// ─── Smile Genius Go — demo data ─────────────────────────────────────────────
// Seed data for the clinician mobile prototype. Dates are relative to "now"
// so the Needs-attention counts (overdue, arriving today…) always make sense.

export type PracticeId = 'cds' | 'isc';
export const PRACTICES: { id: PracticeId; name: string; area: string }[] = [
  { id: 'cds', name: 'Camden Dental Studio', area: 'Camden, London' },
  { id: 'isc', name: 'Islington Smile Care', area: 'Islington, London' },
];
export const practiceName = (id: PracticeId) => PRACTICES.find(p => p.id === id)!.name;

export const LABS = [
  { id: 'northstar', name: 'Northstar Dental Lab', town: 'Leeds' },
  { id: 'precision', name: 'Precision Dental Works', town: 'Manchester' },
  { id: 'brightarch', name: 'Bright Arch Laboratory', town: 'Bristol' },
];
export const labName = (id: string) => LABS.find(l => l.id === id)?.name ?? id;

export const CLINICIANS = [
  { id: 'reed', name: 'Dr Olivia Reed', gdc: '284119' },
  { id: 'okafor', name: 'Dr Samuel Okafor', gdc: '301557' },
  { id: 'lee', name: 'Dr Hannah Lee', gdc: '276204' },
];
export const clinicianName = (id: string) => CLINICIANS.find(c => c.id === id)?.name ?? id;

export const PATIENTS = [
  { id: 'P-10231', name: 'Amelia Taylor', dob: '14/03/1988' },
  { id: 'P-10188', name: 'James Williams', dob: '02/11/1951' },
  { id: 'P-10342', name: 'Maya Patel', dob: '21/07/1994' },
  { id: 'P-10077', name: 'Daniel Morgan', dob: '09/01/1969' },
  { id: 'P-10415', name: 'Sara Khan', dob: '30/05/1990' },
  { id: 'P-10290', name: 'Rhys Evans', dob: '17/09/1976' },
  { id: 'P-10356', name: 'Lucy Chen', dob: '05/12/2006' },
  { id: 'P-10119', name: 'Petra Novak', dob: '28/02/1982' },
  { id: 'P-10402', name: 'Ella Brooks', dob: '11/04/1958' },
  { id: 'P-10450', name: 'Tom Hughes', dob: '03/08/1985' },
];
export const patientById = (id: string) => PATIENTS.find(p => p.id === id)!;
export const initials = (name: string) =>
  name.replace(/^Dr\s+/, '').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
/** "Amelia Taylor" → "A. Taylor" — how lab work lists patients. */
export const shortName = (name: string) => {
  const parts = name.split(' ');
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

export const SERVICES = ['Crown', 'Bridge', 'Veneer', 'Inlay / onlay', 'Implant restoration', 'Full denture', 'Partial denture', 'Retainer', 'Night guard', 'Whitening trays'];
export const MATERIALS = ['Layered zirconia', 'Monolithic zirconia', 'Lithium disilicate (e.max)', 'Porcelain fused to metal', 'Full gold', 'Acrylic', 'Cobalt chrome', 'Flexible nylon', 'PMMA temporary'];
export const SHADES = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'C1', 'C2', 'D2', 'D3', 'BL1', 'BL2'];
export const COURIERS = ["Lab's own courier", 'Royal Mail Special Delivery', 'DPD', 'DHL Express', 'Hand delivered', 'Other'];
export const STORAGE = ['Lab work drawer', 'Surgery 1', 'Surgery 2', 'Reception'];
export const RECEIVE_CHECKS = [
  { id: 'complete', label: 'Work undamaged and complete', required: true },
  { id: 'models', label: 'Models, impressions or bite blocks returned', required: false },
  { id: 'som', label: 'Statement of manufacture / delivery note included', required: true },
];
export const PROBLEMS = ['Damaged in transit', 'Wrong shade', 'Missing items', 'Doesn’t match prescription', 'Wrong patient / case', 'Other'];

// ─── Lab work ───────────────────────────────────────────────────────────────

/** Where the work physically is. Questions and lateness are flags on top. */
export type Stage = 'ready' | 'dispatched' | 'at-lab' | 'production' | 'shipped' | 'received';
export const STAGES: { id: Stage; label: string; short: string }[] = [
  { id: 'ready', label: 'Ready to dispatch', short: 'Ready' },
  { id: 'dispatched', label: 'Dispatched to lab', short: 'Dispatched' },
  { id: 'at-lab', label: 'Received by lab', short: 'At lab' },
  { id: 'production', label: 'In production', short: 'Production' },
  { id: 'shipped', label: 'Shipped by lab', short: 'Shipped' },
  { id: 'received', label: 'Received at practice', short: 'Received' },
];
export const stageIndex = (s: Stage) => STAGES.findIndex(x => x.id === s);

