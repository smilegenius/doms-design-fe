import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SPA fallback so a refresh on /go/work/SG-28491 still serves index.html.
export default defineConfig({
  plugins: [react()],
  appType: 'spa',
})
