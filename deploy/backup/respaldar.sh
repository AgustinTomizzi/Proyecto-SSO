#!/bin/sh
# Backups de la base (servicio "backup" de docker-compose).
#   respaldar.sh          bucle: un respaldo por día a la hora BACKUP_HORA (03:00)
#   respaldar.sh --ahora  un respaldo ya y termina
#   respaldar.sh --seguridad  respaldo previo a una restauración, en
#                         /backups/seguridad (nombre propio, sin rotación)
# Deja /backups/diario/galileo-AAAAMMDD-HHMM.sql.gz (se conservan BACKUP_DIAS,
# 14 por defecto), copia el primero de cada mes en /backups/mensual (se
# conservan BACKUP_MESES, 6) y escribe /backups/estado.json para el monitoreo.
set -eu

DESTINO=/backups
DIAS="${BACKUP_DIAS:-14}"
MESES="${BACKUP_MESES:-6}"
HORA="${BACKUP_HORA:-03:00}"

registrar() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

estado() { # estado.json: resultado del último respaldo (lo lee estado_sistema.php)
  printf '{"ultimo":"%s","archivo":"%s","bytes":%s,"ok":%s,"error":"%s","diarios":%s,"mensuales":%s}\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "$2" "$3" "$4" \
    "$(ls "$DESTINO"/diario/*.sql.gz 2>/dev/null | wc -l)" "$(ls "$DESTINO"/mensual/*.sql.gz 2>/dev/null | wc -l)" \
    > "$DESTINO/estado.json.tmp" && mv "$DESTINO/estado.json.tmp" "$DESTINO/estado.json"
}

respaldar() {
  carpeta="${1:-diario}"
  mkdir -p "$DESTINO/diario" "$DESTINO/mensual" "$DESTINO/seguridad"
  # Con segundos y prefijo propio: nunca pisa otro respaldo (por ejemplo, el que se va a restaurar).
  prefijo=galileo
  [ "$carpeta" = "seguridad" ] && prefijo=antes-de-restaurar
  archivo="$DESTINO/$carpeta/$prefijo-$(date '+%Y%m%d-%H%M%S').sql.gz"
  # --single-transaction: copia consistente sin bloquear la base (InnoDB).
  if mysqldump -h "${DB_HOST:-mysql}" -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers \
       --set-gtid-purged=OFF --databases ProyectoEstela 2>/tmp/error.txt | gzip -9 > "$archivo.tmp" \
     && [ -s "$archivo.tmp" ] && gzip -t "$archivo.tmp"; then
    mv "$archivo.tmp" "$archivo"
    if [ "$carpeta" = "seguridad" ]; then
      registrar "respaldo de seguridad: $(basename "$archivo")"
      return 0
    fi
    [ "$(date '+%d')" = "01" ] && cp "$archivo" "$DESTINO/mensual/"
    ls -1t "$DESTINO"/diario/*.sql.gz | tail -n +"$((DIAS + 1))" | xargs -r rm -f
    ls -1t "$DESTINO"/mensual/*.sql.gz 2>/dev/null | tail -n +"$((MESES + 1))" | xargs -r rm -f
    bytes=$(wc -c < "$archivo")
    estado "$(basename "$archivo")" "$bytes" true ""
    registrar "respaldo ok: $(basename "$archivo") ($bytes bytes)"
  else
    rm -f "$archivo.tmp"
    error=$(grep -v "Using a password" /tmp/error.txt | head -c 200 | tr '"\n' "' ")
    estado "" 0 false "$error"
    registrar "respaldo FALLÓ: $error"
    return 1
  fi
}

if [ "${1:-}" = "--ahora" ]; then
  respaldar diario
  exit $?
fi
if [ "${1:-}" = "--seguridad" ]; then
  respaldar seguridad
  exit $?
fi

registrar "backups diarios a las $HORA (se conservan $DIAS diarios y $MESES mensuales)"
# Si no hay ningún respaldo todavía, se hace uno al arrancar.
[ -f "$DESTINO/estado.json" ] || respaldar || true
while true; do
  [ "$(date '+%H:%M')" = "$HORA" ] && { respaldar || true; sleep 61; }
  sleep 30
done
