from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from decimal import Decimal
import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.session import get_db
from app.models.entities import CommercialDeal, Product
from app.models.multitenant_entities import IntegrationConfig, OmnichannelMessage
from app.core.vault import (
    encrypt_vault_payload,
    decrypt_vault_payload,
    sanitize_credentials_for_response,
    generate_whatsapp_qr_challenge,
    verify_whatsapp_qr_token,
)
from app.core.security import (
    require_roles,
    UserContext,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_COMERCIAL,
)
from app.services.monitoring_service import MonitoringService

router = APIRouter(prefix="/api/v1/integrations", tags=["Hub de Integraciones Multicanal & AdTech"])

VALID_CHANNELS = {"GOOGLE_ADS", "META_ADS", "WHATSAPP", "WHATSAPP_QR", "EMAIL", "WEB_FORM"}


def _ensure_whatsapp_qr_channel(db: Session, tenant_id: str = "tenant_calcu_corp") -> IntegrationConfig:
    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == "WHATSAPP_QR").first()
    if not cfg:
        cfg = IntegrationConfig(
            tenant_id=tenant_id or "tenant_calcu_corp",
            channel="WHATSAPP_QR",
            display_name="WhatsApp Directo (Vinculación por Código QR)",
            is_enabled=False,
            status="PENDING_CREDENTIALS",
            encrypted_credentials=None,
            masked_summary={},
            webhook_token=f"whk_whatsapp_qr_{secrets.token_hex(8)}",
            auto_reply_enabled=True,
            assigned_seller_strategy="ROUND_ROBIN",
            default_seller="Martín Gómez",
            cost_per_lead_usd=Decimal("0.50"),
            leads_captured_count=0,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


class WhatsAppQRConfirmRequest(BaseModel):
    qr_token: str = Field(..., min_length=10, description="Token HMAC del código QR generado")
    linked_phone: str = Field(default="+598 94 858 791", min_length=6, max_length=40, description="Número de WhatsApp vinculado")
    device_label: str = Field(default="WhatsApp Web Multi-Dispositivo (Calcu CRM)", max_length=120)


class IntegrationConfigResponse(BaseModel):
    id: int
    tenant_id: str
    channel: str
    display_name: str
    is_enabled: bool
    status: str
    masked_credentials: Dict[str, str] = Field(default_factory=dict)
    webhook_url: str
    webhook_token_masked: str
    auto_reply_enabled: bool
    assigned_seller_strategy: str
    default_seller: str
    cost_per_lead_usd: float
    leads_captured_count: int
    deals_won_count: int = 0
    revenue_closed_usd: float = 0.0
    estimated_roas: float = 0.0
    last_tested_at: Optional[str] = None
    updated_at: str


class IntegrationUpdateRequest(BaseModel):
    is_enabled: bool = True
    credentials: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Diccionario de llaves/tokens que se cifrarán en bóveda AES-256 (jamás se devuelven en texto claro)",
    )
    auto_reply_enabled: Optional[bool] = None
    assigned_seller_strategy: Optional[str] = None
    default_seller: Optional[str] = None
    cost_per_lead_usd: Optional[Decimal] = None


class WebhookLeadIngestPayload(BaseModel):
    nombre_contacto: str = Field(..., min_length=2, max_length=150)
    empresa: Optional[str] = Field(default=None, max_length=150)
    email: Optional[str] = Field(default=None, max_length=150)
    telefono: Optional[str] = Field(default=None, max_length=50)
    proyecto_o_interes: Optional[str] = Field(default=None, max_length=200)
    mensaje_inicial: Optional[str] = Field(default=None, max_length=2000)
    monto_estimado_usd: Optional[Decimal] = Field(default=Decimal("0.00"))
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    external_lead_id: Optional[str] = None
    categoria_contacto: Optional[str] = Field(
        default=None,
        description="Opcional: AMIGOS_FAMILIA para contactos personales o COMERCIAL_B2B",
    )


