# Script PowerShell para iniciar Calcu Suite SPA
$Host.UI.RawUI.WindowTitle = "Calcu | SupplyFinance Suite"
Set-Location -Path $PSScriptRoot
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Iniciando Calcu Suite: FastAPI (:8000) + Vite SPA (:5173)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
python run.py
