"""Build derived HTF candles using the Phase 2-B aggregation core.

One sequential 1m pass folds every cached interval. Source rows stay in the
Master Dataset; this writer only touches `aggregate_cache.db`.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from app.cache.db import connect_cache_writable
from app.cache.fingerprint import MasterFingerprint, capture_master_fingerprint
from app.cache.schema import (
    META_BUILT_AT,
    META_POLICY_VERSION,
    META_SCHEMA_VERSION,
    META_SOURCE_INTERVAL,
    META_STATUS,
    SCHEMA_SQL,
    CacheState,
    policy_version,
    schema_version,
)
from app.cache.validate import validate_cache_integrity
from app.config import SUPPORTED_EXCHANGE, SUPPORTED_MARKET, SUPPORTED_SYMBOL
from app.models import Candle
from app.repositories import CandleRepository
from app.services.candle_aggregation_service import reduce_bucket_rows
from app.timeframes import CACHED_INTERVALS, SOURCE_INTERVAL, interval_ms, utc_bucket_start

ProgressCallback = Callable[[str], None]

_INSERT_SQL = """
INSERT INTO aggregated_candles (
    exchange, market, symbol, interval, open_time,
    open, high, low, close, volume,
    source_candle_count, expected_candle_count, complete
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


class _IntervalFolder:
    def __init__(self, interval: str) -> None:
        self.interval = interval
        self.tf_ms = interval_ms(interval)
        self.current_start: int | None = None
        self.current_rows: list[tuple[int, str, str, str, str, str]] = []
        self.emitted = 0

    def push(self, row: tuple[int, str, str, str, str, str]) -> Candle | None:
        start = utc_bucket_start(row[0], self.tf_ms)
        if self.current_start is None:
            self.current_start = start
            self.current_rows = [row]
            return None
        if start == self.current_start:
            self.current_rows.append(row)
            return None
        candle = reduce_bucket_rows(self.current_rows, self.current_start, self.interval)
        self.current_start = start
        self.current_rows = [row]
        self.emitted += 1
        return candle

    def flush(self) -> Candle | None:
        if not self.current_rows or self.current_start is None:
            return None
        candle = reduce_bucket_rows(self.current_rows, self.current_start, self.interval)
        self.current_rows = []
        self.current_start = None
        self.emitted += 1
        return candle


class AggregationCacheBuilder:
    def __init__(self, repository: CandleRepository, cache_path: Path) -> None:
        self._repository = repository
        self._cache_path = cache_path

    def build(
        self,
        *,
        fingerprint: MasterFingerprint | None = None,
        progress: ProgressCallback | None = None,
        insert_batch_size: int = 5_000,
        progress_every: int = 250_000,
    ) -> dict[str, int]:
        resolved = fingerprint or capture_master_fingerprint(self._repository.database_path, self._repository)
        log = progress or (lambda _message: None)
        info = self._repository.get_market_info(
            exchange=SUPPORTED_EXCHANGE,
            market=SUPPORTED_MARKET,
            symbol=SUPPORTED_SYMBOL,
            interval=SOURCE_INTERVAL,
            base_asset="BTC",
            quote_asset="USDT",
            api_exchange="binance",
            api_market="spot",
        )
        if info.first_open_time is None or info.last_open_time is None or info.candle_count == 0:
            raise RuntimeError("Master Dataset has no 1m candles to cache")

        log(f"Building local chart cache from {info.candle_count:,} 1m candles...")
        started = time.perf_counter()
        conn = connect_cache_writable(self._cache_path)
        try:
            conn.executescript(SCHEMA_SQL)
            _upsert_meta(conn, META_SCHEMA_VERSION, schema_version())
            _upsert_meta(conn, META_POLICY_VERSION, policy_version())
            _upsert_meta(conn, META_SOURCE_INTERVAL, SOURCE_INTERVAL)
            _upsert_meta(conn, META_STATUS, CacheState.BUILDING.value)
            for key, value in resolved.as_meta().items():
                _upsert_meta(conn, key, value)
            conn.execute("DELETE FROM aggregated_candles")
            conn.commit()

            folders = [_IntervalFolder(interval) for interval in CACHED_INTERVALS]
            pending: list[tuple] = []
            source_count = 0
            source = self._repository.iter_ohlcv_range(
                exchange=SUPPORTED_EXCHANGE,
                market=SUPPORTED_MARKET,
                symbol=SUPPORTED_SYMBOL,
                interval=SOURCE_INTERVAL,
                from_open_time=info.first_open_time,
                to_open_time=info.last_open_time,
            )
            for row in source:
                source_count += 1
                for folder in folders:
                    candle = folder.push(row)
                    if candle is not None:
                        pending.append(_candle_params(candle, folder.interval))
                if len(pending) >= insert_batch_size:
                    conn.executemany(_INSERT_SQL, pending)
                    conn.commit()
                    pending.clear()
                if source_count % progress_every == 0:
                    pct = min(99, int(source_count * 100 / info.candle_count))
                    counts = "  ".join(f"{folder.interval} {folder.emitted:,}" for folder in folders)
                    log(f"{pct:>3}%  scanned {source_count:,}/{info.candle_count:,}  {counts}")

            for folder in folders:
                candle = folder.flush()
                if candle is not None:
                    pending.append(_candle_params(candle, folder.interval))
            if pending:
                conn.executemany(_INSERT_SQL, pending)
                conn.commit()

            integrity = validate_cache_integrity(conn)
            if not integrity.ok:
                _upsert_meta(conn, META_STATUS, CacheState.INVALID.value)
                conn.commit()
                raise RuntimeError(f"cache integrity failed: {integrity.reason}")

            _upsert_meta(conn, META_STATUS, CacheState.READY.value)
            _upsert_meta(conn, META_BUILT_AT, datetime.now(timezone.utc).isoformat())
            conn.commit()
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            elapsed = time.perf_counter() - started
            counts = {folder.interval: folder.emitted for folder in folders}
            log(f"Cache READY in {elapsed:.1f}s  " + "  ".join(f"{k} {v:,}" for k, v in counts.items()))
            return counts
        except Exception:
            try:
                _upsert_meta(conn, META_STATUS, CacheState.INVALID.value)
                conn.commit()
            except Exception:
                pass
            raise
        finally:
            conn.close()


def _candle_params(candle: Candle, interval: str) -> tuple[object, ...]:
    return (
        SUPPORTED_EXCHANGE,
        SUPPORTED_MARKET,
        SUPPORTED_SYMBOL,
        interval,
        candle.open_time,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
        candle.source_candle_count,
        candle.expected_candle_count,
        1 if candle.complete else 0,
    )


def _upsert_meta(conn, key: str, value: str) -> None:
    conn.execute(
        """
        INSERT INTO cache_meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (key, value),
    )
