from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.cache.builder import AggregationCacheBuilder
from app.cache.db import connect_cache_writable
from app.cache.fingerprint import capture_master_fingerprint
from app.cache.repository import AggregationCacheRepository
from app.cache.schema import (
    META_POLICY_VERSION,
    META_SCHEMA_VERSION,
    META_STATUS,
    CacheState,
    policy_version,
    schema_version,
)
from app.cache.validate import validate_cache_integrity
from app.config import DEFAULT_CANDLE_LIMIT, MAX_CANDLE_LIMIT, SUPPORTED_EXCHANGE, SUPPORTED_MARKET, SUPPORTED_SYMBOL
from app.models import Candle
from app.repositories import CandleRepository
from app.services.market_data_service import MarketDataService
from app.timeframes import CACHED_INTERVALS, interval_ms, last_complete_bucket_start, utc_bucket_end_inclusive, utc_bucket_start
from tests.conftest import CANDLES_SCHEMA, insert_candle


def _service(repository: CandleRepository, cache=None) -> MarketDataService:
    return MarketDataService(
        repository,
        default_limit=DEFAULT_CANDLE_LIMIT,
        max_limit=MAX_CANDLE_LIMIT,
        cache=cache,
    )


def _build_cache(repository: CandleRepository, cache_path: Path) -> AggregationCacheRepository:
    fingerprint = capture_master_fingerprint(repository.database_path, repository)
    AggregationCacheBuilder(repository, cache_path).build(fingerprint=fingerprint, progress=lambda _msg: None)
    return AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)


def test_last_complete_bucket_start_excludes_partial_hour():
    hour = 3_600_000
    start = 1_640_995_200_000
    cutoff = start + 32 * 60_000
    assert utc_bucket_start(cutoff, hour) == start
    assert utc_bucket_end_inclusive(start, hour) > cutoff
    assert last_complete_bucket_start(cutoff, hour) == start - hour


def test_last_complete_bucket_start_includes_fully_ended_bucket():
    hour = 3_600_000
    start = 1_640_995_200_000
    cutoff = utc_bucket_end_inclusive(start, hour)
    assert last_complete_bucket_start(cutoff, hour) == start


def test_cache_missing_is_not_ready(tmp_path: Path, repository: CandleRepository):
    cache = AggregationCacheRepository(tmp_path / "missing.db", expected_fingerprint=capture_master_fingerprint(repository.database_path, repository))
    assert cache.status().state is CacheState.MISSING
    assert cache.is_ready() is False
    cache.close()


def test_htf_works_without_cache(repository: CandleRepository):
    service = _service(repository)
    _, interval, rows = service.get_candles(
        symbol="BTCUSDT",
        interval="5m",
        from_open_time=1_502_942_400_000,
        to_open_time=1_502_942_400_000 + 300_000,
        limit=10,
    )
    assert interval == "5m"
    assert len(rows) >= 1
    assert rows[0].open_time == 1_502_942_400_000


def test_cache_schema_metadata_and_ready(repository: CandleRepository, tmp_path: Path):
    cache_path = tmp_path / "aggregate_cache.db"
    cache = _build_cache(repository, cache_path)
    status = cache.status()
    assert status.state is CacheState.READY
    assert status.schema_version == schema_version()
    assert status.policy_version == policy_version()
    assert set(status.candle_counts) == set(CACHED_INTERVALS)
    assert all(count >= 1 for count in status.candle_counts.values())
    conn = connect_cache_writable(cache_path)
    try:
        report = validate_cache_integrity(conn)
        assert report.ok, report
        assert report.checks["duplicate_keys"] == 0
        assert report.checks["invalid_ohlc"] == 0
        assert report.checks["unsupported_intervals"] == []
        meta = {row[0]: row[1] for row in conn.execute("SELECT key, value FROM cache_meta")}
        assert meta[META_SCHEMA_VERSION] == schema_version()
        assert meta[META_POLICY_VERSION] == policy_version()
        assert meta[META_STATUS] == CacheState.READY.value
    finally:
        conn.close()
    cache.close()


def test_incomplete_build_is_not_ready(repository: CandleRepository, tmp_path: Path):
    cache_path = tmp_path / "aggregate_cache.db"
    cache = _build_cache(repository, cache_path)
    cache.close()
    conn = connect_cache_writable(cache_path)
    conn.execute("UPDATE cache_meta SET value = ? WHERE key = ?", (CacheState.BUILDING.value, META_STATUS))
    conn.commit()
    conn.close()
    fingerprint = capture_master_fingerprint(repository.database_path, repository)
    reopened = AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)
    assert reopened.status().state is CacheState.BUILDING
    assert reopened.is_ready() is False
    service = _service(repository, cache=reopened)
    _, _, cached_skipped = service.get_candles(
        symbol="BTCUSDT",
        interval="5m",
        from_open_time=1_502_942_400_000,
        to_open_time=None,
        limit=10,
    )
    live = _service(repository)
    _, _, expected = live.get_candles(
        symbol="BTCUSDT",
        interval="5m",
        from_open_time=1_502_942_400_000,
        to_open_time=None,
        limit=10,
    )
    assert [row.open_time for row in cached_skipped] == [row.open_time for row in expected]
    reopened.close()


