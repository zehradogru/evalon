import sys
from pathlib import Path
import csv
import time
import newspaper
from googlenewsdecoder.new_decoderv1 import decode_google_news_url
import re

ROOT_DIR = Path(__file__).resolve().parent
CSV_PATH = ROOT_DIR / "bist-news-data" / "tr_haberler_215206_fixed.csv"
OUT_PATH = ROOT_DIR / "bist-news-data" / "tr_haberler_215206_fixed-2.csv"

def strip_html(text):
    if not text: return ""
    return re.sub(r'<[^>]+>', '', text).replace('&nbsp;', ' ').strip()

def main():
    print(f"Yükleniyor: {CSV_PATH}")
    if not CSV_PATH.exists():
        print("CSV dosyası bulunamadı!")
        return

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)

    # İçeriği boş ve URL'si hala news.google.com olanları say
    total_missing = sum(1 for r in rows if not r.get("content") and "news.google.com" in r.get("url", ""))
    print(f"Kurtarılmayı bekleyen toplam {total_missing} satır var.\n")
    
    fixed_count = 0
    
    for i, row in enumerate(rows):
        if not row.get("content") and "news.google.com" in row.get("url", ""):
            print(f"[{fixed_count+1}/{total_missing}] Deneniyor: {row['symbol']} - {row['title'][:30]}...")
            try:
                # 1. URL'yi şifreden arındır
                dec_res = decode_google_news_url(row["url"])
                actual_url = dec_res.get("decoded_url") if isinstance(dec_res, dict) and dec_res.get("status") else row["url"]

                # 2. Eğer gerçek link bulunduysa haberi çek
                if actual_url and "news.google.com" not in actual_url:
                    config = newspaper.Config()
                    config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
                    
                    article = newspaper.Article(actual_url, language='tr', config=config)
                    article.download()
                    article.parse()
                    
                    if hasattr(article, 'text') and article.text:
                        row["content"] = strip_html(article.text)
                        row["url"] = actual_url  # Şifreli proxy'i gerçek adrese çeviriyoruz
                        fixed_count += 1
                        print(f"  -> Başarılı! Kurtarıldı.")
                    else:
                        print(f"  -> Sayfa açıldı ama metin bulunamadı.")
                else:
                    print(f"  -> Google Decode başarısız (Hala news.google.com). VPN açman gerekiyor olabilir.")
                    
            except Exception as e:
                print(f"  -> Hata: {e}")
            
            # Google'ı kızdırmamak ve rate-limit banından korunmak için 3 sn bekle
            time.sleep(3)
    
    if fixed_count > 0:
        print(f"\n✅ Toplam {fixed_count} satır başarıyla kurtarıldı!")
        print(f"Yeni dosya kaydediliyor: {OUT_PATH}")
        with open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
        print("İşlem tamamlandı.")
    else:
        print("\n❌ Hiç satır kurtarılamadı. VPN/IP değişikliği yapıp tekrar denemeyi unutma!")

if __name__ == "__main__":
    main()
