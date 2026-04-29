"""Mevcut bist_haberler CSV'lerinden progress dosyasını rebuild eder."""
import csv
import json
from pathlib import Path

data_dir = Path(__file__).parent / "bist-news-data"
progress_f = Path(__file__).parent / "scraper-data" / "mass_scraper_progress.json"

done = {}
for csv_path in sorted(data_dir.glob("bist_haberler_*.csv")):
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                sym = row.get("symbol", "").strip()
                if sym:
                    done[sym] = "done"
        print(f"  OK {csv_path.name}")
    except Exception as e:
        print(f"  SKIP {csv_path.name}: {e}")

print(f"\nToplam {len(done)} unique ticker bulundu.")
if done:
    progress_f.parent.mkdir(exist_ok=True)
    with open(progress_f, "w", encoding="utf-8") as f:
        json.dump(done, f, indent=2)
    print(f"Progress dosyasi yazildi: {progress_f}")
else:
    print("Hicbir veri bulunamadi, progress yazilmadi.")
