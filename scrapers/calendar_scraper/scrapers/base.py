#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scrapers/base.py — Tüm kazıyıcılar için temel sınıf

Her yeni kaynak (İş Yatırım, KAP, Investing vb.) bu arayüzü implemente eder.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import List

import requests

from config import USER_AGENT, HTTP_TIMEOUT, REQUEST_DELAY
from models import CalendarEvent


class BaseScraper(ABC):
    """Soyut temel kazıyıcı sınıfı."""

    name: str = "base"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/json",
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.5",
        })

    def _get(self, url: str, **kwargs) -> requests.Response:
        """Rate-limited GET isteği."""
        kwargs.setdefault("timeout", HTTP_TIMEOUT)
        response = self.session.get(url, **kwargs)
        response.raise_for_status()
        time.sleep(REQUEST_DELAY)
        return response

    def _post(self, url: str, **kwargs) -> requests.Response:
        """Rate-limited POST isteği."""
        kwargs.setdefault("timeout", HTTP_TIMEOUT)
        response = self.session.post(url, **kwargs)
        response.raise_for_status()
        time.sleep(REQUEST_DELAY)
        return response

    @abstractmethod
    def scrape(self, tickers: List[str] | None = None) -> List[CalendarEvent]:
        """
        Takvim etkinliklerini kazıyıp CalendarEvent listesi döndürür.

        Args:
            tickers: Sadece belirli hisseler için çekmek isteniyorsa ticker listesi.
                     None ise tüm mevcut veriler çekilir.

        Returns:
            CalendarEvent listesi
        """
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} ({self.name})>"
