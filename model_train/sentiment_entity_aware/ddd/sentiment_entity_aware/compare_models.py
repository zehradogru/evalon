#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
compare_models.py — sentiment_v4 vs entity_aware karşılaştırması
Sadece LOCAL. DB'ye hiçbir şey yazılmaz.

Çalıştır:
  python compare_models.py
"""
import re
import textwrap
from pathlib import Path

import pandas as pd
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = Path(__file__).resolve().parent

# ── Model Yolları ─────────────────────────────────────────────────────────────
OLD_MODEL_PATH = Path(r"C:\Users\zehra\Masaüstü\evalonn\model_train\sentiment_v4\final_model_dbmdz")
NEW_MODEL_PATH = HERE / "final_model_entity_aware"
TEST_CSV       = HERE / "data" / "test.csv"

# ── Label mappings ─────────────────────────────────────────────────────────────
OLD_ID2LABEL = {0: "NÖTR", 1: "OLUMLU", 2: "OLUMSUZ"}   # sentiment_v4 label sırası
NEW_ID2LABEL = {0: "NÖTR", 1: "OLUMLU", 2: "OLUMSUZ"}   # entity_aware label sırası

# ─────────────────────────────────────────────────────────────────────────────

def load_model(path, label2id=None):
    tok = AutoTokenizer.from_pretrained(str(path))
    mdl = AutoModelForSequenceClassification.from_pretrained(str(path))
    mdl.eval()
    if torch.cuda.is_available():
        mdl = mdl.cuda()
    return tok, mdl

def predict_old(tok, mdl, text, max_len=256):
    """Eski model: sadece text girer."""
    enc = tok(text, truncation=True, padding="max_length",
               max_length=max_len, return_tensors="pt")
    if torch.cuda.is_available():
        enc = {k: v.cuda() for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    probs = torch.softmax(logits, dim=-1)[0].cpu().tolist()
    idx = int(torch.argmax(logits, dim=-1)[0])
    # model'in config'inden al
    id2label = mdl.config.id2label
    label = id2label.get(idx, OLD_ID2LABEL.get(idx, str(idx)))
    return label, round(probs[idx], 3)

def predict_new(tok, mdl, symbol, text, max_len=256):
    """Yeni model: [CLS] SYMBOL [SEP] TEXT [SEP] formatı."""
    enc = tok(text=symbol, text_pair=text,
              truncation="only_second", padding="max_length",
              max_length=max_len, return_tensors="pt")
    if torch.cuda.is_available():
        enc = {k: v.cuda() for k, v in enc.items()}
    with torch.no_grad():
        logits = mdl(**enc).logits
    probs = torch.softmax(logits, dim=-1)[0].cpu().tolist()
    idx = int(torch.argmax(logits, dim=-1)[0])
    id2label = mdl.config.id2label
    label = id2label.get(idx, NEW_ID2LABEL.get(idx, str(idx)))
    return label, round(probs[idx], 3)

def count_tickers_in_text(text, ticker_list):
    found = set()
    for t in ticker_list:
        if re.search(rf"\b{re.escape(t)}\b", text, re.IGNORECASE):
            found.add(t)
    return found

# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("Modeller yükleniyor...")
    old_tok, old_mdl = load_model(OLD_MODEL_PATH)
    new_tok, new_mdl = load_model(NEW_MODEL_PATH)
    print("  ✓ Eski model (sentiment_v4/final_model_dbmdz)")
    print("  ✓ Yeni model (final_model_entity_aware)")

    # Test verisi
    df = pd.read_csv(TEST_CSV)
    print(f"\nTest seti: {len(df)} satır")
    print(df["label"].value_counts().to_string())

    # Ticker listesi (semboller test datasından)
    all_symbols = set(df["symbol"].unique())

    results = []
    for _, row in df.iterrows():
        symbol = str(row["symbol"])
        text   = str(row["text"])
        true   = str(row["label"])

        old_pred, old_conf = predict_old(old_tok, old_mdl, text)
        new_pred, new_conf = predict_new(new_tok, new_mdl, symbol, text)

        found_tickers = count_tickers_in_text(text, all_symbols)
        multi_ticker  = len(found_tickers) > 1

        results.append({
            "symbol":       symbol,
            "true":         true,
            "old_pred":     old_pred,
            "old_conf":     old_conf,
            "new_pred":     new_pred,
            "new_conf":     new_conf,
            "old_correct":  old_pred == true,
            "new_correct":  new_pred == true,
            "multi_ticker": multi_ticker,
            "found_tickers": ", ".join(sorted(found_tickers)),
            "text_snippet": text[:120],
        })

    res = pd.DataFrame(results)

    # ── Genel Metrikler ───────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("GENEL SONUÇLAR")
    print("="*60)
    old_acc = res["old_correct"].mean()
    new_acc = res["new_correct"].mean()
    print(f"  Eski model accuracy : {old_acc:.3f}  ({res['old_correct'].sum()}/{len(res)})")
    print(f"  Yeni model accuracy : {new_acc:.3f}  ({res['new_correct'].sum()}/{len(res)})")

    # Per-class
    print("\n--- Sınıf bazlı doğruluk ---")
    for lbl in ["OLUMLU", "OLUMSUZ", "NÖTR"]:
        sub = res[res["true"] == lbl]
        if len(sub) == 0:
            continue
        o = sub["old_correct"].mean()
        n = sub["new_correct"].mean()
        print(f"  {lbl:8s}  eski={o:.3f}  yeni={n:.3f}  (n={len(sub)})")

    # ── Multi-Ticker Analizi ─────────────────────────────────────────────────
    multi = res[res["multi_ticker"] == True]
    single = res[res["multi_ticker"] == False]

    print("\n" + "="*60)
    print("MULTI-TICKER İÇEREN HABERLER")
    print("="*60)
    if len(multi) == 0:
        print("  Test setinde multi-ticker haber bulunamadı.")
    else:
        print(f"  Toplam multi-ticker: {len(multi)} satır")
        print(f"  Eski model accuracy: {multi['old_correct'].mean():.3f}")
        print(f"  Yeni model accuracy: {multi['new_correct'].mean():.3f}")

        print("\n--- Detaylı multi-ticker örnekler ---")
        # Sadece ikisi aynı sonuç vermeyenleri göster
        diff = multi[multi["old_pred"] != multi["new_pred"]]
        print(f"  İki modelin farklı dediği: {len(diff)} satır\n")
        for i, (_, r) in enumerate(diff.head(10).iterrows()):
            print(f"  [{i+1}] Symbol: {r['symbol']}  |  Gerçek: {r['true']}")
            print(f"       Ticker'lar: {r['found_tickers']}")
            print(f"       Eski: {r['old_pred']} ({r['old_conf']:.2f})  |  Yeni: {r['new_pred']} ({r['new_conf']:.2f})")
            print(f"       Eski doğru: {'✓' if r['old_correct'] else '✗'}  |  Yeni doğru: {'✓' if r['new_correct'] else '✗'}")
            print(f"       Metin: {textwrap.shorten(r['text_snippet'], 100)}")
            print()

    # ── Tek-ticker karşılaştırma ─────────────────────────────────────────────
    print("="*60)
    print("TEK-TICKER HABERLER")
    print("="*60)
    print(f"  Toplam: {len(single)} satır")
    print(f"  Eski model accuracy: {single['old_correct'].mean():.3f}")
    print(f"  Yeni model accuracy: {single['new_correct'].mean():.3f}")

    # ── Yeni modelin kazandığı / kaybettiği vakalar ───────────────────────────
    new_wins  = res[(res["new_correct"] == True)  & (res["old_correct"] == False)]
    new_loses = res[(res["new_correct"] == False) & (res["old_correct"] == True)]
    print(f"\n  Yeni model kazandı (eski yanlış, yeni doğru): {len(new_wins)}")
    print(f"  Yeni model kaybetti (eski doğru, yeni yanlış): {len(new_loses)}")

    # ── Örnekler: yeni modelin doğru yaptığı ─────────────────────────────────
    if len(new_wins) > 0:
        print("\n--- Yeni modelin düzelttikleri (ilk 5) ---")
        for i, (_, r) in enumerate(new_wins.head(5).iterrows()):
            print(f"  [{i+1}] {r['symbol']} | Gerçek: {r['true']} | Eski: {r['old_pred']} → Yeni: {r['new_pred']}")
            print(f"       {textwrap.shorten(r['text_snippet'], 100)}")

    # CSV kaydet (lokal, DB'ye gitmiyor)
    out_path = HERE / "comparison_results.csv"
    res.to_csv(out_path, index=False)
    print(f"\nTüm sonuçlar kaydedildi: {out_path}")
    print("(DB'ye hiçbir şey yazılmadı)")

if __name__ == "__main__":
    main()
