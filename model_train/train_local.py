from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from datasets import Dataset, DatasetDict
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from model_utils import ARTIFACTS_DIR, MODEL_DIR, ensure_directory, load_training_dataframe


MODEL_NAME = "dbmdz/bert-base-turkish-cased"
SEED = 42
DEFAULT_MAX_LENGTH = 256


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Yerel Turkce BERT sentiment modelini egitir.")
    parser.add_argument("--epochs", type=int, default=2, help="Toplam epoch sayisi")
    parser.add_argument("--batch-size", type=int, default=8, help="CPU batch size tabani")
    parser.add_argument("--max-length", type=int, default=DEFAULT_MAX_LENGTH, help="Tokenizer max length")
    parser.add_argument("--resume", action="store_true", help="Varsa son checkpoint'ten devam et")
    parser.add_argument("--data-path", type=str, default="", help="Egitim verisi csv yolu")
    parser.add_argument("--artifacts-dir", type=str, default="", help="Rapor ve checkpoint klasoru")
    parser.add_argument("--model-dir", type=str, default="", help="Egitilen modelin kaydedilecegi klasor")
    return parser.parse_args()


def describe_device() -> tuple[str, bool]:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Kullanilan cihaz: {device}")
    if device == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    return device, device == "cuda"


def split_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=SEED,
        stratify=df["label"],
    )
    valid_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=SEED,
        stratify=temp_df["label"],
    )
    return (
        train_df.reset_index(drop=True),
        valid_df.reset_index(drop=True),
        test_df.reset_index(drop=True),
    )


def print_split_stats(name: str, frame: pd.DataFrame) -> dict:
    stats = {
        "rows": int(len(frame)),
        "labels": frame["sentiment"].value_counts().sort_index().to_dict(),
    }
    print(f"{name}: {stats['rows']} satir -> {stats['labels']}")
    return stats


def build_datasets(
    train_df: pd.DataFrame,
    valid_df: pd.DataFrame,
    test_df: pd.DataFrame,
    tokenizer,
    max_length: int,
) -> DatasetDict:
    dataset_dict = DatasetDict(
        {
            "train": Dataset.from_pandas(train_df[["text", "label"]], preserve_index=False),
            "validation": Dataset.from_pandas(valid_df[["text", "label"]], preserve_index=False),
            "test": Dataset.from_pandas(test_df[["text", "label"]], preserve_index=False),
        }
    )

    def tokenize_function(batch: dict) -> dict:
        return tokenizer(batch["text"], truncation=True, max_length=max_length)

    tokenized = dataset_dict.map(tokenize_function, batched=True)
    tokenized = tokenized.rename_column("label", "labels")
    return tokenized


def compute_metrics(eval_pred) -> dict:
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels,
        predictions,
        average="macro",
        zero_division=0,
    )
    return {
        "accuracy": accuracy_score(labels, predictions),
        "macro_precision": precision,
        "macro_recall": recall,
        "macro_f1": f1,
    }


def find_latest_checkpoint(checkpoints_dir) -> str | None:
    checkpoint_dirs = [path for path in checkpoints_dir.glob("checkpoint-*") if path.is_dir()]
    if not checkpoint_dirs:
        return None
    latest = max(checkpoint_dirs, key=lambda path: path.stat().st_mtime)
    return str(latest)


