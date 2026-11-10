from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.otp import MAX_ATTEMPTS, get_gateway, hash_code


class FakeGateway:
    def __init__(self):
        self.records = {}
        self.sent = []
        self.created = []

    def hash(self, email, code):
        return hash_code(email, code, "test-secret")

    async def get_record(self, email):
        return self.records.get(email)

    async def save_record(self, email, code_hash, expires_at, sent_at):
        self.records[email] = {
            "email": email,
            "code_hash": code_hash,
            "attempts": 0,
            "expires_at": expires_at.isoformat(),
            "sent_at": sent_at.isoformat(),
        }

    async def set_attempts(self, email, attempts):
        self.records[email]["attempts"] = attempts

    async def delete_record(self, email):
        self.records.pop(email, None)

    async def send_email(self, email, code):
        self.sent.append((email, code))

    async def sign_in_token(self, email):
        self.created.append(email)
        return "token-hash-123"


@pytest.fixture
def gateway():
    return FakeGateway()


@pytest.fixture
def client(gateway):
    app = create_app()
    app.dependency_overrides[get_gateway] = lambda: gateway
    return TestClient(app)


def send(client, email="Ada@Example.com"):
    return client.post("/v1/otp/send", json={"email": email})


def test_send_emails_a_six_digit_code(client, gateway):
    assert send(client).json() == {"sent": True}
    email, code = gateway.sent[0]
    assert email == "ada@example.com"
    assert len(code) == 6 and code.isdigit()
    # Only a hash is stored, never the code itself.
    assert code not in str(gateway.records["ada@example.com"])


def test_send_rejects_bad_email(client):
    assert send(client, "nope").status_code == 400


def test_send_has_a_cooldown(client):
    assert send(client).status_code == 200
    assert send(client).status_code == 429


def test_verify_with_the_right_code(client, gateway):
    send(client)
    _, code = gateway.sent[0]
    res = client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": code})
    assert res.status_code == 200
    assert res.json() == {"token_hash": "token-hash-123"}
    assert gateway.created == ["ada@example.com"]
    # A code works once.
    again = client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": code})
    assert again.status_code == 400


def test_verify_rejects_a_wrong_code(client, gateway):
    send(client)
    _, code = gateway.sent[0]
    wrong = "000000" if code != "000000" else "111111"
    res = client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": wrong})
    assert res.status_code == 400
    assert gateway.records["ada@example.com"]["attempts"] == 1
    assert gateway.created == []


def test_verify_locks_after_too_many_tries(client, gateway):
    send(client)
    _, code = gateway.sent[0]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(MAX_ATTEMPTS):
        client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": wrong})
    # Even the right code is refused now.
    res = client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": code})
    assert res.status_code == 429


def test_verify_rejects_an_expired_code(client, gateway):
    send(client)
    _, code = gateway.sent[0]
    gateway.records["ada@example.com"]["expires_at"] = (
        datetime.now(timezone.utc) - timedelta(minutes=1)
    ).isoformat()
    res = client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": code})
    assert res.status_code == 400


def test_verify_without_a_request(client):
    assert client.post("/v1/otp/verify", json={"email": "ghost@example.com", "code": "123456"}).status_code == 400


def test_verify_needs_six_digits(client):
    assert client.post("/v1/otp/verify", json={"email": "ada@example.com", "code": "12ab"}).status_code == 422
