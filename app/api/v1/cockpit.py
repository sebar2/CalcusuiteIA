from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.entities import (
    Product, 
    Inventory, 
    Budget, 
    Category,
    OrdenReposicion,
    PresupuestoVersion,
    AuditLog,
    AccionCompromiso
)
from app.domain.schemas import (
    MultilevelVarianceResponse,
    SupplyKanbanResponse,
    SupplyKanbanStage,
    SupplyOrderResponse,
    SupplyOrderCreate,
    SupplyOrderStageUpdate,
    SupplyOrderUpdate,
    AccionCompromisoCreate,
    AccionCompromisoBatchCreate,
    AccionCompromisoResponse,
    AuditLogResponse,
    InitiativeEvaluationRequest,
    InitiativeEvaluationResponse,
    InitiativeBenchmarkRequest,
    InitiativeBenchmarkResponse,
    OllamaStatusResponse,
    BudgetScenarioRequest,
    BudgetScenarioResponse,
    CrossReportResponse,
    CompetitorItemResponse,
    CompetitorSearchRequest,
    CompetitorSelectionEvaluationRequest,
    CompetitorSelectionEvaluationResponse,
)
from app.core.security import (
    get_current_user,
    UserContext,
    record_audit_log,
    validate_order_stage_transition,
    validate_budget_variance_authorization,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_COMERCIAL,
    ROLE_ANALISTA_OPERACIONES,
)
from app.engine.variance import calculate_multilevel_variance_breakdown
from app.engine.initiatives import evaluate_business_initiative
from app.services.budget_planner_service import BudgetPlannerService
from app.services.ai_advisor_service import AIAdvisorService

router = APIRouter(prefix="/api/v1", tags=["Cockpit de Performance & Ciberseguridad"])


