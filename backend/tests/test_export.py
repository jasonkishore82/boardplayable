import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from app.local.db import migrate, now_iso, session  # noqa: E402
from export_to_supabase import build_plan  # noqa: E402


def test_plan_matches_the_local_data(tmp_path):
    db = str(tmp_path / "x.db")
    migrate(db)
    now = now_iso()
    with session(db) as conn:
        conn.execute("insert into users values ('u1', 'ada@example.com', '$2b$12$hash', ?)", (now,))
        conn.execute("insert into users values ('u2', 'bob@example.com', null, ?)", (now,))
        conn.execute("insert into profiles values ('u1', 'ada', null, ?, ?)", (now, now))
        conn.execute("insert into game_stats values ('u1', 'chess', 3, 2, ?)", (now,))

    plan = build_plan(db)
    ada, bob = plan["users"]
    assert ada["password_hash"] == "$2b$12$hash"
    assert ada["email_confirm"] is True
    assert ada["user_metadata"] == {"username": "ada"}
    assert "password_hash" not in bob  # never finished sign-up
    assert bob["user_metadata"] == {}
    assert [p["username"] for p in plan["profiles"]] == ["ada"]
    assert plan["game_stats"][0]["played"] == 3
