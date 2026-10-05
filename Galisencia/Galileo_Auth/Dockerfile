FROM php:8.2-apache

# Extensiones PDO + MySQL
RUN docker-php-ext-install pdo pdo_mysql

# Sesion (strict mode, cookie HttpOnly/SameSite) y ocultar errores/version.
COPY docker/php-seguridad.ini /usr/local/etc/php/conf.d/seguridad.ini

WORKDIR /var/www/html

# Copiar la app Galileo_Auth (el docroot queda en /var/www/html,
# asi que /api/login.php resuelve a Galileo_Auth/api/login.php).
# .dockerignore deja fuera Dockerfile y la documentacion; docker/ (config de
# PHP) se borra del docroot para no servirlo.
COPY . .

RUN rm -rf /var/www/html/docker \
    && chown -R www-data:www-data /var/www/html \
    && a2enmod rewrite

EXPOSE 80
