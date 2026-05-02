#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/multi_label.py  —  Faz 1: Coklu-Model Konsensus Etiketleme

Strateji:
  1. BERT v3 (fine-tuned, yerel GPU) — tum satirlari batch'le calistir
     → BERT score >= 0.92: direkt HIGH kabul, Ollama'ya gitme (~%70 tasarruf)
  2. Sadece belirsiz satirlar (~%30) → qwen2.5:7b (Ollama, GPU'da calistir)
  3. Konsensus: BERT vs qwen anlasmasina gore final etiket + agirlik

Konsensus kurallari:
  BERT >= 0.92             → HIGH   (weight=1.5) — qwen atlanir
  BERT+qwen anlasma        → HIGH   (weight=1.5)
  anlasmazlik, BERT >= 0.80 → REJECT (model icin zararli)
  anlasmazlik, BERT < 0.80  → LOW    (weight=0.5, qwen etiketi alinir)

Kullanim:
  python multi_label.py                    # Tam calistir
  python multi_label.py --limit 50         # Hizli test
  python multi_label.py --resume           # Kaldigi yerden devam
  python multi_label.py --bert-only        # Sadece BERT (hizli baseline)
"""
from __future__ import annotations

import argparse
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

from model_utils import build_news_text, load_sentiment_pipeline, score_texts

# ── Sabitler ──────────────────────────────────────────────────────────────────

BERT_MODEL_DIR         = MODEL_TRAIN_DIR / "bist_bert_model_v3"
INPUT_DEFAULT          = HERE / "train_clean.csv"
OUTPUT_DEFAULT         = HERE / "labeled_train_consensus.csv"
REJECTED_DEFAULT       = HERE / "rejected_samples.csv"

OLLAMA_URL             = "http://localhost:11434/api/generate"
OLLAMA_PS_URL          = "http://localhost:11434/api/ps"
OLLAMA_MODEL           = "qwen2.5:7b"
OLLAMA_TIMEOUT         = 90
OLLAMA_WORKERS         = 4      # paralel istek sayisi

TEXT_MAX_CHARS         = 600    # qwen'e gonderilecek maks karakter

VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}
_NOTR_NORM   = {"NOTR", "NÖTR"}  # qwen NOTR, BERT NÖTR — ikisini de kabul et

# ── Prompt ────────────────────────────────────────────────────────────────────

_PROMPT = """\
Asagidaki BIST haber metnini degerlendir. YALNIZCA tek kelime yaz: OLUMLU, OLUMSUZ veya NOTR

OLUMLU (hisse icin net pozitif):
- Kar artisi, guclu bilanco, temttu aciklamasi, bedelsiz sermaye artirimi
- "Al" veya "endeks ustu getiri" veya "overweight" tavsiyesi
- Hedef fiyat artisi veya yuksek hedef fiyat belirlenmesi
- Hissenin yukseldigine dair haber (olumlu sebeple)
- Yeni yatirim, buyume, sozlesme kazanma haberi

OLUMSUZ (hisse icin net negatif):
- Zarar/ziyan aciklamasi, negatif bilanco
- "Sat", "azalt" veya "endeks alti getiri" tavsiyesi
- TMSF el koymasi, sorusturma, haciz, iflas, dava
- Zorla hisse devri, ortaklik yapisi degisikligi (olumsuz)
- Hedef fiyat indirimi, hissenin dusus haberi (negatif sebeple)

NOTR (net yatirim sinyali yok):
- Sadece teknik analiz veya destek/direnc seviyeleri
- Genel endeks veya piyasa ozeti (birden fazla hisse)
- KAP bildirimi (tavsiye icermeyen)
- Salt hedef fiyat listesi (tavsiye/yorum yok)
- Gunluk kapanis, hacim bilgisi

Haber: {text}
"""

# ── Keyword pre-filter (prompt kullanmadan kesin sinyalleri yakala) ────────────
# Not: Bunlar prompt ornekleri degil, kesin anlam tasiyan Turkce finansal ifadeler

_KW_OLUMLU = [
    "al tavsiyesi", "al olarak belirledi", "al olarak deklare",
    "al görüşü", "al gorusu", "al önerisi", "al onerisi",
    "endeks üstü getiri", "endeks ustu getiri",
    "overweight", "outperform",
    "net kâr artı", "net kar arti", "kâr büyüdü", "kar buyudu",
    "bedelsiz hisse dağıtacak", "bedelsiz sermaye artırımı gerçekleştir",
    "bedelsiz sermaye artırımı", "bedelsiz artirimi",  # bedelsiz haberleri → OLUMLU
    "temettü açıkladı", "temettu acikladi",
    "temettü kararı", "temettü karar",      # "temettü kararı aldı" → OLUMLU
    "temettü verimi",                       # "temettü verimi %X'i aştı" → OLUMLU
    "hisse geri alım", "geri alım programı", # buyback → OLUMLU
    "prim potansiyeli",                     # "%X prim potansiyeli" → OLUMLU
]

_KW_OLUMSUZ = [
    "tmsf",
    "net zarar",                              # 'zarar açıkladı' çok geniş — kaldırıldı
    "soruşturma", "sorusturma",
    "iflas", "haciz", "tasfiye",
    "sat tavsiyesi", "sat olarak belirledi",  # 'sat olarak' çok geniş — kaldırıldı
    "azalt tavsiyesi", "azalt olarak",
    "endeks altı getiri", "endeks alti getiri",
    "underperform", "underweight",
    "el konuldu", "el koyma",
]


def quick_label(text: str) -> str | None:
    """Kesin keyword varsa label doner, yoksa None (qwen'e bırak)."""
    tl = text.lower()
    # OLUMLU once kontrol et (al tavsiyesi + zarar varsa yine OLUMLU)
    if any(kw in tl for kw in _KW_OLUMLU):
        return "OLUMLU"
    if any(kw in tl for kw in _KW_OLUMSUZ):
        return "OLUMSUZ"
    return None

# ── Argümanlar ────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="BERT v3 + qwen2.5:7b konsensus etiketleyici")
    p.add_argument("--input",      default=str(INPUT_DEFAULT))
    p.add_argument("--output",     default=str(OUTPUT_DEFAULT))
    p.add_argument("--limit",      type=int, default=0,   help="Test: sadece ilk N satir")
    p.add_argument("--bert-only",  action="store_true",   help="Sadece BERT kullan (hizli)")
    p.add_argument("--resume",     action="store_true",   help="Kaldigi yerden devam et")
    p.add_argument("--batch-size", type=int, default=16,  help="BERT batch size")
    return p.parse_args()

# ── GPU kontrolü ──────────────────────────────────────────────────────────────

def require_gpu(model: str) -> None:
    """qwen GPU'da yuklu degilse programi durdur."""
    try:
        ps = requests.get(OLLAMA_PS_URL, timeout=10).json()
        for m in ps.get("models", []):
            if model in m.get("name", "") and m.get("size_vram", 0) > 0:
                vram_mb = m["size_vram"] // 1024 // 1024
                print(f"  GPU OK — {m['name']}: {vram_mb} MB VRAM")
                return
    except Exception as e:
        print(f"  [GPU kontrol hatasi]: {e}")

    print(f"  UYARI: {model} /api/ps'de gorunmuyor — CPU modunda devam ediliyor.")
    print(f"  (GPU kullanimi: Ollama servis logunu kontrol edin)")


def unload_ollama(model: str) -> None:
    """Modeli VRAM'den bosalt (BERT GPU kullanabilsin)."""
    try:
        r = requests.post(
            OLLAMA_URL,
            json={"model": model, "keep_alive": 0},
            timeout=15,
        )
        if r.status_code == 200:
            print(f"  {model} VRAM'den bosaltildi.")
    except Exception:
        pass  # servis calismiyor olabilir, sorun degil


def warmup_ollama(model: str) -> bool:
    """Modeli VRAM'e yukle, baglantıyı dogrula."""
    print(f"  {model} isinıyor...", end="", flush=True)
    try:
        r = requests.post(
            OLLAMA_URL,
            json={"model": model, "prompt": "merhaba", "stream": False,
                  "options": {"num_predict": 1, "temperature": 0}},
            timeout=120,
        )
        if r.status_code == 200:
            print(" hazir.")
            return True
        print(f" HTTP {r.status_code}")
        return False
    except Exception as e:
        print(f" hata: {e}")
        return False

# ── Ollama etiketleme ─────────────────────────────────────────────────────────

def ollama_label(text: str) -> str | None:
    """Tek satirlik Türkce haberi OLUMLU/OLUMSUZ/NOTR olarak etiktle."""
    try:
        r = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": _PROMPT.format(text=text[:TEXT_MAX_CHARS]),
                "stream": False,
                "options": {"num_predict": 4, "temperature": 0, "num_ctx": 1024},
            },
            timeout=OLLAMA_TIMEOUT,
        )
        r.raise_for_status()
        raw = r.json().get("response", "").strip().upper()
        for word in raw.split():
            w = word.rstrip(".,;:\n")
            if w in _NOTR_NORM:
                return "NÖTR"
            if w in VALID_LABELS:
                return w
        return None
    except requests.exceptions.ConnectionError:
        return None
    except Exception as e:
        print(f"  [Ollama hatasi]: {e}")
        return None

