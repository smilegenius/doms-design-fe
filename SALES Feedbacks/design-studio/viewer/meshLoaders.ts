import { useEffect, useState } from 'react';
import type { DesignFile } from '../data/designStudio';
import { getFile } from '../store/fileStore';
import { Face, norm, Scene, Vec3 } from './archModel';

// ── STL / OBJ / PLY → renderable scene (no dependencies) ─────────────────────
// Parses the common CAD export formats into triangles, centres them, scales
// them to fit the viewer (~48mm across) and decimates to keep
// orbiting smooth in the canvas renderer.

type Tri = [Vec3, Vec3, Vec3];
const MAX_FACES = 8000;

function parseStl(buf: ArrayBuffer): Tri[] {
  const dv = new DataView(buf);
  const count = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (buf.byteLength === 84 + count * 50 && count > 0) {
    const tris: Tri[] = [];
    for (let i = 0; i < count; i++) {
      const o = 84 + i * 50 + 12;
      const v = (k: number): Vec3 => [dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 4, true), dv.getFloat32(o + k * 12 + 8, true)];
      tris.push([v(0), v(1), v(2)]);
    }
    return tris;
  }
  const text = new TextDecoder().decode(buf);
  const verts = [...text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m => [+m[1], +m[2], +m[3]] as Vec3);
  const tris: Tri[] = [];
  for (let i = 0; i + 2 < verts.length; i += 3) tris.push([verts[i], verts[i + 1], verts[i + 2]]);
  return tris;
}

function parseObj(text: string): Tri[] {
  const v: Vec3[] = [];
  const tris: Tri[] = [];
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'f') {
      const idx = p.slice(1).map(t => { const i = parseInt(t.split('/')[0], 10); return i < 0 ? v.length + i : i - 1; });
      for (let k = 1; k + 1 < idx.length; k++) tris.push([v[idx[0]], v[idx[k]], v[idx[k + 1]]]);
    }
  }
  return tris.filter(t => t.every(Boolean));
}

function parsePly(buf: ArrayBuffer): Tri[] {
  const bytes = new Uint8Array(buf);
  const headEnd = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 4096))).indexOf('end_header');
  if (headEnd < 0) return [];
  const header = new TextDecoder().decode(bytes.slice(0, headEnd));
  const bodyStart = headEnd + 'end_header'.length + 1;
  const format = /format\s+(\w+)/.exec(header)?.[1] ?? 'ascii';
  const nv = +(/element\s+vertex\s+(\d+)/.exec(header)?.[1] ?? 0);
  const nf = +(/element\s+face\s+(\d+)/.exec(header)?.[1] ?? 0);
  // Vertex properties (we only read x, y, z by position).
  const vSection = header.split(/element\s+vertex\s+\d+/)[1]?.split(/element/)[0] ?? '';
  const props = [...vSection.matchAll(/property\s+(\w+)\s+(\w+)/g)].map(m => ({ type: m[1], name: m[2] }));
  const SIZES: Record<string, number> = { char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2, int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  const v: Vec3[] = [];
  const tris: Tri[] = [];
  if (format === 'ascii') {
    const lines = new TextDecoder().decode(bytes.slice(bodyStart)).split('\n');
    const xi = props.findIndex(p => p.name === 'x'), yi = props.findIndex(p => p.name === 'y'), zi = props.findIndex(p => p.name === 'z');
    for (let i = 0; i < nv; i++) { const p = lines[i].trim().split(/\s+/).map(Number); v.push([p[xi], p[yi], p[zi]]); }
    for (let i = 0; i < nf; i++) {
      const p = lines[nv + i]?.trim().split(/\s+/).map(Number) ?? [];
      const idx = p.slice(1, 1 + p[0]);
      for (let k = 1; k + 1 < idx.length; k++) tris.push([v[idx[0]], v[idx[k]], v[idx[k + 1]]]);
    }
    return tris.filter(t => t.every(Boolean));
  }
  if (format !== 'binary_little_endian') return [];
  const dv = new DataView(buf);
  const read = (type: string, o: number) => {
    switch (type) {
      case 'float': case 'float32': return dv.getFloat32(o, true);
      case 'double': case 'float64': return dv.getFloat64(o, true);
      case 'int': case 'int32': return dv.getInt32(o, true);
      case 'uint': case 'uint32': return dv.getUint32(o, true);
      case 'short': case 'int16': return dv.getInt16(o, true);
      case 'ushort': case 'uint16': return dv.getUint16(o, true);
      case 'char': case 'int8': return dv.getInt8(o);
      default: return dv.getUint8(o);
    }
  };
  let o = bodyStart;
  for (let i = 0; i < nv; i++) {
    const vals: Record<string, number> = {};
    for (const p of props) { vals[p.name] = read(p.type, o); o += SIZES[p.type] ?? 4; }
    v.push([vals.x, vals.y, vals.z]);
  }
  const listType = /property\s+list\s+(\w+)\s+(\w+)\s+vertex_ind/.exec(header);
  const countT = listType?.[1] ?? 'uchar', idxT = listType?.[2] ?? 'int';
  for (let i = 0; i < nf; i++) {
    const c = read(countT, o); o += SIZES[countT];
    const idx: number[] = [];
    for (let k = 0; k < c; k++) { idx.push(read(idxT, o)); o += SIZES[idxT]; }
    for (let k = 1; k + 1 < idx.length; k++) tris.push([v[idx[0]], v[idx[k]], v[idx[k + 1]]]);
  }
  return tris.filter(t => t.every(Boolean));
}

