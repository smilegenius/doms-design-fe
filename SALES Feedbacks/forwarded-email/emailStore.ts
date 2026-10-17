import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { addCreatedCase, removeCreatedCases } from '../../src/app/data/createdCases';
import { mockPractices } from '../../src/app/data/clinicsData';
import { MOCK_NOTIFICATIONS } from '../../src/app/pages/NotificationsPage';
import type { DesignFile } from '../design-studio/data/designStudio';
import { LAB_NAME, portalDate, portalDateTime } from '../lab-prescription-inbox/data';
import { exactMatch, suggestMatches, type FileSubject } from '../intake-form/fileMatching';

// ── Forwarded emails ─────────────────────────────────────────────────────────
// Lab staff forward dentists' emails (case updates, new requests, "see
// attached"…) to the same inbox address as prescription photos. Photos of
// paper prescriptions still become AI drafts; every other email becomes an
// email draft in Cases straight away (SF-FE-…). Opening it, the lab either
// creates a new case from it (QuickCreate, showing the real email) or adds it
// to an existing case as context (body + files). The email stays linked to
// the case it ends up on, so its Email tab, attachments and print resolve.

export const EMAIL_DRAFT_PREFIX = 'SF-FE-';

export interface ForwardedEmail {
  id: string;
  at: string;
  forwardedBy: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  files: DesignFile[];
  /** new: waiting as a draft · case: became a case · added: context on an existing case. */
  status: 'new' | 'case' | 'added' | 'dismissed';
  /** The case it's on (status case or added). */
  caseId?: string;
  /** Its draft row in Cases (kept after it's resolved, for links). */
  draftId?: string;
  actedBy?: string;
  actedAt?: string;
}

interface State { emails: ForwardedEmail[]; counter: number; seeded?: boolean }
const LS_KEY = 'salesFeedbacks.forwardedEmails.v3';

function load(): State {
  try { const p = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (p?.emails) return p; } catch { /* corrupt */ }
  return { emails: [], counter: 0 };
}
let state: State = load();
const listeners = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* keep in memory */ }
  listeners.forEach(l => l());
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === LS_KEY) { state = load(); listeners.forEach(l => l()); } });
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useForwardedEmails(): State { return useSyncExternalStore(subscribe, () => state); }
export const getEmail = (id: string) => state.emails.find(e => e.id === id);
export const toTriage = () => state.emails.filter(e => e.status === 'new');
/** Emails on a case: added as context, or the email the case was made from (Attachment files / Scans → Email). */
export const emailsForCase = (caseId: string) => state.emails.filter(e => (e.status === 'added' || e.status === 'case') && e.caseId === caseId);
export const emailForDraft = (draftId: string) => state.emails.find(e => e.draftId === draftId);
/** The email a case was created from (status case), for its Email tab and print. */
export const emailBehind = (caseId: string) => state.emails.find(e => (e.status === 'case' && e.caseId === caseId) || (e.status === 'new' && e.draftId === caseId));
export const isEmailSeeded = () => !!state.seeded;
export function markEmailSeeded() { commit({ ...state, seeded: true }); }

// ── Reading the email (simulated parsing) ────────────────────────────────────
const REF = /\b(SG-\d{4}-\d{4}|SG-\d{4,6}|CASE-[A-Z]{1,4}-?\d{2,5}|CASE-\d{2,5}|ITR-CASE-\d{4,6}|3SH-REF-\d{4,6})\b/i;
// Names stay on one line: "patient Liam Foster" but not "Liam Foster\n\nHello".
const PATIENT = /\b(?:patient|pt|for)[: \t]+(?:Mr\.?|Mrs\.?|Ms\.?|Miss[ \t])?[ \t]*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z'’-]+)+)/;
const SERVICES: [RegExp, string][] = [
  [/\bveneers?\b/i, 'Veneers'], [/\bcrowns?\b/i, 'Crown'], [/\bbridge\b/i, 'Bridge'], [/\bnight ?guard\b/i, 'Night Guard'],
  [/\baligners?\b/i, 'Clear Aligners'], [/\bretainer\b/i, 'Retainer'], [/\bdenture\b/i, 'Full Denture'],
];

