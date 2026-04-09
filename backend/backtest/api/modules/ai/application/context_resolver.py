from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from api.modules.ai.domain.models import AiRequestContext, AiSessionRecord


_TRANSLATION_TABLE = str.maketrans({
    "ç": "c",
    "ğ": "g",
    "ı": "i",
    "i": "i",
    "ö": "o",
    "ş": "s",
    "ü": "u",
    "Ç": "c",
    "Ğ": "g",
    "İ": "i",
    "I": "i",
    "Ö": "o",
    "Ş": "s",
    "Ü": "u",
})

_TIMEFRAME_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b1\s*(?:m|dk|dakika)\b"), "1m"),
    (re.compile(r"\b5\s*(?:m|dk|dakika)\b"), "5m"),
    (re.compile(r"\b15\s*(?:m|dk|dakika)\b"), "15m"),
    (re.compile(r"\b1\s*(?:h|saat)\b|\b1\s*saatlik\b|\bsaatlik\b"), "1h"),
    (re.compile(r"\b4\s*(?:h|saat)\b|\b4\s*saatlik\b"), "4h"),
    (re.compile(r"\b1\s*(?:d|gun|gün)\b|\bgunluk\b|\bgunlük\b"), "1d"),
    (re.compile(r"\b1\s*(?:w|hafta)\b|\bhaftalik\b|\bhaftalık\b"), "1w"),
    (re.compile(r"\b1\s*(?:mo|ay)\b|\baylik\b|\baylık\b"), "1M"),
]

_COMPANY_ALIASES = {
    "turk hava yollari": "THYAO.IS",
    "turk hava yollari hissesi": "THYAO.IS",
    "thyao": "THYAO.IS",
    "akbank": "AKBNK.IS",
    "aselsan": "ASELS.IS",
    "ase lsan": "ASELS.IS",
    "eregli": "EREGL.IS",
    "eregli demir celik": "EREGL.IS",
    "tupras": "TUPRS.IS",
    "tupras hissesi": "TUPRS.IS",
    "garanti": "GARAN.IS",
    "garan": "GARAN.IS",
    "bim": "BIMAS.IS",
    "bimas": "BIMAS.IS",
}

_STOPWORDS = {
    "bist",
    "borsa",
    "rsi",
    "macd",
    "ema",
    "sma",
    "atr",
    "analiz",
    "analizi",
    "analizini",
    "teknik",
    "temel",
    "hisse",
    "hissesi",
    "hisselerde",
    "nasil",
    "durumda",
    "yazdim",
    "yok",
    "var",
    "tamam",
    "evet",
    "hayir",
    "hayır",
    "saat",
    "gun",
    "gün",
    "hafta",
    "ay",
    "backtest",
    "strateji",
    "rule",
    "kural",
    "indicator",
    "indikator",
    "indikatör",
    "destek",
    "direnc",
    "direnç",
    "trend",
    "fiyat",
    "veri",
    "yap",
    "icin",
    "için",
    "ile",
}

_TOKEN_PATTERN = re.compile(r"\b[a-z]{4,6}(?:\.is)?\b")


def resolve_request_context(
    *,
    session: AiSessionRecord,
    incoming: AiRequestContext,
    user_message: str,
) -> AiRequestContext:
    previous = AiRequestContext.model_validate(session.working_context or {})
    resolved = previous.model_copy(deep=True)

    resolved.user_id = incoming.user_id or previous.user_id or "demo"
    resolved.auto_save_drafts = incoming.auto_save_drafts

    if incoming.ticker:
        resolved.ticker = _canonicalize_ticker(incoming.ticker)
        if not incoming.selected_symbols:
            resolved.selected_symbols = [resolved.ticker]
    if incoming.timeframe:
        resolved.timeframe = incoming.timeframe
    if incoming.indicator_id:
        resolved.indicator_id = incoming.indicator_id
    if incoming.active_blueprint:
        resolved.active_blueprint = incoming.active_blueprint
    if incoming.selected_symbols:
        resolved.selected_symbols = _normalize_symbol_list(incoming.selected_symbols)
        if len(resolved.selected_symbols) == 1:
            resolved.ticker = resolved.selected_symbols[0]

    inferred_ticker = infer_ticker(user_message)
    inferred_timeframe = infer_timeframe(user_message)
    inferred_symbols = infer_symbol_list(user_message)

    if inferred_symbols:
        resolved.selected_symbols = inferred_symbols
        if len(inferred_symbols) == 1:
            resolved.ticker = inferred_symbols[0]

    if inferred_ticker:
        resolved.ticker = inferred_ticker
        resolved.selected_symbols = [inferred_ticker]

    if inferred_timeframe:
        resolved.timeframe = inferred_timeframe

    return resolved


