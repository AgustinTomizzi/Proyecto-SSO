import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // En desarrollo, /api se reenvía al backend del perfil dev de Docker
  // (docker compose --profile dev up -> :8080) o a VITE_PROXY_API. En Docker
  // lo hace el proxy de entrada (proxy/).
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_API ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
