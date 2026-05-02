#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
triple_label.py — 3 Model Çoğunluk Oylamalı BIST Haber Sentiment Etiketleyici

Strateji:
  - 3 model sırayla çalışır (tek GPU VRAM'e sığması için birer birer yüklenir)
  - Oylama sonuçları:
      3/3 aynı → HIGH   → output/unanimous_labeled.csv
      2/3 aynı → MEDIUM → output/majority_labeled.csv
      hepsi farklı → REJECT → output/rejected.csv  (eğitime girmez)

Kullanım:
  python triple_label.py --limit 20        # Hızlı test (20 satır)
  python triple_label.py                   # Tüm dosyayı işle
  python triple_label.py --resume          # Kaldığı yerden devam
  python triple_label.py --input dosya.csv # Farklı girdi dosyası
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

# ── Ayarlar ───────────────────────────────────────────────────────────────────

OLLAMA_URL     = "http://localhost:11434/api/generate"
OLLAMA_TIMEOUT = 90
WORKERS        = 8        # paralel istek sayısı — RTX 5070 için optimize
TEXT_MAX_CHARS = 600      # prompta gönderilecek max karakter

# Modeller — eğer yoksa ollama pull <model_adı> komutuyla indir
MODEL_A = "qwen3:14b"
MODEL_B = "gemma3:12b"
MODEL_C = "llama3.1:latest"

HERE = Path(__file__).resolve().parent

INPUT_DEFAULT    = HERE / "all_unlabeled.csv"
OUTPUT_DIR       = HERE / "output"
OUT_UNANIMOUS    = OUTPUT_DIR / "unanimous_labeled.csv"   # 3/3 — HIGH
OUT_MAJORITY     = OUTPUT_DIR / "majority_labeled.csv"    # 2/3 — MEDIUM
OUT_REJECTED     = OUTPUT_DIR / "rejected.csv"            # anlaşmazlık

CHECKPOINT_A        = OUTPUT_DIR / "checkpoint_a.json"
CHECKPOINT_B        = OUTPUT_DIR / "checkpoint_b.json"
CHECKPOINT_C        = OUTPUT_DIR / "checkpoint_c.json"
CHECKPOINT_INTERVAL = 500   # her N satırda bir diske kaydet

VALID_LABELS = {"OLUMLU", "OLUMSUZ", "NÖTR"}
_NOTR_NORM   = {"NOTR", "NÖTR"}

# qwen3 thinking modu: API isteğine top-level "think": false eklenerek kapatılır

# ── Prompt ────────────────────────────────────────────────────────────────────

_PROMPT = """\
Aşağıdaki Türkçe finans haberi metnini yatırımcı perspektifinden değerlendir ve yalnızca tek kelime yaz: OLUMLU, OLUMSUZ veya NOTR

Etiket tanımları:
OLUMLU — Metin, ilgili şirket veya varlık için açıkça olumlu bir finansal ya da operasyonel gelişmeyi yansıtıyorsa.
OLUMSUZ — Metin, ilgili şirket veya varlık için açıkça olumsuz bir finansal ya da operasyonel gelişmeyi yansıtıyorsa.
NOTR — Metin tarafsız bilgi aktarıyorsa, net bir olumlu ya da olumsuz sinyal taşımıyorsa veya yorum gerektiriyorsa.

Değerlendirme kuralları:
- Yalnızca metnin gerçek içeriğine dayan; metinde açıkça ifade edilmeyen sonuçlara varma.
- Metin yarım veya kırpılmış olabilir; eksik bilgiyi tahmin etme.
- İkiye giden ya da karma sinyaller içeren metinlerde NOTR yaz.
- Belirsizlik durumunda NOTR yaz.
- Yanıtın yalnızca tek kelimeden oluşmalı: OLUMLU, OLUMSUZ veya NOTR

Metin: {text}
"""

# ── Ollama yardımcıları ───────────────────────────────────────────────────────

def warmup(model: str) -> bool:
    print(f"  {model} yükleniyor...", end="", flush=True)
    try:
        r = requests.post(
            OLLAMA_URL,
            json={"model": model, "prompt": "merhaba", "stream": False,
                  "options": {"num_predict": 1, "temperature": 0, "num_gpu": 99}},

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
        requests.post(OLLAMA_URL, json={"model": model, "keep_alive": 0}, timeout=15)
        print(f"  {model} VRAM'den boşaltıldı.")
    except Exception:
        pass


def _parse_label(raw: str) -> str:
    """Ham model çıktısından OLUMLU/OLUMSUZ/NÖTR etiketini çıkar.
    <think>...</think> bloklarını temizler, sondan başa doğru tarar."""
    import re
    # Thinking bloklarını temizle (Ollama zaten kesiyor ama savunma amaçlı)
    cleaned = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL)
    upper = cleaned.strip().upper()
    # Sondan başa tara: modeller genelde cevabı en sona yazar
    words = upper.split()
    for word in reversed(words):
        w = word.rstrip(".,;:\n")
        if w in _NOTR_NORM:
            return "NÖTR"
        if w in VALID_LABELS:
            return w
    return "NÖTR"


def call_model(model: str, text: str) -> str:
    prompt = _PROMPT.format(text=text[:TEXT_MAX_CHARS])
    is_qwen3 = "qwen3" in model.lower()
    payload = {
        "model":   model,
        "prompt":  prompt,
        "stream":  False,
        "options": {"num_predict": 16, "temperature": 0, "num_ctx": 1024, "num_gpu": 99},
    }
    if is_qwen3:
        payload["think"] = False  # thinking modunu kapat (Ollama >=0.5)
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        r.raise_for_status()
        raw = r.json().get("response", "")
        return _parse_label(raw)
    except Exception:
        return "NÖTR"


def label_phase(model: str, indices: list[int], texts: list[str],
                checkpoint_path: Path) -> dict[int, str]:
    """Modeli çalıştır, her CHECKPOINT_INTERVAL satırda diske kaydet."""
    results: dict[int, str] = {}

    # Var olan checkpoint'i yükle
    if checkpoint_path.exists():
        try:
            with open(checkpoint_path, encoding="utf-8") as f:
                results = {int(k): v for k, v in json.load(f).items()}
            print(f"  [CHECKPOINT] {len(results)} satır yüklendi, devam ediliyor.")
        except Exception:
            results = {}

    idx_to_text = dict(zip(indices, texts))
    remaining   = [i for i in indices if i not in results]
    lock        = threading.Lock()
    done_count  = [0]

    def _save_checkpoint():
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        with open(checkpoint_path, "w", encoding="utf-8") as f:
            json.dump({str(k): v for k, v in results.items()}, f, ensure_ascii=False)

    def _one(idx: int):
        lbl = call_model(model, idx_to_text[idx])
        with lock:
            results[idx] = lbl
            done_count[0] += 1
            if done_count[0] % CHECKPOINT_INTERVAL == 0:
                _save_checkpoint()

    with tqdm(total=len(indices), initial=len(indices) - len(remaining),
              unit="satır", desc=f"  {model}", ncols=72) as pbar:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            futs = {ex.submit(_one, i): i for i in remaining}
            for fut in as_completed(futs):
                fut.result()
                pbar.update(1)

    _save_checkpoint()  # faz sonu son kayıt
    return results

# ── CSV yardımcıları ──────────────────────────────────────────────────────────

_csv_lock = threading.Lock()

OUT_COLS = [
    "orig_idx", "text", "label", "confidence", "weight",
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


def build_text(row) -> str:
    """title + summary + content birleştir."""
    parts = []
    for col in ("title", "summary", "content"):
        val = str(row.get(col, "") or "").strip()
        if val:
            parts.append(val)
    return " ".join(parts)


# ── Model ön testi ────────────────────────────────────────────────────────────

_TEST_SAMPLES = [
    ("Şirket bu çeyrekte rekor kar açıkladı ve temettü ödeyeceğini duyurdu.",   "OLUMLU"),
    ("Fabrikada yangın çıktı, üretim tamamen durdu ve büyük zarar oluştu.",       "OLUMSUZ"),
    ("Şirket genel kurul toplantısını 15 Mayıs tarihinde yapacağını bildirdi.",   "NÖTR"),
    ("Banka net karını yüzde kırk artırarak beklentilerin üzerine çıktı.",        "OLUMLU"),
    ("Şirkete vergi kaçakçılığı nedeniyle ağır para cezası uygulandı.",           "OLUMSUZ"),
]


def pre_run_test(model: str) -> bool:
    """Modeli 5 bilinen örnekle test et.
    Tümü NÖTR dönüyorsa False döner ve kullanıcıyı uyarır."""
    print(f"\n  [TEST] {model} — 5 örnek kontrol ediliyor...")
    results = []
    all_notr = True
    for text, expected in _TEST_SAMPLES:
        label = call_model(model, text)
        ok = "✓" if label == expected else "?"
        results.append(label)
        if label != "NÖTR":
            all_notr = False
        print(f"    {ok} beklenen={expected:<8} dönen={label:<8}  {text[:50]}")
    dist = {l: results.count(l) for l in set(results)}
    print(f"  Dağılım: {dist}")
    if all_notr:
        print(f"  ⚠ UYARI: {model} tüm örnekleri NÖTR döndürdü — bu model atlanıyor!")
        return False
    return True

# ── Argümanlar ────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="3 model çoğunluk oylamalı sentiment etiketleyici")
    p.add_argument("--input",  default=str(INPUT_DEFAULT), help="Girdi CSV dosyası")
    p.add_argument("--limit",  type=int, default=0,        help="Test için satır sınırı (0=tümü)")
    p.add_argument("--resume", action="store_true",        help="Kaldığı yerden devam et")
    return p.parse_args()

# ── Ana fonksiyon ─────────────────────────────────────────────────────────────

def main() -> None:
    args       = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"HATA: {input_path} bulunamadı.")
        sys.exit(1)

    print("=" * 64)
    print("3 Model Sentiment Etiketleyici")
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

    # text kolonu yoksa birleştir
    if "text" not in df.columns:
        df["text"] = df.apply(build_text, axis=1)

    texts    = df["text"].fillna("").tolist()
    all_orig = list(range(len(texts)))
    print(f"Toplam satır: {len(texts)}\n")

    # Resume: daha önce işlenenleri atla
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

    pending = [i for i in all_orig if i not in done_indices]
    p_texts = [texts[i] for i in pending]

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
    labels_a = label_phase(MODEL_A, pending, p_texts, CHECKPOINT_A)
    print(f"  Faz A tamamlandı: {time.time()-t0:.1f}s\n")
    unload(MODEL_A)
    time.sleep(2)

    # ── Faz B ─────────────────────────────────────────────────────────────
    print(f"── Faz B: {MODEL_B} ──")
    if not warmup(MODEL_B):
        print(f"UYARI: {MODEL_B} bulunamadı. 'ollama pull {MODEL_B}' ile indirin.")
        labels_b = {}
    else:
        if not pre_run_test(MODEL_B):
            print(f"HATA: {MODEL_B} düzgün etiketlemiyor. Script durduruluyor.")
            sys.exit(1)
        print()
        t0 = time.time()
        labels_b = label_phase(MODEL_B, pending, p_texts, CHECKPOINT_B)
        print(f"  Faz B tamamlandı: {time.time()-t0:.1f}s\n")
        unload(MODEL_B)
        time.sleep(2)

    # ── Faz C ─────────────────────────────────────────────────────────────
    print(f"── Faz C: {MODEL_C} ──")
    if not warmup(MODEL_C):
        print(f"UYARI: {MODEL_C} bulunamadı. 'ollama pull {MODEL_C}' ile indirin.")
        labels_c = {}
    else:
        if not pre_run_test(MODEL_C):
            print(f"HATA: {MODEL_C} düzgün etiketlemiyor. Script durduruluyor.")
            sys.exit(1)
        print()
        t0 = time.time()
        labels_c = label_phase(MODEL_C, pending, p_texts, CHECKPOINT_C)
        print(f"  Faz C tamamlandı: {time.time()-t0:.1f}s\n")

    # ── Oylama ────────────────────────────────────────────────────────────
    unanimous_rows: list[dict] = []
    majority_rows:  list[dict] = []
    rejected_rows:  list[dict] = []

    for orig_i, text in zip(pending, p_texts):
        la = labels_a.get(orig_i, "NÖTR")
        lb = labels_b.get(orig_i, "NÖTR")
        lc = labels_c.get(orig_i, "NÖTR")

        votes  = Counter([la, lb, lc])
        winner, top_count = votes.most_common(1)[0]

        row = {
            "orig_idx":      orig_i,
            "text":          text,
            "label":         winner,
            "confidence":    None,
            "weight":        None,
            "model_a_label": la,
            "model_b_label": lb,
            "model_c_label": lc,
        }

        if top_count == 3:
            # 3/3 oybirliği
            row["confidence"] = "HIGH"
            row["weight"]     = 2.0
            unanimous_rows.append(row)
        elif top_count == 2:
            # 2/3 çoğunluk
            row["confidence"] = "MEDIUM"
            row["weight"]     = 1.0
            majority_rows.append(row)
        else:
            # hepsi farklı → red
            row["confidence"] = "REJECT"
            row["weight"]     = 0.0
            rejected_rows.append(row)

    write_rows(OUT_UNANIMOUS, unanimous_rows)
    write_rows(OUT_MAJORITY,  majority_rows)
    write_rows(OUT_REJECTED,  rejected_rows)

    # ── Özet ──────────────────────────────────────────────────────────────
    total = len(pending)
    print("=" * 64)
    print(f"Sonuçlar ({total} satır işlendi):\n")
    print(f"  3/3 oybirliği  HIGH   : {len(unanimous_rows):>5}  ({len(unanimous_rows)/total*100:.1f}%)")
    print(f"  2/3 çoğunluk   MEDIUM : {len(majority_rows):>5}  ({len(majority_rows)/total*100:.1f}%)")
    print(f"  Anlaşmazlık    REJECT : {len(rejected_rows):>5}  ({len(rejected_rows)/total*100:.1f}%)")
    accepted = len(unanimous_rows) + len(majority_rows)
    print(f"  ─────────────────────────────────────────────────────")
    print(f"  Toplam kabul (H+M)    : {accepted:>5}  ({accepted/total*100:.1f}%)\n")

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

    # Checkpoint dosyalarını temizle
    for cp in (CHECKPOINT_A, CHECKPOINT_B, CHECKPOINT_C):
        cp.unlink(missing_ok=True)

    # ── Otomatik yedek ────────────────────────────────────────────────────
    import shutil
    from datetime import datetime
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = OUTPUT_DIR / f"backup_{ts}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    for src in (OUT_UNANIMOUS, OUT_MAJORITY, OUT_REJECTED):
        if src.exists():
            shutil.copy2(src, backup_dir / src.name)
    print(f"\n  Yedek kaydedildi: {backup_dir}")

    print(f"Çıktı dizini: {OUTPUT_DIR}")
    print(f"  {OUT_UNANIMOUS.name}")
    print(f"  {OUT_MAJORITY.name}")
    print(f"  {OUT_REJECTED.name}")


if __name__ == "__main__":
    main()