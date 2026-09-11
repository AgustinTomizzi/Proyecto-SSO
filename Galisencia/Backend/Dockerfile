# Imagen base de PHP con Apache
FROM php:8.2-apache

# Instalar extensiones necesarias
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Habilitar mod_rewrite de Apache
RUN a2enmod rewrite

# Configurar el directorio de trabajo
WORKDIR /var/www/html

# Copiar archivos del backend
COPY login-php/ /var/www/html/

# Dar permisos a Apache
RUN chown -R www-data:www-data /var/www/html

# Exponer puerto 80
EXPOSE 80

# Iniciar Apache en primer plano
CMD ["apache2-foreground"]
