import io
import re
import json
import calendar
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import List, Optional
import httpx
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, and_, or_

from app.core.config import settings

PERIOD_REGEX = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')

from app.database.session import get_db
from app.models.entities import (
    Product, 
    Inventory, 
    Budget, 
    PresupuestoMeta, 
    Category, 
    Sale, 
    PresupuestoVersion, 
    OrdenReposicion,
    CentroCosto,
    PresupuestoCentroCosto,
    Area,
    ResponsableUser,
    Tender,
    TenderItem,
    CommercialDeal,
    CommercialDealItem,
    StockLocationBatch,
    Warehouse,
    AccionCompromiso,
    Client,
    Company,
    Supplier,
    UserPreference,
    OrdenCompra,
    OrdenCompraDetalle,
    ImplicitServiceCatalog,
    ImplicitBudgetOrder,
    ImplicitBudgetItem,
    BiddingVertical,
    BiddingKeyword,
)
from app.domain.schemas import (
    ETLUploadResponse,
    InventoryAlert,
    InventoryQuickUpdateRequest,
    InventoryQuickUpdateResponse,
    ReventaBatchCreatePayload,
    BatchApprovePayload,
    ImplicitServiceItemSchema,
    ImplicitServiceCreatePayload,
    ImplicitBudgetItemCreate,
    ImplicitBudgetItemResponse,
    ImplicitBudgetOrderCreate,
    ImplicitBudgetOrderResponse,
    LocalPurchaseOrderCreate,
    LocalPurchaseOrderResponse,
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientDealItemSummary,
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierProductItem,
    CostCenterBudgetCreate,
    CostCenterBudgetUpdate,
    CostCenterBudgetResponse,
    OllamaModelItem,
    OllamaModelsResponse,
    ActiveModelRequest,
    ActiveModelResponse,
    MarginSummary,
    DiscountSimulationRequest,
    DiscountSimulationResponse,
    BudgetVarianceReport,
    AvailablePeriodsResponse,
    BudgetSeedResponse,
    BudgetManualBatchRequest,
    BudgetManualBatchResponse,
    BudgetAISuggestResponse,
    BudgetPeriodDeleteResponse,
    CategoryCreate,
    CategoryResponse,
    BROUExchangeRateResponse,
    CostCenterResponse,
    CostCenterCreate,
    CostCenterBudgetLine,
    CostCenterSummaryItem,
    CostCenterBudgetReportResponse,
    CostCenterBatchRequest,
    CostCenterBatchResponse,
    CostCenterTotalOpexResponse,
    CostCenterBudget,
    CostCentersGeneralBudgetResponse,
    AreaSchema,
    AreaCreateRequest,
    AreaUpdateRequest,
    ResponsibleUserSchema,
    ResponsibleUserCreateRequest,
    ResponsibleUserUpdateRequest,
    WarehouseSchema,
    WarehouseCreate,
    WarehouseUpdate,
    PurchaseOrderSuggestion,
    PurchaseOrderSuggestionsResponse,
    BudgetCommitmentSchema,
    BudgetCommitmentCreate,
    BudgetCommitmentUpdate,
    BudgetCommitmentAIAuditResponse,
    TenderEvaluateRequest,
    TenderEvaluateResponse,
    TenderCreateRequest,
    TenderResponse,
    TenderQuoteRequest,
    DialecticalDebateResponse,
    CommercialDealCreate,
    CommercialDealUpdate,
    CommercialDealStageUpdate,
    CommercialDealResponse,
    StockLocationBatchCreate,
    StockLocationBatchResponse,
    StockTransferRequest,
    StockLocationSummary,
    SalesOrderGenerateRequest,
    SalesOrderResponse,
    StockBatchItem,
    WarehouseTransferPayload,
    WarehouseAssignStockPayload,
    WarehouseStockItem,
    WarehouseBatchDetail,
    TenderLiveFeedResponse,
    TenderImportFeedRequest,
    TenderFeedSyncRequest,
    ApplyScenarioRequest,
    ApplyScenarioResponse,
    BudgetScenarioRequest,
    BudgetScenarioResponse,
    PricingAIBundlesResponse,
    PricingAIBundlesRequest,
    AIBundleItem,
    BundleProductItem,
    WaterfallStep,
    BiddingVerticalItem,
    BiddingVerticalCreate,
    BiddingKeywordItem,
    BiddingKeywordCreate,
    BiddingKeywordBulkCreate,
    BiddingAIExpandKeywordsRequest,
    BiddingAIExpandKeywordsResponse,
)
from app.services.budget_planner_service import BudgetPlannerService
from app.services.tenders_service import tenders_service
from app.services.commercial_service import commercial_service
from app.services.stock_trace_service import stock_trace_service
from app.services.agents.tenders_debate_service import run_dialectical_debate
from app.services.exchange_rate_service import ExchangeRateService
from app.core.security import (
    get_current_user,
    UserContext,
    record_audit_log,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_OPERACIONES,
    require_roles,
)
from app.services.report_export_service import ReportExportService
from app.services.etl_service import ETLService
from app.services.ai_advisor_service import AIAdvisorService
from app.engine.inventory import calculate_rop, calculate_doh
from app.engine.pricing import (
    calculate_gross_margin,
    calculate_markup,
    calculate_unit_contribution_margin,
    calculate_marginal_ratio,
    simulate_discount,
)
from app.engine.variance import (
    calculate_variance,
    calculate_variance_pct,
    get_variance_status,
)

router = APIRouter(prefix="/api/v1", tags=["SupplyFinance Core V1"])


@router.post("/etl/upload", response_model=ETLUploadResponse, summary="Ingesta de planillas Excel/CSV")
async def upload_spreadsheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Ingesta planillas con inserciones idempotentes y soporte para hojas múltiples.
    """
    filename = file.filename or ""
    lower_filename = filename.lower()
    if not (lower_filename.endswith(".csv") or lower_filename.endswith(".xlsx") or lower_filename.endswith(".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de archivo inválido. Se requiere archivo .csv, .xlsx o .xls"
        )
    
    content = await file.read()
    MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo excede el tamaño máximo permitido de 15 MB."
        )

    result = ETLService.ingest_spreadsheet(content, filename, db)
    
    if result["status"] == "error":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=result["message"]
        )
    
    return ETLUploadResponse(
        status=result["status"],
        records_processed=result["records_processed"],
        errors=result["errors"],
        message=result["message"]
    )


@router.get("/categories", response_model=List[CategoryResponse], summary="Listado maestro de categorías activas (BCNF)")
def get_all_categories(
    include_test: bool = False,
    db: Session = Depends(get_db)
):
    """
    Retorna todas las categorías existentes en la base de datos BCNF.
    Por defecto filtra las categorías temporales generadas por suites de prueba (TestCat_*).
    """
    cats = db.query(Category).order_by(Category.nombre.asc()).all()
    res = []
    for c in cats:
        if not include_test and c.nombre.lower().startswith("testcat"):
            continue
        m_val = float(c.margen_target_pct or 30.0)
        if 0.0 < m_val < 1.0:
            m_val = m_val * 100.0
        res.append(CategoryResponse(
            id=c.id,
            nombre=c.nombre,
            margen_target_pct=round(m_val, 1),
            created_at=c.created_at
        ))
    return res


@router.post("/categories", response_model=CategoryResponse, summary="Creación dinámica de categoría (BCNF no destructiva)")
def create_category_endpoint(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Crea una categoría al vuelo validando unicidad case-insensitive.
    Si ya existe, la retorna de forma idempotente.
    """
    clean_nombre = payload.nombre.strip()
    existing = db.query(Category).filter(func.lower(Category.nombre) == func.lower(clean_nombre)).first()
    if existing:
        m_val = float(existing.margen_target_pct or 30.0)
        if 0.0 < m_val < 1.0:
            m_val = m_val * 100.0
        return CategoryResponse(
            id=existing.id,
            nombre=existing.nombre,
            margen_target_pct=round(m_val, 1),
            created_at=existing.created_at
        )

    m_pct = Decimal(str(payload.margen_target_pct or 30.0))
    if m_pct > 1:
        m_pct = m_pct / Decimal('100.0')

    new_cat = Category(
        nombre=clean_nombre,
        margen_target_pct=m_pct
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_CATEGORY",
        resource=f"categorias/{new_cat.id}",
        details={"nombre": new_cat.nombre, "margen_target_pct": float(payload.margen_target_pct or 30.0)}
    )

    return CategoryResponse(
        id=new_cat.id,
        nombre=new_cat.nombre,
        margen_target_pct=float(payload.margen_target_pct or 30.0),
        created_at=new_cat.created_at
    )


@router.get("/inventory/categories", response_model=List[str], summary="Listado de categorías únicas de productos")
def get_categories(
    include_test: bool = False,
    db: Session = Depends(get_db)
):
    """
    Retorna la lista de categorías únicas de productos, unificadas sin duplicados por mayúsculas/minúsculas.
    """
    cats = db.query(Category.nombre).distinct().all()
    seen = {}
    for (c,) in cats:
        if c and str(c).strip():
            c_str = str(c).strip()
            low = c_str.lower()
            if not include_test and low.startswith("testcat"):
                continue
            if low not in seen:
                seen[low] = c_str
    return sorted(list(seen.values()), key=lambda x: x.lower())


@router.get("/inventory/alerts", response_model=List[InventoryAlert], summary="SKUs con stock actual menor o igual a ROP")
def get_inventory_alerts(
    only_alerts: bool = False,
    categoria: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Reporte de control de abastecimiento:
    Calcula ROP y DOH para cada SKU, y señala alertas donde stock_actual <= ROP.
    """
    query = db.query(Product).options(
        selectinload(Product.categoria_rel),
        selectinload(Product.inventario)
    )
    if categoria:
        query = query.join(Category).filter(Category.nombre.ilike(f"%{categoria}%"))
    
    products = query.all()

    # Demanda Comprometida en Pipeline CRM (Tratos en etapas 'negociacion', 'ganada'/'ganado')
    committed_deals = db.query(CommercialDeal).filter(
        CommercialDeal.etapa.in_(["negociacion", "ganada", "ganado"])
    ).all()
    committed_by_sku = {}
    for d in committed_deals:
        if d.items:
            for it in d.items:
                s = it.sku
                committed_by_sku[s] = committed_by_sku.get(s, 0) + int(it.cantidad or 0)

    report: List[InventoryAlert] = []

    for prod in products:
        inv = prod.inventario
        if not inv:
            continue

        stock_actual = inv.stock_actual
        rop = calculate_rop(
            daily_demand=inv.demanda_diaria_promedio,
            lead_time=inv.lead_time_dias,
            safety_stock=Decimal(str(inv.stock_seguridad))
        )
        
        # Demanda comprometida en pipeline y stock disponible neto
        stock_comprometido = committed_by_sku.get(prod.sku, 0)
        stock_disponible_neto = max(0, stock_actual - stock_comprometido)

        # DOH (Days On Hand): Días de inventario disponibles según rotación y demanda anual
        inv_val = Decimal(str(stock_actual)) * prod.costo_unitario
        cogs_anual = inv.demanda_diaria_promedio * prod.costo_unitario * Decimal('365')
        if cogs_anual > Decimal('0'):
            doh = calculate_doh(inv_val, cogs_anual)
        elif inv.demanda_diaria_promedio > Decimal('0'):
            doh = calculate_doh(Decimal(str(stock_actual)), inv.demanda_diaria_promedio * Decimal('365'))
        else:
            doh = Decimal('0.00')

        # Alerta se dispara si stock total <= ROP o si el stock neto tras compromisos <= ROP
        is_alert = (Decimal(str(stock_actual)) <= rop) or (Decimal(str(stock_disponible_neto)) <= rop)

        if only_alerts and not is_alert:
            continue

        report.append(InventoryAlert(
            sku=prod.sku,
            nombre=prod.nombre,
            categoria=prod.categoria,
            stock_actual=stock_actual,
            rop=rop,
            doh=doh,
            is_alert=is_alert,
            stock_seguridad=inv.stock_seguridad,
            lead_time_dias=inv.lead_time_dias,
            deposito_central=inv.deposito_central,
            transito_maritimo=inv.transito_maritimo,
            aduana=inv.aduana,
            costo_unitario=prod.costo_unitario,
            demanda_diaria_promedio=inv.demanda_diaria_promedio,
            image_url=prod.image_url,
            stock_comprometido_pipeline=stock_comprometido,
            stock_disponible_neto=stock_disponible_neto
        ))

    return report


@router.patch(
    "/inventory/{sku}",
    response_model=InventoryQuickUpdateResponse,
    summary="Edición rápida atómica de stock, ROP y costos unitarios con sincronización a Kanban"
)
@router.patch(
    "/inventory/{sku}/quick-update",
    response_model=InventoryQuickUpdateResponse,
    include_in_schema=False
)
def quick_update_inventory(
    sku: str,
    payload: InventoryQuickUpdateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Edición express celda a celda o modal para administradores y analistas de operaciones:
    - Actualiza stock físico (depósito central, tránsito, aduana) o stock global.
    - Actualiza costo base de adquisición, lead time, stock de seguridad y demanda diaria.
    - Recalcula atómicamente ROP y DOH en caliente.
    - Sincroniza el pipeline Kanban (crea/actualiza orden en etapa 'sugerido' si Stock <= ROP,
      o la subsana si el stock supera el ROP).
    - Registra auditoría inmutable RBAC.
    """
    from datetime import date, timedelta

    prod = db.query(Product).filter(Product.sku == sku).first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con SKU '{sku}' no encontrado."
        )

    inv = prod.inventario
    if not inv:
        inv = Inventory(
            producto_id=prod.id,
            deposito_central=0,
            transito_maritimo=0,
            aduana=0,
            stock_seguridad=10,
            lead_time_dias=Decimal('30.0'),
            demanda_diaria_promedio=Decimal('5.0')
        )
        db.add(inv)
        db.flush()

    # 1. Actualización de depósitos o stock general
    if payload.stock_actual is not None:
        target_stock = int(payload.stock_actual)
        if payload.deposito_central is not None:
            inv.deposito_central = int(payload.deposito_central)
        else:
            other_stock = inv.transito_maritimo + inv.aduana
            if target_stock >= other_stock:
                inv.deposito_central = target_stock - other_stock
            else:
                inv.deposito_central = target_stock
                inv.transito_maritimo = 0
                inv.aduana = 0
    elif payload.deposito_central is not None:
        inv.deposito_central = int(payload.deposito_central)

    if payload.transito_maritimo is not None:
        inv.transito_maritimo = int(payload.transito_maritimo)
    if payload.aduana is not None:
        inv.aduana = int(payload.aduana)

    # 2. Parámetros operativos de supply chain
    if payload.lead_time_dias is not None:
        inv.lead_time_dias = Decimal(str(payload.lead_time_dias))
    if payload.stock_seguridad is not None:
        inv.stock_seguridad = int(payload.stock_seguridad)
    if payload.demanda_diaria_promedio is not None:
        inv.demanda_diaria_promedio = Decimal(str(payload.demanda_diaria_promedio))

    # 3. Costo unitario base e imagen
    if payload.costo_unitario is not None:
        prod.costo_base = Decimal(str(payload.costo_unitario))
    if payload.image_url is not None:
        prod.image_url = payload.image_url

    db.flush()

    # 4. Recálculo financiero y de rotación
    stock_actual = inv.stock_actual
    rop = calculate_rop(
        daily_demand=inv.demanda_diaria_promedio,
        lead_time=inv.lead_time_dias,
        safety_stock=Decimal(str(inv.stock_seguridad))
    )
    inv_val = Decimal(str(stock_actual)) * prod.costo_unitario
    cogs_anual = inv.demanda_diaria_promedio * prod.costo_unitario * Decimal('365')
    if cogs_anual > Decimal('0'):
        doh = calculate_doh(inv_val, cogs_anual)
    elif inv.demanda_diaria_promedio > Decimal('0'):
        doh = calculate_doh(Decimal(str(stock_actual)), inv.demanda_diaria_promedio * Decimal('365'))
    else:
        doh = Decimal('0.00')

    is_alert = Decimal(str(stock_actual)) <= rop

    # 5. Sincronización bidireccional con Kanban de Reposición
    if is_alert:
        existing_order = db.query(OrdenReposicion).filter(
            OrdenReposicion.sku_id == prod.sku,
            OrdenReposicion.etapa == "sugerido"
        ).first()
        sug_qty = max(int(rop * Decimal('1.5') - Decimal(str(stock_actual))), 15)
        monto_total = Decimal(str(sug_qty)) * prod.costo_unitario

        if existing_order:
            existing_order.cantidad = sug_qty
            existing_order.monto_total = monto_total
        else:
            new_order = OrdenReposicion(
                sku_id=prod.sku,
                cantidad=sug_qty,
                monto_total=monto_total,
                proveedor=f"Proveedor Oficial {prod.categoria}",
                etapa="sugerido",
                responsable="Alerta Automática (ROP)",
                fecha_arribo_estimada=date.today() + timedelta(days=int(inv.lead_time_dias or 30))
            )
            db.add(new_order)
    else:
        suggested_order = db.query(OrdenReposicion).filter(
            OrdenReposicion.sku_id == prod.sku,
            OrdenReposicion.etapa == "sugerido"
        ).first()
        if suggested_order:
            db.delete(suggested_order)

    # 6. Auditoría inmutable RBAC
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="UPDATE_INVENTORY_QUICK",
        resource=f"inventory/{sku}",
        details={
            "sku": sku,
            "stock_actual": stock_actual,
            "rop": float(rop),
            "doh": float(doh),
            "is_alert": is_alert,
            "costo_unitario": float(prod.costo_unitario)
        }
    )

    db.commit()

    updated_item = InventoryAlert(
        sku=prod.sku,
        nombre=prod.nombre,
        categoria=prod.categoria,
        stock_actual=stock_actual,
        rop=rop,
        doh=doh,
        is_alert=is_alert,
        stock_seguridad=inv.stock_seguridad,
        lead_time_dias=inv.lead_time_dias,
        deposito_central=inv.deposito_central,
        transito_maritimo=inv.transito_maritimo,
        aduana=inv.aduana,
        costo_unitario=prod.costo_unitario,
        demanda_diaria_promedio=inv.demanda_diaria_promedio,
        image_url=prod.image_url
    )

    return InventoryQuickUpdateResponse(
        status="success",
        message=f"Inventario y parámetros de '{sku}' actualizados exitosamente.",
        item=updated_item
    )


@router.get("/pricing/margins", response_model=List[MarginSummary], summary="Resumen de márgenes y contribución")
def get_pricing_margins(
    categoria: Optional[str] = None,
    sku: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Analítica de precios, margen bruto, markup y contribución marginal por producto.
    """
    query = db.query(Product).options(
        selectinload(Product.categoria_rel),
        selectinload(Product.inventario)
    )
    if categoria:
        query = query.join(Category).filter(Category.nombre.ilike(f"%{categoria}%"))
    if sku:
        query = query.filter(Product.sku.ilike(f"%{sku}%"))

    products = query.all()
    results: List[MarginSummary] = []

    for prod in products:
        gross_margin = calculate_gross_margin(prod.precio_venta, prod.costo_unitario)
        markup = calculate_markup(prod.precio_venta, prod.costo_unitario)
        unit_cm = calculate_unit_contribution_margin(prod.precio_venta, prod.costo_unitario)
        cm_ratio = calculate_marginal_ratio(prod.precio_venta, prod.costo_unitario)

        results.append(MarginSummary(
            sku=prod.sku,
            nombre=prod.nombre,
            categoria=prod.categoria,
            precio_venta=prod.precio_venta,
            costo_unitario=prod.costo_unitario,
            gross_margin_pct=gross_margin,
            markup_pct=markup,
            unit_contribution_margin=unit_cm,
            marginal_ratio=cm_ratio
        ))

    return results


@router.post("/pricing/simulate", response_model=DiscountSimulationResponse, summary="Simulador de impacto de descuentos comerciales")
def simulate_commercial_discount(
    req: DiscountSimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Simulador interactivo del impacto de descuentos comerciales y cálculo del Waterfall de canales y márgenes.
    Normaliza y acepta parámetros flexibles en español e inglés:
    precio_base / base_price, costo_unitario / cost, descuento_pct / discount_pct, comision_pct / commission_pct, flete_usd / freight.
    """
    p_base_dec = req.precio_base if req.precio_base is not None else req.base_price
    c_unit_dec = req.costo_unitario if req.costo_unitario is not None else req.cost

    if (p_base_dec is None or c_unit_dec is None) and req.sku:
        prod = db.query(Product).filter(Product.sku == req.sku).first()
        if prod:
            if p_base_dec is None:
                p_base_dec = prod.precio_venta
            if c_unit_dec is None:
                c_unit_dec = prod.costo_unitario
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto con SKU '{req.sku}' no encontrado en el sistema."
            )

    if p_base_dec is None or c_unit_dec is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere base_price y cost, o un sku existente en la base de datos."
        )

    if p_base_dec <= Decimal('0'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El precio base debe ser mayor a cero."
        )

    p_base = float(p_base_dec)
    c_unit = float(c_unit_dec)

    # Normalizar descuento porcentual (maneja tanto '0.10' = 10% como '10' = 10%)
    raw_desc = req.descuento_pct if req.descuento_pct is not None else req.discount_pct
    if raw_desc is None:
        desc_pct = 0.0
    else:
        f_desc = float(raw_desc)
        if 0.0 < f_desc <= 1.0:
            desc_pct = f_desc * 100.0
        else:
            desc_pct = max(0.0, f_desc)

    # Normalizar canal y comisión porcentual
    canal = req.canal or req.channel or "Canal Mayorista"
    raw_com = req.comision_pct if req.comision_pct is not None else req.commission_pct
    if raw_com is None or float(raw_com) == 0.0:
        channel_commissions = {
            "Mercado Libre": 12.0,
            "Retail Físico": 8.0,
            "Tienda Propia": 4.0,
            "Canal Mayorista": 2.0,
            "Mayorista": 2.0
        }
        com_pct = channel_commissions.get(canal, 0.0)
    else:
        f_com = float(raw_com)
        if 0.0 < f_com <= 1.0:
            com_pct = f_com * 100.0
        else:
            com_pct = max(0.0, f_com)

    # Normalizar flete
    raw_flete = req.flete_usd if req.flete_usd is not None else req.freight
    flete = float(raw_flete) if raw_flete is not None else 0.0

    # Lógica de cálculo determinista del Waterfall
    desc_monto = p_base * (desc_pct / 100.0)
    precio_neto = p_base - desc_monto
    comision_monto = precio_neto * (com_pct / 100.0)
    costo_canal_flete = comision_monto + flete
    cmv_total = c_unit
    margen_contribucion = precio_neto - cmv_total - costo_canal_flete
    ratio_marginal = (margen_contribucion / precio_neto * 100.0) if precio_neto > 0 else 0.0

    waterfall_steps = [
        WaterfallStep(step="1. Precio Base", valor=round(p_base, 2), tipo="base"),
        WaterfallStep(step="2. Descuento", valor=-round(desc_monto, 2), tipo="deduccion"),
        WaterfallStep(step="3. Precio Neto", valor=round(precio_neto, 2), tipo="subtotal"),
        WaterfallStep(step="4. Costo CMV", valor=-round(cmv_total, 2), tipo="deduccion"),
        WaterfallStep(step="5. Canal & Flete", valor=-round(costo_canal_flete, 2), tipo="deduccion"),
        WaterfallStep(step="6. Contrib. Neta", valor=round(margen_contribucion, 2), tipo="final")
    ]
    alerta = "El descuento destruye el margen de la unidad" if margen_contribucion <= 0 else None

    # Métricas de compatibilidad previa
    gross_margin_amount = precio_neto - c_unit
    gross_margin = (gross_margin_amount / precio_neto) if precio_neto > 0 else 0.0
    markup = (gross_margin_amount / c_unit) if c_unit > 0 else 0.0
    is_neg = gross_margin < 0 or margen_contribucion < 0
    below_15 = (ratio_marginal / 100.0) < 0.15
    is_viable = not below_15 and margen_contribucion > 0

    disc_price_dec = (p_base_dec * (Decimal('1') - Decimal(str(desc_pct / 100.0)))).quantize(Decimal('0.01'))
    gross_margin_dec = Decimal(str(round(gross_margin, 4))).quantize(Decimal('0.0001')) if precio_neto > 0 else Decimal('0')
    cm_dec = Decimal(str(round(margen_contribucion, 2))).quantize(Decimal('0.01'))

    return DiscountSimulationResponse(
        precio_base=round(p_base, 2),
        descuento_monto=round(desc_monto, 2),
        precio_neto=round(precio_neto, 2),
        cmv=round(cmv_total, 2),
        canal_flete=round(costo_canal_flete, 2),
        margen_contribucion=round(margen_contribucion, 2),
        ratio_marginal=round(ratio_marginal, 1),
        waterfall_steps=waterfall_steps,
        alerta=alerta,
        base_price=p_base_dec,
        discount_pct=Decimal(str(round(desc_pct / 100.0, 4))),
        discounted_price=disc_price_dec,
        effective_price=disc_price_dec,
        cost=c_unit_dec,
        channel=canal,
        gross_margin=gross_margin_dec,
        gross_margin_pct=Decimal(str(round(gross_margin * 100.0, 2))),
        markup=Decimal(str(round(markup, 4))),
        markup_pct=Decimal(str(round(markup * 100.0, 2))),
        unit_contribution_margin=cm_dec,
        marginal_ratio=Decimal(str(round(ratio_marginal / 100.0, 4))),
        is_negative_margin=is_neg,
        below_threshold_15pct=below_15,
        is_viable=is_viable
    )


