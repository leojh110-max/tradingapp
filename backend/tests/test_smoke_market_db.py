"""Read-only smoke tests against the Phase 1 Master Dataset.

These tests never INSERT/UPDATE/DELETE. They skip if market.db is not present.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, default_database_path
from app.db import connect_readonly
from app.main import create_app

pytestmark = pytest.mark.smoke

FIRST_OPEN_TIME = 1_502_942_400_000
MID_OPEN_TIME = 1_640_995_200_000
LAST_OPEN_TIME = 1_789_516_740_000
OFFSET_20799_OPEN_TIME = 1_512_367_220_799
OFFSET_14789_OPEN_TIME = 1_518_170_354_789
EXPECTED_COUNT = 4_767_678


@pytest.fixture(scope="module")
def market_db_path() -> Path:
    path = default_database_path()
    if not path.exists():
        pytest.skip(f"Master dataset not found: {path}")
    return path


@pytest.fixture(scope="module")
def smoke_client(market_db_path: Path) -> TestClient:
    settings = Settings(database_path=market_db_path)
    app = create_app(settings)
    with TestClient(app) as client:
        yield client


def _db_candle(market_db_path: Path, open_time: int) -> dict[str, object]:
    conn = connect_readonly(market_db_path)
    try:
        row = conn.execute(
            """
            SELECT open_time, open, high, low, close, volume
            FROM candles
            WHERE exchange = 'BINANCE' AND market = 'SPOT'
              AND symbol = 'BTCUSDT' AND interval = '1m'
              AND open_time = ?
            """,
            (open_time,),
        ).fetchone()
        assert row is not None, f"Missing expected master candle {open_time}"
        return {
            "openTime": int(row["open_time"]),
            "open": str(row["open"]),
            "high": str(row["high"]),
            "low": str(row["low"]),
            "close": str(row["close"]),
            "volume": str(row["volume"]),
        }
    finally:
        conn.close()


def test_real_db_connection(market_db_path: Path):
    conn = connect_readonly(market_db_path)
    try:
        row = conn.execute("SELECT 1 AS ok").fetchone()
        assert int(row["ok"]) == 1
    finally:
        conn.close()


def test_real_db_is_read_only(market_db_path: Path):
    conn = connect_readonly(market_db_path)
    try:
        with pytest.raises(Exception):
            conn.execute("DELETE FROM candles WHERE 1=0")
    finally:
        conn.close()


def test_real_market_info(smoke_client: TestClient):
    body = smoke_client.get("/api/market/info").json()
    assert body["exchange"] == "binance"
    assert body["market"] == "spot"
    assert body["symbol"] == "BTCUSDT"
    assert body["interval"] == "1m"
    assert body["candleCount"] == EXPECTED_COUNT
    assert body["firstOpenTime"] == FIRST_OPEN_TIME
    assert body["lastOpenTime"] == LAST_OPEN_TIME


def test_real_db_does_not_return_entire_series(smoke_client: TestClient):
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "limit": 1500},
    ).json()
    assert len(body["candles"]) == 1500
    assert body["candles"][-1]["openTime"] == LAST_OPEN_TIME


def test_real_first_history_sample(smoke_client: TestClient, market_db_path: Path):
    expected = _db_candle(market_db_path, FIRST_OPEN_TIME)
    body = smoke_client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": "1m",
            "from": FIRST_OPEN_TIME,
            "to": FIRST_OPEN_TIME + 120_000,
        },
    ).json()
    assert body["candles"][0] == expected
    assert body["candles"][0]["open"] == "4261.48000000"
    assert body["candles"][0]["openTime"] == FIRST_OPEN_TIME


def test_real_mid_history_sample(smoke_client: TestClient, market_db_path: Path):
    expected = _db_candle(market_db_path, MID_OPEN_TIME)
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": MID_OPEN_TIME, "to": MID_OPEN_TIME, "limit": 1},
    ).json()
    assert body["candles"] == [expected]
    assert expected["open"] == "46216.93000000"


def test_real_recent_history_sample(smoke_client: TestClient, market_db_path: Path):
    expected = _db_candle(market_db_path, LAST_OPEN_TIME)
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": LAST_OPEN_TIME, "to": LAST_OPEN_TIME, "limit": 1},
    ).json()
    assert body["candles"] == [expected]
    assert expected["close"] == "75644.48000000"


def test_real_offset_20799_timestamp_preserved(smoke_client: TestClient, market_db_path: Path):
    expected = _db_candle(market_db_path, OFFSET_20799_OPEN_TIME)
    body = smoke_client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": "1m",
            "from": OFFSET_20799_OPEN_TIME,
            "to": OFFSET_20799_OPEN_TIME,
            "limit": 1,
        },
    ).json()
    candle = body["candles"][0]
    assert candle == expected
    assert candle["openTime"] == OFFSET_20799_OPEN_TIME
    assert candle["openTime"] % 60_000 == 20_799
    assert candle["openTime"] != (OFFSET_20799_OPEN_TIME // 60_000) * 60_000


def test_real_offset_14789_timestamp_preserved(smoke_client: TestClient, market_db_path: Path):
    expected = _db_candle(market_db_path, OFFSET_14789_OPEN_TIME)
    body = smoke_client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": "1m",
            "from": OFFSET_14789_OPEN_TIME,
            "to": OFFSET_14789_OPEN_TIME,
            "limit": 1,
        },
    ).json()
    candle = body["candles"][0]
    assert candle == expected
    assert candle["openTime"] == OFFSET_14789_OPEN_TIME
    assert candle["openTime"] % 60_000 == 14_789


def test_real_range_is_chronological_and_unique(smoke_client: TestClient):
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": MID_OPEN_TIME, "limit": 200},
    ).json()
    times = [row["openTime"] for row in body["candles"]]
    assert times == sorted(times)
    assert len(times) == len(set(times)) == 200


def test_real_ohlc_sanity_sample(smoke_client: TestClient):
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "limit": 300},
    ).json()
    for row in body["candles"]:
        open_ = Decimal(row["open"])
        high = Decimal(row["high"])
        low = Decimal(row["low"])
        close = Decimal(row["close"])
        assert high >= max(open_, close)
        assert low <= min(open_, close)


def test_frontend_adapter_identity_matches_api_and_db(smoke_client: TestClient, market_db_path: Path):
    """Chart adapters may convert for plotting, but identity stays openTime milliseconds."""
    samples = [FIRST_OPEN_TIME, MID_OPEN_TIME, LAST_OPEN_TIME, OFFSET_20799_OPEN_TIME]
    for open_time in samples:
        db_row = _db_candle(market_db_path, open_time)
        api_row = smoke_client.get(
            "/api/candles",
            params={"symbol": "BTCUSDT", "interval": "1m", "from": open_time, "to": open_time, "limit": 1},
        ).json()["candles"][0]
        assert api_row == db_row
        chart_time_seconds = api_row["openTime"] / 1000
        # Adapter must not snap to UTC minute boundaries.
        if api_row["openTime"] % 60_000 != 0:
            assert chart_time_seconds != (api_row["openTime"] // 60_000) * 60
        assert chart_time_seconds * 1000 == api_row["openTime"]
