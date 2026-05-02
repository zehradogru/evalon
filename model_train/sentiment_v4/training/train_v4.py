#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sentiment_v4/train_v4.py  —  Faz 3: BERT v4 Model Eğitimi

labeled_train_consensus.csv (Faz 1 çıktısı) ile 3 farklı base modeli fine-tune eder.
Her model ayrı checkpoint klasörüne kaydedilir.

BASE MODELLER:
  savasy  → savasy/bert-base-turkish-sentiment-cased  (Turkish, pre-labeled sentiment)
  xlmr    → xlm-roberta-base                          (multilingual, 270M param — RTX 5070 önerilir)
  dbmdz   → dbmdz/bert-base-turkish-cased             (Turkish BERT baseline = v3 ile aynı)

KONSENSÜS AĞIRLIKLARI (sample_weight):
  HIGH    → 1.5 (3/3 anlaşma)
  MEDIUM  → 1.0 (2/3 anlaşma, BERT ≥ 0.80)
  LOW     → 0.5 (2/3 anlaşma, BERT < 0.80)

EĞİTİM PARAMETRELERİ:
  epochs=8, early_stopping patience=3
  lr=2e-5, warmup_ratio=0.1, weight_decay=0.01
  gradient_accumulation_steps=2
  max_length=256

KULLANIM:
  python train_v4.py --model savasy
  python train_v4.py --model xlmr --batch-size 32   # RTX 5070
  python train_v4.py --model dbmdz --no-weights      # Ağırlıksız baseline
  python train_v4.py --model savasy --epochs 3       # Hızlı test
