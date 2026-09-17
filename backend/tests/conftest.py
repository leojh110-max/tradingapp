from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.repositories import CandleRepository

CANDLES_SCHEMA = """
CREATE TABLE candles (
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
    close_time INTEGER NOT NULL,
    quote_volume TEXT NOT NULL,
    trade_count INTEGER NOT NULL,
    taker_buy_base_volume TEXT NOT NULL,
    taker_buy_quote_volume TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_row INTEGER,
    PRIMARY KEY (exchange, market, symbol, interval, open_time)
);

CREATE INDEX idx_candles_symbol_interval_time
    ON candles (symbol, interval, open_time);

CREATE INDEX idx_candles_lookup
    ON candles (exchange, market, symbol, interval, open_time, close_time);
"""

EXCHANGE = "BINANCE"
MARKET = "SPOT"
SYMBOL = "BTCUSDT"
INTERVAL = "1m"


def insert_candle(
    conn: sqlite3.Connection,
    open_time: int,
    open: str,
    high: str,
    low: str,
    close: str,
    volume: str,
) -> None:
    conn.execute(
        """
        INSERT INTO candles (
            exchange, market, symbol, interval, open_time,
            open, high, low, close, volume, close_time,
            quote_volume, trade_count, taker_buy_base_volume, taker_buy_quote_volume,
            source_file, source_row
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '0', 0, '0', '0', 'test.csv', 1)
        """,
        (
            EXCHANGE,
            MARKET,
            SYMBOL,
            INTERVAL,
            open_time,
            open,
            high,
            low,
            close,
            volume,
            open_time + 59_999,
        ),
    )


@pytest.fixture()
def fixture_db(tmp_path: Path) -> Path:
    path = tmp_path / "market.db"
    conn = sqlite3.connect(path)
    conn.executescript(CANDLES_SCHEMA)
    # 10 aligned 1m candles starting 2017-08-17 04:00 UTC
    base = 1_502_942_400_000
    prices = [
        ("4261.48000000", "4261.48000000", "4261.48000000", "4261.48000000", "1.77518300"),
        ("4261.48000000", "4261.48000000", "4260.00000000", "4260.11000000", "0.50000000"),
        ("4260.11000000", "4280.56000000", "4260.11000000", "4280.56000000", "0.26107400"),
        ("4280.56000000", "4280.56000000", "4270.00000000", "4271.00000000", "1.00000000"),
        ("4271.00000000", "4275.00000000", "4270.50000000", "4274.25000000", "2.25000000"),
        ("4274.25000000", "4290.00000000", "4274.25000000", "4288.00000000", "3.10000000"),
        ("4288.00000000", "4288.00000000", "4288.00000000", "4288.00000000", "0.00000000"),
        ("4288.00000000", "4300.00000000", "4287.00000000", "4299.50000000", "4.00000000"),
        ("4299.50000000", "4310.00000000", "4298.00000000", "4305.00000000", "5.50000000"),
        ("4305.00000000", "4305.00000000", "4290.00000000", "4291.11000000", "1.25000000"),
    ]
    for index, (open_, high, low, close, volume) in enumerate(prices):
        insert_candle(conn, base + index * 60_000, open_, high, low, close, volume)

    # Gap: skip 10 minutes, then 3 more aligned candles
    after_gap = base + 20 * 60_000
    insert_candle(conn, after_gap, "4400.00000000", "4410.00000000", "4399.00000000", "4405.00000000", "8.00000000")
    insert_candle(conn, after_gap + 60_000, "4405.00000000", "4420.00000000", "4405.00000000", "4418.00000000", "9.00000000")
    insert_candle(conn, after_gap + 120_000, "4418.00000000", "4418.00000000", "4410.00000000", "4412.00000000", "1.50000000")

    # Known historical offset regime (20799 ms) — original open_time, not rounded
    offset_base = 1_512_367_220_799
    insert_candle(conn, offset_base, "11478.00000000", "11478.00000000", "11478.00000000", "11478.00000000", "0.00000000")
    insert_candle(conn, offset_base + 60_000, "11478.00000000", "11490.00000000", "11470.00000000", "11485.50000000", "12.34000000")
    insert_candle(conn, offset_base + 120_000, "11485.50000000", "11500.00000000", "11480.00000000", "11490.00000000", "3.00000000")

    conn.commit()
    conn.close()
    return path


@pytest.fixture()
def settings(fixture_db: Path, tmp_path: Path) -> Settings:
    return Settings(
        database_path=fixture_db,
        frontend_dist=tmp_path / "missing-dist",
        cache_path=tmp_path / "aggregate_cache.db",
    )


@pytest.fixture()
def repository(fixture_db: Path) -> CandleRepository:
    repo = CandleRepository(fixture_db)
    try:
        yield repo
    finally:
        repo.close()


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
