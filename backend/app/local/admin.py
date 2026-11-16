"""A built-in admin account for local mode, so the app can be tried without signing up.

Sign in with username `admin` (or email `admin@boardplayable.local`) and password `admin123`.
Local mode only: the password is public, so this must never exist in production.
"""

import sqlite3

from .bot import ensure_bot_friend
from .db import now_iso
from .passwords import hash_password

ADMIN_ID = "00000000-0000-4000-8000-0000000ad000"
ADMIN_EMAIL = "admin@boardplayable.local"
ADMIN_NAME = "admin"
ADMIN_PASSWORD = "admin123"


def ensure_admin(conn: sqlite3.Connection) -> bool:
    """Create the admin account if it isn't there yet. Returns True when it was just created."""
    exists = conn.execute(
        "select 1 from users where id = ? or email = ?", (ADMIN_ID, ADMIN_EMAIL)
    ).fetchone() or conn.execute("select 1 from profiles where username = ?", (ADMIN_NAME,)).fetchone()
    if exists:
        return False
    now = now_iso()
    conn.execute(
        "insert into users (id, email, password_hash, created_at) values (?, ?, ?, ?)",
        (ADMIN_ID, ADMIN_EMAIL, hash_password(ADMIN_PASSWORD), now),
    )
    conn.execute(
        "insert into profiles (id, username, created_at, updated_at) values (?, ?, ?, ?)",
        (ADMIN_ID, ADMIN_NAME, now, now),
    )
    ensure_bot_friend(conn, ADMIN_ID)
    return True
