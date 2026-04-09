from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any

import numpy as np
import pandas as pd
from lightweight_charts import Chart


@dataclass(frozen=True)
class ChartTheme:
    name: str
    background: str
    text: str
    grid: str
    up: str
    down: str
    crosshair: str
    volume_up: str
    volume_down: str
    border: str
    line_color: str  # Yeni: Çizgi grafiği için ana renk


THEMES: Dict[str, ChartTheme] = {
    "dark": ChartTheme(
        name="dark",
        background="#0F172A",  # "Modern Midnight" - Derin, zengin gece mavisi (Slate 900)
        text="#E2E8F0",        # Parlak, net beyazımsı gri (Slate 200)
        grid="#1E293B",        # Arkaplanla uyumlu hafif grid (Slate 800)
        up="#22D3EE",          # "Electric Cyan" - Motive edici parlak turkuaz
        down="#F472B6",        # "Neon Pink" - Agresif olmayan ama net pembe/kırmızı
        crosshair="#94A3B8",   # Dengeli gri crosshair
        volume_up="rgba(34, 211, 238, 0.3)",
        volume_down="rgba(244, 114, 182, 0.3)",
        border="#334155",      # Çerçeve (Slate 700)
        line_color="#2962FF",  # "TradingView Blue" - Çok net, canlı, profesyonel mavi
    ),
    "light": ChartTheme(
        name="light",
        background="#ffffff",
        text="#24292f",
        grid="#e1e4e8",
        up="#2ea043",
        down="#cf222e",
        crosshair="#0969da",
        volume_up="rgba(46, 160, 67, 0.40)",
        volume_down="rgba(207, 34, 46, 0.40)",
        border="#e1e4e8",
        line_color="#2962FF",
    ),
}


def _get_theme(theme: str) -> ChartTheme:
    key = (theme or "dark").lower()
    if key not in THEMES:
        raise ValueError(f"Unknown theme '{theme}'. Use: {list(THEMES.keys())}")
    return THEMES[key]


def _normalize_ohlcv(ohlcv: pd.DataFrame, timezone: Optional[str]) -> pd.DataFrame:
    df = ohlcv.copy()

    # Index -> DatetimeIndex
    if not isinstance(df.index, pd.DatetimeIndex):
        df.index = pd.to_datetime(df.index, errors="coerce")

    # Timezone normalize
    if timezone:
        if df.index.tz is None:
            df.index = df.index.tz_localize(timezone)
        else:
            df.index = df.index.tz_convert(timezone)

    df = df.sort_index()
    df = df[~df.index.duplicated(keep="last")]

    # Column normalize
    df.columns = df.columns.str.lower()
    required_cols = ["open", "high", "low", "close"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"OHLCV must include columns: {missing}")

    for col in required_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    if "volume" in df.columns:
        df["volume"] = (
            pd.to_numeric(df["volume"], errors="coerce")
            .fillna(0)
            .astype("int64")
        )

    df = df.dropna(subset=required_cols)

    # Move index to time column for lightweight-charts
    df = df.reset_index()
    df = df.rename(columns={df.columns[0]: "time"})
    return df


def _norm_side(value: Any) -> str:
    if value is None:
        return "long"
    side = str(value).lower().strip()
    if side in {"short", "sell", "-1"}:
        return "short"
    return "long"


def _build_markers(trades: pd.DataFrame, precision: int, theme: ChartTheme) -> list[dict]:
    markers: list[dict] = []
    for row in trades.itertuples(index=False):
        data = row._asdict()
        entry_time = data.get("entry_time")
        entry_price = data.get("entry_price")
        exit_time = data.get("exit_time")
        exit_price = data.get("exit_price")
        side = _norm_side(data.get("side"))

        if pd.notna(entry_time) and pd.notna(entry_price):
            markers.append(
                {
                    "time": pd.to_datetime(entry_time),
                    "position": "below" if side == "long" else "above",
                    "shape": "arrow_up" if side == "long" else "arrow_down",
                    "color": theme.up if side == "long" else theme.down,
                    "text": f"BUY @ {entry_price:.{precision}f}" if side == "long" else f"SELL @ {entry_price:.{precision}f}",
                }
            )

        if pd.notna(exit_time) and pd.notna(exit_price):
            if pd.notna(entry_price):
                pnl = (exit_price - entry_price) * (1 if side == "long" else -1)
                pnl_pct = (pnl / entry_price) * 100 if entry_price else 0
                pnl_text = f"EXIT @ {exit_price:.{precision}f} ({pnl_pct:+.2f}%)"
            else:
                pnl_text = f"EXIT @ {exit_price:.{precision}f}"

            markers.append(
                {
                    "time": pd.to_datetime(exit_time),
                    "position": "above" if side == "long" else "below",
                    "shape": "arrow_down" if side == "long" else "arrow_up",
                    "color": theme.down if side == "long" else theme.up,
                    "text": pnl_text,
                }
            )
    return markers


