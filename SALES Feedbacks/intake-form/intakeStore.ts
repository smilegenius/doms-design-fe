import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { addCreatedCase, removeCreatedCases } from '../../src/app/data/createdCases';
import { mockPractices } from '../../src/app/data/clinicsData';
import { MOCK_NOTIFICATIONS } from '../../src/app/pages/NotificationsPage';
import type { DesignFile } from '../design-studio/data/designStudio';
import { LAB_NAME, LAB_TEAM, portalDate, portalDateTime } from '../lab-prescription-inbox/data';

// ── Lab website intake form ──────────────────────────────────────────────────
// Each lab gets a branded, embeddable form. A dentist's submission becomes a
// draft case (status 'draft') in the shared created-cases store, so it shows
// in the real Cases list and opens in the real QuickCreate for the lab to
// check and confirm, exactly like the email-inbox drafts.

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
}

export interface IntakePrefs { inApp: boolean; email: boolean }

interface IntakeState {
  config: IntakeConfig;
  prefs: Record<string, IntakePrefs>;
  submissions: IntakeSubmission[];
  counter: number;
  resetVersion: number;
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
  prefs: Object.fromEntries(LAB_TEAM.map(m => [m.email, { inApp: true, email: m.email === 'sajid@smilegenius.com' }])),
  submissions: [],
  counter: 6,
  resetVersion: 0,
});

function load(): IntakeState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.config) return { ...DEFAULT_STATE(), ...p, config: { ...DEFAULT_CONFIG, ...p.config } }; }
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

export const intakeUrl = (slug: string, embed = false) => `${window.location.origin}/intake/${slug}${embed ? '?embed=1' : ''}`;
export const embedSnippet = (slug: string, labName: string) =>
  `<iframe src="${intakeUrl(slug, true)}" title="${labName.replace(/"/g, '&quot;')}: new case" style="width:100%;max-width:760px;height:1100px;border:0;" loading="lazy"></iframe>`;
export const buttonSnippet = (slug: string, accent: AccentId) => {
  const a = accentFor(accent);
  return `<a href="${intakeUrl(slug)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 20px;border-radius:10px;background:linear-gradient(90deg,${a.from},${a.to});color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none;">Send us a case</a>`;
};

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'my-lab';

export function updateIntakeConfig(patch: Partial<IntakeConfig>) { commit({ ...state, config: { ...state.config, ...patch } }); }
export function setIntakePref(email: string, channel: keyof IntakePrefs, value: boolean) {
  const cur = state.prefs[email] ?? { inApp: false, email: false };
  commit({ ...state, prefs: { ...state.prefs, [email]: { ...cur, [channel]: value } } });
}
export const intakeEmailRecipients = (prefs = state.prefs) => LAB_TEAM.filter(m => prefs[m.email]?.email).map(m => m.email);
export const submissionForCase = (caseId: string) => state.submissions.find(s => s.caseId === caseId);

// ── Submit ────────────────────────────────────────────────────────────────────
export interface IntakeInput {
  dentist: string; gdc: string; practice: string; postcode: string; email: string; phone: string;
  patientName: string; patientDob: string; patientRef: string;
  service: string; teeth: number[];
  material?: string; shade?: string; orderType?: string; delivery?: string; instructions?: string;
  /** Service-specific selects (retainer type, aligner duration…), by field label. */
  extras: Record<string, string>;
  files: DesignFile[];
}

const withDr = (n: string) => (/^dr\.?\s/i.test(n.trim()) ? n.trim().replace(/^dr\.?\s*/i, 'Dr. ') : `Dr. ${n.trim()}`);
const isoToPortal = (iso?: string) => (iso ? portalDate(new Date(`${iso}T12:00:00`)) : null);

export function submitIntake(input: IntakeInput): IntakeSubmission {
  const counter = state.counter + 1;
  const ref = `WEB-${String(counter).padStart(4, '0')}`;
  const caseId = `${INTAKE_ID_PREFIX}${String(Date.now()).slice(-5)}${counter}`;
  const at = new Date().toISOString();
  const today = portalDate();
  const known = mockPractices.find(p => p.name.toLowerCase() === input.practice.trim().toLowerCase());
  const practice = known?.name ?? input.practice.trim();
  const dentist = withDr(input.dentist);
  const scans = input.files.filter(f => f.kind === 'mesh' || f.kind === 'dicom').length;

  const extras = Object.entries(input.extras).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const instructions = [input.instructions?.trim(), ...extras, input.patientRef ? `Clinic patient ref: ${input.patientRef}` : '', `Patient DOB: ${isoToPortal(input.patientDob)}`]
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
      subject: `Website intake form · ${ref}`,
      receivedAt: 'Just now',
      attachmentName: input.files.length ? `${input.files.length} file${input.files.length === 1 ? '' : 's'} attached` : 'No files attached',
      bodyPreview: `Submitted through ${state.config.labName}'s website intake form by ${dentist} (GDC ${input.gdc || 'not given'}, ${input.phone}).${known ? '' : ` New practice: "${practice}", ${input.postcode}, isn't linked yet.`}`,
    },
  };
  addCreatedCase(draft);

  const sub: IntakeSubmission = {
    caseId, ref, at, dentist, gdc: input.gdc, practice, postcode: input.postcode, email: input.email.trim(), phone: input.phone,
    patientName: draft.patientName, service: input.service, knownPractice: !!known, files: input.files, notified: intakeEmailRecipients(),
  };
  commit({ ...state, counter, submissions: [sub, ...state.submissions] });
  return sub;
}

/** A website draft the lab confirmed through QuickCreate (saved as a new case). */
export function removeIntakeDraft(caseId: string) {
  if (caseId.startsWith(INTAKE_ID_PREFIX)) removeCreatedCases(c => c.id === caseId);
}

export function resetIntakeDemo() {
  removeCreatedCases(c => c.id.startsWith(INTAKE_ID_PREFIX));
  commit({ ...DEFAULT_STATE(), resetVersion: state.resetVersion + 1 });
}

// ── Bell ─────────────────────────────────────────────────────────────────────
// In-app is a per-user preference; the prototype's bell belongs to whoever is
// signed in, so it follows the demo account (Sajid).
export function syncIntakeNotifications(me = 'sajid@smilegenius.com') {
  if (state.prefs[me]?.inApp === false) return;
  [...state.submissions].reverse().forEach(s => {
    const id = `web-${s.caseId}`;
    if (MOCK_NOTIFICATIONS.some(n => n.id === id)) return;
    MOCK_NOTIFICATIONS.unshift({
      id,
      title: `New case request from your website: ${s.ref}`,
      body: `${s.dentist} (${s.practice}) sent a ${s.service} case${s.files.length ? ` with ${s.files.length} file${s.files.length === 1 ? '' : 's'}` : ''}. A draft is waiting in Cases for you to check and confirm.${s.knownPractice ? '' : ' New practice, not linked yet.'}`,
      timestamp: portalDateTime(s.at),
      read: false,
    });
  });
}
