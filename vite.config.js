import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_FUNCTIONS_URL (set in .env.local) enables direct Cloud Function calls
// during local dev, bypassing the need for a Vercel/Firebase emulator.
//
// Example .env.local:
//   VITE_FUNCTIONS_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net
//
// In production (Firebase Hosting) this env var is not set — the rewrites
// in firebase.json route /api/* to the Cloud Functions automatically.
const functionsUrl = process.env.VITE_FUNCTIONS_URL || ''

const proxyTarget = functionsUrl ? {
  '/api/sendmail': {
    target:      functionsUrl,
    changeOrigin: true,
    rewrite:     () => '/sendWelcomeEmail',
  },
  '/api/deleteOrphanedAuth': {
    target:      functionsUrl,
    changeOrigin: true,
    rewrite:     () => '/deleteOrphanedAuth',
  },
} : {}

export default defineConfig({
  plugins: [react()],
  server: { proxy: proxyTarget },
})