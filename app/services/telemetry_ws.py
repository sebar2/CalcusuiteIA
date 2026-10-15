import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Any, List, Optional
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.database.session import SessionLocal
from app.models.logistics_entities import LogisticsTelemetryPing, LogisticsDispatchOrder

logger = logging.getLogger("calcu.telemetry_ws")

class TelemetryConnectionManager:
    """
    Gestor de conexiones WebSocket persistentes para telemetría GPS y tracking en vivo.
    - Soporta WebSockets de choferes móviles en ruta (/ws/tracking/driver/{order_id}).
    - Soporta WebSockets de torres de control / despachadores (/ws/tracking/fleet).
    - Minimiza sobrecarga de cabeceras HTTP y latencia en enlaces Tailscale VPN.
    """

    def __init__(self):
        # order_id -> Set de WebSockets de choferes o monitores de esa orden
        self.driver_connections: Dict[int, Set[WebSocket]] = {}
        # Conexiones activas de despachadores / torre de control global
        self.fleet_connections: Set[WebSocket] = set()
        # Caché rápida en memoria de la última posición reportada por orden
        self.latest_positions: Dict[int, Dict[str, Any]] = {}

    async def connect_driver(self, websocket: WebSocket, order_id: int):
        await websocket.accept()
        if order_id not in self.driver_connections:
            self.driver_connections[order_id] = set()
        self.driver_connections[order_id].add(websocket)
        logger.info("Chofer conectado a WebSocket para orden #%d", order_id)

    def disconnect_driver(self, websocket: WebSocket, order_id: int):
        if order_id in self.driver_connections:
            self.driver_connections[order_id].discard(websocket)
            if not self.driver_connections[order_id]:
                del self.driver_connections[order_id]
        logger.info("Chofer desconectado de WebSocket para orden #%d", order_id)

    async def connect_fleet(self, websocket: WebSocket):
        await websocket.accept()
        self.fleet_connections.add(websocket)
        logger.info("Despachador conectado a WebSocket de flota global (Total activos: %d)", len(self.fleet_connections))

    def disconnect_fleet(self, websocket: WebSocket):
        self.fleet_connections.discard(websocket)
        logger.info("Despachador desconectado de WebSocket de flota global (Total activos: %d)", len(self.fleet_connections))

    async def broadcast_to_fleet(self, payload: Dict[str, Any]):
        """Envía actualización a todas las pantallas de despacho activas en tiempo real."""
        dead_connections = set()
        data_text = json.dumps(payload, default=str)
        for ws in self.fleet_connections:
            try:
                await ws.send_text(data_text)
            except Exception as e:
                logger.warning("Fallo al enviar a despachador WS: %s", e)
                dead_connections.add(ws)

        for dead in dead_connections:
            self.fleet_connections.discard(dead)

    def record_and_broadcast_ping(
        self,
        order_id: int,
        lat: float,
        lng: float,
        velocidad_kmh: float = 0.0,
        bateria_pct: int = 100,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Persiste el ping en la base de datos y genera el payload enriquecido para broadcast.
        """
        now = datetime.now(timezone.utc)
        should_close_db = False
        if db is None:
            db = SessionLocal()
            should_close_db = True

        try:
            ping = LogisticsTelemetryPing(
                order_id=order_id,
                lat=lat,
                lng=lng,
                velocidad_kmh=velocidad_kmh,
                bateria_pct=bateria_pct,
            )
            db.add(ping)
            db.commit()

            order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
            driver_name = order.driver.nombre if (order and order.driver) else "Conductor"
            client_name = order.client.nombre_comercial if (order and order.client) else "Cliente"
            numero_orden = order.numero_orden if order else f"ORD-{order_id}"

            marker = {
                "order_id": order_id,
                "numero_orden": numero_orden,
                "client_nombre": client_name,
                "driver_nombre": driver_name,
                "lat": lat,
                "lng": lng,
                "velocidad_kmh": velocidad_kmh,
                "bateria_pct": bateria_pct,
                "timestamp": now.isoformat(),
            }
            self.latest_positions[order_id] = marker
            return marker
        finally:
            if should_close_db:
                db.close()


telemetry_manager = TelemetryConnectionManager()
