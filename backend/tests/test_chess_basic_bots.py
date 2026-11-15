import random

import chess
import pytest

from app.games.bots import list_bots, make_bot
from app.games.chessbots import EasyChessBot, MediumChessBot, material
from tests.test_rooms_bot import client, connect, next_of  # noqa: F401  (client is a fixture)


def test_both_bots_are_listed_and_playable_without_extra_installs():
    listed = {b["id"]: b for b in list_bots("", "chess", "")}
    assert listed["easy"]["available"] and listed["medium"]["available"]
    assert make_bot("easy", game="chess").name == "Easy Bot"
    assert make_bot("medium", game="chess").name == "Medium Bot"
    # Chess shows the basic bots first, then Maia, then the jkw slot.
    assert list(listed)[:2] == ["easy", "medium"]
    assert list(listed)[-1] == "jkw"


@pytest.mark.parametrize("bot", [EasyChessBot(), MediumChessBot()])
def test_every_move_is_legal_through_a_whole_game(bot):
    random.seed(3)
    board = chess.Board()
    for _ in range(60):
        if board.is_game_over():
            break
        move = chess.Move.from_uci(bot.choose(board.fen()))
        assert move in board.legal_moves
        board.push(move)


def test_medium_finds_mate_in_one():
    # Fool's mate: black to play Qh4#.
    board = chess.Board("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2")
    assert MediumChessBot().choose(board.fen()) == "d8h4"


def test_medium_takes_a_free_queen():
    # White rook on a1 can capture an undefended black queen on a8; every other move leaves it alone.
    board = chess.Board("q3k3/8/8/8/8/8/8/R3K3 w - - 0 1")
    assert MediumChessBot().choose(board.fen()) == "a1a8"


def test_medium_does_not_hang_its_queen():
    # Black pawn on b5 attacks c4. The queen should not walk onto a square the pawn guards.
    board = chess.Board("4k3/8/8/1p6/8/8/3Q4/4K3 w - - 0 1")
    for _ in range(20):
        move = chess.Move.from_uci(MediumChessBot().choose(board.fen()))
        board.push(move)
        assert not any(
            reply.to_square == move.to_square and board.piece_at(move.to_square).piece_type == chess.QUEEN
            for reply in board.legal_moves
            if board.piece_at(reply.from_square).piece_type == chess.PAWN
        )
        board.pop()


def test_medium_beats_easy_over_a_few_games():
    random.seed(11)
    medium_points = 0
    for game_number in range(4):
        board = chess.Board()
        medium_is_white = game_number % 2 == 0
        while not board.is_game_over() and board.fullmove_number < 80:
            medium_to_move = (board.turn == chess.WHITE) == medium_is_white
            bot = MediumChessBot() if medium_to_move else EasyChessBot()
            board.push(chess.Move.from_uci(bot.choose(board.fen())))
        outcome = board.outcome()
        if outcome and outcome.winner is not None:
            medium_points += 1 if outcome.winner == medium_is_white else -1
        else:
            # Unfinished or drawn: judge by material.
            medium_points += 1 if material(board, medium_is_white) > 0 else 0
    assert medium_points >= 3


def test_a_chess_room_with_the_easy_bot_replies(client):  # noqa: F811
    with connect(client, "chess:basic1", bot="easy") as ws:
        seats = next_of(ws, "state")["game"]["seats"]
        assert seats["black"]["username"] == "Easy Bot"
        ws.send_json({"type": "start"})
        ws.send_json({"type": "move", "from": "e2", "to": "e4"})
        state = next_of(ws, "state", lambda m: m["game"]["turn"] == "white" and len(m["game"]["board"]) >= 32 and m["game"]["board"].get("e4") == "P")["game"]
        # Black has answered, so white is to move again with the full set of pieces minus nothing.
        assert state["turn"] == "white"
