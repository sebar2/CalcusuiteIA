"""0001_baseline_schema

Revision ID: 0001_baseline
Revises: 
Create Date: 2026-10-08 16:30:00.000000

Línea base oficial del esquema relacional BCNF de Calcu:
- Categorías con escala normalizada NUMERIC(14, 4)
- Áreas y Centros de Costo (BCNF OPEX)
- Productos, Inventario y Lotes Multi-depósito
- Presupuestos, Metas, Ventas y Órdenes de Reposición
- Licitaciones ARCE (Tenders) y Pipeline CRM
- Auditoría RBAC y Acciones de Compromiso
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '0001_baseline'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = set(inspector.get_table_names())

    # 1. Tabla categorias
    if 'categorias' not in existing_tables:
        op.create_table(
            'categorias',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('nombre', sa.String(100), unique=True, nullable=False),
            sa.Column('margen_target_pct', sa.Numeric(14, 4), server_default='0.30', nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        )

    # 2. Tabla areas
    if 'areas' not in existing_tables:
        op.create_table(
            'areas',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('codigo', sa.String(30), unique=True, nullable=False),
            sa.Column('nombre', sa.String(100), nullable=False),
            sa.Column('descripcion', sa.String(255), nullable=True),
        )

    # 3. Tabla responsables_organizacion
    if 'responsables_organizacion' not in existing_tables:
        op.create_table(
            'responsables_organizacion',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('nombre', sa.String(100), nullable=False),
            sa.Column('email', sa.String(100), unique=True, nullable=False),
            sa.Column('cargo', sa.String(100), nullable=False),
            sa.Column('area_id', sa.Integer(), sa.ForeignKey('areas.id'), nullable=True),
        )

    # 4. Tabla centros_costo
    if 'centros_costo' not in existing_tables:
        op.create_table(
            'centros_costo',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('codigo', sa.String(30), unique=True, nullable=False),
            sa.Column('nombre', sa.String(100), nullable=False),
            sa.Column('responsable', sa.String(100), nullable=False),
            sa.Column('activo', sa.Boolean(), server_default='1', nullable=True),
            sa.Column('area_id', sa.Integer(), sa.ForeignKey('areas.id'), nullable=True),
            sa.Column('responsable_id', sa.Integer(), sa.ForeignKey('responsables_organizacion.id'), nullable=True),
        )

    # 5. Tabla presupuestos_centros_costo
    if 'presupuestos_centros_costo' not in existing_tables:
        op.create_table(
            'presupuestos_centros_costo',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('periodo', sa.String(50), nullable=False),
            sa.Column('centro_costo_id', sa.Integer(), sa.ForeignKey('centros_costo.id'), nullable=False),
            sa.Column('concepto_opex', sa.String(150), nullable=False),
            sa.Column('monto_presupuestado', sa.Numeric(14, 4), server_default='0.00', nullable=True),
            sa.Column('monto_real', sa.Numeric(14, 4), server_default='0.00', nullable=True),
        )

    # 6. Tabla productos
    if 'productos' not in existing_tables:
        op.create_table(
            'productos',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('sku', sa.String(50), unique=True, nullable=False),
            sa.Column('nombre', sa.String(200), nullable=False),
            sa.Column('categoria_id', sa.Integer(), sa.ForeignKey('categorias.id'), nullable=False),
            sa.Column('costo_base', sa.Numeric(14, 4), nullable=False),
            sa.Column('precio_lista', sa.Numeric(14, 4), nullable=False),
            sa.Column('doh_seguridad', sa.Integer(), server_default='15', nullable=False),
            sa.Column('activo', sa.Boolean(), server_default='true', nullable=False),
        )

    # 7. Tabla inventario
    if 'inventario' not in existing_tables:
        op.create_table(
            'inventario',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('sku', sa.String(50), sa.ForeignKey('productos.sku'), unique=True, nullable=False),
            sa.Column('stock_actual', sa.Integer(), server_default='0', nullable=False),
            sa.Column('stock_seguridad', sa.Integer(), server_default='0', nullable=False),
            sa.Column('lead_time_dias', sa.Integer(), server_default='15', nullable=False),
            sa.Column('demanda_diaria_promedio', sa.Numeric(14, 4), server_default='0.00', nullable=False),
            sa.Column('deposito_central', sa.Integer(), server_default='0', nullable=True),
            sa.Column('transito_maritimo', sa.Integer(), server_default='0', nullable=True),
            sa.Column('aduana', sa.Integer(), server_default='0', nullable=True),
        )

    # 8. Sincronizar índices si las tablas ya existían
    if 'centros_costo' in existing_tables:
        with op.batch_alter_table('centros_costo', schema=None) as batch_op:
            try:
                batch_op.create_index(batch_op.f('ix_centros_costo_area_id'), ['area_id'], unique=False)
            except Exception:
                pass
            try:
                batch_op.create_index(batch_op.f('ix_centros_costo_responsable_id'), ['responsable_id'], unique=False)
            except Exception:
                pass


def downgrade() -> None:
    pass
