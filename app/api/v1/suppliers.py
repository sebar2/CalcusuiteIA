"""
Router dedicado para la gestión integral de Catálogos de Proveedores (SupplyFinance Core).
Proporciona endpoints para:
- Catálogo comercial de productos (PVP, PVM, Costo, márgenes)
- Ingesta masiva por planilla Excel/CSV
- Consulta de licitaciones y contratos estatales adjudicados vía Procurement Intelligence Hub
- Rigor contable: Todo cálculo en Decimal con ROUND_HALF_UP, sin tipos float.
"""

from __future__ import annotations

import io
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.engine.pricing import (
    calculate_catalog_item_metrics,
    calculate_cost_markup,
    calculate_resale_gross_margin,
    calculate_trade_discount,
)
from app.models.entities import Supplier, SupplierCatalogItem
from app.domain.schemas import (
    SupplierCatalogItemCreate,
    SupplierCatalogItemResponse,
    SupplierCatalogItemUpdate,
)
from app.services.procurement_client import procurement_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/suppliers", tags=["Supplier Catalogs & Logistics"])


def _to_decimal(val: Any, default: Decimal = Decimal("0.0000")) -> Decimal:
    if val is None:
        return default
    if isinstance(val, Decimal):
        return val
    try:
        s = str(val).strip().replace("$", "").replace(",", ".").replace(" ", "")
        if not s or s.lower() == "nan":
            return default
        return Decimal(s).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return default


# =============================================================================
# 1. CATÁLOGO COMERCIAL DE PRODUCTOS (PVP / PVM / COSTO)
# =============================================================================

@router.get("/{supplier_id}/catalog/products")
def get_supplier_catalog_products(
    supplier_id: int,
    rubro: Optional[str] = Query(None, description="Filtrar por rubro comercial"),
    search: Optional[str] = Query(None, description="Buscar por SKU o nombre de producto"),
    db: Session = Depends(get_db),
):
    """
    Retorna el catálogo comercial de productos del proveedor con métricas calculadas:
    - Costo de compra
    - PVM (Precio de Venta a Comercios / Mayorista)
    - PVP (Precio de Venta al Público)
    - Descuento a Comercios %, Margen Bruto de Reventa % y Markup sobre Costo %
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Proveedor {supplier_id} no encontrado.")

    query = db.query(SupplierCatalogItem).filter(SupplierCatalogItem.supplier_id == supplier_id)

    if rubro and rubro.strip() and rubro.strip().lower() != "todos":
        query = query.filter(SupplierCatalogItem.rubro.ilike(f"%{rubro.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                SupplierCatalogItem.sku_proveedor.ilike(term),
                SupplierCatalogItem.sku_calcu.ilike(term),
                SupplierCatalogItem.nombre.ilike(term),
            )
        )

    items = query.order_by(SupplierCatalogItem.id.desc()).all()

    results: List[Dict[str, Any]] = []
    for it in items:
        metrics = calculate_catalog_item_metrics(it.costo_compra, it.precio_venta_comercios, it.precio_venta_publico)
        results.append({
            "id": it.id,
            "supplier_id": it.supplier_id,
            "sku_proveedor": it.sku_proveedor,
            "sku_calcu": it.sku_calcu,
            "nombre": it.nombre,
            "rubro": it.rubro,
            "costo_compra": it.costo_compra,
            "precio_venta_comercios": it.precio_venta_comercios,
            "precio_venta_publico": it.precio_venta_publico,
            "descuento_comercios_pct": metrics["descuento_comercios_pct"],
            "margen_reventa_pct": metrics["margen_reventa_pct"],
            "markup_costo_pct": metrics["markup_costo_pct"],
            "stock_estimado": it.stock_estimado,
            "updated_at": it.updated_at.isoformat() if it.updated_at else None,
        })

    return {
        "success": True,
        "supplier_id": supplier.id,
        "supplier_name": supplier.nombre,
        "total": len(results),
        "items": results,
    }


@router.post("/{supplier_id}/catalog/products", response_model=SupplierCatalogItemResponse)
def create_or_update_catalog_product(
    supplier_id: int,
    payload: SupplierCatalogItemCreate,
    db: Session = Depends(get_db),
):
    """
    Agrega o actualiza un producto individual en el catálogo del proveedor.
    Si ya existe un registro con el mismo sku_proveedor para este proveedor, actualiza los valores.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Proveedor {supplier_id} no encontrado.")

    existing = db.query(SupplierCatalogItem).filter(
        SupplierCatalogItem.supplier_id == supplier_id,
        SupplierCatalogItem.sku_proveedor == payload.sku_proveedor.strip(),
    ).first()

    if existing:
        existing.sku_calcu = payload.sku_calcu.strip() if payload.sku_calcu else None
        existing.nombre = payload.nombre.strip()
        existing.rubro = payload.rubro.strip() if payload.rubro else "Iluminación"
        existing.costo_compra = payload.costo_compra
        existing.precio_venta_comercios = payload.precio_venta_comercios
        existing.precio_venta_publico = payload.precio_venta_publico
        existing.stock_estimado = payload.stock_estimado.strip() if payload.stock_estimado else "En Stock MVD"
        existing.updated_at = datetime.now(timezone.utc)
        item = existing
    else:
        item = SupplierCatalogItem(
            supplier_id=supplier_id,
            sku_proveedor=payload.sku_proveedor.strip(),
            sku_calcu=payload.sku_calcu.strip() if payload.sku_calcu else None,
            nombre=payload.nombre.strip(),
            rubro=payload.rubro.strip() if payload.rubro else "Iluminación",
            costo_compra=payload.costo_compra,
            precio_venta_comercios=payload.precio_venta_comercios,
            precio_venta_publico=payload.precio_venta_publico,
            stock_estimado=payload.stock_estimado.strip() if payload.stock_estimado else "En Stock MVD",
            updated_at=datetime.now(timezone.utc),
        )
        db.add(item)

    db.commit()
    db.refresh(item)

    metrics = calculate_catalog_item_metrics(item.costo_compra, item.precio_venta_comercios, item.precio_venta_publico)
    return SupplierCatalogItemResponse(
        id=item.id,
        supplier_id=item.supplier_id,
        sku_proveedor=item.sku_proveedor,
        sku_calcu=item.sku_calcu,
        nombre=item.nombre,
        rubro=item.rubro,
        costo_compra=item.costo_compra,
        precio_venta_comercios=item.precio_venta_comercios,
        precio_venta_publico=item.precio_venta_publico,
        stock_estimado=item.stock_estimado,
        descuento_comercios_pct=metrics["descuento_comercios_pct"],
        margen_reventa_pct=metrics["margen_reventa_pct"],
        markup_costo_pct=metrics["markup_costo_pct"],
        updated_at=item.updated_at,
    )


