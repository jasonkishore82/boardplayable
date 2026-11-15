"""Computer opponents for chess.

    easy                              Plays a random legal move. Always available, no extra install.
    medium                            Looks two moves ahead and plays for material: it takes free pieces, avoids
                                      hanging its own, and finds mate in one. It does not plan further, so it can
                                      still be out-thought. Always available.
    jkw                               "jkw Chess Bot". A slot for your own bot: it is listed last, as not available
                                      yet. To plug one in, write a class with `choose(fen)` and return it from
                                      make_chess_bot below.
    maia-1100, maia-1500, maia-1900   Maia-2, a neural network trained on human games. It plays the way a player
                                      of that rating tends to play, mistakes included, rather than the best move.

Maia-2 is a separate install (it brings PyTorch with it) and a ~50 MB weights file, so it is optional:
`pip install -r requirements-maia.txt`, then `python scripts/fetch_maia.py`. Until both are there the bots are
listed as unavailable.

A chess bot is anything with `id`, `name` and `choose(fen) -> uci move`, for example "e2e4" or "e7e8q".
"""

import importlib.util
import random
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import chess

from .bots import BotUnavailable

WEIGHTS_FILE = "rapid_model.pt"
DEFAULT_DIR = Path(__file__).resolve().parents[2] / "maia2_models"

# Maia-2 understands ratings from 1100 to 2000 in steps of 100.
LEVELS = [
    {"id": "maia-1100", "elo": 1100, "description": "Plays like a casual player. Makes plenty of mistakes."},
    {"id": "maia-1500", "elo": 1500, "description": "Plays like a solid club player."},
    {"id": "maia-1900", "elo": 1900, "description": "Plays like a strong club player. Few blunders."},
]


class ChessBot:
    id: str
    name: str

    def choose(self, fen: str) -> str: ...


PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}
MATE = 100_000


def material(board: chess.Board, side: bool) -> int:
    """Piece values for `side` minus the other side's."""
    total = 0
    for piece in board.piece_map().values():
        total += PIECE_VALUES[piece.piece_type] * (1 if piece.color == side else -1)
    return total


@dataclass
class EasyChessBot:
    id: str = "bot-easy"
    name: str = "Easy Bot"

    def choose(self, fen: str) -> str:
        return random.choice(list(chess.Board(fen).legal_moves)).uci()


@dataclass
class MediumChessBot:
    id: str = "bot-medium"
    name: str = "Medium Bot"

    def choose(self, fen: str) -> str:
        board = chess.Board(fen)
        me = board.turn
        best_score, best_moves = -MATE * 2, []
        for move in board.legal_moves:
            board.push(move)
            if board.is_checkmate():
                board.pop()
                return move.uci()
            if board.is_stalemate() or board.is_insufficient_material():
                score = 0  # a draw: fine only when it is behind, which the comparison below handles
            else:
                # Assume the opponent answers with whatever is best for them in material terms.
                worst = MATE
                for reply in board.legal_moves:
                    board.push(reply)
                    value = -MATE if board.is_checkmate() else material(board, me)
                    board.pop()
                    worst = min(worst, value)
                score = worst
            board.pop()
            # A tiny random nudge so games are not identical every time.
            score += random.random()
            if score > best_score + 1e-9:
                best_score, best_moves = score, [move]
            elif abs(score - best_score) <= 1e-9:
                best_moves.append(move)
        return random.choice(best_moves).uci()


def weights_path(model_dir: str = "") -> Path:
    return (Path(model_dir) if model_dir else DEFAULT_DIR) / WEIGHTS_FILE


def maia_installed(model_dir: str = "") -> bool:
    return importlib.util.find_spec("maia2") is not None and weights_path(model_dir).is_file()


@lru_cache(maxsize=2)
def _load(model_dir: str) -> tuple[Any, Any]:
    from maia2 import inference, model  # imported here: it pulls in PyTorch

    loaded = model.from_pretrained(type="rapid", device="cpu", save_root=str(Path(weights_path(model_dir)).parent))
    return loaded, inference.prepare()


@dataclass
class MaiaBot:
    elo: int
    model_dir: str = ""

    @property
    def id(self) -> str:
        return f"bot-maia-{self.elo}"

    @property
    def name(self) -> str:
        return f"Maia {self.elo}"

    def choose(self, fen: str) -> str:
        from maia2 import inference

        model, prepared = _load(self.model_dir)
        probabilities, _ = inference.inference_each(model, prepared, fen, self.elo, self.elo)
        # Pick in proportion to how likely a player of this rating is to play each move.
        moves = list(probabilities)
        return random.choices(moves, weights=[probabilities[m] for m in moves])[0]


def make_chess_bot(kind: str, model_dir: str = "") -> ChessBot:
    if kind == "easy":
        return EasyChessBot()
    if kind == "medium":
        return MediumChessBot()
    if kind == "jkw":
        raise BotUnavailable("the jkw Chess Bot is not installed yet")
    level = next((lv for lv in LEVELS if lv["id"] == kind), None)
    if level is None:
        raise BotUnavailable(f"unknown bot: {kind}")
    if not maia_installed(model_dir):
        raise BotUnavailable("Maia is not installed on this server")
    return MaiaBot(level["elo"], model_dir)


def list_chess_bots(model_dir: str = "") -> list[dict[str, Any]]:
    available = maia_installed(model_dir)
    maia = [
        {"id": lv["id"], "name": f"Maia {lv['elo']}", "description": lv["description"], "available": available}
        for lv in LEVELS
    ]
    basic = [
        {"id": "easy", "name": "Easy Bot", "description": "Plays at random. Good for warming up.", "available": True},
        {"id": "medium", "name": "Medium Bot", "description": "Takes free pieces and sees one move ahead.", "available": True},
    ]
    return [*basic, *maia, {"id": "jkw", "name": "jkw Chess Bot", "description": "Coming soon.", "available": False}]
