import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { addCreatedCase, getCreatedCases, removeCreatedCases } from '../../src/app/data/createdCases';
import { mockPractices } from '../../src/app/data/clinicsData';
import { MOCK_NOTIFICATIONS } from '../../src/app/pages/NotificationsPage';
import type { DesignFile } from '../design-studio/data/designStudio';
import { LAB_NAME, LAB_TEAM, portalDate, portalDateTime } from '../lab-prescription-inbox/data';

// ── LabLink: the lab's website form ──────────────────────────────────────────
// Each lab gets one branded, embeddable link for dentists. Two kinds of request:
//   • A new case: becomes a draft case (status 'draft') in the shared
//     created-cases store, so it shows in the real Cases list and opens in the
//     real QuickCreate for the lab to check and confirm, like inbox drafts.
//   • Files for an existing case: matched to a case (fileMatching.ts). An
//     exact reference syncs the files into that case; otherwise a draft row
//     waits on the Match files screen for the lab to pick the case.

export const INTAKE_ID_PREFIX = 'SF-WEB-';

export const ACCENTS = [
  { id: 'brand',  label: 'Smile Genius', from: '#4D8EF7', to: '#A59DFF' },
  { id: 'teal',   label: 'Teal',         from: '#0F9F8F', to: '#34C3B5' },
  { id: 'navy',   label: 'Navy',         from: '#1E3A8A', to: '#3B82F6' },
  { id: 'plum',   label: 'Plum',         from: '#7C3AED', to: '#C084FC' },
  { id: 'coral',  label: 'Coral',        from: '#E2553F', to: '#F59E7A' },
  { id: 'slate',  label: 'Graphite',     from: '#334155', to: '#64748B' },
] as const;
export type AccentId = (typeof ACCENTS)[number]['id'];
export const accentFor = (id: AccentId) => ACCENTS.find(a => a.id === id) ?? ACCENTS[0];

export interface IntakeConfig {
  enabled: boolean;
  slug: string;
  labName: string;
  /** Data URL (stored in localStorage; capped at 2MB on upload). */
  logo: string | null;
  accent: AccentId;
  welcome: string;
  services: string[];
}

export interface IntakeSubmission {
  /** Absent on older requests: those were all new cases. */
  kind?: 'new-case' | 'files';
  /** New case: its draft. Files: the draft row while unmatched (SF-WEB-F…), else ''. */
  caseId: string;
  ref: string;
  at: string;
  dentist: string;
  gdc: string;
  practice: string;
  postcode: string;
  email: string;
  phone: string;
  patientName: string;
  service: string;
  knownPractice: boolean;
  files: DesignFile[];
  /** Team members emailed when it arrived. */
  notified: string[];
  /** Everything else the dentist entered: rendered as the order form. */
  order?: IntakeOrder;
  /** Set once the lab confirmed the draft: the real case it became. */
  confirmedCaseId?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  /** Files for an existing case. */
  filesFor?: FilesFor;
  /** New case: delivery address. */
  address?: DeliveryAddress;
  /** Set when this new-case draft was made from an unmatched files request. */
  fromRef?: string;
}

export interface DeliveryAddress { line: string; city: string; postcode: string }
export const addressText = (a?: DeliveryAddress) => (a ? [a.line, a.city, a.postcode].filter(Boolean).join(', ') : '');

export interface FilesFor {
  patientDob: string;
  reference: string;
  comments: string;
  teeth: number[];
  /** The draft row's id while it was waiting (kept after it's matched). */
  draftId?: string;
  /** Where the files ended up, and how. */
  attachedCaseId?: string;
  attachedAt?: string;
  attachedBy?: string;
  matchedBy?: 'reference' | 'lab';
  dismissedAt?: string;
  /** Turned into a new-case draft instead (no existing case found). */
  convertedTo?: string;
  convertedRef?: string;
}

export interface IntakeOrder {
  patientDob: string;
  patientRef: string;
  teeth: number[];
  material?: string;
  shade?: string;
  orderType?: string;
  delivery?: string;
  instructions?: string;
  extras: Record<string, string>;
}

