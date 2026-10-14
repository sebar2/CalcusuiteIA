import uuid
import logging
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Dict
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import desc

logger = logging.getLogger(__name__)

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
        """Garantiza la presencia de los nodos logísticos maestros en la BD."""
        default_whs = [
            ("FAB-CHINA", "Fábrica de Origen (Shenzhen / Alemania)", "FABRICA", "Shenzhen, China", "China", 50000),
            ("TRANSITO-MAR", "Tránsito Marítimo / Aduana de Montevideo", "TRANSITO", "Ruta Marítima Océano Atlántico", "China", 30000),
            ("DEP-CENTRAL-MVD", "Depósito Central Montevideo", "CENTRAL", "Montevideo, Uruguay", "Uruguay", 25000),
            ("DEP-SALTO", "Depósito Regional Salto", "SUCURSAL", "Salto, Uruguay", "Uruguay", 8000),
            ("SHOWROOM-POCITOS", "Showroom Pocitos (Retiro / Venta)", "SUCURSAL", "Pocitos, Montevideo", "Uruguay", 3000),
            ("wh-ningbo-hub", "Depósito Internacional Ningbo", "INTERNACIONAL", "Ningbo Port Logistics Park", "China", 60000),
            ("wh-shenzhen-hub", "Depósito Consolidación Shenzhen", "INTERNACIONAL", "Yantian Bonded Area", "China", 45000),
        ]
        for w_id, nom, tipo, ubic, pais, cap in default_whs:
            existing = db.query(Warehouse).filter(Warehouse.id == w_id).first()
            if not existing:
                wh = Warehouse(
                    id=w_id,
                    nombre=nom,
                    tipo=tipo,
                    ubicacion=ubic,
                    pais=pais,
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
                    fecha_terminado=today + timedelta(days=10),
                    estado="EN_PRODUCCION",
                    observaciones=f"Orden #{order.id} del proveedor {order.proveedor} en fabricación.",
                )
                db.add(batch)
            else:
                batch.ubicacion = "fabrica_origen"
                batch.estado = "EN_PRODUCCION"
                batch.buque_o_tracking = f"PO-{order.id}-FAB-PROD"
                batch.fecha_terminado = today + timedelta(days=10)
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

        elif order.etapa == "proveedor_uy":
            # 2.5. Proveedores Uy / Reventa en plaza
            if not batch:
                batch = StockLocationBatch(
                    id=lote_id,
                    sku=order.sku_id,
                    cantidad=order.cantidad,
                    warehouse_id="DEP-CENTRAL-MVD",
                    ubicacion="proveedor_uy",
                    pais_origen="UY",
                    estado="DISPONIBLE",
                    estado_aprobacion="APROBADO",
                    observaciones=f"Orden #{order.id} canalizada a proveedor plaza {order.proveedor}.",
                )
                db.add(batch)
            else:
                batch.ubicacion = "proveedor_uy"
                batch.pais_origen = "UY"
                batch.estado_aprobacion = "APROBADO"

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
        warehouse_id: Optional[str] = None,
        exclude_test_batches: bool = False
    ) -> List[StockBatchItem]:
        """
        Retorna la lista normalizada de lotes asignados a las 4 etapas maestras logísticas:
        1. Fábrica (Producción)
        2. Depósito Internacional (Consolidación origen)
        3. En Alta Mar (Buques / Tránsito marítimo)
        4. Depósitos Uruguay (Stock físico nacionalizado)
        """
        try:
            query = db.query(StockLocationBatch)
            if exclude_test_batches:
                query = query.filter(~StockLocationBatch.id.like("LOT-%-TEST-%"), ~StockLocationBatch.id.like("LOT-2026-TEST%"))
            batches = query.all()
        except Exception as e:
            if "fecha_terminado" in str(e) or "does not exist" in str(e) or "42703" in str(e):
                logger.warning("Detectada columna faltante en base de datos. Auto-reparando esquema: %s", e)
                from app.database.session import sync_table_columns
                db.rollback()
                sync_table_columns(db.connection())
                query = db.query(StockLocationBatch)
                if exclude_test_batches:
                    query = query.filter(~StockLocationBatch.id.like("LOT-%-TEST-%"), ~StockLocationBatch.id.like("LOT-2026-TEST%"))
                batches = query.all()
            else:
                raise
        today = date.today()
        warehouses_map = {w.id: w for w in db.query(Warehouse).all()}
        result: List[StockBatchItem] = []

        for b in batches:
            # Determinar warehouse_id estandarizado o personalizado
            target_loc = b.warehouse_id or b.ubicacion
            wh_id = self.WAREHOUSE_ID_MAP.get(target_loc, target_loc)
            if warehouse_id and wh_id != warehouse_id and b.ubicacion != warehouse_id and b.warehouse_id != warehouse_id:
                continue

            wh_entity = warehouses_map.get(wh_id) or warehouses_map.get(b.ubicacion)
            wh_tipo = wh_entity.tipo if wh_entity else None
            wh_nombre = wh_entity.nombre if wh_entity else wh_id

            # Clasificar en las 5 columnas maestras:
            b_estado = (b.estado or "").upper()
            b_ubic = (b.ubicacion or "").lower()
            supp = b.supplier_rel
            supp_tipo = (supp.tipo_proveedor or "").upper() if supp else ""
            b_estado_aprob = getattr(b, "estado_aprobacion", "APROBADO")

            if (
                supp_tipo in ("PROVEEDOR_UY", "PROVEEDOR_REVENTA")
                or b_ubic in ("proveedor_uy", "reventa_local")
                or (b.observaciones and "reventa" in b.observaciones.lower())
                or (b_estado_aprob == "PENDIENTE_APROBACION" and wh_id not in ("FAB-CHINA", "TRANSITO-MAR"))
            ):
                etapa_columna = "proveedor_uy"
                etapa = BatchStage.CENTRAL
            elif (
                b_ubic in ("fabrica_origen", "fab-china", "fab-ningbo")
                or wh_id == "FAB-CHINA"
                or wh_tipo == "FABRICA"
                or b_estado in ("EN_PRODUCCION", "EN_FABRICACION", "FABRICACION")
            ):
                etapa_columna = "fabrica"
                etapa = BatchStage.FABRICACION
            elif (
                wh_tipo == "INTERNACIONAL"
                or wh_id in ("wh-ningbo-hub", "wh-shenzhen-hub", "wh-hamburgo-hub")
                or ("hub" in wh_id.lower() or "internacional" in wh_id.lower())
                or (b_ubic == "deposito_internacional")
            ):
                etapa_columna = "deposito_internacional"
                etapa = BatchStage.CENTRAL
            elif (
                b_ubic in ("transito_maritimo", "transito-mar")
                or wh_id == "TRANSITO-MAR"
                or wh_tipo == "TRANSITO"
                or b_estado in ("EN_TRANSITO", "TRANSITO", "EMBARCADO")
                or (b.buque_o_tracking and any(x in b.buque_o_tracking.lower() for x in ("cosco", "maersk", "msc", "bl-", "buque")))
            ):
                etapa_columna = "alta_mar"
                etapa = BatchStage.TRANSITO
            else:
                etapa_columna = "deposito_uruguay"
                if "pocitos" in wh_id.lower() or "showroom" in wh_id.lower():
                    etapa = BatchStage.SHOWROOM
                elif "salto" in wh_id.lower() or wh_tipo == "SUCURSAL":
                    etapa = BatchStage.SUCURSAL
                else:
                    etapa = BatchStage.CENTRAL

            dias_rest = 0
            if b.fecha_eta:
                dias_rest = max(0, (b.fecha_eta - today).days)
            elif etapa_columna == "fabrica":
                dias_rest = 14
            elif etapa_columna == "alta_mar":
                dias_rest = 21

            prod = b.producto_rel
            prod_nombre = prod.nombre if prod else b.sku
            p_venta = float(prod.precio_lista) if (prod and prod.precio_lista) else 0.0
            img_url = prod.image_url if prod else None

            # Dual SKU & Lote
            sku_fab = b.sku_fabrica or f"MK-{b.sku}-CN"
            lot_fab = b.lote_fabrica or f"LOT-{b.id.replace('LOT-', '')}"

            # Proveedor / Buque / Fábrica
            supp = b.supplier_rel
            if supp:
                supp_id = supp.id
                supp_nom = supp.nombre
                origen_p = supp.pais or ("China" if b.pais_origen in ["CN", "China"] else "Alemania")
            else:
                supp_id = None
                if etapa_columna == "alta_mar":
                    supp_nom = b.buque_o_tracking or "MSC LAURA - Mediterranean Shipping"
                elif etapa_columna == "fabrica":
                    supp_nom = "Foshan Lighting Co. Ltd"
                else:
                    supp_nom = "Luminar Global Logistics"
                origen_p = "China" if b.pais_origen in ["CN", "China"] else "Uruguay"

            fecha_terminado_val = b.fecha_terminado
            if not fecha_terminado_val and etapa_columna == "fabrica":
                fecha_terminado_val = today + timedelta(days=12)

            obs_upper = (b.observaciones or "").upper()
            id_upper = (b.id or "").upper()
            if "LICIT" in obs_upper or "LICIT" in id_upper or "TENDER" in obs_upper:
                orig_tipo_val = "LICITACION_B2B"
            elif "ROP" in obs_upper or "ROP" in id_upper or getattr(b, "orden_rop_id", None):
                orig_tipo_val = "ROP_REPOSICION"
            else:
                orig_tipo_val = "STOCK_DIRECTO"

            result.append(
                StockBatchItem(
                    id=b.id,
                    lote=b.id,
                    sku=b.sku,
                    sku_fabrica=sku_fab,
                    lote_fabrica=lot_fab,
                    cantidad=b.cantidad,
                    precio_venta=round(p_venta, 2),
                    etapa=etapa,
                    etapa_logistica=etapa,
                    etapa_columna=etapa_columna,
                    warehouse_id=wh_id,
                    warehouse_nombre=wh_nombre,
                    supplier_id=supp_id,
                    supplier_nombre=supp_nom,
                    origen_pais=origen_p,
                    proveedor=supp_nom,
                    dias_restantes=dias_rest,
                    dias_restantes_eta=dias_rest,
                    fecha_eta=b.fecha_eta,
                    fecha_despacho=b.fecha_despacho,
                    fecha_terminado=fecha_terminado_val,
                    producto_nombre=prod_nombre or b.sku,
                    buque_o_tracking=b.buque_o_tracking or "",
                    imagen_url=img_url,
                    origen_tipo=orig_tipo_val,
                    costo_compra=float(b.costo_compra) if getattr(b, "costo_compra", None) is not None else None,
                    estado_aprobacion=getattr(b, "estado_aprobacion", "APROBADO") or "APROBADO",
                    estado=b.estado or ("EN_PRODUCCION" if etapa_columna == "fabrica" else ("EN_TRANSITO" if etapa_columna == "alta_mar" else "DISPONIBLE")),
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

        # Buscar lote de origen por id o por combinación (id, sku)
        batch = None
        if payload.lote:
            if payload.sku:
                batch = db.query(StockLocationBatch).filter(
                    StockLocationBatch.id == payload.lote,
                    StockLocationBatch.sku == payload.sku
                ).first()
            if not batch:
                batch = db.query(StockLocationBatch).filter(
                    StockLocationBatch.id == payload.lote
                ).first()

        if not batch and payload.sku:
            # Fallback buscar lote por SKU en esa ubicación
            batch = db.query(StockLocationBatch).filter(
                StockLocationBatch.sku == payload.sku
            ).first()

        if not batch:
            raise ValueError(f"Lote '{payload.lote or payload.batch_id}' para SKU '{payload.sku or 'N/A'}' no encontrado.")

        if getattr(batch, "estado_aprobacion", "APROBADO") not in ("APROBADO", None):
            raise ValueError(f"El lote '{batch.id}' no puede transferirse porque está en estado '{batch.estado_aprobacion}'. Requiere aprobación previa de Comercial o Directorio.")

        if batch.cantidad < payload.cantidad:
            raise ValueError(
                f"Stock insuficiente en lote {batch.id}: disponible {batch.cantidad}, requerido {payload.cantidad}."
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
                warehouse_id=dest_wh,
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
            batch.warehouse_id = dest_wh
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
