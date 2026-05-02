#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
models.py — Takvim etkinliği veri modelleri

Tüm kazıyıcılar (scrapers) bu ortak veri yapısını kullanır.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional


@dataclass
class CalendarEvent:
    """BIST takvim etkinliğini temsil eden veri sınıfı."""

    ticker: str                         # Hisse kodu: THYAO, AKBNK, vb.
    event_date: datetime                # Etkinliğin tarihi
    event_type: str                     # BILANCO | TEMETTU | GENEL_KURUL | MAKRO
    event_title: str                    # Etkinlik açıklaması
    importance: int = 2                 # 1=Düşük, 2=Orta, 3=Yüksek
    source: str = ""                    # Veri kaynağı (isyatirim, kap, vb.)
    extra: Optional[str] = None         # Ek bilgi (JSON string olabilir)
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def event_id(self) -> str:
        """Benzersiz ID üret: THYAO-BILANCO-20240515"""
        date_str = self.event_date.strftime("%Y%m%d")
        return f"{self.ticker}-{self.event_type}-{date_str}"

    def to_dict(self) -> dict:
        """Oracle insert için dict olarak döndür."""
        return {
            "id": self.event_id,
            "ticker": self.ticker.upper(),
            "event_date": self.event_date,
            "event_type": self.event_type.upper(),
            "event_title": self.event_title[:255],
            "importance": max(1, min(3, self.importance)),
            "source": self.source[:100],
            "extra": (self.extra or "")[:1000],
            "created_at": self.created_at,
            "updated_at": datetime.now(),
        }

    def to_api_json(self) -> dict:
        """Frontend CalendarView bileşeninin beklediği JSON formatına dönüştür."""
        return {
            "id": self.event_id,
            "date": self.event_date.isoformat(),
            "country": "TRY",
            "countryCode": "TR",
            "event": self.event_title,
            "actual": None,
            "forecast": None,
            "previous": None,
            "unit": "",
            "importance": self.importance,
        }

    def __repr__(self) -> str:
        return (
            f"CalendarEvent({self.ticker} | {self.event_type} | "
            f"{self.event_date.strftime('%Y-%m-%d')} | {self.event_title})"
        )