export interface IntakePrefs { inApp: boolean; email: boolean }
/** The two LabLink notifications, each with its own bell / email switches. */
export type LabLinkNotice = 'newCase' | 'files';
export type LabLinkPrefs = Record<LabLinkNotice, IntakePrefs>;

interface IntakeState {
  config: IntakeConfig;
  prefs: Record<string, LabLinkPrefs>;
  submissions: IntakeSubmission[];
  counter: number;
  resetVersion: number;
  prefsVersion?: number;
  /** Which version of the example requests (one draft, one confirmed case) has been added. */
  seedVersion?: number;
}

const LS_KEY = 'salesFeedbacks.intakeForm.v1';

const DEFAULT_CONFIG: IntakeConfig = {
  enabled: true,
  slug: 'smile-genius-lab',
  labName: LAB_NAME,
  logo: null,
  accent: 'brand',
  welcome: 'Send us a new case. We\'ll confirm it and be in touch within one working day.',
  services: ['Crown', 'Bridge', 'Veneers', 'Clear Aligners', 'Retainer', 'Night Guard', 'Full Denture'],
};

const DEFAULT_STATE = (): IntakeState => ({
  config: DEFAULT_CONFIG,
  // Only the lab admin is notified by default; others are added in Settings → Notifications.
  prefs: Object.fromEntries(LAB_TEAM.map(m => {
    const on = m.email === 'sajid@smilegenius.com';
    return [m.email, { newCase: { inApp: on, email: on }, files: { inApp: on, email: on } }];
  })),
  prefsVersion: 3,
  submissions: [],
  counter: 6,
  resetVersion: 0,
});

function load(): IntakeState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.config) {
      const d = DEFAULT_STATE();
      // v2 had one switch pair per person: carry it over to "new case", and
      // "files" starts the same. Older saves start from the admin-only default.
      const prefs = p.prefsVersion === d.prefsVersion ? p.prefs
        : p.prefsVersion === 2 ? Object.fromEntries(Object.entries(p.prefs as Record<string, IntakePrefs>).map(([e, v]) => [e, { newCase: v, files: { ...v } }]))
        : d.prefs;
      return { ...d, ...p, config: { ...DEFAULT_CONFIG, ...p.config }, prefs, prefsVersion: d.prefsVersion };
    } }
  } catch { /* corrupt or blocked */ }
  return DEFAULT_STATE();
}

let state: IntakeState = load();
const listeners = new Set<() => void>();

function commit(next: IntakeState) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* e.g. a big logo over quota: keep in memory */ }
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
export function useIntake(): IntakeState { return useSyncExternalStore(subscribe, () => state); }

export const intakeUrl = (slug: string, embed = false) => `${window.location.origin}/lablink/${slug}${embed ? '?embed=1' : ''}`;
export const embedSnippet = (slug: string, labName: string) =>
  `<iframe src="${intakeUrl(slug, true)}" title="${labName.replace(/"/g, '&quot;')}: LabLink" style="width:100%;max-width:760px;height:1100px;border:0;" loading="lazy"></iframe>`;
export const buttonSnippet = (slug: string, accent: AccentId) => {
  const a = accentFor(accent);
  return `<a href="${intakeUrl(slug)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 20px;border-radius:10px;background:linear-gradient(90deg,${a.from},${a.to});color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none;">Send us a case or files</a>`;
};

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'my-lab';

export function updateIntakeConfig(patch: Partial<IntakeConfig>) { commit({ ...state, config: { ...state.config, ...patch } }); }
const OFF: IntakePrefs = { inApp: false, email: false };
export function setIntakePref(email: string, notice: LabLinkNotice, channel: keyof IntakePrefs, value: boolean) {
  const cur = state.prefs[email] ?? { newCase: { ...OFF }, files: { ...OFF } };
  commit({ ...state, prefs: { ...state.prefs, [email]: { ...cur, [notice]: { ...cur[notice], [channel]: value } } } });
}
export const intakeEmailRecipients = (notice: LabLinkNotice = 'newCase', prefs = state.prefs) =>
  LAB_TEAM.filter(m => prefs[m.email]?.[notice]?.email).map(m => m.email);
