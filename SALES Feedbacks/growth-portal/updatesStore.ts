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
  /** Subsection the link is listed under; worked out from the link when not set. */
  group?: string;
}

export interface Update {
  id: string;
  bucket: string;
  title: string;
  tag: UpdateTag;
  note: string;
  /** One short line shown on the page; the note sits behind "Details". */
  summary?: string;
  examples: UpdateExample[];
  custom?: boolean;
}

export const BUCKETS = ['Cases & intake', 'Billing', 'Design & CAD', 'Settings & notifications', 'Navigation'] as const;

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
      { label: 'Branded form: CASE-RS-2002 (scanner case)', to: '/growth/order-form/CASE-RS-2002' },
      { label: 'Branded form: SG-2026-0519 (LabLink case)', to: '/growth/order-form/SG-2026-0519' },
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
    id: 'billing-home', bucket: 'Billing', title: 'Billing: lab invoicing and Xero sync', tag: 'new',
    note: 'A new Billing item in the sidebar. Every case is invoiced on dispatch, posted to Xero and emailed; payments are read back from Xero; one statement per account goes out at month end. Billing home is the admin\'s daily inbox: paid, pending and overdue totals, flagged invoices with bulk approve, the On hold queue, smart-assist nudges and the month-end countdown. Admins only. Xero and QuickBooks are simulated.',
    examples: [
      { label: 'Billing home', to: '/growth/billing' },
      { label: 'Flagged invoices', to: '/growth/billing?filter=pending' },
      { label: 'An invoice (PDF, payments, credit note, void)', to: '/growth/billing/invoices/INV-2418' },
    ],
  },
  {
    id: 'billing-case', bucket: 'Billing', title: 'Billing tab on the case', tag: 'new',
    note: 'Next to Order form and Lab Documents: the lines with where each price came from (one click explains it), the NHS / private toggle, stages billed so far for staged work, bought-in parts priced by the item\'s rule, the invoice status, "Bill now", a possible-remake question and the on-hold banner.',
    examples: [
      { label: 'Staged denture (billed each stage)', to: '/growth/cases/CASE-DN-3001?sf=billing' },
      { label: 'Possible remake', to: '/growth/cases/CASE-RS-2002?sf=billing' },
    ],
  },
  {
    id: 'billing-accounts', bucket: 'Billing', title: 'Billing accounts, dentists, limits and holds', tag: 'new',
    note: 'Add accounts in three shapes: a practice, a dentist at one practice who pays their own bills, or a dentist who floats across several practices. Map dentists to practices from either side (practice page: add a dentist, who pays; dentist page: practices); cases not yet invoiced move to whoever now pays, and dentists sending cases from a practice they aren\'t linked to show as "Unlinked". Each account has its price list, emails, Xero contact (matched or created), currency, statement of manufacture, balance and ageing, statements and old-system balances. Optional limits count unpaid invoices plus work in progress, warn early, and can pause new cases; a payment in Xero lifts the hold.',
    examples: [
      { label: 'Add an account', to: '/growth/billing/accounts' },
      { label: 'Dentist across practices (Dr. Campbell)', to: '/growth/billing/accounts/acc-d-dr-campbell' },
      { label: 'Practice with its dentists (Manchester)', to: '/growth/billing/accounts/acc-p-smile-genius-manchester' },
      { label: 'Account on hold (Birmingham 2)', to: '/growth/billing/accounts/acc-p-smile-genius-birmingham-2' },
      { label: 'Overseas practice in EUR', to: '/growth/billing/accounts/acc-p-smile-genius-dublin' },
    ],
  },
  {
    id: 'billing-pricing', bucket: 'Billing', title: 'Catalog, promotions and tiers', tag: 'new',
    note: 'Add catalog items and edit them in full (code, department, unit, NHS and private prices, billing per stage, component pricing, VAT), archive items without touching old invoices, and change prices from a date: today, back-dated, or scheduled for later, with a price history per item. "Change prices" raises or lowers a department or the whole catalog by a percentage with rounding and a preview. Cases are always priced as of the day they were received. Plus CSV import, order types mapped once, and optional promotions and volume tiers.',
    examples: [
      { label: 'Catalog', to: '/growth/billing/catalog' },
      { label: 'Promotions and tiers', to: '/growth/billing/pricing' },
    ],
  },
  {
    id: 'billing-setup', bucket: 'Billing', title: 'Billing settings and reports', tag: 'new',
    note: 'The lab settings with their defaults, connecting or disconnecting Xero or QuickBooks, email templates with the lab logo, the sync and email logs, and six reports Xero can\'t give (unbilled work, account trends, given away, remakes, product mix, cash forecast) with CSV export and the Monday email.',
    examples: [
      { label: 'Billing settings', to: '/growth/billing/settings' },
      { label: 'Reports', to: '/growth/billing/reports' },
    ],
  },
  {
    id: 'cad-board', bucket: 'Design & CAD', title: 'Design board (exocad & 3Shape)', tag: 'new',
    note: 'A new Design item in the sidebar. Every digital case becomes a CAD order in exocad or 3Shape (by restoration type), with the case details and scans filled in, and moves across the board: CAD order created, In design, With a partner, Awaiting dentist, Ready to manufacture, Manufacturing, Finishing, Dispatched. Cards show patient, teeth, due date, technician or partner and CAD, with overdue, waiting-on-dentist, queued and duplicate flags. Drag a card onto a technician to assign it, or along the lab columns (Dispatched starts the invoice). The connector is simulated until exocad and 3Shape partner access is agreed.',
    examples: [
      { label: 'Design board', to: '/growth/design' },
      { label: 'Partners', to: '/growth/design/partners' },
    ],
  },
  {
    id: 'cad-case', bucket: 'Design & CAD', title: 'CAD design tab on the case', tag: 'new',
    note: 'Next to Order form and Billing: the order as sent to CAD (reference, patient, client, due date, teeth, indication and material from the mapping, shade, implant), the scans with a one-click scan pack, and Open in CAD. Finished designs come back by hand for now: paste the exocad webview or 3Shape Communicate link, or upload the STL and screenshots, and confirm what was designed. Differences from the case (an extra unit, a crown that became an onlay) reprice the invoice draft and flag it. Send for approval creates a Design Studio review link; the dentist\'s answer moves the case on, with reminders, round history and the approved version on record.',
    examples: [
      { label: 'Veneers waiting on the dentist', to: '/growth/cases/SG-2026-0481?sf=cad' },
      { label: 'Possible duplicate order', to: '/growth/cases/CASE-051?sf=cad' },
      { label: 'Design differs from the case', to: '/growth/cases/CASE-001?sf=cad' },
    ],
  },
  {
    id: 'cad-partners', bucket: 'Design & CAD', title: 'Outsourced design and milling partners', tag: 'new',
    note: 'Send any case to a design or milling partner from the case. They get a secure link (no account) to download the scans and order details and upload the design, or confirm dispatch with a tracking number; the result lands on the same case. Late partners are flagged and reminded, and the case can be reassigned.',
    examples: [
      { label: 'Partners and late jobs', to: '/growth/design/partners' },
      { label: 'Partner\'s page (design, late)', to: '/partner/pt_demo01', newTab: true },
      { label: 'Partner\'s page (milling, shipped)', to: '/partner/pt_demo02', newTab: true },
    ],
  },
  {
    id: 'cad-settings', bucket: 'Design & CAD', title: 'Settings: CAD & design', tag: 'new',
    note: 'The ten CAD settings with defaults (CAD per restoration type, when to create the order, patient details, approval rules, reminder, partners, assignment), the indication and material mapping table, and the desktop connector: a guided setup (download, sign in, find exocad / 3Shape folders, where it runs, test order) and health per connector, with offline orders queued and delivered on reconnect.',
    examples: [
      { label: 'CAD & design settings', to: '/growth/settings?tab=cad' },
    ],
  },
  {
    id: 'design-studio', bucket: 'Design & CAD', title: 'Design Studio', tag: 'new',
    note: 'The lab shares a design with the dentist through a link. The dentist turns the 3D model, captures views, marks up and comments, then approves or requests changes. The lab replies point by point and shares the next version.',
    examples: [{ label: 'Lab\'s Design Studio', to: '/growth/cases/SG-2026-0481/studio?demo=1' }, { label: 'The dentist\'s review link', to: '/review/rv_8kq2m4x9', newTab: true }],
  },
  {
    id: 'design-on-case', bucket: 'Design & CAD', title: 'Design review inside the case', tag: 'changed',
    note: 'A new "Design review" item next to Details / Invoice / Shipping on the case page. Cases with no design get a button to share one, by link or by uploading files. Dentists can attach their own files for the lab.',
    examples: [{ label: 'A case with a design', to: '/growth/cases/SG-2026-0481?sf=design' }],
  },
  {
    id: 'notif-categories', bucket: 'Settings & notifications', title: 'New notification categories', tag: 'changed',
    note: 'Settings → Notifications gains "Prescription Email Inbox" and "LabLink" categories (LabLink has two: new case request, files for an existing case). Each person sets their own bell and email alerts, and admins can add default recipients from User Management.',
    examples: [{ label: 'Prescription inbox category', to: '/growth/settings?tab=notifications&focus=rx-inbox' }, { label: 'LabLink category', to: '/growth/settings?tab=notifications&focus=intake-form' }],
  },
  {
    id: 'settings-tabs', bucket: 'Settings & notifications', title: 'New Settings tabs', tag: 'changed',
    note: 'The Settings sidebar gets "Prescription Email Inbox", "LabLink (website form)", "Bulk Actions" and "CAD & design" tabs below the existing ones. Every existing tab is unchanged.',
    examples: [
      { label: 'Prescription Email Inbox', to: '/growth/settings?tab=rx-inbox' },
      { label: 'LabLink', to: '/growth/settings?tab=intake-form' },
      { label: 'Bulk Actions', to: '/growth/settings?tab=bulk-actions' },
      { label: 'CAD & design', to: '/growth/settings?tab=cad' },
    ],
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

/** The one-liners shown on the page (the full notes stay behind "Details"). */
const SUMMARY: Record<string, string> = {
  'rx-inbox': 'Email a photo of a paper prescription; AI makes a pre-filled draft case.',
  lablink: 'One link on the lab website for new cases and files; files match to the right case.',
  'bulk-actions': 'Tick cases or drafts to accept, download or print them, with saved defaults.',
  'branded-order-form': 'Printed order forms carry the lab logo and name, with a small Smile Genius mark.',
  'forwarded-emails': 'Forwarded emails become drafts: make a new case or add to an existing one.',
  'billing-home': 'Every case invoiced on dispatch, posted to Xero, statements at month end.',
  'billing-case': 'Prices, NHS/private, stages and parts on the case, with Bill now.',
  'billing-accounts': 'Practices or dentists as accounts, who pays, limits and holds.',
  'billing-pricing': 'Add and edit items, prices from a date, bulk changes, promotions and tiers.',
  'billing-setup': 'Billing settings, Xero connection, email templates and six reports.',
  'cad-board': 'Every digital case as a CAD order, tracked across a drag-and-drop board.',
  'cad-case': 'The CAD order on the case: bring the design back, send it for approval.',
  'cad-partners': 'Send a case to a design or milling partner through a no-login link.',
  'cad-settings': 'CAD choices, approval rules, mapping table and the desktop connector.',
  'design-studio': 'Share a design with the dentist; they mark it up, approve or ask for changes.',
  'design-on-case': 'The design review sits on the case page, next to the case details.',
  'notif-categories': 'Notification categories for the inbox and LabLink, with default recipients.',
  'settings-tabs': 'New Settings tabs for the sandbox features.',
  'growth-portal': 'A separate copy of the Lab portal; the real portals never show this work.',
  'whats-new': 'This page.',
};

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
  const all: Update[] = [...BUILT_IN.map(u => ({ ...u, summary: u.summary ?? SUMMARY[u.id], note: s.notes[u.id] ?? u.note })), ...s.custom];
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
