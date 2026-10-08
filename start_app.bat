@echo off
title Calcu - SupplyFinance Suite (Bitrix24 Edition)
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
color 0B
cd /d "%~dp0"
echo ==========================================================
echo   Iniciando Calcu Suite: FastAPI (:8000) + Vite SPA (:5173)
echo ==========================================================
python run.py
pause