export const getIntakeConfig = () => state.config;
/** Bump to regenerate the example requests (and their files) in browsers that already have them. */
const SEED_VERSION = 7;
export const isIntakeSeeded = () => state.seedVersion === SEED_VERSION;
/** Example requests (intakeDemo.ts): add their cases and submissions once. */
export function addSeededRequests(subs: IntakeSubmission[], cases: Case[]) {
  const have = new Set(getCreatedCases().map(c => c.id));
  [...cases].reverse().forEach(c => { if (!have.has(c.id) || state.seedVersion !== SEED_VERSION) addCreatedCase(c); });
  // Re-seeding replaces the previous examples (addCreatedCase replaces by id too).
  const refs = new Set(subs.map(s => s.ref));
  // Keep new refs after the examples' (WEB-0010), so they never collide.
  const top = Math.max(state.counter, ...subs.map(s => Number(s.ref.replace(/\D/g, '')) || 0));
  commit({ ...state, counter: top, seedVersion: SEED_VERSION, submissions: [...state.submissions.filter(s => !refs.has(s.ref)), ...subs] });
}

/** The most recent website request whose draft is still waiting in Cases. */
export function latestIntakeDraft(): IntakeSubmission | undefined {
  const drafts = new Set(getCreatedCases().filter(c => c.status === 'draft').map(c => c.id));
  return state.submissions.find(s => s.kind !== 'files' && drafts.has(s.caseId));
}
export const submissionForCase = (caseId: string) => state.submissions.find(s => s.caseId === caseId);
/** The website request behind a case: its draft, or the real case it was confirmed as. */
export const submissionBehind = (caseId: string) => state.submissions.find(s => s.kind !== 'files' && (s.caseId === caseId || s.confirmedCaseId === caseId));

/** The lab confirmed a website draft in QuickCreate, which saved it as a new case. */
export function linkConfirmedCase(draftId: string, caseId: string, by?: string) {
  commit({ ...state, submissions: state.submissions.map(s => (s.caseId === draftId ? { ...s, confirmedCaseId: caseId, confirmedAt: new Date().toISOString(), confirmedBy: by } : s)) });
}

// ── Submit ────────────────────────────────────────────────────────────────────
export interface IntakeInput {
  dentist: string; gdc: string; practice: string; postcode: string; email: string; phone: string;
  patientName: string; patientDob: string; patientRef: string;
  service: string; teeth: number[];
  material?: string; shade?: string; orderType?: string; delivery?: string; instructions?: string;
  /** Service-specific selects (retainer type, aligner duration…), by field label. */
  extras: Record<string, string>;
  files: DesignFile[];
  address?: DeliveryAddress;
  /** Made from an unmatched files request (MatchFilesPage → Create a new case). */
  fromRef?: string;
}

const isoToPortal = (iso?: string) => (iso ? portalDate(new Date(`${iso}T12:00:00`)) : null);

/** The next free WEB-#### reference (skips any already used, e.g. by the examples). */
function nextRef(): { counter: number; ref: string } {
  const used = new Set(state.submissions.map(s => s.ref));
  let counter = state.counter + 1;
  while (used.has(`WEB-${String(counter).padStart(4, '0')}`)) counter++;
  return { counter, ref: `WEB-${String(counter).padStart(4, '0')}` };
}

