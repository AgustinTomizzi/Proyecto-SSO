#!/usr/bin/env bash
# Stack Docker aislado para los tests de integración (no toca el stack principal).
#   stack-pruebas.sh up     base nueva (down -v del proyecto de pruebas) y build de todo
#   stack-pruebas.sh test   corre tests/api.test.mjs contra el stack de pruebas
#   stack-pruebas.sh down   baja el stack de pruebas y borra SU volumen
#   stack-pruebas.sh dc ... cualquier comando de docker compose sobre ese proyecto
# Variables: PRUEBAS_PROYECTO (pruebas), PRUEBAS_PUERTO (3100), PRUEBAS_MAILPIT (8125).
cd "$(git rev-parse --show-toplevel)" || exit 1
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROYECTO="${PRUEBAS_PROYECTO:-pruebas}"
# Backups del stack de pruebas aparte de los del stack principal.
export BACKUP_DIR="${BACKUP_DIR:-./backups-pruebas}"
if [ "$PROYECTO" = "galileo" ]; then echo "El proyecto de pruebas no puede ser el principal (galileo)."; exit 1; fi
DC="docker compose -p $PROYECTO -f docker-compose.yml -f $DIR/compose.pruebas.yml"
case "$1" in
  up)   $DC down -v --remove-orphans >/dev/null 2>&1; $DC up --build -d --wait 2>&1 | tail -15 ;;
  test) API_URL="${API_URL:-http://localhost:${PRUEBAS_PUERTO:-3100}/api}" node tests/api.test.mjs 2>&1 | tail -25
        BASE_URL="http://localhost:${PRUEBAS_PUERTO:-3100}" node tests/pwa.test.mjs 2>&1 | tail -5 ;;
  down) $DC down -v --remove-orphans 2>&1 | tail -3 ;;
  dc)   shift; $DC "$@" ;;
  *)    echo "uso: $0 up|test|down|dc ..."; exit 1 ;;
esac
