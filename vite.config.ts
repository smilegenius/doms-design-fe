import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `appType: 'spa'` keeps Vite's history-API fallback turned on for both the
// dev server and `vite preview`, so refreshing on a nested URL like
// /supplier/cases always returns index.html and React Router takes over.
export default defineConfig({
  plugins: [react()],
  appType: 'spa',
})
