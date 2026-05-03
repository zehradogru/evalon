import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except: pass

import csv
from collections import Counter

with open('data/bist_calendar_20260502_234908.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

print(f"Toplam: {len(rows)} etkinlik\n")

types = Counter(r['event_type'] for r in rows)
print("=== EVENT TYPE DAGILIMI ===")
for t, c in types.most_common():
    print(f"  {t:15s}: {c}")

print(f"\n=== TUM ETKINLIKLER ===")
for r in sorted(rows, key=lambda x: x['event_date']):
    d = r['event_date'][:10]
    tp = r['event_type']
    title = r['event_title'][:65]
    imp = r.get('importance', '?')
    print(f"  {d}  [{tp:6s}] (onem:{imp})  {title}")
