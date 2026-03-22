import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server proxies all /api/* requests to the local Express backend.
// Start the backend first: cd ../HR-Autonomous-Backend && npm run dev
// Then in a second terminal: npm run dev
//
// In production (Vercel) VITE_BACKEND_URL points to Render backend —
// useData.js and ai.js use it to call the API directly (no proxy needed).

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})