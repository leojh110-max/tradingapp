from __future__ import annotations

import sqlite3

import pytest

from app.db import connect_readonly


def test_readonly_connection_succeeds(fixture_db):
    conn = connect_readonly(fixture_db)
    row = conn.execute("SELECT COUNT(*) AS n FROM candles").fetchone()
    assert int(row["n"]) == 16
    conn.close()


def test_readonly_connection_rejects_writes(fixture_db):
    conn = connect_readonly(fixture_db)
    with pytest.raises(sqlite3.OperationalError, match="readonly|query_only"):
        conn.execute("UPDATE candles SET open = open")
    conn.close()


def test_readonly_connection_rejects_delete(fixture_db):
    conn = connect_readonly(fixture_db)
    with pytest.raises(sqlite3.OperationalError):
        conn.execute("DELETE FROM candles")
    conn.close()