export function submitIntake(input: IntakeInput): IntakeSubmission {
  const { counter, ref } = nextRef();
  const caseId = `${INTAKE_ID_PREFIX}${String(Date.now()).slice(-5)}${counter}`;
  const at = new Date().toISOString();
  const today = portalDate();
  const known = mockPractices.find(p => p.name.toLowerCase() === input.practice.trim().toLowerCase());
  const practice = known?.name ?? input.practice.trim();
  // Kept exactly as typed: the sender isn't verified until the lab checks them.
  const dentist = input.dentist.trim();
  const scans = input.files.filter(f => f.kind === 'mesh' || f.kind === 'dicom').length;

  const extras = Object.entries(input.extras).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const instructions = [input.instructions?.trim(), ...extras, input.patientRef ? `Clinic patient ref: ${input.patientRef}` : '', input.patientDob ? `Patient DOB: ${isoToPortal(input.patientDob)}` : '']
    .filter(Boolean).join('\n');

  const draft: Case = {
    id: caseId,
    patientName: input.patientName.trim(),
    practice,
    dentist,
    lab: state.config.labName,
    services: [input.service],
    serviceItems: [{
      id: `${caseId}-s1`, name: input.service, status: 'submitted', deliveryDate: null,
      fdi: input.teeth, material: input.material, shade: input.shade, orderType: input.orderType,
      instructions, scanFileCount: scans, attachmentCount: input.files.length - scans,
    }],
    status: 'draft',
    createdAt: today,
    updatedAt: today,
    requestedDelivery: isoToPortal(input.delivery),
    hasAlert: false,
    // Not iTero: QuickCreate would show its scan-zip pane instead of the sender pane.
    scanner: '3Shape',
    source: 'email',
    createdBy: dentist,
    createdBySide: 'clinic',
    emailPrescription: {
      fromName: `${dentist} · ${practice}`,
      fromEmail: input.email.trim(),
      subject: `LabLink · new case · ${ref}`,
      receivedAt: 'Just now',
      attachmentName: input.files.length ? `${input.files.length} file${input.files.length === 1 ? '' : 's'} attached` : 'No files attached',
      bodyPreview: `Submitted through ${state.config.labName}'s LabLink by ${dentist} (GDC ${input.gdc || 'not given'}, ${input.phone}). Sender not verified: check their GDC registration before confirming.${known ? '' : ` New practice: "${practice}", ${input.postcode}, isn't linked yet.`}`,
    },
  };
  addCreatedCase(draft);

  const sub: IntakeSubmission = {
    caseId, ref, at, dentist, gdc: input.gdc, practice, postcode: input.postcode, email: input.email.trim(), phone: input.phone,
    address: input.address, fromRef: input.fromRef,
    patientName: draft.patientName, service: input.service, knownPractice: !!known, files: input.files, notified: intakeEmailRecipients(),
    order: {
      patientDob: input.patientDob, patientRef: input.patientRef, teeth: input.teeth, material: input.material, shade: input.shade,
      orderType: input.orderType, delivery: input.delivery, instructions: input.instructions, extras: input.extras,
    },
  };
  commit({ ...state, counter, submissions: [sub, ...state.submissions] });
  return sub;
}

// ── Files for an existing case ────────────────────────────────────────────────
export const FILES_ID_PREFIX = `${INTAKE_ID_PREFIX}F`;

export interface FilesInput {
  dentist: string; gdc: string; practice: string; postcode: string; email: string; phone: string;
  patientName: string; patientDob: string; reference: string; service: string; teeth: number[];
  comments: string; files: DesignFile[];
}

/** The draft row a not-yet-matched file submission shows as in Cases. */
export function filesDraftCase(sub: IntakeSubmission): Case {
  const f = sub.filesFor!;
  const scans = sub.files.filter(x => x.kind === 'mesh' || x.kind === 'dicom').length;
  return {
    id: sub.caseId, patientName: sub.patientName, practice: sub.practice, dentist: sub.dentist, lab: state.config.labName,
    services: ['Additional files'],
    serviceItems: [{
      id: `${sub.caseId}-s1`, name: 'Additional files', status: 'submitted', deliveryDate: null, fdi: f.teeth,
      instructions: f.comments, scanFileCount: scans, attachmentCount: sub.files.length - scans,
    }],
    status: 'draft', createdAt: portalDate(new Date(sub.at)), updatedAt: portalDate(new Date(sub.at)), requestedDelivery: null, hasAlert: false,
    scanner: '3Shape', source: 'email', createdBy: sub.dentist, createdBySide: 'clinic',
    emailPrescription: {
      fromName: `${sub.dentist} · ${sub.practice}`, fromEmail: sub.email, subject: `LabLink · files for an existing case · ${sub.ref}`,
      receivedAt: 'Just now', attachmentName: `${sub.files.length} file${sub.files.length === 1 ? '' : 's'}`,
      bodyPreview: `${sub.dentist} sent ${sub.files.length} file${sub.files.length === 1 ? '' : 's'} for ${sub.patientName}${f.reference ? ` (reference "${f.reference}")` : ''}. Match them to a case.`,
    },
  };
}

