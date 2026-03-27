@echo off
REM =============================================================================
REM test-all.bat — Roda TODOS os testes do Aura System (Windows)
REM Uso: test-all.bat [--e2e-only | --unit-only | --skip-e2e]
REM =============================================================================

setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%aura-backend
set UNIT_STATUS=SKIP
set E2E_STATUS=SKIP
set SKIP_UNIT=0
set SKIP_E2E=0

for %%A in (%*) do (
  if "%%A"=="--e2e-only"  set SKIP_UNIT=1
  if "%%A"=="--unit-only" set SKIP_E2E=1
  if "%%A"=="--skip-e2e"  set SKIP_E2E=1
)

echo.
echo ================================================
echo   AURA SYSTEM — Suite de Testes Completa
echo ================================================
echo.

REM ── Testes unitários (Vitest) ──────────────────────────────────────────────
if %SKIP_UNIT%==0 (
  echo [1/2] Rodando testes unitarios ^(Vitest^)...
  echo ------------------------------------------------
  pushd "%BACKEND_DIR%"
  call npm run test:ci
  if errorlevel 1 (
    set UNIT_STATUS=FAIL
  ) else (
    set UNIT_STATUS=PASS
  )
  popd
  echo.
)

REM ── Testes E2E (Playwright) ────────────────────────────────────────────────
if %SKIP_E2E%==0 (
  echo [2/2] Rodando testes E2E ^(Playwright^)...
  echo ------------------------------------------------
  pushd "%ROOT_DIR%"
  call npx playwright test --reporter=list
  if errorlevel 1 (
    set E2E_STATUS=FAIL
  ) else (
    set E2E_STATUS=PASS
  )
  popd
  echo.
)

REM ── Relatório final ────────────────────────────────────────────────────────
echo ================================================
echo   RESULTADO FINAL
echo ================================================
if "%UNIT_STATUS%"=="PASS" echo   [OK]   Testes unitarios ^(Vitest^)
if "%UNIT_STATUS%"=="FAIL" echo   [FAIL] Testes unitarios ^(Vitest^)
if "%UNIT_STATUS%"=="SKIP" echo   [-]    Testes unitarios ^(ignorado^)
if "%E2E_STATUS%"=="PASS"  echo   [OK]   Testes E2E ^(Playwright^)
if "%E2E_STATUS%"=="FAIL"  echo   [FAIL] Testes E2E ^(Playwright^)
if "%E2E_STATUS%"=="SKIP"  echo   [-]    Testes E2E ^(ignorado^)
echo.

if "%UNIT_STATUS%"=="FAIL" goto :fail
if "%E2E_STATUS%"=="FAIL"  goto :fail

echo   TODOS OS TESTES PASSARAM
echo.
exit /b 0

:fail
echo   FALHOU — corrija os erros antes de fazer deploy
echo.
exit /b 1
