import uuid
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Dict
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.entities import (
    StockLocationBatch,
    OrdenReposicion,
    Warehouse,
    Inventory,
    Product,
)
from app.domain.schemas import (
    BatchStage,
    StockBatchItem,
    WarehouseTransferPayload,
    WarehouseAssignStockPayload,
)


class InventorySyncService:
    """
    Motor reactivo de sincronización entre el Kanban de Reposición (ROP)
    y el Monitor Multi-Depósito por SKU + Lote.
    """

    WAREHOUSE_ID_MAP: Dict[str, str] = {
        "fabrica_origen": "FAB-CHINA",
        "transito_maritimo": "TRANSITO-MAR",
        "deposito_central": "DEP-CENTRAL-MVD",
        "dep-central": "DEP-CENTRAL-MVD",
        "DEP-CENTRAL-MVD": "DEP-CENTRAL-MVD",
        "dep-salto": "DEP-SALTO",
        "DEP-SALTO": "DEP-SALTO",
        "loc-pocitos": "SHOWROOM-POCITOS",
        "SHOWROOM-POCITOS": "SHOWROOM-POCITOS",
        "showrooms_locales": "SHOWROOM-POCITOS",
        "FAB-CHINA": "FAB-CHINA",
        "TRANSITO-MAR": "TRANSITO-MAR",
    }

    LOCATION_REVERSE_MAP: Dict[str, str] = {
        "FAB-CHINA": "fabrica_origen",
        "TRANSITO-MAR": "transito_maritimo",
        "DEP-CENTRAL-MVD": "deposito_central",
        "DEP-SALTO": "deposito_central", # Para inventario físico nacionalizado
        "SHOWROOM-POCITOS": "showrooms_locales",
    }

    def ensure_default_warehouses(self, db: Session):
        """Garantiza la presencia de los 5 nodos logísticos maestros en la BD."""
        default_whs = [
            ("FAB-CHINA", "Fábrica de Origen (Shenzhen / Alemania)", "FABRICA", "Shenzhen, China", 50000),
            ("TRANSITO-MAR", "Tránsito Marítimo / Aduana de Montevideo", "TRANSITO", "Ruta Marítima Océano Atlántico", 30000),
            ("DEP-CENTRAL-MVD", "Depósito Central Montevideo", "CENTRAL", "Montevideo, Uruguay", 25000),
            ("DEP-SALTO", "Depósito Regional Salto", "SUCURSAL", "Salto, Uruguay", 8000),
            ("SHOWROOM-POCITOS", "Showroom Pocitos (Retiro / Venta)", "SUCURSAL", "Pocitos, Montevideo", 3000),
        ]
        for w_id, nom, tipo, ubic, cap in default_whs:
            existing = db.query(Warehouse).filter(Warehouse.id == w_id).first()
            if not existing:
                wh = Warehouse(
                    id=w_id,
                    nombre=nom,
                    tipo=tipo,
                    ubicacion=ubic,
                    capacidad_unidades=cap,
                    activo=True,
                )
                db.add(wh)
        db.commit()

    def sync_rop_order_stage(self, db: Session, order: OrdenReposicion):
        """
        Sincroniza el cambio de etapa de una Orden de Reposición (ROP)
        con la entidad física StockLocationBatch.
        """
        self.ensure_default_warehouses(db)

        lote_id = f"LOT-2026-{order.sku_id}"
        today = date.today()

        batch = db.query(StockLocationBatch).filter(
            (StockLocationBatch.id == lote_id) | (StockLocationBatch.sku == order.sku_id)
        ).first()

        if order.etapa == "fabricacion":
            # 1. Fábrica de Origen
            if not batch:
                batch = StockLocationBatch(
                    id=lote_id,
                    sku=order.sku_id,
                    cantidad=order.cantidad,
                    ubicacion="fabrica_origen",
                    pais_origen="CN",
                    buque_o_tracking=f"PO-{order.id}-FAB-PROD",
                    fecha_despacho=today + timedelta(days=15),
                    fecha_eta=order.fecha_arribo_estimada,
                    estado="EN_PRODUCCION",
                    observaciones=f"Orden #{order.id} del proveedor {order.proveedor} en fabricación.",
                )
                db.add(batch)
            else:
                batch.ubicacion = "fabrica_origen"
                batch.estado = "EN_PRODUCCION"
                batch.buque_o_tracking = f"PO-{order.id}-FAB-PROD"
                batch.observaciones = f"Orden #{order.id} en fabricación."

        elif order.etapa == "transito":
            # 2. Tránsito Marítimo / Aduana
            if not batch:
                batch = StockLocationBatch(
                    id=lote_id,
                    sku=order.sku_id,
                    cantidad=order.cantidad,
                    ubicacion="transito_maritimo",
                    pais_origen="CN",
                    buque_o_tracking=f"COSCO-UY-{order.sku_id[:4]}",
                    fecha_despacho=today,
                    fecha_eta=order.fecha_arribo_estimada,
                    estado="EN_TRANSITO",
                    observaciones=f"Embarque marítimo de Orden #{order.id}.",
                )
                db.add(batch)
            else:
                batch.ubicacion = "transito_maritimo"
                batch.estado = "EN_TRANSITO"
                batch.buque_o_tracking = f"COSCO-UY-{order.sku_id[:4]}"
                batch.fecha_eta = order.fecha_arribo_estimada

            # Sincronizar columna tránsito en inventarios
            prod = db.query(Product).filter(Product.sku == order.sku_id).first()
            if prod:
                inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
                if inv:
                    inv.transito_maritimo = max(inv.transito_maritimo, order.cantidad)

        elif order.etapa == "ingresado":
            # 3. Ingresado al Depósito Central
            if not batch:
                batch = StockLocationBatch(
                    id=lote_id,
                    sku=order.sku_id,
                    cantidad=order.cantidad,
                    ubicacion="deposito_central",
                    pais_origen="CN",
                    buque_o_tracking="ARRIBADO-MVD",
                    fecha_despacho=today - timedelta(days=45),
                    fecha_eta=today,
                    estado="DISPONIBLE",
                    observaciones=f"Ingresado a Depósito Central Montevideo.",
                )
                db.add(batch)
            else:
                batch.ubicacion = "deposito_central"
                batch.estado = "DISPONIBLE"
                batch.buque_o_tracking = "ARRIBADO-MVD"

            # Actualizar inventario físico
            prod = db.query(Product).filter(Product.sku == order.sku_id).first()
            if prod:
                inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
                if inv:
                    inv.deposito_central += order.cantidad
                    inv.transito_maritimo = max(0, inv.transito_maritimo - order.cantidad)

        db.commit()

    def list_unified_batches(
        self,
        db: Session,
        warehouse_id: Optional[str] = None
    ) -> List[StockBatchItem]:
        """
        Retorna la lista normalizada de lotes asignados a los almacenes.
        """
        batches = db.query(StockLocationBatch).all()
        today = date.today()
        result: List[StockBatchItem] = []

        for b in batches:
            # Mapear ubicación a warehouse_id estandarizado
            wh_id = self.WAREHOUSE_ID_MAP.get(b.ubicacion, "DEP-CENTRAL-MVD")
            if warehouse_id and wh_id != warehouse_id and b.ubicacion != warehouse_id:
                continue

            # Determinar etapa enum
            if wh_id == "FAB-CHINA" or b.ubicacion == "fabrica_origen":
                etapa = BatchStage.FABRICACION
            elif wh_id == "TRANSITO-MAR" or b.ubicacion == "transito_maritimo":
                etapa = BatchStage.TRANSITO
            elif wh_id == "DEP-CENTRAL-MVD":
                etapa = BatchStage.CENTRAL
            elif wh_id == "DEP-SALTO":
                etapa = BatchStage.SUCURSAL
            elif wh_id == "SHOWROOM-POCITOS" or b.ubicacion == "showrooms_locales":
                etapa = BatchStage.SHOWROOM
            else:
                etapa = BatchStage.CENTRAL

            dias_rest = 0
            if b.fecha_eta:
                dias_rest = max(0, (b.fecha_eta - today).days)
            elif etapa == BatchStage.FABRICACION:
                dias_rest = 14

            prod_nombre = b.producto_rel.nombre if b.producto_rel else b.sku

            result.append(
                StockBatchItem(
                    id=b.id,
                    lote=b.id,
                    sku=b.sku,
                    cantidad=b.cantidad,
                    etapa=etapa,
                    etapa_logistica=etapa,
                    warehouse_id=wh_id,
                    origen_pais="China" if b.pais_origen in ["CN", "China"] else "Alemania",
                    proveedor="Luminar Global Logistics",
                    dias_restantes=dias_rest,
                    dias_restantes_eta=dias_rest,
                    fecha_eta=b.fecha_eta,
                    fecha_despacho=b.fecha_despacho,
                    producto_nombre=prod_nombre or b.sku,
                    buque_o_tracking=b.buque_o_tracking or "",
                    origen_tipo="ROP" if getattr(b, "orden_rop_id", None) else "STOCK_DIRECTO",
                    estado=b.estado or "DISPONIBLE",
                    observaciones=b.observaciones or "",
                )
            )

        return result

    def transfer_stock(
        self,
        db: Session,
        payload: WarehouseTransferPayload
    ) -> StockBatchItem:
        """
        Transfiere stock físico entre depósitos asegurando integridad por lote.
        """
        # Normalizar IDs
        orig_wh = self.WAREHOUSE_ID_MAP.get(payload.origen_id, payload.origen_id)
        dest_wh = self.WAREHOUSE_ID_MAP.get(payload.destino_id, payload.destino_id)

        # Buscar lote de origen
        batch = db.query(StockLocationBatch).filter(
            StockLocationBatch.id == payload.lote,
            StockLocationBatch.sku == payload.sku
        ).first()

        if not batch:
            # Fallback buscar lote por SKU en esa ubicación
            batch = db.query(StockLocationBatch).filter(
                StockLocationBatch.sku == payload.sku
            ).first()

        if not batch:
            raise ValueError(f"Lote {payload.lote} con SKU {payload.sku} no encontrado.")

        if batch.cantidad < payload.cantidad:
            raise ValueError(
                f"Stock insuficiente en lote {payload.lote}: disponible {batch.cantidad}, requerido {payload.cantidad}."
            )

        cant_mover = payload.cantidad

        if cant_mover < batch.cantidad:
            # División parcial del lote
            batch.cantidad -= cant_mover
            nuevo_lote_id = f"{batch.id}-{dest_wh[:3]}-{uuid.uuid4().hex[:4].upper()}"
            nuevo_batch = StockLocationBatch(
                id=nuevo_lote_id,
                sku=batch.sku,
                cantidad=cant_mover,
                ubicacion=self.LOCATION_REVERSE_MAP.get(dest_wh, "deposito_central"),
                pais_origen=batch.pais_origen,
                buque_o_tracking=f"TRANSFER-{orig_wh}-A-{dest_wh}",
                fecha_despacho=date.today(),
                fecha_eta=date.today(),
                estado="DISPONIBLE",
                observaciones=f"Transferido desde {orig_wh} a {dest_wh}. {payload.observaciones or ''}".strip(),
            )
            db.add(nuevo_batch)
            ret_batch = nuevo_batch
        else:
            # Traslado completo
            batch.ubicacion = self.LOCATION_REVERSE_MAP.get(dest_wh, "deposito_central")
            batch.buque_o_tracking = f"TRANSFER-{orig_wh}-A-{dest_wh}"
            if payload.observaciones:
                batch.observaciones = f"{batch.observaciones or ''} | {payload.observaciones}".strip()
            ret_batch = batch

        # Sincronizar inventarios si afecta Montevideo vs Showrooms
        prod = db.query(Product).filter(Product.sku == payload.sku).first()
        if prod:
            inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
            if inv:
                if orig_wh == "DEP-CENTRAL-MVD" and dest_wh == "SHOWROOM-POCITOS":
                    inv.deposito_central = max(0, inv.deposito_central - cant_mover)
                elif orig_wh == "SHOWROOM-POCITOS" and dest_wh == "DEP-CENTRAL-MVD":
                    inv.deposito_central += cant_mover

        db.commit()
        db.refresh(ret_batch)

        etapa_dest = (
            BatchStage.SHOWROOM
            if dest_wh == "SHOWROOM-POCITOS"
            else (BatchStage.SUCURSAL if dest_wh == "DEP-SALTO" else BatchStage.CENTRAL)
        )
        return StockBatchItem(
            id=ret_batch.id,
            lote=ret_batch.id,
            sku=ret_batch.sku,
            cantidad=ret_batch.cantidad,
            etapa=etapa_dest,
            etapa_logistica=etapa_dest,
            warehouse_id=dest_wh,
            origen_pais="China",
            proveedor="Luminar Logistics",
            dias_restantes=0,
            fecha_eta=ret_batch.fecha_eta,
            producto_nombre=ret_batch.producto_rel.nombre if ret_batch.producto_rel else ret_batch.sku,
            buque_o_tracking=ret_batch.buque_o_tracking or "",
            estado=ret_batch.estado or "DISPONIBLE",
        )

    def assign_direct_stock(
        self,
        db: Session,
        payload: WarehouseAssignStockPayload
    ) -> StockBatchItem:
        """
        Asigna o crea stock físico directo en un depósito especificado.
        """
        wh_id = self.WAREHOUSE_ID_MAP.get(payload.warehouse_id, payload.warehouse_id)
        loc_db = self.LOCATION_REVERSE_MAP.get(wh_id, "deposito_central")

        lote_id = payload.lote or f"LOT-2026-{payload.sku}-{wh_id[:3]}"

        existing = db.query(StockLocationBatch).filter(StockLocationBatch.id == lote_id).first()
        if existing:
            existing.cantidad += payload.cantidad
            ret_batch = existing
        else:
            ret_batch = StockLocationBatch(
                id=lote_id,
                sku=payload.sku,
                cantidad=payload.cantidad,
                ubicacion=loc_db,
                pais_origen="CN",
                buque_o_tracking="INGRESO-MANUAL",
                fecha_despacho=date.today(),
                fecha_eta=date.today(),
                estado="DISPONIBLE",
                observaciones=payload.observaciones or "Alta directa de stock.",
            )
            db.add(ret_batch)

        # Sincronizar con tabla inventarios
        prod = db.query(Product).filter(Product.sku == payload.sku).first()
        if prod:
            inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
            if inv and wh_id == "DEP-CENTRAL-MVD":
                inv.deposito_central += payload.cantidad

        db.commit()
        db.refresh(ret_batch)

        etapa_direct = BatchStage.CENTRAL if wh_id == "DEP-CENTRAL-MVD" else BatchStage.SUCURSAL
        return StockBatchItem(
            id=ret_batch.id,
            lote=ret_batch.id,
            sku=ret_batch.sku,
            cantidad=ret_batch.cantidad,
            etapa=etapa_direct,
            etapa_logistica=etapa_direct,
            warehouse_id=wh_id,
            origen_pais="China",
            proveedor=payload.proveedor or "Ingreso Manual",
            dias_restantes=0,
            fecha_eta=date.today(),
            producto_nombre=prod.nombre if prod else ret_batch.sku,
            buque_o_tracking=ret_batch.buque_o_tracking or "",
            origen_tipo="STOCK_DIRECTO",
            estado=ret_batch.estado or "DISPONIBLE",
        )


inventory_sync_service = InventorySyncService()
