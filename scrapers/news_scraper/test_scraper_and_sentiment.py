import json
import sys
import time
import urllib.parse
from pathlib import Path
from datetime import datetime
import feedparser
import requests
from bs4 import BeautifulSoup

try:
    from transformers import pipeline
    import torch
    # HuggingFace pipeline model max 512 tokens (kelime parcasi) alacak sekilde truncate (kirpma) parametreleriyle yukuletiyoruz
    print("[+] Transformers modeli yükleniyor... (savasy/bert-base-turkish-sentiment-cased)")
    sentiment_model = pipeline("sentiment-analysis", model="savasy/bert-base-turkish-sentiment-cased", truncation=True, max_length=512)
    USE_ML = True
    print("[+] Model yüklendi!")
except ImportError:
    USE_ML = False
    print("[-] Transformers yüklü değil!")

def fetch_article_content(url):
    """
    Verilen URL'ye gider, sitenin HTML'ini indirir ve asil haber metnini ayiklar.
    """
    try:
        # Bot korumasina takilmamak icin User-Agent ekliyoruz
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()
        
        # Google News RSS link redirects to the actual news automatically if we follow redirects, 
        # But sometimes Google wrapper blocks parsing by using a JS redirect. 
        # Using a simple check to see if there is a meta refresh or fallback to article text:
        html = response.text
        import re
        
        # Sadece gecerli bir HTTP/HTTPS linkiyle baslayan URL'leri al, JS kodlarina takilma
        match = re.search(r'(?i)url=(https?://[^\'">\s]+)', html)
        if hasattr(match, 'group'):
            actual_url = match.group(1)
            # Gercek siteye tekrar istek at
            response = requests.get(actual_url, headers=headers, timeout=15, allow_redirects=True)
            html = response.text
        else:
            # Eger "url=" yapisi bulamazsa sayfadaki ilk gercek dis linki bulmaya calis
            match_a = re.search(r'<a\s+(?:[^>]*?\s+)?href=["\'](https?://[^\'">]+)["\']', html, re.IGNORECASE)
            if hasattr(match_a, 'group') and "news.google" not in match_a.group(1):
                actual_url = match_a.group(1)
        
        # Genelde haber metinleri <p> etiketleri icindedir.
        # Javascript kodlari ve kisa buton yazilari ciksin diye uzunluk filtresi koyuyoruz.
        paragraphs = soup.find_all("p")
        content_texts = []
        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) > 40: # 40 karakterden kisa p'leri (reklam/menu) yoksay
                content_texts.append(text)
                
        full_content = " ".join(content_texts)
        return full_content
    except Exception as e:
        return f"ICERIK_CEKILEMEDI: {e}"

def analyze_sentiment(content):
    """Asil haber metni (full content) uzerinden duygu analizi yapar."""
    if not content.strip() or content.startswith("ICERIK"):
        return "Nötr (İçerik Yok)"

    if USE_ML:
        try:
            # Model cok uzun metinlerde yorulmasin veya patlamasin diye 
            # metnin ilk 300-350 kelimesini (kabaca haberin asil icerik kismini) aliyoruz
            words = content.split()[:350]
            short_text = " ".join(words)
            
            result = sentiment_model(short_text)[0]
            label = result['label'].lower()
            return "Olumlu" if label == "positive" else "Olumsuz"
        except Exception as e:
            return f"Nötr (Hata: {e})"
    else:
        return "Nötr"

def get_bing_news_rss(symbol, limit=4):
    """Yahoo News kullanarak arama yapar ve direkt linkleri alir."""
    query = f"{symbol} hisse ekonomi"
    query_encoded = urllib.parse.quote(query)
    
    url = f"https://news.search.yahoo.com/rss?p={query_encoded}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        feed = feedparser.parse(response.content)
    except:
        return []

    articles = []
    entries = getattr(feed, 'entries', [])
    if not entries:
        print("  -> Yahoo feedi bos dondu! URL: " + url)

    for entry in entries[:limit]:
        pub_date = entry.get('published', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        title = entry.get('title', '')
        link = entry.get('link', '')

        # Haberin dogrudan kaynagina in
        content = fetch_article_content(link)

        # Analizi icerikten yap!
        sentiment = analyze_sentiment(content)

        articles.append({
            "sembol": symbol,
            "tarih": pub_date,
            "baslik": title,
            "icerik_uzunlugu": len(content),
            "duygu_analizi": sentiment,
            "link": link,
            "tam_metin": content[:300] + '...' if len(content)>300 else content
        })
    return articles

def main():
    root_dir = Path(__file__).resolve().parent
    tickers_file = root_dir / "bist_tickers.json"
    data_dir = root_dir / "data"
    data_dir.mkdir(exist_ok=True)

    with open(tickers_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        bist_symbols = data.get("tr", [])

    print(f"\n=======================================================")
    print(f"GERCEK TAM ICERIK & AI DUYGU ANALIZI TESTI (Sadece %s)" % bist_symbols[:2])
    print(f"=======================================================\n")

    all_news = []
    for symbol in bist_symbols[:2]:
        print(f"[*] {symbol} haberleri araniyor ve sitelere gidiliyor...")      
        news = get_bing_news_rss(symbol, limit=2)
        for n in news:
            print(f"  -> B: {n['baslik'][:70]}...")
            print(f"  -> Cekilen Metin: {n['icerik_uzunlugu']} karakter...")      
            print(f"  => AI SONUCU: {n['duygu_analizi']}\n")
        all_news.extend(news)
        time.sleep(1) # Sitelere spam atmamak pahasina
        
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_path = data_dir / f"gercek_icerik_analiz_{timestamp}.json"
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_news, f, ensure_ascii=False, indent=4)
        
    print(f"[+] Detayli sonuclar kaydedildi: {output_path.resolve()}")

if __name__ == '__main__':
    main()
