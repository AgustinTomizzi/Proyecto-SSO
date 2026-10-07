# Despliegue en un servidor (Oracle Cloud gratis + DuckDNS)

Para que Galileo esté siempre encendido y se pueda entrar desde cualquier lugar (Android, iPhone, cualquier PC) con HTTPS, sin depender de la PC de desarrollo.

Plan actual: **gratis**. La facturación queda a futuro.

| Pieza | Para qué | Costo |
|---|---|---|
| Oracle Cloud "Always Free" (VM Ampere A1, Ubuntu) | El servidor, encendido 24/7 | Gratis (pide tarjeta para verificar identidad, no cobra) |
| DuckDNS | Un nombre fijo, por ejemplo `galileo-eest5.duckdns.org` | Gratis |
| Let's Encrypt | Certificado HTTPS (necesario para la PWA y la cookie segura) | Gratis, se renueva solo |

## Qué hace el kit

- `deploy/produccion/compose.produccion.yml`: se suma a `docker-compose.yml`.
  - nginx en los puertos 80 y 443 con el certificado de `DOMINIO`.
  - Servicio `certbot`, que renueva el certificado solo. nginx se recarga cada 6 h para tomarlo.
  - Sin Mailpit: el envío de emails queda deshabilitado hasta configurar un SMTP real.
- `deploy/produccion/nginx.conf.template`:
  - En el puerto 80 responde el desafío de Let's Encrypt y redirige a HTTPS.
  - En el 443 sirve `/`, `/galiservas/` y `/api/` (`proxy/rutas.inc`) con HSTS.
  - Rechaza los pedidos que no vienen al dominio (por ejemplo, por IP).
- `deploy/produccion/bloquear-cuentas-demo.sql`: bloquea las cuentas que siguen con la contraseña inicial, para que nadie entre desde internet con `demo1234`.
- `deploy/desplegar.sh <IP> <DOMINIO> [--con-mis-datos]`: instala, configura y levanta todo por SSH. Es idempotente, así que también sirve para actualizar.

## Paso a paso (la primera vez)

### 1. Cuenta de Oracle Cloud

1. Crear la cuenta en <https://www.oracle.com/cloud/free/>. Elegir una región cercana (por ejemplo, *Brazil East (São Paulo)* o *Chile (Santiago)*): **no se puede cambiar después**.
2. *Compute → Instances → Create instance*:
   - **Image:** Canonical Ubuntu 24.04.
   - **Shape:** *Ampere* → `VM.Standard.A1.Flex`, 2 OCPU y 12 GB (dentro del gratis: hasta 4 OCPU y 24 GB). Si dice "Out of capacity", reintentar más tarde o probar con otro *availability domain*.
   - **Add SSH keys → Paste public key:** el contenido de `~/.ssh/galileo_oracle.pub`.
3. Anotar la **Public IP address** de la instancia.
4. Abrir los puertos 80 y 443. Ir a *Networking → Virtual cloud networks*, entrar a la VCN de la instancia y después a *Security Lists → Default Security List → Add Ingress Rules*. Cargar dos reglas, una con *Destination port* `80` y otra con `443`; en las dos, *Source CIDR* `0.0.0.0/0` y protocolo TCP. El firewall interno de Ubuntu lo abre el script.

### 2. Dominio gratis en DuckDNS

1. Entrar a <https://www.duckdns.org> (con Google, GitHub, etc.).
2. Crear un subdominio, por ejemplo `galileo-eest5`, y en *current ip* poner la IP pública de Oracle. Tocar *update ip*.
3. Comprobar desde la PC que el nombre apunta a la IP:

   ```bash
   nslookup galileo-eest5.duckdns.org
   ```

   La IP de Oracle no cambia mientras la instancia exista.

### 3. Desplegar

Desde la raíz del repo, en Git Bash, con el código ya commiteado (se sube `HEAD`):

```bash
bash deploy/desplegar.sh <IP> galileo-eest5.duckdns.org
```

Para llevar también los datos de la base local (alumnos, cursos, asistencias), con el stack local levantado:

```bash
bash deploy/desplegar.sh <IP> galileo-eest5.duckdns.org --con-mis-datos
```

