"""
İki kontrol:
  1. Tüm CSV'den 50 random satır
  2. Keyword ile düzeltilen 278 satır (önceki etiket != şimdiki)
"""
import importlib.util, sys, random
from pathlib import Path
import pandas as pd

HERE = Path(__file__).resolve().parent
CSV  = HERE / "labeled_train_consensus.csv"
ORIG = HERE / "train_clean.csv"

# quick_label yükle
spec = importlib.util.spec_from_file_location("ml", HERE / "multi_label.py")
ml   = importlib.util.module_from_spec(spec); spec.loader.exec_module(ml)
quick_label = ml.quick_label

# Hangi keyword'in eşleştiğini bul
def matched_kw(text):
    tl = text.lower()
    for kw in ml._KW_OLUMLU:
        if kw in tl:
            return f"OLUMLU<-'{kw}'"
    for kw in ml._KW_OLUMSUZ:
        if kw in tl:
            return f"OLUMSUZ<-'{kw}'"
    return None

df = pd.read_csv(CSV)

# ── 1. 50 random ──────────────────────────────────────────────────────────────
print("=" * 80)
print("BÖLÜM 1 — 50 random satır")
print("=" * 80)
sample = df.sample(n=50, random_state=random.randint(0,9999))
for _, row in sample.iterrows():
    text = str(row["text"])
    kw   = matched_kw(text) or "qwen"
    print(f"\n[{row['label']:<8}] idx={int(row['orig_idx'])}  ({kw})")
    print(f"  {text[:250]}")

# ── 2. Keyword ile düzeltilen satırlar ────────────────────────────────────────
# Bunları bulmak için: quick_label() ŞIMDI eşleşen ama label bunlar
# (patch sonrası label == quick_label değeri)
# Orijinal qwen etiketini bilmiyoruz çünkü üzerine yazdık.
# Ama keyword eşleşen her satırı listeleyelim + bağlamı gösterelim
print("\n" * 2)
print("=" * 80)
print("BÖLÜM 2 — Keyword eşleşen tüm satırlar (278 düzeltilen dahil) — 40 örnek")
print("=" * 80)

kw_rows = [(i, row) for i, row in df.iterrows() if quick_label(str(row["text"])) is not None]
print(f"Toplam keyword eşleşen: {len(kw_rows)}")

# Random 40 tane göster
random.shuffle(kw_rows)
for _, row in kw_rows[:40]:
    text = str(row["text"])
    kw   = matched_kw(text)
    print(f"\n[{row['label']:<8}] idx={int(row['orig_idx'])}  ({kw})")
    print(f"  {text[:280]}")
