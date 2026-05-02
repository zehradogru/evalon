#!/usr/bin/env python3
"""Few-shot prompt ile qwen2.5:7b doğruluk testi."""
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
LABELS = {"OLUMLU", "OLUMSUZ", "NOTR"}

PROMPT = """Sen bir Borsa Istanbul (BIST) finans analistisin.

Asagidaki haberin bir Turk sirketi icin etkisini analiz et.
YALNIZCA tek kelime yaz: OLUMLU, OLUMSUZ veya NOTR

OLUMLU = kar artisi, al tavsiyesi, sermaye artirimi, temttu, ihracat artisi, guclenmesi
OLUMSUZ = zarar, iflas, satis dustu, kredi notu indirim, dava, operasyon durma
NOTR = genel piyasa ozeti, teknik seviye, beklenti, takvim bilgisi

Ornekler:
---
Haber: Aselsan 2025 net kari onceki yila gore yuzde 85 artti.
OLUMLU

Haber: Garanti BBVA 2 milyar TL zarar acikladi.
OLUMSUZ

Haber: BIST 100 endeksi gun sonunda 9800 puandan kapandi.
NOTR

Haber: Sisecam 2011den beri temettu dagitan sirket, bedelsiz sermaye artirimi gundeme geldi.
OLUMLU
---

Haber: {text}
"""


def ask(model: str, text: str) -> str:
    resp = requests.post(
        OLLAMA_URL,
        json={
            "model": model,
            "prompt": PROMPT.format(text=text),
            "stream": False,
            "options": {"num_predict": 8, "temperature": 0},
        },
        timeout=90,
    )
    raw = resp.json().get("response", "").strip().upper()
    for word in raw.split():
        w = word.rstrip(".,;:\n")
        if w in LABELS:
            return w
    return f"?({raw[:30]})"


TESTS = [
    ("OLUMLU",  "10 hissede aylik kazanc yuzde 94e dayandi. Bu hisseler son 1 ayda en fazla kazandiran."),
    ("OLUMSUZ", "Garanti BBVA net kari beklentilerin altinda kaldi, hisse sertifikalari dusuyor."),
    ("OLUMLU",  "BofA Aselsan icin guclu al tavsiyesi verdi, hedef fiyati yuzde 30 artti."),
    ("NOTR",    "BIST 100 gun sonu 9800 puandan kapandi, dolar 32.5 TL oldu."),
    ("OLUMLU",  "Sisecam bedelsiz sermaye artirimi potansiyeli. 2011den beri temettu dagitan sirket ozkaynaklar guclu."),
    ("OLUMSUZ", "Tofas 2025 4. ceyrek net zarari 1.2 milyar TL, satis gelirleri dustu."),
    ("NOTR",    "TAVHL icin HSBC kritik teknik seviyeleri acikladi, destek 280 direnc 310 TL."),
    ("OLUMLU",  "Can Holding Tekfen hisselerini yuzde 12 prim ile satın aldi, hisse yukseldi."),
]

MODEL = "qwen2.5:7b"
correct = 0

print(f"\n{'Beklenen':<10} {'Sonuc':<10} {'Durum':<8}  Haber")
print("-" * 90)

for expected, text in TESTS:
    result = ask(MODEL, text)
    ok = "OK" if result == expected else "HATALI"
    if result == expected:
        correct += 1
    print(f"{expected:<10} {result:<10} {ok:<8}  {text[:60]}")

print(f"\nDogru: {correct}/{len(TESTS)}  ({correct/len(TESTS)*100:.0f}%)")

# GPU kontrolu
print("\n--- GPU ---")
try:
    ps = requests.get("http://localhost:11434/api/ps", timeout=5).json()
    for m in ps.get("models", []):
        vram = m.get("size_vram", 0) // 1024 // 1024
        print(f"  {m['name']}: {vram} MB VRAM")
except Exception as e:
    print(f"  Hata: {e}")
