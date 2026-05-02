import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"

def clean_text(text):
    if pd.isna(text):
        return ""
    return str(text).strip()

def main():
    print("Veriler okutuluyor...")
    files = list(DATA_DIR.glob("*.csv"))
    
    dfs = []
    for f in files:
        if f.name in ["train.csv", "val.csv", "test.csv"]:
            continue
        print(f"  - {f.name} okunuyor...")
        df = pd.read_csv(f)
        dfs.append(df)
        
    if not dfs:
        print("Data klasorunde CSV bulunamadi!")
        return

    full_df = pd.concat(dfs, ignore_index=True)
    
    # 1. Filtreleme
    print("\nVeri temizleniyor...")
    full_df = full_df[full_df["sentiment"].isin(["OLUMLU", "OLUMSUZ", "NÖTR", "NOTR"])]
    full_df = full_df.dropna(subset=["symbol", "sentiment"])
    
    # NOTR duzeltme (Encoding sorunlarina karsi)
    full_df["sentiment"] = full_df["sentiment"].replace({"NÖTR": "NOTR", "NOTR": "NOTR"})
    
    # 2. Birlestirme
    prepared_data = []
    for _, row in full_df.iterrows():
        sym = clean_text(row["symbol"])
        title = clean_text(row.get("title", ""))
        summary = clean_text(row.get("summary", ""))
        content = clean_text(row.get("content", ""))
        
        parts = [title]
        if summary and summary != title:
            parts.append(summary)
        # Content cok uzun olmasin, ilk kismi alalim
        content_snippet = content[:500] if content else ""
        if content_snippet and content_snippet != summary and content_snippet != title:
            parts.append(content_snippet)
            
        text = " ".join(parts).strip()
        if not text or not sym:
            continue
            
        prepared_data.append({
            "symbol": sym,
            "text": text,
            "label": row["sentiment"]
        })
        
    final_df = pd.DataFrame(prepared_data)
    final_df = final_df.drop_duplicates(subset=["symbol", "text"])
    
    print(f"\nToplam temiz veri sayisi: {len(final_df)}")
    print(final_df["label"].value_counts())
    
    # 3. Split (%80 Train, %10 Val, %10 Test)
    print("\nTrain/Val/Test bolunuyor...")
    train = final_df.sample(frac=0.8, random_state=42)
    rest = final_df.drop(train.index)
    val = rest.sample(frac=0.5, random_state=42)
    test = rest.drop(val.index)
    
    train.to_csv(DATA_DIR / "train.csv", index=False)
    val.to_csv(DATA_DIR / "val.csv", index=False)
    test.to_csv(DATA_DIR / "test.csv", index=False)
    
    print("Kaydedildi:")
    print(f"  Train: {len(train)}")
    print(f"  Val  : {len(val)}")
    print(f"  Test : {len(test)}")

if __name__ == "__main__":
    main()
