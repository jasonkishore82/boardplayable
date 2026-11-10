import pytest

from app.games.tictactoe import MoveError, TicTacToe


def play(game, *moves):
    """moves are (cell) values; marks alternate starting with whoever's turn it is."""
    for cell in moves:
        game.play(cell, game.turn)


def test_x_goes_first_and_turns_alternate():
    g = TicTacToe()
    g.play(4, "X")
    assert g.board[4] == "X" and g.turn == "O"


def test_wrong_turn_is_rejected():
    g = TicTacToe()
    with pytest.raises(MoveError, match="not your turn"):
        g.play(0, "O")


def test_taken_and_out_of_range_squares():
    g = TicTacToe()
    g.play(0, "X")
    with pytest.raises(MoveError, match="taken"):
        g.play(0, "O")
    for bad in (-1, 9, "4", None, 1.5, True):
        with pytest.raises(MoveError):
            g.play(bad, "O")


def test_row_win_records_the_line_and_score():
    g = TicTacToe()
    play(g, 0, 3, 1, 4, 2)
    assert g.winner == "X"
    assert g.line == (0, 1, 2)
    assert g.scores["X"] == 1


def test_diagonal_win_for_o():
    g = TicTacToe()
    play(g, 1, 0, 2, 4, 5, 8)
    assert g.winner == "O" and g.line == (0, 4, 8)


def test_draw():
    g = TicTacToe()
    play(g, 0, 1, 2, 4, 3, 5, 7, 6, 8)
    assert g.winner == "draw" and g.line is None
    assert g.scores["draw"] == 1


def test_no_moves_after_the_game_ends():
    g = TicTacToe()
    play(g, 0, 3, 1, 4, 2)
    with pytest.raises(MoveError, match="over"):
        g.play(8, "O")


def test_rematch_alternates_who_starts_and_keeps_scores():
    g = TicTacToe()
    with pytest.raises(MoveError):
        g.rematch()  # not over yet
    play(g, 0, 3, 1, 4, 2)
    g.rematch()
    assert g.board == [None] * 9 and g.winner is None
    assert g.round == 2 and g.turn == "O"
    assert g.scores["X"] == 1
    play(g, 0, 3, 1, 4, 2)  # O wins round 2
    g.rematch()
    assert g.turn == "X"
    assert g.scores == {"X": 1, "O": 1, "draw": 0}