/** "end of next week", "next week", "tomorrow", "in 5 days", "by 30/10" → a portal date. */
function deliveryFrom(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  const d = new Date(now);
  if (/end of next week/.test(t)) { d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7) + 7); return portalDate(d); }
  if (/end of (this|the) week/.test(t)) { d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return portalDate(d); }
  if (/\bnext week\b/.test(t)) { d.setDate(d.getDate() + 7); return portalDate(d); }
  if (/\btomorrow\b/.test(t)) { d.setDate(d.getDate() + 1); return portalDate(d); }
  const inDays = t.match(/\bin (\d{1,2}) (?:working )?days?\b/);
  if (inDays) { d.setDate(d.getDate() + Number(inDays[1])); return portalDate(d); }
  const by = t.match(/\bby (\d{1,2})[/.](\d{1,2})\b/);
  if (by) { const x = new Date(now.getFullYear(), Number(by[2]) - 1, Number(by[1])); if (x < now) x.setFullYear(x.getFullYear() + 1); return portalDate(x); }
  return null;
}

export function readEmail(e: Pick<ForwardedEmail, 'subject' | 'body' | 'fromName'>) {
  const text = `${e.subject}\n${e.body}`;
  const reference = text.match(REF)?.[1] ?? '';
  const patientName = text.match(PATIENT)?.[1] ?? '';
  const practice = mockPractices.map(p => p.name).sort((a, b) => b.length - a.length).find(n => text.toLowerCase().includes(n.toLowerCase())) ?? '';
  const service = SERVICES.find(([re]) => re.test(text))?.[1] ?? '';
  const fdi = [...text.matchAll(/\b([1-4][1-8])\b/g)].map(m => Number(m[1])).filter(n => n % 10 >= 1);
  const codes = [...text.matchAll(/\b(UR|UL|LL|LR)([1-8])\b/g)].map(m => ({ UR: 10, UL: 20, LL: 30, LR: 40 }[m[1] as 'UR'] + Number(m[2])));
  const teeth = [...new Set([...fdi, ...codes])].slice(0, 8);
  const shade = text.match(/\b(A[1-4]|A3\.5|B[1-4]|C[1-4]|D[2-4]|BL[1-4])\b/)?.[1];
  const material = /e\.?max|lithium/i.test(text) ? 'Lithium Disilicate (e.max)' : /zirconia/i.test(text) ? 'Zirconia' : undefined;
  const orderType = /\bnhs\b/i.test(text) ? 'NHS' : /\bprivate\b/i.test(text) ? 'Private' : undefined;
  const subject: FileSubject = { patientName, practice, dentist: e.fromName, reference, service, teeth };
  return { reference, patientName, practice, service, teeth, shade, material, orderType, delivery: deliveryFrom(text), subject };
}

export function matchesFor(e: ForwardedEmail) {
  const r = readEmail(e);
  const exact = r.reference ? exactMatch({ ...r.subject, practice: r.practice }) : undefined;
  return { read: r, exact, suggestions: r.patientName ? suggestMatches(r.subject) : [] };
}

