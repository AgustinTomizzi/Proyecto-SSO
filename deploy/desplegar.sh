#!/usr/bin/env bash
# Despliega (o actualiza) Galileo en un servidor Ubuntu con Docker, con HTTPS de
# Let's Encrypt para un dominio propio (por ejemplo, uno gratis de DuckDNS).
# Ver docs/DESPLIEGUE.md.
#
#   bash deploy/desplegar.sh <IP> <DOMINIO> [--con-mis-datos]
#
#   --con-mis-datos  copia la base del stack local (proyecto "galileo") al
#                    servidor. Reemplaza la base del servidor (antes guarda un
#                    respaldo de seguridad allá).
#
# Variables opcionales: SSH_LLAVE (~/.ssh/galileo_oracle), SSH_USUARIO (ubuntu),
# EMAIL_CERT (email para avisos de Let's Encrypt; vacío = sin email).
#
# Es idempotente: correrlo de nuevo sube el código actual (HEAD) y reconstruye.
# El .env del servidor se genera una sola vez, con contraseñas aleatorias, y
# nunca sale del servidor.
set -euo pipefail
export MSYS_NO_PATHCONV=1

IP="${1:-}"; DOMINIO="${2:-}"; OPCION="${3:-}"
if [[ -z "$IP" || -z "$DOMINIO" ]]; then
  echo "Uso: bash deploy/desplegar.sh <IP> <DOMINIO> [--con-mis-datos]" >&2
  exit 1
fi
LLAVE="${SSH_LLAVE:-$HOME/.ssh/galileo_oracle}"
USUARIO="${SSH_USUARIO:-ubuntu}"
SSH=(ssh -i "$LLAVE" -o StrictHostKeyChecking=accept-new "$USUARIO@$IP")
cd "$(git rev-parse --show-toplevel)"

echo "==> 1/7 Conexión con $USUARIO@$IP"
"${SSH[@]}" true

echo "==> 2/7 Docker, firewall y swap"
"${SSH[@]}" 'bash -s' <<'REMOTO'
set -euo pipefail
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi
# Las imágenes de Ubuntu de Oracle traen iptables cerrado salvo SSH.
for puerto in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$puerto" -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 5 -p tcp --dport "$puerto" -j ACCEPT
done
if ! command -v netfilter-persistent >/dev/null; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
fi
sudo netfilter-persistent save >/dev/null
# Swap de 2 GB: el build de los frontends no entra en máquinas de 1 GB.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
REMOTO

echo "==> 3/7 Código ($(git rev-parse --short HEAD))"
git archive --format=tar HEAD | "${SSH[@]}" 'mkdir -p ~/galileo && tar -x -C ~/galileo'

echo "==> 4/7 Configuración (.env del servidor)"
"${SSH[@]}" "DOMINIO='$DOMINIO' bash -s" <<'REMOTO'
set -euo pipefail
cd ~/galileo
if [[ ! -f .env ]]; then
  clave() { openssl rand -hex 24; }
  sed -e "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$(clave)|" \
      -e "s|^DB_APP_PASSWORD=.*|DB_APP_PASSWORD=$(clave)|" \
      -e "s|^APP_ENV=.*|APP_ENV=prod|" \
      -e "s|^APP_URL=.*|APP_URL=https://$DOMINIO|" \
      -e "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://$DOMINIO|" \
      -e "s|^SMTP_HOST=.*|SMTP_HOST=|" \
      .env.example > .env
  printf '\n# Producción (deploy/desplegar.sh)\nCOMPOSE_PROJECT_NAME=galileo\nDOMINIO=%s\n' "$DOMINIO" >> .env
  chmod 600 .env
  echo "    .env generado con contraseñas aleatorias."
else
  sed -i "s|^DOMINIO=.*|DOMINIO=$DOMINIO|" .env
  echo "    .env existente: se conserva."
fi
cat > dc <<'SCRIPT'
#!/bin/sh
# Atajo: docker compose con la configuración de producción.
cd "$(dirname "$0")" && exec sudo docker compose -f docker-compose.yml -f deploy/produccion/compose.produccion.yml "$@"
SCRIPT
chmod +x dc
REMOTO

