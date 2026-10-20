import pytest
from decimal import Decimal, ROUND_HALF_UP
from starlette.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.accounting_entities import JournalEntry, JournalLine, JournalItem, Expense
from app.models.entities import CentroCosto, PresupuestoCentroCosto
from app.services.accounting_service import AccountingService
from app.services.fpa_service import FpaService


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


def test_journal_item_alias_and_cost_center_fields():
    """Valida la presencia del campo cost_center_id y la interoperabilidad de JournalItem."""
    assert JournalItem is JournalLine
    assert hasattr(JournalEntry, "cost_center_id")
    assert hasattr(JournalLine, "cost_center_id")
    assert hasattr(CentroCosto, "alerta_85_activa")
    assert hasattr(CentroCosto, "alerta_100_activa")


def test_transactional_accounting_to_opex_sync(db_session):
    """
    Valida la sincronización transaccional ACID entre el registro de un gasto contable
    (Expense / JournalEntry / JournalLine) y la ejecución real en PresupuestoCentroCosto.
    Garantiza cálculo financiero exacto en Decimal (ROUND_HALF_UP).
    """
    # 1. Obtener un centro de costo activo
    cc = db_session.query(CentroCosto).filter(CentroCosto.activo == True).first()
    assert cc is not None, "Debe existir al menos un centro de costo activo"

    test_period = "2025-09"
    test_neto = Decimal("12450.5000")

    # 2. Registrar gasto contable vinculado al centro de costo
    expense_data = {
        "fecha": "2025-09-15",
        "proveedor_beneficiario": "Test Auditoría y Servicios S.A.",
        "rut_proveedor": "219999990019",
        "concepto": "Servicio de Consultoría y Auditoría Técnica",
        "categoria_gasto": "CLOUD_TI",
        "centro_costo_id": cc.id,
        "subtotal_neto": float(test_neto),
        "tasa_iva_pct": 22.0,
        "moneda": "UYU",
        "numero_comprobante": "CFE-EXP-TEST-9988",
        "forma_pago": "TRANSFERENCIA",
        "estado": "PAGADO"
    }

    created_expense = AccountingService.create_expense(db_session, expense_data)
    assert created_expense.id is not None
    assert created_expense.centro_costo_id == cc.id

    # 3. Verificar que el asiento en Libro Diario tenga el cost_center_id
    journal_entry = db_session.query(JournalEntry).filter(
        JournalEntry.referencia_doc == "CFE-EXP-TEST-9988"
    ).first()
    assert journal_entry is not None
    assert journal_entry.cost_center_id == cc.id
    assert journal_entry.balanceado is True

    # Verificar que la línea del debe también tenga cost_center_id
    debit_line = db_session.query(JournalLine).filter(
        JournalLine.entry_id == journal_entry.id,
        JournalLine.debe > Decimal("0.00")
    ).first()
    assert debit_line is not None
    assert debit_line.cost_center_id == cc.id

    # 4. Verificar sincronización automática en PresupuestoCentroCosto (ACID)
    presupuesto = db_session.query(PresupuestoCentroCosto).filter(
        PresupuestoCentroCosto.periodo == test_period,
        PresupuestoCentroCosto.centro_costo_id == cc.id
    ).first()
    assert presupuesto is not None
    assert Decimal(str(presupuesto.monto_real)) >= test_neto


def test_fpa_summary_endpoint_and_decimal_reconciliation(client):
    """
    Verifica el endpoint GET /api/v1/finance/fpa/summary?period=2025-09
    y audita la conciliación matemática sin desvío (cero diff en Decimal).
    """
    response = client.get("/api/v1/finance/fpa/summary?period=2025-09")
    assert response.status_code == 200
    data = response.json()

    assert data["periodo"] == "2025-09"
    assert "presupuesto_total" in data
    assert "real_ejecutado_total" in data
    assert "desvio_neto" in data
    assert "desvio_porcentual" in data
    assert "semaforo" in data
    assert data["semaforo"] in ["VERDE", "AMARILLO", "ROJO"]
    assert "runway_meses" in data
    assert data["runway_meses"] > 0
    assert "centros_costo" in data
    assert len(data["centros_costo"]) >= 6

    # Conciliación financiera exacta
    presupuesto = Decimal(str(data["presupuesto_total"])).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    real = Decimal(str(data["real_ejecutado_total"])).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    desvio = Decimal(str(data["desvio_neto"])).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    # Regla: Real - Presupuesto = Desvío Neto exacto
    assert (real - presupuesto) == desvio, f"Falla de conciliación: {real} - {presupuesto} != {desvio}"

    # Validar proyecciones de caja y CCC
    assert "proyecciones" in data
    proy = data["proyecciones"]
    assert "dias_30" in proy
    assert "dias_60" in proy
    assert "dias_90" in proy
    assert "ccc_dias" in proy
    assert proy["ccc_dias"] > 0


def test_fpa_budget_line_creation_and_update(client, db_session):
    """Valida la creación y actualización de partidas presupuestarias OPEX."""
    cc = db_session.query(CentroCosto).filter(CentroCosto.activo == True).first()
    assert cc is not None

    payload = {
        "centro_costo_id": cc.id,
        "periodo": "2025-09",
        "concepto_opex": "Partida Experimental de Test QA",
        "monto_presupuestado": 35000.0,
        "monto_real": 34800.0
    }

    res = client.post("/api/v1/finance/fpa/budget-line", json=payload)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["monto_presupuestado"] == 35000.0
    assert res_data["concepto_opex"] == "Partida Experimental de Test QA"


def test_fpa_governance_update(client, db_session):
    """Valida la actualización de gobernanza, responsables y alertas tempranas."""
    cc = db_session.query(CentroCosto).filter(CentroCosto.activo == True).first()
    assert cc is not None

    payload = {
        "centro_costo_id": cc.id,
        "responsable": "Dra. Sofía Rivas (Controller Certificado)",
        "email_notificacion": "srivas@calcu.com.uy",
        "alerta_85_activa": True,
        "alerta_100_activa": True
    }

    res = client.post("/api/v1/finance/fpa/responsables", json=payload)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["responsable"] == "Dra. Sofía Rivas (Controller Certificado)"
    assert res_data["email_notificacion"] == "srivas@calcu.com.uy"


def test_fpa_copilot_audit(client):
    """Valida el asistente conversacional / copiloto financiero con detección de anomalías."""
    payload = {
        "prompt": "Auditar anomalías en el Libro Diario y sugerir recortes de OPEX",
        "periodo": "2025-09"
    }

    res = client.post("/api/v1/finance/fpa/copilot", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "analysis" in data
    assert len(data["analysis"]) > 50
    assert "anomalies" in data
    assert "suggested_cuts" in data
    assert "runway_proyectado_con_ahorros" in data
