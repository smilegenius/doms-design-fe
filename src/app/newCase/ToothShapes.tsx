// ─── New Case Flow · tooth artwork ───────────────────────────────────────────
// Anatomical teeth for the horizontal Teeth Chart, seen from the buccal /
// labial side, drawn in millimetres from typical mesiodistal crown widths,
// cervical widths, crown heights and root lengths (roots a little shortened so
// two rows stay compact: crown to root about 1 : 1.4). Each type has its own
// outline: wide shovel-shaped upper centrals, narrower laterals, pointed
// canines with the longest root, premolars with one buccal cusp tip (two roots
// on the upper first), molars with their buccal cusps, a cervical constriction
// and two roots (lower) or three (upper: the palatal one behind, lighter).
//
// Every shape is drawn once, crown up and mesial on the right (the patient's
// right side as the viewer sees it), then flipped for the upper jaw (crowns
// down, roots up) and mirrored for the patient's left.

import { CSSProperties, memo } from 'react';

// ─── Dimensions ──────────────────────────────────────────────────────────────

/** Space between neighbouring teeth, and half the gap either side of the midline (mm). */
export const GAP = 1.4;
export const MID_HALF = 1.1;
/** Room kept above and below each shape for its outline. */
const PAD = 0.45;

type Pt = [number, number];
type CrownSpec =
  | { t: 'incisor'; cD: number; cM: number; dR: number; mR: number }
  | { t: 'cusp'; tip: number; cD: number; cM: number; sD: Pt; sM: Pt; sharp: number; sharpY: number }
  | { t: 'molar'; cusps: Pt[]; notches: Pt[]; cD: number; cM: number };
type RootSpec =
  | { t: 'single'; apex: number; tp: number; au: number; fused?: boolean }
  | { t: 'pm1' }
  | { t: 'upper3' | 'lower2'; ud: number; wd: number; rd: number; um: number; wm: number; rm: number; rf: number };
/** w: crown width, hc: crown height, hr: root length (mm); cw: cervical width as a share of w; vS: CEJ height at the sides (share of hc). */
interface Spec { w: number; hc: number; hr: number; cw: number; vS: number; crown: CrownSpec; root: RootSpec }

