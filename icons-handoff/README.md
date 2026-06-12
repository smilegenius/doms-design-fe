# Icons Handoff — Smile Genius Supplier Portal

Two categories of icons live in this prototype:

## 1. Static assets (in this folder)

`public-assets/` contains every PNG / SVG that ships with the app — scanner brand images, dental arch SVGs, the FDI tooth chart, etc.

| File | Notes |
|------|-------|
| `dental-arch.svg` | 171.9 KB |
| `favicon.svg` | 0.9 KB |
| `FDI.svg` | 157.5 KB |
| `scanner-3shape.png.png` | 122.9 KB |
| `scanner-itero.png.png` | 9.0 KB |
| `scanner-medit.png.png` | 38.4 KB |
| `teeth-3d.png` | 108.5 KB |

## 2. Lucide icons (raw SVGs included)

`lucide-svg/` now contains every lucide icon used in the app as a plain .svg file (kebab-case filename). The dev can drop them into any design tool — or just install the npm package and use the React components.

### Original npm path

Every other icon in the UI comes from `lucide-react` (131 unique). They are JSX components rendered as inline SVGs — there are no .svg files in the repo for them. See **LUCIDE_ICONS.md** for the full list plus the download URL pattern. **LUCIDE_ICONS.txt** has the same list as a tab-separated plain file for spreadsheets / scripts.

## Quick start for the developer

```bash
npm install lucide-react
```

Then `import { Mail, ChevronDown } from 'lucide-react'` and use as JSX. The static assets in `public-assets/` should be dropped into the Vite/Next/CRA `public/` folder so paths like `/scanner-itero.png.png` resolve.

## Source-of-truth links

- Lucide icon browser: https://lucide.dev/icons
- Lucide GitHub (raw SVGs): https://github.com/lucide-icons/lucide/tree/main/icons
- npm package: https://www.npmjs.com/package/lucide-react
