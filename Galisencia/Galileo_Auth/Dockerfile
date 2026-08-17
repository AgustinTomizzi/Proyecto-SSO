FROM php:8.2-apache

# Extensiones PDO + MySQL
RUN docker-php-ext-install pdo pdo_mysql

WORKDIR /var/www/html

# Copiar la app Galileo_Auth (el docroot queda en /var/www/html,
# asi que /api/login.php resuelve a Galileo_Auth/api/login.php)
COPY . .

RUN chown -R www-data:www-data /var/www/html \
    && a2enmod rewrite

EXPOSE 80
