#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
from pathlib import Path
import pandas as pd
import torch
from torch.utils.data import Dataset
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)
from sklearn.metrics import accuracy_score, f1_score
import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
OUTPUT = HERE / "final_model_entity_aware"

LABEL2ID = {"NÖTR": 0, "NOTR": 0, "OLUMLU": 1, "OLUMSUZ": 2}
ID2LABEL = {0: "NÖTR", 1: "OLUMLU", 2: "OLUMSUZ"}

class EntitySentimentDataset(Dataset):
    def __init__(self, symbols, texts, labels, tokenizer, max_length=256):
        # En onemli kisim: text=symbol, text_pair=text
        # Model bunu "[CLS] SYMBOL [SEP] TEXT [SEP]" olarak kodlar.
        self.encodings = tokenizer(
            text=symbols,
            text_pair=texts,
            truncation="only_second", # Sadece haberi kes, sembolu kesme
            padding="max_length",
            max_length=max_length,
        )
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
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

def load_data(csv_path):
    df = pd.read_csv(csv_path)
    symbols = df["symbol"].astype(str).tolist()
    texts = df["text"].astype(str).tolist()
    labels = df["label"].map(LABEL2ID).tolist()
    return symbols, texts, labels

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="dbmdz/bert-base-turkish-cased")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    parser.add_argument("--max-len", type=int, default=256)
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    
    # 1. Tokenizer & Model
    print("Tokenizer ve Model yukleniyor...")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=3,
        label2id=LABEL2ID,
        id2label=ID2LABEL,
        ignore_mismatched_sizes=True,
    )

    # 2. Data
    print("Veriler yukleniyor...")
    train_sym, train_txt, train_lbl = load_data(DATA / "train.csv")
    val_sym, val_txt, val_lbl = load_data(DATA / "val.csv")
    
    train_ds = EntitySentimentDataset(train_sym, train_txt, train_lbl, tokenizer, args.max_len)
    val_ds = EntitySentimentDataset(val_sym, val_txt, val_lbl, tokenizer, args.max_len)

    # 3. Trainer
    training_args = TrainingArguments(
        output_dir=str(HERE / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch * 2,
        learning_rate=args.lr,
        warmup_ratio=0.1,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        fp16=torch.cuda.is_available(),
        report_to="none",
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    print("Egitim basliyor...")
    trainer.train()

    print(f"Final model kaydediliyor: {OUTPUT}")
    trainer.save_model(str(OUTPUT))
    tokenizer.save_pretrained(str(OUTPUT))
    print("Bitti!")

if __name__ == "__main__":
    main()
