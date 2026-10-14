import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ── SALES Feedbacks standalone dev entry ─────────────────────────────────────
// Serves this folder on its own port so nothing outside it (App.tsx routes,
// root Tailwind / tsconfig, deploy config) has to change. The portal's own
// components are imported read-only from ../src.
//
//   npx vite --config "SALES Feedbacks/vite.config.ts"

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

export default defineConfig({
  root: here,
  appType: 'spa',
  // The portal's static assets (FDI chart, logos, …) are served unchanged.
  publicDir: path.join(repoRoot, 'public'),
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss({ config: path.join(here, 'tailwind.config.js') }), autoprefixer()],
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
  },
});