export interface CaseEvent { stage: Stage | 'authorised' | 'note'; at: string; by: string; text?: string }
export interface Message { from: 'lab' | 'practice'; author: string; text: string; at: string }

export interface LabCase {
  id: string;
  patientId: string;
  practice: PracticeId;
  lab: string;
  clinician: string;
  createdBy: string;
  service: string;
  teeth: string[];
  material: string;
  shade?: string;
  stumpShade?: string;
  funding: 'NHS' | 'Private';
  instructions: string;
  returnBy: string;
  stage: Stage;
  attachments: string[];
  events: CaseEvent[];
  messages: Message[];
  /** Lab is waiting on the practice. */
  questionOpen?: boolean;
  chasedAt?: string;
  problem?: string;
  dispatch?: { courier: string; tracking?: string; bags: number; notes?: string };
  receipt?: { storedIn: string; comment?: string };
  source: 'manual' | 'photo';
  /** The patient appointment this work is for — what the clinician plans around. */
  appointment?: Appointment;
  /** Further items on the same prescription (multi-service case). The first item is service/teeth/material above. */
  items?: RxItem[];
}

export interface RxItem { service: string; teeth: string[]; material: string; shade?: string }
/** "Crown UR6" or "Veneer UR1, UL1 +1" for multi-service cases. */
export const caseTitle = (c: LabCase) => `${c.service} ${c.teeth.join(', ')}${c.items?.length ? ` +${c.items.length}` : ''}`;
export const allItems = (c: LabCase): RxItem[] => [{ service: c.service, teeth: c.teeth, material: c.material, shade: c.shade }, ...(c.items ?? [])];

export interface Appointment { at: string; kind: 'Fit' | 'Try-in' | 'Issue'; room: string }

