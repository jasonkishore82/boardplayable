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


def make_user(client, name):
    email = f"{name}@example.com"
    code = client.post("/v1/local/otp/send", json={"email": email}).json()["dev_code"]
    first = client.post("/v1/local/otp/verify", json={"email": email, "code": code}).json()
    done = client.post(
        "/v1/local/signup/complete",
        json={"username": name, "password": "correct horse"},
        headers={"Authorization": f"Bearer {first['access_token']}"},
    ).json()
    return {"id": done["user"]["id"], "h": {"Authorization": f"Bearer {done['access_token']}"}}


def test_new_users_start_with_the_test_bot_as_a_friend(client):
    ada = make_user(client, "ada")
    lists = client.get("/v1/local/friends", headers=ada["h"]).json()
    assert [f["username"] for f in lists["friends"]] == ["playbot"]
    assert lists["friends"][0]["user_id"] == BOT_ID


def test_bot_replies_to_messages(client):
    ada = make_user(client, "ada")
    sent = client.post(f"/v1/local/messages/{BOT_ID}", json={"body": "hello bot"}, headers=ada["h"])
    assert sent.status_code == 200
    thread = client.get(f"/v1/local/messages/{BOT_ID}", headers=ada["h"]).json()
    assert [m["sender_id"] for m in thread] == [ada["id"], BOT_ID]
    assert thread[0]["body"] == "hello bot"


def test_friend_request_flow_and_chat(client):
    ada, bob = make_user(client, "ada"), make_user(client, "bob")
    assert client.post("/v1/local/friends/request", json={"username": "Bob"}, headers=ada["h"]).status_code == 200

    # Bob sees it, Ada sees it as waiting.
    bob_lists = client.get("/v1/local/friends", headers=bob["h"]).json()
    assert [r["username"] for r in bob_lists["incoming"]] == ["ada"]
    assert [r["username"] for r in client.get("/v1/local/friends", headers=ada["h"]).json()["outgoing"]] == ["bob"]

    # No chatting until accepted.
    assert client.post(f"/v1/local/messages/{bob['id']}", json={"body": "hi"}, headers=ada["h"]).status_code == 403

    fid = bob_lists["incoming"][0]["friendship_id"]
    assert client.post(f"/v1/local/friends/{fid}/respond", json={"accept": True}, headers=bob["h"]).status_code == 200

    assert client.post(f"/v1/local/messages/{bob['id']}", json={"body": "hi bob"}, headers=ada["h"]).status_code == 200
    assert client.post(f"/v1/local/messages/{ada['id']}", json={"body": "hi ada"}, headers=bob["h"]).status_code == 200
    thread = client.get(f"/v1/local/messages/{ada['id']}", headers=bob["h"]).json()
    assert [m["body"] for m in thread] == ["hi bob", "hi ada"]


def test_request_errors(client):
    ada, bob = make_user(client, "ada"), make_user(client, "bob")
    assert client.post("/v1/local/friends/request", json={"username": "nobody"}, headers=ada["h"]).status_code == 404
    assert client.post("/v1/local/friends/request", json={"username": "ada"}, headers=ada["h"]).status_code == 400
    assert client.post("/v1/local/friends/request", json={"username": "bob"}, headers=ada["h"]).status_code == 200
    assert client.post("/v1/local/friends/request", json={"username": "bob"}, headers=ada["h"]).status_code == 409
    # Bob asking Ada back is also a duplicate.
    assert client.post("/v1/local/friends/request", json={"username": "ada"}, headers=bob["h"]).status_code == 409


def test_only_the_recipient_can_answer(client):
    ada, bob = make_user(client, "ada"), make_user(client, "bob")
    client.post("/v1/local/friends/request", json={"username": "bob"}, headers=ada["h"])
    fid = client.get("/v1/local/friends", headers=bob["h"]).json()["incoming"][0]["friendship_id"]
    assert client.post(f"/v1/local/friends/{fid}/respond", json={"accept": True}, headers=ada["h"]).status_code == 404


def test_messages_are_validated_and_private(client):
    ada, bob, eve = make_user(client, "ada"), make_user(client, "bob"), make_user(client, "eve")
    client.post("/v1/local/friends/request", json={"username": "bob"}, headers=ada["h"])
    fid = client.get("/v1/local/friends", headers=bob["h"]).json()["incoming"][0]["friendship_id"]
    client.post(f"/v1/local/friends/{fid}/respond", json={"accept": True}, headers=bob["h"])

    assert client.post(f"/v1/local/messages/{bob['id']}", json={"body": "   "}, headers=ada["h"]).status_code == 400
    assert client.post(f"/v1/local/messages/{bob['id']}", json={"body": "x" * 1001}, headers=ada["h"]).status_code == 400
    # A third person cannot read the conversation.
    assert client.get(f"/v1/local/messages/{bob['id']}", headers=eve["h"]).status_code == 403
    assert client.get(f"/v1/local/messages/{ada['id']}", headers=eve["h"]).status_code == 403


def test_declined_and_removed_friends_cannot_chat(client):
    ada, bob = make_user(client, "ada"), make_user(client, "bob")
    client.post("/v1/local/friends/request", json={"username": "bob"}, headers=ada["h"])
    fid = client.get("/v1/local/friends", headers=bob["h"]).json()["incoming"][0]["friendship_id"]
    client.post(f"/v1/local/friends/{fid}/respond", json={"accept": True}, headers=bob["h"])
    assert client.delete(f"/v1/local/friends/{fid}", headers=ada["h"]).status_code == 200
    assert client.post(f"/v1/local/messages/{bob['id']}", json={"body": "hi"}, headers=ada["h"]).status_code == 403
