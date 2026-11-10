"""Friends and chat backed by local SQLite. Only mounted when LOCAL_MODE is on."""

import sqlite3
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import User, current_user
from ..config import Settings, get_settings
from ..local.bot import BOT_ID, reply_to
from ..local.db import now_iso, session

router = APIRouter(prefix="/v1/local", tags=["local mode"])


class RequestBody(BaseModel):
    username: str = Field(max_length=40)


class RespondBody(BaseModel):
    accept: bool


class MessageBody(BaseModel):
    body: str = Field(max_length=2000)


def are_friends(conn: sqlite3.Connection, a: str, b: str) -> bool:
    row = conn.execute(
        "select 1 from friendships where status = 'accepted' and "
        "((requester_id = ? and addressee_id = ?) or (requester_id = ? and addressee_id = ?))",
        (a, b, b, a),
    ).fetchone()
    return row is not None


def message_json(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "sender_id": row["sender_id"], "body": row["body"], "created_at": row["created_at"]}


@router.get("/friends")
def list_friends(user: User = Depends(current_user), settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    friends: list[dict[str, str]] = []
    incoming: list[dict[str, str]] = []
    outgoing: list[dict[str, str]] = []
    with session(settings.local_db_path) as conn:
        rows = conn.execute(
            "select f.id, f.requester_id, f.addressee_id, f.status, pr.username as requester_name, "
            "pa.username as addressee_name from friendships f "
            "join profiles pr on pr.id = f.requester_id join profiles pa on pa.id = f.addressee_id "
            "where (f.requester_id = ? or f.addressee_id = ?) and f.status in ('pending', 'accepted') "
            "order by f.created_at",
            (user.id, user.id),
        ).fetchall()
    for r in rows:
        mine = r["requester_id"] == user.id
        other = {
            "friendship_id": r["id"],
            "user_id": r["addressee_id"] if mine else r["requester_id"],
            "username": r["addressee_name"] if mine else r["requester_name"],
        }
        if r["status"] == "accepted":
            friends.append(other)
        elif mine:
            outgoing.append(other)
        else:
            incoming.append(other)
    friends.sort(key=lambda f: f["username"])
    return {"friends": friends, "incoming": incoming, "outgoing": outgoing}


@router.post("/friends/request")
def send_request(
    body: RequestBody, user: User = Depends(current_user), settings: Settings = Depends(get_settings)
) -> dict[str, bool]:
    name = body.username.strip().lower()
    with session(settings.local_db_path) as conn:
        target = conn.execute("select id from profiles where username = ?", (name,)).fetchone()
        if target is None:
            raise HTTPException(404, "No one has that username.")
        if target["id"] == user.id:
            raise HTTPException(400, "That's you.")
        existing = conn.execute(
            "select 1 from friendships where (requester_id = ? and addressee_id = ?) or (requester_id = ? and addressee_id = ?)",
            (user.id, target["id"], target["id"], user.id),
        ).fetchone()
        if existing:
            raise HTTPException(409, "You already have a request or friendship with them.")
        conn.execute(
            "insert into friendships (id, requester_id, addressee_id, status, created_at) values (?, ?, ?, 'pending', ?)",
            (str(uuid.uuid4()), user.id, target["id"], now_iso()),
        )
    return {"ok": True}


@router.post("/friends/{friendship_id}/respond")
def respond(
    friendship_id: str,
    body: RespondBody,
    user: User = Depends(current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, bool]:
    with session(settings.local_db_path) as conn:
        cur = conn.execute(
            "update friendships set status = ?, responded_at = ? "
            "where id = ? and addressee_id = ? and status = 'pending'",
            ("accepted" if body.accept else "declined", now_iso(), friendship_id, user.id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "That request isn't waiting for you.")
    return {"ok": True}


@router.delete("/friends/{friendship_id}")
def remove_friend(
    friendship_id: str, user: User = Depends(current_user), settings: Settings = Depends(get_settings)
) -> dict[str, bool]:
    with session(settings.local_db_path) as conn:
        conn.execute(
            "delete from friendships where id = ? and (requester_id = ? or addressee_id = ?)",
            (friendship_id, user.id, user.id),
        )
    return {"ok": True}


@router.get("/messages/{friend_id}")
def get_messages(
    friend_id: str, user: User = Depends(current_user), settings: Settings = Depends(get_settings)
) -> list[dict[str, Any]]:
    with session(settings.local_db_path) as conn:
        if not are_friends(conn, user.id, friend_id):
            raise HTTPException(403, "You can only chat with friends.")
        rows = conn.execute(
            "select * from (select rowid as rid, * from messages where "
            "(sender_id = ? and recipient_id = ?) or (sender_id = ? and recipient_id = ?) "
            "order by created_at desc, rid desc limit 200) order by created_at asc, rid asc",
            (user.id, friend_id, friend_id, user.id),
        ).fetchall()
    return [message_json(r) for r in rows]


@router.post("/messages/{friend_id}")
def send_message(
    friend_id: str,
    body: MessageBody,
    user: User = Depends(current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    text = body.body.strip()
    if not text:
        raise HTTPException(400, "Write something first.")
    if len(text) > 1000:
        raise HTTPException(400, "Messages can be up to 1000 characters.")
    with session(settings.local_db_path) as conn:
        if not are_friends(conn, user.id, friend_id):
            raise HTTPException(403, "You can only chat with friends.")
        message_id = str(uuid.uuid4())
        conn.execute(
            "insert into messages (id, sender_id, recipient_id, body, created_at) values (?, ?, ?, ?, ?)",
            (message_id, user.id, friend_id, text, now_iso()),
        )
        if friend_id == BOT_ID:
            reply_to(conn, user.id)
        row = conn.execute("select * from messages where id = ?", (message_id,)).fetchone()
        return message_json(row)