const UPPER: Record<number, Spec> = {
  1: { w: 8.5, hc: 10.5, hr: 12.5, cw: 0.82, vS: 0.9, crown: { t: 'incisor', cD: 0.3, cM: 0.17, dR: 0.17, mR: 0.07 }, root: { t: 'single', apex: 0.47, tp: 0.19, au: 0.1 } },
  2: { w: 6.5, hc: 9, hr: 11.5, cw: 0.77, vS: 0.9, crown: { t: 'incisor', cD: 0.36, cM: 0.22, dR: 0.27, mR: 0.12 }, root: { t: 'single', apex: 0.44, tp: 0.17, au: 0.1 } },
  3: { w: 7.5, hc: 10, hr: 15, cw: 0.73, vS: 0.89, crown: { t: 'cusp', tip: 0.55, cD: 0.44, cM: 0.3, sD: [0.17, 0.23], sM: [0.88, 0.17], sharp: 0.07, sharpY: 0.03 }, root: { t: 'single', apex: 0.48, tp: 0.2, au: 0.09 } },
  4: { w: 7, hc: 8.5, hr: 12, cw: 0.71, vS: 0.9, crown: { t: 'cusp', tip: 0.47, cD: 0.36, cM: 0.32, sD: [0.15, 0.14], sM: [0.85, 0.15], sharp: 0.08, sharpY: 0.025 }, root: { t: 'pm1' } },
  5: { w: 6.5, hc: 8, hr: 12, cw: 0.77, vS: 0.9, crown: { t: 'cusp', tip: 0.5, cD: 0.36, cM: 0.32, sD: [0.15, 0.13], sM: [0.85, 0.13], sharp: 0.16, sharpY: 0 }, root: { t: 'single', apex: 0.48, tp: 0.18, au: 0.11 } },
  6: { w: 10, hc: 7.5, hr: 11.5, cw: 0.8, vS: 0.93, crown: { t: 'molar', cusps: [[0.27, 0], [0.7, 0]], notches: [[0.47, 0.16]], cD: 0.38, cM: 0.27 }, root: { t: 'upper3', ud: 0.27, wd: 0.13, rd: 0.93, um: 0.7, wm: 0.16, rm: 0.97, rf: 0.3 } },
  7: { w: 9, hc: 7, hr: 11, cw: 0.78, vS: 0.93, crown: { t: 'molar', cusps: [[0.3, 0.05], [0.69, 0]], notches: [[0.5, 0.17]], cD: 0.4, cM: 0.28 }, root: { t: 'upper3', ud: 0.32, wd: 0.13, rd: 0.92, um: 0.66, wm: 0.15, rm: 0.96, rf: 0.4 } },
  8: { w: 8.5, hc: 6.5, hr: 9.5, cw: 0.76, vS: 0.93, crown: { t: 'molar', cusps: [[0.32, 0.08], [0.67, 0]], notches: [[0.5, 0.15]], cD: 0.42, cM: 0.3 }, root: { t: 'single', apex: 0.42, tp: 0.24, au: 0.14, fused: true } },
};
const LOWER: Record<number, Spec> = {
  1: { w: 5, hc: 9, hr: 11.5, cw: 0.7, vS: 0.9, crown: { t: 'incisor', cD: 0.2, cM: 0.15, dR: 0.1, mR: 0.08 }, root: { t: 'single', apex: 0.5, tp: 0.16, au: 0.11 } },
  2: { w: 5.5, hc: 9.5, hr: 12, cw: 0.73, vS: 0.9, crown: { t: 'incisor', cD: 0.26, cM: 0.16, dR: 0.13, mR: 0.08 }, root: { t: 'single', apex: 0.47, tp: 0.17, au: 0.11 } },
  3: { w: 7, hc: 11, hr: 14.5, cw: 0.79, vS: 0.89, crown: { t: 'cusp', tip: 0.6, cD: 0.42, cM: 0.22, sD: [0.2, 0.22], sM: [0.9, 0.1], sharp: 0.07, sharpY: 0.03 }, root: { t: 'single', apex: 0.5, tp: 0.2, au: 0.09 } },
  4: { w: 7, hc: 8.5, hr: 12.5, cw: 0.71, vS: 0.9, crown: { t: 'cusp', tip: 0.52, cD: 0.38, cM: 0.34, sD: [0.16, 0.17], sM: [0.86, 0.15], sharp: 0.08, sharpY: 0.03 }, root: { t: 'single', apex: 0.5, tp: 0.18, au: 0.1 } },
  5: { w: 7, hc: 8, hr: 13, cw: 0.71, vS: 0.9, crown: { t: 'cusp', tip: 0.5, cD: 0.36, cM: 0.32, sD: [0.16, 0.13], sM: [0.84, 0.12], sharp: 0.17, sharpY: 0 }, root: { t: 'single', apex: 0.48, tp: 0.19, au: 0.11 } },
  6: { w: 11, hc: 7.5, hr: 12.5, cw: 0.82, vS: 0.93, crown: { t: 'molar', cusps: [[0.14, 0.07], [0.42, 0], [0.76, 0]], notches: [[0.27, 0.15], [0.58, 0.17]], cD: 0.4, cM: 0.28 }, root: { t: 'lower2', ud: 0.24, wd: 0.16, rd: 0.95, um: 0.71, wm: 0.18, rm: 1, rf: 0.22 } },
  7: { w: 10.5, hc: 7, hr: 12, cw: 0.76, vS: 0.93, crown: { t: 'molar', cusps: [[0.28, 0.02], [0.72, 0]], notches: [[0.5, 0.15]], cD: 0.4, cM: 0.28 }, root: { t: 'lower2', ud: 0.29, wd: 0.15, rd: 0.95, um: 0.69, wm: 0.17, rm: 0.98, rf: 0.3 } },
  8: { w: 10, hc: 7, hr: 10, cw: 0.75, vS: 0.93, crown: { t: 'molar', cusps: [[0.3, 0.06], [0.7, 0.02]], notches: [[0.5, 0.13]], cD: 0.42, cM: 0.3 }, root: { t: 'single', apex: 0.44, tp: 0.25, au: 0.15, fused: true } },
};

