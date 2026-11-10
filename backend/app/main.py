from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .local.db import migrate
from .routes import health, local, me, otp, rooms, social_local


LAN_ORIGINS = (
    r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d{2,5}$"
)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.local_mode:
            for name in migrate(settings.local_db_path):
                print(f"[local mode] applied {name} to {settings.local_db_path}", flush=True)
        yield

    app = FastAPI(title="Board Playable API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        # Local mode only: pages opened from localhost or a private LAN address (for testing with friends).
        allow_origin_regex=LAN_ORIGINS if settings.local_mode else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(otp.router)
    if settings.local_mode:
        app.include_router(local.router)
        app.include_router(social_local.router)
    app.include_router(rooms.router)
    return app


app = create_app()
