# Aura System - Script de Desenvolvimento com Logs
$ErrorActionPreference = "Continue"
$ROOT = $PSScriptRoot
$env:Path = "C:\Program Files\nodejs;$env:Path"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AURA SYSTEM - Iniciando Aplicacao" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan

# Criar pasta de logs
$logsDir = Join-Path $ROOT "logs"
if (!(Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

# Limpar logs antigos
"" | Out-File "$logsDir\backend.log"
"" | Out-File "$logsDir\frontend.log"

# Matar processos antigos
Write-Host "`nEncerrando processos antigos..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Iniciar Backend
Write-Host "Iniciando Backend (porta 3001)..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($root, $logFile)
    Set-Location "$root\aura-backend"
    $env:Path = "C:\Program Files\nodejs;$env:Path"
    & npm run dev 2>&1 | Tee-Object -FilePath $logFile
} -ArgumentList $ROOT, "$logsDir\backend.log"

Start-Sleep -Seconds 5

# Iniciar Frontend  
Write-Host "Iniciando Frontend (porta 3000)..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    param($root, $logFile)
    Set-Location $root
    $env:Path = "C:\Program Files\nodejs;$env:Path"
    & npm run dev 2>&1 | Tee-Object -FilePath $logFile
} -ArgumentList $ROOT, "$logsDir\frontend.log"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Servidores iniciados!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Logs:     ./logs/backend.log" -ForegroundColor Gray
Write-Host "            ./logs/frontend.log" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

# Manter o script rodando e mostrar logs
Write-Host "`nPressione Ctrl+C para parar. Monitorando logs...`n" -ForegroundColor Yellow

while ($true) {
    Receive-Job $backendJob, $frontendJob
    Start-Sleep -Seconds 1
}

