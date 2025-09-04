import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      '@tanstack/react-virtual',
    ],
    exclude: [],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    commonjsOptions: {
      include: [/@tanstack/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
})
