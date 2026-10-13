"""0002_add_multilocation_and_dual_sku

Revision ID: 0002_multilocation_dual_sku
Revises: 0001_baseline
Create Date: 2026-10-09 10:45:00.000000

Agrega columnas para trazabilidad Multi-Depósito, Dual-SKU y categorización de proveedores:
- stock_location_batches: fecha_terminado, sku_fabrica, lote_fabrica, supplier_id, warehouse_id
- suppliers: tipo_proveedor, razon_social, pais, contacto_nombre, contacto_cargo, descripcion
- warehouses: pais
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '0002_multilocation_dual_sku'
down_revision: Union[str, Sequence[str], None] = '0001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = set(inspector.get_table_names())

    # 1. Tabla stock_location_batches
    if 'stock_location_batches' in existing_tables:
        cols = {c['name'] for c in inspector.get_columns('stock_location_batches')}
        with op.batch_alter_table('stock_location_batches', schema=None) as batch_op:
            if 'fecha_terminado' not in cols:
                batch_op.add_column(sa.Column('fecha_terminado', sa.Date(), nullable=True))
            if 'sku_fabrica' not in cols:
                batch_op.add_column(sa.Column('sku_fabrica', sa.String(100), nullable=True))
            if 'lote_fabrica' not in cols:
                batch_op.add_column(sa.Column('lote_fabrica', sa.String(100), nullable=True))
            if 'supplier_id' not in cols:
                batch_op.add_column(sa.Column('supplier_id', sa.Integer(), nullable=True))
            if 'warehouse_id' not in cols:
                batch_op.add_column(sa.Column('warehouse_id', sa.String(50), nullable=True))

    # 2. Tabla suppliers
    if 'suppliers' in existing_tables:
        cols = {c['name'] for c in inspector.get_columns('suppliers')}
        with op.batch_alter_table('suppliers', schema=None) as batch_op:
            if 'tipo_proveedor' not in cols:
                batch_op.add_column(sa.Column('tipo_proveedor', sa.String(50), server_default='FABRICA', nullable=False))
            if 'razon_social' not in cols:
                batch_op.add_column(sa.Column('razon_social', sa.String(200), nullable=True))
            if 'pais' not in cols:
                batch_op.add_column(sa.Column('pais', sa.String(100), server_default='China', nullable=True))
            if 'contacto_nombre' not in cols:
                batch_op.add_column(sa.Column('contacto_nombre', sa.String(100), nullable=True))
            if 'contacto_cargo' not in cols:
                batch_op.add_column(sa.Column('contacto_cargo', sa.String(100), nullable=True))
            if 'descripcion' not in cols:
                batch_op.add_column(sa.Column('descripcion', sa.Text(), nullable=True))

    # 3. Tabla warehouses
    if 'warehouses' in existing_tables:
        cols = {c['name'] for c in inspector.get_columns('warehouses')}
        with op.batch_alter_table('warehouses', schema=None) as batch_op:
            if 'pais' not in cols:
                batch_op.add_column(sa.Column('pais', sa.String(100), server_default='Uruguay', nullable=True))


def downgrade() -> None:
    pass
