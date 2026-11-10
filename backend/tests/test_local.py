import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_MODE", "true")
    monkeypatch.setenv("LOCAL_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("RESEND_API_KEY", "")  # never send real email from tests
    get_settings.cache_clear()
    with TestClient(create_app()) as c:
        yield c
    get_settings.cache_clear()


def sign_up(client, email="ada@example.com"):
    sent = client.post("/v1/local/otp/send", json={"email": email}).json()
    res = client.post("/v1/local/otp/verify", json={"email": email, "code": sent["dev_code"]})
    assert res.status_code == 200
    return res.json()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_whole_sign_up_flow(client):
    first = sign_up(client)
    assert first["user"]["email"] == "ada@example.com"
    assert first["user"]["username"] is None  # email confirmed, no username yet

    done = client.post(
        "/v1/local/signup/complete",
        json={"username": "Ada_99", "password": "correct horse"},
        headers=auth(first["access_token"]),
    ).json()
    assert done["user"]["username"] == "ada_99"

    # The same token works against the API's normal protected routes.
    me = client.get("/v1/me", headers=auth(done["access_token"])).json()
    assert me["username"] == "ada_99"

    signin = client.post("/v1/local/signin", json={"email": "ada@example.com", "password": "correct horse"})
    assert signin.status_code == 200
    assert client.get("/v1/local/stats", headers=auth(signin.json()["access_token"])).json() == {"played": 0, "won": 0}


def test_wrong_password_and_unknown_user(client):
    first = sign_up(client)
    client.post(
        "/v1/local/signup/complete",
        json={"username": "ada", "password": "correct horse"},
        headers=auth(first["access_token"]),
    )
    assert client.post("/v1/local/signin", json={"email": "ada@example.com", "password": "nope nope"}).status_code == 401
    assert client.post("/v1/local/signin", json={"email": "who@example.com", "password": "correct horse"}).status_code == 401


def test_wrong_code_is_rejected(client):
    client.post("/v1/local/otp/send", json={"email": "ada@example.com"})
    res = client.post("/v1/local/otp/verify", json={"email": "ada@example.com", "code": "000000"})
    assert res.status_code in (400, 429)


def test_username_must_be_unique(client):
    one = sign_up(client, "one@example.com")
    two = sign_up(client, "two@example.com")
    body = {"username": "samename", "password": "correct horse"}
    assert client.post("/v1/local/signup/complete", json=body, headers=auth(one["access_token"])).status_code == 200
    assert client.post("/v1/local/signup/complete", json=body, headers=auth(two["access_token"])).status_code == 409


def test_username_and_password_rules(client):
    first = sign_up(client)
    headers = auth(first["access_token"])
    assert client.post("/v1/local/signup/complete", json={"username": "no", "password": "correct horse"}, headers=headers).status_code == 400
    assert client.post("/v1/local/signup/complete", json={"username": "fine_name", "password": "short"}, headers=headers).status_code == 422


def test_delete_account_removes_everything(client):
    first = sign_up(client)
    done = client.post(
        "/v1/local/signup/complete",
        json={"username": "ada", "password": "correct horse"},
        headers=auth(first["access_token"]),
    ).json()
    assert client.delete("/v1/local/account", headers=auth(done["access_token"])).status_code == 200
    assert client.post("/v1/local/signin", json={"email": "ada@example.com", "password": "correct horse"}).status_code == 401


def test_local_routes_need_a_token(client):
    assert client.get("/v1/local/session").status_code == 401
    assert client.delete("/v1/local/account").status_code == 401


def test_lan_browsers_are_allowed_in_local_mode(client):
    def allowed(origin):
        res = client.options(
            "/v1/local/otp/send",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"},
        )
        return res.headers.get("access-control-allow-origin") == origin

    assert allowed("http://localhost:5175")
    assert allowed("http://192.168.2.111:5175")
    assert allowed("http://10.0.0.7:5175")
    assert allowed("http://172.20.1.2:5175")
    assert not allowed("https://evil.example.com")
    assert not allowed("http://192.168.2.111.evil.com:5175")
    assert not allowed("http://172.40.1.2:5175")
