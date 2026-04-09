import requests
url='https://news.google.com/rss/articles/CBMiY0FVX3lxTE1iVHZiQjN5S2o2YUlPeTVNR2gzV3JiMzhzQmZqR2Rqa1p4ZjR0emlDcl9FZ2dpcFBpY3MtTHFLMmp5ZFYzemMzS3gzdEx5dTQ4bnAxZ01FZlNpc0ZLRWoxWm15bw'
r = requests.get(url)
print(r.text)
