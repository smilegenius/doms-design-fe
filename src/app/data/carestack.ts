import { useSyncExternalStore } from 'react';
import type { Case } from '../pages/CasesPage';
import { markCommunicationSent, recordCommunication, removeCareStackCommunications } from './caseCommunications';
import type { CaseCommunication } from './caseCommunications';

// ─── CareStack integration ───────────────────────────────────────────────────
// CareStack is the practice-management system a dental group (DSO) may run.
// When the group's Smile Genius admin enables the integration, every Lab Work
// case created by one of the group's clinics is validated against CareStack
// (patient / provider / location), its CareStack appointment is looked up and
// linked, and lab-work milestones (accepted, shipped, received, due-date
// changes) are mirrored onto that appointment as timestamped notes — plus the
// practice is emailed. This module is the prototype's stand-in for all of it:
//
//   • settings   — the ONE enable flag (set by the admin toggle or the demo
//                  flow card), connection + last-sync stamps.
//   • directory  — a small mock of CareStack's locations / providers /
//                  patients / appointments, used for exact (one-to-one)
//                  matching. V1 never fuzzy-matches and never creates patients.
//   • per-case   — mapping status for the three entities, the appointment
//                  state, and the milestone records (shipment, receipt…).
//   • log        — every sync action, timestamped, for the audit trail shown
//                  on the case.
//   • due dates  — flag-independent history of lab due-date changes (the
//                  cases list shows a "Changed" marker off this).
//
// localStorage-backed like the rest of the prototype's user-made data.

// ─── Types ───────────────────────────────────────────────────────────────────

export type CaseLike = Pick<
  Case,
  'id' | 'patientName' | 'practice' | 'dentist' | 'lab' | 'services' | 'createdAt' | 'requestedDelivery' | 'status'
> & { source?: string; scanner?: string };

export interface CareStackSettings {
  enabled: boolean;
  connection: 'connected' | 'disconnected';
  lastSyncAt: string | null; // ISO
  orgId: string;
}

export interface CsLocation {
  id: string;
  name: string;
  address: string;
  /** Smile Genius practice this location is mapped to — null = CareStack-only. */
  sgPracticeName: string | null;
  practiceManager: { name: string; email: string };
  receptionist: { name: string; email: string };
}

export interface CsProvider {
  id: string;
  name: string;
  /** Location this provider record belongs to — '*' = every group location. */
  locationId: string;
  active: boolean;
  /** Smile Genius dentist this provider is mapped to (by name). */
  sgName: string | null;
}

export interface CsPatient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // DD-MMM-YYYY
  locationId: string;
}

export interface CsAppointment {
  id: string;
  patientId: string;
  providerId: string;
  locationId: string;
  startsAt: string; // ISO local
  durationMin: number;
  type: string;
}