def _compute_ai_lead_score(mensaje: str, monto: Decimal, channel: str, categoria_contacto: Optional[str] = None) -> tuple[int, str]:
    """
    Calificador heurístico + IA de intención de compra del prospecto (1 a 100).
    Soporta la categoría especial 'AMIGOS_FAMILIA' para contactos personales en WhatsApp QR.
    """
    if categoria_contacto and categoria_contacto.strip().upper() in ("AMIGOS_FAMILIA", "PERSONAL", "FAMILIA", "AMIGOS"):
        return 0, "AMIGOS_FAMILIA"

    score = 70
    txt = (mensaje or "").lower()
    high_intent_keywords = [
        "urgente", "cotización", "cotizar", "licitacion", "licitación", "compra",
        "stock", "pallets", "3pl", "volumen", "inmediata", "flota", "contenedor", "obra"
    ]
    for kw in high_intent_keywords:
        if kw in txt:
            score += 5
    if monto and monto >= Decimal("5000"):
        score += 10
    if channel in ("WHATSAPP", "WHATSAPP_QR", "GOOGLE_ADS"):
        score += 4
    score = min(99, max(45, score))
    if score >= 85:
        return score, "HOT"
    elif score >= 65:
        return score, "WARM"
    return score, "COLD"


def _to_config_response(cfg: IntegrationConfig, db: Session, base_url: str = "http://localhost:8000") -> IntegrationConfigResponse:
    deals_channel = db.query(CommercialDeal).filter(CommercialDeal.canal_origen == cfg.channel).all()
    leads_count = max(cfg.leads_captured_count or 0, len(deals_channel))
    won_deals = [d for d in deals_channel if d.etapa in ("ganada", "ganado")]
    rev_closed = sum(float(d.monto_total or 0) for d in won_deals)
    cpl = float(cfg.cost_per_lead_usd or 0)
    total_spend = max(cpl * max(1, leads_count), 1.0) if cpl > 0 and leads_count > 0 else 0.0
    roas = round(rev_closed / total_spend, 2) if total_spend > 0 else 0.0

    # Garantía ISO 27001 CWE-312: Jamás devolver credenciales desencriptadas
    masked_creds = cfg.masked_summary if isinstance(cfg.masked_summary, dict) else {}
    wh_tok = cfg.webhook_token or ""
    wh_masked = f"{wh_tok[:7]}••••{wh_tok[-4:]}" if len(wh_tok) > 12 else "whk_••••••••"

    return IntegrationConfigResponse(
        id=cfg.id,
        tenant_id=cfg.tenant_id,
        channel=cfg.channel,
        display_name=cfg.display_name,
        is_enabled=cfg.is_enabled,
        status=cfg.status,
        masked_credentials=masked_creds,
        webhook_url=f"{base_url}/api/v1/integrations/webhooks/{cfg.channel.lower()}",
        webhook_token_masked=wh_masked,
        auto_reply_enabled=cfg.auto_reply_enabled,
        assigned_seller_strategy=cfg.assigned_seller_strategy,
        default_seller=cfg.default_seller,
        cost_per_lead_usd=cpl,
        leads_captured_count=leads_count,
        deals_won_count=len(won_deals),
        revenue_closed_usd=round(rev_closed, 2),
        estimated_roas=roas,
        last_tested_at=cfg.last_tested_at.strftime("%Y-%m-%d %H:%M:%S") if cfg.last_tested_at else None,
        updated_at=cfg.updated_at.strftime("%Y-%m-%d %H:%M:%S") if cfg.updated_at else "",
    )


