from __future__ import annotations

from fastapi import APIRouter, Request

from app.services import MarketDataService

router = APIRouter()


def _service(request: Request) -> MarketDataService:
    return request.app.state.service


@router.get("/health")
def health(request: Request) -> dict[str, object]:
    return _service(request).health()
