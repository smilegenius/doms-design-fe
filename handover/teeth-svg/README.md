# Teeth SVG assets

All 32 permanent teeth as standalone SVGs, exported from the app's current tooth artwork
(`src/app/newCase/ToothShapes.tsx` and `ToothLineArt.ts`), so they match the New Case teeth chart
and the order form exactly. Open `index.html` to preview everything.

## Folder layout

```
teeth-svg/
  color/                 colour set (New Case teeth chart)
    default/ selected/ missing/ implant/ pontic/
      tooth-11.svg … tooth-48.svg      32 files per state, FDI numbers
    chart-default.svg …                whole mouth, all 32 teeth placed
  lineart/               line-art set (Dental Order Form chart), same structure
  manifest.json          per tooth: FDI, Universal number, name, arch, side, size (mm), x position in chart (mm)
  generate.tsx           regenerates everything from the source components
  index.html             preview sheet
```

330 SVGs in total: 2 styles × 5 states × 32 teeth, plus 10 whole-mouth charts.

## States

| State | Look |
|---|---|
| `default` | natural tooth, crown and root |
| `selected` | teal (colour) / grey with dark outline (line art) |
| `missing` | dashed ghost outline, no fill |
| `implant` | crown on a threaded fixture |
| `pontic` | crown only, dashed (bridge) |

## Notes for using them

- **Numbering:** FDI. Quadrants 1/2 are upper right/left, 3/4 lower left/right. `manifest.json` has the Universal number for US labs.
- **Orientation is baked in:** upper teeth point crown down, lower crown up, and each side is already mirrored, as seen facing the patient. No flipping needed.
- **Units:** the viewBox is in millimetres from real tooth widths, so teeth drawn at the same scale line up. The `width`/`height` attributes are 8 px per mm; override them with CSS (`height: 80px; width: auto`).
- **Stroke widths** use `vector-effect="non-scaling-stroke"`, so outlines stay 1–1.5 px at any size.
- **Inlining several SVGs in one page:** gradient ids (`sg-en`, `sg-se`…) are the same in every file. That's fine (they're identical), but if you edit colours per file, give each file its own id prefix. As `<img src>` there's no clash at all.
- **Whole-mouth charts** wrap each tooth in `<svg id="t11">`, `<svg id="t12">` and so on, so you can find a tooth inside a chart file by id.
- **Other treatment colours** (purple, amber, pink, green for multi-treatment orders) aren't exported as files. They're in `TOOTH_HUES` in `ToothShapes.tsx` if you need them.

## Regenerating

From the repo root:

```
npx esbuild handover/teeth-svg/generate.tsx --bundle --platform=node --format=esm --outfile=handover/teeth-svg/.gen.mjs --jsx=automatic --packages=external
node handover/teeth-svg/.gen.mjs
```
Delete `.gen.mjs` afterwards.
