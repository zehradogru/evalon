# backtest + BIST Prices API

This repo contains:
- Python backtest utilities
- A small FastAPI service to fetch OHLCV from `BIST_PRICES` (Oracle) with optional timeframe aggregation (5m/1h/1d/etc).

## Run API (local)

1) Install deps

```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

Note: indicator endpoints use TA-Lib (installed via `requirements.txt`).

2) Configure env

Required (examples):
- `ORACLE_DB_USER=ADMIN`
- `ORACLE_DB_PASSWORD=...`
- `ORACLE_DB_DSN=evalondb_high`
- `ORACLE_WALLET_PASSWORD=...` (if your wallet needs it)

Wallet options:
- Local dev: keep `./wallet` directory next to `bist_prices_client.py` (default)
- Or set `ORACLE_WALLET_DIR=/abs/path/to/wallet`
- Or set `ORACLE_WALLET_ZIP_B64=<base64_of_wallet_zip>` (the API will unzip it to a temp dir on startup)

3) Start server

```bash
./venv/bin/uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `GET /v1/prices?ticker=THYAO&timeframe=5m&start=2025-01-01T10:00:00&end=2025-01-01T18:00:00&limit=1000`
- `GET /v1/indicators/catalog`
- `GET /v1/indicators?ticker=THYAO&timeframe=1h&strategy=rsi&limit=500`

Timeframe examples: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`/`1g`, `1w`, `1M`/`1mo`.

## Vercel Notes

This is deployed as a Python FastAPI app. The root URL (`/`) returns a small JSON payload with links and a
non-secret config status snapshot.

To make `/v1/prices` work on Vercel you must set Env Vars:
- `ORACLE_DB_USER`
- `ORACLE_DB_PASSWORD`
- `ORACLE_DB_DSN`
- Wallet: `ORACLE_WALLET_ZIP_B64` (base64 zip of your Oracle wallet) or `ORACLE_WALLET_DIR` (rarely useful on Vercel)
