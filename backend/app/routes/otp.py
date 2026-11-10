import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..otp import HttpGateway, check_code, get_gateway, issue_code

router = APIRouter(prefix="/v1/otp", tags=["sign-up"])

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


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
    await issue_code(gateway, clean_email(body.email))
    # Same answer whether or not the address already has an account.
    return {"sent": True}


@router.post("/verify")
async def verify_code(body: VerifyBody, gateway: HttpGateway = Depends(get_gateway)) -> dict[str, str]:
    email = clean_email(body.email)
    await check_code(gateway, email, body.code)
    return {"token_hash": await gateway.sign_in_token(email)}
