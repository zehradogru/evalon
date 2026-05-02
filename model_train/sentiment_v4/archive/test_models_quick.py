#!/usr/bin/env python3
"""
Ollama model kalite testi — 10 BIST haberi üzerinde llama3.1 vs qwen2.5:7b karşılaştırması.

Kullanım:
    python test_models_quick.py
"""
import time
from pathlib import Path

import pandas as pd
import requests

# ── Ayarlar ───────────────────────────────────────────────────────────────────

OLLAMA_URL = "http://localhost:11434/api/generate"
MODELS     = ["llama3.1", "qwen2.5:7b"]
VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NOTR"}

PROMPT = (
    "Sen bir Borsa Istanbul (BIST) finans analistisin.\n"
    "Asagidaki haber, bir Turk sirketinin hisse senedi fiyatina nasil etki eder?\n"
    "Yalnizca su 3 kelimeden BIRINII yaz: OLUMLU, OLUMSUZ, NOTR\n"
    "Aciklama yapma. Sadece tek kelime.\n\n"
    "Haber:\n{text}\n\n"
    "Cevap:"
)

# Anahtar kelime filtreleri ile dengeli örneklem
POS_KEYWORDS = "artış|yüksel|kâr|büyüme|rekor|ihracat|satış arttı"
NEG_KEYWORDS = "düşüş|zarar|kayıp|geriledi|kriz|borç|iflas"

# ── Yardımcılar ───────────────────────────────────────────────────────────────

def load_sample(csv_path: Path, n: int = 10) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    pos = df[df["text"].str.contains(POS_KEYWORDS, case=False, na=False)].head(3)
    neg = df[df["text"].str.contains(NEG_KEYWORDS, case=False, na=False)].head(4)
    neu = df[~df.index.isin(pos.index.tolist() + neg.index.tolist())].sample(3, random_state=42)
    return pd.concat([pos, neg, neu]).head(n)


def ask(model: str, text: str) -> tuple[str, float]:
    t0 = time.time()
    resp = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": PROMPT.format(text=text[:700]),
            "stream": False,
            "options": {"num_predict": 5, "temperature": 0},
        },
        timeout=90,
    )
    raw   = resp.json().get("response", "").strip().upper()
    word  = raw.split()[0].rstrip(".,;:\n") if raw.split() else "?"
    if word in ("NÖTR", "NEUTRAL"):
        word = "NOTR"
    if word not in VALID_LABELS:
        word = f"?({raw[:20]})"
    return word, round(time.time() - t0, 1)


def check_gpu() -> None:
    try:
        ps = requests.get("http://localhost:11434/api/ps", timeout=5).json()
        for m in ps.get("models", []):
            vram_mb = m.get("size_vram", 0) // 1024 // 1024
            print(f"  {m['name']}: {vram_mb} MB VRAM")
    except Exception as e:
        print(f"  Hata: {e}")

# ── Ana akış ──────────────────────────────────────────────────────────────────

def main() -> None:
    here   = Path(__file__).parent
    sample = load_sample(here / "train_clean.csv")

    tallies = {m: {lbl: 0 for lbl in VALID_LABELS} | {"?": 0} for m in MODELS}

    # Başlık
    print(f"\n{'#':<3}  {'Haber (ilk 65 karakter)':<67}", end="")
    for m in MODELS:
        print(f"  {m[:14]:<18}", end="")
    print()
    print("-" * 115)

    for n, (_, row) in enumerate(sample.iterrows(), 1):
        text    = str(row["text"])
        snippet = text[:65].replace("\n", " ")
        print(f"{n:<3}  {snippet:<67}", end="", flush=True)
        for m in MODELS:
            lbl, t = ask(m, text)
            key    = lbl if lbl in tallies[m] else "?"
            tallies[m][key] += 1
            print(f"  {lbl:<12} {t}s", end="", flush=True)
        print()

    # Özet
    print("\n--- Etiket Dağılımı ---")
    for m in MODELS:
        print(f"  {m}: {tallies[m]}")

    print("\n--- GPU Durumu (ollama ps) ---")
    check_gpu()


if __name__ == "__main__":
    main()
