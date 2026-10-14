import { fileURLToPath } from 'node:url';
import path from 'node:path';
import base from '../tailwind.config.js';

// Same theme as the portal (imported from the root config, unchanged), with the
// content globs widened to this folder plus the portal source it reuses.
const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  ...base,
  content: [
    path.join(here, 'index.html'),
    path.join(here, '**/*.{ts,tsx}').replace(/\\/g, '/'),
    path.join(here, '../src/**/*.{js,ts,jsx,tsx}').replace(/\\/g, '/'),
    `!${path.join(here, 'node_modules/**').replace(/\\/g, '/')}`,
  ],
};
