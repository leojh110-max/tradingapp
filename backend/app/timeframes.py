"""Supported chart intervals and UTC bucket helpers.

`utc_bucket_start` is grouping only. It must never be written back onto a
Master Dataset 1m row.
"""

from __future__ import annotations

SOURCE_INTERVAL = "1m"
MINUTE_MS = 60_000

TIMEFRAME_MS: dict[str, int] = {
    "1m": 60_000,
    "5m": 300_000,
    "10m": 600_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
}

SUPPORTED_INTERVALS: tuple[str, ...] = tuple(TIMEFRAME_MS.keys())

CACHED_INTERVALS: tuple[str, ...] = tuple(
    name for name in SUPPORTED_INTERVALS if name != SOURCE_INTERVAL
)

CACHE_SCHEMA_VERSION = 1
AGGREGATION_POLICY_VERSION = "utc-calendar-v1"


def last_complete_bucket_start(cutoff_ms: int, timeframe_ms: int) -> int:
    """Highest HTF bucket whose full UTC range is at or before cutoff.

    A cached completed candle for this bucket cannot contain source rows after
    cutoff. The bucket that contains cutoff is never returned by this helper.
    """
    containing = utc_bucket_start(cutoff_ms, timeframe_ms)
    if utc_bucket_end_inclusive(containing, timeframe_ms) <= cutoff_ms:
        return containing
    return containing - timeframe_ms


def interval_ms(interval: str) -> int:
    try:
        return TIMEFRAME_MS[interval]
    except KeyError as exc:
        raise ValueError(f"Unsupported interval: {interval}") from exc


def expected_source_count(interval: str) -> int:
    return interval_ms(interval) // MINUTE_MS


def utc_bucket_start(open_time_ms: int, timeframe_ms: int) -> int:
    """Return the UTC calendar bucket start that contains `open_time_ms`."""
    if timeframe_ms <= 0:
        raise ValueError("timeframe_ms must be positive")
    return (open_time_ms // timeframe_ms) * timeframe_ms


def utc_bucket_end_inclusive(bucket_start: int, timeframe_ms: int) -> int:
    return bucket_start + timeframe_ms - 1
