import csv, json
from pathlib import Path

folder = Path(__file__).parent / "bist-news-data"
all_files = sorted(folder.glob("*.csv"))
print("Tum CSV dosyalari:")
for f in all_files:
    try:
        with open(f, encoding="utf-8") as fp:
            rows = list(csv.DictReader(fp))
        syms = set(r["symbol"] for r in rows)
        print(f"  {f.name}: {len(rows)} satir, {len(syms)} sembol")
    except Exception as e:
        print(f"  {f.name}: OKUNAMADI ({e})")

prog_path = Path(__file__).parent / "scraper-data" / "mass_scraper_progress.json"
prog = json.loads(prog_path.read_text(encoding="utf-8"))
done = [k for k, v in prog.items() if v == "done"]

# Active CSV symbols
active = Path(__file__).parent / "bist-news-data" / "bist_haberler_20260428_011504.csv"
active_syms = set()
if active.exists():
    with open(active, encoding="utf-8") as fp:
        for r in csv.DictReader(fp):
            active_syms.add(r["symbol"])

missing = [t for t in done if t not in active_syms]
print(f"\nProgress.json'da 'done' ama aktif CSV'de YOK: {missing}")

print("\nBu tickerlar diger CSV'lerde aranıyor...")
for t in missing:
    found_in = []
    for f in all_files:
        if "011504" in f.name:
            continue
        try:
            with open(f, encoding="utf-8") as fp:
                rows = [r for r in csv.DictReader(fp) if r["symbol"] == t]
            if rows:
                found_in.append(f"{f.name}({len(rows)} satir)")
        except:
            pass
    if found_in:
        print(f"  {t}: {found_in}")
    else:
        print(f"  {t}: HICBIR YERDE YOK - eksik!")
