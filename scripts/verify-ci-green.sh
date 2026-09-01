#!/usr/bin/env bash
# =============================================================================
# verify-ci-green.sh — Bloqueia o deploy se o CI (GitHub Actions) não passou
# para o commit atual. Usado pelos scripts npm run deploy:*.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

if ! command -v gh &> /dev/null; then
  echo -e "${YELLOW}⚠ gh CLI não encontrado — não é possível verificar o status do CI.${RESET}"
  echo -e "${YELLOW}  Instale em https://cli.github.com ou rode o deploy manualmente por sua conta e risco.${RESET}"
  exit 1
fi

SHA="$(git rev-parse HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}✗ Há alterações não commitadas.${RESET}"
  echo -e "${YELLOW}  O deploy publica os arquivos locais diretamente — sem commit, o CI não reflete o que vai pro ar.${RESET}"
  echo -e "${YELLOW}  Commit e faça push antes de tentar novamente.${RESET}"
  exit 1
fi

# Verifica se o commit atual já foi enviado ao GitHub
if ! git merge-base --is-ancestor "$SHA" "$(git rev-parse @{upstream} 2>/dev/null || echo origin/master)" 2>/dev/null; then
  echo -e "${YELLOW}⚠ O commit atual ($SHA) não parece estar no remoto (origin).${RESET}"
  echo -e "${YELLOW}  Rode 'git push' antes, para o CI rodar sobre este código.${RESET}"
  exit 1
fi

echo "Verificando status do CI para o commit ${SHA:0:7}..."

MAX_WAIT_SECONDS=600
WAITED=0
INTERVAL=10

while true; do
  STATUS_JSON="$(gh run list --commit "$SHA" --workflow ci.yml --json status,conclusion,url --limit 5 2>/dev/null || echo '[]')"

  if [ "$STATUS_JSON" = "[]" ]; then
    echo -e "${YELLOW}⚠ Nenhuma execução do CI encontrada para este commit ainda.${RESET}"
    if [ "$WAITED" -ge "$MAX_WAIT_SECONDS" ]; then
      echo -e "${RED}✗ Timeout esperando o CI iniciar. Verifique manualmente: gh run list --commit $SHA${RESET}"
      exit 1
    fi
    sleep "$INTERVAL"
    WAITED=$((WAITED + INTERVAL))
    continue
  fi

  # Considera "pronto" quando todas as execuções relevantes concluíram
  PENDING=$(echo "$STATUS_JSON" | grep -c '"status":"in_progress"\|"status":"queued"' || true)
  FAILED=$(echo "$STATUS_JSON" | grep -c '"conclusion":"failure"\|"conclusion":"cancelled"' || true)

  if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}✗ CI falhou para este commit.${RESET}"
    echo "$STATUS_JSON"
    exit 1
  fi

  if [ "$PENDING" -eq 0 ]; then
    echo -e "${GREEN}✓ CI passou para o commit ${SHA:0:7}. Prosseguindo com o deploy.${RESET}"
    exit 0
  fi

  if [ "$WAITED" -ge "$MAX_WAIT_SECONDS" ]; then
    echo -e "${RED}✗ Timeout esperando o CI terminar (10min). Verifique manualmente: gh run list --commit $SHA${RESET}"
    exit 1
  fi

  echo "CI ainda rodando... aguardando (${WAITED}s/${MAX_WAIT_SECONDS}s)"
  sleep "$INTERVAL"
  WAITED=$((WAITED + INTERVAL))
done
