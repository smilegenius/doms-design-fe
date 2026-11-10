// ─── Accept case on print · demo store (Nov 2026) ───────────────────────────
// The lab's cases for the Accept-on-print flow. They live here, not in the
// portal's Cases (pages/CasesPage mockCases), so the live lab statuses the flow
// needs (Received, Accepted…) never reach the portal's lists or status pickers.
// localStorage-backed like the other flow stores; the walkthrough can reset it.

import { useSyncExternalStore } from 'react';
import { recordDispatch, removeDispatch } from '../data/dispatchRecords';
import { CURRENT_USER, type Scanner } from '../pages/CasesPage';

/** The lab's statuses, in the order a case moves through them. Received is for posted cases only. */
export type LabStatus = 'Submitted' | 'Received' | 'Accepted' | 'On Hold' | 'In Production' | 'Quality Check' | 'Shipped';

export interface StatusEvent {
  status: LabStatus;
  /** "03-Nov-2026 09:40" */
  at: string;
  /** The practice for Submitted, the lab user for everything after. */
  by: string;
}

export type Via =
  | { kind: 'scanner'; scanner: Scanner }
  | { kind: 'email' }
  | { kind: 'post'; courier: string; packaging: 'Bag' | 'Box'; tracking: string; /** yyyy-mm-dd */ postedOn: string };

export interface LabCase {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: 'Female' | 'Male';
  practice: string;
  dentist: string;
  service: string;
  fdi: number[];
  material: string;
  shade: string;
  orderType: 'NHS' | 'Private';
  instructions: string;
  scanFileCount: number;
  via: Via;
  /** DD-MMM-YYYY */
  createdAt: string;
  requestedDelivery: string;
  status: LabStatus;
  history: StatusEvent[];
  /** Posted cases: when the lab marked the parcel as received. */
  receivedAt?: string;
  /** Set once the case is accepted, or moved past Accepted from the status list. */
  acceptedAt?: string;
  /** What the lab asked the practice for when it put the case on hold. */
  hold?: { missing: string[]; note?: string; at: string };
  updatedAt: string;
}

/** Who the lab's own changes are recorded as (the portal's signed-in user). */
export const LAB_USER = CURRENT_USER;
export const LAB_NAME = 'Smile Genius Lab';
/** The demo's clock: Tue 3 Nov 2026. */
const TODAY = '03-Nov-2026';
const PARCEL_MISSING = 'Parcel hasn’t arrived';

/** What the lab can say is missing. A posted case can't be received while its parcel hasn't arrived. */
export const MISSING_OPTIONS = {
  post: [PARCEL_MISSING, 'Impressions', 'Bite registration', 'Shade', 'Prescription details', 'Photos', 'Other'],
  digital: ['Scan files', 'Bite scan', 'Shade', 'Prescription details', 'Photos', 'Other'],
};

export const isPosted = (c: LabCase) => c.via.kind === 'post';
export const isAccepted = (c: LabCase) => !!c.acceptedAt;
/** The prompt's extra part: a posted case the lab hasn't marked as received. */
export const awaitingReceipt = (c: LabCase) => isPosted(c) && !c.receivedAt;

// ─── Seed ────────────────────────────────────────────────────────────────────

