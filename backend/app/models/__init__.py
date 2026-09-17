"""API and domain models.

OHLCV fields remain strings so JSON serialization does not coerce SQLite TEXT
tokens through binary float.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Candle:
    open_time: int
    open: str
    high: str
    low: str
    close: str
    volume: str
    source_candle_count: int | None = None
    expected_candle_count: int | None = None
    complete: bool | None = None


@dataclass(frozen=True)
class MarketInfo:
    exchange: str
    market: str
    symbol: str
    base_asset: str
    quote_asset: str
    interval: str
    first_open_time: int | None
    last_open_time: int | None
    candle_count: int
    source_interval: str = "1m"
    source_candle_count: int = 0
