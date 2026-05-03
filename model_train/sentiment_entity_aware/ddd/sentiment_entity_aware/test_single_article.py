#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_single_article.py — Tek bir haberi her iki modelle etiketler ve karşılaştırır.
"""
from pathlib import Path
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = Path(__file__).resolve().parent
OLD_MODEL_PATH = Path(r"C:\Users\zehra\Masaüstü\evalonn\model_train\sentiment_v4\final_model_dbmdz")
NEW_MODEL_PATH = HERE / "final_model_entity_aware"

ID2LABEL = {0: "NÖTR", 1: "OLUMLU", 2: "OLUMSUZ"}

# ── Haber ─────────────────────────────────────────────────────────────────────
TITLE = "Tüpraş, THY ve SASA zirveyi bırakmıyor! İşte yatırımcı sayısı en yüksek 20 hisse"
TEXT = """\
Borsa İstanbul'da 27-30 Nisan haftası sonrasında, halka açık şirketler arasında yatırımcıların \
en çok tercih ettiği hisse senetleri belli oldu. Son verilere göre THY, zirveyi Tüpraş'tan \
teslim aldı. İşte borsada en fazla yatırımcı sayısına sahip 20 hisse senedi.

Buna göre borsada en çok yatırımcısı olan şirket 822.007 yatırımcı ile Türk Hava Yolları A.O. \
(THYAO) oldu. Onu 821.615 yatırımcı sayısı ile Tüpraş Türkiye Petrol Rafinerileri A.Ş. (TUPRS) \
ve 689.765 yatırımcı sayısı ile Sasa Polyester Sanayi A.Ş. (SASA) izledi.

Yatırımcı sayısı en yüksek şirketler:
1. THYAO  - 822.007   2. TUPRS  - 821.615   3. SASA   - 689.765
4. ASELS  - 581.001   5. ISCTR  - 518.121   6. HEKTS  - 496.585
7. SISE   - 476.538   8. PGSUS  - 419.729   9. ALTNY  - 381.177
10. EREGL - 377.159   11. REEDR - 340.384   12. KONTR - 315.880
13. KCHOL - 311.315   14. FROTO - 299.481   15. CWENE - 279.439
16. ASTOR - 267.544   17. PATEK - 260.465   18. TABGD - 242.494
19. IZENR - 242.424   20. CANTE - 240.493
"""

# DB'deki etiket (ekran görüntüsünden "SASA" symbol, "Bekleniyor" görünüyor)
DB_SYMBOL  = "SASA"
DB_LABEL   = "BEKLIYOR"   # ekranda "Bekleniyor" tag'i var

# Test etmek istediğimiz tüm ticker'lar (haberde geçen)
TICKERS = [
    "THYAO", "TUPRS", "SASA", "ASELS", "ISCTR",
    "HEKTS", "SISE",  "PGSUS","ALTNY", "EREGL",
    "REEDR", "KONTR", "KCHOL","FROTO", "CWENE",
    "ASTOR", "PATEK", "TABGD","IZENR", "CANTE",
]

# ── Model yükle ───────────────────────────────────────────────────────────────
def load_model(path):
    tok = AutoTokenizer.from_pretrained(str(path))
    mdl = AutoModelForSequenceClassification.from_pretrained(str(path))
    mdl.eval()
    if torch.cuda.is_available():
        mdl = mdl.cuda()
    return tok, mdl

def predict_old(tok, mdl, text, max_len=256):
    enc = tok(text, truncation=True, max_length=max_len,
              return_tensors="pt", padding=True)
    if torch.cuda.is_available():
        enc = {k: v.cuda() for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    probs = torch.softmax(logits, dim=-1)[0].cpu().tolist()
    pred  = int(torch.argmax(logits, dim=-1).item())
    return ID2LABEL[pred], probs

def predict_new(tok, mdl, symbol, text, max_len=256):
    enc = tok(text=symbol, text_pair=text, truncation=True,
              max_length=max_len, return_tensors="pt", padding=True)
    if torch.cuda.is_available():
        enc = {k: v.cuda() for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    probs = torch.softmax(logits, dim=-1)[0].cpu().tolist()
    pred  = int(torch.argmax(logits, dim=-1).item())
    return ID2LABEL[pred], probs

# ── Ana ───────────────────────────────────────────────────────────────────────
print("Modeller yükleniyor...")
old_tok, old_mdl = load_model(OLD_MODEL_PATH)
new_tok, new_mdl = load_model(NEW_MODEL_PATH)
print("  ✓ Eski model (sentiment_v4)")
print("  ✓ Yeni model (entity_aware)\n")

combined_text = TITLE + "\n" + TEXT

# ── Eski model: sadece text ────────────────────────────────────────────────────
old_label, old_probs = predict_old(old_tok, old_mdl, combined_text)

print("=" * 65)
print("HABER:")
print(f"  Başlık : {TITLE}")
print(f"  DB Symbol: {DB_SYMBOL}  |  DB Etiket: {DB_LABEL}")
print("=" * 65)

print(f"\n[ESKİ MODEL — text only]  →  {old_label}")
print(f"  NÖTR={old_probs[0]:.3f}  OLUMLU={old_probs[1]:.3f}  OLUMSUZ={old_probs[2]:.3f}")

# ── Yeni model: her ticker için ayrı ayrı ─────────────────────────────────────
print(f"\n[YENİ MODEL — entity-aware, her ticker için]")
print(f"  {'Ticker':<8}  {'Tahmin':<10}  NÖTR    OLUMLU  OLUMSUZ")
print(f"  {'-'*7}  {'-'*10}  {'------':<8}{'------':<8}{'-------'}")
for ticker in TICKERS:
    label, probs = predict_new(new_tok, new_mdl, ticker, combined_text)
    marker = "  ← DB kaydı" if ticker == DB_SYMBOL else ""
    print(f"  {ticker:<8}  {label:<10}  {probs[0]:.3f}   {probs[1]:.3f}   {probs[2]:.3f}{marker}")

# ── Yorum ─────────────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("YORUM:")
print("  Bu haber yatırımcı sayısı sıralamasını veriyor.")
print("  Haber içeriği bilgilendirici / istatistiksel.")
print("  DB kaydı SASA sembolüne atanmış, BEKLIYOR durumunda.")
print("=" * 65)
