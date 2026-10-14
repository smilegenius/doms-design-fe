import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { MOCK_NOTIFICATIONS } from '../../src/app/pages/NotificationsPage';
import type { DesignFile } from '../design-studio/data/designStudio';
import { fid, putBlob } from '../design-studio/store/fileStore';
import { LAB_NAME, portalDate, portalDateTime } from '../lab-prescription-inbox/data';

// ── Clinician upload links ───────────────────────────────────────────────────
// The lab makes a per-case link, shares it on WhatsApp or email, and the
// clinic uploads files to it without an account. Same module-store pattern
// as the Design Studio store; the `storage` listener means the lab's panel
// updates the moment the clinic's tab sends files.
//
// Data exposure: when a link is made we snapshot an allow-listed view of the
// case (PublicCaseView). The public page only ever reads that snapshot — it
// never sees the Case, so the patient's name, DOB, contact details, clinical
// notes and prices can't leak into it.

export type RequestKind = 'cbct' | 'ios' | 'photos' | 'xrays' | 'other';

export const REQUEST_KINDS: { id: RequestKind; label: string; hint: string }[] = [
  { id: 'cbct',   label: 'CBCT / DICOM',      hint: 'The full DICOM export: a folder or a ZIP' },
  { id: 'ios',    label: 'Intra-oral scan',   hint: 'STL, PLY or OBJ: upper, lower and bite' },
  { id: 'photos', label: 'Clinical photos',   hint: 'Smile, retracted and shade-tab photos' },
  { id: 'xrays',  label: 'X-rays',            hint: 'Periapical, bitewing or OPG images' },
  { id: 'other',  label: 'Other',             hint: 'Anything else the note asks for' },
];

/** The only case details an upload link may show. */
export interface PublicCaseView {
  caseRef: string;
  practice: string;
  dentist: string;
  patientInitials: string;
  service: string;
  teeth: number[];
}

export interface UploadBatch { id: string; uploader?: string; at: string; files: DesignFile[] }

export interface UploadLink {
  token: string;
  /** 6-digit access code sent separately; null when the lab turned it off. */
  code: string | null;
  caseId: string;
  view: PublicCaseView;
  requested: RequestKind[];
  note: string;
  labName: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  openedAt?: string;
  failedAttempts: number;
  lockedUntil?: string;
  batches: UploadBatch[];
  /** Files received after this are "new" on the case-page chip. */
  reviewedAt?: string;
}

interface UploadState { links: UploadLink[]; seeded: boolean }

const LS_KEY = 'salesFeedbacks.uploadLinks.v1';
export const MAX_CODE_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function load(): UploadState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); if (Array.isArray(p?.links)) return p; }
  } catch { /* corrupt or blocked */ }
  return { links: [], seeded: false };
}

let state: UploadState = load();
const listeners = new Set<() => void>();

function commit(next: UploadState) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
  listeners.forEach(l => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== LS_KEY) return;
    state = load();
    listeners.forEach(l => l());
  });
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useUploadLinks(): UploadState { return useSyncExternalStore(subscribe, () => state); }

function update(token: string, fn: (l: UploadLink) => UploadLink) {
  commit({ ...state, links: state.links.map(l => (l.token === token ? fn(l) : l)) });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const rand = (n: number, chars: string) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => chars[b % chars.length]).join('');
const newToken = () => `up_${rand(10, 'abcdefghjkmnpqrstuvwxyz23456789')}`;
const newCode = () => rand(6, '0123456789');

/** "Amelia Hughes" → "A.H."; "James O'Neill" → "J.O." */
export function initialsOf(name: string) {
  const words = name.replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  if (!words.length) return '—';
  const picks = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picks.map(w => `${w.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase()}.`).join('');
}

/** Build the allow-listed snapshot for a case. Nothing else leaves the lab. */
export function publicViewFor(c: Pick<Case, 'id' | 'patientName' | 'practice' | 'dentist' | 'services' | 'serviceItems'>): PublicCaseView {
  const teeth = [...new Set(c.serviceItems.flatMap(si => si.fdi ?? []))].sort((a, b) => a - b);
  return {
    caseRef: c.id,
    practice: c.practice,
    dentist: c.dentist,
    patientInitials: initialsOf(c.patientName),
    service: (c.services.length ? c.services : c.serviceItems.map(si => si.name)).join(', '),
    teeth,
  };
}

