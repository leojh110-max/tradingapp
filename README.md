# Offline Candlestick Training Web App

Phase 2-A of an offline historical candlestick training application.

This is **not** a Binance or TradingView clone. It is an educational chart that reads the Phase 1 Master Dataset (`market.db`) through a local FastAPI backend. The app is designed to run with **no internet connection**.

## Timeframes

The chart can switch:

`1m` `5m` `10m` `15m` `30m` `1h` `4h` `1d`

`1m` is the Master Dataset. Higher timeframes are computed from bounded 1m
range queries using UTC calendar buckets. See `docs/AGGREGATION_POLICY.md`.
A derived cache (`data/cache/aggregate_cache.db`) may store those results for
speed; it is disposable and is never a source of truth. See `docs/CACHE.md`.


## Offline rules

Runtime code must not use CDN, Google Fonts, TradingView embeds, Binance APIs, or any other remote resource. The only allowed network is `localhost` / `127.0.0.1` between the React frontend and the FastAPI backend.

Phase 1 `market.db` is opened **read-only**. This app never deletes, updates, rounds, or fabricates candles.

## Prerequisites

- Python 3.10+
- Node.js 18+
- Phase 1 Master Dataset at:

`E:\Development\candlestick_chart\Binance Historical Data Manager\data\database\market.db`

Override with `MARKET_DB_PATH` if needed. Derived cache path:
`AGGREGATE_CACHE_PATH` (default `tradingapp/data/cache/aggregate_cache.db`).

## HTF cache

```powershell
cd E:\Development\candlestick_chart\tradingapp\backend
python -m app.cache status
python -m app.cache build
python -m app.cache validate
```

## Backend

```powershell
cd E:\Development\candlestick_chart\tradingapp
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API:

- `GET /api/health`
- `GET /api/market/info`
- `GET /api/candles?symbol=BTCUSDT&interval=1m&from=...&to=...&limit=1500`

`cutoff` is accepted so a future Replay Mode can keep `open_time <= T` on the server. Replay is not implemented yet.

## Frontend

```powershell
cd E:\Development\candlestick_chart\tradingapp\frontend
npm install
npm run dev
```

Vite listens on `http://127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:8000`.

## Tests

```powershell
cd E:\Development\candlestick_chart\tradingapp\backend
python -m pytest

cd E:\Development\candlestick_chart\tradingapp\frontend
npm test
npm run audit:offline
```

Smoke tests marked `smoke` use the real `market.db` read-only.

## Production-oriented build (not a full installer yet)

```powershell
cd frontend
npm run build
```

The backend will serve `frontend/dist` automatically when that folder exists, so a later single-port layout (`http://127.0.0.1:8000`) is possible. A Windows `start.bat` package is not part of this phase.

## What this phase does not include

Replay, orders, positions, indicators, drawing tools, and multi-symbol support.
