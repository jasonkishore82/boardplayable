"""In-memory room registry for live play.

A room tracks who is connected, keeps a short chat history, and relays messages between players. If the room
id starts with a known game id (for example `tic-tac-toe:ab12cd`) the room also runs that game: the first people
to join take its seats, everyone else watches, and the server checks every move.

A single API instance holds the state, so scale out with a shared broker (e.g. Redis) once rooms need to span
instances.

Messages from the browser (JSON):
    {"type": "chat", "text": "..."}   say something to the room
    {"type": "move", ...}             make a move (game rooms). Fields depend on the game:
                                      tic-tac-toe {"cell": 0-8}, chess {"from": "e2", "to": "e4"},
                                      snakes and ladders {} (the server rolls the dice)
    {"type": "resign"}                give up the game (chess)
    {"type": "seat", "seat": "black"} play the other side (chess). Only until the first move of a round is played.
    {"type": "start"}                 begin the game once both seats are taken (chess). Moves wait for it.
    {"type": "rematch"}               start the next round once a game is over (game rooms)
    anything else                     relayed to everyone as {"type": "message", "from": id, "data": ...}

Messages to the browser:
    {"type": "presence", "players": [...]}
    {"type": "state", "game": {...}}          game rooms: board, turn, winner, seats, scores
    {"type": "history", "messages": [...]}    sent once to a newcomer
    {"type": "chat", "id", "from", "username", "text", "at"}
    {"type": "chat", ..., "from": "system", "system": true}   a note from the room, e.g. "Game 2 started"
    {"type": "error", "message": "..."}
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from ..auth import User
from ..games.bots import Bot
from ..games.chessgame import Chess
from ..games.snakes import SnakesAndLadders
from ..games.tictactoe import MoveError, TicTacToe

MAX_PLAYERS = 6
MAX_CHAT_LENGTH = 500
CHAT_HISTORY = 100
# How long the computer "thinks" before it moves, so the move doesn't land instantly. Tests set it to 0.
BOT_DELAY = 0.7

GAMES = {"tic-tac-toe": TicTacToe, "chess": Chess, "snakes-and-ladders": SnakesAndLadders}


@dataclass
class Room:
    id: str
    members: dict[str, tuple[User, WebSocket]] = field(default_factory=dict)
    game: Any = None  # an instance of one of the classes in GAMES
    seats: dict[str, str] = field(default_factory=dict)  # seat -> user id
    names: dict[str, str | None] = field(default_factory=dict)  # user id -> username
    chat: list[dict[str, Any]] = field(default_factory=list)
    bot: Bot | None = None  # a computer opponent, seated like a player (the last seat to start with)
    bot_task: asyncio.Task | None = None

    def players(self) -> list[dict[str, str | None]]:
        return [{"id": u.id, "username": u.username} for u, _ in self.members.values()]

    def mark_of(self, user_id: str) -> str | None:
        return next((m for m, uid in self.seats.items() if uid == user_id), None)

    def game_view(self) -> dict[str, Any] | None:
        if self.game is None:
            return None
        seats = {
            mark: ({"id": self.seats[mark], "username": self.names.get(self.seats[mark])} if mark in self.seats else None)
            for mark in self.game.SEATS
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

    async def join(
        self, room_id: str, user: User, ws: WebSocket, bot: Bot | None = None, seat: str | None = None
    ) -> Room:
        """`seat` is the side the player would like ("white" or "black" in chess). It is used when they are given a
        seat, if the game lets players choose and that seat is free."""
        new_bot_room = False
        async with self._lock:
            room = self._rooms.get(room_id)
            if room is None:
                room = self._rooms[room_id] = new_room(room_id)
                # A computer opponent can only be added by whoever opens the room.
                if bot is not None and room.game is not None and room.game.SUPPORTS_BOT:
                    room.bot = bot
                    room.names[bot.id] = bot.name
                    new_bot_room = True
            if user.id not in room.members and len(room.members) >= MAX_PLAYERS:
                raise RoomFull(room_id)
            room.members[user.id] = (user, ws)
            room.names[user.id] = user.username
            if room.game and room.mark_of(user.id) is None:
                free = [m for m in room.game.SEATS if m not in room.seats]
                # A computer opponent that has not sat down yet needs one seat left for it.
                if room.bot and room.mark_of(room.bot.id) is None and len(free) < 2:
                    free = []
                wanted = seat if getattr(room.game, "CHOOSE_SEAT", False) and seat in free else None
                if free:
                    room.seats[wanted or free[0]] = user.id
            if room.bot and room.mark_of(room.bot.id) is None:
                # The computer takes the last seat, or the other one if the player chose that.
                left = [m for m in reversed(room.game.SEATS) if m not in room.seats]
                if left:
                    room.seats[left[0]] = room.bot.id
        await self.broadcast(room, {"type": "presence", "players": room.players()})
        if room.game:
            await self.broadcast(room, {"type": "state", "game": room.game_view()})
        if room.chat:
            await self._send(ws, {"type": "history", "messages": room.chat})
        if new_bot_room and room.bot:
            await self._say(room, room.bot, "Good luck! Let's play.")
        self._schedule_bot(room)
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
                if room.bot_task:
                    room.bot_task.cancel()
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
        elif kind == "start":
            problem = self._start(room, user)
            if problem:
                await self._send(ws, {"type": "error", "message": problem})
                return
            await self.broadcast(room, {"type": "state", "game": room.game_view()})
            await self._announce(room, f"Game {room.game.round} started")
            self._schedule_bot(room)
        elif kind == "seat":
            problem = self._change_seat(room, user, data.get("seat"))
            if problem:
                await self._send(ws, {"type": "error", "message": problem})
                return
            await self.broadcast(room, {"type": "state", "game": room.game_view()})
            self._schedule_bot(room)
        elif kind in ("move", "rematch", "resign"):
            if room.game is None:
                await self._send(ws, {"type": "error", "message": "This room has no game."})
                return
            mark = room.mark_of(user.id)
            if mark is None:
                await self._send(ws, {"type": "error", "message": "You're watching this game."})
                return
            try:
                if kind == "move":
                    room.game.apply(data, mark)
                elif kind == "resign":
                    if not hasattr(room.game, "resign"):
                        raise MoveError("You can't resign this game.")
                    room.game.resign(mark)
                else:
                    room.game.rematch()
                    if room.game.SWAP_ON_REMATCH:
                        a, b = room.game.SEATS
                        if a in room.seats and b in room.seats:
                            room.seats[a], room.seats[b] = room.seats[b], room.seats[a]
            except MoveError as exc:
                await self._send(ws, {"type": "error", "message": str(exc)})
                return
            await self.broadcast(room, {"type": "state", "game": room.game_view()})
            if kind == "rematch":
                await self._announce(room, f"Game {room.game.round} started")
            self._schedule_bot(room)
            if kind == "move":
                await self._wrap_up(room)
        else:
            await self.broadcast(room, {"type": "message", "from": user.id, "data": data})

    def _start(self, room: Room, user: User) -> str | None:
        """Begin a game that waits for "Start game". Returns the reason when it can't be done."""
        game = room.game
        if game is None or not getattr(game, "NEEDS_START", False):
            return "This game doesn't need starting."
        if room.mark_of(user.id) is None:
            return "You're watching this game."
        if any(seat not in room.seats for seat in game.SEATS):
            return "Wait for an opponent to join first."
        try:
            game.start()
        except MoveError as exc:
            return str(exc)
        return None

    def _change_seat(self, room: Room, user: User, target: Any) -> str | None:
        """Move the player to the seat they asked for, trading places with whoever sits there. Returns the reason
        when it can't be done."""
        game = room.game
        if game is None:
            return "This room has no game."
        if not getattr(game, "CHOOSE_SEAT", False):
            return "You can't choose sides in this game."
        mark = room.mark_of(user.id)
        if mark is None:
            return "You're watching this game."
        if target not in game.SEATS:
            return "Pick one of the sides."
        if game.moves > 0 or game.winner:
            return "Sides are locked once the game is in play."
        if target == mark:
            return None
        other = room.seats.get(target)
        room.seats[target] = user.id
        if other is not None:
            room.seats[mark] = other
        else:
            del room.seats[mark]
        game.swap_sides()
        return None

    def _schedule_bot(self, room: Room) -> None:
        """If it is the computer's turn, make it move shortly."""
        game = room.game
        if room.bot is None or game is None or game.winner or game.turn != room.mark_of(room.bot.id):
            return
        if not getattr(game, "live", True):  # waiting for "Start game"
            return
        if room.bot_task and not room.bot_task.done():
            return
        room.bot_task = asyncio.create_task(self._bot_move(room))

    async def _bot_move(self, room: Room) -> None:
        game, bot = room.game, room.bot
        if game is None or bot is None:
            return
        await asyncio.sleep(BOT_DELAY)
        seat = room.mark_of(bot.id)
        if not room.members or game.winner or seat is None or game.turn != seat:
            return
        move = await asyncio.to_thread(game.bot_move, bot, seat)
        # Someone may have moved or left while the bot was thinking.
        if not room.members or game.winner or game.turn != seat:
            return
        game.apply(move, seat)
        await self.broadcast(room, {"type": "state", "game": room.game_view()})
        await self._wrap_up(room)

    async def _wrap_up(self, room: Room) -> None:
        """When a game against the computer ends, whoever ended it, the computer says so."""
        game, bot = room.game, room.bot
        if bot is None or game is None or not game.winner:
            return
        if game.winner == room.mark_of(bot.id):
            text = "Good game! I got that one."
        elif game.winner == "draw":
            text = "Good game! A draw."
        else:
            text = "Good game! You got me."
        await self._say(room, bot, text)

    async def _say(self, room: Room, speaker: Bot, text: str) -> None:
        message = {
            "type": "chat",
            "id": str(uuid.uuid4()),
            "from": speaker.id,
            "username": speaker.name,
            "text": text,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        room.chat.append(message)
        del room.chat[:-CHAT_HISTORY]
        await self.broadcast(room, message)

    async def _announce(self, room: Room, text: str) -> None:
        """A note from the room itself in the chat, such as which game of the session has started."""
        message = {
            "type": "chat",
            "id": str(uuid.uuid4()),
            "from": "system",
            "username": None,
            "text": text,
            "at": datetime.now(timezone.utc).isoformat(),
            "system": True,
        }
        room.chat.append(message)
        del room.chat[:-CHAT_HISTORY]
        await self.broadcast(room, message)

    async def _send(self, ws: WebSocket, message: dict) -> None:
        try:
            await ws.send_json(message)
        except Exception:  # a dropped socket is cleaned up by its own handler
            pass

    async def broadcast(self, room: Room, message: dict) -> None:
        for _, ws in list(room.members.values()):
            await self._send(ws, message)


rooms = RoomManager()
