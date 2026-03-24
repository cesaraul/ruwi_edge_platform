import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, org_id: str):
        await ws.accept()
        self._connections.setdefault(org_id, []).append(ws)
        logger.info("WebSocket conectado para org %s. Total: %d", org_id, len(self._connections[org_id]))

    def disconnect(self, ws: WebSocket, org_id: str):
        conns = self._connections.get(org_id, [])
        if ws in conns:
            conns.remove(ws)
        logger.info("WebSocket desconectado de org %s. Restantes: %d", org_id, len(conns))

    async def broadcast_to_org(self, org_id: str, data: dict):
        dead: list[WebSocket] = []
        for ws in self._connections.get(org_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, org_id)


ws_manager = ConnectionManager()
