# BERT v4 Konsensüs Etiketleme Pipeline'ı

## Özet

BIST haber sentiment analizi için %95+ doğruluk hedefli BERT v4 modeli pipeline'ı tasarlandı ve Faz 0–1 çalıştırıldı. Çoklu model konsensüs sistemi (BERT v3 + qwen2.5:7b) ile 5525 haberi otomatik etiketleyen altyapı kuruldu.

## Değişiklik Listesi

### Yeni Eklenen Dosyalar

| Dosya | Açıklama |
|---|---|
| `model_train/sentiment_v4/prepare_data.py` | Faz 0 — veri temizleme, dedup, HTML strip |
| `model_train/sentiment_v4/multi_label.py` | Faz 1 — çoklu model konsensüs etiketleme |
| `model_train/sentiment_v4/build_gold_test.py` | Faz 2 — gold test seti oluşturma (3/3 anlaşma) |
| `model_train/sentiment_v4/train_v4.py` | Faz 3 — konsensüs ağırlıklı BERT fine-tuning |
| `model_train/sentiment_v4/ensemble_predict.py` | Faz 4 — 3 model soft voting ensemble |
| `model_train/sentiment_v4/evaluate.py` | Faz 6 — final metrik değerlendirmesi |

### Oluşturulan Veri Dosyaları

| Dosya | Satır | Açıklama |
|---|---|---|
| `model_train/sentiment_v4/train_unlabeled.csv` | 6000 | Ham eğitim seti (scraped) |
| `model_train/sentiment_v4/test_unlabeled.csv` | 399 | Ham test seti (scraped) |
| `model_train/sentiment_v4/train_clean.csv` | 5525 | Faz 0 çıktısı — temizlenmiş |
| `model_train/sentiment_v4/test_clean.csv` | 373 | Faz 0 çıktısı — temizlenmiş |
| `model_train/sentiment_v4/labeled_train_consensus.csv` | devam ediyor | Faz 1 çıktısı (tam çalışma sürüyor) |

### Değiştirilen Dosyalar

- `model_train/sentiment_v4/multi_label.py` — birden fazla optimizasyon uygulandı (aşağıda detay)

## Teknik Detaylar

### Veri Kaynağı
- **Kaynak**: Oracle DB `BIST_NEWS` tablosu — 6399 satır scrape edilmiş Türkçe BIST haberi
- **Dışlanan**: `model_train/data.csv` — AI tarafından üretilmiş sentetik şablonlar, model kalitesini bozuyor
- **Bölme**: İlk 6000 → train, son 399 → test (sıralı bölme, karışım yok)

### Faz 0 — prepare_data.py
Uygulanan drop kuralları:
- `dup_title`: aynı başlık tekrarı → −239 train, −3 test
- `no_content_short_summary`: içerik yok + özet kısa → −11 train, −1 test
- `too_short`: toplam karakter < 100 → −225 train, −22 test

Her satıra `[TICKER:SEMBOL]` bağlamı eklendi, HTML tag'ler temizlendi, content 1500 karakter ile sınırlandırıldı.

### Faz 1 — multi_label.py Konsensüs Sistemi

**Modeller:**
- `BERT v3` (`dbmdz/bert-base-turkish-cased` fine-tuned, `bist_bert_model_v3/`) — yerel GPU
- `qwen2.5:7b` (Ollama, 4.7GB) — Türkçe destekli multilingual LLM

**Konsensüs Kuralları:**
| Durum | Confidence | Weight |
|---|---|---|
| BERT score ≥ 0.92 (fast-accept) | HIGH | 1.5 |
| 2/2 anlaşma (BERT+qwen) | HIGH | 1.5 |
| 2 model anlaşmazlık + BERT < 0.80 | LOW (qwen etiketi) | 0.5 |
| 2 model anlaşmazlık + BERT ≥ 0.80 | REJECT | 0.0 |

**Optimizasyonlar (bu oturumda uygulandı):**

