import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.abspath('docs/screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def take(page, name, desc):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path)
    print(f"  [OK] [{name}.png] {desc} -> {path}")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1600, 'height': 950})
        page = context.new_page()

        print("[1] Autenticando mediante API /auth/login...")
        page.goto('http://127.0.0.1:5173')
        page.evaluate('''async () => {
            const r = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            const d = await r.json();
            localStorage.setItem('calcu_access_token', d.access_token);
            localStorage.setItem('calcu_user', JSON.stringify({
                token: d.access_token,
                user_id: d.user_id,
                role: d.role,
                nombre: d.nombre,
                tenant_id: d.tenant_id,
                company_name: d.company_name,
                license_tier: d.license_tier,
                is_master_superadmin: d.is_master_superadmin
            }));
            return d;
        }''')
        page.reload()
        page.wait_for_timeout(3000)

        # -----------------------------------------------------------------
        # 21. MERCADO LIBRE KANBAN 5 ETAPAS
        # -----------------------------------------------------------------
        print("[2] Navegando a Mercado Libre Uruguay...")
        meli_btn = page.locator('button', has_text="Mercado Libre").first
        meli_btn.scroll_into_view_if_needed()
        meli_btn.click()
        page.wait_for_timeout(3000)
        take(page, "21_mercadolibre_kanban_5etapas", "Tablero Kanban 5 Etapas Mercado Libre Uruguay con SLA")

        # -----------------------------------------------------------------
        # 24. MODAL DE PUBLICACIÓN MERCADO LIBRE
        # -----------------------------------------------------------------
        print("[3] Abriendo Modal de Publicación Mercado Libre...")
        try:
            pub_btn = page.locator('button:has-text("Publicar"), button:has-text("Nueva Publicación")').first
            if pub_btn.is_visible():
                pub_btn.click()
                page.wait_for_timeout(2000)
                take(page, "24_meli_publicacion_modal", "Modal de Publicación Asistida MeLi Pinned & Selector 3 Vías")
                
                # Cerrar modal
                close_btn = page.locator('button:has-text("Cancelar"), div.fixed button').first
                if close_btn.is_visible():
                    close_btn.click()
                    page.wait_for_timeout(800)
        except Exception as e:
            print("  Error en modal:", e)

        # -----------------------------------------------------------------
        # 23. CHAT OMNICANAL & WHATSAPP DIRECTO QR MULTIMEDIA
        # -----------------------------------------------------------------
        print("[4] Navegando a Chat Omnicanal IA...")
        chat_btn = page.locator('button', has_text="Chat Omnicanal IA").first
        chat_btn.scroll_into_view_if_needed()
        chat_btn.click()
        page.wait_for_timeout(3000)
        take(page, "23_omnichannel_chat_multimedia", "Consola de Chat Omnicanal WhatsApp Directo QR Multimedia")

        # -----------------------------------------------------------------
        # 22. HUB INTEGRACIONES MULTICANAL
        # -----------------------------------------------------------------
        print("[5] Navegando a Hub Integraciones...")
        hub_btn = page.locator('button', has_text="Hub Integraciones").first
        hub_btn.scroll_into_view_if_needed()
        hub_btn.click()
        page.wait_for_timeout(3000)
        take(page, "22_integraciones_whatsapp_qr", "Hub de Integraciones Multicanal con Métricas ROAS y CAC")

        # -----------------------------------------------------------------
        # 25. LICENCIAS SAAS & MULTI-TENANT (PROGRAMA PIONEROS)
        # -----------------------------------------------------------------
        print("[6] Navegando a Licencias & Tenants...")
        tenants_btn = page.locator('button', has_text="Licencias & Tenants").first
        tenants_btn.scroll_into_view_if_needed()
        tenants_btn.click()
        page.wait_for_timeout(3000)
        take(page, "25_licencias_multitenant_pioneros", "Gestión de Licencias Multi-Tenant y Aislamiento de Base de Datos")

        context.close()

        # -----------------------------------------------------------------
        # 26. VISTA MÓVIL XIAOMI REDMI NOTE 9 PRO (DRAWER HAMBURGUESA ☰)
        # -----------------------------------------------------------------
        print("[7] Generando vista móvil Xiaomi Redmi Note 9 Pro (393x873)...")
        mobile_ctx = browser.new_context(
            viewport={'width': 393, 'height': 873},
            user_agent='Mozilla/5.0 (Linux; Android 15; Redmi Note 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
        )
        mobile_page = mobile_ctx.new_page()
        mobile_page.goto('http://127.0.0.1:5173')
        mobile_page.evaluate('''async () => {
            const r = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            const d = await r.json();
            localStorage.setItem('calcu_access_token', d.access_token);
            localStorage.setItem('calcu_user', JSON.stringify({
                token: d.access_token,
                user_id: d.user_id,
                role: d.role,
                nombre: d.nombre,
                tenant_id: d.tenant_id,
                company_name: d.company_name,
                license_tier: d.license_tier,
                is_master_superadmin: d.is_master_superadmin
            }));
        }''')
        mobile_page.reload()
        mobile_page.wait_for_timeout(3000)

        # Clic en el botón hamburguesa ☰ en el TopHeader móvil
        menu_btn = mobile_page.locator('button[aria-label="Abrir menú de navegación"]').or_(mobile_page.locator('header button').first)
        menu_btn.click()
        mobile_page.wait_for_timeout(1500)
        take(mobile_page, "26_mobile_redmi_note_9_pro_menu", "Menú Hamburguesa y Drawer Desplegado en Xiaomi Redmi Note 9 Pro")

        mobile_ctx.close()
        browser.close()
        print("\n¡Capturas reales generadas con éxito!")

if __name__ == '__main__':
    run()
