"""CandleRepository — read-only access to the Phase 1 Master Dataset.

Does not alter timestamps, fill gaps, or convert OHLCV TEXT values to float.
Range queries always filter by exchange/market/symbol/interval and open_time.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db import connect_readonly
from app.models import Candle, MarketInfo

_SERIES_FILTER = "exchange = ? AND market = ? AND symbol = ? AND interval = ?"

_CANDLE_SELECT = """
SELECT open_time, open, high, low, close, volume
FROM candles
WHERE exchange = ? AND market = ? AND symbol = ? AND interval = ?
"""


class CandleRepository:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._conn = connect_readonly(database_path)

    @property
    def connection(self) -> sqlite3.Connection:
        return self._conn

    def close(self) -> None:
        self._conn.close()

    def get_market_info(
        self,
        *,
        exchange: str,
        market: str,
        symbol: str,
        interval: str,
        base_asset: str,
        quote_asset: str,
        api_exchange: str,
        api_market: str,
    ) -> MarketInfo:
        row = self._conn.execute(
            f"""
            SELECT
                COUNT(*) AS candle_count,
                MIN(open_time) AS first_open_time,
                MAX(open_time) AS last_open_time
            FROM candles
            WHERE {_SERIES_FILTER}
            """,
            (exchange, market, symbol, interval),
        ).fetchone()
        count = int(row["candle_count"]) if row else 0
        first = int(row["first_open_time"]) if row and row["first_open_time"] is not None else None
        last = int(row["last_open_time"]) if row and row["last_open_time"] is not None else None
        return MarketInfo(
            exchange=api_exchange,
            market=api_market,
            symbol=symbol,
            base_asset=base_asset,
            quote_asset=quote_asset,
            interval=interval,
            first_open_time=first,
            last_open_time=last,
            candle_count=count,
        )

    def get_series_bounds(
        self,
        *,
        exchange: str,
        market: str,
        symbol: str,
        interval: str,
    ) -> tuple[int | None, int | None]:
        row = self._conn.execute(
            f"""
            SELECT MIN(open_time) AS first_open_time, MAX(open_time) AS last_open_time
            FROM candles
            WHERE {_SERIES_FILTER}
            """,
            (exchange, market, symbol, interval),
        ).fetchone()
        first = int(row["first_open_time"]) if row and row["first_open_time"] is not None else None
        last = int(row["last_open_time"]) if row and row["last_open_time"] is not None else None
        return first, last

    def iter_ohlcv_range(
        self,
        *,
        exchange: str,
        market: str,
        symbol: str,
        interval: str,
        from_open_time: int,
        to_open_time: int,
        batch_size: int = 50_000,
    ):
        """Yield (open_time, open, high, low, close, volume) in [from, to]."""
        sql = (
            _CANDLE_SELECT
            + " AND open_time >= ? AND open_time <= ? ORDER BY open_time"
        )
        cursor = self._conn.execute(
            sql,
            (exchange, market, symbol, interval, from_open_time, to_open_time),
        )
        while True:
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break
            for row in rows:
                yield (
                    int(row["open_time"]),
                    str(row["open"]),
                    str(row["high"]),
                    str(row["low"]),
                    str(row["close"]),
                    str(row["volume"]),
                )

    def iter_candles_range(
        self,
        *,
        exchange: str,
        market: str,
        symbol: str,
        interval: str,
        from_open_time: int,
        to_open_time: int,
        batch_size: int = 50_000,
    ):
        """Yield 1m (or stored) candles in [from, to] using batched range queries.

        Does not load the full series. Callers must pass a bounded window.
        """
        if batch_size < 1:
            raise ValueError("batch_size must be >= 1")
        cursor = from_open_time
        while cursor <= to_open_time:
            batch = self.get_candles(
                exchange=exchange,
                market=market,
                symbol=symbol,
                interval=interval,
                from_open_time=cursor,
                to_open_time=to_open_time,
                limit=batch_size,
            )
            if not batch:
                break
            yield from batch
            next_cursor = batch[-1].open_time + 1
            if len(batch) < batch_size or next_cursor > to_open_time:
                break
            cursor = next_cursor

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
        """Return at most `limit` candles in chronological order.

        Query shape is chosen so the frontend never needs the full 4.7M series:

        - from is None: last `limit` candles with open_time <= to (or series end).
          Used for initial load, pan-left, and future replay cutoff.
        - from is set: first `limit` candles with open_time >= from (and <= to).
          Used for pan-right / filling a window from a start time.
        """
        params: list[object] = [exchange, market, symbol, interval]
        sql = _CANDLE_SELECT
        if from_open_time is None:
            if to_open_time is not None:
                sql += " AND open_time <= ?"
                params.append(to_open_time)
            sql += " ORDER BY open_time DESC LIMIT ?"
            params.append(limit)
            rows = self._conn.execute(sql, params).fetchall()
            rows.reverse()
        else:
            sql += " AND open_time >= ?"
            params.append(from_open_time)
            if to_open_time is not None:
                sql += " AND open_time <= ?"
                params.append(to_open_time)
            sql += " ORDER BY open_time ASC LIMIT ?"
            params.append(limit)
            rows = self._conn.execute(sql, params).fetchall()
        return [_row_to_candle(row) for row in rows]


def _row_to_candle(row: sqlite3.Row) -> Candle:
    return Candle(
        open_time=int(row["open_time"]),
        open=str(row["open"]),
        high=str(row["high"]),
        low=str(row["low"]),
        close=str(row["close"]),
        volume=str(row["volume"]),
    )
