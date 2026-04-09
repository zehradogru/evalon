from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional, Literal, Dict, Any, Tuple

import numpy as np
import pandas as pd


IntrabarPriority = Literal["stop_first", "tp_first"]
StopTpReference = Literal["fill", "open"]  # stop/tp yüzdesi hangi giriş fiyatına göre hesaplanacak


@dataclass
class BacktestConfig:
    initial_cash: float = 10_000.0

    # Costs
    fee_rate: float = 0.0005          # 5 bps
    slippage_bps: float = 2.0         # 2 bps (fill fiyatına uygulanır)

    # Risk exits (None -> devre dışı; ama senin kullanımında genelde dolu olacak)
    stop_loss_pct: Optional[float] = None     # 0.02 => %2
    take_profit_pct: Optional[float] = None   # 0.04 => %4
    intrabar_priority: IntrabarPriority = "stop_first"

    # stop/tp seviyesini hangi giriş fiyatına göre kuracağız?
    # - "fill": slippage dahil gerçekleşen entry_price
    # - "open": bar open (raw) fiyatı
    stop_tp_reference: StopTpReference = "fill"

    # Data sanity
    skip_volume_zero_bars: bool = True  # volume=0 bar’da fill yapma (entry/exit)

    # End behavior
    force_close_on_end: bool = True

    # Debug / Logging
    log_trades: bool = False


@dataclass
class BacktestResult:
    config: Dict[str, Any]
    trades: pd.DataFrame
    equity: pd.DataFrame
    metrics: Dict[str, float]


def _bps_to_mult(bps: float) -> float:
    return bps / 10_000.0


