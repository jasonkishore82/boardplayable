import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import create_app

SECRET = "test-secret-at-least-32-characters-long"


def make_token(sub: str = "user-1", username: str = "ada", **overrides) -> str:
    claims = {
        "sub": sub,
        "email": f"{username}@example.com",
        "aud": "authenticated",
        "exp": int(time.time()) + 3600,
        "user_metadata": {"username": username},
        **overrides,
    }
    return jwt.encode(claims, SECRET, algorithm="HS256")


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co", supabase_jwt_secret=SECRET
    )
    return TestClient(app)


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_me_requires_token(client):
    assert client.get("/v1/me").status_code == 401


def test_me_rejects_bad_token(client):
    bad = jwt.encode({"sub": "x", "aud": "authenticated"}, "wrong-secret-wrong-secret-wrong!!", algorithm="HS256")
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_me_rejects_expired_token(client):
    token = make_token(exp=int(time.time()) - 10)
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_me_returns_user(client):
    res = client.get("/v1/me", headers={"Authorization": f"Bearer {make_token()}"})
    assert res.status_code == 200
    assert res.json() == {"id": "user-1", "email": "ada@example.com", "username": "ada"}


def test_room_presence_and_relay(client):
    with client.websocket_connect(f"/v1/rooms/r1?token={make_token('a', 'ada')}") as a:
        assert a.receive_json()["players"] == [{"id": "a", "username": "ada"}]
        with client.websocket_connect(f"/v1/rooms/r1?token={make_token('b', 'bo')}") as b:
            assert len(a.receive_json()["players"]) == 2
            assert len(b.receive_json()["players"]) == 2
            b.send_json({"move": "e4"})
            assert a.receive_json() == {"type": "message", "from": "b", "data": {"move": "e4"}}


def test_room_rejects_missing_token(client):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/v1/rooms/r1") as ws:
            ws.receive_json()
