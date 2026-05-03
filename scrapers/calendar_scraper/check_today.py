import sys, os, csv
from datetime import datetime

os.environ["PYTHONIOENCODING"] = "utf-8"
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except: pass

def get_todays_events(filename, prefix):
    events = []
    try:
        with open(filename, encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
            for r in rows:
                if "2026-05-03" in r['event_date']:
                    events.append((prefix, r['event_date'][:10], r['event_type'], r['ticker'], r['event_title']))
    except FileNotFoundError:
        pass
    return events

all_events = []
all_events.extend(get_todays_events('c:/Users/zehra/Masaüstü/evalonn/scrapers/calendar_scraper/data/bist_calendar_20260502_233210.csv', 'HISSE'))
all_events.extend(get_todays_events('c:/Users/zehra/Masaüstü/evalonn/scrapers/calendar_scraper/data/bist_calendar_20260502_234908.csv', 'MAKRO'))

print(f"Bugun (2026-05-03) icin toplam: {len(all_events)} etkinlik bulundu.\n")

for ev in all_events:
    prefix, date, type_, ticker, title = ev
    print(f"[{prefix}] {ticker:8s} | {type_:8s} | {title}")