# ----------------------------------------------------------------------
# DIMENSIÓN 1: PERFORMANCE INTEGRAL Y CONTROL PRESUPUESTARIO MULTINIVEL
# ----------------------------------------------------------------------
@router.get(
    "/variance/multilevel",
    response_model=MultilevelVarianceResponse,
    summary="Descomposición multinivel de variaciones (Precio, Volumen y Mix)",
    description="Descompone los desvíos presupuestarios entre Efecto Precio, Efecto Volumen y Efecto Mix por categoría y genera automáticamente un Plan de Mitigación en 3 Pasos si la variación supera el 5%."
)
async def get_multilevel_variance(
    periodo: str = Query(default="2025-09", description="Periodo presupuestario"),
    version_base: str = Query(default="V0_Aprobado", description="Versión presupuestaria base"),
    version_actual: str = Query(default="Forecast_Q1", description="Versión presupuestaria comparada"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    # Buscar registros en presupuestos_versiones o construir desde transacciones/budgets
    b_versions = db.query(PresupuestoVersion).filter(
        PresupuestoVersion.periodo == periodo,
        PresupuestoVersion.cuenta == "Ventas"
    ).all()

    # Si no hay suficientes versiones en presupuestos_versiones, usar Budget estándar
    lines_data = []
    if b_versions:
        cats = sorted(list(set(v.categoria for v in b_versions)))
        for cat in cats:
            v_base = next((v for v in b_versions if v.categoria == cat and v.version == version_base), None)
            v_act = next((v for v in b_versions if v.categoria == cat and v.version == version_actual), None)

            base_val = v_base.monto if v_base else Decimal('100000.00')
            act_val = v_act.monto if v_act else Decimal('105000.00')

            # Precios y cantidades representativas
            b_price = Decimal('100.00')
            b_qty = (base_val / b_price).quantize(Decimal('1'))
            
            # Variación inducida
            a_price = (b_price * (act_val / base_val if base_val > 0 else Decimal('1'))).quantize(Decimal('0.01'))
            a_qty = b_qty

            lines_data.append({
                "categoria": cat,
                "nombre": f"Línea {cat}",
                "budgeted_price": b_price,
                "budgeted_qty": b_qty,
                "actual_price": a_price,
                "actual_qty": a_qty,
                "budgeted_margin": Decimal('35.00')
            })
    else:
        # Fallback analítico determinístico con categorías de demo
        categories = ["Industrial", "Electrónica", "Insumos"]
        defaults = [
            ("Industrial", Decimal('150.00'), Decimal('1000'), Decimal('162.00'), Decimal('1000')),
            ("Electrónica", Decimal('80.00'), Decimal('1000'), Decimal('74.00'), Decimal('1000')),
            ("Insumos", Decimal('12.00'), Decimal('3750'), Decimal('12.00'), Decimal('3750')),
        ]
        for cat, bp, bq, ap, aq in defaults:
            lines_data.append({
                "categoria": cat,
                "nombre": f"Línea {cat}",
                "budgeted_price": bp,
                "budgeted_qty": bq,
                "actual_price": ap,
                "actual_qty": aq,
                "budgeted_margin": bp * Decimal('0.35')
            })

    result = calculate_multilevel_variance_breakdown(lines_data)

    mitigation_plan: List[str] = []
    if result["requires_mitigation"]:
        mitigation_plan = [
            f"Efecto Precio: Renegociar tarifas comerciales y bonificaciones en las categorías con desvío adverso para recuperar ${abs(result['total_price_variance']):,.2f}.",
            f"Efecto Volumen: Desplegar campaña de empuje comercial en canales mayoristas para compensar la caída en unidades estimadas (${abs(result['total_volume_variance']):,.2f}).",
            "Efecto Mix: Rebalancear el portafolio comercial priorizando SKUs con margen de contribución > 35% y congelar contrataciones no operativas hasta estabilizar EBITDA."
        ]

    return MultilevelVarianceResponse(
        total_budget=result["total_budget"],
        total_actual=result["total_actual"],
        net_variance=result["net_variance"],
        net_variance_pct=result["net_variance_pct"],
        total_price_variance=result["total_price_variance"],
        total_volume_variance=result["total_volume_variance"],
        total_mix_variance=result["total_mix_variance"],
        requires_mitigation=result["requires_mitigation"],
        mitigation_plan_3_steps=mitigation_plan,
        lines=result["lines"]
    )


# ----------------------------------------------------------------------
# DIMENSIÓN 1: COMPARATIVA MATRICIAL 3 PRESUPUESTOS (Alias de compatibilidad)
# ----------------------------------------------------------------------
@router.post(
    "/budget/scenarios",
    response_model=BudgetScenarioResponse,
    summary="Comparativa matricial de 3 presupuestos (Conservador, Base, Agresivo)"
)
async def post_budget_scenarios_matrix(
    req: BudgetScenarioRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    return await BudgetPlannerService.generate_scenarios(req, db)


# ----------------------------------------------------------------------
# DIMENSIÓN 3: PIPELINE KANBAN DE REPOSICIÓN (ESTILO BITRIX24 CON TOTALES)
# ----------------------------------------------------------------------
KANBAN_STAGE_CONFIG = [
    {
        "id": "sugerido",
        "name": "Sugerido (Stock <= ROP)",
        "color_hex": "#2fc6f6"
    },
    {
        "id": "aprobacion",
        "name": "Pendiente de Aprobación",
        "color_hex": "#00a2e8"
    },
    {
        "id": "fabricacion",
        "name": "En Fabricación",
        "color_hex": "#1e40af"
    },
    {
        "id": "transito",
        "name": "En Tránsito / Aduana",
        "color_hex": "#f39c12"
    },
    {
        "id": "ingresado",
        "name": "Ingresado / Stock Central",
        "color_hex": "#2ecc71"
    },
]

@router.get(
    "/supply/kanban",
    response_model=SupplyKanbanResponse,
    summary="Tablero Kanban de Reposición por etapas con acumuladores de capital inmovilizado"
)
@router.get(
    "/kanban/supply",
    response_model=SupplyKanbanResponse,
    include_in_schema=False
)
def get_supply_kanban(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    all_orders = db.query(OrdenReposicion).order_by(OrdenReposicion.created_at.desc()).all()

    stages_result = []
    total_pipeline = Decimal('0.00')

    for cfg in KANBAN_STAGE_CONFIG:
        stage_id = cfg["id"]
        stage_orders = [o for o in all_orders if o.etapa == stage_id]
        stage_capital = sum((o.monto_total for o in stage_orders), Decimal('0.00'))
        total_pipeline += stage_capital

        stages_result.append(SupplyKanbanStage(
            id=stage_id,
            name=cfg["name"],
            color_hex=cfg["color_hex"],
            total_capital=stage_capital,
            order_count=len(stage_orders),
            orders=stage_orders
        ))

    return SupplyKanbanResponse(
        stages=stages_result,
        total_pipeline_capital=total_pipeline
    )


@router.patch(
    "/supply/orders/{order_id}/stage",
    response_model=SupplyOrderResponse,
    summary="Mover orden de reposición entre etapas con control RBAC y auditoría inmutable"
)
def update_supply_order_stage(
    order_id: int,
    payload: SupplyOrderStageUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    order = db.query(OrdenReposicion).filter(OrdenReposicion.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orden de reposición #{order_id} no encontrada."
        )

    valid_stage_ids = [c["id"] for c in KANBAN_STAGE_CONFIG]
    if payload.target_stage not in valid_stage_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Etapa inválida '{payload.target_stage}'. Válidas: {valid_stage_ids}"
        )

    # Segregación de Funciones RBAC:
    # Mover a aprobación o montos > $5,000 requiere obligatoriamente rol 'controller_admin'
    validate_order_stage_transition(
        amount=order.monto_total,
        target_stage=payload.target_stage,
        user=user
    )

    prev_stage = order.etapa
    order.etapa = payload.target_stage
    db.commit()
    db.refresh(order)

    # Sincronización automática de lote y depósito físico por etapa
    try:
        from app.services.inventory_sync_service import inventory_sync_service
        inventory_sync_service.sync_rop_order_stage(db, order)
    except Exception as e:
        print(f"[SyncWarning] Error al sincronizar lote de orden {order.id}: {e}")

    # Trazabilidad: Registrar en audit_logs de forma inmutable
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="MOVE_ORDER_STAGE",
        resource=f"ordenes_reposicion/{order.id}",
        details={
            "sku_id": order.sku_id,
            "monto_total": float(order.monto_total),
            "previous_stage": prev_stage,
            "new_stage": payload.target_stage
        }
    )

    return order


@router.patch(
    "/orders/{order_id}",
    response_model=SupplyOrderResponse,
    summary="Actualizar campos de una orden de reposición",
    tags=["Órdenes de Reposición"]
)
@router.patch(
    "/supply/orders/{order_id}",
    response_model=SupplyOrderResponse,
    summary="Actualizar campos de una orden de reposición (alias)",
    tags=["Órdenes de Reposición"]
)
def update_supply_order_details(
    order_id: int,
    payload: SupplyOrderUpdate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    order = db.query(OrdenReposicion).filter(OrdenReposicion.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orden #{order_id} no encontrada."
        )

    # Validar transición de etapa si se incluye en payload
    if payload.etapa is not None and payload.etapa != order.etapa:
        valid_stage_ids = [c["id"] for c in KANBAN_STAGE_CONFIG]
        if payload.etapa not in valid_stage_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Etapa inválida '{payload.etapa}'. Válidas: {valid_stage_ids}"
            )
        # Segregación de funciones RBAC
        target_amt = payload.monto_total if payload.monto_total is not None else order.monto_total
        validate_order_stage_transition(
            amount=target_amt,
            target_stage=payload.etapa,
            user=user
        )

    prev_details = {
        "sku_id": order.sku_id,
        "cantidad": order.cantidad,
        "monto_total": float(order.monto_total),
        "proveedor": order.proveedor,
        "responsable": order.responsable,
        "etapa": order.etapa,
        "fecha_arribo_estimada": str(order.fecha_arribo_estimada)
    }

    if payload.sku_id is not None:
        order.sku_id = payload.sku_id
    if payload.cantidad is not None:
        order.cantidad = payload.cantidad
    if payload.monto_total is not None:
        order.monto_total = payload.monto_total
    if payload.proveedor is not None:
        order.proveedor = payload.proveedor
    if payload.responsable is not None:
        order.responsable = payload.responsable
    if payload.etapa is not None:
        order.etapa = payload.etapa
    if payload.fecha_arribo_estimada is not None:
        order.fecha_arribo_estimada = payload.fecha_arribo_estimada

    db.commit()
    db.refresh(order)

    try:
        from app.services.inventory_sync_service import inventory_sync_service
        inventory_sync_service.sync_rop_order_stage(db, order)
    except Exception as e:
        print(f"[SyncWarning] Error al sincronizar orden {order.id}: {e}")

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="UPDATE_ORDER",
        resource=f"ordenes_reposicion/{order.id}",
        details={
            "previous": prev_details,
            "updated": {
                "sku_id": order.sku_id,
                "cantidad": order.cantidad,
                "monto_total": float(order.monto_total),
                "proveedor": order.proveedor,
                "responsable": order.responsable,
                "etapa": order.etapa,
                "fecha_arribo_estimada": str(order.fecha_arribo_estimada)
            }
        }
    )

    return order


@router.post(
    "/supply/orders",
    response_model=SupplyOrderResponse,
    summary="Crear orden de reposición"
)
def create_supply_order(
    payload: SupplyOrderCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    new_order = OrdenReposicion(
        sku_id=payload.sku_id,
        cantidad=payload.cantidad,
        monto_total=payload.monto_total,
        proveedor=payload.proveedor,
        etapa=payload.etapa or "sugerido",
        responsable=payload.responsable,
        fecha_arribo_estimada=payload.fecha_arribo_estimada
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_ORDER",
        resource=f"ordenes_reposicion/{new_order.id}",
        details={
            "sku_id": new_order.sku_id,
            "cantidad": new_order.cantidad,
            "monto_total": float(new_order.monto_total)
        }
    )

    return new_order


# ----------------------------------------------------------------------
# DIMENSIÓN 4: EVALUADOR DE NUEVAS INICIATIVAS (CAPEX, BREAK-EVEN, PAYBACK)
# ----------------------------------------------------------------------
@router.post(
    "/initiatives/evaluate",
    response_model=InitiativeEvaluationResponse,
    summary="Evaluador financiero de factibilidad para nuevos proyectos (Break-Even, Payback, ROI)"
)
async def post_evaluate_initiative_endpoint(
    req: InitiativeEvaluationRequest,
    user: UserContext = Depends(get_current_user)
):
    return await AIAdvisorService.evaluate_initiative(req)


# ----------------------------------------------------------------------
# DIMENSIÓN 5: MINUTAS EJECUTIVAS Y ACCIONES TRANSVERSALES
# ----------------------------------------------------------------------
@router.post(
    "/advisor/executive-summary",
    response_model=CrossReportResponse,
    summary="Generador de minutas ejecutivas adaptadas por audiencia (Dirección, Comercial, Logística)"
)
async def post_executive_summary(
    audience: str = Body(default="Dirección General"),
    periodo: Optional[str] = Body(default="2025-09"),
    extra_context: Optional[str] = Body(default=None),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    # Mapear audiencias estándar
    aud_norm = "Directorio / Gerencia General"
    if "comercial" in audience.lower():
        aud_norm = "Gerencia Comercial"
    elif "logística" in audience.lower() or "operaciones" in audience.lower():
        aud_norm = "Jefatura de Logística / Operaciones"

    from app.domain.schemas import CrossReportRequest
    req = CrossReportRequest(
        audience=aud_norm,
        periodo=periodo,
        extra_context=extra_context
    )
    return await AIAdvisorService.generate_cross_report(req, db)


@router.get(
    "/actions",
    response_model=List[AccionCompromisoResponse],
    summary="Listado de acciones y compromisos derivados de las minutas"
)
def get_actions(
    area: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    query = db.query(AccionCompromiso)
    if area:
        query = query.filter(AccionCompromiso.area.ilike(f"%{area}%"))
    return query.order_by(AccionCompromiso.fecha_limite.asc()).all()


@router.post(
    "/actions",
    response_model=AccionCompromisoResponse,
    summary="Crear acción o compromiso derivado"
)
def create_action(
    payload: AccionCompromisoCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    new_act = AccionCompromiso(
        titulo=payload.titulo,
        area=payload.area,
        responsable=payload.responsable,
        fecha_limite=payload.fecha_limite,
        estado=payload.estado or "Pendiente",
        origen=payload.origen or "Minuta Ejecutiva"
    )
    db.add(new_act)
    db.commit()
    db.refresh(new_act)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_ACTION_COMMITMENT",
        resource=f"acciones_compromisos/{new_act.id}",
        details={"titulo": new_act.titulo, "area": new_act.area}
    )

    return new_act


# ----------------------------------------------------------------------
# MÓDULO DE CIBERSEGURIDAD: TRAZABILIDAD Y REGISTRO AUDIT LOGS
# ----------------------------------------------------------------------
@router.get(
    "/audit/logs",
    response_model=List[AuditLogResponse],
    summary="Registro inmutable de trazabilidad y auditoría de ciberseguridad financiera"
)
def get_audit_logs(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()


# ----------------------------------------------------------------------
# MÓDULO OLLAMA & BENCHMARKING DE MERCADO
# ----------------------------------------------------------------------
@router.get(
    "/advisor/ollama-status",
    response_model=OllamaStatusResponse,
    summary="Estado de conectividad y disponibilidad de Ollama en tiempo real"
)
async def get_ollama_status():
    return await AIAdvisorService.check_ollama_status()


@router.post(
    "/initiatives/ai-benchmark",
    response_model=InitiativeBenchmarkResponse,
    summary="Benchmarking cruzado de Nuevas Iniciativas (DB Interna + Mercado Web)"
)
async def run_initiative_benchmark(
    payload: InitiativeBenchmarkRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="RUN_INITIATIVE_BENCHMARK",
        resource=f"initiatives/benchmark/{payload.product_name}",
        details={
            "product_name": payload.product_name,
            "proposed_price": float(payload.proposed_price),
            "engine_mode": payload.engine_mode
        }
    )
    return await AIAdvisorService.benchmark_initiative(payload, db)



@router.post(
    "/actions/batch",
    response_model=List[AccionCompromisoResponse],
    summary="Creación masiva de compromisos derivados de minutas ejecutivas"
)
def create_actions_batch(
    payload: AccionCompromisoBatchCreate,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    created_items = []
    for item in payload.acciones:
        new_act = AccionCompromiso(
            titulo=item.titulo,
            area=item.area,
            responsable=item.responsable,
            fecha_limite=item.fecha_limite,
            estado=item.estado or "Pendiente",
            origen=item.origen or "Minuta Ejecutiva"
        )
        db.add(new_act)
        created_items.append(new_act)

    db.commit()
    for act in created_items:
        db.refresh(act)

    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="CREATE_BATCH_ACTIONS",
        resource="acciones_compromisos/batch",
        details={"count": len(created_items)}
    )

    return created_items