def plot_trades_lightweight(
    ohlcv: pd.DataFrame,
    trades: Optional[pd.DataFrame] = None,
    title: str = "Trading Chart",
    theme: str = "dark",
    chart_type: str = "line",
    show_volume: bool = False,
    show_trade_lines: bool = False,
    show_markers: bool = True,
    width: int = 1400,
    height: int = 800,
    watermark: Optional[str] = None,
    precision: int = 4,
    timezone: str = "Europe/Istanbul",
    enable_zoom_buttons: bool = False,
    allow_mouse_wheel: bool = True,
) -> Chart:
    """
    TradingView-style interactive chart using lightweight-charts.

    - Fast for large datasets
    - Candlesticks + volume
    - Trade markers + entry/exit lines
    """
    theme_cfg = _get_theme(theme)

    chart = Chart(
        width=width,
        height=height,
        title=title,
        inner_width=1.0,
        inner_height=1.0 if not show_volume else 0.75,
        toolbox=True,
    )

    # Layout
    chart.layout(
        background_color=theme_cfg.background,
        text_color=theme_cfg.text,
        font_size=12,
        font_family="IBM Plex Sans, -apple-system, BlinkMacSystemFont, sans-serif",
    )
    chart.grid(vert_enabled=True, horz_enabled=True, color=theme_cfg.grid)
    chart.candle_style(
        up_color=theme_cfg.up,
        down_color=theme_cfg.down,
        wick_up_color=theme_cfg.up,
        wick_down_color=theme_cfg.down,
        border_up_color=theme_cfg.up,
        border_down_color=theme_cfg.down,
    )
    chart.crosshair(
        mode="normal",
        vert_color=theme_cfg.crosshair,
        vert_style="dotted",
        vert_width=1,
        horz_color=theme_cfg.crosshair,
        horz_style="dotted",
        horz_width=1,
        vert_label_background_color=theme_cfg.crosshair,
        horz_label_background_color=theme_cfg.crosshair,
    )

    chart.price_scale(
        auto_scale=True,
        mode="normal",
        border_visible=True,
        border_color=theme_cfg.border,
        text_color=theme_cfg.text,
        entire_text_only=False,
    )

    chart.time_scale(
        right_offset=10,
        min_bar_spacing=3,
        visible=True,
        time_visible=True,
        seconds_visible=False,
        border_visible=True,
        border_color=theme_cfg.border,
    )

    # Disable mouse wheel zoom/scroll if requested
    # Chart Options & Interaction
    # Using format() to avoid f-string brace escaping confusion
    js_options = """
    if (window.{id}) {{
        window.{id}.chart.applyOptions({{
            handleScroll: {{
                horzTouchDrag: true,
                vertTouchDrag: false
            }},
            handleScale: {{
                mouseWheel: true,
                pinch: true,
                axisPressedMouseMove: {{
                    time: true,
                    price: true
                }}
            }},
            kineticScroll: {{
                touch: false,
                mouse: false
            }}
        }});
    }}
    """.format(id=chart.id)
    
    chart.run_script(js_options)

    if watermark:
        chart.watermark(
            text=watermark,
            color="rgba(150, 150, 150, 0.3)",
            font_size=48,
            font_family="IBM Plex Sans",
        )

    chart.legend(visible=True, font_size=14, font_family="IBM Plex Sans")

    # Prepare data
    df = _normalize_ohlcv(ohlcv, timezone)

    # Candlesticks (always set for time scale / drawings)
    chart.set(df[["time", "open", "high", "low", "close"]])

    chart_type = (chart_type or "line").lower()
    price_series = chart

    if chart_type == "line":
        # Hide candles and draw a line series instead
        chart.candle_style(
            up_color="rgba(0,0,0,0)",
            down_color="rgba(0,0,0,0)",
            wick_visible=False,
            border_visible=False,
            wick_up_color="rgba(0,0,0,0)",
            wick_down_color="rgba(0,0,0,0)",
            border_up_color="rgba(0,0,0,0)",
            border_down_color="rgba(0,0,0,0)",
        )
        price_series = chart.create_line(
            name="Price",
            color=theme_cfg.line_color,
            style="solid",
            width=2,
            price_line=True,
            price_label=True,
        )
        line_df = df[["time", "close"]].rename(columns={"close": "Price"})
        price_series.set(line_df)

    # Volume histogram
    if show_volume and "volume" in df.columns:
        volume_chart = chart.create_subchart(
            width=1.0,
            height=0.25,
            sync=True,
            sync_crosshairs_only=False,
        )
        volume_chart.layout(
            background_color=theme_cfg.background,
            text_color=theme_cfg.text,
        )
        volume_chart.grid(
            vert_enabled=True,
            horz_enabled=True,
            color=theme_cfg.grid,
        )
        volume_series = volume_chart.create_histogram(
            name="Volume",
            color=theme_cfg.volume_up,
            price_line=False,
            price_label=False,
        )

        volume_df = df[["time", "volume", "open", "close"]].copy()
        volume_df["color"] = np.where(
            volume_df["close"] >= volume_df["open"],
            theme_cfg.volume_up,
            theme_cfg.volume_down,
        )
        volume_df = volume_df.rename(columns={"volume": "Volume"})
        volume_series.set(volume_df[["time", "Volume", "color"]])

    # Trades
    if trades is not None and not trades.empty:
        if show_markers:
            markers = _build_markers(trades, precision, theme_cfg)
            if markers:
                price_series.marker_list(markers)

        if show_trade_lines:
            for row in trades.itertuples(index=False):
                data = row._asdict()
                entry_time = data.get("entry_time")
                exit_time = data.get("exit_time")
                entry_price = data.get("entry_price")
                exit_price = data.get("exit_price")
                side = _norm_side(data.get("side"))

                if pd.notna(entry_time) and pd.notna(exit_time) and pd.notna(entry_price) and pd.notna(exit_price):
                    pnl = (exit_price - entry_price) * (1 if side == "long" else -1)
                    line_color = theme_cfg.up if pnl > 0 else theme_cfg.down

                    price_series.trend_line(
                        start_time=pd.to_datetime(entry_time),
                        start_value=entry_price,
                        end_time=pd.to_datetime(exit_time),
                        end_value=exit_price,
                        line_color=line_color,
                        width=2,
                        style="dashed",
                    )

    chart.precision(precision)

    # Optional on-screen zoom controls (no mouse wheel)
    if enable_zoom_buttons:
        bar_spacing = 6.0

        def _set_bar_spacing(value: float) -> None:
            chart.run_script(
                f"{chart.id}.chart.applyOptions({{timeScale: {{barSpacing: {value}}}}});"
            )

        _set_bar_spacing(bar_spacing)

        def _zoom_in(ch: Chart) -> None:
            nonlocal bar_spacing
            bar_spacing = min(bar_spacing * 1.2, 80)
            _set_bar_spacing(bar_spacing)

        def _zoom_out(ch: Chart) -> None:
            nonlocal bar_spacing
            bar_spacing = max(bar_spacing / 1.2, 1.0)
            _set_bar_spacing(bar_spacing)

        def _fit(ch: Chart) -> None:
            ch.fit()

        chart.topbar.button("zoom_in", "+", align="right", func=_zoom_in)
        chart.topbar.button("zoom_out", "-", align="right", func=_zoom_out)
        chart.topbar.button("fit", "Fit", align="right", func=_fit)
    return chart


