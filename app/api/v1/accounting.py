from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.services.accounting_service import AccountingService

router = APIRouter(prefix="/accounting", tags=["Accounting & Taxes"])

class ExpenseCreateSchema(BaseModel):
    fecha: Optional[str] = None
    proveedor_beneficiario: str
    rut_proveedor: Optional[str] = None
    concepto: str
    categoria_gasto: str # COMBUSTIBLE, SERVICIOS_PUBLICOS, ALQUILERES, PAPELERIA_SUMINISTROS, NOMINA, MANTENIMIENTO, CLOUD_TI, IMPUESTOS
    centro_costo_id: Optional[int] = None
    subtotal_neto: float
    tasa_iva_pct: float = 22.0
    moneda: str = "UYU"
    numero_comprobante: Optional[str] = None
    forma_pago: str = "TRANSFERENCIA"
    estado: str = "PAGADO"

@router.get("/expenses", response_model=List[Dict[str, Any]])
def list_expenses(
    periodo: Optional[str] = Query(None, description="'YYYY-MM'"),
    categoria: Optional[str] = Query(None),
    centro_costo_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Lista de gastos operativos con desglose de IVA Crédito Fiscal."""
    expenses = AccountingService.get_expenses(db, periodo=periodo, categoria=categoria, centro_costo_id=centro_costo_id, limit=limit)
    return [
        {
            "id": e.id,
            "fecha": e.fecha.isoformat(),
            "proveedor_beneficiario": e.proveedor_beneficiario,
            "rut_proveedor": e.rut_proveedor,
            "concepto": e.concepto,
            "categoria_gasto": e.categoria_gasto,
            "centro_costo_id": e.centro_costo_id,
            "centro_costo_nombre": e.centro_costo_rel.nombre if e.centro_costo_rel else "General",
            "subtotal_neto": float(e.subtotal_neto),
            "tasa_iva_pct": float(e.tasa_iva_pct),
            "monto_iva": float(e.monto_iva),
            "monto_total": float(e.monto_total),
            "moneda": e.moneda,
            "numero_comprobante": e.numero_comprobante,
            "forma_pago": e.forma_pago,
            "estado": e.estado
        }
        for e in expenses
    ]

@router.post("/expenses", response_model=Dict[str, Any])
def create_expense(payload: ExpenseCreateSchema, db: Session = Depends(get_db)):
    """Registra un nuevo gasto operativo y genera el asiento contable en el Libro Diario."""
    try:
        expense = AccountingService.create_expense(db, payload.model_dump())
        return {
            "success": True,
            "message": f"Gasto registrado exitosamente con ID #{expense.id}",
            "expense_id": expense.id,
            "monto_total": float(expense.monto_total)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al registrar gasto: {str(e)}")

@router.get("/journal", response_model=List[Dict[str, Any]])
def get_journal(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    """Obtiene los asientos del Libro Diario Contable con balance estricto Debe == Haber."""
    entries = AccountingService.get_journal_entries(db, limit=limit)
    return [
        {
            "id": entry.id,
            "numero_asiento": entry.numero_asiento,
            "fecha": entry.fecha.isoformat(),
            "glosa": entry.glosa,
            "tipo_operacion": entry.tipo_operacion,
            "referencia_doc": entry.referencia_doc,
            "total_debe": float(entry.total_debe),
            "total_haber": float(entry.total_haber),
            "balanceado": entry.balanceado,
            "lines": [
                {
                    "id": line.id,
                    "cuenta_codigo": line.cuenta_codigo,
                    "cuenta_nombre": line.cuenta_nombre,
                    "debe": float(line.debe),
                    "haber": float(line.haber)
                }
                for line in entry.lines
            ]
        }
        for entry in entries
    ]

@router.get("/tax-summary", response_model=Dict[str, Any])
def get_tax_summary(periodo: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Liquidación fiscal corporativa en tiempo real (IVA Débito/Crédito DGI, BPS e IRAE)."""
    return AccountingService.get_tax_summary(db, periodo=periodo)
