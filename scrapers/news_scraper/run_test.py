import scrapers.news_scraper.collect_markets_news as c

def test_main():
    print('Testing with 2 tickers...')
    symbols = c.load_tickers_from_json()[:2]
    history = c.load_history()
    out_dir = c.ROOT_DIR / 'scraper-data' / 'butun_borsalar_csv'
    out_dir.mkdir(parents=True, exist_ok=True)
    
    rows = c.scrape_market('tr', symbols, history, limit=2, sleep_sec=1.0)
    
    print(f'Scraped {len(rows)} articles.')
    for r in rows:
        print(f"[{r['symbol']}] URL: {r['url']}")
        print(f"CONTENT LEN: {len(r['content'])}")
        print(f"CONTENT SNEAK PEEK: {r['content'][:150]}...\n")

if __name__ == '__main__':
    test_main()
