import os
import base64
import time
from playwright.sync_api import sync_playwright

WORKSPACE = os.path.abspath(".")
DOCS_DIR = os.path.join(WORKSPACE, "docs")
SCREENSHOTS_DIR = os.path.join(DOCS_DIR, "screenshots")
ARTIFACT_DIR = r"C:\Users\sebar\.gemini\antigravity\brain\2570fc9f-a035-4b13-ac76-8986765a3a5a"

def get_base64_image(filename):
    path = os.path.join(SCREENSHOTS_DIR, filename)
    if os.path.exists(path):
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            return f"data:image/png;base64,{encoded}"
    return ""

def main():
    print("Iniciando generacion del Manual Completo Calcu 2026...")

    # Mapeo de capturas en base64 para que el HTML sea 100% portable y autocontenido
    images = {
        "00": get_base64_image("00_login_portal_acceso.png"),
        "01": get_base64_image("01_monitoreo_dashboard_ejecutivo.png"),
        "02": get_base64_image("02_monitoreo_reporte_deudores.png"),
        "03": get_base64_image("03_monitoreo_auditoria_iso27001.png"),
        "04": get_base64_image("04_monitoreo_control_usuarios_rbac.png"),
        "05": get_base64_image("05_cobranzas_kanban_5etapas.png"),
        "06": get_base64_image("06_intimacion_legal_modal.png"),
        "07": get_base64_image("07_libro_diario_partida_doble.png"),
        "08": get_base64_image("08_libro_mayor_t_accounts.png"),
        "09": get_base64_image("09_liquidacion_fiscal_dgi_bps.png"),
        "10": get_base64_image("10_facturacion_b2b_listado.png"),
        "11": get_base64_image("11_facturacion_emision_modal.png"),
        "12": get_base64_image("12_3pl_tracking_gps_mapa.png"),
        "13": get_base64_image("13_3pl_wms_deposito.png"),
        "14": get_base64_image("14_3pl_kanban_operativo.png"),
        "15": get_base64_image("15_3pl_rentabilidad_finanzas.png"),
        "16": get_base64_image("16_supply_control_room.png"),
        "17": get_base64_image("17_supply_kanban_rop.png"),
        "18": get_base64_image("18_pricing_analitica_canales.png"),
        "19": get_base64_image("19_licitaciones_radar_arce.png"),
    }

    html_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Manual Completo Calcu Suite & 3PL Logística 2026</title>
    <style>
        @page {{
            size: A4;
            margin: 1.8cm 1.5cm 1.8cm 1.5cm;
            @bottom-right {{
                content: counter(page);
                font-size: 9pt;
                color: #64748b;
            }}
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 11pt;
        }}
        .cover {{
            padding: 80px 40px;
            background: linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0369a1 100%);
            color: white;
            border-radius: 24px;
            margin-bottom: 40px;
            page-break-after: always;
            text-align: center;
        }}
        .cover h1 {{
            font-size: 38pt;
            font-weight: 900;
            margin: 0 0 10px 0;
            letter-spacing: -1px;
            background: linear-gradient(to right, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .cover .subtitle {{
            font-size: 16pt;
            font-weight: 500;
            color: #94a3b8;
            margin-bottom: 30px;
        }}
        .cover .tagline {{
            font-size: 13pt;
            max-width: 700px;
            margin: 0 auto 40px auto;
            color: #cbd5e1;
            line-height: 1.6;
        }}
        .badge-grid {{
            display: flex;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 25px;
        }}
        .badge {{
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 10pt;
            font-weight: 600;
            color: #f8fafc;
        }}
        .toc {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 40px;
            page-break-after: always;
        }}
        .toc h2 {{
            margin-top: 0;
            font-size: 18pt;
            color: #0f172a;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
        }}
        .toc-list {{
            list-style: none;
            padding: 0;
            margin: 0;
            columns: 2;
            column-gap: 30px;
        }}
        .toc-list li {{
            margin-bottom: 12px;
            font-size: 10.5pt;
        }}
        .toc-list a {{
            text-decoration: none;
            color: #1e293b;
            font-weight: 600;
        }}
        .section-header {{
            border-left: 6px solid #0284c7;
            padding-left: 15px;
            margin-top: 40px;
            margin-bottom: 20px;
            page-break-before: always;
        }}
        .section-header h2 {{
            font-size: 20pt;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
        }}
        .section-header .section-tag {{
            font-size: 10pt;
            font-weight: 700;
            text-transform: uppercase;
            color: #0284c7;
            letter-spacing: 1px;
        }}
        h3 {{
            font-size: 14pt;
            color: #1e293b;
            margin-top: 30px;
            margin-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }}
        p {{
            margin-bottom: 14px;
            text-align: justify;
        }}
        .screenshot-card {{
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            margin: 25px 0 35px 0;
            page-break-inside: avoid;
        }}
        .screenshot-card img {{
            width: 100%;
            height: auto;
            display: block;
            border-bottom: 1px solid #e2e8f0;
        }}
        .screenshot-caption {{
            padding: 12px 18px;
            background: #f8fafc;
            font-size: 9.5pt;
            color: #475569;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .screenshot-caption strong {{
            color: #0f172a;
        }}
        .feature-box {{
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-left: 4px solid #16a34a;
            border-radius: 10px;
            padding: 16px 20px;
            margin: 20px 0;
            font-size: 10.5pt;
        }}
        .alert-box {{
            background: #fff1f2;
            border: 1px solid #fecdd3;
            border-left: 4px solid #e11d48;
            border-radius: 10px;
            padding: 16px 20px;
            margin: 20px 0;
            font-size: 10.5pt;
        }}
        .tech-box {{
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-left: 4px solid #0284c7;
            border-radius: 10px;
            padding: 16px 20px;
            margin: 20px 0;
            font-size: 10.5pt;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10pt;
        }}
        th, td {{
            border: 1px solid #e2e8f0;
            padding: 10px 14px;
            text-align: left;
        }}
        th {{
            background: #f8fafc;
            font-weight: 700;
            color: #1e293b;
        }}
        tr:nth-child(even) {{
            background: #fafafa;
        }}
        .footer-note {{
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            font-size: 9pt;
            color: #64748b;
        }}
    </style>
</head>
<body>

    <!-- PORTADA -->
    <div class="cover">
        <div style="font-size: 12pt; text-transform: uppercase; letter-spacing: 2px; color: #38bdf8; font-weight: 800; margin-bottom: 15px;">
            Documento Técnico & Comercial Oficial 2026
        </div>
        <h1>CALCU SUITE & 3PL LOGÍSTICA</h1>
        <div class="subtitle">Ecosistema Integrado de Abastecimiento, Cobranzas DGI, Inteligencia Artificial y Logística Satelital</div>
        <div class="tagline">
            Manual exhaustivo de la suite con especificación técnica, modelos de gobernanza ISO 27001, flujos de cobranza prejudicial de 5 etapas, ruteo GPS en tiempo real y despliegue de aplicación móvil Android nativa (APK).
        </div>
        <div class="badge-grid">
            <span class="badge">FastAPI Core 2026</span>
            <span class="badge">React 19 & Tailwind</span>
            <span class="badge">Tailscale ZTNA Mesh</span>
            <span class="badge">ISO/IEC 27001:2022</span>
            <span class="badge">CFE DGI Uruguay</span>
            <span class="badge">Capacitor Android APK</span>
            <span class="badge">Gemini IA Copilot</span>
        </div>
    </div>

    <!-- TABLA DE CONTENIDOS -->
    <div class="toc">
        <h2>Índice General del Manual</h2>
        <ul class="toc-list">
            <li><strong>Capítulo 1:</strong> <a href="#portal">Portal de Acceso y Red Segura Tailscale</a></li>
            <li><strong>Capítulo 2:</strong> <a href="#monitoreo">Monitoreo, Auditoría y Ciberseguridad</a></li>
            <li><strong>Capítulo 3:</strong> <a href="#deudores">Reportes Financieros y Aging de Cartera</a></li>
            <li><strong>Capítulo 4:</strong> <a href="#iso27001">Gobernanza Perimetral ISO 27001</a></li>
            <li><strong>Capítulo 5:</strong> <a href="#rbac">Control de Usuarios y Permisos RBAC</a></li>
            <li><strong>Capítulo 6:</strong> <a href="#cobranzas">Cobranzas en 5 Etapas de Mora</a></li>
            <li><strong>Capítulo 7:</strong> <a href="#intimacion">Intimación Legal Prejudicial (CGP)</a></li>
            <li><strong>Capítulo 8:</strong> <a href="#contabilidad">Libro Diario y Mayor (Partida Doble)</a></li>
            <li><strong>Capítulo 9:</strong> <a href="#fiscal">Liquidación Fiscal DGI y BPS</a></li>
            <li><strong>Capítulo 10:</strong> <a href="#facturacion">Facturación B2B (e-Facturas y NC)</a></li>
            <li><strong>Capítulo 11:</strong> <a href="#emision">Emisión Predictiva y Consumidor Final</a></li>
            <li><strong>Capítulo 12:</strong> <a href="#tracking">Tracking Satelital GPS en Vivo 3PL</a></li>
            <li><strong>Capítulo 13:</strong> <a href="#wms">WMS Depósito Multi-Cliente 3PL</a></li>
            <li><strong>Capítulo 14:</strong> <a href="#kanban3pl">Kanban Operativo de Entregas 3PL</a></li>
            <li><strong>Capítulo 15:</strong> <a href="#rentabilidad">Rentabilidad y Costo por Kilómetro</a></li>
            <li><strong>Capítulo 16:</strong> <a href="#supply">Control Room de Abastecimiento DOH</a></li>
            <li><strong>Capítulo 17:</strong> <a href="#rop">Pipeline Kanban de Reposición ROP</a></li>
            <li><strong>Capítulo 18:</strong> <a href="#pricing">Pricing Dinámico y Multicanal</a></li>
            <li><strong>Capítulo 19:</strong> <a href="#licitaciones">Radar de Licitaciones ARCE / SICE</a></li>
            <li><strong>Capítulo 20:</strong> <a href="#apk">App Móvil Android (APK) y Despliegue</a></li>
        </ul>
    </div>

    <!-- CAPÍTULO 1 -->
    <div id="portal" class="section-header">
        <div class="section-tag">Capítulo 1</div>
        <h2>Portal de Acceso y Red Segura Tailscale</h2>
    </div>
    <p>
        El acceso a la plataforma se realiza mediante un portal unificado que conecta las dos unidades del negocio: la <strong>Suite Corporativa Calcu</strong> (para directores, finanzas, comercial y supply chain) y la <strong>Unidad Desacoplada 3PL Logística</strong> (para operadores de depósito, choferes y clientes de flete).
    </p>
    <div class="screenshot-card">
        <img src="{images['00']}" alt="Portal de Acceso">
        <div class="screenshot-caption">
            <span><strong>Figura 1.1:</strong> Portal de Autenticación Unificado con selector de entorno Suite/3PL y perfiles demo rápidos.</span>
            <span>Vista: Login / Auth Gate</span>
        </div>
    </div>
    <div class="tech-box">
        <strong>Conexión Cifrada Tailscale Zero-Trust (ZTNA):</strong> La suite se comunica sobre una red VPN privada en malla (mesh). Esto significa que ningún puerto de base de datos ni de APIs críticas queda expuesto a Internet público. Los choferes en ruta y las terminales de almacén se comunican directamente peer-to-peer (P2P), garantizando la latencia más baja posible sin intermediación de servidores de retransmisión (DERP).
    </div>

    <!-- CAPÍTULO 2 -->
    <div id="monitoreo" class="section-header">
        <div class="section-tag">Capítulo 2</div>
        <h2>Monitoreo, Auditoría & Dashboard Ejecutivo</h2>
    </div>
    <p>
        El <strong>Dashboard Ejecutivo</strong> reúne en una sola pantalla los 6 cuadrantes vitales para la toma de decisiones empresariales, integrando además un <strong>Copiloto IA conversacional impulsado por Gemini</strong>.
    </p>
    <div class="screenshot-card">
        <img src="{images['01']}" alt="Dashboard Ejecutivo">
        <div class="screenshot-caption">
            <span><strong>Figura 2.1:</strong> Dashboard Ejecutivo con 6 cuadrantes analíticos y chat inteligente con Gemini AI.</span>
            <span>Módulo: Monitoreo / Dashboard</span>
        </div>
    </div>
    <h3>Detalle de los 6 Cuadrantes Analíticos:</h3>
    <table>
        <tr>
            <th style="width: 25%;">Cuadrante</th>
            <th style="width: 35%;">Métricas Clave</th>
            <th style="width: 40%;">Impacto en el Negocio</th>
        </tr>
        <tr>
            <td><strong>1. Deudores & Mora (Aging)</strong></td>
            <td>Total cartera vencida ($425.400 UYU), clientes en mora y desglose por antigüedad.</td>
            <td>Control del riesgo crediticio y activación oportuna de acciones de cobro.</td>
        </tr>
        <tr>
            <td><strong>2. KPI de Vendedores</strong></td>
            <td>Ventas por ejecutivo, comisiones proyectadas y % de alcance de meta Q3.</td>
            <td>Incentivos alineados al margen y seguimiento de la fuerza comercial.</td>
        </tr>
        <tr>
            <td><strong>3. Asistencia & Horarios</strong></td>
            <td>Hora de ingreso, egreso, estado presente y nodo Tailscale de conexión.</td>
            <td>Supervisión de personal en campo y teletrabajo sin requerir biométricos físicos.</td>
        </tr>
        <tr>
            <td><strong>4. KPIs de Productos</strong></td>
            <td>Top SKUs más vendidos, facturación generada y rotación de inventario.</td>
            <td>Priorización de reposición para evitar quiebre de stock en ítems Clase A.</td>
        </tr>
        <tr>
            <td><strong>5. Formas de Pago</strong></td>
            <td>Distribución porcentual entre Contado, Crédito a 30 días y Transferencia BROU.</td>
            <td>Previsibilidad del flujo de caja diario y semanal.</td>
        </tr>
        <tr>
            <td><strong>6. Medios de Compra</strong></td>
            <td>Ventas por Portal Web B2B, Vendedores en Calle y Licitaciones Estatales.</td>
            <td>Evaluación del ROI por canal comercial para asignación presupuestaria.</td>
        </tr>
    </table>

    <!-- CAPÍTULO 3 -->
    <div id="deudores" class="section-header">
        <div class="section-tag">Capítulo 3</div>
        <h2>Reportes Financieros y Aging de Cartera</h2>
    </div>
    <p>
        El reporte de cobranzas y deudores permite a la gerencia financiera segmentar al instante las cuentas por cobrar impagas según su antigüedad de vencimiento.
    </p>
    <div class="screenshot-card">
        <img src="{images['02']}" alt="Reporte de Deudores">
        <div class="screenshot-caption">
            <span><strong>Figura 3.1:</strong> Reporte de Deudores con filtros de mora a 1, 30, 45 y 60+ días y detalle de comprobantes.</span>
            <span>Módulo: Monitoreo / Reportes</span>
        </div>
    </div>
    <p>
        Al aplicar los filtros superiores (<strong>1 Día</strong>, <strong>30 Días</strong>, <strong>45 Días</strong> o <strong>60+ Días</strong>), la tabla recalcula el monto adeudado y expone los números exactos de e-Facturas que componen el saldo, el límite de crédito del cliente y el estado del caso en el Kanban de cobranzas.
    </p>

    <!-- CAPÍTULO 4 -->
    <div id="iso27001" class="section-header">
        <div class="section-tag">Capítulo 4</div>
        <h2>Gobernanza Perimetral ISO/IEC 27001:2022</h2>
    </div>
    <p>
        Calcu cuenta con un **agente de seguridad perimetral continuo en segundo plano** que realiza escaneos periódicos del nodo central. El estándar exige que solo los puertos indispensables estén autorizados.
    </p>
    <div class="screenshot-card">
        <img src="{images['03']}" alt="Auditoría ISO 27001">
        <div class="screenshot-caption">
            <span><strong>Figura 4.1:</strong> Registro de auditoría perimetral ISO 27001 con severidades, IPs y eventos en vivo.</span>
            <span>Módulo: Monitoreo / Auditoría</span>
        </div>
    </div>
    <div class="feature-box">
        <strong>Cumplimiento de Controles ISO 27001:</strong>
        <ul>
            <li><strong>Control A.8.15 (Registro de Eventos):</strong> Trazabilidad inmutable de toda acción con fecha, hora, usuario y dirección IP del nodo Tailscale.</li>
            <li><strong>Control A.8.16 (Monitoreo de Actividades):</strong> Detección instantánea de accesos no autorizados o aperturas de puertos anómalos.</li>
            <li><strong>Control A.8.20 y A.8.21 (Seguridad en Redes):</strong> Tráfico completamente cifrado mediante WireGuard (Tailscale) sin IPs públicas expuestas.</li>
        </ul>
    </div>

    <!-- CAPÍTULO 5 -->
    <div id="rbac" class="section-header">
        <div class="section-tag">Capítulo 5</div>
        <h2>Control de Usuarios & RBAC Granular</h2>
    </div>
    <p>
        La seguridad lógica del sistema opera bajo el principio de menor privilegio (*Least Privilege*). Los administradores pueden crear nuevos colaboradores asignándoles perfiles preestablecidos o aplicando bloqueos manuales por módulo.
    </p>
    <div class="screenshot-card">
        <img src="{images['04']}" alt="Control de Usuarios RBAC">
        <div class="screenshot-caption">
            <span><strong>Figura 5.1:</strong> Matriz de usuarios y control granular de acceso con etiquetas de módulos bloqueados.</span>
            <span>Módulo: Monitoreo / Usuarios</span>
        </div>
    </div>

    <!-- CAPÍTULO 6 -->
    <div id="cobranzas" class="section-header">
        <div class="section-tag">Capítulo 6</div>
        <h2>Cobranzas Automatizadas en 5 Etapas de Mora</h2>
    </div>
    <p>
        Para erradicar la cartera incobrable, Calcu implementa un motor automático de envejecimiento de deuda (*Aging Engine*) que clasifica las facturas a crédito impagas en 5 etapas claramente delimitadas:
    </p>
    <div class="screenshot-card">
        <img src="{images['05']}" alt="Kanban de Cobranzas">
        <div class="screenshot-caption">
            <span><strong>Figura 6.1:</strong> Tablero Kanban de Cobranzas en 5 etapas con cálculo de días de atraso y límite de crédito.</span>
            <span>Módulo: Contabilidad / Cobranzas</span>
        </div>
    </div>
    <table>
        <tr>
            <th>Etapa</th>
            <th>Vencimiento</th>
            <th>Acción Automática del Sistema</th>
        </tr>
        <tr>
            <td><strong style="color: #f59e0b;">1. Nuevo Deudor</strong></td>
            <td>1 a 29 días vencido</td>
            <td>Ingreso automático a la lista de cobranzas. Notificación preventiva al ejecutivo comercial.</td>
        </tr>
        <tr>
            <td><strong style="color: #ea580c;">2. Contactado</strong></td>
            <td>30 a 44 días vencido</td>
            <td>Pase automático al día 30. Generación de estado de cuenta para envío por correo o WhatsApp.</td>
        </tr>
        <tr>
            <td><strong style="color: #e11d48;">3. Deudor Advertido</strong></td>
            <td>45 a 59 días vencido</td>
            <td>Pase automático al día 45. Suspensión inmediata de nuevas ventas a crédito en facturación.</td>
        </tr>
        <tr>
            <td><strong style="color: #dc2626;">4. Deudor Complicado</strong></td>
            <td>60 a 62 días vencido</td>
            <td>Habilitación del botón para generar el borrador de <strong>Intimación Legal Prejudicial</strong>.</td>
        </tr>
        <tr>
            <td><strong style="color: #9333ea;">5. Moroso / Estudio Jurídico</strong></td>
            <td>63+ días vencido</td>
            <td>Pase a estudio jurídico externo para radicación de demanda ejecutiva de cobro (juicio ejecutivo).</td>
        </tr>
    </table>

    <!-- CAPÍTULO 7 -->
    <div id="intimacion" class="section-header">
        <div class="section-tag">Capítulo 7</div>
        <h2>Generador de Intimación Legal Prejudicial</h2>
    </div>
    <p>
        Al alcanzar la etapa 4 o 5, el sistema permite generar con un solo clic el documento formal de intimación prejudicial conforme a la legislación uruguaya:
    </p>
    <div class="screenshot-card">
        <img src="{images['06']}" alt="Modal Intimación Legal">
        <div class="screenshot-caption">
            <span><strong>Figura 7.1:</strong> Borrador formal de Intimación Legal Prejudicial bajo normativa CGP y Ley 14.412.</span>
            <span>Módulo: Contabilidad / Intimación Legal</span>
        </div>
    </div>
    <div class="feature-box">
        <strong>Validez Jurídica:</strong> El documento redactado automáticamente invoca los artículos 353 y siguientes del Código General del Proceso (CGP) de la República Oriental del Uruguay y el Decreto Ley 14.412, confiriéndole carácter de título ejecutivo a las facturas conformadas adeudadas e intimando el pago en un plazo perentorio de 3 días hábiles.
    </div>

    <!-- CAPÍTULO 8 -->
    <div id="contabilidad" class="section-header">
        <div class="section-tag">Capítulo 8</div>
        <h2>Libro Diario y Libro Mayor (Partida Doble Cuadrada)</h2>
    </div>
    <p>
        Toda operación realizada en el sistema (emisión de facturas, notas de crédito, pagos de clientes o registros de gastos) genera asientos contables en tiempo real bajo el principio inmutable de **Partida Doble Cuadrada** (Débito = Crédito).
    </p>
    <div class="screenshot-card">
        <img src="{images['07']}" alt="Libro Diario">
        <div class="screenshot-caption">
            <span><strong>Figura 8.1:</strong> Libro Diario con validación automática Sum(Debe) == Sum(Haber) para cada transacción.</span>
            <span>Módulo: Contabilidad / Libro Diario</span>
        </div>
    </div>
    <div class="screenshot-card">
        <img src="{images['08']}" alt="Libro Mayor por Cuenta">
        <div class="screenshot-caption">
            <span><strong>Figura 8.2:</strong> Libro Mayor General por cuentas contables (T-Accounts) con saldo neto acumulado.</span>
            <span>Módulo: Contabilidad / Libro Mayor</span>
        </div>
    </div>

    <!-- CAPÍTULO 9 -->
    <div id="fiscal" class="section-header">
        <div class="section-tag">Capítulo 9</div>
        <h2>Liquidación Fiscal DGI y BPS con Dictamen IA</h2>
    </div>
    <p>
        Calcu calcula automáticamente las obligaciones impositivas mensuales de la empresa ante la Dirección General Impositiva (DGI) y el Banco de Previsión Social (BPS) de Uruguay:
    </p>
    <div class="screenshot-card">
        <img src="{images['09']}" alt="Liquidación Fiscal DGI BPS">
        <div class="screenshot-caption">
            <span><strong>Figura 9.1:</strong> Liquidación fiscal de IVA, anticipo IRAE, aportes BPS y dictamen tributario IA.</span>
            <span>Módulo: Contabilidad / Fiscalidad</span>
        </div>
    </div>
    <ul>
        <li><strong>IVA Débito Fiscal vs. IVA Crédito Fiscal:</strong> Conciliación del IVA generado por ventas versus el crédito fiscal por compras y gastos operativos.</li>
        <li><strong>Anticipo Mensual de IRAE:</strong> Aplicación del coeficiente legal sobre la facturación neta mensual.</li>
        <li><strong>Cargas Sociales BPS:</strong> Nómina imponible, aporte patronal jubilatorio (7.5%) y FONASA patronal (5.0%).</li>
    </ul>

    <!-- CAPÍTULO 10 -->
    <div id="facturacion" class="section-header">
        <div class="section-tag">Capítulo 10</div>
        <h2>Facturación B2B (e-Facturas y Notas de Crédito DGI)</h2>
    </div>
    <p>
        Módulo diseñado para la emisión de Comprobantes Fiscales Electrónicos (CFE) bajo estándares DGI, soportando e-Facturas (111) y Notas de Crédito (112) con cálculo de IVA básico (22%) y mínimo (10%).
    </p>
    <div class="screenshot-card">
        <img src="{images['10']}" alt="Listado Facturación CFE">
        <div class="screenshot-caption">
            <span><strong>Figura 10.1:</strong> Listado general de facturación con KPIs de total facturado, IVA débito y cuentas por cobrar.</span>
            <span>Módulo: Comercial / e-Facturas</span>
        </div>
    </div>

    <!-- CAPÍTULO 11 -->
    <div id="emision" class="section-header">
        <div class="section-tag">Capítulo 11</div>
        <h2>Emisión Predictiva, Órdenes de Venta y Consumidor Final</h2>
    </div>
    <p>
        El formulario de facturación incluye capacidades avanzadas de búsqueda predictiva y control de riesgo:
    </p>
    <div class="screenshot-card">
        <img src="{images['11']}" alt="Modal de Emisión Predictiva">
        <div class="screenshot-caption">
            <span><strong>Figura 11.1:</strong> Modal de emisión con selector de Orden de Venta, autocompletado y regla de Consumidor Final.</span>
            <span>Módulo: Comercial / Emitir Factura</span>
        </div>
    </div>
    <div class="feature-box">
        <strong>Innovaciones en el Formulario de Emisión:</strong>
        <ol>
            <li><strong>Cargar desde Orden de Venta (OV):</strong> Permite seleccionar una orden aprobada en el CRM y traslada automáticamente cliente, RUT y líneas de productos.</li>
            <li><strong>Búsqueda Predictiva de Clientes (>2 letras):</strong> Búsqueda en tiempo real por RUT, Cédula de Identidad, Razón Social o Nombre de Fantasía.</li>
            <li><strong>Búsqueda Predictiva de Productos (>2 letras):</strong> Sugerencias inmediatas de SKU con precio unitario y stock real disponible.</li>
            <li><strong>Bloqueo Estricto a Consumidor Final:</strong> Si el comprobante se emite a una persona física con Cédula de Identidad (C.I.), el sistema bloquea automáticamente la opción de crédito y fuerza el cobro a Contado Inmediato, salvaguardando el flujo de caja.</li>
            <li><strong>Emisión de Notas de Crédito (CFE 112):</strong> Al seleccionar Nota de Crédito, se despliega el listado de facturas emitidas para referenciarla y revierte los saldos contables deudores.</li>
        </ol>
    </div>

    <!-- CAPÍTULO 12 -->
    <div id="tracking" class="section-header">
        <div class="section-tag">Capítulo 12</div>
        <h2>Unidad 3PL: Ruteo y Tracking GPS Satelital en Vivo</h2>
    </div>
    <p>
        La Unidad 3PL Logística cuenta con un módulo de telemetría cartográfica en tiempo real sobre tecnología Leaflet y WebSockets de latencia reducida:
    </p>
    <div class="screenshot-card">
        <img src="{images['12']}" alt="Tracking GPS 3PL">
        <div class="screenshot-caption">
            <span><strong>Figura 12.1:</strong> Mapa satelital interactivo con geolocalización en tiempo real de camiones y camionetas 3PL.</span>
            <span>Módulo: 3PL Logística / Tracking GPS</span>
        </div>
    </div>
    <p>
        Cada unidad móvil reporta periódicamente su velocidad, nivel de combustible y estado de viaje (en base, en ruta o entregado), permitiendo responder consultas de clientes sobre el horario estimado de arribo (ETA) sin llamar al conductor.
    </p>

    <!-- CAPÍTULO 13 -->
    <div id="wms" class="section-header">
        <div class="section-tag">Capítulo 13</div>
        <h2>Unidad 3PL: WMS Depósito Multi-Cliente y Códigos QR</h2>
    </div>
    <p>
        Gestión física y lógica del almacén de distribución con segregación de existencias por cuenta cliente tercerizada:
    </p>
    <div class="screenshot-card">
        <img src="{images['13']}" alt="Depósito WMS 3PL">
        <div class="screenshot-caption">
            <span><strong>Figura 13.1:</strong> WMS con control de stock multi-cliente, volumen en m³, pallets y códigos Code128/QR.</span>
            <span>Módulo: 3PL Logística / Depósito WMS</span>
        </div>
    </div>

    <!-- CAPÍTULO 14 -->
    <div id="kanban3pl" class="section-header">
        <div class="section-tag">Capítulo 14</div>
        <h2>Unidad 3PL: Kanban Operativo de Entregas y Despachos</h2>
    </div>
    <p>
        Tablero de control de tráfico y distribución de bultos organizado en 5 columnas operativas:
    </p>
    <div class="screenshot-card">
        <img src="{images['14']}" alt="Kanban Operativo 3PL">
        <div class="screenshot-caption">
            <span><strong>Figura 14.1:</strong> Kanban 3PL de flujo de pedidos: Pendiente, En Carga, En Tránsito, Entregado e Incidencia.</span>
            <span>Módulo: 3PL Logística / Kanban 3PL</span>
        </div>
    </div>

    <!-- CAPÍTULO 15 -->
    <div id="rentabilidad" class="section-header">
        <div class="section-tag">Capítulo 15</div>
        <h2>Unidad 3PL: Análisis de Rentabilidad y Costo por Kilómetro</h2>
    </div>
    <p>
        Supervisión de la rentabilidad del negocio logístico mediante el cálculo del costo real por kilómetro transportado:
    </p>
    <div class="screenshot-card">
        <img src="{images['15']}" alt="Rentabilidad 3PL">
        <div class="screenshot-caption">
            <span><strong>Figura 15.1:</strong> Panel financiero 3PL con ingresos de flete, costos de combustible y margen neto por viaje.</span>
            <span>Módulo: 3PL Logística / Rentabilidad 3PL</span>
        </div>
    </div>

    <!-- CAPÍTULO 16 -->
    <div id="supply" class="section-header">
        <div class="section-tag">Capítulo 16</div>
        <h2>Supply Chain: Control Room de Abastecimiento & DOH</h2>
    </div>
    <p>
        El corazón analítico de compras de Calcu supervisa la disponibilidad de inventario expresada en **Días de Cobertura (Days on Hand - DOH)**:
    </p>
    <div class="screenshot-card">
        <img src="{images['16']}" alt="Control Room Abastecimiento">
        <div class="screenshot-caption">
            <span><strong>Figura 16.1:</strong> Control Room con semáforo DOH (Crítico &lt;15d, Normal 15-45d, Sobrestock &gt;45d).</span>
            <span>Módulo: Supply Chain / Abastecimiento</span>
        </div>
    </div>

    <!-- CAPÍTULO 17 -->
    <div id="rop" class="section-header">
        <div class="section-tag">Capítulo 17</div>
        <h2>Supply Chain: Pipeline Kanban de Reposición (ROP)</h2>
    </div>
    <p>
        Gestión de las órdenes de importación y compras locales en 5 estadios logísticos continuos:
    </p>
    <div class="screenshot-card">
        <img src="{images['17']}" alt="Kanban ROP">
        <div class="screenshot-caption">
            <span><strong>Figura 17.1:</strong> Pipeline Kanban de reposición continua ROP desde sugerido hasta disponible.</span>
            <span>Módulo: Supply Chain / Kanban ROP</span>
        </div>
    </div>

    <!-- CAPÍTULO 18 -->
    <div id="pricing" class="section-header">
        <div class="section-tag">Capítulo 18</div>
        <h2>Comercial: Pricing Dinámico y Simulación de Canales</h2>
    </div>
    <p>
        Simulador de precios de venta mayorista y minorista con sensibilidad ante la cotización del dólar BROU:
    </p>
    <div class="screenshot-card">
        <img src="{images['18']}" alt="Pricing y Canales">
        <div class="screenshot-caption">
            <span><strong>Figura 18.1:</strong> Analítica de márgenes comerciales y matriz de descuentos por canal.</span>
            <span>Módulo: Comercial / Pricing & Canales</span>
        </div>
    </div>

    <!-- CAPÍTULO 19 -->
    <div id="licitaciones" class="section-header">
        <div class="section-tag">Capítulo 19</div>
        <h2>Licitaciones Estatales: Radar de Convocatorias ARCE / SICE</h2>
    </div>
    <p>
        Radar inteligente de compras públicas en Uruguay (ARCE y SICE) con seguimiento de competidores y cotizador de pliegos:
    </p>
    <div class="screenshot-card">
        <img src="{images['19']}" alt="Radar de Licitaciones SICE">
        <div class="screenshot-caption">
            <span><strong>Figura 19.1:</strong> Radar de convocatorias públicas con análisis de precio benchmark y viabilidad de stock.</span>
            <span>Módulo: Licitaciones / Radar SICE</span>
        </div>
    </div>

    <!-- CAPÍTULO 20 -->
    <div id="apk" class="section-header">
        <div class="section-tag">Capítulo 20</div>
        <h2>Aplicación Móvil Android (APK) y Despliegue en Terreno</h2>
    </div>
    <p>
        Para la operación en terreno de choferes de flota, operarios de depósito y supervisores de ruta, Calcu incluye un cliente móvil nativo para dispositivos Android:
    </p>
    <div class="tech-box">
        <strong>Ficha Técnica de la Aplicación Móvil:</strong>
        <ul>
            <li><strong>Archivo Binario Compilado:</strong> <code>Calcu_3PL_Mobile_v2026.apk</code> (Tamaño: 5.94 MB)</li>
            <li><strong>Identificador de Paquete:</strong> <code>com.calcu.logistics3pl</code></li>
            <li><strong>Framework Nativo:</strong> Capacitor 8 + WebSockets de baja latencia</li>
            <li><strong>Compatibilidad:</strong> Android 10.0 (API 29) hasta Android 15 (API 35)</li>
            <li><strong>Funcionalidades de Hardware:</strong> Receptor GPS continuo en segundo plano, cámara integrada para lectura de códigos QR de remitos y panel táctil para firma digital de entrega en pantalla.</li>
            <li><strong>Conexión Cifrada:</strong> Configuración automática para conectarse a la VPN Tailscale corporativa sin intervención técnica del chofer.</li>
        </ul>
    </div>

    <div class="footer-note">
        <strong>Calcu Suite Enterprise © 2026</strong> | Todos los derechos reservados.<br>
        Documento preparado para presentación ejecutiva a socios comerciales e inversores estratégicos.
    </div>

</body>
</html>
"""

    html_path = os.path.join(DOCS_DIR, "MANUAL_COMPLETO_CALCU_2026.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"  [OK] HTML generado: {html_path}")

    # Generar PDF oficial mediante Playwright Headless
    pdf_path = os.path.join(DOCS_DIR, "MANUAL_COMPLETO_CALCU_2026.pdf")
    print("  Renderizando PDF con Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        page.goto(f"file:///{html_path.replace(os.sep, '/')}")
        page.wait_for_timeout(2000)
        page.pdf(
            path=pdf_path,
            format="A4",
            print_background=True,
            margin={"top": "1.5cm", "bottom": "1.5cm", "left": "1.2cm", "right": "1.2cm"}
        )
        browser.close()
    print(f"  [OK] PDF generado con exito: {pdf_path}")

if __name__ == '__main__':
    main()
