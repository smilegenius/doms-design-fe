// ─── New Case Flow · demo store ──────────────────────────────────────────────
// The flow keeps its own cases, patients, learned scanner logins and
// notifications in localStorage, apart from the portal's real Cases list, so
// the walkthrough never changes another screen. Same subscribe pattern as
// data/createdCases.ts. One demo scan is held back in the scanner inbox until
// someone presses Refresh on the picker's New Scans lane.

import { useSyncExternalStore } from 'react';
import { CLINIC, LabId, PATIENTS, Patient, ProductId, SCANNER_LOGINS, Scanner, UserId, setNotationLookup } from './data';
import { CaseDraft, Notation, ServiceItem, setLoginLookup } from './rules';
import type { Ux } from './controller';

// A posted case is created Ready for Dispatch (not with the lab yet) and becomes Submitted once it's posted.
export type RowStatus = 'Draft' | 'Ready for Dispatch' | 'Submitted' | 'Received' | 'In production' | 'Delivered';
export interface CaseRow {
  id: string;
  patientId: string;
  status: RowStatus;
  flag?: 'Awaiting scan' | 'Awaiting approval';
  source: 'scanner' | 'clinic';
  /** Only rows made in this flow carry a draft; history rows are display-only. */
  draft?: CaseDraft;
  createdBy?: UserId;
  /** "Medit · 10:42" for scanner drafts */
  scanLabel?: string;
  service: string;
  delivery?: string;
  dentist?: string;
  labId: LabId;
  updatedAt: number;
  sentAt?: number;
  /** The same send moment on the demo clock (ISO of demoNow() at send), so its dates hold across page loads. */
  sentDemoAt?: string;
  /** E6 demo: the scan for a "Scan to Follow" case has arrived. */
  scanArrived?: { scanner: Scanner; time: string };
  /** Scan to Follow: when the attached scan reached the lab, on the demo clock (ms). */
  scanAt?: number;
  highlightUntil?: number;
}
export interface FlowEvent { id: string; forUser: UserId; text: string; caseId: string; at: number }

interface State {
  rows: CaseRow[];
  patients: Patient[];
  userId: UserId;
  logins: Record<string, UserId | undefined>;
  events: FlowEvent[];
  counter: number;
  favourites: LabId[];
  /** Which of the three experiences opens a case. */
  ux: Ux;
  /** The held-back demo scan (Hannah Lowe, iTero) has been delivered. */
  scanInboxDelivered: boolean;
  /** Tooth numbering each user picked by the chart (FDI, Universal, Palmer); else the user's own. */
  notations: Partial<Record<UserId, Notation>>;
}

const KEY = 'newCaseFlow.v1';
let uid = 0;
export const newId = (p = 'it') => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;

export function blankDraft(patient: Patient, extra: Partial<CaseDraft> = {}): CaseDraft {
  return {
    patientId: patient.id,
    funding: patient.funding,
    lab: patient.nextStage?.lab ?? CLINIC.usualLab,
    labSrc: patient.nextStage ? 'Made the previous stage' : "Clinic's usual lab",
    labPicked: false,
    items: [],
    // Impressions by post unless a scan says otherwise (a scan always wins in recordsState).
    records: { route: 'post', box: {}, disinfected: false, files: [] },
    rememberLogin: true,
    fastTrack: false,
    split: false,
    keepTogether: false,
    note: '',
    step: '',
    dismissedNotes: [],
    ...extra,
  };
}
export function newItem(product: ProductId, extra: Partial<ServiceItem> = {}): ServiceItem {
  return { id: newId(), product, teeth: [], teethDone: false, photos: [], ...extra };
}

