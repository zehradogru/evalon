#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent

_calendar_candidates = [
    APP_DIR / "scrapers" / "calendar_scraper",
    APP_DIR.parent.parent / "scrapers" / "calendar_scraper",
]
_news_candidates = [
    APP_DIR / "scrapers" / "news_scraper",
    APP_DIR.parent.parent / "scrapers" / "news_scraper",
]

CALENDAR_DIR = next((path for path in _calendar_candidates if path.exists()), _calendar_candidates[0])
NEWS_DIR = next((path for path in _news_candidates if path.exists()), _news_candidates[0])

os.environ.setdefault("PYTHONUNBUFFERED", "1")
os.environ.setdefault("ORACLE_WALLET_DIR", str(NEWS_DIR / "oracle_wallet"))
os.chdir(CALENDAR_DIR)
sys.path.insert(0, str(CALENDAR_DIR))

from collector import collect_all, save_to_files, save_to_oracle  # noqa: E402


def _env_sources() -> list[str] | None:
    raw = os.environ.get("CALENDAR_SOURCES", "").strip()
    if not raw:
        return None
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values or None


def main() -> int:
    started_at = datetime.now()
    print("=" * 72)
    print(f"[calendar-job] started_at={started_at.isoformat(timespec='seconds')}")
    print(f"[calendar-job] sources={_env_sources() or ['macro_tr']}")
    print("=" * 72)

    events, stats = collect_all(sources=_env_sources())
    if not events:
        print("[calendar-job] HATA: hiç etkinlik toplanamadı.")
        return 1

    json_path, csv_path = save_to_files(events)
    upserted, errors = save_to_oracle(events)

    summary = {
        "count": len(events),
        "upserted": upserted,
        "errors": errors,
        "by_source": Counter(event.source for event in events),
        "by_type": Counter(event.event_type for event in events),
        "csv_path": str(csv_path),
        "json_path": str(json_path),
        "stats": stats,
    }
    print("[calendar-job] summary=" + json.dumps(summary, ensure_ascii=False, default=int))

    if errors:
        print("[calendar-job] HATA: DB yazımı sırasında hata oluştu.")
        return 1

    finished_at = datetime.now()
    print(f"[calendar-job] finished_at={finished_at.isoformat(timespec='seconds')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
