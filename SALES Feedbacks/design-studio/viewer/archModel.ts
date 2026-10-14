import type { ModelParams } from '../data/designStudio';

// ── Procedural dental arch ───────────────────────────────────────────────────
// Upper and lower arches (7 teeth per quadrant, FDI), each tooth a superellipse
// "lathe" shaped by type, set on a parabolic arch with a scalloped gingiva
// tube. Units are millimetres: x = patient's left, y = up, z = anterior.
// Version / stage parameters move teeth so V1 vs V2 (and stage 0 vs final)
// genuinely look different in the viewer.

export type Vec3 = [number, number, number];
export type Material = 'enamel' | 'designed' | 'gum' | 'attachment';
export interface Face { pts: Vec3[]; normal: Vec3; centroid: Vec3; mat: Material; jaw: 'upper' | 'lower' }
/** doubleSided: uploaded meshes (winding not guaranteed) — no culling, no jaw hiding. */
export interface Scene { faces: Face[]; shadeRgb: [number, number, number]; doubleSided?: boolean }

// Clinical changes are sub-millimetre; scale them so they read on screen.
const EXAGGERATE = 2.2;

const UPPER = { w: [8.6, 6.6, 7.6, 7.0, 6.6, 10.2, 9.2], h: [10.6, 9.2, 10.2, 8.2, 7.8, 7.0, 6.6], d: [7.0, 6.2, 8.0, 9.2, 9.0, 11.0, 10.6] };
const LOWER = { w: [5.3, 5.9, 6.8, 7.0, 7.2, 11.0, 10.4], h: [9.0, 9.4, 10.8, 8.4, 8.0, 7.6, 7.2], d: [6.0, 6.2, 7.6, 7.6, 8.0, 10.4, 10.2] };

const SHADES: Record<string, [number, number, number]> = {
  A1: [241, 234, 216], A2: [236, 224, 197], A3: [230, 214, 182], B1: [244, 239, 224], BL3: [247, 245, 238],
};

const LAT = 9, LON = 16;

