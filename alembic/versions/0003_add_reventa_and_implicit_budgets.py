"""0003_add_reventa_and_implicit_budgets

Revision ID: 0003_reventa_implicit
Revises: 0002_multilocation_dual_sku
Create Date: 2026-10-09 12:30:00.000000

Agrega soporte para:
- Lotes de Proveedores Uy / Reventa con estado_aprobacion y costo_compra en stock_location_batches
- Órdenes de compra locales con tipo_orden, fecha_disponible y monto_total
- Catálogo de servicios implícitos (implicit_service_catalog) y presupuestos (implicit_budget_orders, implicit_budget_items)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '0003_reventa_implicit'
down_revision: Union[str, Sequence[str], None] = '0002_multilocation_dual_sku'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = set(inspector.get_table_names())

    # 1. Columnas en stock_location_batches
    if 'stock_location_batches' in existing_tables:
        cols = {c['name'] for c in inspector.get_columns('stock_location_batches')}
        with op.batch_alter_table('stock_location_batches', schema=None) as batch_op:
            if 'estado_aprobacion' not in cols:
                batch_op.add_column(sa.Column('estado_aprobacion', sa.String(30), server_default='APROBADO', nullable=False))
            if 'costo_compra' not in cols:
                batch_op.add_column(sa.Column('costo_compra', sa.Numeric(14, 4), nullable=True))

    # 2. Columnas en ordenes_compra
    if 'ordenes_compra' in existing_tables:
        cols = {c['name'] for c in inspector.get_columns('ordenes_compra')}
        with op.batch_alter_table('ordenes_compra', schema=None) as batch_op:
            if 'tipo_orden' not in cols:
                batch_op.add_column(sa.Column('tipo_orden', sa.String(30), server_default='IMPORTACION', nullable=False))
            if 'fecha_disponible' not in cols:
                batch_op.add_column(sa.Column('fecha_disponible', sa.Date(), nullable=True))
            if 'monto_total' not in cols:
                batch_op.add_column(sa.Column('monto_total', sa.Numeric(14, 4), server_default='0.00', nullable=False))

    # 3. Tabla implicit_service_catalog
    if 'implicit_service_catalog' not in existing_tables:
        op.create_table(
            'implicit_service_catalog',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('rubro', sa.String(50), nullable=False),
            sa.Column('codigo', sa.String(50), unique=True, nullable=False),
            sa.Column('nombre_servicio', sa.String(150), nullable=False),
            sa.Column('proveedor_id', sa.Integer(), sa.ForeignKey('suppliers.id'), nullable=True),
            sa.Column('costo_unitario_base', sa.Numeric(14, 4), server_default='0.00', nullable=False),
            sa.Column('moneda', sa.String(10), server_default='USD', nullable=False),
            sa.Column('descripcion', sa.Text(), nullable=True),
            sa.Column('activo', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )

    # 4. Tabla implicit_budget_orders
    if 'implicit_budget_orders' not in existing_tables:
        op.create_table(
            'implicit_budget_orders',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('numero_orden', sa.String(50), unique=True, nullable=False),
            sa.Column('titulo', sa.String(200), nullable=False),
            sa.Column('monto_total', sa.Numeric(14, 4), server_default='0.00', nullable=False),
            sa.Column('moneda', sa.String(10), server_default='USD', nullable=False),
            sa.Column('estado', sa.String(30), server_default='PENDIENTE_APROBACION', nullable=False),
            sa.Column('aprobado_por', sa.String(100), nullable=True),
            sa.Column('fecha_aprobacion', sa.DateTime(), nullable=True),
            sa.Column('observaciones', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )

    # 5. Tabla implicit_budget_items
    if 'implicit_budget_items' not in existing_tables:
        op.create_table(
            'implicit_budget_items',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('budget_id', sa.Integer(), sa.ForeignKey('implicit_budget_orders.id'), nullable=False),
            sa.Column('rubro', sa.String(50), nullable=False),
            sa.Column('service_id', sa.Integer(), sa.ForeignKey('implicit_service_catalog.id'), nullable=True),
            sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('suppliers.id'), nullable=True),
            sa.Column('descripcion', sa.String(200), nullable=False),
            sa.Column('cantidad', sa.Integer(), server_default='1', nullable=False),
            sa.Column('costo_unitario', sa.Numeric(14, 4), nullable=False),
            sa.Column('costo_total', sa.Numeric(14, 4), nullable=False),
        )


def downgrade() -> None:
    pass