const isUpper = (id: string) => id[0] === '1' || id[0] === '2';
const specOf = (id: string) => (isUpper(id) ? UPPER : LOWER)[Number(id[1])];
/** The width a tooth takes in its row, gap included (mm). */
export const slotOf = (id: string) => specOf(id).w + GAP;

const halfOf = (t: Record<number, Spec>) => [1, 2, 3, 4, 5, 6, 7, 8].reduce((s, k) => s + t[k].w + GAP, 0);
/** Half the chart, midline to the outer edge (mm): the wider jaw plus the midline gap and a little margin. */
export const HALF_W = Math.max(halfOf(UPPER), halfOf(LOWER)) + MID_HALF + 0.4;
export const CHART_W = HALF_W * 2;
/** The narrowest slot (lower lateral incisor): what decides whether full tooth numbers fit under each crown. */
export const NARROWEST_SLOT = Math.min(...[1, 2, 3, 4, 5, 6, 7, 8].map(k => Math.min(UPPER[k].w, LOWER[k].w))) + GAP;

/** The centre of a tooth from the chart's left edge (mm), viewer facing the patient: for moving between rows by keyboard. */
export function toothX(id: string): number {
  const t = isUpper(id) ? UPPER : LOWER;
  const pos = Number(id[1]);
  let off = MID_HALF;
  for (let k = 1; k < pos; k++) off += t[k].w + GAP;
  off += (t[pos].w + GAP) / 2;
  // Quadrants 1 and 4 (the patient's right) are on the viewer's left.
  return id[0] === '1' || id[0] === '4' ? HALF_W - off : HALF_W + off;
}

// ─── Geometry ────────────────────────────────────────────────────────────────

interface Geo {
  w: number; hc: number; T: number;
  crown: string; crownOutline: string; cej: string;
  roots: string; rootOutline: string; backRoot?: string;
  details: string[]; rootDetails: string[];
  screw: { body: string; abutment: string; threads: string };
}

const n2 = (v: number) => String(Math.round(v * 100) / 100);
const GEO = new Map<string, Geo>();