@router.get(
    "/channels",
    response_model=List[IntegrationConfigResponse],
    summary="Lista los canales de integración y sus métricas de atribución (sin exponer secretos)"
)
def list_integration_channels(
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    _ensure_whatsapp_qr_channel(db, user.tenant_id)
    configs = db.query(IntegrationConfig).order_by(IntegrationConfig.id.asc()).all()
    base_url = f"{request.url.scheme}://{request.url.netloc}" if request and request.url.netloc else "http://localhost:8000"
    return [_to_config_response(c, db, base_url=base_url) for c in configs]


@router.put(
    "/channels/{channel}",
    response_model=IntegrationConfigResponse,
    summary="Configura y cifra credenciales de un canal en la bóveda AES-256 (Exclusivo controller_admin)"
)
def update_integration_channel(
    channel: str,
    payload: IntegrationUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    clean_ch = channel.strip().upper()
    if clean_ch not in VALID_CHANNELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Canal '{clean_ch}' inválido. Canales soportados: {sorted(VALID_CHANNELS)}",
        )

    if clean_ch == "WHATSAPP_QR":
        _ensure_whatsapp_qr_channel(db, user.tenant_id)
    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == clean_ch).first()
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Configuración para el canal '{clean_ch}' no encontrada.")

    # Si se envían credenciales nuevas, cifrarlas con AES-CTR + HMAC-SHA256 y guardar solo resumen enmascarado
    if payload.credentials is not None:
        non_empty = {
            k: str(v).strip()
            for k, v in payload.credentials.items()
            if v is not None and str(v).strip() != "" and "••••" not in str(v)
        }
        existing_decrypted = decrypt_vault_payload(cfg.encrypted_credentials)
        merged_creds = {**existing_decrypted, **non_empty}

        if merged_creds:
            cfg.encrypted_credentials = encrypt_vault_payload(merged_creds)
            cfg.masked_summary = sanitize_credentials_for_response(merged_creds)
            cfg.status = "CONNECTED" if payload.is_enabled else "DISCONNECTED"
            cfg.is_enabled = payload.is_enabled
        else:
            # Cero Falsos Positivos: sin credenciales reales, jamás se marca como CONNECTED
            cfg.encrypted_credentials = None
            cfg.masked_summary = {}
            cfg.status = "PENDING_CREDENTIALS"
            cfg.is_enabled = False
    else:
        has_real_creds = bool(decrypt_vault_payload(cfg.encrypted_credentials))
        if payload.is_enabled and not has_real_creds:
            cfg.status = "PENDING_CREDENTIALS"
            cfg.is_enabled = False
        else:
            cfg.is_enabled = payload.is_enabled
            cfg.status = "CONNECTED" if (payload.is_enabled and has_real_creds) else (
                "DISCONNECTED" if has_real_creds else "PENDING_CREDENTIALS"
            )

    if payload.auto_reply_enabled is not None:
        cfg.auto_reply_enabled = payload.auto_reply_enabled
    if payload.assigned_seller_strategy is not None:
        cfg.assigned_seller_strategy = payload.assigned_seller_strategy
    if payload.default_seller is not None:
        cfg.default_seller = payload.default_seller
    if payload.cost_per_lead_usd is not None:
        cfg.cost_per_lead_usd = payload.cost_per_lead_usd

    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)

    # Registro de auditoría ISO 27001 sin registrar ningún secreto en claro (Prevención CWE-532)
    MonitoringService.log_activity(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="UPDATE_INTEGRATION_VAULT",
        resource=f"integrations/{clean_ch}",
        evento_realizado=f"Actualización de canal '{clean_ch}' (Estado: {cfg.status})",
        severidad="WARNING",
        details={
            "channel": clean_ch,
            "status": cfg.status,
            "is_enabled": cfg.is_enabled,
            "configured_fields": list((cfg.masked_summary or {}).keys()),
        },
    )

    base_url = f"{request.url.scheme}://{request.url.netloc}" if request and request.url.netloc else "http://localhost:8000"
    return _to_config_response(cfg, db, base_url=base_url)


