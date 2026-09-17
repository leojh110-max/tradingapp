"""Real market.db aggregation regression tests (read-only)."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, default_database_path
from app.db import connect_readonly
from app.main import create_app
from app.timeframes import TIMEFRAME_MS, utc_bucket_start

pytestmark = pytest.mark.smoke

OFFSET_20799 = 1_512_367_220_799
OFFSET_14789 = 1_518_170_354_789
FIRST_1M = 1_502_942_400_000
MID_1M = 1_640_995_200_000
LAST_1M = 1_789_516_740_000
GAP_BEFORE = 1_529_978_340_000  # 2018-06-26 01:59
GAP_AFTER = 1_530_014_400_000  # 2018-06-26 12:00


@pytest.fixture(scope="module")
def market_db_path() -> Path:
    path = default_database_path()
    if not path.exists():
        pytest.skip(f"Master dataset not found: {path}")
    return path


@pytest.fixture(scope="module")
def smoke_client(market_db_path: Path) -> TestClient:
    app = create_app(Settings(database_path=market_db_path))
    with TestClient(app) as client:
        yield client


def _source_bucket(market_db_path: Path, bucket_start: int, interval: str) -> list[dict[str, object]]:
    tf_ms = TIMEFRAME_MS[interval]
    conn = connect_readonly(market_db_path)
    try:
        rows = conn.execute(
            """
            SELECT open_time, open, high, low, close, volume
            FROM candles
            WHERE exchange = 'BINANCE' AND market = 'SPOT'
              AND symbol = 'BTCUSDT' AND interval = '1m'
              AND open_time >= ? AND open_time < ?
            ORDER BY open_time
            """,
            (bucket_start, bucket_start + tf_ms),
        ).fetchall()
        return [
            {
                "openTime": int(row["open_time"]),
                "open": str(row["open"]),
                "high": str(row["high"]),
                "low": str(row["low"]),
                "close": str(row["close"]),
                "volume": str(row["volume"]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def _manual_ohlcv(rows: list[dict[str, object]]) -> dict[str, object]:
    volume = sum((Decimal(str(row["volume"])) for row in rows), Decimal(0))
    high_row = max(rows, key=lambda row: Decimal(str(row["high"])))
    low_row = min(rows, key=lambda row: Decimal(str(row["low"])))
    return {
        "open": rows[0]["open"],
        "high": high_row["high"],
        "low": low_row["low"],
        "close": rows[-1]["close"],
        "volume": format(volume, "f"),
    }


def _api_bucket(client: TestClient, interval: str, bucket_start: int) -> dict[str, object]:
    body = client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": interval,
            "from": bucket_start,
            "to": bucket_start,
            "limit": 1,
        },
    ).json()
    assert body["candles"], f"missing {interval} candle at {bucket_start}"
    return body["candles"][0]


def _assert_match(interval: str, bucket_start: int, client: TestClient, market_db_path: Path) -> dict[str, object]:
    source = _source_bucket(market_db_path, bucket_start, interval)
    assert source, f"no 1m source for {interval} {bucket_start}"
    expected = _manual_ohlcv(source)
    api_row = _api_bucket(client, interval, bucket_start)
    assert api_row["openTime"] == bucket_start
    assert api_row["open"] == expected["open"]
    assert api_row["high"] == expected["high"]
    assert api_row["low"] == expected["low"]
    assert api_row["close"] == expected["close"]
    assert api_row["volume"] == expected["volume"]
    assert api_row["sourceCandleCount"] == len(source)
    assert api_row["expectedCandleCount"] == TIMEFRAME_MS[interval] // 60_000
    assert api_row["complete"] is (len(source) == api_row["expectedCandleCount"])
    return api_row


def test_offset_1m_timestamps_unchanged_in_master_db(market_db_path: Path):
    conn = connect_readonly(market_db_path)
    try:
        for ts, offset in ((OFFSET_20799, 20_799), (OFFSET_14789, 14_789)):
            row = conn.execute(
                """
                SELECT open_time FROM candles
                WHERE exchange = 'BINANCE' AND market = 'SPOT'
                  AND symbol = 'BTCUSDT' AND interval = '1m' AND open_time = ?
                """,
                (ts,),
            ).fetchone()
            assert int(row["open_time"]) == ts
            assert ts % 60_000 == offset
            assert ts != (ts // 60_000) * 60_000
    finally:
        conn.close()


def test_real_5m_early_history(smoke_client: TestClient, market_db_path: Path):
    row = _assert_match("5m", FIRST_1M, smoke_client, market_db_path)
    assert row["open"] == "4261.48000000"
    assert row["high"] == "4280.56000000"
    assert row["complete"] is True


def test_real_mid_history_multiple_timeframes(smoke_client: TestClient, market_db_path: Path):
    for interval in ("5m", "10m", "15m", "30m", "1h", "4h", "1d"):
        _assert_match(interval, utc_bucket_start(MID_1M, TIMEFRAME_MS[interval]), smoke_client, market_db_path)


def test_real_recent_1h_and_1d(smoke_client: TestClient, market_db_path: Path):
    _assert_match("1h", utc_bucket_start(LAST_1M, TIMEFRAME_MS["1h"]), smoke_client, market_db_path)
    _assert_match("1d", utc_bucket_start(LAST_1M, TIMEFRAME_MS["1d"]), smoke_client, market_db_path)


def test_real_offset_20799_bucket_assignment(smoke_client: TestClient, market_db_path: Path):
    bucket = utc_bucket_start(OFFSET_20799, TIMEFRAME_MS["5m"])
    assert bucket == 1_512_367_200_000
    source = _source_bucket(market_db_path, bucket, "5m")
    assert any(row["openTime"] == OFFSET_20799 for row in source)
    assert any(row["openTime"] == 1_512_367_200_000 for row in source)
    row = _assert_match("5m", bucket, smoke_client, market_db_path)
    assert row["sourceCandleCount"] == 6
    assert row["complete"] is False
    assert OFFSET_20799 == 1_512_367_220_799


def test_real_offset_14789_bucket_assignment(smoke_client: TestClient, market_db_path: Path):
    bucket = utc_bucket_start(OFFSET_14789, TIMEFRAME_MS["5m"])
    assert bucket == 1_518_170_100_000
    source = _source_bucket(market_db_path, bucket, "5m")
    assert source[0]["openTime"] == OFFSET_14789
    row = _assert_match("5m", bucket, smoke_client, market_db_path)
    assert row["sourceCandleCount"] == 1
    assert row["complete"] is False


def test_real_gap_1h_buckets_are_not_fabricated(smoke_client: TestClient, market_db_path: Path):
    body = smoke_client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": "1h",
            "from": utc_bucket_start(GAP_BEFORE, TIMEFRAME_MS["1h"]),
            "to": GAP_AFTER,
            "limit": 50,
        },
    ).json()
    times = [row["openTime"] for row in body["candles"]]
    hour = 3_600_000
    start = utc_bucket_start(GAP_BEFORE, hour)
    missing = [start + hour]  # 02:00
    # 02:00 through 11:00 should be absent
    for offset in range(1, 11):
        assert start + offset * hour not in times
    assert start in times
    assert utc_bucket_start(GAP_AFTER, hour) in times


def test_real_cutoff_1h_has_no_lookahead(smoke_client: TestClient, market_db_path: Path):
    hour = utc_bucket_start(MID_1M, TIMEFRAME_MS["1h"])
    cutoff = hour + 32 * 60_000
    allowed = _source_bucket(market_db_path, hour, "1h")
    allowed = [row for row in allowed if int(row["openTime"]) <= cutoff]
    future = [row for row in _source_bucket(market_db_path, hour, "1h") if int(row["openTime"]) > cutoff]
    assert future, "test requires 1m rows after cutoff inside the hour"
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1h", "from": hour, "to": hour, "limit": 1, "cutoff": cutoff},
    ).json()
    candle = body["candles"][0]
    expected = _manual_ohlcv(allowed)
    assert candle["high"] == expected["high"]
    assert candle["close"] == expected["close"]
    assert candle["complete"] is False
    assert candle["sourceCandleCount"] == len(allowed)
    assert int(candle["sourceCandleCount"]) < 60


def test_limit_is_higher_timeframe_count(smoke_client: TestClient):
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1h", "limit": 25},
    ).json()
    assert len(body["candles"]) == 25
    times = [row["openTime"] for row in body["candles"]]
    assert times == sorted(times)
    assert len(set(times)) == 25


def test_1m_payload_remains_without_required_meta(smoke_client: TestClient):
    body = smoke_client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": FIRST_1M, "to": FIRST_1M, "limit": 1},
    ).json()
    row = body["candles"][0]
    assert set(row) == {"openTime", "open", "high", "low", "close", "volume"}
