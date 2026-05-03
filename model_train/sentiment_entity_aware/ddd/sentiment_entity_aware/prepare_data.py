import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUTPUT_DIR = HERE / "output"
DATA_DIR = HERE / "data"

def main():
    print("Etiketli veriler yukleniyor...")

    # 1. Sadece 3/3 unanimous (HIGH confidence) base
    unanimous = pd.read_csv(OUTPUT_DIR / "unanimous_labeled.csv")
    print(f"  unanimous: {len(unanimous)} satir")

    # 2. majority'den sadece OLUMSUZ al (OLUMSUZ class'ini takviye et)
    majority = pd.read_csv(OUTPUT_DIR / "majority_labeled.csv")
    majority_olumsuz = majority[majority["label"] == "OLUMSUZ"].copy()
    print(f"  majority'den OLUMSUZ takviyesi: {len(majority_olumsuz)} satir")

    # 3. Birlestir
    combined = pd.concat([unanimous, majority_olumsuz], ignore_index=True)
    combined = combined.drop_duplicates(subset=["symbol", "text"])
    combined = combined.dropna(subset=["symbol", "text", "label"])

    # 4. Label normalize (NOTR / NÖTR tutarsizligi)
    combined["label"] = combined["label"].replace({"NOTR": "NÖTR"})
    combined = combined[combined["label"].isin(["OLUMLU", "OLUMSUZ", "NÖTR"])]

    print(f"\nBirlestirme sonrasi:")
    print(combined["label"].value_counts().to_string())

    # 5. Dengeleme — her sinif esit (min sinif kadar)
    min_count = combined["label"].value_counts().min()
    print(f"\nDengeleme: her siniftan {min_count} ornek alinacak")
    balanced = (
        combined.groupby("label", group_keys=False)
        .apply(lambda x: x.sample(min_count, random_state=42))
        .reset_index(drop=True)
    )
    balanced = balanced.sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"\nFinal balanced dataset:")
    print(balanced["label"].value_counts().to_string())
    print(f"Toplam: {len(balanced)}")

    # 6. Train/Val/Test split (%80 / %10 / %10) — stratified
    from sklearn.model_selection import train_test_split
    train, rest = train_test_split(balanced, test_size=0.2, random_state=42, stratify=balanced["label"])
    val, test = train_test_split(rest, test_size=0.5, random_state=42, stratify=rest["label"])

    # train.py'nin beklediği kolonlar: symbol, text, label
    for split_name, split_df in [("train", train), ("val", val), ("test", test)]:
        out = split_df[["symbol", "text", "label"]].reset_index(drop=True)
        out.to_csv(DATA_DIR / f"{split_name}.csv", index=False)
        print(f"{split_name}.csv: {len(out)} satir | {out['label'].value_counts().to_dict()}")

    print("\nHazir! data/train.csv, val.csv, test.csv olusturuldu.")

if __name__ == "__main__":
    main()
