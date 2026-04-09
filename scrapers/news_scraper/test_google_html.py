import requests, re
from bs4 import BeautifulSoup
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
url = 'https://www.google.com.tr/search?q=THYAO+hisse+haberler&tbm=nws'
r = requests.get(url, headers=headers)
soup = BeautifulSoup(r.text, 'html.parser')
links = []
for a in soup.find_all('a'):
    href = a.get('href', '')
    if href.startswith('http') and 'google.com' not in href:
        links.append(href)
print("Found real links:", links[:3])