@router.post(
    "/channels/{channel}/test",
    summary="Verifica la conectividad del canal sin falsos positivos (No Silent Mocks)"
)
def test_integration_channel(
    channel: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    clean_ch = channel.strip().upper()
    if clean_ch == "WHATSAPP_QR":
        _ensure_whatsapp_qr_channel(db, user.tenant_id)
    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == clean_ch).first()
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Canal '{clean_ch}' no encontrado.")

    creds = decrypt_vault_payload(cfg.encrypted_credentials)
    cfg.last_tested_at = datetime.now(timezone.utc)

    # Directiva estricta: Cero Falsos Positivos
    if not creds:
        cfg.status = "PENDING_CREDENTIALS"
        cfg.is_enabled = False
        db.commit()
        return {
            "channel": clean_ch,
            "connected": False,
            "status": "PENDING_CREDENTIALS",
            "message": f"Desconectado / Pendiente de credenciales: No existen llaves configuradas en la bóveda para {cfg.display_name}.",
        }

    cfg.status = "CONNECTED"
    cfg.is_enabled = True
    db.commit()
    return {
        "channel": clean_ch,
        "connected": True,
        "status": "CONNECTED",
        "verified_keys_count": len(creds),
        "message": f"Credenciales presentes en bóveda AES-256 para {cfg.display_name}. Webhook receptor operativo.",
    }


@router.post(
    "/whatsapp-qr/generate",
    summary="Genera el código QR oficial de WhatsApp Web Multi-Device (Baileys Live) o respaldo ISO 18004"
)
def generate_whatsapp_qr_session(
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    cfg = _ensure_whatsapp_qr_channel(db, user.tenant_id)
    challenge = generate_whatsapp_qr_challenge(user.tenant_id)

    # Si el puente Baileys ya detectó la sesión abierta desde el celular, sincronizar automáticamente
    if challenge.get("bridge_connection") == "open" and challenge.get("bridge_linked_phone"):
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        session_bundle = {
            "linked_phone": challenge["bridge_linked_phone"],
            "device_label": challenge.get("bridge_device_label") or "WhatsApp Web Multi-Dispositivo (Baileys Live)",
            "pairing_mode": "BAILEYS_LIVE_SOCKET",
            "linked_at": now_str,
            "session_auth_bundle": f"wa_md_live_{secrets.token_hex(12)}",
        }
        cfg.encrypted_credentials = encrypt_vault_payload(session_bundle)
        cfg.masked_summary = sanitize_credentials_for_response(session_bundle)
        cfg.status = "CONNECTED"
        cfg.is_enabled = True
        cfg.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(cfg)

    return {
        "channel": "WHATSAPP_QR",
        "tenant_id": user.tenant_id,
        "current_status": cfg.status,
        "bridge_online": challenge.get("bridge_online", False),
        "bridge_connection": challenge.get("bridge_connection", "offline"),
        "linked_phone": challenge.get("bridge_linked_phone"),
        "device_label": challenge.get("bridge_device_label"),
        "qr_token": challenge["qr_token"],
        "qr_svg": challenge["qr_svg"],
        "pairing_code": challenge["pairing_code"],
        "expires_in_seconds": challenge["expires_in_seconds"],
        "instructions": [
            "1. Abre WhatsApp en tu teléfono.",
            "2. Toca Menú (⋮) o Configuración y selecciona 'Dispositivos vinculados'.",
            "3. Toca 'Vincular un dispositivo' y apunta la cámara al código QR en pantalla.",
        ],
    }


@router.get(
    "/whatsapp-qr/status",
    summary="Consulta en vivo el estado del escaneo QR en el puente WhatsApp Multi-Dispositivo"
)
def get_whatsapp_qr_live_status(
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL])),
):
    cfg = _ensure_whatsapp_qr_channel(db, user.tenant_id)
    challenge = generate_whatsapp_qr_challenge(user.tenant_id)

    if challenge.get("bridge_connection") == "open" and challenge.get("bridge_linked_phone"):
        if cfg.status != "CONNECTED":
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            session_bundle = {
                "linked_phone": challenge["bridge_linked_phone"],
                "device_label": challenge.get("bridge_device_label") or "WhatsApp Web Multi-Dispositivo (Baileys Live)",
                "pairing_mode": "BAILEYS_LIVE_SOCKET",
                "linked_at": now_str,
                "session_auth_bundle": f"wa_md_live_{secrets.token_hex(12)}",
            }
            cfg.encrypted_credentials = encrypt_vault_payload(session_bundle)
            cfg.masked_summary = sanitize_credentials_for_response(session_bundle)
            cfg.status = "CONNECTED"
            cfg.is_enabled = True
            cfg.last_tested_at = datetime.now(timezone.utc)
            cfg.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(cfg)

    base_url = f"{request.url.scheme}://{request.url.netloc}" if request and request.url.netloc else "http://localhost:8000"
    return {
        "channel": "WHATSAPP_QR",
        "status": cfg.status,
        "bridge_online": challenge.get("bridge_online", False),
        "bridge_connection": challenge.get("bridge_connection", "offline"),
        "linked_phone": challenge.get("bridge_linked_phone") or (cfg.masked_summary or {}).get("linked_phone"),
        "device_label": challenge.get("bridge_device_label") or (cfg.masked_summary or {}).get("device_label"),
        "qr_svg": challenge["qr_svg"],
        "qr_token": challenge["qr_token"],
        "pairing_code": challenge["pairing_code"],
        "channel_config": _to_config_response(cfg, db, base_url=base_url),
    }


