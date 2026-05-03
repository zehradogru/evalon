#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
entity_label.py — Hisse Özelinde (Entity-Aware) 3 Model Çoğunluk Oylamalı Sentiment Etiketleyici

Fark: Her haberde ilgili hisse kodu (symbol) prompt'a eklenir.
Model metnin genel havasına değil, o hisseyle ilişkisine göre etiket verir.

Giriş formatı: [HISSE: {symbol}] {title} {summary} {content[:250 kelime]}
Çıktı: OLUMLU / OLUMSUZ / NÖTR

Oylama:
  3/3 aynı → HIGH   → output/unanimous_labeled.csv
  2/3 aynı → MEDIUM → output/majority_labeled.csv
  hepsi farklı → REJECT → output/rejected.csv

Kullanım:
  python entity_label.py               # Tüm veriyi işle
  python entity_label.py --limit 20    # Test modu
  python entity_label.py --resume      # Kaldığı yerden devam
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

# ── Ayarlar ───────────────────────────────────────────────────────────────────

OLLAMA_URL     = "http://localhost:11434/api/generate"
OLLAMA_TIMEOUT = 90
WORKERS        = 8
TEXT_MAX_WORDS = 250   # title+summary+content'ten max kelime sayısı

MODEL_A = "qwen3:14b"
MODEL_B = "gemma3:12b"
MODEL_C = "llama3.1:latest"

HERE       = Path(__file__).resolve().parent
INPUT_CSV  = HERE / "data" / "bist_haberler_ALL_content.csv"
OUTPUT_DIR = HERE / "output"

OUT_UNANIMOUS = OUTPUT_DIR / "unanimous_labeled.csv"
OUT_MAJORITY  = OUTPUT_DIR / "majority_labeled.csv"
OUT_REJECTED  = OUTPUT_DIR / "rejected.csv"

CHECKPOINT_A        = OUTPUT_DIR / "checkpoint_a.json"
CHECKPOINT_B        = OUTPUT_DIR / "checkpoint_b.json"
CHECKPOINT_C        = OUTPUT_DIR / "checkpoint_c.json"
CHECKPOINT_INTERVAL = 500

VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}
_NOTR_NORM   = {"NOTR", "NÖTR"}

# ── Prompt ────────────────────────────────────────────────────────────────────

_PROMPT = """\
Aşağıdaki Türkçe finans haberini, yalnızca "{symbol}" hisse senedi yatırımcısı perspektifinden değerlendir.
Bu haberin "{symbol}" hissesi için anlamı nedir? Yalnızca tek kelime yaz: OLUMLU, OLUMSUZ veya NOTR

Etiket tanımları:
OLUMLU — Haber, "{symbol}" hissesi için açıkça olumlu bir finansal ya da operasyonel gelişmeyi yansıtıyorsa.
OLUMSUZ — Haber, "{symbol}" hissesi için açıkça olumsuz bir finansal ya da operasyonel gelişmeyi yansıtıyorsa.
NOTR — Haber "{symbol}" hissesiyle doğrudan ilgili değilse, tarafsız bilgi aktarıyorsa veya etki belirsizse.

Değerlendirme kuralları:
- Sadece "{symbol}" hissesi için etkiyi değerlendir, genel piyasa yorumu yapma.
- Haber "{symbol}" hissesinden hiç bahsetmiyorsa veya dolaylı ilişkiliyse NOTR yaz.
- İkiye giden ya da karma sinyallerde NOTR yaz.
- Belirsizlik durumunda NOTR yaz.
- Yanıtın yalnızca tek kelimeden oluşmalı: OLUMLU, OLUMSUZ veya NOTR

Hisse: {symbol}
Haber: {text}
"""

# ── Metin hazırlama ───────────────────────────────────────────────────────────

def build_text(row: pd.Series) -> str:
    """title + summary + content birleştir, TEXT_MAX_WORDS kelimeyle sınırla."""
    parts = []
    for col in ("title", "summary", "content"):
        val = str(row.get(col, "") or "").strip()
        if val and val.lower() not in ("nan", "none", ""):
            parts.append(val)
    combined = " ".join(parts)
    words = combined.split()
    if len(words) > TEXT_MAX_WORDS:
        combined = " ".join(words[:TEXT_MAX_WORDS]) + "..."
    return combined

# ── Ollama yardımcıları ───────────────────────────────────────────────────────

