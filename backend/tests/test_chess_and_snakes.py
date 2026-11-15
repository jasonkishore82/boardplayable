import pytest

from app.games.chessgame import Chess
from app.games.snakes import FINISH, LADDERS, SNAKES, SnakesAndLadders
from app.games.tictactoe import MoveError
from tests.test_rooms_game import client, connect, next_of  # noqa: F401  (client is a fixture)


def move(game, origin, target, **extra):
    if not game.live:
        game.start()
    game.apply({"from": origin, "to": target, **extra}, game.turn)


# ---- chess ----


def test_chess_white_opens_and_turns_alternate():
    g = Chess()
    g.start()
    assert g.turn == "white"
    move(g, "e2", "e4")
    assert g.turn == "black"
    assert g.view()["board"]["e4"] == "P" and "e2" not in g.view()["board"]


def test_chess_rejects_wrong_turn_and_illegal_moves():
    g = Chess()
    g.start()
    with pytest.raises(MoveError, match="not your turn"):
        g.apply({"from": "e7", "to": "e5"}, "black")
    with pytest.raises(MoveError, match="isn't allowed"):
        move(g, "e2", "e5")  # a pawn can't jump three squares
    with pytest.raises(MoveError, match="isn't allowed"):
        move(g, "a1", "a3")  # a rook is blocked by its own pawn
    with pytest.raises(MoveError, match="Pick a piece"):
        g.apply({"from": "z9", "to": "e4"}, "white")


def test_chess_view_lists_legal_moves():
    legal = Chess().view()["legal"]
    assert sorted(legal["e2"]) == ["e3", "e4"]
    assert sorted(legal["g1"]) == ["f3", "h3"]
    assert "a1" not in legal


def test_chess_fools_mate_ends_the_game():
    g = Chess()
    g.start()
    for origin, target in (("f2", "f3"), ("e7", "e5"), ("g2", "g4"), ("d8", "h4")):
        move(g, origin, target)
    assert g.winner == "black" and g.reason == "checkmate"
    assert g.scores["black"] == 1
    assert g.view()["legal"] == {}
    with pytest.raises(MoveError, match="over"):
        move(g, "a2", "a3")


def test_chess_check_is_reported_and_pinned_moves_are_refused():
    g = Chess()
    g.start()
    for origin, target in (("e2", "e4"), ("f7", "f6"), ("d1", "h5")):
        move(g, origin, target)
    assert g.view()["check"] == "e8"
    with pytest.raises(MoveError, match="isn't allowed"):
        move(g, "a7", "a6")  # doesn't answer the check


def test_chess_pawn_promotes_to_a_queen_by_default():
    g = Chess()
    g.start()
    g.board.set_fen("8/P7/8/8/8/8/8/k6K w - - 0 1")
    move(g, "a7", "a8")
    assert g.view()["board"]["a8"] == "Q"


def test_chess_pawn_promotes_to_the_piece_the_player_chose():
    for letter in ("r", "b", "n"):
        g = Chess()
        g.start()
        g.board.set_fen("8/P7/8/8/8/8/8/k6K w - - 0 1")
        move(g, "a7", "a8", promotion=letter)
        assert g.view()["board"]["a8"] == letter.upper()


def test_chess_resign_and_rematch_swaps_scores():
    g = Chess()
    g.start()
    with pytest.raises(MoveError, match="isn't over"):
        g.rematch()
    g.resign("white")
    assert g.winner == "black" and g.reason == "resignation"
    g.rematch()
    assert g.round == 2 and g.winner is None and g.turn == "white"
    assert g.scores["white"] == 1  # the player who won as black now plays white


# ---- snakes and ladders ----


def rolling(*values):
    queue = list(values)
    return lambda: queue.pop(0)


def test_snakes_roll_moves_the_current_player_and_passes_the_turn():
    g = SnakesAndLadders(dice=rolling(2))
    g.roll("red")
    assert g.positions["red"] == 2 and g.turn == "blue"
    assert g.last == {"seat": "red", "roll": 2, "from": 0, "to": 2, "via": None}


def test_snakes_wrong_turn_is_rejected():
    g = SnakesAndLadders(dice=rolling(3))
    with pytest.raises(MoveError, match="not your turn"):
        g.roll("blue")


def test_snakes_ladders_climb_and_snakes_slide():
    g = SnakesAndLadders(dice=rolling(4, 5))
    g.roll("red")  # 0 -> 4, ladder to 14
    assert g.positions["red"] == 14 and g.last["via"] == "ladder"
    g.positions["blue"] = 11
    g.roll("blue")  # 11 + 5 = 16, snake to 6
    assert g.positions["blue"] == 6 and g.last["via"] == "snake"


def test_snakes_needs_exact_roll_to_finish_and_winner_is_scored():
    g = SnakesAndLadders(dice=rolling(5, 1, 3))
    g.positions["red"] = 97
    g.roll("red")  # 102 is too far: stays on 97
    assert g.positions["red"] == 97 and g.winner is None
    g.roll("blue")
    g.roll("red")  # 97 + 3 = 100
    assert g.winner == "red" and g.scores["red"] == 1


def test_snakes_rematch_resets_the_board_and_alternates_the_start():
    g = SnakesAndLadders(dice=rolling(1))
    with pytest.raises(MoveError, match="isn't over"):
        g.rematch()
    g.winner = "red"
    g.positions["red"] = FINISH
    g.rematch()
    assert g.positions == {"red": 0, "blue": 0} and g.winner is None and g.turn == "blue"


def test_snakes_board_has_no_square_that_is_both_head_and_foot():
    assert not set(SNAKES) & set(LADDERS)
    assert not set(SNAKES) & set(SNAKES.values())
    assert not set(LADDERS) & set(LADDERS.values())
    assert FINISH not in SNAKES


# ---- through the room server ----


def test_chess_room_seats_moves_and_rematch_swaps_colours(client):  # noqa: F811
    with connect(client, "chess:r1", "a", "ada") as a, connect(client, "chess:r1", "b", "bo") as b:
        state = next_of(b, "state")["game"]
        assert state["seats"]["white"]["username"] == "ada" and state["seats"]["black"]["username"] == "bo"

        a.send_json({"type": "move", "from": "e2", "to": "e4"})
        assert "Start game" in next_of(a, "error")["message"]
        b.send_json({"type": "start"})
        assert next_of(a, "state")["game"]["live"] is True

        b.send_json({"type": "move", "from": "e7", "to": "e5"})
        assert "not your turn" in next_of(b, "error")["message"]

        a.send_json({"type": "move", "from": "e2", "to": "e4"})
        assert next_of(b, "state")["game"]["board"]["e4"] == "P"

        a.send_json({"type": "resign"})
        assert next_of(b, "state")["game"]["winner"] == "black"
        b.send_json({"type": "rematch"})
        game = next_of(a, "state")["game"]
        while game["round"] != 2:
            game = next_of(a, "state")["game"]
        seats = game["seats"]
        assert seats["white"]["username"] == "bo" and seats["black"]["username"] == "ada"


def test_snakes_room_rolls_for_the_player_whose_turn_it_is(client):  # noqa: F811
    with connect(client, "snakes-and-ladders:r1", "a", "ada") as a, connect(client, "snakes-and-ladders:r1", "b", "bo") as b:
        next_of(b, "state")
        b.send_json({"type": "move"})
        assert "not your turn" in next_of(b, "error")["message"]
        a.send_json({"type": "move"})
        game = next_of(b, "state")["game"]
        assert game["last"]["seat"] == "red" and game["turn"] == "blue"
        assert 1 <= game["last"]["roll"] <= 6