const DAY = 864e5;
const at = (days: number, h = 9, m = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const SEED_CASES: LabCase[] = [
  {
    id: 'SG-28497', appointment: { at: at(12, 14, 0), kind: 'Try-in', room: 'Surgery 2' }, patientId: 'P-10402', practice: 'isc', lab: 'precision', clinician: 'okafor', createdBy: 'Dr Samuel Okafor',
    service: 'Partial denture', teeth: ['Upper arch'], material: 'Cobalt chrome', funding: 'NHS',
    instructions: 'Cobalt chrome framework, clasps on UR5 and UL6. Try-in before finish please.',
    returnBy: at(10), stage: 'ready', attachments: ['Prescription.pdf', 'Upper impression photo'], source: 'manual',
    events: [{ stage: 'authorised', at: at(0, 8, 31), by: 'Dr Samuel Okafor' }], messages: [],
  },
  {
    id: 'SG-28491', appointment: { at: at(7, 10, 30), kind: 'Fit', room: 'Surgery 1' }, patientId: 'P-10231', practice: 'cds', lab: 'northstar', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Crown', teeth: ['UR6'], material: 'Layered zirconia', shade: 'A2', stumpShade: 'ND3', funding: 'Private',
    instructions: 'Light contacts mesial and distal. Natural characterisation, slight translucency at the incisal third.',
    returnBy: at(6), stage: 'ready', attachments: ['Prescription photo', 'Shade photo'], source: 'photo',
    events: [{ stage: 'authorised', at: at(-1, 16, 22), by: 'Dr Olivia Reed' }], messages: [],
  },
  {
    id: 'SG-28488', appointment: { at: at(0, 15, 30), kind: 'Issue', room: 'Surgery 2' }, patientId: 'P-10188', practice: 'isc', lab: 'precision', clinician: 'okafor', createdBy: 'Dr Samuel Okafor',
    service: 'Full denture', teeth: ['Both arches'], material: 'Acrylic', shade: 'A3', funding: 'NHS',
    instructions: 'Final finish after successful try-in. Patient prefers slightly lighter teeth than try-in.',
    returnBy: at(0, 10), stage: 'shipped', attachments: ['Prescription.pdf', 'Try-in notes'], source: 'manual',
    events: [
      { stage: 'authorised', at: at(-9, 10, 16), by: 'Dr Samuel Okafor' },
      { stage: 'dispatched', at: at(-9, 15, 40), by: 'Reception' },
      { stage: 'at-lab', at: at(-8, 9, 5), by: 'Precision Dental Works' },
      { stage: 'production', at: at(-7, 11, 0), by: 'Precision Dental Works' },
      { stage: 'shipped', at: at(-1, 16, 10), by: 'Precision Dental Works', text: 'DPD · 1 box' },
    ],
    messages: [],
  },
  {
    id: 'SG-28485', appointment: { at: at(4, 9, 0), kind: 'Fit', room: 'Surgery 1' }, patientId: 'P-10342', practice: 'cds', lab: 'northstar', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Night guard', teeth: ['Upper arch'], material: 'Acrylic', funding: 'Private',
    instructions: 'Hard acrylic, 2 mm, canine guidance.',
    returnBy: at(3, 17), stage: 'production', attachments: ['Prescription photo', 'Bite registration'], source: 'photo', questionOpen: true,
    events: [
      { stage: 'authorised', at: at(-6, 9, 12), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-6, 14, 2), by: 'Dr Olivia Reed' },
      { stage: 'at-lab', at: at(-5, 8, 48), by: 'Northstar Dental Lab' },
      { stage: 'production', at: at(-4, 10, 30), by: 'Northstar Dental Lab' },
    ],
    messages: [
      { from: 'lab', author: 'Ben Ashworth · Northstar', text: 'The bite registration looks distorted on the left side. Can you confirm the occlusal vertical you want, or send a new bite? We’ve paused the case until then.', at: at(0, 7, 48) },
    ],
  },
  {
    id: 'SG-28479', appointment: { at: at(1, 10, 0), kind: 'Fit', room: 'Surgery 2' }, patientId: 'P-10077', practice: 'isc', lab: 'brightarch', clinician: 'lee', createdBy: 'Dr Hannah Lee',
    service: 'Implant restoration', teeth: ['LL6'], material: 'Monolithic zirconia', shade: 'A3', funding: 'Private',
    instructions: 'Screw-retained on Straumann BL RC. Scan body and analogue enclosed.',
    returnBy: at(-2, 17), stage: 'at-lab', attachments: ['Prescription.pdf', 'Intraoral scan link'], source: 'manual',
    events: [
      { stage: 'authorised', at: at(-14, 11, 5), by: 'Dr Hannah Lee' },
      { stage: 'dispatched', at: at(-13, 15, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-12, 9, 20), by: 'Bright Arch Laboratory' },
    ],
    messages: [],
  },
  {
    id: 'SG-28472', appointment: { at: at(9, 11, 0), kind: 'Try-in', room: 'Surgery 1' }, patientId: 'P-10415', practice: 'cds', lab: 'northstar', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Veneer', teeth: ['UR1', 'UL1'], material: 'Lithium disilicate (e.max)', shade: 'BL2', funding: 'Private',
    items: [{ service: 'Whitening trays', teeth: ['Both arches'], material: 'Flexible nylon' }],
    instructions: 'Match to digital smile design. Minimal prep. Feldspathic look.',
    returnBy: at(8), stage: 'dispatched', attachments: ['Prescription photo', 'DSD mock-up.pdf'], source: 'photo',
    dispatch: { courier: 'DHL Express', tracking: 'JD014600006281', bags: 1 },
    events: [
      { stage: 'authorised', at: at(-1, 10, 2), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-1, 15, 30), by: 'Dr Olivia Reed', text: 'DHL Express · JD014600006281' },
    ],
    messages: [],
  },
  {
    id: 'SG-28466', appointment: { at: at(0, 11, 40), kind: 'Fit', room: 'Surgery 1' }, patientId: 'P-10290', practice: 'cds', lab: 'precision', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Bridge', teeth: ['LR4', 'LR5', 'LR6'], material: 'Porcelain fused to metal', shade: 'A3.5', funding: 'NHS',
    instructions: 'Three-unit bridge, LR5 pontic, modified ridge lap.',
    returnBy: at(0, 12), stage: 'shipped', attachments: ['Prescription.pdf'], source: 'manual',
    events: [
      { stage: 'authorised', at: at(-10, 9, 0), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-10, 16, 15), by: 'Reception' },
      { stage: 'at-lab', at: at(-9, 9, 30), by: 'Precision Dental Works' },
      { stage: 'production', at: at(-8, 10, 0), by: 'Precision Dental Works' },
      { stage: 'shipped', at: at(-1, 14, 45), by: 'Precision Dental Works', text: 'Royal Mail Special Delivery' },
    ],
    messages: [],
  },
  {
    id: 'SG-28460', appointment: { at: at(0, 9, 15), kind: 'Issue', room: 'Surgery 2' }, patientId: 'P-10356', practice: 'isc', lab: 'brightarch', clinician: 'lee', createdBy: 'Dr Hannah Lee',
    service: 'Retainer', teeth: ['Both arches'], material: 'Acrylic', funding: 'Private',
    instructions: 'Essix retainers, 1 mm, upper and lower.',
    returnBy: at(-1), stage: 'received', attachments: ['Prescription.pdf'], source: 'manual',
    receipt: { storedIn: 'Lab work drawer' },
    events: [
      { stage: 'authorised', at: at(-12, 10, 0), by: 'Dr Hannah Lee' },
      { stage: 'dispatched', at: at(-12, 15, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-11, 9, 0), by: 'Bright Arch Laboratory' },
      { stage: 'production', at: at(-10, 9, 0), by: 'Bright Arch Laboratory' },
      { stage: 'shipped', at: at(-3, 13, 0), by: 'Bright Arch Laboratory' },
      { stage: 'received', at: at(-2, 10, 20), by: 'Reception', text: 'Stored in Lab work drawer' },
    ],
    messages: [],
  },
  {
    id: 'SG-28452', patientId: 'P-10119', practice: 'isc', lab: 'northstar', clinician: 'okafor', createdBy: 'Dr Samuel Okafor',
    service: 'Inlay / onlay', teeth: ['UL7'], material: 'Full gold', funding: 'Private',
    instructions: 'Gold onlay, cover distobuccal cusp.',
    returnBy: at(-9), stage: 'received', attachments: ['Prescription.pdf'], source: 'manual',
    receipt: { storedIn: 'Surgery 2' },
    events: [
      { stage: 'authorised', at: at(-20, 10, 0), by: 'Dr Samuel Okafor' },
      { stage: 'dispatched', at: at(-20, 15, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-19, 9, 0), by: 'Northstar Dental Lab' },
      { stage: 'production', at: at(-18, 9, 0), by: 'Northstar Dental Lab' },
      { stage: 'shipped', at: at(-11, 13, 0), by: 'Northstar Dental Lab' },
      { stage: 'received', at: at(-10, 11, 0), by: 'Reception', text: 'Stored in Surgery 2' },
    ],
    messages: [],
  },
];

