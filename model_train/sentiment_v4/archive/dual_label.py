#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/dual_label.py — İki model konsensüs etiketleme

Strateji:
  1. Keyword pre-filter → direkt etiket (kesin sinyal, her iki model de "kabul")
  2. Faz A: qwen2.5:7b ile tüm satırları etiketle
  3. Faz B: llama3.1 ile aynı satırları etiketle (qwen unload edilir, llama yüklenir)
  4. Konsensüs:
       keyword eşleşti             → KABUL (weight=2.0, güvenilir keyword)
       qwen == llama               → KABUL (weight=1.5)
       qwen != llama               → RED   (dual_rejected.csv'ye yaz, eğitime girmiyor)

Kullanım:
  python dual_label.py                    # Tam çalıştır
  python dual_label.py --limit 100        # Hızlı test
  python dual_label.py --resume           # Kaldığı yerden devam et
  python dual_label.py --input train_clean.csv
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

HERE            = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent

OLLAMA_URL      = "http://localhost:11434/api/generate"
OLLAMA_PS_URL   = "http://localhost:11434/api/ps"
OLLAMA_TIMEOUT  = 90
OLLAMA_WORKERS  = 4

TEXT_MAX_CHARS  = 600

MODEL_A = "qwen2.5:7b"
MODEL_B = "llama3.1:latest"

INPUT_DEFAULT    = HERE / "bist_haberler_ALL_content.csv"
OUTPUT_DEFAULT   = HERE / "dual_labeled_new.csv"
REJECTED_DEFAULT = HERE / "dual_rejected_new.csv"

VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}
_NOTR_NORM   = {"NOTR", "NÖTR", "NÖTR"}

# ── Prompt (açıklama tabanlı, örnek yok) ─────────────────────────────────────

_PROMPT = """\
BIST haber metnini yatırımcı perspektifinden değerlendir. YALNIZCA tek kelime yaz: OLUMLU, OLUMSUZ veya NOTR

OLUMLU: Şirket için net pozitif finansal veya operasyonel gelişme.
Kâr artışı, güçlü bilanço, temettü veya bedelsiz dağıtımı, al/overweight/outperform tavsiyesi,
hedef fiyat artışı, yeni büyük sözleşme veya yatırım, hisse geri alımı.

OLUMSUZ: Şirket için net negatif gelişme.
Zarar/ziyan açıklaması, sat/underperform/underweight tavsiyesi, TMSF el koyması,
soruşturma/haciz/iflas, hedef fiyat indirimi, düşüşe neden olan gelişme.

NOTR: Net yatırım sinyali yok.
Teknik analiz veya destek/direnç seviyeleri, genel endeks/piyasa özeti,
KAP bildirimi (tavsiye içermeyen), salt fiyat/hacim/işlem bilgisi.

Haber: {text}
"""

# ── Keyword pre-filter ────────────────────────────────────────────────────────

_KW_OLUMLU = [
    "al tavsiyesi", "al olarak belirledi", "al olarak deklare",
    "al görüşü", "al gorusu", "al önerisi", "al onerisi",
    "endeks üstü getiri", "endeks ustu getiri",
    "overweight", "outperform",
    "net kâr artı", "net kar arti", "kâr büyüdü", "kar buyudu",
    "bedelsiz hisse dağıtacak", "bedelsiz sermaye artırımı gerçekleştir",
    "bedelsiz sermaye artırımı", "bedelsiz artirimi",
    "temettü açıkladı", "temettu acikladi",
    "temettü kararı", "temettü karar",
    "temettü verimi",
    "hisse geri alım", "geri alım programı",
    "prim potansiyeli",
]

_KW_OLUMSUZ = [
    "tmsf",
    "net zarar",
    "soruşturma", "sorusturma",
    "iflas", "haciz", "tasfiye",
    "sat tavsiyesi", "sat olarak belirledi",
    "azalt tavsiyesi", "azalt olarak",
    "endeks altı getiri", "endeks alti getiri",
    "underperform", "underweight",
    "el konuldu", "el koyma",
]


def quick_label(text: str) -> str | None:
    """Kesin keyword varsa label döner, yoksa None."""
    tl = text.lower()
    if any(kw in tl for kw in _KW_OLUMLU):
        return "OLUMLU"
    if any(kw in tl for kw in _KW_OLUMSUZ):
        return "OLUMSUZ"
    return None


# ── Ollama yardımcıları ───────────────────────────────────────────────────────

