from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status

from ..auth import InvalidToken, verify_token
from ..config import Settings, get_settings
from ..games.bots import BotUnavailable, make_bot
from ..realtime.rooms import RoomFull, rooms

router = APIRouter(prefix="/v1", tags=["rooms"])


@router.websocket("/rooms/{room_id}")
async def room_socket(
    ws: WebSocket,
    room_id: str,
    token: str = "",
    bot: str = "",
    seat: str = "",
    settings: Settings = Depends(get_settings),
) -> None:
    # ?seat=white|black is the side the player would like, in games that let them choose (chess).
    # Browsers cannot set headers on a WebSocket, so the access token comes as ?token=
    try:
        user = verify_token(token, settings)
    except InvalidToken:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    opponent = None
    if bot:
        # ?bot=easy|medium|jkw asks for a computer opponent. It only takes effect when this connection creates the room.
        try:
            opponent = make_bot(bot, settings.custom_bot_path, room_id.split(":", 1)[0], settings.maia_model_dir)
        except BotUnavailable:
            await ws.send_json({"type": "error", "message": "That bot isn't available right now.", "fatal": True})
            await ws.close()
            return
    try:
        room = await rooms.join(room_id, user, ws, bot=opponent, seat=seat or None)
    except RoomFull:
        await ws.send_json({"type": "error", "message": "This game is full.", "fatal": True})
        await ws.close()
        return

    try:
        while True:
            data = await ws.receive_json()
            await rooms.handle(room, user, ws, data)
    except WebSocketDisconnect:
        pass
    finally:
        await rooms.leave(room, user)