@router.put("/{supplier_id}/catalog/products/{item_id}", response_model=SupplierCatalogItemResponse)
def update_catalog_product(
    supplier_id: int,
    item_id: int,
    payload: SupplierCatalogItemUpdate,
    db: Session = Depends(get_db),
):
    """
    Edita parcialmente un ítem del catálogo de un proveedor.
    """
    item = db.query(SupplierCatalogItem).filter(
        SupplierCatalogItem.id == item_id,
        SupplierCatalogItem.supplier_id == supplier_id,
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Ítem de catálogo no encontrado.")

    if payload.sku_proveedor is not None:
        item.sku_proveedor = payload.sku_proveedor.strip()
    if payload.sku_calcu is not None:
        item.sku_calcu = payload.sku_calcu.strip() if payload.sku_calcu else None
    if payload.nombre is not None:
        item.nombre = payload.nombre.strip()
    if payload.rubro is not None:
        item.rubro = payload.rubro.strip()
    if payload.costo_compra is not None:
        item.costo_compra = payload.costo_compra
    if payload.precio_venta_comercios is not None:
        item.precio_venta_comercios = payload.precio_venta_comercios
    if payload.precio_venta_publico is not None:
        item.precio_venta_publico = payload.precio_venta_publico
    if payload.stock_estimado is not None:
        item.stock_estimado = payload.stock_estimado.strip()

    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)

    metrics = calculate_catalog_item_metrics(item.costo_compra, item.precio_venta_comercios, item.precio_venta_publico)
    return SupplierCatalogItemResponse(
        id=item.id,
        supplier_id=item.supplier_id,
        sku_proveedor=item.sku_proveedor,
        sku_calcu=item.sku_calcu,
        nombre=item.nombre,
        rubro=item.rubro,
        costo_compra=item.costo_compra,
        precio_venta_comercios=item.precio_venta_comercios,
        precio_venta_publico=item.precio_venta_publico,
        stock_estimado=item.stock_estimado,
        descuento_comercios_pct=metrics["descuento_comercios_pct"],
        margen_reventa_pct=metrics["margen_reventa_pct"],
        markup_costo_pct=metrics["markup_costo_pct"],
        updated_at=item.updated_at,
    )


