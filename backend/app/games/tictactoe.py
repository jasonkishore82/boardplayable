"""Tic-tac-toe rules. Pure logic, no networking. The room server calls this to referee every move."""

from dataclasses import dataclass, field
from typing import Any

LINES = ((0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6))


class MoveError(Exception):
    """A move that breaks the rules. The message is safe to show the player."""


@dataclass
class TicTacToe:
    SEATS = ("X", "O")
    SUPPORTS_BOT = True
    SWAP_ON_REMATCH = False

    board: list[str | None] = field(default_factory=lambda: [None] * 9)
    turn: str = "X"
    winner: str | None = None  # "X", "O" or "draw"
    line: tuple[int, int, int] | None = None
    round: int = 1
    moves: int = 0  # moves played in the current round
    history: list[str] = field(default_factory=list)  # this round's moves, e.g. ["X5", "O1"]
    scores: dict[str, int] = field(default_factory=lambda: {"X": 0, "O": 0, "draw": 0})

    @property
    def started(self) -> bool:
        return self.moves > 0 or self.round > 1

    def apply(self, data: dict[str, Any], seat: str) -> None:
        """Entry point for the room server: data is the player's move message."""
        self.play(data.get("cell"), seat)

    def bot_move(self, bot: Any, seat: str) -> dict[str, Any]:
        """Ask a computer opponent for its move. A bot that picks a taken square plays the first free one."""
        free = [i for i, cell in enumerate(self.board) if cell is None]
        try:
            cell = bot.choose(list(self.board), seat)
        except Exception:
            cell = -1
        return {"cell": cell if cell in free else free[0]}

    def play(self, cell: Any, mark: str) -> None:
        if self.winner:
            raise MoveError("The game is over. Start a rematch.")
        if mark != self.turn:
            raise MoveError("It's not your turn.")
        if not isinstance(cell, int) or isinstance(cell, bool) or not 0 <= cell < 9:
            raise MoveError("Pick a square on the board.")
        if self.board[cell] is not None:
            raise MoveError("That square is taken.")

        self.board[cell] = mark
        self.moves += 1
        self.history.append(f"{mark}{cell + 1}")
        for a, b, c in LINES:
            if self.board[a] == self.board[b] == self.board[c] == mark:
                self.winner, self.line = mark, (a, b, c)
                self.scores[mark] += 1
                return
        if self.moves == 9:
            self.winner = "draw"
            self.scores["draw"] += 1
            return
        self.turn = "O" if mark == "X" else "X"

    def rematch(self) -> None:
        if not self.winner:
            raise MoveError("The game isn't over yet.")
        self.round += 1
        self.board = [None] * 9
        self.winner, self.line, self.moves = None, None, 0
        self.history = []
        # The player who went second last time goes first.
        self.turn = "X" if self.round % 2 == 1 else "O"

    def view(self) -> dict[str, Any]:
        return {
            "board": list(self.board),
            "turn": self.turn,
            "winner": self.winner,
            "line": list(self.line) if self.line else None,
            "round": self.round,
            "history": list(self.history),
            "scores": dict(self.scores),
        }
