"""FastAPI entrypoint for the offline candlestick training app."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.market import router as market_router
from app.config import Settings, load_settings
from app.repositories import CandleRepository
from app.services import MarketDataService


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        repository = CandleRepository(resolved.database_path)
        app.state.settings = resolved
        app.state.repository = repository
        app.state.service = MarketDataService(
            repository,
            default_limit=resolved.default_limit,
            max_limit=resolved.max_limit,
        )
        try:
            yield
        finally:
            repository.close()

    app = FastAPI(
        title="Offline Candlestick Training API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.cors_origins),
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(market_router, prefix="/api")
    _maybe_mount_frontend(app, resolved.frontend_dist)
    return app


def _maybe_mount_frontend(app: FastAPI, dist: Path) -> None:
    if dist.is_dir() and (dist / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")


app = create_app()