def infer_ticker(message: str) -> str | None:
    normalized = _normalize_text(message)
    for alias, ticker in _COMPANY_ALIASES.items():
        if alias in normalized:
            return ticker

    known_tickers = _known_tickers()
    original_tokens = re.findall(r"\b[A-Za-zÇĞİÖŞÜçğıöşü]{3,8}(?:\.IS|\.is)?\b", message)
    normalized_tokens = _TOKEN_PATTERN.findall(normalized)

    candidates: list[str] = []
    for token in original_tokens:
        canonical = _canonicalize_ticker(token)
        base = canonical.removesuffix(".IS")
        if base.lower() in _STOPWORDS:
            continue
        if canonical in known_tickers and (token.upper().endswith(".IS") or token.isupper()):
            candidates.append(canonical)

    if not candidates:
        for token in normalized_tokens:
            base = token.removesuffix(".is")
            if base in _STOPWORDS:
                continue
            canonical = _canonicalize_ticker(base)
            if canonical in known_tickers:
                candidates.append(canonical)

    return candidates[0] if candidates else None


def infer_symbol_list(message: str) -> list[str]:
    normalized = _normalize_text(message)
    matches: list[str] = []

    for alias, ticker in _COMPANY_ALIASES.items():
        if alias in normalized and ticker not in matches:
            matches.append(ticker)

    known_tickers = _known_tickers()
    original_tokens = re.findall(r"\b[A-Za-zÇĞİÖŞÜçğıöşü]{3,8}(?:\.IS|\.is)?\b", message)
    normalized_tokens = _TOKEN_PATTERN.findall(normalized)

    for token in original_tokens:
        canonical = _canonicalize_ticker(token)
        base = canonical.removesuffix(".IS")
        if base.lower() in _STOPWORDS:
            continue
        if canonical in known_tickers and (token.upper().endswith(".IS") or token.isupper()) and canonical not in matches:
            matches.append(canonical)

    for token in normalized_tokens:
        base = token.removesuffix(".is")
        if base in _STOPWORDS:
            continue
        canonical = _canonicalize_ticker(base)
        if canonical in known_tickers and canonical not in matches:
            matches.append(canonical)

    return matches


def infer_timeframe(message: str) -> str | None:
    normalized = _normalize_text(message)
    for pattern, timeframe in _TIMEFRAME_PATTERNS:
        if pattern.search(normalized):
            return timeframe
    return None


def _normalize_symbol_list(symbols: Iterable[str]) -> list[str]:
    seen: list[str] = []
    for symbol in symbols:
        canonical = _canonicalize_ticker(symbol)
        if not canonical or canonical in seen:
            continue
        seen.append(canonical)
    return seen


def _canonicalize_ticker(value: str) -> str:
    raw = value.strip().upper()
    if not raw:
        return ""
    return raw if raw.endswith(".IS") else f"{raw}.IS"


def _normalize_text(value: str) -> str:
    lowered = value.translate(_TRANSLATION_TABLE).lower()
    return re.sub(r"[^a-z0-9.\s]+", " ", lowered)


@lru_cache(maxsize=1)
def _known_tickers() -> set[str]:
    tickers: set[str] = set()
    cache_roots = [
        Path("/Users/aliberkyesilduman/backtest/.bist_cache_pro"),
        Path("/Users/aliberkyesilduman/backtest/.bist_cache"),
    ]

    for root in cache_roots:
        if not root.exists():
            continue
        for path in root.glob("*_IS.meta.json"):
            symbol = path.name.removesuffix(".meta.json").replace("_", ".")
            if symbol.endswith(".IS"):
                tickers.add(symbol)

    return tickers
