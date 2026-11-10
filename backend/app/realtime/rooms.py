"""In-memory room registry for live play.

A room tracks who is connected, keeps a short chat history, and relays messages between players. If the room
id starts with a known game id (for example `tic-tac-toe:ab12cd`) the room also runs that game: the first two
people to join take the seats, everyone else watches, and the server checks every move.

A single API instance holds the state, so scale out with a shared broker (e.g. Redis) once rooms need to span
instances.

Messages from the browser (JSON):
    {"type": "chat", "text": "..."}   say something to the room
    {"type": "move", "cell": 0-8}     play a square (game rooms)
    {"type": "rematch"}               start the next round once a game is over (game rooms)
    anything else                     relayed to everyone as {"type": "message", "from": id, "data": ...}

Messages to the browser:
    {"type": "presence", "players": [...]}
    {"type": "state", "game": {...}}          game rooms: board, turn, winner, seats, scores
    {"type": "history", "messages": [...]}    sent once to a newcomer
    {"type": "chat", "id", "from", "username", "text", "at"}
    {"type": "error", "message": "..."}
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from ..auth import User
from ..games.tictactoe import MoveError, TicTacToe

MAX_PLAYERS = 6
MAX_CHAT_LENGTH = 500
CHAT_HISTORY = 100
SEAT_MARKS = ("X", "O")

GAMES = {"tic-tac-toe": TicTacToe}


@dataclass
class Room:
    id: str
    members: dict[str, tuple[User, WebSocket]] = field(default_factory=dict)
    game: TicTacToe | None = None
    seats: dict[str, str] = field(default_factory=dict)  # mark -> user id
    names: dict[str, str | None] = field(default_factory=dict)  # user id -> username
    chat: list[dict[str, Any]] = field(default_factory=list)

    def players(self) -> list[dict[str, str | None]]:
        return [{"id": u.id, "username": u.username} for u, _ in self.members.values()]

    def mark_of(self, user_id: str) -> str | None:
        return next((m for m, uid in self.seats.items() if uid == user_id), None)

    def game_view(self) -> dict[str, Any] | None:
        if self.game is None:
            return None
        seats = {
            mark: ({"id": self.seats[mark], "username": self.names.get(self.seats[mark])} if mark in self.seats else None)
            for mark in SEAT_MARKS
        }
        return {**self.game.view(), "seats": seats}


class RoomFull(Exception):
    pass


def new_room(room_id: str) -> Room:
    game_class = GAMES.get(room_id.split(":", 1)[0])
    return Room(room_id, game=game_class() if game_class else None)


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._lock = asyncio.Lock()

    async def join(self, room_id: str, user: User, ws: WebSocket) -> Room:
        async with self._lock:
            room = self._rooms.get(room_id)
            if room is None:
                room = self._rooms[room_id] = new_room(room_id)
            if user.id not in room.members and len(room.members) >= MAX_PLAYERS:
                raise RoomFull(room_id)
            room.members[user.id] = (user, ws)
            room.names[user.id] = user.username
            if room.game and room.mark_of(user.id) is None:
                free = next((m for m in SEAT_MARKS if m not in room.seats), None)
                if free:
                    room.seats[free] = user.id
        await self.broadcast(room, {"type": "presence", "players": room.players()})
        if room.game:
            await self.broadcast(room, {"type": "state", "game": room.game_view()})
        if room.chat:
            await self._send(ws, {"type": "history", "messages": room.chat})
        return room

    async def leave(self, room: Room, user: User) -> None:
        async with self._lock:
            room.members.pop(user.id, None)
            # Leaving before a game starts frees the seat for someone else.
            if room.game and not room.game.started:
                mark = room.mark_of(user.id)
                if mark:
                    del room.seats[mark]
            if not room.members:
                self._rooms.pop(room.id, None)
        await self.broadcast(room, {"type": "presence", "players": room.players()})
        if room.game and room.members:
            await self.broadcast(room, {"type": "state", "game": room.game_view()})

    async def handle(self, room: Room, user: User, ws: WebSocket, data: Any) -> None:
        kind = data.get("type") if isinstance(data, dict) else None

        if kind == "chat":
            text = str(data.get("text", "")).strip()[:MAX_CHAT_LENGTH]
            if not text:
                return
            message = {
                "type": "chat",
                "id": str(uuid.uuid4()),
                "from": user.id,
                "username": user.username,
                "text": text,
                "at": datetime.now(timezone.utc).isoformat(),
            }
            room.chat.append(message)
            del room.chat[:-CHAT_HISTORY]
            await self.broadcast(room, message)
        elif kind in ("move", "rematch"):
            if room.game is None:
                await self._send(ws, {"type": "error", "message": "This room has no game."})
                return
            mark = room.mark_of(user.id)
            if mark is None:
                await self._send(ws, {"type": "error", "message": "You're watching this game."})
                return
            try:
                if kind == "move":
                    room.game.play(data.get("cell"), mark)
                else:
                    room.game.rematch()
            except MoveError as exc:
                await self._send(ws, {"type": "error", "message": str(exc)})
                return
            await self.broadcast(room, {"type": "state", "game": room.game_view()})
        else:
            await self.broadcast(room, {"type": "message", "from": user.id, "data": data})

    async def _send(self, ws: WebSocket, message: dict) -> None:
        try:
            await ws.send_json(message)
        except Exception:  # a dropped socket is cleaned up by its own handler
            pass

    async def broadcast(self, room: Room, message: dict) -> None:
        for _, ws in list(room.members.values()):
            await self._send(ws, message)


rooms = RoomManager()