function build(s: Spec): Geo {
  const { w, hc, hr, cw, vS } = s;
  const a = 0.5 - cw / 2, b = 0.5 + cw / 2;
  // Crown points: u across the width, v down the crown (share of hc). Root points: r down the root (share of hr).
  const C = (u: number, v: number) => `${n2(u * w)} ${n2(v * hc)}`;
  const R = (u: number, r: number) => `${n2(u * w)} ${n2(hc + r * hr)}`;
  const c3 = (p1: string, p2: string, p: string) => ` C ${p1} ${p2} ${p}`;
  const DC = C(a, vS), MC = C(b, vS);
  const dip = vS + (1 - vS) * 0.75;
  // The cervical line, mesial to distal, bowed toward the root in the middle.
  const cejBack = c3(C(b - 0.1, dip), C(0.64, 1), C(0.5, 1)) + c3(C(0.36, 1), C(a + 0.1, dip), DC);

  // ── crown outline, distal cervix → around the crown → mesial cervix
  let out = `M ${DC}`;
  const details: string[] = [];
  const cr = s.crown;
  if (cr.t === 'incisor') {
    out += c3(C(a - 0.03, 0.72), C(0, cr.cD + 0.22), C(0, cr.cD));
    out += c3(C(0, cr.cD * 0.4), C(cr.dR * 0.25, 0.012), C(cr.dR, 0.012));
    out += c3(C(0.45, 0), C(0.62, 0), C(1 - cr.mR, 0));
    out += c3(C(1 - cr.mR * 0.3, 0), C(1, cr.cM * 0.4), C(1, cr.cM));
    out += c3(C(1, cr.cM + 0.3), C(b + 0.04, 0.72), MC);
  } else if (cr.t === 'cusp') {
    const [du, dv] = cr.sD, [mu, mv] = cr.sM;
    out += c3(C(a - 0.08, 0.72), C(0, cr.cD + 0.2), C(0, cr.cD));
    out += c3(C(0, cr.cD - 0.1), C(du - 0.08, dv + 0.05), C(du, dv));
    out += c3(C(du + 0.1, dv - 0.06), C(cr.tip - cr.sharp, cr.sharpY), C(cr.tip, 0));
    out += c3(C(cr.tip + cr.sharp, cr.sharpY), C(mu - 0.1, mv - 0.06), C(mu, mv));
    out += c3(C(mu + 0.08, mv + 0.05), C(1, cr.cM - 0.1), C(1, cr.cM));
    out += c3(C(1, cr.cM + 0.24), C(b + 0.07, 0.72), MC);
    // The buccal / labial ridge running down from the cusp tip.
    details.push(`M ${C(cr.tip, 0.08)}` + c3(C(cr.tip - 0.01, 0.3), C(cr.tip - 0.03, 0.48), C(cr.tip - 0.04, 0.62)));
  } else {
    const cs = cr.cusps, ns = cr.notches;
    out += c3(C(a - 0.07, 0.76), C(0, cr.cD + 0.2), C(0, cr.cD));
    out += c3(C(0, cr.cD - 0.17), C(cs[0][0] - 0.13, cs[0][1]), C(cs[0][0], cs[0][1]));
    ns.forEach(([nu, nv], i) => {
      const [tu, tv] = cs[i], [su, sv] = cs[i + 1];
      out += c3(C(tu + 0.4 * (nu - tu), tv), C(nu - 0.035, nv - 0.06), C(nu, nv));
      out += c3(C(nu + 0.035, nv - 0.06), C(su - 0.4 * (su - nu), sv), C(su, sv));
      // The buccal groove running down from the notch between two cusps.
      details.push(`M ${C(nu, nv + 0.03)}` + c3(C(nu + 0.006, nv + 0.14), C(nu - 0.004, 0.36), C(nu + 0.002, 0.46)));
    });
    const [lu, lv] = cs[cs.length - 1];
    out += c3(C(lu + 0.13, lv), C(1, cr.cM - 0.15), C(1, cr.cM));
    out += c3(C(1, cr.cM + 0.24), C(b + 0.07, 0.76), MC);
  }

  // ── roots, distal cervix → apex (apices) → mesial cervix; filled up into the crown so no seam shows
  const rt = s.root;
  const tuck = ` L ${C(b, 0.8)} L ${C(a, 0.8)} Z`;
  const single = (apex: number, tp: number, au: number) =>
    `M ${DC}` + c3(R(a - 0.01, 0.25), R(apex - tp, 0.75), R(apex - au, 0.95))
    + c3(R(apex - au / 2, 1.005), R(apex + au / 2, 1.005), R(apex + au, 0.95))
    + c3(R(apex + tp, 0.75), R(b + 0.01, 0.25), MC);
  let rootOutline: string;
  let backRoot: string | undefined;
  const rootDetails: string[] = [];
  if (rt.t === 'single') {
    rootOutline = single(rt.apex, rt.tp, rt.au);
    if (rt.fused) rootDetails.push(`M ${R(0.5, 0.12)}` + c3(R(0.49, 0.42), R(0.47, 0.66), R(0.45, 0.82)));
  } else if (rt.t === 'pm1') {
    // Upper first premolar: the buccal root in front, the palatal one behind it and a little distal.
    rootOutline = single(0.56, 0.15, 0.09);
    backRoot = `M ${C(a + 0.06, vS)}` + c3(R(a - 0.02, 0.4), R(0.22, 0.84), R(0.31, 0.96))
      + c3(R(0.35, 1.0), R(0.42, 0.99), R(0.45, 0.92)) + c3(R(0.5, 0.6), R(0.55, 0.3), C(0.56, vS)) + ' Z';
  } else {
    const { ud, wd, rd, um, wm, rm, rf } = rt;
    rootOutline = `M ${DC}`
      + c3(R(a - 0.02, 0.25), R(ud - wd * 0.9, 0.65), R(ud - wd / 2, rd - 0.06))
      + c3(R(ud - wd / 2 + 0.01, rd), R(ud + wd / 2 - 0.01, rd), R(ud + wd / 2, rd - 0.06))
      + c3(R(ud + wd / 2 + 0.02, rf + 0.35), R(0.42, rf), R(0.5, rf))
      + c3(R(0.58, rf), R(um - wm / 2 - 0.02, rf + 0.35), R(um - wm / 2, rm - 0.06))
      + c3(R(um - wm / 2 + 0.01, rm), R(um + wm / 2 - 0.01, rm), R(um + wm / 2, rm - 0.06))
      + c3(R(um + wm * 0.9, 0.65), R(b + 0.02, 0.25), MC);
    // Upper molars: the palatal root, the longest, shows between and beyond the two buccal ones.
    if (rt.t === 'upper3') {
      backRoot = `M ${C(0.36, vS)}` + c3(R(0.33, 0.45), R(0.4, 0.98), R(0.5, 1.04)) + c3(R(0.6, 0.98), R(0.67, 0.45), C(0.64, vS)) + ' Z';
    }
  }

  // ── an implant on record: abutment and a threaded fixture in place of the root
  const cx = 0.5 * w, sw = 0.62 * cw * w, aw = 0.5 * cw * w;
  const y0 = hc + 0.04 * hr, y1 = hc + 0.8 * hr;
  const tipHalf = sw * 0.36;
  const screwBody = `M ${n2(cx - sw / 2)} ${n2(y0)} L ${n2(cx + sw / 2)} ${n2(y0)} L ${n2(cx + tipHalf)} ${n2(y1 - sw * 0.3)}`
    + ` Q ${n2(cx)} ${n2(y1 + sw * 0.15)} ${n2(cx - tipHalf)} ${n2(y1 - sw * 0.3)} Z`;
  const abutment = `M ${n2(cx - aw / 2)} ${n2(0.84 * hc)} L ${n2(cx + aw / 2)} ${n2(0.84 * hc)} L ${n2(cx + aw / 2)} ${n2(y0 + 0.2)} L ${n2(cx - aw / 2)} ${n2(y0 + 0.2)} Z`;
  let threads = '';
  const yEnd = y1 - sw * 0.35;
  for (let y = y0 + 1.1; y < yEnd - 0.4; y += 1.25) {
    const k = (y - y0) / (yEnd - y0);
    const half = sw / 2 - k * (sw / 2 - tipHalf);
    threads += `M ${n2(cx - half)} ${n2(y + 0.4)} L ${n2(cx + half)} ${n2(y - 0.1)} `;
  }

  const T = hc + hr * 1.05;
  return {
    w, hc, T,
    crown: out + cejBack + ' Z',
    crownOutline: out,
    cej: `M ${MC}` + cejBack,
    roots: rootOutline + tuck,
    rootOutline,
    backRoot,
    details,
    rootDetails,
    screw: { body: screwBody, abutment, threads },
  };
}

