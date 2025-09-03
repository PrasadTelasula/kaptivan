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
      'react-window',
      'react-virtualized-auto-sizer',
    ],
    exclude: [],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    commonjsOptions: {
      include: [/react-window/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
})
