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
    id: 'lablink', bucket: 'Cases & intake', title: 'LabLink', tag: 'new',
    note: 'One branded link each lab puts on its website, in email signatures and auto-replies, in place of WeTransfer, Dropbox and the old per-case upload links. Dentists send either a new case or files for an existing case. A new case (with a delivery address) becomes a draft that shows the submitted order form, attachments and sender checks; once confirmed, the LabLink form sits as a tab next to the Smile Genius order form. Files quoting the case ID or scanner ref sync straight into the case; otherwise they wait on a Match files screen with the likely cases and why, and if the case can\'t be found the lab creates a new case from them. Everything lands in the case\'s Attachment files / Scans section, filterable by type and source.',
    examples: [
      { label: 'New-case draft (WEB-0005)', to: '/growth/cases/quick-new/SF-WEB-DEMO05' },
      { label: 'Confirmed case + order form (SG-2026-0519)', to: '/growth/cases/SG-2026-0519?sf=order' },
      { label: 'Files to match (WEB-0009)', to: '/growth/cases/quick-new/SF-WEB-F0009' },
      { label: 'Files synced into CASE-RS-2002', to: '/growth/cases/CASE-RS-2002?sf=attachments' },
      { label: 'No case found? Create one (WEB-0009)', to: '/growth/cases/quick-new/SF-WEB-F0009' },
      { label: 'LabLink form tab (SG-2026-0519)', to: '/growth/cases/SG-2026-0519?sf=order' },
      { label: 'LabLink settings', to: '/growth/settings?tab=intake-form' },
      { label: 'Dentist view: new case', to: '/lablink/smile-genius-lab?mode=new', newTab: true },
      { label: 'Dentist view: files for a case', to: '/lablink/smile-genius-lab?mode=files', newTab: true },
    ],
  },
  {
    id: 'bulk-actions', bucket: 'Cases & intake', title: 'Bulk Actions', tag: 'new',
    note: 'Everything works on the cases you tick. "Accept" moves ticked cases to In Production through the portal\'s own status update, with its override rules. Drafts can be ticked too, and moved to Received or Accepted in one go. Download files puts only the ticked cases in a ZIP; choose what to include (scans, CBCT, photos, documents, order forms, file list), how folders are named, and one ZIP or one per practice. Print order forms asks once: Smile Genius form, the original (scanner, LabLink or email), or both. Each lab user\'s choices are remembered, and are in Settings → Bulk Actions.',
    examples: [
      { label: 'Tick drafts on Cases', to: '/growth/cases?bulk=drafts' },
      { label: 'Download 2 cases', to: '/growth/cases?bulk=download&ids=CASE-RS-2002,SG-2026-0519' },
      { label: 'Print scanner + LabLink + email cases', to: '/growth/cases?bulk=print&ids=CASE-RS-2002,SG-2026-0519,SG-2026-0527' },
      { label: 'Your Bulk Actions defaults', to: '/growth/settings?tab=bulk-actions' },
    ],
  },
  {
    id: 'branded-order-form', bucket: 'Cases & intake', title: 'Lab-branded order form', tag: 'changed',
    note: 'The printed and downloaded Smile Genius order form now carries the lab\'s logo top left and the lab\'s name top right, taken from Settings → LabLink (initials on the lab\'s colour if no logo is uploaded), with a small Smile Genius mark at the bottom. The header and footer repeat on every page, however many pages the form runs to.',
    examples: [
      { label: 'Print 2 order forms', to: '/growth/cases?bulk=print&ids=CASE-RS-2002,SG-2026-0519' },
      { label: 'Upload the lab logo', to: '/growth/settings?tab=intake-form' },
    ],
  },
  {
    id: 'forwarded-emails', bucket: 'Cases & intake', title: 'Forwarded emails', tag: 'new',
    note: 'Lab staff forward any dentist email to the same inbox address as prescription photos. Every email becomes a draft in Cases, filled with what was read from it (patient, practice, service, teeth, shade, material, order type, needed-by date). Opening the draft shows the email: create a new case from it, where QuickCreate shows the real email, sets the order type and picks the clinic when only one matches; or add it to an existing case, where its files and text join the case\'s attachments. A case made from an email gets an Email tab next to the order form.',
    examples: [
      { label: 'Email draft → new case (Liam Foster)', to: '/growth/cases/quick-new/SF-FE-0005' },
      { label: 'Email draft → existing case (Isabella Hughes)', to: '/growth/cases/quick-new/SF-FE-0004' },
      { label: 'Case made from an email (SG-2026-0527)', to: '/growth/cases/SG-2026-0527?sf=email' },
      { label: 'All email drafts', to: '/growth/cases/emails' },
      { label: 'Forward an email', to: '/growth/cases?forward=1' },
    ],
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
    note: 'Settings → Notifications gains "Prescription Email Inbox" and "LabLink" categories (LabLink has two: new case request, files for an existing case). Each person sets their own bell and email alerts, and admins can add default recipients from User Management.',
    examples: [{ label: 'Prescription inbox category', to: '/growth/settings?tab=notifications&focus=rx-inbox' }, { label: 'LabLink category', to: '/growth/settings?tab=notifications&focus=intake-form' }],
  },
  {
    id: 'settings-tabs', bucket: 'Settings & notifications', title: 'Two new Settings tabs', tag: 'changed',
    note: 'The Settings sidebar gets "Prescription Email Inbox" and "LabLink (website form)" tabs below the existing ones. Every existing tab is unchanged.',
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
