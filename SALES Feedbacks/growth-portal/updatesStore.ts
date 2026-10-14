import { useSyncExternalStore } from 'react';

// ── What's new: the Growth Team Feedback change log ──────────────────────────
// A high-level log of what this sandbox adds or changes, bucketed by area.
// Each update has a short note (editable, saved in this browser) and links to
// an example of the change. Anyone can also add their own update.

export type UpdateTag = 'new' | 'changed';

export interface UpdateExample {
  label: string;
  /** In-app path (stays in Growth Team Feedback), or a public page opened in a new tab. */
  to: string;
  newTab?: boolean;
}

export interface Update {
  id: string;
  bucket: string;
  title: string;
  tag: UpdateTag;
  note: string;
  examples: UpdateExample[];
  custom?: boolean;
}

export const BUCKETS = ['Cases & intake', 'Design', 'Settings & notifications', 'Navigation'] as const;

export const BUILT_IN: Update[] = [
  {
    id: 'rx-inbox', bucket: 'Cases & intake', title: 'Prescription email inbox', tag: 'new',
    note: 'Each lab gets an inbox address. Lab staff email a photo of a paper prescription and AI creates a pre-filled draft case, with the photo viewable page by page inside the draft.',
    examples: [{ label: 'Inbox bar on Cases', to: '/growth/cases' }, { label: 'Inbox settings tab', to: '/growth/settings?tab=rx-inbox' }],
  },
  {
    id: 'upload-links', bucket: 'Cases & intake', title: 'Clinician upload links', tag: 'new',
    note: 'From a case, the lab creates a link to send by WhatsApp or email. The clinic uploads DICOM, scans and photos without logging in, and sees only the case ref and the patient\'s initials. Optional access code, expiry and revoke.',
    examples: [{ label: 'Request files on a case', to: '/growth/cases/SG-2026-0481?sf=files' }, { label: 'The clinic\'s page', to: '/upload/demo', newTab: true }],
  },
  {
    id: 'intake-form', bucket: 'Cases & intake', title: 'Website intake form', tag: 'new',
    note: 'A branded new-case form each lab can link to or embed on its website, with its logo. Each submission becomes a draft case for the lab to check, using the lab\'s own Prescription Builder fields.',
    examples: [{ label: 'Intake form settings', to: '/growth/settings?tab=intake-form' }, { label: 'The public form', to: '/intake/smile-genius-lab', newTab: true }],
  },
  {
    id: 'design-studio', bucket: 'Design', title: 'Design Studio', tag: 'new',
    note: 'The lab shares a design with the dentist through a link. The dentist turns the 3D model, captures views, marks up and comments, then approves or requests changes. The lab replies point by point and shares the next version.',
    examples: [{ label: 'Lab\'s Design Studio', to: '/growth/cases/SG-2026-0481/studio?demo=1' }, { label: 'The dentist\'s review link', to: '/review/rv_8kq2m4x9', newTab: true }],
  },
  {
    id: 'design-on-case', bucket: 'Design', title: 'Design review inside the case', tag: 'changed',
    note: 'A new "Design review" item next to Details / Invoice / Shipping on the case page. Cases with no design get a button to share one, by link or by uploading files. Dentists can attach their own files for the lab.',
    examples: [{ label: 'A case with a design', to: '/growth/cases/SG-2026-0481?sf=design' }],
  },
  {
    id: 'notif-categories', bucket: 'Settings & notifications', title: 'New notification categories', tag: 'changed',
    note: 'Settings → Notifications gains "Prescription Email Inbox" and "Website Intake Form" categories. Each person sets their own bell and email alerts, and admins can add default recipients from User Management.',
    examples: [{ label: 'Prescription inbox category', to: '/growth/settings?tab=notifications&focus=rx-inbox' }, { label: 'Website intake category', to: '/growth/settings?tab=notifications&focus=intake-form' }],
  },
  {
    id: 'settings-tabs', bucket: 'Settings & notifications', title: 'Two new Settings tabs', tag: 'changed',
    note: 'The Settings sidebar gets "Prescription Email Inbox" and "Website Intake Form" tabs below the existing ones. Every existing tab is unchanged.',
    examples: [{ label: 'Settings sidebar', to: '/growth/settings?tab=intake-form' }],
  },
  {
    id: 'growth-portal', bucket: 'Navigation', title: 'Growth Team Feedback portal', tag: 'new',
    note: 'A card on the portal select screen opens this separate copy of the Lab portal. The real Lab, Clinic and DSO portals never show any of this work.',
    examples: [{ label: 'Portal select', to: '/portal-select' }],
  },
  {
    id: 'whats-new', bucket: 'Navigation', title: 'What\'s new log', tag: 'new',
    note: 'This page: a sidebar item above Settings that lists each change with a note and an example you can open.',
    examples: [{ label: 'You are here', to: '/growth/updates' }],
  },
];

interface State { notes: Record<string, string>; custom: Update[]; seen: string[] }
const LS_KEY = 'salesFeedbacks.updates.v1';

function load(): State {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (p) return { notes: p.notes ?? {}, custom: p.custom ?? [], seen: p.seen ?? [] };
  } catch { /* corrupt or blocked */ }
  return { notes: {}, custom: [], seen: [] };
}
let state: State = load();
const listeners = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
  listeners.forEach(l => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useUpdates() {
  const s = useSyncExternalStore(subscribe, () => state);
  const all: Update[] = [...BUILT_IN.map(u => ({ ...u, note: s.notes[u.id] ?? u.note })), ...s.custom];
  return { all, seen: s.seen, unseen: all.filter(u => !s.seen.includes(u.id)).length };
}
export function setNote(id: string, note: string) {
  if (state.custom.some(u => u.id === id)) commit({ ...state, custom: state.custom.map(u => (u.id === id ? { ...u, note } : u)) });
  else commit({ ...state, notes: { ...state.notes, [id]: note } });
}
export function addUpdate(u: Omit<Update, 'id' | 'custom'>) {
  commit({ ...state, custom: [{ ...u, id: `custom-${Date.now().toString(36)}`, custom: true }, ...state.custom] });
}
export function removeUpdate(id: string) { commit({ ...state, custom: state.custom.filter(u => u.id !== id) }); }
export function resetNote(id: string) { const n = { ...state.notes }; delete n[id]; commit({ ...state, notes: n }); }
export function markAllSeen() {
  const ids = [...BUILT_IN.map(u => u.id), ...state.custom.map(u => u.id)];
  if (ids.every(i => state.seen.includes(i))) return;
  commit({ ...state, seen: ids });
}
export const isEdited = (id: string) => id in state.notes;
