"""
Docker ile backend image build edip Artifact Registry'ye push et,
sonra Cloud Run'ı yeni image ile güncelle.
"""
import subprocess
import sys
import json
import shlex
from datetime import datetime
from google.oauth2 import service_account

GCLOUD = r'C:\Users\zehra\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
REGION = 'europe-west1'
SERVICE = 'evalon-backtest-api'
TAG = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
IMAGE_BASE = f'{REGION}-docker.pkg.dev/{PROJECT_ID}/cloud-run-source-deploy/{SERVICE}'
IMAGE = f'{IMAGE_BASE}:{TAG}'

credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)

print(f'[1] Building & pushing image via Cloud Build: {IMAGE}...')
build_result = subprocess.run(
    [GCLOUD, 'builds', 'submit',
     '--tag', IMAGE,
     '--project', PROJECT_ID,
     '.'],
    cwd=r'C:\Users\zehra\Masaüstü\evalonn\backend\backtest',
)
if build_result.returncode != 0:
    print('FAIL: gcloud builds submit')
    sys.exit(1)
print('[OK] Build & Push')

print('[4] Deploying to Cloud Run...')
from google.cloud import run_v2
from google.cloud.run_v2.types import VpcAccess

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

    # REDIS_URL sırrını ekle/güncelle
    from google.cloud.run_v2.types import EnvVar, EnvVarSource, SecretKeySelector
    redis_env = EnvVar(
        name='REDIS_URL',
        value_source=EnvVarSource(
            secret_key_ref=SecretKeySelector(
                secret=f'projects/{PROJECT_ID}/secrets/REDIS_URL',
                version='latest',
            )
        ),
    )
    # Mevcut REDIS_URL env var'ını kaldır (adına göre), sonra yenisini ekle
    container.env[:] = [ev for ev in container.env if ev.name != 'REDIS_URL']
    container.env.append(redis_env)
    print('  REDIS_URL secret bağlandı.')

# Serverless VPC Access connector ekle (Memorystore erişimi için zorunlu)
vpc_connector = f'projects/{PROJECT_ID}/locations/{REGION}/connectors/evalon-vpc-connector'
service.template.vpc_access.connector = vpc_connector
service.template.vpc_access.egress = VpcAccess.VpcEgress.ALL_TRAFFIC
print(f'  VPC connector: {vpc_connector}')

operation = client.update_service(service=service)
result = operation.result(timeout=180)
print('[OK] Deployed: ' + result.uri)