const SEED: LabCase[] = [
  {
    id: 'CASE-ACC-5101', patientName: 'Olivia Bennett', patientAge: 42, patientGender: 'Female',
    practice: 'Smile Genius Cardiff', dentist: 'Dr. Evans',
    service: 'Crown', fdi: [36], material: 'Zirconia', shade: 'A2', orderType: 'Private',
    instructions: 'Full-contour zirconia, light occlusal contact. Margin at the gum line.',
    scanFileCount: 4, via: { kind: 'scanner', scanner: 'iTero' },
    createdAt: '02-Nov-2026', requestedDelivery: '13-Nov-2026', status: 'Submitted',
    history: [{ status: 'Submitted', at: '02-Nov-2026 16:20', by: 'Smile Genius Cardiff' }],
    updatedAt: '02-Nov-2026',
  },
  {
    id: 'CASE-ACC-5102', patientName: 'George Patel', patientAge: 58, patientGender: 'Male',
    practice: 'Smile Genius Leeds', dentist: 'Dr. Okafor',
    service: 'Bridge', fdi: [14, 15, 16], material: 'PFM', shade: 'A3', orderType: 'NHS',
    instructions: 'Three-unit bridge, 15 pontic. Impressions and bite registration in the bag.',
    scanFileCount: 0, via: { kind: 'post', courier: 'Royal Mail', packaging: 'Bag', tracking: 'RM 4821 7730 5GB', postedOn: '2026-10-31' },
    createdAt: '30-Oct-2026', requestedDelivery: '16-Nov-2026', status: 'Submitted',
    history: [{ status: 'Submitted', at: '31-Oct-2026 11:05', by: 'Smile Genius Leeds' }],
    updatedAt: '31-Oct-2026',
  },
  {
    id: 'CASE-ACC-5103', patientName: 'Chloe Martin', patientAge: 29, patientGender: 'Female',
    practice: 'Smile Genius Bristol', dentist: 'Dr. Hughes',
    service: 'Night Guard', fdi: [], material: 'Hard (Michigan)', shade: '—', orderType: 'Private',
    instructions: 'Upper hard night guard, 2 mm. Patient grinds at night.',
    scanFileCount: 0, via: { kind: 'post', courier: 'DPD', packaging: 'Box', tracking: 'DPD 1550 8812', postedOn: '2026-10-30' },
    createdAt: '29-Oct-2026', requestedDelivery: '12-Nov-2026', status: 'Received',
    history: [
      { status: 'Submitted', at: '30-Oct-2026 15:40', by: 'Smile Genius Bristol' },
      { status: 'Received', at: '02-Nov-2026 10:15', by: LAB_USER },
    ],
    receivedAt: '02-Nov-2026 10:15',
    updatedAt: '02-Nov-2026',
  },
  {
    id: 'CASE-ACC-5104', patientName: 'Amira Hassan', patientAge: 35, patientGender: 'Female',
    practice: 'Smile Genius Manchester', dentist: 'Dr. Lin',
    service: 'Veneers', fdi: [11, 21], material: 'E.max', shade: 'B1', orderType: 'Private',
    instructions: 'Two veneers, natural translucency at the incisal edge.',
    scanFileCount: 2, via: { kind: 'email' },
    createdAt: '03-Nov-2026', requestedDelivery: '17-Nov-2026', status: 'Submitted',
    history: [{ status: 'Submitted', at: '03-Nov-2026 08:30', by: 'Smile Genius Manchester' }],
    updatedAt: '03-Nov-2026',
  },
  {
    id: 'CASE-ACC-5105', patientName: 'Daniel Price', patientAge: 51, patientGender: 'Male',
    practice: 'Smile Genius Cardiff', dentist: 'Dr. Evans',
    service: 'Crown', fdi: [46], material: 'E.max', shade: 'A3', orderType: 'Private',
    instructions: 'Lithium disilicate crown, match 45.',
    scanFileCount: 3, via: { kind: 'scanner', scanner: 'Medit' },
    createdAt: '30-Oct-2026', requestedDelivery: '10-Nov-2026', status: 'Accepted',
    history: [
      { status: 'Submitted', at: '30-Oct-2026 09:50', by: 'Smile Genius Cardiff' },
      { status: 'Accepted', at: '30-Oct-2026 14:05', by: LAB_USER },
    ],
    acceptedAt: '30-Oct-2026 14:05',
    updatedAt: '30-Oct-2026',
  },
  {
    id: 'CASE-ACC-5106', patientName: 'Ruby Clarke', patientAge: 24, patientGender: 'Female',
    practice: 'Smile Genius Leeds', dentist: 'Dr. Okafor',
    service: 'Retainer', fdi: [], material: 'Essix', shade: '—', orderType: 'Private',
    instructions: 'Upper and lower Essix retainers, 1 mm.',
    scanFileCount: 2, via: { kind: 'scanner', scanner: '3Shape' },
    createdAt: '27-Oct-2026', requestedDelivery: '06-Nov-2026', status: 'In Production',
    history: [
      { status: 'Submitted', at: '27-Oct-2026 12:10', by: 'Smile Genius Leeds' },
      { status: 'Accepted', at: '27-Oct-2026 15:30', by: LAB_USER },
      { status: 'In Production', at: '28-Oct-2026 09:00', by: LAB_USER },
    ],
    acceptedAt: '27-Oct-2026 15:30',
    updatedAt: '28-Oct-2026',
  },
];

