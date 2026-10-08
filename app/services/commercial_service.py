import uuid
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone, date
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.entities import (
    CommercialDeal,
    CommercialDealItem,
    SalesOrder,
    SalesOrderItem,
    Inventory,
    Product,
    StockLocationBatch,
)
from app.domain.schemas import (
    CommercialDealCreate,
    CommercialDealUpdate,
    CommercialDealResponse,
    DealItemResponse,
    SalesOrderGenerateRequest,
    SalesOrderResponse,
    SalesOrderItemResponse,
)


class CommercialService:
    @staticmethod
    def _to_response(deal: CommercialDeal, warning: Optional[str] = None) -> CommercialDealResponse:
        items_res = []
        for it in deal.items:
            prod_name = it.producto_rel.nombre if it.producto_rel else it.sku
            subtotal = Decimal(str(it.cantidad)) * it.precio_unitario
            items_res.append(
                DealItemResponse(
                    id=it.id,
                    deal_id=it.deal_id,
                    sku=it.sku,
                    cantidad=it.cantidad,
                    precio_unitario=it.precio_unitario,
                    subtotal=subtotal,
                    producto_nombre=prod_name,
                )
            )

        return CommercialDealResponse(
            id=deal.id,
            proyecto_nombre=deal.proyecto_nombre,
            cliente=deal.cliente,
            rut=getattr(deal, 'rut', None),
            vendedor=deal.vendedor,
            monto_total=deal.monto_total,
            moneda=deal.moneda,
            etapa=deal.etapa,
            observaciones=deal.observaciones,
            created_at=deal.created_at,
            items=items_res,
            total_items_count=len(items_res),
            stock_reservation_warning=warning,
        )

    @staticmethod
    def _to_sales_order_response(so: SalesOrder) -> SalesOrderResponse:
        items_res = []
        for it in so.items:
            p_name = it.producto_rel.nombre if it.producto_rel else it.sku
            items_res.append(
                SalesOrderItemResponse(
                    id=it.id,
                    sales_order_id=it.sales_order_id,
                    sku=it.sku,
                    cantidad=it.cantidad,
                    precio_unitario=float(it.precio_unitario),
                    subtotal=float(it.subtotal),
                    producto_nombre=p_name,
                )
            )

        return SalesOrderResponse(
            id=so.id,
            deal_id=so.deal_id,
            numero_ov=so.numero_ov,
            cliente=so.cliente,
            rut=so.rut,
            vendedor=so.vendedor,
            warehouse_id=so.warehouse_id,
            subtotal=float(so.subtotal),
            iva_monto=float(so.iva_monto),
            total=float(so.total),
            moneda=so.moneda,
            tipo_cambio=float(so.tipo_cambio) if so.tipo_cambio else None,
            estado=so.estado,
            notas=so.notas,
            fecha_emision=so.fecha_emision,
            created_at=so.created_at,
            items=items_res,
        )

    def list_deals(
        self,
        db: Session,
        etapa: Optional[str] = None,
        vendedor: Optional[str] = None
    ) -> List[CommercialDealResponse]:
        query = db.query(CommercialDeal).order_by(desc(CommercialDeal.created_at))
        if etapa:
            query = query.filter(CommercialDeal.etapa == etapa)
        if vendedor:
            query = query.filter(CommercialDeal.vendedor == vendedor)
        deals = query.all()
        return [self._to_response(d) for d in deals]

    def get_deal(self, db: Session, deal_id: str) -> Optional[CommercialDealResponse]:
        deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
        if not deal:
            return None
        return self._to_response(deal)

    def create_deal(self, db: Session, payload: CommercialDealCreate) -> CommercialDealResponse:
        deal_id = f"deal-{uuid.uuid4().hex[:12]}"
        
        # Calcular monto total si no vino definido o es 0
        monto = payload.monto_total or Decimal('0.00')
        if monto == Decimal('0.00') and payload.items:
            calc_monto = Decimal('0.00')
            for it in payload.items:
                calc_monto += Decimal(str(it.cantidad)) * (it.precio_unitario or Decimal('0.00'))
            if calc_monto > Decimal('0.00'):
                monto = calc_monto

        deal = CommercialDeal(
            id=deal_id,
            proyecto_nombre=payload.proyecto_nombre,
            cliente=payload.cliente,
            rut=payload.rut,
            vendedor=payload.vendedor,
            monto_total=monto,
            moneda=payload.moneda,
            etapa=payload.etapa,
            observaciones=payload.observaciones,
        )
        db.add(deal)
        db.flush()

        for it in payload.items:
            deal_item = CommercialDealItem(
                deal_id=deal.id,
                sku=it.sku,
                cantidad=it.cantidad,
                precio_unitario=it.precio_unitario or Decimal('0.00'),
            )
            db.add(deal_item)

        db.commit()
        db.refresh(deal)
        return self._to_response(deal)

    def update_deal(self, db: Session, deal_id: str, payload: CommercialDealUpdate) -> Optional[CommercialDealResponse]:
        deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
        if not deal:
            return None

        if payload.proyecto_nombre is not None:
            deal.proyecto_nombre = payload.proyecto_nombre
        if payload.cliente is not None:
            deal.cliente = payload.cliente
        if payload.rut is not None:
            deal.rut = payload.rut
        if payload.vendedor is not None:
            deal.vendedor = payload.vendedor
        if payload.monto_total is not None:
            deal.monto_total = payload.monto_total
        if payload.moneda is not None:
            deal.moneda = payload.moneda
        if payload.observaciones is not None:
            deal.observaciones = payload.observaciones
        if payload.etapa is not None:
            deal.etapa = payload.etapa

        if payload.items is not None:
            # Reemplazar items
            db.query(CommercialDealItem).filter(CommercialDealItem.deal_id == deal.id).delete()
            calc_monto = Decimal('0.00')
            for it in payload.items:
                pr = it.precio_unitario or Decimal('0.00')
                calc_monto += Decimal(str(it.cantidad)) * pr
                deal_item = CommercialDealItem(
                    deal_id=deal.id,
                    sku=it.sku,
                    cantidad=it.cantidad,
                    precio_unitario=pr,
                )
                db.add(deal_item)
            if payload.monto_total is None and calc_monto > Decimal('0.00'):
                deal.monto_total = calc_monto

        db.commit()
        db.refresh(deal)
        return self._to_response(deal)

    def update_stage(self, db: Session, deal_id: str, new_stage: str) -> Optional[CommercialDealResponse]:
        deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
        if not deal:
            return None

        previous_stage = deal.etapa
        deal.etapa = new_stage
        warning_msg = None

        if new_stage == "ganada" and previous_stage != "ganada":
            warnings = []
            for it in deal.items:
                prod = db.query(Product).filter(Product.sku == it.sku).first()
                if prod:
                    inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
                    if inv:
                        if inv.deposito_central < it.cantidad:
                            warnings.append(
                                f"SKU {it.sku}: Quiebre parcial (requerido: {it.cantidad}, disponible: {inv.deposito_central})"
                            )
                            inv.deposito_central = max(0, inv.deposito_central - it.cantidad)
                        else:
                            inv.deposito_central -= it.cantidad
            if warnings:
                warning_msg = " | ".join(warnings)

        db.commit()
        db.refresh(deal)
        return self._to_response(deal, warning=warning_msg)

    def generate_sales_order(
        self,
        db: Session,
        deal_id: str,
        payload: SalesOrderGenerateRequest
    ) -> SalesOrderResponse:
        """
        Emite una Orden de Venta formal (OV) desde un Deal:
        1. Asigna correlativo: OV-2026-XXXX.
        2. Descuenta el stock del depósito seleccionado.
        3. Cambia el estado del Deal a 'ganada'.
        4. Calcula subtotal, IVA (22%) y total.
        """
        deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
        if not deal:
            raise ValueError("Trato comercial no encontrado")

        # Correlativo formal
        count = db.query(SalesOrder).count()
        num_ov = f"OV-2026-{(count + 1):04d}"
        so_id = f"so-{uuid.uuid4().hex[:10]}"

        wh_id = payload.warehouse_id or "DEP-CENTRAL-MVD"

        subtotal = Decimal('0.00')
        order_items_to_create = []

        # Recorrer partidas y descontar stock del depósito
        for it in deal.items:
            line_sub = Decimal(str(it.cantidad)) * it.precio_unitario
            subtotal += line_sub

            order_items_to_create.append(
                SalesOrderItem(
                    sales_order_id=so_id,
                    sku=it.sku,
                    cantidad=it.cantidad,
                    precio_unitario=it.precio_unitario,
                    subtotal=line_sub,
                )
            )

            # Descontar stock físico en inventarios y lotes
            prod = db.query(Product).filter(Product.sku == it.sku).first()
            if prod:
                inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
                if inv:
                    inv.deposito_central = max(0, inv.deposito_central - it.cantidad)

            batch = db.query(StockLocationBatch).filter(
                StockLocationBatch.sku == it.sku
            ).first()
            if batch:
                batch.cantidad = max(0, batch.cantidad - it.cantidad)

        iva_monto = subtotal * Decimal('0.22')
        total = subtotal + iva_monto

        sales_order = SalesOrder(
            id=so_id,
            deal_id=deal.id,
            numero_ov=num_ov,
            cliente=deal.cliente,
            rut=getattr(deal, 'rut', None),
            vendedor=deal.vendedor,
            warehouse_id=wh_id,
            subtotal=subtotal,
            iva_monto=iva_monto,
            total=total,
            moneda=payload.moneda or deal.moneda,
            tipo_cambio=Decimal('42.50'),
            estado="EMITIDA",
            notas=payload.notas or deal.observaciones,
            fecha_emision=datetime.now(timezone.utc).date(),
        )

        db.add(sales_order)
        for item in order_items_to_create:
            db.add(item)

        # Actualizar etapa del Deal a 'ganada'
        deal.etapa = "ganada"

        db.commit()
        db.refresh(sales_order)

        return self._to_sales_order_response(sales_order)

    def get_sales_order(self, db: Session, order_id: str) -> Optional[SalesOrderResponse]:
        so = db.query(SalesOrder).filter(
            (SalesOrder.id == order_id) | (SalesOrder.numero_ov == order_id)
        ).first()
        if not so:
            return None
        return self._to_sales_order_response(so)

    def list_sales_orders(self, db: Session, deal_id: Optional[str] = None) -> List[SalesOrderResponse]:
        query = db.query(SalesOrder).order_by(desc(SalesOrder.created_at))
        if deal_id:
            query = query.filter(SalesOrder.deal_id == deal_id)
        return [self._to_sales_order_response(so) for so in query.all()]

    def delete_deal(self, db: Session, deal_id: str) -> bool:
        deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
        if not deal:
            return False
        db.delete(deal)
        db.commit()
        return True


commercial_service = CommercialService()
