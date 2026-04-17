from google.oauth2 import service_account
from google.cloud import run_v2

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
REGION = 'europe-west1'
SERVICE = 'evalon-backtest-api'

credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)

client = run_v2.ServicesClient(credentials=credentials)
name = f'projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE}'
service = client.get_service(name=name)

print('Service URI:', service.uri)
print('Observed generation:', service.observed_generation)

for c in service.template.containers:
    print('Container image:', c.image)

# List revisions
rev_client = run_v2.RevisionsClient(credentials=credentials)
parent = f'projects/{PROJECT_ID}/locations/{REGION}/services/{SERVICE}'
revisions = list(rev_client.list_revisions(parent=parent))
print(f'\nRevisions ({len(revisions)}):')
for r in revisions[:5]:
    print(f'  {r.name.split("/")[-1]} | created: {r.create_time} | image: {r.containers[0].image if r.containers else "?"} ')
