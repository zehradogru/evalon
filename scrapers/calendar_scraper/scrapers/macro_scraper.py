#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/macro_scraper.py — Türkiye makroekonomik takvim kazıyıcısı

TCMB faiz kararı, TÜİK enflasyon, işsizlik gibi Türkiye'ye özel
makroekonomik verilerin tarihlerini çeker.

Kaynak: ForexFactory (sadece TR filtresi) veya Investing.com TR
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import List, Optional

from models import CalendarEvent
from scrapers.base import BaseScraper


class MacroScraper(BaseScraper):
    """
    Türkiye makroekonomik takvim verilerini çeker.
    ForexFactory'nin halka açık JSON feed'inden TRY (Türk Lirası)
    filtresine sahip etkinlikleri alır.
    """

    name = "macro_tr"

    # ForexFactory halka açık JSON feed'leri
    FF_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    FF_NEXT_WEEK = "https://nfs.faireconomy.media/ff_calendar_nextweek.json"

    # Yüksek öneme sahip TR makro etkinlikleri
    HIGH_IMPORTANCE_KEYWORDS = [
        "interest rate", "faiz", "cpi", "enflasyon", "gdp", "büyüme",
        "unemployment", "işsizlik", "trade balance", "current account",
    ]

    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        """
        ForexFactory'den Türkiye (TRY) makro etkinliklerini çeker.
        tickers parametresi bu scraper için kullanılmaz (makro veri).
        """
        events: List[CalendarEvent] = []

        for url in [self.FF_THIS_WEEK, self.FF_NEXT_WEEK]:
            try:
                response = self._get(url, headers={"Accept": "application/json"})
                items = response.json()

                for item in items:
                    country = str(item.get("country", "")).upper()
                    if country != "TRY":
                        continue

                    ev = self._parse_ff_item(item)
                    if ev:
                        events.append(ev)

            except Exception as exc:
                print(f"[macro_tr] ForexFactory hatası ({url}): {exc}")

        print(f"[macro_tr] {len(events)} TR makro etkinliği çekildi.")
        return events

    def _parse_ff_item(self, item: dict) -> Optional[CalendarEvent]:
        """ForexFactory JSON öğesini CalendarEvent'e çevirir."""
        try:
            title = str(item.get("title", "")).strip()
            if not title:
                return None

            date_str = str(item.get("date", ""))
            event_date = self._parse_date(date_str)
            if not event_date:
                return None

            # Impact: Low/Medium/High → 1/2/3
            impact = str(item.get("impact", "")).lower()
            if impact == "high":
                importance = 3
            elif impact == "medium":
                importance = 2
            else:
                importance = 1

            # Bazı önemli etkinlikleri yükselt
            if any(kw in title.lower() for kw in self.HIGH_IMPORTANCE_KEYWORDS):
                importance = max(importance, 2)

            # Ek bilgileri JSON olarak sakla
            extra = json.dumps({
                "actual": item.get("actual"),
                "forecast": item.get("forecast"),
                "previous": item.get("previous"),
            }, ensure_ascii=False)

            return CalendarEvent(
                ticker="MAKRO",           # Makro veriler için özel ticker
                event_date=event_date,
                event_type="MAKRO",
                event_title=f"[TR] {title}",
                importance=importance,
                source=self.name,
                extra=extra,
            )

        except Exception:
            return None

    @staticmethod
    def _parse_date(text: str) -> Optional[datetime]:
        """ForexFactory tarih formatını parse eder."""
        if not text:
            return None
        try:
            # ForexFactory ISO-8601 kullanır
            return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, AttributeError):
            pass

        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue

        return None
