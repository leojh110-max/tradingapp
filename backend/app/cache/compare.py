"""Compare cached HTF candles with Phase 2-B on-demand aggregation."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import Candle
from app.services.market_data_service import MarketDataService
from app.timeframes import CACHED_INTERVALS

SAMPLE_WINDOWS: tuple[tuple[str, int | None, int | None, int], ...] = (
    ("latest", None, None, 80),
    ("early", 1_502_942_400_000, 1_502_950_000_000, 80),
    ("offset_20799", 1_512_367_220_799 - 60_000, 1_512_367_520_799, 40),
    ("offset_14789", 1_518_170_354_789 - 60_000, 1_518_242_354_789 + 60_000, 40),
    ("alignment_transition", 1_512_367_200_000 - 300_000, 1_512_367_560_000, 40),
    ("raw_gap", 1_529_978_340_000, 1_530_014_400_000, 80),
)


@dataclass(frozen=True)
class EquivalenceMismatch:
    interval: str
    window: str
    field: str
    cache_value: object
    on_demand_value: object
    open_time: int | None


def candles_equivalent(left: Candle, right: Candle) -> list[str]:
    mismatches: list[str] = []
    for field in (
        "open_time",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "source_candle_count",
        "expected_candle_count",
        "complete",
    ):
        if getattr(left, field) != getattr(right, field):
            mismatches.append(field)
    return mismatches


def compare_services(
    cached: MarketDataService,
    on_demand: MarketDataService,
    *,
    windows: tuple[tuple[str, int | None, int | None, int], ...] = SAMPLE_WINDOWS,
    intervals: tuple[str, ...] = CACHED_INTERVALS,
) -> list[EquivalenceMismatch]:
    mismatches: list[EquivalenceMismatch] = []
    for interval in intervals:
        for name, from_time, to_time, limit in windows:
            _, _, cache_rows = cached.get_candles(
                symbol="BTCUSDT",
                interval=interval,
                from_open_time=from_time,
                to_open_time=to_time,
                limit=limit,
            )
            _, _, live_rows = on_demand.get_candles(
                symbol="BTCUSDT",
                interval=interval,
                from_open_time=from_time,
                to_open_time=to_time,
                limit=limit,
            )
            if len(cache_rows) != len(live_rows):
                mismatches.append(
                    EquivalenceMismatch(
                        interval,
                        name,
                        "length",
                        len(cache_rows),
                        len(live_rows),
                        None,
                    )
                )
                continue
            for cache_row, live_row in zip(cache_rows, live_rows, strict=True):
                for field in candles_equivalent(cache_row, live_row):
                    mismatches.append(
                        EquivalenceMismatch(
                            interval,
                            name,
                            field,
                            getattr(cache_row, field),
                            getattr(live_row, field),
                            cache_row.open_time,
                        )
                    )
    return mismatches
