import logging
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.models.accounting_entities import Invoice, CollectionCase
from app.models.entities import Client
from app.domain.models import AuditLog

logger = logging.getLogger(__name__)

class CollectionService:
    """
    Motor de Gestión de Cobranzas y Recuperación de Cartera en 5 Etapas (Kanban & Aging)
    Reglas de Transición Automática:
    - Etapa 1 (Nuevo Deudor): 1 a 29 días de vencido el crédito
    - Etapa 2 (Contactado): Pasa automáticamente a los 30 días de vencido (30 a 44 días)
    - Etapa 3 (Deudor Advertido): Pasa automáticamente a los 45 días de vencido (45 a 59 días)
    - Etapa 4 (Deudor Complicado): Pasa automáticamente a los 60 días de vencido (60 a 62 días - Intimación Legal)
    - Etapa 5 (Moroso / Estudio Jurídico): Pasa automáticamente a los 63 días de vencido (derivación prejudicial)
    """

    @staticmethod
    def calculate_stage(dias_vencido: int) -> str:
        if dias_vencido >= 63:
            return "5_JURIDICO"
        elif dias_vencido >= 60:
            return "4_COMPLICADO"
        elif dias_vencido >= 45:
            return "3_ADVERTIDO"
        elif dias_vencido >= 30:
            return "2_CONTACTADO"
        elif dias_vencido >= 1:
            return "1_NUEVO_DEUDOR"
        return "AL_DIA"

    @staticmethod
    def get_collections_overview(db: Session, filter_days: Optional[int] = None) -> Dict[str, Any]:
        """
        Calcula la cartera de deudores, agrupa facturas por cliente y organiza el tablero Kanban de 5 etapas.
        """
        today = date.today()

        # Buscar facturas a crédito no cobradas ni anuladas
        unpaid_invoices = (
            db.query(Invoice)
            .filter(
                Invoice.estado == "EMITIDA",
                Invoice.fecha_vencimiento < today,
                ~Invoice.tipo_cfe.in_(["112_NOTA_CREDITO", "102_NOTA_CREDITO_ETICKET"])
            )
            .order_by(Invoice.fecha_vencimiento.asc())
            .all()
        )

        debtors_map: Dict[str, Dict[str, Any]] = {}

        for inv in unpaid_invoices:
            dias_venc = (today - inv.fecha_vencimiento).days
            if dias_venc < 1:
                continue

            rut = inv.cliente_rut or "SIN_RUT"
            if rut not in debtors_map:
                # Buscar datos del cliente
                cli = db.query(Client).filter(or_(Client.rut == rut, Client.nombre == inv.cliente_nombre)).first()
                limite_credito = float(cli.limite_credito) if (cli and cli.limite_credito and cli.limite_credito > 0) else 200.0
                email = cli.email if cli else None
                phone = cli.phone if cli else None
                address = cli.address if cli else inv.cliente_direccion
                tipo_doc = cli.tipo_documento if cli else inv.tipo_documento_receptor or "RUT"
                es_consumidor = cli.es_consumidor_final if cli else inv.es_consumidor_final

                debtors_map[rut] = {
                    "client_id": cli.id if cli else None,
                    "cliente_nombre": inv.cliente_nombre,
                    "cliente_rut": rut,
                    "tipo_documento": tipo_doc,
                    "es_consumidor_final": es_consumidor,
                    "email": email,
                    "phone": phone,
                    "address": address,
                    "limite_credito": limite_credito,
                    "monto_total_deuda": 0.0,
                    "dias_max_vencido": 0,
                    "facturas": [],
                    "facturas_numeros": [],
                    "etapa": "1_NUEVO_DEUDOR"
                }

            debtor = debtors_map[rut]
            debtor["monto_total_deuda"] += float(inv.total)
            if dias_venc > debtor["dias_max_vencido"]:
                debtor["dias_max_vencido"] = dias_venc
            
            debtor["facturas_numeros"].append(inv.numero_factura)
            debtor["facturas"].append({
                "id": inv.id,
                "numero_factura": inv.numero_factura,
                "fecha_emision": inv.fecha_emision.isoformat(),
                "fecha_vencimiento": inv.fecha_vencimiento.isoformat(),
                "dias_vencido": dias_venc,
                "moneda": inv.moneda,
                "total": float(inv.total)
            })

        # Asignar etapa y límites calculados
        debtor_list: List[Dict[str, Any]] = []
        for rut, debtor in debtors_map.items():
            max_days = debtor["dias_max_vencido"]
            debtor["etapa"] = CollectionService.calculate_stage(max_days)
            debtor["excede_limite"] = debtor["limite_credito"] > 0 and debtor["monto_total_deuda"] > debtor["limite_credito"]
            debtor["cupo_disponible"] = max(0.0, debtor["limite_credito"] - debtor["monto_total_deuda"]) if debtor["limite_credito"] > 0 else 0.0

            # Filtro por antigüedad si fue solicitado
            if filter_days is not None:
                if filter_days == 1 and max_days < 1:
                    continue
                elif filter_days == 30 and (max_days < 30 or max_days >= 45):
                    continue
                elif filter_days == 45 and (max_days < 45 or max_days >= 60):
                    continue
                elif filter_days == 60 and max_days < 60:
                    continue

            debtor_list.append(debtor)

            # Sincronizar en collection_cases si existe (con normalización 1NF en collection_case_invoices)
            inv_ids = [f["id"] for f in debtor["facturas"]]
            matched_invs = db.query(Invoice).filter(Invoice.id.in_(inv_ids)).all() if inv_ids else []

            case = db.query(CollectionCase).filter(CollectionCase.cliente_rut == rut).first()
            if not case:
                case = CollectionCase(
                    cliente_id=debtor["client_id"],
                    cliente_nombre=debtor["cliente_nombre"],
                    cliente_rut=rut,
                    etapa=debtor["etapa"],
                    dias_max_vencido=max_days,
                    monto_total_deuda=Decimal(str(debtor["monto_total_deuda"])),
                    facturas_ids=debtor["facturas_numeros"],
                    invoices_rel=matched_invs,
                    ultimo_contacto=datetime.now(timezone.utc)
                )
                db.add(case)
            else:
                case.cliente_id = debtor["client_id"]
                case.etapa = debtor["etapa"]
                case.dias_max_vencido = max_days
                case.monto_total_deuda = Decimal(str(debtor["monto_total_deuda"]))
                case.facturas_ids = debtor["facturas_numeros"]
                case.invoices_rel = matched_invs

        
        try:
            db.commit()
        except Exception:
            db.rollback()

        # Armar tablero Kanban en 5 etapas
        kanban_stages = {
            "1_NUEVO_DEUDOR": {
                "id": "1_NUEVO_DEUDOR",
                "titulo": "1. Nuevo Deudor",
                "descripcion": "1 a 29 días de vencido. Alerta temprana y recordatorio de cortesía.",
                "color": "amber",
                "items": [d for d in debtor_list if d["etapa"] == "1_NUEVO_DEUDOR"],
                "total_monto": sum(d["monto_total_deuda"] for d in debtor_list if d["etapa"] == "1_NUEVO_DEUDOR")
            },
            "2_CONTACTADO": {
                "id": "2_CONTACTADO",
                "titulo": "2. Contactado",
                "descripcion": "Pasa automáticamente a los 30 días de vencido. Gestión telefónica y renegociación.",
                "color": "orange",
                "items": [d for d in debtor_list if d["etapa"] == "2_CONTACTADO"],
                "total_monto": sum(d["monto_total_deuda"] for d in debtor_list if d["etapa"] == "2_CONTACTADO")
            },
            "3_ADVERTIDO": {
                "id": "3_ADVERTIDO",
                "titulo": "3. Deudor Advertido",
                "descripcion": "Pasa automáticamente a los 45 días de vencido. Suspensión de despachos y corte de crédito.",
                "color": "rose",
                "items": [d for d in debtor_list if d["etapa"] == "3_ADVERTIDO"],
                "total_monto": sum(d["monto_total_deuda"] for d in debtor_list if d["etapa"] == "3_ADVERTIDO")
            },
            "4_COMPLICADO": {
                "id": "4_COMPLICADO",
                "titulo": "4. Deudor Complicado",
                "descripcion": "Pasa automáticamente a los 60 días de vencido. Emisión de Intimación Legal formal.",
                "color": "red",
                "items": [d for d in debtor_list if d["etapa"] == "4_COMPLICADO"],
                "total_monto": sum(d["monto_total_deuda"] for d in debtor_list if d["etapa"] == "4_COMPLICADO")
            },
            "5_JURIDICO": {
                "id": "5_JURIDICO",
                "titulo": "5. Moroso / Estudio Jurídico",
                "descripcion": "Pasa automáticamente a los 63 días de vencido. Derivado a estudio legal para acción judicial.",
                "color": "purple",
                "items": [d for d in debtor_list if d["etapa"] == "5_JURIDICO"],
                "total_monto": sum(d["monto_total_deuda"] for d in debtor_list if d["etapa"] == "5_JURIDICO")
            }
        }

        total_cartera = sum(d["monto_total_deuda"] for d in debtor_list)
        clientes_en_mora = len(debtor_list)

        return {
            "resumen": {
                "total_cartera_vencida": total_cartera,
                "cantidad_deudores": clientes_en_mora,
                "dias_mora_promedio": round(sum(d["dias_max_vencido"] for d in debtor_list) / max(1, clientes_en_mora), 1),
                "casos_criticos_60d": sum(1 for d in debtor_list if d["dias_max_vencido"] >= 60)
            },
            "kanban": kanban_stages,
            "deudores": debtor_list
        }

    @staticmethod
    def generate_legal_notice(db: Session, rut: str) -> Dict[str, Any]:
        """
        Genera el borrador formal de Intimación Legal de Pago bajo la legislación uruguaya (Decreto Ley 14.412 y CGP).
        """
        today = date.today()
        overview = CollectionService.get_collections_overview(db)
        debtor = next((d for d in overview["deudores"] if d["cliente_rut"] == rut), None)
        
        if not debtor:
            raise ValueError(f"No se encontró cliente deudor con RUT/Documento: {rut}")

        facturas_str = ", ".join(f"{f['numero_factura']} (Vencimiento: {f['fecha_vencimiento']}, Monto: ${f['total']:,.2f})" for f in debtor["facturas"])
        
        texto_intimacion = f"""
================================================================================
INTIMACIÓN FORMAL Y PREJUDICIAL DE PAGO
================================================================================
Montevideo, Uruguay, {today.strftime('%d de %B de %Y')}

A: {debtor['cliente_nombre']}
RUT / Documento: {debtor['cliente_rut']}
Domicilio Constituido: {debtor.get('address') or 'Domicilio fiscal registrado'}

De: CALCU S.A. - Asesoría Letrada & Departamento de Recuperación de Créditos
Ref: Cobro Ejecutivo de Créditos Comerciales Impagos

Por la presente, intimamos a Uds. en los términos de los Arts. 11, 14 y concordantes del Código General del Proceso y la normativa cambiaria uruguaya vigente, para que en el plazo improrrogable y perentorio de CUARENTA Y OCHO (48) HORAS hábiles a partir de la recepción de la presente, procedan a cancelar el saldo total deudor que asciende a:

MONTO CAPITAL TOTAL: ${debtor['monto_total_deuda']:,.2f} UYU
DETALLE DE COMPROBANTES FISCALES VENCIDOS ({debtor['dias_max_vencido']} DÍAS EN MORA):
{facturas_str}

Vencido el plazo estipulado sin que se haya acreditado el efectivo pago o suscrito un convenio de refinanciación satisfactorio en nuestras oficinas comerciales, se procederá sin más trámite a:
1. La radicación inmediata de la DEMANDA EJECUTIVA en vía judicial con traba de embargo genérico y específico de cuentas bancarias.
2. La comunicación formal de antecedentes de morosidad ante la Cámara de Comercio y Ligas de Defensa Comercial (LIDECO) e informes crediticios clearing.
3. El devengamiento de intereses punitorios y moratorios a la tasa máxima legal fijada por el Banco Central del Uruguay (BCU), con más los costos y costas del juicio.

Sírvase coordinar la cancelación inmediata comunicándose con nuestra Gerencia de Cobranzas al tel: +598 2900 8000 o vía email: cobranzas@calcu.com.uy.

Atentamente,
Departamento Jurídico & Controller Financiero
CALCU ENTERPRISE SUITE
"""
        return {
            "cliente_nombre": debtor["cliente_nombre"],
            "cliente_rut": debtor["cliente_rut"],
            "monto_total": debtor["monto_total_deuda"],
            "dias_vencido": debtor["dias_max_vencido"],
            "facturas": debtor["facturas_numeros"],
            "texto_intimacion": texto_intimacion.strip()
        }