export type EntityStatus = 'idle' | 'checking' | 'matched' | 'not-found';
export interface EntityMapping {
  status: EntityStatus;
  csId?: string;
  csLabel?: string;
  /** Why it could not be mapped. */
  reason?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export type AppointmentState = 'blocked' | 'searching' | 'linked' | 'required' | 'not-required';

export interface CaseCareStack {
  caseId: string;
  patient: EntityMapping;
  dentist: EntityMapping;
  practice: EntityMapping;
  appointment: {
    state: AppointmentState;
    appointmentId?: string;
    /** Ambiguous lookups keep the candidates for the Link-existing flow only. */
    candidateIds?: string[];
    /** 'none' | 'ambiguous' — why the lookup ended at Appointment Required. */
    requiredReason?: 'none' | 'ambiguous';
    createdBySg?: boolean;
    linkedBy?: string;
    linkedAt?: string;
    notRequired?: { reason: string; by: string; at: string };
  };
  acceptedAt?: string;
  shipment?: {
    shipmentDate: string;
    courier: string;
    trackingNumber: string;
    trackingUrl?: string;
    expectedDelivery: string;
    by: string;
    at: string;
  };
  receipt?: { receivedAt: string; receivedBy: string; notes?: string; at: string };
  /** The queued end-of-day "Appointment Required" email. */
  digest?: { commId: string; queuedAt: string; sentAt?: string };
  validatedAt?: string;
}

export type LogKind = 'validation' | 'appointment' | 'note' | 'email' | 'due-date' | 'shipment' | 'receipt' | 'sync';
export type LogOutcome = 'ok' | 'skipped' | 'failed' | 'queued';
export interface CareStackLogEntry {
  id: string;
  caseId: string; // '' for group-level entries (sync)
  at: string; // ISO
  kind: LogKind;
  outcome: LogOutcome;
  text: string;
  detail?: string;
  by?: string;
}

export interface DueDateChange {
  caseId: string;
  previous: string | null;
  next: string;
  reason?: string;
  by: string;
  at: string; // ISO
}

export type CareStackEmailEvent = 'appointment-required' | 'due-date-changed' | 'accepted' | 'shipped' | 'received';

// ─── Mock CareStack directory ────────────────────────────────────────────────

export const APPOINTMENT_TYPES = ['Lab Work Fit', 'Crown Fit', 'Try-in', 'Review', 'Denture Delivery', 'Aligner Check'];
export const COURIERS = ['Royal Mail', 'DPD', 'DHL Express', 'UPS', 'Evri', 'Other'];

export const CS_LOCATIONS: CsLocation[] = [
  { id: 'CS-LOC-1001', name: 'Smile Genius Manchester', address: '12 Deansgate, Manchester M3 2BW', sgPracticeName: 'Smile Genius Manchester', practiceManager: { name: "James O'Connor", email: 'james.oconnor@smilegenius.com' }, receptionist: { name: 'Priya Nair', email: 'reception.manchester@smilegenius.com' } },
  { id: 'CS-LOC-1002', name: 'Smile Genius London Central', address: '48 Harley Street, London W1G 9PW', sgPracticeName: 'Smile Genius London Central', practiceManager: { name: 'Hannah Clarke', email: 'hannah.clarke@smilegenius.com' }, receptionist: { name: 'Tom Ellis', email: 'reception.london@smilegenius.com' } },
  { id: 'CS-LOC-1003', name: 'Smile Genius Belfast', address: '5 Donegall Square, Belfast BT1 5GS', sgPracticeName: 'Smile Genius Belfast', practiceManager: { name: 'Aoife Byrne', email: 'aoife.byrne@smilegenius.com' }, receptionist: { name: 'Conor Walsh', email: 'reception.belfast@smilegenius.com' } },
  { id: 'CS-LOC-1004', name: 'Smile Genius Leeds', address: '20 Park Row, Leeds LS1 5JF', sgPracticeName: 'Smile Genius Leeds', practiceManager: { name: 'Sarah Whitaker', email: 'sarah.whitaker@smilegenius.com' }, receptionist: { name: 'Ben Ford', email: 'reception.leeds@smilegenius.com' } },
  { id: 'CS-LOC-1005', name: 'Smile Genius Birmingham 1', address: '3 Colmore Row, Birmingham B3 2BJ', sgPracticeName: 'Smile Genius Birmingham 1', practiceManager: { name: 'Daniel Osei', email: 'daniel.osei@smilegenius.com' }, receptionist: { name: 'Leah Price', email: 'reception.bham1@smilegenius.com' } },
  { id: 'CS-LOC-1006', name: 'Smile Genius Birmingham 2', address: '77 Hagley Road, Birmingham B16 8QG', sgPracticeName: 'Smile Genius Birmingham 2', practiceManager: { name: 'Meera Shah', email: 'meera.shah@smilegenius.com' }, receptionist: { name: 'Owen Reid', email: 'reception.bham2@smilegenius.com' } },
  { id: 'CS-LOC-1007', name: 'Smile Genius Glasgow', address: '101 Buchanan Street, Glasgow G1 3HF', sgPracticeName: 'Smile Genius Glasgow', practiceManager: { name: 'Fiona Ross', email: 'fiona.ross@smilegenius.com' }, receptionist: { name: 'Callum Gray', email: 'reception.glasgow@smilegenius.com' } },
  { id: 'CS-LOC-1008', name: 'Smile Genius Bristol', address: '9 Queen Square, Bristol BS1 4JQ', sgPracticeName: 'Smile Genius Bristol', practiceManager: { name: 'Rachel Moore', email: 'rachel.moore@smilegenius.com' }, receptionist: { name: 'Sam Hale', email: 'reception.bristol@smilegenius.com' } },
  // CareStack-only — no Smile Genius practice mapped to it yet.
  { id: 'CS-LOC-1009', name: 'Smile Genius Salford', address: '14 Chapel Street, Salford M3 7AA', sgPracticeName: null, practiceManager: { name: 'Nina Patel', email: 'nina.patel@smilegenius.com' }, receptionist: { name: 'Ade Okafor', email: 'reception.salford@smilegenius.com' } },
];

export const CS_PROVIDERS: CsProvider[] = [
  { id: 'CS-PRV-2001', name: 'Dr. Webb',      locationId: '*',           active: true,  sgName: 'Dr. Webb' },
  { id: 'CS-PRV-2002', name: 'Dr. Davies',    locationId: '*',           active: true,  sgName: 'Dr. Davies' },
  { id: 'CS-PRV-2003', name: 'Sophie Wilson', locationId: 'CS-LOC-1001', active: true,  sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2007', name: 'Sophie Wilson', locationId: 'CS-LOC-1003', active: false, sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2008', name: 'Sophie Wilson', locationId: 'CS-LOC-1002', active: true,  sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2009', name: 'Sophie Wilson', locationId: 'CS-LOC-1005', active: true,  sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2010', name: 'Sophie Wilson', locationId: 'CS-LOC-1006', active: true,  sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2011', name: 'Sophie Wilson', locationId: 'CS-LOC-1007', active: true,  sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2012', name: 'Sophie Wilson', locationId: 'CS-LOC-1004', active: true,  sgName: 'Sophie Wilson' },
  { id: 'CS-PRV-2004', name: 'Dr. Sharma',    locationId: '*',           active: true,  sgName: 'Dr. Sharma' },
  { id: 'CS-PRV-2005', name: 'Dr. Whitfield', locationId: '*',           active: true,  sgName: null },
  { id: 'CS-PRV-2006', name: 'Dr. Hartwell',  locationId: '*',           active: false, sgName: null },
  { id: 'CS-PRV-2013', name: 'Dr. White',     locationId: '*',           active: true,  sgName: 'Dr. White' },
  { id: 'CS-PRV-2014', name: 'Dr. Murphy',    locationId: '*',           active: true,  sgName: 'Dr. Murphy' },
  { id: 'CS-PRV-2015', name: 'Dr. Anderson',  locationId: '*',           active: true,  sgName: 'Dr. Anderson' },
  { id: 'CS-PRV-2016', name: 'Dr. Campbell',  locationId: '*',           active: true,  sgName: 'Dr. Campbell' },
  { id: 'CS-PRV-2017', name: 'Dr. Evans',     locationId: '*',           active: false, sgName: 'Dr. Evans' },
];

export const CS_PATIENTS: CsPatient[] = [
  { id: 'CS-PAT-30011', firstName: 'Isabella', lastName: 'Hughes',         dob: '14-Mar-1992', locationId: 'CS-LOC-1001' },
  { id: 'CS-PAT-30019', firstName: 'Isabella', lastName: 'Hughes-Barrett', dob: '14-Mar-1991', locationId: 'CS-LOC-1001' },
  { id: 'CS-PAT-30042', firstName: 'Marcus',   lastName: 'Reed',           dob: '02-Nov-1985', locationId: 'CS-LOC-1001' },
  { id: 'CS-PAT-30077', firstName: 'Lucas',    lastName: 'Brown',          dob: '21-Jul-1978', locationId: 'CS-LOC-1003' },
  { id: 'CS-PAT-30080', firstName: 'Lucas',    lastName: 'Browne',         dob: '09-Feb-1990', locationId: 'CS-LOC-1003' },
  { id: 'CS-PAT-30095', firstName: 'Nadia',    lastName: 'Farrell',        dob: '30-Aug-1996', locationId: 'CS-LOC-1001' },
  { id: 'CS-PAT-30102', firstName: 'Grace',    lastName: 'Bennett',        dob: '11-Jan-1988', locationId: 'CS-LOC-1002' },
];

export const CS_APPOINTMENTS: CsAppointment[] = [
  { id: 'CS-APT-7701', patientId: 'CS-PAT-30011', providerId: 'CS-PRV-2001', locationId: 'CS-LOC-1001', startsAt: '2026-05-21T09:30:00', durationMin: 40, type: 'Crown Fit' },
  { id: 'CS-APT-7745', patientId: 'CS-PAT-30011', providerId: 'CS-PRV-2001', locationId: 'CS-LOC-1001', startsAt: '2026-05-29T14:00:00', durationMin: 40, type: 'Crown Fit' },
  { id: 'CS-APT-7760', patientId: 'CS-PAT-30042', providerId: 'CS-PRV-2001', locationId: 'CS-LOC-1001', startsAt: '2026-05-27T10:00:00', durationMin: 30, type: 'Try-in' },
  { id: 'CS-APT-7761', patientId: 'CS-PAT-30042', providerId: 'CS-PRV-2001', locationId: 'CS-LOC-1001', startsAt: '2026-05-27T15:30:00', durationMin: 30, type: 'Review' },
  { id: 'CS-APT-7790', patientId: 'CS-PAT-30077', providerId: 'CS-PRV-2002', locationId: 'CS-LOC-1003', startsAt: '2026-06-08T11:00:00', durationMin: 30, type: 'Review' },
];

// Appointments Smile Genius created (Create New) — kept apart so the seed list
// above stays static.
let createdAppointments: CsAppointment[] = [];

export function locationById(id?: string) { return CS_LOCATIONS.find(l => l.id === id); }
export function providerById(id?: string) { return CS_PROVIDERS.find(p => p.id === id); }
export function patientById(id?: string) { return CS_PATIENTS.find(p => p.id === id); }
export function appointmentById(id?: string) {
  return [...CS_APPOINTMENTS, ...createdAppointments].find(a => a.id === id);
}
export function locationForPractice(practice: string) {
  return CS_LOCATIONS.find(l => l.sgPracticeName === practice);
}
/** Providers a case at `locationId` can be matched to / pick from. */
export function providersAtLocation(locationId?: string): CsProvider[] {
  return CS_PROVIDERS.filter(p => p.locationId === '*' || (locationId != null && p.locationId === locationId));
}
export function mappedActiveProviders(locationId?: string): CsProvider[] {
  return providersAtLocation(locationId).filter(p => p.active && p.sgName);
}
export function mappedLocations(): CsLocation[] {
  return CS_LOCATIONS.filter(l => l.sgPracticeName);
}
export function searchCsPatients(q: string, locationId?: string): CsPatient[] {
  const needle = q.trim().toLowerCase();
  return CS_PATIENTS.filter(p => {
    const full = `${p.firstName} ${p.lastName}`.toLowerCase();
    const sameLoc = !locationId || p.locationId === locationId;
    return sameLoc && (!needle || full.includes(needle) || p.id.toLowerCase().includes(needle) || needle.split(/\s+/).every(t => full.includes(t)));
  });
}
export function searchCsProviders(q: string, locationId?: string): CsProvider[] {
  const needle = q.trim().toLowerCase().replace(/^dr\.?\s*/, '');
  return providersAtLocation(locationId).filter(p => !needle || p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle));
}
export function appointmentsForPatient(patientId?: string): CsAppointment[] {
  if (!patientId) return [];
  return [...CS_APPOINTMENTS, ...createdAppointments]
    .filter(a => a.patientId === patientId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const p2 = (n: number) => String(n).padStart(2, '0');

/** 'DD-MMM-YYYY' → Date (local midnight), or null. */
export function parseDmy(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split('-');
  const mi = MONTHS.indexOf(m as typeof MONTHS[number]);
  if (mi < 0 || !d || !y) return null;
  return new Date(Number(y), mi, Number(d));
}
export function toDmy(d: Date): string {
  return `${p2(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}
/** ISO → 'DD-MMM-YYYY HH:mm' (the stamp format the rest of the app uses). */
export function formatStamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${toDmy(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
/** ISO → 'Thu 21 May 2026 · 09:30' for appointment cards. */
export function formatAppointmentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${day} ${p2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function caseLink(caseId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/clinic/cases/${encodeURIComponent(caseId)}`;
}
function nowIso() { return new Date().toISOString(); }

// ─── Stores ──────────────────────────────────────────────────────────────────

const LS_SETTINGS = 'carestack.settings';
const LS_CASES = 'carestack.cases';
const LS_LOG = 'carestack.log';
const LS_DUE = 'cases.dueDateChanges';

const DEFAULT_SETTINGS: CareStackSettings = {
  enabled: false,
  connection: 'connected',
  lastSyncAt: '2026-05-19T06:00:00.000Z',
  orgId: 'org-dso-1',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked — keep in-memory */ }
}

// Seeded due-date changes so the "Changed" marker is visible without the
// integration being on (the lab moved these dates before the demo starts).
const SEED_DUE_DATE_CHANGES: DueDateChange[] = [
  { caseId: 'CASE-RS-2003', previous: '24-May-2026', next: '26-May-2026', reason: 'Material back-order — zirconia disc', by: 'Smile Genius Lab', at: '2026-05-15T10:20:00.000Z' },
  { caseId: 'CASE-003',     previous: '25-May-2026', next: '30-May-2026', reason: 'Lab capacity — remake required',     by: 'Kingsbridge Dental Lab', at: '2026-05-12T15:05:00.000Z' },
];

let settings: CareStackSettings = { ...DEFAULT_SETTINGS, ...loadJson<Partial<CareStackSettings>>(LS_SETTINGS, {}) };
let cases: Record<string, CaseCareStack> = normaliseCases(loadJson<Record<string, CaseCareStack>>(LS_CASES, {}));
let log: CareStackLogEntry[] = loadJson<CareStackLogEntry[]>(LS_LOG, []);
let dueDateChanges: DueDateChange[] = loadJson<DueDateChange[] | null>(LS_DUE, null) ?? SEED_DUE_DATE_CHANGES;

// A refresh mid-lookup must not leave a spinner stuck on — transient states
// fall back to their resting state and re-run on the next open.
function normaliseCases(input: Record<string, CaseCareStack>): Record<string, CaseCareStack> {
  const out: Record<string, CaseCareStack> = {};
  for (const [id, rec] of Object.entries(input)) {
    const fix = (m: EntityMapping): EntityMapping => (m.status === 'checking' ? { status: 'idle' } : m);
    out[id] = {
      ...rec,
      patient: fix(rec.patient),
      dentist: fix(rec.dentist),
      practice: fix(rec.practice),
      appointment: rec.appointment.state === 'searching' ? { state: 'blocked' } : rec.appointment,
    };
  }
  return out;
}

const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

function commitSettings(next: CareStackSettings) { settings = next; saveJson(LS_SETTINGS, next); emit(); }
function commitCases(next: Record<string, CaseCareStack>) { cases = next; saveJson(LS_CASES, next); emit(); }
function commitLog(next: CareStackLogEntry[]) { log = next; saveJson(LS_LOG, next); emit(); }
function commitDue(next: DueDateChange[]) { dueDateChanges = next; saveJson(LS_DUE, next); emit(); }

let seq = 0;
function addLog(entry: Omit<CareStackLogEntry, 'id' | 'at'> & { at?: string }): CareStackLogEntry {
  const rec: CareStackLogEntry = { ...entry, id: `cs-log-${Date.now()}-${++seq}`, at: entry.at ?? nowIso() };
  commitLog([...log, rec]);
  return rec;
}
function patchCase(caseId: string, patch: Partial<CaseCareStack> | ((prev: CaseCareStack) => Partial<CaseCareStack>)) {
  const prev = cases[caseId];
  if (!prev) return;
  const p = typeof patch === 'function' ? patch(prev) : patch;
  commitCases({ ...cases, [caseId]: { ...prev, ...p } });
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getCareStackSettings() { return settings; }
export function setCareStackEnabled(on: boolean) {
  if (settings.enabled === on) return;
  commitSettings({ ...settings, enabled: on });
  addLog({ caseId: '', kind: 'sync', outcome: 'ok', text: on ? 'CareStack integration enabled for Smile Genius Group' : 'CareStack integration disabled for Smile Genius Group' });
}
export function useCareStackSettings(): CareStackSettings {
  return useSyncExternalStore(subscribe, getCareStackSettings);
}
export function useCareStackEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => settings.enabled);
}
let syncing = false;
export function isSyncing() { return syncing; }
export function simulateSync(): Promise<void> {
  if (syncing) return Promise.resolve();
  syncing = true;
  emit();
  return new Promise(resolve => {
    setTimeout(() => {
      syncing = false;
      commitSettings({ ...settings, connection: 'connected', lastSyncAt: nowIso() });
      addLog({ caseId: '', kind: 'sync', outcome: 'ok', text: `Master data synchronised — ${CS_LOCATIONS.length} locations, ${CS_PROVIDERS.length} providers, ${CS_PATIENTS.length.toLocaleString()} patients` });
      resolve();
    }, 1200);
  });
}
export function useCareStackSyncing(): boolean {
  return useSyncExternalStore(subscribe, () => syncing);
}