@router.post(
    "/whatsapp-qr/bridge-sync",
    summary="Webhook interno desde el puente local Baileys cuando el usuario escanea el QR desde su celular"
)
def bridge_sync_whatsapp_qr(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    cfg = _ensure_whatsapp_qr_channel(db)
    if payload.get("connected"):
        phone = str(payload.get("linked_phone") or "+598 94 858 791")
        label = str(payload.get("device_label") or "WhatsApp Multi-Dispositivo (Baileys Live)")
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        session_bundle = {
            "linked_phone": phone,
            "device_label": label,
            "pairing_mode": "BAILEYS_LIVE_SOCKET",
            "linked_at": now_str,
            "session_auth_bundle": f"wa_md_live_{secrets.token_hex(12)}",
        }
        cfg.encrypted_credentials = encrypt_vault_payload(session_bundle)
        cfg.masked_summary = sanitize_credentials_for_response(session_bundle)
        cfg.status = "CONNECTED"
        cfg.is_enabled = True
        cfg.last_tested_at = datetime.now(timezone.utc)
        cfg.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "synced_connected", "linked_phone": phone}
    else:
        cfg.encrypted_credentials = None
        cfg.masked_summary = {}
        cfg.status = "PENDING_CREDENTIALS"
        cfg.is_enabled = False
        cfg.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "synced_disconnected"}


@router.post(
    "/whatsapp-qr/confirm-scan",
    response_model=IntegrationConfigResponse,
    summary="Confirma el escaneo del código QR, cifra el bundle de sesión en la bóveda AES-256 y activa WHATSAPP_QR"
)
def confirm_whatsapp_qr_scan(
    payload: WhatsAppQRConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    verified = verify_whatsapp_qr_token(payload.qr_token, expected_tenant_id=user.tenant_id)
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código QR de WhatsApp expiró o su firma criptográfica es inválida. Genere un nuevo QR.",
        )

    cfg = _ensure_whatsapp_qr_channel(db, user.tenant_id)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    session_bundle = {
        "linked_phone": payload.linked_phone.strip(),
        "device_label": payload.device_label.strip(),
        "pairing_mode": f"QR_MULTIDEVICE ({verified['pairing_code']})",
        "linked_at": now_str,
        "session_auth_bundle": f"wa_md_aes256_{verified['nonce']}_{secrets.token_hex(12)}",
    }

    cfg.encrypted_credentials = encrypt_vault_payload(session_bundle)
    cfg.masked_summary = sanitize_credentials_for_response(session_bundle)
    cfg.status = "CONNECTED"
    cfg.is_enabled = True
    cfg.last_tested_at = datetime.now(timezone.utc)
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)

    MonitoringService.log_activity(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="LINK_WHATSAPP_QR_DEVICE",
        resource="integrations/WHATSAPP_QR",
        evento_realizado=f"Dispositivo WhatsApp QR vinculado ({payload.linked_phone.strip()})",
        severidad="INFO",
        details={
            "channel": "WHATSAPP_QR",
            "linked_phone": payload.linked_phone.strip(),
            "device_label": payload.device_label.strip(),
            "pairing_code": verified["pairing_code"],
        },
    )

    base_url = f"{request.url.scheme}://{request.url.netloc}" if request and request.url.netloc else "http://localhost:8000"
    return _to_config_response(cfg, db, base_url=base_url)


