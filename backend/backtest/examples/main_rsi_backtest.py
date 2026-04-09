from __future__ import annotations

from datetime import datetime

from dotenv import load_dotenv

from data_clients.bist_prices_client import BistPricesClient
from engine.backtest_engine import BacktestConfig
from stratejiler import (
    RSIStrategy, RSIStrategyConfig,
    MACDStrategy, MACDStrategyConfig,
    StratejiKombinator,
)


def main() -> None:
    load_dotenv()
    client = BistPricesClient()

    # Veri çek
    ohlcv = client.fetch_prices(
        ticker="THYAO",
       
    )

    if ohlcv.empty:
        raise ValueError("Seçilen aralıkta veri bulunamadı.")

    # Stratejileri oluştur
    rsi = RSIStrategy(RSIStrategyConfig(period=14, entry_level=30.0))
    macd = MACDStrategy(MACDStrategyConfig(fast_period=12, slow_period=26, signal_period=9))

    # Kombinator: RSI ve MACD ikisi de AL derse AL
    kombine = StratejiKombinator(stratejiler=[rsi, macd])

    # Backtest çalıştır
    result = kombine.run_backtest(
        ohlcv,
        config=BacktestConfig(
            stop_loss_pct=0.02,
            take_profit_pct=0.01,
            log_trades=True,
        ),
    )

    print("\n--- SONUÇLAR ---")
    print(result.metrics)


if __name__ == "__main__":
    main()