def create_multi_timeframe_chart(
    data_dict: Dict[str, pd.DataFrame],
    trades: Optional[pd.DataFrame] = None,
    theme: str = "dark",
) -> Chart:
    """Create a multi-timeframe chart with a topbar switcher."""
    timeframes = list(data_dict.keys())
    main_tf = timeframes[0]

    chart = plot_trades_lightweight(
        ohlcv=data_dict[main_tf],
        trades=trades,
        title=f"Multi-TF Chart | {main_tf.upper()}",
        theme=theme,
    )

    chart.topbar.switcher(
        name="timeframe",
        options=timeframes,
        default=main_tf,
        func=lambda c: None,
    )

    return chart


if __name__ == "__main__":
    # Demo
    np.random.seed(42)
    n_bars = 5000
    dates = pd.date_range("2025-01-01 09:30", periods=n_bars, freq="1min")
    price = 100 + np.cumsum(np.random.randn(n_bars) * 0.1)

    ohlcv = pd.DataFrame(
        {
            "open": price + np.random.randn(n_bars) * 0.02,
            "high": price + np.abs(np.random.randn(n_bars) * 0.05),
            "low": price - np.abs(np.random.randn(n_bars) * 0.05),
            "close": price,
            "volume": np.random.randint(1000, 10000, n_bars),
        },
        index=dates,
    )

    trades = pd.DataFrame(
        {
            "entry_time": [dates[100], dates[800], dates[1500]],
            "entry_price": [price[100], price[800], price[1500]],
            "exit_time": [dates[300], dates[1000], dates[1800]],
            "exit_price": [price[300], price[1000], price[1800]],
            "side": ["long", "long", "long"],
        }
    )

    chart = plot_trades_lightweight(
        ohlcv=ohlcv,
        trades=trades,
        title="Demo | Lightweight Charts",
        theme="dark",
        show_volume=False,
        watermark="DEMO",
        precision=2,
    )
    chart.show(block=True)
