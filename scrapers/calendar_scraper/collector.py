#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
collector.py — Ana orkestratör (collector)

Tüm kaynaklardan (İş Yatırım, KAP, Makro) verileri toplar,
birleştirir, tekilleştirir ve Oracle DB'ye yazar.

Bu modül, main.py ve cloud job tarafından çağrılır.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from config import BIST_TICKERS, DATA_DIR
from models import CalendarEvent

# Lazy import — scrapers kullanıldığında yüklenir
_scrapers_cache = None


def _get_scrapers():
    """Tüm kayıtlı kazıyıcıları döndürür (lazy init)."""
    global _scrapers_cache
    if _scrapers_cache is None:
        from scrapers.isyatirim_scraper import IsYatirimScraper
        from scrapers.kap_scraper import KapScraper
        from scrapers.macro_scraper import MacroScraper

        _scrapers_cache = [
            IsYatirimScraper(),
            KapScraper(),
            MacroScraper(),
        ]
    return _scrapers_cache


# ---------------------------------------------------------------------------
# Collect
# ---------------------------------------------------------------------------

def collect_all(
    tickers: Optional[List[str]] = None,
    sources: Optional[List[str]] = None,
) -> Tuple[List[CalendarEvent], Dict[str, int]]:
    """
    Tüm kaynaklardan takvim verilerini toplar.

    Args:
        tickers: Sadece belirli hisseler için çek (None = tümü)
        sources: Sadece belirli kaynaklar (["isyatirim", "kap", "macro_tr"])
                 None = hepsi

    Returns:
        (events, stats) — Toplanan etkinlikler ve kaynak bazında istatistikler
    """
    target_tickers = tickers or BIST_TICKERS
    all_events: List[CalendarEvent] = []
    stats: Dict[str, int] = {}

    scrapers = _get_scrapers()

    for scraper in scrapers:
        if sources and scraper.name not in sources:
            continue

        print(f"\n{'='*60}")
        print(f"[collector] {scraper.name} çalışıyor...")
        print(f"{'='*60}")

        try:
            # Makro scraper'a ticker listesi göndermemize gerek yok
            if scraper.name == "macro_tr":
                events = scraper.scrape()
            else:
                events = scraper.scrape(target_tickers)

            all_events.extend(events)
            stats[scraper.name] = len(events)
            print(f"[collector] {scraper.name}: {len(events)} etkinlik toplandı.")

        except Exception as exc:
            stats[scraper.name] = 0
            stats[f"{scraper.name}_error"] = 1
            print(f"[collector] {scraper.name} HATA: {exc}")

    # Tekilleştir (aynı ID'ye sahip etkinlikleri birleştir)
    all_events = _deduplicate(all_events)
    stats["toplam_benzersiz"] = len(all_events)

    # Sadece bu haftanın başından (Pazartesi) itibaren olan etkinlikleri tut
    from datetime import timedelta
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())  # Bu haftanın Pazartesi'si
    before = len(all_events)
    all_events = [ev for ev in all_events if ev.event_date >= week_start]
    filtered = before - len(all_events)
    if filtered:
        print(f"[collector] {filtered} gecmis etkinlik filtrelendi (< {week_start.strftime('%Y-%m-%d')})")
    stats["gecmis_filtrelenen"] = filtered

    print(f"\n[collector] Toplam benzersiz etkinlik: {len(all_events)}")
    return all_events, stats


def _deduplicate(events: List[CalendarEvent]) -> List[CalendarEvent]:
    """Aynı event_id'ye sahip etkinlikleri birleştirir (son gelen kazanır)."""
    seen: Dict[str, CalendarEvent] = {}
    for ev in events:
        seen[ev.event_id] = ev
    return list(seen.values())


# ---------------------------------------------------------------------------
# Local file save
# ---------------------------------------------------------------------------

def save_to_files(events: List[CalendarEvent]) -> Tuple[Path, Path]:
    """Etkinlikleri JSON ve CSV olarak kaydeder."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    json_path = DATA_DIR / f"bist_calendar_{ts}.json"
    csv_path = DATA_DIR / f"bist_calendar_{ts}.csv"

    # JSON
    json_data = [ev.to_dict() for ev in events]
    # datetime → str dönüşümü
    for item in json_data:
        for key, val in item.items():
            if isinstance(val, datetime):
                item[key] = val.isoformat()

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    # CSV
    csv_fields = [
        "id", "ticker", "event_date", "event_type",
        "event_title", "importance", "source", "extra",
    ]
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for ev in events:
            row = ev.to_dict()
            row["event_date"] = (
                row["event_date"].strftime("%Y-%m-%d %H:%M")
                if isinstance(row["event_date"], datetime)
                else str(row["event_date"])
            )
            # Sadece CSV alanlarını yaz
            csv_row = {k: row.get(k, "") for k in csv_fields}
            writer.writerow(csv_row)

    print(f"[collector] JSON: {json_path}")
    print(f"[collector] CSV:  {csv_path}")
    return json_path, csv_path


# ---------------------------------------------------------------------------
# Oracle save
# ---------------------------------------------------------------------------

def save_to_oracle(events: List[CalendarEvent]) -> Tuple[int, int]:
    """
    Etkinlikleri Oracle DB'ye yazar (MERGE / upsert).
    Returns: (upserted, errors)
    """
    from db import get_connection, ensure_table, upsert_events

    conn = get_connection()
    if not conn:
        print("[collector] Oracle bağlantısı kurulamadı!")
        return 0, len(events)

    try:
        ensure_table(conn)
        upserted, errors = upsert_events(conn, events)
        print(f"[collector] Oracle: {upserted} yazıldı, {errors} hata")
        return upserted, errors
    finally:
        conn.close()