export const isOverdue = (c: LabCase) =>
  c.stage !== 'received' && c.stage !== 'shipped' && new Date(c.returnBy).getTime() < Date.now();

/** The one thing the practice should do next — drives the case's CTA. */
export type NextAction = 'dispatch' | 'reply' | 'chase' | 'check-in' | 'wait' | 'done';
export function nextAction(c: LabCase): NextAction {
  if (c.stage === 'ready') return 'dispatch';
  if (c.questionOpen) return 'reply';
  if (c.stage === 'shipped') return 'check-in';
  if (isOverdue(c) && !c.chasedAt) return 'chase';
  if (c.stage === 'received') return 'done';
  return 'wait';
}

/** Will the work be in the practice for the patient's appointment?
 *  This is the clinician's question; stages are the lab's. */
export type ReadinessLevel = 'in-practice' | 'arriving' | 'on-track' | 'attention' | 'at-risk';
export interface Readiness { level: ReadinessLevel; label: string; detail: string }
export function readiness(c: LabCase): Readiness {
  if (c.stage === 'received') return { level: 'in-practice', label: 'In practice', detail: c.receipt ? `In ${c.receipt.storedIn.toLowerCase()}` : 'Checked in' };
  const appt = c.appointment ? new Date(c.appointment.at).getTime() : null;
  const due = new Date(c.returnBy).getTime();
  if (isOverdue(c)) {
    const n = Math.max(1, -dayOffset(c.returnBy));
    return { level: 'at-risk', label: 'Late', detail: `Lab is ${n} day${n > 1 ? 's' : ''} late${c.chasedAt ? ' · chased' : ''}` };
  }
  if (appt && due > appt) return { level: 'at-risk', label: 'At risk', detail: `Due back ${fmtTime(c.returnBy)}, after the ${c.appointment!.kind.toLowerCase()}` };
  if (c.questionOpen) return { level: 'attention', label: 'Lab waiting', detail: 'Lab has a question for you' };
  if (c.stage === 'ready') return { level: 'attention', label: 'Ready to dispatch', detail: 'Still at the practice, not sent to the lab yet' };
  if (c.stage === 'shipped') return { level: 'arriving', label: 'Arriving', detail: `Due ${relDay(c.returnBy).toLowerCase()}` };
  return { level: 'on-track', label: 'On track', detail: `Back ${relDay(c.returnBy).toLowerCase()}` };
}
export const READINESS_ORDER: ReadinessLevel[] = ['at-risk', 'attention', 'arriving', 'on-track', 'in-practice'];

