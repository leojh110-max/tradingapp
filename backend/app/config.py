"""Application configuration.

The Master Dataset lives in the Phase 1 Data Manager directory. This app
opens that SQLite file read-only and never writes to it.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

SUPPORTED_EXCHANGE = "BINANCE"
SUPPORTED_MARKET = "SPOT"
SUPPORTED_SYMBOL = "BTCUSDT"
SUPPORTED_INTERVAL = "1m"  # Master Dataset interval; higher TFs are computed

DEFAULT_CANDLE_LIMIT = 1500
MAX_CANDLE_LIMIT = 5000

# Display / API casing. Database rows use the uppercase constants above.
API_EXCHANGE = "binance"
API_MARKET = "spot"


def _candlestick_chart_root() -> Path:
    # backend/app/config.py -> tradingapp -> candlestick_chart
    return Path(__file__).resolve().parents[3]


def default_database_path() -> Path:
    return (
        _candlestick_chart_root()
        / "Binance Historical Data Manager"
        / "data"
        / "database"
        / "market.db"
    )


def default_cache_path() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "cache" / "aggregate_cache.db"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    default_limit: int = DEFAULT_CANDLE_LIMIT
    max_limit: int = MAX_CANDLE_LIMIT
    cors_origins: tuple[str, ...] = (
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    )
    frontend_dist: Path = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    cache_path: Path = default_cache_path()

    @property
    def exchange(self) -> str:
        return SUPPORTED_EXCHANGE

    @property
    def market(self) -> str:
        return SUPPORTED_MARKET

    @property
    def symbol(self) -> str:
        return SUPPORTED_SYMBOL

    @property
    def interval(self) -> str:
        return SUPPORTED_INTERVAL


def load_settings() -> Settings:
    raw = os.environ.get("MARKET_DB_PATH", "").strip()
    database_path = Path(raw) if raw else default_database_path()
    cache_raw = os.environ.get("AGGREGATE_CACHE_PATH", "").strip()
    cache_path = Path(cache_raw) if cache_raw else default_cache_path()
    return Settings(database_path=database_path.resolve(), cache_path=cache_path.resolve())