/**
 * Demo reset — forget every per-case CareStack result, the sync log, the
 * notifications it raised and any due-date changes made during the demo, so
 * the walkthrough can be replayed from the top. The enable flag is kept.
 */
export function resetCareStackDemo() {
  validationTimers.forEach(t => window.clearTimeout(t));
  validationTimers.clear();
  createdAppointments = [];
  commitCases({});
  commitLog([]);
  commitDue(SEED_DUE_DATE_CHANGES);
  removeCareStackCommunications();
}

// ── Reads ────────────────────────────────────────────────────────────────────
export function getCaseCareStack(caseId: string): CaseCareStack | undefined { return cases[caseId]; }
export function useCaseCareStack(caseId: string): CaseCareStack | undefined {
  return useSyncExternalStore(subscribe, () => cases[caseId]);
}
export function useAllCaseCareStack(): Record<string, CaseCareStack> {
  return useSyncExternalStore(subscribe, () => cases);
}
export function getCareStackLog() { return log; }
export function useCareStackLog(caseId?: string): CareStackLogEntry[] {
  const all = useSyncExternalStore(subscribe, getCareStackLog);
  return caseId === undefined ? all : all.filter(e => e.caseId === caseId);
}
export function getDueDateChanges() { return dueDateChanges; }
export function useDueDateChanges(): DueDateChange[] {
  return useSyncExternalStore(subscribe, getDueDateChanges);
}
export function latestDueDateChange(caseId: string, all: DueDateChange[] = dueDateChanges): DueDateChange | undefined {
  let best: DueDateChange | undefined;
  for (const c of all) if (c.caseId === caseId && (!best || c.at > best.at)) best = c;
  return best;
}
export function hasReceipt(caseId: string) { return !!cases[caseId]?.receipt; }
export function hasShipment(caseId: string) { return !!cases[caseId]?.shipment; }