// ─── Store ───────────────────────────────────────────────────────────────────

const LS_KEY = 'acceptOnPrint.v1';

function load(): LabCase[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* corrupt — start from the seed */ }
  return SEED;
}

let cases: LabCase[] = load();
const listeners = new Set<() => void>();

function commit(next: LabCase[]) {
  cases = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in memory */ }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLabCases(): LabCase[] {
  return useSyncExternalStore(subscribe, () => cases);
}

export const getLabCase = (id: string) => cases.find(c => c.id === id);

/** "03-Nov-2026 09:40" on the demo's day, at the real clock's time. */
function now(): string {
  const d = new Date();
  return `${TODAY} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function update(id: string, change: (c: LabCase, at: string) => LabCase) {
  const at = now();
  commit(cases.map(c => (c.id === id ? { ...change(c, at), updatedAt: TODAY } : c)));
}

const withEvent = (c: LabCase, status: LabStatus, at: string): LabCase => ({
  ...c, status, history: [...c.history, { status, at, by: LAB_USER }],
});

/** A posted case's parcel is in: Received. */
function receive(c: LabCase, at: string): LabCase {
  return awaitingReceipt(c) ? { ...withEvent(c, 'Received', at), receivedAt: at } : c;
}

/** Yes, accept case. A posted case not marked as received is received first. */
export function acceptCase(id: string) {
  update(id, (c, at) => ({ ...withEvent(receive(c, at), 'Accepted', at), acceptedAt: at, hold: undefined }));
}

/** Something missing: the case goes On Hold, asking the practice for what's missing. A posted case's parcel
 *  counts as received unless the lab says it hasn't arrived. */
export function putOnHold(id: string, missing: string[], note?: string) {
  update(id, (c, at) => {
    const base = missing.includes(PARCEL_MISSING) ? c : receive(c, at);
    return { ...withEvent(base, 'On Hold', at), hold: { missing, note: note?.trim() || undefined, at } };
  });
}

/** A pick from the lab's status list. Received is a posted case's; anything past Accepted counts as accepted. */
export function setLabStatus(id: string, status: LabStatus) {
  if (status === 'Accepted') { acceptCase(id); return; }
  update(id, (c, at) => {
    if (status === 'Received') return receive(c, at);
    const next = withEvent(c, status, at);
    return status === 'On Hold' ? next : { ...next, acceptedAt: c.acceptedAt ?? at, hold: undefined };
  });
}

/** The posted cases' "Clinic → Lab" record, for the Shipping tab on Case Details. */
function seedDispatch() {
  for (const c of SEED) {
    if (c.via.kind !== 'post') continue;
    recordDispatch(c.id, {
      courier: c.via.courier, packaging: c.via.packaging, tracking: c.via.tracking, dispatchedOn: c.via.postedOn,
      by: c.practice, at: `${c.via.postedOn}T11:00:00`,
    });
  }
}

/** Called when the walkthrough opens a screen: the posted cases' dispatch records are in place. */
export function ensureDemo() { seedDispatch(); }

/** One case back to how the demo starts it, so a walkthrough scenario always opens on its own scenario. */
export function resetCase(id: string) {
  const seed = SEED.find(c => c.id === id);
  if (seed) commit(cases.map(c => (c.id === id ? seed : c)));
}

export function resetDemo() {
  for (const c of SEED) removeDispatch(c.id);
  seedDispatch();
  commit(SEED);
}
