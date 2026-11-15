import os
import pickle
import random

import pytest

from app.games.bots import (
    DEFAULT_TABLE,
    BotUnavailable,
    EasyBot,
    MediumBot,
    QTableBot,
    legal_moves,
    list_bots,
    make_bot,
    read_table,
    winning_move,
)
from app.games.tictactoe import TicTacToe


def board(text):
    """'XO.' style rows, e.g. 'XX. .O. ...' (spaces ignored)."""
    cells = text.replace(" ", "")
    return [None if c == "." else c for c in cells]


def test_easy_plays_a_legal_move():
    b = board("XOX XOO ...")
    for _ in range(20):
        assert EasyBot().choose(b, "X") in legal_moves(b)


def test_medium_takes_the_win_then_blocks():
    assert MediumBot().choose(board("XX. OO. ..."), "X") == 2  # win beats block
    assert MediumBot().choose(board("XX. .O. ..."), "O") == 2  # must block X
    assert winning_move(board("X.. .X. ..."), "X") == 8
    assert winning_move(board("X.. ... ..."), "X") is None


def test_medium_prefers_the_centre_then_corners():
    assert MediumBot().choose(board("... ... ..."), "X") == 4
    assert MediumBot().choose(board("... .X. ..."), "O") in (0, 2, 6, 8)


def test_a_q_table_bot_takes_the_best_legal_move(tmp_path):
    state = "M.T......"  # I hold 0, they hold 2
    table = {(state, 1): 0.2, (state, 3): 0.9, (state, 0): 5.0}  # 0 is taken, so it is not legal
    bot = QTableBot(table)
    b = board("X.O ... ...")
    assert bot.choose(b, "X") == 3
    # Seen from the other side the same shape reads differently, so it falls back to a random legal move.
    assert bot.choose(board("O.X ... ..."), "O") == 3 or bot.choose(board("O.X ... ..."), "O") in legal_moves(board("O.X ... ..."))


def test_unseen_positions_still_get_a_legal_move():
    bot = QTableBot({("MMMMMMMMM", 0): 1.0})
    b = board("X.. .O. ...")
    assert bot.choose(b, "X") in legal_moves(b)


def test_loader_accepts_a_plain_table(tmp_path):
    path = tmp_path / "t.pkl"
    path.write_bytes(pickle.dumps({("........M", 4): 0.5}))
    assert read_table(path) == {("........M", 4): 0.5}


def test_loader_refuses_pickles_that_would_run_code(tmp_path):
    class Evil:
        def __reduce__(self):
            return (os.system, ("echo pwned",))

    path = tmp_path / "evil.pkl"
    path.write_bytes(pickle.dumps(Evil()))
    with pytest.raises(pickle.UnpicklingError):
        read_table(path)


@pytest.mark.parametrize(
    "payload",
    [
        {},  # empty
        [1, 2, 3],  # not a dict
        {("bad", 1): 1.0},  # wrong state shape
        {("........M", 9): 1.0},  # move out of range
        {("........M", 1): "high"},  # value not a number
    ],
)
def test_loader_rejects_the_wrong_shape(tmp_path, payload):
    path = tmp_path / "x.pkl"
    path.write_bytes(pickle.dumps(payload))
    with pytest.raises(BotUnavailable):
        read_table(path)


def test_make_bot_and_availability(tmp_path):
    assert make_bot("easy").name == "Easy Bot"
    assert make_bot("medium").name == "Medium Bot"
    with pytest.raises(BotUnavailable):
        make_bot("nope")
    missing = str(tmp_path / "missing.pkl")
    with pytest.raises(BotUnavailable):
        make_bot("jkw", missing)
    listed = {b["id"]: b["available"] for b in list_bots(missing)}
    assert listed == {"easy": True, "medium": True, "jkw": False}


def play_out(bot_x, bot_o):
    game = TicTacToe()
    bots = {"X": bot_x, "O": bot_o}
    while not game.winner:
        game.play(bots[game.turn].choose(list(game.board), game.turn), game.turn)
    return game.winner


@pytest.mark.skipif(not DEFAULT_TABLE.is_file(), reason="jkw Chess Bot model not installed")
def test_the_real_jkw_model_is_strong():
    random.seed(7)
    bot = make_bot("jkw")
    assert bot.name == "jkw Chess Bot"
    losses = 0
    for opponent in (EasyBot(), MediumBot()):
        for _ in range(60):
            if play_out(bot, opponent) == "O":  # bot as X: a win for the opponent is a loss for the bot
                losses += 1
            if play_out(opponent, bot) == "X":  # bot as O
                losses += 1
    assert losses == 0
