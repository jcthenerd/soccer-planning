import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Built output (dist/) is served by the Express server at / (see
// server/index.js); run `npm run build` here after any source change.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
