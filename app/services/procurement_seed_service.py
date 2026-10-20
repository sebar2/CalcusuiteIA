"""
Servicio de Semillero e Indexación Profunda de Licitaciones Estatales OCDS (Calcu Bidding Suite).
Garantiza que calcu.db cuente con registros OCDS hidratados para las 7 verticales comerciales:
  - Objeto de contratación completo
  - Ítems solicitados con código SICE, descripción, cantidad y unidad
  - URLs oficiales al pliego web ARCE y al PDF descargable
  - Semáforos financieros de pago (DSO SIIF) y rigor numérico en Decimal.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.entities import ProcurementIndexedCall

logger = logging.getLogger(__name__)

SEEDED_CALLS: List[Dict[str, Any]] = [
    # 1. ILUMINACIÓN & EFICIENCIA ENERGÉTICA
    {
        "id": "1378101",
        "compra_id": "1378101",
        "ocid": "ocds-arce-1378101",
        "titulo": "Suministro e instalación de artefactos de iluminación LED y campanas industriales",
        "organismo": "UTE - Administración Nacional de Usinas y Trasmisiones Eléctricas",
        "objeto_contratacion": "Adquisición de 250 luminarias LED viales con driver DALI-2 y campanas industriales high bay 150W IP65 para subestaciones y plantas de distribución de UTE.",
        "vertical_id": "ILUMINACION_EFICIENCIA",
        "tipo_compra": "Licitación Abreviada",
        "fecha_apertura": date.today() + timedelta(days=12),
        "fecha_cierre": date.today() + timedelta(days=25),
        "monto_estimado": Decimal("1850000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 35,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378101",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378101.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "LUM-6060",
                "descripcion": "Panel LED 60x60 40W 4000K UGR<19",
                "cantidad": 120,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Driver DALI-2 regulable, factor de potencia >0.96, vida útil L70 50.000h, marco aluminio blanco, norma UNIT 180."
            },
            {
                "codigo_sice": "UFO-150W",
                "descripcion": "Campana Industrial LED High Bay 150W IP65",
                "cantidad": 60,
                "unidad_medida": "UNIDAD",
                "especificaciones": "150W, 140 lm/W, lente policarbonato 90°, disipador aluminio fundido, protección DPS 10kV, vida útil L70 60.000h."
            },
            {
                "codigo_sice": "PRY-100W",
                "descripcion": "Proyector LED Exterior 100W Full Cutoff IP66",
                "cantidad": 40,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Óptica asimétrica vial Tipo II, vidrio templado 4mm, IK08, protección contra sobretensión transitoria."
            }
        ]
    },
    # 2. MOBILIARIO CORPORATIVO & EQUIPAMIENTO
    {
        "id": "1378202",
        "compra_id": "1378202",
        "ocid": "ocds-arce-1378202",
        "titulo": "Renovación de sillería ergonómica operativa, escritorios y armarios modulares",
        "organismo": "BROU - Banco de la República Oriental del Uruguay",
        "objeto_contratacion": "Suministro de puestos de trabajo ejecutivos, sillas operativas con mecanismo sincro y armarios metálicos monobloque para sucursales bancarias.",
        "vertical_id": "MOBILIARIO_EQUIPAMIENTO",
        "tipo_compra": "Licitación Pública",
        "fecha_apertura": date.today() + timedelta(days=8),
        "fecha_cierre": date.today() + timedelta(days=22),
        "monto_estimado": Decimal("2450000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 30,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378202",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378202.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "MOB-SIL-01",
                "descripcion": "Silla Operativa Ergonómica con Apoyacabeza",
                "cantidad": 80,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Norma UNE-EN 1335, mecanismo sincro 4 posiciones, apoyo lumbar regulable, espuma inyectada 50kg/m3, tela mesh ignífuga."
            },
            {
                "codigo_sice": "MOB-ESC-02",
                "descripcion": "Puesto de Trabajo 140x70 melamínico 25mm con pasacables",
                "cantidad": 45,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Tapa melamínica 25mm canto ABS 2mm, pasacables metálico, estructura patas cerradas en chapa de acero pintura epoxi."
            },
            {
                "codigo_sice": "MOB-ARM-03",
                "descripcion": "Armario Metálico 2 puertas batientes con cerradura de falleba",
                "cantidad": 30,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Chapa de acero plegada calibre 22, 4 estantes regulables reforzados, cerradura con llave articulada plegable."
            }
        ]
    },
    # 3. EQUIPAMIENTO MÉDICO & HOSPITALARIO
    {
        "id": "1378303",
        "compra_id": "1378303",
        "ocid": "ocds-arce-1378303",
        "titulo": "Adquisición de equipamiento clínico, camillas de traslado y biombos",
        "organismo": "ASSE - Administración de los Servicios de Salud del Estado",
        "objeto_contratacion": "Adquisición de camillas de traslado hidráulicas con barandas de seguridad, negatoscopios LED y biombos clínicos para hospitales del interior.",
        "vertical_id": "EQUIPAMIENTO_HOSPITALARIO",
        "tipo_compra": "Licitación Abreviada",
        "fecha_apertura": date.today() + timedelta(days=6),
        "fecha_cierre": date.today() + timedelta(days=18),
        "monto_estimado": Decimal("1620000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 65,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378303",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378303.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "MED-CAM-01",
                "descripcion": "Camilla de Traslado Hidráulica con Barandas Rebatibles",
                "cantidad": 25,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Estructura acero esmaltado epoxi, ruedas 150mm con freno centralizado, colchoneta viscoelástica impermeable, registro MSP."
            },
            {
                "codigo_sice": "MED-NEG-02",
                "descripcion": "Negatoscopio LED Doble Campo Extra Delgado",
                "cantidad": 35,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Iluminación LED uniforme 4000 lux, sensor de presencia, encendido automático por inserción de radiografía, IEC 60601."
            },
            {
                "codigo_sice": "MED-BIO-03",
                "descripcion": "Biombo Clínico de 3 Cuerpos Plegable en Ruedas",
                "cantidad": 40,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Estructura tubular cromada, cortinas vinílicas lavables ignífugas y antibacterianas, ruedas dobles giratorias."
            }
        ]
    },
    # 4. OBRA CIVIL & CONSTRUCCIÓN
    {
        "id": "1378404",
        "compra_id": "1378404",
        "ocid": "ocds-arce-1378404",
        "titulo": "Refacción edilicia, tabiquería en placa de yeso y cielorrasos desmontables",
        "organismo": "Intendencia de Canelones - Dirección General de Obras",
        "objeto_contratacion": "Suministro e instalación de tabiques divisorios en drywall, cielorrasos de fibra mineral y pintura para centros cívicos departamentales.",
        "vertical_id": "OBRA_CIVIL_CONSTRUCCION",
        "tipo_compra": "Licitación Pública",
        "fecha_apertura": date.today() + timedelta(days=15),
        "fecha_cierre": date.today() + timedelta(days=30),
        "monto_estimado": Decimal("3100000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 85,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378404",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378404.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "OBR-TAB-01",
                "descripcion": "Tabique Drywall Doble Placa de Yeso 12.5mm con Lana de Vidrio",
                "cantidad": 450,
                "unidad_medida": "M2",
                "especificaciones": "Perfiles soleras y montantes 70mm acero galvanizado Z275, aislación acústica con lana mineral, masillado y encintado."
            },
            {
                "codigo_sice": "OBR-CIE-02",
                "descripcion": "Cielorraso Desmontable 60x60 Fibra Mineral",
                "cantidad": 300,
                "unidad_medida": "M2",
                "especificaciones": "Perfilería vista esmaltada blanca prepintada T15, placas texturadas con absorción acústica NRC 0.65, UNIT."
            },
            {
                "codigo_sice": "OBR-PIN-03",
                "descripcion": "Pintura Látex Lavable para Interiores",
                "cantidad": 60,
                "unidad_medida": "BALDE 20L",
                "especificaciones": "Látex acrílico antihongo alta cobertura blanco mate, resistencia al frote húmedo > 5000 ciclos."
            }
        ]
    },
    # 5. SUMINISTROS ELECTROMECÁNICOS
    {
        "id": "1378505",
        "compra_id": "1378505",
        "ocid": "ocds-arce-1378505",
        "titulo": "Suministro de llaves termomagnéticas industriales y gabinetes estancos IP66",
        "organismo": "ANTEL - Administración Nacional de Telecomunicaciones",
        "objeto_contratacion": "Adquisición de protecciones termomagnéticas tripolares 10kA y gabinetes metálicos estancos IP66 para centros de datos y shelters.",
        "vertical_id": "ELECTROMECANICA_SUMINISTROS",
        "tipo_compra": "Compra Directa",
        "fecha_apertura": date.today() + timedelta(days=5),
        "fecha_cierre": date.today() + timedelta(days=14),
        "monto_estimado": Decimal("980000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 32,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378505",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378505.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "ELC-DIS-01",
                "descripcion": "Interruptor Termomagnético 3x63A Curva C 10kA",
                "cantidad": 120,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Norma IEC 60947-2, poder de corte 10kA en 400V, fijación riel DIN simétrico 35mm, terminales para cable 25mm2."
            },
            {
                "codigo_sice": "ELC-TAB-02",
                "descripcion": "Gabinete Metálico Estanco IP66 800x600x250",
                "cantidad": 30,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Chapa acero 1.5mm plegada, platina de montaje zincada, cerradura doble paleta, pintura epoxi RAL 7035."
            }
        ]
    },
    # 6. TECNOLOGÍA, REDES & NETWORKING
    {
        "id": "1378606",
        "compra_id": "1378606",
        "ocid": "ocds-arce-1378606",
        "titulo": "Adquisición de Racks 42U, Patch Panels Cat6A y Bobinas de Fibra Óptica",
        "organismo": "BPS - Banco de Previsión Social",
        "objeto_contratacion": "Renovación de cableado estructurado e infraestructura de networking en edificios centrales del BPS.",
        "vertical_id": "TECNOLOGIA_REDES",
        "tipo_compra": "Concurso de Precios",
        "fecha_apertura": date.today() + timedelta(days=9),
        "fecha_cierre": date.today() + timedelta(days=21),
        "monto_estimado": Decimal("1420000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 42,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378606",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378606.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "RED-RCK-01",
                "descripcion": "Rack de Comunicaciones 42U 800x1000",
                "cantidad": 12,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Puerta frontal y trasera microperforada 80%, guías 19 pulgadas numeradas, organizadores verticales, kit 4 ventiladores."
            },
            {
                "codigo_sice": "RED-PAT-02",
                "descripcion": "Patch Panel 24 Puertos Cat6A Blindado F/UTP 1U",
                "cantidad": 40,
                "unidad_medida": "UNIDAD",
                "especificaciones": "Certificación ANSI/TIA-568-C.2 Categoría 6A componente homologado Fluke, incluye barra trasera organizadora."
            },
            {
                "codigo_sice": "RED-FIB-03",
                "descripcion": "Bobina Fibra Óptica Monomodo 12 Hilos 1000m",
                "cantidad": 8,
                "unidad_medida": "BOBINA",
                "especificaciones": "Cubierta LSZH autoextinguible para exterior/interior, estándar G.652D, dieléctrica anti-roedor."
            }
        ]
    },
    # 7. SERVICIOS & MANTENIMIENTO INTEGRAL
    {
        "id": "1378707",
        "compra_id": "1378707",
        "ocid": "ocds-arce-1378707",
        "titulo": "Servicio mensual integral de higiene, limpieza y desinfección edilicia",
        "organismo": "Ministerio de Transporte y Obras Públicas (MTOP)",
        "objeto_contratacion": "Contratación de empresa de limpieza y desinfección integral con provisión de insumos y maquinaria para sede central del MTOP.",
        "vertical_id": "SERVICIOS_LIMPIEZA_MANTENIMIENTO",
        "tipo_compra": "Licitación Abreviada",
        "fecha_apertura": date.today() + timedelta(days=11),
        "fecha_cierre": date.today() + timedelta(days=26),
        "monto_estimado": Decimal("2100000.0000"),
        "moneda": "UYU",
        "status": "ACTIVE",
        "dso_estimado_dias": 62,
        "url_pliego_arce": "https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/id/1378707",
        "url_pliego_pdf": "https://www.comprasestatales.gub.uy/Pliegos/pedido_1378707.pdf",
        "items_solicitados": [
            {
                "codigo_sice": "SRV-LMP-01",
                "descripcion": "Servicio Mensual de Limpieza Edilicia 2500m2",
                "cantidad": 12,
                "unidad_medida": "MES",
                "especificaciones": "Dotación fija de 8 operarios con EPP certificado, productos ecológicos biodegradables, Decreto 406/988."
            },
            {
                "codigo_sice": "SRV-VID-02",
                "descripcion": "Limpieza en Altura de Fachadas Vidriadas y Muros Cortina",
                "cantidad": 4,
                "unidad_medida": "SERVICIO",
                "especificaciones": "Personal certificado para trabajo en altura con arnés de seguridad, línea de vida y seguro BSE contra accidentes."
            }
        ]
    }
]


def ensure_procurement_indexed_calls_seeded(db: Session) -> int:
    """
    Verifica que la base de datos contenga las convocatorias de las 7 verticales.
    Si faltan o no existen, las inserta o actualiza de forma idempotente.
    """
    seeded_count = 0
    now = datetime.now(timezone.utc)

    for item in SEEDED_CALLS:
        cid = item["compra_id"]
        existing = db.query(ProcurementIndexedCall).filter(ProcurementIndexedCall.compra_id == cid).first()
        if not existing:
            new_call = ProcurementIndexedCall(
                id=cid,
                compra_id=cid,
                ocid=item["ocid"],
                titulo=item["titulo"],
                organismo=item["organismo"],
                objeto_contratacion=item["objeto_contratacion"],
                vertical_id=item["vertical_id"],
                tipo_compra=item["tipo_compra"],
                fecha_apertura=item["fecha_apertura"],
                fecha_cierre=item["fecha_cierre"],
                monto_estimado=item["monto_estimado"],
                moneda=item["moneda"],
                status=item["status"],
                dso_estimado_dias=item["dso_estimado_dias"],
                url_pliego_arce=item["url_pliego_arce"],
                url_pliego_pdf=item["url_pliego_pdf"],
                items_solicitados=item["items_solicitados"],
                last_synced_at=now,
            )
            db.add(new_call)
            seeded_count += 1
        else:
            # Mantener actualizados los items solicitados y urls
            existing.objeto_contratacion = item["objeto_contratacion"]
            existing.items_solicitados = item["items_solicitados"]
            existing.url_pliego_arce = item["url_pliego_arce"]
            existing.url_pliego_pdf = item["url_pliego_pdf"]
            existing.dso_estimado_dias = item["dso_estimado_dias"]
            existing.last_synced_at = now

    if seeded_count > 0:
        db.commit()
        logger.info("Se indexaron %d convocatorias de referencia en calcu.db", seeded_count)

    return seeded_count
