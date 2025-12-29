@echo off
echo ========================================
echo    AURA SYSTEM - Iniciando Backend
echo ========================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

cd /d "%~dp0aura-backend"

echo Diretorio: %CD%
echo.
echo Iniciando servidor na porta 3001...
echo.

npm run dev

pause

