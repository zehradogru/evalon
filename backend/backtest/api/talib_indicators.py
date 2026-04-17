from __future__ import annotations

from typing import Dict, List,  Union, Optional, Any

import numpy as np
import pandas as pd


class TalibUnavailableError(RuntimeError):
    pass


INDICATOR_CATALOG: List[Dict[str, str]] = [
    {"id": "sma", "label": "SMA"},
    {"id": "ema", "label": "EMA"},
    {"id": "wma", "label": "WMA"},
    {"id": "dema", "label": "DEMA"},
    {"id": "tema", "label": "TEMA"},
    {"id": "trima", "label": "TRIMA"},
    {"id": "kama", "label": "KAMA"},
    {"id": "t3", "label": "T3"},
    {"id": "bbands", "label": "Bollinger Bands"},
    {"id": "rsi", "label": "RSI"},
    {"id": "stoch", "label": "Stochastic"},
    {"id": "stochrsi", "label": "Stoch RSI"},
    {"id": "cci", "label": "CCI"},
    {"id": "adx", "label": "ADX"},
    {"id": "adxr", "label": "ADXR"},
    {"id": "macd", "label": "MACD"},
    {"id": "apo", "label": "APO"},
    {"id": "ppo", "label": "PPO"},
    {"id": "mfi", "label": "MFI"},
    {"id": "willr", "label": "Williams %R"},
    {"id": "roc", "label": "ROC"},
    {"id": "mom", "label": "MOM"},
    {"id": "ultosc", "label": "Ultimate Oscillator"},
    {"id": "atr", "label": "ATR"},
    {"id": "natr", "label": "NATR"},
    {"id": "obv", "label": "OBV"},
    {"id": "ad", "label": "Chaikin A/D"},
    {"id": "adosc", "label": "Chaikin Oscillator"},
    {"id": "aroon", "label": "Aroon"},
    {"id": "aroonosc", "label": "Aroon Oscillator"},
]

_CATALOG_BY_ID = {item["id"]: item for item in INDICATOR_CATALOG}


def supported_indicator_ids() -> List[str]:
    return [item["id"] for item in INDICATOR_CATALOG]


def normalize_indicator_key(value: str) -> str:
    key = value.lower().strip()
    key = key.replace(" ", "").replace("-", "").replace("_", "")
    aliases = {
        "bollingerbands": "bbands",
        "bollinger": "bbands",
        "stochastic": "stoch",
        "williamsr": "willr",
        "williams%r": "willr",
        "ultimateoscillator": "ultosc",
        "chaikinad": "ad",
        "chaikinoscillator": "adosc",
        "arron": "aroon",
    }
    if key in _CATALOG_BY_ID:
        return key
    if key in aliases:
        return aliases[key]
    raise ValueError(f"Unknown indicator: {value}")


