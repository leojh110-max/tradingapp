from __future__ import annotations

from decimal import Decimal

from app.models import Candle
from app.services.candle_aggregation_service import aggregate_source_candles, source_query_window
from app.timeframes import TIMEFRAME_MS, expected_source_count, utc_bucket_start


def _c(open_time: int, open: str, high: str, low: str, close: str, volume: str) -> Candle:
    return Candle(open_time=open_time, open=open, high=high, low=low, close=close, volume=volume)


def _minute(base: int, index: int, **values: str) -> Candle:
    defaults = {
        "open": "10.00000000",
        "high": "11.00000000",
        "low": "9.00000000",
        "close": "10.50000000",
        "volume": "1.00000000",
    }
    defaults.update(values)
    return _c(base + index * 60_000, **defaults)


def test_utc_bucket_starts():
    ts = 1_640_995_380_000  # 2022-01-01 00:03 UTC
    assert utc_bucket_start(ts, TIMEFRAME_MS["5m"]) == 1_640_995_200_000  # 00:00
    assert utc_bucket_start(ts, TIMEFRAME_MS["15m"]) == 1_640_995_200_000
    assert utc_bucket_start(ts, TIMEFRAME_MS["1h"]) == 1_640_995_200_000
    assert utc_bucket_start(ts, TIMEFRAME_MS["4h"]) == 1_640_995_200_000
    assert utc_bucket_start(ts, TIMEFRAME_MS["1d"]) == 1_640_995_200_000
    assert utc_bucket_start(1_640_996_100_000, TIMEFRAME_MS["15m"]) == 1_640_996_100_000  # 00:15
    assert utc_bucket_start(1_640_997_000_000, TIMEFRAME_MS["30m"]) == 1_640_997_000_000  # 00:30
    assert utc_bucket_start(1_641_009_600_000, TIMEFRAME_MS["4h"]) == 1_641_009_600_000  # 04:00


def test_5m_aggregation_ohlcv_and_decimal_volume():
    base = 1_502_942_400_000
    rows = [
        _minute(base, 0, open="4261.48000000", high="4261.48000000", low="4261.48000000", close="4261.48000000", volume="1.77518300"),
        _minute(base, 1, open="4261.48000000", high="4261.48000000", low="4261.48000000", close="4261.48000000", volume="0.00000000"),
        _minute(base, 2, open="4280.56000000", high="4280.56000000", low="4280.56000000", close="4280.56000000", volume="0.26107400"),
        _minute(base, 3, open="4261.48000000", high="4261.48000000", low="4261.48000000", close="4261.48000000", volume="0.01200800"),
        _minute(base, 4, open="4261.48000000", high="4261.48000000", low="4261.48000000", close="4261.48000000", volume="0.14079600"),
    ]
    out = aggregate_source_candles(rows, "5m")
    assert len(out) == 1
    candle = out[0]
    assert candle.open_time == base
    assert candle.open == "4261.48000000"
    assert candle.high == "4280.56000000"
    assert candle.low == "4261.48000000"
    assert candle.close == "4261.48000000"
    assert candle.volume == "2.18906100"
    assert Decimal(candle.volume) == sum(Decimal(row.volume) for row in rows)
    assert candle.source_candle_count == 5
    assert candle.expected_candle_count == 5
    assert candle.complete is True


def test_each_supported_higher_timeframe_bucket_size():
    base = 1_640_995_200_000
    for interval, tf_ms in TIMEFRAME_MS.items():
        if interval == "1m":
            continue
        count = expected_source_count(interval)
        rows = [_minute(base, i, high=str(i + 1), low="1", close=str(i), volume="0.1") for i in range(count)]
        out = aggregate_source_candles(rows, interval)
        assert len(out) == 1, interval
        assert out[0].open_time == base
        assert out[0].source_candle_count == count
        assert out[0].complete is True
        assert out[0].close == str(count - 1)
        assert utc_bucket_start(base + tf_ms - 1, tf_ms) == base


def test_gap_does_not_synthesize_missing_minutes():
    base = 1_502_942_400_000
    rows = [_minute(base, 0), _minute(base, 1), _minute(base, 3), _minute(base, 4)]
    out = aggregate_source_candles(rows, "5m")
    assert len(out) == 1
    assert out[0].source_candle_count == 4
    assert out[0].expected_candle_count == 5
    assert out[0].complete is False
    assert out[0].open_time == base


