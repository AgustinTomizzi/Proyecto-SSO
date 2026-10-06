# Dependencias PHP (Composer): la librería OIDC. vendor/ no se versiona.
FROM composer:2 AS dependencias
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --optimize-autoloader

FROM php:8.2-apache

# Extensiones PDO + MySQL
RUN docker-php-ext-install pdo pdo_mysql

# Sesion (strict mode, cookie HttpOnly/SameSite) y ocultar errores/version.
COPY docker/php-seguridad.ini /usr/local/etc/php/conf.d/seguridad.ini
# Apache niega includes/, config/ y cli/: solo /api es público.
COPY docker/apache-seguridad.conf /etc/apache2/conf-enabled/galileo-seguridad.conf

WORKDIR /var/www/html

# Copiar la app Galileo_Auth (el docroot queda en /var/www/html,
# asi que /api/login.php resuelve a Galileo_Auth/api/login.php).
# .dockerignore deja fuera Dockerfile y la documentacion; docker/ (config de
# PHP) se borra del docroot para no servirlo.
COPY . .

COPY --from=dependencias /app/vendor /var/www/html/vendor

RUN rm -rf /var/www/html/docker \
    && chown -R www-data:www-data /var/www/html \
    && a2enmod rewrite

EXPOSE 80
