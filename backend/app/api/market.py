from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from app.models import Candle, MarketInfo
from app.services import MarketDataError, MarketDataService

router = APIRouter()


def _service(request: Request) -> MarketDataService:
    return request.app.state.service


def _http_error(exc: MarketDataError) -> HTTPException:
    status = 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})


@router.get("/market/info")
def market_info(
    request: Request,
    symbol: str | None = Query(default=None),
    interval: str | None = Query(default=None),
) -> dict[str, object]:
    try:
        info = _service(request).get_market_info(symbol=symbol, interval=interval)
    except MarketDataError as exc:
        raise _http_error(exc) from exc
    return _market_info_payload(info)


@router.get("/candles")
def candles(
    request: Request,
    symbol: str = Query(...),
    interval: str = Query(...),
    from_time: int | None = Query(default=None, alias="from"),
    to_time: int | None = Query(default=None, alias="to"),
    limit: int | None = Query(default=None),
    cutoff: int | None = Query(
        default=None,
        description="Optional hard ceiling (open_time <= cutoff). Reserved for future Replay Mode.",
    ),
) -> dict[str, object]:
    try:
        resolved_symbol, resolved_interval, rows = _service(request).get_candles(
            symbol=symbol,
            interval=interval,
            from_open_time=from_time,
            to_open_time=to_time,
            limit=limit,
            cutoff=cutoff,
        )
    except MarketDataError as exc:
        raise _http_error(exc) from exc
    return {
        "symbol": resolved_symbol,
        "interval": resolved_interval,
        "candles": [_candle_payload(row) for row in rows],
    }


def _market_info_payload(info: MarketInfo) -> dict[str, object]:
    return {
        "exchange": info.exchange,
        "market": info.market,
        "symbol": info.symbol,
        "baseAsset": info.base_asset,
        "quoteAsset": info.quote_asset,
        "interval": info.interval,
        "firstOpenTime": info.first_open_time,
        "lastOpenTime": info.last_open_time,
        "candleCount": info.candle_count,
        "sourceInterval": info.source_interval,
        "sourceCandleCount": info.source_candle_count,
    }


def _candle_payload(candle: Candle) -> dict[str, object]:
    payload: dict[str, object] = {
        "openTime": candle.open_time,
        "open": candle.open,
        "high": candle.high,
        "low": candle.low,
        "close": candle.close,
        "volume": candle.volume,
    }
    if candle.source_candle_count is not None:
        payload["sourceCandleCount"] = candle.source_candle_count
    if candle.expected_candle_count is not None:
        payload["expectedCandleCount"] = candle.expected_candle_count
    if candle.complete is not None:
        payload["complete"] = candle.complete
    return payload
