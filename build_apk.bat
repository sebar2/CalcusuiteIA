@echo off
chcp 65001 >nul
title Compilador APK - Calcu 3PL Logística
color 0A

echo ===============================================================================
echo            📱 COMPILADOR DE APK NATIVO - CALCU 3PL LOGÍSTICA
echo ===============================================================================
echo.

cd /d "%~dp0frontend"
echo [*] 1/3: Compilando frontend web (TypeScript + Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Falló la compilación de Vite.
    pause
    exit /b 1
)

echo [*] 2/3: Sincronizando assets nativos con Capacitor...
call npx cap sync
if %errorlevel% neq 0 (
    echo [ERROR] Falló la sincronización de Capacitor.
    pause
    exit /b 1
)

echo [*] 3/3: Compilando APK con Gradle y OpenJDK 21...
cd /d "%~dp0frontend\android"
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
set "ANDROID_HOME=C:\Users\sebar\AppData\Local\Android\Sdk"
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo [ERROR] Falló la compilación de Gradle.
    pause
    exit /b 1
)

cd /d "%~dp0"
copy /y "frontend\android\app\build\outputs\apk\debug\app-debug.apk" "Calcu3PL-Logistica.apk" >nul

echo.
echo ===============================================================================
echo  [ÉXITO] APK Generado y actualizado correctamente:
echo  Ubicación: %~dp0Calcu3PL-Logistica.apk
echo ===============================================================================
echo.
pause