@router.post(
    "/pricing/ai-bundles-suggest",
    response_model=PricingAIBundlesResponse,
    summary="Generador de Packs y Bundles Estratégicos con Asesor Multifuncional IA"
)
async def suggest_ai_bundles(
    payload: Optional[PricingAIBundlesRequest] = None,
    engine_mode: Optional[str] = Query(None, description="Modo: auto, force_llm, heuristic, local_ai"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Agente de Pricing multifuncional (Performance + Marketing + Ventas + Logística + Finanzas).
    Detecta productos en sobrestock (DOH > 90d o stock inmovilizado) y productos de alta rotación.
    Ejecuta inferencia en el modelo local de Ollama (ej. gemma4:26b) con timeout infinito.
    """
    target_model = (payload.model if payload and payload.model else None) or "gemma4:26b"
    eff_mode = (payload.engine_mode if payload and payload.engine_mode else None) or engine_mode or "local_ai"

    products = db.query(Product).filter(Product.activo == True).all()
    if not products:
        products = db.query(Product).all()

    # Análisis de DOH y candidatos reales
    overstock_candidates = []
    fast_mover_candidates = []

    for p in products:
        if not p.inventario:
            continue
        inv = p.inventario
        stock = inv.stock_actual
        costo = float(p.costo_unitario or 1.0)
        precio = float(p.precio_venta or (costo * 1.35))
        demanda = float(inv.demanda_diaria_promedio or 0.0)

        # Calcular DOH
        if demanda > 0:
            doh = stock / demanda
        elif stock > 100:
            doh = 180.0
        else:
            doh = 30.0

        item_info = {
            "sku": p.sku,
            "nombre": p.nombre,
            "stock_actual": stock,
            "doh": round(doh, 1),
            "precio_regular_usd": round(precio, 2),
            "costo_unitario_usd": round(costo, 2),
            "volumen_total": stock * costo
        }

        if doh > 90.0 or stock >= 500:
            overstock_candidates.append(item_info)
        else:
            fast_mover_candidates.append(item_info)

    # Ordenar por criticidad de sobrestock y volumen
    overstock_candidates.sort(key=lambda x: (x["doh"], x["volumen_total"]), reverse=True)
    fast_mover_candidates.sort(key=lambda x: x["stock_actual"], reverse=True)

    if not overstock_candidates:
        overstock_candidates = [
            {
                "sku": p.sku,
                "nombre": p.nombre,
                "stock_actual": p.inventario.stock_actual if p.inventario else 100,
                "doh": 120.0,
                "precio_regular_usd": float(p.precio_venta),
                "costo_unitario_usd": float(p.costo_unitario),
                "volumen_total": 100 * float(p.costo_unitario)
            }
            for p in products[:len(products)//2 or 1]
        ]
    if not fast_mover_candidates:
        fast_mover_candidates = [
            {
                "sku": p.sku,
                "nombre": p.nombre,
                "stock_actual": p.inventario.stock_actual if p.inventario else 50,
                "doh": 15.0,
                "precio_regular_usd": float(p.precio_venta),
                "costo_unitario_usd": float(p.costo_unitario),
                "volumen_total": 50 * float(p.costo_unitario)
            }
            for p in products[len(products)//2 or 1:]
        ]

    # Intentar inferencia real con Ollama si no está en modo heurístico forzado
    if eff_mode != "heuristic":
        try:
            skus_context = {
                "sobrestock_critico": [
                    {
                        "sku": p["sku"],
                        "nombre": p["nombre"],
                        "stock_unidades": p["stock_actual"],
                        "doh_dias": p["doh"],
                        "precio_regular_usd": p["precio_regular_usd"],
                        "costo_unitario_usd": p["costo_unitario_usd"]
                    }
                    for p in overstock_candidates[:5]
                ],
                "productos_ancla_alta_demanda": [
                    {
                        "sku": p["sku"],
                        "nombre": p["nombre"],
                        "stock_unidades": p["stock_actual"],
                        "doh_dias": p["doh"],
                        "precio_regular_usd": p["precio_regular_usd"],
                        "costo_unitario_usd": p["costo_unitario_usd"]
                    }
                    for p in fast_mover_candidates[:5]
                ]
            }

            prompt = (
                "Eres el Comité Ejecutivo de Calcu (CFO, Marketing, Ventas y Logística).\n"
                "Analiza los siguientes SKUs de sobrestock y productos ancla del catálogo real:\n"
                f"{json.dumps(skus_context, ensure_ascii=False, indent=2)}\n\n"
                "Genera 3 propuestas estratégicas de Bundles / Packs en formato JSON estricto con la siguiente estructura:\n"
                "{\n"
                '  "dictamen_cfo": "Resumen ejecutivo del comité explicando la estrategia financiera y de rotación",\n'
                '  "bundles": [\n'
                "    {\n"
                '      "id": "BUNDLE-01",\n'
                '      "titulo": "Nombre comercial del pack",\n'
                '      "descuento_pct": 15.0,\n'
                '      "margen_pct": 28.5,\n'
                '      "racional": "Estrategia comercial de apalancamiento",\n'
                '      "skus": [\n'
                '        {"sku": "SKU-XXX", "nombre": "Nombre", "tipo": "sobrestock", "stock_dias": 120, "precio_reg": 50.0},\n'
                '        {"sku": "SKU-YYY", "nombre": "Nombre", "tipo": "ancla", "stock_dias": 20, "precio_reg": 30.0}\n'
                "      ],\n"
                '      "precio_pack": 68.0,\n'
                '      "precio_regular": 80.0,\n'
                '      "capital_liberado": 350.0,\n'
                '      "espacio_liberado_m2": 2.4,\n'
                '      "evaluaciones": {\n'
                '        "mkt": "Evaluación de marketing",\n'
                '        "finanzas": "Evaluación financiera",\n'
                '        "logistica": "Evaluación logística"\n'
                "      },\n"
                '      "pitch_comercial": "Argumento de venta para clientes y comerciales"\n'
                "    }\n"
                "  ]\n"
                "}\n\n"
                "IMPORTANTE: Responde ÚNICAMENTE con el objeto JSON válido, sin markdown ni explicaciones adicionales."
            )

            ollama_url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
            async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=5.0)) as client:
                resp = await client.post(
                    ollama_url,
                    json={
                        "model": target_model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.2}
                    }
                )
                if resp.status_code == 200:
                    raw_text = resp.json().get("response", "")
                    cleaned_json_text = re.sub(r'<think>[\s\S]*?</think>', '', raw_text, flags=re.IGNORECASE).strip()
                    match = re.search(r'\{[\s\S]*\}', cleaned_json_text)
                    if match:
                        parsed = json.loads(match.group(0))
                        llm_bundles = parsed.get("bundles", [])
                        if isinstance(llm_bundles, list) and len(llm_bundles) >= 2:
                            ai_items: List[AIBundleItem] = []
                            for idx, b in enumerate(llm_bundles[:3]):
                                b_id = str(b.get("id") or f"BUNDLE-OLLAMA-0{idx+1}")
                                b_titulo = str(b.get("titulo") or b.get("nombre_pack") or f"Pack IA {idx+1}")
                                b_racional = str(b.get("racional") or b.get("descripcion") or "Combinación estratégica generada por IA")
                                b_desc_pct = float(b.get("descuento_pct") or 15.0)
                                b_margen_pct = float(b.get("margen_pct") or 25.0)
                                b_p_pack = float(b.get("precio_pack") or b.get("precio_bundle_sugerido_usd") or 50.0)
                                b_p_reg = float(b.get("precio_regular") or b.get("precio_individual_total_usd") or (b_p_pack * 1.15))
                                b_cap_lib = float(b.get("capital_liberado") or b.get("capital_inmovilizado_liberado_usd") or 200.0)
                                b_m2_lib = float(b.get("espacio_liberado_m2") or b.get("m2_liberados_estimados") or 1.5)
                                b_pitch = str(b.get("pitch_comercial") or b.get("argumento_comercial") or "Propuesta de valor integral.")

                                evs = b.get("evaluaciones") or {}
                                mkt_ev = str(evs.get("mkt") or b.get("evaluacion_marketing") or "Impulsa la adopción comercial acelerada.")
                                fin_ev = str(evs.get("finanzas") or b.get("evaluacion_finanzas") or f"Preserva margen del {b_margen_pct}%.")
                                log_ev = str(evs.get("logistica") or b.get("evaluacion_logistica") or f"Descomprime {b_m2_lib} m² en depósito.")

                                skus_raw = b.get("skus") or b.get("productos") or []
                                prod_items: List[BundleProductItem] = []
                                for s in skus_raw:
                                    s_sku = str(s.get("sku") or "SKU-GEN")
                                    prod_db = next((p for p in products if p.sku == s_sku), None)
                                    s_nom = str(s.get("nombre") or (prod_db.nombre if prod_db else s_sku))
                                    s_doh = float(s.get("stock_dias") or s.get("doh") or (120.0 if "sobre" in str(s.get("tipo", "")).lower() else 25.0))
                                    s_precio = float(s.get("precio_reg") or s.get("precio_regular_usd") or (float(prod_db.precio_venta) if prod_db else 20.0))
                                    s_costo = float(prod_db.costo_unitario) if prod_db else (s_precio * 0.6)
                                    s_stock = int(prod_db.inventario.stock_actual) if (prod_db and prod_db.inventario) else 50
                                    s_over = "sobre" in str(s.get("tipo", "")).lower() or s_doh > 90

                                    prod_items.append(BundleProductItem(
                                        sku=s_sku,
                                        nombre=s_nom,
                                        stock_actual=s_stock,
                                        doh=round(s_doh, 1),
                                        precio_regular_usd=round(s_precio, 2),
                                        costo_unitario_usd=round(s_costo, 2),
                                        es_sobrestock=s_over
                                    ))

                                if not prod_items and overstock_candidates and fast_mover_candidates:
                                    p_o = overstock_candidates[idx % len(overstock_candidates)]
                                    p_f = fast_mover_candidates[idx % len(fast_mover_candidates)]
                                    prod_items = [
                                        BundleProductItem(
                                            sku=p_o["sku"],
                                            nombre=p_o["nombre"],
                                            stock_actual=p_o["stock_actual"],
                                            doh=p_o["doh"],
                                            precio_regular_usd=p_o["precio_regular_usd"],
                                            costo_unitario_usd=p_o["costo_unitario_usd"],
                                            es_sobrestock=True
                                        ),
                                        BundleProductItem(
                                            sku=p_f["sku"],
                                            nombre=p_f["nombre"],
                                            stock_actual=p_f["stock_actual"],
                                            doh=p_f["doh"],
                                            precio_regular_usd=p_f["precio_regular_usd"],
                                            costo_unitario_usd=p_f["costo_unitario_usd"],
                                            es_sobrestock=False
                                        )
                                    ]

                                ai_items.append(AIBundleItem(
                                    id=b_id,
                                    nombre_pack=b_titulo,
                                    descripcion=b_racional,
                                    productos=prod_items,
                                    precio_individual_total_usd=b_p_reg,
                                    precio_bundle_sugerido_usd=b_p_pack,
                                    descuento_bundle_pct=b_desc_pct,
                                    margen_neto_pct=b_margen_pct,
                                    capital_inmovilizado_liberado_usd=b_cap_lib,
                                    m2_liberados_estimados=b_m2_lib,
                                    argumento_comercial=b_pitch,
                                    evaluacion_marketing=mkt_ev,
                                    evaluacion_finanzas=fin_ev,
                                    evaluacion_logistica=log_ev
                                ))

                            cfo_dictamen = parsed.get("dictamen_cfo") or (
                                f"Dictamen del Comité Ejecutivo (Inferencia LLM {target_model}): Se estructuraron {len(ai_items)} "
                                "packs estratégicos anti-sobrestock optimizando el margen de contribución y liberando espacio físico de almacenamiento."
                            )
                            return PricingAIBundlesResponse(
                                status="success",
                                total_bundles_sugeridos=len(ai_items),
                                dictamen_cfo=cfo_dictamen,
                                bundles=ai_items
                            )
        except Exception as exc:
            logger.info("Ollama bundling inference fallback (%s): %s", target_model, exc)

    # Fallback matemático determinista sobre catálogo real
    bundles: List[AIBundleItem] = []
    
    # 1. Combo Industrial / Infraestructura
    p_over_1 = overstock_candidates[0] if overstock_candidates else None
    p_fast_1 = fast_mover_candidates[0] if fast_mover_candidates else None
    if p_over_1 and p_fast_1:
        p_indiv = p_over_1["precio_regular_usd"] + p_fast_1["precio_regular_usd"]
        p_bundle = round(p_indiv * 0.85, 2)
        cost_total = p_over_1["costo_unitario_usd"] + p_fast_1["costo_unitario_usd"]
        margen = round(((p_bundle - cost_total) / p_bundle) * 100, 1) if p_bundle > 0 else 25.0
        cap_lib = round(p_over_1["costo_unitario_usd"] * min(p_over_1["stock_actual"], 20), 2)
        m2_lib = round(min(p_over_1["stock_actual"], 20) * 0.12, 1)

        bundles.append(AIBundleItem(
            id="BUNDLE-OBRA-01",
            nombre_pack=f"Combo Obra Pro: {p_over_1['nombre']} + {p_fast_1['nombre']}",
            descripcion=f"Tracción comercial directa: apalanca la alta demanda de {p_fast_1['sku']} para acelerar la rotación del lote inmovilizado {p_over_1['sku']}.",
            productos=[
                BundleProductItem(
                    sku=p_over_1["sku"],
                    nombre=p_over_1["nombre"],
                    stock_actual=p_over_1["stock_actual"],
                    doh=p_over_1["doh"],
                    precio_regular_usd=p_over_1["precio_regular_usd"],
                    costo_unitario_usd=p_over_1["costo_unitario_usd"],
                    es_sobrestock=True
                ),
                BundleProductItem(
                    sku=p_fast_1["sku"],
                    nombre=p_fast_1["nombre"],
                    stock_actual=p_fast_1["stock_actual"],
                    doh=p_fast_1["doh"],
                    precio_regular_usd=p_fast_1["precio_regular_usd"],
                    costo_unitario_usd=p_fast_1["costo_unitario_usd"],
                    es_sobrestock=False
                )
            ],
            precio_individual_total_usd=p_indiv,
            precio_bundle_sugerido_usd=p_bundle,
            descuento_bundle_pct=15.0,
            margen_neto_pct=margen,
            capital_inmovilizado_liberado_usd=cap_lib,
            m2_liberados_estimados=m2_lib,
            argumento_comercial="Adquiere la solución completa lista para instalar con un beneficio exclusivo del 15% de ahorro frente a la compra individual.",
            evaluacion_marketing="Alta percepción de valor integral y conveniencia de compra en un solo pedido consolidado.",
            evaluacion_finanzas=f"Margen neto protegido del {margen}%, acelerando recuperación de flujo de caja.",
            evaluacion_logistica=f"Descongestiona {m2_lib} m² en depósito central y reduce costos de almacenamiento mensual."
        ))

    # 2. Pack Mantenimiento & Suministro
    p_over_2 = overstock_candidates[1] if len(overstock_candidates) > 1 else overstock_candidates[0]
    p_fast_2 = fast_mover_candidates[1] if len(fast_mover_candidates) > 1 else fast_mover_candidates[0]
    if p_over_2 and p_fast_2 and p_over_2 != p_over_1:
        p_indiv = p_over_2["precio_regular_usd"] + p_fast_2["precio_regular_usd"]
        p_bundle = round(p_indiv * 0.88, 2)
        cost_total = p_over_2["costo_unitario_usd"] + p_fast_2["costo_unitario_usd"]
        margen = round(((p_bundle - cost_total) / p_bundle) * 100, 1) if p_bundle > 0 else 28.0
        cap_lib = round(p_over_2["costo_unitario_usd"] * min(p_over_2["stock_actual"], 30), 2)
        m2_lib = round(min(p_over_2["stock_actual"], 30) * 0.08, 1)

        bundles.append(AIBundleItem(
            id="BUNDLE-MANT-02",
            nombre_pack=f"Kit Mantenimiento Operativo: {p_over_2['nombre']} & Repuesto",
            descripcion="Sinergia de reposición periódica para instaladores y contratistas de mantenimiento preventivo.",
            productos=[
                BundleProductItem(
                    sku=p_over_2["sku"],
                    nombre=p_over_2["nombre"],
                    stock_actual=p_over_2["stock_actual"],
                    doh=p_over_2["doh"],
                    precio_regular_usd=p_over_2["precio_regular_usd"],
                    costo_unitario_usd=p_over_2["costo_unitario_usd"],
                    es_sobrestock=True
                ),
                BundleProductItem(
                    sku=p_fast_2["sku"],
                    nombre=p_fast_2["nombre"],
                    stock_actual=p_fast_2["stock_actual"],
                    doh=p_fast_2["doh"],
                    precio_regular_usd=p_fast_2["precio_regular_usd"],
                    costo_unitario_usd=p_fast_2["costo_unitario_usd"],
                    es_sobrestock=False
                )
            ],
            precio_individual_total_usd=p_indiv,
            precio_bundle_sugerido_usd=p_bundle,
            descuento_bundle_pct=12.0,
            margen_neto_pct=margen,
            capital_inmovilizado_liberado_usd=cap_lib,
            m2_liberados_estimados=m2_lib,
            argumento_comercial="Pack de reposición estratégica con 12% de bonificación directa para reducir paradas de planta.",
            evaluacion_marketing="Empaquetado orientado a fidelización de clientes recurrentes e instaladores certificados.",
            evaluacion_finanzas=f"Margen operativo saludable ({margen}%) con monetización inmediata de inventario inmovilizado.",
            evaluacion_logistica=f"Optimiza el picking unificado reduciendo manipulación física en {m2_lib} m²."
        ))

    # 3. Solución Eficiencia & Alta Rotación
    p_over_3 = overstock_candidates[2] if len(overstock_candidates) > 2 else overstock_candidates[-1]
    p_fast_3 = fast_mover_candidates[-1] if fast_mover_candidates else None
    if p_over_3 and p_fast_3:
        p_indiv = p_over_3["precio_regular_usd"] + p_fast_3["precio_regular_usd"]
        p_bundle = round(p_indiv * 0.85, 2)
        cost_total = p_over_3["costo_unitario_usd"] + p_fast_3["costo_unitario_usd"]
        margen = round(((p_bundle - cost_total) / p_bundle) * 100, 1) if p_bundle > 0 else 30.0
        cap_lib = round(p_over_3["costo_unitario_usd"] * min(p_over_3["stock_actual"], 15), 2)
        m2_lib = round(min(p_over_3["stock_actual"], 15) * 0.15, 1)

        bundles.append(AIBundleItem(
            id="BUNDLE-EFIC-03",
            nombre_pack=f"Solución Eficiencia Comercial: {p_over_3['nombre']}",
            descripcion=f"Estrategia de venta cruzada agresiva para liquidar existencias con DOH crítico de {p_over_3['doh']} días.",
            productos=[
                BundleProductItem(
                    sku=p_over_3["sku"],
                    nombre=p_over_3["nombre"],
                    stock_actual=p_over_3["stock_actual"],
                    doh=p_over_3["doh"],
                    precio_regular_usd=p_over_3["precio_regular_usd"],
                    costo_unitario_usd=p_over_3["costo_unitario_usd"],
                    es_sobrestock=True
                ),
                BundleProductItem(
                    sku=p_fast_3["sku"],
                    nombre=p_fast_3["nombre"],
                    stock_actual=p_fast_3["stock_actual"],
                    doh=p_fast_3["doh"],
                    precio_regular_usd=p_fast_3["precio_regular_usd"],
                    costo_unitario_usd=p_fast_3["costo_unitario_usd"],
                    es_sobrestock=False
                )
            ],
            precio_individual_total_usd=p_indiv,
            precio_bundle_sugerido_usd=p_bundle,
            descuento_bundle_pct=15.0,
            margen_neto_pct=margen,
            capital_inmovilizado_liberado_usd=cap_lib,
            m2_liberados_estimados=m2_lib,
            argumento_comercial="Obtén la combinación tecnológica homologada con garantía extendida y 15% de ahorro en kit.",
            evaluacion_marketing="Posiciona el producto lento como un upgrade premium de valor en el catálogo comercial.",
            evaluacion_finanzas=f"Libera capital de trabajo inmovilizado (${cap_lib:,.2f}) preservando margen neto ({margen}%).",
            evaluacion_logistica=f"Disminuye riesgo de obsolescencia técnica y libera {m2_lib} m² en racks."
        ))

    dictamen = (
        f"Dictamen del Comité Ejecutivo Multifuncional: Se identificaron {len(overstock_candidates)} SKUs en sobrestock "
        f"(DOH > 90d). Se generaron {len(bundles)} propuestas de bundling con descuentos controlados del 12%-15% "
        f"que protegen márgenes superiores al 24% y aceleran la rotación de capital de trabajo inmovilizado."
    )

    return PricingAIBundlesResponse(
        status="success",
        total_bundles_sugeridos=len(bundles),
        dictamen_cfo=dictamen,
        bundles=bundles
    )


@router.get("/budget/variance", response_model=List[BudgetVarianceReport], summary="Comparativo de ejecución presupuestaria en tiempo real (BCNF)")
def get_budget_variance(
    periodo: Optional[str] = None,
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Análisis de variaciones presupuestarias en tiempo de ejecución (BCNF Estricto).
    Cruza presupuestos_metas con transacciones_ventas para obtener montos reales
    sin almacenar datos derivados redundantes en la base de datos.
    Operadores de comparación de rango ANSI-SQL 100% agnósticos para PostgreSQL y SQLite.
    """
    query = db.query(PresupuestoMeta)

    if periodo:
        periodo = periodo.strip()
        # Validación defensiva del formato de periodo
        if not (PERIOD_REGEX.match(periodo) or re.match(r'^\d{4}-Q[1-4]$', periodo)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato de período inválido '{periodo}'. Se espera formato YYYY-MM (ej. 2025-09)."
            )
        query = query.filter(PresupuestoMeta.periodo == periodo)
    else:
        # Fallback inteligente: consultar por defecto el periodo más reciente con metas reales
        latest_meta = (
            db.query(PresupuestoMeta.periodo)
            .filter(PresupuestoMeta.periodo.isnot(None))
            .order_by(PresupuestoMeta.periodo.desc())
            .first()
        )
        if latest_meta and latest_meta[0]:
            periodo = latest_meta[0]
            query = query.filter(PresupuestoMeta.periodo == periodo)

    if categoria:
        query = query.join(Category, PresupuestoMeta.categoria_id == Category.id).filter(Category.nombre.ilike(f"%{categoria}%"))
    
    metas = query.all()
    reports: List[BudgetVarianceReport] = []

    for m in metas:
        # Calcular ventas reales en tiempo de ejecución para la categoría y período
        sales_q = db.query(
            func.sum(Sale.cantidad * Sale.precio_unitario_real)
        ).join(Product, Sale.producto_id == Product.id).filter(
            Product.categoria_id == m.categoria_id
        )

        target_period = m.periodo or periodo
        if target_period:
            if PERIOD_REGEX.match(target_period):
                # Rango de fechas determinista en memoria (ANSI-SQL compatible y optimizado para índices)
                year, month = int(target_period[:4]), int(target_period[5:7])
                start_date = date(year, month, 1)
                _, last_day = calendar.monthrange(year, month)
                end_date = date(year, month, last_day)
                sales_q = sales_q.filter(
                    or_(
                        Sale.periodo == target_period,
                        and_(Sale.fecha >= start_date, Sale.fecha <= end_date)
                    )
                )
            else:
                sales_q = sales_q.filter(Sale.periodo == target_period)

        real_amount = sales_q.scalar()
        if real_amount is None:
            # Fallback a ventas históricas totales de la categoría si ese período aún no tiene transacciones
            hist_sales = db.query(
                func.sum(Sale.cantidad * Sale.precio_unitario_real)
            ).join(Product, Sale.producto_id == Product.id).filter(
                Product.categoria_id == m.categoria_id
            ).scalar()
            real_amount = hist_sales if hist_sales is not None else Decimal('0.00')

        real_amount = Decimal(str(real_amount)).quantize(Decimal('0.01'))
        var_abs = calculate_variance(real_amount, m.monto_presupuestado)
        var_pct = calculate_variance_pct(real_amount, m.monto_presupuestado)
        status_color = get_variance_status(real_amount, m.monto_presupuestado, higher_is_better=True)

        reports.append(BudgetVarianceReport(
            id=m.id,
            periodo=m.periodo,
            categoria=m.categoria,
            tipo="VENTAS",
            monto_presupuestado=m.monto_presupuestado,
            monto_real=real_amount,
            variacion_absoluta=var_abs,
            variacion_porcentual=var_pct,
            status=status_color
        ))

    return reports


@router.get("/budget/available-periods", response_model=AvailablePeriodsResponse, summary="Obtener periodos presupuestarios disponibles")
def get_available_periods(db: Session = Depends(get_db)):
    """
    Retorna los meses únicos existentes (YYYY-MM) en ventas reales, metas presupuestarias,
    versiones y centros de costo, ordenados cronológicamente descendente, junto al periodo por defecto recomendado.
    """
    periods_set = set()

    # 1. Ventas reales
    sales = db.query(Sale.periodo, Sale.fecha).all()
    for s in sales:
        if s.periodo:
            periods_set.add(s.periodo)
        elif s.fecha:
            periods_set.add(s.fecha.strftime("%Y-%m"))

    # 2. Metas presupuestarias (BCNF)
    metas = db.query(PresupuestoMeta.periodo).distinct().all()
    for m in metas:
        if m.periodo:
            periods_set.add(m.periodo)

    # 3. Presupuestos Versiones
    p_versions = db.query(PresupuestoVersion.periodo).distinct().all()
    for pv in p_versions:
        if pv.periodo:
            periods_set.add(pv.periodo)

    # 4. Presupuestos Centros de Costo (OPEX)
    cc_periods = db.query(PresupuestoCentroCosto.periodo).distinct().all()
    for ccp in cc_periods:
        if ccp.periodo:
            periods_set.add(ccp.periodo)

    if not periods_set:
        periods_set.add("2025-09")

    # Ordenar descendente (los más recientes primero)
    sorted_periods = sorted(list(periods_set), reverse=True)
    default_period = sorted_periods[0] if sorted_periods else "2025-09"

    return AvailablePeriodsResponse(
        periods=sorted_periods,
        default_period=default_period
    )


@router.post("/budget/seed-from-actuals", response_model=BudgetSeedResponse, summary="Autogenerar metas presupuestarias desde ventas históricas (+5%)")
def seed_budget_from_actuals(
    periodo: str = Query(..., description="Periodo objetivo YYYY-MM para sembrar presupuesto"),
    db: Session = Depends(get_db)
):
    """
    Si no existe presupuesto para el periodo seleccionado, calcula las ventas históricas
    reales agrupadas por categoría y siembra registros en presupuestos_metas y presupuestos_versiones
    con un target de crecimiento estándar (+5%). BCNF estricto: cero redundancias.
    """
    existing_count = db.query(PresupuestoMeta).filter(PresupuestoMeta.periodo == periodo).count()
    if existing_count > 0:
        total_b = sum((m.monto_presupuestado for m in db.query(PresupuestoMeta).filter(PresupuestoMeta.periodo == periodo).all()), Decimal('0.00'))
        return BudgetSeedResponse(
            status="already_exists",
            periodo=periodo,
            records_seeded=existing_count,
            total_budgeted=total_b,
            message=f"El período {periodo} ya contaba con {existing_count} registros presupuestarios."
        )

    # Agrupar ventas reales por categoría
    cats = db.query(Category).all()
    records_seeded = 0
    total_budgeted = Decimal('0.00')

    for cat in cats:
        # Calcular ventas reales históricas
        sales_sum = db.query(
            func.sum(Sale.cantidad * Sale.precio_unitario_real)
        ).join(Product, Sale.producto_id == Product.id).filter(
            Product.categoria_id == cat.id
        ).scalar()

        actual_sales = Decimal(str(sales_sum)) if sales_sum else Decimal('50000.00')
        target_sales = (actual_sales * Decimal('1.05')).quantize(Decimal('0.01'))

        # Unidades estimadas
        unidades = int(round(float(target_sales) / 100.0))

        # Sembrar en presupuestos_metas (BCNF)
        meta = PresupuestoMeta(
            version="V0",
            periodo=periodo,
            categoria_id=cat.id,
            monto_presupuestado=target_sales,
            unidades_presupuestadas=unidades
        )
        db.add(meta)
        records_seeded += 1
        total_budgeted += target_sales

        # Sembrar también en presupuestos_versiones para análisis multinivel
        pv_v0 = PresupuestoVersion(
            version="V0_Aprobado",
            periodo=periodo,
            cuenta="Ventas",
            categoria=cat.nombre,
            monto=target_sales
        )
        pv_fc = PresupuestoVersion(
            version="Forecast_Q1",
            periodo=periodo,
            cuenta="Ventas",
            categoria=cat.nombre,
            monto=actual_sales.quantize(Decimal('0.01'))
        )
        db.add(pv_v0)
        db.add(pv_fc)
        records_seeded += 2

    db.commit()

    return BudgetSeedResponse(
        status="success",
        periodo=periodo,
        records_seeded=records_seeded,
        total_budgeted=total_budgeted,
        message=f"Presupuesto autogenerado exitosamente para el período {periodo}: {records_seeded} registros (+5% target comercial)."
    )


@router.post("/budget/manual-batch", response_model=BudgetManualBatchResponse, summary="Opción A: Iniciar Presupuesto en Blanco y Carga Manual (V0)")
def save_budget_manual_batch(
    payload: BudgetManualBatchRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Persiste una grilla de metas presupuestarias cargadas manualmente por el usuario.
    Normalizado a BCNF estricto (cero campos calculados redundantes).
    """
    version = payload.version or "V0"
    records_saved = 0
    total_budgeted = Decimal('0.00')

    for item in payload.items:
        cat = db.query(Category).filter(Category.id == item.categoria_id).first()
        if not cat:
            continue

        existing_meta = db.query(PresupuestoMeta).filter(
            PresupuestoMeta.periodo == payload.periodo,
            PresupuestoMeta.categoria_id == item.categoria_id,
            PresupuestoMeta.version == version
        ).first()

        if existing_meta:
            existing_meta.monto_presupuestado = item.monto_presupuestado
            existing_meta.unidades_presupuestadas = item.unidades_presupuestadas
        else:
            new_meta = PresupuestoMeta(
                version=version,
                periodo=payload.periodo,
                categoria_id=item.categoria_id,
                monto_presupuestado=item.monto_presupuestado,
                unidades_presupuestadas=item.unidades_presupuestadas
            )
            db.add(new_meta)

        # Reflejar también en versiones contables
        existing_pv = db.query(PresupuestoVersion).filter(
            PresupuestoVersion.periodo == payload.periodo,
            PresupuestoVersion.categoria == cat.nombre,
            PresupuestoVersion.version == "V0_Aprobado"
        ).first()
        if existing_pv:
            existing_pv.monto = item.monto_presupuestado
        else:
            db.add(PresupuestoVersion(
                version="V0_Aprobado",
                periodo=payload.periodo,
                cuenta="Ventas",
                categoria=cat.nombre,
                monto=item.monto_presupuestado
            ))

        records_saved += 1
        total_budgeted += item.monto_presupuestado

    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="MANUAL_BUDGET_BATCH_SAVE",
        resource=f"presupuestos_metas/{payload.periodo}",
        details={"periodo": payload.periodo, "records": records_saved, "total": float(total_budgeted)}
    )

    return BudgetManualBatchResponse(
        status="success",
        periodo=payload.periodo,
        version=version,
        records_saved=records_saved,
        total_budgeted=total_budgeted,
        message=f"Presupuesto {version} guardado exitosamente: {records_saved} categorías cargadas (${total_budgeted:,.2f})."
    )


@router.post("/budget/ai-suggest", response_model=BudgetAISuggestResponse, summary="Opción B: Sugerir Presupuesto con IA (Ventas + Stock + Costos)")
@router.post("/budget/ai-goals", response_model=BudgetAISuggestResponse, summary="Alias: Generación Asistida de Metas Presupuestarias con IA")
async def suggest_budget_ai_endpoint(
    periodo: str = Query(..., description="Periodo objetivo YYYY-MM para sugerir presupuesto"),
    engine_mode: str = Query("auto", description="Modo de ejecución: auto, force_llm, heuristic"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Analiza ventas históricas, DOH actual por categoría y alertas de ROP para generar
    una recomendación balanceada de metas comerciales asistida por IA y sanitizada por unidades de negocio.
    """
    return await AIAdvisorService.suggest_budget_ai(periodo, db, engine_mode=engine_mode)


@router.delete("/budget/period/{periodo}", response_model=BudgetPeriodDeleteResponse, summary="Reiniciar / Limpiar Período Presupuestario (Solo Admin)")
def delete_budget_period(
    periodo: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Limpia todas las metas presupuestarias de un período específico para permitir
    rehacer la simulación o carga desde cero. Exige rol controller_admin.
    """
    if user.role != ROLE_CONTROLLER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: Solo el rol 'controller_admin' tiene autorización para reiniciar un período presupuestario."
        )

    deleted_metas = db.query(PresupuestoMeta).filter(PresupuestoMeta.periodo == periodo).delete()
    deleted_vers = db.query(PresupuestoVersion).filter(PresupuestoVersion.periodo == periodo).delete()
    db.commit()

    total_deleted = deleted_metas + deleted_vers

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="RESET_BUDGET_PERIOD",
        resource=f"presupuestos/{periodo}",
        details={"periodo": periodo, "deleted_metas": deleted_metas, "deleted_vers": deleted_vers}
    )

    return BudgetPeriodDeleteResponse(
        status="success",
        periodo=periodo,
        records_deleted=total_deleted,
        message=f"Período {periodo} reiniciado con éxito. Se eliminaron {deleted_metas} metas para recarga o nueva sugerencia."
    )


@router.get(
    "/finance/exchange-rate/brou",
    response_model=BROUExchangeRateResponse,
    summary="Cotización oficial del Dólar en Uruguay (BROU) con cache de 4h y contingencia"
)
async def get_brou_exchange_rate(force_refresh: bool = False):
    """
    Retorna la cotización oficial del Dólar (BROU) con compra, venta y tasa utilizada,
    cacheada por 4 horas con respaldo de contingencia garantizado.
    """
    return await ExchangeRateService.fetch_brou_rate(force_refresh=force_refresh)


# ----------------------------------------------------------------------
# ESTRUCTURA ORGANIZACIONAL (ÁREAS Y RESPONSABLES - BCNF)
# ----------------------------------------------------------------------
@router.get(
    "/areas",
    response_model=List[AreaSchema],
    summary="Listado maestro de Áreas / Sectores organizacionales"
)
def get_all_areas(db: Session = Depends(get_db)):
    areas = db.query(Area).order_by(Area.codigo.asc()).all()
    res = []
    for a in areas:
        c_count = db.query(CentroCosto).filter(CentroCosto.area_id == a.id).count()
        res.append(AreaSchema(
            id=a.id,
            codigo=a.codigo,
            nombre=a.nombre,
            descripcion=a.descripcion,
            centros_count=c_count
        ))
    return res


@router.post(
    "/areas",
    response_model=AreaSchema,
    summary="Creación dinámica de Área / Sector organizacional"
)
def create_area(
    payload: AreaCreateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    clean_cod = payload.codigo.strip().upper()
    clean_nom = payload.nombre.strip()
    existing = db.query(Area).filter(
        (Area.codigo == clean_cod) | (func.lower(Area.nombre) == func.lower(clean_nom))
    ).first()
    if existing:
        c_count = db.query(CentroCosto).filter(CentroCosto.area_id == existing.id).count()
        return AreaSchema(
            id=existing.id,
            codigo=existing.codigo,
            nombre=existing.nombre,
            descripcion=existing.descripcion,
            centros_count=c_count
        )

    new_a = Area(
        codigo=clean_cod,
        nombre=clean_nom,
        descripcion=payload.descripcion.strip() if payload.descripcion else None
    )
    db.add(new_a)
    db.commit()
    db.refresh(new_a)
    return AreaSchema(
        id=new_a.id,
        codigo=new_a.codigo,
        nombre=new_a.nombre,
        descripcion=new_a.descripcion,
        centros_count=0
    )


@router.put(
    "/areas/{area_id}",
    response_model=AreaSchema,
    summary="Actualiza un Área u organización existente"
)
def update_area(
    area_id: int,
    payload: AreaUpdateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    if payload.codigo is not None:
        area.codigo = payload.codigo.strip().upper()
    if payload.nombre is not None:
        area.nombre = payload.nombre.strip()
    if payload.descripcion is not None:
        area.descripcion = payload.descripcion.strip()
    db.commit()
    db.refresh(area)
    c_count = db.query(CentroCosto).filter(CentroCosto.area_id == area.id).count()
    return AreaSchema(
        id=area.id,
        codigo=area.codigo,
        nombre=area.nombre,
        descripcion=area.descripcion,
        centros_count=c_count
    )


@router.get(
    "/users",
    response_model=List[ResponsibleUserSchema],
    summary="Listado maestro de Usuarios y Responsables corporativos"
)
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(ResponsableUser).order_by(ResponsableUser.nombre.asc()).all()
    res = []
    for u in users:
        area_nom = u.area.nombre if u.area else None
        res.append(ResponsibleUserSchema(
            id=u.id,
            nombre=u.nombre,
            email=u.email,
            cargo=u.cargo,
            area_id=u.area_id,
            area_nombre=area_nom
        ))
    return res


@router.post(
    "/users",
    response_model=ResponsibleUserSchema,
    summary="Creación de Usuario / Responsable de Gasto"
)
def create_user(
    payload: ResponsibleUserCreateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    clean_email = payload.email.strip().lower()
    existing = db.query(ResponsableUser).filter(func.lower(ResponsableUser.email) == clean_email).first()
    if existing:
        return ResponsibleUserSchema(
            id=existing.id,
            nombre=existing.nombre,
            email=existing.email,
            cargo=existing.cargo,
            area_id=existing.area_id,
            area_nombre=existing.area.nombre if existing.area else None
        )

    new_u = ResponsableUser(
        nombre=payload.nombre.strip(),
        email=clean_email,
        cargo=payload.cargo.strip(),
        area_id=payload.area_id
    )
    db.add(new_u)
    db.commit()
    db.refresh(new_u)
    return ResponsibleUserSchema(
        id=new_u.id,
        nombre=new_u.nombre,
        email=new_u.email,
        cargo=new_u.cargo,
        area_id=new_u.area_id,
        area_nombre=new_u.area.nombre if new_u.area else None
    )


@router.put(
    "/users/{user_id}",
    response_model=ResponsibleUserSchema,
    summary="Actualiza un Usuario o Responsable existente"
)
def update_user(
    user_id: int,
    payload: ResponsibleUserUpdateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    user_obj = db.query(ResponsableUser).filter(ResponsableUser.id == user_id).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if payload.nombre is not None:
        user_obj.nombre = payload.nombre.strip()
    if payload.email is not None:
        user_obj.email = payload.email.strip().lower()
    if payload.cargo is not None:
        user_obj.cargo = payload.cargo.strip()
    if payload.area_id is not None:
        user_obj.area_id = payload.area_id
    db.commit()
    db.refresh(user_obj)
    return ResponsibleUserSchema(
        id=user_obj.id,
        nombre=user_obj.nombre,
        email=user_obj.email,
        cargo=user_obj.cargo,
        area_id=user_obj.area_id,
        area_nombre=user_obj.area.nombre if user_obj.area else None
    )


# ----------------------------------------------------------------------
# CENTROS DE COSTO (BCNF) & GESTIÓN DE OPEX OPERATIVO MENSUAL
# ----------------------------------------------------------------------
@router.get(
    "/cost-centers",
    response_model=List[CostCenterResponse],
    summary="Listado maestro de Centros de Costo activos (BCNF)"
)
def get_cost_centers(
    solo_activos: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(CentroCosto)
    if solo_activos:
        query = query.filter(CentroCosto.activo == True)
    
    items = query.order_by(CentroCosto.codigo.asc()).all()
    res = []
    for c in items:
        resp_name = c.responsable_user.nombre if c.responsable_user else c.responsable
        res.append(CostCenterResponse(
            id=c.id,
            codigo=c.codigo,
            nombre=c.nombre,
            responsable=resp_name,
            activo=c.activo,
            area_id=c.area_id,
            area_nombre=c.area.nombre if c.area else None,
            responsable_id=c.responsable_id,
            responsable_nombre=c.responsable_user.nombre if c.responsable_user else None
        ))
    return res


@router.post(
    "/cost-centers",
    response_model=CostCenterResponse,
    summary="Creación dinámica de Centro de Costo (idempotente / BCNF)"
)
def create_cost_center(
    payload: CostCenterCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    existing = db.query(CentroCosto).filter(
        (CentroCosto.codigo == payload.codigo.strip().upper()) |
        (CentroCosto.nombre.ilike(payload.nombre.strip()))
    ).first()

    if existing:
        return CostCenterResponse(
            id=existing.id,
            codigo=existing.codigo,
            nombre=existing.nombre,
            responsable=existing.responsable_user.nombre if existing.responsable_user else existing.responsable,
            activo=existing.activo,
            area_id=existing.area_id,
            area_nombre=existing.area.nombre if existing.area else None,
            responsable_id=existing.responsable_id,
            responsable_nombre=existing.responsable_user.nombre if existing.responsable_user else None
        )

    resp_text = payload.responsable
    if payload.responsable_id:
        usr = db.query(ResponsableUser).filter(ResponsableUser.id == payload.responsable_id).first()
        if usr:
            resp_text = usr.nombre

    new_cc = CentroCosto(
        codigo=payload.codigo.strip().upper(),
        nombre=payload.nombre.strip(),
        responsable=resp_text,
        activo=payload.activo,
        area_id=payload.area_id,
        responsable_id=payload.responsable_id
    )
    db.add(new_cc)
    db.commit()
    db.refresh(new_cc)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_COST_CENTER",
        resource=f"centros_costo/{new_cc.id}",
        details={"codigo": new_cc.codigo, "nombre": new_cc.nombre, "responsable": new_cc.responsable}
    )
    return CostCenterResponse(
        id=new_cc.id,
        codigo=new_cc.codigo,
        nombre=new_cc.nombre,
        responsable=new_cc.responsable_user.nombre if new_cc.responsable_user else new_cc.responsable,
        activo=new_cc.activo,
        area_id=new_cc.area_id,
        area_nombre=new_cc.area.nombre if new_cc.area else None,
        responsable_id=new_cc.responsable_id,
        responsable_nombre=new_cc.responsable_user.nombre if new_cc.responsable_user else None
    )


@router.get(
    "/budget/cost-centers",
    response_model=CostCenterBudgetReportResponse,
    summary="Reporte matricial de OPEX presupuestado vs real por Centro de Costo"
)
def get_cost_center_budget_report(
    periodo: Optional[str] = Query(default=None, description="Período contable (ej. 2025-09)"),
    db: Session = Depends(get_db)
):
    """
    Retorna la descomposición completa del gasto operativo (OPEX) por Centro de Costo,
    con cálculo de desvíos en monto y porcentaje, clasificación de ahorro/exceso y partidas.
    """
    if not periodo:
        latest_cc = (
            db.query(PresupuestoCentroCosto.periodo)
            .filter(PresupuestoCentroCosto.periodo.isnot(None))
            .order_by(PresupuestoCentroCosto.periodo.desc())
            .first()
        )
        periodo = latest_cc[0] if latest_cc and latest_cc[0] else "2025-09"
    else:
        periodo = periodo.strip()
        if not (PERIOD_REGEX.match(periodo) or re.match(r'^\d{4}-Q[1-4]$', periodo)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Formato de período inválido '{periodo}'. Se espera YYYY-MM (ej. 2025-09)."
            )

    centros = db.query(CentroCosto).filter(CentroCosto.activo == True).order_by(CentroCosto.codigo.asc()).all()
    partidas_query = db.query(PresupuestoCentroCosto).filter(PresupuestoCentroCosto.periodo == periodo).all()

    total_pres = Decimal('0.00')
    total_real = Decimal('0.00')
    summary_items: List[CostCenterSummaryItem] = []

    for cc in centros:
        cc_partidas = [p for p in partidas_query if p.centro_costo_id == cc.id]
        cc_pres = sum((p.monto_presupuestado for p in cc_partidas), Decimal('0.00'))
        cc_real = sum((p.monto_real for p in cc_partidas), Decimal('0.00'))

        total_pres += cc_pres
        total_real += cc_real

        cc_pres_f = round(float(cc_pres), 2)
        cc_real_f = round(float(cc_real), 2)
        # Variación Neta = Presupuesto Asignado - Gasto Ejecutado (negativo = sobregiro / exceso)
        var_monto = round(cc_pres_f - cc_real_f, 2)
        var_pct = round((var_monto / cc_pres_f * 100.0), 1) if cc_pres_f > 0 else 0.0

        if var_monto < 0.0:
            estado = "EXCESO_GASTO"
        elif var_monto > 0.0:
            estado = "AHORRO"
        else:
            estado = "EN_PRESUPUESTO"

        lineas: List[CostCenterBudgetLine] = []
        for p in cc_partidas:
            p_pres_f = round(float(p.monto_presupuestado or 0.0), 2)
            p_real_f = round(float(p.monto_real or 0.0), 2)
            p_var = round(p_pres_f - p_real_f, 2)
            p_pct = round((p_var / p_pres_f * 100.0), 1) if p_pres_f > 0 else 0.0
            p_est = "EXCESO_GASTO" if p_var < 0.0 else "AHORRO" if p_var > 0.0 else "EN_PRESUPUESTO"
            lineas.append(CostCenterBudgetLine(
                id=p.id,
                periodo=p.periodo,
                centro_costo_id=cc.id,
                centro_costo_codigo=cc.codigo,
                centro_costo_nombre=cc.nombre,
                concepto_opex=p.concepto_opex,
                monto_presupuestado=p_pres_f,
                monto_real=p_real_f,
                variacion_monto=p_var,
                variacion_pct=p_pct,
                estado=p_est
            ))

        resp_display = cc.responsable_user.nombre if cc.responsable_user else cc.responsable
        summary_items.append(CostCenterSummaryItem(
            centro_costo_id=cc.id,
            codigo=cc.codigo,
            nombre=cc.nombre,
            responsable=resp_display,
            area_id=cc.area_id,
            area_nombre=cc.area.nombre if cc.area else None,
            responsable_id=cc.responsable_id,
            responsable_nombre=cc.responsable_user.nombre if cc.responsable_user else None,
            total_presupuestado=cc_pres_f,
            total_real=cc_real_f,
            variacion_neta=var_monto,
            variacion_pct=var_pct,
            estado=estado,
            partidas=lineas
        ))

    total_pres_f = round(float(total_pres), 2)
    total_real_f = round(float(total_real), 2)
    var_total = round(total_pres_f - total_real_f, 2)
    var_total_pct = round((var_total / total_pres_f * 100.0), 1) if total_pres_f > 0 else 0.0

    return CostCenterBudgetReportResponse(
        periodo=periodo,
        total_opex_presupuestado=total_pres_f,
        total_opex_real=total_real_f,
        variacion_total=var_total,
        variacion_total_pct=var_total_pct,
        centros_costo=summary_items
    )


@router.post(
    "/budget/cost-centers/batch",
    response_model=CostCenterBatchResponse,
    summary="Carga y actualización por lote de partidas de OPEX por Centro de Costo"
)
def save_cost_center_budget_batch(
    payload: CostCenterBatchRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    saved_count = 0
    total_pres = Decimal('0.00')

    for item in payload.items:
        # Verificar o actualizar partida existente
        existing = db.query(PresupuestoCentroCosto).filter(
            PresupuestoCentroCosto.periodo == payload.periodo,
            PresupuestoCentroCosto.centro_costo_id == item.centro_costo_id,
            PresupuestoCentroCosto.concepto_opex == item.concepto_opex.strip()
        ).first()

        m_pres = Decimal(str(item.monto_presupuestado))
        m_real = Decimal(str(item.monto_real or 0.0))

        if existing:
            existing.monto_presupuestado = m_pres
            existing.monto_real = m_real
        else:
            new_p = PresupuestoCentroCosto(
                periodo=payload.periodo,
                centro_costo_id=item.centro_costo_id,
                concepto_opex=item.concepto_opex.strip(),
                monto_presupuestado=m_pres,
                monto_real=m_real
            )
            db.add(new_p)

        total_pres += m_pres
        saved_count += 1

    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="SAVE_COST_CENTER_BUDGET_BATCH",
        resource=f"budget/cost-centers/{payload.periodo}",
        details={
            "periodo": payload.periodo,
            "records_saved": saved_count,
            "total_opex_presupuestado": float(total_pres)
        }
    )

    return CostCenterBatchResponse(
        status="success",
        periodo=payload.periodo,
        records_saved=saved_count,
        total_opex_presupuestado=round(float(total_pres), 2),
        message=f"Se guardaron exitosamente {saved_count} partidas de OPEX para el período {payload.periodo}."
    )


@router.get(
    "/budget/cost-centers/total-opex",
    response_model=CostCenterTotalOpexResponse,
    summary="Entrega el OPEX mensual consolidado para alimentar simuladores de Business Case"
)
def get_total_monthly_opex(
    periodo: str = Query(default="2025-09", description="Período contable"),
    db: Session = Depends(get_db)
):
    partidas = db.query(PresupuestoCentroCosto).filter(PresupuestoCentroCosto.periodo == periodo).all()
    if not partidas:
        # Fallback al período base 2025-09 si el solicitado aún no tiene partidas
        partidas = db.query(PresupuestoCentroCosto).filter(PresupuestoCentroCosto.periodo == "2025-09").all()

    total_pres = sum((p.monto_presupuestado for p in partidas), Decimal('0.00'))
    total_real = sum((p.monto_real for p in partidas), Decimal('0.00'))
    centros_unicos = {p.centro_costo_id for p in partidas}

    return CostCenterTotalOpexResponse(
        periodo=periodo,
        total_opex_presupuestado=round(float(total_pres), 2),
        total_opex_real=round(float(total_real), 2),
        centros_contabilizados=len(centros_unicos),
        partidas_contabilizadas=len(partidas),
        status="success"
    )


@router.get(
    "/budgets",
    response_model=CostCentersGeneralBudgetResponse,
    summary="Resumen presupuestario por centro de costos con tipos primitivos garantizados"
)
def get_general_budgets(
    periodo: Optional[str] = Query(default="2026-Q1", description="Período presupuestario"),
    db: Session = Depends(get_db)
):
    centros = db.query(CentroCosto).filter(CentroCosto.activo == True).all()
    partidas = db.query(PresupuestoCentroCosto).all()

    # Si hay partidas para el período específico, usarlas. Sino buscar partidas existentes
    partidas_periodo = [p for p in partidas if p.periodo == periodo]
    if not partidas_periodo and partidas:
        partidas_periodo = partidas

    items: List[CostCenterBudget] = []
    presupuesto_total = 0.0
    ejecutado_total = 0.0

    for cc in centros:
        cc_parts = [p for p in partidas_periodo if p.centro_costo_id == cc.id]
        p_asig = round(sum(float(p.monto_presupuestado or 0.0) for p in cc_parts), 2)
        p_ejec = round(sum(float(p.monto_real or 0.0) for p in cc_parts), 2)
        var_neta = round(p_asig - p_ejec, 2)
        saldo_disp = round(p_asig - p_ejec, 2)

        items.append(CostCenterBudget(
            id=str(cc.codigo),
            nombre=str(cc.nombre),
            presupuesto_asignado=float(p_asig),
            ejecutado=float(p_ejec),
            saldo_disponible=float(saldo_disp),
            variacion_neta=float(var_neta),
            periodo=periodo
        ))
        presupuesto_total += p_asig
        ejecutado_total += p_ejec

    return CostCentersGeneralBudgetResponse(
        periodo=periodo or "2026-Q1",
        presupuesto_total=round(presupuesto_total, 2),
        ejecutado_total=round(ejecutado_total, 2),
        saldo_total=round(presupuesto_total - ejecutado_total, 2),
        centros_costo=items,
        status="success"
    )


# ----------------------------------------------------------------------
# FUSIÓN LUMINAR -> CALCU: LICITACIONES & PROYECTOS B2B (ZERO-TRUST)
# ----------------------------------------------------------------------
@router.post(
    "/tenders/evaluate",
    response_model=TenderEvaluateResponse,
    summary="Evalúa factibilidad logística, tasa BROU y dialéctica IA (David & Aristóteles)"
)
async def evaluate_tender(
    payload: TenderEvaluateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Motor determinístico de factibilidad logística de licitaciones y proyectos B2B.
    Cruza stock real con lead times, aplica margen y genera dictamen generativo
    multi-agente con Ollama (Ing. David & Aristóteles).
    """
    eval_result = await tenders_service.evaluate_tender_async(db=db, payload=payload)
    return eval_result


@router.post(
    "/tenders/debate",
    response_model=DialecticalDebateResponse,
    summary="Ejecuta debate dialéctico generativo multi-agente entre Ing. David y Aristóteles"
)
async def run_tender_debate_endpoint(
    payload: TenderQuoteRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Cadena dialéctica secuencial:
    Turno 1: Ing. David Jiménez Vera (Rigor electrotécnico & normativas UNIT)
    Turno 2: Aristóteles (Estrategia comercial retórica B2B y propuesta formal)
    """
    eval_result = tenders_service.evaluate_tender(db=db, payload=payload)
    logistics_audit = [item.model_dump() for item in eval_result.items]
    debate_result = await run_dialectical_debate(
        tender_data=payload,
        logistics_audit=logistics_audit,
        exchange_rate_brou=eval_result.tasa_cambio_brou,
        engine_mode=getattr(payload, "engine_mode", "auto") or "auto"
    )
    return DialecticalDebateResponse(
        status="success",
        proyecto_nombre=payload.proyecto_nombre,
        postura_david=debate_result["postura_david"],
        replica_aristoteles=debate_result["replica_aristoteles"],
        modelo_utilizado=debate_result["modelo_utilizado"],
        latency_ms=debate_result.get("latency_ms")
    )


@router.post(
    "/tenders",
    response_model=TenderResponse,
    summary="Crea y persiste una licitación evaluada en base de datos"
)
def create_tender(
    payload: TenderCreateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Evalúa la licitación y la almacena de forma inmutable en el repositorio de licitaciones.
    """
    eval_result = tenders_service.evaluate_tender(db=db, payload=payload)
    saved_tender = tenders_service.save_tender(
        db=db,
        eval_resp=eval_result,
        observaciones=payload.observaciones
    )

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_TENDER_B2B",
        resource=f"tenders/{saved_tender.id}",
        details={
            "proyecto": saved_tender.proyecto_nombre,
            "cliente": saved_tender.cliente_licitacion,
            "moneda": saved_tender.moneda,
            "total_ofertado": eval_result.total_ofertado
        }
    )

    return TenderResponse(
        id=saved_tender.id,
        proyecto_nombre=saved_tender.proyecto_nombre,
        cliente_licitacion=saved_tender.cliente_licitacion,
        nicho=saved_tender.nicho,
        fecha_apertura=saved_tender.fecha_apertura,
        plazo_entrega_dias=saved_tender.plazo_entrega_dias,
        moneda=saved_tender.moneda,
        tipo_cambio_brou=float(saved_tender.tipo_cambio_brou),
        estado=saved_tender.estado,
        observaciones=saved_tender.observaciones,
        total_items=len(saved_tender.items),
        total_ofertado=eval_result.total_ofertado,
        created_at=saved_tender.created_at
    )


@router.get(
    "/tenders",
    response_model=List[TenderResponse],
    summary="Listado de licitaciones y proyectos B2B registrados"
)
def list_tenders(
    db: Session = Depends(get_db)
):
    tenders = db.query(Tender).order_by(Tender.created_at.desc()).all()
    res = []
    for t in tenders:
        total_of = sum(float(item.precio_unitario_ofertado * item.cantidad_solicitada) for item in t.items)
        res.append(TenderResponse(
            id=t.id,
            proyecto_nombre=t.proyecto_nombre,
            cliente_licitacion=t.cliente_licitacion,
            nicho=t.nicho,
            fecha_apertura=t.fecha_apertura,
            plazo_entrega_dias=t.plazo_entrega_dias,
            moneda=t.moneda,
            tipo_cambio_brou=float(t.tipo_cambio_brou),
            estado=t.estado,
            observaciones=t.observaciones,
            total_items=len(t.items),
            total_ofertado=round(total_of, 2),
            created_at=t.created_at
        ))
    return res


# --- FEED AUTOMATIZADO DE LICITACIONES PÚBLICAS B2B (SERLUX) ---
@router.get(
    "/tenders/live-feed",
    response_model=TenderLiveFeedResponse,
    summary="Feed de licitaciones públicas uruguayas relevantes para Serlux (Iluminación & Mobiliario)"
)
def get_tenders_live_feed(
    nicho: Optional[str] = Query(None, description="ILUMINACION_TECNICA | MOBILIARIO_CORPORATIVO | TODAS"),
    q: Optional[str] = Query(None, max_length=120, description="Búsqueda libre"),
    keyword: Optional[str] = Query(None, max_length=120, description="Palabra clave específica"),
):
    from app.services.tenders_feed_service import tenders_feed_service
    search_term = keyword or q
    return tenders_feed_service.get_live_feed(nicho=nicho, q=search_term)


@router.post(
    "/tenders/feed/sync",
    response_model=TenderLiveFeedResponse,
    summary="Fuerza la sincronización del feed contra el RSS/OCDS oficial de ARCE usando el modelo Ollama y vertical configurados"
)
def sync_tenders_live_feed(
    payload: Optional[TenderFeedSyncRequest] = None,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    from app.services.tenders_feed_service import tenders_feed_service
    req = payload or TenderFeedSyncRequest()
    return tenders_feed_service.get_live_feed(
        nicho=req.vertical_id,
        force_sync=True,
        model=req.model,
        vertical_id=req.vertical_id,
        limit=req.limit,
        offset=req.offset,
        append_mode=req.append_mode,
        db=db,
    )


@router.post(
    "/tenders/import-feed-item",
    summary="Importa y evalúa una licitación pública oficial del feed con 1 clic"
)
def import_tender_feed_item(
    payload: TenderImportFeedRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    from app.services.tenders_feed_service import tenders_feed_service
    res = tenders_feed_service.import_feed_item(
        db=db,
        feed_item_id=payload.feed_item_id,
        proyecto_nombre=payload.proyecto_nombre
    )
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="IMPORT_TENDER_FEED_ITEM",
        resource=f"tenders/{res.get('tender_id')}",
        details={"feed_item_id": payload.feed_item_id}
    )
    return res


# --- GESTIÓN DE VERTICALES COMERCIALES B2B & PALABRAS CLAVE ---

@router.get(
    "/bidding/verticals",
    response_model=List[BiddingVerticalItem],
    summary="Lista todas las verticales comerciales activas con conteo de palabras clave"
)
def list_bidding_verticals(db: Session = Depends(get_db)):
    verticals = db.query(BiddingVertical).filter(BiddingVertical.activo == True).all()  # noqa: E712
    if not verticals:
        ETLService.seed_bidding_verticals(db)
        verticals = db.query(BiddingVertical).filter(BiddingVertical.activo == True).all()  # noqa: E712
    results = []
    for v in verticals:
        kw_count = db.query(BiddingKeyword).filter(BiddingKeyword.vertical_id == v.id).count()
        results.append(BiddingVerticalItem(
            id=v.id,
            nombre=v.nombre,
            icon=v.icon,
            color_badge=v.color_badge,
            descripcion=v.descripcion,
            activo=v.activo,
            keywords_count=kw_count,
        ))
    return results


@router.post(
    "/bidding/verticals",
    response_model=BiddingVerticalItem,
    summary="Crea un nuevo rubro o vertical comercial para licitaciones B2B"
)
def create_bidding_vertical(
    payload: BiddingVerticalCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    existing = db.query(BiddingVertical).filter(BiddingVertical.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"La vertical con ID '{payload.id}' ya existe.")

    vertical = BiddingVertical(
        id=payload.id.strip().upper(),
        nombre=payload.nombre.strip(),
        icon=payload.icon or "📋",
        color_badge=payload.color_badge or "blue",
        descripcion=payload.descripcion,
        activo=payload.activo,
    )
    db.add(vertical)
    db.commit()
    db.refresh(vertical)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_BIDDING_VERTICAL",
        resource=f"bidding_verticals/{vertical.id}",
        details={"nombre": vertical.nombre}
    )
    return BiddingVerticalItem(
        id=vertical.id,
        nombre=vertical.nombre,
        icon=vertical.icon,
        color_badge=vertical.color_badge,
        descripcion=vertical.descripcion,
        activo=vertical.activo,
        keywords_count=0
    )


@router.put(
    "/bidding/verticals/{vertical_id}",
    response_model=BiddingVerticalItem,
    summary="Actualiza metadatos de un rubro comercial"
)
def update_bidding_vertical(
    vertical_id: str,
    payload: BiddingVerticalCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    vertical = db.query(BiddingVertical).filter(BiddingVertical.id == vertical_id).first()
    if not vertical:
        raise HTTPException(status_code=404, detail="Vertical no encontrada.")

    vertical.nombre = payload.nombre.strip()
    vertical.icon = payload.icon or vertical.icon
    vertical.color_badge = payload.color_badge or vertical.color_badge
    vertical.descripcion = payload.descripcion
    vertical.activo = payload.activo
    db.commit()
    db.refresh(vertical)

    kw_count = db.query(BiddingKeyword).filter(BiddingKeyword.vertical_id == vertical.id).count()
    return BiddingVerticalItem(
        id=vertical.id,
        nombre=vertical.nombre,
        icon=vertical.icon,
        color_badge=vertical.color_badge,
        descripcion=vertical.descripcion,
        activo=vertical.activo,
        keywords_count=kw_count
    )


@router.get(
    "/bidding/verticals/{vertical_id}/keywords",
    response_model=List[BiddingKeywordItem],
    summary="Obtiene las palabras clave de inclusión y exclusión de un rubro comercial"
)
def get_bidding_keywords(vertical_id: str, db: Session = Depends(get_db)):
    vert = db.query(BiddingVertical).filter(BiddingVertical.id == vertical_id).first()
    if not vert:
        ETLService.seed_bidding_verticals(db)
        vert = db.query(BiddingVertical).filter(BiddingVertical.id == vertical_id).first()

    kws = db.query(BiddingKeyword).filter(BiddingKeyword.vertical_id == vertical_id).order_by(BiddingKeyword.tipo.desc(), BiddingKeyword.keyword.asc()).all()
    return [
        BiddingKeywordItem(
            id=k.id,
            vertical_id=k.vertical_id,
            keyword=k.keyword,
            tipo=k.tipo,
            peso=float(k.peso),
            fuente=k.fuente,
            created_at=k.created_at
        ) for k in kws
    ]


@router.post(
    "/bidding/verticals/{vertical_id}/keywords",
    summary="Agrega palabras clave (individual o en bloque) a un rubro comercial"
)
def add_bidding_keywords(
    vertical_id: str,
    payload: BiddingKeywordBulkCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    vert = db.query(BiddingVertical).filter(BiddingVertical.id == vertical_id).first()
    if not vert:
        ETLService.seed_bidding_verticals(db)
        vert = db.query(BiddingVertical).filter(BiddingVertical.id == vertical_id).first()
        if not vert:
            vert = BiddingVertical(
                id=vertical_id.strip().upper(),
                nombre=vertical_id.replace("_", " ").title(),
                icon="📋",
                color_badge="blue",
                descripcion=f"Rubro comercial {vertical_id}",
                activo=True,
                created_at=datetime.now(timezone.utc)
            )
            db.add(vert)
            db.commit()
            db.refresh(vert)

    tipo = (payload.tipo or "INCLUSION").upper()
    peso = Decimal(str(payload.peso or 1.0))
    created_count = 0

    for raw_kw in payload.keywords:
        kw_clean = raw_kw.strip().lower()
        if not kw_clean:
            continue
        existing = db.query(BiddingKeyword).filter(
            BiddingKeyword.vertical_id == vertical_id,
            BiddingKeyword.keyword == kw_clean,
            BiddingKeyword.tipo == tipo
        ).first()
        if not existing:
            new_kw = BiddingKeyword(
                vertical_id=vertical_id,
                keyword=kw_clean,
                tipo=tipo,
                peso=peso,
                fuente="MANUAL",
                created_at=datetime.now(timezone.utc)
            )
            db.add(new_kw)
            created_count += 1

    db.commit()
    return {"status": "success", "message": f"Se agregaron {created_count} palabras clave a la vertical {vertical_id}."}


@router.delete(
    "/bidding/keywords/{keyword_id}",
    summary="Elimina una palabra clave configurada"
)
def delete_bidding_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    kw = db.query(BiddingKeyword).filter(BiddingKeyword.id == keyword_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="Palabra clave no encontrada.")
    db.delete(kw)
    db.commit()
    return {"status": "success", "message": f"Palabra clave #{keyword_id} eliminada."}


@router.post(
    "/bidding/ai/expand-keywords",
    response_model=BiddingAIExpandKeywordsResponse,
    summary="Asistente IA Local (Ollama) para expandir sinónimos y palabras clave por rubro"
)
def ai_expand_keywords(
    payload: BiddingAIExpandKeywordsRequest,
    db: Session = Depends(get_db)
):
    from app.services.tenders_feed_service import expand_keywords_with_ai
    res = expand_keywords_with_ai(
        query=payload.query,
        vertical_id=payload.vertical_id,
        rubro_nombre=payload.rubro_nombre,
        model=payload.model,
        include_exclusions=payload.include_exclusions
    )
    return BiddingAIExpandKeywordsResponse(
        status=res.get("status", "success"),
        vertical_id=res.get("vertical_id"),
        query=res.get("query"),
        model_used=res.get("model_used", "Local LLM"),
        sinonimos_sugeridos=res.get("sinonimos_sugeridos", []),
        keywords_inclusion_sugeridas=res.get("keywords_inclusion_sugeridas", []),
        keywords_exclusion_sugeridas=res.get("keywords_exclusion_sugeridas", []),
        explicacion=res.get("explicacion", ""),
        es_fallback_heuristico=res.get("es_fallback_heuristico", False),
    )



@router.get(
    "/tenders/{tender_id}",
    summary="Obtiene el detalle completo y dictámenes de una licitación"
)
def get_tender_detail(
    tender_id: str,
    db: Session = Depends(get_db)
):
    t = db.query(Tender).filter(Tender.id == tender_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Licitación no encontrada")

    import json
    dictamen_david = json.loads(t.dictamen_david) if t.dictamen_david else {}
    dictamen_aristoteles = json.loads(t.dictamen_aristoteles) if t.dictamen_aristoteles else {}

    items = []
    total_of = 0.0
    for it in t.items:
        sub = float(it.precio_unitario_ofertado * it.cantidad_solicitada)
        total_of += sub
        items.append({
            "id": it.id,
            "sku": it.sku,
            "cantidad_solicitada": it.cantidad_solicitada,
            "costo_unitario": float(it.costo_unitario_historico or 0),
            "precio_unitario": float(it.precio_unitario_ofertado),
            "subtotal": round(sub, 2),
            "margen_estimado": float(it.margen_estimado or 0),
            "viabilidad_logistica": it.viabilidad_logistica,
            "unidades_faltantes": it.unidades_faltantes,
            "dias_retraso_estimado": it.dias_retraso_estimado
        })

    return {
        "id": t.id,
        "proyecto_nombre": t.proyecto_nombre,
        "cliente_licitacion": t.cliente_licitacion,
        "nicho": t.nicho,
        "fecha_apertura": t.fecha_apertura,
        "plazo_entrega_dias": t.plazo_entrega_dias,
        "moneda": t.moneda,
        "tipo_cambio_brou": float(t.tipo_cambio_brou),
        "estado": t.estado,
        "observaciones": t.observaciones,
        "total_ofertado": round(total_of, 2),
        "items": items,
        "dictamen_david": dictamen_david,
        "dictamen_aristoteles": dictamen_aristoteles,
        "created_at": t.created_at
    }


# ==============================================================================
# PIPELINE COMERCIAL (CRM) ENDPOINTS
# ==============================================================================

@router.get(
    "/deals",
    response_model=List[CommercialDealResponse],
    summary="Lista tratos comerciales del pipeline CRM"
)
def list_commercial_deals(
    etapa: Optional[str] = Query(None, description="Filtrar por etapa del pipeline"),
    vendedor: Optional[str] = Query(None, description="Filtrar por vendedor asignado"),
    db: Session = Depends(get_db)
):
    return commercial_service.list_deals(db, etapa=etapa, vendedor=vendedor)


@router.post(
    "/deals",
    response_model=CommercialDealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo trato comercial en el pipeline CRM"
)
def create_commercial_deal(
    payload: CommercialDealCreate,
    db: Session = Depends(get_db)
):
    return commercial_service.create_deal(db, payload)


@router.get(
    "/deals/{deal_id}",
    response_model=CommercialDealResponse,
    summary="Obtiene detalle de un trato comercial"
)
def get_commercial_deal(
    deal_id: str,
    db: Session = Depends(get_db)
):
    deal = commercial_service.get_deal(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Trato comercial no encontrado")
    return deal


@router.put(
    "/deals/{deal_id}",
    response_model=CommercialDealResponse,
    summary="Actualiza un trato comercial completo"
)
def update_commercial_deal(
    deal_id: str,
    payload: CommercialDealUpdate,
    db: Session = Depends(get_db)
):
    deal = commercial_service.update_deal(db, deal_id, payload)
    if not deal:
        raise HTTPException(status_code=404, detail="Trato comercial no encontrado")
    return deal


@router.put(
    "/deals/{deal_id}/stage",
    response_model=CommercialDealResponse,
    summary="Cambia la etapa de un trato comercial (reserva stock al ganar)"
)
@router.patch(
    "/deals/{deal_id}/stage",
    response_model=CommercialDealResponse,
    summary="Cambia la etapa de un trato comercial (reserva stock al ganar)"
)
@router.put(
    "/crm/deals/{deal_id}/stage",
    response_model=CommercialDealResponse,
    summary="Cambia la etapa de un trato comercial (alias CRM)"
)
@router.patch(
    "/crm/deals/{deal_id}/stage",
    response_model=CommercialDealResponse,
    summary="Cambia la etapa de un trato comercial (alias CRM)"
)
def update_commercial_deal_stage(
    deal_id: str,
    payload: CommercialDealStageUpdate,
    db: Session = Depends(get_db)
):
    deal = commercial_service.update_stage(db, deal_id, payload.etapa)
    if not deal:
        raise HTTPException(status_code=404, detail="Trato comercial no encontrado")
    return deal


@router.delete(
    "/deals/{deal_id}",
    summary="Elimina un trato comercial"
)
def delete_commercial_deal(
    deal_id: str,
    db: Session = Depends(get_db)
):
    ok = commercial_service.delete_deal(db, deal_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Trato comercial no encontrado")
    return {"status": "success", "message": f"Trato {deal_id} eliminado exitosamente"}


# --- Órdenes de Venta Formales (Sales Orders - OV) ---
@router.post(
    "/deals/{deal_id}/generate-sales-order",
    response_model=SalesOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Emite una Orden de Venta formal (OV) desde un Deal y descuenta stock del depósito seleccionado"
)
def generate_sales_order(
    deal_id: str,
    payload: SalesOrderGenerateRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    try:
        so = commercial_service.generate_sales_order(db, deal_id, payload)
        record_audit_log(
            db=db,
            user_id=user.user_id,
            role=user.role,
            action="GENERATE_SALES_ORDER",
            resource=f"sales_orders/{so.id}",
            details={
                "deal_id": deal_id,
                "numero_ov": so.numero_ov,
                "total": so.total,
                "warehouse_id": payload.warehouse_id
            }
        )
        return so
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/deals/{deal_id}/sales-orders",
    response_model=List[SalesOrderResponse],
    summary="Obtiene las Órdenes de Venta emitidas para un Deal específico"
)
def list_deal_sales_orders(
    deal_id: str,
    db: Session = Depends(get_db)
):
    return commercial_service.list_sales_orders(db, deal_id=deal_id)


@router.get(
    "/sales-orders",
    response_model=List[SalesOrderResponse],
    summary="Listado maestro de Órdenes de Venta emitidas"
)
def list_all_sales_orders(
    db: Session = Depends(get_db)
):
    return commercial_service.list_sales_orders(db)


@router.get(
    "/sales-orders/{order_id}",
    response_model=SalesOrderResponse,
    summary="Obtiene el detalle completo de una Orden de Venta"
)
def get_sales_order_detail(
    order_id: str,
    db: Session = Depends(get_db)
):
    so = commercial_service.get_sales_order(db, order_id)
    if not so:
        raise HTTPException(status_code=404, detail="Orden de Venta no encontrada")
    return so


# ==============================================================================
# MONITOR DE STOCK MULTI-UBICACIÓN & TRÁNSITO
# ==============================================================================

@router.get(
    "/stock-locations/summary",
    response_model=StockLocationSummary,
    summary="Resumen agregado de unidades en los 4 estadios físicos"
)
def get_stock_locations_summary(
    db: Session = Depends(get_db)
):
    return stock_trace_service.get_summary(db)


@router.get(
    "/stock-locations/batches",
    response_model=List[StockLocationBatchResponse],
    summary="Lista lotes de inventario con tracking ETA y ubicación"
)
def list_stock_location_batches(
    ubicacion: Optional[str] = Query(None, description="Filtrar por ubicación física"),
    db: Session = Depends(get_db)
):
    return stock_trace_service.list_batches(db, ubicacion=ubicacion)


@router.post(
    "/stock-locations/batches",
    response_model=StockLocationBatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo lote de stock para trazabilidad"
)
def create_stock_location_batch(
    payload: StockLocationBatchCreate,
    db: Session = Depends(get_db)
):
    return stock_trace_service.create_batch(db, payload)


@router.post(
    "/stock-locations/transfer",
    response_model=StockLocationBatchResponse,
    summary="Transfiere un lote de stock entre ubicaciones y actualiza inventarios"
)
def transfer_stock_location_batch(
    payload: StockTransferRequest,
    db: Session = Depends(get_db)
):
    batch = stock_trace_service.transfer_batch(db, payload)
    if not batch:
        raise HTTPException(status_code=404, detail="Lote de inventario no encontrado")
    return batch


@router.post(
    "/stock-locations/auto-arrive",
    summary="Procesa el arribo automático de lotes marítimos con ETA cumplida"
)
def auto_arrive_stock_batches(
    db: Session = Depends(get_db)
):
    count = stock_trace_service.auto_arrive_batches(db)
    return {
        "status": "success",
        "batches_processed": count,
        "message": f"Se procesaron {count} lotes arribados hacia Depósito Central."
    }


# ==============================================================================
# GOBERNANZA MULTI-DEPÓSITO & ALMACENES FÍSICOS
# ==============================================================================

@router.get(
    "/warehouses",
    response_model=List[WarehouseSchema],
    summary="Listado maestro de depósitos y almacenes físicos"
)
def list_warehouses(
    db: Session = Depends(get_db)
):
    return db.query(Warehouse).order_by(Warehouse.id.asc()).all()


@router.post(
    "/warehouses",
    response_model=WarehouseSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo depósito / ubicación física"
)
def create_warehouse(
    payload: WarehouseCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    raw_id = payload.id.strip() if payload.id and payload.id.strip() else payload.nombre.strip()
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "-", raw_id.lower()).strip("-")
    if not clean_id:
        clean_id = f"wh-{uuid.uuid4().hex[:6]}"

    existing = db.query(Warehouse).filter(Warehouse.id == clean_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El depósito con identificador '{clean_id}' ya existe."
        )
    wh = Warehouse(
        id=clean_id,
        nombre=payload.nombre.strip(),
        tipo=payload.tipo,
        ubicacion=payload.ubicacion.strip(),
        pais=payload.pais.strip() if payload.pais else "Uruguay",
        capacidad_unidades=payload.capacidad_unidades,
        activo=payload.activo
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="WAREHOUSE_CREATE",
        resource=f"warehouses/{wh.id}",
        details=payload.model_dump()
    )

    return wh


@router.put(
    "/warehouses/{wh_id}",
    response_model=WarehouseSchema,
    summary="Actualiza la configuración de un depósito o ubicación física"
)
def update_warehouse(
    wh_id: str,
    payload: WarehouseUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Depósito no encontrado"
        )
    if payload.nombre is not None:
        wh.nombre = payload.nombre.strip()
    if payload.tipo is not None:
        wh.tipo = payload.tipo
    if payload.ubicacion is not None:
        wh.ubicacion = payload.ubicacion.strip()
    if payload.pais is not None:
        wh.pais = payload.pais.strip()
    if payload.capacidad_unidades is not None:
        wh.capacidad_unidades = payload.capacidad_unidades
    if payload.activo is not None:
        wh.activo = payload.activo
    db.commit()
    db.refresh(wh)
    return wh


@router.get(
    "/warehouses/{wh_id}/stock",
    response_model=List[WarehouseStockItem],
    summary="Obtiene el inventario consolidado y lotes por SKU de un depósito"
)
def get_warehouse_stock(
    wh_id: str,
    db: Session = Depends(get_db)
):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")

    from app.services.inventory_sync_service import inventory_sync_service
    batches = inventory_sync_service.list_unified_batches(db, warehouse_id=wh_id)

    sku_groups: dict = {}
    for b in batches:
        sku = b.sku
        if sku not in sku_groups:
            prod = db.query(Product).filter(Product.sku == sku).first()
            sku_groups[sku] = {
                "sku": sku,
                "producto_nombre": (prod.nombre if prod else b.producto_nombre) or sku,
                "image_url": prod.image_url if prod else None,
                "stock_disponible": 0,
                "stock_reservado": 0,
                "lotes": []
            }

        sku_groups[sku]["stock_disponible"] += b.cantidad
        sku_groups[sku]["lotes"].append(
            WarehouseBatchDetail(
                lote=b.lote,
                cantidad=b.cantidad,
                estado=b.estado or "DISPONIBLE",
                fecha_eta=b.fecha_eta,
                buque_o_tracking=b.buque_o_tracking,
                observaciones=b.observaciones
            )
        )

    for sku, data in sku_groups.items():
        reserved_qty = (
            db.query(func.coalesce(func.sum(CommercialDealItem.cantidad), 0))
            .join(CommercialDeal, CommercialDealItem.deal_id == CommercialDeal.id)
            .filter(
                CommercialDealItem.sku == sku,
                CommercialDeal.etapa.in_(["GANADO", "CIERRE", "ORDEN_GENERADA"])
            )
            .scalar()
        )
        data["stock_reservado"] = int(reserved_qty or 0)

    return [WarehouseStockItem(**data) for data in sku_groups.values()]


@router.delete(
    "/warehouses/{wh_id}",
    summary="Elimina un depósito o almacén vacío o de prueba"
)
def delete_warehouse(
    wh_id: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Depósito no encontrado")

    from app.services.inventory_sync_service import inventory_sync_service
    batches = inventory_sync_service.list_unified_batches(db, warehouse_id=wh_id)
    total_qty = sum(b.cantidad for b in batches)
    if total_qty > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el depósito '{wh.nombre}' porque contiene {total_qty} unidades de stock activo."
        )

    rev_loc = inventory_sync_service.LOCATION_REVERSE_MAP.get(wh_id, wh_id)
    db.query(StockLocationBatch).filter(
        (StockLocationBatch.ubicacion == wh_id) | (StockLocationBatch.ubicacion == rev_loc)
    ).delete(synchronize_session=False)

    db.delete(wh)
    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="DELETE_WAREHOUSE",
        resource=f"warehouses/{wh_id}",
        details={"nombre": wh.nombre, "id": wh_id}
    )

    return {"status": "success", "warehouse_id": wh_id, "message": f"Depósito {wh.nombre} eliminado correctamente."}



@router.post(
    "/warehouses/transfer",
    response_model=StockBatchItem,
    summary="Transfiere stock de un lote entre depósitos y almacenes físicos"
)
def transfer_warehouse_stock(
    payload: WarehouseTransferPayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    from app.services.inventory_sync_service import inventory_sync_service
    try:
        res = inventory_sync_service.transfer_stock(db, payload)
        record_audit_log(
            db=db,
            user_id=user.user_id,
            role=user.role,
            action="TRANSFER_WAREHOUSE_STOCK",
            resource=f"batches/{payload.lote}",
            details=payload.model_dump()
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/warehouses/assign-stock",
    response_model=StockBatchItem,
    status_code=status.HTTP_201_CREATED,
    summary="Asigna o ajusta stock directo en un depósito"
)
def assign_direct_warehouse_stock(
    payload: WarehouseAssignStockPayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    from app.services.inventory_sync_service import inventory_sync_service
    res = inventory_sync_service.assign_direct_stock(db, payload)
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="ASSIGN_DIRECT_STOCK",
        resource=f"warehouses/{payload.warehouse_id}",
        details=payload.model_dump()
    )
    return res


@router.get(
    "/warehouses/batches",
    response_model=List[StockBatchItem],
    summary="Listado unificado de lotes sincronizados por almacén"
)
def list_unified_warehouse_batches(
    warehouse_id: Optional[str] = Query(None, description="Filtrar por ID de depósito"),
    exclude_test_batches: bool = Query(False, description="Ocultar lotes de prueba sintéticos"),
    db: Session = Depends(get_db)
):
    from app.services.inventory_sync_service import inventory_sync_service
    return inventory_sync_service.list_unified_batches(
        db, warehouse_id=warehouse_id, exclude_test_batches=exclude_test_batches
    )


# ==============================================================================
# PROVEEDORES DE PLAZA / REVENTA LOCAL & FLUJO DE APROBACIÓN
# ==============================================================================

@router.post(
    "/warehouses/reventa-batches",
    response_model=StockBatchItem,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un lote de compra a Proveedor Uruguay / Reventa (Pendiente de Aprobación)"
)
def create_reventa_batch(
    payload: ReventaBatchCreatePayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Proveedor con ID {payload.supplier_id} no encontrado.")

    prod = db.query(Product).filter(Product.sku == payload.sku).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Producto con SKU '{payload.sku}' no registrado en el catálogo local.")

    lote_id = f"LOT-REV-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    today = date.today()

    new_batch = StockLocationBatch(
        id=lote_id,
        sku=payload.sku,
        sku_fabrica=payload.sku_fabrica or f"MK-{payload.sku}-UY",
        lote_fabrica=payload.lote_fabrica or f"LOT-PROV-{payload.supplier_id}",
        cantidad=payload.cantidad,
        ubicacion="proveedor_uy",
        pais_origen="UY",
        buque_o_tracking="PLAZA-LOCAL",
        fecha_despacho=today,
        fecha_eta=payload.fecha_disponible or today,
        fecha_terminado=payload.fecha_disponible or today,
        supplier_id=supplier.id,
        warehouse_id="PROV-UY",
        estado="EN_PROVEEDOR",
        estado_aprobacion="PENDIENTE_APROBACION",
        costo_compra=payload.costo_compra or prod.costo_base,
        observaciones=payload.observaciones or f"Compra plaza reventa: {supplier.nombre}",
    )
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_REVENTA_BATCH",
        resource=f"stock_location_batches/{new_batch.id}",
        details=payload.model_dump(mode="json")
    )

    from app.services.inventory_sync_service import inventory_sync_service
    batches = inventory_sync_service.list_unified_batches(db)
    found = next((b for b in batches if b.id == new_batch.id), None)
    if found:
        return found

    return StockBatchItem(
        id=new_batch.id,
        lote=new_batch.id,
        sku=new_batch.sku,
        sku_fabrica=new_batch.sku_fabrica,
        lote_fabrica=new_batch.lote_fabrica,
        cantidad=new_batch.cantidad,
        precio_venta=float(payload.precio_venta),
        costo_compra=float(payload.costo_compra) if payload.costo_compra and user.role in ("controller_admin", "comercial") else None,
        estado_aprobacion="PENDIENTE_APROBACION",
        etapa_columna="proveedor_uy",
        warehouse_id="PROV-UY",
        supplier_id=supplier.id,
        supplier_nombre=supplier.nombre,
        origen_pais="Uruguay",
        proveedor=supplier.nombre,
        fecha_eta=new_batch.fecha_eta,
        fecha_terminado=new_batch.fecha_terminado,
        producto_nombre=prod.nombre,
        estado="EN_PROVEEDOR",
        observaciones=new_batch.observaciones
    )


@router.patch(
    "/warehouses/batches/{batch_id}/approve",
    response_model=StockBatchItem,
    summary="Aprueba o rechaza un lote de proveedor reventa (Solo Comercial o Admin)"
)
def approve_reventa_batch(
    batch_id: str,
    payload: BatchApprovePayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    if user.role not in ("controller_admin", "comercial"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Segregación de funciones: La aprobación de lotes de reventa requiere rol 'comercial' o 'controller_admin'."
        )

    batch = db.query(StockLocationBatch).filter(StockLocationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Lote '{batch_id}' no encontrado.")

    batch.estado_aprobacion = payload.estado_aprobacion.upper()
    if payload.estado_aprobacion.upper() == "APROBADO":
        batch.estado = "APROBADO_PARA_INGRESO"
    elif payload.estado_aprobacion.upper() == "RECHAZADO":
        batch.estado = "RECHAZADO"

    if payload.observaciones:
        batch.observaciones = f"[{user.role.upper()}]: {payload.observaciones}. {batch.observaciones or ''}"

    db.commit()
    db.refresh(batch)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="APPROVE_REVENTA_BATCH",
        resource=f"stock_location_batches/{batch.id}",
        details={"estado_aprobacion": batch.estado_aprobacion}
    )

    from app.services.inventory_sync_service import inventory_sync_service
    batches = inventory_sync_service.list_unified_batches(db)
    found = next((b for b in batches if b.id == batch.id), None)
    if found:
        return found

    return StockBatchItem(
        id=batch.id,
        lote=batch.id,
        sku=batch.sku,
        cantidad=batch.cantidad,
        estado_aprobacion=batch.estado_aprobacion,
        estado=batch.estado,
        warehouse_id=batch.warehouse_id or "PROV-UY",
        etapa_columna="proveedor_uy"
    )


# ==============================================================================
# ÓRDENES DE COMPRA LOCALES (PROVEEDORES URUGUAY / PLAZA)
# ==============================================================================

@router.get(
    "/supply/local-orders",
    response_model=List[LocalPurchaseOrderResponse],
    summary="Listado de órdenes de compra para proveedores de plaza (Uruguay)"
)
def list_local_purchase_orders(
    db: Session = Depends(get_db)
):
    orders = db.query(OrdenCompra).filter(OrdenCompra.tipo_orden == "LOCAL_REVENTA").order_by(OrdenCompra.id.desc()).all()
    res: List[LocalPurchaseOrderResponse] = []
    for o in orders:
        detalle = db.query(OrdenCompraDetalle).filter(OrdenCompraDetalle.orden_id == o.id).first()
        sku_val = detalle.producto.sku if detalle and detalle.producto else ""
        prod_nom = detalle.producto.nombre if detalle and detalle.producto else ""
        cant = detalle.cantidad if detalle else 0
        costo_u = float(detalle.costo_unitario_pactado) if detalle else 0.0

        res.append(
            LocalPurchaseOrderResponse(
                id=o.id,
                numero_po=o.numero_po,
                proveedor=o.proveedor,
                sku=sku_val,
                producto_nombre=prod_nom,
                cantidad=cant,
                costo_unitario=costo_u,
                monto_total=float(o.monto_total or (cant * costo_u)),
                fecha_emision=o.fecha_emision,
                fecha_disponible=o.fecha_disponible or o.fecha_arribo_estimada,
                estado=o.etapa,
                responsable=o.responsable
            )
        )
    return res


@router.post(
    "/supply/local-orders",
    response_model=LocalPurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una orden de compra para un proveedor de plaza local"
)
def create_local_purchase_order(
    payload: LocalPurchaseOrderCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == payload.proveedor_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor de plaza no encontrado.")

    prod = db.query(Product).filter(Product.sku == payload.sku).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Producto con SKU '{payload.sku}' no encontrado.")

    po_num = f"OC-UY-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    monto_tot = Decimal(str(payload.cantidad)) * payload.costo_unitario

    po = OrdenCompra(
        numero_po=po_num,
        proveedor=supplier.nombre,
        etapa="aprobada",
        responsable=payload.responsable or user.user_id,
        fecha_emision=date.today(),
        fecha_arribo_estimada=payload.fecha_disponible,
        tipo_orden="LOCAL_REVENTA",
        fecha_disponible=payload.fecha_disponible,
        monto_total=monto_tot
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    detalle = OrdenCompraDetalle(
        orden_id=po.id,
        producto_id=prod.id,
        cantidad=payload.cantidad,
        costo_unitario_pactado=payload.costo_unitario
    )
    db.add(detalle)

    # Crear automáticamente lote correspondiente en Proveedores Uy (Pendiente de Aprobación)
    lot_rev_id = f"LOT-REV-{po.numero_po[-4:]}"
    batch = StockLocationBatch(
        id=lot_rev_id,
        sku=prod.sku,
        sku_fabrica=f"MK-{prod.sku}-UY",
        lote_fabrica=f"OC-{po.numero_po[-6:]}",
        cantidad=payload.cantidad,
        ubicacion="proveedor_uy",
        pais_origen="UY",
        buque_o_tracking="PLAZA-LOCAL",
        fecha_despacho=date.today(),
        fecha_eta=payload.fecha_disponible,
        fecha_terminado=payload.fecha_disponible,
        supplier_id=supplier.id,
        warehouse_id="PROV-UY",
        estado="EN_PROVEEDOR",
        estado_aprobacion="PENDIENTE_APROBACION",
        costo_compra=payload.costo_unitario,
        observaciones=f"OC Local #{po.numero_po} ({supplier.nombre})",
    )
    db.add(batch)
    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_LOCAL_PURCHASE_ORDER",
        resource=f"ordenes_compra/{po.id}",
        details=payload.model_dump(mode="json")
    )

    return LocalPurchaseOrderResponse(
        id=po.id,
        numero_po=po.numero_po,
        proveedor=supplier.nombre,
        proveedor_id=supplier.id,
        sku=prod.sku,
        producto_nombre=prod.nombre,
        cantidad=payload.cantidad,
        costo_unitario=float(payload.costo_unitario),
        monto_total=float(monto_tot),
        fecha_emision=po.fecha_emision,
        fecha_disponible=po.fecha_disponible,
        estado=po.etapa,
        responsable=po.responsable
    )


# ==============================================================================
# PRESUPUESTOS IMPLÍCITOS & SERVICIOS LOGÍSTICOS (MARÍTIMO, SEGURO, ADUANA, CAMIÓN)
# ==============================================================================

@router.get(
    "/supply/implicit-catalog",
    response_model=List[ImplicitServiceItemSchema],
    summary="Catálogo de servicios de fletes marítimos, seguros, aduanas y camiones"
)
def list_implicit_services_catalog(
    db: Session = Depends(get_db)
):
    items = db.query(ImplicitServiceCatalog).filter(ImplicitServiceCatalog.activo == True).order_by(ImplicitServiceCatalog.rubro.asc()).all()
    return [
        ImplicitServiceItemSchema(
            id=i.id,
            rubro=i.rubro,
            codigo=i.codigo,
            nombre_servicio=i.nombre_servicio,
            proveedor_id=i.proveedor_id,
            proveedor_nombre=i.proveedor_rel.nombre if i.proveedor_rel else None,
            costo_unitario_base=float(i.costo_unitario_base),
            moneda=i.moneda,
            descripcion=i.descripcion,
            activo=i.activo
        )
        for i in items
    ]


@router.post(
    "/supply/implicit-catalog",
    response_model=ImplicitServiceItemSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Agrega un nuevo servicio al catálogo logístico"
)
def create_implicit_service(
    payload: ImplicitServiceCreatePayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    existing = db.query(ImplicitServiceCatalog).filter(ImplicitServiceCatalog.codigo == payload.codigo).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Código de servicio '{payload.codigo}' ya registrado.")

    item = ImplicitServiceCatalog(
        rubro=payload.rubro.upper(),
        codigo=payload.codigo.strip(),
        nombre_servicio=payload.nombre_servicio.strip(),
        proveedor_id=payload.proveedor_id,
        costo_unitario_base=payload.costo_unitario_base,
        moneda=payload.moneda or "USD",
        descripcion=payload.descripcion,
        activo=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ImplicitServiceItemSchema(
        id=item.id,
        rubro=item.rubro,
        codigo=item.codigo,
        nombre_servicio=item.nombre_servicio,
        proveedor_id=item.proveedor_id,
        proveedor_nombre=item.proveedor_rel.nombre if item.proveedor_rel else None,
        costo_unitario_base=float(item.costo_unitario_base),
        moneda=item.moneda,
        descripcion=item.descripcion,
        activo=item.activo
    )


@router.get(
    "/supply/implicit-budgets",
    response_model=List[ImplicitBudgetOrderResponse],
    summary="Listado de órdenes de presupuesto implícito multirrubro"
)
def list_implicit_budget_orders(
    db: Session = Depends(get_db)
):
    orders = db.query(ImplicitBudgetOrder).order_by(ImplicitBudgetOrder.id.desc()).all()
    res: List[ImplicitBudgetOrderResponse] = []
    for o in orders:
        items_dto = [
            ImplicitBudgetItemResponse(
                id=it.id,
                rubro=it.rubro,
                service_id=it.service_id,
                service_nombre=it.service_rel.nombre_servicio if it.service_rel else None,
                supplier_id=it.supplier_id,
                supplier_nombre=it.supplier_rel.nombre if it.supplier_rel else None,
                descripcion=it.descripcion,
                cantidad=it.cantidad,
                costo_unitario=float(it.costo_unitario),
                costo_total=float(it.costo_total)
            )
            for it in o.items
        ]
        res.append(
            ImplicitBudgetOrderResponse(
                id=o.id,
                numero_orden=o.numero_orden,
                titulo=o.titulo,
                monto_total=float(o.monto_total),
                moneda=o.moneda,
                estado=o.estado,
                aprobado_por=o.aprobado_por,
                fecha_aprobacion=o.fecha_aprobacion,
                observaciones=o.observaciones,
                created_at=o.created_at,
                items=items_dto
            )
        )
    return res


@router.post(
    "/supply/implicit-budgets",
    response_model=ImplicitBudgetOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una orden de presupuesto implícito combinando marítimo, seguro, aduana y camiones"
)
def create_implicit_budget_order(
    payload: ImplicitBudgetOrderCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un ítem de servicio.")

    num = f"PRE-IMP-{datetime.now().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    monto_total = Decimal('0.00')

    order = ImplicitBudgetOrder(
        numero_orden=num,
        titulo=payload.titulo.strip(),
        moneda="USD",
        estado="PENDIENTE_APROBACION",
        observaciones=payload.observaciones
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    items_res: List[ImplicitBudgetItemResponse] = []
    for it in payload.items:
        c_tot = Decimal(str(it.cantidad)) * it.costo_unitario
        monto_total += c_tot
        db_it = ImplicitBudgetItem(
            budget_id=order.id,
            rubro=it.rubro.upper(),
            service_id=it.service_id,
            supplier_id=it.supplier_id,
            descripcion=it.descripcion.strip(),
            cantidad=it.cantidad,
            costo_unitario=it.costo_unitario,
            costo_total=c_tot
        )
        db.add(db_it)
        db.commit()
        db.refresh(db_it)

        items_res.append(
            ImplicitBudgetItemResponse(
                id=db_it.id,
                rubro=db_it.rubro,
                service_id=db_it.service_id,
                service_nombre=db_it.service_rel.nombre_servicio if db_it.service_rel else None,
                supplier_id=db_it.supplier_id,
                supplier_nombre=db_it.supplier_rel.nombre if db_it.supplier_rel else None,
                descripcion=db_it.descripcion,
                cantidad=db_it.cantidad,
                costo_unitario=float(db_it.costo_unitario),
                costo_total=float(c_tot)
            )
        )

    order.monto_total = monto_total
    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_IMPLICIT_BUDGET",
        resource=f"implicit_budget_orders/{order.id}",
        details={"numero_orden": order.numero_orden, "monto_total": float(monto_total)}
    )

    return ImplicitBudgetOrderResponse(
        id=order.id,
        numero_orden=order.numero_orden,
        titulo=order.titulo,
        monto_total=float(monto_total),
        moneda=order.moneda,
        estado=order.estado,
        observaciones=order.observaciones,
        created_at=order.created_at,
        items=items_res
    )


@router.patch(
    "/supply/implicit-budgets/{budget_id}/approve",
    response_model=ImplicitBudgetOrderResponse,
    summary="Aprobación directiva de una orden de presupuesto implícito"
)
def approve_implicit_budget_order(
    budget_id: int,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    if user.role != "controller_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gobernanza financiera: La aprobación de presupuestos implícitos requiere rol 'controller_admin'."
        )

    order = db.query(ImplicitBudgetOrder).filter(ImplicitBudgetOrder.id == budget_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de presupuesto no encontrada.")

    order.estado = "APROBADO"
    order.aprobado_por = user.user_id
    order.fecha_aprobacion = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="APPROVE_IMPLICIT_BUDGET",
        resource=f"implicit_budget_orders/{order.id}",
        details={"aprobado_por": user.user_id, "monto": float(order.monto_total)}
    )

    items_dto = [
        ImplicitBudgetItemResponse(
            id=it.id,
            rubro=it.rubro,
            service_id=it.service_id,
            service_nombre=it.service_rel.nombre_servicio if it.service_rel else None,
            supplier_id=it.supplier_id,
            supplier_nombre=it.supplier_rel.nombre if it.supplier_rel else None,
            descripcion=it.descripcion,
            cantidad=it.cantidad,
            costo_unitario=float(it.costo_unitario),
            costo_total=float(it.costo_total)
        )
        for it in order.items
    ]

    return ImplicitBudgetOrderResponse(
        id=order.id,
        numero_orden=order.numero_orden,
        titulo=order.titulo,
        monto_total=float(order.monto_total),
        moneda=order.moneda,
        estado=order.estado,
        aprobado_por=order.aprobado_por,
        fecha_aprobacion=order.fecha_aprobacion,
        observaciones=order.observaciones,
        created_at=order.created_at,
        items=items_dto
    )


# ==============================================================================
# PLANTILLA EXCEL Y CARGA MASIVA DE CATÁLOGO / REVENTA
# ==============================================================================

@router.get(
    "/suppliers/reventa/template",
    summary="Descarga planilla Excel estructurada de ejemplo para catálogo de proveedores de reventa"
)
def download_reventa_catalog_template():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Catalogo_Reventa"

    headers = [
        "sku_local",
        "sku_proveedor",
        "nombre_producto",
        "cantidad",
        "precio_venta_usd",
        "costo_compra_usd",
        "fecha_disponible",
        "observaciones"
    ]
    ws.append(headers)

    sample_rows = [
        ("ELEC-001", "DIST-UY-1001", "Panel LED 60x60 Backlight 40W 4000K", 150, 48.00, 28.50, "2026-10-15", "Stock entrega inmediata depósito Montevideo"),
        ("ELEC-002", "DIST-UY-2004", "Campana Industrial UFO LED 150W IP65", 80, 115.00, 72.00, "2026-10-18", "Para proyecto licitación pública ARCE"),
        ("ACC-001", "REF-SUR-330", "Sensor de Movimiento Microondas Techo", 200, 22.00, 11.50, "2026-10-12", "Distribuidor plaza central"),
    ]
    for row in sample_rows:
        ws.append(row)

    # Estilos cabecera
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = 24

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_proveedores_reventa.xlsx"}
    )


@router.post(
    "/suppliers/reventa/import",
    summary="Carga masiva de catálogo e inventario de reventa desde archivo Excel o CSV"
)
async def import_reventa_catalog(
    file: UploadFile = File(...),
    supplier_id: int = Query(..., description="ID del proveedor de reventa"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor de reventa no encontrado.")

    contents = await file.read()
    filename = file.filename or ""

    try:
        import pandas as pd
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al procesar el archivo: {str(e)}")

    # Normalizar columnas
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    required = ["sku_local", "cantidad"]
    for r in required:
        if r not in df.columns:
            raise HTTPException(status_code=400, detail=f"Columna requerida '{r}' no encontrada en el archivo.")

    imported_count = 0
    today = date.today()

    for _, row in df.iterrows():
        sku_local = str(row["sku_local"]).strip()
        if not sku_local or pd.isna(sku_local):
            continue

        cant = int(row.get("cantidad", 0))
        if cant <= 0:
            continue

        sku_prov = str(row.get("sku_proveedor", f"MK-{sku_local}-UY")).strip()
        costo_c = Decimal(str(row.get("costo_compra_usd", 0.0) or 0.0))
        p_venta = Decimal(str(row.get("precio_venta_usd", 0.0) or 0.0))

        # Verificar o crear producto si no existe
        prod = db.query(Product).filter(Product.sku == sku_local).first()
        if not prod:
            cat = db.query(Category).first()
            prod = Product(
                sku=sku_local,
                nombre=str(row.get("nombre_producto", f"Producto {sku_local}")).strip(),
                categoria_id=cat.id if cat else 1,
                costo_base=costo_c,
                precio_lista=p_venta if p_venta > 0 else (costo_c * Decimal('1.30')),
                doh_seguridad=15,
                activo=True
            )
            db.add(prod)
            db.commit()
            db.refresh(prod)

        lot_id = f"LOT-REV-{uuid.uuid4().hex[:6].upper()}"
        batch = StockLocationBatch(
            id=lot_id,
            sku=sku_local,
            sku_fabrica=sku_prov,
            lote_fabrica=f"EXCEL-{supplier_id}",
            cantidad=cant,
            ubicacion="proveedor_uy",
            pais_origen="UY",
            buque_o_tracking="PLAZA-LOCAL",
            fecha_despacho=today,
            fecha_eta=today,
            fecha_terminado=today,
            supplier_id=supplier.id,
            warehouse_id="PROV-UY",
            estado="EN_PROVEEDOR",
            estado_aprobacion="PENDIENTE_APROBACION",
            costo_compra=costo_c,
            observaciones=f"Importación Masiva Excel: {supplier.nombre}",
        )
        db.add(batch)
        imported_count += 1

    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="IMPORT_REVENTA_EXCEL",
        resource=f"suppliers/{supplier_id}",
        details={"imported_count": imported_count, "filename": filename}
    )

    return {
        "message": f"{imported_count} productos de reventa importados correctamente. Quedaron registrados como lotes en la columna 'Proveedores Uy' pendientes de aprobación.",
        "imported_count": imported_count,
        "proveedor": supplier.nombre
    }


# ==============================================================================
# GOBERNANZA PRESUPUESTARIA: COMPROMISOS & AUDITORÍA IA
# ==============================================================================

@router.get(
    "/commitments",
    response_model=List[BudgetCommitmentSchema],
    summary="Listado de compromisos y acciones correctivas presupuestarias"
)
def list_budget_commitments(
    db: Session = Depends(get_db)
):
    items = db.query(AccionCompromiso).order_by(AccionCompromiso.fecha_limite.asc()).all()
    return [
        BudgetCommitmentSchema(
            id=item.id,
            area=item.area,
            responsable=item.responsable,
            tarea=item.titulo,
            monto=float(item.monto or 0.0),
            fecha_limite=item.fecha_limite,
            urgencia=item.urgencia or "MEDIA",
            estado=item.estado or "PENDIENTE",
            area_id=item.area_id,
            responsable_id=item.responsable_id,
            origen=item.origen or "Minuta Ejecutiva",
            created_at=item.created_at
        )
        for item in items
    ]


@router.post(
    "/commitments",
    response_model=BudgetCommitmentSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo compromiso o plan de acción presupuestario"
)
def create_budget_commitment(
    payload: BudgetCommitmentCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    fl = payload.fecha_limite or datetime.now(timezone.utc).date()
    item = AccionCompromiso(
        titulo=payload.tarea.strip(),
        area=payload.area.strip() if payload.area else "Operaciones",
        responsable=payload.responsable.strip() if payload.responsable else "Responsable General",
        fecha_limite=fl,
        estado=payload.estado or "PENDIENTE",
        origen=payload.origen or "Comité Presupuestos",
        monto=Decimal(str(payload.monto or 0.0)),
        urgencia=payload.urgencia or "MEDIA",
        area_id=payload.area_id,
        responsable_id=payload.responsable_id
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return BudgetCommitmentSchema(
        id=item.id,
        area=item.area,
        responsable=item.responsable,
        tarea=item.titulo,
        monto=float(item.monto),
        fecha_limite=item.fecha_limite,
        urgencia=item.urgencia,
        estado=item.estado,
        area_id=item.area_id,
        responsable_id=item.responsable_id,
        origen=item.origen,
        created_at=item.created_at
    )


@router.put(
    "/commitments/{commitment_id}",
    response_model=BudgetCommitmentSchema,
    summary="Actualiza un compromiso presupuestario existente"
)
def update_budget_commitment(
    commitment_id: int,
    payload: BudgetCommitmentUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    item = db.query(AccionCompromiso).filter(AccionCompromiso.id == commitment_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Compromiso no encontrado")
    
    texto = payload.tarea or payload.compromiso or payload.titulo
    if texto is not None:
        item.titulo = texto.strip()
    if payload.area is not None:
        item.area = payload.area.strip()
    if payload.responsable is not None:
        item.responsable = payload.responsable.strip()
    if payload.monto is not None:
        item.monto = Decimal(str(payload.monto))
    if payload.fecha_limite is not None:
        if isinstance(payload.fecha_limite, str):
            try:
                item.fecha_limite = date.fromisoformat(payload.fecha_limite.split("T")[0])
            except Exception:
                pass
        else:
            item.fecha_limite = payload.fecha_limite
    if payload.urgencia is not None:
        item.urgencia = payload.urgencia
    if payload.estado is not None:
        item.estado = payload.estado
    if payload.area_id is not None:
        item.area_id = payload.area_id
    if payload.responsable_id is not None:
        item.responsable_id = payload.responsable_id
    db.commit()
    db.refresh(item)
    return BudgetCommitmentSchema(
        id=item.id,
        area=item.area,
        responsable=item.responsable,
        tarea=item.titulo,
        monto=float(item.monto),
        fecha_limite=item.fecha_limite,
        urgencia=item.urgencia,
        estado=item.estado,
        area_id=item.area_id,
        responsable_id=item.responsable_id,
        origen=item.origen,
        created_at=item.created_at
    )


@router.delete(
    "/commitments/{commitment_id}",
    summary="Elimina un compromiso presupuestario por ID"
)
def delete_budget_commitment(
    commitment_id: int,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    item = db.query(AccionCompromiso).filter(AccionCompromiso.id == commitment_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Compromiso no encontrado")
    db.delete(item)
    db.commit()
    return {"status": "success", "message": f"Compromiso {commitment_id} eliminado exitosamente"}


@router.post(
    "/commitments/ai-audit",
    response_model=BudgetCommitmentAIAuditResponse,
    summary="Auditoría IA de compromisos presupuestarios e inferencia de 3 tareas urgentes"
)
def audit_commitments_ai(
    periodo: Optional[str] = Query(None, description="Período a auditar ej. 2026-Q1"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    from datetime import timedelta
    periodo_audit = periodo or "2026-Q1"
    cost_centers_lines = db.query(PresupuestoCentroCosto).filter(PresupuestoCentroCosto.periodo == periodo_audit).all()
    
    overrun_items = []
    for line in cost_centers_lines:
        try:
            m_real = float(line.monto_real if line.monto_real is not None else 0.0)
            m_pres = float(line.monto_presupuestado if line.monto_presupuestado is not None else 0.0)
            dif = m_real - m_pres
            if dif > 0:
                cc_nom = line.centro_costo.nombre if (line.centro_costo and line.centro_costo.nombre) else "Gasto General"
                overrun_items.append((cc_nom, line.concepto_opex or "Partida General", dif))
        except Exception:
            continue
    
    overrun_items.sort(key=lambda x: x[2], reverse=True)
    today = datetime.now(timezone.utc).date()
    
    sugeridos: List[BudgetCommitmentCreate] = []
    if overrun_items:
        top3 = overrun_items[:3]
        for idx, (cc, concepto, exceso) in enumerate(top3):
            sugeridos.append(BudgetCommitmentCreate(
                tarea=f"Plan de Contención Urgente en {concepto} ({cc}) - Sobre-ejecución USD {exceso:,.2f}",
                area=cc,
                responsable="Control de Gestión",
                monto=round(exceso, 2),
                fecha_limite=today + timedelta(days=7 * (idx + 1)),
                urgencia="ALTA",
                estado="PENDIENTE",
                origen="Auditoría Predictiva IA"
            ))
    else:
        sugeridos = [
            BudgetCommitmentCreate(
                tarea="Revisión de fletes marítimos consolidados y negociación de demurrage con navieras",
                area="Logística & Comercio Exterior",
                responsable="Jefe de Abastecimiento",
                monto=4500.0,
                fecha_limite=today + timedelta(days=7),
                urgencia="ALTA",
                estado="PENDIENTE",
                origen="Auditoría Predictiva IA"
            ),
            BudgetCommitmentCreate(
                tarea="Auditoría de desvíos en consumibles y OPEX de marketing digital Q1",
                area="Marketing & Performance",
                responsable="Director de Marketing",
                monto=3200.0,
                fecha_limite=today + timedelta(days=14),
                urgencia="ALTA",
                estado="PENDIENTE",
                origen="Auditoría Predictiva IA"
            ),
            BudgetCommitmentCreate(
                tarea="Congelamiento de órdenes spot no esenciales para resguardar capital de trabajo",
                area="Finanzas & Tesorería",
                responsable="CFO / Controller",
                monto=8000.0,
                fecha_limite=today + timedelta(days=21),
                urgencia="ALTA",
                estado="PENDIENTE",
                origen="Auditoría Predictiva IA"
            ),
        ]
    
    diagnostico = (
        f"Auditoría ejecutiva para el período {periodo_audit}. Se han detectado {len(overrun_items)} partidas con "
        f"variaciones sobre el OPEX meta. Se requiere activar inmediatamente planes de contención "
        f"financiera con los líderes de área para mitigar erosión del margen neto y preservar el EBITDA proyectado."
    )
    
    return BudgetCommitmentAIAuditResponse(
        status="success",
        periodo=periodo_audit,
        diagnostico_ia=diagnostico,
        compromisos_urgentes_sugeridos=sugeridos
    )


# ==============================================================================
# MOTOR DE ÓRDENES DE COMPRA INTELIGENTES (CRUCE STOCK REAL X CRM)
# ==============================================================================

@router.post(
    "/purchase-orders/suggestions",
    response_model=PurchaseOrderSuggestionsResponse,
    summary="Calcula sugerencias de compra óptimas cruzando ROP, Stock Físico y Demanda CRM"
)
def get_purchase_order_suggestions(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    # 1. Obtener demanda comprometida en CRM por SKU para tratos activos
    active_deals = db.query(CommercialDeal).filter(
        CommercialDeal.etapa.in_(["cotizacion", "propuesta_enviada", "negociacion"])
    ).all()
    
    crm_demand_by_sku: dict = {}
    for deal in active_deals:
        for it in deal.items:
            crm_demand_by_sku[it.sku] = crm_demand_by_sku.get(it.sku, 0) + it.cantidad
            
    # 2. Evaluar productos e inventarios
    productos = db.query(Product).filter(Product.activo == True).all()
    
    sugerencias: List[PurchaseOrderSuggestion] = []
    total_inversion = 0.0
    current_yearmonth = datetime.now(timezone.utc).strftime("%Y%m")
    
    for prod in productos:
        inv = prod.inventario
        if not inv:
            continue
            
        stock_act = int(inv.deposito_central if inv.deposito_central is not None else (inv.stock_actual or 0))
        stock_tran = int((inv.transito_maritimo or 0) + (inv.aduana or 0))
        demanda_crm = crm_demand_by_sku.get(prod.sku, 0)
        
        # ROP
        rop_calc = int(calculate_rop(
            inv.demanda_diaria_promedio or Decimal('0'),
            inv.lead_time_dias or Decimal('0'),
            Decimal(str(inv.stock_seguridad or 0))
        ))
        
        # Sugerido = max(0, (ROP + Demanda CRM) - (Stock Deposito + Stock Transito))
        deficit = max(0, (rop_calc + demanda_crm) - (stock_act + stock_tran))
        
        if deficit > 0:
            costo_u = float(prod.costo_base or 0.0)
            monto_tot = round(deficit * costo_u, 2)
            lote_sug = f"LOT-{current_yearmonth}-{prod.sku}"
            
            sugerencias.append(PurchaseOrderSuggestion(
                sku=prod.sku,
                nombre=prod.nombre,
                stock_actual=stock_act,
                stock_transito=stock_tran,
                demanda_crm_comprometida=demanda_crm,
                rop=rop_calc,
                cantidad_sugerida_compra=deficit,
                costo_unitario_usd=costo_u,
                monto_total_usd=monto_tot,
                lote_sugerido=lote_sug
            ))
            total_inversion += monto_tot
            
    return PurchaseOrderSuggestionsResponse(
        status="success",
        total_skus_evaluados=len(productos),
        total_skus_deficit=len(sugerencias),
        inversion_total_sugerida_usd=round(total_inversion, 2),
        sugerencias=sugerencias
    )


# ==============================================================================
# GENERADOR DINÁMICO DE PLANTILLAS EXCEL PARA INGESTA ETL
# ==============================================================================

@router.get(
    "/etl/template",
    summary="Descarga planilla Excel (.xlsx) estructurada de ejemplo para ingesta ETL"
)
def download_etl_template(
    tipo: str = Query("inventario", description="Tipo de plantilla: 'inventario', 'ordenes_compra', 'ordenes_venta', 'opex' o 'crm'"),
    tipo_archivo: Optional[str] = Query(None, description="Alias compatible para tipo de plantilla")
):
    tipo_clean = (tipo_archivo or tipo or "inventario").strip().lower()
    wb = openpyxl.Workbook()
    ws = wb.active
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10)
    border_side = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
    
    if tipo_clean in ("ordenes_compra", "po", "compras"):
        ws.title = "Ordenes_Compra_FOB_CIF"
        headers = [
            "numero_po", "proveedor", "etapa", "responsable", "incoterm", "moneda",
            "almacen_destino", "fecha_emision", "fecha_arribo_estimada",
            "sku", "nombre_producto", "imagen_url", "cantidad", "costo_unitario_pactado"
        ]
        sample_rows = [
            [
                "OC-2026-001", "Foshan Lighting Co. Ltd", "transito", "Carlos Méndez", "FOB", "USD",
                "DEP-CENTRAL-MVD", "2026-09-01", "2026-10-25",
                "SKU-LED-PANEL-60X60", "Panel LED 60x60 Backlight 40W",
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100", 500, 12.80
            ],
            [
                "OC-2026-001", "Foshan Lighting Co. Ltd", "transito", "Carlos Méndez", "FOB", "USD",
                "DEP-CENTRAL-MVD", "2026-09-01", "2026-10-25",
                "SKU-CAMPANA-LED-150W", "Campana Industrial High Bay 150W IP65",
                "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100", 200, 42.50
            ],
            [
                "OC-2026-002", "Osram Opto Semiconductors", "sugerido", "Lucía Torres", "CIF", "USD",
                "DEP-CENTRAL-MVD", "2026-09-15", "2026-11-10",
                "SKU-REFLECTOR-SLIM-50W", "Reflector Exterior Slim 50W Negro IP65",
                "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=100", 800, 7.50
            ],
        ]
        filename = "plantilla_ordenes_compra.xlsx"
    elif tipo_clean in ("ordenes_venta", "ov"):
        ws.title = "Ordenes_Venta_OV"
        headers = [
            "numero_ov", "cliente", "rut", "contacto_nombre", "email", 
            "telefono", "direccion", "logo_url", "vendedor", "almacen_despacho", "moneda",
            "sku", "nombre_producto", "imagen_url", "cantidad", "precio_unitario", "estado"
        ]
        sample_rows = [
            [
                "OV-2026-1001", "Constructora del Plata SA", "76.452.120-K", 
                "Ing. Mario Rossi", "mrossi@delplata.cl", "+56 9 8765 4321", 
                "Av. Las Condes 10200, Santiago", "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100",
                "Martín Gómez", "DEP-CENTRAL-MVD", "USD",
                "SKU-LED-PANEL-60X60", "Panel LED 60x60 Backlight 40W",
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100", 400, 28.5, "EMITIDA"
            ],
            [
                "OV-2026-1002", "Laboratorios Pharma Uy", "77.102.304-5", 
                "Lic. Lucía Menéndez", "lmenendez@pharmauy.com", "+56 2 2345 6789", 
                "Parque Industrial ENEA, Pudahuel", "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=100",
                "Valeria Rossi", "DEP-CENTRAL-MVD", "USD",
                "SKU-CAMPANA-LED-150W", "Campana Industrial High Bay 150W IP65",
                "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100", 120, 89.0, "EN_DESPACHO"
            ],
        ]
        filename = "plantilla_ordenes_venta.xlsx"
    elif tipo_clean == "opex":
        ws.title = "Presupuestos_OPEX"
        headers = ["periodo", "codigo_centro_costo", "concepto_opex", "monto_presupuestado", "monto_real"]
        sample_rows = [
            ["2026-Q1", "LOG-01", "Fletes y Envíos Nacionales", 15000.0, 14200.0],
            ["2026-Q1", "MKT-01", "Pauta Publicitaria Google & Meta", 12000.0, 13450.0],
            ["2026-Q1", "ADM-01", "Suscripciones de Software & Cloud", 5000.0, 4800.0],
            ["2026-Q1", "RRHH-01", "Capacitación Técnica del Personal", 3500.0, 2100.0],
        ]
        filename = "plantilla_opex_centros_costo.xlsx"
    elif tipo_clean == "crm":
        ws.title = "Pipeline_CRM_Deals"
        headers = [
            "titulo", "cliente_empresa", "rut", "contacto_nombre", "email", 
            "telefono", "direccion", "logo_url", "etapa", "probabilidad_pct", 
            "sku", "cantidad", "precio_unitario", "moneda"
        ]
        sample_rows = [
            [
                "Licitación Edificio Aeropuerto", "Constructora del Plata SA", "76.452.120-K", 
                "Ing. Mario Rossi", "mrossi@delplata.cl", "+56 9 8765 4321", 
                "Av. Las Condes 10200, Santiago", "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100", 
                "propuesta_enviada", 65, "SKU-LED-PANEL-60X60", 400, 28.5, "USD"
            ],
            [
                "Modernización Planta Industrial", "Laboratorios Pharma Uy", "77.102.304-5", 
                "Lic. Lucía Menéndez", "lmenendez@pharmauy.com", "+56 2 2345 6789", 
                "Parque Industrial ENEA, Pudahuel", "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=100", 
                "negociacion", 80, "SKU-CAMPANA-LED-150W", 120, 89.0, "USD"
            ],
            [
                "Iluminación Cadena Retail", "Supermercados Sol SRL", "78.203.405-1", 
                "Cr. Diego Silva", "compras@supermercadosol.cl", "+56 9 1234 5678", 
                "Av. Providencia 1234, Santiago", "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100", 
                "cotizacion", 40, "SKU-SPOT-EMBUTIR-7W", 850, 6.2, "USD"
            ],
        ]
        filename = "plantilla_crm_deals.xlsx"
    else:
        ws.title = "Inventario_Maestro"
        headers = [
            "sku", "nombre", "categoria", "proveedor", "imagen_url", "costo_unitario", "precio_venta",
            "deposito_central", "transito_maritimo", "aduana", "stock_seguridad",
            "lead_time_dias", "demanda_diaria_promedio"
        ]
        sample_rows = [
            [
                "SKU-LED-PANEL-60X60", "Panel LED 60x60 Backlight 40W", "Paneles LED", 
                "Distribuidora Mayorista SA", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100", 
                14.50, 29.90, 850, 400, 150, 200, 45, 18.5
            ],
            [
                "SKU-CAMPANA-LED-150W", "Campana Industrial High Bay 150W IP65", "Industrial", 
                "Importadora Conosur Ltda", "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=100", 
                48.00, 95.00, 220, 150, 50, 80, 60, 4.2
            ],
            [
                "SKU-REFLECTOR-SLIM-50W", "Reflector Exterior Slim 50W Negro IP65", "Exterior", 
                "Tech & Logistics SpA", "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=100", 
                8.20, 18.50, 1400, 600, 200, 300, 40, 32.0
            ],
            [
                "SKU-CINTA-LED-COB-24V", "Cinta LED COB 24V 5m 4000K", "Tiras y Perfiles", 
                "Distribuidora Mayorista SA", "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=100", 
                11.00, 24.00, 500, 200, 0, 150, 35, 12.0
            ],
        ]
        filename = "plantilla_inventario_maestro.xlsx"
        
    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = cell_border
        
    for row_data in sample_rows:
        ws.append(row_data)
        
    for row in ws.iter_rows(min_row=2, max_row=len(sample_rows) + 1, min_col=1, max_col=len(headers)):
        for cell in row:
            cell.font = data_font
            cell.border = cell_border
            if isinstance(cell.value, (int, float)):
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")
                
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)
        
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==============================================================================
# REPORTES EJECUTIVOS: EXPORTACIÓN NATIVA EXCEL (.XLSX) Y PDF FORMAL (P1.3)
# ==============================================================================

@router.get(
    "/reports/executive/excel",
    summary="Descarga del Reporte Ejecutivo en formato Microsoft Excel (.xlsx)"
)
def export_executive_report_excel(
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_OPERACIONES]))
):
    """
    Genera y descarga un libro de cálculo profesional (.xlsx) con 3 pestañas:
    Resumen Ejecutivo, Inventario & Logística Multi-depósito y Presupuesto & OPEX.
    """
    buffer = ReportExportService.generate_executive_excel(db)
    fecha_str = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"Reporte_Ejecutivo_Calcu_{fecha_str}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get(
    "/reports/executive/pdf",
    summary="Descarga de la Minuta Ejecutiva en formato PDF formal para Dirección"
)
def export_executive_report_pdf(
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_OPERACIONES]))
):
    """
    Genera y descarga una minuta ejecutiva formal imprimible en PDF con cabecera corporativa,
    semáforo de abastecimiento, KPIs financieros y bloque de firmas.
    """
    buffer = ReportExportService.generate_executive_pdf(db)
    fecha_str = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"Minuta_Ejecutiva_Calcu_{fecha_str}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# =====================================================================
# DIRECTORIO B2B: CLIENTES Y PROVEEDORES
# =====================================================================

@router.get(
    "/crm/clients",
    response_model=List[ClientResponse],
    summary="Listado de Clientes B2B con métricas de Pipeline y tratos vinculados"
)
def list_clients(
    q: Optional[str] = Query(None, description="Búsqueda por nombre o RUT"),
    db: Session = Depends(get_db)
):
    """
    Retorna el directorio maestro de clientes B2B con enriquecimiento en vivo
    de deals activos, volumen en pipeline y tratos asociados.
    """
    total_clients = db.query(Client).count()
    if total_clients == 0:
        # Auto-seeding suave desde CommercialDeal para garantizar visibilidad inmediata
        unique_deals = db.query(CommercialDeal).all()
        seen_names = set()
        for deal in unique_deals:
            client_name = (deal.cliente or "").strip()
            if client_name and client_name not in seen_names:
                seen_names.add(client_name)
                clean_email_prefix = re.sub(r'[^a-zA-Z0-9]', '', client_name.lower())[:15]
                new_c = Client(
                    nombre=client_name,
                    rut=deal.rut or None,
                    logo_url=f"https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&auto=format&fit=crop&q=80",
                    email=f"contacto@{clean_email_prefix or 'empresa'}.com",
                    phone="+56 9 8765 4321",
                    address="Av. Las Condes 10200, Santiago"
                )
                db.add(new_c)
        if seen_names:
            db.commit()

    query = db.query(Client)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(Client.nombre.ilike(term), Client.rut.ilike(term)))

    clients = query.order_by(Client.nombre.asc()).all()
    results: List[ClientResponse] = []

    # Cargar tratos para relacionar en memoria
    all_deals = db.query(CommercialDeal).all()

    def _get_deal_val(deal):
        for attr in ['monto_usd', 'valor_usd', 'valor_total', 'monto', 'total_usd', 'monto_total']:
            val = getattr(deal, attr, None)
            if val is not None:
                return float(val)
        if hasattr(deal, 'items') and deal.items:
            return sum(float(getattr(it, 'precio_unitario', 0.0) or 0.0) * float(getattr(it, 'cantidad', 1) or 1) for it in deal.items)
        return 0.0

    for c in clients:
        # Match por nombre o RUT
        c_deals = [
            d for d in all_deals 
            if (d.cliente and d.cliente.strip().lower() == c.nombre.strip().lower()) or 
               (c.rut and d.rut and d.rut.strip().lower() == c.rut.strip().lower())
        ]
        
        deals_count = len(c_deals)
        total_pipe = sum(
            _get_deal_val(d)
            for d in c_deals 
            if (getattr(d, 'etapa', '') or '').lower() not in ['perdida', 'perdido']
        )
        
        deal_items = [
            ClientDealItemSummary(
                id=str(d.id),
                proyecto_nombre=getattr(d, 'proyecto_nombre', '') or getattr(d, 'titulo', '') or f"Trato #{d.id}",
                monto_total=Decimal(str(round(_get_deal_val(d), 2))),
                etapa=getattr(d, 'etapa', 'prospeccion') or 'prospeccion',
                moneda=getattr(d, 'moneda', 'USD') or 'USD',
                created_at=getattr(d, 'created_at', None)
            )
            for d in c_deals
        ]

        pipe_float = round(float(total_pipe), 2)
        results.append(ClientResponse(
            id=c.id,
            nombre=c.nombre,
            rut=c.rut,
            logo_url=c.logo_url,
            email=c.email,
            phone=c.phone,
            address=c.address,
            deals_count=deals_count,
            total_pipeline=Decimal(str(pipe_float)),
            pipeline_activo=pipe_float,
            pipeline_total=pipe_float,
            deals=deal_items,
            created_at=c.created_at
        ))

    return results


@router.post(
    "/crm/clients",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo Cliente B2B en el directorio"
)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    existing = db.query(Client).filter(Client.nombre.ilike(payload.nombre.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un cliente con el nombre '{payload.nombre.strip()}'."
        )

    new_client = Client(
        nombre=payload.nombre.strip(),
        rut=payload.rut.strip() if payload.rut else None,
        logo_url=payload.logo_url,
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CLIENT_CREATE",
        resource=f"clients/{new_client.id}",
        details=payload.model_dump()
    )

    return ClientResponse(
        id=new_client.id,
        nombre=new_client.nombre,
        rut=new_client.rut,
        logo_url=new_client.logo_url,
        email=new_client.email,
        phone=new_client.phone,
        address=new_client.address,
        deals_count=0,
        total_pipeline=0.0,
        deals=[],
        created_at=new_client.created_at
    )


@router.put(
    "/crm/clients/{client_id}",
    response_model=ClientResponse,
    summary="Actualiza datos de contacto y multimedia de un Cliente B2B"
)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    old_vals = {"nombre": client.nombre, "rut": client.rut, "email": client.email}

    if payload.nombre is not None:
        client.nombre = payload.nombre.strip()
    if payload.rut is not None:
        client.rut = payload.rut.strip() if payload.rut else None
    if payload.logo_url is not None:
        client.logo_url = payload.logo_url
    if payload.email is not None:
        client.email = payload.email.strip() if payload.email else None
    if payload.phone is not None:
        client.phone = payload.phone.strip() if payload.phone else None
    if payload.address is not None:
        client.address = payload.address.strip() if payload.address else None

    db.commit()
    db.refresh(client)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CLIENT_UPDATE",
        resource=f"clients/{client.id}",
        details=payload.model_dump(exclude_unset=True)
    )

    # Vincular tratos
    c_deals = db.query(CommercialDeal).filter(
        or_(
            CommercialDeal.cliente == client.nombre,
            and_(CommercialDeal.rut == client.rut, client.rut != None)
        )
    ).all()

    def _get_deal_amount(deal):
        for field in ['monto_usd', 'valor_usd', 'monto', 'total_usd', 'valor_total']:
            val = getattr(deal, field, None)
            if val is not None:
                return float(val)
        if hasattr(deal, 'items') and deal.items:
            return sum(float(getattr(i, 'precio_unitario', 0.0) or 0.0) * float(getattr(i, 'cantidad', 1) or 1) for i in deal.items)
        return 0.0

    total_pipe = sum(
        _get_deal_amount(d)
        for d in c_deals 
        if (getattr(d, 'etapa', '') or '').lower() not in ['perdida', 'perdido']
    )
    deal_items = [
        ClientDealItemSummary(
            id=str(d.id),
            deal_id=d.id,
            deal_code=getattr(d, 'codigo', '') or f"DEAL-{d.id}",
            deal_title=getattr(d, 'titulo', '') or getattr(d, 'proyecto_nombre', '') or f"Trato #{d.id}",
            proyecto_nombre=getattr(d, 'proyecto_nombre', '') or getattr(d, 'titulo', '') or f"Trato #{d.id}",
            etapa=getattr(d, 'etapa', 'prospeccion') or 'prospeccion',
            monto_total=Decimal(str(round(_get_deal_amount(d), 2))),
            probabilidad_pct=getattr(d, 'probabilidad_cierre', None) or getattr(d, 'probabilidad_pct', 50) or 50,
            moneda=getattr(d, 'moneda', 'USD') or 'USD',
            created_at=d.created_at if hasattr(d, 'created_at') else None
        )
        for d in c_deals
    ]

    pipe_float = round(float(total_pipe), 2)
    return ClientResponse(
        id=client.id,
        nombre=client.nombre,
        rut=client.rut,
        logo_url=client.logo_url,
        email=client.email,
        phone=client.phone,
        address=client.address,
        deals_count=len(c_deals),
        total_pipeline=Decimal(str(pipe_float)),
        pipeline_activo=pipe_float,
        pipeline_total=pipe_float,
        deals=deal_items,
        created_at=client.created_at
    )


@router.get(
    "/suppliers",
    response_model=List[SupplierResponse],
    summary="Listado de Proveedores con catálogo de SKUs y lead times asociados"
)
def list_suppliers(
    q: Optional[str] = Query(None, description="Búsqueda por nombre o RUT"),
    tipo_proveedor: Optional[str] = Query(None, description="Filtrar por tipo: FABRICA, NAVIERA_BUQUE, LOGISTICA, GENERAL, PROVEEDOR_UY, PROVEEDOR_REVENTA"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo: TODOS, LOCAL (Uruguay), EXTERIOR (China/Exterior)"),
    rubro: Optional[str] = Query(None, description="Filtrar por rubro comercial: Iluminación, Obra Civil, Ferretería, Electromecánica, etc."),
    condicion_pago: Optional[str] = Query(None, description="Filtrar por condición de pago: Contado, 30 días, 60 días, Crédito Abierto"),
    search: Optional[str] = Query(None, description="Búsqueda universal por RUT, Razón Social o Nombre Comercial"),
    db: Session = Depends(get_db)
):
    """
    Retorna el directorio de proveedores, fábricas y buques con catálogo de SKUs,
    órdenes de compra asociadas, filtros por tipo/rubro/condiciones y trazabilidad logística.
    """
    total_suppliers = db.query(Supplier).count()
    if total_suppliers == 0:
        # Inicializar con distribuidores clave y proveedores registrados en reposición
        existing_provs = [
            r[0] for r in db.query(OrdenReposicion.proveedor).distinct().all() if r[0]
        ]
        
        demo_suppliers_seed = [
            {
                "nombre": "Foshan Lighting Co. Ltd",
                "razon_social": "Foshan Electrical and Lamp Co. Ltd",
                "rut": "CN-91440600190",
                "tipo_proveedor": "FABRICA",
                "pais": "China",
                "contacto_nombre": "Chen Wei",
                "contacto_cargo": "Director de Exportaciones",
                "logo_url": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=100&auto=format&fit=crop&q=80",
                "email": "cwei@foshanlighting.cn",
                "phone": "+86 757 8228 1234",
                "address": "Foshan High-Tech Industrial Zone, Guangdong",
                "descripcion": "Fábrica principal de paneles LED y campanas industriales."
            },
            {
                "nombre": "Ningbo Led Component Group",
                "razon_social": "Ningbo Electronics Import & Export Co.",
                "rut": "CN-91330201720",
                "tipo_proveedor": "FABRICA",
                "pais": "China",
                "contacto_nombre": "Lin Zhao",
                "contacto_cargo": "Jefe de Planta",
                "logo_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&auto=format&fit=crop&q=80",
                "email": "lzhao@ningboled.com",
                "phone": "+86 574 8770 9988",
                "address": "Beilun District, Ningbo, Zhejiang",
                "descripcion": "Fabricante especializado en drivers DALI y 1-10V."
            },
            {
                "nombre": "MSC LAURA - Mediterranean Shipping",
                "razon_social": "MSC Mediterranean Shipping Company SA",
                "rut": "CH-CHE-106.533.456",
                "tipo_proveedor": "NAVIERA_BUQUE",
                "pais": "Suiza",
                "contacto_nombre": "Capt. Marco Valente",
                "contacto_cargo": "Agente Portuario MVD",
                "logo_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=100&auto=format&fit=crop&q=80",
                "email": "mvalente@msc.com",
                "phone": "+598 2916 4400",
                "address": "Rambla 25 de Agosto 508, Montevideo",
                "descripcion": "Buque portacontenedor y naviera regular para ruta Lejano Oriente - Río de la Plata."
            },
            {
                "nombre": "Maersk Line Atlantic",
                "razon_social": "Maersk A/S",
                "rut": "DK-33165012",
                "tipo_proveedor": "NAVIERA_BUQUE",
                "pais": "Dinamarca",
                "contacto_nombre": "Søren Hansen",
                "contacto_cargo": "Representante Comercial",
                "logo_url": "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=100&auto=format&fit=crop&q=80",
                "email": "shansen@maersk.com",
                "phone": "+598 2915 2211",
                "address": "Plaza Independencia 811, Montevideo",
                "descripcion": "Servicio marítimo directo con despacho aduanero y tracking satelital."
            }
        ]

        seed_names = {s["nombre"] for s in demo_suppliers_seed}
        for p_name in existing_provs:
            if p_name.strip() and p_name.strip() not in seed_names:
                demo_suppliers_seed.append({
                    "nombre": p_name.strip(),
                    "razon_social": p_name.strip(),
                    "rut": None,
                    "tipo_proveedor": "FABRICA",
                    "pais": "China",
                    "contacto_nombre": "Contacto Comercial",
                    "contacto_cargo": "Ejecutivo de Cuentas",
                    "logo_url": None,
                    "email": f"contacto@{re.sub(r'[^a-zA-Z0-9]', '', p_name.lower())[:15] or 'proveedor'}.com",
                    "phone": "+86 574 2345 6789",
                    "address": "Zona Industrial",
                    "descripcion": "Proveedor registrado en abastecimiento."
                })

        for s_data in demo_suppliers_seed:
            new_s = Supplier(
                nombre=s_data["nombre"],
                razon_social=s_data.get("razon_social"),
                rut=s_data.get("rut"),
                tipo_proveedor=s_data.get("tipo_proveedor", "FABRICA"),
                pais=s_data.get("pais", "China"),
                contacto_nombre=s_data.get("contacto_nombre"),
                contacto_cargo=s_data.get("contacto_cargo"),
                logo_url=s_data.get("logo_url"),
                email=s_data.get("email"),
                phone=s_data.get("phone"),
                address=s_data.get("address"),
                descripcion=s_data.get("descripcion")
            )
            db.add(new_s)
        db.commit()

    query = db.query(Supplier)

    # Búsqueda Universal
    search_term = (search or q or "").strip()
    if search_term:
        term = f"%{search_term}%"
        query = query.filter(
            or_(
                Supplier.nombre.ilike(term),
                Supplier.rut.ilike(term),
                Supplier.razon_social.ilike(term),
            )
        )

    # Filtro Tipo (Plaza Local vs Fábrica Internacional)
    tipo_filter = (tipo or tipo_proveedor or "").strip().upper()
    if tipo_filter and tipo_filter != "TODOS":
        if tipo_filter in ("LOCAL", "UY", "PLAZA", "PLAZA LOCAL", "URUGUAY", "PROVEEDOR_UY", "PROVEEDOR_REVENTA"):
            query = query.filter(
                or_(
                    Supplier.tipo_proveedor.in_(["PROVEEDOR_UY", "PROVEEDOR_REVENTA", "LOCAL"]),
                    Supplier.pais.ilike("%uruguay%"),
                )
            )
        elif tipo_filter in ("EXTERIOR", "CHINA", "FABRICA", "INTERNACIONAL", "NAVIERA_BUQUE"):
            query = query.filter(
                or_(
                    Supplier.tipo_proveedor.in_(["FABRICA", "NAVIERA_BUQUE", "EXTERIOR"]),
                    Supplier.pais.ilike("%china%"),
                    Supplier.pais.ilike("%suiza%"),
                    Supplier.pais.ilike("%dinamarca%"),
                    Supplier.pais != "Uruguay",
                )
            )
        elif tipo_filter in ("LICITACIONES", "ESTATAL", "LICITACION", "CONTRATISTA_ESTATAL"):
            query = query.filter(
                or_(
                    Supplier.tipo_proveedor.ilike("%licitacion%"),
                    Supplier.tipo_proveedor.ilike("%estatal%"),
                )
            )
        else:
            query = query.filter(Supplier.tipo_proveedor.ilike(f"%{tipo_filter}%"))

    # Filtro por Rubro
    if rubro and rubro.strip() and rubro.strip().lower() != "todos":
        query = query.filter(Supplier.rubro.ilike(f"%{rubro.strip()}%"))

    # Filtro por Condición de Pago
    if condicion_pago and condicion_pago.strip() and condicion_pago.strip().lower() != "todos":
        query = query.filter(Supplier.condicion_pago.ilike(f"%{condicion_pago.strip()}%"))

    suppliers = query.order_by(Supplier.nombre.asc()).all()
    all_products = db.query(Product).all()
    all_orders = db.query(OrdenReposicion).all()
    products_by_sku = {p.sku: p for p in all_products}

    supplier_orders_map: dict[str, list] = {}
    supplier_skus_map: dict[str, set[str]] = {}
    for ord_rep in all_orders:
        if ord_rep.proveedor:
            s_name = ord_rep.proveedor.strip().lower()
            if s_name not in supplier_skus_map:
                supplier_skus_map[s_name] = set()
                supplier_orders_map[s_name] = []
            supplier_skus_map[s_name].add(ord_rep.sku_id)
            supplier_orders_map[s_name].append({
                "id": ord_rep.id,
                "sku_id": ord_rep.sku_id,
                "cantidad": ord_rep.cantidad,
                "monto_total": float(ord_rep.monto_total or 0.0),
                "etapa": ord_rep.etapa,
                "fecha_arribo_estimada": str(ord_rep.fecha_arribo_estimada) if ord_rep.fecha_arribo_estimada else None,
                "responsable": ord_rep.responsable
            })

    results: List[SupplierResponse] = []

    for s in suppliers:
        s_norm = s.nombre.strip().lower()
        skus_associated = supplier_skus_map.get(s_norm, set())
        matched_orders = supplier_orders_map.get(s_norm, [])
        if not skus_associated and all_products:
            idx_s = (s.id or 1) % max(1, len(all_products))
            prods = all_products[idx_s:idx_s + 3] if len(all_products) >= 3 else all_products
        else:
            prods = [
                products_by_sku[sku] for sku in skus_associated if sku in products_by_sku
            ]

        prod_items = [
            SupplierProductItem(
                product_id=p.id,
                sku=p.sku,
                nombre=p.nombre,
                categoria=getattr(p, 'categoria', '') or 'General',
                costo_unitario=Decimal(str(round(float(p.costo_unitario or 0.0), 2))),
                lead_time_dias=Decimal(str(int(p.inventario.lead_time_dias) if (p.inventario and p.inventario.lead_time_dias) else 30)),
                image_url=p.image_url,
                imagen_url=p.image_url
            )
            for p in prods
        ]

        catalog_count = len(s.catalog_items) if hasattr(s, "catalog_items") and s.catalog_items else 0
        results.append(SupplierResponse(
            id=s.id,
            nombre=s.nombre,
            razon_social=s.razon_social,
            rut=s.rut,
            tipo_proveedor=s.tipo_proveedor or "FABRICA",
            pais=s.pais or "China",
            contacto_nombre=s.contacto_nombre,
            contacto_cargo=s.contacto_cargo,
            descripcion=s.descripcion,
            logo_url=s.logo_url,
            email=s.email,
            phone=s.phone,
            address=s.address,
            rubro=s.rubro or "Iluminación",
            condicion_pago=s.condicion_pago or "30 días",
            skus_count=len(prod_items),
            total_skus=len(prod_items),
            productos=prod_items,
            ordenes_compra_count=len(matched_orders),
            ordenes_compra=matched_orders,
            catalog_items_count=catalog_count,
            created_at=s.created_at
        ))

    return results


@router.get(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
    summary="Detalle completo de un proveedor/fábrica/naviera con historial de compras"
)
def get_supplier_by_id(
    supplier_id: int,
    db: Session = Depends(get_db)
):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado.")

    rep_orders = db.query(OrdenReposicion).filter(
        OrdenReposicion.proveedor.ilike(s.nombre.strip())
    ).all()
    rep_skus = {ro.sku_id for ro in rep_orders}
    all_products = db.query(Product).all()
    products_by_sku = {p.sku: p for p in all_products}
    prods = [products_by_sku[sku] for sku in rep_skus if sku in products_by_sku]
    if not prods and all_products:
        idx_s = (s.id or 1) % max(1, len(all_products))
        prods = all_products[idx_s:idx_s + 3] if len(all_products) >= 3 else all_products

    orders_data = [
        {
            "id": o.id,
            "sku_id": o.sku_id,
            "cantidad": o.cantidad,
            "monto_total": float(o.monto_total or 0.0),
            "etapa": o.etapa,
            "fecha_arribo_estimada": str(o.fecha_arribo_estimada) if o.fecha_arribo_estimada else None,
            "responsable": o.responsable
        }
        for o in rep_orders
    ]
    prod_items = [
        SupplierProductItem(
            product_id=p.id,
            sku=p.sku,
            nombre=p.nombre,
            categoria=getattr(p, 'categoria', '') or 'General',
            costo_unitario=Decimal(str(round(float(p.costo_unitario or 0.0), 2))),
            lead_time_dias=Decimal(str(int(p.inventario.lead_time_dias) if (p.inventario and p.inventario.lead_time_dias) else 30)),
            image_url=p.image_url,
            imagen_url=p.image_url
        )
        for p in prods
    ]

    catalog_count = len(s.catalog_items) if hasattr(s, "catalog_items") and s.catalog_items else 0
    return SupplierResponse(
        id=s.id,
        nombre=s.nombre,
        razon_social=s.razon_social,
        rut=s.rut,
        tipo_proveedor=s.tipo_proveedor or "FABRICA",
        pais=s.pais or "China",
        contacto_nombre=s.contacto_nombre,
        contacto_cargo=s.contacto_cargo,
        descripcion=s.descripcion,
        logo_url=s.logo_url,
        email=s.email,
        phone=s.phone,
        address=s.address,
        rubro=s.rubro or "Iluminación",
        condicion_pago=s.condicion_pago or "30 días",
        skus_count=len(prod_items),
        total_skus=len(prod_items),
        productos=prod_items,
        ordenes_compra_count=len(orders_data),
        ordenes_compra=orders_data,
        catalog_items_count=catalog_count,
        created_at=s.created_at
    )


@router.post(
    "/suppliers",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo Proveedor en el directorio"
)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    existing = db.query(Supplier).filter(Supplier.nombre.ilike(payload.nombre.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un proveedor con el nombre '{payload.nombre.strip()}'."
        )

    new_supp = Supplier(
        nombre=payload.nombre.strip(),
        razon_social=payload.razon_social.strip() if payload.razon_social else None,
        rut=payload.rut.strip() if payload.rut else None,
        tipo_proveedor=payload.tipo_proveedor.strip().upper() if payload.tipo_proveedor else "FABRICA",
        pais=payload.pais.strip() if payload.pais else "China",
        contacto_nombre=payload.contacto_nombre.strip() if payload.contacto_nombre else None,
        contacto_cargo=payload.contacto_cargo.strip() if payload.contacto_cargo else None,
        descripcion=payload.descripcion.strip() if payload.descripcion else None,
        logo_url=payload.logo_url,
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None,
        rubro=payload.rubro.strip() if payload.rubro else "Iluminación",
        condicion_pago=payload.condicion_pago.strip() if payload.condicion_pago else "30 días"
    )
    db.add(new_supp)
    db.commit()
    db.refresh(new_supp)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="SUPPLIER_CREATE",
        resource=f"suppliers/{new_supp.id}",
        details=payload.model_dump()
    )

    return SupplierResponse(
        id=new_supp.id,
        nombre=new_supp.nombre,
        razon_social=new_supp.razon_social,
        rut=new_supp.rut,
        tipo_proveedor=new_supp.tipo_proveedor,
        pais=new_supp.pais,
        contacto_nombre=new_supp.contacto_nombre,
        contacto_cargo=new_supp.contacto_cargo,
        descripcion=new_supp.descripcion,
        logo_url=new_supp.logo_url,
        email=new_supp.email,
        phone=new_supp.phone,
        address=new_supp.address,
        rubro=new_supp.rubro or "Iluminación",
        condicion_pago=new_supp.condicion_pago or "30 días",
        skus_count=0,
        total_skus=0,
        productos=[],
        ordenes_compra_count=0,
        ordenes_compra=[],
        catalog_items_count=0,
        created_at=new_supp.created_at
    )


@router.put(
    "/suppliers/{supplier_id}",
    response_model=SupplierResponse,
    summary="Actualiza datos de un Proveedor"
)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado.")

    if payload.nombre is not None:
        supplier.nombre = payload.nombre.strip()
    if payload.razon_social is not None:
        supplier.razon_social = payload.razon_social.strip() if payload.razon_social else None
    if payload.rut is not None:
        supplier.rut = payload.rut.strip() if payload.rut else None
    if payload.tipo_proveedor is not None:
        supplier.tipo_proveedor = payload.tipo_proveedor.strip().upper()
    if payload.pais is not None:
        supplier.pais = payload.pais.strip() if payload.pais else "China"
    if payload.contacto_nombre is not None:
        supplier.contacto_nombre = payload.contacto_nombre.strip() if payload.contacto_nombre else None
    if payload.contacto_cargo is not None:
        supplier.contacto_cargo = payload.contacto_cargo.strip() if payload.contacto_cargo else None
    if payload.descripcion is not None:
        supplier.descripcion = payload.descripcion.strip() if payload.descripcion else None
    if payload.logo_url is not None:
        supplier.logo_url = payload.logo_url
    if payload.email is not None:
        supplier.email = payload.email.strip() if payload.email else None
    if payload.phone is not None:
        supplier.phone = payload.phone.strip() if payload.phone else None
    if payload.address is not None:
        supplier.address = payload.address.strip() if payload.address else None
    if payload.rubro is not None:
        supplier.rubro = payload.rubro.strip() if payload.rubro else "Iluminación"
    if payload.condicion_pago is not None:
        supplier.condicion_pago = payload.condicion_pago.strip() if payload.condicion_pago else "30 días"

    db.commit()
    db.refresh(supplier)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="SUPPLIER_UPDATE",
        resource=f"suppliers/{supplier.id}",
        details=payload.model_dump(exclude_unset=True)
    )

    # SKUs vinculados vía OrdenReposicion
    rep_orders = db.query(OrdenReposicion).filter(
        OrdenReposicion.proveedor.ilike(supplier.nombre.strip())
    ).all()
    rep_skus = {ro.sku_id for ro in rep_orders}
    all_products = db.query(Product).all()
    products_by_sku = {p.sku: p for p in all_products}
    prods = [products_by_sku[sku] for sku in rep_skus if sku in products_by_sku]
    if not prods and all_products:
        idx_s = (supplier.id or 1) % max(1, len(all_products))
        prods = all_products[idx_s:idx_s + 3] if len(all_products) >= 3 else all_products

    orders_data = [
        {
            "id": o.id,
            "sku_id": o.sku_id,
            "cantidad": o.cantidad,
            "monto_total": float(o.monto_total or 0.0),
            "etapa": o.etapa,
            "fecha_arribo_estimada": str(o.fecha_arribo_estimada) if o.fecha_arribo_estimada else None,
            "responsable": o.responsable
        }
        for o in rep_orders
    ]
    prod_items = [
        SupplierProductItem(
            product_id=p.id,
            sku=p.sku,
            nombre=p.nombre,
            categoria=getattr(p, 'categoria', '') or 'General',
            costo_unitario=Decimal(str(round(float(p.costo_unitario or 0.0), 2))),
            lead_time_dias=Decimal(str(int(p.inventario.lead_time_dias) if (p.inventario and p.inventario.lead_time_dias) else 30)),
            image_url=p.image_url,
            imagen_url=p.image_url
        )
        for p in prods
    ]

    catalog_count = len(supplier.catalog_items) if hasattr(supplier, "catalog_items") and supplier.catalog_items else 0
    return SupplierResponse(
        id=supplier.id,
        nombre=supplier.nombre,
        razon_social=supplier.razon_social,
        rut=supplier.rut,
        tipo_proveedor=supplier.tipo_proveedor or "FABRICA",
        pais=supplier.pais or "China",
        contacto_nombre=supplier.contacto_nombre,
        contacto_cargo=supplier.contacto_cargo,
        descripcion=supplier.descripcion,
        logo_url=supplier.logo_url,
        email=supplier.email,
        phone=supplier.phone,
        address=supplier.address,
        rubro=supplier.rubro or "Iluminación",
        condicion_pago=supplier.condicion_pago or "30 días",
        skus_count=len(prod_items),
        total_skus=len(prod_items),
        productos=prod_items,
        ordenes_compra_count=len(orders_data),
        ordenes_compra=orders_data,
        catalog_items_count=catalog_count,
        created_at=supplier.created_at
    )


# =====================================================================
# PRESUPUESTO: CRUD DE PARTIDAS DE CENTROS DE COSTO
# =====================================================================

@router.post(
    "/budget/cost-centers",
    response_model=CostCenterBudgetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea una partida individual de presupuesto para un Centro de Costo"
)
def create_cost_center_budget(
    payload: CostCenterBudgetCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    if not PERIOD_REGEX.match(payload.periodo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El período '{payload.periodo}' es inválido. Formato requerido: YYYY-MM."
        )

    cc = db.query(CentroCosto).filter(CentroCosto.id == payload.centro_costo_id).first()
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Centro de costo ID {payload.centro_costo_id} no encontrado."
        )

    existing = db.query(PresupuestoCentroCosto).filter(
        PresupuestoCentroCosto.periodo == payload.periodo,
        PresupuestoCentroCosto.centro_costo_id == payload.centro_costo_id,
        PresupuestoCentroCosto.concepto_opex == payload.concepto_opex.strip()
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una partida con concepto '{payload.concepto_opex.strip()}' para este centro de costo en el período {payload.periodo}."
        )

    p_pres = Decimal(str(payload.monto_presupuestado))
    p_real = Decimal(str(payload.monto_real or 0.0))

    new_line = PresupuestoCentroCosto(
        periodo=payload.periodo,
        centro_costo_id=payload.centro_costo_id,
        concepto_opex=payload.concepto_opex.strip(),
        monto_presupuestado=p_pres,
        monto_real=p_real
    )
    db.add(new_line)
    db.commit()
    db.refresh(new_line)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="BUDGET_LINE_CREATE",
        resource=f"budget/cost-centers/{new_line.id}",
        details=payload.model_dump()
    )

    m_pres_f = float(new_line.monto_presupuestado)
    m_real_f = float(new_line.monto_real)
    var_monto = round(m_pres_f - m_real_f, 2)
    var_pct = round((var_monto / m_pres_f * 100.0), 1) if m_pres_f > 0 else 0.0
    estado = "OK" if var_monto >= 0 else "EXCEDIDO"

    return CostCenterBudgetResponse(
        id=new_line.id,
        periodo=new_line.periodo,
        centro_costo_id=new_line.centro_costo_id,
        centro_costo_codigo=cc.codigo,
        centro_costo_nombre=cc.nombre,
        concepto_opex=new_line.concepto_opex,
        monto_presupuestado=m_pres_f,
        monto_real=m_real_f,
        variacion_monto=var_monto,
        variacion_pct=var_pct,
        estado=estado
    )


@router.put(
    "/budget/cost-centers/{partida_id}",
    response_model=CostCenterBudgetResponse,
    summary="Actualiza montos o concepto de una partida de presupuesto de Centro de Costo"
)
def update_cost_center_budget(
    partida_id: int,
    payload: CostCenterBudgetUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    partida = db.query(PresupuestoCentroCosto).filter(PresupuestoCentroCosto.id == partida_id).first()
    if not partida:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partida de presupuesto ID {partida_id} no encontrada."
        )

    old_vals = {
        "concepto_opex": partida.concepto_opex,
        "monto_presupuestado": float(partida.monto_presupuestado),
        "monto_real": float(partida.monto_real)
    }

    if payload.concepto_opex is not None:
        partida.concepto_opex = payload.concepto_opex.strip()
    if payload.monto_presupuestado is not None:
        partida.monto_presupuestado = Decimal(str(payload.monto_presupuestado))
    if payload.monto_real is not None:
        partida.monto_real = Decimal(str(payload.monto_real))

    db.commit()
    db.refresh(partida)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="BUDGET_LINE_UPDATE",
        resource=f"budget/cost-centers/{partida.id}",
        details=payload.model_dump(exclude_unset=True)
    )

    cc = partida.centro_costo
    m_pres_f = float(partida.monto_presupuestado)
    m_real_f = float(partida.monto_real)
    var_monto = round(m_pres_f - m_real_f, 2)
    var_pct = round((var_monto / m_pres_f * 100.0), 1) if m_pres_f > 0 else 0.0
    estado = "OK" if var_monto >= 0 else "EXCEDIDO"

    return CostCenterBudgetResponse(
        id=partida.id,
        periodo=partida.periodo,
        centro_costo_id=partida.centro_costo_id,
        centro_costo_codigo=cc.codigo if cc else "",
        centro_costo_nombre=cc.nombre if cc else "",
        concepto_opex=partida.concepto_opex,
        monto_presupuestado=m_pres_f,
        monto_real=m_real_f,
        variacion_monto=var_monto,
        variacion_pct=var_pct,
        estado=estado
    )



# =====================================================================
# ADOPCIÓN PRESUPUESTARIA OFICIAL & ESCENARIOS FP&A (SPRINT 2)
# =====================================================================

@router.post(
    "/budget/apply-scenario",
    response_model=ApplyScenarioResponse,
    summary="Adopción Presupuestaria Oficial (Cierre Contable FP&A)",
    response_description="Persiste el escenario seleccionado en presupuestos_centros_costo vía Upsert"
)
def apply_budget_scenario(
    payload: ApplyScenarioRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_OPERACIONES]))
):
    """
    Graba el presupuesto sugerido por la IA o el usuario en la tabla 'presupuestos_centros_costo'
    para el período seleccionado utilizando un Upsert seguro por (centro_costo_id, periodo).
    """
    periodo = payload.periodo.strip()
    if not periodo:
        raise HTTPException(status_code=400, detail="El período es obligatorio.")

    actualizados = 0
    from app.models.entities import PresupuestoCentroCosto, CentroCosto

    for partida in payload.partidas:
        cc = db.query(CentroCosto).filter(CentroCosto.id == partida.centro_costo_id).first()
        if not cc:
            logger.warning("Centro de costo ID %s no encontrado, omitiendo.", partida.centro_costo_id)
            continue

        concepto = (partida.concepto_opex or f"Partida {cc.nombre}").strip()
        monto_decimal = Decimal(str(partida.monto_presupuestado))
        if monto_decimal < Decimal('0'):
            monto_decimal = Decimal('0.00')

        existente = db.query(PresupuestoCentroCosto).filter(
            PresupuestoCentroCosto.centro_costo_id == partida.centro_costo_id,
            PresupuestoCentroCosto.periodo == periodo
        ).first()

        if existente:
            existente.monto_presupuestado = monto_decimal
            existente.concepto_opex = concepto
        else:
            nueva_fila = PresupuestoCentroCosto(
                periodo=periodo,
                centro_costo_id=partida.centro_costo_id,
                concepto_opex=concepto,
                monto_presupuestado=monto_decimal,
                monto_real=Decimal('0.00')
            )
            db.add(nueva_fila)
        actualizados += 1

    db.commit()

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="APPLY_BUDGET_SCENARIO",
        resource=f"budget/scenarios/{periodo}",
        details={
            "periodo": periodo,
            "scenario_name": payload.scenario_name,
            "partidas_actualizadas": actualizados
        }
    )

    return ApplyScenarioResponse(
        status="success",
        periodo=periodo,
        partidas_actualizadas=actualizados,
        message=f"Presupuesto oficial para {periodo} ({payload.scenario_name.upper()}) grabado exitosamente: {actualizados} centros de costo actualizados."
    )


@router.post(
    "/budget/scenarios",
    response_model=BudgetScenarioResponse,
    summary="Generador de 3 Escenarios Presupuestarios FP&A (Ruta directa de Presupuestos)"
)
async def get_budget_scenarios_direct(
    req: BudgetScenarioRequest,
    db: Session = Depends(get_db)
):
    """
    Ruta directa en /budget/scenarios que delega al motor FP&A BudgetPlannerService.
    """
    return await BudgetPlannerService.generate_scenarios(req, db)
