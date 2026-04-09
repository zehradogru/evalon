from gnews import GNews
from googlenewsdecoder.new_decoderv1 import decode_google_news_url
import newspaper

google_news = GNews(language='tr', country='TR', period='7d', max_results=1)    
news = google_news.get_news('THYAO hisse')
for n in news:
    print('BASLIK:', n['title'])
    
    # URL'yi coz!
    dec_res = decode_google_news_url(n['url'])
    print(dec_res)
    actual_url = dec_res.get('decoded_url') if dec_res.get('status') else n['url']
    print('GERCEK URL:', actual_url)
    
    article = newspaper.Article(actual_url)
    article.download()
    article.parse()
    
    print('CONTENT LEN:', len(article.text))
    print('CONTENT SAMPLE:', article.text[:250])
