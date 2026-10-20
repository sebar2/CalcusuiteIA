#!/usr/bin/env python3
"""
SECURITY & QA GATE - PEAJE INNEGOCIABLE DE CALIDAD Y SEGURIDAD (CALCU SUITE)
=============================================================================
Este script audita automáticamente:
1. SAST Frontend/Backend: Tolerancia CERO a credenciales en texto plano (CWE-312/CWE-798),
   inputs con passwords hardcodeadas en DOM y console.log de secretos (CWE-532).
2. Paridad de Contratos API (Anti-404): Extrae rutas /api/v1/... del frontend y las
   contrasta contra app.routes de FastAPI.
3. Precisión Financiera: Verifica que no existan columnas Float en app/models/entities.py.
4. Smoke Test de Endpoints Críticos: Valida que /intendencias, /buyers, /competitors,
   /prices y /tenders respondan 200 OK.

Retorna 0 si todo está 100% conforme; de lo contrario aborta con código 1.
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from typing import List, Tuple, Set

# Habilitar UTF-8 y colores ANSI en stdout de Windows
if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_BOLD = "\033[1m"
COLOR_RESET = "\033[0m"

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def print_banner():
    print(f"\n{COLOR_CYAN}{COLOR_BOLD}====================================================================")
    print("      CALCU SUITE — SECURITY & QA QUALITY GATE (ZERO-FAIL GATE)     ")
    print(f"===================================================================={COLOR_RESET}\n")


def check_sast_and_dom_security() -> List[str]:
    """
    Audita tolerancia cero a secretos hardcodeados, inputs password con value literal
    y console.log de credenciales.
    """
    violations: List[str] = []

    # 1. Reglas Regex para inputs en DOM
    re_password_literal_1 = re.compile(
        r'<input[^>]*type=[\'"]password[\'"][^>]*value=[\'"][^\'"{]+[\'"]',
        re.IGNORECASE
    )
    re_password_literal_2 = re.compile(
        r'<input[^>]*value=[\'"][^\'"{]+[\'"][^>]*type=[\'"]password[\'"]',
        re.IGNORECASE
    )

    # 2. Búsqueda de palabra clave prohibida
    forbidden_needles = ["bato1420"]

    # 3. Logging de contraseñas
    re_console_password = re.compile(
        r'console\.log\([^)]*(password|secret_key|api_secret|access_token)[^)]*\)',
        re.IGNORECASE
    )

    scanned_exts = {".ts", ".tsx", ".py", ".html", ".js"}
    ignore_dirs = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", ".pytest_cache", ".system_generated"}

    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for f in files:
            p = Path(root) / f
            if p.suffix not in scanned_exts:
                continue

            # Evitar auto-detección en este mismo script
            if p.resolve() == Path(__file__).resolve():
                continue

            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            rel_path = p.relative_to(ROOT_DIR)

            # Verificar literal bato1420
            for needle in forbidden_needles:
                if needle in content:
                    violations.append(
                        f"[CWE-798 Hardcoded Credential] Detectada credencial prohibida '{needle}' en {rel_path}"
                    )

            # Verificar inputs en DOM
            if p.suffix in {".tsx", ".html", ".js"}:
                m1 = re_password_literal_1.search(content)
                m2 = re_password_literal_2.search(content)
                if m1 or m2:
                    snippet = (m1 or m2).group(0)
                    violations.append(
                        f"[CWE-312 Plaintext in DOM] Elemento password con value literal hardcodeado en {rel_path}: '{snippet[:60]}...'"
                    )

                # Verificar console.log
                c_match = re_console_password.search(content)
                if c_match:
                    violations.append(
                        f"[CWE-532 Sensitive Logging] console.log sospechoso de credencial en {rel_path}: '{c_match.group(0)[:60]}...'"
                    )

    return violations


def check_api_contract_parity() -> List[str]:
    """
    Audita que cada ruta /api/v1/... invocada en el frontend exista registrada en FastAPI.
    """
    violations: List[str] = []

    api_ts_path = ROOT_DIR / "frontend" / "src" / "services" / "api.ts"
    if not api_ts_path.exists():
        return [f"No se encontró archivo de contratos de API: {api_ts_path}"]

    api_content = api_ts_path.read_text(encoding="utf-8", errors="ignore")

    # Extraer URLs llamadas en api.ts (entre comillas simples, dobles o backticks)
    raw_calls = set(re.findall(r'[\'"`](/api/v1/[^\'"`?#]+)', api_content))

    # Cargar FastAPI app
    try:
        from app.main import app
    except Exception as exc:
        return [f"No se pudo instanciar la aplicación FastAPI: {exc}"]

    # Obtener todas las rutas registradas en FastAPI mediante openapi schema y routes
    fastapi_routes: Set[str] = set()
    try:
        openapi_schema = app.openapi()
        fastapi_routes.update(openapi_schema.get("paths", {}).keys())
    except Exception:
        pass

    for r in app.routes:
        if hasattr(r, "path"):
            fastapi_routes.add(r.path)
        if hasattr(r, "routes"):
            for sub in r.routes:
                if hasattr(sub, "path"):
                    fastapi_routes.add(sub.path)

    # Convertir rutas de FastAPI a patrones regex
    compiled_fastapi_patterns = []
    for far in fastapi_routes:
        # Reemplazar {param:path} por .+ y {param} por [^/]+
        pattern_str = "^" + re.sub(r'\{[^}:]+:path\}', r'.+', far)
        pattern_str = re.sub(r'\{[^}:]+\}', r'[^/]+', pattern_str) + "$"
        compiled_fastapi_patterns.append((far, re.compile(pattern_str)))

    # Validar cada ruta del frontend contra FastAPI
    for call in sorted(raw_calls):
        # Normalizar template strings tipo ${encodeURIComponent(code)} o ${id} a dummy value
        norm_call = re.sub(r'\$\{[^}]+\}', 'sample_val', call)

        matched = any(pattern.match(norm_call) for _, pattern in compiled_fastapi_patterns)
        if not matched:
            violations.append(
                f"[404 Contract Break] Frontend invoca '{call}' (normalizado: '{norm_call}') pero NO está registrada en FastAPI app.routes"
            )

    return violations


def check_financial_precision() -> List[str]:
    """
    Verifica que no se introduzcan columnas Float en app/models/entities.py.
    """
    violations: List[str] = []
    entities_path = ROOT_DIR / "app" / "models" / "entities.py"
    if not entities_path.exists():
        return [f"Archivo entities.py no encontrado: {entities_path}"]

    lines = entities_path.read_text(encoding="utf-8", errors="ignore").splitlines()

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        # Ignorar comentarios y docstrings
        if stripped.startswith("#") or stripped.startswith('"""') or stripped.startswith("*"):
            continue

        # Detectar columnas Column(Float...)
        if re.search(r'Column\s*\(\s*Float\b', stripped):
            violations.append(
                f"[Financial Precision Violation] Uso prohibido de Float en {entities_path}:{idx}: '{stripped}'"
            )

    return violations


