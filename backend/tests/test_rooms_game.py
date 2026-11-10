import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import create_app
from tests.test_api import SECRET, make_token


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co", supabase_jwt_secret=SECRET
    )
    return TestClient(app)


def connect(client, room, uid, name):
    return client.websocket_connect(f"/v1/rooms/{room}?token={make_token(uid, name)}")


def next_of(ws, kind):
    """Read messages until one of the given type arrives."""
    for _ in range(20):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
    raise AssertionError(f"no {kind} message arrived")


def test_first_two_players_get_seats_and_a_third_watches(client):
    with connect(client, "tic-tac-toe:t1", "a", "ada") as a:
        state = next_of(a, "state")["game"]
        assert state["seats"]["X"]["username"] == "ada" and state["seats"]["O"] is None
        with connect(client, "tic-tac-toe:t1", "b", "bo") as b:
            assert next_of(b, "state")["game"]["seats"]["O"]["username"] == "bo"
            with connect(client, "tic-tac-toe:t1", "c", "cy") as c:
                seats = next_of(c, "state")["game"]["seats"]
                assert {seats["X"]["id"], seats["O"]["id"]} == {"a", "b"}
                c.send_json({"type": "move", "cell": 0})
                assert "watching" in next_of(c, "error")["message"]


def test_moves_are_refereed_and_broadcast(client):
    with connect(client, "tic-tac-toe:t2", "a", "ada") as a, connect(client, "tic-tac-toe:t2", "b", "bo") as b:
        next_of(b, "state")
        # O cannot open.
        b.send_json({"type": "move", "cell": 4})
        assert "not your turn" in next_of(b, "error")["message"]

        a.send_json({"type": "move", "cell": 4})
        for ws in (a, b):
            board = None
            for _ in range(5):
                msg = ws.receive_json()
                if msg["type"] == "state" and msg["game"]["board"][4] == "X":
                    board = msg["game"]
                    break
            assert board and board["turn"] == "O"

        # Taking the same square is refused.
        b.send_json({"type": "move", "cell": 4})
        assert "taken" in next_of(b, "error")["message"]


def test_win_then_rematch(client):
    with connect(client, "tic-tac-toe:t3", "a", "ada") as a, connect(client, "tic-tac-toe:t3", "b", "bo") as b:
        next_of(b, "state")
        for who, cell in ((a, 0), (b, 3), (a, 1), (b, 4), (a, 2)):
            who.send_json({"type": "move", "cell": cell})
        final = None
        for _ in range(20):
            msg = a.receive_json()
            if msg["type"] == "state" and msg["game"]["winner"]:
                final = msg["game"]
                break
        assert final["winner"] == "X" and final["line"] == [0, 1, 2] and final["scores"]["X"] == 1

        b.send_json({"type": "rematch"})
        fresh = None
        for _ in range(20):
            msg = a.receive_json()
            if msg["type"] == "state" and msg["game"]["round"] == 2:
                fresh = msg["game"]
                break
        assert fresh["board"] == [None] * 9 and fresh["turn"] == "O"


def test_chat_reaches_everyone_and_newcomers_get_history(client):
    with connect(client, "tic-tac-toe:t4", "a", "ada") as a:
        with connect(client, "tic-tac-toe:t4", "b", "bo") as b:
            a.send_json({"type": "chat", "text": "  good luck!  "})
            for ws in (a, b):
                msg = next_of(ws, "chat")
                assert msg["text"] == "good luck!" and msg["username"] == "ada" and msg["from"] == "a"
            a.send_json({"type": "chat", "text": "   "})  # blank messages are ignored
            b.send_json({"type": "chat", "text": "you too"})
            assert next_of(a, "chat")["text"] == "you too"
        with connect(client, "tic-tac-toe:t4", "c", "cy") as c:
            history = next_of(c, "history")["messages"]
            assert [m["text"] for m in history] == ["good luck!", "you too"]


def test_chat_works_in_a_room_without_a_game(client):
    with connect(client, "plain-room", "a", "ada") as a:
        next_of(a, "presence")
        a.send_json({"type": "chat", "text": "hello"})
        assert next_of(a, "chat")["text"] == "hello"
        a.send_json({"type": "move", "cell": 1})
        assert "no game" in next_of(a, "error")["message"]


def test_leaving_before_the_first_move_frees_the_seat(client):
    with connect(client, "tic-tac-toe:t5", "a", "ada") as a:
        next_of(a, "state")
        with connect(client, "tic-tac-toe:t5", "b", "bo") as b:
            next_of(b, "state")
        # b left without playing; a sees the O seat open again.
        for _ in range(10):
            msg = a.receive_json()
            if msg["type"] == "state" and msg["game"]["seats"]["O"] is None:
                break
        else:
            raise AssertionError("seat was not released")
        with connect(client, "tic-tac-toe:t5", "c", "cy") as c:
            assert next_of(c, "state")["game"]["seats"]["O"]["username"] == "cy"
