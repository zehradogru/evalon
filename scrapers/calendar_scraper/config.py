#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
config.py — Merkezi yapılandırma modülü

Tüm ortam değişkenleri, sabit değerler ve yol tanımları burada tutulur.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# .env dosyasını yükle
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Oracle DB
# ---------------------------------------------------------------------------

DB_USER     = os.environ.get("ORACLE_DB_USER", "ADMIN")
DB_PASSWORD = os.environ.get("ORACLE_DB_PASSWORD")
DB_DSN      = os.environ.get("ORACLE_DB_DSN", "evalondb_high")
WALLET_DIR  = os.environ.get("ORACLE_WALLET_DIR", "../news_scraper/oracle_wallet")

# ---------------------------------------------------------------------------
# BIST Ticker listesi (news_scraper ile aynı kaynak)
# ---------------------------------------------------------------------------

def load_tickers() -> List[str]:
    """bist_tickers.json dosyasından sembolleri oku."""
    # Önce calendar_scraper klasöründe ara, yoksa news_scraper'dan oku
    candidates = [
        ROOT_DIR / "bist_tickers.json",
        ROOT_DIR.parent / "news_scraper" / "bist_tickers.json",
    ]
    for json_path in candidates:
        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    tickers = data.get("tr", [])
                    print(f"[config] {len(tickers)} ticker yüklendi ({json_path.name})")
                    return tickers
            except Exception as e:
                print(f"[config] Uyarı: {json_path} okunurken hata: {e}")
    print("[config] Uyarı: bist_tickers.json bulunamadı! Boş liste.")
    return []

BIST_TICKERS: List[str] = load_tickers()

# ---------------------------------------------------------------------------
# Scraper ayarları
# ---------------------------------------------------------------------------

# İstekler arası bekleme süresi (saniye) — sunuculara yük bindirmemek için
REQUEST_DELAY = float(os.environ.get("REQUEST_DELAY", "1.5"))

# HTTP isteklerinde kullanılacak User-Agent
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# HTTP timeout (saniye)
HTTP_TIMEOUT = 15
