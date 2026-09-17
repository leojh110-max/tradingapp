from __future__ import annotations

from decimal import Decimal

from app.config import SUPPORTED_EXCHANGE, SUPPORTED_INTERVAL, SUPPORTED_MARKET, SUPPORTED_SYMBOL
from app.repositories import CandleRepository


def test_market_info_from_repository(repository: CandleRepository):
    info = repository.get_market_info(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        base_asset="BTC",
        quote_asset="USDT",
        api_exchange="binance",
        api_market="spot",
    )
    assert info.candle_count == 16
    assert info.first_open_time == 1_502_942_400_000
    assert info.last_open_time == 1_512_367_220_799 + 120_000
    assert info.symbol == "BTCUSDT"
    assert info.interval == "1m"


def test_range_query_returns_window_only(repository: CandleRepository):
    start = 1_502_942_400_000
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=start,
        to_open_time=start + 3 * 60_000,
        limit=1500,
    )
    assert [c.open_time for c in candles] == [
        start,
        start + 60_000,
        start + 120_000,
        start + 180_000,
    ]
    assert all(isinstance(c.open, str) for c in candles)


def test_latest_window_without_from(repository: CandleRepository):
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=None,
        to_open_time=None,
        limit=3,
    )
    assert len(candles) == 3
    assert candles[0].open_time < candles[1].open_time < candles[2].open_time
    assert candles[-1].open_time == 1_512_367_340_799


def test_historical_prepend_uses_to_without_from(repository: CandleRepository):
    first_visible = 1_512_367_220_799
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=None,
        to_open_time=first_visible - 1,
        limit=2,
    )
    assert [c.open_time for c in candles] == [
        1_502_942_400_000 + 21 * 60_000,
        1_502_942_400_000 + 22 * 60_000,
    ]


def test_offset_timestamp_is_not_rounded(repository: CandleRepository):
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=1_512_367_220_799,
        to_open_time=1_512_367_220_799,
        limit=10,
    )
    assert len(candles) == 1
    assert candles[0].open_time == 1_512_367_220_799
    assert candles[0].open_time % 60_000 == 20_799


def test_ohlc_values_remain_original_text(repository: CandleRepository):
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=1_502_942_400_000,
        to_open_time=1_502_942_400_000,
        limit=1,
    )
    assert candles[0].open == "4261.48000000"
    assert candles[0].volume == "1.77518300"


def test_limit_is_enforced(repository: CandleRepository):
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=1_502_942_400_000,
        to_open_time=None,
        limit=4,
    )
    assert len(candles) == 4


def test_empty_range_returns_no_rows(repository: CandleRepository):
    start = 1_502_942_400_000 + 12 * 60_000
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=start,
        to_open_time=start + 60_000,
        limit=1500,
    )
    assert candles == []


def test_ohlc_sanity_on_fixture(repository: CandleRepository):
    candles = repository.get_candles(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SUPPORTED_INTERVAL,
        from_open_time=None,
        to_open_time=None,
        limit=5000,
    )
    for candle in candles:
        open_ = Decimal(candle.open)
        high = Decimal(candle.high)
        low = Decimal(candle.low)
        close = Decimal(candle.close)
        assert high >= open_
        assert high >= close
        assert low <= open_
        assert low <= close
        assert high >= low
