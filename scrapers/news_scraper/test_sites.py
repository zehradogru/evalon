import requests
from bs4 import BeautifulSoup

url = 'https://www.hurriyet.com.tr/arama/?kelime=GARAN'
r = requests.get(url)
soup = BeautifulSoup(r.text, 'html.parser')
for item in soup.find_all('a', class_='category-list__link')[:3]:
    print("Hurriyet Link:", item.get('href'))

url2 = 'https://www.bloomberght.com/arama/GARAN'
r2 = requests.get(url2)
soup2 = BeautifulSoup(r2.text, 'html.parser')
for item in soup2.find_all('a', class_='list-item')[:3]:
    print("Bloomberg Link:", item.get('href'))