def main() -> None:
    args = parse_args()
    _, use_fp16 = describe_device()
    data_path = Path(args.data_path).resolve() if args.data_path else None
    artifacts_dir = Path(args.artifacts_dir).resolve() if args.artifacts_dir else ARTIFACTS_DIR
    model_dir = Path(args.model_dir).resolve() if args.model_dir else MODEL_DIR

    df = load_training_dataframe(data_path=data_path)
    print(f"Egitim verisi yuklendi: {len(df)} benzersiz satir")

    unique_labels = sorted(df["sentiment"].unique())
    label2id = {label: idx for idx, label in enumerate(unique_labels)}
    id2label = {idx: label for label, idx in label2id.items()}
    df["label"] = df["sentiment"].map(label2id)

    print("Siniflar:")
    for label, idx in label2id.items():
        print(f"  {label}: {idx}")

    train_df, valid_df, test_df = split_dataframe(df)

    split_stats = {
        "train": print_split_stats("train", train_df),
        "validation": print_split_stats("validation", valid_df),
        "test": print_split_stats("test", test_df),
    }

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    tokenized_datasets = build_datasets(train_df, valid_df, test_df, tokenizer, args.max_length)
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(label2id),
        id2label=id2label,
        label2id=label2id,
    )

    checkpoints_dir = artifacts_dir / "checkpoints"
    logs_dir = artifacts_dir / "logs"
    reports_dir = artifacts_dir / "reports"
    for path in (checkpoints_dir, logs_dir, reports_dir, model_dir):
        ensure_directory(path)

    training_args = TrainingArguments(
        output_dir=str(checkpoints_dir),
        logging_dir=str(logs_dir),
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        num_train_epochs=args.epochs,
        learning_rate=2e-5,
        per_device_train_batch_size=16 if use_fp16 else args.batch_size,
        per_device_eval_batch_size=16 if use_fp16 else args.batch_size,
        warmup_steps=100,
        weight_decay=0.01,
        logging_steps=25,
        fp16=use_fp16,
        seed=SEED,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["validation"],
        processing_class=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )

    latest_checkpoint = find_latest_checkpoint(checkpoints_dir) if args.resume else None
    if latest_checkpoint:
        print(f"Checkpoint bulundu, buradan devam edilecek: {latest_checkpoint}")

    print("Egitim basliyor...")
    trainer.train(resume_from_checkpoint=latest_checkpoint)

    print("Validation seti degerlendiriliyor...")
    validation_metrics = trainer.evaluate(tokenized_datasets["validation"])
    print(validation_metrics)

    print("Test seti degerlendiriliyor...")
    test_metrics = trainer.evaluate(tokenized_datasets["test"], metric_key_prefix="test")
    print(test_metrics)

    predictions = trainer.predict(tokenized_datasets["test"])
    logits = predictions.predictions
    predicted_ids = np.argmax(logits, axis=-1)
    probabilities = torch.softmax(torch.tensor(logits), dim=-1).numpy()
    max_scores = probabilities.max(axis=1)

    test_report = test_df.copy()
    test_report["predicted_label"] = [id2label[int(idx)] for idx in predicted_ids]
    test_report["prediction_score"] = max_scores
    test_report["is_correct"] = test_report["label"].to_numpy() == predicted_ids
    test_report.to_csv(reports_dir / "test_predictions.csv", index=False, encoding="utf-8")

    cm = confusion_matrix(test_df["label"], predicted_ids, labels=list(id2label.keys()))
    cm_df = pd.DataFrame(
        cm,
        index=[f"true_{id2label[idx]}" for idx in id2label],
        columns=[f"pred_{id2label[idx]}" for idx in id2label],
    )
    cm_df.to_csv(reports_dir / "confusion_matrix.csv", encoding="utf-8")

    summary = {
        "model_name": MODEL_NAME,
        "max_length": args.max_length,
        "rows": int(len(df)),
        "classes": label2id,
        "split_stats": split_stats,
        "validation_metrics": validation_metrics,
        "test_metrics": test_metrics,
    }
    with open(reports_dir / "training_summary.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    model.save_pretrained(model_dir)
    tokenizer.save_pretrained(model_dir)
    with open(model_dir / "label_mapping.json", "w", encoding="utf-8") as handle:
        json.dump({"label2id": label2id, "id2label": id2label}, handle, ensure_ascii=False, indent=2)

    print(f"Model kaydedildi: {model_dir}")
    print(f"Raporlar kaydedildi: {reports_dir}")


if __name__ == "__main__":
    main()
