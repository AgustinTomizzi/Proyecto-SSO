# Instrucciones Docker - Proyecto SSO

## Estructura Actual

El proyecto está configurado con Docker para desplegar el frontend (React + Vite) en producción, con la estructura preparada para integrar el backend (PHP + MySQL) en el futuro.

## Archivos Creados

### Frontend
- `Galisencia/Frontend/Dockerfile` - Imagen Docker para el frontend
- `Galisencia/Frontend/.dockerignore` - Archivos a excluir de la imagen Docker

### Backend (preparado para futuro)
- `Galisencia/Backend/Dockerfile` - Imagen Docker para el backend PHP
- `Galisencia/Backend/.dockerignore` - Archivos a excluir de la imagen Docker

### Orquestación
- `docker-compose.yml` - Configuración de servicios (frontend activo, backend comentado)

## Uso Actual (Solo Frontend)

### Construir y ejecutar el frontend
```bash
docker-compose up --build -d frontend
```

### Ver el frontend
Abre tu navegador en: `http://localhost:3000`

### Detener el frontend
```bash
docker-compose down
```

### Ver logs del frontend
```bash
docker-compose logs frontend
```

## Preparación para Backend (Futuro)

Cuando estés listo para integrar el backend PHP:

### 1. Actualizar configuración de conexión
Edita `Galisencia/Backend/login-php/config/conexion.php` para usar variables de entorno:

```php
$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME') ?: 'login_app';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
```

### 2. Activar servicios en docker-compose.yml
Descomenta los servicios `backend` y `mysql` en el archivo `docker-compose.yml`:

```yaml
# Descomenta estas líneas
backend:
  # ... configuración existente ...

mysql:
  # ... configuración existente ...
```

### 3. Configurar credenciales de base de datos
Modifica las variables de entorno en `docker-compose.yml`:

```yaml
mysql:
  environment:
    MYSQL_ROOT_PASSWORD: tu_contraseña_segura
    MYSQL_DATABASE: login_app
```

```yaml
backend:
  environment:
    - DB_HOST=mysql
    - DB_NAME=login_app
    - DB_USER=root
    - DB_PASSWORD=tu_contraseña_segura
```

### 4. Ejecutar con backend activado
```bash
docker-compose up --build -d
```

Esto iniciará:
- Frontend en `http://localhost:3000`
- Backend en `http://localhost:8000`
- MySQL en puerto interno (no expuesto)

### 5. Verificar conexión
El backend se conectará automáticamente a MySQL usando las variables de entorno configuradas.

## Comandos Útiles

### Reconstruir imagen
```bash
docker-compose build frontend
# o para todos los servicios:
docker-compose build
```

### Ver contenedores en ejecución
```bash
docker-compose ps
```

### Acceder a un contenedor
```bash
docker-compose exec frontend sh
docker-compose exec backend bash
```

### Limpiar todo (detener y eliminar contenedores, redes, volúmenes)
```bash
docker-compose down -v
```

## Solución de Problemas

### El frontend no carga
1. Verifica que el puerto 3000 no esté en uso
2. Revisa los logs: `docker-compose logs frontend`
3. Asegúrate de que la construcción fue exitosa: `docker-compose build frontend`

### Error de conexión a base de datos (cuando el backend esté activo)
1. Verifica que el contenedor MySQL esté corriendo: `docker-compose ps mysql`
2. Revisa los logs de MySQL: `docker-compose logs mysql`
3. Confirma que las credenciales en `docker-compose.yml` sean correctas

### Cambios en el código no se reflejan
1. Reconstruye la imagen: `docker-compose build`
2. Reinicia los contenedores: `docker-compose up -d`

## Estructura de Puertos

- **Frontend**: 3000 (externo) → 80 (interno)
- **Backend**: 8000 (externo) → 80 (interno) - [cuando se active]
- **MySQL**: No expuesto externamente (solo comunicación interna) - [cuando se active]

## Próximos Pasos Recomendados

1. **Desarrollo actual**: Usa el frontend Docker para pruebas de UI
2. **Integración backend**: Cuando el backend esté listo, sigue los pasos de "Preparación para Backend"
3. **Producción**: Considera usar variables de entorno externas (`.env` file) para credenciales sensibles
4. **Dominio personalizado**: Configura nginx con SSL para producción

## Notas de Seguridad

- Las contraseuestas en `docker-compose.yml` son solo para desarrollo
- Para producción, usa secretos de Docker o variables de entorno externas
- No expongas el puerto de MySQL directamente en producción
- Considera implementar HTTPS/TLS para el frontend
