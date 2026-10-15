from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database.session import get_db
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["Invoices B2B"])

class InvoiceItemSchema(BaseModel):
    sku_id: Optional[str] = None
    descripcion: str
    cantidad: int = 1
    precio_unitario: float
    tasa_iva_pct: float = 22.0

class InvoiceCreateSchema(BaseModel):
    cliente_nombre: str
    cliente_rut: str
    cliente_documento: Optional[str] = None
    tipo_documento_receptor: Optional[str] = "RUT"
    es_consumidor_final: bool = False
    orden_compra_ref: Optional[str] = None
    factura_referencia_id: Optional[int] = None
    cliente_direccion: Optional[str] = "Montevideo, Uruguay"
    fecha_emision: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    forma_pago: str = "CREDITO_30_DIAS"
    tipo_cfe: str = "111_E_FACTURA"
    moneda: str = "UYU"
    tipo_cambio: float = 1.0
    notas: Optional[str] = "Comprobante Fiscal Electrónico homologado por DGI"
    items: List[InvoiceItemSchema] = []

@router.get("", response_model=List[Dict[str, Any]])
def list_invoices(
    periodo: Optional[str] = Query(None, description="Período 'YYYY-MM'"),
    estado: Optional[str] = Query(None, description="EMITIDA, COBRADA, ANULADA"),
    tipo_cfe: Optional[str] = Query(None, description="111_E_FACTURA, 112_NOTA_CREDITO, etc."),
    cliente_rut: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Lista de facturas comerciales e-Facturas y Notas de Crédito emitidas."""
    invoices = InvoiceService.get_invoices(db, periodo=periodo, estado=estado, cliente_rut=cliente_rut, tipo_cfe=tipo_cfe, limit=limit)
    return [
        {
            "id": inv.id,
            "numero_factura": inv.numero_factura,
            "serie": inv.serie,
            "tipo_cfe": inv.tipo_cfe,
            "fecha_emision": inv.fecha_emision.isoformat(),
            "fecha_vencimiento": inv.fecha_vencimiento.isoformat(),
            "cliente_nombre": inv.cliente_nombre,
            "cliente_rut": inv.cliente_rut,
            "cliente_documento": inv.cliente_documento,
            "tipo_documento_receptor": inv.tipo_documento_receptor,
            "es_consumidor_final": inv.es_consumidor_final,
            "orden_compra_ref": inv.orden_compra_ref,
            "factura_referencia_id": inv.factura_referencia_id,
            "cliente_direccion": inv.cliente_direccion,
            "moneda": inv.moneda,
            "tipo_cambio": float(inv.tipo_cambio),
            "subtotal": float(inv.subtotal),
            "monto_iva_basico": float(inv.monto_iva_basico),
            "monto_iva_minimo": float(inv.monto_iva_minimo),
            "monto_iva_exento": float(inv.monto_iva_exento),
            "total": float(inv.total),
            "estado": inv.estado,
            "forma_pago": inv.forma_pago,
            "notas": inv.notas,
            "items_count": len(inv.items)
        }
        for inv in invoices
    ]

@router.get("/summary", response_model=Dict[str, Any])
def get_invoices_summary(
    periodo: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Métricas y KPIs consolidados de facturación B2B."""
    return InvoiceService.get_summary(db, periodo=periodo)

@router.get("/search-products", response_model=List[Dict[str, Any]])
def search_products_predictive(
    q: str = Query(..., min_length=2, description="Texto de búsqueda (>2 caracteres)"),
    db: Session = Depends(get_db)
):
    """Autocompletado predictivo de productos por SKU o Nombre."""
    return InvoiceService.search_products(db, q)

@router.get("/search-clients", response_model=List[Dict[str, Any]])
def search_clients_predictive(
    q: str = Query(..., min_length=2, description="Texto de búsqueda (>2 caracteres)"),
    db: Session = Depends(get_db)
):
    """Autocompletado predictivo de clientes por Razón Social, Nombre de Fantasía, RUT o CI."""
    return InvoiceService.search_clients(db, q)

@router.get("/sales-orders", response_model=List[Dict[str, Any]])
def list_sales_orders_available(db: Session = Depends(get_db)):
    """Órdenes de Venta emitidas listas para precargar y facturar."""
    return InvoiceService.get_sales_orders_available(db)

@router.get("/{invoice_id}", response_model=Dict[str, Any])
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    """Detalle completo de una e-Factura o Nota de Crédito con sus ítems."""
    from app.models.accounting_entities import Invoice
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return {
        "id": inv.id,
        "numero_factura": inv.numero_factura,
        "serie": inv.serie,
        "tipo_cfe": inv.tipo_cfe,
        "fecha_emision": inv.fecha_emision.isoformat(),
        "fecha_vencimiento": inv.fecha_vencimiento.isoformat(),
        "cliente_nombre": inv.cliente_nombre,
        "cliente_rut": inv.cliente_rut,
        "cliente_documento": inv.cliente_documento,
        "tipo_documento_receptor": inv.tipo_documento_receptor,
        "es_consumidor_final": inv.es_consumidor_final,
        "orden_compra_ref": inv.orden_compra_ref,
        "factura_referencia_id": inv.factura_referencia_id,
        "cliente_direccion": inv.cliente_direccion,
        "moneda": inv.moneda,
        "tipo_cambio": float(inv.tipo_cambio),
        "subtotal": float(inv.subtotal),
        "monto_iva_basico": float(inv.monto_iva_basico),
        "monto_iva_minimo": float(inv.monto_iva_minimo),
        "total": float(inv.total),
        "estado": inv.estado,
        "forma_pago": inv.forma_pago,
        "notas": inv.notas,
        "items": [
            {
                "id": it.id,
                "sku_id": it.sku_id,
                "descripcion": it.descripcion,
                "cantidad": it.cantidad,
                "precio_unitario": float(it.precio_unitario),
                "tasa_iva_pct": float(it.tasa_iva_pct),
                "subtotal": float(it.subtotal),
                "monto_iva": float(it.monto_iva),
                "total": float(it.total)
            }
            for it in inv.items
        ]
    }

@router.post("", response_model=Dict[str, Any])
def create_invoice(
    payload: InvoiceCreateSchema,
    x_user_role: Optional[str] = Header("controller_admin", alias="X-User-Role"),
    x_user_id: Optional[str] = Header("controller_admin", alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """
    Emite una nueva e-Factura o Nota de Crédito CFE B2B:
    - Valida que Consumidor Final no tenga crédito salvo rol controller_admin
    - Valida que la venta no exceda el límite de crédito del cliente
    - Genera asiento de partida doble (directo o inverso)
    """
    try:
        inv = InvoiceService.create_invoice(
            db,
            payload.model_dump(),
            user_id=x_user_id or "controller_admin",
            user_role=x_user_role or "controller_admin"
        )
        return {
            "success": True,
            "message": f"Comprobante {inv.numero_factura} emitido exitosamente",
            "invoice_id": inv.id,
            "numero_factura": inv.numero_factura,
            "tipo_cfe": inv.tipo_cfe,
            "total": float(inv.total)
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al emitir comprobante: {str(e)}")

@router.post("/{invoice_id}/status")
def update_invoice_status(invoice_id: int, estado: str = Query(..., pattern="^(EMITIDA|COBRADA|ANULADA)$"), db: Session = Depends(get_db)):
    """Actualiza el estado de una factura (e.g. marcar como cobrada o anulada)."""
    from app.models.accounting_entities import Invoice
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    inv.estado = estado
    db.commit()
    return {"success": True, "message": f"Estado de {inv.numero_factura} actualizado a {estado}"}
