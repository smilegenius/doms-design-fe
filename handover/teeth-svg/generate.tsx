// Regenerates this folder's SVGs from the app's own tooth artwork (src/app/newCase/ToothShapes.tsx + ToothLineArt.ts).
// Run from the repo root:
//   npx esbuild handover/teeth-svg/generate.tsx --bundle --platform=node --format=esm --outfile=handover/teeth-svg/.gen.mjs --jsx=automatic --packages=external && node handover/teeth-svg/.gen.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToothDefs, ToothSvg, ToothLook, toothX, CHART_W } from '../../src/app/newCase/ToothShapes';

const OUT = dirname(fileURLToPath(import.meta.url));
const PX_PER_MM = 8;
const UID = 'sg';

const QUADS = ['1', '2', '3', '4'];
const IDS = QUADS.flatMap(q => [1, 2, 3, 4, 5, 6, 7, 8].map(n => `${q}${n}`));

const STYLES: Record<string, ToothLook> = { color: {}, lineart: { mono: true } };
const STATES: Record<string, ToothLook> = {
  default: {},
  selected: { lit: true },
  missing: { missing: true },
  implant: { implant: true },
  pontic: { pontic: true },
};

// Gradients every tooth needs, inlined into each file so it stands alone.
const defsInner = renderToStaticMarkup(<ToothDefs uid={UID} />).replace(/^[\s\S]*?<defs>/, '').replace(/<\/defs>[\s\S]*$/, '');

function usedDefs(body: string): string {
  // Keep only the gradients this tooth references.
  const ids = new Set([...body.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]));
  const grads = defsInner.match(/<linearGradient[\s\S]*?<\/linearGradient>/g) ?? [];
  return grads.filter(g => ids.has(/id="([^"]+)"/.exec(g)![1])).join('');
}

interface Rendered { viewBox: number[]; body: string }
function renderTooth(id: string, look: ToothLook): Rendered {
  const html = renderToStaticMarkup(<ToothSvg id={id} uid={UID} look={look} />);
  const vb = /viewBox="([^"]+)"/.exec(html)![1].split(' ').map(Number);
  const body = html.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return { viewBox: vb, body };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
function standalone({ viewBox, body }: Rendered, title: string): string {
  const [, , w, h] = viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${r2(w * PX_PER_MM)}" height="${r2(h * PX_PER_MM)}" role="img"><title>${title}</title><defs>${usedDefs(body)}</defs>${body}</svg>\n`;
}

const NAMES = ['Central incisor', 'Lateral incisor', 'Canine', 'First premolar', 'Second premolar', 'First molar', 'Second molar', 'Third molar'];
const QUAD_NAMES: Record<string, string> = { '1': 'Upper right', '2': 'Upper left', '3': 'Lower left', '4': 'Lower right' };
const universal = (id: string) => {
  const q = id[0], n = Number(id[1]);
  return q === '1' ? 9 - n : q === '2' ? 8 + n : q === '3' ? 25 - n : 24 + n;
};
const nameOf = (id: string) => `${QUAD_NAMES[id[0]]} ${NAMES[Number(id[1]) - 1].toLowerCase()}`;

const write = (rel: string, text: string) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};

let files = 0;
const manifest: Record<string, unknown>[] = [];
for (const [style, sLook] of Object.entries(STYLES)) {
  for (const [state, stLook] of Object.entries(STATES)) {
    const look = { ...sLook, ...stLook };
    const rendered = IDS.map(id => [id, renderTooth(id, look)] as const);
    for (const [id, r] of rendered) {
      write(`${style}/${state}/tooth-${id}.svg`, standalone(r, `Tooth ${id} (FDI), ${nameOf(id)}, ${state}`));
      files++;
      if (style === 'color' && state === 'default') {
        manifest.push({
          fdi: id, universal: universal(id), name: nameOf(id),
          arch: id[0] === '1' || id[0] === '2' ? 'upper' : 'lower',
          side: id[0] === '1' || id[0] === '4' ? 'right' : 'left',
          widthMm: r2(r.viewBox[2]), heightMm: r2(r.viewBox[3]),
          centerXmm: r2(toothX(id)),
        });
      }
    }

    // Whole-mouth chart: the 32 teeth placed as the app places them (viewer facing the patient, crowns meeting in the middle).
    const upperH = Math.max(...rendered.filter(([id]) => id < '3').map(([, r]) => r.viewBox[3]));
    const lowerH = Math.max(...rendered.filter(([id]) => id >= '3').map(([, r]) => r.viewBox[3]));
    const MID = 1.5;
    const H = upperH + MID + lowerH;
    const used = new Set<string>();
    const nested = rendered.map(([id, r]) => {
      const [vx, vy, vw, vh] = r.viewBox;
      const x = toothX(id) - vw / 2;
      const y = id < '3' ? upperH - vh : upperH + MID;
      [...r.body.matchAll(/url\(#([^)]+)\)/g)].forEach(m => used.add(m[1]));
      return `<svg id="t${id}" x="${r2(x)}" y="${r2(y)}" width="${r2(vw)}" height="${r2(vh)}" viewBox="${vx} ${vy} ${vw} ${vh}" overflow="visible">${r.body}</svg>`;
    }).join('');
    const grads = (defsInner.match(/<linearGradient[\s\S]*?<\/linearGradient>/g) ?? []).filter(g => used.has(/id="([^"]+)"/.exec(g)![1])).join('');
    write(`${style}/chart-${state}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(CHART_W)} ${r2(H)}" width="${r2(CHART_W * PX_PER_MM)}" height="${r2(H * PX_PER_MM)}" role="img"><title>Full mouth chart, ${style}, ${state}</title><defs>${grads}</defs>${nested}</svg>\n`);
    files++;
  }
}
write('manifest.json', JSON.stringify({ unitsNote: 'mm; SVG viewBox units are millimetres', pxPerMm: PX_PER_MM, styles: Object.keys(STYLES), states: Object.keys(STATES), teeth: manifest }, null, 2) + '\n');
console.log(`wrote ${files} svg files`);
