#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/macro_scraper.py - Genel BIST/Turkiye ekonomik takvimi

Kaynaklar:
1. ForexFactory weekly JSON - sadece BIST icin anlamli global/TRY olaylar
2. TCMB resmi takvim sayfasi
3. TUIK kritik veri fallback takvimi
4. Borsa Istanbul resmi tatil sayfasi
5. VIOP aylik vade sonlari
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from typing import Iterable, List, Optional

from bs4 import BeautifulSoup

from models import CalendarEvent
from scrapers.base import BaseScraper


class MacroScraper(BaseScraper):
    """Genel BIST takvim olaylarini toplar."""

    name = "macro_tr"

    FF_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    TCMB_CALENDAR_URL = "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB%2BTR/Main%2BMenu/Duyurular/Takvim"
    BIST_HOLIDAYS_URL = "https://www.borsaistanbul.com/en/official-holidays"

    IMPORTANT_COUNTRIES = {"TRY", "USD", "EUR", "GBP", "CNY", "JPY"}
    MIN_IMPACT = {"Medium", "High", "Holiday"}
    LOOKBACK_DAYS = 7
    HORIZON_DAYS = 370

    HIGH_IMPORTANCE_KEYWORDS = [
        "interest rate",
        "faiz",
        "cpi",
        "inflation",
        "enflasyon",
        "gdp",
        "buyume",
        "büyüme",
        "unemployment",
        "issizlik",
        "işsizlik",
        "trade balance",
        "current account",
        "pmi",
        "retail sales",
        "nonfarm",
        "fomc",
        "ecb",
        "fed",
    ]

    COUNTRY_NAMES = {
        "TRY": "Türkiye",
        "USD": "ABD",
        "EUR": "Avrupa",
        "GBP": "İngiltere",
        "CNY": "Çin",
        "JPY": "Japonya",
    }

    MONTHS_TR = {
        "ocak": 1,
        "şubat": 2,
        "subat": 2,
        "mart": 3,
        "nisan": 4,
        "mayıs": 5,
        "mayis": 5,
        "haziran": 6,
        "temmuz": 7,
        "ağustos": 8,
        "agustos": 8,
        "eylül": 9,
        "eylul": 9,
        "ekim": 10,
        "kasım": 11,
        "kasim": 11,
        "aralık": 12,
        "aralik": 12,
    }

    MONTHS_EN = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }

    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        del tickers
        events: List[CalendarEvent] = []

        try:
            ff_events = self._scrape_forexfactory()
            events.extend(ff_events)
            print(f"[macro_tr] ForexFactory: {len(ff_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] ForexFactory hatası: {exc}")

        try:
            tcmb_events = self._scrape_tcmb_calendar()
            events.extend(tcmb_events)
            print(f"[macro_tr] TCMB resmi takvim: {len(tcmb_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] TCMB resmi takvim hatası: {exc}")

        try:
            tuik_events = self._get_tuik_release_fallback()
            events.extend(tuik_events)
            print(f"[macro_tr] TÜİK fallback takvim: {len(tuik_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] TÜİK fallback hatası: {exc}")

        try:
            bist_holidays = self._scrape_bist_holidays()
            events.extend(bist_holidays)
            print(f"[macro_tr] BIST resmi tatil: {len(bist_holidays)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] BIST resmi tatil hatası: {exc}")
            fallback_holidays = self._get_bist_holidays_fallback()
            events.extend(fallback_holidays)
            print(f"[macro_tr] BIST fallback tatil: {len(fallback_holidays)} etkinlik")

        try:
            viop_events = self._get_viop_expiry_calendar()
            events.extend(viop_events)
            print(f"[macro_tr] VİOP vade takvimi: {len(viop_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] VİOP takvim hatası: {exc}")

        events = self._filter_horizon(self._dedupe_preserve_order(events))
        print(f"[macro_tr] Toplam {len(events)} makro/genel etkinlik")
        return events

    def _scrape_forexfactory(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []

        response = self._get(self.FF_THIS_WEEK, headers={"Accept": "application/json"})
        items = response.json()

        for item in items:
            country = str(item.get("country", "")).upper()
            impact = str(item.get("impact", ""))
            title = str(item.get("title", "")).strip()

            if country not in self.IMPORTANT_COUNTRIES:
                continue
            if impact not in self.MIN_IMPACT:
                continue
            if not self._should_include_ff_item(country, impact, title):
                continue

            event = self._parse_ff_item(item)
            if event:
                events.append(event)

        return events

    def _parse_ff_item(self, item: dict) -> Optional[CalendarEvent]:
        title = str(item.get("title", "")).strip()
        if not title:
            return None

        country = str(item.get("country", "")).upper()
        country_name = self.COUNTRY_NAMES.get(country, country)
        event_date = self._parse_datetime(str(item.get("date", "")))
        if not event_date:
            return None

        impact = str(item.get("impact", "")).lower()
        if impact == "high":
            importance = 3
        elif impact == "medium":
            importance = 2
        else:
            importance = 1

        if country == "TRY":
            importance = max(importance, 2)
        if any(keyword in title.lower() for keyword in self.HIGH_IMPORTANCE_KEYWORDS):
            importance = max(importance, 2)

        return CalendarEvent(
            ticker="MAKRO",
            event_date=event_date,
            event_type=self._build_ff_event_type(title),
            event_title=f"[{country_name}] {title}",
            importance=importance,
            source="forexfactory",
            extra=json.dumps(
                {
                    "actual": item.get("actual"),
                    "forecast": item.get("forecast"),
                    "previous": item.get("previous"),
                    "country": country,
                    "calendar_source": "forexfactory",
                },
                ensure_ascii=False,
            ),
        )

    def _scrape_tcmb_calendar(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []
        now = datetime.now()

        response = self._get(self.TCMB_CALENDAR_URL)
        soup = BeautifulSoup(response.text, "lxml")

        row_specs = [
            (0, "PPK_KARAR", "[Türkiye] TCMB Politika Faizi Kararı (PPK)", 3, "policy_rate"),
            (1, "PPK_OZET", "[Türkiye] TCMB PPK Toplantı Özeti", 2, "policy_summary"),
            (2, "ENFLASYON_RAPORU", "[Türkiye] TCMB Enflasyon Raporu", 3, "inflation_report"),
            (3, "FINANSAL_ISTIKRAR", "[Türkiye] TCMB Finansal İstikrar Raporu", 2, "financial_stability_report"),
        ]

        for table in soup.find_all("table"):
            for tr in table.find_all("tr"):
                cells = [
                    self._clean_text(cell.get_text(" ", strip=True))
                    for cell in tr.find_all(["td", "th"])
                ]
                if len(cells) < 4:
                    continue
                if not any(re.search(r"\d{4}", cell) for cell in cells[:4]):
                    continue

                for index, event_type, title, importance, subtype in row_specs:
                    event_date = self._parse_human_date(cells[index])
                    if not event_date or event_date < now - timedelta(days=self.LOOKBACK_DAYS):
                        continue

                    events.append(
                        CalendarEvent(
                            ticker="MAKRO",
                            event_date=event_date,
                            event_type=event_type,
                            event_title=title,
                            importance=importance,
                            source="tcmb",
                            extra=json.dumps(
                                {
                                    "country": "TRY",
                                    "type": subtype,
                                    "calendar_source": "tcmb",
                                },
                                ensure_ascii=False,
                            ),
                        )
                    )

        return self._dedupe_preserve_order(events)

    def _get_tuik_release_fallback(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []
        now = datetime.now()

        for anchor in self._iter_month_starts(13):
            year = anchor.year
            month = anchor.month

            cpi_date = datetime(year, month, 3)
            if cpi_date >= now - timedelta(days=self.LOOKBACK_DAYS):
                events.append(
                    CalendarEvent(
                        ticker="MAKRO",
                        event_date=cpi_date,
                        event_type="TUFE",
                        event_title="[Türkiye] TÜİK TÜFE (Enflasyon) Verisi",
                        importance=3,
                        source="tuik_fallback",
                        extra=json.dumps({"country": "TRY", "type": "cpi"}, ensure_ascii=False),
                    )
                )

            unemployment_date = datetime(year, month, 10)
            if unemployment_date >= now - timedelta(days=self.LOOKBACK_DAYS):
                events.append(
                    CalendarEvent(
                        ticker="MAKRO",
                        event_date=unemployment_date,
                        event_type="ISSIZLIK",
                        event_title="[Türkiye] TÜİK İşsizlik Oranı Verisi",
                        importance=2,
                        source="tuik_fallback",
                        extra=json.dumps({"country": "TRY", "type": "unemployment"}, ensure_ascii=False),
                    )
                )

            if month in {3, 6, 9, 12}:
                quarter_day = 30 if month in {6, 9} else 31
                gdp_date = datetime(year, month, quarter_day)
                if gdp_date >= now - timedelta(days=self.LOOKBACK_DAYS):
                    events.append(
                        CalendarEvent(
                            ticker="MAKRO",
                            event_date=gdp_date,
                            event_type="GSYH",
                            event_title="[Türkiye] TÜİK GSYİH (Büyüme) Verisi",
                            importance=3,
                            source="tuik_fallback",
                            extra=json.dumps({"country": "TRY", "type": "gdp"}, ensure_ascii=False),
                        )
                    )

        return self._dedupe_preserve_order(events)

    def _scrape_bist_holidays(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []
        now = datetime.now()

        response = self._get(self.BIST_HOLIDAYS_URL)
        soup = BeautifulSoup(response.text, "lxml")

        for table in soup.find_all("table"):
            for tr in table.find_all("tr"):
                cells = [
                    self._clean_text(cell.get_text(" ", strip=True))
                    for cell in tr.find_all(["td", "th"])
                ]
                if len(cells) < 3:
                    continue

                date_text, holiday_name, state_text = cells[:3]
                if str(now.year) not in date_text:
                    continue

                dates = self._parse_bist_date_range(date_text)
                if not dates:
                    continue

                is_half_day = "until 13:00" in state_text.lower() or "half day" in holiday_name.lower()

                for event_date in dates:
                    if event_date < now - timedelta(days=self.LOOKBACK_DAYS):
                        continue
                    title_prefix = "[BIST] Borsa Yarım Gün" if is_half_day else "[BIST] Borsa Kapalı"
                    events.append(
                        CalendarEvent(
                            ticker="BIST",
                            event_date=event_date,
                            event_type="TATIL",
                            event_title=f"{title_prefix} — {holiday_name}",
                            importance=2,
                            source="borsa_istanbul",
                            extra=json.dumps(
                                {
                                    "country": "TRY",
                                    "type": "holiday",
                                    "state": "half_day" if is_half_day else "closed",
                                    "calendar_source": "borsa_istanbul",
                                },
                                ensure_ascii=False,
                            ),
                        )
                    )

        return self._dedupe_preserve_order(events)

    def _get_bist_holidays_fallback(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []
        now = datetime.now()

        fallback_holidays = [
            ("2026-01-01", "Yeni Yıl Tatili", False),
            ("2026-03-19", "Ramazan Bayramı Arefesi", True),
            ("2026-03-20", "Ramazan Bayramı", False),
            ("2026-03-21", "Ramazan Bayramı", False),
            ("2026-03-22", "Ramazan Bayramı", False),
            ("2026-04-23", "Ulusal Egemenlik ve Çocuk Bayramı", False),
            ("2026-05-01", "Emek ve Dayanışma Günü", False),
            ("2026-05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı", False),
            ("2026-05-26", "Kurban Bayramı Arefesi", True),
            ("2026-05-27", "Kurban Bayramı", False),
            ("2026-05-28", "Kurban Bayramı", False),
            ("2026-05-29", "Kurban Bayramı", False),
            ("2026-05-30", "Kurban Bayramı", False),
            ("2026-07-15", "Demokrasi ve Milli Birlik Günü", False),
            ("2026-08-30", "Zafer Bayramı", False),
            ("2026-10-28", "Cumhuriyet Bayramı", True),
            ("2026-10-29", "Cumhuriyet Bayramı", False),
        ]

        for date_str, label, is_half_day in fallback_holidays:
            event_date = datetime.strptime(date_str, "%Y-%m-%d")
            if event_date < now - timedelta(days=self.LOOKBACK_DAYS):
                continue

            title_prefix = "[BIST] Borsa Yarım Gün" if is_half_day else "[BIST] Borsa Kapalı"
            events.append(
                CalendarEvent(
                    ticker="BIST",
                    event_date=event_date,
                    event_type="TATIL",
                    event_title=f"{title_prefix} — {label}",
                    importance=2,
                    source="borsa_istanbul_fallback",
                    extra=json.dumps(
                        {
                            "country": "TRY",
                            "type": "holiday",
                            "state": "half_day" if is_half_day else "closed",
                        },
                        ensure_ascii=False,
                    ),
                )
            )

        return events

    def _get_viop_expiry_calendar(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []
        now = datetime.now()

        for anchor in self._iter_month_starts(13):
            first_day = datetime(anchor.year, anchor.month, 1)
            days_until_friday = (4 - first_day.weekday()) % 7
            first_friday = first_day + timedelta(days=days_until_friday)
            third_friday = first_friday + timedelta(weeks=2)

            if third_friday >= now - timedelta(days=self.LOOKBACK_DAYS):
                events.append(
                    CalendarEvent(
                        ticker="BIST",
                        event_date=third_friday,
                        event_type="VADE",
                        event_title="[BIST] VİOP Opsiyon/Vadeli İşlem Vade Sonu",
                        importance=2,
                        source="viop_calendar",
                        extra=json.dumps({"country": "TRY", "type": "viop_expiry"}, ensure_ascii=False),
                    )
                )

        return events

    def _iter_month_starts(self, count: int) -> Iterable[datetime]:
        now = datetime.now()
        year = now.year
        month = now.month
        for offset in range(count):
            total_month = month - 1 + offset
            current_year = year + (total_month // 12)
            current_month = (total_month % 12) + 1
            yield datetime(current_year, current_month, 1)

    def _filter_horizon(self, events: Iterable[CalendarEvent]) -> List[CalendarEvent]:
        now = datetime.now()
        start = now - timedelta(days=self.LOOKBACK_DAYS)
        end = now + timedelta(days=self.HORIZON_DAYS)
        return [event for event in events if start <= event.event_date <= end]

    def _should_include_ff_item(self, country: str, impact: str, title: str) -> bool:
        title_lower = title.lower()
        if "holiday" in title_lower:
            return False

        if country == "TRY":
            return True

        if impact != "High":
            return False

        return any(keyword in title_lower for keyword in self.HIGH_IMPORTANCE_KEYWORDS)

    @staticmethod
    def _build_ff_event_type(title: str) -> str:
        slug = re.sub(r"[^A-Z0-9]+", "_", title.upper()).strip("_")
        return f"FF_{(slug or 'EVENT')[:47]}"

    def _parse_bist_date_range(self, text: str) -> List[datetime]:
        cleaned = self._clean_text(text.split(",", 1)[0])

        cross_month = re.match(
            r"^(?P<first>\d+(?:-\d+)*)\s+(?P<first_month>[A-Za-z]+),\s*(?P<second>\d+(?:-\d+)*)\s+(?P<second_month>[A-Za-z]+)\s+(?P<year>\d{4})$",
            cleaned,
        )
        if cross_month:
            year = int(cross_month.group("year"))
            dates = []
            dates.extend(self._build_range_dates(cross_month.group("first"), cross_month.group("first_month"), year))
            dates.extend(self._build_range_dates(cross_month.group("second"), cross_month.group("second_month"), year))
            return dates

        same_month = re.match(
            r"^(?P<days>\d+(?:-\d+)*)\s+(?P<month>[A-Za-z]+)\s+(?P<year>\d{4})$",
            cleaned,
        )
        if same_month:
            return self._build_range_dates(
                same_month.group("days"),
                same_month.group("month"),
                int(same_month.group("year")),
            )

        single = self._parse_human_date(cleaned)
        return [single] if single else []

    def _build_range_dates(self, day_blob: str, month_name: str, year: int) -> List[datetime]:
        month = self._month_number(month_name)
        if month is None:
            return []

        dates: List[datetime] = []
        for day_value in day_blob.split("-"):
            value = day_value.strip()
            if value.isdigit():
                dates.append(datetime(year, month, int(value)))
        return dates

    def _parse_human_date(self, text: str) -> Optional[datetime]:
        cleaned = self._clean_text(text)

        direct = self._parse_datetime(cleaned)
        if direct:
            return direct

        single = re.match(
            r"^(?P<day>\d{1,2})\s+(?P<month>[A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(?P<year>\d{4})$",
            cleaned,
        )
        if not single:
            return None

        month = self._month_number(single.group("month"))
        if month is None:
            return None
        return datetime(int(single.group("year")), month, int(single.group("day")))

    def _month_number(self, month_name: str) -> Optional[int]:
        key = month_name.strip().lower()
        return self.MONTHS_TR.get(key) or self.MONTHS_EN.get(key)

    @staticmethod
    def _clean_text(text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _dedupe_preserve_order(events: Iterable[CalendarEvent]) -> List[CalendarEvent]:
        seen: set[tuple[str, str, str, str]] = set()
        deduped: List[CalendarEvent] = []
        for event in events:
            key = (
                event.ticker,
                event.event_type,
                event.event_date.isoformat(),
                event.event_title,
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(event)
        return deduped

    @staticmethod
    def _parse_datetime(text: str) -> Optional[datetime]:
        if not text:
            return None

        candidate = text.strip().replace("\xa0", " ")

        try:
            return datetime.fromisoformat(candidate.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, AttributeError):
            pass

        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d.%m.%Y",
            "%d.%m.%Y %H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(candidate, fmt)
            except ValueError:
                continue

        return None
