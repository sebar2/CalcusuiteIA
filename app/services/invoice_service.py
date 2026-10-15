import logging
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, or_

from app.models.accounting_entities import Invoice, InvoiceItem, JournalEntry, JournalLine
from app.models.entities import Product, Client, SalesOrder, SupplierCatalogItem
from app.domain.models import AuditLog

logger = logging.getLogger(__name__)

class InvoiceService:
    @staticmethod
    def get_invoices(
        db: Session,
        periodo: Optional[str] = None,
        estado: Optional[str] = None,
        cliente_rut: Optional[str] = None,
        tipo_cfe: Optional[str] = None,
        limit: int = 50
    ) -> List[Invoice]:
        """Obtiene la lista de facturas comerciales e-Facturas y Notas de Crédito emitidas."""
        query = db.query(Invoice).order_by(desc(Invoice.id))
        if estado:
            query = query.filter(Invoice.estado == estado.upper())
        if cliente_rut:
            query = query.filter(Invoice.cliente_rut == cliente_rut)
        if tipo_cfe:
            query = query.filter(Invoice.tipo_cfe == tipo_cfe)
        if periodo:
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
    def search_products(db: Session, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Búsqueda predictiva de productos por SKU o Nombre (requiere >2 caracteres).
        Retorna coincidencias con precio unitario, stock y categoría.
        """
        if not query or len(query.strip()) < 2:
            return []
        
        pattern = f"%{query.strip().lower()}%"
        results = []
        
        # 1. Buscar en productos del catálogo interno
        prods = db.query(Product).filter(
            or_(
                func.lower(Product.sku).like(pattern),
                func.lower(Product.nombre).like(pattern)
            )
        ).limit(limit).all()

        for p in prods:
            stock = 0
            if hasattr(p, 'inventario') and p.inventario:
                stock = getattr(p.inventario, 'stock_actual', 0)
            elif hasattr(p, 'stock_actual'):
                stock = getattr(p, 'stock_actual', 0)
            price = getattr(p, 'precio_lista', None) or getattr(p, 'precio_venta', 0.0)
            cost = getattr(p, 'costo_base', None) or getattr(p, 'costo_unitario', 0.0)
            results.append({
                "sku": p.sku,
                "nombre": p.nombre,
                "descripcion": f"{p.nombre} (SKU: {p.sku})",
                "precio_unitario": float(price or 0.0),
                "costo": float(cost or 0.0),
                "stock_actual": int(stock or 0),
                "tasa_iva_pct": 22.0,
                "origen": "INVENTARIO_PROPIO"
            })

        # 2. Si hay espacio, complementar con catálogo de proveedores
        if len(results) < limit:
            supp_items = db.query(SupplierCatalogItem).filter(
                or_(
                    func.lower(SupplierCatalogItem.sku_proveedor).like(pattern),
                    func.lower(SupplierCatalogItem.nombre).like(pattern)
                )
            ).limit(limit - len(results)).all()

            for si in supp_items:
                results.append({
                    "sku": si.sku_proveedor,
                    "nombre": si.nombre,
                    "descripcion": f"{si.nombre} (Catálogo Proveedor: {si.sku_proveedor})",
                    "precio_unitario": float(si.precio_venta_comercios or 0.0),
                    "costo": float(si.costo_compra or 0.0),
                    "stock_actual": 999,
                    "tasa_iva_pct": 22.0,
                    "origen": "CATALOGO_PROVEEDOR"
                })

        return results

    @staticmethod
    def search_clients(db: Session, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Búsqueda predictiva de clientes por Razón Social, Nombre de Fantasía, RUT o CI (>2 caracteres).
        """
        if not query or len(query.strip()) < 2:
            return []

        pattern = f"%{query.strip().lower()}%"
        clients = db.query(Client).filter(
            or_(
                func.lower(Client.nombre).like(pattern),
                func.lower(Client.razon_social).like(pattern),
                func.lower(Client.nombre_fantasia).like(pattern),
                func.lower(Client.rut).like(pattern),
                func.lower(Client.documento).like(pattern)
            )
        ).limit(limit).all()

        today = date.today()
        results = []
        for c in clients:
            # Calcular deuda actual del cliente
            deuda_total = db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00"))).filter(
                Invoice.cliente_rut == (c.rut or c.documento or ""),
                Invoice.estado == "EMITIDA",
                ~Invoice.tipo_cfe.in_(["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
            ).scalar() or Decimal("0.00")

            limite = float(c.limite_credito or 0.0)
            deuda = float(deuda_total)
            cupo_disponible = max(0.0, limite - deuda) if limite > 0 else 0.0

            results.append({
                "id": c.id,
                "nombre": c.nombre,
                "razon_social": c.razon_social or c.nombre,
                "nombre_fantasia": c.nombre_fantasia or c.nombre,
                "rut": c.rut or c.documento or "",
                "documento": c.documento or c.rut or "",
                "tipo_documento": c.tipo_documento or ("CI" if c.es_consumidor_final else "RUT"),
                "es_consumidor_final": bool(c.es_consumidor_final),
                "email": c.email,
                "phone": c.phone,
                "address": c.address,
                "limite_credito": limite,
                "deuda_acumulada": deuda,
                "cupo_disponible": cupo_disponible,
                "bloqueo_credito": bool(c.es_consumidor_final) or (limite > 0 and deuda >= limite)
            })

        return results

    @staticmethod
    def get_sales_orders_available(db: Session, limit: int = 20) -> List[Dict[str, Any]]:
        """Obtiene órdenes de venta emitidas pendientes o listas para facturar."""
        orders = db.query(SalesOrder).filter(SalesOrder.estado.in_(["EMITIDA", "EN_DESPACHO"])).order_by(desc(SalesOrder.created_at)).limit(limit).all()
        result = []
        for o in orders:
            result.append({
                "id": o.id,
                "numero_ov": o.numero_ov,
                "cliente": o.cliente,
                "rut": o.rut,
                "vendedor": o.vendedor,
                "subtotal": float(o.subtotal),
                "iva_monto": float(o.iva_monto),
                "total": float(o.total),
                "moneda": o.moneda,
                "fecha_emision": o.fecha_emision.isoformat() if o.fecha_emision else None,
                "items": [
                    {
                        "sku": it.sku,
                        "cantidad": it.cantidad,
                        "precio_unitario": float(it.precio_unitario),
                        "subtotal": float(it.subtotal)
                    }
                    for it in o.items
                ]
            })
        return result

    @staticmethod
    def create_invoice(db: Session, data: Dict[str, Any], user_id: str = "controller_admin", user_role: str = "controller_admin") -> Invoice:
        """
        Emite una nueva e-Factura o Nota de Crédito (CFE DGI) con:
        - Control de Límite de Crédito
        - Bloqueo de crédito a Consumidor Final (salvo rol controller_admin)
        - Asiento contable inverso en caso de Nota de Crédito
        """
        tipo_cfe = data.get("tipo_cfe", "111_E_FACTURA")
        is_credit_note = tipo_cfe in ["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"]

        es_consumidor_final = bool(data.get("es_consumidor_final", False))
        forma_pago = data.get("forma_pago", "CREDITO_30_DIAS")
        tipo_documento_receptor = data.get("tipo_documento_receptor", "CI" if es_consumidor_final else "RUT")
        documento_receptor = data.get("documento_receptor") or data.get("cliente_rut")

        # 1. Regla de Negocio: Consumidor Final NO puede operar a crédito
        if es_consumidor_final and "CREDITO" in forma_pago.upper() and user_role != "controller_admin":
            raise ValueError("Los clientes Consumidor Final sólo pueden operar al Contado. La venta a crédito requiere autorización expresa de Gerencia/Controller.")

        # Generar número correlativo
        count = db.query(func.count(Invoice.id)).scalar() or 0
        if is_credit_note:
            numero_factura = f"NC-A-{1000 + count + 1}"
        else:
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
            raw_items = [{
                "descripcion": data.get("concepto", "Ajuste / Ítem comercial"),
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

        # 2. Control de Límite de Crédito para ventas a crédito
        cliente_rut = data.get("cliente_rut", "219998880017")
        if not is_credit_note and "CREDITO" in forma_pago.upper():
            cli = db.query(Client).filter(or_(Client.rut == cliente_rut, Client.documento == cliente_rut)).first()
            if cli and cli.limite_credito and cli.limite_credito > Decimal("0.00"):
                deuda_actual = db.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00"))).filter(
                    Invoice.cliente_rut == cliente_rut,
                    Invoice.estado == "EMITIDA",
                    ~Invoice.tipo_cfe.in_(["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
                ).scalar() or Decimal("0.00")
                if deuda_actual + total_factura > cli.limite_credito and user_role != "controller_admin":
                    raise ValueError(f"Límite de crédito excedido: Deuda actual ${float(deuda_actual):,.2f} + Esta factura ${float(total_factura):,.2f} supera el cupo de ${float(cli.limite_credito):,.2f}")

        factura_ref_id = data.get("factura_referencia_id")

        invoice = Invoice(
            numero_factura=numero_factura,
            serie="NC" if is_credit_note else data.get("serie", "A"),
            tipo_cfe=tipo_cfe,
            fecha_emision=fecha_emision,
            fecha_vencimiento=fecha_vencimiento,
            cliente_nombre=data.get("cliente_nombre", "Cliente Comercial S.A."),
            cliente_rut=cliente_rut,
            cliente_documento=documento_receptor,
            tipo_documento_receptor=tipo_documento_receptor,
            es_consumidor_final=es_consumidor_final,
            orden_compra_ref=data.get("orden_compra_ref"),
            factura_referencia_id=factura_ref_id,
            cliente_direccion=data.get("cliente_direccion", "Montevideo, Uruguay"),
            moneda=data.get("moneda", "UYU"),
            tipo_cambio=Decimal(str(data.get("tipo_cambio", "1.0000"))),
            subtotal=subtotal,
            monto_iva_basico=iva_basico,
            monto_iva_minimo=iva_minimo,
            monto_iva_exento=iva_exento,
            total=total_factura,
            estado=data.get("estado", "EMITIDA"),
            forma_pago=forma_pago,
            notas=data.get("notas", "Comprobante Fiscal Electrónico homologado por DGI"),
            items=items_objs
        )
        db.add(invoice)
        db.flush()

        # Si es Nota de Crédito y anula una factura de referencia completa, marcar original como ANULADA
        if is_credit_note and factura_ref_id:
            ref_inv = db.query(Invoice).filter(Invoice.id == factura_ref_id).first()
            if ref_inv:
                ref_inv.estado = "ANULADA"
                ref_inv.notas = (ref_inv.notas or "") + f" | Anulada mediante Nota de Crédito {numero_factura}"

        # Asiento Contable Automático en Libro Diario (Partida Doble)
        InvoiceService._create_invoice_journal_entry(db, invoice, is_credit_note)

        # Registrar en Auditoría y Monitoreo
        db.add(AuditLog(
            user_id=user_id,
            role=user_role,
            action="EMITIR_NOTA_CREDITO" if is_credit_note else "EMITIR_FACTURA",
            resource=f"invoices/{invoice.id}",
            ip_address="100.64.0.1",
            ubicacion="Montevideo (Nodo Tailscale Central)",
            evento_realizado=f"{'Emisión de Nota de Crédito' if is_credit_note else 'Emisión de Factura'} {invoice.numero_factura} a {invoice.cliente_nombre} por ${float(invoice.total):,.2f}",
            severidad="INFO",
            details={
                "numero_factura": invoice.numero_factura,
                "tipo_cfe": invoice.tipo_cfe,
                "cliente": invoice.cliente_nombre,
                "rut": invoice.cliente_rut,
                "total": float(invoice.total),
                "es_consumidor_final": es_consumidor_final,
                "factura_referencia_id": factura_ref_id
            }
        ))
        db.commit()
        db.refresh(invoice)
        return invoice

    @staticmethod
    def _create_invoice_journal_entry(db: Session, invoice: Invoice, is_credit_note: bool = False):
        """
        Genera el asiento contable por partida doble:
        - Si es Venta Normal: Debe Deudores por Ventas / Haber Ventas e IVA Débito.
        - Si es Nota de Crédito: Debe Ventas e IVA Débito / Haber Deudores por Ventas (reversión exacta).
        """
        asiento_num = (db.query(func.max(JournalEntry.numero_asiento)).scalar() or 0) + 1
        
        entry = JournalEntry(
            numero_asiento=asiento_num,
            fecha=invoice.fecha_emision,
            glosa=f"{'Nota de Crédito por ajuste/devolución' if is_credit_note else 'Venta B2B'} según {invoice.numero_factura} - {invoice.cliente_nombre}",
            tipo_operacion="NOTA_CREDITO" if is_credit_note else "VENTA",
            referencia_doc=invoice.numero_factura,
            total_debe=invoice.total,
            total_haber=invoice.total,
            balanceado=True
        )
        db.add(entry)
        db.flush()

        iva_total = invoice.monto_iva_basico + invoice.monto_iva_minimo

        if not is_credit_note:
            # Factura Normal:
            # Debe: Deudores por Ventas
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
            if iva_total > Decimal("0.00"):
                db.add(JournalLine(
                    entry_id=entry.id,
                    cuenta_codigo="2.1.3",
                    cuenta_nombre="IVA Débito Fiscal (DGI)",
                    debe=Decimal("0.00"),
                    haber=iva_total
                ))
        else:
            # Nota de Crédito:
            # Debe: Ventas Netas (disminución de ingreso)
            db.add(JournalLine(
                entry_id=entry.id,
                cuenta_codigo="4.1.1",
                cuenta_nombre="Ventas Netas de Bienes y Servicios (Ajuste NC)",
                debe=invoice.subtotal,
                haber=Decimal("0.00")
            ))
            # Debe: IVA Débito Fiscal (disminución de débito)
            if iva_total > Decimal("0.00"):
                db.add(JournalLine(
                    entry_id=entry.id,
                    cuenta_codigo="2.1.3",
                    cuenta_nombre="IVA Débito Fiscal (Ajuste NC)",
                    debe=iva_total,
                    haber=Decimal("0.00")
                ))
            # Haber: Deudores por Ventas (disminución de cuenta por cobrar)
            db.add(JournalLine(
                entry_id=entry.id,
                cuenta_codigo="1.1.3",
                cuenta_nombre="Deudores por Ventas / Clientes B2B (Crédito)",
                debe=Decimal("0.00"),
                haber=invoice.total
            ))

    @staticmethod
    def get_summary(db: Session, periodo: Optional[str] = None) -> Dict[str, Any]:
        """Calcula los KPIs consolidados de facturación B2B considerando Notas de Crédito."""
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
        # Restar notas de crédito
        ventas_brutas = sum(float(i.total) for i in invoices if i.estado != "ANULADA" and i.tipo_cfe not in ["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
        notas_credito = sum(float(i.total) for i in invoices if i.tipo_cfe in ["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
        total_facturado = max(0.0, ventas_brutas - notas_credito)

        iva_debito = sum(float(i.monto_iva_basico + i.monto_iva_minimo) for i in invoices if i.estado != "ANULADA" and i.tipo_cfe not in ["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
        por_cobrar = sum(float(i.total) for i in invoices if i.estado == "EMITIDA" and i.tipo_cfe not in ["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
        cobradas = sum(float(i.total) for i in invoices if i.estado == "COBRADA")
        anuladas = sum(1 for i in invoices if i.estado == "ANULADA")

        return {
            "periodo": periodo or "Consolidado 2026",
            "total_facturado": total_facturado,
            "iva_debito_fiscal": iva_debito,
            "cuentas_por_cobrar": por_cobrar,
            "total_cobrado": cobradas,
            "cantidad_facturas": len(invoices),
            "cantidad_notas_credito": sum(1 for i in invoices if i.tipo_cfe in ["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"]),
            "cantidad_anuladas": anuladas
        }
