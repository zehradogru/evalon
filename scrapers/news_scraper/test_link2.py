import requests, re
url = 'https://news.google.com/rss/articles/CBMinwFBVV95cUxNTmF5emVPMklLR2w5bG5lX05ydTdsS0JyQi1rVXktT0htNF9tUC1qU1NCa1RmZmVVcnlyTHdEMjhoVDRGSzduLXd2OWVKV0hhdkdDb3N5R2poTEgySXg3d0F5TTIzS05LNFMtZkttU2RLY0xEdUR3OHA0N1ltV1VNMVNuU2RHOUpWaHJnWkNrOElrTWpob1BCbXh4dlhyOHM?oc=5'
r = requests.get(url)
match = re.search(r'data-n-v="([^"]+)"', r.text)
if match: print("DATA-N-V found: " + match.group(1))
matches = re.findall(r'<a[^>]+href="([^"]+)"', r.text)
print("Links: " + str(matches[:5]))
import base64
print("Text length:", len(r.text))
