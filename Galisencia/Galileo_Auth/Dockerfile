FROM php:8.2-apache

# Extensiones PDO + MySQL
RUN docker-php-ext-install pdo pdo_mysql

# Sesiones persistentes y cookie accesible en todo /api
# Usamos /tmp (world-writable) para evitar problemas de permisos con www-data.
RUN { \
        echo "session.save_path = /tmp"; \
        echo "session.cookie_path = /"; \
        echo "session.cookie_httponly = 1"; \
        echo "session.cookie_samesite = Lax"; \
    } > /usr/local/etc/php/conf.d/session.ini

WORKDIR /var/www/html

# Copiar la app Galileo_Auth (el docroot queda en /var/www/html,
# asi que /api/login.php resuelve a Galileo_Auth/api/login.php)
COPY . .

RUN chown -R www-data:www-data /var/www/html \
    && a2enmod rewrite

EXPOSE 80
