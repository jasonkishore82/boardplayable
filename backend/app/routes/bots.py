from typing import Any

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..games.bots import list_bots

router = APIRouter(prefix="/v1", tags=["bots"])


@router.get("/bots")
def bots(game: str = "tic-tac-toe", settings: Settings = Depends(get_settings)) -> list[dict[str, Any]]:
    """The computer opponents for a game, and which of them can be played right now."""
    return list_bots(settings.custom_bot_path, game, settings.maia_model_dir)
