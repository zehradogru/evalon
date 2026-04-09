from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import sqrt
from typing import Any


Candle = dict[str, float | int]


@dataclass
class RuleMask:
    long: list[bool]
    short: list[bool]


def create_empty_mask(length: int) -> RuleMask:
    return RuleMask(long=[False] * length, short=[False] * length)


def evaluate_rising_structure(bars: list[Candle], lookback: int) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(lookback, len(bars)):
        start = i - lookback
        split = start + max(1, lookback // 2)
        first_low = min_low(bars, start, split)
        second_low = min_low(bars, split, i + 1)
        first_high = max_high(bars, start, split)
        second_high = max_high(bars, split, i + 1)
        out.long[i] = second_low > first_low and second_high > first_high and float(bars[i]["c"]) > float(bars[split]["c"])
    return out


def evaluate_falling_structure(bars: list[Candle], lookback: int) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(lookback, len(bars)):
        start = i - lookback
        split = start + max(1, lookback // 2)
        first_low = min_low(bars, start, split)
        second_low = min_low(bars, split, i + 1)
        first_high = max_high(bars, start, split)
        second_high = max_high(bars, split, i + 1)
        out.short[i] = second_low < first_low and second_high < first_high and float(bars[i]["c"]) < float(bars[split]["c"])
    return out


def evaluate_ema_stack(bars: list[Candle], fast_period: int, slow_period: int) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    safe_fast = min(fast_period, max(2, slow_period - 1))
    safe_slow = max(slow_period, safe_fast + 1)
    fast = ema(closes, safe_fast)
    slow = ema(closes, safe_slow)
    out = create_empty_mask(len(bars))
    for i, bar in enumerate(bars):
        close = float(bar["c"])
        out.long[i] = close > fast[i] and fast[i] > slow[i]
        out.short[i] = close < fast[i] and fast[i] < slow[i]
    return out


def evaluate_ema_cross(bars: list[Candle], fast_period: int, slow_period: int) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    safe_fast = min(fast_period, max(2, slow_period - 1))
    safe_slow = max(slow_period, safe_fast + 1)
    fast = ema(closes, safe_fast)
    slow = ema(closes, safe_slow)
    out = create_empty_mask(len(bars))
    for i in range(1, len(bars)):
        out.long[i] = fast[i - 1] < slow[i - 1] and fast[i] >= slow[i]
        out.short[i] = fast[i - 1] > slow[i - 1] and fast[i] <= slow[i]
    return out


def evaluate_ma_ribbon(bars: list[Candle], fast_period: int, mid_period: int, slow_period: int) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    fast = ema(closes, fast_period)
    mid = ema(closes, max(mid_period, fast_period + 1))
    slow = ema(closes, max(slow_period, mid_period + 1))
    out = create_empty_mask(len(bars))
    for i in range(1, len(bars)):
        rising = fast[i] > fast[i - 1] and mid[i] > mid[i - 1] and slow[i] > slow[i - 1]
        falling = fast[i] < fast[i - 1] and mid[i] < mid[i - 1] and slow[i] < slow[i - 1]
        out.long[i] = fast[i] > mid[i] and mid[i] > slow[i] and rising
        out.short[i] = fast[i] < mid[i] and mid[i] < slow[i] and falling
    return out


def evaluate_rsi_regime(bars: list[Candle], period: int, level: float) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    values = compute_rsi(closes, period)
    short_threshold = clamp_number(100 - level, 50, 1, 99)
    out = create_empty_mask(len(bars))
    for i in range(len(bars)):
        out.long[i] = values[i] >= level
        out.short[i] = values[i] <= short_threshold
    return out


def evaluate_rsi_reclaim(bars: list[Candle], period: int, lower: float, upper: float) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    values = compute_rsi(closes, period)
    out = create_empty_mask(len(bars))
    for i in range(1, len(bars)):
        out.long[i] = values[i - 1] < lower and values[i] >= lower
        out.short[i] = values[i - 1] > upper and values[i] <= upper
    return out


def evaluate_breakout(bars: list[Candle], lookback: int, buffer_pct: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    buffer = buffer_pct / 100
    for i in range(lookback, len(bars)):
        prior_high = max_high(bars, i - lookback, i)
        prior_low = min_low(bars, i - lookback, i)
        close = float(bars[i]["c"])
        out.long[i] = close >= prior_high * (1 + buffer)
        out.short[i] = close <= prior_low * (1 - buffer)
    return out


def evaluate_donchian_breakout(bars: list[Candle], lookback: int) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(lookback, len(bars)):
        prior_high = max_high(bars, i - lookback, i)
        prior_low = min_low(bars, i - lookback, i)
        close = float(bars[i]["c"])
        out.long[i] = close > prior_high
        out.short[i] = close < prior_low
    return out


def evaluate_pullback(bars: list[Candle], ema_period: int, tolerance_pct: float) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    ema_line = ema(closes, ema_period)
    tolerance = tolerance_pct / 100
    out = create_empty_mask(len(bars))
    for i, bar in enumerate(bars):
        level = ema_line[i]
        if level == 0:
            continue
        long_touch = abs(float(bar["l"]) - level) / level <= tolerance
        short_touch = abs(float(bar["h"]) - level) / level <= tolerance
        close = float(bar["c"])
        out.long[i] = long_touch and close >= level
        out.short[i] = short_touch and close <= level
    return out


def evaluate_compression(bars: list[Candle], window_bars: int, range_pct: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(window_bars, len(bars)):
        high = max_high(bars, i - window_bars, i + 1)
        low = min_low(bars, i - window_bars, i + 1)
        close = max(1e-9, float(bars[i]["c"]))
        normalized_range = ((high - low) / close) * 100
        compressed = normalized_range <= range_pct
        out.long[i] = compressed
        out.short[i] = compressed
    return out


def evaluate_bollinger_squeeze(bars: list[Candle], period: int, deviation: float, width_pct: float) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    mid = sma(closes, period)
    out = create_empty_mask(len(bars))
    for i in range(period - 1, len(bars)):
        slice_values = closes[i - period + 1:i + 1]
        std = standard_deviation(slice_values)
        upper = mid[i] + std * deviation
        lower = mid[i] - std * deviation
        base = max(1e-9, mid[i])
        band_width_pct = ((upper - lower) / base) * 100
        squeezed = band_width_pct <= width_pct
        out.long[i] = squeezed
        out.short[i] = squeezed
    return out


def evaluate_fib_bounce(bars: list[Candle], lookback: int, upper_level: float, lower_level: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    high_level = min(upper_level, lower_level)
    low_level = max(upper_level, lower_level)
    for i in range(lookback, len(bars)):
        start = i - lookback
        swing_low = min_low(bars, start, i + 1)
        swing_high = max_high(bars, start, i + 1)
        range_value = max(1e-9, swing_high - swing_low)

        long_zone_top = swing_high - range_value * high_level
        long_zone_bottom = swing_high - range_value * low_level
        short_zone_bottom = swing_low + range_value * high_level
        short_zone_top = swing_low + range_value * low_level

        low = float(bars[i]["l"])
        high = float(bars[i]["h"])
        close = float(bars[i]["c"])
        open_price = float(bars[i]["o"])

        in_long_zone = low <= long_zone_top and low >= long_zone_bottom
        in_short_zone = high >= short_zone_bottom and high <= short_zone_top

        out.long[i] = in_long_zone and close > open_price and close >= long_zone_top
        out.short[i] = in_short_zone and close < open_price and close <= short_zone_bottom
    return out


def evaluate_support_hold(bars: list[Candle], lookback: int, tolerance_pct: float) -> RuleMask:
    tolerance = tolerance_pct / 100
    out = create_empty_mask(len(bars))
    for i in range(lookback, len(bars)):
        support = min_low(bars, i - lookback, i)
        resistance = max_high(bars, i - lookback, i)
        low = float(bars[i]["l"])
        high = float(bars[i]["h"])
        close = float(bars[i]["c"])
        open_price = float(bars[i]["o"])
        out.long[i] = abs(low - support) / support <= tolerance and close > support and close > open_price
        out.short[i] = abs(high - resistance) / resistance <= tolerance and close < resistance and close < open_price
    return out


def evaluate_sr_flip_retest(bars: list[Candle], lookback: int, tolerance_pct: float) -> RuleMask:
    tolerance = tolerance_pct / 100
    out = create_empty_mask(len(bars))
    for i in range(lookback + 1, len(bars)):
        resistance = max_high(bars, i - lookback - 1, i - 1)
        support = min_low(bars, i - lookback - 1, i - 1)
        previous_close = float(bars[i - 1]["c"])
        low = float(bars[i]["l"])
        high = float(bars[i]["h"])
        close = float(bars[i]["c"])
        long_broken = previous_close > resistance
        short_broken = previous_close < support
        out.long[i] = long_broken and low >= resistance * (1 - tolerance) and low <= resistance * (1 + tolerance) and close > resistance
        out.short[i] = short_broken and high >= support * (1 - tolerance) and high <= support * (1 + tolerance) and close < support
    return out


def evaluate_ascending_triangle(bars: list[Candle], window_bars: int, tolerance_pct: float) -> RuleMask:
    tolerance = tolerance_pct / 100
    out = create_empty_mask(len(bars))
    for i in range(window_bars, len(bars)):
        start = i - window_bars
        split = start + window_bars // 2
        first_high = max_high(bars, start, split)
        second_high = max_high(bars, split, i)
        first_low = min_low(bars, start, split)
        second_low = min_low(bars, split, i)

        resistance_flat = abs(second_high - first_high) / max(1e-9, first_high) <= tolerance
        support_flat = abs(second_low - first_low) / max(1e-9, first_low) <= tolerance
        close = float(bars[i]["c"])
        out.long[i] = resistance_flat and second_low > first_low and close > max(first_high, second_high)
        out.short[i] = support_flat and second_high < first_high and close < min(first_low, second_low)
    return out


def evaluate_double_bottom(bars: list[Candle], window_bars: int, tolerance_pct: float) -> RuleMask:
    tolerance = tolerance_pct / 100
    out = create_empty_mask(len(bars))
    for i in range(window_bars, len(bars)):
        start = i - window_bars
        first_low_info = find_lowest_bar(bars, start, start + int(window_bars * 0.45))
        second_low_info = find_lowest_bar(bars, start + int(window_bars * 0.55), i)
        first_high_info = find_highest_bar(bars, start, start + int(window_bars * 0.45))
        second_high_info = find_highest_bar(bars, start + int(window_bars * 0.55), i)
        neckline_high = max_high(bars, first_low_info["index"], second_low_info["index"] + 1)
        neckline_low = min_low(bars, first_high_info["index"], second_high_info["index"] + 1)

        lows_aligned = abs(first_low_info["value"] - second_low_info["value"]) / max(1e-9, first_low_info["value"]) <= tolerance
        highs_aligned = abs(first_high_info["value"] - second_high_info["value"]) / max(1e-9, first_high_info["value"]) <= tolerance
        close = float(bars[i]["c"])

        out.long[i] = lows_aligned and second_low_info["index"] > first_low_info["index"] and close > neckline_high
        out.short[i] = highs_aligned and second_high_info["index"] > first_high_info["index"] and close < neckline_low
    return out


def evaluate_bull_flag(bars: list[Candle], impulse_bars: int, pullback_bars: int, min_move_pct: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    total_bars = impulse_bars + pullback_bars
    for i in range(total_bars, len(bars)):
        impulse_start = i - total_bars
        impulse_end = i - pullback_bars
        impulse_start_close = float(bars[impulse_start]["c"])
        impulse_end_close = float(bars[impulse_end]["c"])
        last_pullback_close = float(bars[i - 1]["c"])
        impulse_move_pct = ((impulse_end_close - impulse_start_close) / impulse_start_close) * 100
        pullback_high = max_high(bars, impulse_end, i)
        pullback_low = min_low(bars, impulse_end, i)
        pullback_slope = last_pullback_close - impulse_end_close

        short_impulse_move_pct = ((impulse_start_close - impulse_end_close) / impulse_start_close) * 100
        short_pullback_slope = last_pullback_close - impulse_end_close
        close = float(bars[i]["c"])

        out.long[i] = (
            impulse_move_pct >= min_move_pct
            and pullback_slope < 0
            and close > pullback_high
            and pullback_low > impulse_start_close
        )
        out.short[i] = (
            short_impulse_move_pct >= min_move_pct
            and short_pullback_slope > 0
            and close < pullback_low
            and pullback_high < impulse_start_close
        )
    return out


def evaluate_rectangle_breakout(bars: list[Candle], window_bars: int, range_pct: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(window_bars, len(bars)):
        prior_high = max_high(bars, i - window_bars, i)
        prior_low = min_low(bars, i - window_bars, i)
        prev_close = max(1e-9, float(bars[i - 1]["c"]))
        normalized_range = ((prior_high - prior_low) / prev_close) * 100
        base_ready = normalized_range <= range_pct
        close = float(bars[i]["c"])
        out.long[i] = base_ready and close > prior_high
        out.short[i] = base_ready and close < prior_low
    return out


def evaluate_trend_slope(bars: list[Candle], lookback: int, min_move_pct: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(lookback, len(bars)):
        start_close = max(1e-9, float(bars[i - lookback]["c"]))
        move_pct = ((float(bars[i]["c"]) - start_close) / start_close) * 100
        out.long[i] = move_pct >= min_move_pct
        out.short[i] = move_pct <= -min_move_pct
    return out


def evaluate_channel_trend(bars: list[Candle], lookback: int) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(lookback, len(bars)):
        high = max_high(bars, i - lookback, i + 1)
        low = min_low(bars, i - lookback, i + 1)
        mid = low + (high - low) / 2
        older_low = min_low(bars, i - lookback, i - (lookback // 2))
        newer_low = min_low(bars, i - (lookback // 2), i + 1)
        older_high = max_high(bars, i - lookback, i - (lookback // 2))
        newer_high = max_high(bars, i - (lookback // 2), i + 1)
        close = float(bars[i]["c"])
        out.long[i] = close > mid and newer_low > older_low and newer_high >= older_high
        out.short[i] = close < mid and newer_high < older_high and newer_low <= older_low
    return out


def evaluate_adx_dmi_trend(
    bars: list[Candle],
    period: int,
    trend_threshold: float,
    min_di_spread: float,
) -> RuleMask:
    tr = compute_true_range(bars)
    plus_dm = [0.0] * len(bars)
    minus_dm = [0.0] * len(bars)
    for i in range(1, len(bars)):
        up_move = float(bars[i]["h"]) - float(bars[i - 1]["h"])
        down_move = float(bars[i - 1]["l"]) - float(bars[i]["l"])
        plus_dm[i] = up_move if up_move > down_move and up_move > 0 else 0.0
        minus_dm[i] = down_move if down_move > up_move and down_move > 0 else 0.0

    smoothed_tr = wilder_smoothing(tr, period)
    smoothed_plus = wilder_smoothing(plus_dm, period)
    smoothed_minus = wilder_smoothing(minus_dm, period)
    plus_di = [0.0] * len(bars)
    minus_di = [0.0] * len(bars)
    dx = [0.0] * len(bars)
    for i in range(period - 1, len(bars)):
        if smoothed_tr[i] <= 0:
            continue
        plus_di[i] = (smoothed_plus[i] / smoothed_tr[i]) * 100
        minus_di[i] = (smoothed_minus[i] / smoothed_tr[i]) * 100
        total_di = plus_di[i] + minus_di[i]
        dx[i] = 0.0 if total_di == 0 else (abs(plus_di[i] - minus_di[i]) / total_di) * 100

    adx = smooth_directional_index(dx, period)
    out = create_empty_mask(len(bars))
    for i in range((period * 2) - 2, len(bars)):
        long_spread = plus_di[i] - minus_di[i]
        short_spread = minus_di[i] - plus_di[i]
        adx_rising = i == 0 or adx[i] >= adx[i - 1]
        out.long[i] = adx[i] >= trend_threshold and long_spread >= min_di_spread and adx_rising
        out.short[i] = adx[i] >= trend_threshold and short_spread >= min_di_spread and adx_rising
    return out


def evaluate_aroon_trend(
    bars: list[Candle],
    period: int,
    strong_level: float,
    weak_level: float,
) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(period - 1, len(bars)):
        start = i - period + 1
        highest_index = start
        lowest_index = start
        for j in range(start, i + 1):
            if float(bars[j]["h"]) >= float(bars[highest_index]["h"]):
                highest_index = j
            if float(bars[j]["l"]) <= float(bars[lowest_index]["l"]):
                lowest_index = j

        days_since_high = i - highest_index
        days_since_low = i - lowest_index
        aroon_up = ((period - days_since_high) / period) * 100
        aroon_down = ((period - days_since_low) / period) * 100
        out.long[i] = aroon_up >= strong_level and aroon_down <= weak_level and aroon_up > aroon_down
        out.short[i] = aroon_down >= strong_level and aroon_up <= weak_level and aroon_down > aroon_up
    return out


def evaluate_ichimoku_cloud_trend(
    bars: list[Candle],
    conversion_period: int,
    base_period: int,
    span_b_period: int,
    displacement: int,
) -> RuleMask:
    conversion_line = [0.0] * len(bars)
    base_line = [0.0] * len(bars)
    leading_span_a_raw: list[float | None] = [None] * len(bars)
    leading_span_b_raw: list[float | None] = [None] * len(bars)

    for i in range(len(bars)):
        if i >= conversion_period - 1:
            conversion_line[i] = (
                max_high(bars, i - conversion_period + 1, i + 1)
                + min_low(bars, i - conversion_period + 1, i + 1)
            ) / 2
        if i >= base_period - 1:
            base_line[i] = (
                max_high(bars, i - base_period + 1, i + 1)
                + min_low(bars, i - base_period + 1, i + 1)
            ) / 2
        if conversion_line[i] and base_line[i]:
            leading_span_a_raw[i] = (conversion_line[i] + base_line[i]) / 2
        if i >= span_b_period - 1:
            leading_span_b_raw[i] = (
                max_high(bars, i - span_b_period + 1, i + 1)
                + min_low(bars, i - span_b_period + 1, i + 1)
            ) / 2

    out = create_empty_mask(len(bars))
    for i in range(displacement, len(bars)):
        cloud_index = i - displacement
        span_a = leading_span_a_raw[cloud_index]
        span_b = leading_span_b_raw[cloud_index]
        if span_a is None or span_b is None or conversion_line[i] == 0 or base_line[i] == 0:
            continue
        close = float(bars[i]["c"])
        cloud_top = max(span_a, span_b)
        cloud_bottom = min(span_a, span_b)
        out.long[i] = close > cloud_top and span_a > span_b and conversion_line[i] > base_line[i]
        out.short[i] = close < cloud_bottom and span_a < span_b and conversion_line[i] < base_line[i]
    return out


def evaluate_vortex_trend(
    bars: list[Candle],
    period: int,
    min_spread: float,
) -> RuleMask:
    tr = compute_true_range(bars)
    positive_vm = [0.0] * len(bars)
    negative_vm = [0.0] * len(bars)
    for i in range(1, len(bars)):
        positive_vm[i] = abs(float(bars[i]["h"]) - float(bars[i - 1]["l"]))
        negative_vm[i] = abs(float(bars[i]["l"]) - float(bars[i - 1]["h"]))

    out = create_empty_mask(len(bars))
    for i in range(period, len(bars)):
        start = i - period + 1
        tr_sum = sum(tr[start:i + 1])
        if tr_sum <= 0:
            continue
        vi_plus = sum(positive_vm[start:i + 1]) / tr_sum
        vi_minus = sum(negative_vm[start:i + 1]) / tr_sum
        out.long[i] = vi_plus > vi_minus and (vi_plus - vi_minus) >= min_spread
        out.short[i] = vi_minus > vi_plus and (vi_minus - vi_plus) >= min_spread
    return out


def evaluate_supertrend_bias(
    bars: list[Candle],
    period: int,
    multiplier: float,
) -> RuleMask:
    atr = compute_atr(bars, period)
    basic_upper = [0.0] * len(bars)
    basic_lower = [0.0] * len(bars)
    final_upper = [0.0] * len(bars)
    final_lower = [0.0] * len(bars)
    supertrend = [0.0] * len(bars)
    out = create_empty_mask(len(bars))

    start = period - 1
    if start >= len(bars):
        return out

    for i in range(start, len(bars)):
        hl2 = (float(bars[i]["h"]) + float(bars[i]["l"])) / 2
        basic_upper[i] = hl2 + multiplier * atr[i]
        basic_lower[i] = hl2 - multiplier * atr[i]

    final_upper[start] = basic_upper[start]
    final_lower[start] = basic_lower[start]
    supertrend[start] = final_lower[start] if float(bars[start]["c"]) >= ((float(bars[start]["h"]) + float(bars[start]["l"])) / 2) else final_upper[start]
    out.long[start] = float(bars[start]["c"]) > supertrend[start]
    out.short[start] = float(bars[start]["c"]) < supertrend[start]

    for i in range(start + 1, len(bars)):
        previous_close = float(bars[i - 1]["c"])
        final_upper[i] = basic_upper[i] if basic_upper[i] < final_upper[i - 1] or previous_close > final_upper[i - 1] else final_upper[i - 1]
        final_lower[i] = basic_lower[i] if basic_lower[i] > final_lower[i - 1] or previous_close < final_lower[i - 1] else final_lower[i - 1]

        close = float(bars[i]["c"])
        if supertrend[i - 1] == final_upper[i - 1]:
            supertrend[i] = final_lower[i] if close > final_upper[i] else final_upper[i]
        else:
            supertrend[i] = final_upper[i] if close < final_lower[i] else final_lower[i]

        out.long[i] = supertrend[i] == final_lower[i] and close > supertrend[i]
        out.short[i] = supertrend[i] == final_upper[i] and close < supertrend[i]
    return out


def evaluate_psar_trend(
    bars: list[Candle],
    step: float,
    max_step: float,
) -> RuleMask:
    out = create_empty_mask(len(bars))
    if len(bars) < 2:
        return out

    highs = [float(bar["h"]) for bar in bars]
    lows = [float(bar["l"]) for bar in bars]
    closes = [float(bar["c"]) for bar in bars]
    sar = [0.0] * len(bars)

    uptrend = closes[1] >= closes[0]
    acceleration_factor = step
    extreme_point = highs[0] if uptrend else lows[0]
    sar[0] = lows[0] if uptrend else highs[0]
    out.long[0] = uptrend and closes[0] > sar[0]
    out.short[0] = (not uptrend) and closes[0] < sar[0]

    for i in range(1, len(bars)):
        current_sar = sar[i - 1] + acceleration_factor * (extreme_point - sar[i - 1])
        if uptrend:
            current_sar = min(current_sar, lows[i - 1], lows[i - 2] if i > 1 else lows[i - 1])
            if lows[i] < current_sar:
                uptrend = False
                current_sar = extreme_point
                extreme_point = lows[i]
                acceleration_factor = step
            else:
                if highs[i] > extreme_point:
                    extreme_point = highs[i]
                    acceleration_factor = min(max_step, acceleration_factor + step)
        else:
            current_sar = max(current_sar, highs[i - 1], highs[i - 2] if i > 1 else highs[i - 1])
            if highs[i] > current_sar:
                uptrend = True
                current_sar = extreme_point
                extreme_point = highs[i]
                acceleration_factor = step
            else:
                if lows[i] < extreme_point:
                    extreme_point = lows[i]
                    acceleration_factor = min(max_step, acceleration_factor + step)

        sar[i] = current_sar
        out.long[i] = uptrend and closes[i] > sar[i]
        out.short[i] = (not uptrend) and closes[i] < sar[i]
    return out


def evaluate_macd_zero_bias(
    bars: list[Candle],
    fast: int,
    slow: int,
    signal: int,
) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    safe_fast = min(fast, max(2, slow - 1))
    safe_slow = max(slow, safe_fast + 1)
    fast_line = ema(closes, safe_fast)
    slow_line = ema(closes, safe_slow)
    macd_line = [fast_line[i] - slow_line[i] for i in range(len(closes))]
    signal_line = ema(macd_line, signal)
    out = create_empty_mask(len(bars))
    for i in range(len(bars)):
        out.long[i] = macd_line[i] > 0 and signal_line[i] > 0 and macd_line[i] >= signal_line[i]
        out.short[i] = macd_line[i] < 0 and signal_line[i] < 0 and macd_line[i] <= signal_line[i]
    return out


def evaluate_macd_cross(bars: list[Candle], fast: int, slow: int, signal: int) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    safe_fast = min(fast, max(2, slow - 1))
    safe_slow = max(slow, safe_fast + 1)
    fast_line = ema(closes, safe_fast)
    slow_line = ema(closes, safe_slow)
    macd_line = [fast_line[i] - slow_line[i] for i in range(len(closes))]
    signal_line = ema(macd_line, signal)
    out = create_empty_mask(len(bars))
    for i in range(1, len(bars)):
        out.long[i] = macd_line[i - 1] < signal_line[i - 1] and macd_line[i] >= signal_line[i]
        out.short[i] = macd_line[i - 1] > signal_line[i - 1] and macd_line[i] <= signal_line[i]
    return out


def evaluate_retest(bars: list[Candle], window_bars: int, tolerance_pct: float) -> RuleMask:
    tolerance = tolerance_pct / 100
    out = create_empty_mask(len(bars))
    for i in range(window_bars, len(bars)):
        resistance = max_high(bars, i - window_bars, i)
        support = min_low(bars, i - window_bars, i)
        low = float(bars[i]["l"])
        high = float(bars[i]["h"])
        close = float(bars[i]["c"])
        out.long[i] = low >= resistance * (1 - tolerance) and low <= resistance * (1 + tolerance) and close >= resistance
        out.short[i] = high >= support * (1 - tolerance) and high <= support * (1 + tolerance) and close <= support
    return out


def evaluate_volume_confirm(bars: list[Candle], factor: float, lookback: int) -> RuleMask:
    volume = [float(bar["v"]) for bar in bars]
    averages = sma(volume, lookback)
    out = create_empty_mask(len(bars))
    for i in range(len(bars)):
        confirmed = averages[i] > 0 and volume[i] >= averages[i] * factor
        out.long[i] = confirmed
        out.short[i] = confirmed
    return out


def evaluate_vwap_reclaim(bars: list[Candle]) -> RuleMask:
    out = create_empty_mask(len(bars))
    cumulative_price_volume = 0.0
    cumulative_volume = 0.0
    current_day_key = ""

    for i, bar in enumerate(bars):
        day_key = format_day_key(int(bar["t"]))
        if day_key != current_day_key:
            current_day_key = day_key
            cumulative_price_volume = 0.0
            cumulative_volume = 0.0

        typical_price = (float(bar["h"]) + float(bar["l"]) + float(bar["c"])) / 3
        cumulative_price_volume += typical_price * float(bar["v"])
        cumulative_volume += float(bar["v"])
        vwap = cumulative_price_volume / cumulative_volume if cumulative_volume > 0 else float(bar["c"])

        close = float(bar["c"])
        open_price = float(bar["o"])
        out.long[i] = float(bar["l"]) <= vwap and close > vwap and close > open_price
        out.short[i] = float(bar["h"]) >= vwap and close < vwap and close < open_price
    return out


def evaluate_micro_breakout(bars: list[Candle], pivot_bars: int) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(pivot_bars, len(bars)):
        prior_high = max_high(bars, i - pivot_bars, i)
        prior_low = min_low(bars, i - pivot_bars, i)
        close = float(bars[i]["c"])
        out.long[i] = close > prior_high
        out.short[i] = close < prior_low
    return out


def evaluate_inside_breakout(bars: list[Candle]) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i in range(2, len(bars)):
        mother = bars[i - 2]
        inside = bars[i - 1]
        is_inside = float(inside["h"]) <= float(mother["h"]) and float(inside["l"]) >= float(mother["l"])
        if not is_inside:
            continue
        close = float(bars[i]["c"])
        out.long[i] = close > float(mother["h"])
        out.short[i] = close < float(mother["l"])
    return out


def evaluate_reversal_candle(bars: list[Candle], body_pct_threshold: float) -> RuleMask:
    out = create_empty_mask(len(bars))
    for i, bar in enumerate(bars):
        range_value = max(1e-9, float(bar["h"]) - float(bar["l"]))
        body_pct = (abs(float(bar["c"]) - float(bar["o"])) / range_value) * 100
        bullish_close = (float(bar["c"]) - float(bar["l"])) / range_value >= 0.7
        bearish_close = (float(bar["h"]) - float(bar["c"])) / range_value >= 0.7
        out.long[i] = float(bar["c"]) > float(bar["o"]) and body_pct >= body_pct_threshold and bullish_close
        out.short[i] = float(bar["c"]) < float(bar["o"]) and body_pct >= body_pct_threshold and bearish_close
    return out


def evaluate_stoch_rsi_cross(
    bars: list[Candle],
    rsi_period: int,
    stoch_period: int,
    signal_period: int,
    oversold: float,
    overbought: float,
) -> RuleMask:
    closes = [float(bar["c"]) for bar in bars]
    rsi = compute_rsi(closes, rsi_period)
    k = [0.0] * len(bars)
    for i in range(stoch_period - 1, len(bars)):
        window = rsi[i - stoch_period + 1:i + 1]
        min_value = min(window)
        max_value = max(window)
        k[i] = 0.0 if max_value == min_value else ((rsi[i] - min_value) / (max_value - min_value)) * 100
    d = sma(k, signal_period)
    out = create_empty_mask(len(bars))
    for i in range(1, len(bars)):
        out.long[i] = k[i - 1] < d[i - 1] and k[i] >= d[i] and k[i - 1] <= oversold
        out.short[i] = k[i - 1] > d[i - 1] and k[i] <= d[i] and k[i - 1] >= overbought
    return out


def ema(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    k = 2 / (period + 1)
    out = [0.0] * len(values)
    out[0] = values[0]
    for i in range(1, len(values)):
        out[i] = values[i] * k + out[i - 1] * (1 - k)
    return out


def compute_true_range(bars: list[Candle]) -> list[float]:
    true_range = [0.0] * len(bars)
    for i, bar in enumerate(bars):
        high = float(bar["h"])
        low = float(bar["l"])
        if i == 0:
            true_range[i] = high - low
            continue
        previous_close = float(bars[i - 1]["c"])
        true_range[i] = max(high - low, abs(high - previous_close), abs(low - previous_close))
    return true_range


def wilder_smoothing(values: list[float], period: int) -> list[float]:
    out = [0.0] * len(values)
    if len(values) < period:
        return out

    running_total = sum(values[:period])
    out[period - 1] = running_total
    for i in range(period, len(values)):
        out[i] = out[i - 1] - (out[i - 1] / period) + values[i]
    return out


def smooth_directional_index(dx: list[float], period: int) -> list[float]:
    out = [0.0] * len(dx)
    start = (period * 2) - 2
    if len(dx) <= start:
        return out

    initial_values = dx[period - 1:start + 1]
    out[start] = sum(initial_values) / period
    for i in range(start + 1, len(dx)):
        out[i] = ((out[i - 1] * (period - 1)) + dx[i]) / period
    return out


def compute_atr(bars: list[Candle], period: int) -> list[float]:
    true_range = compute_true_range(bars)
    smoothed = wilder_smoothing(true_range, period)
    atr = [0.0] * len(bars)
    for i in range(period - 1, len(bars)):
        atr[i] = smoothed[i] / period
    return atr


def compute_rsi(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    out = [0.0] * len(values)
    alpha = 1 / period
    avg_gain = 0.0
    avg_loss = 0.0

    for i in range(1, len(values)):
        diff = values[i] - values[i - 1]
        gain = diff if diff > 0 else 0.0
        loss = -diff if diff < 0 else 0.0

        if i == 1:
            avg_gain = gain
            avg_loss = loss
        else:
            avg_gain = gain * alpha + avg_gain * (1 - alpha)
            avg_loss = loss * alpha + avg_loss * (1 - alpha)

        if avg_loss == 0:
            out[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            out[i] = 100 - (100 / (1 + rs))

    return out


def sma(values: list[float], period: int) -> list[float]:
    out = [0.0] * len(values)
    rolling = 0.0
    for i, value in enumerate(values):
        rolling += value
        if i >= period:
            rolling -= values[i - period]
        out[i] = rolling / period if i >= period - 1 else 0.0
    return out


def standard_deviation(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return sqrt(variance)


def find_lowest_bar(bars: list[Candle], start: int, end: int) -> dict[str, float | int]:
    best_index = start
    best_value = float("inf")
    for i in range(start, end):
        low = float(bars[i]["l"])
        if low < best_value:
            best_value = low
            best_index = i
    return {"index": best_index, "value": best_value}


def find_highest_bar(bars: list[Candle], start: int, end: int) -> dict[str, float | int]:
    best_index = start
    best_value = float("-inf")
    for i in range(start, end):
        high = float(bars[i]["h"])
        if high > best_value:
            best_value = high
            best_index = i
    return {"index": best_index, "value": best_value}


def max_high(bars: list[Candle], start: int, end: int) -> float:
    high = float("-inf")
    for i in range(start, end):
        high = max(high, float(bars[i]["h"]))
    return high


def min_low(bars: list[Candle], start: int, end: int) -> float:
    low = float("inf")
    for i in range(start, end):
        low = min(low, float(bars[i]["l"]))
    return low


def clamp_int(value: Any, fallback: int, minimum: int, maximum: int) -> int:
    try:
        number_value = round(float(value))
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, int(number_value)))


def clamp_number(value: Any, fallback: float, minimum: float, maximum: float) -> float:
    try:
        number_value = float(value)
    except (TypeError, ValueError):
        return fallback
    return min(maximum, max(minimum, number_value))


def round_number(value: float, digits: int) -> float:
    factor = 10 ** digits
    return round(value * factor) / factor


def format_day_key(unix_seconds: int) -> str:
    date = datetime.fromtimestamp(unix_seconds, tz=timezone.utc)
    return f"{date.year}-{date.month}-{date.day}"


def get_timeframe_seconds(tf: str) -> int:
    mapping = {
        "1m": 60,
        "3m": 180,
        "5m": 300,
        "15m": 900,
        "30m": 1800,
        "1h": 3600,
        "2h": 7200,
        "4h": 14400,
        "6h": 21600,
        "12h": 43200,
        "1d": 86400,
        "3d": 259200,
        "1w": 604800,
        "1M": 2592000,
    }
    return mapping.get(tf, 3600)
