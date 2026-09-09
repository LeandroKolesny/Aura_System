#!/usr/bin/env bash
# =============================================================================
# test-all.sh — Roda TODOS os testes do Aura System
# Uso: bash test-all.sh [--e2e-only | --unit-only | --skip-e2e]
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/aura-backend"

SKIP_UNIT=false
SKIP_E2E=false

for arg in "$@"; do
  case $arg in
    --e2e-only)   SKIP_UNIT=true ;;
    --unit-only)  SKIP_E2E=true ;;
    --skip-e2e)   SKIP_E2E=true ;;
  esac
done

UNIT_STATUS="SKIP"
E2E_STATUS="SKIP"
UNIT_TIME=0
E2E_TIME=0

print_header() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════${RESET}"
}

print_result() {
  local label="$1" status="$2" time="$3"
  if [ "$status" = "PASS" ]; then
    echo -e "  ${GREEN}✓ $label${RESET} ${YELLOW}(${time}s)${RESET}"
  elif [ "$status" = "FAIL" ]; then
    echo -e "  ${RED}✗ $label${RESET} ${YELLOW}(${time}s)${RESET}"
  else
    echo -e "  ${YELLOW}– $label (ignorado)${RESET}"
  fi
}

# ── Testes unitários / integração (Vitest) ────────────────────────────────────
# Roda frontend (raiz) E backend — faltava o frontend aqui antes, o que dava
# falsa confiança rodando "--unit-only" (os testes de AppContext/api.ts nunca
# eram executados por este script, só pelo `npm run test:unit` da raiz).
if [ "$SKIP_UNIT" = false ]; then
  print_header "TESTES UNITÁRIOS — Vitest (frontend + backend)"
  START=$(date +%s)
  if (cd "$ROOT_DIR" && npx vitest run 2>&1) && (cd "$BACKEND_DIR" && npm run test:ci 2>&1); then
    UNIT_STATUS="PASS"
  else
    UNIT_STATUS="FAIL"
  fi
  UNIT_TIME=$(( $(date +%s) - START ))
fi

# ── Testes E2E (Playwright) ───────────────────────────────────────────────────
if [ "$SKIP_E2E" = false ]; then
  print_header "TESTES E2E — Playwright (frontend)"
  START=$(date +%s)
  if (cd "$ROOT_DIR" && npx playwright test --reporter=list 2>&1); then
    E2E_STATUS="PASS"
  else
    E2E_STATUS="FAIL"
  fi
  E2E_TIME=$(( $(date +%s) - START ))
fi

# ── Relatório final ───────────────────────────────────────────────────────────
print_header "RESULTADO FINAL"
print_result "Testes unitários (Vitest)"  "$UNIT_STATUS" "$UNIT_TIME"
print_result "Testes E2E (Playwright)"    "$E2E_STATUS"  "$E2E_TIME"
echo ""

if [ "$UNIT_STATUS" = "FAIL" ] || [ "$E2E_STATUS" = "FAIL" ]; then
  echo -e "${RED}${BOLD}  ✗ FALHOU — corrija os erros antes de fazer deploy${RESET}"
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}  ✓ TODOS OS TESTES PASSARAM${RESET}"
  echo ""
  exit 0
fi