// ─── Validation (entity mapping) ─────────────────────────────────────────────

// Purpose-built outcomes for the demo cases — everything else resolves from
// the directory (exact, one-to-one). Keyed by case id.
interface DemoOverride {
  patient?: EntityMapping;
  dentist?: EntityMapping;
  /** Seed the appointment as already linked (the lookup ran at creation). */
  linkedAppointmentId?: string;
}
const DEMO_OVERRIDES: Record<string, DemoOverride> = {
  'CASE-RS-2001': { linkedAppointmentId: 'CS-APT-7701' },
  'CASE-RS-2002': {
    patient: {
      status: 'not-found',
      reason: "No exact match for 'Isabella Hughes' — iTero sent DOB 14-Mar-1991; CareStack holds 14-Mar-1992. Nearest record: Isabella Hughes-Barrett (CS-PAT-30019).",
    },
  },
};

function hashName(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}

function resolvePatient(c: CaseLike, loc?: CsLocation): EntityMapping {
  const [first, ...rest] = c.patientName.trim().split(/\s+/);
  const last = rest.join(' ');
  const hit = CS_PATIENTS.find(p => p.firstName.toLowerCase() === first?.toLowerCase() && p.lastName.toLowerCase() === last.toLowerCase());
  if (hit) return { status: 'matched', csId: hit.id, csLabel: `${hit.firstName} ${hit.lastName} · DOB ${hit.dob}` };
  // The directory above is a slice of CareStack's patient base — everyone
  // else resolves to a stable synthetic id so the demo list isn't a wall of
  // red crosses.
  if (loc) return { status: 'matched', csId: `CS-PAT-${30000 + hashName(c.patientName) % 60000}`, csLabel: c.patientName };
  return { status: 'not-found', reason: `Cannot search patients — '${c.practice}' is not mapped to a CareStack location.` };
}

