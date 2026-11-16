import pytest

from app.games.cricket import BALLS, WICKETS, Cricket, EasyCricketBot, MediumCricketBot
from app.games.tictactoe import MoveError
from tests.test_rooms_bot import client, connect, next_of  # noqa: F401  (client is a fixture)


def ball(g, bat, bowl):
    """Play one ball: the batter picks `bat`, the bowler `bowl`."""
    g.apply({"pick": bat}, g.batting)
    g.apply({"pick": bowl}, g.bowling)


def test_a_different_number_scores_the_batters_pick():
    g = Cricket()
    ball(g, 4, 2)
    assert g.runs["home"] == 4 and g.wickets["home"] == 0 and g.balls["home"] == 1
    assert g.last == {"batter": "home", "bat": 4, "bowl": 2, "runs": 4, "out": False}
    assert g.history == ["home 4 v 2: 4 runs"]


def test_matching_numbers_are_out():
    g = Cricket()
    ball(g, 3, 3)
    assert g.runs["home"] == 0 and g.wickets["home"] == 1
    assert g.last["out"] is True


def test_picks_stay_secret_until_both_are_in():
    g = Cricket()
    g.apply({"pick": 6}, "home")
    view = g.view()
    assert view["picked"] == {"home": True, "away": False}
    assert "6" not in str({k: v for k, v in view.items() if k != "maxWickets"})
    assert view["last"] is None and view["turn"] == "away"
    # The bowler may pick first too.
    g2 = Cricket()
    g2.apply({"pick": 2}, "away")
    assert g2.turn == "home"


def test_bad_picks_are_refused():
    g = Cricket()
    for bad in (0, 7, "3", True, None):
        with pytest.raises(MoveError, match="1 to 6"):
            g.apply({"pick": bad}, "home")
    g.apply({"pick": 1}, "home")
    with pytest.raises(MoveError, match="already picked"):
        g.apply({"pick": 2}, "home")


def test_innings_ends_after_all_wickets_and_the_other_side_chases():
    g = Cricket()
    ball(g, 6, 1)
    for _ in range(WICKETS):
        ball(g, 2, 2)
    assert g.innings == 2 and g.batting == "away" and g.target == 7
    ball(g, 6, 1)
    assert not g.winner
    ball(g, 1, 2)
    assert g.winner == "away" and g.reason == "chased the target" and g.scores["away"] == 1


def test_innings_ends_when_the_balls_run_out_and_a_tie_is_a_draw():
    g = Cricket()
    for _ in range(BALLS):
        ball(g, 1, 2)
    assert g.innings == 2 and g.runs["home"] == BALLS
    for _ in range(BALLS):
        ball(g, 1, 2)
    assert g.winner == "draw" and g.scores["draw"] == 1


def test_the_side_batting_first_can_defend():
    g = Cricket()
    ball(g, 5, 1)
    for _ in range(WICKETS):
        ball(g, 1, 1)
    for _ in range(WICKETS):
        ball(g, 4, 4)
    assert g.winner == "home" and g.reason == "defended the total"
    with pytest.raises(MoveError, match="over"):
        g.apply({"pick": 1}, "home")


def test_rematch_swaps_who_bats_first():
    g = Cricket()
    with pytest.raises(MoveError):
        g.rematch()
    for _ in range(WICKETS * 2):
        ball(g, 1, 1)
    g.rematch()
    assert g.round == 2 and g.first == "away" and g.batting == "away" and g.innings == 1
    assert g.runs == {"home": 0, "away": 0} and g.history == [] and g.moves == 0


def test_bots_pick_numbers_from_one_to_six():
    g = Cricket()
    ball(g, 3, 1)
    ball(g, 3, 2)
    for bot in (EasyCricketBot(), MediumCricketBot()):
        for seat in ("home", "away"):
            for _ in range(20):
                assert 1 <= g.bot_move(bot, seat)["pick"] <= 6


def test_the_bot_list_for_cricket(client):
    bots = client.get("/v1/bots?game=cricket").json()
    assert [b["id"] for b in bots] == ["easy", "medium"]
    assert all(b["available"] for b in bots)


def test_a_whole_game_against_the_bot(client):
    with connect(client, "cricket:c1", bot="medium") as ws:
        game = next_of(ws, "state")["game"]
        assert game["seats"]["home"]["username"] == "ada"
        assert game["seats"]["away"]["username"] == "Medium Bot"
        for _ in range(2 * BALLS + 1):
            if game["winner"]:
                break
            balls = game["balls"]["home"] + game["balls"]["away"]
            ws.send_json({"type": "move", "pick": 3})
            game = next_of(
                ws, "state", lambda m: m["game"]["balls"]["home"] + m["game"]["balls"]["away"] > balls
            )["game"]
        assert game["winner"] in ("home", "away", "draw")
