from datetime import datetime
from typing import Any

from fastapi import Depends

from ..config import Settings, get_settings
from ..otp import deliver_email, hash_code
from .db import session


class SqliteGateway:
    """Keeps sign-up codes in the local SQLite file. Prints each code to the API console."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.path = settings.local_db_path
        self.secret = settings.otp_secret or settings.local_jwt_secret

    def hash(self, email: str, code: str) -> str:
        return hash_code(email, code, self.secret)

    async def get_record(self, email: str) -> dict[str, Any] | None:
        with session(self.path) as conn:
            row = conn.execute("select * from email_otps where email = ?", (email,)).fetchone()
            return dict(row) if row else None

    async def save_record(self, email: str, code_hash: str, expires_at: datetime, sent_at: datetime) -> None:
        with session(self.path) as conn:
            conn.execute(
                "insert or replace into email_otps (email, code_hash, attempts, expires_at, sent_at) "
                "values (?, ?, 0, ?, ?)",
                (email, code_hash, expires_at.isoformat(), sent_at.isoformat()),
            )

    async def set_attempts(self, email: str, attempts: int) -> None:
        with session(self.path) as conn:
            conn.execute("update email_otps set attempts = ? where email = ?", (attempts, email))

    async def delete_record(self, email: str) -> None:
        with session(self.path) as conn:
            conn.execute("delete from email_otps where email = ?", (email,))

    async def send_email(self, email: str, code: str) -> None:
        print(f"\n  [local mode] sign-up code for {email}: {code}\n", flush=True)
        # Optional: also send a real email when a Resend key is configured.
        if self.settings.resend_api_key:
            try:
                await deliver_email(self.settings.resend_api_key, self.settings.resend_from_email, email, code)
            except Exception as exc:  # local testing should never fail because email failed
                print(f"  [local mode] real email not sent: {exc}", flush=True)


def get_local_gateway(settings: Settings = Depends(get_settings)) -> SqliteGateway:
    return SqliteGateway(settings)
