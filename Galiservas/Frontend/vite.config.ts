import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Galiservas se sirve en /galiservas/ detrás del proxy de entrada. En
// desarrollo, /api se reenvía al backend del perfil dev de Docker (:8080).
export default defineConfig({
  base: '/galiservas/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_API ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
})
