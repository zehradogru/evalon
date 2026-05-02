"""
Labeled CSV'den random 20-30 satir alip etiket dogrulugunu gorsel goster.
Insan gozu ile hizli kontrol icin.
"""
import pandas as pd
import random
import sys

CSV = "C:/Users/zehra/Masaüstü/evalonn/model_train/sentiment_v4/labeled_train_consensus.csv"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 25

df = pd.read_csv(CSV)
print(f"Toplam etiketli: {len(df)} satir")
print("Dagilim:")
for lbl, cnt in df["label"].value_counts().items():
    print(f"  {lbl:<10}: {cnt:>5} ({cnt/len(df)*100:.1f}%)")
print()

sample = df.sample(n=min(N, len(df)), random_state=random.randint(0, 9999))

SEP = "-" * 80
for _, row in sample.iterrows():
    print(SEP)
    print(f"  idx={int(row['orig_idx'])}  ETIKET: [{row['label']}]")
    text = str(row["text"])
    # Ilk 300 char goster
    print(f"  {text[:300]}")
    if len(text) > 300:
        print("  ...")
print(SEP)
