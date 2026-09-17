"""CLI: python -m app.cache status|build|validate|rebuild|benchmark"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from app.cache.builder import AggregationCacheBuilder
from app.cache.compare import compare_services
from app.cache.db import connect_cache_writable
from app.cache.fingerprint import capture_master_fingerprint, file_identity
from app.cache.repository import AggregationCacheRepository
from app.cache.schema import CacheState
from app.cache.validate import validate_cache_integrity
from app.config import DEFAULT_CANDLE_LIMIT, MAX_CANDLE_LIMIT, load_settings
from app.repositories import CandleRepository
from app.services.market_data_service import MarketDataService
from app.timeframes import CACHED_INTERVALS


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Derived HTF aggregation cache")
    parser.add_argument("command", choices=("status", "build", "validate", "rebuild", "benchmark"))
    args = parser.parse_args(argv)
    settings = load_settings()
    if args.command == "status":
        return _status(settings.database_path, settings.cache_path)
    if args.command == "build":
        return _build(settings.database_path, settings.cache_path, rebuild=False)
    if args.command == "rebuild":
        return _build(settings.database_path, settings.cache_path, rebuild=True)
    if args.command == "validate":
        return _validate(settings.database_path, settings.cache_path)
    return _benchmark(settings.database_path, settings.cache_path)


def _status(database_path: Path, cache_path: Path) -> int:
    size, mtime = file_identity(database_path)
    print(f"Master {database_path}")
    print(f"  size={size}  mtime={mtime}")
    print(f"Cache  {cache_path}")
    repository = CandleRepository(database_path)
    try:
        fingerprint = capture_master_fingerprint(database_path, repository)
        cache = AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)
        report = cache.status()
        print(f"  state={report.state.value}")
        print(f"  reason={report.reason}")
        if report.schema_version:
            print(f"  schema={report.schema_version}  policy={report.policy_version}")
        if report.fingerprint:
            fp = report.fingerprint
            print(
                "  stored fingerprint: "
                f"size={fp.file_size} mtime={fp.mtime} count={fp.candle_count} "
                f"first={fp.first_open_time} last={fp.last_open_time}"
            )
        if report.candle_counts:
            print("  candles: " + "  ".join(f"{k}={v:,}" for k, v in sorted(report.candle_counts.items())))
        cache.close()
    finally:
        repository.close()
    return 0 if report.state is CacheState.READY else 1


def _build(database_path: Path, cache_path: Path, *, rebuild: bool) -> int:
    before_size, before_mtime = file_identity(database_path)
    print(f"Master before: size={before_size} mtime={before_mtime}")
    if rebuild and cache_path.exists():
        for suffix in ("", "-wal", "-shm"):
            path = Path(str(cache_path) + suffix) if suffix else cache_path
            if path.exists():
                path.unlink()
                print(f"Removed {path}")
    repository = CandleRepository(database_path)
    try:
        fingerprint = capture_master_fingerprint(database_path, repository)
        builder = AggregationCacheBuilder(repository, cache_path)
        builder.build(fingerprint=fingerprint, progress=print)
    finally:
        repository.close()
    after_size, after_mtime = file_identity(database_path)
    print(f"Master after:  size={after_size} mtime={after_mtime}")
    if (before_size, before_mtime) != (after_size, after_mtime):
        print("ERROR: Master Dataset identity changed during cache build")
        return 2
    print(f"Cache size: {cache_path.stat().st_size} bytes")
    return 0


def _validate(database_path: Path, cache_path: Path) -> int:
    repository = CandleRepository(database_path)
    try:
        fingerprint = capture_master_fingerprint(database_path, repository)
        cache = AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)
        report = cache.status()
        print(f"status={report.state.value}  {report.reason}")
        if report.state is not CacheState.READY:
            cache.close()
            return 1
        writable = connect_cache_writable(cache_path)
        try:
            integrity = validate_cache_integrity(writable)
        finally:
            writable.close()
        print(f"integrity={integrity.ok}  {integrity.reason}  {integrity.checks}")
        if not integrity.ok:
            cache.close()
            return 1
        cached_service = MarketDataService(
            repository,
            default_limit=DEFAULT_CANDLE_LIMIT,
            max_limit=MAX_CANDLE_LIMIT,
            cache=cache,
        )
        live_service = MarketDataService(
            repository,
            default_limit=DEFAULT_CANDLE_LIMIT,
            max_limit=MAX_CANDLE_LIMIT,
            cache=None,
        )
        mismatches = compare_services(cached_service, live_service)
        if mismatches:
            print(f"equivalence FAILED ({len(mismatches)} mismatches)")
            for item in mismatches[:30]:
                print(
                    f"  {item.interval} {item.window} {item.field} "
                    f"cache={item.cache_value} on-demand={item.on_demand_value} open_time={item.open_time}"
                )
            cache.close()
            return 1
        print("equivalence OK across sample windows")
        cache.close()
    finally:
        repository.close()
    return 0


def _benchmark(database_path: Path, cache_path: Path) -> int:
    repository = CandleRepository(database_path)
    try:
        fingerprint = capture_master_fingerprint(database_path, repository)
        cache = AggregationCacheRepository(cache_path, expected_fingerprint=fingerprint)
        cached = MarketDataService(
            repository,
            default_limit=DEFAULT_CANDLE_LIMIT,
            max_limit=MAX_CANDLE_LIMIT,
            cache=cache,
        )
        live = MarketDataService(
            repository,
            default_limit=DEFAULT_CANDLE_LIMIT,
            max_limit=MAX_CANDLE_LIMIT,
            cache=None,
        )
        print(f"{'interval':<8} {'limit':>6} {'cache_ms':>12} {'ondemand_ms':>12} {'n':>6}")
        for interval in CACHED_INTERVALS:
            for limit in (400, 1500):
                cache_ms, cache_n = _time_request(cached, interval, limit)
                live_ms, live_n = _time_request(live, interval, limit)
                print(f"{interval:<8} {limit:>6} {cache_ms:>12.1f} {live_ms:>12.1f} {cache_n:>6}")
                if cache_n != live_n:
                    print(f"  warning: candle counts differ cache={cache_n} on-demand={live_n}")
        cache.close()
    finally:
        repository.close()
    return 0


def _time_request(service: MarketDataService, interval: str, limit: int) -> tuple[float, int]:
    # Warm SQLite page cache for this query shape, then measure the next call.
    service.get_candles(
        symbol="BTCUSDT",
        interval=interval,
        from_open_time=None,
        to_open_time=None,
        limit=limit,
    )
    started = time.perf_counter()
    _, _, rows = service.get_candles(
        symbol="BTCUSDT",
        interval=interval,
        from_open_time=None,
        to_open_time=None,
        limit=limit,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    return elapsed_ms, len(rows)


if __name__ == "__main__":
    sys.exit(main())
