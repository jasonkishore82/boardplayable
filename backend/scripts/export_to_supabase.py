"""Copy the local SQLite data into Supabase.

Dry run by default: it prints what it WOULD send. Nothing is written until you pass --apply.

    cd backend
    .venv\\Scripts\\python scripts\\export_to_supabase.py                 # dry run
    .venv\\Scripts\\python scripts\\export_to_supabase.py --apply         # really write

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from backend/.env), and the Supabase tables from
supabase/migrations to exist already. Users are created through the Auth admin API with their bcrypt password
hash, so they can sign in with the same password. Rows that already exist in Supabase are updated, not duplicated.
"""

import argparse
import sqlite3
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

TABLES = ["profiles", "friendships", "game_invites", "game_stats", "messages"]
CONFLICT = {
    "profiles": "id",
    "friendships": "id",
    "game_invites": "id",
    "game_stats": "user_id,game_id",
    "messages": "id",
}
# The local test bot is not a real person, so it and anything that mentions it stays behind.
BOT_ID = "00000000-0000-4000-8000-000000000b07"
ID_COLUMNS = ("id", "user_id", "requester_id", "addressee_id", "from_id", "to_id", "sender_id", "recipient_id")


def rows(conn: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    found = [dict(r) for r in conn.execute(f"select * from {table}")]  # noqa: S608 (fixed table names)
    return [r for r in found if BOT_ID not in (r.get(c) for c in ID_COLUMNS)]


def build_plan(db_path: str) -> dict[str, list[dict[str, Any]]]:
    """Everything that would be copied, shaped for the Supabase APIs."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        usernames = {r["id"]: r["username"] for r in conn.execute("select id, username from profiles")}
        users = []
        for u in rows(conn, "users"):
            payload: dict[str, Any] = {
                "id": u["id"],
                "email": u["email"],
                "email_confirm": True,
                "user_metadata": {"username": usernames.get(u["id"])} if usernames.get(u["id"]) else {},
            }
            if u["password_hash"]:
                payload["password_hash"] = u["password_hash"]
            users.append(payload)
        plan: dict[str, list[dict[str, Any]]] = {"users": users}
        for table in TABLES:
            plan[table] = rows(conn, table)
        return plan
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", default="local.db", help="path to the local SQLite file")
    parser.add_argument("--apply", action="store_true", help="actually write to Supabase")
    args = parser.parse_args()

    from app.config import get_settings

    settings = get_settings()
    plan = build_plan(args.db)
    print(f"Local data in {args.db}:")
    for name, items in plan.items():
        print(f"  {name:14} {len(items)}")
    if not args.apply:
        print("\nDry run. Nothing was sent. Re-run with --apply to write to Supabase.")
        return
    if not (settings.supabase_url and settings.supabase_service_role_key):
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env first.")

    base = settings.supabase_url.rstrip("/")
    headers = {"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}"}
    with httpx.Client(timeout=30, headers=headers) as client:
        for user in plan["users"]:
            res = client.post(f"{base}/auth/v1/admin/users", json=user)
            if res.status_code == 422:
                print(f"  user {user['email']}: already exists, left as is")
            elif res.status_code >= 400:
                # Some projects reject password_hash; retry without it (the user can reset their password).
                retry = {k: v for k, v in user.items() if k != "password_hash"}
                res = client.post(f"{base}/auth/v1/admin/users", json=retry)
                print(f"  user {user['email']}: created without password ({res.status_code})")
            else:
                print(f"  user {user['email']}: created")
        for table in TABLES:
            if not plan[table]:
                continue
            res = client.post(
                f"{base}/rest/v1/{table}?on_conflict={CONFLICT[table]}",
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                json=plan[table],
            )
            print(f"  {table}: {len(plan[table])} rows -> {res.status_code}")
            if res.status_code >= 400:
                print("   ", res.text[:300])


if __name__ == "__main__":
    main()
