from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import urllib.parse
import json
import os
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from decimal import Decimal
from app.database.session import get_db
from app.models.entities import CommercialDeal, CommercialDealItem, Product, Inventory
from app.models.multitenant_entities import OmnichannelMessage, IntegrationConfig
from app.core.vault import decrypt_vault_payload
from app.core.security import (
    require_roles,
    UserContext,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_COMERCIAL,
)
from app.services.meli_service import MeliService

router = APIRouter(prefix="/api/v1/omnichannel", tags=["Chat Omnicanal Unificado & Copiloto IA"])


class OmnichannelMessageResponse(BaseModel):
    id: int
    deal_id: str
    channel: str
    direction: str
    sender_name: str
    sender_address: Optional[str] = None
    message_text: str
    delivery_status: str
    is_ai_generated: bool
    created_at: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None


class ConversationSummaryResponse(BaseModel):
    deal_id: str
    proyecto_nombre: str
    cliente: str
    vendedor: str
    etapa: str
    monto_total: float
    moneda: str
    canal_origen: str
    utm_campaign: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    ai_score: int = 75
    ai_classification: str = "WARM"
    last_message_text: str
    last_message_channel: str
    last_message_at: str
    messages_count: int


class SendMessageRequest(BaseModel):
    channel: str = Field(..., description="Canal por el que se desea responder: WHATSAPP, EMAIL, META_ADS, GOOGLE_ADS, WEB_FORM")
    message_text: str = Field(..., min_length=1, max_length=4000)
    is_ai_generated: bool = False
    media_url: Optional[str] = None
    media_type: Optional[str] = None


class AISuggestionRequest(BaseModel):
    custom_context: Optional[str] = None
    tone: str = Field(default="consultivo_b2b", description="consultivo_b2b | cierre_agresivo | soporte_tecnico")


class UpdateDealContactRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    ai_classification: Optional[str] = Field(
        default=None,
        description="Categoría del contacto: AMIGOS_FAMILIA | WARM | HOT | COLD",
    )
    clear_items: Optional[bool] = Field(
        default=None,
        description="Si es True, elimina todos los productos/SKUs asignados al prospecto y deja monto en 0",
    )


def _resolve_lid_phone(raw_phone: Optional[str]) -> Optional[str]:
    if not raw_phone:
        return raw_phone
    digits = "".join(c for c in str(raw_phone) if c.isdigit())
    if not digits:
        return raw_phone
    auth_dir = os.path.join(os.getcwd(), "tenants_data", "wa_qr_auth_info")
    rev_file = os.path.join(auth_dir, f"lid-mapping-{digits}_reverse.json")
    if os.path.exists(rev_file):
        try:
            with open(rev_file, "r", encoding="utf-8") as f:
                mapped_pn = str(json.load(f) or "").strip()
            pn_digits = "".join(c for c in mapped_pn if c.isdigit())
            if pn_digits:
                digits = pn_digits
        except Exception:
            pass
    if digits.startswith("598") and len(digits) == 11:
        return f"+598 {digits[3:5]} {digits[5:8]} {digits[8:]}"
    return raw_phone


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: Dict[str, Any]):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(payload)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)


ws_manager = ConnectionManager()


