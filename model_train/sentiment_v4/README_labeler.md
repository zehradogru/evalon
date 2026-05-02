# BIST Haber Sentiment Etiketleyici — Kurulum ve Kullanım Kılavuzu

Bu araç, BIST haber başlık ve özetlerini **3 farklı yerel LLM** kullanarak
**OLUMLU / OLUMSUZ / NÖTR** olarak etiketler.

3 modelin oylamasına göre iki ayrı çıktı üretir:
- `output/unanimous_labeled.csv` — 3 modelin de aynı kararı verdiği satırlar **(yüksek güven)**
- `output/majority_labeled.csv`  — 2 modelin aynı kararı verdiği satırlar **(orta güven)**
- `output/rejected.csv`          — 3 model anlaşamadı, eğitime girmez

---

## Gereksinimler

- **Python 3.10+** — https://www.python.org/downloads/
- **Ollama** — https://ollama.com/download  
  Windows'ta kurulumdan sonra sistem tepsisinde çalışır.
- **GPU**: NVIDIA RTX 5070 veya benzeri 8GB+ VRAM önerilir  
  (CPU ile de çalışır ama çok yavaş olur)

---

## Adım 1 — Ollama Kurulumu ve Model İndirme

Ollama kurduktan sonra bir terminal açıp modelleri indirin.  
Toplam indirme boyutu ~**20 GB**'tır, internet hızınıza göre 20-60 dk sürebilir.

```powershell
ollama pull qwen3:14b        # ~8.5 GB  — en iyi Türkçe anlama
ollama pull gemma3:12b       # ~7.3 GB  — Google, güçlü
ollama pull llama3.1:latest  # ~4.9 GB  — Meta, denge
```

Modellerin indirildiğini doğrulamak için:
```powershell
ollama list
```

---

## Adım 2 — Python Ortamı Kurulumu

Proje klasörüne gidin (zip'i çıkardığınız yer):

```powershell
cd C:\sentiment_labeler

# Sanal ortam oluştur
python -m venv venv

# Aktifleştir (Windows)
venv\Scripts\activate

# Bağımlılıkları kur
pip install -r requirements_labeler.txt
```

---

## Adım 3 — Girdi Dosyasını Kopyalayın

`bist_haberler_ALL_content.csv` dosyasını bu klasöre kopyalayın.  
Dosya formatı: `market, symbol, source, title, summary, content, sentiment, url, ...` kolonlarını içermelidir.

---

## Adım 4 — Önce Test Edin (10 satır)

Ollama'nın çalıştığından emin olmak için küçük bir test yapın:

```powershell
# Sanal ortam aktifse:
python triple_label.py --limit 10
```

Her model sırasıyla çalışır, terminalden ilerlemeyi görebilirsiniz:
```
── Faz A: qwen3:14b ──
  qwen3:14b yükleniyor... hazır.
  qwen3:14b: 100%|█████| 10/10 [00:45<00:00]
── Faz B: gemma3:12b ──
  ...
```

---

## Adım 5 — Tam Çalıştırma (14.000+ satır)

```powershell
python triple_label.py
```

**Tahmini süre:** ~3-5 saat (3 model × 14k satır × ~0.5s/satır)

Yarıda kesilirse `--resume` ile kaldığı yerden devam eder:
```powershell
python triple_label.py --resume
```

---

## Adım 6 — Farklı Girdi Dosyası

```powershell
python triple_label.py --input C:\diger_haberler.csv
```

---

## Çıktı Dosyaları

Tüm sonuçlar `output/` klasörüne yazılır:

| Dosya | Açıklama | Güven | Eğitimde Kullanım |
|---|---|---|---|
| `unanimous_labeled.csv` | 3/3 model aynı karar | HIGH (weight=2.0) | ✅ Öncelikli |
| `majority_labeled.csv` | 2/3 model aynı karar | MEDIUM (weight=1.0) | ✅ Kullanılabilir |
| `rejected.csv` | 3 model anlaşamadı | REJECT (weight=0.0) | ❌ Kullanma |

### Kolon açıklamaları:
- `orig_idx` — girdi CSV'sindeki satır numarası
- `text` — etiketlenen metin (title+summary+content birleşimi)
- `label` — final etiket: `OLUMLU`, `OLUMSUZ`, `NÖTR`
- `confidence` — `HIGH` / `MEDIUM` / `REJECT`
- `weight` — eğitimde bu satıra verilecek ağırlık (2.0 / 1.0 / 0.0)
- `model_a_label` — qwen3:14b kararı
- `model_b_label` — gemma3:12b kararı
- `model_c_label` — llama3.1 kararı

---

## Sorun Giderme

**"Ollama erişilemiyor" hatası:**  
→ Windows sistem tepsisinde Ollama ikonuna sağ tıklayıp "Start" deyin,  
  veya terminalde `ollama serve` komutunu çalıştırın.

**Model indirildiyse ama "bulunamadı" hatası:**  
→ `ollama list` ile model adını kontrol edin. Farklıysa `triple_label.py` dosyasının  
  başındaki `MODEL_A`, `MODEL_B`, `MODEL_C` sabitlerini güncelleyin.

**GPU yerine CPU çalışıyor (çok yavaş):**  
→ NVIDIA sürücüleri güncel mi? `nvidia-smi` komutuyla VRAM kullanımını kontrol edin.  
  Ollama CUDA'yı otomatik algılamalıdır.

**Bir model yoksa:**  
→ Script eksik modeli atlar ama uyarı verir. 2 modelle 2/2 = yüksek güven,  
  1 modelle ise devam etmez.

---

## Modelleri Değiştirmek İsterseniz

`triple_label.py` dosyasının başındaki satırları düzenleyin:

```python
MODEL_A = "qwen3:14b"       # değiştirilebilir
MODEL_B = "gemma3:12b"      # değiştirilebilir
MODEL_C = "llama3.1:latest" # değiştirilebilir
```

Mevcut ve önerilen modeller:
```
ollama pull qwen2.5:14b    # qwen3:14b alternatifi, biraz daha küçük
ollama pull mistral:7b     # hızlı ama zayıf Türkçe
```
