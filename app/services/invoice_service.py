import logging
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.models.accounting_entities import Invoice, InvoiceItem, JournalEntry, JournalLine
from app.domain.models import AuditLog

logger = logging.getLogger(__name__)

class InvoiceService:
    @staticmethod
    def get_invoices(
        db: Session,
        periodo: Optional[str] = None,
        estado: Optional[str] = None,
        cliente_rut: Optional[str] = None,
        limit: int = 50
    ) -> List[Invoice]:
        """Obtiene la lista de facturas comerciales e-Facturas emitidas."""
        query = db.query(Invoice).order_by(desc(Invoice.id))
        if estado:
            query = query.filter(Invoice.estado == estado.upper())
        if cliente_rut:
            query = query.filter(Invoice.cliente_rut == cliente_rut)
        if periodo:
            # Formato periodo: 'YYYY-MM'
            try:
                year, month = map(int, periodo.split("-"))
                query = query.filter(
                    func.extract('year', Invoice.fecha_emision) == year,
                    func.extract('month', Invoice.fecha_emision) == month
                )
            except Exception:
                pass
        return query.limit(limit).all()

    @staticmethod
    def create_invoice(db: Session, data: Dict[str, Any], user_id: str = "controller_admin") -> Invoice:
        """
        Emite una nueva e-Factura / Comprobante Fiscal Electrónico (CFE) con
        cálculo automático de impuestos y asiento contable por partida doble.
        """
        # Generar número correlativo
        count = db.query(func.count(Invoice.id)).scalar() or 0
        numero_factura = f"e-Factura A-{1000 + count + 1}"
        
        fecha_emision = data.get("fecha_emision")
        if isinstance(fecha_emision, str):
            fecha_emision = datetime.strptime(fecha_emision, "%Y-%m-%d").date()
        elif not fecha_emision:
            fecha_emision = date.today()

        fecha_vencimiento = data.get("fecha_vencimiento")
        if isinstance(fecha_vencimiento, str):
            fecha_vencimiento = datetime.strptime(fecha_vencimiento, "%Y-%m-%d").date()
        elif not fecha_vencimiento:
            fecha_vencimiento = fecha_emision

        raw_items = data.get("items", [])
        if not raw_items:
            # Item genérico si no se especificaron líneas
            raw_items = [{
                "descripcion": data.get("concepto", "Venta Mayorista B2B"),
                "cantidad": 1,
                "precio_unitario": data.get("total", 1000.0),
                "tasa_iva_pct": 22.0
            }]

        subtotal = Decimal("0.00")
        iva_basico = Decimal("0.00")
        iva_minimo = Decimal("0.00")
        iva_exento = Decimal("0.00")
        items_objs = []

        for it in raw_items:
            cant = int(it.get("cantidad", 1))
            precio = Decimal(str(it.get("precio_unitario", 0.0)))
            tasa = Decimal(str(it.get("tasa_iva_pct", 22.0)))
            
            line_subtotal = (precio * cant).quantize(Decimal("0.01"))
            line_iva = ((line_subtotal * tasa) / Decimal("100.00")).quantize(Decimal("0.01"))
            line_total = line_subtotal + line_iva
            
            subtotal += line_subtotal
            if tasa == Decimal("22.00"):
                iva_basico += line_iva
            elif tasa == Decimal("10.00"):
                iva_minimo += line_iva
            else:
                iva_exento += line_iva

            items_objs.append(InvoiceItem(
                sku_id=it.get("sku_id"),
                descripcion=it.get("descripcion", "Ítem comercial"),
                cantidad=cant,
                precio_unitario=precio,
                tasa_iva_pct=tasa,
                subtotal=line_subtotal,
                monto_iva=line_iva,
                total=line_total
            ))

        total_factura = subtotal + iva_basico + iva_minimo

        invoice = Invoice(
            numero_factura=numero_factura,
            serie=data.get("serie", "A"),
            tipo_cfe=data.get("tipo_cfe", "111_E_FACTURA"),
            fecha_emision=fecha_emision,
            fecha_vencimiento=fecha_vencimiento,
            cliente_nombre=data.get("cliente_nombre", "Cliente Comercial S.A."),
            cliente_rut=data.get("cliente_rut", "219998880017"),
            cliente_direccion=data.get("cliente_direccion", "Montevideo, Uruguay"),
            moneda=data.get("moneda", "UYU"),
            tipo_cambio=Decimal(str(data.get("tipo_cambio", "1.0000"))),
            subtotal=subtotal,
            monto_iva_basico=iva_basico,
            monto_iva_minimo=iva_minimo,
            monto_iva_exento=iva_exento,
            total=total_factura,
            estado=data.get("estado", "EMITIDA"),
            forma_pago=data.get("forma_pago", "CREDITO_30_DIAS"),
            notas=data.get("notas", "Comprobante Fiscal Electrónico homologado"),
            items=items_objs
        )
        db.add(invoice)
        db.flush()

        # Generar Asiento Contable Automático en Libro Diario (Partida Doble)
        InvoiceService._create_invoice_journal_entry(db, invoice)

        # Registrar en Auditoría y Monitoreo
        db.add(AuditLog(
            user_id=user_id,
            role="comercial",
            action="EMITIR_FACTURA",
            resource=f"invoices/{invoice.id}",
            ip_address="100.64.0.1",
            ubicacion="Montevideo (Nodo Tailscale Central)",
            evento_realizado=f"Emisión de {invoice.numero_factura} a {invoice.cliente_nombre} por ${float(invoice.total):,.2f}",
            severidad="INFO",
            details={
                "numero_factura": invoice.numero_factura,
                "cliente": invoice.cliente_nombre,
                "rut": invoice.cliente_rut,
                "total": float(invoice.total),
                "iva": float(invoice.monto_iva_basico + invoice.monto_iva_minimo)
            }
        ))
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def _create_invoice_journal_entry(db: Session, invoice: Invoice):
        """Genera el asiento contable de venta por partida doble."""
        asiento_num = (db.query(func.max(JournalEntry.numero_asiento)).scalar() or 0) + 1
        
        entry = JournalEntry(
            numero_asiento=asiento_num,
            fecha=invoice.fecha_emision,
            glosa=f"Venta B2B según {invoice.numero_factura} - {invoice.cliente_nombre}",
            tipo_operacion="VENTA",
            referencia_doc=invoice.numero_factura,
            total_debe=invoice.total,
            total_haber=invoice.total,
            balanceado=True
        )
        db.add(entry)
        db.flush()

        # Debe: Cuentas por Cobrar (Deudores por Ventas)
        db.add(JournalLine(
            entry_id=entry.id,
            cuenta_codigo="1.1.3",
            cuenta_nombre="Deudores por Ventas / Clientes B2B",
            debe=invoice.total,
            haber=Decimal("0.00")
        ))

        # Haber: Ventas Netas
        db.add(JournalLine(
            entry_id=entry.id,
            cuenta_codigo="4.1.1",
            cuenta_nombre="Ventas Netas de Bienes y Servicios",
            debe=Decimal("0.00"),
            haber=invoice.subtotal
        ))

        # Haber: IVA Débito Fiscal
        iva_total = invoice.monto_iva_basico + invoice.monto_iva_minimo
        if iva_total > Decimal("0.00"):
            db.add(JournalLine(
                entry_id=entry.id,
                cuenta_codigo="2.1.3",
                cuenta_nombre="IVA Débito Fiscal (DGI)",
                debe=Decimal("0.00"),
                haber=iva_total
            ))

    @staticmethod
    def get_summary(db: Session, periodo: Optional[str] = None) -> Dict[str, Any]:
        """Calcula los KPIs consolidados de facturación B2B."""
        query = db.query(Invoice)
        if periodo:
            try:
                year, month = map(int, periodo.split("-"))
                query = query.filter(
                    func.extract('year', Invoice.fecha_emision) == year,
                    func.extract('month', Invoice.fecha_emision) == month
                )
            except Exception:
                pass

        invoices = query.all()
        total_facturado = sum(float(i.total) for i in invoices if i.estado != "ANULADA")
        iva_debito = sum(float(i.monto_iva_basico + i.monto_iva_minimo) for i in invoices if i.estado != "ANULADA")
        por_cobrar = sum(float(i.total) for i in invoices if i.estado == "EMITIDA")
        cobradas = sum(float(i.total) for i in invoices if i.estado == "COBRADA")
        anuladas = sum(1 for i in invoices if i.estado == "ANULADA")

        return {
            "periodo": periodo or "Consolidado 2026",
            "total_facturado": total_facturado,
            "iva_debito_fiscal": iva_debito,
            "cuentas_por_cobrar": por_cobrar,
            "total_cobrado": cobradas,
            "cantidad_facturas": len(invoices),
            "cantidad_anuladas": anuladas
        }
