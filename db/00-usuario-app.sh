#!/bin/bash
# 00-usuario-app.sh
# Crea el usuario MySQL con el que se conecta el backend. Solo tiene permisos
# de datos (sin DDL) sobre la base de la aplicacion; root queda reservado para
# administrar. La imagen oficial de MySQL lo ejecuta (o lo incluye con `.`)
# en el primer arranque, antes de los .sql.

if [ -z "${DB_APP_USER:-}" ] || [ -z "${DB_APP_PASSWORD:-}" ]; then
  echo "00-usuario-app.sh: faltan DB_APP_USER o DB_APP_PASSWORD (ver .env.example)" >&2
  exit 1
fi

# Duplicar comillas simples para usarlas dentro de literales SQL.
app_user_sql=${DB_APP_USER//\'/\'\'}
app_password_sql=${DB_APP_PASSWORD//\'/\'\'}

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${app_user_sql}'@'%' IDENTIFIED BY '${app_password_sql}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO '${app_user_sql}'@'%';
FLUSH PRIVILEGES;
SQL