def warmup(model: str) -> bool:
    print(f"  {model} yükleniyor...", end="", flush=True)
    try:
        payload = {"model": model, "prompt": "merhaba", "stream": False,
                   "options": {"num_predict": 1, "temperature": 0, "num_gpu": 99}}
        if "qwen3" in model.lower():
            payload["think"] = False
        r = requests.post(OLLAMA_URL, json=payload, timeout=120)
        if r.status_code == 200:
            print(" hazır.")
            return True
        print(f" HTTP {r.status_code}")
        return False
    except Exception as e:
        print(f" hata: {e}")
        return False


def unload(model: str) -> None:
    try:
        requests.post(OLLAMA_URL, json={"model": model, "keep_alive": 0}, timeout=15)
        print(f"  {model} VRAM'den boşaltıldı.")
    except Exception:
        pass


def _parse_label(raw: str) -> str:
    """Ham çıktıdan etiket çıkar. <think>...</think> bloklarını temizler."""
    cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL)
    upper = cleaned.strip().upper()
    for word in reversed(upper.split()):
        w = word.rstrip(".,;:\n")
        if w in _NOTR_NORM:
            return "NÖTR"
        if w in VALID_LABELS:
            return w
    return "NÖTR"


def call_model(model: str, symbol: str, text: str) -> str:
    prompt = _PROMPT.format(symbol=symbol, text=text)
    payload = {
        "model":   model,
        "prompt":  prompt,
        "stream":  False,
        "options": {"num_predict": 16, "temperature": 0, "num_ctx": 1024, "num_gpu": 99},
    }
    if "qwen3" in model.lower():
        payload["think"] = False   # thinking modunu kapat
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        r.raise_for_status()
        raw = r.json().get("response", "")
        return _parse_label(raw)
    except Exception:
        return "NÖTR"

# ── Ön test ───────────────────────────────────────────────────────────────────

_TEST_SAMPLES = [
    ("THYAO", "Türk Hava Yolları bu çeyrekte rekor yolcu sayısına ulaştı ve net karı yüzde elli arttı.",             "OLUMLU"),
    ("EREGL", "Ereğli Demir Çelik fabrikasında yangın çıktı, üretim tamamen durdu.",                                  "OLUMSUZ"),
    ("AKBNK", "Merkez Bankası politika faizini sabit tuttu.",                                                          "NÖTR"),
    ("GARAN", "Garanti Bankası temettü dağıtımı için sermaye piyasası kuruluna başvurdu ve onay aldı.",                "OLUMLU"),
    ("BIMAS", "Ekonomi Bakanı enflasyonla mücadele kapsamında yeni tedbirleri açıkladı.",                              "NÖTR"),
]


def pre_run_test(model: str) -> bool:
    print(f"\n  [TEST] {model} — 5 entity-aware örnek kontrol ediliyor...")
    results = []
    all_notr = True
    for symbol, text, expected in _TEST_SAMPLES:
        label = call_model(model, symbol, text)
        ok = "✓" if label == expected else "?"
        results.append(label)
        if label != "NÖTR":
            all_notr = False
        print(f"    {ok} [{symbol}] beklenen={expected:<8} dönen={label:<8}  {text[:55]}")
    dist = {l: results.count(l) for l in set(results)}
    print(f"  Dağılım: {dist}")
    if all_notr:
        print(f"  ⚠ UYARI: {model} tüm örnekleri NÖTR döndürdü — bu model atlanıyor!")
        return False
    return True

# ── Faz işleyici ──────────────────────────────────────────────────────────────

def label_phase(model: str, indices: list[int], symbols: list[str], texts: list[str],
                checkpoint_path: Path) -> dict[int, str]:
    """Modeli çalıştır, her CHECKPOINT_INTERVAL satırda diske kaydet."""
    results: dict[int, str] = {}

    if checkpoint_path.exists():
        try:
            with open(checkpoint_path, encoding="utf-8") as f:
                results = {int(k): v for k, v in json.load(f).items()}
            print(f"  [CHECKPOINT] {len(results)} satır yüklendi, devam ediliyor.")
        except Exception:
            results = {}

    idx_to_sym  = dict(zip(indices, symbols))
    idx_to_text = dict(zip(indices, texts))
    remaining   = [i for i in indices if i not in results]
    lock        = threading.Lock()
    done_count  = [0]

    def _save():
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        with open(checkpoint_path, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in results.items()}, f, ensure_ascii=False)

    def _one(idx: int):
        lbl = call_model(model, idx_to_sym[idx], idx_to_text[idx])
        with lock:
            results[idx] = lbl
            done_count[0] += 1
            if done_count[0] % CHECKPOINT_INTERVAL == 0:
                _save()

    with tqdm(total=len(indices), initial=len(indices) - len(remaining),
              unit="satır", desc=f"  {model}", ncols=76) as pbar:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            futs = {ex.submit(_one, i): i for i in remaining}
            for fut in as_completed(futs):
                fut.result()
                pbar.update(1)

    _save()
    return results

