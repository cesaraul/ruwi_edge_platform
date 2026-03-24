from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.websocket.manager import ws_manager

ws_router = APIRouter()


@ws_router.websocket("/ws/{org_id}")
async def websocket_endpoint(
    ws: WebSocket,
    org_id: str,
    token: str = Query(...),
):
    payload = decode_token(token)
    if not payload or payload.get("org_id") != org_id:
        await ws.close(code=4001)
        return

    await ws_manager.connect(ws, org_id)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, org_id)