1. **dolphin-llama3 devre dışı**: Model Türkçeyi anlamıyor, 9/10 satırı OLUMSUZ etiketliyor. qwen olmadan 2-model modunda otomatik engellendi.
2. **BERT fast-accept (≥0.92)**: %70 satır direkt HIGH — Ollama'ya hiç gitmiyor. ~25 saatlik çalışmayı ~1.5 saate indirdi.
3. **GPU VRAM temizleme**: BERT bittikten sonra `torch.cuda.empty_cache()` → qwen GPU'da çalışabildi. Hız: 19s/satır → **3s/satır** (6x).
4. **`num_predict: 5, temperature: 0`**: qwen sadece 1 token üretiyor (NÖTR/OLUMLU/OLUMSUZ).
5. **Checkpoint**: Her 100 uncertain satırda `.multi_label_checkpoint.json` → `--resume` ile kaldığı yerden devam.

**50 satır test sonuçları (son çalışma):**
- Kabul: %92 (46/50)
- HIGH: 38, LOW: 8, REJECT: 4
- Dağılım: NÖTR %67, OLUMSUZ %24, OLUMLU %9

### Model Durumu

| Model | Durum | Notlar |
|---|---|---|
| `dolphin-llama3:latest` | Devre dışı | Türkçeyi anlamıyor |
| `qwen2.5:7b` | Aktif (GPU) | İyi Türkçe, 3s/satır |
| `BERT v3` | Aktif | val_acc=90.27%, test_acc=86.38% |

## Kontrol Listesi

- [x] `train_unlabeled.csv` + `test_unlabeled.csv` bölündü
- [x] `prepare_data.py` çalıştırıldı → `train_clean.csv` (5525), `test_clean.csv` (373)
- [x] `multi_label.py` 50 satır test → %92 kabul, GPU 3s/satır doğrulandı
- [x] `multi_label.py` 50 satır test → %92 kabul, GPU 3s/satır doğrulandı
- [ ] `multi_label.py` tam çalışma (5525 satır) — **⚠️ DURDU** (46/5525 satır, terminal oturumu kapandı, `--resume` ile yeniden başlatılmalı)
- [ ] `build_gold_test.py` çalıştırılacak → `gold_test.csv`
- [ ] `train_v4.py --model savasy` → `bist_bert_model_v4_savasy/`
- [ ] `train_v4.py --model dbmdz` → `bist_bert_model_v4_dbmdz/`
- [ ] `train_v4.py --model xlmr` → `bist_bert_model_v4_xlmr/` (batch=4, grad_accum=2)
- [ ] `ensemble_predict.py` → `ensemble_predictions.csv`
- [ ] `evaluate.py` → acc≥0.95, macro_F1≥0.93 hedefi

## Bilinen Sorunlar / Eksikler

- **OLUMSUZ azlığı**: Train set'te OLUMSUZ oranı düşük (%7-24 arası). `WeightedRandomSampler` bunu dengeleyecek ama dikkat gerekiyor.
- **qwen anlaşmazlık oranı**: 15/50 uncertain satırın 8'i BERT ile çelişiyor. Gerçek BIST haberlerinde BERT v3'ün OLUMLU/OLUMSUZ ayrımı zayıf olabilir.
- **`labeled_train_consensus.csv` henüz tamamlanmadı**: Tam çalışma sürüyor; Faz 2-3-4-6 bu dosyaya bağımlı.
- **Oracle DB güncelleme**: `BIST_NEWS.SENTIMENT` sütunu hâlâ `BEKLIYOR` — v4 eğitildikten sonra `label_oracle_db.py` çalıştırılacak.
- **multi_label.py Faz 1 çökmesi**: Terminal oturumu kapandı, sadece 46/5525 satır etiketlendi. `--resume` flag mevcut — `venv\Scripts\python.exe sentiment_v4\multi_label.py --models bert qwen --resume` komutuyla kaldığı yerden devam edilebilir.
- **Backend API / Frontend**: `/v1/news` endpoint ve frontend news sayfası bu oturumda tamamlandı (ayrıntı: `docs/api-integration/2026-04-24/oracle-news-api-frontend.md`). Cloud Run deploy henüz yapılmadı.
