#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/isyatirim_scraper.py — İş Yatırım bilanço tarihleri kazıyıcısı

İş Yatırım'ın hisse karşılaştırma / mali takvim sayfasından
şirketlerin bilanço açıklama tarihlerini çeker.

Kaynak: isyatirim.com.tr (halka açık sayfa, arka plan XHR isteği)
"""

from __future__ import annotations

import re
import json
from datetime import datetime
from typing import List, Optional

from bs4 import BeautifulSoup

from models import CalendarEvent
from scrapers.base import BaseScraper


class IsYatirimScraper(BaseScraper):
    """İş Yatırım hisse analiz sayfalarından bilanço takvimi çeker."""

    name = "isyatirim"

    # İş Yatırım'ın hisse endeks sayfası — tüm BIST100 hisselerinin listesini döndürür
    BASE_URL = "https://www.isyatirim.com.tr"

    # Hisse detay sayfasından mali takvim bilgisi
    COMPANY_URL = (
        "https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/"
        "sirket-karti.aspx?hisse={ticker}"
    )

    # İş Yatırım mali takvim API-benzeri endpoint (XHR)
    FINANCIAL_CALENDAR_API = (
        "https://www.isyatirim.com.tr/_layouts/15/Jeeves/Jes498/JeesService.asmx/"
        "GetFinancialCalendar"
    )

    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        """
        İş Yatırım'dan bilanço takvimi verilerini çeker.
        Önce XHR endpoint'ini dener, başarısız olursa
        her hissenin şirket kartı sayfasını parse eder.
        """
        events: List[CalendarEvent] = []

        # Yöntem 1: Toplu mali takvim endpoint'i
        try:
            bulk_events = self._try_financial_calendar_api()
            if bulk_events:
                print(f"[isyatirim] API'den {len(bulk_events)} etkinlik çekildi.")
                if tickers:
                    ticker_set = set(t.upper() for t in tickers)
                    bulk_events = [e for e in bulk_events if e.ticker in ticker_set]
                events.extend(bulk_events)
                return events
        except Exception as exc:
            print(f"[isyatirim] API denemesi başarısız: {exc}")

        # Yöntem 2: Her hisse için şirket kartı sayfasını tara
        target_tickers = tickers or []
        if not target_tickers:
            print("[isyatirim] Ticker listesi boş, atlıyor.")
            return events

        print(f"[isyatirim] {len(target_tickers)} hisse için şirket kartları taranıyor...")
        for i, ticker in enumerate(target_tickers, 1):
            try:
                ev = self._scrape_company_page(ticker)
                if ev:
                    events.extend(ev)
                    print(f"   [{i}/{len(target_tickers)}] {ticker}: {len(ev)} etkinlik")
                else:
                    print(f"   [{i}/{len(target_tickers)}] {ticker}: etkinlik bulunamadı")
            except Exception as exc:
                print(f"   [{i}/{len(target_tickers)}] {ticker}: HATA — {exc}")

        return events

    def _try_financial_calendar_api(self) -> List[CalendarEvent]:
        """İş Yatırım'ın arka plan JSON servisini dener."""
        events: List[CalendarEvent] = []
        try:
            response = self._post(
                self.FINANCIAL_CALENDAR_API,
                json={},
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
            data = response.json()
            items = data.get("d", data) if isinstance(data, dict) else data

            if isinstance(items, list):
                for item in items:
                    ev = self._parse_api_item(item)
                    if ev:
                        events.append(ev)
        except Exception:
            raise

        return events

    def _parse_api_item(self, item: dict) -> Optional[CalendarEvent]:
        """API JSON öğesini CalendarEvent'e çevirir."""
        try:
            ticker = str(item.get("HESSION", item.get("hession", "")))
            ticker = ticker.replace(".E.BIST", "").strip().upper()
            if not ticker:
                return None

            date_str = item.get("TARIH", item.get("tarih", ""))
            event_date = self._parse_date(date_str)
            if not event_date:
                return None

            title = item.get("ACIKLAMA", item.get("aciklama", f"{ticker} Bilanço"))
            period = item.get("DONEM", item.get("donem", ""))
            if period:
                title = f"{ticker} {period} Bilanço Açıklaması"

            return CalendarEvent(
                ticker=ticker,
                event_date=event_date,
                event_type="BILANCO",
                event_title=title,
                importance=3,
                source=self.name,
            )
        except Exception:
            return None

    def _scrape_company_page(self, ticker: str) -> List[CalendarEvent]:
        """Bir hissenin İş Yatırım şirket kartı sayfasını parse eder.
        Bilanço, Temettü ve Sermaye Artırımı tablolarını ayrı ayrı arar."""
        events: List[CalendarEvent] = []
        url = self.COMPANY_URL.format(ticker=ticker)

        try:
            response = self._get(url)
            soup = BeautifulSoup(response.text, "lxml")

            for table in soup.find_all("table"):
                headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
                headers_joined = " ".join(headers)

                # --- Bilanço tablosu ---
                if any(kw in headers_joined for kw in ["tarih", "dönem", "bilanço"]) and "temettü" not in headers_joined:
                    for row in table.find_all("tr")[1:]:
                        cells = [td.get_text(strip=True) for td in row.find_all("td")]
                        if len(cells) >= 2:
                            ev = self._parse_table_row(ticker, cells)
                            if ev:
                                events.append(ev)

                # --- Temettü tablosu ---
                # Başlıklar: Kod, Dağ. Tarihi, Temettü Verim, Hisse Başı TL, ...
                elif "dağ. tarihi" in headers_joined or ("temettü" in headers_joined and "hisse" in headers_joined):
                    date_idx = None
                    amount_idx = None
                    for i, h in enumerate(headers):
                        if "tarihi" in h or "tarih" in h:
                            date_idx = i
                        if "hisse başı" in h:
                            amount_idx = i

                    if date_idx is not None:
                        for row in table.find_all("tr")[1:]:
                            cells = [td.get_text(strip=True) for td in row.find_all("td")]
                            if len(cells) <= date_idx:
                                continue
                            if "kayıt bulunamadı" in " ".join(cells).lower():
                                continue
                            event_date = self._parse_date(cells[date_idx])
                            if not event_date:
                                continue
                            amount = cells[amount_idx] if amount_idx and amount_idx < len(cells) else ""
                            title = f"{ticker} Temettü Ödemesi"
                            if amount:
                                title += f" ({amount} TL/hisse)"
                            events.append(CalendarEvent(
                                ticker=ticker,
                                event_date=event_date,
                                event_type="TEMETTU",
                                event_title=title[:255],
                                importance=3,
                                source=self.name,
                            ))

                # --- Sermaye Artırımı tablosu ---
                # Başlıklar: Kod, BölünmeSonrasıSermaye, Tarih, BedelliOran, ... BedelsizIKOran, BedelsizTemettüOran ...
                elif "bedelsiz" in headers_joined or ("sermaye" in headers_joined and "oran" in headers_joined):
                    date_idx = None
                    bedelsiz_idx = None
                    for i, h in enumerate(headers):
                        if h == "tarih":
                            date_idx = i
                        if "bedelsiz" in h and "ik" in h:
                            bedelsiz_idx = i

                    if date_idx is not None:
                        for row in table.find_all("tr")[1:]:
                            cells = [td.get_text(strip=True) for td in row.find_all("td")]
                            if len(cells) <= date_idx:
                                continue
                            if "kayıt bulunamadı" in " ".join(cells).lower():
                                continue
                            event_date = self._parse_date(cells[date_idx])
                            if not event_date:
                                continue
                            bedelsiz = cells[bedelsiz_idx] if bedelsiz_idx and bedelsiz_idx < len(cells) else ""
                            title = f"{ticker} Sermaye Artırımı"
                            if bedelsiz and bedelsiz != "0" and bedelsiz != "-":
                                title += f" (Bedelsiz %{bedelsiz})"
                            events.append(CalendarEvent(
                                ticker=ticker,
                                event_date=event_date,
                                event_type="BEDELSIZ",
                                event_title=title[:255],
                                importance=2,
                                source=self.name,
                            ))

            # Inline script JSON verisi
            for script in soup.find_all("script"):
                text = script.get_text()
                if "FinancialCalendar" in text or "bilancoTarih" in text:
                    json_matches = re.findall(r'\{[^}]+\}', text)
                    for match in json_matches:
                        try:
                            obj = json.loads(match)
                            ev = self._parse_api_item(obj)
                            if ev and ev.ticker == ticker:
                                events.append(ev)
                        except json.JSONDecodeError:
                            continue

        except Exception as exc:
            print(f"[isyatirim] {ticker} sayfa parse hatası: {exc}")

        return events

    def _parse_table_row(self, ticker: str, cells: List[str]) -> Optional[CalendarEvent]:
        """HTML tablo satırını CalendarEvent'e çevirir."""
        try:
            # Hücreler genelde: [Dönem, Tarih] veya [Tarih, Açıklama]
            date_cell = None
            period_cell = None

            for cell in cells:
                parsed = self._parse_date(cell)
                if parsed:
                    date_cell = parsed
                elif any(kw in cell.lower() for kw in ["q1", "q2", "q3", "q4", "çeyrek", "yıllık", "6 ay"]):
                    period_cell = cell

            if date_cell:
                title = f"{ticker} Bilanço Açıklaması"
                if period_cell:
                    title = f"{ticker} {period_cell} Bilanço Açıklaması"

                return CalendarEvent(
                    ticker=ticker,
                    event_date=date_cell,
                    event_type="BILANCO",
                    event_title=title,
                    importance=3,
                    source=self.name,
                )
        except Exception:
            pass
        return None

    @staticmethod
    def _parse_date(text: str) -> Optional[datetime]:
        """Farklı tarih formatlarını parse etmeye çalışır."""
        if not text or not text.strip():
            return None

        text = text.strip()
        formats = [
            "%d.%m.%Y",          # 15.05.2024
            "%d/%m/%Y",          # 15/05/2024
            "%Y-%m-%d",          # 2024-05-15
            "%d %B %Y",          # 15 Mayıs 2024
            "%d.%m.%Y %H:%M",   # 15.05.2024 18:00
        ]

        # Türkçe ay isimlerini İngilizce'ye çevir
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

        # Son çare: regex ile tarih bulmaya çalış
        match = re.search(r'(\d{1,2})[./](\d{1,2})[./](\d{4})', text)
        if match:
            d, m, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
            try:
                return datetime(y, m, d)
            except ValueError:
                pass

        return None
