from google.oauth2 import service_account
from googleapiclient import discovery

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
TARGET_SA = 'evalon-backtest-run@evalon-490523.iam.gserviceaccount.com'

credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)

crm = discovery.build('cloudresourcemanager', 'v1', credentials=credentials)

policy = crm.projects().getIamPolicy(resource=PROJECT_ID, body={}).execute()

print(f'Checking roles for: {TARGET_SA}\n')
for binding in policy.get('bindings', []):
    members = binding.get('members', [])
    for m in members:
        if TARGET_SA in m:
            print(f'  Role: {binding["role"]}')