export type LinkState = 'active' | 'expired' | 'revoked' | 'locked';
export function linkState(l: UploadLink, now = Date.now()): LinkState {
  if (l.revokedAt) return 'revoked';
  if (new Date(l.expiresAt).getTime() < now) return 'expired';
  if (l.lockedUntil && new Date(l.lockedUntil).getTime() > now) return 'locked';
  return 'active';
}

export const linkUrl = (token: string) => `${window.location.origin}/upload/${token}`;
export const fileCount = (l: UploadLink) => l.batches.reduce((n, b) => n + b.files.length, 0);
export const newFileCount = (l: UploadLink) =>
  l.batches.filter(b => !l.reviewedAt || b.at > l.reviewedAt).reduce((n, b) => n + b.files.length, 0);

export function linksForCase(caseId: string) {
  return state.links.filter(l => l.caseId === caseId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function findLink(token: string) { return state.links.find(l => l.token === token); }

// Soft check on the note: it's shown on a page anyone with the link can open.
export function piiWarnings(note: string, patientName?: string): string[] {
  const w: string[] = [];
  if (/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(note) || /\b(dob|d\.o\.b|date of birth|born)\b/i.test(note)) w.push('a date of birth');
  if (/\b\d{3}\s?\d{3}\s?\d{4}\b/.test(note)) w.push('an NHS number');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(note)) w.push('an email address');
  if (/(\+44|\b0)\s?\d{2,4}[\s-]?\d{3}[\s-]?\d{3,4}\b/.test(note)) w.push('a phone number');
  const nameParts = (patientName ?? '').toLowerCase().split(/\s+/).filter(p => p.length > 2);
  const lower = note.toLowerCase();
  if (nameParts.some(p => new RegExp(`\\b${p.replace(/[^a-z]/g, '')}\\b`).test(lower))
    || /\b(for|patient|pt|mr|mrs|ms|miss)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(note)) w.push("a patient's name");
  return w;
}

// ── Lab actions ───────────────────────────────────────────────────────────────
export function createUploadLink(input: {
  caseId: string; view: PublicCaseView; requested: RequestKind[]; note: string;
  expiryDays: number; withCode: boolean; createdBy: string;
}): UploadLink {
  const now = new Date();
  const link: UploadLink = {
    token: newToken(),
    code: input.withCode ? newCode() : null,
    caseId: input.caseId,
    view: input.view,
    requested: input.requested,
    note: input.note.trim(),
    labName: LAB_NAME,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.expiryDays * 86_400_000).toISOString(),
    failedAttempts: 0,
    batches: [],
  };
  // One live link per case: a new one replaces (revokes) the old.
  commit({
    ...state,
    links: [link, ...state.links.map(l => (l.caseId === input.caseId && !l.revokedAt ? { ...l, revokedAt: now.toISOString() } : l))],
  });
  return link;
}

export function revokeUploadLink(token: string) { update(token, l => ({ ...l, revokedAt: new Date().toISOString() })); }
export function markReviewed(caseId: string) {
  const at = new Date().toISOString();
  commit({ ...state, links: state.links.map(l => (l.caseId === caseId ? { ...l, reviewedAt: at } : l)) });
}

// ── Clinic actions (public page) ──────────────────────────────────────────────
export function markOpened(token: string) {
  const l = findLink(token);
  if (l && !l.openedAt) update(token, x => ({ ...x, openedAt: new Date().toISOString() }));
}

export type CodeResult = { ok: true } | { ok: false; locked: boolean; remaining: number };
export function verifyCode(token: string, code: string): CodeResult {
  const l = findLink(token);
  if (!l || linkState(l) !== 'active') return { ok: false, locked: true, remaining: 0 };
  if (!l.code || l.code === code.trim()) { update(token, x => ({ ...x, failedAttempts: 0 })); return { ok: true }; }
  const attempts = l.failedAttempts + 1;
  if (attempts >= MAX_CODE_ATTEMPTS) {
    update(token, x => ({ ...x, failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() }));
    return { ok: false, locked: true, remaining: 0 };
  }
  update(token, x => ({ ...x, failedAttempts: attempts }));
  return { ok: false, locked: false, remaining: MAX_CODE_ATTEMPTS - attempts };
}

