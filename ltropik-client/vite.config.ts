import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5186',
      '/hubs': { target: 'http://localhost:5186', ws: true },
      '/uploads': 'http://localhost:5186',
    },
  },
  build: {
    // esbuild minifier avoids rolldown WASM OOM on constrained machines
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
  },
})
