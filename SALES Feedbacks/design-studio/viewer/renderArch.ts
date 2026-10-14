import type { CameraState, ModelParams } from '../data/designStudio';
import { buildScene, dot, Material, norm, Scene, SceneOptions, Vec3 } from './archModel';

// ── Software renderer (canvas 2D) ────────────────────────────────────────────
// Perspective camera orbiting a target, back-face culling, painter's sort and
// Blinn-Phong shading. No dependencies. The same function renders the live
// viewer and capture stills, so a capture re-renders exactly from its camera.

export interface RenderOptions extends SceneOptions {
  guides?: boolean;      // facial midline guide (smile designs)
  background?: string;   // fill instead of transparent (stills)
}

const MATERIALS: Record<Material, { ks: number; shin: number }> = {
  enamel: { ks: 0.32, shin: 34 },
  designed: { ks: 0.55, shin: 70 },
  gum: { ks: 0.12, shin: 10 },
  attachment: { ks: 0.7, shin: 90 },
};
const GUM: [number, number, number] = [214, 122, 130];
const ATTACH: [number, number, number] = [252, 252, 250];

function eyeFor(c: CameraState): Vec3 {
  const D = 160 / c.zoom;
  const az = (c.azimuth * Math.PI) / 180, el = (c.elevation * Math.PI) / 180;
  return [c.target[0] + D * Math.cos(el) * Math.sin(az), c.target[1] + D * Math.sin(el), c.target[2] + D * Math.cos(el) * Math.cos(az)];
}

export function renderScene(ctx: CanvasRenderingContext2D, width: number, height: number, camera: CameraState, scene: Scene, opts: RenderOptions = {}) {
  ctx.save();
  if (opts.background) { ctx.fillStyle = opts.background; ctx.fillRect(0, 0, width, height); }
  else ctx.clearRect(0, 0, width, height);

  const eye = eyeFor(camera);
  const fwd = norm([camera.target[0] - eye[0], camera.target[1] - eye[1], camera.target[2] - eye[2]]);
  const right = norm([fwd[1] * 0 - fwd[2] * 1, fwd[2] * 0 - fwd[0] * 0, fwd[0] * 1 - fwd[1] * 0]);
  const up: Vec3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const f = Math.min(width, height * 1.6) * 1.55;
  const cx = width / 2, cy = height / 2;

  // Hide the far jaw in occlusal views, like a CAD viewer does.
  const hideLower = !scene.doubleSided && camera.elevation < -52, hideUpper = !scene.doubleSided && camera.elevation > 52;
  const light = norm([-fwd[0] + up[0] * 0.6 - right[0] * 0.35, -fwd[1] + up[1] * 0.6 - right[1] * 0.35, -fwd[2] + up[2] * 0.6 - right[2] * 0.35]);
  const toEye = scale3(fwd, -1);
  const half = norm([light[0] + toEye[0], light[1] + toEye[1], light[2] + toEye[2]]);

  type P = { pts: [number, number][]; depth: number; color: string };
  const polys: P[] = [];
  for (const face of scene.faces) {
    if ((hideLower && face.jaw === 'lower') || (hideUpper && face.jaw === 'upper')) continue;
    const view: Vec3 = [eye[0] - face.centroid[0], eye[1] - face.centroid[1], eye[2] - face.centroid[2]];
    let normal = face.normal;
    if (dot(normal, view) <= 0) {
      if (!scene.doubleSided) continue;
      normal = [-normal[0], -normal[1], -normal[2]];
    }
    const pts: [number, number][] = [];
    let depth = 0, behind = false;
    for (const p of face.pts) {
      const rx = p[0] - eye[0], ry = p[1] - eye[1], rz = p[2] - eye[2];
      const zc = rx * fwd[0] + ry * fwd[1] + rz * fwd[2];
      if (zc < 1) { behind = true; break; }
      const xc = rx * right[0] + ry * right[1] + rz * right[2];
      const yc = rx * up[0] + ry * up[1] + rz * up[2];
      pts.push([cx + (xc * f) / zc, cy - (yc * f) / zc]);
      depth += zc;
    }
    if (behind) continue;
    const m = MATERIALS[face.mat];
    const base = face.mat === 'gum' ? GUM : face.mat === 'attachment' ? ATTACH : scene.shadeRgb;
    const nl = Math.max(0, dot(normal, light));
    const fill = Math.max(0, dot(normal, toEye));
    const spec = Math.pow(Math.max(0, dot(normal, half)), m.shin) * m.ks * 255;
    const k = 0.34 + 0.5 * nl + 0.24 * fill;
    const c = base.map(ch => Math.min(255, Math.round(ch * k + spec)));
    polys.push({ pts, depth: depth / face.pts.length, color: `rgb(${c[0]},${c[1]},${c[2]})` });
  }
  polys.sort((a, b) => b.depth - a.depth);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.8;
  for (const p of polys) {
    ctx.beginPath();
    ctx.moveTo(p.pts[0][0], p.pts[0][1]);
    for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    ctx.fill();
    ctx.stroke();
  }

  if (opts.guides && Math.abs(camera.elevation) < 30 && Math.abs((((camera.azimuth % 360) + 540) % 360) - 180) < 22) {
    const project = (p: Vec3) => {
      const rx = p[0] - eye[0], ry = p[1] - eye[1], rz = p[2] - eye[2];
      const zc = rx * fwd[0] + ry * fwd[1] + rz * fwd[2];
      return [cx + ((rx * right[0] + ry * right[1] + rz * right[2]) * f) / zc, cy - ((rx * up[0] + ry * up[1] + rz * up[2]) * f) / zc];
    };
    const a = project([0, 15, 24]), b = project([0, -13, 24]);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(77,142,247,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(77,142,247,0.95)';
    ctx.font = '600 10px Poppins, sans-serif';
    ctx.fillText('Facial midline', a[0] + 6, a[1] + 10);
  }
  ctx.restore();
}

function scale3(a: Vec3, s: number): Vec3 { return [a[0] * s, a[1] * s, a[2] * s]; }

const stillCache = new Map<string, string>();

/** A 16:10 still of the model from a stored camera (captures, thumbnails). */
export function renderStill(params: ModelParams, camera: CameraState, opts: RenderOptions = {}, width = 640, sceneOverride?: Scene | null, sceneKey = ''): string {
  const key = JSON.stringify([params, camera, opts, width, sceneKey]);
  const hit = stillCache.get(key);
  if (hit) return hit;
  const height = Math.round(width / 1.6);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  renderScene(ctx, width, height, camera, sceneOverride ?? buildScene(params, opts), { ...opts, background: opts.background ?? '#F0F2F7' });
  const url = canvas.toDataURL('image/jpeg', 0.86);
  stillCache.set(key, url);
  return url;
}
