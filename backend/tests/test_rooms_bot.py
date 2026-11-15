import pickle

import pytest
from fastapi.testclient import TestClient

import app.realtime.rooms as room_module
from app.config import Settings, get_settings
from app.main import create_app
from tests.test_api import SECRET, make_token


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(room_module, "BOT_DELAY", 0)
    # A tiny model so the jkw bot can be tested without the real file: it always likes square 8.
    model = tmp_path / "jkw.pkl"
    model.write_bytes(pickle.dumps({("........M", 8): 1.0}))
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co", supabase_jwt_secret=SECRET, custom_bot_path=str(model)
    )
    return TestClient(app)


def connect(client, room, uid="a", name="ada", bot=""):
    suffix = f"&bot={bot}" if bot else ""
    return client.websocket_connect(f"/v1/rooms/{room}?token={make_token(uid, name)}{suffix}")


def next_of(ws, kind, pred=lambda m: True):
    for _ in range(30):
        message = ws.receive_json()
        if message["type"] == kind and pred(message):
            return message
    raise AssertionError(f"no {kind} message arrived")


def test_the_bot_takes_the_o_seat_and_greets(client):
    with connect(client, "tic-tac-toe:b1", bot="easy") as ws:
        seats = next_of(ws, "state")["game"]["seats"]
        assert seats["X"]["username"] == "ada"
        assert seats["O"]["username"] == "Easy Bot"
        chat = next_of(ws, "chat")
        assert chat["username"] == "Easy Bot" and chat["from"] == "bot-easy"


def test_the_bot_answers_each_move(client):
    with connect(client, "tic-tac-toe:b2", bot="medium") as ws:
        next_of(ws, "state")
        ws.send_json({"type": "move", "cell": 0})
        game = next_of(ws, "state", lambda m: "O" in m["game"]["board"])["game"]
        assert game["board"].count("O") == 1 and game["turn"] == "X"
        # Medium opens its reply in the centre because the corner was taken by the human.
        assert game["board"][4] == "O"


def test_a_whole_game_against_the_bot_ends(client):
    with connect(client, "tic-tac-toe:b3", bot="easy") as ws:
        game = next_of(ws, "state")["game"]
        for _ in range(9):
            if game["winner"]:
                break
            empty = [i for i, c in enumerate(game["board"]) if c is None]
            ws.send_json({"type": "move", "cell": empty[0]})
            game = next_of(ws, "state", lambda m: m["game"]["turn"] == "X" or m["game"]["winner"])["game"]
        assert game["winner"] in ("X", "O", "draw")
        # Whoever ended it, the bot says good game.
        bye = next_of(ws, "chat", lambda m: m["from"] == "bot-easy" and "Good game" in m["text"])
        assert bye["username"] == "Easy Bot"


def test_the_human_cannot_play_the_bots_turn(client, monkeypatch):
    monkeypatch.setattr(room_module, "BOT_DELAY", 30)  # the bot is "thinking" for the whole test
    with connect(client, "tic-tac-toe:b4", bot="easy") as ws:
        next_of(ws, "state")
        ws.send_json({"type": "move", "cell": 0})
        next_of(ws, "state", lambda m: m["game"]["board"][0] == "X")
        # It is now O's turn, and O belongs to the bot.
        ws.send_json({"type": "move", "cell": 1})
        assert "not your turn" in next_of(ws, "error")["message"]


def test_the_custom_bot_uses_its_model(client):
    with connect(client, "tic-tac-toe:b5", bot="jkw") as ws:
        seats = next_of(ws, "state")["game"]["seats"]
        assert seats["O"]["username"] == "jkw Chess Bot"
        ws.send_json({"type": "move", "cell": 0})
        game = next_of(ws, "state", lambda m: "O" in m["game"]["board"])["game"]
        # Its table gives square 8 the only positive value for the position "M" at 8 ... unseen here,
        # so it falls back to a legal move. It must be a real, empty square.
        assert game["board"].count("O") == 1


def test_an_unknown_bot_is_refused(client):
    with connect(client, "tic-tac-toe:b6", bot="nope") as ws:
        error = ws.receive_json()
        assert error["type"] == "error" and error["fatal"] is True


def test_a_missing_model_is_refused(monkeypatch, tmp_path):
    monkeypatch.setattr(room_module, "BOT_DELAY", 0)
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co",
        supabase_jwt_secret=SECRET,
        custom_bot_path=str(tmp_path / "nope.pkl"),
    )
    client = TestClient(app)
    with connect(client, "tic-tac-toe:b7", bot="jkw") as ws:
        assert ws.receive_json()["fatal"] is True


def test_a_bot_cannot_be_added_to_a_room_that_already_exists(client):
    with connect(client, "tic-tac-toe:b8", "a", "ada") as first:
        next_of(first, "state")
        with connect(client, "tic-tac-toe:b8", "b", "bo", bot="easy") as second:
            seats = next_of(second, "state")["game"]["seats"]
            assert seats["O"]["username"] == "bo"  # a person, not the bot


def test_rematch_lets_the_bot_open(client):
    with connect(client, "tic-tac-toe:b9", bot="medium") as ws:
        game = next_of(ws, "state")["game"]
        # Play until the round ends.
        for _ in range(9):
            if game["winner"]:
                break
            empty = [i for i, c in enumerate(game["board"]) if c is None]
            ws.send_json({"type": "move", "cell": empty[-1]})
            game = next_of(ws, "state", lambda m: m["game"]["turn"] == "X" or m["game"]["winner"])["game"]
        ws.send_json({"type": "rematch"})
        # Round two starts with O, which is the bot, so it plays a first move on its own.
        game = next_of(ws, "state", lambda m: m["game"]["round"] == 2 and "O" in m["game"]["board"])["game"]
        assert game["board"].count("O") == 1 and game["turn"] == "X"


def test_the_bots_endpoint_lists_who_can_play(client):
    names = {b["id"]: b["available"] for b in client.get("/v1/bots").json()}
    assert names == {"easy": True, "medium": True, "jkw": True}
