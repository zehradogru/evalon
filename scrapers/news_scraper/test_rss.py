import feedparser, re
feed = feedparser.parse('https://news.google.com/rss/search?q=THYAO+hisse&hl=tr&gl=TR&ceid=TR:tr')
if feed.entries:
    e = feed.entries[0]
    print(e.title)
    print(e.link)
    text = re.sub(r'<[^>]+>', '', e.summary)
    print("Summary:", text.replace('&nbsp;', ' ').strip())
