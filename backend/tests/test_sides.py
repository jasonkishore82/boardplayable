"""Choosing white or black in chess: when joining, and by asking to trade places before the first move."""

from tests.test_rooms_bot import client, next_of  # noqa: F401  (client is a fixture)
from tests.test_api import make_token


def connect(client, room, uid="a", name="ada", bot="", seat=""):
    extra = (f"&bot={bot}" if bot else "") + (f"&seat={seat}" if seat else "")
    return client.websocket_connect(f"/v1/rooms/{room}?token={make_token(uid, name)}{extra}")


def test_the_first_player_is_white_unless_they_ask_for_black(client):
    with connect(client, "chess:s1") as ws:
        seats = next_of(ws, "state")["game"]["seats"]
        assert seats["white"]["username"] == "ada" and seats["black"] is None
    with connect(client, "chess:s2", seat="black") as ws:
        seats = next_of(ws, "state")["game"]["seats"]
        assert seats["black"]["username"] == "ada" and seats["white"] is None


def test_asking_for_black_against_a_bot_makes_the_bot_white_and_it_moves_first(client):
    with connect(client, "chess:s3", bot="easy", seat="black") as ws:
        game = next_of(ws, "state")["game"]
        assert game["seats"]["black"]["username"] == "ada"
        assert game["seats"]["white"]["username"] == "Easy Bot"
        assert game["live"] is False and game["history"] == []  # the bot waits for Start game
        ws.send_json({"type": "start"})
        game = next_of(ws, "state", lambda m: m["game"]["history"])["game"]
        assert len(game["history"]) == 1 and game["turn"] == "black"


def test_a_taken_side_falls_back_to_the_free_one(client):
    with connect(client, "chess:s4") as ada, connect(client, "chess:s4", "b", "bo", seat="white") as bo:
        next_of(ada, "state")
        seats = next_of(bo, "state")["game"]["seats"]
        assert seats["white"]["username"] == "ada" and seats["black"]["username"] == "bo"


def test_a_player_can_trade_places_before_the_first_move(client):
    with connect(client, "chess:s5") as ada, connect(client, "chess:s5", "b", "bo") as bo:
        next_of(bo, "state", lambda m: m["game"]["seats"]["black"])
        bo.send_json({"type": "seat", "seat": "white"})
        seats = next_of(bo, "state", lambda m: m["game"]["seats"]["white"]["username"] == "bo")["game"]["seats"]
        assert seats["black"]["username"] == "ada"
        # White moves first, and white is now bo.
        bo.send_json({"type": "start"})
        bo.send_json({"type": "move", "from": "e2", "to": "e4"})
        assert next_of(bo, "state", lambda m: m["game"]["history"])["game"]["history"] == ["e4"]


def test_a_lone_player_can_move_to_the_empty_side(client):
    with connect(client, "chess:s6") as ws:
        next_of(ws, "state")
        ws.send_json({"type": "seat", "seat": "black"})
        seats = next_of(ws, "state", lambda m: m["game"]["seats"]["black"])["game"]["seats"]
        assert seats["black"]["username"] == "ada" and seats["white"] is None


def test_sides_are_locked_once_a_move_is_played(client):
    with connect(client, "chess:s7") as ada, connect(client, "chess:s7", "b", "bo") as bo:
        next_of(bo, "state", lambda m: m["game"]["seats"]["black"])
        ada.send_json({"type": "start"})
        ada.send_json({"type": "move", "from": "e2", "to": "e4"})
        next_of(bo, "state", lambda m: m["game"]["history"])
        bo.send_json({"type": "seat", "seat": "white"})
        assert "locked" in next_of(bo, "error")["message"]


def test_sides_cannot_be_chosen_in_tic_tac_toe(client):
    with connect(client, "tic-tac-toe:s8", seat="O") as ws:
        assert next_of(ws, "state")["game"]["seats"]["X"]["username"] == "ada"
        ws.send_json({"type": "seat", "seat": "O"})
        assert "can't choose sides" in next_of(ws, "error")["message"]


def test_start_needs_both_seats_and_only_happens_once(client):
    with connect(client, "chess:s9") as ws:
        next_of(ws, "state")
        ws.send_json({"type": "start"})
        assert "opponent" in next_of(ws, "error")["message"]
    with connect(client, "chess:s10", bot="easy") as ws:
        next_of(ws, "state")
        ws.send_json({"type": "start"})
        assert next_of(ws, "state", lambda m: m["game"]["live"])["game"]["live"] is True
        ws.send_json({"type": "start"})
        assert "already started" in next_of(ws, "error")["message"]


def test_the_chat_says_which_game_has_started(client):
    with connect(client, "chess:s11", bot="easy") as ws:
        next_of(ws, "state")
        ws.send_json({"type": "start"})
        note = next_of(ws, "chat", lambda m: m.get("system"))
        assert note["text"] == "Game 1 started" and note["from"] == "system" and note["at"]
        ws.send_json({"type": "resign"})
        next_of(ws, "state", lambda m: m["game"]["winner"])
        ws.send_json({"type": "rematch"})
        note = next_of(ws, "chat", lambda m: m.get("system"))
        assert note["text"] == "Game 2 started"
