"""Hand cricket for two players. Pure logic, no networking.

Every ball, the batter and the bowler each pick a number from 1 to 6 without seeing the other's pick. If the numbers
match, the batter is out. Otherwise the batter scores the number they picked. Each side bats once: an innings ends
when the batting side loses all its wickets or runs out of balls, and the side batting second wins as soon as it
passes the target. Equal scores are a draw.

The server keeps both picks secret until the second one arrives, so neither player can wait and react.
"""

import random
from dataclasses import dataclass, field
from typing import Any

from .tictactoe import MoveError

SEATS = ("home", "away")
WICKETS = 2  # wickets per innings
BALLS = 18  # balls per innings (3 overs)


def other(seat: str) -> str:
    return SEATS[1] if seat == SEATS[0] else SEATS[0]


def overs(balls: int) -> str:
    """18 balls is "3.0", 14 balls is "2.2"."""
    return f"{balls // 6}.{balls % 6}"


@dataclass
class Cricket:
    SEATS = SEATS
    SUPPORTS_BOT = True
    SWAP_ON_REMATCH = False

    first: str = "home"  # who bats first this round
    batting: str = "home"
    innings: int = 1
    runs: dict[str, int] = field(default_factory=lambda: {s: 0 for s in SEATS})
    wickets: dict[str, int] = field(default_factory=lambda: {s: 0 for s in SEATS})
    balls: dict[str, int] = field(default_factory=lambda: {s: 0 for s in SEATS})
    picks: dict[str, int] = field(default_factory=dict)  # this ball's secret picks, by seat
    last: dict[str, Any] | None = None
    winner: str | None = None  # "home", "away" or "draw"
    reason: str | None = None
    round: int = 1
    moves: int = 0  # balls bowled this round
    history: list[str] = field(default_factory=list)
    scores: dict[str, int] = field(default_factory=lambda: {"home": 0, "away": 0, "draw": 0})

    @property
    def started(self) -> bool:
        return self.moves > 0 or self.round > 1

    @property
    def bowling(self) -> str:
        return other(self.batting)

    @property
    def turn(self) -> str:
        """Who still has to pick for this ball. The batter goes first when nobody has picked, so a computer bowler
        waits for the player. Both picks stay hidden either way."""
        if self.batting not in self.picks:
            return self.batting
        return self.bowling

    @property
    def target(self) -> int | None:
        """Runs the side batting second needs to win."""
        return self.runs[self.first] + 1 if self.innings == 2 else None

    def apply(self, data: dict[str, Any], seat: str) -> None:
        """Entry point for the room server: data is the player's move message, {"pick": 1-6}."""
        self.pick(data.get("pick"), seat)

    def pick(self, number: Any, seat: str) -> None:
        if self.winner:
            raise MoveError("The game is over. Start a rematch.")
        if seat not in SEATS:
            raise MoveError("You're watching this game.")
        if not isinstance(number, int) or isinstance(number, bool) or not 1 <= number <= 6:
            raise MoveError("Pick a number from 1 to 6.")
        if seat in self.picks:
            raise MoveError("You've already picked for this ball.")
        self.picks[seat] = number
        if len(self.picks) == 2:
            self._bowl()

    def _bowl(self) -> None:
        bat, bowl = self.picks[self.batting], self.picks[self.bowling]
        self.picks = {}
        side = self.batting
        out = bat == bowl
        scored = 0 if out else bat
        self.balls[side] += 1
        self.moves += 1
        if out:
            self.wickets[side] += 1
        else:
            self.runs[side] += scored
        self.last = {"batter": side, "bat": bat, "bowl": bowl, "runs": scored, "out": out}
        self.history.append(f"{side} {bat} v {bowl}: {'out' if out else f'{scored} run' + ('s' if scored != 1 else '')}")

        innings_over = self.wickets[side] >= WICKETS or self.balls[side] >= BALLS
        if self.innings == 1:
            if innings_over:
                self.innings = 2
                self.batting = other(side)
            return

        target = self.runs[self.first] + 1
        if self.runs[side] >= target:
            self._finish(side, "chased the target")
        elif innings_over:
            if self.runs[side] == target - 1:
                self._finish("draw", "scores level")
            else:
                self._finish(self.first, "defended the total")

    def _finish(self, winner: str, reason: str) -> None:
        self.winner, self.reason = winner, reason
        self.scores[winner] += 1

    def bot_move(self, bot: Any, seat: str) -> dict[str, Any]:
        """Ask a computer opponent for its pick. It sees only balls already played, never this ball's other pick."""
        role = "bat" if seat == self.batting else "bowl"
        try:
            number = bot.pick(self.public(), seat, role)
        except Exception:
            number = None
        if not isinstance(number, int) or isinstance(number, bool) or not 1 <= number <= 6:
            number = random.randint(1, 6)
        return {"pick": number}

    def rematch(self) -> None:
        if not self.winner:
            raise MoveError("The game isn't over yet.")
        self.round += 1
        # Sides take turns to bat first.
        self.first = self.batting = SEATS[(self.round - 1) % 2]
        self.innings = 1
        self.runs = {s: 0 for s in SEATS}
        self.wickets = {s: 0 for s in SEATS}
        self.balls = {s: 0 for s in SEATS}
        self.picks, self.last = {}, None
        self.winner, self.reason, self.moves = None, None, 0
        self.history = []

    def public(self) -> dict[str, Any]:
        """Everything anyone may see. This ball's picks are left out: only who has picked."""
        return {
            "first": self.first,
            "batting": self.batting,
            "innings": self.innings,
            "runs": dict(self.runs),
            "wickets": dict(self.wickets),
            "balls": dict(self.balls),
            "target": self.target,
            "picked": {s: s in self.picks for s in SEATS},
            "last": dict(self.last) if self.last else None,
            "maxWickets": WICKETS,
            "maxBalls": BALLS,
            "history": list(self.history),
        }

    def view(self) -> dict[str, Any]:
        return {
            **self.public(),
            "turn": self.turn,
            "winner": self.winner,
            "reason": self.reason,
            "round": self.round,
            "scores": dict(self.scores),
        }