function resolveDentist(c: CaseLike, loc?: CsLocation): EntityMapping {
  const name = c.dentist.trim().toLowerCase();
  const matches = providersAtLocation(loc?.id).filter(p => p.name.toLowerCase() === name);
  const active = matches.find(p => p.active && p.sgName);
  if (active) return { status: 'matched', csId: active.id, csLabel: `${active.name}${active.active ? ' · Active' : ''}` };
  const inactive = matches.find(p => !p.active);
  if (inactive) return { status: 'not-found', reason: `'${c.dentist}' matched CareStack provider ${inactive.id}, but the provider is inactive at ${loc?.name ?? 'this location'}.` };
  const unmapped = matches[0];
  if (unmapped) return { status: 'not-found', reason: `CareStack provider ${unmapped.id} (${unmapped.name}) is not mapped to a Smile Genius dentist. Ask your DSO admin to map it.` };
  return { status: 'not-found', reason: `No CareStack provider named '${c.dentist}'${loc ? ` at ${loc.name}` : ''}.` };
}

function resolvePractice(c: CaseLike, loc?: CsLocation): EntityMapping {
  if (loc) return { status: 'matched', csId: loc.id, csLabel: loc.name };
  return { status: 'not-found', reason: `No CareStack location is mapped to '${c.practice}'. Location mapping is managed at group level by your DSO admin.` };
}

const validationTimers = new Map<string, number>();

/**
 * Kick off CareStack validation for a case if it has never run. Idempotent —
 * safe to call on every open. Runs ~1.2 s later so the "checking" state is
 * visible, then either starts the appointment lookup (all three matched) or
 * parks the case at `blocked`.
 */
export function ensureCaseValidation(c: CaseLike) {
  if (!settings.enabled) return;
  const existing = cases[c.id];
  if (existing && existing.patient.status !== 'idle') return;
  if (validationTimers.has(c.id)) return;

  const checking: EntityMapping = { status: 'checking' };
  commitCases({
    ...cases,
    [c.id]: {
      caseId: c.id,
      patient: checking,
      dentist: checking,
      practice: checking,
      appointment: { state: 'blocked' },
    },
  });

  const t = window.setTimeout(() => {
    validationTimers.delete(c.id);
    const loc = locationForPractice(c.practice);
    const ov = DEMO_OVERRIDES[c.id] ?? {};
    const patient = ov.patient ?? resolvePatient(c, loc);
    const dentist = ov.dentist ?? resolveDentist(c, loc);
    const practice = resolvePractice(c, loc);
    const at = nowIso();
    patchCase(c.id, { patient, dentist, practice, validatedAt: at });

    const line = (label: string, m: EntityMapping) => `${label}: ${m.status === 'matched' ? `matched ${m.csId}` : 'not found'}`;
    addLog({
      caseId: c.id, kind: 'validation', outcome: [patient, dentist, practice].every(m => m.status === 'matched') ? 'ok' : 'failed',
      text: `Entity validation completed — ${line('Patient', patient)} · ${line('Dentist', dentist)} · ${line('Practice', practice)}`,
      detail: [patient, dentist, practice].filter(m => m.reason).map(m => m.reason).join('\n') || undefined,
    });

    if (ov.linkedAppointmentId && [patient, dentist, practice].every(m => m.status === 'matched')) {
      patchCase(c.id, { appointment: { state: 'linked', appointmentId: ov.linkedAppointmentId, linkedBy: 'Smile Genius (auto)', linkedAt: at } });
      const appt = appointmentById(ov.linkedAppointmentId);
      addLog({ caseId: c.id, kind: 'appointment', outcome: 'ok', text: `Appointment ${ov.linkedAppointmentId} linked automatically — one confident match${appt ? ` (${formatAppointmentTime(appt.startsAt)})` : ''}` });
      return;
    }
    maybeStartAppointmentLookup(c);
  }, 1200);
  validationTimers.set(c.id, t);
}

/** The user picked the right CareStack record — re-run the lookup for that entity. */
export function retryEntityLookup(c: CaseLike, entity: 'patient' | 'dentist', pick: { csId: string; csLabel: string }, by: string) {
  const rec = cases[c.id];
  if (!rec) return;
  patchCase(c.id, { [entity]: { status: 'checking' } as EntityMapping });
  window.setTimeout(() => {
    const at = nowIso();
    patchCase(c.id, { [entity]: { status: 'matched', csId: pick.csId, csLabel: pick.csLabel, correctedBy: by, correctedAt: at } as EntityMapping });
    addLog({ caseId: c.id, kind: 'validation', outcome: 'ok', by, text: `${entity === 'patient' ? 'Patient' : 'Dentist'} corrected and re-checked — matched ${pick.csId} (${pick.csLabel})` });
    maybeStartAppointmentLookup(c);
  }, 900);
}

// ─── Appointment lookup ──────────────────────────────────────────────────────

function allMapped(rec: CaseCareStack) {
  return rec.patient.status === 'matched' && rec.dentist.status === 'matched' && rec.practice.status === 'matched';
}
function linkedAppointmentIds(): Set<string> {
  const s = new Set<string>();
  for (const r of Object.values(cases)) if (r.appointment.state === 'linked' && r.appointment.appointmentId) s.add(r.appointment.appointmentId);
  return s;
}

function maybeStartAppointmentLookup(c: CaseLike) {
  const rec = cases[c.id];
  if (!rec || !allMapped(rec)) return;
  if (rec.appointment.state !== 'blocked') return;
  startAppointmentLookup(c);
}

/**
 * Background appointment search. "Confident" = same patient, provider and
 * location, on or after the requested delivery date (within three weeks), and
 * not already linked to another Smile Genius case. Exactly one → linked;
 * anything else → Appointment Required (ambiguous candidates are kept for the
 * Link-existing flow but never auto-selected).
 */
