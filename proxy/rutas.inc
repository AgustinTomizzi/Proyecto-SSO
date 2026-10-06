# Rutas compartidas por http.conf y https.conf: un solo dominio para todo.
server_tokens off;
client_max_body_size 6m;

# DNS interno de Docker. Con proxy_pass por variable, nginx vuelve a resolver
# los nombres de los servicios: si un contenedor se recrea y cambia de IP, el
# proxy no queda apuntando a la vieja.
resolver 127.0.0.11 valid=10s ipv6=off;

location /api/ {
    set $upstream_backend http://backend:80;
    proxy_pass $upstream_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Con HTTPS el proxy agrega HSTS a todo (https.conf); se descarta el que
    # agrega PHP para no duplicarlo.
    proxy_hide_header Strict-Transport-Security;
}

location = /galiservas {
    return 301 /galiservas/;
}

# Galiservas se compila con base /galiservas/; el contenedor sirve en /.
location /galiservas/ {
    set $upstream_galiservas http://galiservas:80;
    rewrite ^/galiservas/(.*)$ /$1 break;
    proxy_pass $upstream_galiservas;
    proxy_set_header Host $host;
}

location / {
    set $upstream_frontend http://frontend:80;
    proxy_pass $upstream_frontend;
    proxy_set_header Host $host;
}
