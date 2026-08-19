import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy al backend (PHP/Apache). En dev asume Apache en :80; ajustá el
  // target si tu PHP corre en otro puerto. En Docker esto lo hace nginx.
  // También podés setear VITE_API_URL al backend directamente.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
      },
    },
  },
})