echo "==> 5/7 Certificado HTTPS para $DOMINIO"
if "${SSH[@]}" "sudo docker run --rm -v galileo_letsencrypt:/etc/letsencrypt alpine test -f /etc/letsencrypt/live/$DOMINIO/fullchain.pem" 2>/dev/null; then
  echo "    Ya existe; certbot lo renueva solo."
else
  echo "    Let's Encrypt pide aceptar sus términos: https://letsencrypt.org/repository/"
  read -r -p "    ¿Aceptás los términos de Let's Encrypt? Escribí SI para seguir: " ok
  [[ "$ok" == "SI" ]] || { echo "Cancelado." >&2; exit 1; }
  if [[ -n "${EMAIL_CERT:-}" ]]; then CORREO=(--email "$EMAIL_CERT"); else CORREO=(--register-unsafely-without-email); fi
  "${SSH[@]}" "cd ~/galileo && (./dc stop proxy 2>/dev/null || true) && sudo docker run --rm -p 80:80 -v galileo_letsencrypt:/etc/letsencrypt certbot/certbot certonly --standalone --non-interactive --agree-tos ${CORREO[*]} -d $DOMINIO"
fi

echo "==> 6/7 Levantando los servicios (el primer build tarda varios minutos)"
"${SSH[@]}" "cd ~/galileo && ./dc up -d --build --remove-orphans --wait --wait-timeout 600"

if [[ "$OPCION" == "--con-mis-datos" ]]; then
  echo "    Copiando la base local al servidor"
  docker compose -p galileo exec -T backup sh /respaldar.sh --ahora >/dev/null
  ULTIMO="$(ls -t backups/diario/galileo-*.sql.gz | head -1)"
  "${SSH[@]}" 'cd ~/galileo && ./dc exec -T backup sh /respaldar.sh --seguridad >/dev/null'
  "${SSH[@]}" 'cd ~/galileo && gunzip | ./dc exec -T mysql sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\""' < "$ULTIMO"
  "${SSH[@]}" 'cd ~/galileo && ./dc restart backend notificador >/dev/null'
  echo "    Restaurado $ULTIMO"
fi

# El primer Administrador que siga con la contraseña inicial (o bloqueado)
# recibe una temporal aleatoria, que se muestra solo acá.
ADMIN="$("${SSH[@]}" 'cd ~/galileo && ./dc exec -T mysql sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -N ProyectoEstela"' <<'SQL' 2>/dev/null | tr -d '\r'
SELECT u.email FROM usuarios u JOIN roles r ON r.id_rol = u.rol_id
WHERE r.nombre = 'Administrador' AND u.debe_cambiar_password = 1
ORDER BY u.id_usuario LIMIT 1;
SQL
)"
if [[ -n "$ADMIN" ]]; then
  TEMPORAL="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  "${SSH[@]}" "TEMPORAL='$TEMPORAL' ADMIN='$ADMIN' bash -s" <<'REMOTO'
set -euo pipefail
cd ~/galileo
HASH="$(./dc exec -T backend php -r 'echo password_hash($argv[1], PASSWORD_DEFAULT);' -- "$TEMPORAL")"
printf "UPDATE usuarios SET contrasena = '%s', debe_cambiar_password = 1 WHERE email = '%s';\n" "$HASH" "$ADMIN" \
  | ./dc exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ProyectoEstela'
REMOTO
  ADMIN_MSJ="Administrador: $ADMIN  ·  contraseña temporal: $TEMPORAL  (la vas a cambiar al entrar)"
fi

# Nadie entra desde internet con una contraseña demo conocida.
"${SSH[@]}" 'cd ~/galileo && ./dc exec -T mysql sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -N" < deploy/produccion/bloquear-cuentas-demo.sql' \
  | sed 's/^/    Cuentas con contraseña inicial bloqueadas: /'

echo "==> 7/7 Verificación"
if curl -fsS "https://$DOMINIO/api/salud.php"; then
  echo; echo "Listo: https://$DOMINIO"
  [[ -n "${ADMIN_MSJ:-}" ]] && echo "$ADMIN_MSJ"
else
  echo "La verificación falló: revisá con  ssh ... 'cd ~/galileo && ./dc logs --tail 50'" >&2
  exit 1
fi
