"""
Frontend Next.js Docker image build edip Artifact Registry'ye push et,
sonra Cloud Run'a 'evalon-web' servisi olarak deploy et.
"""
import subprocess
import sys
import re
from pathlib import Path
from google.oauth2 import service_account
import google.auth.transport.requests

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
REGION = 'europe-west1'
SERVICE = 'evalon-web'
IMAGE = f'{REGION}-docker.pkg.dev/{PROJECT_ID}/cloud-run-source-deploy/{SERVICE}'
FRONTEND_DIR = r'C:\Users\zehra\Masaüstü\evalonn\frontend'

# Load env vars from .env.local
env_file = Path(FRONTEND_DIR) / '.env.local'
env_vars = {}
for line in env_file.read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        key, _, val = line.partition('=')
        env_vars[key.strip()] = val.strip()

BUILD_ARGS = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    'NEXT_PUBLIC_EVALON_API_URL',
]

# --- Auth ---
credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
request = google.auth.transport.requests.Request()
credentials.refresh(request)
token = credentials.token

print('[1] Authenticating Docker with Artifact Registry...')
auth_result = subprocess.run(
    ['docker', 'login', '-u', 'oauth2accesstoken', '--password-stdin',
     f'{REGION}-docker.pkg.dev'],
    input=token.encode(),
    capture_output=True
)
if auth_result.returncode != 0:
    print('FAIL:', auth_result.stderr.decode())
    sys.exit(1)
print('[OK] Docker auth')

# --- Build ---
print(f'[2] Building frontend image: {IMAGE}...')
build_cmd = ['docker', 'build', '-t', IMAGE]
for key in BUILD_ARGS:
    val = env_vars.get(key, '')
    build_cmd += ['--build-arg', f'{key}={val}']
build_cmd.append('.')

build_result = subprocess.run(build_cmd, cwd=FRONTEND_DIR)
if build_result.returncode != 0:
    print('FAIL: docker build')
    sys.exit(1)
print('[OK] Build')

# --- Push ---
print(f'[3] Pushing {IMAGE}...')
push_result = subprocess.run(['docker', 'push', IMAGE])
if push_result.returncode != 0:
    print('FAIL: docker push')
    sys.exit(1)
print('[OK] Push')

# --- Deploy to Cloud Run ---
print('[4] Deploying to Cloud Run...')
from google.cloud import run_v2

run_credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
client = run_v2.ServicesClient(credentials=run_credentials)
parent = f'projects/{PROJECT_ID}/locations/{REGION}'
name = f'{parent}/services/{SERVICE}'

try:
    service = client.get_service(name=name)
    print(f'  Updating existing service: {SERVICE}')
    for container in service.template.containers:
        container.image = IMAGE
    operation = client.update_service(service=service)
except Exception:
    # Service doesn't exist yet, create it
    print(f'  Creating new service: {SERVICE}')
    from google.cloud.run_v2 import Service, RevisionTemplate, Container
    service = Service()
    service.template = RevisionTemplate()
    container = Container()
    container.image = IMAGE
    service.template.containers = [container]
    service.template.max_instance_request_concurrency = 80
    operation = client.create_service(parent=parent, service=service, service_id=SERVICE)

result = operation.result(timeout=300)
print(f'[OK] Deployed: {result.uri}')
print(f'\nFrontend URL: {result.uri}')
