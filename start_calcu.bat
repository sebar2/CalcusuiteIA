@echo off
title Calcu SupplyFinance Suite - Centro de Control
color 0B
cd /d "%~dp0"

:MENU
cls
echo ===============================================================================
echo             CALCU - SUPPLYFINANCE SUITE : CENTRO DE CONTROL
echo ===============================================================================
echo.
echo   [1] MODO LIGERO (SQLite)
echo       - Base local calcu.db sin dependencias externas
echo       - Backend FastAPI en http://localhost:8000 con autoreload
echo.
echo   [2] MODO CORPORATIVO (PostgreSQL 16 en Docker)
echo       - Levanta postgres:16-alpine y redis:7-alpine con Docker Compose
echo       - Conexion con QueuePool de alta concurrencia
echo       - Backend FastAPI en http://localhost:8000
echo.
echo   [3] MODO COMPLETO FULL-STACK (Backend + Frontend)
echo       - Abre Backend FastAPI (:8000) en terminal dedicada
echo       - Abre Frontend React Vite (:5173) en terminal dedicada
echo.
echo   [4] MIGRAR DATOS ETL (SQLite hacia PostgreSQL 16)
echo       - Sincroniza tablas, registros y secuencias
echo.
echo   [5] EJECUTAR SUITE DE PRUEBAS AUTOMATIZADAS (Pytest)
echo       - Ejecuta los 176 tests unitarios y de integracion
echo.
echo   [0] SALIR
echo.
echo ===============================================================================
set /p OPCION="Seleccione una opcion [0-5]: "

if "%OPCION%"=="1" goto MODO_SQLITE
if "%OPCION%"=="2" goto MODO_POSTGRES
if "%OPCION%"=="3" goto MODO_FULLSTACK
if "%OPCION%"=="4" goto MIGRAR_ETL
if "%OPCION%"=="5" goto RUN_TESTS
if "%OPCION%"=="0" goto SALIR
if /i "%OPCION%"=="q" goto SALIR

echo.
echo [!] Opcion no valida.
timeout /t 2 >nul
goto MENU

:MODO_SQLITE
cls
echo ===============================================================================
echo   INICIANDO EN MODO LIGERO (SQLite)
echo ===============================================================================
echo.
set "DATABASE_URL=sqlite:///calcu.db"
echo [*] DATABASE_URL = %DATABASE_URL%
echo [*] Servidor Backend en: http://localhost:8000
echo [*] Swagger Docs: http://localhost:8000/docs
echo [*] Presione Ctrl+C para detener el servidor.
echo.
python -m uvicorn app.main:app --reload --port 8000
pause
goto MENU

:MODO_POSTGRES
cls
echo ===============================================================================
echo   INICIANDO EN MODO CORPORATIVO (PostgreSQL 16 + Docker)
echo ===============================================================================
echo.
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Desktop no esta abierto o no responde.
    echo         Inicie Docker Desktop e intente nuevamente.
    echo.
    pause
    goto MENU
)
echo [*] Levantando contenedores PostgreSQL y Redis...
docker-compose up -d
timeout /t 3 /nobreak >nul
set "DATABASE_URL=postgresql+pg8000://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db"
echo [*] DATABASE_URL = %DATABASE_URL%
echo [*] Servidor Backend en: http://localhost:8000
echo [*] Presione Ctrl+C para detener el servidor.
echo.
python -m uvicorn app.main:app --reload --port 8000
pause
goto MENU

:MODO_FULLSTACK
cls
echo ===============================================================================
echo   CONFIGURACION FULL-STACK (FastAPI + React Vite)
echo ===============================================================================
echo.
echo Seleccione el motor de base de datos:
echo   [1] SQLite (calcu.db)
echo   [2] PostgreSQL 16 (Docker)
echo.
set /p DB_CHOICE="Opcion [1 o 2]: "

if "%DB_CHOICE%"=="2" (
    docker info >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Docker Desktop no esta activo.
        pause
        goto MENU
    )
    docker-compose up -d
    timeout /t 3 /nobreak >nul
    set "TARGET_DB=postgresql+pg8000://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db"
) else (
    set "TARGET_DB=sqlite:///calcu.db"
)

echo.
echo [*] Abriendo Backend FastAPI (:8000)...
start "Calcu Backend (:8000)" cmd /k "color 0A && cd /d "%~dp0" && set "DATABASE_URL=%TARGET_DB%" && python -m uvicorn app.main:app --reload --port 8000"

echo [*] Abriendo Frontend React Vite (:5173)...
start "Calcu Frontend (:5173)" cmd /k "color 0E && cd /d "%~dp0frontend" && npm run dev"

echo.
echo [OK] Ambos servicios iniciados en terminales independientes.
echo     - Backend:  http://localhost:8000 (Docs: /docs)
echo     - Frontend: http://localhost:5173
echo.
pause
goto MENU

:MIGRAR_ETL
cls
echo ===============================================================================
echo   MIGRACION ETL DE DATOS (calcu.db a PostgreSQL 16)
echo ===============================================================================
echo.
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Desktop no esta activo. Inicielo para conectar PostgreSQL.
    pause
    goto MENU
)
docker-compose up -d db
timeout /t 3 /nobreak >nul
echo [*] Ejecutando scripts/migrate_sqlite_to_pg.py...
python scripts/migrate_sqlite_to_pg.py --sqlite-path calcu.db --pg-url "postgresql+pg8000://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db"
echo.
pause
goto MENU

:RUN_TESTS
cls
echo ===============================================================================
echo   EJECUTANDO SUITE DE PRUEBAS AUTOMATIZADAS (Pytest)
echo ===============================================================================
echo.
python -m pytest tests/unit tests/integration -q
echo.
pause
goto MENU

:SALIR
cls
exit /b 0