def test_stale_fingerprint_is_not_used(repository: CandleRepository, tmp_path: Path):
    cache_path = tmp_path / "aggregate_cache.db"
    cache = _build_cache(repository, cache_path)
    cache.close()
    conn = connect_cache_writable(cache_path)
    conn.execute("UPDATE cache_meta SET value = '0' WHERE key = 'master_mtime'")
    conn.commit()
    conn.close()
    fingerprint = capture_master_fingerprint(repository.database_path, repository)
    stale = AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)
    assert stale.status().state is CacheState.STALE
    assert stale.is_ready() is False
    stale.close()


def test_schema_mismatch_is_invalid(repository: CandleRepository, tmp_path: Path):
    cache_path = tmp_path / "aggregate_cache.db"
    cache = _build_cache(repository, cache_path)
    cache.close()
    conn = connect_cache_writable(cache_path)
    conn.execute("UPDATE cache_meta SET value = '99' WHERE key = ?", (META_SCHEMA_VERSION,))
    conn.commit()
    conn.close()
    fingerprint = capture_master_fingerprint(repository.database_path, repository)
    invalid = AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)
    assert invalid.status().state is CacheState.INVALID
    invalid.close()


def test_cache_query_matches_ondemand(repository: CandleRepository, tmp_path: Path):
    cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
    cached = _service(repository, cache=cache)
    live = _service(repository)
    for interval in CACHED_INTERVALS:
        _, _, cache_rows = cached.get_candles(
            symbol="BTCUSDT",
            interval=interval,
            from_open_time=None,
            to_open_time=None,
            limit=50,
        )
        _, _, live_rows = live.get_candles(
            symbol="BTCUSDT",
            interval=interval,
            from_open_time=None,
            to_open_time=None,
            limit=50,
        )
        assert _rows_equal(cache_rows, live_rows), interval
    cache.close()


def test_offset_20799_equivalence(repository: CandleRepository, tmp_path: Path):
    cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
    cached = _service(repository, cache=cache)
    live = _service(repository)
    start = 1_512_367_220_799
    for interval in ("5m", "15m", "1h"):
        _, _, cache_rows = cached.get_candles(
            symbol="BTCUSDT",
            interval=interval,
            from_open_time=start - 60_000,
            to_open_time=start + 180_000,
            limit=20,
        )
        _, _, live_rows = live.get_candles(
            symbol="BTCUSDT",
            interval=interval,
            from_open_time=start - 60_000,
            to_open_time=start + 180_000,
            limit=20,
        )
        assert _rows_equal(cache_rows, live_rows), interval
        if cache_rows:
            assert cache_rows[0].open_time == utc_bucket_start(start, interval_ms(interval))
    cache.close()


def test_offset_14789_equivalence(tmp_path: Path):
    path = tmp_path / "offset14789.db"
    conn = sqlite3.connect(path)
    conn.executescript(CANDLES_SCHEMA)
    start = 1_518_170_354_789
    for index in range(6):
        insert_candle(
            conn,
            start + index * 60_000,
            "100.00000000",
            "101.00000000",
            "99.00000000",
            "100.50000000",
            "1.25000000",
        )
    conn.commit()
    conn.close()
    repository = CandleRepository(path)
    try:
        cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
        cached = _service(repository, cache=cache)
        live = _service(repository)
        for interval in ("5m", "15m", "1h"):
            _, _, cache_rows = cached.get_candles(
                symbol="BTCUSDT",
                interval=interval,
                from_open_time=start,
                to_open_time=start + 360_000,
                limit=20,
            )
            _, _, live_rows = live.get_candles(
                symbol="BTCUSDT",
                interval=interval,
                from_open_time=start,
                to_open_time=start + 360_000,
                limit=20,
            )
            assert _rows_equal(cache_rows, live_rows), interval
            if cache_rows:
                assert cache_rows[0].open_time == utc_bucket_start(start, interval_ms(interval))
        cache.close()
    finally:
        repository.close()


def test_gap_equivalence(repository: CandleRepository, tmp_path: Path):
    cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
    cached = _service(repository, cache=cache)
    live = _service(repository)
    _, _, cache_rows = cached.get_candles(
        symbol="BTCUSDT",
        interval="5m",
        from_open_time=1_502_942_400_000,
        to_open_time=1_502_943_720_000,
        limit=20,
    )
    _, _, live_rows = live.get_candles(
        symbol="BTCUSDT",
        interval="5m",
        from_open_time=1_502_942_400_000,
        to_open_time=1_502_943_720_000,
        limit=20,
    )
    assert _rows_equal(cache_rows, live_rows)
    incomplete = [row for row in cache_rows if row.complete is False]
    assert incomplete
    cache.close()