def check_critical_endpoints_smoke() -> List[str]:
    """
    Ejecuta un smoke test sobre los endpoints críticos del bloque Licitaciones.
    """
    violations: List[str] = []
    try:
        from starlette.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        endpoints = [
            ("/api/v1/procurement/intendencias", 200),
            ("/api/v1/procurement/buyers", 200),
            ("/api/v1/procurement/competitors", 200),
            ("/api/v1/procurement/prices", 200),
            ("/api/v1/procurement/tenders", 200),
        ]

        for ep, expected_code in endpoints:
            res = client.get(ep)
            if res.status_code != expected_code:
                violations.append(
                    f"[Endpoint Health Failure] {ep} respondió HTTP {res.status_code} (esperado: {expected_code})"
                )
            else:
                body = res.json()
                if not body.get("success"):
                    violations.append(
                        f"[Endpoint Health Failure] {ep} devolvió success: false"
                    )
    except Exception as exc:
        violations.append(f"[Smoke Test Crash] Error ejecutando smoke tests: {exc}")

    return violations


def main():
    print_banner()
    start_time = time.time()
    total_failures = 0

    # 1. SAST & DOM Security
    print(f"[*] 1. Escaneando SAST & Seguridad DOM (CWE-312, CWE-798, CWE-532)...")
    sast_violations = check_sast_and_dom_security()
    if sast_violations:
        total_failures += len(sast_violations)
        print(f"    {COLOR_RED}[FAIL] Se encontraron {len(sast_violations)} violaciones de seguridad:{COLOR_RESET}")
        for v in sast_violations:
            print(f"      - {v}")
    else:
        print(f"    {COLOR_GREEN}[PASS] 0 credenciales hardcodeadas, 0 secretos en DOM, 0 logging inseguro.{COLOR_RESET}")

    # 2. API Contract Parity
    print(f"[*] 2. Auditando Paridad de Contratos API Frontend <-> FastAPI (Anti-404)...")
    parity_violations = check_api_contract_parity()
    if parity_violations:
        total_failures += len(parity_violations)
        print(f"    {COLOR_RED}[FAIL] Se encontraron {len(parity_violations)} descalces de contrato 404:{COLOR_RESET}")
        for v in parity_violations:
            print(f"      - {v}")
    else:
        print(f"    {COLOR_GREEN}[PASS] 100% de paridad. Todas las rutas de frontend están registradas en FastAPI.{COLOR_RESET}")

    # 3. Precisión Financiera
    print(f"[*] 3. Auditando Rigor Financiero (Decimal & Numeric(14, 4) sin tipos Float)...")
    precision_violations = check_financial_precision()
    if precision_violations:
        total_failures += len(precision_violations)
        print(f"    {COLOR_RED}[FAIL] Violaciones de precisión en entities.py:{COLOR_RESET}")
        for v in precision_violations:
            print(f"      - {v}")
    else:
        print(f"    {COLOR_GREEN}[PASS] Rigor financiero asegurado. Cero columnas Float en entidades.{COLOR_RESET}")

    # 4. Smoke Test Endpoints
    print(f"[*] 4. Smoke Test de Endpoints Críticos (/intendencias, /buyers, /competitors, /prices, /tenders)...")
    smoke_violations = check_critical_endpoints_smoke()
    if smoke_violations:
        total_failures += len(smoke_violations)
        print(f"    {COLOR_RED}[FAIL] Fallas en smoke tests:{COLOR_RESET}")
        for v in smoke_violations:
            print(f"      - {v}")
    else:
        print(f"    {COLOR_GREEN}[PASS] Todos los endpoints críticos responden HTTP 200 con éxito.{COLOR_RESET}")

    elapsed = round(time.time() - start_time, 2)
    print("\n--------------------------------------------------------------------")
    if total_failures == 0:
        print(f"{COLOR_GREEN}{COLOR_BOLD}>>> RESULTADO: PEAJE DE CALIDAD Y SEGURIDAD APROBADO [PASS] ({elapsed}s){COLOR_RESET}")
        print("El código cumple con todos los estándares para entrega a producción.\n")
        sys.exit(0)
    else:
        print(f"{COLOR_RED}{COLOR_BOLD}>>> RESULTADO: PEAJE BLOQUEADO [FAIL] - {total_failures} INFRACCIONES ({elapsed}s){COLOR_RESET}")
        print("La entrega está VETADA hasta corregir la totalidad de las infracciones listadas arriba.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
