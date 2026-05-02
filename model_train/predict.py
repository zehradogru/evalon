from __future__ import annotations

import argparse

from model_utils import load_sentiment_pipeline, normalize_label, score_texts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Egitilen model ile hizli tahmin alir.")
    parser.add_argument(
        "--text",
        action="append",
        default=[],
        help="Tahmin edilecek haber metni. Birden fazla kez verilebilir.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    texts = args.text or [
        "Sirket yuzde 300 bedelsiz onayi aldi, yatirimcilarin ilgisi hizla artti.",
        "Tedarik zinciri sorunu nedeniyle uretim aksadi ve satis beklentileri bozuldu.",
        "Yonetim kurulu gorev dagilimi ve sirket unvan degisikligi rutin sekilde tamamlandi.",
    ]

    try:
        classifier = load_sentiment_pipeline()
    except Exception as exc:
        print(f"Model yuklenemedi. Once egitim tamamlanmali: {exc}")
        return

    results = score_texts(classifier, texts, batch_size=min(8, len(texts)))

    print("--- Tahmin Sonuclari ---")
    for text, result in zip(texts, results):
        label = normalize_label(result["label"])
        print(f"Haber: {text}")
        print(f"Analiz: {label} (Guven Skoru: {result['score']:.4f})\n")


if __name__ == "__main__":
    main()
