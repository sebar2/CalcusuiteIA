import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.pdfgen import canvas
from PIL import Image as PILImage

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        if self._pageNumber == 1:
            return  # Portada sin pie de página
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header
        self.drawString(54, 755, "CALCU PLATAFORMA INTEGRAL | MANUAL DE USUARIO & ARQUITECTURA")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 747, 558, 747)
        
        # Footer
        text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(558, 36, text)
        self.drawString(54, 36, "Confidencial - Uso Interno Operativo")
        self.line(54, 48, 558, 48)
        self.restoreState()

def build_pdf():
    pdf_filename = "MANUAL_DE_USUARIO_CALCU_3PL.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Colores
    c_primary = colors.HexColor("#003366")
    c_secondary = colors.HexColor("#0088CC")
    c_dark = colors.HexColor("#1E293B")
    c_muted = colors.HexColor("#64748B")
    c_bg_callout = colors.HexColor("#F1F5F9")
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=c_primary,
        spaceAfter=8
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=c_secondary,
        spaceAfter=15
    )
    
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_muted,
        spaceAfter=20
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=c_primary,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=c_secondary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        spaceAfter=6
    )
    
    bold_lead_style = ParagraphStyle(
        'BoldLead_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        spaceAfter=6
    )
    
    caption_style = ParagraphStyle(
        'Caption_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=10,
        textColor=c_muted,
        alignment=1, # Center
        spaceBefore=3,
        spaceAfter=10
    )
    
    callout_style = ParagraphStyle(
        'Callout_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_dark
    )
    
    th_style = ParagraphStyle(
        'TH_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )
    
    td_style = ParagraphStyle(
        'TD_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=c_dark
    )
    
    td_bold_style = ParagraphStyle(
        'TDBold_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=c_primary
    )
    
    story = []
    
    def make_callout(text, title="NOTA"):
        content = [
            Paragraph(f"<b><font color='#0088CC'>[{title}]</font></b> {text}", callout_style)
        ]
        t = Table([[content]], colWidths=[504])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c_bg_callout),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('LINELEFT', (0,0), (0,0), 3.0, c_secondary),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        return t

    def get_image_flowable(filename, caption, max_width=490, max_height=260):
        path = os.path.join('docs', 'screenshots', filename)
        if not os.path.exists(path):
            return None
        
        # Calculate aspect ratio with PIL
        with PILImage.open(path) as im:
            orig_w, orig_h = im.size
            
        ratio = orig_w / float(orig_h)
        target_w = max_width
        target_h = target_w / ratio
        
        if target_h > max_height:
            target_h = max_height
            target_w = target_h * ratio
            
        img = Image(path, width=target_w, height=target_h)
        cap = Paragraph(f"Figura: {caption}", caption_style)
        return KeepTogether([img, cap])

    # ==================== PORTADA ====================
    story.append(Spacer(1, 40))
    story.append(Paragraph("CALCU | PLATAFORMA INTEGRAL", title_style))
    story.append(Paragraph("Manual de Arquitectura, Módulos Operativos, Analítica Financiera (FP&A), Licitaciones B2B y 3PL Logística", subtitle_style))
    
    story.append(make_callout(
        "Este documento describe de manera exhaustiva el funcionamiento de todos los dominios de la plataforma Calcu, su modelo de co-liderazgo por agentes de software, su infraestructura móvil sobre VPN Tailscale y la unidad de negocio desacoplada de Logística & Distribución 3PL.",
        title="DOCUMENTO OFICIAL DE ARQUITECTURA & USUARIO"
    ))
    story.append(Spacer(1, 14))
    story.append(Paragraph("Versión: 2.5 Enterprise  |  Entorno: Python FastAPI + React 19 + Android 15 Capacitor  |  Fecha: Octubre 2026", meta_style))
    story.append(PageBreak())

    # ==================== SECCIÓN 1: INTRODUCCIÓN Y AGENTES ====================
    story.append(Paragraph("1. Visión General & Ecosistema de Agentes", h1_style))
    story.append(Paragraph("CALCU es un sistema operativo empresarial unificado que fusiona el control de abastecimiento ROP, la inteligencia de licitaciones públicas (SICE), el control presupuestario de gestión (FP&A) y la unidad desacoplada de logística tercerizada (3PL).", body_style))
    
    story.append(Paragraph("Co-Liderazgo Bicefálico & Subagentes Especializados", h2_style))
    story.append(Paragraph("<b>Estructura de Gobernanza:</b> La evolución arquitectónica y operativa de la suite está dirigida por dos inteligencias rectoras y un ecosistema de agentes satélite:", bold_lead_style))
    
    agents_data = [
        ("Superagente Técnico (CTO)", "Arquitectura Core & Seguridad", "Gobernanza de endpoints, modelos ORM, base de datos y APK."),
        ("Superagente Comercial (CSO/COO)", "Estrategia & Rentabilidad", "Definición de pricing, márgenes B2B, licitaciones y EBITDA."),
        ("data-architect", "Modelado Relacional", "Esquemas SQLAlchemy, migraciones y tipos numéricos de alta precisión."),
        ("domain-engine", "Algoritmos Matemáticos", "Fórmulas puras de ROP, stock de seguridad, EOQ y cubicaje."),
        ("backend-services", "Servicios REST & RBAC", "Rutas FastAPI, control de tokens JWT y permisos por rol (403)."),
        ("ui-engineer", "Experiencia de Usuario", "Componentes React 19, mapas interactivos Leaflet y Tailwind."),
        ("wms-architect", "Almacenaje & Rótulos", "Gestión de racks multi-cliente y generación de rótulos Code128 / QR."),
        ("fleet-dispatch", "Ruteo & Telemetría", "Capacidad cúbica de fletes, cálculo de km y tracking GPS móvil."),
        ("performance-analyst", "FP&A y Finanzas", "Variance presupuestario, cálculo de VAN/TIR y márgenes de reparto.")
    ]
    
    table_rows = [
        [Paragraph("Agente / Rol", th_style), Paragraph("Especialidad", th_style), Paragraph("Dominio de Acción", th_style)]
    ]
    for name, esp, dom in agents_data:
        table_rows.append([
            Paragraph(name, td_bold_style),
            Paragraph(esp, td_style),
            Paragraph(dom, td_style)
        ])
    
    t_agents = Table(table_rows, colWidths=[130, 130, 244])
    t_agents.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t_agents)
    story.append(Spacer(1, 10))

    # ==================== SECCIÓN 2: ACCESO Y SEGURIDAD ====================
    story.append(Paragraph("2. Autenticación, Conectividad VPN y Multi-Rol (RBAC)", h1_style))
    story.append(Paragraph("La plataforma cuenta con un portal unificado de autenticación con selector de modo (Suite Corporativa o 3PL Logística) y botones de acceso rápido demo de 1-clic con credenciales aseguradas con JWT SHA-256.", body_style))
    
    img_flow = get_image_flowable("01_login_3pl.png", "Portal de Acceso - Modo 3PL Logística con conexión Tailscale VPN")
    if img_flow: story.append(img_flow)
    
    img_flow = get_image_flowable("02_login_suite.png", "Portal de Acceso - Modo Suite Calcu Corporativa")
    if img_flow: story.append(img_flow)
    
    story.append(make_callout(
        "Para conectar dispositivos móviles en calle (Android) con el servidor central de forma segura y sin exponer puertos públicos, la plataforma utiliza la red privada de malla Tailscale VPN (nodo 100.119.40.92 en puerto :8000 para API y :5173 para Web).",
        title="CONECTIVIDAD TAILSCALE VPN"
    ))
    story.append(PageBreak())

    # ==================== SECCIÓN 3: SUITE CORPORATIVA ====================
    story.append(Paragraph("3. Módulos de la Suite Corporativa Calcu", h1_style))
    
    story.append(Paragraph("3.1. Sala de Control (Control Room) & Algoritmo ROP", h2_style))
    story.append(Paragraph("El Control Room es el centro neurálgico de la cadena de suministro. Monitorea en tiempo real el capital inmovilizado, días de cobertura de inventario y calcula de forma dinámica el Punto de Reorden (ROP):", body_style))
    story.append(Paragraph("<b>Fórmula ROP:</b> ROP = (Demanda Diaria Promedio × Lead Time en Días) + Stock de Seguridad", bold_lead_style))
    img_flow = get_image_flowable("10_control_room.png", "Tablero de Control Room con KPIs de Salud de Inventario y Alertas ROP")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("3.2. Stock Multi-Depósito & Trazabilidad de Baches", h2_style))
    story.append(Paragraph("Permite la administración simultánea de múltiples almacenes físicos, transferencias entre depósitos y trazabilidad de lotes con fechas de ingreso y vencimiento.", body_style))
    img_flow = get_image_flowable("12_multi_stock.png", "Gestión de Ubicaciones Físicas y Trazabilidad Multi-Depósito")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("3.3. Finanzas Corporativas & Control Presupuestario (FP&A)", h2_style))
    story.append(Paragraph("Módulo de Variance Analysis que compara el presupuesto aprobado contra la ejecución real, imputando gastos por centros de costos (OPEX) y evaluando nuevos proyectos de capital (CAPEX) mediante VAN y TIR.", body_style))
    img_flow = get_image_flowable("14_budget_variance.png", "Control Presupuestario de Gastos y Análisis de Desvíos FP&A")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("3.4. Pipeline Comercial (CRM B2B)", h2_style))
    story.append(Paragraph("Seguimiento visual de oportunidades corporativas por etapas de negociación, vinculadas a la ficha técnica de clientes y presupuestos asignados.", body_style))
    img_flow = get_image_flowable("15_commercial_crm.png", "Pipeline Comercial Kanban B2B")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("3.5. Radar de Licitaciones & Compras Estatales (SICE)", h2_style))
    story.append(Paragraph("Captura llamados abiertos de compras públicas del Estado uruguayo, analizando precios de adjudicación histórica de competidores y evaluando pliegos con el motor de Inteligencia Artificial.", body_style))
    img_flow = get_image_flowable("16_tenders_radar.png", "Radar Inteligente de Compras Públicas y Licitaciones Estatales")
    if img_flow: story.append(img_flow)
    story.append(PageBreak())

    # ==================== SECCIÓN 4: UNIDAD 3PL ====================
    story.append(Paragraph("4. Unidad Desacoplada: 3PL Logística & Distribución", h1_style))
    story.append(Paragraph("Esta unidad de negocio opera como operador logístico independiente para la custodia y distribución capilar de mercadería de terceros (supermercados y PyMEs clientes), cobrando por servicios de almacenaje, manipulación y fletes.", body_style))
    
    story.append(Paragraph("4.1. Directorio de Clientes 3PL & Matriz Tarifaria", h2_style))
    story.append(Paragraph("Permite registrar empresas clientes con múltiples sucursales de entrega y definir contratos con tarifas personalizadas de almacenaje ($/pallet/día), manipulación ($/bulto handling), acondicionamiento ($/unidad VAS) y fletes ($ base + $/km).", body_style))
    img_flow = get_image_flowable("06_logistics_clients.png", "Directorio Maestro de Clientes 3PL y Tarifas Acordadas")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("4.2. Flota de Vehículos y Personal Tercerizado", h2_style))
    story.append(Paragraph("Ficha de conductores fleteros y operarios de depósito. Cada vehículo cuenta con su cubicaje volumétrico (m³), capacidad de carga (kg) y capacidad de pallets estandarizados.", body_style))
    img_flow = get_image_flowable("07_logistics_fleet.png", "Administración de Flota, Capacidad Volumétrica y Choferes")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("4.3. Depósito WMS Multi-Cliente & Generador de Rótulos Limpios", h2_style))
    story.append(Paragraph("Gestión de stock en custodia segregado por cliente. Permite el armado de pedidos por Picking Parcial con descuento automático de stock, y genera rótulos PDF con Código de Barras Code128 y Código QR 2D con zonas de quietud separadas para lectura óptica 100% libre de interferencias.", body_style))
    img_flow = get_image_flowable("04_logistics_inventory.png", "Inventario en Custodia WMS y Configuración del HUB Central")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("4.4. Kanban Operativo de 5 Estadios Logísticos", h2_style))
    story.append(Paragraph("Flujo de trabajo para coordinar el pedido: 1. Ingreso & Descarga → 2. Acondicionamiento / Etiquetado → 3. Listo para Despacho → 4. En Distribución → 5. Entregado con Conformidad. Al asignar el transporte, el motor valida que no se supere el 100% de la capacidad de peso ni de volumen del vehículo.", body_style))
    img_flow = get_image_flowable("03_logistics_kanban.png", "Tablero Kanban Operativo 3PL con Validación de Carga")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("4.5. Tracking GPS en Vivo & HUB Central en Mapa Satelital", h2_style))
    story.append(Paragraph("Visualizador cartográfico sobre Leaflet (OpenStreetMap y Esri Satellite) que ubica el Centro de Distribución Base (HUB 3PL), las unidades de transporte en ruta y las polilíneas de despacho, alimentado por la telemetría en tiempo real transmitida desde el celular del chofer.", body_style))
    img_flow = get_image_flowable("05_logistics_tracking.png", "Mapa Satelital con HUB Base 3PL y Unidades en Tránsito")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("4.6. Órdenes de Servicio Logístico & Remitos Oficiales", h2_style))
    story.append(Paragraph("Generación e impresión de remitos de entrega oficiales con código QR y casillero legal para la firma digital del receptor.", body_style))
    img_flow = get_image_flowable("08_logistics_orders.png", "Historial de Órdenes de Servicio y Remitos con Firma Digital")
    if img_flow: story.append(img_flow)
    
    story.append(Paragraph("4.7. Costos Fijos, Variables & Rentabilidad EBITDA 3PL", h2_style))
    story.append(Paragraph("Liquidación automatizada de los servicios facturados al cliente, liquidación de pagos a fleteros por viaje y kilómetro, registro de costos fijos (alquiler de depósito sincronizado con el Hub, luz) y variables (toner, stretch), generando el Estado de Resultados Operativo (EBITDA). Este módulo está estrictamente bloqueado para operarios y choferes.", body_style))
    img_flow = get_image_flowable("09_logistics_finance.png", "Métricas de Rentabilidad EBITDA y Liquidaciones de Flete 3PL")
    if img_flow: story.append(img_flow)
    story.append(PageBreak())

    # ==================== SECCIÓN 5: DESPLIEGUE Y MÓVIL ====================
    story.append(Paragraph("5. Despliegue, App Móvil Nativa (APK) y Conectividad", h1_style))
    story.append(Paragraph("La plataforma cuenta con una solución integral de despliegue para escritorio y dispositivos móviles:", body_style))
    
    deploy_rows = [
        ("Lanzador 1-Clic Windows", "start_3pl_logistics.bat", "Inicia Backend FastAPI (:8000) y Frontend Vite (:5173) en 0.0.0.0, detecta IPs de Tailscale y abre el navegador en modo 3PL."),
        ("Habilitador Firewall", "abrir_puertos_firewall.bat", "Configura las reglas de entrada en el Firewall de Windows para los puertos 8000 y 5173 permitiendo el acceso del celular."),
        ("App Móvil Nativa Android", "Calcu3PL-Logistica.apk", "APK nativa compilada con Capacitor y OpenJDK 21 para Android 15. Permite a choferes ver sus órdenes, transmitir GPS y capturar firmas."),
        ("Compilador de APK", "build_apk.bat", "Compila automáticamente el código TypeScript/React y regenera el APK nativo en segundos.")
    ]
    
    deploy_table_rows = [
        [Paragraph("Herramienta", th_style), Paragraph("Archivo", th_style), Paragraph("Descripción Técnica", th_style)]
    ]
    for col1, col2, col3 in deploy_rows:
        deploy_table_rows.append([
            Paragraph(col1, td_bold_style),
            Paragraph(f"<code>{col2}</code>", td_style),
            Paragraph(col3, td_style)
        ])
        
    t_deploy = Table(deploy_table_rows, colWidths=[120, 130, 254])
    t_deploy.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(t_deploy)
    story.append(Spacer(1, 14))
    
    story.append(make_callout(
        "El sistema se encuentra 100% operativo tanto para uso en escritorio local como para distribución móvil en campo a través de la red VPN privada Tailscale.",
        title="ESTADO OPERATIVO DEL SISTEMA"
    ))
    
    # Construir documento con NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[OK] Documento PDF generado exitosamente: {pdf_filename}")

if __name__ == '__main__':
    build_pdf()