El script:

1. Se conecta por SSH (`~/.ssh/galileo_oracle`, usuario `ubuntu`).
2. Instala Docker (repositorio oficial), abre 80 y 443 en iptables y agrega 2 GB de swap.
3. Sube el código (`git archive HEAD`) a `~/galileo`.
4. Genera el `.env` del servidor **una sola vez**, con contraseñas aleatorias, `APP_ENV=prod` y `APP_URL=https://<dominio>`. Ese archivo nunca sale del servidor.
5. Pide el certificado de Let's Encrypt. Antes **pregunta si aceptás sus términos** (<https://letsencrypt.org/repository/>). Con `EMAIL_CERT=tu@correo` avisa antes de vencimientos; sin email también funciona.
6. Construye y levanta todo. El primer build tarda unos minutos.
7. Si el primer Administrador sigue con la contraseña inicial, le da una **contraseña temporal aleatoria que muestra una sola vez** en la terminal (pide cambiarla al entrar). Después bloquea el resto de las cuentas con la contraseña inicial.
8. Verifica `https://<dominio>/api/salud.php`.

Al terminar muestra `Listo: https://<dominio>`.

### 4. Rehabilitar usuarios

Las cuentas bloqueadas se rehabilitan desde **Administración → Usuarios → Restablecer**. Ahí se genera una contraseña temporal para pasarle a cada persona, que la cambia al entrar.

## Actualizar

Commitear los cambios y volver a correr el mismo comando sin `--con-mis-datos`:

```bash
bash deploy/desplegar.sh <IP> galileo-eest5.duckdns.org
```

Las migraciones nuevas de `db/` **no se aplican solas** sobre una base existente (Docker solo las corre al crear el volumen). Hay que aplicarlas a mano en el servidor:

```bash
ssh -i ~/.ssh/galileo_oracle ubuntu@<IP> "cd ~/galileo && ./dc exec -T mysql sh -c 'exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\"' < db/23-....sql"
```

## Operación en el servidor

`~/galileo/dc` es un atajo de `docker compose` con la configuración de producción.

```bash
ssh -i ~/.ssh/galileo_oracle ubuntu@<IP>
cd ~/galileo
./dc ps                      # estado de los servicios
./dc logs -f backend         # logs
./dc exec backup sh /respaldar.sh --ahora                       # backup manual
COMPOSE_ARGS="-f docker-compose.yml -f deploy/produccion/compose.produccion.yml" \
  sudo -E bash deploy/backup/restaurar.sh backups/diario/<archivo>.sql.gz   # restaurar
```

- **Backups:** quedan en `~/galileo/backups` (14 diarios y 6 mensuales). Conviene bajarlos a otra máquina de vez en cuando:

  ```bash
  scp -i ~/.ssh/galileo_oracle -r ubuntu@<IP>:galileo/backups ./backups-servidor
  ```

- **Monitoreo:** "Estado del sistema" en Galisencia y un monitor gratis de UptimeRobot hacia `https://<dominio>/api/salud.php` (ver `DOCKER_INSTRUCTIONS.md`).
- **Emails:** para enviar avisos reales, completar `SMTP_*` en `~/galileo/.env` (por ejemplo, Brevo o Gmail con contraseña de aplicación) y correr `./dc up -d`.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `ssh: connect ... timed out` | La IP es otra o falta la regla del puerto 22 en la Security List (viene por defecto). |
| Certbot: `Timeout during connect` | Faltan las reglas de 80/443 en la Security List o DuckDNS apunta a otra IP. |
| Certbot: `too many certificates` | Let's Encrypt limita los pedidos repetidos: esperar unas horas. |
| La página no carga pero `./dc ps` está bien | Se entró por IP: hay que usar el dominio. |
| `Out of capacity` al crear la VM | Falta de máquinas Ampere gratis en la región: reintentar más tarde. |
| Oracle avisa que va a reclamar la instancia | Las instancias gratis con muy poco uso se pueden reclamar. Pasar la cuenta a *Pay As You Go* evita eso y sigue sin cobrar si no se pasan los límites gratis. |
