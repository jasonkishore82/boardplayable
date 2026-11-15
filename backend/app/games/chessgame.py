"""Chess rules for a live room. The python-chess library referees every move (check, castling, en passant,
promotion, mate and draws); this class only adds seats, scores and rematches around it."""

from typing import Any

import chess

from .tictactoe import MoveError

SQUARES = {chess.square_name(s) for s in chess.SQUARES}
REASONS = {
    chess.Termination.CHECKMATE: "checkmate",
    chess.Termination.STALEMATE: "stalemate",
    chess.Termination.INSUFFICIENT_MATERIAL: "insufficient material",
    chess.Termination.SEVENTYFIVE_MOVES: "the 75-move rule",
    chess.Termination.FIVEFOLD_REPETITION: "fivefold repetition",
}


class Chess:
    SEATS = ("white", "black")
    SUPPORTS_BOT = True
    SWAP_ON_REMATCH = True  # the players trade colours each round
    CHOOSE_SEAT = True  # a player may pick white or black until the first move of a round
    NEEDS_START = True  # the first round waits for a player to press "Start game"

    def __init__(self) -> None:
        self.board = chess.Board()
        self.winner: str | None = None  # "white", "black" or "draw"
        self.reason: str | None = None
        self.last: tuple[str, str] | None = None
        self.round = 1
        self.moves = 0
        self.history: list[str] = []  # this round's moves, e.g. ["e4", "e5", "Nf3"]
        self.scores = {"white": 0, "black": 0, "draw": 0}
        # False until a player presses "Start game". Moves are refused and the computer waits until then.
        # A rematch begins at once, since "Play again" is itself the start.
        self.live = False

    @property
    def turn(self) -> str:
        return "white" if self.board.turn == chess.WHITE else "black"

    @property
    def started(self) -> bool:
        return self.moves > 0 or self.round > 1

    def start(self) -> None:
        if self.live:
            raise MoveError("The game has already started.")
        self.live = True

    def apply(self, data: dict[str, Any], seat: str) -> None:
        origin, target, promotion = data.get("from"), data.get("to"), data.get("promotion", "q")
        if not self.live:
            raise MoveError("Press Start game first.")
        if self.winner:
            raise MoveError("The game is over. Start a rematch.")
        if seat != self.turn:
            raise MoveError("It's not your turn.")
        if origin not in SQUARES or target not in SQUARES:
            raise MoveError("Pick a piece and a square on the board.")
        if promotion not in ("q", "r", "b", "n"):
            raise MoveError("You can promote to a queen, rook, bishop or knight.")

        move = chess.Move.from_uci(origin + target)
        piece = self.board.piece_at(move.from_square)
        if piece and piece.piece_type == chess.PAWN and chess.square_rank(move.to_square) in (0, 7):
            move = chess.Move.from_uci(origin + target + promotion)
        if move not in self.board.legal_moves:
            raise MoveError("That move isn't allowed.")

        san = self.board.san(move)  # must be worked out before the move is played
        self.board.push(move)
        self.moves += 1
        self.history.append(san)
        self.last = (origin, target)
        outcome = self.board.outcome()
        if outcome:
            self.winner = "draw" if outcome.winner is None else ("white" if outcome.winner else "black")
            self.reason = REASONS.get(outcome.termination, "a draw")
            self.scores[self.winner] += 1

    def bot_move(self, bot: Any, seat: str) -> dict[str, Any]:
        """Ask a computer opponent for its move. A bot that picks an illegal move plays the first legal one."""
        legal = {move.uci(): move for move in self.board.legal_moves}
        try:
            uci = bot.choose(self.board.fen())
        except Exception:
            uci = ""
        move = legal.get(uci) or next(iter(legal.values()))
        return {"from": chess.square_name(move.from_square), "to": chess.square_name(move.to_square),
                "promotion": chess.piece_symbol(move.promotion) if move.promotion else "q"}

    def resign(self, seat: str) -> None:
        if not self.live:
            raise MoveError("The game hasn't started yet.")
        if self.winner:
            raise MoveError("The game is over.")
        self.winner = "black" if seat == "white" else "white"
        self.reason = "resignation"
        self.scores[self.winner] += 1

    def swap_sides(self) -> None:
        """The room swapped who plays which colour, so the scores swap too and stay with the players."""
        self.scores["white"], self.scores["black"] = self.scores["black"], self.scores["white"]

    def rematch(self) -> None:
        if not self.winner:
            raise MoveError("The game isn't over yet.")
        self.round += 1
        self.board = chess.Board()
        self.winner, self.reason, self.last, self.moves = None, None, None, 0
        self.history = []
        self.live = True
        # The room swaps the seats, so the scores follow the players.
        self.scores["white"], self.scores["black"] = self.scores["black"], self.scores["white"]

    def view(self) -> dict[str, Any]:
        legal: dict[str, list[str]] = {}
        if not self.winner:
            for move in self.board.legal_moves:
                legal.setdefault(chess.square_name(move.from_square), []).append(chess.square_name(move.to_square))
        king = self.board.king(self.board.turn)
        return {
            "board": {chess.square_name(s): p.symbol() for s, p in self.board.piece_map().items()},
            "turn": self.turn,
            "winner": self.winner,
            "reason": self.reason,
            "legal": legal,
            "last": list(self.last) if self.last else None,
            "check": chess.square_name(king) if king is not None and self.board.is_check() else None,
            "history": list(self.history),
            "round": self.round,
            "scores": dict(self.scores),
            "live": self.live,
        }
