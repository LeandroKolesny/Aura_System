@echo off
echo ========================================
echo    AURA SYSTEM - Iniciando Aplicacao
echo ========================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

:: Criar pasta de logs
if not exist "%~dp0logs" mkdir "%~dp0logs"

:: Limpar logs antigos
echo [%date% %time%] Iniciando Backend... > "%~dp0logs\backend.log"
echo [%date% %time%] Iniciando Frontend... > "%~dp0logs\frontend.log"

echo Encerrando processos antigos nas portas 3000 e 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak > nul

echo.
echo Iniciando Backend (porta 3001)...
start "Aura Backend" powershell -NoExit -Command "cd '%~dp0aura-backend'; $env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run dev 2>&1 | Tee-Object -FilePath '%~dp0logs\backend.log'"

echo Aguardando backend iniciar...
timeout /t 8 /nobreak > nul

echo Iniciando Frontend (porta 3000)...
start "Aura Frontend" powershell -NoExit -Command "cd '%~dp0'; $env:Path = 'C:\Program Files\nodejs;' + $env:Path; npm run dev 2>&1 | Tee-Object -FilePath '%~dp0logs\frontend.log'"

echo.
echo ========================================
echo   Servidores iniciados!
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:3000
echo
echo   LOGS salvos em:
echo   - logs\backend.log
echo   - logs\frontend.log
echo ========================================
echo.
pause