def test_duplicate_cache_key_rejected(repository: CandleRepository, tmp_path: Path):
    cache_path = tmp_path / "aggregate_cache.db"
    cache = _build_cache(repository, cache_path)
    cache.close()
    conn = connect_cache_writable(cache_path)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            """
            INSERT INTO aggregated_candles (
                exchange, market, symbol, interval, open_time,
                open, high, low, close, volume,
                source_candle_count, expected_candle_count, complete
            ) VALUES (?, ?, ?, '5m', 1502942400000, '1', '1', '1', '1', '1', 1, 5, 0)
            """,
            (SUPPORTED_EXCHANGE, SUPPORTED_MARKET, SUPPORTED_SYMBOL),
        )
    conn.close()


def test_master_stays_readonly_during_cache_build(fixture_db: Path, tmp_path: Path):
    before = (fixture_db.stat().st_size, int(fixture_db.stat().st_mtime))
    repository = CandleRepository(fixture_db)
    try:
        cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
        cache.close()
    finally:
        repository.close()
    after = (fixture_db.stat().st_size, int(fixture_db.stat().st_mtime))
    assert before == after


def test_cutoff_full_bucket_uses_cache(tmp_path: Path):
    db_path, hour_start = _hour_db(tmp_path)
    repository = CandleRepository(db_path)
    try:
        cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
        cached = _service(repository, cache=cache)
        live = _service(repository)
        cutoff = utc_bucket_end_inclusive(hour_start, interval_ms("1h"))
        _, _, cache_rows = cached.get_candles(
            symbol="BTCUSDT",
            interval="1h",
            from_open_time=None,
            to_open_time=None,
            limit=5,
            cutoff=cutoff,
        )
        _, _, live_rows = live.get_candles(
            symbol="BTCUSDT",
            interval="1h",
            from_open_time=None,
            to_open_time=None,
            limit=5,
            cutoff=cutoff,
        )
        assert _rows_equal(cache_rows, live_rows)
        assert len(cache_rows) == 1
        assert cache_rows[0].source_candle_count == 60
        assert cache_rows[0].complete is True
        cache.close()
    finally:
        repository.close()


def test_cutoff_partial_bucket_does_not_use_future_cache(tmp_path: Path):
    db_path, hour_start = _hour_db(tmp_path)
    repository = CandleRepository(db_path)
    try:
        cache = _build_cache(repository, tmp_path / "aggregate_cache.db")
        cached = _service(repository, cache=cache)
        live = _service(repository)
        cutoff = hour_start + 32 * 60_000
        _, _, cache_rows = cached.get_candles(
            symbol="BTCUSDT",
            interval="1h",
            from_open_time=None,
            to_open_time=None,
            limit=5,
            cutoff=cutoff,
        )
        _, _, live_rows = live.get_candles(
            symbol="BTCUSDT",
            interval="1h",
            from_open_time=None,
            to_open_time=None,
            limit=5,
            cutoff=cutoff,
        )
        assert _rows_equal(cache_rows, live_rows)
        assert len(cache_rows) == 1
        assert cache_rows[0].open_time == hour_start
        assert cache_rows[0].source_candle_count == 33
        assert cache_rows[0].complete is False
        full = cache.get_candles(
            exchange=SUPPORTED_EXCHANGE,
            market=SUPPORTED_MARKET,
            symbol=SUPPORTED_SYMBOL,
            interval="1h",
            from_open_time=hour_start,
            to_open_time=hour_start,
            limit=1,
        )
        assert full[0].source_candle_count == 60
        assert cache_rows[0].source_candle_count < full[0].source_candle_count
        assert cache_rows[0].close != full[0].close
        cache.close()
    finally:
        repository.close()


def _hour_db(tmp_path: Path) -> tuple[Path, int]:
    path = tmp_path / "hour.db"
    conn = sqlite3.connect(path)
    conn.executescript(CANDLES_SCHEMA)
    hour_start = 1_640_995_200_000
    for index in range(60):
        insert_candle(
            conn,
            hour_start + index * 60_000,
            str(100 + index),
            str(100 + index + 1),
            str(100 + index - 1),
            str(100 + index + 0.5),
            "1.00000000",
        )
    conn.commit()
    conn.close()
    return path, hour_start


def _rows_equal(left: list[Candle], right: list[Candle]) -> bool:
    if len(left) != len(right):
        return False
    for a, b in zip(left, right, strict=True):
        if (
            a.open_time != b.open_time
            or a.open != b.open
            or a.high != b.high
            or a.low != b.low
            or a.close != b.close
            or a.volume != b.volume
            or a.source_candle_count != b.source_candle_count
            or a.expected_candle_count != b.expected_candle_count
            or a.complete != b.complete
        ):
            return False
    return True