export function startAppointmentLookup(c: CaseLike) {
  const rec = cases[c.id];
  if (!rec || !allMapped(rec)) return;
  patchCase(c.id, { appointment: { state: 'searching' } });
  addLog({ caseId: c.id, kind: 'appointment', outcome: 'ok', text: 'Appointment lookup started — searching CareStack for a matching appointment' });

  window.setTimeout(() => {
    const cur = cases[c.id];
    if (!cur || cur.appointment.state !== 'searching') return;
    const taken = linkedAppointmentIds();
    const from = parseDmy(c.requestedDelivery) ?? new Date(2026, 4, 19);
    const to = new Date(from.getTime() + 21 * 86400000);
    const candidates = appointmentsForPatient(cur.patient.csId).filter(a =>
      a.providerId === cur.dentist.csId &&
      a.locationId === cur.practice.csId &&
      !taken.has(a.id) &&
      new Date(a.startsAt) >= from && new Date(a.startsAt) <= to,
    );
    const at = nowIso();
    if (candidates.length === 1) {
      const appt = candidates[0];
      patchCase(c.id, { appointment: { state: 'linked', appointmentId: appt.id, linkedBy: 'Smile Genius (auto)', linkedAt: at } });
      addLog({ caseId: c.id, kind: 'appointment', outcome: 'ok', text: `Appointment ${appt.id} linked automatically — one confident match (${formatAppointmentTime(appt.startsAt)})` });
      return;
    }
    const reason: 'none' | 'ambiguous' = candidates.length === 0 ? 'none' : 'ambiguous';
    patchCase(c.id, { appointment: { state: 'required', requiredReason: reason, candidateIds: candidates.map(a => a.id) } });
    addLog({
      caseId: c.id, kind: 'appointment', outcome: 'failed',
      text: reason === 'none'
        ? 'No CareStack appointment found — Appointment Required'
        : `${candidates.length} possible appointments found — not auto-selected, Appointment Required`,
    });
    queueAppointmentRequiredEmail(c);
  }, 1500);
}

export function linkExistingAppointment(c: CaseLike, appointmentId: string, by: string) {
  const at = nowIso();
  patchCase(c.id, { appointment: { state: 'linked', appointmentId, linkedBy: by, linkedAt: at } });
  const appt = appointmentById(appointmentId);
  addLog({ caseId: c.id, kind: 'appointment', outcome: 'ok', by, text: `Existing appointment ${appointmentId} linked${appt ? ` (${formatAppointmentTime(appt.startsAt)})` : ''}` });
}

let apptSeq = 7800;
export function createAndLinkAppointment(
  c: CaseLike,
  input: { date: string; time: string; providerId: string; locationId: string; type: string },
  by: string,
): CsAppointment {
  const rec = cases[c.id];
  const appt: CsAppointment = {
    id: `CS-APT-${++apptSeq}`,
    patientId: rec?.patient.csId ?? '',
    providerId: input.providerId,
    locationId: input.locationId,
    startsAt: `${input.date}T${input.time}:00`,
    durationMin: 30,
    type: input.type,
  };
  createdAppointments = [...createdAppointments, appt];
  const at = nowIso();
  patchCase(c.id, { appointment: { state: 'linked', appointmentId: appt.id, createdBySg: true, linkedBy: by, linkedAt: at } });
  addLog({ caseId: c.id, kind: 'appointment', outcome: 'ok', by, text: `Appointment ${appt.id} created in CareStack and linked (${formatAppointmentTime(appt.startsAt)} · ${providerById(input.providerId)?.name ?? input.providerId})` });
  return appt;
}

export function markAppointmentNotRequired(c: CaseLike, reason: string, by: string) {
  const at = nowIso();
  patchCase(c.id, { appointment: { state: 'not-required', notRequired: { reason, by, at } } });
  addLog({ caseId: c.id, kind: 'appointment', outcome: 'ok', by, text: `Marked Appointment Not Required — ${reason}. No CareStack appointment will be created or updated for this case.` });
}

// ─── Notifications (emails) ──────────────────────────────────────────────────

export const CARESTACK_EMAIL_TEMPLATES: Record<CareStackEmailEvent, { label: string; subject: string; body: string }> = {
  'appointment-required': {
    label: 'Appointment Required',
    subject: 'Appointment Required for Lab Work – {{Patient Name}}',
    body: `Hi {{Dentist/Practice Name}},
Smile Genius could not find a matching CareStack appointment for the following Lab Work case:
Patient: {{Patient Name}}
Dentist: {{Dentist Name}}
Practice: {{Practice Name}}
Lab: {{Lab Name}}
Lab Work: {{Lab Work Description}}
Case Created: {{Case Creation Date}}
Requested Delivery Date: {{Requested Due Date}}
Please review the case and select one of the following actions in Smile Genius:
• Link an Existing Appointment – if an appointment already exists in CareStack.
• Create New Appointment – select the required appointment details in Smile Genius and Smile Genius will create and link the appointment in CareStack.
• Appointment Not Required – if the Lab Work does not require a patient appointment.
Resolve Appointment: {{Smile Genius Case Link}}
The Lab Work case can continue to be processed while the appointment is being resolved.
Thanks,
Smile Genius`,
  },
  'due-date-changed': {
    label: 'Due Date Changed',
    subject: 'Lab Work Due Date Changed – {{Patient Name}}',
    body: `Hi {{Dentist/Practice Name}},
The requested delivery date for the following Lab Work case has been changed by the lab:
Patient: {{Patient Name}}
Dentist: {{Dentist Name}}
Lab: {{Lab Name}}
Previous Due Date: {{Previous Due Date}}
New Due Date: {{New Due Date}}
Reason: {{Reason}}
Please review the updated delivery date and determine whether the patient's appointment needs to be rescheduled.
View Lab Work Case: {{Smile Genius Case Link}}
Thanks,
Smile Genius`,
  },
  accepted: {
    label: 'Accepted by Lab',
    subject: 'Lab Work Accepted by Lab – {{Patient Name}}',
    body: `Hi {{Dentist/Practice Name}},
The lab has accepted the following Lab Work case:
Patient: {{Patient Name}}
Dentist: {{Dentist Name}}
Lab: {{Lab Name}}
Accepted On: {{Date/Time}}
View Lab Work Case: {{Smile Genius Case Link}}
Thanks,
Smile Genius`,
  },
  shipped: {
    label: 'Shipped',
    subject: 'Lab Work Shipped – {{Patient Name}}',
    body: `Hi {{Dentist/Practice Name}},
The following Lab Work case has been shipped by the lab:
Patient: {{Patient Name}}
Dentist: {{Dentist Name}}
Lab: {{Lab Name}}
Shipment Date: {{Shipment Date}}
Courier: {{Courier}}
Tracking Number: {{Tracking Number}}
Expected Delivery Date: {{Expected Delivery Date}}
You can use the tracking information above to follow the delivery.
View Lab Work Case: {{Smile Genius Case Link}}
Thanks,
Smile Genius`,
  },
  received: {
    label: 'Received by Practice',
    subject: 'Lab Work Received – {{Patient Name}}',
    body: `Hi {{Dentist/Practice Name}},
The following Lab Work case has been received by the practice:
Patient: {{Patient Name}}
Dentist: {{Dentist Name}}
Lab: {{Lab Name}}
Received Date/Time: {{Received Date/Time}}
Received By: {{User Name}}
Delivery Notes: {{Delivery Notes}}
View Lab Work Case: {{Smile Genius Case Link}}
Thanks,
Smile Genius`,
  },
};