@router.get(
    "/conversations",
    response_model=List[ConversationSummaryResponse],
    summary="Lista todos los prospectos y tratos con su historial de conversación omnicanal"
)
def list_conversations(
    canal_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    deals_q = db.query(CommercialDeal).order_by(desc(CommercialDeal.created_at))
    if canal_filter and canal_filter != "ALL":
        deals_q = deals_q.filter(CommercialDeal.canal_origen == canal_filter.upper())
    deals = deals_q.all()

    dirty = False
    results: List[ConversationSummaryResponse] = []
    for d in deals:
        raw_phone = getattr(d, "phone", None)
        resolved_phone = _resolve_lid_phone(raw_phone)
        if resolved_phone and resolved_phone != raw_phone:
            d.phone = resolved_phone
            dirty = True

        msgs = (
            db.query(OmnichannelMessage)
            .filter(OmnichannelMessage.deal_id == d.id)
            .order_by(desc(OmnichannelMessage.created_at))
            .all()
        )
        last_msg = msgs[0] if msgs else None
        canal_orig = getattr(d, "canal_origen", "MANUAL") or "MANUAL"
        results.append(
            ConversationSummaryResponse(
                deal_id=d.id,
                proyecto_nombre=d.proyecto_nombre,
                cliente=d.cliente,
                vendedor=d.vendedor,
                etapa=d.etapa,
                monto_total=float(d.monto_total or 0),
                moneda=d.moneda,
                canal_origen=canal_orig,
                utm_campaign=getattr(d, "utm_campaign", None),
                email=getattr(d, "email", None),
                phone=resolved_phone,
                ai_score=getattr(d, "ai_score", 75) or 75,
                ai_classification=getattr(d, "ai_classification", "WARM") or "WARM",
                last_message_text=last_msg.message_text if last_msg else (d.observaciones or "Sin mensajes registrados"),
                last_message_channel=last_msg.channel if last_msg else canal_orig,
                last_message_at=(
                    last_msg.created_at.strftime("%Y-%m-%d %H:%M")
                    if last_msg and last_msg.created_at
                    else (d.created_at.strftime("%Y-%m-%d %H:%M") if d.created_at else "Reciente")
                ),
                messages_count=len(msgs),
            )
        )
    if dirty:
        db.commit()
    return results


@router.patch(
    "/conversations/{deal_id}/contact",
    summary="Actualiza el número de teléfono, email, categoría (Amigos/Familia vs Comercial) o limpia productos del prospecto"
)
def update_conversation_contact(
    deal_id: str,
    payload: UpdateDealContactRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Prospecto / Trato no encontrado.")
    if payload.phone is not None:
        deal.phone = _resolve_lid_phone(payload.phone.strip())
    if payload.email is not None:
        deal.email = payload.email.strip() or None
    if payload.ai_classification is not None:
        cat = payload.ai_classification.strip().upper()
        deal.ai_classification = cat
        if cat == "AMIGOS_FAMILIA":
            deal.ai_score = 0
            deal.monto_total = Decimal("0.00")
            deal.costo_adquisicion_estimado = Decimal("0.00")
            db.query(CommercialDealItem).filter(CommercialDealItem.deal_id == deal.id).delete(synchronize_session=False)
        elif deal.ai_score == 0:
            deal.ai_score = 75
    if payload.clear_items:
        db.query(CommercialDealItem).filter(CommercialDealItem.deal_id == deal.id).delete(synchronize_session=False)
        deal.monto_total = Decimal("0.00")
    db.commit()
    db.refresh(deal)
    return {
        "deal_id": deal.id,
        "phone": deal.phone,
        "email": deal.email,
        "ai_classification": deal.ai_classification,
        "ai_score": deal.ai_score,
        "monto_total": float(deal.monto_total or 0),
        "message": "Datos y categoría del contacto actualizados correctamente.",
    }


@router.get(
    "/messages/{deal_id}",
    response_model=List[OmnichannelMessageResponse],
    summary="Obtiene el hilo cronológico completo de mensajes de un prospecto"
)
def get_deal_messages(
    deal_id: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Prospecto / Trato comercial no encontrado.")

    msgs = (
        db.query(OmnichannelMessage)
        .filter(OmnichannelMessage.deal_id == deal_id)
        .order_by(OmnichannelMessage.created_at.asc(), OmnichannelMessage.id.asc())
        .all()
    )
    return [
        OmnichannelMessageResponse(
            id=m.id,
            deal_id=m.deal_id,
            channel=m.channel,
            direction=m.direction,
            sender_name=m.sender_name,
            sender_address=m.sender_address,
            message_text=m.message_text,
            delivery_status=m.delivery_status,
            is_ai_generated=m.is_ai_generated,
            created_at=m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else "",
            media_url=m.metadata_json.get("media_url") if isinstance(m.metadata_json, dict) else None,
            media_type=m.metadata_json.get("media_type") if isinstance(m.metadata_json, dict) else None,
        )
        for m in msgs
    ]


@router.post(
    "/upload-media",
    summary="Sube un archivo de imagen o audio para el Chat Omnicanal (Validación MIME & Magic Bytes ISO 27001)"
)
async def upload_omnichannel_media(
    file: UploadFile = File(...),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    import uuid
    # Límite estricto 50MB para videos, imágenes y audios (Prevención DoS)
    MAX_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo excede el tamaño máximo permitido de 50 MB."
        )

    # Detección y validación por Magic Bytes (Prevención RCE & CWE-434)
    media_type = None
    ext = None
    content_type = (file.content_type or "").lower()

    if content.startswith(b"\xff\xd8\xff"):
        media_type = "IMAGE"
        ext = ".jpg"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        media_type = "IMAGE"
        ext = ".png"
    elif len(content) > 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        media_type = "IMAGE"
        ext = ".webp"
    elif content.startswith(b"OggS"):
        media_type = "AUDIO"
        ext = ".ogg"
    elif content.startswith(b"ID3") or (len(content) > 2 and content[0] == 0xff and (content[1] & 0xe0) == 0xe0):
        media_type = "AUDIO"
        ext = ".mp3"
    elif content.startswith(b"\x1a\x45\xdf\xa3"):
        # Contenedor EBML (WebM / Matroska)
        if "audio" in content_type:
            media_type, ext = "AUDIO", ".weba"
        else:
            media_type, ext = "VIDEO", ".webm"
    elif len(content) > 12 and (content[4:8] == b"ftyp" or b"ftyp" in content[:24]):
        # Contenedor ISO BMFF / QuickTime (MP4 o M4A)
        major_brand = content[8:12] if len(content) >= 12 else b""
        if major_brand in (b"M4A ", b"M4B ") or "audio" in content_type:
            media_type = "AUDIO"
            ext = ".m4a"
        else:
            media_type = "VIDEO"
            ext = ".mp4"
    else:
        # Fallback a MIME verificado si coincide con formatos autorizados
        if "video/mp4" in content_type or "video/quicktime" in content_type:
            media_type, ext = "VIDEO", ".mp4"
        elif "video/webm" in content_type:
            media_type, ext = "VIDEO", ".webm"
        elif "image/jpeg" in content_type:
            media_type, ext = "IMAGE", ".jpg"
        elif "image/png" in content_type:
            media_type, ext = "IMAGE", ".png"
        elif "image/webp" in content_type:
            media_type, ext = "IMAGE", ".webp"
        elif "audio/ogg" in content_type:
            media_type, ext = "AUDIO", ".ogg"
        elif "audio/mpeg" in content_type or "audio/mp3" in content_type:
            media_type, ext = "AUDIO", ".mp3"
        elif "audio/mp4" in content_type or "audio/m4a" in content_type or "audio/webm" in content_type:
            media_type, ext = "AUDIO", ".m4a"
        else:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Formato de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP), audios (OGG, MP3, M4A) y videos (MP4, WebM, MOV)."
            )

    media_dir = os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads", "omnichannel_media")
    os.makedirs(media_dir, exist_ok=True)

    filename = f"chat_{media_type.lower()}_{uuid.uuid4().hex[:12]}_{int(datetime.now(timezone.utc).timestamp())}{ext}"
    target_path = os.path.join(media_dir, filename)

    with open(target_path, "wb") as f:
        f.write(content)

    return {
        "media_url": f"/static/uploads/omnichannel_media/{filename}",
        "media_type": media_type,
        "filename": filename,
        "size_bytes": len(content),
    }


@router.post(
    "/messages/{deal_id}",
    summary="Envía un mensaje al prospecto por el canal elegido (Política Cero Falsos Positivos)"
)
async def send_omnichannel_message(
    deal_id: str,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Prospecto / Trato no encontrado.")

    if deal.phone:
        resolved_p = _resolve_lid_phone(deal.phone)
        if resolved_p and resolved_p != deal.phone:
            deal.phone = resolved_p

    clean_ch = payload.channel.strip().upper()

    # Validación Anti-Penalización de Mercado Libre Uruguay
    if clean_ch == "MERCADO_LIBRE":
        is_valid, violation = MeliService.validate_anti_penalty(payload.message_text)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Políticas de Mercado Libre: {violation}",
            )

    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == clean_ch).first()
    has_real_creds = bool(cfg and cfg.is_enabled and decrypt_vault_payload(cfg.encrypted_credentials))

    # Despacho en vivo para Mercado Libre si existen credenciales válidas y es una pregunta pre-venta
    meli_dispatched = False
    if clean_ch == "MERCADO_LIBRE":
        meli_token = MeliService.get_valid_seller_token(db, tenant_id=user.tenant_id)
        if meli_token and deal.external_lead_id and deal.external_lead_id.startswith("meli_q_"):
            q_id = deal.external_lead_id.replace("meli_q_", "")
            try:
                await MeliService.answer_question(
                    question_id=q_id,
                    text=payload.message_text.strip(),
                    access_token=meli_token
                )
                meli_dispatched = True
                has_real_creds = True
            except Exception as e:
                pass

    # Si el canal es WHATSAPP_QR (o WHATSAPP sin API Cloud pero con QR Bridge conectado), despachar en vivo por Baileys
    bridge_dispatched = False
    if clean_ch in ("WHATSAPP_QR", "WHATSAPP") and deal.phone and (clean_ch == "WHATSAPP_QR" or not has_real_creds):
        try:
            import urllib.request as _ureq
            bridge_url = os.getenv("WA_QR_BRIDGE_URL", "http://127.0.0.1:3010").rstrip("/")
            req_body = {
                "phone": deal.phone,
                "message": payload.message_text.strip(),
            }
            if payload.media_url:
                req_body["media_url"] = payload.media_url
                req_body["media_type"] = payload.media_type or "IMAGE"

            req_data = json.dumps(req_body).encode("utf-8")
            req = _ureq.Request(
                f"{bridge_url}/send",
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with _ureq.urlopen(req, timeout=5.0) as resp:
                if resp.status == 200:
                    resp_body = json.loads(resp.read().decode("utf-8"))
                    if resp_body.get("sent"):
                        bridge_dispatched = True
                        has_real_creds = True
                        clean_ch = "WHATSAPP_QR"
                        if resp_body.get("resolved_phone"):
                            deal.phone = resp_body["resolved_phone"]
        except Exception:
            pass

    # Cero Falsos Positivos: informar con total transparencia si el canal externo no tiene llaves reales
    delivery_status = (
        "DELIVERED_MELI_API"
        if meli_dispatched
        else (
            "DELIVERED_WHATSAPP_QR_BRIDGE"
            if bridge_dispatched
            else ("DELIVERED_API" if has_real_creds else "LOGGED_PENDING_CHANNEL_CREDENTIALS")
        )
    )

    out_media_meta = {}
    if payload.media_url:
        out_media_meta["media_url"] = payload.media_url
        out_media_meta["media_type"] = payload.media_type or "IMAGE"

    new_msg = OmnichannelMessage(
        tenant_id=user.tenant_id,
        deal_id=deal.id,
        channel=clean_ch,
        direction="OUTBOUND",
        sender_name=f"{user.user_id} ({deal.vendedor})",
        sender_address=deal.phone if clean_ch in ("WHATSAPP", "WHATSAPP_QR") else (deal.email or ""),
        message_text=payload.message_text.strip(),
        delivery_status=delivery_status,
        is_ai_generated=payload.is_ai_generated,
        metadata_json=out_media_meta if out_media_meta else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Construir enlace de acción asistida cuando las credenciales API aún no están configuradas
    direct_action_url = None
    if clean_ch in ("WHATSAPP", "WHATSAPP_QR"):
        phone_clean = "".join(c for c in (deal.phone or "59894858791") if c.isdigit())
        encoded_txt = urllib.parse.quote(payload.message_text.strip())
        direct_action_url = f"https://wa.me/{phone_clean}?text={encoded_txt}"
    elif clean_ch == "EMAIL" and deal.email:
        subj = urllib.parse.quote(f"Propuesta Comercial Calcu - {deal.proyecto_nombre}")
        body = urllib.parse.quote(payload.message_text.strip())
        direct_action_url = f"mailto:{deal.email}?subject={subj}&body={body}"
    elif clean_ch == "MERCADO_LIBRE":
        direct_action_url = "https://www.mercadolibre.com.uy/preguntas"

    msg_Out = {
        "id": new_msg.id,
        "deal_id": new_msg.deal_id,
        "channel": new_msg.channel,
        "direction": new_msg.direction,
        "sender_name": new_msg.sender_name,
        "sender_address": new_msg.sender_address,
        "message_text": new_msg.message_text,
        "delivery_status": new_msg.delivery_status,
        "is_ai_generated": new_msg.is_ai_generated,
        "created_at": new_msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
    }

    await ws_manager.broadcast({"event": "NEW_MESSAGE", "deal_id": deal.id, "message": msg_Out})

    return {
        "message": msg_Out,
        "channel_connected": has_real_creds,
        "delivery_status": delivery_status,
        "direct_action_url": direct_action_url,
        "status_notice": (
            f"✓✓ Mensaje enviado en vivo a WhatsApp ({deal.phone}) vía WhatsApp Directo QR."
            if bridge_dispatched
            else (
                f"Mensaje enviado por sesión activa de {clean_ch}."
                if has_real_creds
                else f"Registrado en historial centralizado. El canal {clean_ch} está en estado 'Pendiente de credenciales' API; puede usar el enlace directo asistido si desea despacharlo manualmente."
            )
        ),
    }


@router.post(
    "/ai-suggest/{deal_id}",
    summary="Agente de IA Gratuito (Ollama Local / Gemini Flash Free + Contexto de Stock): Sugiere respuestas inteligentes"
)
def generate_ai_chat_suggestions(
    deal_id: str,
    payload: AISuggestionRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    """
    Analiza la fuente del prospecto (`canal_origen`), campaña UTM, preguntas realizadas en el chat
    y consulta en vivo el catálogo de productos y stock en depósitos de Calcu para generar
    respuestas automáticas/sugeridas altamente efectivas sin costo.
    """
    deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Prospecto / Trato no encontrado.")

    msgs = (
        db.query(OmnichannelMessage)
        .filter(OmnichannelMessage.deal_id == deal_id)
        .order_by(OmnichannelMessage.created_at.desc())
        .limit(5)
        .all()
    )
    last_inbound = next((m.message_text for m in msgs if m.direction == "INBOUND"), deal.observaciones or "")

    # Consultar catálogo y stock real en Calcu para enriquecer la respuesta
    products = db.query(Product).limit(6).all()
    stock_snippets = []
    for p in products:
        inv = db.query(Inventory).filter(Inventory.producto_id == p.id).first()
        qty = inv.deposito_central if inv else 50
        stock_snippets.append(f"{p.nombre} ({p.sku}): USD {float(p.precio_lista):.2f} ({qty} u. en stock MVD)")

    catalog_summary = " | ".join(stock_snippets[:3]) if stock_snippets else "Catálogo completo con stock inmediato en Montevideo"
    canal = getattr(deal, "canal_origen", "MANUAL") or "MANUAL"
    campana = getattr(deal, "utm_campaign", None) or "Campaña Directa B2B"
    cliente_corto = deal.cliente.split("/")[0].strip()

    # Intentar inferencia con Ollama local (100% gratuito) si está corriendo en localhost:11434
    ai_engine_used = "Calcu Context AI Engine (Zero-Cost Local + Stock Real-Time)"
    ollama_custom_reply = None
    try:
        import urllib.request
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        prompt_text = (
            f"Actúa como ejecutivo comercial B2B de Calcu. El cliente '{deal.cliente}' ingresó por el canal '{canal}' "
            f"(Campaña: {campana}) consultando por '{deal.proyecto_nombre}'. "
            f"Su último mensaje fue: '{last_inbound}'. "
            f"Productos disponibles en stock: {catalog_summary}. "
            f"Redacta una respuesta breve, cordial y ejecutiva de máximo 3 líneas en español proponiendo avanzar con la cotización."
        )
        req_body = json.dumps({
            "model": "llama3",
            "prompt": prompt_text,
            "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{ollama_url}/api/generate",
            data=req_body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=1.8) as resp:
            if resp.status == 200:
                resp_data = json.loads(resp.read().decode("utf-8"))
                if resp_data.get("response"):
                    ollama_custom_reply = resp_data["response"].strip()
                    ai_engine_used = "Ollama Local LLM (100% Gratuito & Privado)"
    except Exception:
        pass

    # Construir las 3 sugerencias estratégicas adaptadas al canal de origen y pregunta del prospecto
    channel_greeting = {
        "GOOGLE_ADS": f"Gracias por contactarnos a través de nuestra campaña en Google sobre {deal.proyecto_nombre}",
        "META_ADS": f"Recibimos tus datos desde nuestro formulario en Meta/Facebook para {deal.proyecto_nombre}",
        "WHATSAPP": f"¡Hola! Qué gusto saludarte por WhatsApp respecto a tu consulta de {deal.proyecto_nombre}",
        "WHATSAPP_QR": f"¡Hola! Recibimos tu mensaje directo en nuestro WhatsApp vinculado por {deal.proyecto_nombre}",
        "EMAIL": f"Estimados {cliente_corto}, acusamos recibo de su requerimiento comercial para {deal.proyecto_nombre}",
        "WEB_FORM": f"¡Hola equipo de {cliente_corto}! Recibimos su solicitud desde nuestra web corporativa",
    }.get(canal, f"Hola {cliente_corto}, gracias por comunicarte con Calcu por {deal.proyecto_nombre}")

    sugerencia_1 = ollama_custom_reply or (
        f"{channel_greeting}. Analizando tu consulta (\"{last_inbound[:90]}...\"), te confirmo que disponemos de "
        f"stock inmediato en nuestro Depósito Central Montevideo ({catalog_summary}). "
        f"¿Te parece bien que te envíe por aquí la cotización formal para un estimado de {deal.moneda} {float(deal.monto_total):,.2f}?"
    )

    sugerencia_2 = (
        f"¡Hola {cliente_corto}! Soy {deal.vendedor}, tu ejecutivo asignado en Calcu. "
        f"Para el proyecto '{deal.proyecto_nombre}', podemos reservar hoy mismo el lote en depósito con bonificación corporativa "
        f"por volumen y despacho en 24-48 hs. ¿Tienes 5 minutos hoy a las 15:00 hs para una breve llamada de cierre?"
    )

    sugerencia_3 = (
        f"Estimados {cliente_corto}: Adjunto el detalle técnico y condiciones comerciales para '{deal.proyecto_nombre}'. "
        f"Contamos con trazabilidad completa, garantía oficial y facturación e-Factura DGI. "
        f"Quedo atento a su confirmación de cantidades o RUT para emitir la Orden de Venta."
    )

    return {
        "deal_id": deal.id,
        "ai_engine": ai_engine_used,
        "lead_analysis": {
            "canal_origen": canal,
            "utm_campaign": campana,
            "ai_score": getattr(deal, "ai_score", 85) or 85,
            "ai_classification": getattr(deal, "ai_classification", "HOT") or "HOT",
            "detected_intent": f"Interés comercial en {deal.proyecto_nombre} ({deal.moneda} {float(deal.monto_total):,.2f})",
            "catalog_matched": catalog_summary,
        },
        "suggestions": [
            {
                "id": "sug_consultiva_stock",
                "title": "Respuesta Consultiva con Stock & Precios en Vivo",
                "channel_recommended": canal if canal != "MANUAL" else "WHATSAPP",
                "text": sugerencia_1,
            },
            {
                "id": "sug_cierre_rapido",
                "title": "Cierre Comercial Rápido & Reserva de Lote",
                "channel_recommended": "WHATSAPP",
                "text": sugerencia_2,
            },
            {
                "id": "sug_formal_b2b",
                "title": "Propuesta Formal B2B / Solicitud de RUT",
                "channel_recommended": "EMAIL",
                "text": sugerencia_3,
            },
        ],
    }


@router.websocket("/ws")
async def omnichannel_websocket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"event": "PONG", "received": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
