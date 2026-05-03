#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import csv
import time
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

# Yeni eklendi: NLP ve scraper modulleri eksik oldugu icin GNews (Google News API) direkt entegre edildi.
from gnews import GNews
import newspaper
from googlenewsdecoder.new_decoderv1 import decode_google_news_url
from sentiment_inference import predict_sentiment_for_ticker, warm_up

HISTORY_FILE = ROOT_DIR / "scraper-data" / "scrape_history.json"  

def strip_html(text):
    if not text: return ""
    clean = re.sub(r'<[^>]+>', '', text)
    return clean.replace('&nbsp;', ' ').strip()

def load_history():
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r") as f: return set(json.load(f))
        except: return set()
    return set()

def save_history(history_set):
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_FILE, "w") as f: json.dump(list(history_set), f)

def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()

def dedupe_rows(rows):
    seen = set()
    out = []
    for r in rows:
        k = r.get("url_hash")
        if not k or k in seen: continue
        seen.add(k)
        out.append(r)
    return out

def format_date(dt_str):
    if not dt_str: return ""
    try:
        dt = datetime.strptime(dt_str, "%a, %d %b %Y %H:%M:%S %Z")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return str(dt_str)

def scrape_market(market: str, symbols: list, history: set, limit: int=100, sleep_sec: float=2.0, csv_path=None, csv_fields=None):
    print(f"\n--- {market.upper()} PİYASASI KAYNAKLARI (GNews) YÜKLENİYOR ---")
    
    # GNews nesnemizi olusturuyoruz (Gunluk tetiklenecegi icin sadece o gunun haberlerini cekiyoruz)
    google_news = GNews(language='tr' if market=='tr' else 'en', country='TR' if market=='tr' else 'US', period='1d', max_results=limit)
    
    total_scraped = 0
    for i, symbol in enumerate(symbols, 1):
        print(f"[{market.upper()}] ({i}/{len(symbols)}) Sembol taranıyor: {symbol}")
        symbol_articles = []
        
        try:
            # Sadece ozel sirket/hisse filtrelemesi
            query = f"{symbol} hisse" if market == "tr" else f"{symbol} stock news"
            news_items = google_news.get_news(query)
            
            for item in news_items:
                url = item.get("url", "")
                title = item.get("title", "")
                
                url_hash = sha256_text(url) if url else sha256_text(title)
                
                if url_hash in history:
                    continue # Zaten eklendi
                
                # Makale icerigine git (Gnews RSS proxy'lerini asip orijinal siteyi buluyoruz)
                article_content = ""
                print(f"      -> '{symbol}' haber detayı indiriliyor... ({title[:40]}...)")
                
                try:
                    dec_res = decode_google_news_url(url)
                    actual_url = dec_res.get("decoded_url") if isinstance(dec_res, dict) and dec_res.get("status") else url
                    url = actual_url # URL'yi de gercek URL ile guncelliyoruz
                    
                    config = newspaper.Config()
                    config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    
                    article = newspaper.Article(actual_url, language='tr' if market == 'tr' else 'en', config=config)
                    article.download()
                    article.parse()
                    
                    if hasattr(article, 'text') and article.text:
                        article_content = strip_html(article.text)

                    # trafilatura: newspaper3k boş döndüyse daha iyi içerik çekicisi dene
                    if not article_content:
                        try:
                            import trafilatura
                            fetched = trafilatura.fetch_url(actual_url)
                            if fetched:
                                article_content = trafilatura.extract(fetched) or ""
                        except Exception as te:
                            print(f"         [Trafilatura] İçerik çekme başarısız: {te}")
                        
                except Exception as e:
                    print(f"         [Uyarı] Makale metni okunamadı: {e}")
                
                summary_text = strip_html(item.get("description", ""))
                # Sembolle ilgili cümleler üzerinden ticker-aware sentiment tahmin et
                sentiment_label, _ = predict_sentiment_for_ticker(
                    symbol=symbol,
                    title=title,
                    summary=summary_text,
                    content=article_content,
                )

                d = {
                    "market": market.upper(),
                    "symbol": symbol,
                    "source": item.get('publisher', {}).get('title', 'Google News'),
                    "title": title,
                    "summary": summary_text,
                    "content": article_content,
                    "sentiment": sentiment_label,
                    "url": url,
                    "author": "Bilinmiyor",
                    "published_at": format_date(item.get("published date")),
                    "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "url_hash": url_hash
                }
                
                history.add(url_hash)
                symbol_articles.append(d)
                time.sleep(1) # Haberi okuduktan sonra spam atmayalim

        except Exception as e:
            print(f"   -> Hata ({symbol}): Gećildi. Hata: {e}")
        
        # O hisse icin listeyi tekil hale getir
        symbol_articles = dedupe_rows(symbol_articles)
        
        # Her hisse sonrasi eldeki veriyi aninda diskteki CSV'ye ekle
        if symbol_articles and csv_path and csv_fields:
            with open(csv_path, "a", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction='ignore')
                writer.writerows(symbol_articles)
            # Crash durumunda basa sarmamak icin history'i de o an kaydet
            save_history(history)
            
        total_scraped += len(symbol_articles)
        
        # Her sembol sonrasi ufak bir bekleme
        time.sleep(sleep_sec)
            
    return total_scraped

def load_tickers_from_json():
    json_path = ROOT_DIR / "bist_tickers.json"
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("tr", [])
    except Exception as e:
        print(f"BIST ticker JSON okunamadı: {e}")
        return []

def main():
    out_dir = ROOT_DIR / "bist-news-data"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # JSON dosyasından tüm ticker'ları çekiyoruz
    tr_symbols = load_tickers_from_json()
    if not tr_symbols:
        print("Uyarı: JSON tablosundan ticker yüklenemedi!")
        tr_symbols = []

    markets = {
        "tr": tr_symbols
    }
    
    # CSV formatı sütunlar
    csv_fields = ["market", "symbol", "source", "title", "summary", "content", "sentiment", "url", "author", "published_at", "scraped_at", "url_hash"]

    print("="*60)
    print("TÜM BORSALAR İÇİN HABER TARAMASI BAŞLATILDI")
    print(f"Hedef Klasör: {out_dir}")
    print("="*60)

    history = load_history()

    # Sentiment modelini scraping başlamadan ısıt (ilk haberde gecikme olmasın)
    print("Sentiment modeli yükleniyor...")
    warm_up()
    print("Sentiment modeli hazır. Haber taraması başlıyor...")

    for market, syms in markets.items():
        print(f"\n>>>> {market.upper()} PİYASASI ÇEKİMİ BAŞLIYOR <<<<")
        
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = out_dir / f"{market}_haberler_{ts}.csv"
        
        # En basta dosyayi olusturup sütun basliklarini at
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction='ignore')
            writer.writeheader()
        
        # Günlük çalışacağı için her hissenin en güncel 15 haberine bakması yeterli olacaktır.
        rows_count = scrape_market(market, syms, history, limit=15, sleep_sec=1.0, csv_path=csv_path, csv_fields=csv_fields)
        
        if rows_count == 0:
            print(f"\n✅ {market.upper()} TAMAMLANDI! Yeni haber bulunamadı.")
            continue
            
        print(f"\n==============================================")
        print(f"✅ {market.upper()} TAMAMLANDI! Toplam {rows_count} yeni haber kaydedildi -> {csv_path.name}")
        print(f"==============================================\n")
        
    save_history(history)
    print("MÜKEMMEL! TÜM PİYASALARIN ÇEKİMİ VE CSV KAYITLARI BİTTİ.")

if __name__ == "__main__":
    main()