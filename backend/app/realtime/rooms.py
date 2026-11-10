"""In-memory room registry for live play.

Game engines will plug in here later. For now a room tracks who is connected
and relays messages between them. A single API instance holds the state, so
scale out with a shared broker (e.g. Redis) once rooms need to span instances.
"""

import asyncio
from dataclasses import dataclass, field

from fastapi import WebSocket

from ..auth import User

MAX_PLAYERS = 6


@dataclass
class Room:
    id: str
    members: dict[str, tuple[User, WebSocket]] = field(default_factory=dict)

    def players(self) -> list[dict[str, str | None]]:
        return [{"id": u.id, "username": u.username} for u, _ in self.members.values()]


class RoomFull(Exception):
    pass


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._lock = asyncio.Lock()

    async def join(self, room_id: str, user: User, ws: WebSocket) -> Room:
        async with self._lock:
            room = self._rooms.setdefault(room_id, Room(room_id))
            if user.id not in room.members and len(room.members) >= MAX_PLAYERS:
                raise RoomFull(room_id)
            room.members[user.id] = (user, ws)
        await self.broadcast(room, {"type": "presence", "players": room.players()})
        return room

    async def leave(self, room: Room, user: User) -> None:
        async with self._lock:
            room.members.pop(user.id, None)
            if not room.members:
                self._rooms.pop(room.id, None)
        await self.broadcast(room, {"type": "presence", "players": room.players()})

    async def broadcast(self, room: Room, message: dict) -> None:
        for _, ws in list(room.members.values()):
            try:
                await ws.send_json(message)
            except Exception:  # a dropped socket is cleaned up by its own handler
                pass


rooms = RoomManager()
