import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server proxies all /api/* requests to the local Express backend.
// Start the backend first: cd backend && node server.js
// Then in a second terminal: npm run dev
//
// In production (Firebase Hosting) the rewrites in firebase.json
// handle /api/* routing to Cloud Functions — no proxy needed there.

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
        // No rewrite needed — backend routes match /api/sendmail etc. exactly
      },
    },
  },
})
