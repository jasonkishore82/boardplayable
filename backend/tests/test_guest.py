import re

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.local.bot import BOT_ID
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_MODE", "true")
    monkeypatch.setenv("LOCAL_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("RESEND_API_KEY", "")
    get_settings.cache_clear()
    with TestClient(create_app()) as c:
        yield c
    get_settings.cache_clear()


def auth(session):
    return {"Authorization": f"Bearer {session['access_token']}"}


def test_a_guest_can_start_playing_with_no_email_or_password(client):
    res = client.post("/v1/local/guest")
    assert res.status_code == 200
    session = res.json()
    assert re.fullmatch(r"guest_[0-9a-f]{6}", session["user"]["username"])
    assert session["user"]["email"].endswith("@guest.local")

    # The token works everywhere a normal one does.
    me = client.get("/v1/me", headers=auth(session)).json()
    assert me["username"] == session["user"]["username"]
    assert client.get("/v1/local/stats", headers=auth(session)).json() == {"played": 0, "won": 0}


def test_every_guest_is_a_different_player(client):
    one, two = client.post("/v1/local/guest").json(), client.post("/v1/local/guest").json()
    assert one["user"]["id"] != two["user"]["id"]
    assert one["user"]["username"] != two["user"]["username"]


def test_guests_start_with_the_test_friend_and_can_chat(client):
    guest = client.post("/v1/local/guest").json()
    friends = client.get("/v1/local/friends", headers=auth(guest)).json()["friends"]
    assert [f["user_id"] for f in friends] == [BOT_ID]
    sent = client.post(f"/v1/local/messages/{BOT_ID}", json={"body": "hi"}, headers=auth(guest))
    assert sent.status_code == 200


def test_a_guest_cannot_sign_in_with_a_password_later(client):
    guest = client.post("/v1/local/guest").json()
    for password in ("", "anything at all", "correct horse"):
        res = client.post("/v1/local/signin", json={"email": guest["user"]["email"], "password": password})
        assert res.status_code in (401, 422)


def test_a_guest_can_delete_their_account(client):
    guest = client.post("/v1/local/guest").json()
    assert client.delete("/v1/local/account", headers=auth(guest)).status_code == 200
    assert client.get("/v1/local/session", headers=auth(guest)).status_code == 401