export const CARESTACK_NOTE_TEMPLATES = {
  accepted: `Lab Work Accepted
The lab has accepted this Lab Work case.
Accepted: {{Date/Time}}
Smile Genius Case: {{Case Link}}`,
  shipped: `Lab Work Shipped
Shipment Date: {{Shipment Date}}
Courier: {{Courier}}
Tracking Number: {{Tracking Number}}
Expected Delivery: {{Expected Delivery Date}}
Smile Genius Case: {{Case Link}}`,
  received: `Lab Work Received by Practice
Received: {{Received Date/Time}}
Received By: {{User Name}}
Delivery Notes: {{Delivery Notes}}
Smile Genius Case: {{Case Link}}`,
  'due-date-changed': `Lab Work Due Date Changed
Previous Due Date: {{Previous Due Date}}
New Due Date: {{New Due Date}}
Reason: {{Reason}}
Smile Genius Case: {{Case Link}}`,
};

export function fillCsTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => vars[k.trim()] ?? `{{${k.trim()}}}`);
}

function dentistEmail(dentist: string) {
  const slug = dentist.replace(/^dr\.?\s*/i, '').trim().toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  return `${slug || 'dentist'}@smilegenius.com`;
}

/** TO: dentist + practice manager · CC: receptionist — resolved from the mapped location. */
export function recipientsFor(c: CaseLike) {
  const loc = locationForPractice(c.practice);
  const pm = loc?.practiceManager ?? { name: 'Practice Manager', email: `manager@${c.practice.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.uk` };
  const rc = loc?.receptionist ?? { name: 'Reception', email: `reception@${c.practice.toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.uk` };
  return {
    to: [{ name: c.dentist, email: dentistEmail(c.dentist) }, pm],
    cc: rc,
  };
}

function baseVars(c: CaseLike): Record<string, string> {
  return {
    'Patient Name': c.patientName,
    'Dentist/Practice Name': c.dentist,
    'Dentist Name': c.dentist,
    'Practice Name': c.practice,
    'Lab Name': c.lab,
    'Lab Work Description': c.services.join(', ') || 'Lab work',
    'Case Creation Date': c.createdAt,
    'Requested Due Date': c.requestedDelivery ?? 'Not set',
    'Smile Genius Case Link': caseLink(c.id),
    'Case Link': caseLink(c.id),
  };
}

export const CARESTACK_SENDER = 'notifications@smilegenius.com';

export function sendCareStackEmail(
  c: CaseLike,
  event: CareStackEmailEvent,
  vars: Record<string, string>,
  opts: { queued?: boolean } = {},
): CaseCommunication {
  const tpl = CARESTACK_EMAIL_TEMPLATES[event];
  const all = { ...baseVars(c), ...vars };
  const r = recipientsFor(c);
  const rec = recordCommunication({
    caseId: c.id,
    channel: 'email',
    trigger: 'automated',
    recipientName: r.to.map(x => x.name).join(', '),
    recipientAddress: r.to.map(x => x.email).join(', '),
    cc: `${r.cc.name} <${r.cc.email}>`,
    sender: CARESTACK_SENDER,
    subject: fillCsTemplate(tpl.subject, all),
    body: fillCsTemplate(tpl.body, all),
    status: opts.queued ? 'queued' : 'sent',
    source: 'carestack',
    csEvent: event,
  });
  addLog({
    caseId: c.id, kind: 'email', outcome: opts.queued ? 'queued' : 'ok',
    text: opts.queued
      ? `Email "${rec.subject}" queued for the end-of-day digest — to ${rec.recipientName} · cc ${r.cc.name}`
      : `Email "${rec.subject}" sent — to ${rec.recipientName} · cc ${r.cc.name}`,
    detail: rec.body,
  });
  return rec;
}

function queueAppointmentRequiredEmail(c: CaseLike) {
  const rec = sendCareStackEmail(c, 'appointment-required', {}, { queued: true });
  patchCase(c.id, { digest: { commId: rec.id, queuedAt: rec.at } });
}

/** Demo control: run the end-of-day digest now for one case. */
export function simulateDigestSend(caseId: string) {
  const rec = cases[caseId];
  if (!rec?.digest || rec.digest.sentAt) return;
  const sent = markCommunicationSent(rec.digest.commId);
  const at = nowIso();
  patchCase(caseId, { digest: { ...rec.digest, sentAt: at } });
  addLog({ caseId, kind: 'email', outcome: 'ok', text: `End-of-day digest sent — "${sent?.subject ?? 'Appointment Required'}"`, detail: sent?.body });
}

// ─── CareStack appointment notes ─────────────────────────────────────────────

/**
 * Add a note to the linked CareStack appointment. CareStack's own note
 * history stamps updatedOn / updatedBy, so no separate timestamp field is
 * sent. Not linked → the update stays in Smile Genius and the skip is logged.
 */
export function postAppointmentNote(c: CaseLike, title: string, body: string, by?: string) {
  const rec = cases[c.id];
  const appt = rec?.appointment;
  if (appt?.state === 'linked' && appt.appointmentId) {
    addLog({ caseId: c.id, kind: 'note', outcome: 'ok', by, text: `Note posted to CareStack appointment ${appt.appointmentId} — ${title}`, detail: body });
    return true;
  }
  addLog({
    caseId: c.id, kind: 'note', outcome: 'skipped', by,
    text: appt?.state === 'not-required'
      ? `${title} — not posted to CareStack (appointment marked Not Required)`
      : `${title} — not posted to CareStack (no appointment linked). The update remains in Smile Genius.`,
    detail: body,
  });
  return false;
}

