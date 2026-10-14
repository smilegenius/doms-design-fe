import { useEffect, useState } from 'react';
import { DesignFile, fileKind, MAX_FILE_BYTES } from '../data/designStudio';

// ── Design files (IndexedDB) ─────────────────────────────────────────────────
// Uploaded STL / OBJ / PLY / images / PDFs are far too big for localStorage,
// so the bytes live in IndexedDB on this origin. The lab portal and the
// dentist's review tab share the origin, so both can read them.

const DB = 'salesFeedbacks.designFiles';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let n = 0;
export const fid = () => `file-${Date.now().toString(36)}${(n++).toString(36)}`;

export interface FileCheck { ok: DesignFile[]; rejected: string[] }

/** Validate and store files. Returns the stored metadata plus human-readable rejections. */
export async function storeFiles(files: File[], uploadedBy: DesignFile['uploadedBy']): Promise<FileCheck> {
  const ok: DesignFile[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    const kind = fileKind(f.name, f.type);
    if (!kind) { rejected.push(`${f.name}: we can show STL, OBJ, PLY, images and PDFs`); continue; }
    if (f.size > MAX_FILE_BYTES) { rejected.push(`${f.name}: files must be 50MB or smaller`); continue; }
    const meta: DesignFile = { id: fid(), name: f.name, size: f.size, mime: f.type || 'application/octet-stream', kind, uploadedBy, uploadedAt: new Date().toISOString() };
    try {
      await tx('readwrite', s => s.put(f, meta.id));
      ok.push(meta);
    } catch {
      rejected.push(`${f.name}: couldn't be saved on this device`);
    }
  }
  return { ok, rejected };
}

/** Store raw bytes under an id (callers that do their own validation). */
export async function putBlob(id: string, blob: Blob): Promise<boolean> {
  try { await tx('readwrite', s => s.put(blob, id)); return true; } catch { return false; }
}

export async function getFile(id: string): Promise<Blob | undefined> {
  try { return await tx<Blob | undefined>('readonly', s => s.get(id) as IDBRequest<Blob | undefined>); } catch { return undefined; }
}

const urlCache = new Map<string, string>();

/** Object URL for a stored file ('' while loading, null if it isn't on this device). */
export function useFileUrl(id?: string): string | null {
  const [url, setUrl] = useState<string | null>(() => (id ? urlCache.get(id) ?? '' : null));
  useEffect(() => {
    if (!id) { setUrl(null); return; }
    const hit = urlCache.get(id);
    if (hit) { setUrl(hit); return; }
    let live = true;
    getFile(id).then(b => {
      if (!live) return;
      if (!b) { setUrl(null); return; }
      const u = URL.createObjectURL(b);
      urlCache.set(id, u);
      setUrl(u);
    });
    return () => { live = false; };
  }, [id]);
  return url;
}

export async function openFileInTab(id: string) {
  const b = await getFile(id);
  if (!b) return false;
  const u = urlCache.get(id) ?? URL.createObjectURL(b);
  urlCache.set(id, u);
  window.open(u, '_blank', 'noopener');
  return true;
}

/** Save a stored file to the user's Downloads (DICOM series: every member file). */
export async function downloadFile(file: { id: string; name: string; parts?: string[] }) {
  const ids = file.parts?.length ? file.parts : [file.id];
  let saved = 0;
  for (const [i, id] of ids.entries()) {
    const b = await getFile(id);
    if (!b) continue;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = file.parts?.length ? `${file.name}-${String(i + 1).padStart(4, '0')}.dcm` : file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    saved++;
  }
  return saved;
}
