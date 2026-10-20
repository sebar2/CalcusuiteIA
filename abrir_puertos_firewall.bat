@echo off
title Habilitar Puertos Firewall para Calcu-Enterprise-SuperAdmin (Tailscale)
color 0A
cls
echo ===============================================================================
echo        HABILITACION DE PUERTOS DE FIREWALL PARA CALCU 3PL
echo ===============================================================================
echo.
echo [*] Agregando reglas de entrada para puertos 8000 (API) y 5173 (Web)...
netsh advfirewall firewall add rule name="Calcu-Enterprise-SuperAdmin (8000)" dir=in action=allow protocol=TCP localport=8000 profile=any
netsh advfirewall firewall add rule name="Calcu-Enterprise-SuperAdmin (5173)" dir=in action=allow protocol=TCP localport=5173 profile=any
echo.
echo [OK] Reglas agregadas exitosamente. El celular podra conectarse libremente por Tailscale.
echo.
pause