"""
from __future__ import annotations

import argparse
import math
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, f1_score
from torch.utils.data import Dataset, WeightedRandomSampler
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)

HERE = Path(__file__).resolve().parent
MODEL_TRAIN_DIR = HERE.parent
sys.path.insert(0, str(MODEL_TRAIN_DIR))

SEED = 42
DEFAULT_MAX_LENGTH = 256
DEFAULT_EPOCHS = 8
DEFAULT_LR = 2e-5
DEFAULT_WARMUP_RATIO = 0.1
DEFAULT_WEIGHT_DECAY = 0.01
DEFAULT_GRAD_ACCUM = 2
EARLY_STOPPING_PATIENCE = 3

MODEL_CONFIGS = {
    "savasy": {
        "name": "savasy/bert-base-turkish-sentiment-cased",
        "batch_size_default": 16,
        "dir": "checkpoints_savasy",
        "final_dir": "bist_bert_model_v4_savasy",
    },
    "xlmr": {
        "name": "xlm-roberta-base",
        "batch_size_default": 4,   # RTX 4060 (8GB): 4; RTX 5070 (12GB+): 16
        "dir": "checkpoints_xlmr",
        "final_dir": "bist_bert_model_v4_xlmr",
    },
    "dbmdz": {
        "name": "dbmdz/bert-base-turkish-cased",
        "batch_size_default": 16,
        "dir": "checkpoints_dbmdz",
        "final_dir": "bist_bert_model_v4_dbmdz",
    },
}

LABEL2ID = {"NÖTR": 0, "OLUMLU": 1, "OLUMSUZ": 2}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True, choices=list(MODEL_CONFIGS.keys()),
                   help="Base model: savasy | xlmr | dbmdz")
    p.add_argument("--input", default=str(HERE / "labeled_train_consensus.csv"))
    p.add_argument("--output-dir", default=None,
                   help="Checkpoint klasörü (varsayılan: sentiment_v4/checkpoints_{model}/)")
    p.add_argument("--final-dir", default=None,
                   help="Final model klasörü (varsayılan: bist_bert_model_v4_{model}/)")
    p.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    p.add_argument("--batch-size", type=int, default=0, help="0 = model default")
    p.add_argument("--lr", type=float, default=DEFAULT_LR)
    p.add_argument("--max-length", type=int, default=DEFAULT_MAX_LENGTH)
    p.add_argument("--no-weights", action="store_true", help="Sample ağırlıklarını kullanma")
    p.add_argument("--min-confidence", default="LOW", choices=["HIGH", "MEDIUM", "LOW"],
                   help="Minimum güven seviyesi: HIGH | MEDIUM | LOW")
    p.add_argument("--val-size", type=float, default=0.15)
    return p.parse_args()


# ── Dataset ───────────────────────────────────────────────────────────────────
class SentimentDataset(Dataset):
    def __init__(self, texts: list[str], labels: list[int], tokenizer, max_length: int) -> None:
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


# ── Metrikler ─────────────────────────────────────────────────────────────────
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    acc = accuracy_score(labels, preds)
    macro_f1 = f1_score(labels, preds, average="macro")
    return {"accuracy": acc, "macro_f1": macro_f1}


# ── Veri Yükle ────────────────────────────────────────────────────────────────
CONFIDENCE_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}


def load_data(input_path: str, min_confidence: str, no_weights: bool):
    df = pd.read_csv(input_path)

    # REJECT satırları zaten filtered ama yine de kontrol et
    df = df[df["confidence"] != "REJECT"].copy()
    df = df[df["label"].notna()].copy()

    # Minimum güven filtresi
    min_rank = CONFIDENCE_RANK[min_confidence]
    df = df[df["confidence"].map(CONFIDENCE_RANK) >= min_rank].copy()

    # Label encode
    df = df[df["label"].isin(LABEL2ID.keys())].copy()
    df["label_id"] = df["label"].map(LABEL2ID)

    # Weights
    if no_weights:
        df["weight"] = 1.0
    else:
        # Zaten weight kolonu var (1.5 / 1.0 / 0.5)
        if "weight" not in df.columns:
            df["weight"] = 1.0
        df["weight"] = df["weight"].fillna(1.0).astype(float)

    return df


# ── Split ─────────────────────────────────────────────────────────────────────
def split_data(df: pd.DataFrame, val_size: float, seed: int):
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    n_val = int(len(df) * val_size)
    val_df = df.iloc[:n_val]
    train_df = df.iloc[n_val:]
    return train_df.reset_index(drop=True), val_df.reset_index(drop=True)


# ── Ana Eğitim ────────────────────────────────────────────────────────────────
def main() -> None:
    args = parse_args()
    set_seed(SEED)

    cfg = MODEL_CONFIGS[args.model]
    model_name = cfg["name"]
    batch_size = args.batch_size if args.batch_size > 0 else cfg["batch_size_default"]

    checkpoint_dir = Path(args.output_dir) if args.output_dir else HERE / cfg["dir"]
    final_dir = Path(args.final_dir) if args.final_dir else MODEL_TRAIN_DIR / cfg["final_dir"]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    fp16 = device == "cuda"

    print("=" * 60)
    print(f"Faz 3 — BERT v4 Eğitimi: {args.model} ({model_name})")
    print("=" * 60)
    print(f"Device   : {device}" + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""))
    print(f"Girdi    : {args.input}")
    print(f"Çıktı    : {checkpoint_dir}")
    print(f"Final    : {final_dir}")
    print(f"epochs={args.epochs}, batch={batch_size}, lr={args.lr}, fp16={fp16}")
    print()

    # Veri yükle
    df = load_data(args.input, args.min_confidence, args.no_weights)
    print(f"Yüklenen: {len(df)} satır (min_confidence={args.min_confidence})")

    train_df, val_df = split_data(df, args.val_size, SEED)
    print(f"Train: {len(train_df)}, Val: {len(val_df)}")
    print(f"\nTrain label dağılımı:")
    for lbl, cnt in train_df["label"].value_counts().items():
        print(f"  {lbl}: {cnt}")
    print()

    # Tokenizer + Model
    print(f"Tokenizer yükleniyor: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    print(f"Model yükleniyor: {model_name}")
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=3,
        label2id=LABEL2ID,
        id2label=ID2LABEL,
        ignore_mismatched_sizes=True,
    )

    # Dataset oluştur
    train_dataset = SentimentDataset(
        train_df["text"].tolist(), train_df["label_id"].tolist(), tokenizer, args.max_length
    )
    val_dataset = SentimentDataset(
        val_df["text"].tolist(), val_df["label_id"].tolist(), tokenizer, args.max_length
    )

    # WeightedRandomSampler
    data_collator = None
    train_sampler = None
    if not args.no_weights and "weight" in train_df.columns:
        weights = torch.tensor(train_df["weight"].tolist(), dtype=torch.float)
        train_sampler = WeightedRandomSampler(
            weights, num_samples=len(weights), replacement=True
        )
        print(f"WeightedRandomSampler aktif: HIGH×1.5, MEDIUM×1.0, LOW×0.5")

    # Training arguments
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    final_dir.mkdir(parents=True, exist_ok=True)

    steps_per_epoch = math.ceil(len(train_dataset) / (batch_size * DEFAULT_GRAD_ACCUM))
    warmup_steps = int(steps_per_epoch * args.epochs * DEFAULT_WARMUP_RATIO)

    training_args = TrainingArguments(
        output_dir=str(checkpoint_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size * 2,
        learning_rate=args.lr,
        weight_decay=DEFAULT_WEIGHT_DECAY,
        warmup_steps=warmup_steps,
        gradient_accumulation_steps=DEFAULT_GRAD_ACCUM,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        fp16=fp16,
        seed=SEED,
        report_to="none",
        logging_steps=50,
        logging_dir=str(checkpoint_dir / "logs"),
    )

    # Trainer
    class WeightedTrainer(Trainer):
        """WeightedRandomSampler kullanmak için özel Trainer."""
        def get_train_dataloader(self):
            if train_sampler is not None:
                from torch.utils.data import DataLoader
                return DataLoader(
                    self.train_dataset,
                    batch_size=self._train_batch_size,
                    sampler=train_sampler,
                    collate_fn=self.data_collator,
                    drop_last=self.args.dataloader_drop_last,
                    num_workers=self.args.dataloader_num_workers,
                    pin_memory=self.args.dataloader_pin_memory,
                )
            return super().get_train_dataloader()

    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=EARLY_STOPPING_PATIENCE)],
    )

    # Eğit
    print(f"\nEğitim başlıyor... (patience={EARLY_STOPPING_PATIENCE})")
    trainer.train()

    # En iyi modeli kaydet
    print(f"\nEn iyi model kaydediliyor: {final_dir}")
    trainer.save_model(str(final_dir))
    tokenizer.save_pretrained(str(final_dir))

    # Doğrulama metrikleri
    print("\nDoğrulama seti değerlendirmesi:")
    metrics = trainer.evaluate()
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.4f}")

    val_acc = metrics.get("eval_accuracy", 0)
    val_f1 = metrics.get("eval_macro_f1", 0)

    print(f"\n{'=' * 60}")
    print(f"Sonuç: val_acc={val_acc:.4f}, val_macro_f1={val_f1:.4f}")
    if val_f1 >= 0.93:
        print("  Hedef makro F1 (≥0.93) karşılandı!")
    else:
        print(f"  Hedef makro F1: 0.93, mevcut: {val_f1:.4f} — daha fazla veri/epoch dene")

    print(
        "\nSONRAKİ ADIMLAR:\n"
        "  python train_v4.py --model xlmr   # Sıradaki base model\n"
        "  python ensemble_predict.py         # Faz 4: Ensemble değerlendirme\n"
        "  python evaluate.py                 # Faz 6: Gold test final değerlendirme"
    )


if __name__ == "__main__":
    main()
