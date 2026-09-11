# Etapa de build
FROM node:20-alpine AS builder

# URLs inyectadas en tiempo de build (ver docker-compose.yml)
ARG VITE_API_URL=/api
ARG VITE_GALISENCIA_URL=http://localhost:3000

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GALISENCIA_URL=$VITE_GALISENCIA_URL

WORKDIR /app

# Copiar archivos de configuración primero para mejor cacheo
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa de producción - imagen ligera para servir los archivos estáticos
FROM nginx:alpine

# Copiar los archivos de build al directorio de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de nginx con proxy a /api (backend PHP)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]