def warmup(model: str) -> bool:
    print(f"  {model} ısınıyor...", end="", flush=True)
    try:
        r = requests.post(
            OLLAMA_URL,
            json={"model": model, "prompt": "merhaba", "stream": False,
                  "options": {"num_predict": 1, "temperature": 0}},
            timeout=120,
        )
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
        requests.post(OLLAMA_URL,
                      json={"model": model, "keep_alive": 0},
                      timeout=15)
        print(f"  {model} VRAM'den boşaltıldı.")
    except Exception:
        pass


def call_model(model: str, text: str) -> str | None:
    try:
        r = requests.post(
            OLLAMA_URL,
            json={
                "model":   model,
                "prompt":  _PROMPT.format(text=text[:TEXT_MAX_CHARS]),
                "stream":  False,
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
        print(f"  [{model} hatası]: {e}")
        return None


# ── Bir modelle tüm satırları etiketle (paralel) ─────────────────────────────

def label_all(model: str, indices: list[int], texts: list[str],
              desc: str) -> dict[int, str]:
    """Verilen (orig_idx → text) çiftlerini etiketle, {orig_idx: label} döndür."""
    results: dict[int, str] = {}
    lock = threading.Lock()
    failed = [0]

    def _one(args):
        orig_i, text = args
        lbl = call_model(model, text)
        if lbl is None:
            lbl = "NÖTR"
            failed[0] += 1
        with lock:
            results[orig_i] = lbl

    with tqdm(total=len(indices), unit="satır", desc=f"  {desc}", ncols=72) as pbar:
        with ThreadPoolExecutor(max_workers=OLLAMA_WORKERS) as ex:
            futs = {ex.submit(_one, (idx, txt)): idx
                    for idx, txt in zip(indices, texts)}
            for fut in as_completed(futs):
                fut.result()
                pbar.update(1)

    if failed[0]:
        print(f"  Uyarı: {failed[0]} Ollama hatası → NÖTR atandı")
    return results


# ── CSV yardımcıları ──────────────────────────────────────────────────────────

_CSV_COLS = ["orig_idx", "text", "label", "confidence", "weight",
             "model_a_label", "model_b_label", "source"]

_csv_lock = threading.Lock()


def write_rows(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with _csv_lock:
        write_header = not path.exists()
        pd.DataFrame(rows, columns=_CSV_COLS).to_csv(
            path, mode="a", index=False, encoding="utf-8", header=write_header
        )


# ── Argümanlar ────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="qwen2.5:7b + llama3.1 çift model etiketleyici")
    p.add_argument("--input",  default=str(INPUT_DEFAULT))
    p.add_argument("--output", default=str(OUTPUT_DEFAULT))
    p.add_argument("--limit",  type=int, default=0)
    p.add_argument("--resume", action="store_true")
    return p.parse_args()


# ── Ana fonksiyon ─────────────────────────────────────────────────────────────

def main() -> None:
    args          = parse_args()
    input_path    = Path(args.input)
    output_path   = Path(args.output)
    rejected_path = output_path.parent / REJECTED_DEFAULT.name

    if not input_path.exists():
        print(f"HATA: {input_path} bulunamadı.")
        sys.exit(1)

    print("=" * 64)
    print(f"Çift Model Konsensüs Etiketleme")
    print(f"  Model A : {MODEL_A}")
    print(f"  Model B : {MODEL_B}")
    print(f"  Strateji: A==B → KABUL | A!=B → RED")
    print("=" * 64)

    df = pd.read_csv(input_path)
    if args.limit > 0:
        df = df.head(args.limit)
        print(f"[TEST MODU] İlk {args.limit} satır.\n")

    # text kolonu yoksa title+summary+content birleştir
    if "text" not in df.columns:
        def _build_text(row) -> str:
            parts = []
            for col in ("title", "summary", "content"):
                val = str(row.get(col, "") or "").strip()
                if val:
                    parts.append(val)
            return " ".join(parts)
        df["text"] = df.apply(_build_text, axis=1)

    texts      = df["text"].fillna("").tolist()
    all_orig   = list(range(len(texts)))
    total      = len(texts)
    print(f"Toplam satır: {total}\n")

    # Resume: tamamlananları atla
    done_indices: set[int] = set()
    if args.resume:
        for p in (output_path, rejected_path):
            if p.exists():
                try:
                    done_indices.update(pd.read_csv(p)["orig_idx"].tolist())
                except Exception:
                    pass
        if done_indices:
            print(f"[RESUME] {len(done_indices)} satır zaten işlenmiş, atlanıyor.\n")
    else:
        output_path.unlink(missing_ok=True)
        rejected_path.unlink(missing_ok=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    pending = [i for i in all_orig if i not in done_indices]
    if not pending:
        print("Tüm satırlar işlenmiş. Çıkılıyor.")
        return

    print(f"İşlenecek: {len(pending)} satır\n")

    # ── Adım 1: Tüm satırlar LLM'e gider ─────────────────────────────────
    llm_indices: list[int]  = list(pending)
    llm_texts:   list[str]  = [texts[i] for i in pending]

    print(f"LLM'e gidecek   : {len(llm_indices):>5} satır\n")

    if not llm_indices:
        print("LLM'e gidecek satır yok, tamamlandı.")
    else:
        # ── Adım 2: Model A (qwen) ────────────────────────────────────────
        print(f"── Faz A: {MODEL_A} ──────────────────────────────────────────")
        if not warmup(MODEL_A):
            print("HATA: Ollama erişilemiyor.")
            sys.exit(1)

        t0 = time.time()
        labels_a = label_all(MODEL_A, llm_indices, llm_texts, MODEL_A)
        print(f"  Faz A tamamlandı: {time.time()-t0:.1f}s\n")

        # ── Adım 3: Model B (llama3.1) ────────────────────────────────────
        print(f"── Faz B: {MODEL_B} ─────────────────────────────────────────")
        unload(MODEL_A)
        time.sleep(2)  # VRAM'in boşalması için kısa bekleme
        if not warmup(MODEL_B):
            print("HATA: llama3.1 başlatılamadı.")
            sys.exit(1)

        t0 = time.time()
        labels_b = label_all(MODEL_B, llm_indices, llm_texts, MODEL_B)
        print(f"  Faz B tamamlandı: {time.time()-t0:.1f}s\n")

        # ── Adım 4: Konsensüs ─────────────────────────────────────────────
        accepted_rows: list[dict] = []
        rejected_rows: list[dict] = []

        for orig_i, text in zip(llm_indices, llm_texts):
            la = labels_a.get(orig_i, "NÖTR")
            lb = labels_b.get(orig_i, "NÖTR")
            if la == lb:
                accepted_rows.append({
                    "orig_idx":    orig_i,
                    "text":        text,
                    "label":       la,
                    "confidence":  "HIGH",
                    "weight":      1.5,
                    "model_a_label": la,
                    "model_b_label": lb,
                    "source":      "consensus",
                })
            else:
                rejected_rows.append({
                    "orig_idx":    orig_i,
                    "text":        text,
                    "label":       None,
                    "confidence":  "REJECT",
                    "weight":      0.0,
                    "model_a_label": la,
                    "model_b_label": lb,
                    "source":      "disagreement",
                })

        write_rows(output_path, accepted_rows)
        write_rows(rejected_path, rejected_rows)

        total_llm    = len(llm_indices)
        agree_count  = len(accepted_rows)
        reject_count = len(rejected_rows)
        agree_pct    = agree_count / total_llm * 100 if total_llm else 0

        print(f"── Konsensüs sonuçları ──────────────────────────────────────")
        print(f"  Toplam LLM değerlendirilen : {total_llm}")
        print(f"  İkisi de aynı fikir (KABUL): {agree_count} ({agree_pct:.1f}%)")
        print(f"  Anlaşmazlık (RED)          : {reject_count} ({100-agree_pct:.1f}%)")
        print()

    # ── Özet ──────────────────────────────────────────────────────────────
    final_df = pd.read_csv(output_path) if output_path.exists() else pd.DataFrame()
    print(f"{'=' * 64}")
    print(f"Kabul edilen toplam: {len(final_df)} satır")

    if len(final_df):
        print("\nEtiket dağılımı:")
        for lbl, cnt in final_df["label"].value_counts().items():
            pct = cnt / len(final_df) * 100
            print(f"  {lbl:<10}: {cnt:>5} ({pct:.1f}%)")

    if rejected_path.exists():
        rej_df = pd.read_csv(rejected_path)
        print(f"\nRed edilen (eğitime girmiyor): {len(rej_df)} satır")

    print(f"\nKabul  : {output_path}")
    print(f"Red    : {rejected_path}")
    print("\nSonraki adım:")
    print("  python build_gold_test.py --input dual_labeled.csv")
    print("  python train_v4.py --input dual_labeled.csv --model savasy")


if __name__ == "__main__":
    main()
