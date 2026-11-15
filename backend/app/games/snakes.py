"""Snakes and ladders for two players. The server rolls the dice, so nobody can fake a six."""

import random
from typing import Any, Callable

from .tictactoe import MoveError

FINISH = 100
LADDERS = {1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100}
SNAKES = {16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78}


class SnakesAndLadders:
    SEATS = ("red", "blue")
    SUPPORTS_BOT = False
    SWAP_ON_REMATCH = False

    def __init__(self, dice: Callable[[], int] | None = None) -> None:
        self.dice = dice or (lambda: random.randint(1, 6))
        self.positions = {seat: 0 for seat in self.SEATS}  # 0 means "not on the board yet"
        self.turn = "red"
        self.winner: str | None = None
        self.last: dict[str, Any] | None = None
        self.round = 1
        self.moves = 0
        self.scores = {seat: 0 for seat in self.SEATS}

    @property
    def started(self) -> bool:
        return self.moves > 0 or self.round > 1

    def apply(self, data: dict[str, Any], seat: str) -> None:
        self.roll(seat)

    def roll(self, seat: str) -> None:
        if self.winner:
            raise MoveError("The game is over. Start a rematch.")
        if seat != self.turn:
            raise MoveError("It's not your turn.")

        roll = self.dice()
        start = self.positions[seat]
        landing = start + roll
        if landing > FINISH:  # you need the exact number to finish
            landing = start
        via = None
        if landing in LADDERS:
            landing, via = LADDERS[landing], "ladder"
        elif landing in SNAKES:
            landing, via = SNAKES[landing], "snake"

        self.positions[seat] = landing
        self.moves += 1
        self.last = {"seat": seat, "roll": roll, "from": start, "to": landing, "via": via}
        if landing == FINISH:
            self.winner = seat
            self.scores[seat] += 1
            return
        self.turn = self.SEATS[(self.SEATS.index(seat) + 1) % len(self.SEATS)]

    def rematch(self) -> None:
        if not self.winner:
            raise MoveError("The game isn't over yet.")
        self.round += 1
        self.positions = {seat: 0 for seat in self.SEATS}
        self.winner, self.last, self.moves = None, None, 0
        # The player who went second last time goes first.
        self.turn = self.SEATS[(self.round - 1) % len(self.SEATS)]

    def view(self) -> dict[str, Any]:
        return {
            "positions": dict(self.positions),
            "turn": self.turn,
            "winner": self.winner,
            "last": self.last,
            "ladders": {str(k): v for k, v in LADDERS.items()},
            "snakes": {str(k): v for k, v in SNAKES.items()},
            "round": self.round,
            "scores": dict(self.scores),
        }
