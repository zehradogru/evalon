import pandas as pd
import google.generativeai as genai
import time
import os

# 1. API Ayarları
# API key'i ortam değişkeninden almayı deneyelim, yoksa varsayılanı bırakalım
API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyA5hlkKWt9sw-CF9IvUeyHaNh24NiRRPBs")
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

def get_gemini_sentiment(title, summary, content):
    # Çok uzun metinleri kesiyoruz (Sadece başlık, özet ve içeriğin ilk 400 karakteri)
    kisa_icerik = str(content)[:400] 
    
    prompt = f"""
    Sen bir Borsa İstanbul (BIST) analistisin. 
    Aşağıdaki haberin hisse senedi fiyatına etkisini analiz et.
    Sadece şu 3 kelimeden birini söyle: OLUMLU, OLUMSUZ, NÖTR.
    Açıklama yapma, sadece tek kelime cevap ver.
    
    Başlık: {title}
    Özet: {summary}
    İçerik Girişi: {kisa_icerik}
    """
    
    try:
        response = model.generate_content(prompt)
        cevap = response.text.strip().upper()
        # Bazen AI nokta koyabilir, temizleyelim
        cevap = cevap.replace(".", "").replace("\n", "")
        
        if cevap in ["OLUMLU", "OLUMSUZ", "NÖTR"]:
            return cevap
        return "NÖTR"
    except Exception as e:
        print(f"Hata oluştu: {e}")
        return "BEKLIYOR"

# 2. Scraper'dan çıkan veriyi oku
dosya_adi = "bist-news-data/tr_haberler_215206_fixed-2.csv" # En son güncellenen csv
print(f"{dosya_adi} okunuyor...")
df = pd.read_csv(dosya_adi)

# Sadece BEKLIYOR olanları bulalım
islem_yapilacaklar = df[df['sentiment'] == "BEKLIYOR"].index
toplam = len(islem_yapilacaklar)

print(f"Toplam {toplam} adet haber etiketlenecek. Başlıyor...")

# 3. Döngü ile Gemini'ye sor
for i, index in enumerate(islem_yapilacaklar, 1):
    satir = df.loc[index]
    
    print(f"[{i}/{toplam}] Analiz ediliyor: {satir['symbol']} - {str(satir['title'])[:40]}...")
    
    duygu = get_gemini_sentiment(satir['title'], satir['summary'], satir['content'])
    
    # DataFrame'i güncelle
    df.at[index, 'sentiment'] = duygu
    print(f"   ---> Sonuç: {duygu}")
    
    # Her 10 haberde bir CSV'yi güncelleyelim (Elektrik giderse baştan başlamamak için)
    if i % 10 == 0:
        df.to_csv("bist-news-data/etiketlenmis_veri_seti.csv", index=False)
        
    # BEDAVA KOTA İÇİN BEKLEME SÜRESİ (Dakikada 15 istek sınırı)
    time.sleep(4.2) 

# Bittiğinde son kez kaydet
df.to_csv("bist-news-data/etiketlenmis_veri_seti.csv", index=False)
print("HARİKA! TÜM VERİLER ETİKETLENDİ VE 'bist-news-data/etiketlenmis_veri_seti.csv' DOSYASINA KAYDEDİLDİ.")
