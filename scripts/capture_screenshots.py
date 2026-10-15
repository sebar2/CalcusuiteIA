import os
import time
import shutil
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.abspath('docs/screenshots')
ARTIFACT_DIR = r"C:\Users\sebar\.gemini\antigravity\brain\2570fc9f-a035-4b13-ac76-8986765a3a5a"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def take(page, name, desc):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path)
    art_path = os.path.join(ARTIFACT_DIR, f"{name}.png")
    shutil.copy2(path, art_path)
    print(f"  [OK] [{name}.png] {desc}")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1600, 'height': 950})
        page = context.new_page()

        print("[Paso 1] Navegando a http://127.0.0.1:5173...")
        page.goto('http://127.0.0.1:5173')
        page.wait_for_timeout(1500)

        # Captura de Pantalla: Login View
        take(page, "00_login_portal_acceso", "Portal de Autenticación & Acceso Unificado Calcu Suite y 3PL")

        # Iniciar sesión como Controller Admin en Suite Calcu
        print("[Paso 2] Autenticando con perfil Controller Admin...")
        try:
            suite_btn = page.locator('button', has_text="Suite Calcu")
            if suite_btn.is_visible():
                suite_btn.click()
                page.wait_for_timeout(500)
            
            admin_btn = page.locator('button', has_text="admin").first
            if admin_btn.is_visible():
                admin_btn.click()
                page.wait_for_timeout(2500)
        except Exception as e:
            print("  Error en login UI, inyectando token directo:", e)
            page.evaluate('''() => {
                localStorage.setItem('calcu_auth_user', JSON.stringify({
                    user_id: 'admin',
                    nombre: 'Sebastián R. (Controller General)',
                    role: 'controller_admin',
                    token: 'session_demo_2026'
                }));
            }''')
            page.reload()
            page.wait_for_timeout(2000)

        print("\n--- MÓDULO 1: MONITOREO & CIBERSEGURIDAD ---")
        mon_btn = page.locator('button', has_text="Monitoreo").first
        mon_btn.click()
        page.wait_for_timeout(2000)

        # 1. Dashboard Ejecutivo & Copiloto IA (6 Cuadrantes)
        dash_tab = page.locator('button', has_text="Dashboard Ejecutivo")
        if dash_tab.is_visible():
            dash_tab.click()
            page.wait_for_timeout(2000)
        take(page, "01_monitoreo_dashboard_ejecutivo", "Dashboard Ejecutivo 6 Cuadrantes y Copiloto IA Gemini")

        # 2. Reporte de Deudores con Aging y Facturas
        deudores_tab = page.locator('button', has_text="Reporte de Deudores")
        if deudores_tab.is_visible():
            deudores_tab.click()
            page.wait_for_timeout(1500)
        take(page, "02_monitoreo_reporte_deudores", "Reporte Detallado de Deudores con Aging y Filtros 1/30/45/60d")

        # 3. Auditoría Perimetral ISO 27001
        audit_tab = page.locator('button', has_text="Registro de Actividades")
        if audit_tab.is_visible():
            audit_tab.click()
            page.wait_for_timeout(1500)
        take(page, "03_monitoreo_auditoria_iso27001", "Registro Perimetral ISO 27001 y Auditoría de Actividad")

        # 4. Control de Usuarios & RBAC Granular
        users_tab = page.locator('button', has_text="Control de Usuarios")
        if users_tab.is_visible():
            users_tab.click()
            page.wait_for_timeout(1500)
        take(page, "04_monitoreo_control_usuarios_rbac", "Gestión de Usuarios, Puestos y Restricciones Modulares")

        print("\n--- MÓDULO 2: CONTABILIDAD & COBRANZAS ---")
        page.locator('button', has_text="Contabilidad").first.click()
        page.wait_for_timeout(2000)

        # 5. Cobranzas Kanban 5 Etapas
        page.locator('button', has_text="Cobranzas (Kanban 5 Etapas)").click()
        page.wait_for_timeout(1500)
        take(page, "05_cobranzas_kanban_5etapas", "Tablero Kanban de Cobranzas en 5 Etapas de Mora")

        # 6. Modal de Intimación Legal CGP
        try:
            legal_btn = page.locator('button', has_text="Emitir Intimación Legal").first
            if legal_btn.is_visible():
                legal_btn.click()
                page.wait_for_timeout(1200)
                take(page, "06_intimacion_legal_modal", "Borrador de Intimación Legal Prejudicial (CGP Uruguay)")
                # Click X button in modal
                close_btn = page.locator('div.fixed button').first
                if close_btn.is_visible():
                    close_btn.click()
                page.wait_for_timeout(500)
        except Exception as e:
            print("  Modal legal omitido:", e)

        # 7. Libro Diario (Partida Doble)
        page.locator('button', has_text="Libro Diario").click()
        page.wait_for_timeout(1500)
        take(page, "07_libro_diario_partida_doble", "Libro Diario en Partida Doble Cuadrada")

        # 8. Libro Mayor por Cuenta (T-Accounts)
        page.locator('button', has_text="Libro Mayor por Cuenta").click()
        page.wait_for_timeout(1500)
        take(page, "08_libro_mayor_t_accounts", "Libro Mayor por Cuenta Contable (T-Accounts)")

        # 9. Liquidación Fiscal DGI / BPS
        page.locator('button', has_text="Liquidación Fiscal").click()
        page.wait_for_timeout(1500)
        take(page, "09_liquidacion_fiscal_dgi_bps", "Liquidación Fiscal Mensual DGI (IVA, IRAE) y BPS")

        print("\n--- MÓDULO 3: FACTURACIÓN B2B ---")
        page.locator('button', has_text="e-Facturas").first.click()
        page.wait_for_timeout(2000)
        take(page, "10_facturacion_b2b_listado", "Listado de e-Facturas (111) y Notas de Crédito (112)")

        # Modal de Emisión con búsqueda predictiva
        page.locator('button', has_text="Emitir Factura").first.click()
        page.wait_for_timeout(1000)
        take(page, "11_facturacion_emision_modal", "Modal de Emisión con Búsqueda Predictiva y Consumidor Final")
        close_modal_btn = page.locator('div.fixed button').first
        if close_modal_btn.is_visible():
            close_modal_btn.click()
        page.wait_for_timeout(500)

        print("\n--- MÓDULO 4: UNIDAD DESACOPLADA 3PL LOGÍSTICA ---")
        # 12. Tracking GPS (ya capturado antes, o recapturar)
        page.locator('button', has_text="Tracking GPS").first.click()
        page.wait_for_timeout(2500)
        take(page, "12_3pl_tracking_gps_mapa", "Tracking Satelital GPS en Tiempo Real de Flota 3PL")

        # 13. Depósito & Stock 3PL (WMS)
        page.locator('nav button').nth(7).click()
        page.wait_for_timeout(2000)
        take(page, "13_3pl_wms_deposito", "WMS Depósito Multi-Cliente y Stock 3PL")

        # 14. Kanban Operativo 3PL
        page.locator('button', has_text="Kanban 3PL").first.click()
        page.wait_for_timeout(2000)
        take(page, "14_3pl_kanban_operativo", "Kanban Operativo 3PL de Despacho y Entregas")

        # 15. Rentabilidad Financiera 3PL
        page.locator('button', has_text="Rentabilidad 3PL").first.click()
        page.wait_for_timeout(2000)
        take(page, "15_3pl_rentabilidad_finanzas", "Rentabilidad Financiera y Costo Operativo por Km")

        print("\n--- MÓDULO 5: SUPPLY CHAIN, PRICING & LICITACIONES ---")
        # 16. Control Room
        page.locator('button', has_text="Abastecimiento").first.click()
        page.wait_for_timeout(2000)
        take(page, "16_supply_control_room", "Control Room de Abastecimiento y DOH de Inventario")

        # 17. Kanban ROP
        page.locator('button', has_text="Kanban ROP").first.click()
        page.wait_for_timeout(2000)
        take(page, "17_supply_kanban_rop", "Pipeline Kanban de Reposición Automatizada ROP")

        # 18. Pricing & Canales
        page.locator('button', has_text="Pricing & Canales").first.click()
        page.wait_for_timeout(2000)
        take(page, "18_pricing_analitica_canales", "Analítica de Márgenes Comerciales y Pricing Dinámico")

        # 19. Radar Licitaciones
        page.locator('button', has_text="Radar SICE").first.click()
        page.wait_for_timeout(2000)
        take(page, "19_licitaciones_radar_arce", "Radar de Licitaciones Estatales ARCE / SICE")

        browser.close()
        print("\n=======================================================")
        print("¡Todas las capturas de pantalla fueron generadas con éxito!")
        print(f"Directorio local: {SCREENSHOTS_DIR}")
        print(f"Directorio de artefactos: {ARTIFACT_DIR}")
        print("=======================================================")

if __name__ == '__main__':
    run()
