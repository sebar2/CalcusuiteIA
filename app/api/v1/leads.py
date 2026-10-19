from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.session import get_db
from app.domain.models import LeadProspect
from app.services.monitoring_service import MonitoringService

router = APIRouter(prefix="/leads", tags=["Leads & Prospección Comercial"])

class LeadCreateSchema(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150, description="Nombre completo del contacto")
    empresa: str = Field(..., min_length=2, max_length=150, description="Nombre o Razón Social de la empresa")
    email: str = Field(..., description="Correo electrónico corporativo")
    telefono: str = Field(..., min_length=6, max_length=50, description="Teléfono o WhatsApp de contacto")
    interes: Optional[str] = Field("Demo Completa Enterprise", description="Módulo o servicio de principal interés")
    mensaje: Optional[str] = Field(None, max_length=1000, description="Consulta o requerimiento específico")
    honeypot: Optional[str] = Field(None, description="Campo trampa anti-spam (debe quedar vacío)")

class LeadResponseSchema(BaseModel):
    id: int
    nombre: str
    empresa: str
    email: str
    telefono: str
    interes: str
    mensaje: Optional[str] = None
    estado: str
    canal_origen: str
    created_at: str

@router.post("", status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreateSchema,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Captura de prospectos comerciales y solicitudes de demo para Calcu Suite 2026.
    Integra auditoría ISO 27001, filtro anti-bot honeypot y generación de enlace directo a WhatsApp.
    """
    # 1. Filtro anti-bot Honeypot
    if payload.honeypot:
        # Silenciosamente simular éxito para engañar scrapers/bots sin guardar basura
        return {
            "status": "success",
            "message": "Solicitud procesada correctamente.",
            "lead_id": 0,
            "direct_contact": {
                "email": "sebar_2@hotmail.com",
                "whatsapp": "+59894858791"
            }
        }

    # 2. Extracción de IP y geolocalización de red
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    # 3. Persistencia del Lead en Base de Datos
    new_lead = LeadProspect(
        nombre=payload.nombre.strip(),
        empresa=payload.empresa.strip(),
        email=payload.email.strip().lower(),
        telefono=payload.telefono.strip(),
        interes=payload.interes or "Demo Completa Enterprise",
        mensaje=payload.mensaje.strip() if payload.mensaje else None,
        canal_origen="web_landing_github",
        ip_origen=client_ip,
        estado="NUEVO_LEAD",
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    # 4. Registro en el Log Inmutable de Auditoría ISO 27001
    try:
        MonitoringService.log_activity(
            db=db,
            user_id="lead_visitor",
            role="prospecto_externo",
            action="NUEVO_LEAD_REGISTRADO",
            resource=f"leads/{new_lead.id}",
            evento_realizado=f"Nuevo prospecto demo: {new_lead.nombre} ({new_lead.empresa}) - Interés: {new_lead.interes}",
            severidad="INFO",
            ip_address=client_ip,
            ubicacion="Web Landing Pública (GitHub Pages)",
            details={
                "lead_id": new_lead.id,
                "nombre": new_lead.nombre,
                "empresa": new_lead.empresa,
                "email": new_lead.email,
                "telefono": new_lead.telefono,
                "interes": new_lead.interes,
                "mensaje": new_lead.mensaje
            }
        )
    # 4.1 Registro automático en CRM y Chat Omnicanal (Canal: WEB_FORM)
    deal_id = None
    try:
        from app.domain.models import CommercialDeal
        from app.models.multitenant_entities import OmnichannelMessage
        from app.api.v1.omnichannel import ws_manager
        import asyncio

        deal = CommercialDeal(
            cliente=f"{new_lead.nombre} / {new_lead.empresa}",
            proyecto_nombre=f"Demo Web: {new_lead.empresa} ({new_lead.interes})",
            monto_total=1200.0,
            moneda="USD",
            etapa="prospeccion",
            probabilidad=0.80,
            vendedor="Asignación Web / Automática",
            canal_origen="WEB_FORM",
            utm_campaign="Landing GitHub Pages",
            phone=new_lead.telefono,
            email=new_lead.email,
            ai_score=92,
            ai_classification="HOT",
            observaciones=f"Interés: {new_lead.interes}. Mensaje: {new_lead.mensaje or 'Solicitud demo web'}"
        )
        db.add(deal)
        db.commit()
        db.refresh(deal)
        deal_id = deal.id

        welcome_msg = (
            f"📥 Nuevo lead recibido desde el formulario web de la landing GitHub Pages:\n"
            f"👤 Contacto: {new_lead.nombre}\n"
            f"🏢 Empresa: {new_lead.empresa}\n"
            f"📧 Email: {new_lead.email}\n"
            f"📱 Teléfono/WhatsApp: {new_lead.telefono}\n"
            f"🎯 Interés: {new_lead.interes}\n"
            f"💬 Consulta: {new_lead.mensaje or 'Solicitud de acceso a la demo corporativa'}"
        )
        omni_msg = OmnichannelMessage(
            deal_id=deal.id,
            channel="WEB_FORM",
            direction="INBOUND",
            sender_name=new_lead.nombre,
            sender_address=new_lead.email,
            message_text=welcome_msg,
            delivery_status="DELIVERED_API",
            is_ai_generated=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(omni_msg)
        db.commit()

        # Emitir notificación WebSocket si el loop está activo
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(ws_manager.broadcast({
                    "event": "NEW_MESSAGE",
                    "deal_id": deal.id,
                    "message": {
                        "id": omni_msg.id,
                        "deal_id": deal.id,
                        "channel": "WEB_FORM",
                        "direction": "INBOUND",
                        "sender_name": new_lead.nombre,
                        "message_text": welcome_msg,
                        "delivery_status": "DELIVERED_API",
                        "created_at": omni_msg.created_at.strftime("%Y-%m-%d %H:%M:%S")
                    }
                }))
        except Exception:
            pass
    except Exception:
        pass

    # 5. Construcción de URL WhatsApp para contacto instantáneo
    mensaje_wa = (
        f"Hola Sebastián, acabo de solicitar acceso a la demo de Calcu Suite 2026 en la web.\n"
        f"Mi nombre es {new_lead.nombre} de la empresa {new_lead.empresa}.\n"
        f"Me interesa: {new_lead.interes}."
    )
    import urllib.parse
    wa_encoded = urllib.parse.quote(mensaje_wa)
    wa_link = f"https://wa.me/59894858791?text={wa_encoded}"

    return {
        "status": "success",
        "message": f"¡Gracias {new_lead.nombre}! Tu solicitud de demo para {new_lead.empresa} fue registrada con éxito.",
        "lead_id": new_lead.id,
        "direct_contact": {
            "email": "sebar_2@hotmail.com",
            "whatsapp": "+59894858791",
            "whatsapp_url": wa_link
        }
    }

@router.get("", response_model=List[LeadResponseSchema])
def list_leads(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Recupera la lista de prospectos y leads comerciales registrados (en orden cronológico inverso).
    """
    leads = db.query(LeadProspect).order_by(desc(LeadProspect.created_at)).limit(limit).all()
    return [
        LeadResponseSchema(
            id=l.id,
            nombre=l.nombre,
            empresa=l.empresa,
            email=l.email,
            telefono=l.telefono,
            interes=l.interes,
            mensaje=l.mensaje,
            estado=l.estado,
            canal_origen=l.canal_origen,
            created_at=l.created_at.strftime("%Y-%m-%d %H:%M:%S")
        )
        for l in leads
    ]
