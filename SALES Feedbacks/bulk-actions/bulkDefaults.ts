import { useSyncExternalStore } from 'react';

// ── Bulk Actions defaults, per lab user ──────────────────────────────────────
// How each lab user likes bulk downloads, prints and draft moves set up. The
// dialogs open with these and save back when "Remember these choices" is on;
// Settings → Bulk Actions shows and resets them.

export type IncludeKey = 'scans' | 'dicom' | 'photos' | 'docs' | 'sgForm' | 'originalForm' | 'fileList';
export type FolderNaming = 'id' | 'id-patient' | 'practice-id';
export type ZipGrouping = 'one' | 'per-practice';
export type PrintWhich = 'sg' | 'original' | 'both';
export type PrintNoOriginal = 'sg-instead' | 'skip';
export type PrintOrder = 'ticked' | 'id' | 'practice' | 'delivery';
export type DraftTarget = 'new' | 'in-production';

export interface BulkDefaults {
  download: { include: Record<IncludeKey, boolean>; naming: FolderNaming; grouping: ZipGrouping };
  print: { which: PrintWhich; noOriginal: PrintNoOriginal; order: PrintOrder };
  drafts: { primary: DraftTarget; confirm: boolean };
  /** Has this user saved anything yet ("Using your saved defaults"). */
  saved: { download: boolean; print: boolean; drafts: boolean };
}

export const INCLUDE_LABELS: Record<IncludeKey, string> = {
  scans: 'Scans (STL / PLY / OBJ)', dicom: 'CBCT / DICOM', photos: 'Photos', docs: 'Documents (PDF, ZIP)',
  sgForm: 'Smile Genius order form', originalForm: 'Original order form', fileList: 'File list (files.txt)',
};
export const NAMING_LABELS: Record<FolderNaming, string> = { id: 'Case ID', 'id-patient': 'Case ID + patient', 'practice-id': 'Practice / Case ID' };
export const GROUPING_LABELS: Record<ZipGrouping, string> = { one: 'One ZIP for everything', 'per-practice': 'One ZIP per practice' };
export const WHICH_LABELS: Record<PrintWhich, string> = { sg: 'Smile Genius order form', original: 'Original order form (scanner / LabLink / email)', both: 'Both' };
export const NO_ORIGINAL_LABELS: Record<PrintNoOriginal, string> = { 'sg-instead': 'Print their Smile Genius form instead', skip: 'Skip them' };
export const ORDER_LABELS: Record<PrintOrder, string> = { ticked: 'As ticked', id: 'Case ID', practice: 'Practice', delivery: 'Delivery date' };
export const TARGET_LABELS: Record<DraftTarget, string> = { new: 'Received (New)', 'in-production': 'Accepted (In Production)' };

export const FACTORY: BulkDefaults = {
  download: {
    include: { scans: true, dicom: true, photos: true, docs: true, sgForm: true, originalForm: true, fileList: true },
    naming: 'id-patient', grouping: 'one',
  },
  print: { which: 'sg', noOriginal: 'sg-instead', order: 'ticked' },
  drafts: { primary: 'new', confirm: true },
  saved: { download: false, print: false, drafts: false },
};

const KEY = 'salesFeedbacks.bulkDefaults.v1';
type Store = Record<string, BulkDefaults>;

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
let state: Store = load();
const listeners = new Set<() => void>();
function commit(next: Store) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
  listeners.forEach(l => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

const merge = (d?: Partial<BulkDefaults>): BulkDefaults => ({
  download: { ...FACTORY.download, ...d?.download, include: { ...FACTORY.download.include, ...d?.download?.include } },
  print: { ...FACTORY.print, ...d?.print },
  drafts: { ...FACTORY.drafts, ...d?.drafts },
  saved: { ...FACTORY.saved, ...d?.saved },
});

export function useBulkDefaults(user = 'me'): BulkDefaults {
  const s = useSyncExternalStore(subscribe, () => state);
  return merge(s[user]);
}
export const getBulkDefaults = (user = 'me') => merge(state[user]);

export function saveBulkDefaults<K extends 'download' | 'print' | 'drafts'>(user: string, part: K, value: BulkDefaults[K]) {
  const cur = merge(state[user]);
  commit({ ...state, [user]: { ...cur, [part]: value, saved: { ...cur.saved, [part]: true } } });
}
export function resetBulkDefaults(user: string, part?: 'download' | 'print' | 'drafts') {
  if (!part) { const n = { ...state }; delete n[user]; commit(n); return; }
  const cur = merge(state[user]);
  commit({ ...state, [user]: { ...cur, [part]: FACTORY[part], saved: { ...cur.saved, [part]: false } } });
}
