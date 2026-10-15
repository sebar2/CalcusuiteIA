@echo off
title CALCU 3PL - Plataforma de Logistica y Distribucion
color 0B
cls

echo ===============================================================================
echo                CALCU 3PL - LOGISTICA Y DISTRIBUCION
echo       WMS Multi-Cliente, Flota Tercerizada, Kanban y Tracking GPS
echo ===============================================================================
echo.
echo [*] Verificando entorno de ejecucion...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python no fue encontrado en el PATH del sistema.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm no fue encontrado en el PATH del sistema.
    pause
    exit /b 1
)

echo [OK] Python y Node.js detectados correctamente.
echo.

echo [*] Detectando direcciones IP de red y Tailscale VPN...
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' } | ForEach-Object { Write-Host ('    -> [' + $_.InterfaceAlias + ']: ' + $_.IPAddress) }"
echo.

echo [*] Levantando Backend FastAPI en 0.0.0.0:8000 (Accesible por Tailscale)...
start "CALCU 3PL - Backend API" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [*] Levantando Frontend Vite en 0.0.0.0:5173 (Accesible por Red y Tailscale)...
start "CALCU 3PL - Frontend UI" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 0.0.0.0 --port 5173"

echo [*] Esperando 3 segundos a que inicien los servidores...
powershell -NoProfile -Command "Start-Sleep -Seconds 3"

echo [*] Abriendo navegador en modulo 3PL Logistica...
start "" "http://localhost:5173/?mode=3pl"

echo.
echo ===============================================================================
echo                       PERFILES Y ROLES DISPONIBLES:
echo ===============================================================================
echo  1. ADMINISTRADOR 3PL:
echo     - Usuario:    admin_3pl
echo     - Password:   admin3pl123
echo     - Permisos:   Acceso total a los 7 submodulos 3PL y Costos/Rentabilidad.
echo.
echo  2. OPERARIO DE DEPOSITO (Picking y WMS):
echo     - Usuario:    operario_3pl
echo     - Password:   operario123
echo     - Permisos:   Stock, Picking WMS, Codigos QR/128, Kanban y Remitos.
echo                   Costos y Rentabilidad BLOQUEADOS (403 Forbidden).
echo.
echo  3. CONDUCTOR / FLETERO DE REPARTO:
echo     - Usuario:    conductor_3pl
echo     - Password:   chofer123
echo     - Permisos:   Vista movil de chofer, ordenes asignadas, ruta GPS y firma.
echo ===============================================================================
echo  CONEXION TAILSCALE VPN (IP de tu servidor sebahost):
echo  - IP Tailscale Servidor: 100.119.40.92
echo  - URL Web en Celular:   http://100.119.40.92:5173/?mode=3pl
echo  - URL Servidor en APK:   http://100.119.40.92:8000
echo ===============================================================================
echo.
echo Los servidores estan ejecutandose en sus respectivas ventanas.
echo Presione cualquier tecla si desea cerrar esta consola...
pause >nul