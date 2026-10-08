from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.entities import StockLocationBatch, Inventory, Product
from app.domain.schemas import (
    StockLocationBatchCreate,
    StockLocationBatchResponse,
    StockTransferRequest,
    StockLocationSummary,
)


class StockTraceService:
    @staticmethod
    def _to_response(batch: StockLocationBatch) -> StockLocationBatchResponse:
        today = date.today()
        dias_restantes = None
        arribado = False

        if batch.fecha_eta:
            delta = (batch.fecha_eta - today).days
            dias_restantes = delta
            arribado = delta <= 0

        prod_name = batch.producto_rel.nombre if batch.producto_rel else batch.sku

        return StockLocationBatchResponse(
            id=batch.id,
            sku=batch.sku,
            producto_nombre=prod_name,
            cantidad=batch.cantidad,
            ubicacion=batch.ubicacion,
            pais_origen=batch.pais_origen,
            buque_o_tracking=batch.buque_o_tracking,
            fecha_despacho=batch.fecha_despacho,
            fecha_eta=batch.fecha_eta,
            dias_restantes_eta=dias_restantes,
            arribado=arribado,
            estado=batch.estado,
            observaciones=batch.observaciones,
            created_at=batch.created_at,
        )

    def list_batches(
        self,
        db: Session,
        ubicacion: Optional[str] = None
    ) -> List[StockLocationBatchResponse]:
        query = db.query(StockLocationBatch).order_by(desc(StockLocationBatch.created_at))
        if ubicacion:
            query = query.filter(StockLocationBatch.ubicacion == ubicacion)
        batches = query.all()
        return [self._to_response(b) for b in batches]

    def get_summary(self, db: Session) -> StockLocationSummary:
        batches = db.query(StockLocationBatch).all()
        summary = StockLocationSummary()
        summary.total_lotes = len(batches)

        today = date.today()
        for b in batches:
            summary.total_unidades += b.cantidad
            if b.ubicacion == "fabrica_origen":
                summary.fabrica_origen_unidades += b.cantidad
            elif b.ubicacion == "transito_maritimo":
                summary.transito_maritimo_unidades += b.cantidad
                if b.fecha_eta and (b.fecha_eta - today).days <= 0:
                    summary.lotes_arribados_pendientes += 1
            elif b.ubicacion == "deposito_central":
                summary.deposito_central_unidades += b.cantidad
            elif b.ubicacion == "showrooms_locales":
                summary.showrooms_locales_unidades += b.cantidad

        return summary

    def create_batch(self, db: Session, payload: StockLocationBatchCreate) -> StockLocationBatchResponse:
        batch = StockLocationBatch(
            id=payload.id,
            sku=payload.sku,
            cantidad=payload.cantidad,
            ubicacion=payload.ubicacion,
            pais_origen=payload.pais_origen,
            buque_o_tracking=payload.buque_o_tracking,
            fecha_despacho=payload.fecha_despacho,
            fecha_eta=payload.fecha_eta,
            estado=payload.estado,
            observaciones=payload.observaciones,
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return self._to_response(batch)

    def transfer_batch(self, db: Session, payload: StockTransferRequest) -> Optional[StockLocationBatchResponse]:
        batch = db.query(StockLocationBatch).filter(StockLocationBatch.id == payload.batch_id).first()
        if not batch:
            return None

        origen = batch.ubicacion
        destino = payload.destino
        if origen == destino:
            return self._to_response(batch)

        cant_a_mover = batch.cantidad
        if payload.cantidad and 0 < payload.cantidad < batch.cantidad:
            cant_a_mover = payload.cantidad
            # Reducir lote original
            batch.cantidad -= cant_a_mover
            # Crear nuevo lote transferido
            nuevo_id = f"{batch.id}-T{db.query(StockLocationBatch).filter(StockLocationBatch.id.like(f'{batch.id}%')).count()}"
            nuevo_batch = StockLocationBatch(
                id=nuevo_id,
                sku=batch.sku,
                cantidad=cant_a_mover,
                ubicacion=destino,
                pais_origen=batch.pais_origen,
                buque_o_tracking=batch.buque_o_tracking,
                fecha_despacho=batch.fecha_despacho,
                fecha_eta=batch.fecha_eta,
                estado="DISPONIBLE" if destino in ["deposito_central", "showrooms_locales"] else "EN_TRANSITO",
                observaciones=f"Transferido parcialmente ({cant_a_mover} u) desde {origen}. {payload.observaciones or ''}".strip(),
            )
            db.add(nuevo_batch)
            ret_batch = nuevo_batch
        else:
            # Mover todo el lote
            batch.ubicacion = destino
            batch.estado = "DISPONIBLE" if destino in ["deposito_central", "showrooms_locales"] else "EN_TRANSITO"
            if payload.observaciones:
                batch.observaciones = f"{batch.observaciones or ''} | {payload.observaciones}".strip()
            ret_batch = batch

        # Sincronización bidireccional con tabla `inventarios`
        prod = db.query(Product).filter(Product.sku == batch.sku).first()
        if prod:
            inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
            if inv:
                # Decrementar origen en inventarios
                if origen == "transito_maritimo":
                    inv.transito_maritimo = max(0, inv.transito_maritimo - cant_a_mover)
                elif origen == "deposito_central":
                    inv.deposito_central = max(0, inv.deposito_central - cant_a_mover)
                
                # Incrementar destino en inventarios
                if destino == "deposito_central":
                    inv.deposito_central += cant_a_mover
                elif destino == "transito_maritimo":
                    inv.transito_maritimo += cant_a_mover

        db.commit()
        db.refresh(ret_batch)
        return self._to_response(ret_batch)

    def auto_arrive_batches(self, db: Session) -> int:
        today = date.today()
        batches = db.query(StockLocationBatch).filter(
            StockLocationBatch.ubicacion == "transito_maritimo",
            StockLocationBatch.fecha_eta <= today
        ).all()

        count = 0
        for b in batches:
            self.transfer_batch(
                db=db,
                payload=StockTransferRequest(
                    batch_id=b.id,
                    destino="deposito_central",
                    observaciones="Recepción de arribo automático por cumplimiento de fecha ETA."
                )
            )
            count += 1

        return count


stock_trace_service = StockTraceService()