# ── Konsensüs ─────────────────────────────────────────────────────────────────

def get_consensus(
    bert_label: str,
    bert_score: float,
    qwen_label: str | None,
) -> tuple[str | None, str, float]:
    """
    Donus: (final_label, confidence, weight)
    confidence: HIGH | LOW | REJECT
    """
    if qwen_label is None:
        # BERT fast-accept — qwen'e gidilmedi
        return bert_label, "HIGH", 1.5

    if bert_label == qwen_label:
        return bert_label, "HIGH", 1.5

    # Anlasmazlik
    if bert_score < BERT_CONF_THRESH:
        # BERT belirsiz → qwen'e guven
        return qwen_label, "LOW", 0.5
    else:
        # BERT nispeten emin ama qwen farkli → mughlak, atla
        return None, "REJECT", 0.0

# ── CSV yardımcıları ──────────────────────────────────────────────────────────

_CSV_COLS = ["orig_idx", "text", "label", "confidence", "weight",
             "bert_label", "qwen_label", "bert_score"]


def append_rows(path: Path, rows: list[dict]) -> None:
    """Satirlari CSV'ye ekle (ilk yazista header yaz)."""
    if not rows:
        return
    write_header = not path.exists()
    pd.DataFrame(rows, columns=_CSV_COLS).to_csv(
        path, mode="a", index=False, encoding="utf-8", header=write_header
    )

