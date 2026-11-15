from app.games.chessgame import Chess
from app.games.tictactoe import TicTacToe


def test_chess_history_is_standard_notation_and_resets_on_rematch():
    game = Chess()
    game.start()
    for origin, target in (("e2", "e4"), ("e7", "e5"), ("g1", "f3"), ("b8", "c6"), ("f1", "c4"), ("f8", "c5")):
        game.apply({"from": origin, "to": target}, game.turn)
    assert game.view()["history"] == ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]


def test_chess_history_marks_captures_checks_and_mate():
    game = Chess()
    game.start()
    # Fool's mate.
    for origin, target in (("f2", "f3"), ("e7", "e5"), ("g2", "g4"), ("d8", "h4")):
        game.apply({"from": origin, "to": target}, game.turn)
    assert game.view()["history"] == ["f3", "e5", "g4", "Qh4#"]
    game.rematch()
    assert game.view()["history"] == []


def test_tic_tac_toe_history_is_mark_and_square_number():
    game = TicTacToe()
    for cell in (4, 0, 8):
        game.play(cell, game.turn)
    assert game.view()["history"] == ["X5", "O1", "X9"]
    for cell in (2, 6, 7):  # O wins? no: just keep playing legal squares until the round ends
        if game.winner:
            break
        game.play(cell, game.turn)
    game.winner = game.winner or "draw"
    game.rematch()
    assert game.view()["history"] == []
