"""Runtime settings. Every value comes from the environment (or a local .env file)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase project URL, e.g. https://<ref>.supabase.co
    supabase_url: str = ""
    # Only needed for projects that still sign tokens with the legacy shared secret.
    # Leave empty to verify tokens against the project's public signing keys (JWKS).
    supabase_jwt_secret: str = ""
    supabase_jwt_audience: str = "authenticated"

    # Server-side only. Lets the API create users and store sign-up codes. Never expose it to the browser.
    supabase_service_role_key: str = ""

    # Resend sends the sign-up code emails.
    resend_api_key: str = ""
    resend_from_email: str = "Board Playable <noreply@boardplayable.site>"
    # Key for hashing codes. Defaults to the service role key when empty.
    otp_secret: str = ""

    # Comma-separated list of front-end origins allowed to call the API.
    cors_origins: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
