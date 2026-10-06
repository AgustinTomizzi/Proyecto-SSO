# Rutas compartidas por http.conf y https.conf: un solo dominio para todo.
server_tokens off;
client_max_body_size 6m;

location /api/ {
    proxy_pass http://backend:80/api/;
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
    proxy_pass http://galiservas:80/;
    proxy_set_header Host $host;
}

location / {
    proxy_pass http://frontend:80;
    proxy_set_header Host $host;
}