function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function dot(a: Vec3, b: Vec3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function norm(a: Vec3): Vec3 { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

// Seeded jitter so the "crowded" start of an aligner plan is stable.
function jitter(seed: number) { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

/** Arch curve z(x) and its slope, per jaw. */
const curve = (jaw: 'upper' | 'lower') => (jaw === 'upper'
  ? { z: (x: number) => 22 - 0.041 * x * x, dz: (x: number) => -0.082 * x }
  : { z: (x: number) => 18.6 - 0.043 * x * x, dz: (x: number) => -0.086 * x });

/** x positions of tooth centres along the arch, by arc length. */
function toothXs(jaw: 'upper' | 'lower', widths: number[]): number[] {
  const { dz } = curve(jaw);
  const targets: number[] = [];
  let s = 0;
  for (const w of widths) { targets.push(s + w / 2); s += w; }
  const xs: number[] = [];
  let x = 0, len = 0, i = 0;
  while (i < targets.length && x < 60) {
    const step = 0.02;
    len += Math.hypot(step, dz(x) * step);
    x += step;
    if (len >= targets[i]) { xs.push(x); i++; }
  }
  return xs;
}

interface ToothPose { dx: number; dy: number; dz: number; rotY: number; tip: number }

function malocclusion(fdi: number): ToothPose {
  const u = fdi % 10, s = fdi;
  const anterior = u <= 3;
  return {
    dx: (jitter(s) - 0.5) * (anterior ? 0.8 : 0.3),
    dy: (jitter(s + 3) - 0.5) * (anterior ? 1.4 : 0.6),
    dz: (jitter(s + 7) - 0.5) * (anterior ? 2.6 : 1.0),
    rotY: (jitter(s + 11) - 0.5) * (anterior ? 34 : 12),
    tip: (jitter(s + 17) - 0.5) * 8,
  };
}

function toothFaces(fdi: number, jaw: 'upper' | 'lower', params: ModelParams, stageF: number, pose: ToothPose, centre: Vec3, T: Vec3, N: Vec3): Face[] {
  const u = fdi % 10;
  const dims = jaw === 'upper' ? UPPER : LOWER;
  let w = dims.w[u - 1], h = dims.h[u - 1];
  const d = dims.d[u - 1];
  const kind = u <= 2 ? 'incisor' : u === 3 ? 'canine' : u <= 5 ? 'premolar' : 'molar';
  const designed = !!params.designedTeeth?.includes(fdi);
  if (params.incisalDeltaMm?.[fdi]) h += params.incisalDeltaMm[fdi] * EXAGGERATE;
  const bulk = (params.buccalBulkMm?.[fdi] ?? 0) * EXAGGERATE * 1.4;
  if (kind === 'incisor' && jaw === 'upper') w *= 1;
  const p = kind === 'molar' ? 3.2 : kind === 'incisor' ? 2.7 : 2.3;
  const sign = jaw === 'upper' ? 1 : -1;
  const baseY = jaw === 'upper' ? (u <= 3 ? -1.1 : -0.2) : (u <= 3 ? 0.4 : 0.2);

  // Orientation: rotation about the long axis (aligner rotations) and a small tip.
  const rot = (pose.rotY * (1 - stageF)) * Math.PI / 180;
  const Tr = norm(add(scale(T, Math.cos(rot)), scale(N, Math.sin(rot))));
  const Nr = norm(add(scale(N, Math.cos(rot)), scale(T, -Math.sin(rot))));
  const tip = pose.tip * (1 - stageF) * Math.PI / 180;
  const Y: Vec3 = norm([Math.sin(tip) * Tr[0], Math.cos(tip), Math.sin(tip) * Tr[2]]);

  const ring: Vec3[][] = [];
  for (let j = 0; j <= LAT; j++) {
    const v = j / LAT;                         // 0 = cervical, 1 = incisal / occlusal
    let a = w / 2, b = d / 2;
    if (kind === 'incisor') { a *= 0.78 + 0.24 * v; b *= 1 - 0.68 * v; }
    if (kind === 'canine') { a *= v < 0.55 ? 0.82 + 0.3 * v : 0.98 - 0.85 * (v - 0.55); b *= 1 - 0.45 * v; }
    if (kind === 'premolar' || kind === 'molar') { a *= v < 0.2 ? 0.8 + v : 1; b *= v < 0.2 ? 0.82 + 0.9 * v : 1; }
    // Rounded end caps
    const capStart = kind === 'incisor' ? 0.9 : kind === 'canine' ? 0.86 : 0.8;
    const cap = v > capStart ? Math.sqrt(Math.max(0.02, 1 - ((v - capStart) / (1 - capStart)) ** 2)) : 1;
    const row: Vec3[] = [];
    for (let k = 0; k < LON; k++) {
      const th = (k / LON) * Math.PI * 2;
      let lx = a * cap * spow(Math.cos(th), 2 / p);
      let lz = b * cap * spow(Math.sin(th), 2 / p);
      if (lz > 0 && bulk) lz += bulk * Math.sin(th) * (0.4 + 0.6 * v);
      let ly = baseY + sign * (1 - v) * h;
      if ((kind === 'premolar' || kind === 'molar') && v === 1) ly += -sign * 0.0;
      if ((kind === 'premolar' || kind === 'molar') && v > 0.75) {
        // cusps
        const cusp = kind === 'molar' ? 0.55 * Math.cos(2 * th) + 0.35 * Math.cos(4 * th) : 0.5 * Math.cos(2 * th);
        ly += -sign * cusp * (v - 0.75) * 2.4;
      }
      if (kind === 'incisor') lx *= 1 + 0.04 * Math.sin(th);
      const local = add(add(scale(Tr, lx), scale(Nr, lz)), scale(Y, ly));
      row.push(add(centre, local));
    }
    ring.push(row);
  }

  const tc: Vec3 = add(centre, [0, baseY + sign * h * 0.5, 0]);
  const faces: Face[] = [];
  const mat: Material = designed ? 'designed' : 'enamel';
  const push = (pts: Vec3[]) => {
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[pts.length - 1], pts[0])));
    const c: Vec3 = scale(pts.reduce((acc, q) => add(acc, q), [0, 0, 0] as Vec3), 1 / pts.length);
    if (dot(n, sub(c, tc)) < 0) n = scale(n, -1);
    faces.push({ pts, normal: n, centroid: c, mat, jaw });
  };
  for (let j = 0; j < LAT; j++) {
    for (let k = 0; k < LON; k++) {
      const k2 = (k + 1) % LON;
      push([ring[j][k], ring[j][k2], ring[j + 1][k2], ring[j + 1][k]]);
    }
  }
  // Occlusal / incisal cap
  const top = ring[LAT];
  const topC: Vec3 = scale(top.reduce((acc, q) => add(acc, q), [0, 0, 0] as Vec3), 1 / top.length);
  for (let k = 0; k < LON; k++) push([top[k], top[(k + 1) % LON], topC]);
  return faces;
}

