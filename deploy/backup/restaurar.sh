#!/usr/bin/env bash
# Restaura un respaldo sobre la base actual (REEMPLAZA los datos).
#   bash deploy/backup/restaurar.sh backups/diario/galileo-20261007-0300.sql.gz
# Antes hace un respaldo de seguridad del estado actual.
set -euo pipefail
# Git Bash (Windows) no debe convertir las rutas de dentro del contenedor.
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/../.."
archivo="${1:?indicá el archivo .sql.gz a restaurar}"
[ -f "$archivo" ] || { echo "no existe $archivo"; exit 1; }
gzip -t "$archivo" || { echo "el archivo está dañado"; exit 1; }
DC="docker compose ${COMPOSE_ARGS:-}"
read -r -p "Esto REEMPLAZA la base actual por $archivo. Escribí RESTAURAR para seguir: " ok
[ "$ok" = "RESTAURAR" ] || { echo "cancelado"; exit 1; }
echo "respaldo de seguridad del estado actual..."
$DC exec -T backup sh /respaldar.sh --seguridad
echo "restaurando..."
gunzip -c "$archivo" | $DC exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
echo "listo. Reiniciá el backend: $DC restart backend notificador"
