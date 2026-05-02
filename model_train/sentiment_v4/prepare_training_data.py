#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prepare_training_data.py — Etiketli veriyi temizle, dengele, eğitime hazırla

Kaynak:
  data/unanimous_labeled.csv   (3/3 model — HIGH güven)
  data/majority_labeled.csv    (2/3 model — OLUMSUZ satırlar eklenir, denge için)

Temizlik:
  - Parantezli ticker: (THYAO), (BIST)
  - Kaynak adı: '- Bigpara', '- Anadolu Ajansı', site.com
  - Yazar prefix: 'Yazar Investing.com'
  - nan kalıntıları
  - Tekrar eden başlık/cümle
  - Büyük harf bölüm başlıkları: | EKONOMİ HABERLERİ |

Denge:
  Her 3 sınıftan eşit sayıda satır (en az sınıf kadar)

Çıktı:
  data/training_data.csv   — eğitime hazır, dengeli
  data/train_split.csv     — %80 eğitim
  data/val_split.csv       — %20 doğrulama
"""
from __future__ import annotations

import re
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

# ── Temizlik ──────────────────────────────────────────────────────────────────

# Bilinen kaynak adları
_SOURCE_NAMES = (
    r"Anadolu\s*Ajansı", r"TRT\s*Haber", r"Bigpara", r"Paratic\s*Haber",
    r"Paratic", r"Rota\s*Borsa", r"Mynet\s*Finans", r"Mynet",
    r"Nefes\s*Gazetesi", r"Dünya\s*Gazetesi", r"Hürriyet\s*Finans",
    r"Hürriyet", r"Milliyet", r"Sabah", r"GZT", r"Foreks",
    r"Investing\.com\s*Türkiye", r"Investing\.com", r"TradingView",
    r"getmidas\.com", r"borsagundem\.com\.tr", r"borsagundem",
    r"Borsa\s*G[üu]ndem", r"Borsanın\s*G[üu]ndemi",
    r"Bloomberg\s*HT", r"BloombergHT", r"Finans\s*G[üu]ndem", r"Para\s*Analiz",
    r"Birgün", r"A\s*Para", r"NTV\s*Para", r"Coinspeaker",
    r"Paranın\s*Yönü", r"Yeşil\s*Ekonomi", r"Tacirler", r"Yeni\s*Şafak",
    r"Ekonomim", r"CNN\s*Türk", r"Reuters",
)
_SRC_PAT = "(?:" + "|".join(_SOURCE_NAMES) + ")"

# 1) Tire/pipe sonrası kaynak adı (trailing junk yok — içeriği yeme)
_SOURCE_DASH_RE = re.compile(
    r"\s*[-–|]\s*" + _SRC_PAT + r"\b",
    flags=re.IGNORECASE,
)
# 2) Noktalama sonrası kaynak adı: "Kapanıyor! Coinspeaker" — noktalama SAHİBİ korunur
_SOURCE_PUNCT_RE = re.compile(
    r"(?<=[!?])\s+" + _SRC_PAT + r"\b",
    flags=re.IGNORECASE,
)

def clean(text: str) -> str:
    if not isinstance(text, str):
        return ""

    # 1. Parantezli ticker: (THYAO), (MKARD), (BIST)
    text = re.sub(r"\([A-Z0-9]{2,6}\)", "", text)

    # 2. Kaynak adı: tire/pipe sonrası
    text = _SOURCE_DASH_RE.sub("", text)
    # 2b. Kaynak adı: noktalama (! ?) sonrası (tire yok)
    text = _SOURCE_PUNCT_RE.sub("", text)
    # 2c. Kaynak adı: metin içinde her yerde (haber sitesi adları içerik değil)
    text = re.sub(
        r"\b" + _SRC_PAT + r"\b",
        " ", text, flags=re.IGNORECASE
    )

    # 3. Kalan site uzantıları: site.com, site.com.tr
    text = re.sub(r"\s*\S+\.(?:com|net|org|tv|co\.tr|com\.tr)\S*", " ", text)

    # 4. Yazar prefix: 'Yazar Investing.com -'
    text = re.sub(r"Yazar\s+\S+\s*[-–]?\s*", "", text)

    # 5. nan kalıntısı
    text = re.sub(r"\bnan\b", "", text, flags=re.IGNORECASE)

    # 6. Büyük harf bölüm başlıkları: | EKONOMİ HABERLERİ |
    text = re.sub(r"\|\s*[A-ZÇĞİÖŞÜ\s]{5,40}\|?", " ", text)

    # 7. Karakter düzeyinde ardışık tekrar (boşluksuz concat)
    for _ in range(4):
        new = re.sub(r"(.{10,})\1", r"\1", text, flags=re.DOTALL)
        if new == text:
            break
        text = new

    # 8a. Tek kelime ardışık tekrar: "dağıtmayacak dağıtmayacak"
    text = re.sub(r"\b(\w{4,})\s+\1\b", r"\1", text)

    # 8b. Çoklu kelime ardışık tekrar (2-8 kelimelik pencere, multi-pass)
    for _ in range(3):
        words = text.split()
        result: list[str] = []
        i = 0
        changed = False
        while i < len(words):
            found = False
            for w in range(min(8, (len(words) - i) // 2), 1, -1):
                chunk = [x.lower() for x in words[i:i+w]]
                nxt   = [x.lower() for x in words[i+w:i+w*2]]
                if chunk == nxt:
                    result.extend(words[i:i+w])
                    i += w * 2
                    found = True
                    changed = True
                    break
            if not found:
                result.append(words[i])
                i += 1
        text = " ".join(result)
        if not changed:
            break

    # 9. Fazla boşluk ve noktalama temizliği
    text = re.sub(r"\s{2,}", " ", text).strip()
    text = re.sub(r"^\s*[-–|:]\s*", "", text)

    return text

# ── Ana fonksiyon ─────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("Eğitim Verisi Hazırlama")
    print("=" * 60)

    # Kaynak dosyaları oku
    unanimous = pd.read_csv(DATA / "unanimous_labeled.csv")
    majority  = pd.read_csv(DATA / "majority_labeled.csv")

    # Majority'den sadece OLUMSUZ ekle (OLUMSUZ sınıfını güçlendirmek için)
    maj_neg = majority[majority["label"] == "OLUMSUZ"].copy()

    # AI yazılı haberler — sınıf başına 200 satır (tekdüze olduğu için az alıyoruz)
    AI_DATA = HERE.parent / "data.csv"
    ai_raw = pd.read_csv(AI_DATA, sep="|", header=0)
    ai_raw.columns = ["text", "label"]
    ai_raw["label"] = ai_raw["label"].str.strip().str.strip('"')
    ai_sample = (
        ai_raw.groupby("label", group_keys=False)
              .apply(lambda x: x.sample(min(200, len(x)), random_state=42), include_groups=False)
    ).reset_index(drop=True)

    df = pd.concat([unanimous, maj_neg, ai_sample], ignore_index=True)

    print(f"\nunanimous           : {len(unanimous):>6} satır (3/3 model)")
    print(f"majority OLUMSUZ    : {len(maj_neg):>6} satır (ek)")
    print(f"AI haberler         : {len(ai_sample):>6} satır (200/sınıf)")
    print(f"Toplam              : {len(df):>6} satır")
    print(f"\nÖnce temizlik dağılımı:")
    print(df["label"].value_counts().to_string())

    # Temizlik
    print("\nTemizlik uygulanıyor...")
    df["text"] = df["text"].apply(clean)

    # Çok kısa metinleri at (15 karakter altı)
    before = len(df)
    df = df[df["text"].str.len() >= 15].reset_index(drop=True)
    print(f"Kısa metin filtresi: {before - len(df)} satır çıkarıldı")

    print(f"\nTemizlik sonrası dağılım:")
    print(df["label"].value_counts().to_string())

    # Denge: her sınıftan eşit sayıda
    min_count = df["label"].value_counts().min()
    balanced = (
        df.groupby("label", group_keys=False)
          .apply(lambda x: x.sample(min_count, random_state=42))
          .reset_index(drop=True)
          .sample(frac=1, random_state=42)  # karıştır
          .reset_index(drop=True)
    )

    print(f"\nDengeli dağılım ({min_count} × 3 = {min_count*3} satır):")
    print(balanced["label"].value_counts().to_string())

    # Sadece gerekli kolonları tut
    out = balanced[["text", "label"]].copy()

    # Test (%10) → Train+Val (%90) → Train (%80) / Val (%20)
    trainval_df, test_df = train_test_split(
        out, test_size=0.10, stratify=out["label"], random_state=42
    )
    train_df, val_df = train_test_split(
        trainval_df, test_size=0.20, stratify=trainval_df["label"], random_state=42
    )

    # Kaydet
    out.to_csv(DATA / "training_data.csv", index=False, encoding="utf-8")
    train_df.to_csv(DATA / "train_split.csv", index=False, encoding="utf-8")
    val_df.to_csv(DATA / "val_split.csv",   index=False, encoding="utf-8")
    test_df.to_csv(DATA / "test_split.csv",  index=False, encoding="utf-8")

    print(f"\n{'=' * 60}")
    print(f"Kaydedildi:")
    print(f"  data/training_data.csv  : {len(out)} satir  (tam dengeli)")
    print(f"  data/train_split.csv    : {len(train_df)} satir  (%72 egitim)")
    print(f"  data/val_split.csv      : {len(val_df)} satir  (%18 dogrulama)")
    print(f"  data/test_split.csv     : {len(test_df)} satir  (%10 test)")

    # Örnek kontrol
    print(f"\n── Temizlenmiş örnekler ─────────────────────────────────")
    for lbl in ["OLUMLU", "OLUMSUZ", "NÖTR"]:
        sample = out[out["label"] == lbl].sample(2, random_state=7)
        print(f"\n{lbl}:")
        for _, row in sample.iterrows():
            print(f"  {row['text'][:130]}")

if __name__ == "__main__":
    main()
