"""Computer opponents for tic-tac-toe. Chess bots are in chessbots.py.

    easy    plays a random legal move
    medium  takes a win, blocks yours, otherwise likes the centre and corners (it can still be tricked)
    jkw     "jkw Chess Bot": a Q-learning bot loaded from a trained table (backend/bots/jkw_chess_bot.pkl)

A bot is anything with `id`, `name` and `choose(board, mark) -> cell`. The board is a list of nine cells holding
"X", "O" or None, numbered 0 to 8 row by row.
"""

import pickle
import random
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol

from .tictactoe import LINES

Board = list[str | None]

# Where the trained table lives unless CUSTOM_BOT_PATH says otherwise.
DEFAULT_TABLE = Path(__file__).resolve().parents[2] / "bots" / "jkw_chess_bot.pkl"


class Bot(Protocol):
    id: str
    name: str

    def choose(self, board: Board, mark: str) -> int: ...


class BotUnavailable(Exception):
    """The bot does not exist, or its model file is missing or unreadable."""


def legal_moves(board: Board) -> list[int]:
    return [i for i, cell in enumerate(board) if cell is None]


def other(mark: str) -> str:
    return "O" if mark == "X" else "X"


def winning_move(board: Board, mark: str) -> int | None:
    """A square that wins the game for `mark` right now, if there is one."""
    for a, b, c in LINES:
        line = (board[a], board[b], board[c])
        if line.count(mark) == 2 and line.count(None) == 1:
            return (a, b, c)[line.index(None)]
    return None


@dataclass
class EasyBot:
    id: str = "bot-easy"
    name: str = "Easy Bot"

    def choose(self, board: Board, mark: str) -> int:
        return random.choice(legal_moves(board))


@dataclass
class MediumBot:
    id: str = "bot-medium"
    name: str = "Medium Bot"

    def choose(self, board: Board, mark: str) -> int:
        win = winning_move(board, mark)
        if win is not None:
            return win
        block = winning_move(board, other(mark))
        if block is not None:
            return block
        moves = legal_moves(board)
        for group in ((4,), (0, 2, 6, 8)):
            options = [m for m in group if m in moves]
            if options:
                return random.choice(options)
        return random.choice(moves)


class _TableOnly(pickle.Unpickler):
    """Reads plain data only. Any pickle that tries to import or call something is refused, so a swapped-in
    file cannot run code on the server."""

    def find_class(self, module: str, name: str) -> Any:
        raise pickle.UnpicklingError(f"refusing to load {module}.{name}: the model must be plain data")


def read_table(path: Path) -> dict[tuple[str, int], float]:
    """Load {(state, move): value} and check its shape."""
    with path.open("rb") as handle:
        table = _TableOnly(handle).load()
    if not isinstance(table, dict) or not table:
        raise BotUnavailable("the model file is not a Q-table")
    for key, value in table.items():
        ok = (
            isinstance(key, tuple)
            and len(key) == 2
            and isinstance(key[0], str)
            and len(key[0]) == 9
            and set(key[0]) <= set("MT.")
            and isinstance(key[1], int)
            and 0 <= key[1] <= 8
            and isinstance(value, (int, float))
        )
        if not ok:
            raise BotUnavailable("the model file does not look like a tic-tac-toe Q-table")
    return table


@dataclass
class QTableBot:
    """"jkw Chess Bot". Values are looked up from the bot's own point of view: M = my piece, T = theirs, . = empty,
    so the one table plays either side. It takes the legal move with the highest value, breaking ties at random.
    A position it never saw has no values, so it plays a random move there."""

    table: dict[tuple[str, int], float]
    id: str = "bot-jkw"
    name: str = "jkw Chess Bot"

    def choose(self, board: Board, mark: str) -> int:
        state = "".join("." if cell is None else "M" if cell == mark else "T" for cell in board)
        moves = legal_moves(board)
        values = {m: self.table.get((state, m), 0.0) for m in moves}
        best = max(values.values())
        return random.choice([m for m, v in values.items() if v == best])


@lru_cache(maxsize=4)
def _load_table(path: str, modified: float) -> dict[tuple[str, int], float]:
    # `modified` is part of the cache key so replacing the file is picked up without a restart.
    return read_table(Path(path))


def jkw_table(custom_path: str = "") -> dict[tuple[str, int], float]:
    path = Path(custom_path) if custom_path else DEFAULT_TABLE
    if not path.is_file():
        raise BotUnavailable("the jkw Chess Bot model file is not installed")
    try:
        return _load_table(str(path), path.stat().st_mtime)
    except (pickle.UnpicklingError, EOFError, ValueError, AttributeError, ImportError, IndexError) as exc:
        raise BotUnavailable(f"the jkw Chess Bot model could not be read: {exc}") from exc


INFO = [
    {"id": "easy", "name": "Easy Bot", "description": "Plays at random. Good for warming up."},
    {"id": "medium", "name": "Medium Bot", "description": "Takes wins and blocks yours, but can be tricked."},
    {"id": "jkw", "name": "jkw Chess Bot", "description": "A trained Q-learning bot. Tough to beat."},
]


def make_bot(kind: str, custom_path: str = "", game: str = "tic-tac-toe", maia_dir: str = ""):
    if game == "chess":
        from .chessbots import make_chess_bot

        return make_chess_bot(kind, maia_dir)
    if kind == "easy":
        return EasyBot()
    if kind == "medium":
        return MediumBot()
    if kind == "jkw":
        return QTableBot(jkw_table(custom_path))
    raise BotUnavailable(f"unknown bot: {kind}")


def list_bots(custom_path: str = "", game: str = "tic-tac-toe", maia_dir: str = "") -> list[dict[str, Any]]:
    """Every bot for a game, with whether it can be played right now."""
    if game == "chess":
        from .chessbots import list_chess_bots

        return list_chess_bots(maia_dir)
    out = []
    for info in INFO:
        try:
            make_bot(info["id"], custom_path)
            available = True
        except BotUnavailable:
            available = False
        out.append({**info, "available": available})
    return out
