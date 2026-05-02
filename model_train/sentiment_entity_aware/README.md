# BIST Entity-Aware Sentiment Analysis

Bu klasör, standart duygu analizi yerine **Hisse Özelinde (Entity-Aware)** duygu analizi yapabilen bir BERT modeli eğitmek için gereken tüm kod ve verileri içerir.

## Farkı Nedir?
Eski modeller (Sequence Classification) sadece metni okuyup genel havasına göre etiketleme yapıyordu.
Bu modelin Tokenizer'ı özel olarak ayarlanmıştır. Girdileri şu şekilde alır:
`[CLS] IZENR [SEP] Yatırım fonlarının aldığı 10 hisse şunlardır... [SEP]`

Bu sayede model, metnin genel havasına değil, **ilk başta verilen hisse kodu (entity) ile metin arasındaki ilişkiye** odaklanmayı öğrenir.

## Klasörü Başka PC'de Çalıştırma (Arkadaşının PC'si)

Bu klasörü (`sentiment_entity_aware`) olduğu gibi flash belleğe atıp veya zipleyip arkadaşının PC'sine atabilirsin. Arkadaşının PC'sinde en az 8GB VRAM'li bir NVIDIA GPU olması eğitimi çok hızlandırır.

### Adım 1: Kurulum
Arkadaşının bilgisayarında klasörü açıp terminalde:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Adım 2: Veri Hazırlığı
`data` klasörü içinde kopyaladığımız CSV dosyaları duruyor. Bunları modelin anlayacağı formata (Train/Val/Test) çevirmek için:
```bash
python prepare_data.py
```
Bu işlem `data` klasörü içine `train.csv`, `val.csv` ve `test.csv` oluşturacak.

### Adım 3: Model Eğitimi (Train)
Veri hazır olduktan sonra eğitimi başlatmak için:
```bash
python train.py --epochs 5 --batch 16
```

Bu işlem bittiğinde `final_model_entity_aware` adında bir klasör oluşacak. Bu klasör, uygulamada (Evalon) kullanıma hazır olan eğitilmiş modelindir!
