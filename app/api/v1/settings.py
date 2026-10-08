from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.domain.models import UserPreference
from app.domain.schemas import (
    UserPreferenceUpdate,
    UserPreferenceResponse,
)

router = APIRouter(prefix="/api/v1/settings", tags=["Configuración & Preferencias"])


@router.get(
    "/preferences",
    response_model=UserPreferenceResponse,
    summary="Obtener preferencias de usuario",
    description="Devuelve las preferencias guardadas del usuario (tema, filtros favoritos, columnas visibles y última vista). Si no existen, inicializa un perfil por defecto."
)
def get_user_preferences(
    user_id: str = Query(default="default_user", description="Identificador único del usuario"),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    if not pref:
        pref = UserPreference(
            user_id=user_id,
            active_theme="light_bitrix",
            saved_filters={
                "categoria": "Todas",
                "only_alerts": False,
                "lead_time_min": 0,
                "periodo": "2025-09"
            },
            visible_columns=[
                "sku", "nombre", "categoria", "stock_actual", "rop", "doh", "is_alert"
            ],
            last_view="control_room"
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return pref


@router.post(
    "/preferences",
    response_model=UserPreferenceResponse,
    summary="Guardar o actualizar preferencias de usuario",
    description="Actualiza filtros favoritos, vistas predeterminadas, presets de simulación de pricing y modo visual (light_bitrix/dark)."
)
def update_user_preferences(
    payload: UserPreferenceUpdate,
    db: Session = Depends(get_db)
):
    target_user = payload.user_id or "default_user"
    pref = db.query(UserPreference).filter(UserPreference.user_id == target_user).first()
    
    if not pref:
        pref = UserPreference(
            user_id=target_user,
            active_theme=payload.active_theme or "light_bitrix",
            default_engine_mode=payload.default_engine_mode or "auto",
            saved_filters=payload.saved_filters if payload.saved_filters is not None else {
                "categoria": "Todas",
                "only_alerts": False,
                "lead_time_min": 0,
                "periodo": "2025-09"
            },
            visible_columns=payload.visible_columns if payload.visible_columns is not None else [
                "sku", "nombre", "categoria", "stock_actual", "rop", "doh", "is_alert"
            ],
            last_view=payload.last_view or "control_room",
            updated_at=datetime.now(timezone.utc)
        )
        db.add(pref)
    else:
        if payload.active_theme is not None:
            pref.active_theme = payload.active_theme
        if payload.default_engine_mode is not None:
            pref.default_engine_mode = payload.default_engine_mode
        if payload.saved_filters is not None:
            pref.saved_filters = payload.saved_filters
        if payload.visible_columns is not None:
            pref.visible_columns = payload.visible_columns
        if payload.last_view is not None:
            pref.last_view = payload.last_view
        pref.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(pref)
    return pref
