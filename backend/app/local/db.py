"""Local SQLite database for testing without Supabase. Only used when LOCAL_MODE is on."""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "local_migrations"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def session(path: str) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("pragma foreign_keys = on")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def migrate(path: str) -> list[str]:
    """Apply any local_migrations/*.sql files that haven't run yet. Returns the names applied."""
    applied: list[str] = []
    with session(path) as conn:
        conn.execute("create table if not exists schema_migrations (name text primary key, applied_at text not null)")
        done = {row["name"] for row in conn.execute("select name from schema_migrations")}
        for file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if file.name in done:
                continue
            conn.executescript(file.read_text(encoding="utf-8"))
            conn.execute("insert into schema_migrations (name, applied_at) values (?, ?)", (file.name, now_iso()))
            applied.append(file.name)
    return applied