/** Parse one mesh file into triangles. */
export async function parseMesh(name: string, blob: Blob): Promise<Tri[]> {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'obj') return parseObj(await blob.text());
  const buf = await blob.arrayBuffer();
  return ext === 'ply' ? parsePly(buf) : parseStl(buf);
}

/** Centre, scale to ~48mm, decimate, and turn triangles into renderer faces. */
export function trisToScene(all: Tri[][]): Scene {
  const tris = all.flat();
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const k = 48 / extent;
  const step = Math.max(1, Math.ceil(tris.length / MAX_FACES));
  const faces: Face[] = [];
  for (let i = 0; i < tris.length; i += step) {
    const pts = tris[i].map(p => [(p[0] - c[0]) * k, (p[1] - c[1]) * k, (p[2] - c[2]) * k] as Vec3);
    const e1: Vec3 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
    const e2: Vec3 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
    const n = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
    const centroid: Vec3 = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3, (pts[0][2] + pts[1][2] + pts[2][2]) / 3];
    if (!Number.isFinite(n[0])) continue;
    faces.push({ pts, normal: n, centroid, mat: 'enamel', jaw: 'upper' });
  }
  return { faces, shadeRgb: [236, 228, 208], doubleSided: true };
}

const sceneCache = new Map<string, Scene | null>();

/** Load and parse a version's mesh files from IndexedDB (cached). undefined while loading, null if none / unavailable. */
export function useMeshScene(files?: DesignFile[]): Scene | null | undefined {
  const meshes = (files ?? []).filter(f => f.kind === 'mesh');
  const key = meshes.map(f => f.id).join('|');
  const [scene, setScene] = useState<Scene | null | undefined>(() => (key ? sceneCache.get(key) : null));
  useEffect(() => {
    if (!key) { setScene(null); return; }
    if (sceneCache.has(key)) { setScene(sceneCache.get(key)); return; }
    let live = true;
    setScene(undefined);
    Promise.all(meshes.map(async f => { const b = await getFile(f.id); return b ? parseMesh(f.name, b) : []; }))
      .then(parts => {
        const s = parts.some(p => p.length) ? trisToScene(parts) : null;
        sceneCache.set(key, s);
        if (live) setScene(s);
      })
      .catch(() => { sceneCache.set(key, null); if (live) setScene(null); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return scene;
}

/** Synchronous lookup for stills (after useMeshScene has loaded it). */
export function cachedMeshScene(files?: DesignFile[]): Scene | null | undefined {
  const key = (files ?? []).filter(f => f.kind === 'mesh').map(f => f.id).join('|');
  return key ? sceneCache.get(key) : null;
}
