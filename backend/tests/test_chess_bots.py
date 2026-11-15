import chess
import pytest

from app.games import chessbots
from app.games.bots import BotUnavailable, list_bots, make_bot
from app.games.chessgame import Chess
from tests.test_rooms_game import client, connect, next_of  # noqa: F401  (client is a fixture)


class FirstLegalBot:
    id, name = "bot-test", "Test Bot"

    def choose(self, fen):
        return next(iter(chess.Board(fen).legal_moves)).uci()


class NonsenseBot(FirstLegalBot):
    def choose(self, fen):
        return "a1a8"  # never legal from the start


class BrokenBot(FirstLegalBot):
    def choose(self, fen):
        raise RuntimeError("model exploded")


def test_chess_bot_move_is_always_a_legal_move():
    for bot in (FirstLegalBot(), NonsenseBot(), BrokenBot()):
        game = Chess()
        game.start()
        for _ in range(4):
            game.apply(game.bot_move(bot, game.turn), game.turn)  # raises if the move is illegal
        assert game.moves == 4


def test_chess_bot_promotes_when_it_picks_a_promotion():
    class Promote(FirstLegalBot):
        def choose(self, fen):
            return "a7a8n"

    game = Chess()

    game.start()
    game.board.set_fen("8/P7/8/8/8/8/8/k6K w - - 0 1")
    game.apply(game.bot_move(Promote(), "white"), "white")
    assert game.view()["board"]["a8"] == "N"


def test_chess_bot_list_has_basic_bots_then_maia_levels_then_jkw_last():
    bots = list_bots(game="chess", maia_dir="/nowhere")
    assert [b["id"] for b in bots] == ["easy", "medium", "maia-1100", "maia-1500", "maia-1900", "jkw"]
    # The basic bots need nothing extra; Maia and jkw are unavailable with no weights in /nowhere.
    assert [b["id"] for b in bots if b["available"]] == ["easy", "medium"]


def test_maia_is_unavailable_without_weights_and_jkw_is_a_placeholder():
    with pytest.raises(BotUnavailable, match="Maia"):
        make_bot("maia-1500", game="chess", maia_dir="/nowhere")
    with pytest.raises(BotUnavailable, match="jkw"):
        make_bot("jkw", game="chess")
    with pytest.raises(BotUnavailable):
        make_bot("nonsense", game="chess")


def test_maia_chooses_in_proportion_to_its_probabilities(monkeypatch, tmp_path):
    import sys
    import types

    seen = {}

    def inference_each(model, prepared, fen, elo_self, elo_oppo):
        seen["elo"] = (elo_self, elo_oppo)
        return {"e2e4": 1.0, "d2d4": 0.0}, 0.5

    fake = types.ModuleType("maia2")
    fake.inference = types.SimpleNamespace(inference_each=inference_each, prepare=lambda: "prepared")
    fake.model = types.SimpleNamespace(from_pretrained=lambda **kw: "model")
    monkeypatch.setitem(sys.modules, "maia2", fake)
    monkeypatch.setattr(chessbots, "maia_installed", lambda model_dir="": True)
    chessbots._load.cache_clear()

    bot = make_bot("maia-1500", game="chess", maia_dir=str(tmp_path))
    assert bot.name == "Maia 1500"
    assert bot.choose(chess.STARTING_FEN) == "e2e4"
    assert seen["elo"] == (1500, 1500)
    chessbots._load.cache_clear()


def test_the_bots_endpoint_lists_chess_bots(client):  # noqa: F811
    ids = [b["id"] for b in client.get("/v1/bots?game=chess").json()]
    assert ids[-1] == "jkw" and "maia-1500" in ids


def test_a_chess_room_with_a_bot_plays_black_and_answers(client, monkeypatch):  # noqa: F811
    from app.realtime import rooms as room_module

    monkeypatch.setattr(room_module, "BOT_DELAY", 0)
    monkeypatch.setattr(chessbots, "make_chess_bot", lambda kind, model_dir="": FirstLegalBot())
    with connect(client, "chess:bot1", "a", "ada") as ws, client.websocket_connect(
        "/v1/rooms/chess:bot2?token=" + __import__("tests.test_api", fromlist=["make_token"]).make_token("a", "ada") + "&bot=maia-1500"
    ) as bot_ws:
        # A room without a bot has an empty black seat...
        assert next_of(ws, "state")["game"]["seats"]["black"] is None
        # ...and a room opened with a bot seats it as black.
        seats = next_of(bot_ws, "state")["game"]["seats"]
        assert seats["white"]["username"] == "ada" and seats["black"]["username"] == "Test Bot"

        bot_ws.send_json({"type": "start"})
        bot_ws.send_json({"type": "move", "from": "e2", "to": "e4"})
        game = next_of(bot_ws, "state")["game"]
        while game["turn"] != "white" or game["last"] is None or game["last"][0] == "e2":
            game = next_of(bot_ws, "state")["game"]
        assert game["turn"] == "white" and len(game["board"]) == 32  # the bot moved and white is up again

        # After a resignation and rematch the colours swap, so the bot opens as white.
        bot_ws.send_json({"type": "resign"})
        bot_ws.send_json({"type": "rematch"})
        game = next_of(bot_ws, "state")["game"]
        while game["round"] != 2 or game["last"] is None:
            game = next_of(bot_ws, "state")["game"]
        assert game["seats"]["white"]["username"] == "Test Bot" and game["turn"] == "black"
