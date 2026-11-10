from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status

from ..auth import InvalidToken, verify_token
from ..config import Settings, get_settings
from ..realtime.rooms import RoomFull, rooms

router = APIRouter(prefix="/v1", tags=["rooms"])


@router.websocket("/rooms/{room_id}")
async def room_socket(
    ws: WebSocket, room_id: str, token: str = "", settings: Settings = Depends(get_settings)
) -> None:
    # Browsers cannot set headers on a WebSocket, so the access token comes as ?token=
    try:
        user = verify_token(token, settings)
    except InvalidToken:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    try:
        room = await rooms.join(room_id, user, ws)
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
