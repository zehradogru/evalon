from google.oauth2 import service_account
from googleapiclient import discovery

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
svc = discovery.build('run', 'v2', credentials=credentials)

# Service env vars al
name = f'projects/{PROJECT_ID}/locations/europe-west1/services/evalon-backtest-api'
result = svc.projects().locations().services().get(name=name).execute()

containers = result.get('template', {}).get('containers', [])
for container in containers:
    envs = container.get('env', [])
    print('=== ENV VARS ===')
    for e in envs:
        print(f"  {e.get('name')}: {e.get('value','(secret)')}")