def build_indicator_series(
    ohlcv: pd.DataFrame,
    strategy: str,
    params: Dict[str, Any],
) -> List[Dict[str, Any]]:
    talib = _require_talib()
    key = normalize_indicator_key(strategy)

    close = ohlcv["close"].astype(float).to_numpy()
    open_ = ohlcv["open"].astype(float).to_numpy()
    high = ohlcv["high"].astype(float).to_numpy()
    low = ohlcv["low"].astype(float).to_numpy()
    volume = ohlcv["volume"].astype(float).to_numpy()
    idx = ohlcv.index

    period = _int_param(params, "period", 14, min_value=1)
    fast = _int_param(params, "fast", 12, min_value=1)
    slow = _int_param(params, "slow", 26, min_value=2)
    signal = _int_param(params, "signal", 9, min_value=1)

    if key == "sma":
        values = talib.SMA(close, timeperiod=period)
        return [_line_series(f"SMA ({period})", idx, values, panel=0, color="#f59e0b")]

    if key == "ema":
        values = talib.EMA(close, timeperiod=period)
        return [_line_series(f"EMA ({period})", idx, values, panel=0, color="#10b981")]

    if key == "wma":
        values = talib.WMA(close, timeperiod=period)
        return [_line_series(f"WMA ({period})", idx, values, panel=0, color="#3b82f6")]

    if key == "dema":
        values = talib.DEMA(close, timeperiod=period)
        return [_line_series(f"DEMA ({period})", idx, values, panel=0, color="#6366f1")]

    if key == "tema":
        values = talib.TEMA(close, timeperiod=period)
        return [_line_series(f"TEMA ({period})", idx, values, panel=0, color="#8b5cf6")]

    if key == "trima":
        values = talib.TRIMA(close, timeperiod=period)
        return [_line_series(f"TRIMA ({period})", idx, values, panel=0, color="#14b8a6")]

    if key == "kama":
        values = talib.KAMA(close, timeperiod=period)
        return [_line_series(f"KAMA ({period})", idx, values, panel=0, color="#22c55e")]

    if key == "t3":
        vfactor = _float_param(params, "vfactor", 0.7, min_value=0.0, max_value=1.0)
        values = talib.T3(close, timeperiod=period, vfactor=vfactor)
        return [_line_series(f"T3 ({period})", idx, values, panel=0, color="#a855f7")]

    if key == "bbands":
        std_up = _float_param(params, "std_up", 2.0, min_value=0.1, max_value=10.0)
        std_dn = _float_param(params, "std_dn", 2.0, min_value=0.1, max_value=10.0)
        upper, middle, lower = talib.BBANDS(
            close,
            timeperiod=period,
            nbdevup=std_up,
            nbdevdn=std_dn,
            matype=0,
        )
        return [
            _line_series(f"BB Upper ({period})", idx, upper, panel=0, color="#ef4444", width=1),
            _line_series(f"BB Middle ({period})", idx, middle, panel=0, color="#f59e0b", width=1),
            _line_series(f"BB Lower ({period})", idx, lower, panel=0, color="#22c55e", width=1),
        ]

    if key == "rsi":
        values = talib.RSI(close, timeperiod=period)
        return [
            _line_series(f"RSI ({period})", idx, values, panel=1, color="#be185d"),
            _constant_line("RSI 70", idx, 70.0, panel=1, color="#9ca3af"),
            _constant_line("RSI 30", idx, 30.0, panel=1, color="#9ca3af"),
        ]

    if key == "stoch":
        k_period = _int_param(params, "k_period", 14, min_value=1)
        d_period = _int_param(params, "d_period", 3, min_value=1)
        slowk, slowd = talib.STOCH(
            high,
            low,
            close,
            fastk_period=k_period,
            slowk_period=d_period,
            slowk_matype=0,
            slowd_period=d_period,
            slowd_matype=0,
        )
        return [
            _line_series("STOCH %K", idx, slowk, panel=1, color="#3b82f6"),
            _line_series("STOCH %D", idx, slowd, panel=1, color="#f97316"),
        ]

    if key == "stochrsi":
        k_period = _int_param(params, "k_period", 5, min_value=1)
        d_period = _int_param(params, "d_period", 3, min_value=1)
        fastk, fastd = talib.STOCHRSI(
            close,
            timeperiod=period,
            fastk_period=k_period,
            fastd_period=d_period,
            fastd_matype=0,
        )
        return [
            _line_series("STOCH RSI %K", idx, fastk, panel=1, color="#3b82f6"),
            _line_series("STOCH RSI %D", idx, fastd, panel=1, color="#f97316"),
        ]

    if key == "cci":
        values = talib.CCI(high, low, close, timeperiod=period)
        return [_line_series(f"CCI ({period})", idx, values, panel=1, color="#06b6d4")]

    if key == "adx":
        values = talib.ADX(high, low, close, timeperiod=period)
        return [_line_series(f"ADX ({period})", idx, values, panel=1, color="#f59e0b")]

    if key == "adxr":
        values = talib.ADXR(high, low, close, timeperiod=period)
        return [_line_series(f"ADXR ({period})", idx, values, panel=1, color="#f59e0b")]

    if key == "macd":
        macd, macd_signal, macd_hist = talib.MACD(
            close,
            fastperiod=fast,
            slowperiod=slow,
            signalperiod=signal,
        )
        return [
            _line_series(f"MACD ({fast},{slow})", idx, macd, panel=1, color="#3b82f6"),
            _line_series(f"Signal ({signal})", idx, macd_signal, panel=1, color="#f97316"),
            _hist_series("MACD Histogram", idx, macd_hist, panel=1),
        ]

    if key == "apo":
        values = talib.APO(close, fastperiod=fast, slowperiod=slow, matype=0)
        return [_line_series(f"APO ({fast},{slow})", idx, values, panel=1, color="#4f46e5")]

    if key == "ppo":
        values = talib.PPO(close, fastperiod=fast, slowperiod=slow, matype=0)
        return [_line_series(f"PPO ({fast},{slow})", idx, values, panel=1, color="#4f46e5")]

    if key == "mfi":
        values = talib.MFI(high, low, close, volume, timeperiod=period)
        return [_line_series(f"MFI ({period})", idx, values, panel=1, color="#10b981")]

    if key == "willr":
        values = talib.WILLR(high, low, close, timeperiod=period)
        return [_line_series(f"Williams %R ({period})", idx, values, panel=1, color="#ef4444")]

    if key == "roc":
        values = talib.ROC(close, timeperiod=period)
        return [_line_series(f"ROC ({period})", idx, values, panel=1, color="#3b82f6")]

    if key == "mom":
        values = talib.MOM(close, timeperiod=period)
        return [_line_series(f"MOM ({period})", idx, values, panel=1, color="#a855f7")]

    if key == "ultosc":
        p1 = _int_param(params, "period1", 7, min_value=1)
        p2 = _int_param(params, "period2", 14, min_value=1)
        p3 = _int_param(params, "period3", 28, min_value=1)
        values = talib.ULTOSC(
            high,
            low,
            close,
            timeperiod1=p1,
            timeperiod2=p2,
            timeperiod3=p3,
        )
        return [_line_series(f"ULTOSC ({p1},{p2},{p3})", idx, values, panel=1, color="#f59e0b")]

    if key == "atr":
        values = talib.ATR(high, low, close, timeperiod=period)
        return [_line_series(f"ATR ({period})", idx, values, panel=1, color="#14b8a6")]

    if key == "natr":
        values = talib.NATR(high, low, close, timeperiod=period)
        return [_line_series(f"NATR ({period})", idx, values, panel=1, color="#14b8a6")]

    if key == "obv":
        values = talib.OBV(close, volume)
        return [_line_series("OBV", idx, values, panel=1, color="#f59e0b")]

    if key == "ad":
        values = talib.AD(high, low, close, volume)
        return [_line_series("Chaikin A/D", idx, values, panel=1, color="#22c55e")]

    if key == "adosc":
        fast_ad = _int_param(params, "fast", 3, min_value=1)
        slow_ad = _int_param(params, "slow", 10, min_value=2)
        values = talib.ADOSC(high, low, close, volume, fastperiod=fast_ad, slowperiod=slow_ad)
        return [_line_series(f"Chaikin Osc ({fast_ad},{slow_ad})", idx, values, panel=1, color="#3b82f6")]

    if key == "aroon":
        aroon_down, aroon_up = talib.AROON(high, low, timeperiod=period)
        return [
            _line_series(f"Aroon Up ({period})", idx, aroon_up, panel=1, color="#22c55e"),
            _line_series(f"Aroon Down ({period})", idx, aroon_down, panel=1, color="#ef4444"),
        ]

    if key == "aroonosc":
        values = talib.AROONOSC(high, low, timeperiod=period)
        return [_line_series(f"Aroon Osc ({period})", idx, values, panel=1, color="#3b82f6")]

    raise ValueError(f"Unknown indicator: {strategy}")


