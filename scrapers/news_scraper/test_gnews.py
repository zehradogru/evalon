from gnews import GNews
google_news = GNews(language='tr', country='TR', period='7d', max_results=2)   
news = google_news.get_news('THYAO hisse')
for n in news:
    print("BASLIK:", n['title'])
    article = google_news.get_full_article(n['url'])
    print("URL:", n['url'])
    if article:
        print("CONTENT LEN:", len(article.text))
        print("CONTENT:", article.text[:200])
    else:
        print("CONTENT_LEN: failed")
