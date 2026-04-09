from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.websocket import manager

router = APIRouter(tags=["websockets"])

@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)