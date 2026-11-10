"""Email one-time codes for sign-up.

The API makes the 6-digit code, stores only a keyed hash of it, and emails it with Resend. The storage is
pluggable: `HttpGateway` keeps codes in Supabase (table `email_otps`, readable by the service role alone), so
it works on serverless hosts such as Vercel. `app.local.gateway.SqliteGateway` keeps them in a local SQLite file.
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol
from urllib.parse import quote

import httpx
from fastapi import Depends, HTTPException

from .config import Settings, get_settings

CODE_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 30
MAX_ATTEMPTS = 5
BAD_CODE = "That code is wrong or has expired. Request a new one."


def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(email: str, code: str, secret: str) -> str:
    return hmac.new(secret.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def email_bodies(code: str) -> tuple[str, str]:
    html = (
        '<div style="font-family:system-ui,sans-serif;max-width:420px">'
        "<h2>Your Board Playable code</h2>"
        f'<p style="font-size:30px;letter-spacing:8px;margin:16px 0"><strong>{code}</strong></p>'
        f"<p>It expires in {CODE_TTL_MINUTES} minutes. If you didn&rsquo;t ask for this, ignore this email.</p>"
        "</div>"
    )
    text = f"Your Board Playable code is {code}. It expires in {CODE_TTL_MINUTES} minutes."
    return html, text


async def deliver_email(resend_key: str, sender: str, email: str, code: str) -> None:
    """Send the code with Resend. Raises a 502 when Resend refuses."""
    html, text = email_bodies(code)
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {resend_key}", "User-Agent": "boardplayable-api/1.0"},
            json={"from": sender, "to": [email], "subject": "Your Board Playable code", "html": html, "text": text},
        )
    if res.status_code >= 400:
        raise HTTPException(502, "We couldn't send the email. Try again in a moment.")


class OtpGateway(Protocol):
    def hash(self, email: str, code: str) -> str: ...
    async def get_record(self, email: str) -> dict[str, Any] | None: ...
    async def save_record(self, email: str, code_hash: str, expires_at: datetime, sent_at: datetime) -> None: ...
    async def set_attempts(self, email: str, attempts: int) -> None: ...
    async def delete_record(self, email: str) -> None: ...
    async def send_email(self, email: str, code: str) -> None: ...


async def issue_code(gateway: OtpGateway, email: str) -> str:
    """Make a code, store its hash, and email it. Returns the code (the caller must not expose it in production)."""
    now = datetime.now(timezone.utc)
    record = await gateway.get_record(email)
    if record and now - parse_time(record["sent_at"]) < timedelta(seconds=RESEND_COOLDOWN_SECONDS):
        raise HTTPException(429, "Wait a few seconds before asking for another code.")

    code = new_code()
    await gateway.save_record(email, gateway.hash(email, code), now + timedelta(minutes=CODE_TTL_MINUTES), now)
    await gateway.send_email(email, code)
    return code


async def check_code(gateway: OtpGateway, email: str, code: str) -> None:
    """Raises unless `code` is the live code for `email`. A good code is used up."""
    now = datetime.now(timezone.utc)
    record = await gateway.get_record(email)
    if not record or parse_time(record["expires_at"]) < now:
        raise HTTPException(400, BAD_CODE)

    attempts = int(record["attempts"])
    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong codes. Request a new one.")
    # Count the try before checking it, so a failed request can't be retried for free.
    await gateway.set_attempts(email, attempts + 1)

    if not hmac.compare_digest(record["code_hash"], gateway.hash(email, code)):
        raise HTTPException(400, BAD_CODE)
    await gateway.delete_record(email)


class HttpGateway:
    """Talks to Supabase (storage and user admin) and Resend (email)."""

    def __init__(self, settings: Settings) -> None:
        self.url = settings.supabase_url.rstrip("/")
        self.key = settings.supabase_service_role_key
        self.resend_key = settings.resend_api_key
        self.sender = settings.resend_from_email
        self.secret = settings.otp_secret or self.key

    def hash(self, email: str, code: str) -> str:
        return hash_code(email, code, self.secret)

    @property
    def _headers(self) -> dict[str, str]:
        return {"apikey": self.key, "Authorization": f"Bearer {self.key}"}

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        async with httpx.AsyncClient(timeout=15) as client:
            return await client.request(method, url, **kwargs)

    async def get_record(self, email: str) -> dict[str, Any] | None:
        res = await self._request(
            "GET",
            f"{self.url}/rest/v1/email_otps?email=eq.{quote(email, safe='')}&select=*",
            headers=self._headers,
        )
        res.raise_for_status()
        rows = res.json()
        return rows[0] if rows else None

    async def save_record(self, email: str, code_hash: str, expires_at: datetime, sent_at: datetime) -> None:
        res = await self._request(
            "POST",
            f"{self.url}/rest/v1/email_otps?on_conflict=email",
            headers={**self._headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
            json={
                "email": email,
                "code_hash": code_hash,
                "attempts": 0,
                "expires_at": expires_at.isoformat(),
                "sent_at": sent_at.isoformat(),
            },
        )
        res.raise_for_status()

    async def set_attempts(self, email: str, attempts: int) -> None:
        res = await self._request(
            "PATCH",
            f"{self.url}/rest/v1/email_otps?email=eq.{quote(email, safe='')}",
            headers=self._headers,
            json={"attempts": attempts},
        )
        res.raise_for_status()

    async def delete_record(self, email: str) -> None:
        res = await self._request(
            "DELETE", f"{self.url}/rest/v1/email_otps?email=eq.{quote(email, safe='')}", headers=self._headers
        )
        res.raise_for_status()

    async def send_email(self, email: str, code: str) -> None:
        await deliver_email(self.resend_key, self.sender, email, code)

    async def sign_in_token(self, email: str) -> str:
        """Make sure the user exists (confirmed), then return a one-time token the browser can exchange for a session."""
        created = await self._request(
            "POST",
            f"{self.url}/auth/v1/admin/users",
            headers=self._headers,
            json={"email": email, "email_confirm": True},
        )
        # 422 means the account already exists, which is fine.
        if created.status_code >= 400 and created.status_code != 422:
            raise HTTPException(502, "We couldn't create your account. Try again in a moment.")
        link = await self._request(
            "POST",
            f"{self.url}/auth/v1/admin/generate_link",
            headers=self._headers,
            json={"type": "magiclink", "email": email},
        )
        if link.status_code >= 400:
            raise HTTPException(502, "We couldn't sign you in. Try again in a moment.")
        return link.json()["hashed_token"]


def get_gateway(settings: Settings = Depends(get_settings)) -> HttpGateway:
    if not (settings.supabase_url and settings.supabase_service_role_key and settings.resend_api_key):
        raise HTTPException(503, "Email sign-up isn't configured on the server.")
    return HttpGateway(settings)