const at = (h: number, m: number) => new Date(2026, 9, 22, h, m).getTime();
function seed(): State {
  const p = (id: string) => PATIENTS.find(x => x.id === id)!;
  const rows: CaseRow[] = [
    {
      id: 'CAS-2026-142', patientId: 'P-2025-031', status: 'Draft', source: 'scanner', scanLabel: 'Medit · 10:42',
      service: '—', dentist: 'Dr Sarah Khan', labId: 'northfield', updatedAt: at(10, 42),
      draft: blankDraft(p('P-2025-031'), {
        id: 'CAS-2026-142', login: 'Medit:skhan',
        scan: { scanner: 'Medit', time: '10:42', arches: { upper: true, lower: true, bite: true }, patientId: 'P-2025-031' },
      }),
    },
    {
      id: 'CAS-2026-143', patientId: 'P-2025-044', status: 'Draft', source: 'scanner', scanLabel: 'iTero · 09:12',
      service: '—', labId: 'northfield', updatedAt: at(9, 12),
      draft: blankDraft(p('P-2025-044'), {
        id: 'CAS-2026-143', login: 'iTero:surgery2',
        scan: { scanner: 'iTero', time: '09:12', arches: { upper: true, lower: true, bite: true }, patientId: 'P-2025-044' },
      }),
    },
    {
      // A7 · the Medit form carries "36 · Crown · Zirconia".
      id: 'CAS-2026-141', patientId: 'P-2025-071', status: 'Draft', source: 'scanner', scanLabel: 'Medit · 08:55',
      service: 'Crown · 36', dentist: 'Dr Sarah Khan', labId: 'northfield', updatedAt: at(8, 55),
      draft: blankDraft(p('P-2025-071'), {
        id: 'CAS-2026-141', login: 'Medit:skhan',
        scan: { scanner: 'Medit', time: '08:55', arches: { upper: true, lower: true, bite: true }, patientId: 'P-2025-071' },
        items: [newItem('crown', { id: 'rx141', teeth: ['36'], teethDone: true, teethSrc: 'From scan', ambiguous: 'Zirconia' })],
      }),
    },
    { id: 'CAS-2026-131', patientId: 'P-2025-060', status: 'In production', source: 'clinic', service: 'Night guard · UPPER', delivery: '2026-10-27', dentist: 'Dr Tom Ellery', labId: 'northfield', updatedAt: new Date(2026, 9, 20, 15, 2).getTime() },
    { id: 'CAS-2026-117', patientId: 'P-2025-009', status: 'Delivered', source: 'clinic', service: 'Full denture · UPPER · Bite Registration', delivery: '2026-10-12', dentist: 'Dr Sarah Khan', labId: 'pennine', updatedAt: new Date(2026, 9, 12, 10, 30).getTime() },
    { id: 'CAS-2026-098', patientId: 'P-2025-018', status: 'Delivered', source: 'clinic', service: 'Crown · 46', delivery: '2026-10-03', dentist: 'Dr Sarah Khan', labId: 'northfield', updatedAt: new Date(2026, 9, 3, 9, 15).getTime() },
  ];
  return { rows, patients: [], userId: 'khan', logins: {}, events: [], counter: 144, favourites: ['northfield', 'pennine'], ux: 'guided', scanInboxDelivered: false, notations: {} };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...seed(), ...JSON.parse(raw) };
  } catch { /* fall through to a fresh seed */ }
  return seed();
}
let state: State = load();
const listeners = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getState = () => state;
export function useFlowStore(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ─── Patients ────────────────────────────────────────────────────────────────
export const allPatients = () => [...PATIENTS, ...state.patients];
/** Recent Patients: the ones added in this flow, newest first, then the practice's list. */
export const recentPatients = () => [...state.patients].reverse().concat(PATIENTS);
export const getPatient = (id: string) => allPatients().find(p => p.id === id);
export function addPatient(p: Omit<Patient, 'id'>): Patient {
  const n = state.patients.length + 1;
  const patient: Patient = { ...p, id: `P-2026-${String(n).padStart(3, '0')}` };
  commit({ ...state, patients: [...state.patients, patient] });
  return patient;
}

// ─── Users and scanner logins ────────────────────────────────────────────────
export const setUserId = (userId: UserId) => commit({ ...state, userId });
export function loginMap(): Record<string, UserId | undefined> {
  return { ...SCANNER_LOGINS, ...state.logins };
}
export const learnLogin = (login: string, userId: UserId) => commit({ ...state, logins: { ...state.logins, [login]: userId } });
setLoginLookup(login => !loginMap()[login]);
/** The numbering the charts and teeth read in, kept per user for next time. */
export const setNotation = (userId: UserId, n: Notation) => commit({ ...state, notations: { ...state.notations, [userId]: n } });
setNotationLookup(id => state.notations?.[id]);

export function toggleFavourite(id: LabId) {
  const f = state.favourites.includes(id) ? state.favourites.filter(x => x !== id) : [...state.favourites, id];
  commit({ ...state, favourites: f });
}

// ─── Rows ────────────────────────────────────────────────────────────────────
export const getRow = (id: string) => state.rows.find(r => r.id === id);
export function nextCaseId(): string {
  const id = `CAS-2026-${state.counter}`;
  commit({ ...state, counter: state.counter + 1 });
  return id;
}
export function saveRow(row: CaseRow) {
  const rows = state.rows.some(r => r.id === row.id) ? state.rows.map(r => (r.id === row.id ? row : r)) : [row, ...state.rows];
  commit({ ...state, rows });
}
export function saveRows(list: CaseRow[]) {
  let rows = state.rows;
  for (const row of list) rows = rows.some(r => r.id === row.id) ? rows.map(r => (r.id === row.id ? row : r)) : [row, ...rows];
  commit({ ...state, rows });
}
export const removeRow = (id: string) => commit({ ...state, rows: state.rows.filter(r => r.id !== id) });
/** Ready for Dispatch → Submitted once the clinic posts it (the portal's rule), with the back-by day counted from the post. */
export function markDispatched(id: string, delivery?: string) {
  commit({ ...state, rows: state.rows.map(r => (r.id === id ? { ...r, status: 'Submitted', delivery: delivery ?? r.delivery, updatedAt: Date.now() } : r)) });
}
export function openDraftsFor(patientId: string) {
  return state.rows.filter(r => r.patientId === patientId && r.status === 'Draft' && !r.flag && r.draft);
}

// ─── Scanner inbox ───────────────────────────────────────────────────────────
/** "Check for new scans": the first call delivers the held-back iTero scan for
 *  Hannah Lowe (11:04, upper + lower + bite) as a scanner draft and returns it;
 *  every later call returns []. resetDemo() holds it back again. */
export function checkForScans(): CaseRow[] {
  if (state.scanInboxDelivered) return [];
  const patient = PATIENTS.find(x => x.id === 'P-2025-052');
  if (!patient) { commit({ ...state, scanInboxDelivered: true }); return []; }
  const id = `CAS-2026-${state.counter}`;
  const row: CaseRow = {
    id, patientId: patient.id, status: 'Draft', source: 'scanner', scanLabel: 'iTero · 11:04',
    service: '—', labId: 'northfield', updatedAt: at(11, 4),
    draft: blankDraft(patient, {
      id, login: 'iTero:surgery2',
      scan: { scanner: 'iTero', time: '11:04', arches: { upper: true, lower: true, bite: true }, patientId: patient.id },
    }),
  };
  commit({ ...state, rows: [row, ...state.rows], counter: state.counter + 1, scanInboxDelivered: true });
  return [row];
}

/** What a send changed, so Undo puts back only those rows. */
export type Snapshot = { id: string; before?: CaseRow }[];
export function snapshot(ids: string[]): Snapshot {
  return ids.map(id => ({ id, before: getRow(id) }));
}
export function restore(snap: Snapshot) {
  let rows = state.rows;
  for (const { id, before } of snap) {
    rows = before ? (rows.some(r => r.id === id) ? rows.map(r => (r.id === id ? before : r)) : [before, ...rows]) : rows.filter(r => r.id !== id);
  }
  commit({ ...state, rows });
}

// ─── Notifications ───────────────────────────────────────────────────────────
export function addEvent(e: Omit<FlowEvent, 'id' | 'at'>) {
  commit({ ...state, events: [{ ...e, id: newId('ev'), at: Date.now() }, ...state.events] });
}
export const dismissEvent = (id: string) => commit({ ...state, events: state.events.filter(e => e.id !== id) });

/** Resetting the demo keeps the chosen experience (and holds the inbox scan back again). */
export function resetDemo() {
  commit({ ...seed(), ux: state.ux });
}
export const setUx = (ux: Ux) => commit({ ...state, ux });