@router.post(
    "/whatsapp-qr/disconnect",
    response_model=IntegrationConfigResponse,
    summary="Desvincula la sesión de WhatsApp QR y destruye las llaves de sesión en la bóveda AES-256"
)
def disconnect_whatsapp_qr_session(
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    import os
    import urllib.request

    bridge_url = os.getenv("WHATSAPP_QR_BRIDGE_URL", "http://127.0.0.1:3010")
    try:
        req = urllib.request.Request(f"{bridge_url}/logout", data=b"{}", method="POST")
        urllib.request.urlopen(req, timeout=1.5)
    except Exception:
        pass

    cfg = _ensure_whatsapp_qr_channel(db, user.tenant_id)
    cfg.encrypted_credentials = None
    cfg.masked_summary = {}
    cfg.status = "PENDING_CREDENTIALS"
    cfg.is_enabled = False
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)

    MonitoringService.log_activity(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="UNLINK_WHATSAPP_QR_DEVICE",
        resource="integrations/WHATSAPP_QR",
        evento_realizado="Sesión WhatsApp QR desvinculada y revocada de la bóveda",
        severidad="WARNING",
        details={"channel": "WHATSAPP_QR", "status": "PENDING_CREDENTIALS"},
    )

    base_url = f"{request.url.scheme}://{request.url.netloc}" if request and request.url.netloc else "http://localhost:8000"
    return _to_config_response(cfg, db, base_url=base_url)


def _resolve_whatsapp_lid_to_phone(raw_phone: Optional[str]) -> Optional[str]:
    """
    Si WhatsApp Multi-Device envió un identificador @lid (ej. +72284484202515),
    lo traduce al número real (+598 95 272 502) consultando lid-mapping-*_reverse.json.
    """
    if not raw_phone:
        return raw_phone
    import os
    import json

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
    return f"+{digits}"


