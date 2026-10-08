@echo off
chcp 65001 >nul
title Calcu SupplyFinance Suite - Centro de Control
color 0B

:: Asegurar que el directorio activo sea la raiz del proyecto
cd /d "%~dp0"

:MENU
cls
echo ===============================================================================
echo             CALCU - SUPPLYFINANCE SUITE ^| CENTRO DE CONTROL OPERATIVO
echo ===============================================================================
echo.
echo   [1] MODO LIGERO (SQLite)
echo       - Base de datos local calcu.db sin dependencias externas
echo       - Backend FastAPI en http://localhost:8000 con autoreload
echo.
echo   [2] MODO CORPORATIVO (PostgreSQL 16 + Redis en Docker)
echo       - Levanta postgres:16-alpine y redis:7-alpine con Docker Compose
echo       - Conexión con QueuePool de alta concurrencia
echo       - Backend FastAPI en http://localhost:8000
echo.
echo   [3] MODO COMPLETO FULL-STACK (Backend FastAPI + Frontend Vite)
echo       - Selecciona motor de base de datos
echo       - Abre Backend en terminal dedicada (:8000)
echo       - Abre Frontend en terminal dedicada (:5173)
echo.
echo   [4] MIGRAR DATOS ETL (SQLite -^> PostgreSQL 16)
echo       - Levanta clúster Docker Compose
echo       - Aplica migraciones Alembic y sincroniza tablas y secuencias
echo.
echo   [5] EJECUTAR SUITE DE PRUEBAS AUTOMATIZADAS (Pytest)
echo       - Ejecuta 175+ tests unitarios y de integración
echo.
echo   [0] SALIR
echo.
echo ===============================================================================
set /p OPCION="Seleccione una opción [0-5]: "

if "%OPCION%"=="1" goto MODO_SQLITE
if "%OPCION%"=="2" goto MODO_POSTGRES
if "%OPCION%"=="3" goto MODO_FULLSTACK
if "%OPCION%"=="4" goto MIGRAR_ETL
if "%OPCION%"=="5" goto RUN_TESTS
if "%OPCION%"=="0" goto SALIR
if /i "%OPCION%"=="q" goto SALIR

echo.
echo [!] Opción no válida. Intente de nuevo.
timeout /t 2 >nul
goto MENU

:: ===============================================================================
:: [OPCION 1] MODO LIGERO (SQLite)
:: ===============================================================================
:MODO_SQLITE
cls
echo ===============================================================================
echo   INICIANDO CALCU EN MODO LIGERO (SQLite)
echo ===============================================================================
echo.
set DATABASE_URL=sqlite:///calcu.db
echo [*] DATABASE_URL = %DATABASE_URL%
echo [*] Servidor Backend disponible en: http://localhost:8000
echo [*] Documentación interactiva Swagger: http://localhost:8000/docs
echo [*] Presione Ctrl+C para detener el servidor.
echo.
python -m uvicorn app.main:app --reload --port 8000
echo.
pause
goto MENU

:: ===============================================================================
:: [OPCION 2] MODO CORPORATIVO (PostgreSQL 16 + Redis)
:: ===============================================================================
:MODO_POSTGRES
cls
echo ===============================================================================
echo   INICIANDO CALCU EN MODO CORPORATIVO (PostgreSQL 16 + Docker)
echo ===============================================================================
echo.
echo [*] Verificando disponibilidad de Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Desktop no se encuentra en ejecución o no responde.
    echo         Por favor inicie Docker Desktop e intente nuevamente.
    echo.
    pause
    goto MENU
)

echo [*] Levantando contenedores PostgreSQL 16 y Redis 7 con Docker Compose...
docker-compose up -d
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Falló el inicio de los contenedores Docker.
    pause
    goto MENU
)

echo [*] Esperando confirmación de disponibilidad de base de datos...
timeout /t 3 /nobreak >nul

set DATABASE_URL=postgresql+psycopg://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db
echo [*] DATABASE_URL = %DATABASE_URL%
echo [*] Servidor Backend disponible en: http://localhost:8000
echo [*] Documentación interactiva Swagger: http://localhost:8000/docs
echo [*] Presione Ctrl+C para detener el servidor.
echo.
python -m uvicorn app.main:app --reload --port 8000
echo.
pause
goto MENU

:: ===============================================================================
:: [OPCION 3] MODO COMPLETO FULL-STACK (Backend + Frontend)
:: ===============================================================================
:MODO_FULLSTACK
cls
echo ===============================================================================
echo   CONFIGURACIÓN FULL-STACK (FastAPI + React Vite)
echo ===============================================================================
echo.
echo Seleccione el motor de base de datos para el Backend:
echo   [1] SQLite (calcu.db)
echo   [2] PostgreSQL 16 (Docker Compose)
echo.
set /p DB_CHOICE="Opción [1 o 2]: "

if "%DB_CHOICE%"=="2" (
    docker info >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Docker Desktop no está activo. Abortando.
        pause
        goto MENU
    )
    echo [*] Levantando infraestructura en Docker...
    docker-compose up -d
    timeout /t 3 /nobreak >nul
    set TARGET_DB=postgresql+psycopg://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db
) else (
    set TARGET_DB=sqlite:///calcu.db
)

echo.
echo [*] Levantando ventana de Backend FastAPI (:8000)...
start "Calcu Backend - FastAPI" cmd /k "title Calcu Backend (:8000) && color 0A && cd /d "%~dp0" && set DATABASE_URL=%TARGET_DB% && python -m uvicorn app.main:app --reload --port 8000"

echo [*] Levantando ventana de Frontend React Vite (:5173)...
start "Calcu Frontend - Vite" cmd /k "title Calcu Frontend (:5173) && color 0E && cd /d "%~dp0frontend" && npm run dev"

echo.
echo [✓] Ambos servicios han sido lanzados en terminales independientes.
echo     - Backend API:  http://localhost:8000 (Swagger: /docs)
echo     - Frontend Web: http://localhost:5173
echo.
pause
goto MENU

:: ===============================================================================
:: [OPCION 4] MIGRAR DATOS ETL (SQLite -> PostgreSQL 16)
:: ===============================================================================
:MIGRAR_ETL
cls
echo ===============================================================================
echo   MIGRACIÓN ETL DE DATOS (calcu.db -^> PostgreSQL 16)
echo ===============================================================================
echo.
echo [*] Verificando Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Desktop no está activo.
    echo         Inicie Docker para levantar la base PostgreSQL de destino.
    pause
    goto MENU
)

echo [*] Asegurando estado de contenedor PostgreSQL...
docker-compose up -d db
timeout /t 3 /nobreak >nul

echo [*] Ejecutando pipeline ETL de migración y reseteo de secuencias...
python scripts/migrate_sqlite_to_pg.py --sqlite-path calcu.db --pg-url "postgresql+psycopg://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db"
echo.
pause
goto MENU

:: ===============================================================================
:: [OPCION 5] EJECUTAR SUITE DE PRUEBAS (Pytest)
:: ===============================================================================
:RUN_TESTS
cls
echo ===============================================================================
echo   EJECUTANDO SUITE DE PRUEBAS AUTOMATIZADAS (Pytest)
echo ===============================================================================
echo.
python -m pytest tests/unit tests/integration -v
echo.
echo ===============================================================================
echo   RESUMEN RÁPIDO:
python -m pytest tests/unit tests/integration -q
echo ===============================================================================
echo.
pause
goto MENU

:SALIR
cls
echo Gracias por utilizar Calcu SupplyFinance Suite.
timeout /t 2 >nul
exit /b 0
