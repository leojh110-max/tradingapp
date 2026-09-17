"""Read access to derived HTF candles in aggregate_cache.db."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from app.cache.fingerprint import MasterFingerprint
from app.cache.schema import (
    META_MASTER_CANDLE_COUNT,
    META_MASTER_FILE_SIZE,
    META_MASTER_FIRST_OPEN_TIME,
    META_MASTER_LAST_OPEN_TIME,
    META_MASTER_MTIME,
    META_POLICY_VERSION,
    META_SCHEMA_VERSION,
    META_STATUS,
    CacheState,
    policy_version,
    schema_version,
)
from app.db import connect_readonly
from app.models import Candle

_SELECT = """
SELECT open_time, open, high, low, close, volume,
       source_candle_count, expected_candle_count, complete
FROM aggregated_candles
WHERE exchange = ? AND market = ? AND symbol = ? AND interval = ?
"""


@dataclass(frozen=True)
class CacheStatus:
    state: CacheState
    reason: str
    candle_counts: dict[str, int]
    fingerprint: MasterFingerprint | None = None
    schema_version: str | None = None
    policy_version: str | None = None


class AggregationCacheRepository:
    def __init__(
        self,
        cache_path: Path,
        expected_fingerprint: MasterFingerprint | None = None,
    ) -> None:
        self.cache_path = cache_path
        self._expected = expected_fingerprint
        self._conn: sqlite3.Connection | None = None

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def is_ready(self) -> bool:
        return self._evaluate_state(include_counts=False).state is CacheState.READY

    def status(self) -> CacheStatus:
        return self._evaluate_state(include_counts=True)

    def _evaluate_state(self, *, include_counts: bool) -> CacheStatus:
        if not self.cache_path.exists():
            self.close()
            return CacheStatus(CacheState.MISSING, "cache file is not present", {})
        conn = self._connection()
        if conn is None:
            return CacheStatus(CacheState.INVALID, "cache file could not be opened", {})
        try:
            meta = _read_meta(conn)
        except sqlite3.Error:
            return CacheStatus(CacheState.INVALID, "cache metadata is unreadable", {})
        stored_schema = meta.get(META_SCHEMA_VERSION)
        stored_policy = meta.get(META_POLICY_VERSION)
        stored_state = meta.get(META_STATUS)
        counts = _interval_counts(conn) if include_counts else {}
        fingerprint = _fingerprint_from_meta(meta)
        if stored_schema != schema_version():
            return CacheStatus(
                CacheState.INVALID,
                f"schema version mismatch ({stored_schema!r} != {schema_version()!r})",
                counts,
                fingerprint,
                stored_schema,
                stored_policy,
            )
        if stored_state == CacheState.BUILDING.value:
            return CacheStatus(
                CacheState.BUILDING,
                "cache build is incomplete",
                counts,
                fingerprint,
                stored_schema,
                stored_policy,
            )
        if stored_policy != policy_version():
            return CacheStatus(
                CacheState.STALE,
                f"aggregation policy mismatch ({stored_policy!r} != {policy_version()!r})",
                counts,
                fingerprint,
                stored_schema,
                stored_policy,
            )
        if self._expected is not None and fingerprint is not None and fingerprint != self._expected:
            return CacheStatus(
                CacheState.STALE,
                "master dataset fingerprint does not match this cache",
                counts,
                fingerprint,
                stored_schema,
                stored_policy,
            )
        if self._expected is not None and fingerprint is None:
            return CacheStatus(
                CacheState.INVALID,
                "cache is missing master fingerprint metadata",
                counts,
                None,
                stored_schema,
                stored_policy,
            )
        if stored_state != CacheState.READY.value:
            return CacheStatus(
                CacheState.INVALID,
                f"cache status is {stored_state!r}",
                counts,
                fingerprint,
                stored_schema,
                stored_policy,
            )
        return CacheStatus(
            CacheState.READY,
            "cache is ready",
            counts,
            fingerprint,
            stored_schema,
            stored_policy,
        )

    def get_candles(
        self,
        *,
        exchange: str,
        market: str,
        symbol: str,
        interval: str,
        from_open_time: int | None,
        to_open_time: int | None,
        limit: int,
    ) -> list[Candle]:
        conn = self._connection()
        if conn is None:
            return []
        params: list[object] = [exchange, market, symbol, interval]
        sql = _SELECT
        if from_open_time is None:
            if to_open_time is not None:
                sql += " AND open_time <= ?"
                params.append(to_open_time)
            sql += " ORDER BY open_time DESC LIMIT ?"
            params.append(limit)
            rows = conn.execute(sql, params).fetchall()
            rows.reverse()
        else:
            sql += " AND open_time >= ?"
            params.append(from_open_time)
            if to_open_time is not None:
                sql += " AND open_time <= ?"
                params.append(to_open_time)
            sql += " ORDER BY open_time ASC LIMIT ?"
            params.append(limit)
            rows = conn.execute(sql, params).fetchall()
        return [_row_to_candle(row) for row in rows]

    def _connection(self) -> sqlite3.Connection | None:
        if self._conn is not None:
            return self._conn
        if not self.cache_path.exists():
            return None
        try:
            self._conn = connect_readonly(self.cache_path)
        except (FileNotFoundError, sqlite3.Error, OSError):
            self._conn = None
        return self._conn


def _read_meta(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute("SELECT key, value FROM cache_meta").fetchall()
    return {str(row["key"]): str(row["value"]) for row in rows}


def _interval_counts(conn: sqlite3.Connection) -> dict[str, int]:
    try:
        rows = conn.execute(
            "SELECT interval, COUNT(*) AS n FROM aggregated_candles GROUP BY interval"
        ).fetchall()
    except sqlite3.Error:
        return {}
    return {str(row["interval"]): int(row["n"]) for row in rows}


def _fingerprint_from_meta(meta: dict[str, str]) -> MasterFingerprint | None:
    try:
        return MasterFingerprint(
            file_size=int(meta[META_MASTER_FILE_SIZE]),
            mtime=int(meta[META_MASTER_MTIME]),
            candle_count=int(meta[META_MASTER_CANDLE_COUNT]),
            first_open_time=int(meta[META_MASTER_FIRST_OPEN_TIME]),
            last_open_time=int(meta[META_MASTER_LAST_OPEN_TIME]),
        )
    except (KeyError, ValueError, TypeError):
        return None


def _row_to_candle(row: sqlite3.Row) -> Candle:
    return Candle(
        open_time=int(row["open_time"]),
        open=str(row["open"]),
        high=str(row["high"]),
        low=str(row["low"]),
        close=str(row["close"]),
        volume=str(row["volume"]),
        source_candle_count=int(row["source_candle_count"]),
        expected_candle_count=int(row["expected_candle_count"]),
        complete=bool(row["complete"]),
    )