export function addUploadBatch(token: string, files: DesignFile[], uploader?: string) {
  const l = findLink(token);
  if (!l || linkState(l) !== 'active' || !files.length) return false;
  const batch: UploadBatch = { id: `ub-${Date.now().toString(36)}`, uploader: uploader?.trim() || undefined, at: new Date().toISOString(), files };
  update(token, x => ({ ...x, batches: [...x.batches, batch] }));
  return true;
}

/** How many files this browser's clinic has sent — all the public page reveals. */
export const sentCount = (token: string) => (findLink(token) ? fileCount(findLink(token)!) : 0);

// ── Bell ─────────────────────────────────────────────────────────────────────
export function syncUploadNotifications() {
  const fresh: { at: string; item: (typeof MOCK_NOTIFICATIONS)[number] }[] = [];
  for (const l of state.links) {
    for (const b of l.batches) {
      const id = `ul-${b.id}`;
      if (MOCK_NOTIFICATIONS.some(n => n.id === id)) continue;
      const n = b.files.length;
      fresh.push({
        at: b.at,
        item: {
          id,
          title: `Files received for ${l.caseId}`,
          body: `${n} file${n === 1 ? '' : 's'} uploaded to ${l.caseId} via upload link${b.uploader ? ` by ${b.uploader}` : ''} · ${l.view.practice}. Open the case → Request files to review.`,
          timestamp: portalDateTime(b.at),
          read: false,
        },
      });
    }
  }
  fresh.sort((a, b) => a.at.localeCompare(b.at)).forEach(f => MOCK_NOTIFICATIONS.unshift(f.item));
}

// ── Demo seed ─────────────────────────────────────────────────────────────────
// SG-2026-0481 (the Design Studio demo case) already has a link with one batch
// from the clinic: a photo plus a small "CBCT" series, so the panel isn't empty.
const DEMO_CASE = 'SG-2026-0481';

function fakeDicom(i: number): Blob {
  const bytes = new Uint8Array(2048);
  bytes.set([68, 73, 67, 77], 128); // "DICM"
  bytes[200] = i;
  return new Blob([bytes], { type: 'application/dicom' });
}

let seeding = false;
export async function ensureUploadDemo() {
  if (state.seeded || seeding) return;
  seeding = true;
  try {
    const files: DesignFile[] = [];
    const at = new Date(Date.now() - 26 * 3_600_000).toISOString();
    try {
      const photo = await fetch('/teeth-3d.png').then(r => (r.ok ? r.blob() : null));
      if (photo) {
        const id = fid();
        if (await putBlob(id, photo)) files.push({ id, name: 'retracted-smile.png', size: photo.size, mime: 'image/png', kind: 'image', uploadedBy: 'clinician', uploadedAt: at });
      }
    } catch { /* offline: seed the series only */ }
    const parts: string[] = [];
    for (let i = 0; i < 24; i++) { const id = fid(); if (await putBlob(id, fakeDicom(i))) parts.push(id); }
    if (parts.length) files.push({ id: fid(), name: 'CBCT_0481', size: parts.length * 2048, mime: 'application/dicom', kind: 'dicom', uploadedBy: 'clinician', uploadedAt: at, parts });

    const created = new Date(Date.now() - 2 * 86_400_000);
    const seeded: UploadLink = {
      token: 'up_demo0481cb',
      code: '418205',
      caseId: DEMO_CASE,
      view: { caseRef: DEMO_CASE, practice: 'Smile Genius Belfast', dentist: 'Dr. Murphy', patientInitials: 'A.H.', service: 'Veneers', teeth: [11, 12, 13, 21, 22, 23] },
      requested: ['cbct', 'photos'],
      note: 'Need the CBCT for the 13–23 smile design, plus a retracted photo with the shade tab.',
      labName: LAB_NAME,
      createdBy: 'Mark',
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + 14 * 86_400_000).toISOString(),
      openedAt: at,
      failedAttempts: 0,
      batches: files.length ? [{ id: 'ub-demo0481', uploader: 'Hannah (nurse)', at, files }] : [],
    };
    if (!state.links.some(l => l.caseId === DEMO_CASE)) commit({ links: [seeded, ...state.links], seeded: true });
    else commit({ ...state, seeded: true });
  } finally { seeding = false; }
}

export function resetUploadDemo() { commit({ links: [], seeded: false }); }

export const expiryLabel = (l: UploadLink) => portalDate(new Date(l.expiresAt));