function geometry(id: string): Geo {
  const key = `${isUpper(id) ? 'u' : 'l'}${id[1]}`;
  let g = GEO.get(key);
  if (!g) { g = build(specOf(id)); GEO.set(key, g); }
  return g;
}

// ─── Paint ───────────────────────────────────────────────────────────────────

/**
 * The shared gradients for one chart (enamel, a warmer root, a soft rounding
 * sheen, the selection teal, the grey of another service's crown, the metal of
 * an implant). Rendered once per chart, ids prefixed so charts never clash.
 */
export function ToothDefs({ uid }: { uid: string }) {
  const v = (id: string, stops: [number, string, number?][]) => (
    <linearGradient id={`${uid}-${id}`} x1="0" y1="0" x2="0" y2="1">
      {stops.map(([o, c, op]) => <stop key={o} offset={o} stopColor={c} stopOpacity={op ?? 1} />)}
    </linearGradient>
  );
  const h = (id: string, stops: [number, string, number?][]) => (
    <linearGradient id={`${uid}-${id}`} x1="0" y1="0" x2="1" y2="0">
      {stops.map(([o, c, op]) => <stop key={o} offset={o} stopColor={c} stopOpacity={op ?? 1} />)}
    </linearGradient>
  );
  return (
    <svg aria-hidden focusable="false" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        {v('en', [[0, '#F2F6FA'], [0.14, '#FFFFFF'], [0.62, '#FBF7EE'], [1, '#F0E5CF']])}
        {v('rt', [[0, '#F3E9D5'], [1, '#E6D5B7']])}
        {h('sh', [[0, '#5A4A3A', 0.1], [0.42, '#FFFFFF', 0.55], [0.6, '#FFFFFF', 0.25], [1, '#5A4A3A', 0.12]])}
        {v('se', [[0, '#D8F2FA'], [1, '#8DD4EC']])}
        {v('sr', [[0, '#C8ECF7'], [1, '#A2DBEE']])}
        {v('gr', [[0, '#EEEEF2'], [1, '#CBCBD5']])}
        {h('mt', [[0, '#8A8E9A'], [0.35, '#E6E8EC'], [0.6, '#BBBEC7'], [1, '#7F838E']])}
      </defs>
    </svg>
  );
}