@router.delete("/{supplier_id}/catalog/products/{item_id}")
def delete_catalog_product(
    supplier_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    """
    Elimina un ítem del catálogo de un proveedor.
    """
    item = db.query(SupplierCatalogItem).filter(
        SupplierCatalogItem.id == item_id,
        SupplierCatalogItem.supplier_id == supplier_id,
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Ítem de catálogo no encontrado.")

    db.delete(item)
    db.commit()
    return {"success": True, "message": "Producto eliminado del catálogo correctamente."}


# =============================================================================
# 2. INGESTA MASIVA EXCEL / CSV PARA LISTAS DE PRECIOS
# =============================================================================

@router.post("/{supplier_id}/catalog/upload")
async def upload_supplier_catalog_spreadsheet(
    supplier_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Ingesta masiva de listas de precios de distribuidores y proveedores por archivo Excel (.xlsx, .xls) o CSV (.csv).
    Detecta automáticamente encabezados en español e inglés:
    - SKU Proveedor / Código / Item
    - SKU Calcu / SKU Propio (opcional)
    - Nombre / Producto / Descripción
    - Rubro / Vertical / Categoría
    - Costo / Costo de Compra / Costo Base
    - PVM / Precio Comercios / Precio Mayorista
    - PVP / Precio Público / Precio Venta
    - Stock / Disponibilidad / Plazo
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Proveedor {supplier_id} no encontrado.")

    content = await file.read()
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(content), sep=None, engine="python", dtype=str)
            except Exception:
                df = pd.read_csv(io.BytesIO(content), encoding="latin1", sep=None, engine="python", dtype=str)
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), dtype=str)
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato de archivo no soportado. Debe ser .xlsx, .xls o .csv",
            )
    except Exception as e:
        logger.exception("Error al leer archivo de catálogo: %s", e)
        raise HTTPException(status_code=400, detail=f"No se pudo parsear el archivo: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="La planilla cargada está vacía.")

    # Mapeo flexible de columnas
    def find_col(candidates: List[str]) -> Optional[str]:
        cols = {str(c).strip().lower(): c for c in df.columns}
        for cand in candidates:
            if cand in cols:
                return cols[cand]
        # Búsqueda difusa por inclusión
        for c_lower, orig in cols.items():
            for cand in candidates:
                if cand in c_lower:
                    return orig
        return None

    sku_col = find_col(["sku_proveedor", "sku proveedor", "codigo_proveedor", "código", "sku", "codigo", "item"])
    sku_calcu_col = find_col(["sku_calcu", "sku calcu", "sku propio", "sku_interno", "calcu_sku"])
    nombre_col = find_col(["nombre", "producto", "descripcion", "descripción", "articulo", "artículo", "detalle"])
    rubro_col = find_col(["rubro", "categoria", "categoría", "vertical", "familia"])
    costo_col = find_col(["costo_compra", "costo compra", "costo", "cost", "costo_unitario", "costo base", "compra"])
    pvm_col = find_col(["precio_venta_comercios", "pvm", "precio comercios", "precio comercio", "mayorista", "comercio", "precio_mayorista"])
    pvp_col = find_col(["precio_venta_publico", "pvp", "precio publico", "precio público", "precio venta", "publico", "venta"])
    stock_col = find_col(["stock_estimado", "stock estimado", "stock", "disponibilidad", "plazo", "entrega"])

    if not sku_col or not nombre_col:
        raise HTTPException(
            status_code=400,
            detail=f"La planilla debe incluir al menos una columna de SKU (encontrado: {sku_col}) y Nombre/Descripción (encontrado: {nombre_col}).",
        )

    processed = 0
    created = 0
    updated = 0

    for _, row in df.iterrows():
        sku_val = str(row.get(sku_col) or "").strip()
        nom_val = str(row.get(nombre_col) or "").strip()
        if not sku_val or not nom_val or sku_val.lower() == "nan" or nom_val.lower() == "nan":
            continue

        sku_calcu_val = str(row.get(sku_calcu_col) or "").strip() if sku_calcu_col else None
        if sku_calcu_val and sku_calcu_val.lower() == "nan":
            sku_calcu_val = None

        rub_val = str(row.get(rubro_col) or "Iluminación").strip() if rubro_col else "Iluminación"
        if rub_val.lower() == "nan" or not rub_val:
            rub_val = "Iluminación"

        stock_val = str(row.get(stock_col) or "En Stock MVD").strip() if stock_col else "En Stock MVD"
        if stock_val.lower() == "nan" or not stock_val:
            stock_val = "En Stock MVD"

        cost_val = _to_decimal(row.get(costo_col)) if costo_col else Decimal("0.0000")
        pvm_val = _to_decimal(row.get(pvm_col)) if pvm_col else Decimal("0.0000")
        pvp_val = _to_decimal(row.get(pvp_col)) if pvp_col else Decimal("0.0000")

        # Si PVM o PVP vienen en 0 pero se tiene costo, sugerir margen razonable de catálogo
        if pvm_val <= Decimal("0.0000") and cost_val > Decimal("0.0000"):
            pvm_val = (cost_val * Decimal("1.40")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if pvp_val <= Decimal("0.0000") and pvm_val > Decimal("0.0000"):
            pvp_val = (pvm_val * Decimal("1.35")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        existing = db.query(SupplierCatalogItem).filter(
            SupplierCatalogItem.supplier_id == supplier_id,
            SupplierCatalogItem.sku_proveedor == sku_val,
        ).first()

        if existing:
            existing.nombre = nom_val
            if sku_calcu_val:
                existing.sku_calcu = sku_calcu_val
            existing.rubro = rub_val
            existing.costo_compra = cost_val
            existing.precio_venta_comercios = pvm_val
            existing.precio_venta_publico = pvp_val
            existing.stock_estimado = stock_val
            existing.updated_at = datetime.now(timezone.utc)
            updated += 1
        else:
            new_item = SupplierCatalogItem(
                supplier_id=supplier_id,
                sku_proveedor=sku_val,
                sku_calcu=sku_calcu_val,
                nombre=nom_val,
                rubro=rub_val,
                costo_compra=cost_val,
                precio_venta_comercios=pvm_val,
                precio_venta_publico=pvp_val,
                stock_estimado=stock_val,
                updated_at=datetime.now(timezone.utc),
            )
            db.add(new_item)
            created += 1

        processed += 1

    db.commit()

    return {
        "success": True,
        "message": f"Planilla procesada con éxito: {processed} artículos ({created} creados, {updated} actualizados).",
        "processed": processed,
        "created": created,
        "updated": updated,
    }


# =============================================================================
# 3. LICITACIONES & CONTRATOS ESTATALES DEL PROVEEDOR (INTEGRACIÓN SICE/ARCE)
# =============================================================================

@router.get("/{supplier_id}/catalog/tenders")
async def get_supplier_catalog_tenders(
    supplier_id: int,
    db: Session = Depends(get_db),
):
    """
    Consulta y retorna los contratos y productos ganados por ese proveedor en compras públicas
    de Uruguay (SICE/ARCE/RUPE), conectándose al Procurement Intelligence Hub.
    Elimina tarjetas genéricas o vacías y desglosa montos, fechas, organismo e ítems adjudicados.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Proveedor {supplier_id} no encontrado.")

    # 1. Intentar buscar por RUT o por Nombre Comercial en el Hub de Compras Estatales
    query_str = (supplier.rut or supplier.razon_social or supplier.nombre or "").strip()
    # Limpiar prefijos de RUT
    query_rut = re.sub(r"[^0-9]", "", supplier.rut or "")

    remote_supplier_id = None
    search_terms = [q for q in [query_rut, supplier.razon_social, supplier.nombre] if q and len(q) >= 3]

    for term in search_terms:
        search_res = await procurement_client.search_suppliers(query=term, limit=5)
        if search_res.get("success") and search_res.get("data"):
            supps = search_res["data"].get("suppliers") or []
            if supps:
                # Encontrar el que mejor coincide
                best = supps[0]
                remote_supplier_id = best.get("supplierId") or best.get("_id") or best.get("id")
                break

    # Si no se encontró por búsqueda exacta, probar con el ID de proveedor si parece un código RUPE
    if not remote_supplier_id and supplier.rut:
        remote_supplier_id = supplier.rut.strip()

    normalized_contracts: List[Dict[str, Any]] = []

    if remote_supplier_id:
        detail_res = await procurement_client.get_supplier_detail(str(remote_supplier_id))
        if detail_res.get("success") and detail_res.get("data"):
            data = detail_res["data"]
            recent_raw = data.get("recentContracts") or []
            for c in recent_raw:
                # Extraer organismo
                buyer_obj = c.get("buyer") or {}
                buyer_name = buyer_obj.get("name") or c.get("buyerName") or "Organismo Estatal Adjudicador"

                # Extraer fecha
                contract_date = c.get("date") or c.get("sourceYear") or ""
                if isinstance(contract_date, str) and "T" in contract_date:
                    contract_date = contract_date.split("T")[0]

                # Extraer adjudicaciones e ítems
                awards = c.get("awards") or []
                raw_items = []
                calc_total = Decimal("0.00")
                curr = "UYU"
                contract_title = c.get("title") or ""

                for aw in awards:
                    if not contract_title and aw.get("title") and not aw.get("title").startswith("X/"):
                        contract_title = aw.get("title")
                    aw_date = aw.get("date")
                    if not contract_date and aw_date:
                        contract_date = str(aw_date).split("T")[0]

                    for itm in (aw.get("items") or []):
                        cls = itm.get("classification") or {}
                        desc = cls.get("description") or itm.get("description") or "Ítem Adjudicado"
                        if not contract_title or contract_title.startswith("X/"):
                            contract_title = desc

                        qty = itm.get("quantity") or 1
                        unit_info = itm.get("unit") or {}
                        u_name = unit_info.get("name") or itm.get("unitName") or "UNIDAD"
                        val_info = unit_info.get("value") or {}
                        u_price = _to_decimal(val_info.get("amount") or itm.get("avgPrice") or 0)
                        if val_info.get("currency"):
                            curr = val_info.get("currency")

                        item_total = (Decimal(str(qty)) * u_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        calc_total += item_total

                        raw_items.append({
                            "id": str(itm.get("id") or ""),
                            "description": desc,
                            "quantity": qty,
                            "unitName": u_name,
                            "unitPrice": float(u_price),
                            "totalPrice": float(item_total),
                            "currency": curr,
                        })

                # Si no calculó por ítems, revisar si el contrato tiene amount directo
                final_amount = float(calc_total) if calc_total > Decimal("0.00") else float(_to_decimal(c.get("amount") or 0))

                if not contract_title:
                    contract_title = f"Contrato de Suministros {c.get('id') or ''}".strip()

                # Ignorar únicamente si monto es 0 Y no tiene título ni ítems
                if final_amount > 0 or raw_items or contract_title != "Contrato Estatal":
                    normalized_contracts.append({
                        "id": str(c.get("id") or c.get("_id") or f"CNT-{len(normalized_contracts)+1}"),
                        "ocid": c.get("ocid"),
                        "title": contract_title,
                        "buyerName": buyer_name,
                        "date": str(contract_date),
                        "amount": final_amount,
                        "currency": curr,
                        "status": c.get("status") or "Adjudicado",
                        "itemsCount": len(raw_items),
                        "items": raw_items,
                    })

    # Si no tiene contratos estatales registrados en el hub, retornar contratos vinculados a sus ítems o vacío limpio
    return {
        "success": True,
        "supplier": {
            "id": supplier.id,
            "nombre": supplier.nombre,
            "razon_social": supplier.razon_social,
            "rut": supplier.rut,
            "tipo_proveedor": supplier.tipo_proveedor,
            "rubro": supplier.rubro,
        },
        "remote_matched": bool(remote_supplier_id),
        "total_contracts": len(normalized_contracts),
        "contracts": normalized_contracts,
    }
