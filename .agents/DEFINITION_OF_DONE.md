# DEFINITION OF DONE & QUALITY GATE - CALCU SUITE
=============================================================================

### REGLA DE BLOQUEO DE ENTREGA (QUALITY & SECURITY GATE OBLIGATORIO)

**PROHIBIDO finalizar una respuesta de desarrollo sin antes ejecutar mediante `run_command`:**
1. `python scripts/security_qa_gate.py`
2. `npm run build` (o `tsc -b` en `frontend/`)
3. `pytest`

**Si cualquiera de los 3 comandos arroja un error o advertencia de seguridad (CWE-312, CWE-798, CWE-532, 404 Contract Break o fallo de test), el agente tiene PROHIBIDO entregar el trabajo y debe corregirlo obligatoriamente en el mismo turno.**

---

### Verificaciones Automáticas del Security & QA Gate (`scripts/security_qa_gate.py`):
1. **SAST & Seguridad DOM (Tolerancia Cero Secretos)**:
   - Prohibido cualquier valor hardcodeado en `<input type="password" value="...">`.
   - Prohibido cualquier token o secreto hardcodeado en frontend o backend.
   - Prohibido `console.log` de contraseñas, tokens o secretos (CWE-532).
   - Obligatorio `autoComplete="current-password"`, `autoComplete="new-password"` o `autoComplete="off"` en inputs de contraseña.
2. **Paridad de Contratos API (Anti-404)**:
   - El 100% de las rutas `/api/v1/...` invocadas en `frontend/src/services/api.ts` deben existir y coincidir con rutas registradas en FastAPI (`app.routes` / OpenAPI schema).
3. **Rigor y Precisión Financiera**:
   - Cero columnas `Float` en `app/models/entities.py`. Todos los montos y precios deben ser `Numeric(14, 4)` / `Decimal`.
4. **Smoke Test de Endpoints Críticos**:
   - `/api/v1/procurement/intendencias` -> 200 OK
   - `/api/v1/procurement/buyers` -> 200 OK
   - `/api/v1/procurement/competitors` -> 200 OK
   - `/api/v1/procurement/prices` -> 200 OK
   - `/api/v1/procurement/tenders` -> 200 OK
