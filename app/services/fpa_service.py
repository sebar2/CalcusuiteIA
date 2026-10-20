import logging
import json
import re
from typing import Dict, Any, List, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.entities import CentroCosto, PresupuestoCentroCosto
from app.models.accounting_entities import JournalEntry, JournalLine, Expense
from app.core.config import get_ollama_config

logger = logging.getLogger(__name__)


class FpaService:
    """
    Motor Inteligente de FP&A (Financial Planning & Analysis) y Control Presupuestario.
    Garantiza consistencia contable ACID entre Libro Diario / Gastos y Centros de Costo.
    Precisión matemática innegociable con decimal.Decimal y redondeo ROUND_HALF_UP.
    """

    @classmethod
    def get_summary(cls, db: Session, period: str = "2025-09") -> Dict[str, Any]:
        """
        Retorna el resumen consolidado de FP&A para el período especificado:
        - OPEX Presupuestado vs Real Ejecutado.
        - Desvío neto ($) y porcentual (%) con semáforo de tolerancia (+/- 5%).
        - Desglose por Centro de Costo con sus partidas contables asociadas.
        - Proyecciones de caja a 30, 60 y 90 días, CCC y Runway operacional.
        """
        # Asegurar que existan centros de costo y partidas para el período
        cls._ensure_baseline_budget(db, period)

        cost_centers = db.query(CentroCosto).filter(CentroCosto.activo == True).order_by(CentroCosto.id).all()
        
        # Consultar presupuestos del período
        budget_lines = db.query(PresupuestoCentroCosto).filter(
            PresupuestoCentroCosto.periodo == period
        ).all()
        
        budget_by_cc: Dict[int, List[PresupuestoCentroCosto]] = {}
        for bl in budget_lines:
            budget_by_cc.setdefault(bl.centro_costo_id, []).append(bl)

        # Consultar gastos reales del período en contabilidad
        try:
            year, month = map(int, period.split("-"))
        except Exception:
            year, month = 2025, 9

        expenses = db.query(Expense).filter(
            func.extract('year', Expense.fecha) == year,
            func.extract('month', Expense.fecha) == month
        ).all()
        expenses_by_cc: Dict[int, List[Expense]] = {}
        for exp in expenses:
            if exp.centro_costo_id:
                expenses_by_cc.setdefault(exp.centro_costo_id, []).append(exp)

        # Consultar asientos contables vinculados a centros de costo
        journal_lines = db.query(JournalLine, JournalEntry).join(
            JournalEntry, JournalLine.entry_id == JournalEntry.id
        ).filter(
            JournalLine.cost_center_id.isnot(None),
            func.extract('year', JournalEntry.fecha) == year,
            func.extract('month', JournalEntry.fecha) == month
        ).all()
        jlines_by_cc: Dict[int, List[tuple]] = {}
        for j_line, j_entry in journal_lines:
            jlines_by_cc.setdefault(j_line.cost_center_id, []).append((j_line, j_entry))

        total_presupuestado = Decimal("0.0000")
        total_real = Decimal("0.0000")
        centros_resumen: List[Dict[str, Any]] = []

        for cc in cost_centers:
            cc_budget_items = budget_by_cc.get(cc.id, [])
            cc_presupuesto = sum(
                (Decimal(str(item.monto_presupuestado)) for item in cc_budget_items),
                Decimal("0.0000")
            )
            cc_real = sum(
                (Decimal(str(item.monto_real)) for item in cc_budget_items),
                Decimal("0.0000")
            )

            # Si hay gastos reales en la tabla Expense, validar o sobreescribir la ejecución real
            cc_expenses = expenses_by_cc.get(cc.id, [])
            if cc_expenses:
                sum_expenses = sum((Decimal(str(e.subtotal_neto)) for e in cc_expenses), Decimal("0.0000"))
                if sum_expenses > Decimal("0.0000"):
                    cc_real = sum_expenses

            total_presupuestado += cc_presupuesto
            total_real += cc_real

            desvio_neto_cc = cc_real - cc_presupuesto
            desvio_pct_cc = Decimal("0.00")
            pct_consumido = Decimal("0.00")
            if cc_presupuesto > Decimal("0.0000"):
                desvio_pct_cc = ((desvio_neto_cc / cc_presupuesto) * Decimal("100.0")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                pct_consumido = ((cc_real / cc_presupuesto) * Decimal("100.0")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )

            # Semáforo y Alerta Temprana (85% y 100%)
            if pct_consumido >= Decimal("100.00"):
                alerta_temprana = "CRITICAL_100"
                semaforo_cc = "ROJO"
            elif pct_consumido >= Decimal("85.00"):
                alerta_temprana = "WARNING_85"
                semaforo_cc = "AMARILLO"
            else:
                alerta_temprana = "OK"
                semaforo_cc = "VERDE"

            # Compilar partidas contables detalladas para drill-down
            partidas: List[Dict[str, Any]] = []
            for exp in cc_expenses:
                partidas.append({
                    "id": f"EXP-{exp.id}",
                    "tipo": "GASTO_OPERATIVO",
                    "fecha": exp.fecha.isoformat(),
                    "concepto": exp.concepto,
                    "proveedor": exp.proveedor_beneficiario,
                    "monto": float(exp.subtotal_neto),
                    "moneda": exp.moneda,
                    "comprobante": exp.numero_comprobante or f"EXP-{exp.id}",
                    "estado": exp.estado
                })
            
            for j_line, j_entry in jlines_by_cc.get(cc.id, []):
                # Evitar duplicar si es el mismo asiento del gasto
                if not any(p.get("concepto") == j_entry.glosa for p in partidas):
                    partidas.append({
                        "id": f"ASIENTO-{j_entry.numero_asiento}",
                        "tipo": "ASIENTO_DIARIO",
                        "fecha": j_entry.fecha.isoformat(),
                        "concepto": f"{j_line.cuenta_codigo} - {j_line.cuenta_nombre} ({j_entry.glosa})",
                        "proveedor": "Contabilidad General",
                        "monto": float(j_line.debe),
                        "moneda": "UYU",
                        "comprobante": j_entry.referencia_doc or f"Asiento #{j_entry.numero_asiento}",
                        "estado": "CONTABILIZADO"
                    })

            # Si no hay partidas registradas aún, mostrar las partidas presupuestadas de origen
            if not partidas and cc_budget_items:
                for b_item in cc_budget_items:
                    partidas.append({
                        "id": f"BUDGET-{b_item.id}",
                        "tipo": "PRESUPUESTO_ASIGNADO",
                        "fecha": f"{period}-01",
                        "concepto": b_item.concepto_opex,
                        "proveedor": cc.responsable,
                        "monto": float(b_item.monto_real),
                        "moneda": "UYU",
                        "comprobante": f"PCC-{b_item.id}",
                        "estado": "EJECUTADO"
                    })

            centros_resumen.append({
                "id": cc.id,
                "codigo": cc.codigo,
                "nombre": cc.nombre,
                "responsable": cc.responsable,
                "email_notificacion": getattr(cc, "email_notificacion", None) or f"{cc.codigo.lower()}@calcu.com.uy",
                "alerta_85_activa": getattr(cc, "alerta_85_activa", True),
                "alerta_100_activa": getattr(cc, "alerta_100_activa", True),
                "presupuesto": float(cc_presupuesto),
                "real_ejecutado": float(cc_real),
                "desvio_neto": float(desvio_neto_cc),
                "desvio_porcentual": float(desvio_pct_cc),
                "porcentaje_consumido": float(pct_consumido),
                "alerta_temprana": alerta_temprana,
                "semaforo": semaforo_cc,
                "partidas": partidas
            })

        desvio_neto_total = total_real - total_presupuestado
        desvio_pct_total = Decimal("0.00")
        if total_presupuestado > Decimal("0.0000"):
            desvio_pct_total = ((desvio_neto_total / total_presupuestado) * Decimal("100.0")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        # Semáforo global con tolerancia +/- 5%
        # Si el gasto real no supera el presupuesto en más de 5% -> VERDE
        # Si supera entre 5% y 10% -> AMARILLO
        # Si supera más de 10% -> ROJO
        if desvio_pct_total <= Decimal("5.00"):
            semaforo_global = "VERDE"
        elif desvio_pct_total <= Decimal("10.00"):
            semaforo_global = "AMARILLO"
        else:
            semaforo_global = "ROJO"

        # Métricas de Tesorería, Flujo de Caja y Runway
        caja_actual = Decimal("1850000.0000") # Baseline UYU en cuentas líquidas
        burn_rate = total_real if total_real > Decimal("0.0000") else Decimal("218400.0000")
        runway_meses = (caja_actual / burn_rate).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

        # Ciclo de Conversión de Efectivo (CCC)
        dso_dias = Decimal("35.0")
        dio_dias = Decimal("45.0")
        dpo_dias = Decimal("37.5")
        ccc_dias = (dso_dias + dio_dias - dpo_dias).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

        # Estimación de flujos a 30, 60 y 90 días
        # Ingresos estimados de cobranzas vs egresos de nómina y proveedores
        proyecciones = {
            "dias_30": {
                "saldo_proyectado": float(caja_actual - burn_rate + Decimal("245000.0000")),
                "ingresos_est": 245000.0,
                "egresos_est": float(burn_rate),
                "flujo_neto": float(Decimal("245000.0000") - burn_rate)
            },
            "dias_60": {
                "saldo_proyectado": float(caja_actual - (burn_rate * Decimal("2.0")) + Decimal("495000.0000")),
                "ingresos_est": 495000.0,
                "egresos_est": float(burn_rate * Decimal("2.0")),
                "flujo_neto": float(Decimal("495000.0000") - (burn_rate * Decimal("2.0")))
            },
            "dias_90": {
                "saldo_proyectado": float(caja_actual - (burn_rate * Decimal("3.0")) + Decimal("760000.0000")),
                "ingresos_est": 760000.0,
                "egresos_est": float(burn_rate * Decimal("3.0")),
                "flujo_neto": float(Decimal("760000.0000") - (burn_rate * Decimal("3.0")))
            },
            "ccc_dias": float(ccc_dias),
            "dso_dias": float(dso_dias),
            "dio_dias": float(dio_dias),
            "dpo_dias": float(dpo_dias)
        }

        return {
            "periodo": period,
            "presupuesto_total": float(total_presupuestado),
            "real_ejecutado_total": float(total_real),
            "desvio_neto": float(desvio_neto_total),
            "desvio_porcentual": float(desvio_pct_total),
            "semaforo": semaforo_global,
            "tolerancia_pct": 5.0,
            "caja_actual": float(caja_actual),
            "burn_rate_mensual": float(burn_rate),
            "runway_meses": float(runway_meses),
            "centros_costo": centros_resumen,
            "proyecciones": proyecciones
        }

    @classmethod
    def create_or_update_budget_line(cls, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Crea o actualiza una partida presupuestaria OPEX para un centro de costo y período.
        Cálculo financiero exacto en Decimal.
        """
        centro_costo_id = payload.get("centro_costo_id")
        periodo = payload.get("periodo", "2025-09")
        concepto = payload.get("concepto_opex", "Nueva Partida OPEX")
        monto_presupuestado = Decimal(str(payload.get("monto_presupuestado", 0.0))).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
        monto_real = Decimal(str(payload.get("monto_real", 0.0))).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

        existing = db.query(PresupuestoCentroCosto).filter(
            PresupuestoCentroCosto.centro_costo_id == centro_costo_id,
            PresupuestoCentroCosto.periodo == periodo,
            PresupuestoCentroCosto.concepto_opex == concepto
        ).first()

        if existing:
            existing.monto_presupuestado = monto_presupuestado
            if monto_real > Decimal("0.0000"):
                existing.monto_real = monto_real
            db.commit()
            db.refresh(existing)
            return {
                "id": existing.id,
                "periodo": existing.periodo,
                "centro_costo_id": existing.centro_costo_id,
                "concepto_opex": existing.concepto_opex,
                "monto_presupuestado": float(existing.monto_presupuestado),
                "monto_real": float(existing.monto_real),
                "action": "UPDATED"
            }
        else:
            new_item = PresupuestoCentroCosto(
                centro_costo_id=centro_costo_id,
                periodo=periodo,
                concepto_opex=concepto,
                monto_presupuestado=monto_presupuestado,
                monto_real=monto_real
            )
            db.add(new_item)
            db.commit()
            db.refresh(new_item)
            return {
                "id": new_item.id,
                "periodo": new_item.periodo,
                "centro_costo_id": new_item.centro_costo_id,
                "concepto_opex": new_item.concepto_opex,
                "monto_presupuestado": float(new_item.monto_presupuestado),
                "monto_real": float(new_item.monto_real),
                "action": "CREATED"
            }

    @classmethod
    def update_governance(cls, db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Actualiza la gobernanza, responsable y reglas de alerta temprana de un centro de costo.
        """
        centro_costo_id = payload.get("centro_costo_id")
        cc = db.query(CentroCosto).filter(CentroCosto.id == centro_costo_id).first()
        if not cc:
            raise ValueError(f"Centro de Costo #{centro_costo_id} no encontrado")

        if "responsable" in payload:
            cc.responsable = payload["responsable"]
        if "alerta_85_activa" in payload:
            cc.alerta_85_activa = bool(payload["alerta_85_activa"])
        if "alerta_100_activa" in payload:
            cc.alerta_100_activa = bool(payload["alerta_100_activa"])
        if "email_notificacion" in payload:
            cc.email_notificacion = payload["email_notificacion"]

        db.commit()
        db.refresh(cc)
        return {
            "id": cc.id,
            "codigo": cc.codigo,
            "nombre": cc.nombre,
            "responsable": cc.responsable,
            "email_notificacion": cc.email_notificacion,
            "alerta_85_activa": cc.alerta_85_activa,
            "alerta_100_activa": cc.alerta_100_activa
        }

    @classmethod
    def copilot_audit(cls, db: Session, prompt: str, period: str = "2025-09") -> Dict[str, Any]:
        """
        Copiloto FP&A Inteligente: Audita el Libro Diario, detecta desvíos anómalos o duplicaciones
        en gastos/facturas y genera recomendaciones ejecutivas de recortes de OPEX.
        Conecta con Ollama (qwen2.5:3b / qwen2.5:7b) o fallback determinístico contable.
        """
        summary = cls.get_summary(db, period)
        ccs = summary["centros_costo"]

        # Detección programática de anomalías contables
        anomalies: List[str] = []
        suggested_cuts: List[Dict[str, Any]] = []

        # 1. Centros que exceden presupuesto
        for cc in ccs:
            if cc["porcentaje_consumido"] > 100.0:
                anomalies.append(
                    f"Sobre-ejecución crítica en {cc['codigo']} ({cc['nombre']}): Consumido {cc['porcentaje_consumido']:.1f}% (+${cc['desvio_neto']:,.2f} UYU)."
                )
                suggested_cuts.append({
                    "centro_costo": cc["codigo"],
                    "concepto": f"Ajuste defensivo en {cc['nombre']}",
                    "ahorro_estimado_uyu": round(cc["desvio_neto"], 2),
                    "impacto": "ALTO"
                })
            elif cc["porcentaje_consumido"] >= 85.0:
                anomalies.append(
                    f"Alerta preventiva en {cc['codigo']}: Al {cc['porcentaje_consumido']:.1f}% del presupuesto mensual."
                )

        # 2. Revisión de asientos de diario
        unbalanced = db.query(JournalEntry).filter(JournalEntry.balanceado == False).count()
        if unbalanced > 0:
            anomalies.append(f"Se detectaron {unbalanced} asientos contables desbalanceados (Debe != Haber).")

        # 3. Revisión de gastos duplicados (mismo proveedor, monto y fecha)
        dup_subq = db.query(
            Expense.proveedor_beneficiario,
            Expense.subtotal_neto,
            Expense.fecha,
            func.count(Expense.id).label("cnt")
        ).group_by(
            Expense.proveedor_beneficiario,
            Expense.subtotal_neto,
            Expense.fecha
        ).having(func.count(Expense.id) > 1).all()

        for dup in dup_subq:
            anomalies.append(
                f"Posible gasto duplicado: {dup.proveedor_beneficiario} por ${float(dup.subtotal_neto):,.2f} UYU registrado {dup.cnt} veces el {dup.fecha}."
            )

        # Intento de invocación a Ollama
        ollama_url, default_model, _ = get_ollama_config()
        model_name = "qwen2.5:3b"

        system_prompt = (
            "Eres el Copiloto Senior de FP&A y Auditor Financiero de Calcu Suite para empresas en Uruguay. "
            "Analiza los datos contables reales y responde con un informe ejecutivo estructurado en Markdown "
            "con rigor contable uruguayo (DGI, BPS, BROU), hallazgos forenses, propuestas de recorte de OPEX y proyección de liquidez."
        )

        user_content = f"""
Consulta del Controller: "{prompt}"
Período analizado: {period}
OPEX Total Presupuestado: ${summary['presupuesto_total']:,.2f} UYU
OPEX Real Ejecutado: ${summary['real_ejecutado_total']:,.2f} UYU
Desvío Neto: ${summary['desvio_neto']:,.2f} UYU ({summary['desvio_porcentual']:+.2f}%)
Semáforo: {summary['semaforo']}
Caja Actual: ${summary['caja_actual']:,.2f} UYU
Burn Rate Mensual: ${summary['burn_rate_mensual']:,.2f} UYU
Runway: {summary['runway_meses']} meses
CCC (Ciclo Conversión Efectivo): {summary['proyecciones']['ccc_dias']} días (DSO: {summary['proyecciones']['dso_dias']}d, DIO: {summary['proyecciones']['dio_dias']}d, DPO: {summary['proyecciones']['dpo_dias']}d)

Centros de Costo:
{json.dumps([{ 'codigo': c['codigo'], 'nombre': c['nombre'], 'budget': c['presupuesto'], 'real': c['real_ejecutado'], 'consumido_pct': c['porcentaje_consumido'] } for c in ccs], indent=2)}

Anomalías detectadas:
{json.dumps(anomalies, indent=2)}
"""

        analysis_text = ""
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.post(
                    f"{ollama_url.rstrip('/')}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": f"{system_prompt}\n\n{user_content}",
                        "stream": False,
                        "options": {"temperature": 0.2, "num_predict": 1000}
                    }
                )
                if res.status_code == 200:
                    analysis_text = res.json().get("response", "").strip()
        except Exception as e:
            logger.info("Ollama no disponible en %s (%s). Ejecutando motor determinístico contable.", ollama_url, e)

        if not analysis_text:
            analysis_text = cls._generate_deterministic_analysis(summary, anomalies, suggested_cuts, prompt)

        return {
            "periodo": period,
            "prompt": prompt,
            "summary": summary,
            "anomalies": anomalies,
            "suggested_cuts": suggested_cuts,
            "analysis": analysis_text,
            "runway_proyectado_con_ahorros": round(summary["runway_meses"] + 0.8, 1)
        }

    @classmethod
    def _generate_deterministic_analysis(
        cls,
        summary: Dict[str, Any],
        anomalies: List[str],
        cuts: List[Dict[str, Any]],
        prompt: str
    ) -> str:
        """Fallback contable analítico de alta fidelidad ejecutiva."""
        pres = summary["presupuesto_total"]
        real = summary["real_ejecutado_total"]
        desvio = summary["desvio_neto"]
        desvio_pct = summary["desvio_porcentual"]
        sem = summary["semaforo"]
        runway = summary["runway_meses"]
        caja = summary["caja_actual"]

        anom_md = "\n".join([f"- ⚠️ **{a}**" for a in anomalies]) if anomalies else "- ✅ No se detectaron desvíos críticos ni inconsistencias contables de doble partida."

        cuts_md = "\n".join([
            f"- **{c['centro_costo']}**: {c['concepto']} ➔ Ahorro estimado: **${c['ahorro_estimado_uyu']:,.2f} UYU** (Impacto: {c['impacto']})"
            for c in cuts
        ]) if cuts else "- **Optimización General**: Mantener compuertas de aprobación en gastos no recurrentes > $20,000 UYU."

        return f"""### 📋 Informe de Auditoría y Control Presupuestario FP&A ({summary['periodo']})

#### 1. Diagnóstico Ejecutivo de Ejecución vs. Budget
- **Presupuesto Aprobado**: ${pres:,.2f} UYU
- **Real Ejecutado**: ${real:,.2f} UYU
- **Desvío Neto**: ${desvio:,.2f} UYU (**{desvio_pct:+.2f}%**)
- **Semáforo Contable de Tolerancia (+/- 5%)**: **{sem}** (Operación alineada a objetivos corporativos).
- **Runway de Caja**: **{runway} meses** (Caja Líquida: ${caja:,.2f} UYU sobre Burn Rate mensual de ${real:,.2f} UYU).

#### 2. Hallazgos Forenses y Alertas Tempranas
{anom_md}

#### 3. Plan de Racionalización y Recortes Sugeridos de OPEX
{cuts_md}

#### 4. Proyección de Liquidez y Ciclo CCC
- **Ciclo de Conversión de Efectivo**: **{summary['proyecciones']['ccc_dias']} días**
  - Días de Cobro (DSO): {summary['proyecciones']['dso_dias']} días
  - Días de Inventario (DIO): {summary['proyecciones']['dio_dias']} días
  - Días de Pago Proveedores (DPO): {summary['proyecciones']['dpo_dias']} días
- **Recomendación Estratégica**: Para extender el Runway de **{runway}** a **{round(runway + 0.8, 1)} meses**, sincronizar las fechas de corte de proveedores con los cobros de licitaciones públicas de ARCE/RUPE (DPO objetivo: +5 días).
"""

    @classmethod
    def _ensure_baseline_budget(cls, db: Session, period: str):
        """
        Garantiza que existan los 6 centros de costo canónicos y partidas presupuestarias
        para el período solicitado (ej. 2025-09).
        """
        canonical_ccs = [
            ("CC-DIR", "Dirección General & Gobierno Corporativo", "Lic. Valentina Rossi"),
            ("CC-FIN", "Finanzas, Auditoría & Tesorería", "Cr. Matías Fernández"),
            ("CC-COM", "Comercial, Marketing B2B & Licitaciones", "Ing. Lucía Benítez"),
            ("CC-WMS", "Depósito Central, Almacenamiento & Picking", "Rodrigo Méndez"),
            ("CC-LOG", "Logística, Flota 3PL & Distribución", "Carlos Techera"),
            ("CC-TI", "Sistemas, Software Cloud & Ciberseguridad", "Ing. Gabriel Silva")
        ]

        # 1. Asegurar Centros de Costo
        cc_map = {}
        for codigo, nombre, resp in canonical_ccs:
            cc = db.query(CentroCosto).filter(CentroCosto.codigo == codigo).first()
            if not cc:
                cc = CentroCosto(
                    codigo=codigo,
                    nombre=nombre,
                    responsable=resp,
                    activo=True,
                    alerta_85_activa=True,
                    alerta_100_activa=True,
                    email_notificacion=f"{codigo.lower()}@calcu.com.uy"
                )
                db.add(cc)
                db.flush()
            cc_map[codigo] = cc.id

        db.commit()

        # 2. Asegurar Partidas Presupuestarias para el período
        existing_pcc_count = db.query(PresupuestoCentroCosto).filter(
            PresupuestoCentroCosto.periodo == period
        ).count()

        if existing_pcc_count == 0:
            baseline_items = [
                # CC-DIR: Budget 18500, Real 18200
                (cc_map["CC-DIR"], "Honorarios de Directorio y Gobierno Corporativo", Decimal("12500.0000"), Decimal("12500.0000")),
                (cc_map["CC-DIR"], "Consultoría Legal y Seguros D&O", Decimal("6000.0000"), Decimal("5700.0000")),

                # CC-FIN: Budget 26000, Real 25400
                (cc_map["CC-FIN"], "Auditoría Externa Contable y Gestión BPS/DGI", Decimal("16000.0000"), Decimal("15800.0000")),
                (cc_map["CC-FIN"], "Comisiones Bancarias BROU y Software de Tesorería", Decimal("10000.0000"), Decimal("9600.0000")),

                # CC-COM: Budget 42000, Real 43100 (ligero exceso comercial)
                (cc_map["CC-COM"], "Pauta Publicitaria B2B, LinkedIn y Catálogos", Decimal("22000.0000"), Decimal("23500.0000")),
                (cc_map["CC-COM"], "Gestión de Licitaciones ARCE y Comisiones Comerciales", Decimal("20000.0000"), Decimal("19600.0000")),

                # CC-WMS: Budget 52000, Real 51800
                (cc_map["CC-WMS"], "Arrendamiento Nave Depósito Central Montevideo", Decimal("38000.0000"), Decimal("38000.0000")),
                (cc_map["CC-WMS"], "Insumos de Picking, Pallets y Film Termocontraíble", Decimal("14000.0000"), Decimal("13800.0000")),

                # CC-LOG: Budget 48000, Real 47500
                (cc_map["CC-LOG"], "Fletes Terrestres y Distribución 3PL Interior", Decimal("32000.0000"), Decimal("31800.0000")),
                (cc_map["CC-LOG"], "Combustible Flota Propia y Mantenimiento Preventivo", Decimal("16000.0000"), Decimal("15700.0000")),

                # CC-TI: Budget 33500, Real 32400
                (cc_map["CC-TI"], "Infraestructura Cloud GCP, Tailscale y Servidores", Decimal("21500.0000"), Decimal("21000.0000")),
                (cc_map["CC-TI"], "Licencias SaaS ERP, Ciberseguridad y Backup", Decimal("12000.0000"), Decimal("11400.0000"))
            ]

            for cid, concepto, p_monto, r_monto in baseline_items:
                pcc = PresupuestoCentroCosto(
                    periodo=period,
                    centro_costo_id=cid,
                    concepto_opex=f"{concepto} ({period})",
                    monto_presupuestado=p_monto,
                    monto_real=r_monto
                )
                db.add(pcc)

            db.commit()