/** Day buckets used to group work by appointment. */
export function dayOffset(iso: string) {
  const s = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  return Math.round((s(new Date(iso)) - s(new Date())) / DAY);
}

export type Attention = 'ready' | 'arriving' | 'questions' | 'overdue';
export const ATTENTION: { id: Attention; label: string; hint: string }[] = [
  { id: 'ready', label: 'Ready to dispatch', hint: 'Print label and book courier' },
  { id: 'arriving', label: 'Arriving from lab', hint: 'Check in on arrival' },
  { id: 'questions', label: 'Lab questions', hint: 'Reply to the lab' },
  { id: 'overdue', label: 'Overdue lab work', hint: 'Chase the lab' },
];
export const matchesAttention = (c: LabCase, a: Attention) =>
  a === 'ready' ? c.stage === 'ready'
  : a === 'arriving' ? c.stage === 'shipped'
  : a === 'questions' ? !!c.questionOpen
  : isOverdue(c);

// ─── Finance ────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'to-approve' | 'needs-review' | 'queried' | 'approved' | 'rejected';
export type CheckState = 'pass' | 'warn' | 'fail';
export interface Invoice {
  id: string;
  supplier: string;
  practice: PracticeId;
  net: number;
  vat: number;
  status: InvoiceStatus;
  received: string;
  due: string;
  source: string;
  caseId?: string;
  lines: { label: string; qty: number; unit: number }[];
  checks: { label: string; detail: string; state: CheckState }[];
  activity: { text: string; at: string }[];
}

export const SEED_INVOICES: Invoice[] = [
  {
    id: 'PDW-7731', supplier: 'Precision Dental Works', practice: 'isc', net: 1940, vat: 388, status: 'needs-review',
    received: at(-1, 11, 41), due: at(13), source: 'Received via supplier upload', caseId: 'SG-28488',
    lines: [
      { label: 'Full denture · J. Williams', qty: 1, unit: 1290 },
      { label: 'Remake — upper denture', qty: 1, unit: 650 },
    ],
    checks: [
      { label: 'Lab order match', detail: 'Matches SG-28488', state: 'pass' },
      { label: 'Duplicate check', detail: 'No matching invoice found', state: 'pass' },
      { label: 'Supplier VAT number', detail: 'GB 419 2210 55 verified', state: 'pass' },
      { label: 'Amount vs usual', detail: '38% above usual for full dentures — remake line not on lab order', state: 'warn' },
    ],
    activity: [{ text: 'Received via supplier upload', at: at(-1, 11, 41) }, { text: 'Amount anomaly flagged', at: at(-1, 11, 42) }],
  },
  {
    id: 'NDL-10482', supplier: 'Northstar Dental Lab', practice: 'cds', net: 1070, vat: 214, status: 'to-approve',
    received: at(-2, 9, 13), due: at(12), source: 'Received via email and read automatically', caseId: 'SG-28452',
    lines: [
      { label: 'Gold onlay · P. Novak', qty: 1, unit: 820 },
      { label: 'Implant components · D. Morgan', qty: 1, unit: 250 },
    ],
    checks: [
      { label: 'Lab order match', detail: 'Matches SG-28452, received at practice', state: 'pass' },
      { label: 'Duplicate check', detail: 'No matching invoice found', state: 'pass' },
      { label: 'Supplier VAT number', detail: 'GB 284 1192 07 verified', state: 'pass' },
      { label: 'Amount vs usual', detail: 'Within normal range', state: 'pass' },
    ],
    activity: [{ text: 'Received via email and read automatically', at: at(-2, 9, 13) }, { text: 'All checks passed', at: at(-2, 9, 14) }],
  },
  {
    id: 'HSD-55120', supplier: 'Henry Schein Dental', practice: 'cds', net: 642.5, vat: 128.5, status: 'to-approve',
    received: at(-3, 14, 2), due: at(20), source: 'Received via email and read automatically',
    lines: [
      { label: 'Nitrile gloves (M) × 20 boxes', qty: 20, unit: 8.75 },
      { label: 'Composite A2 syringes', qty: 10, unit: 46.75 },
    ],
    checks: [
      { label: 'Purchase order match', detail: 'PO-4471 · all lines delivered', state: 'pass' },
      { label: 'Duplicate check', detail: 'No matching invoice found', state: 'pass' },
      { label: 'Supplier VAT number', detail: 'GB 652 8810 13 verified', state: 'pass' },
      { label: 'Amount vs usual', detail: 'Within normal range', state: 'pass' },
    ],
    activity: [{ text: 'Received via email and read automatically', at: at(-3, 14, 2) }],
  },
  {
    id: 'DE-2026-118', supplier: 'Dentaurum GmbH', practice: 'isc', net: 1320, vat: 0, status: 'queried',
    received: at(-5, 16, 45), due: at(9), source: 'Received via email',
    lines: [{ label: 'Orthodontic wire assortment', qty: 4, unit: 330 }],
    checks: [
      { label: 'Duplicate check', detail: 'Possible duplicate of DE-2026-112 (same amount)', state: 'fail' },
      { label: 'Reverse charge VAT', detail: 'Zero-rated EU supply noted', state: 'pass' },
    ],
    activity: [{ text: 'Received via email', at: at(-5, 16, 45) }, { text: 'Queried by Emily Morris: possible duplicate', at: at(-4, 10, 5) }],
  },
  {
    id: 'BAL-2209', supplier: 'Bright Arch Laboratory', practice: 'isc', net: 480, vat: 96, status: 'approved',
    received: at(-8, 10, 0), due: at(6), source: 'Received via supplier upload', caseId: 'SG-28460',
    lines: [{ label: 'Retainers (pair) · L. Chen', qty: 1, unit: 480 }],
    checks: [
      { label: 'Lab order match', detail: 'Matches SG-28460', state: 'pass' },
      { label: 'Duplicate check', detail: 'No matching invoice found', state: 'pass' },
    ],
    activity: [{ text: 'Received via supplier upload', at: at(-8, 10, 0) }, { text: 'Approved by Dr Olivia Reed', at: at(-7, 9, 30) }],
  },
];

