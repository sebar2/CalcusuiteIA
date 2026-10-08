import sys
from pathlib import Path

# Asegurar que el directorio raíz del proyecto tenga precedencia en sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st
import pandas as pd
import requests
import io
import re
import asyncio
import concurrent.futures
from decimal import Decimal
from typing import Optional, List, Dict, Any

# Configuración de página Streamlit
st.set_page_config(
    page_title="Calcu - Supply Chain & Financial BI Suite",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilos CSS personalizados para look & feel corporativo
st.markdown("""
<style>
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        border-left: 5px solid #0d6efd;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .metric-card-alert {
        background-color: #fff5f5;
        border-radius: 8px;
        padding: 16px;
        border-left: 5px solid #dc3545;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .advisor-box {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        border-left: 5px solid #6f42c1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        margin-bottom: 12px;
    }
    .badge-green {
        background-color: #d1e7dd;
        color: #0f5132;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .badge-yellow {
        background-color: #fff3cd;
        color: #664d03;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .badge-red {
        background-color: #f8d7da;
        color: #842029;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.85rem;
    }
    .stProgress > div > div > div > div {
        background-color: #0d6efd;
    }
</style>
""", unsafe_allow_html=True)

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

# ==========================================================
# GESTOR DE COMUNICACIÓN CON BACKEND (API & FALLBACK DIRECTO)
# ==========================================================
def check_backend_health() -> bool:
    try:
        r = requests.get("http://127.0.0.1:8000/health", timeout=1.5)
        return r.status_code == 200
    except Exception:
        return False

BACKEND_ONLINE = check_backend_health()

def api_get(endpoint: str, params: Optional[dict] = None) -> Optional[Any]:
    if BACKEND_ONLINE:
        try:
            r = requests.get(f"{API_BASE_URL}{endpoint}", params=params, timeout=5)
            if r.status_code == 200:
                return r.json()
            st.error(f"Error {r.status_code} desde backend: {r.text}")
            return None
        except Exception:
            pass

    # Fallback directo a la capa de servicios y SQLAlchemy Core
    try:
        from app.database.session import SessionLocal, init_db
        from app.models.entities import Product, Inventory, Budget, Category
        from app.engine.inventory import calculate_rop, calculate_doh
        from app.engine.pricing import (
            calculate_gross_margin, calculate_markup,
            calculate_unit_contribution_margin, calculate_marginal_ratio
        )
        from app.engine.variance import calculate_variance, calculate_variance_pct, get_variance_status

        init_db()
        db = SessionLocal()
        try:
            if endpoint == "/inventory/categories":
                cats = db.query(Category.nombre).join(Product, Product.category_id == Category.id).distinct().all()
                seen = {}
                for (c,) in cats:
                    if c and str(c).strip():
                        c_str = str(c).strip()
                        low = c_str.lower()
                        if low not in seen:
                            seen[low] = c_str
                return sorted(list(seen.values()), key=lambda x: x.lower())

            elif endpoint == "/inventory/alerts":
                only_alerts = params.get("only_alerts", False) if params else False
                categoria = params.get("categoria") if params else None
                query = db.query(Product)
                if categoria:
                    query = query.join(Category).filter(Category.nombre.ilike(f"%{categoria}%"))
                prods = query.all()
                out = []
                for p in prods:
                    inv = p.inventario
                    if not inv:
                        continue
                    stock_actual = inv.stock_actual
                    rop = calculate_rop(inv.demanda_diaria_promedio, inv.lead_time_dias, Decimal(str(inv.stock_seguridad)))
                    inv_val = Decimal(str(stock_actual)) * p.costo_unitario
                    cogs_anual = inv.demanda_diaria_promedio * p.costo_unitario * Decimal('365')
                    doh = calculate_doh(inv_val, cogs_anual) if cogs_anual > Decimal('0') else Decimal('0.00')
                    is_alert = Decimal(str(stock_actual)) <= rop
                    if only_alerts and not is_alert:
                        continue
                    out.append({
                        "sku": p.sku,
                        "nombre": p.nombre,
                        "categoria": p.categoria,
                        "stock_actual": stock_actual,
                        "rop": str(rop),
                        "doh": str(doh),
                        "is_alert": is_alert,
                        "stock_seguridad": inv.stock_seguridad,
                        "lead_time_dias": str(inv.lead_time_dias),
                        "deposito_central": inv.deposito_central,
                        "transito_maritimo": inv.transito_maritimo,
                        "aduana": inv.aduana
                    })
                return out

            elif endpoint == "/pricing/margins":
                categoria = params.get("categoria") if params else None
                sku_q = params.get("sku") if params else None
                query = db.query(Product)
                if categoria:
                    query = query.join(Category).filter(Category.nombre.ilike(f"%{categoria}%"))
                if sku_q:
                    query = query.filter(Product.sku.ilike(f"%{sku_q}%"))
                prods = query.all()
                out = []
                for p in prods:
                    gm = calculate_gross_margin(p.precio_venta, p.costo_unitario)
                    mk = calculate_markup(p.precio_venta, p.costo_unitario)
                    cm = calculate_unit_contribution_margin(p.precio_venta, p.costo_unitario)
                    mr = calculate_marginal_ratio(p.precio_venta, p.costo_unitario)
                    out.append({
                        "sku": p.sku,
                        "nombre": p.nombre,
                        "categoria": p.categoria,
                        "precio_venta": str(p.precio_venta),
                        "costo_unitario": str(p.costo_unitario),
                        "gross_margin_pct": str(gm),
                        "markup_pct": str(mk),
                        "unit_contribution_margin": str(cm),
                        "marginal_ratio": str(mr)
                    })
                return out

            elif endpoint == "/budget/variance":
                periodo = params.get("periodo") if params else None
                tipo = params.get("tipo") if params else None
                query = db.query(Budget)
                if periodo:
                    query = query.filter(Budget.periodo == periodo)
                if tipo:
                    query = query.filter(Budget.tipo == tipo.upper())
                b_list = query.all()
                out = []
                for b in b_list:
                    v_abs = calculate_variance(b.monto_real, b.monto_presupuestado)
                    v_pct = calculate_variance_pct(b.monto_real, b.monto_presupuestado)
                    stat = get_variance_status(b.monto_real, b.monto_presupuestado, b.tipo.upper() == "VENTAS")
                    out.append({
                        "id": b.id,
                        "periodo": b.periodo,
                        "categoria": b.categoria,
                        "tipo": b.tipo,
                        "monto_presupuestado": str(b.monto_presupuestado),
                        "monto_real": str(b.monto_real),
                        "variacion_absoluta": str(v_abs),
                        "variacion_porcentual": str(v_pct),
                        "status": stat
                    })
                return out
        finally:
            db.close()
    except Exception as e:
        st.error(f"Error en consulta de datos: {e}")
    return None

def _execute_async_advisor(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:
        loop = None
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            pass
        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        elif loop:
            return loop.run_until_complete(coro)
        else:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            return new_loop.run_until_complete(coro)

def api_post(endpoint: str, json_data: dict) -> Optional[Any]:
    if BACKEND_ONLINE:
        try:
            req_timeout = 50 if "/advisor/" in endpoint else 8
            r = requests.post(f"{API_BASE_URL}{endpoint}", json=json_data, timeout=req_timeout)
            if r.status_code in [200, 201]:
                return r.json()
            st.error(f"Error {r.status_code}: {r.text}")
            return None
        except Exception:
            pass

    # Fallback directo a la capa de servicios y SQLAlchemy Core
    try:
        if endpoint == "/pricing/simulate":
            from app.engine.pricing import simulate_discount
            base_p = Decimal(str(json_data.get("base_price", "100")))
            cost = Decimal(str(json_data.get("cost", "50")))
            disc = Decimal(str(json_data.get("discount_pct", "0")))
            comm = Decimal(str(json_data.get("commission_pct", "0")))
            freight = Decimal(str(json_data.get("freight", "0")))

            sim = simulate_discount(base_p, cost, disc, comm, freight)
            return {k: (str(v) if isinstance(v, Decimal) else v) for k, v in sim.items()}

        elif endpoint == "/advisor/variance-insights":
            from app.domain.schemas import VarianceInsightRequest
            from app.services.ai_advisor_service import AIAdvisorService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = VarianceInsightRequest(**json_data)
                try:
                    resp = _execute_async_advisor(AIAdvisorService.analyze_variance(req_obj, db))
                except Exception:
                    resp = AIAdvisorService.generate_variance_heuristic(lines=req_obj.lines, periodo=req_obj.periodo)
                return resp.model_dump(mode='json')
            finally:
                db.close()

        elif endpoint == "/advisor/inventory-insights":
            from app.domain.schemas import InventoryInsightRequest
            from app.services.ai_advisor_service import AIAdvisorService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = InventoryInsightRequest(**json_data)
                try:
                    resp = _execute_async_advisor(AIAdvisorService.analyze_inventory(req_obj, db))
                except Exception:
                    resp = AIAdvisorService.generate_inventory_heuristic(items=req_obj.items)
                return resp.model_dump(mode='json')
            finally:
                db.close()

        elif endpoint == "/advisor/budget-scenarios":
            from app.domain.schemas import BudgetScenarioRequest
            from app.services.budget_planner_service import BudgetPlannerService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = BudgetScenarioRequest(**json_data)
                resp = _execute_async_advisor(BudgetPlannerService.generate_scenarios(req_obj, db))
                return resp.model_dump(mode='json')
            finally:
                db.close()

        elif endpoint == "/advisor/integral-audit":
            from app.domain.schemas import IntegralAuditRequest
            from app.services.ai_advisor_service import AIAdvisorService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = IntegralAuditRequest(**json_data)
                resp = _execute_async_advisor(AIAdvisorService.audit_integral_performance(req_obj, db))
                return resp.model_dump(mode='json')
            finally:
                db.close()

        elif endpoint == "/advisor/commercial-optimizer":
            from app.domain.schemas import CommercialOptimizerRequest
            from app.services.ai_advisor_service import AIAdvisorService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = CommercialOptimizerRequest(**json_data)
                resp = _execute_async_advisor(AIAdvisorService.optimize_commercial_pricing(req_obj, db))
                return resp.model_dump(mode='json')
            finally:
                db.close()

        elif endpoint == "/advisor/supply-action-plan":
            from app.domain.schemas import SupplyActionPlanRequest
            from app.services.ai_advisor_service import AIAdvisorService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = SupplyActionPlanRequest(**json_data)
                resp = _execute_async_advisor(AIAdvisorService.generate_supply_action_plan(req_obj, db))
                return resp.model_dump(mode='json')
            finally:
                db.close()

        elif endpoint == "/advisor/evaluate-initiative":
            from app.domain.schemas import InitiativeEvaluationRequest
            from app.services.ai_advisor_service import AIAdvisorService

            req_obj = InitiativeEvaluationRequest(**json_data)
            resp = _execute_async_advisor(AIAdvisorService.evaluate_initiative(req_obj))
            return resp.model_dump(mode='json')

        elif endpoint == "/advisor/generate-cross-report":
            from app.domain.schemas import CrossReportRequest
            from app.services.ai_advisor_service import AIAdvisorService
            from app.database.session import SessionLocal, init_db

            init_db()
            db = SessionLocal()
            try:
                req_obj = CrossReportRequest(**json_data)
                resp = _execute_async_advisor(AIAdvisorService.generate_cross_report(req_obj, db))
                return resp.model_dump(mode='json')
            finally:
                db.close()

    except Exception as e:
        st.error(f"Excepción en procesamiento local: {e}")
        return None

# ==========================================================
# BARRA LATERAL (SIDEBAR DE CONTROL & NAVEGACIÓN)
# ==========================================================
st.sidebar.title("🧮 Calcu")
st.sidebar.caption("Supply Chain & Financial Analytics Core")

if BACKEND_ONLINE:
    st.sidebar.success("🟢 **Backend FastAPI:** En línea (`v1.0.0`)")
else:
    st.sidebar.warning("🟡 **Modo Autónomo:** Capa de servicios directa")

menu = st.sidebar.radio(
    "Módulos Operativos",
    [
        "📦 Control Room de Abastecimiento",
        "🏷️ Analítica Comercial & Pricing",
        "📈 Variance Analysis Presupuestario",
        "🚀 Copiloto Ejecutivo & Nuevas Iniciativas",
        "📥 Ingesta de Datos (ETL)"
    ],
    key="sidebar_navigation_menu"
)

st.sidebar.divider()
st.sidebar.markdown("""
**Arquitectura Multicapa:**
- **Frontend BI:** Streamlit 1.63 Interactive UI
- **Backend API:** FastAPI 2.0 RESTful Endpoints
- **Copiloto IA:** Ollama LLM + Fallback Determinístico Contable
- **Motor Financiero:** Pure Decimal Precision Engine
- **Persistencia:** SQLAlchemy Core + SQLite
""")

# ==========================================================
# 1. CONTROL ROOM DE ABASTECIMIENTO
# ==========================================================
if menu == "📦 Control Room de Abastecimiento":
    st.title("📦 Control Room de Abastecimiento")
    st.caption("Monitoreo continuo de inventarios, punto de reorden (ROP), días de cobertura (DOH) y desglose físico por ubicación.")

    col_filter1, col_filter2, col_filter3 = st.columns([2, 2, 1])
    with col_filter1:
        only_alerts = st.checkbox("🚨 Filtrar únicamente SKUs en Quiebre / Reorden (Stock ≤ ROP)", value=False, key="filter_only_alerts")
    with col_filter2:
        available_cats = api_get("/inventory/categories") or []
        cat_options = ["Todas"] + [c for c in available_cats if c != "Todas"]
        cat_filter = st.selectbox("Filtrar por Categoría", cat_options, key="filter_categoria")
    with col_filter3:
        st.markdown("<div style='padding-top: 15px;'></div>", unsafe_allow_html=True)
        if st.button("🔄 Actualizar", use_container_width=True):
            st.rerun()

    query_params = {"only_alerts": only_alerts}
    if cat_filter != "Todas":
        query_params["categoria"] = cat_filter

    data = api_get("/inventory/alerts", params=query_params)

    if data:
        total_skus = len(data)
        alert_skus = sum(1 for item in data if item.get("is_alert"))
        doh_values = [float(item.get("doh", 0)) for item in data if float(item.get("doh", 0)) > 0]
        avg_doh = sum(doh_values) / len(doh_values) if doh_values else 0.0
        total_stock = sum(int(item.get("stock_actual", 0)) for item in data)

        # Tarjetas de KPIs Principales
        kpi1, kpi2, kpi3, kpi4 = st.columns(4)
        with kpi1:
            st.metric("Total SKUs Analizados", total_skus)
        with kpi2:
            st.metric(
                "SKUs en Quiebre / Reorden",
                alert_skus,
                delta=f"{alert_skus} en riesgo crítico" if alert_skus > 0 else "Nivel óptimo",
                delta_color="inverse" if alert_skus > 0 else "normal"
            )
        with kpi3:
            st.metric("Promedio DOH (Cobertura)", f"{avg_doh:.1f} días", delta="Rotación saludable" if avg_doh >= 30 else "Baja cobertura")
        with kpi4:
            st.metric("Stock Físico Total", f"{total_stock:,} un.")

        st.divider()

        # ==========================================================
        # COPILOTO ASESOR IA - PLAN DE REABASTECIMIENTO CRÍTICO
        # ==========================================================
        st.subheader("🤖 Copiloto Asesor de Operaciones (Supply Chain Director)")
        col_btn_inv, col_btn_desc = st.columns([1, 2])
        with col_btn_inv:
            btn_plan_critico = st.button("💡 Sugerir Plan de Reabastecimiento Crítico", type="primary", use_container_width=True, key="btn_inventory_advisor")
        with col_btn_desc:
            st.caption("Audita en tiempo real las brechas críticas entre Cobertura (DOH) y Lead Time, riesgo de rotura OTIF y emite directrices de compra prioritarias.")

        if btn_plan_critico:
            with st.spinner("🤖 Copiloto IA evaluando riesgos de abastecimiento y brechas Lead Time..."):
                sku_items = []
                for item in data:
                    sku_items.append({
                        "sku": str(item.get("sku")),
                        "nombre": str(item.get("nombre", "")),
                        "categoria": str(item.get("categoria", "")),
                        "stock_actual": int(item.get("stock_actual", 0)),
                        "rop": str(item.get("rop", 0)),
                        "doh": str(item.get("doh", 0)),
                        "is_alert": bool(item.get("is_alert", False)),
                        "stock_seguridad": int(item.get("stock_seguridad", 0) or 0),
                        "lead_time_dias": str(item.get("lead_time_dias", 0)),
                        "demanda_diaria_promedio": str(item.get("demanda_diaria_promedio", 0)),
                        "deposito_central": int(item.get("deposito_central", 0) or 0),
                        "transito_maritimo": int(item.get("transito_maritimo", 0) or 0),
                        "aduana": int(item.get("aduana", 0) or 0)
                    })
                inv_req_payload = {
                    "items": sku_items,
                    "categoria_filter": cat_filter if cat_filter != "Todas" else None,
                    "only_alerts": only_alerts
                }
                res_inv_advisor = api_post("/advisor/inventory-insights", inv_req_payload)
                if res_inv_advisor:
                    st.session_state["inventory_advisor_result"] = res_inv_advisor

        if "inventory_advisor_result" in st.session_state and st.session_state["inventory_advisor_result"]:
            inv_res = st.session_state["inventory_advisor_result"]
            with st.expander("📋 Diagnóstico Ejecutivo de Abastecimiento & Plan de Contingencia", expanded=True):
                is_llm_inv = inv_res.get("provider") == "local_llm"
                inv_lat = inv_res.get("latency_ms", 0.0)
                inv_model = inv_res.get("model", "N/A")

                # Badge del motor
                if is_llm_inv:
                    st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({inv_model})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{inv_lat:.1f} ms</strong></small></div>', unsafe_allow_html=True)
                else:
                    st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico Operativo ({inv_model})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{inv_lat:.1f} ms</strong></small></div>', unsafe_allow_html=True)

                # Métricas Cuantitativas Resumen
                inv_metrics = inv_res.get("metrics_summary", {})
                if inv_metrics:
                    im1, im2, im3, im4 = st.columns(4)
                    with im1:
                        st.metric(
                            "Ratio de Quiebre (Stock ≤ ROP)",
                            f"{inv_metrics.get('ratio_quiebre_pct', 0.0):.1f}%",
                            delta=f"{inv_metrics.get('quiebre_skus_count', 0)} SKUs en quiebre",
                            delta_color="inverse" if inv_metrics.get('quiebre_skus_count', 0) > 0 else "normal"
                        )
                    with im2:
                        neg_gaps = inv_metrics.get("negative_gap_count", 0)
                        st.metric(
                            "SKUs Brecha Negativa",
                            neg_gaps,
                            delta="DOH < Lead Time (Crítico)" if neg_gaps > 0 else "Cobertura suficiente",
                            delta_color="inverse" if neg_gaps > 0 else "normal"
                        )
                    with im3:
                        min_gap = inv_metrics.get("min_gap_doh_lead_time", 0.0)
                        st.metric(
                            "Brecha Mínima (DOH - Lead Time)",
                            f"{min_gap:+.1f} días",
                            delta=f"{min_gap:+.1f}d",
                            delta_color="inverse" if min_gap < 0 else "normal"
                        )
                    with im4:
                        crit_list = inv_res.get("critical_items", [])
                        st.metric("SKU Máxima Urgencia", crit_list[0] if crit_list else "Ninguno")

                # Secciones del Diagnóstico
                col_diag_inv, col_imp_inv = st.columns(2)
                with col_diag_inv:
                    st.markdown("##### 1. 🚨 Diagnóstico Operativo de Desabastecimiento")
                    st.warning(inv_res.get("diagnosis", "Sin diagnóstico disponible."))
                with col_imp_inv:
                    st.markdown("##### 2. 📉 Impacto en Nivel de Servicio & OPEX Logístico")
                    st.error(inv_res.get("cash_service_impact", "Sin impacto disponible."))

                st.markdown("##### 3. 🛡️ Plan de Contingencia Inmediato (3 Puntos Ejecutivos)")
                actions_inv = inv_res.get("action_plan", [])
                for idx, act in enumerate(actions_inv, start=1):
                    clean_a = re.sub(r"^(\d+[\.\)]|\-|\*)\s*", "", act)
                    st.markdown(f"""
                    <div style="background-color: #f8f9fa; border-left: 4px solid #0d6efd; padding: 10px 14px; margin-bottom: 8px; border-radius: 4px;">
                        <strong>Directriz #{idx}:</strong> {clean_a}
                    </div>
                    """, unsafe_allow_html=True)

                # Tabla interactiva de priorización de órdenes de compra según brecha (DOH - Lead Time)
                st.markdown("##### 🛒 Matriz de Priorización de Órdenes de Compra (Brecha DOH vs. Lead Time)")
                st.caption("Ordenado por la brecha más crítica: SKUs con brecha negativa (DOH < Lead Time) agotarán existencias antes de la reposición del proveedor.")

                df_po = pd.DataFrame(data).copy()
                df_po["doh_num"] = df_po["doh"].astype(float)
                df_po["lead_time_num"] = df_po["lead_time_dias"].astype(float)
                df_po["brecha"] = df_po["doh_num"] - df_po["lead_time_num"]
                df_po["stock_actual_num"] = df_po["stock_actual"].astype(int)
                df_po["rop_num"] = df_po["rop"].astype(float)

                def get_po_priority(row):
                    if row["brecha"] < 0:
                        return "🚨 CRÍTICA (DOH < Lead Time)"
                    elif row["is_alert"]:
                        return "⚠️ ALTA (Stock ≤ ROP)"
                    elif row["brecha"] < 15:
                        return "🟡 MEDIA (Monitorear)"
                    else:
                        return "✅ NORMAL"

                df_po["prioridad"] = df_po.apply(get_po_priority, axis=1)
                df_po = df_po.sort_values(by=["brecha", "doh_num"], ascending=[True, True])

                display_po_cols = {
                    "sku": "SKU",
                    "nombre": "Producto",
                    "categoria": "Categoría",
                    "stock_actual_num": "Stock Total",
                    "rop_num": "Punto Reorden (ROP)",
                    "doh_num": "DOH (Días)",
                    "lead_time_num": "Lead Time (Días)",
                    "brecha": "Brecha (DOH - Lead Time)",
                    "prioridad": "Prioridad de Compra"
                }

                df_po_display = df_po[list(display_po_cols.keys())].rename(columns=display_po_cols).copy()
                df_po_display["Brecha (DOH - Lead Time)"] = df_po_display["Brecha (DOH - Lead Time)"].apply(lambda x: f"{x:+.1f} días")
                df_po_display["DOH (Días)"] = df_po_display["DOH (Días)"].apply(lambda x: f"{x:.1f}")
                df_po_display["Lead Time (Días)"] = df_po_display["Lead Time (Días)"].apply(lambda x: f"{x:.0f}")
                df_po_display["Punto Reorden (ROP)"] = df_po_display["Punto Reorden (ROP)"].apply(lambda x: f"{x:.0f}")

                st.dataframe(df_po_display, use_container_width=True, hide_index=True)

                with st.expander("📄 Ver Informe Completo en Markdown"):
                    st.markdown(inv_res.get("raw_markdown", ""))

        st.divider()

        # Tabla interactiva con desglose de inventario
        df = pd.DataFrame(data)
        df["Estado"] = df["is_alert"].apply(lambda x: "🚨 REORDENAR URGENTE" if x else "✅ Óptimo")
        
        display_cols = {
            "sku": "SKU",
            "nombre": "Producto",
            "categoria": "Categoría",
            "stock_actual": "Stock Total",
            "deposito_central": "Depósito Central",
            "transito_maritimo": "Tránsito Marítimo",
            "aduana": "Aduana",
            "rop": "Punto Reorden (ROP)",
            "doh": "Days on Hand (DOH)",
            "stock_seguridad": "Stock Seg.",
            "lead_time_dias": "Lead Time (Días)",
            "Estado": "Estado Operativo"
        }
        
        available_cols = [c for c in display_cols.keys() if c in df.columns]
        df_display = df[available_cols].rename(columns=display_cols)
        
        st.subheader("📋 Matriz de Control de Stock y Puntos de Reorden")
        st.dataframe(df_display, use_container_width=True, hide_index=True)

        # Comparativo gráfico y desglose
        st.divider()
        st.subheader("📊 Analítica Gráfica y Desglose de Abastecimiento")
        tab_chart1, tab_chart2, tab_chart3 = st.tabs([
            "📉 Comparativa: Stock Actual vs. Punto de Reorden (ROP)",
            "📍 Desglose de Stock por Ubicación Física",
            "⏳ Análisis de Días de Cobertura (DOH)"
        ])

        with tab_chart1:
            st.markdown("Identifica visualmente qué productos tienen su stock actual por debajo del umbral de seguridad y reabastecimiento (ROP).")
            chart_stock_rop = df.set_index("nombre")[["stock_actual", "rop"]].astype(float)
            chart_stock_rop.columns = ["Stock Actual", "Punto de Reorden (ROP)"]
            st.bar_chart(chart_stock_rop, height=350)

        with tab_chart2:
            st.markdown("Desglose del stock físico consolidado según su ubicación en la cadena logística:")
            loc_cols = [c for c in ["deposito_central", "transito_maritimo", "aduana"] if c in df.columns]
            if loc_cols:
                chart_loc = df.set_index("nombre")[loc_cols].astype(float)
                chart_loc.columns = ["Depósito Central", "Tránsito Marítimo", "Aduana"][:len(loc_cols)]
                st.bar_chart(chart_loc, height=350)
            else:
                st.info("Desglose por ubicación no disponible en el conjunto actual.")

        with tab_chart3:
            st.markdown("Días de inventario disponibles (DOH) para abastecer la demanda esperada:")
            chart_doh = df.set_index("nombre")[["doh"]].astype(float)
            chart_doh.columns = ["Días de Cobertura (DOH)"]
            st.bar_chart(chart_doh, height=350)

    else:
        st.info("No se encontraron registros de inventario con los criterios seleccionados.")

# ==========================================================
# 2. ANALÍTICA COMERCIAL & SIMULADOR DE PRICING
# ==========================================================
elif menu == "🏷️ Analítica Comercial & Pricing":
    st.title("🏷️ Analítica Comercial & Simulador de Pricing")
    st.caption("Control de rentabilidad unitaria, márgenes brutos, markups y simulación en tiempo real de sensibilidad comercial ante descuentos.")

    tab1, tab2 = st.tabs(["📊 Catálogo de Precios y Márgenes", "🎯 Simulador Interactivo de Pricing & Descuentos"])

    with tab1:
        st.subheader("Catálogo de Márgenes y Rentabilidad por Producto")
        margins_data = api_get("/pricing/margins")

        if margins_data:
            df_m = pd.DataFrame(margins_data)

            # KPIs Resumen del Catálogo
            avg_margin = df_m["gross_margin_pct"].astype(float).mean() * 100
            avg_markup = df_m["markup_pct"].astype(float).mean() * 100
            total_prods = len(df_m)

            k1, k2, k3 = st.columns(3)
            with k1:
                st.metric("Total Productos Monitoreados", total_prods)
            with k2:
                st.metric("Margen Bruto Promedio", f"{avg_margin:.2f}%")
            with k3:
                st.metric("Markup Promedio", f"{avg_markup:.2f}%")

            st.divider()

            # Búsqueda y filtrado
            col_s1, col_s2 = st.columns([2, 1])
            with col_s1:
                search_txt = st.text_input("🔍 Buscar por Nombre o SKU", "")
            with col_s2:
                unique_cats = {}
                for c in df_m["categoria"]:
                    if c and str(c).strip():
                        c_str = str(c).strip()
                        low = c_str.lower()
                        if low not in unique_cats:
                            unique_cats[low] = c_str
                cats = ["Todas"] + sorted(list(unique_cats.values()), key=lambda x: x.lower())
                sel_cat = st.selectbox("Categoría", cats, key="pricing_cat_filter")

            df_filt = df_m.copy()
            if search_txt:
                df_filt = df_filt[df_filt["nombre"].str.contains(search_txt, case=False) | df_filt["sku"].str.contains(search_txt, case=False)]
            if sel_cat != "Todas":
                df_filt = df_filt[df_filt["categoria"].str.lower() == sel_cat.lower()]

            # Formato corporativo
            df_disp = pd.DataFrame()
            df_disp["SKU"] = df_filt["sku"]
            df_disp["Producto"] = df_filt["nombre"]
            df_disp["Categoría"] = df_filt["categoria"]
            df_disp["Costo Unitario"] = df_filt["costo_unitario"].apply(lambda x: f"${float(x):,.2f}")
            df_disp["Precio Venta"] = df_filt["precio_venta"].apply(lambda x: f"${float(x):,.2f}")
            df_disp["Margen Bruto"] = df_filt["gross_margin_pct"].apply(lambda x: f"{float(x)*100:.2f}%")
            df_disp["Markup"] = df_filt["markup_pct"].apply(lambda x: f"{float(x)*100:.2f}%")
            df_disp["Contribución Marginal"] = df_filt["unit_contribution_margin"].apply(lambda x: f"${float(x):,.2f}")
            df_disp["Ratio Marginal"] = df_filt["marginal_ratio"].apply(lambda x: f"{float(x)*100:.2f}%")

            st.dataframe(df_disp, use_container_width=True, hide_index=True)
        else:
            st.info("No hay datos de productos disponibles.")

    with tab2:
        st.subheader("Simulador Financiero de Sensibilidad Comercial")
        st.markdown("Evalúa el impacto de descuentos comerciales, comisiones y costos de flete sobre el margen bruto y la contribución unitaria.")

        # Opción para precargar desde catálogo
        margins_for_select = api_get("/pricing/margins") or []
        sku_options = ["(Entrada Manual Personalizada)"] + [f"{item['sku']} - {item['nombre']}" for item in margins_for_select]
        selected_sku_label = st.selectbox("📦 Precargar datos desde SKU existente (opcional):", sku_options)

        default_base_price = 150.0
        default_cost = 100.0

        if selected_sku_label != "(Entrada Manual Personalizada)":
            chosen_sku = selected_sku_label.split(" - ")[0]
            matched = next((item for item in margins_for_select if item["sku"] == chosen_sku), None)
            if matched:
                default_base_price = float(matched["precio_venta"])
                default_cost = float(matched["costo_unitario"])

        col_in1, col_in2 = st.columns(2)
        with col_in1:
            base_p = st.number_input("Precio Base de Venta ($)", min_value=1.0, value=default_base_price, step=5.0)
            cost_u = st.number_input("Costo Directo Unitario ($)", min_value=0.0, value=default_cost, step=5.0)
            discount_p = st.slider("Descuento Comercial (%)", min_value=0, max_value=70, value=40, step=1)

        with col_in2:
            comm_p = st.slider("Comisión sobre Venta (%)", min_value=0, max_value=25, value=0, step=1)
            freight_u = st.number_input("Flete / Logística Unitaria ($)", min_value=0.0, value=0.0, step=1.0)
            st.markdown("<div style='padding-top: 28px;'></div>", unsafe_allow_html=True)
            recalc = st.button("🚀 Calcular Rentabilidad", type="primary", use_container_width=True)

        # Ejecución de la simulación
        sim_req = {
            "base_price": str(base_p),
            "cost": str(cost_u),
            "discount_pct": str(discount_p / 100.0),
            "commission_pct": str(comm_p / 100.0),
            "freight": str(freight_u)
        }
        res = api_post("/pricing/simulate", sim_req)

        if res:
            st.divider()
            disc_price = float(res['discounted_price'])
            gross_m = float(res['gross_margin'])
            unit_cm = float(res['unit_contribution_margin'])
            markup_res = float(res['markup'])
            is_neg = res.get('is_negative_margin', False)

            # Tarjetas de Resultados
            r1, r2, r3, r4 = st.columns(4)
            with r1:
                st.metric("Precio Descontado Final", f"${disc_price:,.2f}")
            with r2:
                st.metric("Margen Bruto", f"{gross_m*100:.2f}%", delta=f"{gross_m*100:.2f}%", delta_color="normal" if gross_m > 0 else "inverse")
            with r3:
                st.metric("Contribución Marginal Unit.", f"${unit_cm:,.2f}", delta=f"${unit_cm:,.2f}", delta_color="normal" if unit_cm > 0 else "inverse")
            with r4:
                st.metric("Markup Efectivo", f"{markup_res*100:.2f}%")

            # Detección visual de márgenes negativos
            if is_neg or gross_m < 0:
                st.error(f"""
                🚨 **ALERTA CRÍTICA: DESTRUCCIÓN DE MARGEN**  
                El descuento comercial del **{discount_p}%** sitúa el precio de venta (${disc_price:,.2f}) por debajo del costo unitario directo (${cost_u:,.2f}) o costos variables, generando una **pérdida unitaria de ${abs(unit_cm):,.2f}**.  
                *Acción requerida: Reducir el descuento a un umbral que preserve margen positivo.*
                """)
            elif gross_m < 0.15:
                st.warning(f"⚠️ **Margen Reducido ({gross_m*100:.2f}%)** — La operación es rentable pero opera cerca del umbral de quiebre. Altamente vulnerable a variaciones de flete.")
            else:
                st.success(f"✅ **Margen Comercial Saludable ({gross_m*100:.2f}%)** — La operación mantiene una contribución neta de **${unit_cm:,.2f}** por unidad.")

            # Gráfico de descomposición del precio
            st.subheader("Descomposición de la Estructura de Precio Unitario")
            comm_val = disc_price * (comm_p / 100.0)
            cost_val = cost_u
            freight_val = freight_u
            margin_net = unit_cm

            df_waterfall = pd.DataFrame({
                "Componente": ["Costo Directo", "Flete", "Comisión Venta", "Contribución Neta"],
                "Monto ($)": [cost_val, freight_val, comm_val, margin_net]
            })
            st.bar_chart(df_waterfall.set_index("Componente"), height=300)

# ==========================================================
# 3. VARIANCE ANALYSIS PRESUPUESTARIO
# ==========================================================
elif menu == "📈 Variance Analysis Presupuestario":
    st.title("📈 Variance Analysis Presupuestario (Budget vs. Actuals)")
    st.caption("Control de desviaciones presupuestarias con semaforización contable Green / Yellow / Red (Tolerancia del ±2%) y planificador inteligente de 3 escenarios.")

    tab_variance, tab_scenarios = st.tabs(["📊 Variance vs. Actuals", "🎯 Planificador de 3 Escenarios"])

    with tab_variance:
        var_data = api_get("/budget/variance")

        if var_data:
            df_var = pd.DataFrame(var_data)

            # Filtros Superiores
            col_f1, col_f2 = st.columns(2)
            with col_f1:
                periodos = ["Todos"] + sorted(list(df_var["periodo"].unique()))
                sel_periodo = st.selectbox("Seleccionar Período Fiscal", periodos, key="var_sel_periodo")
            with col_f2:
                sel_tipo = st.selectbox("Tipo de Cuenta", ["Todos", "VENTAS", "COSTOS"], key="var_sel_tipo")

            df_filtered = df_var.copy()
            if sel_periodo != "Todos":
                df_filtered = df_filtered[df_filtered["periodo"] == sel_periodo]
            if sel_tipo != "Todos":
                df_filtered = df_filtered[df_filtered["tipo"] == sel_tipo]

            # KPIs Resumen
            t_presup = df_filtered["monto_presupuestado"].astype(float).sum()
            t_real = df_filtered["monto_real"].astype(float).sum()
            t_diff = t_real - t_presup
            pct_diff = (t_diff / t_presup * 100) if t_presup > 0 else 0.0

            k1, k2, k3 = st.columns(3)
            with k1:
                st.metric("Total Presupuestado", f"${t_presup:,.2f}")
            with k2:
                st.metric("Total Ejecutado (Real)", f"${t_real:,.2f}")
            with k3:
                st.metric(
                    "Desviación Neta",
                    f"${t_diff:,.2f}",
                    delta=f"{pct_diff:+.2f}%",
                    delta_color="normal" if t_diff >= 0 else "inverse"
                )

            st.divider()

            # Semáforos Contables
            def format_status(s):
                if s == "Green":
                    return "🟢 Favorable (Green)"
                elif s == "Yellow":
                    return "🟡 En Presupuesto (Yellow)"
                else:
                    return "🔴 Desfavorable (Red)"

            df_display_budget = pd.DataFrame()
            df_display_budget["Período"] = df_filtered["periodo"]
            df_display_budget["Categoría"] = df_filtered["categoria"]
            df_display_budget["Tipo"] = df_filtered["tipo"]
            df_display_budget["Presupuestado"] = df_filtered["monto_presupuestado"].apply(lambda x: f"${float(x):,.2f}")
            df_display_budget["Real"] = df_filtered["monto_real"].apply(lambda x: f"${float(x):,.2f}")
            df_display_budget["Variación $"] = df_filtered["variacion_absoluta"].apply(lambda x: f"${float(x):,.2f}")
            df_display_budget["Variación %"] = df_filtered["variacion_porcentual"].apply(lambda x: f"{float(x)*100:+.2f}%")
            df_display_budget["Semáforo Contable"] = df_filtered["status"].apply(format_status)

            st.subheader("📋 Matriz de Variance Analysis con Semáforos Contables")
            st.dataframe(df_display_budget, use_container_width=True, hide_index=True)

            st.divider()

            # ==========================================================
            # COPILOTO ASESOR IA - DIAGNÓSTICO EJECUTIVO DE VARIANCE
            # ==========================================================
            st.subheader("🤖 Diagnóstico Ejecutivo del Copiloto IA")
            col_btn_var, col_btn_var_desc = st.columns([1, 2])
            with col_btn_var:
                btn_audit_variance = st.button("🔍 Generar Auditoría con IA", type="primary", use_container_width=True, key="btn_variance_advisor")
            with col_btn_var_desc:
                st.caption("Audita la matriz de variaciones activa, detecta dispersión de precios, caídas de volumen o sobregastos en OPEX y proyecta el impacto en Working Capital.")

            if btn_audit_variance:
                with st.spinner("🤖 Copiloto IA auditando variaciones presupuestarias..."):
                    lines_payload = []
                    for _, row in df_filtered.iterrows():
                        lines_payload.append({
                            "id": int(row["id"]) if pd.notnull(row.get("id")) else None,
                            "categoria": str(row.get("categoria", "")),
                            "tipo": str(row.get("tipo", "VENTAS")),
                            "periodo": str(row.get("periodo", "")),
                            "monto_presupuestado": str(row.get("monto_presupuestado", 0)),
                            "monto_real": str(row.get("monto_real", 0)),
                            "variacion_absoluta": str(row.get("variacion_absoluta", 0)),
                            "variacion_porcentual": str(row.get("variacion_porcentual", 0)),
                            "status": str(row.get("status", ""))
                        })
                    var_req_payload = {
                        "periodo": sel_periodo if sel_periodo != "Todos" else None,
                        "lines": lines_payload,
                        "total_presupuestado": str(t_presup),
                        "total_real": str(t_real)
                    }
                    res_var_advisor = api_post("/advisor/variance-insights", var_req_payload)
                    if res_var_advisor:
                        st.session_state["variance_advisor_result"] = res_var_advisor

            if "variance_advisor_result" in st.session_state and st.session_state["variance_advisor_result"]:
                var_res = st.session_state["variance_advisor_result"]
                with st.expander("📋 Informe Ejecutivo del Copiloto Financiero (Variance Controller)", expanded=True):
                    is_llm_var = var_res.get("provider") == "local_llm"
                    var_lat = var_res.get("latency_ms", 0.0)
                    var_model = var_res.get("model", "N/A")

                    # Badge del motor
                    if is_llm_var:
                        st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({var_model})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{var_lat:.1f} ms</strong></small></div>', unsafe_allow_html=True)
                    else:
                        st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico Contable ({var_model})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{var_lat:.1f} ms</strong></small></div>', unsafe_allow_html=True)

                    # Alerta si hay líneas desfavorables críticas (> 5%)
                    crit_lines = var_res.get("critical_items", [])
                    if crit_lines:
                        st.error(
                            f"🚨 **Alerta Crítica Presupuestaria:** Se detectaron **{len(crit_lines)}** rubros con desvío desfavorable superior al 5% frente a la meta:\n\n"
                            + "\n".join([f"- **{line_item}**" for line_item in crit_lines])
                        )
                    else:
                        st.success("✅ **Presupuesto Bajo Control:** No se detectaron partidas con desvíos desfavorables mayores al 5%.")

                    # Métricas Cuantitativas Resumen
                    var_metrics = var_res.get("metrics_summary", {})
                    if var_metrics:
                        vm1, vm2, vm3, vm4 = st.columns(4)
                        with vm1:
                            st.metric("Partidas Críticas (>5%)", var_metrics.get("unfavorable_count", len(crit_lines)))
                        with vm2:
                            net_cash = var_metrics.get("net_cash_impact", 0.0)
                            st.metric(
                                "Impacto Neto en Caja",
                                f"${net_cash:,.2f}",
                                delta=f"${net_cash:,.2f}",
                                delta_color="normal" if net_cash >= 0 else "inverse"
                            )
                        with vm3:
                            var_v = var_metrics.get("desvio_ventas_pct", 0.0)
                            st.metric("Desvío Global Ventas", f"{var_v:+.2f}%", delta=f"{var_v:+.2f}%", delta_color="normal" if var_v >= 0 else "inverse")
                        with vm4:
                            var_c = var_metrics.get("desvio_costos_pct", 0.0)
                            st.metric("Desvío Global OPEX/Costos", f"{var_c:+.2f}%", delta=f"{var_c:+.2f}%", delta_color="inverse" if var_c > 0 else "normal")

                    # Secciones del Diagnóstico
                    col_diag_var, col_imp_var = st.columns(2)
                    with col_diag_var:
                        st.markdown("##### 1. 🔍 Diagnóstico del Desvío (Volumen, Precio u OPEX)")
                        st.info(var_res.get("diagnosis", "Sin diagnóstico disponible."))
                    with col_imp_var:
                        st.markdown("##### 2. 💸 Impacto en Caja y Nivel de Servicio")
                        st.warning(var_res.get("cash_service_impact", "Sin impacto disponible."))

                    st.markdown("##### 3. 🎯 Plan de Acción Inmediato (3 Directrices Claras para Gerencia)")
                    actions_var = var_res.get("action_plan", [])
                    for idx, act in enumerate(actions_var, start=1):
                        clean_a = re.sub(r"^(\d+[\.\)]|\-|\*)\s*", "", act)
                        st.markdown(f"""
                        <div style="background-color: #f8f9fa; border-left: 4px solid #198754; padding: 10px 14px; margin-bottom: 8px; border-radius: 4px;">
                            <strong>Directriz #{idx}:</strong> {clean_a}
                        </div>
                        """, unsafe_allow_html=True)

                    with st.expander("📄 Ver Informe Completo en Markdown"):
                        st.markdown(var_res.get("raw_markdown", ""))

            # Gráfico Comparativo Presupuesto vs Real
            st.divider()
            st.subheader("📊 Comparativa Visual: Presupuestado vs. Real Ejecutado")
            chart_budget = df_filtered[["categoria", "monto_presupuestado", "monto_real"]].copy()
            chart_budget["monto_presupuestado"] = chart_budget["monto_presupuestado"].astype(float)
            chart_budget["monto_real"] = chart_budget["monto_real"].astype(float)
            chart_grouped = chart_budget.groupby("categoria").sum()
            chart_grouped.columns = ["Presupuestado", "Real"]
            st.bar_chart(chart_grouped, height=350)

        else:
            st.info("No se encontraron registros de presupuesto.")

    with tab_scenarios:
        st.subheader("🎯 Planificador Estratégico de 3 Escenarios (FP&A Engine)")
        st.caption("Proyección cuantitativa rigurosa (Conservador, Base, Agresivo) con inferencia cualitativa de supuestos, riesgos y planes de contingencia (qwen2.5:7b).")

        col_sc_btn, col_sc_sel = st.columns([1, 1])
        with col_sc_btn:
            btn_scenarios = st.button("⚡ Generar y Evaluar 3 Escenarios (qwen2.5:7b)", type="primary", use_container_width=True, key="btn_budget_scenarios")
        with col_sc_sel:
            scenario_filter = st.selectbox(
                "Selector de Escenario:",
                ["Todos (Comparativa)", "Conservador (Defensivo)", "Base (Moderado)", "Agresivo (Expansión)"],
                key="scenario_filter_selector"
            )

        if btn_scenarios:
            with st.spinner("🤖 Generando y evaluando 3 escenarios presupuestarios con qwen2.5:7b..."):
                sc_payload = {}
                res_sc = api_post("/advisor/budget-scenarios", sc_payload)
                if res_sc:
                    st.session_state["budget_scenarios_result"] = res_sc

        if "budget_scenarios_result" in st.session_state and st.session_state["budget_scenarios_result"]:
            sc_data = st.session_state["budget_scenarios_result"]
            hist = sc_data.get("historical", {})
            con = sc_data.get("conservative", {})
            base = sc_data.get("base", {})
            agg = sc_data.get("aggressive", {})

            # Resumen de línea base histórica
            if hist:
                st.markdown(f"""
                <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 10px 14px; margin-bottom: 16px; border-radius: 4px;">
                    <strong>📌 Base Histórica de Referencia:</strong>
                    Ventas: <strong>${float(hist.get('sales', 0)):,.2f}</strong> |
                    CMV: <strong>${float(hist.get('cogs', 0)):,.2f}</strong> |
                    Margen Bruto: <strong>${float(hist.get('gross_margin', 0)):,.2f}</strong> |
                    OPEX: <strong>${float(hist.get('opex', 0)):,.2f}</strong> |
                    Margen Contribución: <strong>${float(hist.get('contribution_margin', 0)):,.2f}</strong>
                </div>
                """, unsafe_allow_html=True)

            sc_list = [con, base, agg]
            table_rows = []
            for item in sc_list:
                table_rows.append({
                    "Escenario": item.get("name", ""),
                    "Enfoque Estratégico": item.get("focus", ""),
                    "Crecimiento Ventas %": f"{float(item.get('sales_growth_pct', 0)) * 100:+.1f}%",
                    "Ventas Netas Proyectadas": f"${float(item.get('projected_sales', 0)):,.2f}",
                    "CMV": f"${float(item.get('projected_cogs', 0)):,.2f}",
                    "Margen Bruto ($ y %)": f"${float(item.get('gross_margin', 0)):,.2f} ({float(item.get('gross_margin_pct', 0)) * 100:.2f}%)",
                    "OPEX Estimado": f"${float(item.get('projected_opex', 0)):,.2f}",
                    "Margen de Contribución Total ($ y %)": f"${float(item.get('contribution_margin', 0)):,.2f} ({float(item.get('contribution_margin_pct', 0)) * 100:.2f}%)",
                    "Delta vs Base Histórica": f"${float(item.get('delta_cm_vs_historical', 0)):+,.2f}"
                })

            df_table = pd.DataFrame(table_rows)

            if scenario_filter != "Todos (Comparativa)":
                df_table_filtered = df_table[df_table["Escenario"].apply(lambda s: scenario_filter.split()[0].lower() in s.lower())]
            else:
                df_table_filtered = df_table

            st.markdown("##### 📋 Matriz Comparativa de Escenarios")
            st.dataframe(df_table_filtered, use_container_width=True, hide_index=True)

            # Gráfico comparativo de barras
            st.markdown("##### 📊 Comparativa Visual: Ventas, CMV, Margen Bruto y Contribución Marginal")
            chart_rows = []
            for item in sc_list:
                chart_rows.append({
                    "Escenario": item.get("name", "").split()[0],
                    "Ventas Netas": float(item.get("projected_sales", 0)),
                    "CMV": float(item.get("projected_cogs", 0)),
                    "Margen Bruto": float(item.get("gross_margin", 0)),
                    "Contribución Marginal": float(item.get("contribution_margin", 0))
                })
            df_chart = pd.DataFrame(chart_rows)
            if scenario_filter != "Todos (Comparativa)":
                df_chart = df_chart[df_chart["Escenario"].apply(lambda s: scenario_filter.split()[0].lower() in s.lower())]

            st.bar_chart(df_chart.set_index("Escenario"), height=350)

            # Panel expandible con el análisis cualitativo generado por qwen2.5:7b
            with st.expander("📋 Análisis Cualitativo & Supuestos Estratégicos (qwen2.5:7b)", expanded=True):
                is_llm_sc = sc_data.get("provider") == "local_llm"
                sc_model = sc_data.get("model", "qwen2.5:7b")
                sc_lat = sc_data.get("latency_ms", 0.0)

                if is_llm_sc:
                    st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({sc_model})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{sc_lat:.1f} ms</strong></small></div>', unsafe_allow_html=True)
                else:
                    st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico ({sc_model})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{sc_lat:.1f} ms</strong></small></div>', unsafe_allow_html=True)

                st.markdown(sc_data.get("raw_markdown", "Sin análisis cualitativo disponible."))
        else:
            st.info("💡 Haz clic en el botón superior **⚡ Generar y Evaluar 3 Escenarios (qwen2.5:7b)** para calcular las proyecciones y obtener el análisis cualitativo integral.")

# ==========================================================
# 4. COPILOTO EJECUTIVO & NUEVAS INICIATIVAS
# ==========================================================
elif menu == "🚀 Copiloto Ejecutivo & Nuevas Iniciativas":
    st.title("🚀 Copiloto Ejecutivo & Nuevas Iniciativas")
    st.caption("Suite de inteligencia de negocios para evaluación de factibilidad, minutas ejecutivas cross-área y auditorías financieras con IA.")

    tab_init, tab_cross, tab_quick = st.tabs([
        "💡 Evaluador de Factibilidad",
        "📋 Minutas & Reportes Cross-Área",
        "⚡ Acciones Rápidas de Copiloto"
    ])

    # ----------------------------------------------------------
    # SUB-MÓDULO A: EVALUADOR DE FACTIBILIDAD DE NUEVAS INICIATIVAS
    # ----------------------------------------------------------
    with tab_init:
        st.subheader("💡 Evaluador de Factibilidad de Nuevas Iniciativas")
        st.caption("Simulación financiera del Business Case: Break-Even Point, retorno sobre inversión (ROI), payback y análisis de riesgos competitivos.")

        col_in1, col_in2 = st.columns(2)
        with col_in1:
            init_name = st.text_input("Nombre de la Iniciativa / Proyecto:", value="Expansión Línea Premium Válvulas Inox", key="init_name_val")
            init_inv = st.number_input("Inversión Inicial ($):", min_value=0.0, value=25000.0, step=1000.0, key="init_inv_val")
            init_cost = st.number_input("Costo Unitario Directo Estimado ($):", min_value=0.01, value=45.0, step=5.0, key="init_cost_val")
            init_price = st.number_input("Precio de Venta Unitario Estimado ($):", min_value=0.01, value=95.0, step=5.0, key="init_price_val")

        with col_in2:
            init_demand = st.number_input("Demanda Esperada (unidades):", min_value=1, value=1200, step=50, key="init_demand_val")
            init_fixed = st.number_input("Costos Fijos Adicionales ($):", min_value=0.0, value=5000.0, step=500.0, key="init_fixed_val")
            init_comp = st.text_area(
                "Notas sobre Competidores y Mercado:",
                value="El competidor líder comercializa a $110 con calidad similar. Hay alternativa asiática a $85 pero con lead time de 90 días.",
                height=68,
                key="init_comp_val"
            )

        btn_eval_init = st.button("📊 Evaluar Viabilidad con IA", type="primary", use_container_width=True, key="btn_run_eval_init")

        if btn_eval_init:
            with st.spinner("🤖 Copiloto IA calculando viabilidad económica y analizando riesgos frente a competidores..."):
                payload_i = {
                    "initiative_name": init_name,
                    "initial_investment": str(init_inv),
                    "estimated_unit_cost": str(init_cost),
                    "estimated_unit_price": str(init_price),
                    "expected_demand": int(init_demand),
                    "fixed_costs": str(init_fixed),
                    "competitors_notes": init_comp
                }
                res_i = api_post("/advisor/evaluate-initiative", payload_i)
                if res_i:
                    st.session_state["initiative_eval_result"] = res_i

        if "initiative_eval_result" in st.session_state and st.session_state["initiative_eval_result"]:
            res_eval = st.session_state["initiative_eval_result"]
            st.divider()

            is_llm_e = res_eval.get("provider") == "local_llm"
            mod_e = res_eval.get("model", "qwen2.5:7b")
            lat_e = res_eval.get("latency_ms", 0.0)

            if is_llm_e:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({mod_e})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_e:.1f} ms</strong></small></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico ({mod_e})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_e:.1f} ms</strong></small></div>', unsafe_allow_html=True)

            viab_status = str(res_eval.get("viability", "Factible"))
            if viab_status.lower() == "factible":
                badge_html = '<span class="badge-green" style="font-size: 1.05rem; padding: 6px 14px;">✅ FACTIBLE</span>'
            elif viab_status.lower() == "marginal":
                badge_html = '<span class="badge-yellow" style="font-size: 1.05rem; padding: 6px 14px;">⚠️ MARGINAL</span>'
            else:
                badge_html = '<span class="badge-red" style="font-size: 1.05rem; padding: 6px 14px;">🚨 INVIABLE</span>'

            st.markdown(f"#### Dictamen de Viabilidad del Business Case: {badge_html}", unsafe_allow_html=True)

            # Tarjetas de Métricas Financieras
            c_cm, c_be_u, c_be_r, c_pay, c_roi, c_v = st.columns(6)
            u_cm = float(res_eval.get("unit_contribution_margin", 0))
            m_rat = float(res_eval.get("marginal_ratio", 0)) * 100
            be_u = int(res_eval.get("break_even_units", 0))
            be_r = float(res_eval.get("break_even_revenue", 0))
            pay_c = float(res_eval.get("payback_cycles", 0))
            roi_v = float(res_eval.get("roi_pct", 0)) * 100

            with c_cm:
                st.metric("Margen Contribución Unit.", f"${u_cm:,.2f}", delta=f"{m_rat:.1f}% del precio")
            with c_be_u:
                st.metric("Break-Even (Unidades)", f"{be_u:,} un.")
            with c_be_r:
                st.metric("Break-Even ($ Facturación)", f"${be_r:,.2f}")
            with c_pay:
                st.metric("Payback Estimado", f"{pay_c:.2f} ciclos")
            with c_roi:
                st.metric("Retorno ROI", f"{roi_v:+.1f}%", delta=f"{roi_v:+.1f}%", delta_color="normal" if roi_v > 0 else "inverse")
            with c_v:
                st.metric("Dictamen", viab_status)

            st.write("")
            st.subheader("🛡️ Análisis de Riesgos Frente a Competidores")
            st.info(res_eval.get("risk_assessment", "Sin análisis de riesgo registrado."))

            with st.expander("📄 Reporte Ejecutivo Completo del Copiloto", expanded=True):
                st.markdown(res_eval.get("raw_markdown", ""))

    # ----------------------------------------------------------
    # SUB-MÓDULO B: GENERADOR DE MINUTAS Y REPORTES CROSS-ÁREA
    # ----------------------------------------------------------
    with tab_cross:
        st.subheader("📋 Generador de Minutas y Reportes Cross-Área")
        st.caption("Síntesis multinivel adaptada automáticamente para la audiencia gerencial de destino.")

        col_a1, col_a2 = st.columns([1, 1])
        with col_a1:
            audience_opts = [
                "Directorio / Gerencia General",
                "Gerencia Comercial",
                "Jefatura de Logística / Operaciones"
            ]
            chosen_audience = st.selectbox("🎯 Selector de Audiencia:", audience_opts, key="cross_audience_sel")
            if "Directorio" in chosen_audience:
                st.info("📌 **Enfoque Directorio:** EBITDA, flujo de caja libre, capital de trabajo, retorno de capital y riesgos macroeconómicos.")
            elif "Comercial" in chosen_audience:
                st.info("📌 **Enfoque Comercial:** Cumplimiento de cuotas de venta, mix de productos, dispersión de pricing por canal y márgenes brutos.")
            else:
                st.info("📌 **Enfoque Logística / Operaciones:** Días de cobertura (DOH), rotación, lead time de proveedores y reposición de stock.")

        with col_a2:
            extra_context_val = st.text_area(
                "Contexto Adicional / Prioridades Estratégicas (opcional):",
                value="Cierre de trimestre con foco en control de inventario de baja rotación y preservación de liquidez.",
                height=85,
                key="cross_context_val"
            )

        btn_run_cross = st.button("📝 Generar Minuta Ejecutiva", type="primary", use_container_width=True, key="btn_run_cross_report")

        if btn_run_cross:
            with st.spinner(f"🤖 Copiloto IA redactando informe adaptado para {chosen_audience}..."):
                payload_c = {
                    "audience": chosen_audience,
                    "periodo": None,
                    "extra_context": extra_context_val
                }
                res_c = api_post("/advisor/generate-cross-report", payload_c)
                if res_c:
                    st.session_state["cross_report_result"] = res_c

        if "cross_report_result" in st.session_state and st.session_state["cross_report_result"]:
            cr_data = st.session_state["cross_report_result"]
            st.divider()

            is_llm_cr = cr_data.get("provider") == "local_llm"
            mod_cr = cr_data.get("model", "qwen2.5:7b")
            lat_cr = cr_data.get("latency_ms", 0.0)

            if is_llm_cr:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({mod_cr})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_cr:.1f} ms</strong></small></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico ({mod_cr})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_cr:.1f} ms</strong></small></div>', unsafe_allow_html=True)

            km_dict = cr_data.get("key_metrics", {})
            if km_dict:
                mc1, mc2, mc3, mc4, mc5 = st.columns(5)
                with mc1:
                    st.metric("Ventas Totales", f"${float(km_dict.get('ventas', 0)):,.2f}")
                with mc2:
                    st.metric("Costos Totales", f"${float(km_dict.get('costos', 0)):,.2f}")
                with mc3:
                    st.metric("Margen Bruto", f"{float(km_dict.get('margen_bruto_pct', 0)):.1f}%")
                with mc4:
                    st.metric("EBITDA Estimado", f"${float(km_dict.get('ebitda_estimado', 0)):,.2f}")
                with mc5:
                    st.metric("SKUs en Alerta", km_dict.get("skus_en_alerta", 0))

            st.subheader(f"📋 Minuta Ejecutiva para {cr_data.get('audience', chosen_audience)}")
            st.markdown(cr_data.get("raw_markdown", ""))

            # Botón de Descarga
            slug_aud = chosen_audience.lower().replace(" ", "_").replace("/", "_")
            st.download_button(
                label="📥 Descargar Informe en Markdown (.md)",
                data=cr_data.get("raw_markdown", ""),
                file_name=f"minuta_ejecutiva_{slug_aud}.md",
                mime="text/markdown",
                use_container_width=True,
                key="btn_download_minuta_md"
            )

    # ----------------------------------------------------------
    # SUB-MÓDULO C: ACCIONES RÁPIDAS DE COPILOTO
    # ----------------------------------------------------------
    with tab_quick:
        st.subheader("⚡ Acciones Rápidas de Copiloto")
        st.caption("Ejecución inmediata de diagnósticos especializados con desglose de varianzas, optimización de canales y planificación de abastecimiento.")

        col_q1, col_q2, col_q3 = st.columns(3)
        with col_q1:
            btn_audit_int = st.button("📊 Auditoría Integral\n(Efecto Precio/Volumen/Mix)", use_container_width=True, key="btn_quick_int")
        with col_q2:
            btn_opt_comm = st.button("🏷️ Optimizador de Canales & Pricing\n(Meli vs Mayorista)", use_container_width=True, key="btn_quick_comm")
        with col_q3:
            btn_plan_sup = st.button("📦 Plan de Abastecimiento\n& Capital de Trabajo", use_container_width=True, key="btn_quick_sup")

        if btn_audit_int:
            with st.spinner("🤖 Ejecutando Auditoría Integral (Efecto Precio/Volumen/Mix)..."):
                res_ai = api_post("/advisor/integral-audit", {"periodo": None, "lines": []})
                if res_ai:
                    st.session_state["quick_action_selected"] = "integral"
                    st.session_state["quick_integral_result"] = res_ai

        if btn_opt_comm:
            with st.spinner("🤖 Optimizando canales omnicanal y analizando dispersión de pricing..."):
                res_co = api_post("/advisor/commercial-optimizer", {"channels": []})
                if res_co:
                    st.session_state["quick_action_selected"] = "commercial"
                    st.session_state["quick_commercial_result"] = res_co

        if btn_plan_sup:
            with st.spinner("🤖 Generando plan de abastecimiento y cálculo de capital de trabajo..."):
                res_sp = api_post("/advisor/supply-action-plan", {"items": [], "target_doh": "45.0"})
                if res_sp:
                    st.session_state["quick_action_selected"] = "supply"
                    st.session_state["quick_supply_result"] = res_sp

        # Renderizar resultado activo
        active_qa = st.session_state.get("quick_action_selected")

        if active_qa == "integral" and "quick_integral_result" in st.session_state:
            q_res = st.session_state["quick_integral_result"]
            st.divider()
            is_llm_q = q_res.get("provider") == "local_llm"
            mod_q = q_res.get("model", "qwen2.5:7b")
            lat_q = q_res.get("latency_ms", 0.0)

            if is_llm_q:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({mod_q})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_q:.1f} ms</strong></small></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico ({mod_q})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_q:.1f} ms</strong></small></div>', unsafe_allow_html=True)

            st.subheader("📊 Desglose de Desvío: Efecto Precio, Volumen y Mix")
            k1, k2, k3, k4 = st.columns(4)
            pe = float(q_res.get("price_effect", 0))
            ve = float(q_res.get("volume_effect", 0))
            me = float(q_res.get("mix_effect", 0))
            tv = float(q_res.get("total_variance", 0))

            with k1:
                st.metric("Efecto Precio", f"${pe:,.2f}", delta=f"${pe:,.2f}", delta_color="normal" if pe >= 0 else "inverse")
            with k2:
                st.metric("Efecto Volumen", f"${ve:,.2f}", delta=f"${ve:,.2f}", delta_color="normal" if ve >= 0 else "inverse")
            with k3:
                st.metric("Efecto Mix", f"${me:,.2f}", delta=f"${me:,.2f}", delta_color="normal" if me >= 0 else "inverse")
            with k4:
                st.metric("Desvío Neto Total", f"${tv:,.2f}", delta=f"${tv:,.2f}", delta_color="normal" if tv >= 0 else "inverse")

            crit_anoms = q_res.get("critical_anomalies", [])
            if crit_anoms:
                st.warning("🚨 **Anomalías Críticas Identificadas:**\n\n" + "\n".join([f"- {a}" for a in crit_anoms]))

            st.markdown("##### 🛡️ Plan de Mitigación en 3 Pasos:")
            for p in q_res.get("mitigation_plan_3_steps", []):
                st.markdown(f"- {p}")

            with st.expander("📄 Ver Informe Integral en Markdown"):
                st.markdown(q_res.get("raw_markdown", ""))

        elif active_qa == "commercial" and "quick_commercial_result" in st.session_state:
            q_res = st.session_state["quick_commercial_result"]
            st.divider()
            is_llm_q = q_res.get("provider") == "local_llm"
            mod_q = q_res.get("model", "qwen2.5:7b")
            lat_q = q_res.get("latency_ms", 0.0)

            if is_llm_q:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({mod_q})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_q:.1f} ms</strong></small></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico ({mod_q})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_q:.1f} ms</strong></small></div>', unsafe_allow_html=True)

            st.subheader("🏷️ Análisis Omnicanal de Rentabilidad & Dispersión")
            ch_list = q_res.get("channel_analysis", [])
            if ch_list:
                df_ch = pd.DataFrame([
                    {
                        "Canal": c.get("channel"),
                        "Ventas": f"${float(c.get('sales', 0)):,.2f}",
                        "Costo": f"${float(c.get('cost', 0)):,.2f}",
                        "Comisión %": f"{float(c.get('commission_pct', 0)) * 100:.1f}%",
                        "Flete": f"${float(c.get('freight', 0)):,.2f}",
                        "Margen Bruto": f"{float(c.get('gross_margin_pct', 0)) * 100:.1f}%",
                        "Markup": f"{float(c.get('markup_pct', 0)) * 100:.1f}%",
                        "Contribución Marginal": f"${float(c.get('contribution_margin', 0)):,.2f}",
                        "Estado": c.get("status"),
                        "Acción Sugerida": c.get("suggested_action", "")
                    }
                    for c in ch_list
                ])
                st.dataframe(df_ch, use_container_width=True, hide_index=True)

            adj_list = q_res.get("price_adjustments_suggested", [])
            if adj_list:
                st.markdown("##### 🎯 Ajustes de Precios Sugeridos por Canal:")
                for a in adj_list:
                    st.markdown(f"- **{a.get('channel')}**: Markup actual {a.get('current_markup', 0):.1f}% ➔ Meta sugerida {a.get('suggested_markup', 0):.1f}% (Precio sugerido: ${a.get('suggested_price', 0):,.2f}) — *{a.get('recommendation', '')}*")

            with st.expander("📄 Ver Informe Comercial Completo"):
                st.markdown(q_res.get("raw_markdown", ""))

        elif active_qa == "supply" and "quick_supply_result" in st.session_state:
            q_res = st.session_state["quick_supply_result"]
            st.divider()
            is_llm_q = q_res.get("provider") == "local_llm"
            mod_q = q_res.get("model", "qwen2.5:7b")
            lat_q = q_res.get("latency_ms", 0.0)

            if is_llm_q:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-green">🟢 Motor: LLM Local Ollama ({mod_q})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_q:.1f} ms</strong></small></div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="margin-bottom: 12px;"><span class="badge-yellow">🟡 Motor: Fallback Determinístico ({mod_q})</span> &nbsp; <small style="color: #6c757d;">⏱️ Latencia: <strong>{lat_q:.1f} ms</strong></small></div>', unsafe_allow_html=True)

            sq1, sq2, sq3 = st.columns(3)
            with sq1:
                st.metric("Total SKUs Auditados", q_res.get("total_skus_evaluated", 0))
            with sq2:
                c_skus = q_res.get("critical_skus_count", 0)
                st.metric("SKUs en Quiebre / Reorden", c_skus, delta=f"{c_skus} en riesgo crítico", delta_color="inverse" if c_skus > 0 else "normal")
            with sq3:
                wk_req = float(q_res.get("total_working_capital_required", 0))
                st.metric("Capital de Trabajo Requerido", f"${wk_req:,.2f}")

            po_list = q_res.get("suggested_purchase_orders", [])
            if po_list:
                st.markdown("##### 🛒 Órdenes de Compra Sugeridas (PO):")
                df_po = pd.DataFrame([
                    {
                        "SKU": p.get("sku"),
                        "Producto": p.get("nombre", ""),
                        "Stock Actual": p.get("stock_actual", 0),
                        "ROP": float(p.get("rop", 0)),
                        "DOH (días)": float(p.get("doh", 0)),
                        "Lead Time (días)": float(p.get("lead_time_dias", 0)),
                        "Cantidad Sugerida": p.get("suggested_quantity", 0),
                        "Costo Unitario": f"${float(p.get('unit_cost', 0)):,.2f}",
                        "Capital de Trabajo": f"${float(p.get('working_capital_required', 0)):,.2f}",
                        "Prioridad": p.get("priority", "Media"),
                        "Riesgo Económico": f"${float(p.get('economic_impact_risk', 0)):,.2f}"
                    }
                    for p in po_list
                ])
                st.dataframe(df_po, use_container_width=True, hide_index=True)

            st.markdown("##### 🛡️ Plan de Acción en 3 Pasos:")
            for s in q_res.get("action_plan_3_steps", []):
                st.markdown(f"- {s}")

            with st.expander("📄 Ver Plan de Abastecimiento Completo"):
                st.markdown(q_res.get("raw_markdown", ""))


