import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.entities import Client, CommercialDeal
from app.models.accounting_entities import Invoice, CollectionCase, collection_case_invoices


@pytest.fixture
def memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_commercial_deal_client_relationship_3nf(memory_db):
    """Verifica que CommercialDeal se relaciona correctamente con Client mediante clave foránea (3NF)."""
    client = Client(
        nombre="Ferretería Central S.A.",
        razon_social="Ferretería Central S.A.",
        rut="214567890014",
        tipo_documento="RUT",
        es_consumidor_final=False,
        limite_credito=Decimal("15000.00")
    )
    memory_db.add(client)
    memory_db.commit()

    deal = CommercialDeal(
        id="DEAL-2026-TEST",
        proyecto_nombre="Suministro Eléctrico Obras 2026",
        cliente="Ferretería Central S.A.",
        rut="214567890014",
        monto_total=Decimal("50000.00"),
        etapa="negociacion",
        vendedor="Martín Gómez",
        client_id=client.id
    )
    memory_db.add(deal)
    memory_db.commit()

    # Verificar navegación relacional
    fetched_deal = memory_db.query(CommercialDeal).filter_by(id="DEAL-2026-TEST").first()
    assert fetched_deal is not None
    assert fetched_deal.client_rel is not None
    assert fetched_deal.client_rel.rut == "214567890014"
    assert fetched_deal.client_rel.limite_credito == Decimal("15000.00")


def test_collection_case_invoices_normalization_1nf_and_3nf(memory_db):
    """Verifica la normalización de CollectionCase en 1NF (tabla asociativa M2M) y 3NF (FK Client)."""
    client = Client(
        nombre="Distribuidora del Plata",
        rut="219876540019",
        tipo_documento="RUT",
        es_consumidor_final=False,
        limite_credito=Decimal("20000.00")
    )
    memory_db.add(client)
    memory_db.commit()

    inv1 = Invoice(
        numero_factura="A-000101",
        tipo_cfe="111_E_FACTURA",
        cliente_nombre=client.nombre,
        cliente_rut=client.rut,
        fecha_emision=date(2026, 1, 10),
        fecha_vencimiento=date(2026, 2, 10),
        moneda="UYU",
        subtotal=Decimal("10000.00"),
        monto_iva_basico=Decimal("2200.00"),
        total=Decimal("12200.00"),
        estado="EMITIDA"
    )
    inv2 = Invoice(
        numero_factura="A-000102",
        tipo_cfe="111_E_FACTURA",
        cliente_nombre=client.nombre,
        cliente_rut=client.rut,
        fecha_emision=date(2026, 1, 15),
        fecha_vencimiento=date(2026, 2, 15),
        moneda="UYU",
        subtotal=Decimal("8000.00"),
        monto_iva_basico=Decimal("1760.00"),
        total=Decimal("9760.00"),
        estado="EMITIDA"
    )
    memory_db.add_all([inv1, inv2])
    memory_db.commit()

    case = CollectionCase(
        cliente_id=client.id,
        cliente_nombre=client.nombre,
        cliente_rut=client.rut,
        etapa="2_CONTACTADO",
        dias_max_vencido=35,
        monto_total_deuda=Decimal("21960.00"),
        facturas_ids=["A-000101", "A-000102"],
        invoices_rel=[inv1, inv2],
        ultimo_contacto=datetime.now(timezone.utc)
    )
    memory_db.add(case)
    memory_db.commit()

    # Verificar que case accede al cliente vía FK (3NF)
    fetched_case = memory_db.query(CollectionCase).filter_by(cliente_rut=client.rut).first()
    assert fetched_case is not None
    assert fetched_case.cliente_rel is not None
    assert fetched_case.cliente_rel.id == client.id

    # Verificar que case tiene 2 facturas en la tabla normalizada M2M (1NF)
    assert len(fetched_case.invoices_rel) == 2
    inv_nums = {inv.numero_factura for inv in fetched_case.invoices_rel}
    assert inv_nums == {"A-000101", "A-000102"}

    # Verificar tabla física asociativa collection_case_invoices
    assoc_rows = memory_db.execute(collection_case_invoices.select()).fetchall()
    assert len(assoc_rows) == 2
