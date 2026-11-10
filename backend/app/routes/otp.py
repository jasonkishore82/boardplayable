import hmac
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..otp import (
    CODE_TTL_MINUTES,
    MAX_ATTEMPTS,
    RESEND_COOLDOWN_SECONDS,
    HttpGateway,
    get_gateway,
    new_code,
    parse_time,
)

router = APIRouter(prefix="/v1/otp", tags=["sign-up"])

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
BAD_CODE = "That code is wrong or has expired. Request a new one."


class SendBody(BaseModel):
    email: str = Field(max_length=254)


class VerifyBody(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


def clean_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL.match(email):
        raise HTTPException(400, "Enter a valid email address.")
    return email


@router.post("/send")
async def send_code(body: SendBody, gateway: HttpGateway = Depends(get_gateway)) -> dict[str, bool]:
    email = clean_email(body.email)
    now = datetime.now(timezone.utc)

    record = await gateway.get_record(email)
    if record and now - parse_time(record["sent_at"]) < timedelta(seconds=RESEND_COOLDOWN_SECONDS):
        raise HTTPException(429, "Wait a few seconds before asking for another code.")

    code = new_code()
    await gateway.save_record(email, gateway.hash(email, code), now + timedelta(minutes=CODE_TTL_MINUTES), now)
    await gateway.send_email(email, code)
    # Same answer whether or not the address already has an account.
    return {"sent": True}


@router.post("/verify")
async def verify_code(body: VerifyBody, gateway: HttpGateway = Depends(get_gateway)) -> dict[str, str]:
    email = clean_email(body.email)
    now = datetime.now(timezone.utc)

    record = await gateway.get_record(email)
    if not record or parse_time(record["expires_at"]) < now:
        raise HTTPException(400, BAD_CODE)

    attempts = int(record["attempts"])
    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong codes. Request a new one.")
    # Count the try before checking it, so a failed request can't be retried for free.
    await gateway.set_attempts(email, attempts + 1)

    if not hmac.compare_digest(record["code_hash"], gateway.hash(email, body.code)):
        raise HTTPException(400, BAD_CODE)

    await gateway.delete_record(email)
    return {"token_hash": await gateway.sign_in_token(email)}