/**
 * A dentist sent files / notes for a case they've already sent. `exact` is the
 * case an exact reference matched (fileMatching.exactMatch); with one, the files
 * sync straight in, otherwise a draft row waits for the lab.
 */
export function submitFiles(input: FilesInput, exact?: Case): IntakeSubmission {
  const { counter, ref } = nextRef();
  const at = new Date().toISOString();
  const known = mockPractices.find(p => p.name.toLowerCase() === input.practice.trim().toLowerCase());
  const draftId = exact ? '' : `${FILES_ID_PREFIX}${String(Date.now()).slice(-5)}${counter}`;
  const sub: IntakeSubmission = {
    kind: 'files', ref, at,
    caseId: draftId,
    dentist: input.dentist.trim(), gdc: input.gdc, practice: known?.name ?? input.practice.trim(), postcode: input.postcode,
    email: input.email.trim(), phone: input.phone, patientName: input.patientName.trim(), service: input.service || 'Additional files',
    knownPractice: !!known, files: input.files, notified: intakeEmailRecipients('files'),
    filesFor: {
      patientDob: input.patientDob, reference: input.reference.trim(), comments: input.comments.trim(), teeth: input.teeth, draftId: draftId || undefined,
      ...(exact ? { attachedCaseId: exact.id, attachedAt: at, attachedBy: 'LabLink', matchedBy: 'reference' as const } : {}),
    },
  };
  if (!exact) addCreatedCase(filesDraftCase(sub));
  commit({ ...state, counter, submissions: [sub, ...state.submissions] });
  return sub;
}

/** The lab picked the case on the Match files screen. */
export function attachFiles(ref: string, caseId: string, by?: string) {
  const sub = state.submissions.find(s => s.ref === ref);
  if (!sub?.filesFor) return;
  if (sub.caseId) removeCreatedCases(c => c.id === sub.caseId);
  commit({ ...state, submissions: state.submissions.map(s => (s.ref === ref ? { ...s, caseId: '', filesFor: { ...s.filesFor!, attachedCaseId: caseId, attachedAt: new Date().toISOString(), attachedBy: by, matchedBy: 'lab' } } : s)) });
}

/** Not a match for any case: drop the draft row, keep the request in the log. */
export function dismissFiles(ref: string) {
  const sub = state.submissions.find(s => s.ref === ref);
  if (!sub?.filesFor) return;
  if (sub.caseId) removeCreatedCases(c => c.id === sub.caseId);
  commit({ ...state, submissions: state.submissions.map(s => (s.ref === ref ? { ...s, caseId: '', filesFor: { ...s.filesFor!, dismissedAt: new Date().toISOString() } } : s)) });
}

/**
 * The lab couldn't find the case these files belong to (Match files → Create
 * a new case): turn them into a LabLink new-case draft, prefilled with what
 * was sent. The files request is kept and marked as converted.
 */
export function convertFilesToCase(ref: string): IntakeSubmission | undefined {
  const sub = state.submissions.find(s => s.ref === ref);
  if (!sub?.filesFor) return undefined;
  const f = sub.filesFor;
  const service = sub.service.startsWith('Other') ? 'Other' : sub.service === 'Additional files' ? 'Other' : sub.service;
  const draft = submitIntake({
    dentist: sub.dentist, gdc: sub.gdc, practice: sub.practice, postcode: sub.postcode, email: sub.email, phone: sub.phone,
    patientName: sub.patientName, patientDob: f.patientDob, patientRef: f.reference,
    service, teeth: f.teeth, instructions: f.comments,
    extras: sub.service.startsWith('Other: ') ? { 'Requested item': sub.service.slice(7) } : {},
    files: sub.files, fromRef: sub.ref,
  });
  if (sub.caseId) removeCreatedCases(c => c.id === sub.caseId);
  commit({ ...state, submissions: state.submissions.map(s => (s.ref === ref ? { ...s, caseId: '', filesFor: { ...s.filesFor!, convertedTo: draft.caseId, convertedRef: draft.ref } } : s)) });
  return draft;
}

