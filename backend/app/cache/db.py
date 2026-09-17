"""Writable SQLite helpers for the derived cache only.

Never used for Master `market.db`.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


def connect_cache_writable(cache_path: Path) -> sqlite3.Connection:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(cache_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA temp_store = MEMORY")
    return conn