# ── Ana fonksiyon ─────────────────────────────────────────────────────────────

_csv_lock = threading.Lock()

def _write_row(path: Path, row: dict) -> None:
    """Tek satiri aninda CSV'ye yaz (thread-safe)."""
    with _csv_lock:
        write_header = not path.exists()
        pd.DataFrame([row], columns=_CSV_COLS).to_csv(
            path, mode="a", index=False, encoding="utf-8", header=write_header
        )

# ── Ana fonksiyon ─────────────────────────────────────────────────────────────

def main() -> None:
    args          = parse_args()
    input_path    = Path(args.input)
    output_path   = Path(args.output)
    rejected_path = output_path.parent / "rejected_samples.csv"

    if not input_path.exists():
        print(f"HATA: {input_path} bulunamadi.")
        sys.exit(1)

    print("=" * 60)
    print(f"Faz 1 — {OLLAMA_MODEL} Etiketleme (BERT yok)")
    print("=" * 60)
    print(f"Girdi : {input_path}")
    print(f"Cikti : {output_path}")
    print(f"Model : {OLLAMA_MODEL}")
    print()

    df        = pd.read_csv(input_path)
    if args.limit > 0:
        df = df.head(args.limit)
        print(f"[TEST MODU] Ilk {args.limit} satir.\n")

    all_texts = df["text"].fillna("").tolist()
    total     = len(all_texts)
    print(f"Toplam satir: {total}")

    # Resume: orig_idx kolonundan islenmisleri bul
    done_indices = set()
    if args.resume:
        for p in (output_path, rejected_path):
            if p.exists():
                try:
                    done_indices.update(pd.read_csv(p)["orig_idx"].tolist())
                except Exception:
                    pass
        if done_indices:
            print(f"[RESUME] {len(done_indices)} satir zaten islenmis, atlaniyor.\n")
    else:
        output_path.unlink(missing_ok=True)
        rejected_path.unlink(missing_ok=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    pending_indices = [i for i in range(total) if i not in done_indices]
    pending_texts   = [all_texts[i] for i in pending_indices]
    pending_total   = len(pending_texts)

    if pending_total == 0:
        print("Tum satirlar zaten islenmis. Cikiliyor.")
        return
    print(f"Islenecek: {pending_total} satir\n")

    # qwen warmup + GPU kontrol
    if not warmup_ollama(OLLAMA_MODEL):
        print("HATA: Ollama erisileemiyor. 'ollama serve' calisiyor mu?")
        sys.exit(1)
    require_gpu(OLLAMA_MODEL)
    print()

    failed_count = [0]
    t0     = time.time()

    def process_one(args):
        j, orig_i = args
        text = pending_texts[j]
        # Kesin keyword varsa qwen'e gitmeden etiketle
        fast = quick_label(text)
        if fast is not None:
            qwen_lbl = fast
        else:
            qwen_lbl = ollama_label(text)
            if qwen_lbl is None:
                qwen_lbl = "NÖTR"
                failed_count[0] += 1
        _write_row(output_path, {
            "orig_idx":   orig_i,
            "text":       text,
            "label":      qwen_lbl,
            "confidence": "HIGH",
            "weight":     1.5,
            "bert_label": None,
            "qwen_label": qwen_lbl,
            "bert_score": None,
        })

    print(f"  Paralel worker: {OLLAMA_WORKERS}x\n")
    with tqdm(total=pending_total, unit="satir", desc="  qwen", ncols=70) as pbar:
        with ThreadPoolExecutor(max_workers=OLLAMA_WORKERS) as ex:
            futs = {ex.submit(process_one, (j, orig_i)): orig_i
                    for j, orig_i in enumerate(pending_indices)}
            for fut in as_completed(futs):
                fut.result()  # exception'u yukari tasir
                pbar.update(1)

    elapsed = time.time() - t0
    print(f"\n  Tamamlandi: {elapsed:.1f}s ({pending_total/elapsed:.1f} satir/s)")
    if failed_count[0]:
        print(f"  Uyari: {failed_count[0]} Ollama hatasi -> NOTR olarak kaydedildi")

    # ── Ozet ──────────────────────────────────────────────────────────────
    final_df = pd.read_csv(output_path) if output_path.exists() else pd.DataFrame()

    print(f"\n{'=' * 60}")
    print(f"Toplam CSV: {len(final_df)} satir")

    if len(final_df):
        print("\nEtiket dagilimi:")
        for lbl, cnt in final_df["label"].value_counts().items():
            print(f"  {lbl:<10}: {cnt:>5} ({cnt/len(final_df)*100:.1f}%)")

    print(f"\nDosya: {output_path}")
    print("\nSonraki adimlar:")
    print("  python build_gold_test.py          # Faz 2")
    print("  python train_v4.py --model savasy  # Faz 3")


if __name__ == "__main__":
    main()