function attachmentFaces(centre: Vec3, N: Vec3, T: Vec3, y: number, jaw: 'upper' | 'lower'): Face[] {
  // A small rectangular composite attachment on the buccal surface.
  const c: Vec3 = add(add(centre, scale(N, 4.9)), [0, y, 0]);
  const hw = 1.6, hh = 1.1, depth = 0.9;
  const corners = (o: number): Vec3[] => [
    add(add(add(c, scale(T, -hw)), [0, -hh, 0]), scale(N, o)),
    add(add(add(c, scale(T, hw)), [0, -hh, 0]), scale(N, o)),
    add(add(add(c, scale(T, hw)), [0, hh, 0]), scale(N, o)),
    add(add(add(c, scale(T, -hw)), [0, hh, 0]), scale(N, o)),
  ];
  const back = corners(0), front = corners(depth);
  const mk = (pts: Vec3[], n: Vec3): Face => ({ pts, normal: n, centroid: scale(pts.reduce((a, q) => add(a, q), [0, 0, 0] as Vec3), 1 / pts.length), mat: 'attachment', jaw });
  return [
    mk(front, N),
    mk([back[0], back[1], front[1], front[0]], [0, -1, 0]),
    mk([back[3], back[2], front[2], front[3]], [0, 1, 0]),
    mk([back[1], back[2], front[2], front[1]], T),
    mk([back[0], back[3], front[3], front[0]], scale(T, -1)),
  ];
}

function gumFaces(jaw: 'upper' | 'lower', xs: number[], heights: number[], widthsHalf: number): Face[] {
  const { z, dz } = curve(jaw);
  const sign = jaw === 'upper' ? 1 : -1;
  const xEnd = xs[xs.length - 1] + widthsHalf;
  const SAMPLES = 46, RING = 12;
  const rings: Vec3[][] = [];
  const centres: Vec3[] = [];
  for (let i = -SAMPLES; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const xp = Math.abs(t) * xEnd;
    const side = t < 0 ? -1 : 1;
    const xw = side * xp;
    const T = norm([side * 1, 0, dz(xp) * 1]);
    const N = norm([side * -dz(xp), 0, 1]);
    // Interpolate crown height under this point; scallop: papillae between teeth.
    let idx = 0;
    while (idx < xs.length - 1 && xs[idx + 1] < xp) idx++;
    const h = heights[Math.min(idx, heights.length - 1)];
    const toNearest = Math.min(...xs.map(x => Math.abs(x - xp)), xp);
    const papilla = Math.max(0, 1 - toNearest / 3.2);
    const cy = sign * (0.8 * h + 3.2);
    const centre: Vec3 = [xw, cy, z(xp) - 2.6];
    centres.push(centre);
    const row: Vec3[] = [];
    for (let k = 0; k < RING; k++) {
      const ph = (k / RING) * Math.PI * 2;
      const occlusalSide = -sign * Math.sin(ph) > 0;
      const ry = 3.3 + (occlusalSide ? 1.6 * papilla : 1.2);
      const rx = 4.6;
      const local: Vec3 = add(scale(N, rx * Math.cos(ph)), [0, ry * Math.sin(ph), 0]);
      row.push(add(centre, local));
      void T;
    }
    rings.push(row);
  }
  const faces: Face[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < RING; k++) {
      const k2 = (k + 1) % RING;
      const pts: Vec3[] = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]];
      const c: Vec3 = scale(pts.reduce((a, q) => add(a, q), [0, 0, 0] as Vec3), 1 / 4);
      let n = norm(cross(sub(pts[1], pts[0]), sub(pts[3], pts[0])));
      const axis = add(centres[i], [0, 0, 0]);
      if (dot(n, sub(c, axis)) < 0) n = scale(n, -1);
      faces.push({ pts, normal: n, centroid: c, mat: 'gum', jaw });
    }
  }
  return faces;
}