# ── CSV yazıcı ────────────────────────────────────────────────────────────────

_csv_lock = threading.Lock()

OUT_COLS = [
    "orig_idx", "symbol", "text", "label", "confidence", "weight",
    "model_a_label", "model_b_label", "model_c_label",
]


def write_rows(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with _csv_lock:
        write_header = not path.exists()
        pd.DataFrame(rows, columns=OUT_COLS).to_csv(
            path, mode="a", index=False, encoding="utf-8", header=write_header
        )

# ── Argümanlar ────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Entity-aware 3 model sentiment etiketleyici")
    p.add_argument("--input",  default=str(INPUT_CSV), help="Girdi CSV")
    p.add_argument("--limit",  type=int, default=0,    help="Test için satır sınırı (0=tümü)")
    p.add_argument("--resume", action="store_true",    help="Kaldığı yerden devam et")
    return p.parse_args()

# ── Ana fonksiyon ─────────────────────────────────────────────────────────────

def main() -> None:
    args       = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"HATA: {input_path} bulunamadı.")
        sys.exit(1)

    print("=" * 64)
    print("Entity-Aware Sentiment Etiketleyici")
    print(f"  Model A : {MODEL_A}")
    print(f"  Model B : {MODEL_B}")
    print(f"  Model C : {MODEL_C}")
    print(f"  3/3 aynı → HIGH   → {OUT_UNANIMOUS.name}")
    print(f"  2/3 aynı → MEDIUM → {OUT_MAJORITY.name}")
    print(f"  hepsi farklı → REJECT → {OUT_REJECTED.name}")
    print("=" * 64)

    df = pd.read_csv(input_path)
    if args.limit > 0:
        df = df.head(args.limit)
        print(f"[TEST MODU] İlk {args.limit} satır.\n")

    # text ve symbol kolonlarını hazırla
    df["_text"]   = df.apply(build_text, axis=1)
    df["_symbol"] = df["symbol"].fillna("").astype(str).str.strip()

    symbols  = df["_symbol"].tolist()
    texts    = df["_text"].tolist()
    all_orig = list(range(len(df)))

    print(f"Toplam satır: {len(df)}\n")

    # Resume veya temiz başlangıç
    done_indices: set[int] = set()
    if args.resume:
        for p in (OUT_UNANIMOUS, OUT_MAJORITY, OUT_REJECTED):
            if p.exists():
                try:
                    done_indices.update(pd.read_csv(p)["orig_idx"].tolist())
                except Exception:
                    pass
        if done_indices:
            print(f"[RESUME] {len(done_indices)} satır zaten işlenmiş, atlanıyor.\n")
    else:
        for p in (OUT_UNANIMOUS, OUT_MAJORITY, OUT_REJECTED):
            p.unlink(missing_ok=True)
        for cp in (CHECKPOINT_A, CHECKPOINT_B, CHECKPOINT_C):
            cp.unlink(missing_ok=True)

    pending   = [i for i in all_orig if i not in done_indices]
    p_symbols = [symbols[i] for i in pending]
    p_texts   = [texts[i]   for i in pending]

    if not pending:
        print("Tüm satırlar işlenmiş. Çıkılıyor.")
        return

    print(f"İşlenecek: {len(pending)} satır\n")

    # ── Faz A ─────────────────────────────────────────────────────────────
    print(f"── Faz A: {MODEL_A} ──")
    if not warmup(MODEL_A):
        print("HATA: Ollama erişilemiyor. 'ollama serve' çalışıyor mu?")
        sys.exit(1)
    if not pre_run_test(MODEL_A):
        print(f"HATA: {MODEL_A} düzgün etiketlemiyor. Script durduruluyor.")
        sys.exit(1)
    print()
    t0 = time.time()
    labels_a = label_phase(MODEL_A, pending, p_symbols, p_texts, CHECKPOINT_A)
    print(f"  Faz A tamamlandı: {time.time()-t0:.1f}s\n")
    unload(MODEL_A)
    time.sleep(2)

    # ── Faz B ─────────────────────────────────────────────────────────────
    print(f"── Faz B: {MODEL_B} ──")
    if not warmup(MODEL_B):
        print(f"HATA: {MODEL_B} bulunamadı. 'ollama pull {MODEL_B}' ile indirin.")
        sys.exit(1)
    if not pre_run_test(MODEL_B):
        print(f"HATA: {MODEL_B} düzgün etiketlemiyor. Script durduruluyor.")
        sys.exit(1)
    print()
    t0 = time.time()
    labels_b = label_phase(MODEL_B, pending, p_symbols, p_texts, CHECKPOINT_B)
    print(f"  Faz B tamamlandı: {time.time()-t0:.1f}s\n")
    unload(MODEL_B)
    time.sleep(2)

    # ── Faz C ─────────────────────────────────────────────────────────────
    print(f"── Faz C: {MODEL_C} ──")
    if not warmup(MODEL_C):
        print(f"HATA: {MODEL_C} bulunamadı. 'ollama pull {MODEL_C}' ile indirin.")
        sys.exit(1)
    if not pre_run_test(MODEL_C):
        print(f"HATA: {MODEL_C} düzgün etiketlemiyor. Script durduruluyor.")
        sys.exit(1)
    print()
    t0 = time.time()
    labels_c = label_phase(MODEL_C, pending, p_symbols, p_texts, CHECKPOINT_C)
    print(f"  Faz C tamamlandı: {time.time()-t0:.1f}s\n")

    # ── Oylama ────────────────────────────────────────────────────────────
    unanimous_rows: list[dict] = []
    majority_rows:  list[dict] = []
    rejected_rows:  list[dict] = []

    for orig_i, sym, text in zip(pending, p_symbols, p_texts):
        la = labels_a.get(orig_i, "NÖTR")
        lb = labels_b.get(orig_i, "NÖTR")
        lc = labels_c.get(orig_i, "NÖTR")

        votes  = Counter([la, lb, lc])
        winner, top_count = votes.most_common(1)[0]

        row = {
            "orig_idx":      orig_i,
            "symbol":        sym,
            "text":          text,
            "label":         winner,
            "confidence":    None,
            "weight":        None,
            "model_a_label": la,
            "model_b_label": lb,
            "model_c_label": lc,
        }

        if top_count == 3:
            row["confidence"] = "HIGH"
            row["weight"]     = 2.0
            unanimous_rows.append(row)
        elif top_count == 2:
            row["confidence"] = "MEDIUM"
            row["weight"]     = 1.0
            majority_rows.append(row)
        else:
            row["confidence"] = "REJECT"
            row["weight"]     = 0.0
            rejected_rows.append(row)

    write_rows(OUT_UNANIMOUS, unanimous_rows)
    write_rows(OUT_MAJORITY,  majority_rows)
    write_rows(OUT_REJECTED,  rejected_rows)

    # Checkpoint temizle
    for cp in (CHECKPOINT_A, CHECKPOINT_B, CHECKPOINT_C):
        cp.unlink(missing_ok=True)

    # ── Özet ──────────────────────────────────────────────────────────────
    total = len(pending)
    print("=" * 64)
    print(f"Sonuçlar ({total} satır işlendi):\n")
    print(f"  3/3 oybirliği  HIGH   : {len(unanimous_rows):>6}  ({len(unanimous_rows)/total*100:.1f}%)")
    print(f"  2/3 çoğunluk   MEDIUM : {len(majority_rows):>6}  ({len(majority_rows)/total*100:.1f}%)")
    print(f"  Anlaşmazlık    REJECT : {len(rejected_rows):>6}  ({len(rejected_rows)/total*100:.1f}%)")
    accepted = len(unanimous_rows) + len(majority_rows)
    print(f"  {'─'*53}")
    print(f"  Toplam kabul (H+M)    : {accepted:>6}  ({accepted/total*100:.1f}%)\n")

    for path, rows, name in [
        (OUT_UNANIMOUS, unanimous_rows, "Oybirliği (HIGH)"),
        (OUT_MAJORITY,  majority_rows,  "Çoğunluk (MEDIUM)"),
    ]:
        if rows:
            dist = Counter(r["label"] for r in rows)
            print(f"  {name} dağılımı:")
            for lbl, cnt in dist.most_common():
                print(f"    {lbl:<10}: {cnt:>5} ({cnt/len(rows)*100:.1f}%)")
            print()

    # ── Otomatik yedek ────────────────────────────────────────────────────
    ts         = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = OUTPUT_DIR / f"backup_{ts}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    for src in (OUT_UNANIMOUS, OUT_MAJORITY, OUT_REJECTED):
        if src.exists():
            shutil.copy2(src, backup_dir / src.name)
    print(f"  Yedek kaydedildi: {backup_dir}")

    print(f"\nÇıktı dizini: {OUTPUT_DIR}")
    print(f"  {OUT_UNANIMOUS.name}")
    print(f"  {OUT_MAJORITY.name}")
    print(f"  {OUT_REJECTED.name}")


if __name__ == "__main__":
    main()
