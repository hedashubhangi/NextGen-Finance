import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT || process.env.PORT || '3001'}`,
    },
  },
})