export interface SceneOptions { stage?: number; jaws?: 'upper' | 'lower' | 'both' }

const cache = new Map<string, Scene>();

export function buildScene(params: ModelParams, opts: SceneOptions = {}): Scene {
  const key = JSON.stringify([params, opts.stage ?? null, opts.jaws ?? 'both']);
  const hit = cache.get(key);
  if (hit) return hit;
  const faces: Face[] = [];
  const isPlan = params.kind === 'aligner-plan';
  const jaws: ('upper' | 'lower')[] = opts.jaws === 'upper' ? ['upper'] : opts.jaws === 'lower' ? ['lower'] : ['upper', 'lower'];

  for (const jaw of jaws) {
    const dims = jaw === 'upper' ? UPPER : LOWER;
    const total = jaw === 'upper' ? params.stages?.upper : params.stages?.lower;
    const stageF = isPlan ? Math.min(1, (opts.stage ?? 0) / Math.max(1, total ?? 1)) : 1;
    const xs = toothXs(jaw, dims.w);
    const { z, dz } = curve(jaw);
    // Class II: the upper arch starts proud and comes back over the plan.
    const classII = isPlan && jaw === 'upper' ? 2.4 * (1 - stageF) : 0;
    for (const side of [1, -1] as const) {
      const quadrant = jaw === 'upper' ? (side === -1 ? 1 : 2) : (side === -1 ? 4 : 3);
      for (let u = 1; u <= 7; u++) {
        const fdi = quadrant * 10 + u;
        const x = xs[u - 1];
        const pose = isPlan ? malocclusion(fdi) : { dx: 0, dy: 0, dz: 0, rotY: 0, tip: 0 };
        let mid = 0;
        if (jaw === 'upper' && params.midlineShiftMm && u <= 3) mid = params.midlineShiftMm * EXAGGERATE * (u === 1 ? 1 : u === 2 ? 0.75 : 0.45);
        const over = isPlan && params.overcorrection && fdi === 22 ? -6 : 0;
        const p = { ...pose, rotY: pose.rotY + (stageF >= 1 ? over : over * stageF) };
        const T = norm([side, 0, dz(x) * 1]);
        const N = norm([-dz(x) * side, 0, 1]);
        const centre: Vec3 = [
          side * x + mid + p.dx * (1 - stageF),
          p.dy * (1 - stageF),
          z(x) - (jaw === 'upper' ? 3.4 : 3.0) + p.dz * (1 - stageF) + classII,
        ];
        faces.push(...toothFaces(fdi, jaw, params, stageF, p, centre, T, N));
        const att = params.attachments?.find(a => a.tooth === fdi);
        if (att && (!isPlan || (opts.stage ?? 0) >= att.fromStage)) {
          const h = dims.h[u - 1];
          const y = (jaw === 'upper' ? 1 : -1) * (h * 0.55 - (att.raisedMm ?? 0) * EXAGGERATE);
          faces.push(...attachmentFaces(centre, N, T, y, jaw));
        }
      }
    }
    faces.push(...gumFaces(jaw, xs, dims.h, dims.w[6] / 2));
  }
  const scene: Scene = { faces, shadeRgb: SHADES[params.shade] ?? SHADES.A2 };
  cache.set(key, scene);
  if (cache.size > 120) cache.delete(cache.keys().next().value as string);
  return scene;
}