def _validate_inputs(ohlcv: pd.DataFrame, entry_signal: pd.Series) -> Tuple[pd.DataFrame, pd.Series]:
    """
    ohlcv: index DatetimeIndex, cols: open/high/low/close/volume
    entry_signal: 0/1 Series, index DatetimeIndex (ohlcv ile hizalanacak)
    """
    required_cols = {"open", "high", "low", "close", "volume"}
    missing = required_cols - set(ohlcv.columns)
    if missing:
        raise ValueError(f"ohlcv missing required columns: {sorted(missing)}")

    if not isinstance(ohlcv.index, pd.DatetimeIndex):
        raise ValueError("ohlcv index must be a pandas.DatetimeIndex")

    if not ohlcv.index.is_monotonic_increasing:
        ohlcv = ohlcv.sort_index()

    if not isinstance(entry_signal.index, pd.DatetimeIndex):
        raise ValueError("entry_signal index must be a pandas.DatetimeIndex")

    df = ohlcv.copy()

    # numeric normalize
    for col in ["open", "high", "low", "close"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")

    # drop bad rows + dedup
    df = df.dropna(subset=["open", "high", "low", "close"])
    df = df[~df.index.duplicated(keep="last")]

    sig = entry_signal.reindex(df.index).fillna(0).astype("int8")
    bad_vals = set(sig.unique()) - {0, 1}
    if bad_vals:
        raise ValueError(f"entry_signal must contain only 0/1. Found: {sorted(bad_vals)}")

    return df, sig


def _compute_metrics(equity: pd.DataFrame, trades: pd.DataFrame) -> Dict[str, float]:
    eq = equity["equity"].to_numpy(dtype=float)
    if len(eq) < 2:
        return {
            "total_return_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "num_trades": 0.0,
            "win_rate_pct": 0.0,
        }

    total_return = (eq[-1] / eq[0]) - 1.0

    peak = np.maximum.accumulate(eq)
    dd = (eq / peak) - 1.0
    max_dd = float(dd.min())

    num_trades = len(trades)
    if num_trades == 0:
        return {
            "total_return_pct": float(total_return * 100),
            "max_drawdown_pct": float(max_dd * 100),
            "num_trades": 0.0,
            "win_rate_pct": 0.0,
        }

    pnl = trades["pnl"].to_numpy(dtype=float)
    win_rate = float((pnl > 0).mean() * 100.0)

    return {
        "total_return_pct": float(total_return * 100),
        "max_drawdown_pct": float(max_dd * 100),
        "num_trades": float(num_trades),
        "win_rate_pct": win_rate,
    }


def backtest_single_ticker(
    ohlcv: pd.DataFrame,
    entry_signal: pd.Series,
    config: Optional[BacktestConfig] = None,
) -> BacktestResult:
    """
    Tek hisse - long-only - all-in - cash-only.

    Sinyal:
      entry_signal[t] = 1  =>  bir sonraki bar OPEN’da giriş (lookahead yok)
      entry_signal sadece "giriş tetikleyicisi"dir. Çıkış sinyal ile olmaz.

    Çıkış:
      sadece stop_loss / take_profit ile olur (bar OPEN gap kontrol + low/high kontrol).
      force_close_on_end=True ise son bar CLOSE’da kapatılır.

    Equity:
      her bar sonunda (close) kaydedilir.
    """
    cfg = config or BacktestConfig()
    ohlcv, entry_signal = _validate_inputs(ohlcv, entry_signal)

    n = len(ohlcv)
    idx = ohlcv.index

    # Arrays
    o = ohlcv["open"].to_numpy(dtype=np.float64)
    h = ohlcv["high"].to_numpy(dtype=np.float64)
    l = ohlcv["low"].to_numpy(dtype=np.float64)
    c = ohlcv["close"].to_numpy(dtype=np.float64)
    v = ohlcv["volume"].to_numpy(dtype=np.int64)
    sig = entry_signal.to_numpy(dtype=np.int8)

    fee_rate = float(cfg.fee_rate)
    slip = _bps_to_mult(float(cfg.slippage_bps))

    use_sl = cfg.stop_loss_pct is not None and cfg.stop_loss_pct > 0
    use_tp = cfg.take_profit_pct is not None and cfg.take_profit_pct > 0
    sl_pct = float(cfg.stop_loss_pct) if use_sl else 0.0
    tp_pct = float(cfg.take_profit_pct) if use_tp else 0.0

    # --- State ---
    cash = float(cfg.initial_cash)
    qty = 0.0

    entry_time = None
    entry_i = -1

    entry_open_price = 0.0   # raw open (slippage öncesi)
    entry_fill_price = 0.0   # gerçekleşen fill (slippage sonrası)
    entry_fee = 0.0

    # --- Outputs ---
    cash_hist = np.empty(n, dtype=np.float64)
    posv_hist = np.empty(n, dtype=np.float64)
    eq_hist = np.empty(n, dtype=np.float64)

    trades_rows = []

    def _log(msg: str) -> None:
        if cfg.log_trades:
            print(msg, flush=True)

    def _tradable(i: int) -> bool:
        return (v[i] > 0) if cfg.skip_volume_zero_bars else True

    def _buy_at_open(i: int) -> None:
        """All-in buy at bar i open."""
        nonlocal cash, qty, entry_time, entry_i, entry_open_price, entry_fill_price, entry_fee

        if cash <= 0 or not _tradable(i):
            return

        raw_open = o[i]
        fill = raw_open * (1.0 + slip)  # long entry worse
        # cash = qty*fill*(1+fee_rate) => qty = cash / (fill*(1+fee_rate))
        q = cash / (fill * (1.0 + fee_rate))
        if q <= 0:
            return

        # Lot tam sayı olmalı: sadece tam kısmını al, kalan para kasada kalır
        q = float(int(q))
        if q <= 0:
            return

        trade_value = q * fill
        fee = trade_value * fee_rate
        cash -= (trade_value + fee)

        qty = q
        entry_time = idx[i]
        entry_i = i
        entry_open_price = float(raw_open)
        entry_fill_price = float(fill)
        entry_fee = float(fee)

        _log(
            f"ALIŞ | Zaman: {idx[i]} | Adet: {int(qty)} lot | Açılış: {raw_open:.2f} TL | "
            f"Gerçekleşen: {fill:.2f} TL | Komisyon: {fee:.2f} TL | Kalan Nakit: {cash:.2f} TL"
        )

    def _sell(i: int, raw_price: float, reason: str) -> None:
        """Sell full position at given raw_price (slippage + fee applied)."""
        nonlocal cash, qty, entry_time, entry_i, entry_open_price, entry_fill_price, entry_fee

        if qty <= 0 or not _tradable(i):
            return

        fill = raw_price * (1.0 - slip)  # long exit worse
        trade_value = qty * fill
        fee = trade_value * fee_rate

        gross_pnl = (fill - entry_fill_price) * qty
        pnl = gross_pnl - entry_fee - fee

        ret_pct = ((fill / entry_fill_price) - 1.0) * 100.0 if entry_fill_price > 0 else 0.0
        bars_held = int(i - entry_i) if entry_i >= 0 else 0

        trades_rows.append({
            "entry_time": entry_time,
            "entry_open": entry_open_price,
            "entry_price": entry_fill_price,
            "exit_time": idx[i],
            "exit_price": float(fill),
            "qty": float(qty),
            "exit_reason": reason,
            "entry_fee": float(entry_fee),
            "exit_fee": float(fee),
            "total_fees": float(entry_fee + fee),
            "gross_pnl": float(gross_pnl),
            "pnl": float(pnl),
            "return_pct": float(ret_pct),
            "bars_held": bars_held,
        })

        reason_tr = {
            "stop_loss": "Zarar Kes",
            "stop_loss_gap": "Zarar Kes (Gap)",
            "take_profit": "Kâr Al",
            "take_profit_gap": "Kâr Al (Gap)",
            "end_of_test": "Test Sonu",
        }.get(reason, reason)

        _log(
            f"SATIŞ | Zaman: {idx[i]} | Adet: {int(qty)} lot | Fiyat: {raw_price:.2f} TL | "
            f"Gerçekleşen: {fill:.2f} TL | Sebep: {reason_tr} | Kâr/Zarar: {pnl:.2f} TL | "
            f"Toplam Komisyon: {(entry_fee + fee):.2f} TL | Nakit: {(cash + (trade_value - fee)):.2f} TL"
        )

        cash += (trade_value - fee)
        qty = 0.0
        entry_time = None
        entry_i = -1
        entry_open_price = 0.0
        entry_fill_price = 0.0
        entry_fee = 0.0

    def _stop_tp_levels() -> Tuple[Optional[float], Optional[float]]:
        """Compute stop/tp levels based on selected reference price."""
        if qty <= 0:
            return None, None

        ref = entry_fill_price if cfg.stop_tp_reference == "fill" else entry_open_price

        stop_price = (ref * (1.0 - sl_pct)) if use_sl else None
        tp_price = (ref * (1.0 + tp_pct)) if use_tp else None
        return stop_price, tp_price

    # --- Main loop ---
    for i in range(n):
        # 1) ENTRY at OPEN using previous bar signal (lookahead-safe)
        desired_entry = int(sig[i - 1]) if i > 0 else 0
        if qty == 0 and desired_entry == 1:
            _buy_at_open(i)

        # 2) STOP/TP while in position
        if qty > 0 and (use_sl or use_tp):
            stop_price, tp_price = _stop_tp_levels()

            # OPEN jump check (if open already beyond level)
            # stop: open <= stop
            if use_sl and stop_price is not None and o[i] <= stop_price:
                _sell(i, raw_price=o[i], reason="stop_loss_gap")
            # tp: open >= tp
            elif use_tp and tp_price is not None and o[i] >= tp_price:
                _sell(i, raw_price=o[i], reason="take_profit_gap")
            else:
                # intrabar check using low/high
                hit_stop = use_sl and stop_price is not None and (l[i] <= stop_price)
                hit_tp = use_tp and tp_price is not None and (h[i] >= tp_price)

                if hit_stop or hit_tp:
                    if hit_stop and hit_tp:
                        which = "stop" if cfg.intrabar_priority == "stop_first" else "tp"
                    else:
                        which = "stop" if hit_stop else "tp"

                    if which == "stop":
                        _sell(i, raw_price=stop_price, reason="stop_loss")
                    else:
                        _sell(i, raw_price=tp_price, reason="take_profit")

        # 3) FORCE CLOSE on last bar CLOSE
        if cfg.force_close_on_end and i == n - 1 and qty > 0:
            _sell(i, raw_price=c[i], reason="end_of_test")

        # 4) END-OF-BAR equity (close mark-to-market)
        pos_value = qty * c[i]
        cash_hist[i] = cash
        posv_hist[i] = pos_value
        eq_hist[i] = cash + pos_value

    equity = pd.DataFrame(index=idx, data={
        "cash": cash_hist,
        "pos_value": posv_hist,
        "equity": eq_hist,
    })
    peak = equity["equity"].cummax()
    equity["drawdown"] = (equity["equity"] / peak) - 1.0

    trades = pd.DataFrame(trades_rows, columns=[
        "entry_time", "entry_open", "entry_price",
        "exit_time", "exit_price", "qty",
        "exit_reason", "entry_fee", "exit_fee", "total_fees",
        "gross_pnl", "pnl", "return_pct", "bars_held"
    ])

    metrics = _compute_metrics(equity, trades)

    return BacktestResult(
        config=asdict(cfg),
        trades=trades,
        equity=equity,
        metrics=metrics,
    )
