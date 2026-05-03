#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/macro_scraper.py — Genel BIST/Türkiye Ekonomik Takvim

Üç kaynaktan veri toplar:
1. ForexFactory JSON — Küresel makro etkinlikler (TRY dahil tüm önemli ülkeler)
2. Sabit TCMB/TÜİK Takvimi — Bilinen toplantı/açıklama tarihleri
3. Borsa İstanbul Tatil/Vade takvimi
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import List, Optional

from models import CalendarEvent
from scrapers.base import BaseScraper


class MacroScraper(BaseScraper):
    """
    Genel ekonomik takvim verilerini çeker.
    Hem Türkiye'ye özel (TCMB, TÜİK) hem de global (FED, ECB vb.)
    önemli etkinlikleri kapsar.
    """

    name = "macro_tr"

    # ForexFactory halka açık JSON feed
    FF_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

    # Önemli ülkeler (sadece TRY değil — BIST'i etkileyen tüm majör ekonomiler)
    IMPORTANT_COUNTRIES = {"TRY", "USD", "EUR", "GBP", "CNY", "JPY"}

    # Sadece Medium ve High impact'li etkinlikleri al
    MIN_IMPACT = {"Medium", "High", "Holiday"}

    # Yüksek öneme sahip TR makro etkinlikleri
    HIGH_IMPORTANCE_KEYWORDS = [
        "interest rate", "faiz", "cpi", "enflasyon", "gdp", "büyüme",
        "unemployment", "işsizlik", "trade balance", "current account",
        "pmi", "retail sales", "nonfarm", "fomc", "ecb", "fed",
    ]

    # Ülke kodu → Türkçe isim
    COUNTRY_NAMES = {
        "TRY": "Türkiye", "USD": "ABD", "EUR": "Avrupa",
        "GBP": "İngiltere", "CNY": "Çin", "JPY": "Japonya",
    }

    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        """
        ForexFactory + sabit TCMB takviminden ekonomik takvim çeker.
        tickers parametresi bu scraper için kullanılmaz (makro veri).
        """
        events: List[CalendarEvent] = []

        # 1. ForexFactory — bu haftanın global etkinlikleri
        try:
            ff_events = self._scrape_forexfactory()
            events.extend(ff_events)
            print(f"[macro_tr] ForexFactory: {len(ff_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] ForexFactory hatası: {exc}")

        # 2. Sabit TCMB/TÜİK takvimi
        try:
            tcmb_events = self._get_tcmb_calendar()
            events.extend(tcmb_events)
            print(f"[macro_tr] TCMB/TÜİK sabit takvim: {len(tcmb_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] TCMB takvim hatası: {exc}")

        # 3. Borsa İstanbul tatil/vade takvimi
        try:
            bist_events = self._get_bist_calendar()
            events.extend(bist_events)
            print(f"[macro_tr] BIST takvim: {len(bist_events)} etkinlik")
        except Exception as exc:
            print(f"[macro_tr] BIST takvim hatası: {exc}")

        print(f"[macro_tr] Toplam {len(events)} makro etkinlik")
        return events

    # ─────────────── ForexFactory ───────────────

    def _scrape_forexfactory(self) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []

        response = self._get(self.FF_THIS_WEEK, headers={"Accept": "application/json"})
        items = response.json()

        for item in items:
            country = str(item.get("country", "")).upper()
            impact = str(item.get("impact", ""))

            # Sadece önemli ülkeler ve medium/high etkinlikler
            if country not in self.IMPORTANT_COUNTRIES:
                continue
            if impact not in self.MIN_IMPACT:
                continue

            ev = self._parse_ff_item(item)
            if ev:
                events.append(ev)

        return events

    def _parse_ff_item(self, item: dict) -> Optional[CalendarEvent]:
        try:
            title = str(item.get("title", "")).strip()
            if not title:
                return None

            country = str(item.get("country", "")).upper()
            country_name = self.COUNTRY_NAMES.get(country, country)

            date_str = str(item.get("date", ""))
            event_date = self._parse_date(date_str)
            if not event_date:
                return None

            impact = str(item.get("impact", "")).lower()
            if impact == "high":
                importance = 3
            elif impact == "medium":
                importance = 2
            else:
                importance = 1

            # TR veya keyword match → önem artır
            if country == "TRY":
                importance = max(importance, 2)
            if any(kw in title.lower() for kw in self.HIGH_IMPORTANCE_KEYWORDS):
                importance = max(importance, 2)

            # Forecast/previous bilgisi
            extra = json.dumps({
                "actual": item.get("actual"),
                "forecast": item.get("forecast"),
                "previous": item.get("previous"),
                "country": country,
            }, ensure_ascii=False)

            return CalendarEvent(
                ticker="MAKRO",
                event_date=event_date,
                event_type="MAKRO",
                event_title=f"[{country_name}] {title}",
                importance=importance,
                source=self.name,
                extra=extra,
            )
        except Exception:
            return None

    # ─────────────── Sabit TCMB/TÜİK Takvimi ───────────────

    def _get_tcmb_calendar(self) -> List[CalendarEvent]:
        """
        TCMB PPK toplantı tarihleri ve TÜİK veri açıklama tarihleri.
        Bu tarihler yılın başında TCMB/TÜİK tarafından açıklanır.
        Yılda 8 PPK toplantısı + aylık enflasyon/işsizlik verileri.

        Kaynak: https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+menu/duyurular/basin/ppk-toplanti-takvimi
        Not: Bu tarihler manuel güncellenmeli veya TCMB sitesinden çekilmeli.
        """
        events: List[CalendarEvent] = []
        now = datetime.now()

        # 2026 TCMB PPK Toplantı Tarihleri (her biri Perşembe)
        ppk_dates = [
            "2026-01-22", "2026-03-05", "2026-04-16",
            "2026-05-28", "2026-07-09", "2026-08-20",
            "2026-10-01", "2026-11-12", "2026-12-24",
        ]
        for ds in ppk_dates:
            dt = datetime.strptime(ds, "%Y-%m-%d")
            if dt >= now - timedelta(days=7):  # Son 1 hafta + gelecek
                events.append(CalendarEvent(
                    ticker="MAKRO",
                    event_date=dt,
                    event_type="MAKRO",
                    event_title="[Türkiye] TCMB Politika Faizi Kararı (PPK)",
                    importance=3,
                    source=self.name,
                    extra=json.dumps({"country": "TRY", "type": "interest_rate"}),
                ))

        # TÜİK TÜFE (Enflasyon) — her ayın 3'ü civarı açıklanır
        for month in range(1, 13):
            dt = datetime(now.year, month, 3)
            if dt >= now - timedelta(days=7):
                events.append(CalendarEvent(
                    ticker="MAKRO",
                    event_date=dt,
                    event_type="MAKRO",
                    event_title="[Türkiye] TÜİK TÜFE (Enflasyon) Verisi",
                    importance=3,
                    source=self.name,
                    extra=json.dumps({"country": "TRY", "type": "cpi"}),
                ))

        # TÜİK İşsizlik — genelde ayın 10'u civarı açıklanır
        for month in range(1, 13):
            dt = datetime(now.year, month, 10)
            if dt >= now - timedelta(days=7):
                events.append(CalendarEvent(
                    ticker="MAKRO",
                    event_date=dt,
                    event_type="MAKRO",
                    event_title="[Türkiye] TÜİK İşsizlik Oranı Verisi",
                    importance=2,
                    source=self.name,
                    extra=json.dumps({"country": "TRY", "type": "unemployment"}),
                ))

        # TÜİK GSYİH (GDP) — çeyreklik, genelde çeyrek sonu+2 ay
        gdp_dates = [
            "2026-03-31", "2026-06-30", "2026-09-30", "2026-12-31",
        ]
        for ds in gdp_dates:
            dt = datetime.strptime(ds, "%Y-%m-%d")
            if dt >= now - timedelta(days=7):
                events.append(CalendarEvent(
                    ticker="MAKRO",
                    event_date=dt,
                    event_type="MAKRO",
                    event_title="[Türkiye] TÜİK GSYİH (Büyüme) Verisi",
                    importance=3,
                    source=self.name,
                    extra=json.dumps({"country": "TRY", "type": "gdp"}),
                ))

        return events

    # ─────────────── BIST Tatil/Vade Takvimi ───────────────

    def _get_bist_calendar(self) -> List[CalendarEvent]:
        """Borsa İstanbul resmi tatil günleri ve opsiyon vade sonları."""
        events: List[CalendarEvent] = []
        now = datetime.now()

        # 2026 Borsa İstanbul Tatil Günleri
        bist_holidays = [
            ("2026-01-01", "Yılbaşı Tatili"),
            ("2026-03-29", "Ramazan Bayramı 1. Gün"),
            ("2026-03-30", "Ramazan Bayramı 2. Gün"),
            ("2026-03-31", "Ramazan Bayramı 3. Gün"),
            ("2026-04-23", "Ulusal Egemenlik ve Çocuk Bayramı"),
            ("2026-05-01", "Emek ve Dayanışma Günü"),
            ("2026-05-19", "Atatürk'ü Anma, Gençlik ve Spor Bayramı"),
            ("2026-06-05", "Kurban Bayramı 1. Gün"),
            ("2026-06-06", "Kurban Bayramı 2. Gün"),
            ("2026-06-07", "Kurban Bayramı 3. Gün"),
            ("2026-06-08", "Kurban Bayramı 4. Gün"),
            ("2026-07-15", "Demokrasi ve Milli Birlik Günü"),
            ("2026-08-30", "Zafer Bayramı"),
            ("2026-10-28", "Cumhuriyet Bayramı (yarım gün)"),
            ("2026-10-29", "Cumhuriyet Bayramı"),
        ]

        for ds, name in bist_holidays:
            dt = datetime.strptime(ds, "%Y-%m-%d")
            if dt >= now - timedelta(days=7):
                events.append(CalendarEvent(
                    ticker="BIST",
                    event_date=dt,
                    event_type="TATIL",
                    event_title=f"[BIST] Borsa Kapalı — {name}",
                    importance=2,
                    source=self.name,
                ))

        # VİOP Opsiyon Vade Sonları — her ayın 3. Cuma günü
        for month in range(1, 13):
            # Ayın 3. Cuma'sını bul
            first_day = datetime(now.year, month, 1)
            # İlk Cuma
            days_until_friday = (4 - first_day.weekday()) % 7
            first_friday = first_day + timedelta(days=days_until_friday)
            third_friday = first_friday + timedelta(weeks=2)

            if third_friday >= now - timedelta(days=7):
                events.append(CalendarEvent(
                    ticker="BIST",
                    event_date=third_friday,
                    event_type="VADE",
                    event_title=f"[BIST] VİOP Opsiyon/Vadeli İşlem Vade Sonu",
                    importance=2,
                    source=self.name,
                ))

        return events

    @staticmethod
    def _parse_date(text: str) -> Optional[datetime]:
        if not text:
            return None
        try:
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
