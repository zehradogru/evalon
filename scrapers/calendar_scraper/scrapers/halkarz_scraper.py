#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/halkarz_scraper.py — HalkArz.com temettü ve sermaye artırımı kazıyıcısı

HalkArz.com'un halka açık temettü takvimi ve sermaye artırımı
sayfalarından BIST hisselerine ait etkinlikleri çeker.
"""

from __future__ import annotations

import re
import json
from datetime import datetime
from typing import List, Optional

from bs4 import BeautifulSoup

from models import CalendarEvent
from scrapers.base import BaseScraper


class HalkArzScraper(BaseScraper):
    """HalkArz.com temettü + sermaye artırımı kazıyıcısı."""

    name = "halkarz"

    TEMETTU_URL = "https://halkarz.com/temettu-takvimi/"
    SERMAYE_URL = "https://halkarz.com/sermaye-artirimi/"

    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []

        # 1. Temettü takvimi
        try:
            temettu_events = self._scrape_page(
                self.TEMETTU_URL, "TEMETTU", tickers
            )
            events.extend(temettu_events)
            print(f"[halkarz] Temettü: {len(temettu_events)} etkinlik")
        except Exception as exc:
            print(f"[halkarz] Temettü hatası: {exc}")

        # 2. Sermaye artırımı
        try:
            sermaye_events = self._scrape_page(
                self.SERMAYE_URL, "BEDELSIZ", tickers
            )
            events.extend(sermaye_events)
            print(f"[halkarz] Sermaye artırımı: {len(sermaye_events)} etkinlik")
        except Exception as exc:
            print(f"[halkarz] Sermaye artırımı hatası: {exc}")

        return events

    def _scrape_page(
        self, url: str, event_type: str, tickers: List[str] | None
    ) -> List[CalendarEvent]:
        events: List[CalendarEvent] = []
        ticker_set = set(t.upper() for t in tickers) if tickers else None

        response = self._get(url)
        soup = BeautifulSoup(response.text, "lxml")

        # HalkArz uses <table> elements for data
        for table in soup.find_all("table"):
            headers = []
            for th in table.find_all("th"):
                headers.append(th.get_text(strip=True).lower())

            if not headers:
                continue

            # Find relevant column indices
            ticker_idx = None
            date_idx = None
            title_idx = None
            amount_idx = None

            for i, h in enumerate(headers):
                h_lower = h.lower()
                if any(k in h_lower for k in ["hisse", "kod", "şirket kodu", "sembol"]):
                    ticker_idx = i
                elif any(k in h_lower for k in ["tarih", "ödeme", "son"]):
                    if date_idx is None:  # ilk tarih kolonunu al
                        date_idx = i
                elif any(k in h_lower for k in ["tutar", "oran", "brüt", "net"]):
                    amount_idx = i
                elif any(k in h_lower for k in ["açıklama", "tür", "tip"]):
                    title_idx = i

            if ticker_idx is None or date_idx is None:
                continue

            for row in table.find_all("tr")[1:]:
                cells = [td.get_text(strip=True) for td in row.find_all("td")]
                if len(cells) <= max(ticker_idx, date_idx):
                    continue

                ticker = cells[ticker_idx].strip().upper()
                # Bazen "THYAO.E" gibi suffix olabiliyor
                ticker = ticker.split(".")[0].strip()
                if not ticker or len(ticker) < 2:
                    continue

                if ticker_set and ticker not in ticker_set:
                    continue

                date_text = cells[date_idx].strip()
                event_date = self._parse_date(date_text)
                if not event_date:
                    continue

                # Başlık oluştur
                if event_type == "TEMETTU":
                    amount = cells[amount_idx].strip() if amount_idx and amount_idx < len(cells) else ""
                    title = f"{ticker} Temettü Ödemesi"
                    if amount:
                        title += f" ({amount})"
                else:
                    desc = cells[title_idx].strip() if title_idx and title_idx < len(cells) else ""
                    title = f"{ticker} Sermaye Artırımı"
                    if desc:
                        title += f" — {desc}"

                events.append(CalendarEvent(
                    ticker=ticker,
                    event_date=event_date,
                    event_type=event_type,
                    event_title=title[:255],
                    importance=3,
                    source=self.name,
                ))

        # Eğer tablo bulunamadıysa, div/li bazlı yapıyı dene
        if not events:
            events = self._scrape_card_layout(soup, event_type, ticker_set)

        return events

    def _scrape_card_layout(
        self, soup: BeautifulSoup, event_type: str, ticker_set: set | None
    ) -> List[CalendarEvent]:
        """Kart bazlı layout'tan veri çeker (bazı sayfalar tablo yerine kart kullanır)."""
        events: List[CalendarEvent] = []

        # Genel pattern: hisse kodu + tarih içeren div/article blokları
        for card in soup.select("article, .hisse-card, .temettu-card, .sermaye-card, .wp-block-table"):
            text = card.get_text(" ", strip=True)

            # Ticker bulmaya çalış (genelde 3-5 büyük harf)
            ticker_match = re.search(r'\b([A-ZÇĞİÖŞÜ]{3,6})\b', text)
            if not ticker_match:
                continue
            ticker = ticker_match.group(1)

            if ticker_set and ticker not in ticker_set:
                continue

            # Tarih bulmaya çalış
            date_match = re.search(r'(\d{1,2})[./](\d{1,2})[./](\d{4})', text)
            if not date_match:
                continue

            d, m, y = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
            try:
                event_date = datetime(y, m, d)
            except ValueError:
                continue

            if event_type == "TEMETTU":
                title = f"{ticker} Temettü Ödemesi"
            else:
                title = f"{ticker} Sermaye Artırımı"

            events.append(CalendarEvent(
                ticker=ticker,
                event_date=event_date,
                event_type=event_type,
                event_title=title,
                importance=3,
                source=self.name,
            ))

        return events

    @staticmethod
    def _parse_date(text: str) -> Optional[datetime]:
        if not text or not text.strip():
            return None
        text = text.strip()
        formats = [
            "%d.%m.%Y",
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d.%m.%Y %H:%M",
            "%d %B %Y",
        ]
        tr_months = {
            "ocak": "January", "şubat": "February", "mart": "March",
            "nisan": "April", "mayıs": "May", "haziran": "June",
            "temmuz": "July", "ağustos": "August", "eylül": "September",
            "ekim": "October", "kasım": "November", "aralık": "December",
        }
        text_lower = text.lower()
        for tr, en in tr_months.items():
            if tr in text_lower:
                text = text_lower.replace(tr, en).title()
                break

        for fmt in formats:
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue

        match = re.search(r'(\d{1,2})[./](\d{1,2})[./](\d{4})', text)
        if match:
            d, m, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
            try:
                return datetime(y, m, d)
            except ValueError:
                pass
        return None
