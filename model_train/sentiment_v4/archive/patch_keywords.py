"""
Mevcut labeled CSV'yi quick_label() ile tarayip yanlış etiketleri düzelt.
Sadece keyword_label != mevcut_label olan satırlari gunceller.
"""
import importlib.util
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
CSV  = HERE / "labeled_train_consensus.csv"

# multi_label.py'den quick_label yukle
spec = importlib.util.spec_from_file_location("ml", HERE / "multi_label.py")
ml   = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)
quick_label = ml.quick_label

df = pd.read_csv(CSV)
print(f"Toplam: {len(df)} satir")

changed = 0
for i, row in df.iterrows():
    ql = quick_label(str(row["text"]))
    if ql is not None and ql != row["label"]:
        df.at[i, "label"]      = ql
        df.at[i, "qwen_label"] = ql
        changed += 1

print(f"Duzeltilen: {changed} satir")
df.to_csv(CSV, index=False, encoding="utf-8")

print("\nYeni dagilim:")
for lbl, cnt in df["label"].value_counts().items():
    print(f"  {lbl:<10}: {cnt:>5} ({cnt/len(df)*100:.1f}%)")
