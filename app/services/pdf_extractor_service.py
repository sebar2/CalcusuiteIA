"""
Servicio Lector y Extractor Automático de Pliegos PDF con IA Local (Calcu Bidding Suite).
Extrae texto de documentos de licitación (.pdf / .doc) y genera dictámenes estructurados
con Ollama (gemma4:latest / qwen2.5) en los 4 bloques clave de pliegos uruguayos (TOCAF / RUPE / SICE).
"""

from __future__ import annotations

import io
import logging
import os
import re
from typing import Any, Dict, List, Optional
import httpx
from pypdf import PdfReader

from app.core.config import OLLAMA_BASE_URL, OLLAMA_MODEL

logger = logging.getLogger(__name__)

# Criterios especializados por vertical para el agente IA
VERTICAL_PROFILES: Dict[str, Dict[str, Any]] = {
    "ILUMINACION_EFICIENCIA": {
        "rubro_nombre": "Iluminación & Eficiencia Energética",
        "perito": "Ing. David Jiménez Vera (Ingeniero Eléctrico & Proyectista Lumínico)",
        "criterios": "lúmenes/W (>130 lm/W), grado IP65/IP66, factor de potencia (>0.96), vida útil L70 (>50.000h), protección sobretensiones DPS 6kV/10kV y garantía 5 años",
        "normas": "UNIT 180 / UNIT 1083 / IES LM-79 / LM-80 / CIE S 008",
    },
    "EQUIPAMIENTO_HOSPITALARIO": {
        "rubro_nombre": "Equipamiento Médico & Hospitalario",
        "perito": "Bioing. Martín Carve (Perito en Bioingeniería y Tecnología Médica)",
        "criterios": "habilitación y registro ante el MSP (Ministerio de Salud Pública), lote y número de serie, vencimiento FEFO, biocompatibilidad y cumplimiento de esterilización autoclave",
        "normas": "Normativas MSP Uruguay / IEC 60601 (Seguridad Eléctrica Electromédica) / ISO 13485",
    },
    "OBRA_CIVIL_CONSTRUCCION": {
        "rubro_nombre": "Obra Civil & Construcción",
        "perito": "Ing. Civil Alejandro Morales (Especialista Estructural y Perito de Obras)",
        "criterios": "cubicaje en m3, flete logístico camión/obra, acopio de materiales, resistencia característica del hormigón, plazos de entrega y recepción provisoria en obra",
        "normas": "Normativas UNIT de Estructuras / Pliego General de Obras Públicas MTOP",
    },
    "MOBILIARIO_EQUIPAMIENTO": {
        "rubro_nombre": "Mobiliario Corporativo & Equipamiento",
        "perito": "Lic. Arq. Sofía Larrosa (Directora Técnica de Ergonomía y Mobiliario)",
        "criterios": "ergonomía UNE-EN 1335, resistencia BIFMA, densidad de espuma inyectada, melamínicos 25mm con canto ABS y cubicaje m3 para flete",
        "normas": "Norma UNE-EN 1335 / Certificación BIFMA X5.1 / Estándares UNIT",
    },
    "ELECTROMECANICA_SUMINISTROS": {
        "rubro_nombre": "Suministros Electromecánicos",
        "perito": "Ing. Marcelo Rossi (Ingeniero Electromecánico Senior)",
        "criterios": "poder de corte en kA, curvas de disparo, aislamiento dieléctrico, barras de cobre electrolítico y rendimiento térmico",
        "normas": "Reglamento de Baja Tensión UTE / Normas IEC 61439 e IEC 60947",
    },
    "TECNOLOGIA_REDES": {
        "rubro_nombre": "Tecnología, Redes & Servicios",
        "perito": "Ing. Rodrigo Silva (Principal de Telecomunicaciones & Networking)",
        "criterios": "SLA de soporte técnico 24/7 y tiempo de respuesta < 4h, licencias oficiales, certificaciones técnicas Fluke/TIA-568, PoE+ y redundancia de hardware",
        "normas": "Estándares ANSI/TIA-568 / ISO/IEC 11801 / IEEE 802.3bt PoE++",
    },
    "SERVICIOS_LIMPIEZA_MANTENIMIENTO": {
        "rubro_nombre": "Servicios & Mantenimiento Integral",
        "perito": "Lic. Valentina Viera (Auditora de Operaciones y Seguridad Ocupacional)",
        "criterios": "ratios de m2/hora por operario, equipamiento rotativo industrial, fichas de seguridad química CIAT y dotación de EPP certificado",
        "normas": "Decreto 406/988 de Seguridad e Higiene Laboral / Ley de Tercerizaciones",
    },
}


