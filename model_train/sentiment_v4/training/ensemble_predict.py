#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/ensemble_predict.py  —  Faz 4: Ensemble Tahmin

3 fine-tuned modelin soft-voting ile tahminlerini birleştirir.
Gold test seti üzerinde değerlendirir.

SOFT VOTING: Her modelin softmax olasılıkları ortalaması → argmax
(Majority voting değil — daha güvenilir olasılık odaklı yöntem)

KULLANIM:
  python ensemble_predict.py                          # Tam ensemble
  python ensemble_predict.py --models savasy dbmdz    # 2 modelle
  python ensemble_predict.py --input custom.csv       # Farklı test seti
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

LABEL2ID = {"NÖTR": 0, "OLUMLU": 1, "OLUMSUZ": 2}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}

MODEL_DIRS = {
    "savasy": MODEL_TRAIN_DIR / "bist_bert_model_v4_savasy",
    "xlmr": MODEL_TRAIN_DIR / "bist_bert_model_v4_xlmr",
    "dbmdz": MODEL_TRAIN_DIR / "bist_bert_model_v4_dbmdz",
}

DEFAULT_MAX_LENGTH = 256
DEFAULT_BATCH = 16


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--models", nargs="+", default=list(MODEL_DIRS.keys()),
                   choices=list(MODEL_DIRS.keys()), help="Kullanılacak modeller")
    p.add_argument("--input", default=str(HERE / "gold_test.csv"))
    p.add_argument("--output", default=str(HERE / "ensemble_predictions.csv"))
    p.add_argument("--batch-size", type=int, default=DEFAULT_BATCH)
    p.add_argument("--max-length", type=int, default=DEFAULT_MAX_LENGTH)
    return p.parse_args()


def get_probabilities(
    texts: list[str],
    model_key: str,
    batch_size: int,
    max_length: int,
) -> np.ndarray:
    """Verilen model için tüm metinlerin softmax olasılıklarını döndür. Shape: (N, 3)"""
    model_dir = MODEL_DIRS[model_key]
    if not model_dir.exists():
        print(f"  [!] {model_key} model dir bulunamadı: {model_dir} — atlandı")
        return None

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
    model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))
    model.to(device)
    model.eval()

    all_probs: list[np.ndarray] = []

    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch = texts[i: i + batch_size]
            enc = tokenizer(
                batch,
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=max_length,
            )
            enc = {k: v.to(device) for k, v in enc.items()}
            logits = model(**enc).logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()
            all_probs.append(probs)

    return np.vstack(all_probs)  # (N, 3)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)

    if not input_path.exists():
        print(f"HATA: {input_path} bulunamadı. Önce build_gold_test.py çalıştır.")
        sys.exit(1)

    print("=" * 60)
    print("Faz 4 — Ensemble Tahmin (Soft Voting)")
    print("=" * 60)

    df = pd.read_csv(input_path)
    texts = df["text"].fillna("").tolist()
    true_labels = df["label"].tolist()
    true_ids = [LABEL2ID[l] for l in true_labels if l in LABEL2ID]

    if len(true_ids) != len(texts):
        print("HATA: label sütununda bilinmeyen değer var.")
        sys.exit(1)

    print(f"Test seti: {len(texts)} satır\n")

    # Her model için probabilities hesapla
    model_probs: dict[str, np.ndarray] = {}
    model_results: dict[str, dict] = {}

    for model_key in args.models:
        print(f"[{model_key}] inference...")
        probs = get_probabilities(texts, model_key, args.batch_size, args.max_length)
        if probs is None:
            continue
        model_probs[model_key] = probs

        # Tek model metrikleri
        preds = np.argmax(probs, axis=-1).tolist()
        acc = accuracy_score(true_ids, preds)
        f1 = f1_score(true_ids, preds, average="macro")
        model_results[model_key] = {"accuracy": acc, "macro_f1": f1, "preds": preds}
        print(f"  acc={acc:.4f}, macro_f1={f1:.4f}")

    if not model_probs:
        print("HATA: Hiçbir model yüklenemedi.")
        sys.exit(1)

    # Soft voting — ortalama olasılıklar
    stacked = np.stack(list(model_probs.values()), axis=0)  # (n_models, N, 3)
    avg_probs = stacked.mean(axis=0)  # (N, 3)
    ensemble_preds = np.argmax(avg_probs, axis=-1).tolist()
    ensemble_confs = avg_probs.max(axis=-1).tolist()

    # Ensemble metrikleri
    ens_acc = accuracy_score(true_ids, ensemble_preds)
    ens_f1 = f1_score(true_ids, ensemble_preds, average="macro")

    # Sonuçları kaydet
    result_df = df[["text", "label"]].copy()
    result_df["ensemble_pred"] = [ID2LABEL[p] for p in ensemble_preds]
    result_df["ensemble_conf"] = [round(c, 4) for c in ensemble_confs]
    for mk, res in model_results.items():
        result_df[f"{mk}_pred"] = [ID2LABEL[p] for p in res["preds"]]

    output_path = Path(args.output)
    result_df.to_csv(output_path, index=False, encoding="utf-8")

    # ── Özet ─────────────────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print("SONUÇLAR (Gold Test Seti)")
    print("=" * 60)

    print("\nTek Model Performansı:")
    for mk, res in sorted(model_results.items(), key=lambda x: -x[1]["macro_f1"]):
        print(f"  {mk:<8}: acc={res['accuracy']:.4f}, macro_f1={res['macro_f1']:.4f}")

    print(f"\nEnsemble (Soft Voting):")
    print(f"  accuracy   : {ens_acc:.4f}")
    print(f"  macro_f1   : {ens_f1:.4f}")

    print(f"\nPer-class rapor (Ensemble):")
    print(classification_report(
        true_ids,
        ensemble_preds,
        target_names=[ID2LABEL[i] for i in range(3)],
        digits=4,
    ))

    print("Confusion Matrix (Ensemble):")
    print(confusion_matrix(true_ids, ensemble_preds))

    print(f"\n{'=' * 60}")
    if ens_acc >= 0.95:
        print(f"HEDEF KARŞILANDI: acc={ens_acc:.4f} ≥ 0.95")
    else:
        print(f"Hedef: acc ≥ 0.95 | Mevcut: {ens_acc:.4f}")
        diff = 0.95 - ens_acc
        print(f"  Eksik: {diff:.4f} ({diff*100:.1f} puan)")

    if ens_f1 >= 0.93:
        print(f"HEDEF KARŞILANDI: macro_f1={ens_f1:.4f} ≥ 0.93")
    else:
        print(f"Hedef: macro_f1 ≥ 0.93 | Mevcut: {ens_f1:.4f}")

    print(f"\nTahmin dosyası: {output_path}")


if __name__ == "__main__":
    main()