export interface ToothLook {
  /** Selected (or inside a lit arch): crown and root in the selection teal. */
  lit?: boolean;
  /** A bridge pontic: crown only, dashed. */
  pontic?: boolean;
  /** Recorded missing: a ghosted, dashed outline. */
  missing?: boolean;
  /** Implant on record: the crown on a threaded fixture. */
  implant?: boolean;
  /** Used by another service: a grey crown. */
  other?: boolean;
}

const OUTLINE = '#B8B8C6';
const TEAL_LINE = '#3FA8CA';
const PONTIC_LINE = '#2A8DB0';
const NS = { vectorEffect: 'non-scaling-stroke' } as const;

/**
 * One tooth, in its own <svg> sized by its viewBox (so a row of them shares one
 * scale). `tint`: the light teal wash shown on hover ('hover', via the parent
 * button's group), always ('on', a whole row previewed) or never. `crop: 'crown'`
 * frames the crown alone (a legend's pontic, which has no root to draw).
 */
export const ToothSvg = memo(function ToothSvg({ id, uid, look, tint = 'off', crop, className, style }: {
  id: string; uid: string; look: ToothLook; tint?: 'off' | 'hover' | 'on'; crop?: 'crown'; className?: string; style?: CSSProperties;
}) {
  const g = geometry(id);
  const up = isUpper(id);
  const mirror = id[0] === '2' || id[0] === '3';
  const sx = mirror ? -1 : 1, sy = up ? -1 : 1;
  const transform = `translate(${mirror ? n2(g.w) : 0} ${up ? n2(g.T) : 0}) scale(${sx} ${sy})`;
  // The crown is at the top of a lower tooth's frame and, flipped, at the bottom of an upper one's.
  const top = crop && up ? g.T - g.hc : 0;
  const vw = g.w + GAP, vh = (crop ? g.hc : g.T) + PAD * 2;
  const url = (k: string) => `url(#${uid}-${k})`;

  const { lit, pontic, other } = look;
  const implant = look.implant && !pontic;
  const ghost = look.missing && !pontic && !implant;
  const root = !pontic && !implant;

  const crownFill = lit ? url('se') : other ? url('gr') : url('en');
  const crownLine = lit ? TEAL_LINE : other ? '#9A9AAA' : OUTLINE;
  const lineW = lit ? 1.5 : 1;
  const tintCls = tint === 'on' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100';

  return (
    <svg
      viewBox={`${n2(-GAP / 2)} ${n2(top - PAD)} ${n2(vw)} ${n2(vh)}`}
      aria-hidden
      focusable="false"
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: `${n2(vw)} / ${n2(vh)}`, overflow: 'visible', ...style }}
    >
      <g transform={transform}>
        {pontic ? (
          // Crown only: the pontic has no root of its own.
          <path d={g.crown} fill={lit ? url('se') : other ? '#DCE8EE' : '#E3F4FA'} stroke={PONTIC_LINE} strokeWidth={1.3} strokeDasharray="3 2" strokeLinejoin="round" {...NS} />
        ) : ghost && !lit ? (
          // Recorded missing: the outline of where the tooth was, nothing filled.
          <g fill="none" stroke={OUTLINE} strokeWidth={1} strokeDasharray="2.5 2" strokeLinejoin="round" {...NS}>
            <path d={g.crownOutline} />
            <path d={g.rootOutline} />
          </g>
        ) : (
          <>
            {implant && (
              <g>
                <path d={g.screw.body} fill={url('mt')} stroke="#7F838E" strokeWidth={1} strokeLinejoin="round" {...NS} />
                <path d={g.screw.threads} fill="none" stroke="#6E727E" strokeWidth={0.9} strokeLinecap="round" {...NS} />
                <path d={g.screw.abutment} fill="#A9ADB8" stroke="#7F838E" strokeWidth={1} {...NS} />
              </g>
            )}
            {root && !ghost && (
              <>
                {/* The root behind (palatal): lighter, its outline softer. */}
                {g.backRoot && <path d={g.backRoot} fill={lit ? url('sr') : url('rt')} opacity={0.72} stroke={lit ? TEAL_LINE : '#CFCFD9'} strokeWidth={1} {...NS} />}
                <path d={g.roots} fill={lit ? url('sr') : url('rt')} />
                <path d={g.roots} fill={url('sh')} />
                {/* Fused roots (third molars): the faint groove where they meet. */}
                {g.rootDetails.map((d, i) => <path key={i} d={d} fill="none" stroke={lit ? '#7CC6DE' : '#D2C3A6'} strokeWidth={0.8} strokeLinecap="round" {...NS} />)}
                <path d={g.rootOutline} fill="none" stroke={lit ? TEAL_LINE : OUTLINE} strokeWidth={lineW} strokeLinejoin="round" {...NS} />
              </>
            )}
            {/* Missing but selected (a denture tooth over a gap): the crown in teal, the root only as a ghost. */}
            {root && ghost && <path d={g.rootOutline} fill="none" stroke={OUTLINE} strokeWidth={1} strokeDasharray="2.5 2" {...NS} />}
            <path d={g.crown} fill={crownFill} />
            <path d={g.crown} fill={url('sh')} />
            {g.details.map((d, i) => <path key={i} d={d} fill="none" stroke={lit ? '#7CC6DE' : '#D9CEBB'} strokeWidth={0.8} strokeLinecap="round" opacity={0.85} {...NS} />)}
            {root && !ghost && <path d={g.cej} fill="none" stroke={lit ? '#7CC6DE' : '#D5C8B0'} strokeWidth={0.8} {...NS} />}
            {/* With no root under it, the crown's cervical edge is part of its outline. */}
            <path d={root && !ghost ? g.crownOutline : g.crown} fill="none" stroke={crownLine} strokeWidth={lineW} strokeLinejoin="round" {...NS} />
          </>
        )}
        {tint !== 'off' && (
          <g className={`${tintCls} transition-opacity duration-150 motion-reduce:transition-none`}>
            {/* One wash over crown and root together: the root reaches up under the crown, and two
                translucent fills would paint that band twice. Group opacity composites the union once. */}
            <g fill="#59C1E3" opacity={0.24}>
              <path d={g.crown} />
              {root && !ghost && <path d={g.roots} />}
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}, (p, q) => p.id === q.id && p.uid === q.uid && p.tint === q.tint && p.crop === q.crop && p.className === q.className && p.style === q.style
  && !!p.look.lit === !!q.look.lit && !!p.look.pontic === !!q.look.pontic && !!p.look.missing === !!q.look.missing
  && !!p.look.implant === !!q.look.implant && !!p.look.other === !!q.look.other);
