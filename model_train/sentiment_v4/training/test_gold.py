#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gold test: mevcut prompt + qwen2.5:7b ile 16 örnek üzerinde doğruluk ölç.
"""
import sys
import requests
import pandas as pd
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRAIN = HERE / "train_clean.csv"
MULTI = HERE / "multi_label.py"

# multi_label.py'den prompt ve quick_label fonksiyonunu yukle
import importlib.util
spec = importlib.util.spec_from_file_location("multi_label", str(MULTI))
ml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)
PROMPT_TPL = ml._PROMPT.lstrip('\\').lstrip('\n')
quick_label = ml.quick_label

df = pd.read_csv(TRAIN)

gold = {
    # idx: (beklenen, açıklama)
    299: ("NÖTR",    "TCELL birleşme bildirimi"),
    300: ("OLUMLU",  "SKBNK Q3 kâr artışı"),
    301: ("NÖTR",    "KONTR teknik analiz"),
    302: ("NÖTR",    "günden öne çıkanlar"),
    303: ("OLUMLU",  "AKSA hedef fiyat al tavsiyesi"),
    304: ("OLUMSUZ", "ZOREN 14.7 milyar TL zarar"),
    305: ("OLUMSUZ", "HALKB mahkeme kararı büyük düşüş"),
    306: ("NÖTR",    "OTKAR hedef fiyat indirimi"),
    307: ("NÖTR",    "KONTR teknik analiz"),
    308: ("OLUMLU",  "AGROT %7 yükseldi"),
    309: ("NÖTR",    "BIMAS teknik analiz"),
    310: ("OLUMLU",  "AKSEN çoklu al tavsiyesi"),
      0: ("OLUMLU",  "SISE bedelsiz potansiyeli"),
      1: ("NÖTR",    "piyasalar gün sonu özeti"),
      2: ("OLUMSUZ", "TKFEN TMSF soruşturma"),
      3: ("NÖTR",    "SISE CED süreci"),
}

correct = 0
total = 0
errors = []

for idx, (expected, desc) in gold.items():
    text = str(df.iloc[idx]["text"])[:600]
    # Once keyword pre-filter
    fast = quick_label(text)
    if fast is not None:
        got = fast
        print(f"{'OK' if fast == expected else 'HATALI'} idx={idx:3d} [{desc[:30]:<30}]  Beklenen:{expected:<8} Got:{got} [keyword]")
        if fast != expected:
            print(f"       TEXT: {text[:120]}")
        correct += (fast == expected)
        total += 1
        continue
    prompt = PROMPT_TPL.replace("{text}", text)
    try:
        r = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5:7b",
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": 4, "temperature": 0, "num_ctx": 1024},
            },
            timeout=120,
        )
        raw = r.json().get("response", "").strip().upper()
        got = raw.split()[0].rstrip(".,;:") if raw.split() else "HATA"
        if got in ("NOTR", "NÖTR"):
            got = "NÖTR"
    except Exception as e:
        got = f"HATA:{e}"

    ok = got == expected
    correct += ok
    total += 1
    icon = "OK" if ok else "HATALI"
    print(f"{icon} idx={idx:3d} [{desc[:30]:<30}]  Beklenen:{expected:<8} Got:{got}")
    if not ok:
        print(f"       TEXT: {text[:120]}")

print(f"\nSonuç: {correct}/{total} = %{correct/total*100:.0f}")
if correct == total:
    print("PASS — prompt hazır, etiketleme başlayabilir!")
else:
    print("FAIL — prompt düzeltilmeli!")
    sys.exit(1)
