"""A built-in test friend for local mode, so chat can be tried with one account."""

import random
import sqlite3
import uuid

from .db import now_iso

BOT_ID = "00000000-0000-4000-8000-000000000b07"
BOT_EMAIL = "playbot@bot.local"
BOT_NAME = "playbot"

REPLIES = [
    "Nice one!",
    "Want to play a game?",
    "I'm in. Tic-tac-toe?",
    "Ha, good point.",
    "Give me a minute, I'll be right there.",
    "That sounds fun.",
    "I'm only a test bot, but I'm listening.",
]


def ensure_bot_friend(conn: sqlite3.Connection, user_id: str) -> None:
    """Make sure the bot exists and is friends with this user."""
    now = now_iso()
    conn.execute("insert or ignore into users (id, email, created_at) values (?, ?, ?)", (BOT_ID, BOT_EMAIL, now))
    conn.execute(
        "insert or ignore into profiles (id, username, created_at, updated_at) values (?, ?, ?, ?)",
        (BOT_ID, BOT_NAME, now, now),
    )
    already = conn.execute(
        "select 1 from friendships where (requester_id = ? and addressee_id = ?) or (requester_id = ? and addressee_id = ?)",
        (user_id, BOT_ID, BOT_ID, user_id),
    ).fetchone()
    if not already and user_id != BOT_ID:
        conn.execute(
            "insert into friendships (id, requester_id, addressee_id, status, created_at, responded_at) "
            "values (?, ?, ?, 'accepted', ?, ?)",
            (str(uuid.uuid4()), BOT_ID, user_id, now, now),
        )


def reply_to(conn: sqlite3.Connection, user_id: str) -> None:
    conn.execute(
        "insert into messages (id, sender_id, recipient_id, body, created_at) values (?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), BOT_ID, user_id, random.choice(REPLIES), now_iso()),
    )
