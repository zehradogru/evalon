"""
Test Vertex AI with evalon-backtest-run SA credentials (as if running in Cloud Run)
"""
import os
from google.oauth2 import service_account

KEY_FILE = r'C:\Users\zehra\Masaüstü\evalonn\backend\evalon-490523-cb27db47fd0a.json'
PROJECT_ID = 'evalon-490523'
LOCATION = 'us-central1'

# Use the cloud run service account key
credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)

# Patch google.auth to use these credentials
import google.auth
import google.auth.credentials

# Test 1: Can we import google.genai?
try:
    from google import genai
    print('[OK] google.genai imported')
except Exception as e:
    print(f'[FAIL] google.genai import: {e}')
    exit(1)

# Test 2: Can we create a Vertex AI client?
try:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION, credentials=credentials)
    print('[OK] genai.Client created')
except Exception as e:
    print(f'[FAIL] genai.Client: {e}')
    exit(1)

# Test 3: generate content WITHOUT json mime
try:
    from google.genai import types
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Say hello in one word',
        config=types.GenerateContentConfig(max_output_tokens=50)
    )
    print(f'[OK] Response (plain): {response.text}')
except Exception as e:
    print(f'[FAIL] generate_content plain: {type(e).__name__}: {e}')

# Test 4: generate content WITH response_mime_type=application/json (as gateway uses)
try:
    response2 = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Return JSON: {"reply": "hello"}',
        config=types.GenerateContentConfig(
            response_mime_type='application/json',
            max_output_tokens=100,
        )
    )
    print(f'[OK] Response (json mime): {response2.text}')
except Exception as e:
    print(f'[FAIL] generate_content json mime: {type(e).__name__}: {e}')