def test_offset_timestamp_is_grouped_not_rewritten():
    offset = 1_512_367_220_799
    aligned = 1_512_367_200_000
    source = _c(offset, "11478.00000000", "11478.00000000", "11478.00000000", "11478.00000000", "0.00000000")
    out = aggregate_source_candles([source], "5m")
    assert source.open_time == offset
    assert offset % 60_000 == 20_799
    assert out[0].open_time == aligned
    assert out[0].source_candle_count == 1
    assert out[0].complete is False


def test_transition_overlap_keeps_both_source_rows():
    aligned = _c(1_512_367_200_000, "1", "2", "1", "2", "0.28948500")
    offset = _c(1_512_367_220_799, "2", "2", "2", "2", "0.00000000")
    rows = [
        aligned,
        offset,
        _c(1_512_367_280_799, "2", "3", "2", "3", "0"),
        _c(1_512_367_340_799, "3", "3", "2", "3", "0"),
        _c(1_512_367_400_799, "3", "3", "2", "3", "0"),
        _c(1_512_367_460_799, "3", "3", "2", "3", "0"),
    ]
    out = aggregate_source_candles(rows, "5m")
    assert len(out) == 1
    assert out[0].open_time == 1_512_367_200_000
    assert out[0].source_candle_count == 6
    assert out[0].complete is False
    assert aligned.open_time == 1_512_367_200_000
    assert offset.open_time == 1_512_367_220_799


def test_cutoff_is_hard_ceiling_not_expanded():
    source_from, source_to = source_query_window(
        interval="1h",
        from_open_time=None,
        to_open_time=None,
        limit=1,
        cutoff=1_640_995_200_000 + 32 * 60_000,  # 00:32
        series_first=1_640_995_200_000,
        series_last=1_640_998_800_000,
    )
    assert source_to == 1_640_995_200_000 + 32 * 60_000
    assert source_to < 1_640_995_200_000 + 3_600_000


def test_request_window_expands_to_bucket_edges():
    ten_03 = 1_640_995_200_000 + 3 * 60_000
    eleven_02 = 1_640_995_200_000 + 62 * 60_000
    source_from, source_to = source_query_window(
        interval="5m",
        from_open_time=ten_03,
        to_open_time=eleven_02,
        limit=1500,
        cutoff=None,
        series_first=1_640_995_200_000,
        series_last=1_641_000_000_000,
    )
    assert source_from == 1_640_995_200_000  # 10:00 / 00:00 in this epoch sample
    # 11:02 is in 11:00 5m? 00:00 + 62m = 01:02, 5m bucket 01:00, end 01:04:59.999
    last_bucket = utc_bucket_start(eleven_02, TIMEFRAME_MS["5m"])
    assert last_bucket == 1_640_995_200_000 + 60 * 60_000  # 01:00
    assert source_to == last_bucket + TIMEFRAME_MS["5m"] - 1


def test_limit_caps_output_bucket_window_not_source_minutes():
    source_from, source_to = source_query_window(
        interval="1h",
        from_open_time=None,
        to_open_time=None,
        limit=3,
        cutoff=None,
        series_first=1_000_000_000_000,
        series_last=1_640_998_800_000,  # 01:00
    )
    span = source_to - source_from
    assert span < 4 * 3_600_000
    assert span >= 2 * 3_600_000


def test_cutoff_excludes_future_source_from_bucket():
    base = 1_640_995_200_000
    rows = []
    for i in range(60):
        high = "100.00000000" if i == 40 else "50.00000000"  # 00:40
        close = "80.00000000" if i == 40 else "40.00000000"
        if i == 50:  # 00:50 — after cutoff 00:32, a spike that must not leak
            high = "999.00000000"
            close = "999.00000000"
        rows.append(_minute(base, i, high=high, close=close, volume="1.00000000"))
    cutoff = base + 32 * 60_000
    allowed = [row for row in rows if row.open_time <= cutoff]
    out = aggregate_source_candles(allowed, "1h")
    assert len(out) == 1
    assert out[0].high != "999.00000000"
    assert out[0].close != "999.00000000"
    assert out[0].complete is False
    assert out[0].source_candle_count == 33


def test_1d_bucket_is_utc_midnight():
    ts = 1_640_995_200_000 + 12 * 3_600_000 + 30 * 60_000  # 12:30 UTC
    assert utc_bucket_start(ts, TIMEFRAME_MS["1d"]) == 1_640_995_200_000


def test_empty_buckets_are_not_emitted():
    base = 1_502_942_400_000
    rows = [_minute(base, 0), _minute(base, 10)]
    out = aggregate_source_candles(rows, "5m")
    assert [row.open_time for row in out] == [base, base + 10 * 60_000]