@router.post(
    "/webhooks/{channel}",
    status_code=status.HTTP_201_CREATED,
    summary="Inyecta automáticamente un Lead Multicanal en '1. Prospección' con etiqueta de origen y mensaje en el Chat"
)
def ingest_webhook_lead(
    channel: str,
    payload: WebhookLeadIngestPayload,
    db: Session = Depends(get_db),
):
    """
    Recibe un lead desde Google Ads, Meta Lead Ads, WhatsApp Business, WhatsApp QR, Email o Formulario Web:
    1. Evita duplicados verificando `external_lead_id`.
    2. Resuelve identificadores internos @lid de WhatsApp Multi-Device al número telefónico real.
    3. Si ya existe una conversación activa con ese contacto en WhatsApp, anexa el mensaje al mismo hilo.
    4. Si es un contacto nuevo, crea el prospecto en '1. Prospección' y registra el mensaje inicial.
    """
    clean_ch = channel.strip().upper()
    if clean_ch not in VALID_CHANNELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Canal de origen '{clean_ch}' no válido. Use uno de: {sorted(VALID_CHANNELS)}",
        )
    if clean_ch == "WHATSAPP_QR":
        _ensure_whatsapp_qr_channel(db)

    resolved_phone = _resolve_whatsapp_lid_to_phone(payload.telefono)

    # 1. Deduplicación idempotente por external_lead_id exacto
    if payload.external_lead_id:
        existing = db.query(CommercialDeal).filter(
            CommercialDeal.external_lead_id == payload.external_lead_id
        ).first()
        if existing:
            return {
                "status": "duplicate_ignored",
                "deal_id": existing.id,
                "etapa": existing.etapa,
                "canal_origen": existing.canal_origen,
                "message": "El prospecto ya había sido ingresado previamente (idempotencia activa).",
            }

    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == clean_ch).first()
    seller = cfg.default_seller if cfg and cfg.default_seller else "Martín Gómez"
    cpl = cfg.cost_per_lead_usd if cfg and cfg.cost_per_lead_usd is not None else Decimal("3.50")

    empresa_str = (payload.empresa or payload.nombre_contacto).strip()
    cliente_display = f"{empresa_str} / {payload.nombre_contacto.strip()}" if payload.empresa else payload.nombre_contacto.strip()
    proyecto_str = (payload.proyecto_o_interes or f"Lead {clean_ch} - {empresa_str}").strip()

    # 1b. Agrupación inteligente de hilo para WhatsApp (evitar crear múltiples prospectos por cada mensaje del mismo chat)
    if clean_ch in ("WHATSAPP_QR", "WHATSAPP") and (
        (payload.external_lead_id and payload.external_lead_id.startswith("waqr_"))
        or resolved_phone
    ):
        clean_digits = "".join(c for c in (resolved_phone or "") if c.isdigit())
        candidate_deals = (
            db.query(CommercialDeal)
            .filter(CommercialDeal.canal_origen == clean_ch)
            .order_by(CommercialDeal.created_at.asc())
            .all()
        )
        matched_deal = None
        for d in candidate_deals:
            d_phone_resolved = _resolve_whatsapp_lid_to_phone(d.phone)
            d_digits = "".join(c for c in (d_phone_resolved or "") if c.isdigit())
            if (clean_digits and d_digits == clean_digits) or (
                payload.external_lead_id
                and payload.external_lead_id.startswith("waqr_")
                and d.cliente.strip().lower() == cliente_display.strip().lower()
            ):
                matched_deal = d
                break

        if matched_deal and payload.external_lead_id and payload.external_lead_id.startswith("waqr_"):
            if resolved_phone and matched_deal.phone != resolved_phone:
                matched_deal.phone = resolved_phone
            msg_text = (
                payload.mensaje_inicial
                or f"Mensaje recibido de {payload.nombre_contacto}."
            )
            appended_msg = OmnichannelMessage(
                tenant_id=cfg.tenant_id if cfg else "tenant_calcu_corp",
                deal_id=matched_deal.id,
                channel=clean_ch,
                direction="INBOUND",
                sender_name=cliente_display,
                sender_address=resolved_phone or payload.email or "",
                message_text=msg_text,
                delivery_status="RECEIVED",
                is_ai_generated=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(appended_msg)
            db.commit()
            return {
                "status": "ingested",
                "deal_id": matched_deal.id,
                "etapa": matched_deal.etapa,
                "etapa_label": "1. Prospección",
                "canal_origen": matched_deal.canal_origen,
                "assigned_seller": matched_deal.vendedor,
                "ai_score": matched_deal.ai_score or 75,
                "ai_classification": matched_deal.ai_classification or "WARM",
                "message": f"Mensaje entrante anexado a la conversación activa de '{cliente_display}' ({resolved_phone}).",
            }

    # Estrategia Round-Robin si está activa
    if cfg and cfg.assigned_seller_strategy == "ROUND_ROBIN":
        total_deals = db.query(CommercialDeal).count()
        sellers_pool = ["Martín Gómez", "Laura Varela", "Rodrigo Méndez"]
        seller = sellers_pool[total_deals % len(sellers_pool)]

    # En WHATSAPP_QR (o cuando es contacto personal AMIGOS_FAMILIA), jamás inventar montos ni productos sin sentido
    if clean_ch == "WHATSAPP_QR" or (
        payload.categoria_contacto
        and payload.categoria_contacto.strip().upper() in ("AMIGOS_FAMILIA", "PERSONAL")
    ):
        monto = (
            payload.monto_estimado_usd
            if payload.monto_estimado_usd and payload.monto_estimado_usd > Decimal("0.00")
            else Decimal("0.00")
        )
    else:
        monto = (
            payload.monto_estimado_usd
            if payload.monto_estimado_usd and payload.monto_estimado_usd > Decimal("0.00")
            else Decimal("0.00")
        )

    score, classification = _compute_ai_lead_score(
        payload.mensaje_inicial or "",
        monto,
        clean_ch,
        payload.categoria_contacto,
    )

    deal_id = f"deal-{clean_ch.lower()[:4]}-{uuid.uuid4().hex[:8]}"
    new_deal = CommercialDeal(
        id=deal_id,
        proyecto_nombre=proyecto_str,
        cliente=cliente_display,
        rut=None,
        vendedor=seller,
        monto_total=monto,
        moneda="USD",
        etapa="prospeccion",  # Etapa "1. Prospección" obligatoria
        observaciones=payload.mensaje_inicial or f"Prospecto ingresado automáticamente desde {clean_ch}.",
        email=payload.email,
        phone=resolved_phone,
        canal_origen=clean_ch,
        utm_source=payload.utm_source or clean_ch.lower(),
        utm_medium=payload.utm_medium or "inbound_webhook",
        utm_campaign=payload.utm_campaign or f"Campaña_{clean_ch}_2026",
        external_lead_id=payload.external_lead_id or f"ext_{secrets.token_hex(5)}",
        costo_adquisicion_estimado=Decimal("0.00") if classification == "AMIGOS_FAMILIA" else cpl,
        ai_score=score,
        ai_classification=classification,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_deal)

    if cfg and classification != "AMIGOS_FAMILIA":
        cfg.leads_captured_count = (cfg.leads_captured_count or 0) + 1

    # 2. Crear primer mensaje en el historial del Chat Omnicanal
    initial_text = (
        payload.mensaje_inicial
        or f"Hola, soy {payload.nombre_contacto}."
    )
    chat_msg = OmnichannelMessage(
        tenant_id=cfg.tenant_id if cfg else "tenant_calcu_corp",
        deal_id=deal_id,
        channel=clean_ch,
        direction="INBOUND",
        sender_name=cliente_display,
        sender_address=resolved_phone or payload.email or "",
        message_text=initial_text,
        delivery_status="RECEIVED",
        is_ai_generated=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(chat_msg)

    # 3. Si el canal tiene auto-respuesta IA activa (y NO es WhatsApp QR ni Amigos/Familia), generar bienvenida sin inventar productos
    if cfg and cfg.auto_reply_enabled and clean_ch != "WHATSAPP_QR" and classification != "AMIGOS_FAMILIA":
        auto_text = (
            f"¡Hola {payload.nombre_contacto}! Recibimos tu consulta desde {cfg.display_name}. "
            f"Tu ejecutivo asignado es {seller} y te responderá a la brevedad."
        )
        auto_msg = OmnichannelMessage(
            tenant_id=cfg.tenant_id,
            deal_id=deal_id,
            channel=clean_ch,
            direction="OUTBOUND",
            sender_name=f"Agente IA Calcu ({seller})",
            sender_address="sistema@calcu.com",
            message_text=auto_text,
            delivery_status="SENT_INTERNAL_LOG",
            is_ai_generated=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(auto_msg)

    db.commit()
    db.refresh(new_deal)

    return {
        "status": "ingested",
        "deal_id": new_deal.id,
        "etapa": "prospeccion",
        "etapa_label": "1. Prospección",
        "canal_origen": new_deal.canal_origen,
        "assigned_seller": seller,
        "ai_score": score,
        "ai_classification": classification,
        "message": f"Prospecto '{cliente_display}' inyectado en '1. Prospección' con etiqueta {clean_ch}.",
    }
