from datetime import timedelta
import pytest
from starlette.testclient import TestClient
from fastapi import HTTPException

from app.main import app
from app.core.security import create_access_token, decode_access_token
from app.core.config import JWT_SECRET_KEY, JWT_ALGORITHM


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_create_and_decode_access_token_success():
    """Valida la generación de token JWT y decodificación con claims correctos."""
    claims = {
        "sub": "user_operaciones",
        "role": "analista_operaciones"
    }
    token = create_access_token(claims, expires_delta=timedelta(minutes=30))
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = decode_access_token(token)
    assert decoded.user_id == "user_operaciones"
    assert decoded.role == "analista_operaciones"
    assert not decoded.is_admin()


def test_decode_token_expired():
    """Valida que un token con timestamp exp expirado lance 401 Unauthorized."""
    claims = {"sub": "user_exp", "role": "analista_comercial"}
    token = create_access_token(claims, expires_delta=timedelta(minutes=-5))

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)

    assert exc_info.value.status_code == 401
    assert "expirado" in exc_info.value.detail.lower()


def test_decode_token_tampered():
    """Valida que un token manipulado o con firma adulterada lance 401 Unauthorized."""
    claims = {"sub": "user_tamper", "role": "controller_admin"}
    token = create_access_token(claims, expires_delta=timedelta(minutes=30))
    tampered_token = token[:-4] + "wxyz"

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(tampered_token)

    assert exc_info.value.status_code == 401
    assert "inválido" in exc_info.value.detail.lower() or "firma" in exc_info.value.detail.lower()


def test_auth_login_success(client):
    """POST /api/v1/auth/login emite JWT válido para credenciales registradas."""
    payload = {
        "username": "admin",
        "password": "admin123"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "controller_admin"
    assert data["user_id"] == "admin"


def test_auth_login_invalid_credentials(client):
    """POST /api/v1/auth/login rechaza contraseña errónea con 401."""
    payload = {
        "username": "admin",
        "password": "wrong_password"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "inválidas" in response.json()["detail"].lower()


def test_auth_me_with_bearer_token(client):
    """GET /api/v1/auth/me resuelve el UserContext a partir de Authorization Bearer."""
    token = create_access_token({
        "sub": "usr_analyst_01",
        "role": "analista_comercial"
    })
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "usr_analyst_01"
    assert data["role"] == "analista_comercial"
    assert data["is_admin"] is False


def test_auth_admin_only_forbidden_with_insufficient_role(client):
    """GET /api/v1/auth/admin-only retorna 403 Forbidden cuando el rol no tiene privilegio."""
    token = create_access_token({
        "sub": "usr_comercial_02",
        "role": "analista_comercial"
    })
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/admin-only", headers=headers)
    assert response.status_code == 403
    assert "insuficientes" in response.json()["detail"].lower() or "controller_admin" in response.json()["detail"]


def test_auth_admin_only_allowed_with_controller_admin(client):
    """GET /api/v1/auth/admin-only retorna 200 OK con token de controller_admin."""
    token = create_access_token({
        "sub": "usr_controller_99",
        "role": "controller_admin"
    })
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/admin-only", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["role"] == "controller_admin"


def test_auth_admin_only_unauthorized_when_anonymous(client):
    """GET /api/v1/auth/admin-only sin credenciales retorna 401 Unauthorized."""
    response = client.get("/api/v1/auth/admin-only")
    assert response.status_code == 401
    assert "bearer" in response.json()["detail"].lower() or "autenticación" in response.json()["detail"].lower()


def test_auth_admin_only_unauthorized_with_malformed_header(client):
    """GET /api/v1/auth/admin-only con Bearer token corrupto retorna 401 Unauthorized."""
    headers = {"Authorization": "Bearer not.a.valid.jwt.token"}
    response = client.get("/api/v1/auth/admin-only", headers=headers)
    assert response.status_code == 401
