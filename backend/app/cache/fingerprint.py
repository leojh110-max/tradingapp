"""Cheap Master Dataset fingerprint (no full-file hash)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.config import (
    API_EXCHANGE,
    API_MARKET,
    SUPPORTED_EXCHANGE,
    SUPPORTED_MARKET,
    SUPPORTED_SYMBOL,
)
from app.repositories import CandleRepository
from app.timeframes import SOURCE_INTERVAL


@dataclass(frozen=True)
class MasterFingerprint:
    file_size: int
    mtime: int
    candle_count: int
    first_open_time: int
    last_open_time: int

    def as_meta(self) -> dict[str, str]:
        return {
            "master_file_size": str(self.file_size),
            "master_mtime": str(self.mtime),
            "master_candle_count": str(self.candle_count),
            "master_first_open_time": str(self.first_open_time),
            "master_last_open_time": str(self.last_open_time),
        }


def file_identity(database_path: Path) -> tuple[int, int]:
    stat = database_path.stat()
    return int(stat.st_size), int(stat.st_mtime)


def capture_master_fingerprint(database_path: Path, repository: CandleRepository) -> MasterFingerprint:
    file_size, mtime = file_identity(database_path)
    info = repository.get_market_info(
        exchange=SUPPORTED_EXCHANGE,
        market=SUPPORTED_MARKET,
        symbol=SUPPORTED_SYMBOL,
        interval=SOURCE_INTERVAL,
        base_asset="BTC",
        quote_asset="USDT",
        api_exchange=API_EXCHANGE,
        api_market=API_MARKET,
    )
    return MasterFingerprint(
        file_size=file_size,
        mtime=mtime,
        candle_count=info.candle_count,
        first_open_time=int(info.first_open_time or 0),
        last_open_time=int(info.last_open_time or 0),
    )


def fingerprints_match(expected: MasterFingerprint, stored: MasterFingerprint) -> bool:
    return expected == stored
