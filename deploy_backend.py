"""
Docker ile backend image build edip Artifact Registry'ye push et,
sonra Cloud Run'ı yeni image ile güncelle.
"""
import subprocess
import sys
import json
from google.oauth2 import service_account
import google.auth.transport.requests

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
REGION = 'europe-west1'
SERVICE = 'evalon-backtest-api'
IMAGE = f'{REGION}-docker.pkg.dev/{PROJECT_ID}/cloud-run-source-deploy/{SERVICE}'

credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)

# Get access token for Docker auth
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

print(f'[2] Building image: {IMAGE}...')
build_result = subprocess.run(
    ['docker', 'build', '-t', IMAGE, '.'],
    cwd=r'C:\Users\zehra\Masaüstü\evalonn\backend\backtest',
    capture_output=False  # show live output
)
if build_result.returncode != 0:
    print('FAIL: docker build')
    sys.exit(1)
print('[OK] Build')

print(f'[3] Pushing {IMAGE}...')
push_result = subprocess.run(
    ['docker', 'push', IMAGE],
    capture_output=False
)
if push_result.returncode != 0:
    print('FAIL: docker push')
    sys.exit(1)
print('[OK] Push')

print('[4] Deploying to Cloud Run...')
from google.cloud import run_v2

run_credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
client = run_v2.ServicesClient(credentials=run_credentials)
name = f'projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE}'
service = client.get_service(name=name)

# Update image
for container in service.template.containers:
    container.image = IMAGE
    print(f'  Image set to: {IMAGE}')

operation = client.update_service(service=service)
result = operation.result(timeout=180)
print(f'[OK] Deployed: {result.uri}')