export type LineState = 'matched' | 'difference' | 'missing' | 'resolved';
export interface Statement {
  id: string;
  supplier: string;
  practice: PracticeId;
  period: string;
  balance: number;
  status: 'to-review' | 'reconciled';
  lines: { ref: string; amount: number; state: LineState; note?: string; resolution?: string }[];
}

export const SEED_STATEMENTS: Statement[] = [
  {
    id: 'ST-DSU-0926', supplier: 'Dental Supplies UK', practice: 'cds', period: 'September 2026', balance: 8420.16, status: 'to-review',
    lines: [
      { ref: 'DSU-44120', amount: 2310.4, state: 'matched' },
      { ref: 'DSU-44176', amount: 1985, state: 'matched' },
      { ref: 'DSU-44203', amount: 1640.76, state: 'difference', note: 'Our invoice shows £1,604.76 (£36.00 difference)' },
      { ref: 'DSU-44251', amount: 2484, state: 'missing', note: 'No invoice received for this reference' },
    ],
  },
  {
    id: 'ST-NDL-0926', supplier: 'Northstar Dental Lab', practice: 'cds', period: 'September 2026', balance: 3204, status: 'to-review',
    lines: [
      { ref: 'NDL-10377', amount: 960, state: 'matched' },
      { ref: 'NDL-10401', amount: 960, state: 'matched' },
      { ref: 'NDL-10455', amount: 1284, state: 'matched' },
    ],
  },
];

export const INVOICE_REASONS = ['Price differs from quote', 'Not on lab order / PO', 'Possible duplicate', 'Work not received', 'Wrong practice or entity', 'VAT incorrect'];
export const EXCEPTION_RESOLUTIONS = ['Requested copy invoice from supplier', 'Invoice found and linked', 'Not ours — queried with supplier', 'Credit note requested for difference', 'Accept supplier amount'];

// ─── Formatting ─────────────────────────────────────────────────────────────

export const gbp = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
/** 12-hour clock: "9:15 am". */
export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
};
/** Same, split for stacked time columns: ["9:15", "am"]. */
export const fmtTimeParts = (iso: string) => fmtTime(iso).split(' ') as [string, string];
export const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
export const fmtDateTime = (iso: string) => `${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${fmtTime(iso)}`;
/** "Today", "Tomorrow", "in 6 days", "2 days late". */
export function relDay(iso: string) {
  const start = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const diff = Math.round((start(new Date(iso)) - start(new Date())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
export const nowIso = () => new Date().toISOString();
