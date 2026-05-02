#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/kap_scraper.py — KAP (Kamuyu Aydınlatma Platformu) kazıyıcısı

KAP'ın halka açık bildirim sayfasından temettü dağıtım kararları,
genel kurul toplantıları ve diğer önemli etkinlikleri çeker.

Kaynak: kap.org.tr (halka açık bildirim sayfası)
"""

from __future__ import annotations

import re
import json
from datetime import datetime, timedelta
from typing import List, Optional

from bs4 import BeautifulSoup

from models import CalendarEvent
from scrapers.base import BaseScraper


class KapScraper(BaseScraper):
    """KAP bildirim sayfalarından takvim etkinlikleri kazır."""

    name = "kap"

    # KAP bildirim arama API'si (halka açık)
    DISCLOSURE_URL = "https://www.kap.org.tr/tr/api/disclosures"

    # KAP etkinlik filtreleri
    EVENT_CATEGORIES = {
        "TEMETTU": ["kar payı", "temettü", "nakit kar payı"],
        "GENEL_KURUL": ["genel kurul", "olağan genel kurul"],
        "BILANCO": ["finansal rapor", "mali tablo", "bağımsız denetim"],
        "BEDELSIZ": ["bedelsiz", "sermaye artırımı"],
    }

    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        """KAP'tan bildirim tabanlı takvim etkinliklerini çeker."""
        events: List[CalendarEvent] = []

        # Yöntem 1: KAP API üzerinden bildirim çek
        try:
            api_events = self._try_kap_api(tickers)
            if api_events:
                events.extend(api_events)
                print(f"[kap] API'den {len(api_events)} etkinlik çekildi.")
                return events
        except Exception as exc:
            print(f"[kap] API denemesi başarısız: {exc}")

        # Yöntem 2: KAP ana sayfasından son bildirimleri tara
        try:
            page_events = self._scrape_recent_disclosures(tickers)
            events.extend(page_events)
            print(f"[kap] Bildirim sayfasından {len(page_events)} etkinlik çekildi.")
        except Exception as exc:
            print(f"[kap] Bildirim tarama hatası: {exc}")

        return events

    def _try_kap_api(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        """KAP API endpoint'ini dener."""
        events: List[CalendarEvent] = []

        # KAP'ın halka açık bildirim listesi endpoint'i
        # Son 30 günlük bildirimleri çeker
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)

        payload = {
            "fromDate": start_date.strftime("%Y-%m-%d"),
            "toDate": end_date.strftime("%Y-%m-%d"),
        }

        try:
            response = self._post(
                self.DISCLOSURE_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            data = response.json()
            disclosures = data if isinstance(data, list) else data.get("disclosures", [])

            ticker_set = set(t.upper() for t in tickers) if tickers else None

            for item in disclosures:
                ev = self._parse_disclosure(item, ticker_set)
                if ev:
                    events.append(ev)

        except Exception:
            raise

        return events

    def _parse_disclosure(
        self, item: dict, ticker_set: Optional[set] = None
    ) -> Optional[CalendarEvent]:
        """KAP bildirim JSON'ını CalendarEvent'e çevirir."""
        try:
            # KAP'ın farklı alan adları olabilir
            ticker = str(
                item.get("stockCode", item.get("HISSE_KODU", item.get("stock_code", "")))
            ).strip().upper()

            if not ticker:
                return None
            if ticker_set and ticker not in ticker_set:
                return None

            title = str(
                item.get("title", item.get("BASLIK", item.get("subject", "")))
            ).strip()

            date_str = str(
                item.get("publishDate", item.get("YAYINLANMA_TARIHI", item.get("date", "")))
            )

            event_date = self._parse_date(date_str)
            if not event_date:
                return None

            # Bildirimin tipini belirle
            event_type = self._classify_disclosure(title)
            if not event_type:
                return None  # İlgisiz bildirim

            importance = 3 if event_type in ("TEMETTU", "BILANCO") else 2

            return CalendarEvent(
                ticker=ticker,
                event_date=event_date,
                event_type=event_type,
                event_title=f"{ticker} — {title}"[:255],
                importance=importance,
                source=self.name,
            )

        except Exception:
            return None

    def _classify_disclosure(self, title: str) -> Optional[str]:
        """Bildirim başlığından etkinlik tipini belirler."""
        title_lower = title.lower()
        for event_type, keywords in self.EVENT_CATEGORIES.items():
            if any(kw in title_lower for kw in keywords):
                return event_type
        return None

    def _scrape_recent_disclosures(
        self, tickers: List[str] | None = None
    ) -> List[CalendarEvent]:
        """KAP ana sayfasından son bildirimleri HTML olarak tarar."""
        events: List[CalendarEvent] = []

        try:
            response = self._get("https://www.kap.org.tr/tr/bildirim-sorgu")
            soup = BeautifulSoup(response.text, "lxml")

            ticker_set = set(t.upper() for t in tickers) if tickers else None

            # KAP'ın bildirim tablosunu bul
            for row in soup.select(".w-clearfix.w-inline"):
                try:
                    ticker_el = row.select_one(".comp-cell-row-div.is_stock")
                    title_el = row.select_one(".comp-cell-row-div.notification")
                    date_el = row.select_one(".comp-cell-row-div.date")

                    if not ticker_el or not title_el or not date_el:
                        continue

                    ticker = ticker_el.get_text(strip=True).upper()
                    title = title_el.get_text(strip=True)
                    date_text = date_el.get_text(strip=True)

                    if ticker_set and ticker not in ticker_set:
                        continue

                    event_type = self._classify_disclosure(title)
                    if not event_type:
                        continue

                    event_date = self._parse_date(date_text)
                    if not event_date:
                        continue

                    importance = 3 if event_type in ("TEMETTU", "BILANCO") else 2

                    events.append(CalendarEvent(
                        ticker=ticker,
                        event_date=event_date,
                        event_type=event_type,
                        event_title=f"{ticker} — {title}"[:255],
                        importance=importance,
                        source=self.name,
                    ))
                except Exception:
                    continue

        except Exception as exc:
            print(f"[kap] HTML parse hatası: {exc}")

        return events

    @staticmethod
    def _parse_date(text: str) -> Optional[datetime]:
        """Farklı KAP tarih formatlarını parse eder."""
        if not text or not text.strip():
            return None

        text = text.strip()
        formats = [
            "%d.%m.%Y %H:%M",
            "%d.%m.%Y",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue

        # ISO format denemesi
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, AttributeError):
            pass

        return None