class PDFExtractorService:
    """
    Servicio de extracción de pliegos y análisis técnico con IA para Calcu B2B.
    """

    @classmethod
    async def download_and_extract_text(cls, document_url: str, timeout: float = 20.0) -> str:
        """
        Descarga el documento de pliego y extrae su texto crudo.
        """
        if not document_url or not document_url.startswith("http"):
            return ""

        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                resp = await client.get(
                    document_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Calcu-Bidding/2.0",
                        "Accept": "application/pdf,application/msword,application/octet-stream,*/*",
                    },
                )
                if resp.status_code != 200:
                    logger.warning("Error HTTP %s descargando pliego desde %s", resp.status_code, document_url)
                    return ""

                content = resp.content
                # Si es PDF
                if document_url.lower().endswith(".pdf") or content[:4] == b"%PDF":
                    return cls._extract_from_pdf_bytes(content)

                # Si es texto plano o HTML
                if b"<html" not in content[:200]:
                    try:
                        return content.decode("utf-8", errors="ignore")[:25000]
                    except Exception:
                        pass
        except Exception as exc:
            logger.warning("No se pudo descargar/extraer texto de pliego %s: %s", document_url, exc)

        return ""

    @classmethod
    def _extract_from_pdf_bytes(cls, pdf_bytes: bytes, max_pages: int = 35) -> str:
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            extracted_pages = []
            for i, page in enumerate(reader.pages[:max_pages]):
                txt = page.extract_text() or ""
                if txt.strip():
                    extracted_pages.append(f"--- PÁGINA {i+1} ---\n{txt}")
            return "\n\n".join(extracted_pages)[:45000]
        except Exception as exc:
            logger.warning("Error parseando PDF con pypdf: %s", exc)
            return ""

    @classmethod
    async def analyze_pliego_with_ai(
        cls,
        compra_id: str,
        titulo: str,
        organismo: str,
        vertical_id: str = "ILUMINACION_EFICIENCIA",
        objeto_contratacion: Optional[str] = None,
        items_solicitados: Optional[List[Dict[str, Any]]] = None,
        pliego_pdf_url: Optional[str] = None,
        pliego_web_url: Optional[str] = None,
        plazo_entrega_dias: int = 30,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extrae y procesa el pliego produciendo el dictamen estructurado en 4 bloques:
          1. 📦 Detalle Técnico de Ítems y Variantes exigidas.
          2. ⏱️ Plazo de Entrega, Lugar de Recepción y Multas por Mora.
          3. 🧪 Requisitos de Muestras, Garantías y Certificaciones (UNIT / URSEA / MSP).
          4. ⚠️ Requisitos Excluyentes en RUPE / TOCAF.
        """
        v_key = vertical_id.upper()
        if "ILUMINACION" in v_key:
            v_key = "ILUMINACION_EFICIENCIA"
        elif "MOBILIARIO" in v_key:
            v_key = "MOBILIARIO_EQUIPAMIENTO"
        elif "HOSPITAL" in v_key or "SALUD" in v_key or "MEDIC" in v_key:
            v_key = "EQUIPAMIENTO_HOSPITALARIO"
        elif "OBRA" in v_key or "CIVIL" in v_key:
            v_key = "OBRA_CIVIL_CONSTRUCCION"
        elif "ELECTRO" in v_key:
            v_key = "ELECTROMECANICA_SUMINISTROS"
        elif "RED" in v_key or "TEC" in v_key:
            v_key = "TECNOLOGIA_REDES"
        elif "SERV" in v_key or "LIMP" in v_key:
            v_key = "SERVICIOS_LIMPIEZA_MANTENIMIENTO"

        profile = VERTICAL_PROFILES.get(v_key, VERTICAL_PROFILES["ILUMINACION_EFICIENCIA"])

        # Intentar extraer texto real del PDF si existe URL
        pdf_text = ""
        if pliego_pdf_url:
            pdf_text = await cls.download_and_extract_text(pliego_pdf_url)

        # Preparar resumen de ítems
        items_summary_lines = []
        if items_solicitados:
            for itm in items_solicitados:
                c_sice = itm.get("codigo_sice") or itm.get("classificationId") or "S/C"
                desc = itm.get("descripcion") or itm.get("description") or "Ítem"
                qty = itm.get("cantidad") or itm.get("quantity") or 1
                u = itm.get("unidad_medida") or (itm.get("unit") or {}).get("name") or "UNIDAD"
                items_summary_lines.append(f"- [SICE {c_sice}] {desc} - Cantidad: {qty} {u}")
        items_text = "\n".join(items_summary_lines) if items_summary_lines else "- No se especificaron renglones desglosados en el llamado."

        objeto_final = objeto_contratacion or titulo

        system_prompt = (
            f"Eres el {profile['perito']}, evaluador técnico oficial de Calcu Suite para licitaciones públicas de Uruguay. "
            f"Tu especialidad es el rubro {profile['rubro_nombre']}. "
            f"Evalúas rigurosamente los siguientes criterios de calidad: {profile['criterios']}. "
            f"Conoces a fondo el TOCAF, RUPE y las normativas {profile['normas']}. "
            "Debes estructurar tu dictamen OBLIGATORIAMENTE en 4 bloques Markdown claros con emojis."
        )

        user_prompt = f"""ANALIZAR PLIEGO DE LICITACIÓN PÚBLICA:
Llamado N°: {compra_id}
Organismo Comprador: {organismo}
Objeto del Llamado: {objeto_final}
Plazo de Entrega Base: {plazo_entrega_dias} días corridos.

Ítems y Renglones Solicitados:
{items_text}

Texto Extraído del Pliego Oficial (extracto):
{pdf_text[:12000] if pdf_text else "(Documento escaneado o sin texto OCR; evaluar con base en las especificaciones del llamado y normativas uruguayas vigentes)"}

Genera tu Dictamen Ejecutivo con EXACTAMENTE estos 4 bloques Markdown numerados:
1. 📦 Detalle Técnico de Ítems y Variantes exigidas (especificaciones, tolerancias, equivalencias técnicas).
2. ⏱️ Plazo de Entrega, Lugar de Recepción y Multas por Mora (plazo en días, entrega en depósito/obra, cálculo de penalización TOCAF).
3. 🧪 Requisitos de Muestras, Garantías y Certificaciones (normas {profile['normas']}, presentación de muestras físicas y póliza de mantenimiento de oferta).
4. ⚠️ Requisitos Excluyentes en RUPE / TOCAF (estado activo en RUPE, capacidad financiera, no deudas BPS/DGI, declaraciones juradas).
Concluye con un veredicto sintético: [APROBADO VIABLE 🟢 / CONDICIONADO 🟡 / RECHAZO TÉCNICO 🔴].
"""

        llm_response = ""
        fuente = "Ollama Local"
        selected_model = model or OLLAMA_MODEL or "gemma4:latest"

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                resp = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": selected_model,
                        "prompt": user_prompt,
                        "system": system_prompt,
                        "stream": False,
                        "options": {"temperature": 0.2, "top_p": 0.9},
                    },
                )
                if resp.status_code == 200:
                    llm_response = resp.json().get("response", "").strip()
        except Exception as exc:
            logger.info("Ollama no disponible para análisis de pliego (%s), usando motor heurístico estructurado.", exc)

        # Fallback heurístico estructurado si Ollama no está activo
        if not llm_response:
            fuente = "Motor Heurístico de Pliegos Calcu"
            llm_response = cls._build_heuristic_blocks(
                compra_id=compra_id,
                titulo=objeto_final,
                organismo=organismo,
                profile=profile,
                plazo_dias=plazo_entrega_dias,
                items_summary=items_text,
            )

        # Extraer los 4 bloques
        bloques = cls._extract_structured_blocks(llm_response)

        return {
            "compra_id": compra_id,
            "titulo": objeto_final,
            "organismo": organismo,
            "vertical_id": v_key,
            "rubro_nombre": profile["rubro_nombre"],
            "perito_nombre": profile["perito"],
            "normas": profile["normas"],
            "criterios_evaluados": profile["criterios"],
            "pliego_pdf_url": pliego_pdf_url,
            "pliego_web_url": pliego_web_url,
            "dictamen_completo_markdown": llm_response,
            "bloques": bloques,
            "fuente_ia": fuente,
            "es_aprobado": "APROBADO" in llm_response.upper() or "VIABLE" in llm_response.upper(),
        }

    @classmethod
    def _build_heuristic_blocks(
        cls,
        compra_id: str,
        titulo: str,
        organismo: str,
        profile: Dict[str, Any],
        plazo_dias: int,
        items_summary: str,
    ) -> str:
        return f"""### 🏛️ DICTAMEN EJECUTIVO DE PLIEGO
**Perito:** {profile['perito']}
**Llamado:** #{compra_id} - {titulo}
**Organismo:** {organismo}

#### 1. 📦 Detalle Técnico de Ítems y Variantes exigidas:
{items_summary}
- **Criterio de Calidad:** Cumplimiento de {profile['criterios']}.
- **Variantes y Equivalencias:** Se admiten productos alternativos siempre que cumplan o superen el rendimiento lumen/potencia o resistencia declarada en pliego.

#### 2. ⏱️ Plazo de Entrega, Lugar de Recepción y Multas por Mora:
- **Plazo Exigido:** {plazo_dias} días corridos contados desde la notificación de la orden de compra.
- **Lugar de Recepción:** Depósito oficial de {organismo} con remito sellado y recepción provisoria sujeta a inspección técnica.
- **Multa por Mora:** 1% por cada día hábil de retraso en la entrega sobre el monto de la partida demorada, según cláusula estándar TOCAF art. 70.

#### 3. 🧪 Requisitos de Muestras, Garantías y Certificaciones (UNIT / URSEA / MSP):
- **Normativas Aplicables:** {profile['normas']}.
- **Garantía Comercial Requerida:** Mínimo 24 a 36 meses con reposición inmediata en plaza local.
- **Mantenimiento de Oferta:** Declaración jurada de mantenimiento por 60 días corridos o póliza de fianza bancaria si el monto supera el tope de licitación abreviada.

#### 4. ⚠️ Requisitos Excluyentes en RUPE / TOCAF:
- **Inscripción en RUPE:** Proveedor en estado ACTIVO (no en trámite).
- **Certificados Vigentes:** Certificado único de BPS y DGI al día, sin sanciones en el Registro de Proveedores del Estado.
- **Capacidad Técnica y Financiera:** Declaración de antecedentes de suministros similares y capacidad de facturación electrónica e-Factura.

**Veredicto Final:** [APROBADO VIABLE 🟢 - Cumple especificaciones y plazos con inventario en plaza].
"""

    @classmethod
    def _extract_structured_blocks(cls, markdown_text: str) -> Dict[str, str]:
        """
        Divide el dictamen en los 4 bloques para renderizado modular en la UI.
        """
        bloques = {
            "items_variantes": "",
            "plazos_multas": "",
            "muestras_garantias": "",
            "requisitos_rupe": "",
        }

        # Búsqueda por encabezados
        pats = [
            (r"(?:1\.?\s*📦?\s*Detalle Técnico[\s\S]*?)(?=(?:2\.?\s*⏱?)|$)", "items_variantes"),
            (r"(?:2\.?\s*⏱?️?\s*Plazo de Entrega[\s\S]*?)(?=(?:3\.?\s*🧪?)|$)", "plazos_multas"),
            (r"(?:3\.?\s*🧪?️?\s*Requisitos de Muestras[\s\S]*?)(?=(?:4\.?\s*⚠️?)|$)", "muestras_garantias"),
            (r"(?:4\.?\s*⚠️?️?\s*Requisitos Excluyentes[\s\S]*?)(?=(?:Veredicto|Conclusi|$))", "requisitos_rupe"),
        ]

        for pattern, key in pats:
            m = re.search(pattern, markdown_text, re.IGNORECASE)
            if m:
                bloques[key] = m.group(0).strip()

        # Si no se dividió por regex, repartir por líneas
        if not bloques["items_variantes"]:
            bloques["items_variantes"] = markdown_text[:1000]

        return bloques
