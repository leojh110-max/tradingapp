"""MarketDataService — validation and query orchestration.

Frontend never sees SQLite schema. Replay Mode can later pass `cutoff` so the
backend returns only candles with open_time <= cutoff. This is a server-side
filter, not a chart/CSS hide. For higher timeframes, cutoff is applied to
source 1m rows before aggregation.
"""

from __future__ import annotations

from app.config import (
    API_EXCHANGE,
    API_MARKET,
    MAX_CANDLE_LIMIT,
    SUPPORTED_EXCHANGE,
    SUPPORTED_MARKET,
    SUPPORTED_SYMBOL,
)
from app.models import Candle, MarketInfo
from app.repositories import CandleRepository
from app.services.candle_aggregation_service import CandleAggregationService
from app.timeframes import (
    SOURCE_INTERVAL,
    SUPPORTED_INTERVALS,
    interval_ms,
    last_complete_bucket_start,
    utc_bucket_end_inclusive,
    utc_bucket_start,
)

_SYMBOL_ASSETS: dict[str, tuple[str, str]] = {
    SUPPORTED_SYMBOL: ("BTC", "USDT"),
}


class MarketDataError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class MarketDataService:
    def __init__(
        self,
        repository: CandleRepository,
        *,
        default_limit: int,
        max_limit: int = MAX_CANDLE_LIMIT,
        cache=None,
        source_bounds: tuple[int | None, int | None] | None = None,
    ) -> None:
        self._repository = repository
        self._aggregator = CandleAggregationService(repository)
        self._cache = cache
        self._default_limit = default_limit
        self._max_limit = max_limit
        self._source_bounds = source_bounds

    def health(self) -> dict[str, object]:
        self._repository.connection.execute("SELECT 1").fetchone()
        return {"status": "ok", "offline": True}

    def get_market_info(self, symbol: str | None = None, interval: str | None = None) -> MarketInfo:
        resolved_symbol = self._require_symbol(symbol or SUPPORTED_SYMBOL)
        resolved_interval = self._require_interval(interval or SOURCE_INTERVAL)
        base_asset, quote_asset = _SYMBOL_ASSETS[resolved_symbol]
        source = self._repository.get_market_info(
            exchange=SUPPORTED_EXCHANGE,
            market=SUPPORTED_MARKET,
            symbol=resolved_symbol,
            interval=SOURCE_INTERVAL,
            base_asset=base_asset,
            quote_asset=quote_asset,
            api_exchange=API_EXCHANGE,
            api_market=API_MARKET,
        )
        first = source.first_open_time
        last = source.last_open_time
        if resolved_interval != SOURCE_INTERVAL and first is not None and last is not None:
            tf_ms = interval_ms(resolved_interval)
            first = utc_bucket_start(first, tf_ms)
            last = utc_bucket_start(last, tf_ms)
        return MarketInfo(
            exchange=source.exchange,
            market=source.market,
            symbol=source.symbol,
            base_asset=source.base_asset,
            quote_asset=source.quote_asset,
            interval=resolved_interval,
            first_open_time=first,
            last_open_time=last,
            candle_count=source.candle_count,
            source_interval=SOURCE_INTERVAL,
            source_candle_count=source.candle_count,
        )

    def get_candles(
        self,
        *,
        symbol: str,
        interval: str,
        from_open_time: int | None,
        to_open_time: int | None,
        limit: int | None,
        cutoff: int | None = None,
    ) -> tuple[str, str, list[Candle]]:
        resolved_symbol = self._require_symbol(symbol)
        resolved_interval = self._require_interval(interval)
        resolved_limit = self._require_limit(limit)
        resolved_from = self._require_optional_time(from_open_time, "from")
        resolved_to = self._require_optional_time(to_open_time, "to")
        resolved_cutoff = self._require_optional_time(cutoff, "cutoff")

        effective_to = resolved_to
        if resolved_cutoff is not None:
            if effective_to is None or resolved_cutoff < effective_to:
                effective_to = resolved_cutoff

        if resolved_from is not None and effective_to is not None and resolved_from > effective_to:
            raise MarketDataError("invalid_range", "Parameter 'from' must be less than or equal to 'to'/cutoff")

        if resolved_interval == SOURCE_INTERVAL:
            candles = self._repository.get_candles(
                exchange=SUPPORTED_EXCHANGE,
                market=SUPPORTED_MARKET,
                symbol=resolved_symbol,
                interval=SOURCE_INTERVAL,
                from_open_time=resolved_from,
                to_open_time=effective_to,
                limit=resolved_limit,
            )
            return resolved_symbol, resolved_interval, candles

        source_first, source_last = self._source_series_bounds()
        candles = self._htf_candles(
            interval=resolved_interval,
            from_open_time=resolved_from,
            to_open_time=resolved_to,
            limit=resolved_limit,
            cutoff=resolved_cutoff,
            series_first=source_first,
            series_last=source_last,
        )
        return resolved_symbol, resolved_interval, candles

    def _htf_candles(
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
        if self._cache is not None and self._cache.is_ready():
            try:
                return self._htf_from_cache(
                    interval=interval,
                    from_open_time=from_open_time,
                    to_open_time=to_open_time,
                    limit=limit,
                    cutoff=cutoff,
                    series_first=series_first,
                    series_last=series_last,
                )
            except Exception:
                pass
        return self._aggregator.get_candles(
            interval=interval,
            from_open_time=from_open_time,
            to_open_time=to_open_time,
            limit=limit,
            cutoff=cutoff,
            series_first=series_first,
            series_last=series_last,
        )

    def _htf_from_cache(
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

        cache_to = last_bucket
        partial_bucket: int | None = None
        if cutoff is not None and utc_bucket_end_inclusive(last_bucket, tf_ms) > cutoff:
            partial_bucket = last_bucket
            cache_to = last_complete_bucket_start(cutoff, tf_ms)

        cached = self._cache.get_candles(
            exchange=SUPPORTED_EXCHANGE,
            market=SUPPORTED_MARKET,
            symbol=SUPPORTED_SYMBOL,
            interval=interval,
            from_open_time=first_bucket,
            to_open_time=cache_to,
            limit=limit,
        )
        extra: list[Candle] = []
        if partial_bucket is not None and partial_bucket >= first_bucket:
            extra = self._aggregator.get_candles(
                interval=interval,
                from_open_time=partial_bucket,
                to_open_time=partial_bucket,
                limit=1,
                cutoff=cutoff,
                series_first=series_first,
                series_last=series_last,
            )
            extra = [row for row in extra if row.open_time == partial_bucket]
            if extra and cached and cached[-1].open_time == extra[0].open_time:
                cached = cached[:-1]
        merged = cached + extra
        if from_open_time is None:
            return merged[-limit:] if len(merged) > limit else merged
        return merged[:limit]

    def _source_series_bounds(self) -> tuple[int | None, int | None]:
        if self._source_bounds is None:
            self._source_bounds = self._repository.get_series_bounds(
                exchange=SUPPORTED_EXCHANGE,
                market=SUPPORTED_MARKET,
                symbol=SUPPORTED_SYMBOL,
                interval=SOURCE_INTERVAL,
            )
        return self._source_bounds

    def _require_symbol(self, symbol: str) -> str:
        normalized = symbol.strip().upper()
        if normalized != SUPPORTED_SYMBOL:
            raise MarketDataError("unsupported_symbol", f"Unsupported symbol: {symbol}")
        return normalized

    def _require_interval(self, interval: str) -> str:
        normalized = interval.strip()
        if normalized not in SUPPORTED_INTERVALS:
            raise MarketDataError("unsupported_interval", f"Unsupported interval: {interval}")
        return normalized

    def _require_limit(self, limit: int | None) -> int:
        if limit is None:
            return self._default_limit
        if limit < 1:
            raise MarketDataError("invalid_limit", "Parameter 'limit' must be >= 1")
        if limit > self._max_limit:
            raise MarketDataError(
                "invalid_limit",
                f"Parameter 'limit' must be <= {self._max_limit}",
            )
        return limit

    def _require_optional_time(self, value: int | None, name: str) -> int | None:
        if value is None:
            return None
        if value < 0:
            raise MarketDataError("invalid_range", f"Parameter '{name}' must be a non-negative unix millisecond timestamp")
        return value