export const filesSubmissionForDraft = (caseId: string) => state.submissions.find(s => s.kind === 'files' && (s.caseId === caseId || s.filesFor?.draftId === caseId));

/** Everything LabLink has added to a case: the new-case request it came from, and files sent later. */
export function labLinkForCase(caseId: string): IntakeSubmission[] {
  return state.submissions.filter(s => s.confirmedCaseId === caseId || s.filesFor?.attachedCaseId === caseId);
}

/** A website draft the lab confirmed through QuickCreate (saved as a new case). */
export function removeIntakeDraft(caseId: string) {
  if (caseId.startsWith(INTAKE_ID_PREFIX)) removeCreatedCases(c => c.id === caseId);
}

export function resetIntakeDemo() {
  const confirmed = new Set(state.submissions.map(s => s.confirmedCaseId).filter(Boolean));
  // FILES_ID_PREFIX shares INTAKE_ID_PREFIX, so file drafts go too.
  removeCreatedCases(c => c.id.startsWith(INTAKE_ID_PREFIX) || confirmed.has(c.id));
  commit({ ...DEFAULT_STATE(), resetVersion: state.resetVersion + 1 });
}

// ── Bell ─────────────────────────────────────────────────────────────────────
// In-app is a per-user preference: the bell belongs to whoever is signed in,
// so entries appear when they've opted in and are removed when they opt out.
// New-case requests use `web-…` ids, files for existing cases `lf-…`.
function dropBell(prefix: string) {
  for (let i = MOCK_NOTIFICATIONS.length - 1; i >= 0; i--) if (MOCK_NOTIFICATIONS[i].id.startsWith(prefix)) MOCK_NOTIFICATIONS.splice(i, 1);
}

export function syncIntakeNotifications(me?: string) {
  const p = me ? state.prefs[me] : undefined;
  if (!p?.newCase.inApp) dropBell('web-');
  if (!p?.files.inApp) dropBell('lf-');
  const n = (k: number) => `${k} file${k === 1 ? '' : 's'}`;
  [...state.submissions].reverse().forEach(s => {
    const files = s.kind === 'files';
    if (files ? !p?.files.inApp : !p?.newCase.inApp) return;
    const id = files ? `lf-${s.ref}` : `web-${s.caseId}`;
    if (MOCK_NOTIFICATIONS.some(x => x.id === id)) return;
    const f = s.filesFor;
    MOCK_NOTIFICATIONS.unshift({
      id,
      title: !files ? `New case request on LabLink: ${s.ref}`
        : f?.matchedBy === 'reference' ? `${n(s.files.length)} added to ${f.attachedCaseId} via LabLink`
        : `Files to match from ${s.dentist}: ${s.ref}`,
      body: !files
        ? `${s.dentist} (${s.practice}) sent a ${s.service} case${s.files.length ? ` with ${n(s.files.length)}` : ''}. A draft is waiting in Cases for you to check and confirm.${s.knownPractice ? '' : ' New practice, not linked yet.'}`
        : f?.matchedBy === 'reference'
          ? `${s.dentist} sent ${n(s.files.length)} for ${s.patientName} with reference ${f.reference}. They're in the case's attachments.${f.comments ? ` Note: "${f.comments.slice(0, 90)}${f.comments.length > 90 ? '…' : ''}"` : ''}`
          : `${s.dentist} (${s.practice}) sent ${n(s.files.length)} for "${s.patientName}" without a matching reference. A draft in Cases suggests the likely case.`,
      timestamp: portalDateTime(s.at),
      read: false,
    });
  });
}