# ==========================================================
# 5. INGESTA DE DATOS (ETL)
# ==========================================================
elif menu == "📥 Ingesta de Datos (ETL)":
    st.title("📥 Ingesta y Consolidación de Datos (ETL)")
    st.caption("Carga de planillas Excel/CSV con inserciones idempotentes, normalización Decimal y detección automática de esquemas.")

    st.markdown("""
    Carga tus planillas de **Productos**, **Inventario**, **Transacciones de Ventas** o **Presupuestos**.  
    El pipeline detecta automáticamente las pestañas correspondientes y procesa los datos sin generar duplicados.
    """)

    uploaded_file = st.file_uploader(
        "Arrastra y suelta tu archivo aquí (formatos permitidos: .csv, .xlsx, .xls)",
        type=["csv", "xlsx", "xls"]
    )

    if uploaded_file is not None:
        st.write(f"📁 **Archivo seleccionado:** `{uploaded_file.name}` ({uploaded_file.size / 1024:.2f} KB)")
        
        # Previsualización del archivo antes de procesar
        try:
            if uploaded_file.name.lower().endswith(".csv"):
                df_preview = pd.read_csv(io.BytesIO(uploaded_file.getvalue()))
                st.markdown("##### 👁️ Previsualización de Datos Detectados (Primeras 5 filas):")
                st.dataframe(df_preview.head(5), use_container_width=True)
            else:
                xl = pd.ExcelFile(io.BytesIO(uploaded_file.getvalue()))
                st.info(f"📑 Hojas detectadas en el libro Excel: **{', '.join(xl.sheet_names)}**")
                first_sheet = xl.sheet_names[0]
                df_preview = xl.parse(first_sheet)
                st.markdown(f"##### 👁️ Previsualización de la hoja `{first_sheet}` (Primeras 5 filas):")
                st.dataframe(df_preview.head(5), use_container_width=True)
        except Exception as e_prev:
            st.caption(f"Nota: No se pudo generar la previsualización: {e_prev}")

        if st.button("🚀 Iniciar Procesamiento ETL", type="primary", use_container_width=True):
            progress_bar = st.progress(0, text="Iniciando conexión con API ETL...")
            
            try:
                progress_bar.progress(30, text="Subiendo y validando estructura de planilla...")
                
                if BACKEND_ONLINE:
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                    r = requests.post(f"{API_BASE_URL}/etl/upload", files=files, timeout=30)
                    progress_bar.progress(80, text="Aplicando transformaciones y reglas de negocio...")
                    
                    if r.status_code == 200:
                        resp_json = r.json()
                        progress_bar.progress(100, text="¡Procesamiento ETL exitoso!")
                        st.success(f"✅ {resp_json.get('message', 'Datos cargados exitosamente.')}")
                        st.metric("Registros Procesados", resp_json.get("records_processed", 0))
                    else:
                        progress_bar.empty()
                        st.error(f"❌ Error en la carga ({r.status_code}): {r.text}")
                else:
                    # Procesamiento local directo
                    from app.database.session import SessionLocal, init_db
                    from app.services.etl_service import ETLService
                    init_db()
                    db = SessionLocal()
                    try:
                        progress_bar.progress(80, text="Insertando de forma idempotente en SQLite Core...")
                        result = ETLService.ingest_spreadsheet(uploaded_file.getvalue(), uploaded_file.name, db)
                        progress_bar.progress(100, text="¡Procesamiento ETL exitoso!")
                        if result["status"] == "success":
                            st.success(f"✅ {result['message']}")
                            st.metric("Registros Procesados", result["records_processed"])
                        else:
                            st.error(f"❌ Error durante ETL: {result['message']}")
                    finally:
                        db.close()
            except Exception as ex:
                progress_bar.empty()
                st.error(f"❌ Error al procesar archivo: {str(ex)}")

    st.divider()

    # Descarga de Plantillas de Ejemplo
    st.subheader("📥 Descarga de Plantillas Oficiales de Carga")
    col_d1, col_d2, col_d3, col_d4 = st.columns(4)
    
    csv_prod_template = "sku,nombre,categoria,costo_unitario,precio_venta\nSKU-9901,Válvula Esférica Inox,Industrial,45.00,85.00\n"
    csv_inv_template = "sku,deposito_central,transito_maritimo,aduana,stock_seguridad,lead_time_dias,demanda_diaria_promedio\nSKU-9901,50,20,10,25,15,5.0\n"
    csv_sales_template = "transaction_id,product_sku,cantidad,precio_unitario,costo_unitario,comision_pct,flete_unitario,fecha\nTX-2026-001,SKU-9901,10,85.00,45.00,0.05,2.50,2026-03-15\n"
    csv_budget_template = "periodo,categoria,tipo,monto_presupuestado,monto_real\n2026-Q1,Industrial,VENTAS,150000.00,162000.00\n"

    with col_d1:
        st.download_button(
            "📄 Plantilla Productos (CSV)",
            data=csv_prod_template,
            file_name="plantilla_productos.csv",
            mime="text/csv",
            use_container_width=True,
            key="btn_download_prod_template"
        )
    with col_d2:
        st.download_button(
            "📄 Plantilla Inventario (CSV)",
            data=csv_inv_template,
            file_name="plantilla_inventario.csv",
            mime="text/csv",
            use_container_width=True,
            key="btn_download_inv_template"
        )
    with col_d3:
        st.download_button(
            "📄 Plantilla Ventas (CSV)",
            data=csv_sales_template,
            file_name="plantilla_ventas.csv",
            mime="text/csv",
            use_container_width=True,
            key="btn_download_sales_template"
        )
    with col_d4:
        st.download_button(
            "📄 Plantilla Presupuesto (CSV)",
            data=csv_budget_template,
            file_name="plantilla_presupuesto.csv",
            mime="text/csv",
            use_container_width=True,
            key="btn_download_budget_template"
        )

    with st.expander("ℹ️ Guía Detallada de Formatos y Columnas Obligatorias"):
        st.markdown("""
        - **Hojas de Productos**: Contiene las columnas `sku`, `nombre`, `categoria`, `costo_unitario`, `precio_venta`.
        - **Hojas de Inventario**: Contiene `product_sku` (o `sku`), `deposito_central`, `transito_maritimo`, `aduana`, `stock_seguridad`, `lead_time_dias`, `demanda_diaria_promedio`.
        - **Hojas de Ventas**: Contiene `transaction_id`, `product_sku`, `cantidad`, `precio_unitario`, `costo_unitario`, `comision_pct`, `flete_unitario`, `fecha`.
        - **Hojas de Presupuesto**: Contiene `periodo`, `categoria`, `tipo` (`VENTAS`/`COSTOS`), `monto_presupuestado`, `monto_real`.
        """)

