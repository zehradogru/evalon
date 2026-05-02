#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/evaluate.py  —  Faz 6: Final Değerlendirme

Gold test seti üzerinde tüm modeller ve ensemble için:
  - Accuracy, Macro F1
  - Per-class: precision, recall, F1
  - Confusion matrix
  - %95 hedef kontrolü

KULLANIM:
  python evaluate.py
  python evaluate.py --gold gold_test.csv
  python evaluate.py --predictions ensemble_predictions.csv  # Var olan tahminler üzerine
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)

HERE = Path(__file__).resolve().parent

LABEL2ID = {"NÖTR": 0, "OLUMLU": 1, "OLUMSUZ": 2}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}
LABELS = [ID2LABEL[i] for i in range(3)]

TARGET_ACC = 0.95
TARGET_MACRO_F1 = 0.93
TARGET_CLASS_F1 = 0.90  # Her sınıf için minimum F1


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--gold", default=str(HERE / "gold_test.csv"))
    p.add_argument("--predictions", default=str(HERE / "ensemble_predictions.csv"),
                   help="ensemble_predict.py çıktısı (sütun: ensemble_pred)")
    return p.parse_args()


def print_banner(title: str) -> None:
    print(f"\n{'═' * 60}")
    print(f"  {title}")
    print(f"{'═' * 60}")


def evaluate_predictions(
    true_labels: list[str],
    pred_labels: list[str],
    model_name: str,
) -> dict:
    true_ids = [LABEL2ID[l] for l in true_labels]
    pred_ids = [LABEL2ID[l] if l in LABEL2ID else 0 for l in pred_labels]

    acc = accuracy_score(true_ids, pred_ids)
    macro_f1 = f1_score(true_ids, pred_ids, average="macro")
    prec, rec, f1, _ = precision_recall_fscore_support(
        true_ids, pred_ids, labels=[0, 1, 2], zero_division=0
    )

    print_banner(model_name)
    print(f"  Accuracy  : {acc:.4f} {'✓' if acc >= TARGET_ACC else '✗ (hedef: ≥0.95)'}")
    print(f"  Macro F1  : {macro_f1:.4f} {'✓' if macro_f1 >= TARGET_MACRO_F1 else '✗ (hedef: ≥0.93)'}")

    print(f"\n  Per-class (F1 hedef ≥{TARGET_CLASS_F1}):")
    print(f"  {'Sınıf':<12} {'Precision':>10} {'Recall':>10} {'F1':>10} {'':>5}")
    for i, lbl in enumerate(LABELS):
        flag = "✓" if f1[i] >= TARGET_CLASS_F1 else "✗"
        print(f"  {lbl:<12} {prec[i]:>10.4f} {rec[i]:>10.4f} {f1[i]:>10.4f} {flag:>5}")

    print(f"\n  Confusion Matrix (satır=gerçek, sütun=tahmin):")
    cm = confusion_matrix(true_ids, pred_ids, labels=[0, 1, 2])
    header = "  " + "".join(f"{l:>10}" for l in LABELS)
    print(header)
    for i, row in enumerate(cm):
        print("  " + f"{LABELS[i]:<8}" + "".join(f"{v:>10}" for v in row))

    return {
        "model": model_name,
        "accuracy": acc,
        "macro_f1": macro_f1,
        "per_class_f1": {LABELS[i]: f1[i] for i in range(3)},
        "meets_target": acc >= TARGET_ACC and macro_f1 >= TARGET_MACRO_F1 and all(f1[i] >= TARGET_CLASS_F1 for i in range(3)),
    }


def main() -> None:
    args = parse_args()
    gold_path = Path(args.gold)
    pred_path = Path(args.predictions)

    if not gold_path.exists():
        print(f"HATA: {gold_path} bulunamadı.")
        sys.exit(1)

    gold_df = pd.read_csv(gold_path)
    true_labels = gold_df["label"].tolist()

    print("=" * 60)
    print("Faz 6 — Final Değerlendirme Raporu")
    print("=" * 60)
    print(f"Gold test: {len(gold_df)} satır")
    print(f"\nGold label dağılımı:")
    for lbl, cnt in gold_df["label"].value_counts().items():
        print(f"  {lbl:<10}: {cnt:>4} ({cnt/len(gold_df)*100:.1f}%)")

    all_results: list[dict] = []

    if pred_path.exists():
        pred_df = pd.read_csv(pred_path)
        # Ensure same order
        assert len(pred_df) == len(gold_df), "Gold ve prediction satır sayısı eşleşmiyor!"

        # Ensemble
        if "ensemble_pred" in pred_df.columns:
            res = evaluate_predictions(true_labels, pred_df["ensemble_pred"].tolist(), "Ensemble (Soft Voting)")
            all_results.append(res)

        # Tek modeller (varsa sütun olarak)
        for col in pred_df.columns:
            if col.endswith("_pred") and col != "ensemble_pred":
                model_key = col.replace("_pred", "")
                res = evaluate_predictions(true_labels, pred_df[col].tolist(), f"Model: {model_key}")
                all_results.append(res)
    else:
        print(f"\n  [!] {pred_path} bulunamadı.")
        print("  Önce ensemble_predict.py çalıştır:\n  python ensemble_predict.py")

    # Özet tablo
    if all_results:
        print_banner("ÖZET KARŞILAŞTIRMA")
        print(f"  {'Model':<30} {'Accuracy':>10} {'Macro F1':>10} {'Hedef':>8}")
        print(f"  {'─'*30} {'─'*10} {'─'*10} {'─'*8}")
        for r in sorted(all_results, key=lambda x: -x["macro_f1"]):
            flag = "✓ PASS" if r["meets_target"] else "✗ FAIL"
            print(f"  {r['model']:<30} {r['accuracy']:>10.4f} {r['macro_f1']:>10.4f} {flag:>8}")

        best = max(all_results, key=lambda x: x["macro_f1"])
        print(f"\n  En iyi model: {best['model']}")
        print(f"  Accuracy: {best['accuracy']:.4f} | Macro F1: {best['macro_f1']:.4f}")

        all_pass = all(r["meets_target"] for r in all_results)
        any_pass = any(r["meets_target"] for r in all_results)

        print(f"\n{'═' * 60}")
        if any_pass:
            print("  ≥%95 doğruluk hedefine ulaşıldı!")
            print("\n  SONRAKİ ADIMLAR:")
            print("  1. Oracle DB güncelle: python label_oracle_db.py")
            print("  2. Backend API endpoint'lerini güncelle")
            print("  3. Frontend news sayfasını gerçek data'ya bağla")
        else:
            print(f"  Henüz %95 hedefine ulaşılmadı.")
            print("\n  ÖNERİLER:")
            print("  - Daha fazla HIGH confidence örnek topla (multi_label.py tekrar çalıştır)")
            print("  - LOW confidence örnekleri filtrele (train_v4.py --min-confidence MEDIUM)")
            print("  - xlm-roberta-base dene (RTX 5070 ile)")
            print("  - Epoch sayısını artır: --epochs 12")


if __name__ == "__main__":
    main()
