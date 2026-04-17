from google.oauth2 import service_account
from googleapiclient import discovery

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=['https://www.googleapis.com/auth/cloud-platform']
)
svc = discovery.build('logging', 'v2', credentials=credentials)

# /ai endpoint request logs
f = (
    'resource.type=cloud_run_revision '
    'resource.labels.service_name=evalon-backtest-api '
    'httpRequest.requestUrl=~"/ai/"'
)
body = {'resourceNames': ['projects/' + PROJECT_ID], 'filter': f, 'orderBy': 'timestamp desc', 'pageSize': 20}

result = svc.entries().list(body=body).execute()
entries = result.get('entries', [])
print('AI endpoint requests:', len(entries))
for e in entries:
    req = e.get('httpRequest', {})
    print(e.get('timestamp', '')[:19], req.get('requestMethod'), req.get('requestUrl','')[:100], 'status:', req.get('status'))
