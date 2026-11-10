from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .local.db import migrate
from .routes import health, local, me, otp, rooms


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
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(otp.router)
    if settings.local_mode:
        app.include_router(local.router)
    app.include_router(rooms.router)
    return app


app = create_app()
