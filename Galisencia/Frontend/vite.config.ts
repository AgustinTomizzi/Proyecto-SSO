import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy al backend SSO (PHP) cuando esté desplegado.
  // El frontend usa datos mock por defecto; para conectar la BD real,
  // seteá VITE_API_URL al backend y descomentá este bloque apuntando a la URL.
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'http://server.galileo.edu.ar:81',
  //       changeOrigin: true,
  //     },
  //   },
  // },
})
