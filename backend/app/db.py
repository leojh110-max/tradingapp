"""Read-only SQLite connection helpers.

The Master Dataset must never be written by this application. Connections use
SQLite URI mode=ro plus PRAGMA query_only.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


def connect_readonly(database_path: Path) -> sqlite3.Connection:
    if not database_path.exists():
        raise FileNotFoundError(f"Market database not found: {database_path}")
    uri = f"file:{database_path.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    return conn
