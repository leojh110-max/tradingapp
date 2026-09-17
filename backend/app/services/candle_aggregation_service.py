"""Build higher-timeframe candles from unmodified Master Dataset 1m rows.

Grouping uses UTC calendar buckets. Source open_time values are never rewritten.
Missing 1m candles are never synthesized. Replay cutoff is applied to source
rows before OHLCV is computed so later 1m data cannot leak into a bucket.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from decimal import Decimal

from app.config import SUPPORTED_EXCHANGE, SUPPORTED_MARKET, SUPPORTED_SYMBOL
from app.models import Candle
from app.repositories import CandleRepository
from app.timeframes import (
    SOURCE_INTERVAL,
    expected_source_count,
    interval_ms,
    utc_bucket_end_inclusive,
    utc_bucket_start,
)

_SOURCE_SERIES = {
    "exchange": SUPPORTED_EXCHANGE,
    "market": SUPPORTED_MARKET,
    "symbol": SUPPORTED_SYMBOL,
    "interval": SOURCE_INTERVAL,
}


def aggregate_ohlcv_rows(rows: Iterable[tuple[int, str, str, str, str, str]], interval: str) -> list[Candle]:
    """Stream source OHLCV tuples into UTC higher-timeframe candles."""
    if interval == SOURCE_INTERVAL:
        return [
            Candle(open_time=open_time, open=open_, high=high, low=low, close=close, volume=volume)
            for open_time, open_, high, low, close, volume in rows
        ]
    tf_ms = interval_ms(interval)
    buckets: list[Candle] = []
    current_start: int | None = None
    current: list[tuple[int, str, str, str, str, str]] = []
    for row in rows:
        start = utc_bucket_start(row[0], tf_ms)
        if current_start is None:
            current_start = start
            current = [row]
            continue
        if start == current_start:
            current.append(row)
            continue
        buckets.append(_reduce_bucket_rows(current, current_start, interval))
        current_start = start
        current = [row]
    if current and current_start is not None:
        buckets.append(_reduce_bucket_rows(current, current_start, interval))
    return buckets


def aggregate_source_candles(candles: Sequence[Candle], interval: str) -> list[Candle]:
    """Group already-fetched 1m candles into UTC higher-timeframe buckets."""
    if interval == SOURCE_INTERVAL:
        return list(candles)
    return aggregate_ohlcv_rows(
        (
            (candle.open_time, candle.open, candle.high, candle.low, candle.close, candle.volume)
            for candle in candles
        ),
        interval,
    )


def _reduce_bucket_rows(
    source: Sequence[tuple[int, str, str, str, str, str]],
    bucket_start: int,
    interval: str,
) -> Candle:
    expected = expected_source_count(interval)
    actual = len(source)
    high_row = max(source, key=lambda row: Decimal(row[2]))
    low_row = min(source, key=lambda row: Decimal(row[3]))
    volume = sum((Decimal(row[5]) for row in source), Decimal(0))
    return Candle(
        open_time=bucket_start,
        open=source[0][1],
        high=high_row[2],
        low=low_row[3],
        close=source[-1][4],
        volume=format(volume, "f"),
        source_candle_count=actual,
        expected_candle_count=expected,
        complete=actual == expected,
    )


class CandleAggregationService:
    def __init__(self, repository: CandleRepository) -> None:
        self._repository = repository

    def get_candles(
        self,
        *,
        interval: str,
        from_open_time: int | None,
        to_open_time: int | None,
        limit: int,
        cutoff: int | None,
        series_first: int | None,
        series_last: int | None,
    ) -> list[Candle]:
        if series_first is None or series_last is None:
            return []
        source_from, source_to = source_query_window(
            interval=interval,
            from_open_time=from_open_time,
            to_open_time=to_open_time,
            limit=limit,
            cutoff=cutoff,
            series_first=series_first,
            series_last=series_last,
        )
        if source_from > source_to:
            return []
        source = self._repository.iter_ohlcv_range(
            **_SOURCE_SERIES,
            from_open_time=source_from,
            to_open_time=source_to,
        )
        aggregated = aggregate_ohlcv_rows(source, interval)
        if from_open_time is None:
            return aggregated[-limit:] if len(aggregated) > limit else aggregated
        return aggregated[:limit]


def source_query_window(
    *,
    interval: str,
    from_open_time: int | None,
    to_open_time: int | None,
    limit: int,
    cutoff: int | None,
    series_first: int,
    series_last: int,
) -> tuple[int, int]:
    """Bounded 1m range covering `limit` UTC buckets.

    `to` is expanded to the last bucket end so a partial window cannot build a
    partial higher-timeframe candle. `cutoff` is a hard source ceiling and is
    never expanded past (no look-ahead).
    """
    tf_ms = interval_ms(interval)
    end_for_bucket = series_last
    if to_open_time is not None:
        end_for_bucket = min(end_for_bucket, to_open_time)
    if cutoff is not None:
        end_for_bucket = min(end_for_bucket, cutoff)

    last_bucket = utc_bucket_start(end_for_bucket, tf_ms)
    if from_open_time is None:
        first_bucket = last_bucket - (limit - 1) * tf_ms
    else:
        first_bucket = utc_bucket_start(from_open_time, tf_ms)
        last_bucket = min(last_bucket, first_bucket + (limit - 1) * tf_ms)

    source_from = first_bucket
    source_to = utc_bucket_end_inclusive(last_bucket, tf_ms)
    if cutoff is not None:
        source_to = min(source_to, cutoff)
    source_to = min(source_to, series_last)
    source_from = max(source_from, series_first)
    return source_from, source_to