// ── Actions ──────────────────────────────────────────────────────────────────
/** The draft row an email shows as in Cases, filled with everything read from it. */
function draftCaseFor(e: ForwardedEmail, draftId: string): Case {
  const r = readEmail(e);
  const scans = e.files.filter(f => f.kind === 'mesh' || f.kind === 'dicom').length;
  const service = r.service || 'Other';
  return {
    id: draftId,
    patientName: r.patientName || 'Patient not named',
    practice: r.practice || '',
    dentist: e.fromName.replace(/\s*<.*$/, ''),
    lab: LAB_NAME,
    services: [service],
    serviceItems: [{
      id: `${draftId}-s1`, name: service, status: 'submitted', deliveryDate: r.delivery,
      fdi: r.teeth, material: r.material, shade: r.shade, orderType: r.orderType,
      instructions: e.body.trim(), scanFileCount: scans, attachmentCount: e.files.length - scans,
    }],
    status: 'draft', createdAt: portalDate(new Date(e.at)), updatedAt: portalDate(new Date(e.at)), requestedDelivery: r.delivery, hasAlert: false,
    scanner: '3Shape', source: 'email', createdBy: e.forwardedBy, createdBySide: 'lab',
    emailPrescription: {
      fromName: e.fromName, fromEmail: e.fromEmail, subject: e.subject, receivedAt: portalDateTime(e.at),
      attachmentName: e.files.length ? `${e.files.length} attachment${e.files.length === 1 ? '' : 's'}` : 'No attachments',
      bodyPreview: e.body.trim().slice(0, 280),
    },
  };
}

/** A forwarded email arrives: it's stored and becomes a draft row in Cases straight away. */
export function receiveEmail(input: Omit<ForwardedEmail, 'id' | 'at' | 'status' | 'draftId'>, at = new Date().toISOString()): ForwardedEmail {
  const counter = state.counter + 1;
  const id = `FE-${String(counter).padStart(4, '0')}`;
  const draftId = `${EMAIL_DRAFT_PREFIX}${String(counter).padStart(4, '0')}`;
  const email: ForwardedEmail = { ...input, id, at, status: 'new', draftId };
  addCreatedCase(draftCaseFor(email, draftId));
  commit({ ...state, counter, emails: [email, ...state.emails] });
  return email;
}

function update(id: string, patch: Partial<ForwardedEmail>) {
  commit({ ...state, emails: state.emails.map(e => (e.id === id ? { ...e, ...patch } : e)) });
}
const dropDraft = (e?: ForwardedEmail) => { if (e?.draftId) removeCreatedCases(c => c.id === e.draftId); };

/** Add the email (body + attachments) to an existing case as context; the draft goes. */
export function addEmailToCase(id: string, caseId: string, by?: string) {
  dropDraft(getEmail(id));
  update(id, { status: 'added', caseId, actedBy: by, actedAt: new Date().toISOString() });
}

/** The email's draft became a real case (QuickCreate or Bulk Actions): link them. */
export function linkEmailCase(draftId: string, caseId: string, by?: string) {
  const e = emailForDraft(draftId);
  if (!e) return;
  update(e.id, { status: 'case', caseId, actedBy: by, actedAt: new Date().toISOString() });
}

export function dismissEmail(id: string, by?: string) {
  dropDraft(getEmail(id));
  update(id, { status: 'dismissed', actedBy: by, actedAt: new Date().toISOString() });
}

/** Seeding: put an email straight on a case (as context, or as the case it became). */
export function settleEmail(id: string, status: 'added' | 'case', caseId: string, by: string, at?: string) {
  dropDraft(getEmail(id));
  update(id, { status, caseId, actedBy: by, actedAt: at ?? new Date().toISOString() });
}

export function resetEmailDemo() {
  removeCreatedCases(c => c.id.startsWith(EMAIL_DRAFT_PREFIX));
  commit({ emails: [], counter: 0, seeded: false });
}

// ── Bell ─────────────────────────────────────────────────────────────────────
export function syncEmailNotifications() {
  [...state.emails].reverse().forEach(e => {
    const id = `fe-${e.id}`;
    if (MOCK_NOTIFICATIONS.some(n => n.id === id)) return;
    MOCK_NOTIFICATIONS.unshift({
      id,
      title: `New email draft from ${e.fromName.replace(/\s*<.*$/, '')}`,
      body: `"${e.subject}"${e.files.length ? ` · ${e.files.length} attachment${e.files.length === 1 ? '' : 's'}` : ''}. Forwarded by ${e.forwardedBy}. Open the draft in Cases to make a new case or add it to an existing one.`,
      timestamp: portalDateTime(e.at),
      read: false,
    });
  });
}
