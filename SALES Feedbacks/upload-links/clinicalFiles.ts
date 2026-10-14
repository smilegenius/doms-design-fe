import { DesignFile, fileKind } from '../design-studio/data/designStudio';
import { fid, FileCheck, putBlob } from '../design-studio/store/fileStore';

// ── Clinical files from outside the portal ───────────────────────────────────
// Upload links and the website intake form take more than the design
// formats: CBCT exports (DICOM, usually a folder of extensionless files),
// zips, plus the usual scans, photos and PDFs. A DICOM folder is stored file
// by file but listed as one "series". Headers are never parsed or shown —
// they carry the patient's name and date of birth.

export const MAX_CLINICAL_BYTES = 500 * 1024 * 1024;
export const CLINICAL_HINT = 'DICOM (files or a folder), ZIP, STL / PLY / OBJ, photos or PDF · up to 500MB each';

const ext = (name: string) => (name.includes('.') ? name.toLowerCase().split('.').pop()! : '');

/** DICOM: a .dcm file, or an extensionless file with the "DICM" marker at byte 128. */
async function isDicom(f: File): Promise<boolean> {
  const e = ext(f.name);
  if (e === 'dcm' || e === 'dicom') return true;
  if (e || f.size < 132) return false;
  try {
    const head = new Uint8Array(await f.slice(128, 132).arrayBuffer());
    return String.fromCharCode(...head) === 'DICM';
  } catch { return false; }
}

const folderOf = (f: File) => {
  const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? '';
  return rel.includes('/') ? rel.split('/')[0] : '';
};

export async function storeClinicalFiles(files: File[], uploadedBy: DesignFile['uploadedBy']): Promise<FileCheck> {
  const ok: DesignFile[] = [];
  const rejected: string[] = [];
  const series = new Map<string, File[]>();
  const now = new Date().toISOString();

  for (const f of files) {
    if (f.name.startsWith('.') || f.name === 'DICOMDIR' || f.name === 'Thumbs.db') continue; // OS / viewer index files
    if (f.size > MAX_CLINICAL_BYTES) { rejected.push(`${f.name}: files must be 500MB or smaller`); continue; }
    if (await isDicom(f)) {
      const key = folderOf(f) || 'DICOM series';
      series.set(key, [...(series.get(key) ?? []), f]);
      continue;
    }
    const kind: DesignFile['kind'] | null = ext(f.name) === 'zip' ? 'archive' : fileKind(f.name, f.type);
    if (!kind) { rejected.push(`${f.name}: we accept DICOM, ZIP, STL / PLY / OBJ, images and PDF`); continue; }
    const meta: DesignFile = { id: fid(), name: f.name, size: f.size, mime: f.type || 'application/octet-stream', kind, uploadedBy, uploadedAt: now };
    if (await putBlob(meta.id, f)) ok.push(meta);
    else rejected.push(`${f.name}: couldn't be saved on this device`);
  }

  for (const [name, members] of series) {
    const parts: string[] = [];
    for (const m of members) {
      const id = fid();
      if (await putBlob(id, m)) parts.push(id);
    }
    if (!parts.length) { rejected.push(`${name}: couldn't be saved on this device`); continue; }
    ok.push({
      id: fid(), name, size: members.reduce((s, m) => s + m.size, 0), mime: 'application/dicom',
      kind: 'dicom', uploadedBy, uploadedAt: now, parts,
    });
  }
  return { ok, rejected };
}
