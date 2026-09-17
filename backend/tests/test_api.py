from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient


def test_health(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "offline": True}


def test_market_info(client: TestClient):
    response = client.get("/api/market/info")
    assert response.status_code == 200
    body = response.json()
    assert body["exchange"] == "binance"
    assert body["market"] == "spot"
    assert body["symbol"] == "BTCUSDT"
    assert body["baseAsset"] == "BTC"
    assert body["quoteAsset"] == "USDT"
    assert body["interval"] == "1m"
    assert body["candleCount"] == 16
    assert body["firstOpenTime"] == 1_502_942_400_000
    assert body["lastOpenTime"] == 1_512_367_340_799


def test_candles_default_latest_window(client: TestClient):
    response = client.get("/api/candles", params={"symbol": "BTCUSDT", "interval": "1m", "limit": 5})
    assert response.status_code == 200
    body = response.json()
    candles = body["candles"]
    assert body["symbol"] == "BTCUSDT"
    assert body["interval"] == "1m"
    assert len(candles) == 5
    times = [row["openTime"] for row in candles]
    assert times == sorted(times)
    assert len(times) == len(set(times))
    assert all(isinstance(row["open"], str) for row in candles)
    assert all(isinstance(row["volume"], str) for row in candles)


def test_candles_range_query(client: TestClient):
    start = 1_502_942_400_000
    response = client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": "1m",
            "from": start,
            "to": start + 120_000,
            "limit": 1500,
        },
    )
    assert response.status_code == 200
    candles = response.json()["candles"]
    assert [row["openTime"] for row in candles] == [start, start + 60_000, start + 120_000]
    assert candles[0]["open"] == "4261.48000000"


def test_unsupported_symbol(client: TestClient):
    response = client.get("/api/candles", params={"symbol": "ETHUSDT", "interval": "1m"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "unsupported_symbol"


def test_unsupported_interval(client: TestClient):
    response = client.get("/api/candles", params={"symbol": "BTCUSDT", "interval": "3m"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "unsupported_interval"


def test_supported_higher_timeframe_is_not_rejected(client: TestClient):
    response = client.get("/api/candles", params={"symbol": "BTCUSDT", "interval": "5m", "limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["interval"] == "5m"
    assert len(body["candles"]) >= 1
    assert "sourceCandleCount" in body["candles"][0]
    assert "expectedCandleCount" in body["candles"][0]
    assert "complete" in body["candles"][0]


def test_invalid_from_to(client: TestClient):
    response = client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": 200, "to": 100},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_range"


def test_negative_from(client: TestClient):
    response = client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": -1},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_range"


def test_empty_range(client: TestClient):
    start = 1_502_942_400_000 + 12 * 60_000
    response = client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": start, "to": start + 60_000},
    )
    assert response.status_code == 200
    assert response.json()["candles"] == []


def test_limit_enforced(client: TestClient):
    response = client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "from": 1_502_942_400_000, "limit": 3},
    )
    assert response.status_code == 200
    assert len(response.json()["candles"]) == 3


def test_limit_above_max_rejected(client: TestClient):
    response = client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "limit": 5001},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_limit"


def test_cutoff_excludes_future_candles(client: TestClient):
    cutoff = 1_502_942_400_000 + 2 * 60_000
    response = client.get(
        "/api/candles",
        params={"symbol": "BTCUSDT", "interval": "1m", "limit": 50, "cutoff": cutoff},
    )
    assert response.status_code == 200
    candles = response.json()["candles"]
    assert candles
    assert all(row["openTime"] <= cutoff for row in candles)
    assert candles[-1]["openTime"] == cutoff


def test_offset_timestamp_passthrough(client: TestClient):
    response = client.get(
        "/api/candles",
        params={
            "symbol": "BTCUSDT",
            "interval": "1m",
            "from": 1_512_367_220_799,
            "to": 1_512_367_340_799,
        },
    )
    times = [row["openTime"] for row in response.json()["candles"]]
    assert times == [1_512_367_220_799, 1_512_367_280_799, 1_512_367_340_799]


def test_no_duplicate_open_times(client: TestClient):
    response = client.get("/api/candles", params={"symbol": "BTCUSDT", "interval": "1m", "limit": 50})
    times = [row["openTime"] for row in response.json()["candles"]]
    assert times == sorted(times)
    assert len(times) == len(set(times))


def test_ohlc_sanity(client: TestClient):
    response = client.get("/api/candles", params={"symbol": "BTCUSDT", "interval": "1m", "limit": 50})
    for row in response.json()["candles"]:
        open_ = Decimal(row["open"])
        high = Decimal(row["high"])
        low = Decimal(row["low"])
        close = Decimal(row["close"])
        assert high >= max(open_, close)
        assert low <= min(open_, close)
