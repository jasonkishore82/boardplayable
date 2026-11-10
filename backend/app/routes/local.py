"""Sign-in endpoints backed by local SQLite. Only mounted when LOCAL_MODE is on.

They do what Supabase Auth does in production, so the front end can be tested without Supabase:
email code -> account -> username and password -> signed-in session (a JWT signed with a local secret).
"""

import re
import sqlite3
import time
import uuid
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import User, current_user
from ..config import Settings, get_settings
from ..local.bot import ensure_bot_friend
from ..local.db import now_iso, session
from ..local.gateway import SqliteGateway, get_local_gateway
from ..local.passwords import hash_password, verify_password
from ..otp import check_code, issue_code
from .otp import SendBody, VerifyBody, clean_email

router = APIRouter(prefix="/v1/local", tags=["local mode"])

USERNAME = re.compile(r"^[a-z0-9_]{3,20}$")
TOKEN_DAYS = 7


class CompleteBody(BaseModel):
    username: str = Field(max_length=40)
    password: str = Field(min_length=8, max_length=128)


class SignInBody(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class PasswordBody(BaseModel):
    password: str = Field(min_length=8, max_length=128)


def session_payload(settings: Settings, conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    row = conn.execute(
        "select u.id, u.email, u.created_at, p.username from users u "
        "left join profiles p on p.id = u.id where u.id = ?",
        (user_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(401, "Account not found")
    now = int(time.time())
    token = jwt.encode(
        {
            "sub": row["id"],
            "email": row["email"],
            "aud": settings.supabase_jwt_audience,
            "iat": now,
            "exp": now + TOKEN_DAYS * 86400,
            "user_metadata": {"username": row["username"]},
        },
        settings.local_jwt_secret,
        algorithm="HS256",
    )
    return {
        "access_token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "created_at": row["created_at"],
        },
    }


@router.post("/otp/send")
async def send_code(body: SendBody, gateway: SqliteGateway = Depends(get_local_gateway)) -> dict[str, Any]:
    code = await issue_code(gateway, clean_email(body.email))
    # Local mode only: hand the code back so it can be shown on screen without an inbox.
    return {"sent": True, "dev_code": code}


@router.post("/otp/verify")
async def verify_code(
    body: VerifyBody,
    gateway: SqliteGateway = Depends(get_local_gateway),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    email = clean_email(body.email)
    await check_code(gateway, email, body.code)
    with session(settings.local_db_path) as conn:
        row = conn.execute("select id from users where email = ?", (email,)).fetchone()
        user_id = row["id"] if row else str(uuid.uuid4())
        if row is None:
            conn.execute("insert into users (id, email, created_at) values (?, ?, ?)", (user_id, email, now_iso()))
        return session_payload(settings, conn, user_id)


@router.post("/signup/complete")
def complete_signup(
    body: CompleteBody, user: User = Depends(current_user), settings: Settings = Depends(get_settings)
) -> dict[str, Any]:
    name = body.username.strip().lower()
    if not USERNAME.match(name):
        raise HTTPException(400, "Use 3-20 lowercase letters, numbers or underscores.")
    with session(settings.local_db_path) as conn:
        taken = conn.execute("select 1 from profiles where username = ? and id <> ?", (name, user.id)).fetchone()
        if taken:
            raise HTTPException(409, "That username is taken.")
        now = now_iso()
        conn.execute(
            "insert into profiles (id, username, created_at, updated_at) values (?, ?, ?, ?) "
            "on conflict(id) do update set username = excluded.username, updated_at = excluded.updated_at",
            (user.id, name, now, now),
        )
        conn.execute("update users set password_hash = ? where id = ?", (hash_password(body.password), user.id))
        # Local mode only: give every new user a test friend to chat with.
        ensure_bot_friend(conn, user.id)
        return session_payload(settings, conn, user.id)


@router.post("/signin")
def sign_in(body: SignInBody, settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    email = clean_email(body.email)
    with session(settings.local_db_path) as conn:
        row = conn.execute("select id, password_hash from users where email = ?", (email,)).fetchone()
        if row is None or not verify_password(body.password, row["password_hash"]):
            raise HTTPException(401, "That email and password don't match.")
        return session_payload(settings, conn, row["id"])


@router.get("/session")
def get_session(user: User = Depends(current_user), settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    with session(settings.local_db_path) as conn:
        return session_payload(settings, conn, user.id)


@router.post("/password")
def set_password(
    body: PasswordBody, user: User = Depends(current_user), settings: Settings = Depends(get_settings)
) -> dict[str, bool]:
    with session(settings.local_db_path) as conn:
        conn.execute("update users set password_hash = ? where id = ?", (hash_password(body.password), user.id))
    return {"ok": True}


@router.delete("/account")
def delete_account(user: User = Depends(current_user), settings: Settings = Depends(get_settings)) -> dict[str, bool]:
    with session(settings.local_db_path) as conn:
        # Profile, friendships, invites and stats go with it (on delete cascade).
        conn.execute("delete from users where id = ?", (user.id,))
    return {"ok": True}


@router.get("/stats")
def stats(user: User = Depends(current_user), settings: Settings = Depends(get_settings)) -> dict[str, int]:
    with session(settings.local_db_path) as conn:
        row = conn.execute(
            "select coalesce(sum(played), 0) as played, coalesce(sum(won), 0) as won from game_stats where user_id = ?",
            (user.id,),
        ).fetchone()
        return {"played": row["played"], "won": row["won"]}
