"""SQLite schema for the derived aggregation cache."""

from __future__ import annotations

from enum import Enum

from app.timeframes import AGGREGATION_POLICY_VERSION, CACHE_SCHEMA_VERSION

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cache_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aggregated_candles (
    exchange TEXT NOT NULL,
    market TEXT NOT NULL,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL,
    open_time INTEGER NOT NULL,
    open TEXT NOT NULL,
    high TEXT NOT NULL,
    low TEXT NOT NULL,
    close TEXT NOT NULL,
    volume TEXT NOT NULL,
    source_candle_count INTEGER NOT NULL,
    expected_candle_count INTEGER NOT NULL,
    complete INTEGER NOT NULL,
    PRIMARY KEY (exchange, market, symbol, interval, open_time)
);

CREATE INDEX IF NOT EXISTS idx_aggregated_series_time
    ON aggregated_candles (exchange, market, symbol, interval, open_time);
"""

META_SCHEMA_VERSION = "schema_version"
META_POLICY_VERSION = "aggregation_policy_version"
META_STATUS = "status"
META_MASTER_FILE_SIZE = "master_file_size"
META_MASTER_MTIME = "master_mtime"
META_MASTER_CANDLE_COUNT = "master_candle_count"
META_MASTER_FIRST_OPEN_TIME = "master_first_open_time"
META_MASTER_LAST_OPEN_TIME = "master_last_open_time"
META_SOURCE_INTERVAL = "source_interval"
META_BUILT_AT = "built_at"


class CacheState(str, Enum):
    MISSING = "MISSING"
    INVALID = "INVALID"
    STALE = "STALE"
    BUILDING = "BUILDING"
    READY = "READY"


def schema_version() -> str:
    return str(CACHE_SCHEMA_VERSION)


def policy_version() -> str:
    return AGGREGATION_POLICY_VERSION
