import os
import sys
from decimal import Decimal
from datetime import date, datetime, timezone

# Forzar conexión a 127.0.0.1 para evitar demoras IPv6 en Windows
os.environ["DATABASE_URL"] = "postgresql+pg8000://calcu_user:calcu_secure_pass_2026@127.0.0.1:5432/calcu_db"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.session import SessionLocal
from app.models.entities import (
    Area,
    ResponsableUser,
    CentroCosto,
    PresupuestoCentroCosto,
    PresupuestoMeta,
    Category,
    Product,
    Sale,
    CanalComercial,
    Warehouse,
    StockLocationBatch
)

def run_seed():
    db = SessionLocal()
    print("Iniciando purga y re-siembra de Estructura Organizacional y Presupuestos 2026 (Demo)...")

    try:
        # 1. Purgar presupuestos OPEX antiguos
        deleted_pcc = db.query(PresupuestoCentroCosto).delete()
        print(f"- Eliminadas {deleted_pcc} partidas de PresupuestoCentroCosto antiguas.")

        # 2. Purgar metas comerciales antiguas
        deleted_pm = db.query(PresupuestoMeta).delete()
        print(f"- Eliminadas {deleted_pm} metas de PresupuestoMeta antiguas.")

        # 3. Purgar centros de costo antiguos
        deleted_cc = db.query(CentroCosto).delete()
        print(f"- Eliminados {deleted_cc} centros de costo antiguos.")

        # 4. Purgar usuarios responsables antiguos
        deleted_ru = db.query(ResponsableUser).delete()
        print(f"- Eliminados {deleted_ru} usuarios responsables antiguos.")

        # 5. Purgar áreas antiguas
        deleted_areas = db.query(Area).delete()
        print(f"- Eliminadas {deleted_areas} áreas antiguas.")

        db.commit()

        # 6. Crear 6 Áreas BCNF Profesionales
        areas_data = [
            ("DIR-GEN", "Dirección General & Estrategia", "Supervisión ejecutiva, alianzas de negocio y gobernanza corporativa."),
            ("FIN-CTRL", "Finanzas & Control de Gestión FP&A", "Planificación financiera, tesorería, auditoría de costos e impuestos."),
            ("COM-B2B", "Comercial & Ventas B2B", "Gestión de licitaciones públicas, convenios corporativos y canales mayoristas."),
            ("OPS-WMS", "Operaciones & Depósito Central", "Recepción de contenedores, almacenamiento, control de stock y picking."),
            ("LOG-3PL", "Logística & Flota 3PL", "Ruteo, última milla, telemetría de choferes y despachos interdepartamentales."),
            ("TI-DEV", "Tecnología & Sistemas", "Infraestructura cloud, seguridad perimetral ISO 27001 y suite ERP.")
        ]

        areas_map = {}
        for cod, nom, desc in areas_data:
            a = Area(codigo=cod, nombre=nom, descripcion=desc)
            db.add(a)
            db.flush()
            areas_map[cod] = a
        print(f"+ Creadas {len(areas_map)} Áreas BCNF corporativas.")

        # 7. Crear Usuarios Responsables
        users_data = [
            ("Lic. Valentina Rossi", "vrossi@calcu.com.uy", "CEO / Directora General", "DIR-GEN"),
            ("Cr. Matías Fernández", "mfernandez@calcu.com.uy", "CFO / Controller de Finanzas", "FIN-CTRL"),
            ("Ing. Lucía Benítez", "lbenitez@calcu.com.uy", "Gerente Comercial B2B & Licitaciones", "COM-B2B"),
            ("Rodrigo Méndez", "rmendez@calcu.com.uy", "Jefe de Almacén & WMS Central", "OPS-WMS"),
            ("Carlos Techera", "ctechera@calcu.com.uy", "Supervisor de Flota & Logística 3PL", "LOG-3PL"),
            ("Ing. Gabriel Silva", "gsilva@calcu.com.uy", "Tech Lead / Arquitecto TI", "TI-DEV")
        ]

        users_map = {}
        for nom, email, cargo, a_cod in users_data:
            u = ResponsableUser(
                nombre=nom,
                email=email,
                cargo=cargo,
                area_id=areas_map[a_cod].id
            )
            db.add(u)
            db.flush()
            users_map[nom] = u
        print(f"+ Creados {len(users_map)} Usuarios Responsables ejecutivos.")

        # 8. Crear Centros de Costo Oficiales
        cc_data = [
            ("CC-DIR", "Dirección General & Gobierno Corporativo", "Lic. Valentina Rossi", "DIR-GEN"),
            ("CC-FIN", "Finanzas, Auditoría & Tesorería", "Cr. Matías Fernández", "FIN-CTRL"),
            ("CC-COM", "Comercial, Marketing B2B & Licitaciones", "Ing. Lucía Benítez", "COM-B2B"),
            ("CC-WMS", "Depósito Central, Almacenamiento & Picking", "Rodrigo Méndez", "OPS-WMS"),
            ("CC-LOG", "Logística, Flota 3PL & Distribución", "Carlos Techera", "LOG-3PL"),
            ("CC-TI", "Sistemas, Software Cloud & Ciberseguridad", "Ing. Gabriel Silva", "TI-DEV")
        ]

        cc_map = {}
        for cod, nom, resp_name, a_cod in cc_data:
            cc = CentroCosto(
                codigo=cod,
                nombre=nom,
                responsable=resp_name,
                activo=True,
                area_id=areas_map[a_cod].id,
                responsable_id=users_map[resp_name].id
            )
            db.add(cc)
            db.flush()
            cc_map[cod] = cc
        print(f"+ Creados {len(cc_map)} Centros de Costo operativos.")

        # 9. Crear 4 Presupuestos Mensuales 2026 (Demo) - Meses 7, 8, 9 y 10
        # M7: Julio 2026, M8: Agosto 2026, M9: Setiembre 2026, M10: Octubre 2026
        meses_demo = [
            ("2026-07", "Presupuesto Operativo M7 - Julio 2026 (Demo)", 1.00),
            ("2026-08", "Presupuesto Operativo M8 - Agosto 2026 (Demo)", 1.04),
            ("2026-09", "Presupuesto Operativo M9 - Setiembre 2026 (Demo)", 1.08),
            ("2026-10", "Presupuesto Operativo M10 - Octubre 2026 (Demo)", 1.12),
        ]

        # Partidas representativas por centro de costo
        partidas_base = [
            # Dirección
            ("CC-DIR", "Honorarios de Directorio y Consultoría Estratégica", 3500.0, 3500.0),
            ("CC-DIR", "Gastos Representación y Relaciones Institucionales", 1200.0, 1150.0),
            # Finanzas
            ("CC-FIN", "Auditoría Externa, Honorarios Contables y BPS", 2200.0, 2300.0),
            ("CC-FIN", "Comisiones Bancarias y Mantenimiento de Cuentas BROU", 850.0, 890.0),
            ("CC-FIN", "Seguros de Caución y Responsabilidad Civil", 1400.0, 1400.0),
            # Comercial
            ("CC-COM", "Pauta de Marketing Digital B2B & Campañas LinkedIn", 2800.0, 3100.0),
            ("CC-COM", "Comisiones Comerciales por Cumplimiento de Metas", 4500.0, 4200.0),
            ("CC-COM", "Pliegos de Licitaciones y Trámites RUPE / ARCE", 950.0, 920.0),
            # WMS / Depósito
            ("CC-WMS", "Alquiler Nave Depósito Central Montevideo", 6500.0, 6500.0),
            ("CC-WMS", "Insumos de Empaque, Pallets y Film Termocontraíble", 1300.0, 1550.0),
            ("CC-WMS", "Mantenimiento Autoelevadores y Racks Industriales", 1100.0, 980.0),
            # Logística 3PL
            ("CC-LOG", "Combustible de Flota (Montevideo e Interior)", 4200.0, 4650.0),
            ("CC-LOG", "Peajes Telepeaje y Mantenimiento de Vehículos 3PL", 1800.0, 1720.0),
            ("CC-LOG", "Fletes de Apoyo Subcontratados de Larga Distancia", 2900.0, 3400.0),
            # Tecnología
            ("CC-TI", "Servidores Cloud AWS / DigitalOcean & Backup Offsite", 1600.0, 1620.0),
            ("CC-TI", "Licencias SaaS (ERP, Google Workspace, Tailscale Enterprise)", 1250.0, 1250.0),
            ("CC-TI", "Soporte de Hardware, Redes y Enlace Fibra Óptica", 750.0, 780.0),
        ]

        total_lineas_creadas = 0
        for periodo, titulo_demo, factor in meses_demo:
            for cc_code, concepto, pres_base, real_base in partidas_base:
                p_monto = Decimal(str(round(pres_base * factor, 2)))
                r_monto = Decimal(str(round(real_base * factor, 2)))
                line = PresupuestoCentroCosto(
                    periodo=periodo,
                    centro_costo_id=cc_map[cc_code].id,
                    concepto_opex=f"{concepto} - {titulo_demo}",
                    monto_presupuestado=p_monto,
                    monto_real=r_monto
                )
                db.add(line)
                total_lineas_creadas += 1

        print(f"+ Creadas {total_lineas_creadas} partidas OPEX para 4 presupuestos 2026 (Demo).")

        # 10. Metas Comerciales por Categoría para los 4 meses 2026 (Demo)
        categorias = db.query(Category).all()
        metas_creadas = 0
        if categorias:
            for periodo, titulo_demo, factor in meses_demo:
                for cat in categorias:
                    meta_ventas = Decimal(str(round(25000.0 * factor, 2)))
                    unidades = int(120 * factor)
                    pm = PresupuestoMeta(
                        version="V1-DEMO",
                        periodo=periodo,
                        categoria_id=cat.id,
                        monto_presupuestado=meta_ventas,
                        unidades_presupuestadas=unidades
                    )
                    db.add(pm)
                    metas_creadas += 1
        print(f"+ Creadas {metas_creadas} metas comerciales por categoría para 2026 (Demo).")

        db.commit()
        print(">>> Purga y siembra de Estructura Organizacional y Presupuestos 2026 (Demo) finalizada con éxito total.")

    except Exception as e:
        db.rollback()
        print(f"ERROR durante la siembra: {e}", file=sys.stderr)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