// ─── Lifecycle events ────────────────────────────────────────────────────────
// Each: record on the case → note (if linked) → practice email → audit log.

export function recordAcceptance(c: CaseLike, by: string) {
  ensureRecord(c);
  if (cases[c.id]?.acceptedAt) return;
  const at = nowIso();
  patchCase(c.id, { acceptedAt: at });
  const stamp = formatStamp(at);
  postAppointmentNote(c, 'Lab Work Accepted', fillCsTemplate(CARESTACK_NOTE_TEMPLATES.accepted, { 'Date/Time': stamp, 'Case Link': caseLink(c.id) }), by);
  sendCareStackEmail(c, 'accepted', { 'Date/Time': stamp });
}

export function recordDueDateChange(c: CaseLike, change: { previous: string | null; next: string; reason?: string }, by: string) {
  const at = nowIso();
  const entry: DueDateChange = { caseId: c.id, previous: change.previous, next: change.next, reason: change.reason?.trim() || undefined, by, at };
  commitDue([...dueDateChanges, entry]);
  if (!settings.enabled) return;
  ensureRecord(c);
  addLog({ caseId: c.id, kind: 'due-date', outcome: 'ok', by, text: `Due date changed ${change.previous ?? '—'} → ${change.next}${entry.reason ? ` — ${entry.reason}` : ''}` });
  const vars = { 'Previous Due Date': change.previous ?? '—', 'New Due Date': change.next, Reason: entry.reason ?? 'Not provided' };
  postAppointmentNote(c, 'Lab Work Due Date Changed', fillCsTemplate(CARESTACK_NOTE_TEMPLATES['due-date-changed'], { ...vars, 'Case Link': caseLink(c.id) }), by);
  sendCareStackEmail(c, 'due-date-changed', vars);
}

export function recordShipment(
  c: CaseLike,
  shipment: { shipmentDate: string; courier: string; trackingNumber: string; trackingUrl?: string; expectedDelivery: string },
  by: string,
) {
  ensureRecord(c);
  const at = nowIso();
  patchCase(c.id, { shipment: { ...shipment, by, at } });
  addLog({ caseId: c.id, kind: 'shipment', outcome: 'ok', by, text: `Shipment recorded — ${shipment.courier} · ${shipment.trackingNumber || 'no tracking number'} · shipped ${shipment.shipmentDate}` });
  const vars = {
    'Shipment Date': shipment.shipmentDate,
    Courier: shipment.courier,
    'Tracking Number': shipment.trackingNumber || 'Not available',
    'Expected Delivery Date': shipment.expectedDelivery || 'Not available',
  };
  postAppointmentNote(c, 'Lab Work Shipped', fillCsTemplate(CARESTACK_NOTE_TEMPLATES.shipped, { ...vars, 'Case Link': caseLink(c.id) }), by);
  sendCareStackEmail(c, 'shipped', vars);
}

export function recordReceipt(c: CaseLike, receipt: { receivedAt: string; receivedBy: string; notes?: string }) {
  ensureRecord(c);
  if (cases[c.id]?.receipt) return;
  const at = nowIso();
  patchCase(c.id, { receipt: { ...receipt, notes: receipt.notes?.trim() || undefined, at } });
  const stamp = formatStamp(receipt.receivedAt);
  addLog({ caseId: c.id, kind: 'receipt', outcome: 'ok', by: receipt.receivedBy, text: `Received by practice — ${stamp} · confirmed by ${receipt.receivedBy}${receipt.notes ? ` · ${receipt.notes}` : ''}` });
  const vars = { 'Received Date/Time': stamp, 'User Name': receipt.receivedBy, 'Delivery Notes': receipt.notes?.trim() || 'None' };
  postAppointmentNote(c, 'Lab Work Received by Practice', fillCsTemplate(CARESTACK_NOTE_TEMPLATES.received, { ...vars, 'Case Link': caseLink(c.id) }), receipt.receivedBy);
  sendCareStackEmail(c, 'received', vars);
}

// A milestone can fire on a case that was never opened (bulk status change,
// list row action) — give it a record so the events have somewhere to land.
function ensureRecord(c: CaseLike) {
  if (cases[c.id]) return;
  const idle: EntityMapping = { status: 'idle' };
  commitCases({ ...cases, [c.id]: { caseId: c.id, patient: idle, dentist: idle, practice: idle, appointment: { state: 'blocked' } } });
}

// ─── Summaries (list chip · admin tab) ───────────────────────────────────────

export type CaseCareStackSummary =
  | 'pending' | 'checking' | 'mapping-incomplete' | 'searching' | 'linked' | 'required' | 'not-required';

export function summariseCase(rec?: CaseCareStack): CaseCareStackSummary {
  if (!rec) return 'pending';
  const ms = [rec.patient, rec.dentist, rec.practice];
  if (ms.every(m => m.status === 'idle')) return 'pending';
  if (ms.some(m => m.status === 'checking')) return 'checking';
  if (ms.some(m => m.status === 'not-found')) return 'mapping-incomplete';
  switch (rec.appointment.state) {
    case 'searching': return 'searching';
    case 'linked': return 'linked';
    case 'required': return 'required';
    case 'not-required': return 'not-required';
    default: return 'pending';
  }
}

export const SUMMARY_META: Record<CaseCareStackSummary, { label: string; cls: string }> = {
  pending:              { label: 'Pending check',        cls: 'bg-[#F3F3F5] text-[#717182] border-[#E0E0E6]' },
  checking:             { label: 'Checking…',            cls: 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]' },
  'mapping-incomplete': { label: 'Mapping incomplete',   cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
  searching:            { label: 'Finding appointment…', cls: 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]' },
  linked:               { label: 'Linked',               cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
  required:             { label: 'Appointment required', cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' },
  'not-required':       { label: 'Not required',         cls: 'bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]' },
};

/** Unmapped patients across every validated case — the admin's review list. */
export function unmappedPatients(all: Record<string, CaseCareStack> = cases): { caseId: string; reason?: string }[] {
  return Object.values(all)
    .filter(r => r.patient.status === 'not-found')
    .map(r => ({ caseId: r.caseId, reason: r.patient.reason }));
}
