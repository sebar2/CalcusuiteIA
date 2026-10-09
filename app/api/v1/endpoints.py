import io
import re
import calendar
from decimal import Decimal
from datetime import datetime, timezone, date
from typing import List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func, and_, or_

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
)
from app.domain.schemas import (
    ETLUploadResponse,
    InventoryAlert,
    InventoryQuickUpdateRequest,
    InventoryQuickUpdateResponse,
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
)
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
        
        # DOH (Days On Hand): Días de inventario disponibles según rotación y demanda anual
        inv_val = Decimal(str(stock_actual)) * prod.costo_unitario
        cogs_anual = inv.demanda_diaria_promedio * prod.costo_unitario * Decimal('365')
        if cogs_anual > Decimal('0'):
            doh = calculate_doh(inv_val, cogs_anual)
        elif inv.demanda_diaria_promedio > Decimal('0'):
            doh = calculate_doh(Decimal(str(stock_actual)), inv.demanda_diaria_promedio * Decimal('365'))
        else:
            doh = Decimal('0.00')

        is_alert = Decimal(str(stock_actual)) <= rop

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
            image_url=prod.image_url
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
    Simulador interactivo del impacto de descuentos sobre precio base, margen bruto y contribución.
    Permite suministrar base_price y cost directamente, o indicar un sku existente para auto-completarlos.
    """
    base_price = req.base_price
    cost = req.cost

    if (base_price is None or cost is None) and req.sku:
        prod = db.query(Product).filter(Product.sku == req.sku).first()
        if prod:
            if base_price is None:
                base_price = prod.precio_venta
            if cost is None:
                cost = prod.costo_unitario
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto con SKU '{req.sku}' no encontrado en el sistema."
            )

    if base_price is None or cost is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere base_price y cost, o un sku existente en la base de datos."
        )

    if base_price <= Decimal('0'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El precio base debe ser mayor a cero."
        )

    simulation = simulate_discount(
        base_price=base_price,
        cost=cost,
        discount_pct=req.discount_pct,
        commission_pct=req.commission_pct,
        freight=req.freight
    )

    return DiscountSimulationResponse(**simulation)


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
def suggest_budget_ai_endpoint(
    periodo: str = Query(..., description="Periodo objetivo YYYY-MM para sugerir presupuesto"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Analiza ventas históricas, DOH actual por categoría y alertas de ROP para generar
    una recomendación balanceada de metas comerciales asistida por IA.
    """
    return AIAdvisorService.suggest_budget_ai(periodo, db)


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
    summary="Fuerza la sincronización del feed contra el RSS/OCDS oficial de ARCE"
)
def sync_tenders_live_feed(user: UserContext = Depends(get_current_user)):
    from app.services.tenders_feed_service import tenders_feed_service
    return tenders_feed_service.get_live_feed(force_sync=True)


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
    clean_id = payload.id.strip().lower().replace(" ", "-")
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
        capacidad_unidades=payload.capacidad_unidades,
        activo=payload.activo
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
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
    db: Session = Depends(get_db)
):
    from app.services.inventory_sync_service import inventory_sync_service
    return inventory_sync_service.list_unified_batches(db, warehouse_id=warehouse_id)


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
    if payload.tarea is not None:
        item.titulo = payload.tarea.strip()
    if payload.area is not None:
        item.area = payload.area.strip()
    if payload.responsable is not None:
        item.responsable = payload.responsable.strip()
    if payload.monto is not None:
        item.monto = Decimal(str(payload.monto))
    if payload.fecha_limite is not None:
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
        dif = float(line.monto_real - line.monto_presupuestado)
        if dif > 0:
            cc_nom = line.centro_costo.nombre if line.centro_costo else "Gasto General"
            overrun_items.append((cc_nom, line.concepto_opex, dif))
    
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
    tipo: str = Query("inventario", description="Tipo de plantilla: 'inventario', 'opex' o 'crm'")
):
    tipo_clean = tipo.strip().lower()
    wb = openpyxl.Workbook()
    ws = wb.active
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10)
    border_side = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
    
    if tipo_clean == "opex":
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
        headers = ["titulo", "cliente_empresa", "contacto_nombre", "etapa", "probabilidad_pct", "sku", "cantidad", "precio_unitario", "moneda"]
        sample_rows = [
            ["Licitación Edificio Aeropuerto", "Constructora del Plata SA", "Ing. Mario Rossi", "propuesta_enviada", 65, "SKU-LED-PANEL-60X60", 400, 28.5, "USD"],
            ["Modernización Planta Industrial", "Laboratorios Pharma Uy", "Lic. Lucía Menéndez", "negociacion", 80, "SKU-CAMPANA-LED-150W", 120, 89.0, "USD"],
            ["Iluminación Cadena Retail", "Supermercados Sol SRL", "Cr. Diego Silva", "cotizacion", 40, "SKU-SPOT-EMBUTIR-7W", 850, 6.2, "USD"],
        ]
        filename = "plantilla_crm_deals.xlsx"
    else:
        ws.title = "Inventario_Maestro"
        headers = [
            "sku", "nombre", "categoria", "costo_unitario", "precio_venta",
            "deposito_central", "transito_maritimo", "aduana", "stock_seguridad",
            "lead_time_dias", "demanda_diaria_promedio"
        ]
        sample_rows = [
            ["SKU-LED-PANEL-60X60", "Panel LED 60x60 Backlight 40W", "Paneles LED", 14.50, 29.90, 850, 400, 150, 200, 45, 18.5],
            ["SKU-CAMPANA-LED-150W", "Campana Industrial High Bay 150W IP65", "Industrial", 48.00, 95.00, 220, 150, 50, 80, 60, 4.2],
            ["SKU-REFLECTOR-SLIM-50W", "Reflector Exterior Slim 50W Negro IP65", "Exterior", 8.20, 18.50, 1400, 600, 200, 300, 40, 32.0],
            ["SKU-CINTA-LED-COB-24V", "Cinta LED COB 24V 5m 4000K", "Tiras y Perfiles", 11.00, 24.00, 500, 200, 0, 150, 35, 12.0],
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




