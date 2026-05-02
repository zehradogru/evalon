#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
train.py  —  BIST duygu analizi BERT fine-tune

Kullanım:
  python train.py                        # savasy modeli, varsayılan ayarlar
  python train.py --model dbmdz          # Türkçe BERT baseline
  python train.py --model xlmr           # XLM-RoBERTa (daha büyük)
  python train.py --epochs 3 --test      # Hızlı test çalışması

Çıktı:
  checkpoints/   ← eğitim ara kayıtları
  final_model/   ← deploy edilebilir model + tokenizer
"""
from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, classification_report, f1_score
from torch.utils.data import Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

SEED = 42
LABEL2ID = {"NÖTR": 0, "OLUMLU": 1, "OLUMSUZ": 2}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}

MODEL_CONFIGS = {
    "savasy": {
        "name": "savasy/bert-base-turkish-sentiment-cased",
        "batch_size": 32,
    },
    "dbmdz": {
        "name": "dbmdz/bert-base-turkish-cased",
        "batch_size": 32,
    },
    "xlmr": {
        "name": "xlm-roberta-base",
        "batch_size": 16,
    },
}


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="savasy", choices=list(MODEL_CONFIGS.keys()))
    p.add_argument("--epochs", type=int, default=8)
    p.add_argument("--batch-size", type=int, default=0, help="0 = model default")
    p.add_argument("--lr", type=float, default=2e-5)
    p.add_argument("--max-length", type=int, default=128)
    p.add_argument("--output", default=str(HERE / "final_model"))
    p.add_argument("--test", action="store_true", help="Son test seti değerlendirmesi yap")
    return p.parse_args()


class SentimentDataset(Dataset):
    def __init__(self, texts: list[str], labels: list[int], tokenizer, max_length: int):
        self.encodings = tokenizer(
            texts, truncation=True, padding=True, max_length=max_length
        )
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> dict:
        item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": float(accuracy_score(labels, preds)),
        "macro_f1": float(f1_score(labels, preds, average="macro")),
    }


def load_split(path: Path) -> tuple[list[str], list[int]]:
    df = pd.read_csv(path)
    df = df[df["label"].isin(LABEL2ID)].dropna(subset=["text", "label"])
    texts = df["text"].astype(str).tolist()
    labels = df["label"].map(LABEL2ID).tolist()
    return texts, labels


def main() -> None:
    args = parse_args()
    set_seed(SEED)

    cfg = MODEL_CONFIGS[args.model]
    model_name = cfg["name"]
    batch_size = args.batch_size if args.batch_size > 0 else cfg["batch_size"]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    fp16 = device == "cuda"

    print("=" * 60)
    print(f"BERT Fine-Tune: {args.model}  ({model_name})")
    print("=" * 60)
    print(f"Device     : {device}" + (f"  ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""))
    print(f"epochs={args.epochs}  batch={batch_size}  lr={args.lr}  max_len={args.max_length}  fp16={fp16}")
    print()

    # Veri yükle
    train_texts, train_labels = load_split(DATA / "train_split.csv")
    val_texts,   val_labels   = load_split(DATA / "val_split.csv")
    print(f"Train: {len(train_texts)}  |  Val: {len(val_texts)}")

    # Tokenizer
    print(f"\nTokenizer yükleniyor...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    train_ds = SentimentDataset(train_texts, train_labels, tokenizer, args.max_length)
    val_ds   = SentimentDataset(val_texts,   val_labels,   tokenizer, args.max_length)

    # Model
    print(f"Model yükleniyor...")
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=3,
        label2id=LABEL2ID,
        id2label=ID2LABEL,
        ignore_mismatched_sizes=True,
    )

    checkpoint_dir = HERE / f"checkpoints_{args.model}"
    final_dir = Path(args.output)

    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size * 2,
        learning_rate=args.lr,
        warmup_ratio=0.1,
        weight_decay=0.01,
        gradient_accumulation_steps=2,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        fp16=fp16,
        seed=SEED,
        report_to="none",
        logging_steps=50,
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
    )

    print(f"\nEğitim başlıyor...")
    trainer.train()

    # Final model kaydet
    print(f"\nModel kaydediliyor: {final_dir}")
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))
    print("Kaydedildi.")

    # Test seti değerlendirme
    if args.test and (DATA / "test_split.csv").exists():
        print(f"\n── Test Seti Değerlendirmesi ────────────────────────────")
        test_texts, test_labels = load_split(DATA / "test_split.csv")
        test_ds = SentimentDataset(test_texts, test_labels, tokenizer, args.max_length)
        preds_out = trainer.predict(test_ds)
        preds = np.argmax(preds_out.predictions, axis=-1)
        print(classification_report(
            test_labels, preds,
            target_names=["NÖTR", "OLUMLU", "OLUMSUZ"],
            digits=4,
        ))
        macro_f1 = f1_score(test_labels, preds, average="macro")
        print(f"Test Macro-F1: {macro_f1:.4f}")


if __name__ == "__main__":
    main()