def _line_series(
    name: str,
    idx: pd.Index,
    values: np.ndarray,
    panel: int,
    color: str,
    width: int = 2,
    line_style: int = 0,
) -> Dict[str, Any]:
    data = _points(idx, values)
    return {
        "name": name,
        "type": "line",
        "panel": panel,
        "data": data,
        "options": {"color": color, "lineWidth": width, "lineStyle": line_style},
    }


def _hist_series(
    name: str,
    idx: pd.Index,
    values: np.ndarray,
    panel: int,
) -> Dict[str, Any]:
    data = _points(idx, values, color_by_sign=True)
    return {
        "name": name,
        "type": "histogram",
        "panel": panel,
        "data": data,
        "options": {},
    }


def _constant_line(
    name: str,
    idx: pd.Index,
    value: float,
    panel: int,
    color: str,
) -> Dict[str, Any]:
    data = [{"time": _time_value(ts), "value": float(value)} for ts in idx]
    return {
        "name": name,
        "type": "line",
        "panel": panel,
        "data": data,
        "options": {"color": color, "lineWidth": 1, "lineStyle": 2},
    }


def _points(
    idx: pd.Index,
    values: np.ndarray,
    color_by_sign: bool = False,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for ts, raw in zip(idx, values):
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue
        if not np.isfinite(val):
            continue

        point: Dict[str, Any] = {"time": _time_value(ts), "value": val}
        if color_by_sign:
            point["color"] = "#22c55e" if val >= 0 else "#ef4444"
        out.append(point)
    return out


def _time_value(ts: Any) -> Any:
    if hasattr(ts, "to_pydatetime"):
        return ts.to_pydatetime()
    try:
        return pd.Timestamp(ts).to_pydatetime()
    except Exception:
        return ts


def _int_param(
    params: Dict[str, Any],
    key: str,
    default: int,
    min_value: int,
    max_value: int = 10_000,
) -> int:
    raw = params.get(key)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, value))


def _float_param(
    params: Dict[str, Any],
    key: str,
    default: float,
    min_value: float,
    max_value: float,
) -> float:
    raw = params.get(key)
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(max_value, value))


def _require_talib():
    try:
        import talib
    except Exception as exc:  # pragma: no cover
        raise TalibUnavailableError(
            "TA-Lib is not installed. Run: pip install TA-Lib"
        ) from exc
    return talib
