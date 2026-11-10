"""Verifies Supabase access tokens so the API knows who is calling."""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings


@dataclass(frozen=True)
class User:
    id: str
    email: str | None
    username: str | None


class InvalidToken(Exception):
    pass


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True)


def verify_token(token: str, settings: Settings) -> User:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise InvalidToken("HS256 token but SUPABASE_JWT_SECRET is not set")
            key = settings.supabase_jwt_secret
        else:
            if not settings.supabase_url:
                raise InvalidToken("SUPABASE_URL is not set")
            key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token).key

        claims = jwt.decode(
            token,
            key,
            algorithms=[alg] if alg in {"HS256", "RS256", "ES256"} else [],
            audience=settings.supabase_jwt_audience,
        )
    except InvalidToken:
        raise
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc

    metadata = claims.get("user_metadata") or {}
    return User(id=claims["sub"], email=claims.get("email"), username=metadata.get("username"))


_bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing access token")
    try:
        return verify_token(credentials.credentials, settings)
    except InvalidToken as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid access token") from exc
