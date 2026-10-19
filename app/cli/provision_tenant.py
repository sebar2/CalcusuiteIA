"""
Script CLI Oficial de Aprovisionamiento de Cuentas Multi-Tenant para Calcu Suite 2026.
Uso desde terminal:
  python -m app.cli.provision_tenant --slug "mi_empresa" --name "Mi Empresa S.A." --admin-email "admin@miempresa.com" --admin-user "admin_miempresa" --plan "ENTERPRISE_3PL" --trial-days 14
"""

import argparse
import re
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.database.session import init_db, SessionLocal, tenant_connection_manager
from app.models.multitenant_entities import TenantAccount
from app.models.accounting_entities import SystemUser
from app.services.monitoring_service import hash_password
from app.core.security import ROLE_CONTROLLER_ADMIN
from app.api.v1.tenants import LICENSE_CAPABILITIES


def provision_from_cli(
    slug: str,
    name: str,
    admin_email: str,
    admin_user: str,
    password: str = "calcu2026",
    rut: str = None,
    plan: str = "ENTERPRISE_3PL",
    trial_days: int = 14,
):
    init_db()
    clean_slug = re.sub(r"[^a-z0-9_]", "_", slug.strip().lower())
    tenant_id = f"tenant_{clean_slug}" if not clean_slug.startswith("tenant_") else clean_slug
    tier = plan.upper() if plan.upper() in LICENSE_CAPABILITIES else "ENTERPRISE_3PL"
    caps = LICENSE_CAPABILITIES[tier]

    master_db = SessionLocal()
    try:
        existing = master_db.query(TenantAccount).filter(
            (TenantAccount.id == tenant_id) | (TenantAccount.slug == clean_slug)
        ).first()
        if existing:
            print(f"[!] La cuenta '{tenant_id}' ya se encuentra registrada para '{existing.nombre_empresa}'.")
            return existing.id

        now_utc = datetime.now(timezone.utc)
        trial_end = now_utc + timedelta(days=trial_days)

        new_tenant = TenantAccount(
            id=tenant_id,
            slug=clean_slug,
            nombre_empresa=name.strip(),
            rut=rut,
            schema_name=tenant_id,
            db_strategy="POSTGRES_SCHEMA",
            license_tier=tier,
            simulated_tier=tier,
            subscription_status="TRIAL_14_DAYS",
            trial_starts_at=now_utc,
            trial_ends_at=trial_end,
            max_users=caps["max_users"],
            admin_email=admin_email.strip().lower(),
            admin_username=admin_user.strip().lower(),
            mrr_usd=Decimal(str(caps["price_monthly_usd"])),
            is_active=True,
            created_at=now_utc,
        )
        master_db.add(new_tenant)

        existing_u = master_db.query(SystemUser).filter(
            SystemUser.username == admin_user.strip().lower()
        ).first()
        if not existing_u:
            new_admin = SystemUser(
                username=admin_user.strip().lower(),
                email=admin_email.strip().lower(),
                nombre_completo=f"Admin - {name.strip()}",
                puesto="Controller Administrador de Cuenta",
                role=ROLE_CONTROLLER_ADMIN,
                restricted_modules=[],
                activo=True,
                password_hash=hash_password(password),
                tenant_id=tenant_id,
                two_factor_enabled=False,
                is_master_superadmin=False,
                created_at=now_utc,
            )
            master_db.add(new_admin)

        master_db.commit()

        # Crear e inicializar base de datos / esquema PostgreSQL aislado
        session_isolated = tenant_connection_manager.get_session_for_tenant(tenant_id)
        session_isolated.close()

        print("=" * 70)
        print("  CUENTA MULTI-TENANT CALCU APROVISIONADA CON EXITO")
        print("=" * 70)
        print(f"  ID de Cuenta (Tenant) : {tenant_id}")
        print(f"  Empresa               : {name}")
        print(f"  Esquema / BD Aislada  : {tenant_id}")
        print(f"  Licencia Inicial      : {tier} (Trial {trial_days} días gratis)")
        print(f"  Usuario Administrador : {admin_user.strip().lower()}")
        print(f"  Email Administrador   : {admin_email.strip().lower()}")
        print("=" * 70)
        return tenant_id
    finally:
        master_db.close()


def main():
    parser = argparse.ArgumentParser(description="Aprovisionador de Cuentas Multi-Tenant para Calcu Suite 2026")
    parser.add_argument("--slug", required=True, help="Identificador único (ej. distribuidora_sur)")
    parser.add_argument("--name", required=True, help="Razón Social o Nombre de la Empresa")
    parser.add_argument("--admin-email", required=True, help="Correo del administrador de la cuenta")
    parser.add_argument("--admin-user", required=True, help="Nombre de usuario del administrador")
    parser.add_argument("--password", default="calcu2026", help="Contraseña inicial del administrador")
    parser.add_argument("--rut", default=None, help="RUT de la empresa")
    parser.add_argument("--plan", default="ENTERPRISE_3PL", choices=["STARTER", "PRO", "ENTERPRISE_3PL"])
    parser.add_argument("--trial-days", type=int, default=14, help="Días de prueba gratuita (por defecto 14)")
    args = parser.parse_args()

    provision_from_cli(
        slug=args.slug,
        name=args.name,
        admin_email=args.admin_email,
        admin_user=args.admin_user,
        password=args.password,
        rut=args.rut,
        plan=args.plan,
        trial_days=args.trial_days,
    )


if __name__ == "__main__":
    main()