# ---- computer opponents ----


def _their_picks(state: dict[str, Any], seat: str) -> list[int]:
    """The numbers the other side has shown so far this round, newest last."""
    shown = []
    for line in state.get("history", []):
        side, rest = line.split(" ", 1)
        bat, bowl = rest.split(":")[0].split(" v ")
        shown.append(int(bowl) if side == seat else int(bat))
    return shown


@dataclass
class EasyCricketBot:
    """Picks at random."""

    id: str = "bot-easy"
    name: str = "Easy Bot"

    def pick(self, state: dict[str, Any], seat: str, role: str) -> int:
        return random.randint(1, 6)


@dataclass
class MediumCricketBot:
    """Watches what you play. Bowling, it tends to aim at your favourite numbers. Batting, it steers clear of them
    and leans towards big hits."""

    id: str = "bot-medium"
    name: str = "Medium Bot"

    def pick(self, state: dict[str, Any], seat: str, role: str) -> int:
        recent = _their_picks(state, seat)[-8:]
        counts = {n: 1 + recent.count(n) for n in range(1, 7)}
        if role == "bowl":
            numbers, weights = zip(*counts.items())
            return random.choices(numbers, weights=weights)[0]
        weights = [n / counts[n] for n in range(1, 7)]
        return random.choices(range(1, 7), weights=weights)[0]


CRICKET_BOTS = {"easy": EasyCricketBot, "medium": MediumCricketBot}

CRICKET_INFO = [
    {"id": "easy", "name": "Easy Bot", "description": "Picks at random. Good for warming up."},
    {"id": "medium", "name": "Medium Bot", "description": "Learns your favourite numbers as the game goes on."},
]
