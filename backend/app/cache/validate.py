"""Integrity checks for the derived aggregation cache."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import sqlite3

from app.timeframes import CACHED_INTERVALS, expected_source_count, interval_ms


@dataclass(frozen=True)
class IntegrityReport:
    ok: bool
    reason: str
    checks: dict[str, object]


def validate_cache_integrity(conn: sqlite3.Connection) -> IntegrityReport:
    checks: dict[str, object] = {}

    intervals = [
        str(row[0])
        for row in conn.execute("SELECT DISTINCT interval FROM aggregated_candles").fetchall()
    ]
    unsupported = sorted(set(intervals) - set(CACHED_INTERVALS))
    checks["unsupported_intervals"] = unsupported
    if unsupported:
        return IntegrityReport(False, f"unsupported intervals: {unsupported}", checks)

    missing = [name for name in CACHED_INTERVALS if name not in intervals]
    checks["missing_intervals"] = missing
    if missing:
        return IntegrityReport(False, f"missing cached intervals: {missing}", checks)

    duplicate = conn.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT exchange, market, symbol, interval, open_time, COUNT(*) AS n
            FROM aggregated_candles
            GROUP BY exchange, market, symbol, interval, open_time
            HAVING n > 1
        )
        """
    ).fetchone()[0]
    checks["duplicate_keys"] = int(duplicate)
    if duplicate:
        return IntegrityReport(False, "duplicate cache keys exist", checks)

    unordered = 0
    invalid_ohlc = 0
    bad_expected = 0
    for interval in CACHED_INTERVALS:
        tf_ms = interval_ms(interval)
        expected = expected_source_count(interval)
        previous = None
        rows = conn.execute(
            """
            SELECT open_time, open, high, low, close, volume,
                   source_candle_count, expected_candle_count, complete
            FROM aggregated_candles
            WHERE interval = ?
            ORDER BY open_time
            """,
            (interval,),
        )
        for row in rows:
            open_time = int(row["open_time"])
            if previous is not None and open_time <= previous:
                unordered += 1
            previous = open_time
            if int(row["expected_candle_count"]) != expected:
                bad_expected += 1
            if not _ohlc_valid(str(row["open"]), str(row["high"]), str(row["low"]), str(row["close"])):
                invalid_ohlc += 1
            if int(row["source_candle_count"]) < 1:
                invalid_ohlc += 1
            if open_time != (open_time // tf_ms) * tf_ms:
                unordered += 1

    checks["unordered_or_unaligned"] = unordered
    checks["invalid_ohlc"] = invalid_ohlc
    checks["bad_expected_count"] = bad_expected
    if unordered:
        return IntegrityReport(False, "cache rows are unordered or unaligned", checks)
    if invalid_ohlc:
        return IntegrityReport(False, "invalid OHLC rows exist", checks)
    if bad_expected:
        return IntegrityReport(False, "expected_candle_count does not match interval", checks)

    return IntegrityReport(True, "ok", checks)


def _ohlc_valid(open_: str, high: str, low: str, close: str) -> bool:
    try:
        open_d = Decimal(open_)
        high_d = Decimal(high)
        low_d = Decimal(low)
        close_d = Decimal(close)
    except InvalidOperation:
        return False
    return high_d >= low_d and high_d >= open_d and high_d >= close_d and low_d <= open_d and low_d <= close_d
