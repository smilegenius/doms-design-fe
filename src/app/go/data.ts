// ─── Smile Genius Go — demo data ─────────────────────────────────────────────
// Seed data for the clinician mobile prototype. Dates are relative to "now"
// so the Needs-attention counts (overdue, arriving today…) always make sense.
import {
  SERVICE_CATEGORIES as WEB_SERVICE_CATEGORIES, CASE_SOURCES as WEB_CASE_SOURCES, MATERIAL_TYPES, TOOTH_SHADES, IMPLANT_BRAND_CATALOG,
  IMPLANT_ABUTMENT_MATERIALS, RETAINER_TYPES, OCCLUSION_CLASSES, OCCLUSION_SIDES, YES_NO, ALIGNER_DURATIONS, ALIGNER_INCISAL_EDGE,
  ALIGNER_CROWDING, ALIGNER_SPACING, ALIGNER_OVERJET, ALIGNER_OVERBITE, ALIGNER_OPENBITE, ALIGNER_CROSSBITE, ALIGNER_MIDLINE,
  ALIGNER_BIOTYPE, MILLERS_CLASS, DENTURE_STAGES, getApplianceConfig, getCategoryForItem,
} from '../pages/CreateCasePage';

export type PracticeId = 'cds' | 'isc';
export const PRACTICES: { id: PracticeId; name: string; area: string }[] = [
  { id: 'cds', name: 'Camden Dental Studio', area: 'Camden, London' },
  { id: 'isc', name: 'Islington Smile Care', area: 'Islington, London' },
];
export const practiceName = (id: PracticeId) => PRACTICES.find(p => p.id === id)!.name;

export interface Lab { id: string; name: string; town: string; offline?: boolean; email?: string; phone?: string }
// Mutable so a lab added on the spot (offline lab) is found everywhere.
export const LABS: Lab[] = [
  { id: 'northstar', name: 'Northstar Dental Lab', town: 'Leeds' },
  { id: 'precision', name: 'Precision Dental Works', town: 'Manchester' },
  { id: 'brightarch', name: 'Bright Arch Laboratory', town: 'Bristol' },
  { id: 'harbour', name: 'Harbour Dental Ceramics', town: 'Plymouth', offline: true },
];
export function addLab(l: Omit<Lab, 'id' | 'offline'>): string {
  const id = `lab-${Date.now().toString(36)}`;
  LABS.push({ ...l, id, offline: true });
  return id;
}
export const labName = (id: string) => LABS.find(l => l.id === id)?.name ?? id;

export const CLINICIANS = [
  { id: 'reed', name: 'Dr Olivia Reed', gdc: '284119' },
  { id: 'okafor', name: 'Dr Samuel Okafor', gdc: '301557' },
  { id: 'lee', name: 'Dr Hannah Lee', gdc: '276204' },
];
export const clinicianName = (id: string) => CLINICIANS.find(c => c.id === id)?.name ?? id;

export interface Patient { id: string; name: string; dob: string; email?: string; phone?: string; gender?: string; isNew?: boolean }
// Mutable so a patient created on the spot is found everywhere.
export const PATIENTS: Patient[] = [
  { id: 'P-10231', name: 'Amelia Taylor', dob: '14/03/1988', gender: 'Female', phone: '+44 7700 900231', email: 'amelia.taylor@example.com' },
  { id: 'P-10188', name: 'James Williams', dob: '02/11/1951', gender: 'Male', phone: '+44 7700 900188', email: 'james.williams@example.com' },
  { id: 'P-10342', name: 'Maya Patel', dob: '21/07/1994', gender: 'Female', phone: '+44 7700 900342', email: 'maya.patel@example.com' },
  { id: 'P-10077', name: 'Daniel Morgan', dob: '09/01/1969', gender: 'Male', phone: '+44 7700 900077', email: 'daniel.morgan@example.com' },
  { id: 'P-10415', name: 'Sara Khan', dob: '30/05/1990', gender: 'Female', phone: '+44 7700 900415', email: 'sara.khan@example.com' },
  { id: 'P-10290', name: 'Rhys Evans', dob: '17/09/1976', gender: 'Male', phone: '+44 7700 900290', email: 'rhys.evans@example.com' },
  { id: 'P-10356', name: 'Lucy Chen', dob: '05/12/2006', gender: 'Female', phone: '+44 7700 900356', email: 'lucy.chen@example.com' },
  { id: 'P-10119', name: 'Petra Novak', dob: '28/02/1982', gender: 'Female', phone: '+44 7700 900119', email: 'petra.novak@example.com' },
  { id: 'P-10402', name: 'Ella Brooks', dob: '11/04/1958', gender: 'Female', phone: '+44 7700 900402', email: 'ella.brooks@example.com' },
  { id: 'P-10450', name: 'Tom Hughes', dob: '03/08/1985', gender: 'Male', phone: '+44 7700 900450', email: 'tom.hughes@example.com' },
];
export const patientById = (id: string) => PATIENTS.find(p => p.id === id)!;
export function addPatient(p: Omit<Patient, 'id' | 'isNew'> & { id?: string }): string {
  const id = p.id || `P-${10500 + PATIENTS.length}`;
  PATIENTS.push({ ...p, id, isNew: true });
  return id;
}
export const initials = (name: string) =>
  name.replace(/^Dr\s+/, '').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
/** "Amelia Taylor" → "A. Taylor" — how lab work lists patients. */
export const shortName = (name: string) => {
  const parts = name.split(' ');
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

// ─── Service catalogue + per-service fields — straight from the web portal ──
// Everything below is imported from the clinic/lab create-case form
// (pages/CreateCasePage.tsx) so the app always asks for exactly what the
// portal asks for: same services, materials, shades, implant systems,
// orthodontic / aligner / denture / appliance options.
export const SERVICE_CATEGORIES = WEB_SERVICE_CATEGORIES;
export { IMPLANT_BRAND_CATALOG };
export const MATERIALS = MATERIAL_TYPES;
export const SHADES = TOOTH_SHADES;
export const OTHER_SPECIFY = 'Other (specify)';

const findItem = (itemId: string) => WEB_SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === itemId);
/** Display name — bridge items read better with their category ("Bridge · Pontic"). */
export const serviceLabel = (itemId: string) => {
  const it = findItem(itemId);
  if (!it) return itemId;
  return getCategoryForItem(itemId) === 'bridge' ? `Bridge · ${it.label}` : it.label;
};
export const categoryLabel = (itemId: string) => WEB_SERVICE_CATEGORIES.find(c => c.id === getCategoryForItem(itemId))?.label ?? 'Others';
/** Map a free-form service name (e.g. read from a photo) onto a catalogue item. */
export const itemIdForLabel = (label: string) => {
  const l = label.toLowerCase();
  const all = WEB_SERVICE_CATEGORIES.flatMap(c => c.items);
  return all.find(i => i.label.toLowerCase() === l)?.id
    ?? all.find(i => l.includes(i.label.toLowerCase()) || i.label.toLowerCase().includes(l))?.id
    ?? 'ot-other';
};
/** Orthodontics and appliances don't take material + shade (as on the web form). */
export const needsMaterial = (itemId: string) => !['orthodontics', 'appliances'].includes(getCategoryForItem(itemId) ?? '');
/** "Others" takes material + shade as free text, like the web form. */
export const freeTextMaterial = (itemId: string) => getCategoryForItem(itemId) === 'others';

export interface DetailField {
  key: string;
  label: string;
  kind: 'chips' | 'multi' | 'text' | 'textarea' | 'brand' | 'occlusion';
  options?: string[];
  required?: boolean;
}
const occlusion = (key: string, label: string): DetailField => ({ key, label, kind: 'occlusion', options: OCCLUSION_CLASSES });
/** The category-specific fields for one service — same set and required rules as the web form. */
export function detailFields(itemId: string): DetailField[] {
  const cat = getCategoryForItem(itemId);
  if (cat === 'bridge') return [
    { key: 'brand', label: 'Implant system', kind: 'brand', required: true },
    { key: 'abutmentMaterial', label: 'Implant abutment material', kind: 'chips', options: IMPLANT_ABUTMENT_MATERIALS, required: true },
  ];
  if (itemId === 'or-retainers') return [
    { key: 'retainerType', label: 'Retainer type', kind: 'chips', options: RETAINER_TYPES, required: true },
    occlusion('anglesClass', 'Angle’s class'), occlusion('skeletalClass', 'Skeletal'), occlusion('dentalClass', 'Dental'),
  ];
  if (itemId === 'or-clear-aligners') return [
    { key: 'alignerDuration', label: 'Aligner duration', kind: 'chips', options: ALIGNER_DURATIONS },
    { key: 'phasing', label: 'Phasing', kind: 'chips', options: YES_NO },
    { key: 'ipr', label: 'IPR', kind: 'chips', options: YES_NO },
    { key: 'attachment', label: 'Attachments', kind: 'chips', options: YES_NO },
    { key: 'incisalEdge', label: 'Incisal edge alignment', kind: 'chips', options: ALIGNER_INCISAL_EDGE },
    { key: 'crowding', label: 'Crowding', kind: 'chips', options: ALIGNER_CROWDING },
    { key: 'spacing', label: 'Spacing', kind: 'chips', options: ALIGNER_SPACING },
    { key: 'overjet', label: 'Overjet', kind: 'chips', options: ALIGNER_OVERJET },
    { key: 'overbite', label: 'Overbite', kind: 'chips', options: ALIGNER_OVERBITE },
    { key: 'openbite', label: 'Openbite', kind: 'chips', options: ALIGNER_OPENBITE },
    { key: 'crossbite', label: 'Crossbite', kind: 'chips', options: ALIGNER_CROSSBITE },
    { key: 'midline', label: 'Midline', kind: 'chips', options: ALIGNER_MIDLINE },
    { key: 'biotype', label: 'Biotype', kind: 'chips', options: ALIGNER_BIOTYPE },
    { key: 'millersClass', label: 'Miller’s class', kind: 'chips', options: MILLERS_CLASS },
    occlusion('anglesClass', 'Angle’s class'), occlusion('skeletalClass', 'Skeletal'), occlusion('dentalClass', 'Dental'),
    { key: 'alignerItems', label: 'Additional items', kind: 'textarea' },
  ];
  if (cat === 'denture') return [{ key: 'stages', label: 'Stage', kind: 'multi', options: DENTURE_STAGES, required: true }];
  if (cat === 'appliances') {
    const cfg = getApplianceConfig(itemId);
    return cfg ? [{ key: 'applianceOption', label: cfg.label, kind: 'chips', options: cfg.options, required: true }] : [];
  }
  if (cat === 'others') return [{ key: 'customServiceName', label: 'Service name', kind: 'text', required: true }];
  return [];
}
export { OCCLUSION_SIDES };
export const CASE_SOURCES = [...WEB_CASE_SOURCES.filter(s => s !== 'Other'), 'Photo of lab form', 'Voice note', 'Other'];
export const COURIERS = ["Lab's own courier", 'Royal Mail Special Delivery', 'DPD', 'DHL Express', 'Hand delivered', 'Other'];
export const STORAGE = ['Lab work drawer', 'Surgery 1', 'Surgery 2', 'Reception'];
export const RECEIVE_CHECKS = [
  { id: 'complete', label: 'Work undamaged and complete', required: false },
  { id: 'models', label: 'Models, impressions or bite blocks returned', required: false },
  { id: 'som', label: 'Statement of manufacture or delivery note included', required: false },
];
export const PROBLEMS = ['Damaged in transit', 'Wrong shade', 'Missing items', 'Doesn’t match the case', 'Wrong patient or case', 'Other'];

// ─── Lab work ───────────────────────────────────────────────────────────────

/** Where the work physically is. Questions and lateness are flags on top. */
/** 'draft' = saved but not submitted yet (not part of the lab progress rail). */
export type Stage = 'draft' | 'ready' | 'dispatched' | 'at-lab' | 'production' | 'shipped' | 'received';
export const STAGES: { id: Stage; label: string; short: string }[] = [
  { id: 'ready', label: 'Ready to dispatch', short: 'Ready' },
  { id: 'dispatched', label: 'Dispatched to lab', short: 'Dispatched' },
  { id: 'at-lab', label: 'Received by lab', short: 'At lab' },
  { id: 'production', label: 'In production', short: 'Production' },
  { id: 'shipped', label: 'Shipped by lab', short: 'Shipped' },
  { id: 'received', label: 'Received at practice', short: 'Received' },
];
export const stageIndex = (s: Stage) => STAGES.findIndex(x => x.id === s);
export const stageLabel = (s: Stage) => (s === 'draft' ? 'Draft' : STAGES[stageIndex(s)].label);

/** The lab's own status list (lab portal). Only the lab can change it — the
 *  practice sees it read-only and talks to the lab through Comments. */
export type LabStatus = 'Received' | 'Under Review' | 'On Hold (Lab)' | 'On Hold (Practice)' | 'Accepted' | 'In Queue'
  | 'In Production' | 'Quality Control' | 'Shipped' | 'Delivered' | 'Not Approved' | 'Cancelled';
/** Lab status as the practice sees it. null = the lab hasn't received the case yet. */
export function labStatusOf(c: LabCase): LabStatus | null {
  if (c.onHold) return c.onHold.side === 'Lab' ? 'On Hold (Lab)' : 'On Hold (Practice)';
  if (c.labStatus) return c.labStatus;
  return ({ 'at-lab': 'Accepted', production: 'In Production', shipped: 'Shipped', received: 'Delivered' } as Partial<Record<Stage, LabStatus>>)[c.stage] ?? null;
}

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
  /** Category extra for the first item, e.g. 'Type: Hard'. */
  extra?: string;
  caseSource?: string;
  /** The lab moved the delivery date — the practice should review it (portal: "Delivery date changed"). */
  deliveryChanged?: { from: string; reason?: string };
  /** Set by the lab (lab portal status). Overrides the default derived from the stage. */
  labStatus?: LabStatus;
  /** Put on hold by the lab — only the lab can set or lift it.
   *  side 'Lab' = On Hold (Lab), the lab's own reason; 'Practice' = On Hold (Practice), waiting on the practice. */
  onHold?: { side: 'Lab' | 'Practice'; reason: string; by: string; since: string };
  /** Saved form for a draft case (CaseForm from ManualCase) so it reopens filled in. */
  draftForm?: unknown;
}

export interface RxItem { service: string; teeth: string[]; material: string; shade?: string; extra?: string }
/** "Crown UR6" or "Veneer UR1, UL1 +1" for multi-service cases. */
export const caseTitle = (c: LabCase) => `${c.service} ${c.teeth.join(', ')}${c.items?.length ? ` +${c.items.length}` : ''}`;
export const allItems = (c: LabCase): RxItem[] => [{ service: c.service, teeth: c.teeth, material: c.material, shade: c.shade, extra: c.extra }, ...(c.items ?? [])];

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
    onHold: { side: 'Practice', reason: 'Waiting for the practice to confirm the shade', by: 'Northstar Dental Lab', since: at(0, 9, 0) },
    id: 'SG-28472', appointment: { at: at(9, 11, 0), kind: 'Try-in', room: 'Surgery 1' }, patientId: 'P-10415', practice: 'cds', lab: 'northstar', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Veneer', teeth: ['UR1', 'UL1'], material: 'Lithium disilicate (e.max)', shade: 'BL2', funding: 'Private',
    items: [{ service: 'Whitening trays', teeth: ['Both arches'], material: 'Flexible nylon' }],
    instructions: 'Match to digital smile design. Minimal prep. Feldspathic look.',
    returnBy: at(8), stage: 'at-lab', attachments: ['Prescription photo', 'DSD mock-up.pdf'], source: 'photo',
    dispatch: { courier: 'DHL Express', tracking: 'JD014600006281', bags: 1 },
    events: [
      { stage: 'authorised', at: at(-1, 10, 2), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-1, 15, 30), by: 'Dr Olivia Reed', text: 'DHL Express · JD014600006281' },
      { stage: 'at-lab', at: at(0, 8, 40), by: 'Northstar Dental Lab' },
      { stage: 'note', at: at(0, 9, 0), by: 'Northstar Dental Lab', text: 'Status changed to On Hold (Practice)' },
    ],
    messages: [{ from: 'lab', author: 'Northstar Dental Lab', text: 'We’ve put this case on hold. The mock-up shows BL2 but the lab form says BL3. Which shade should we use?', at: at(0, 9, 0) }],
  },
  {
    id: 'SG-28466', appointment: { at: at(0, 11, 40), kind: 'Fit', room: 'Surgery 1' }, patientId: 'P-10290', practice: 'cds', lab: 'precision', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Bridge', teeth: ['LR4', 'LR5', 'LR6'], material: 'Porcelain fused to metal', shade: 'A3.5', funding: 'NHS',
    instructions: 'Three-unit bridge, LR5 pontic, modified ridge lap.',
    returnBy: at(1, 12), stage: 'shipped', attachments: ['Prescription.pdf'], source: 'manual',
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
  {
    labStatus: 'Quality Control',
    id: 'SG-28503', appointment: { at: at(1, 11, 30), kind: 'Fit', room: 'Surgery 1' }, patientId: 'P-10450', practice: 'cds', lab: 'northstar', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Crown', teeth: ['UL6'], material: 'Monolithic zirconia', shade: 'A2', funding: 'Private',
    instructions: 'Tight contacts, flat fossae for bruxist.',
    returnBy: at(0, 17), stage: 'production', attachments: ['Intraoral scan link'], source: 'manual',
    events: [
      { stage: 'authorised', at: at(-8, 9, 30), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-8, 15, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-7, 9, 10), by: 'Northstar Dental Lab' },
      { stage: 'production', at: at(-6, 10, 0), by: 'Northstar Dental Lab' },
    ],
    messages: [],
  },
  {
    id: 'SG-28506', appointment: { at: at(1, 14, 15), kind: 'Issue', room: 'Surgery 2' }, patientId: 'P-10290', practice: 'cds', lab: 'precision', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Night guard', teeth: ['Lower arch'], material: 'Acrylic', funding: 'Private',
    instructions: 'Soft-lined, 3 mm.',
    returnBy: at(0, 15), stage: 'shipped', attachments: ['Prescription.pdf'], source: 'photo',
    events: [
      { stage: 'authorised', at: at(-9, 9, 0), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-9, 16, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-8, 9, 0), by: 'Precision Dental Works' },
      { stage: 'production', at: at(-7, 9, 0), by: 'Precision Dental Works' },
      { stage: 'shipped', at: at(-1, 15, 20), by: 'Precision Dental Works', text: 'DPD · 1 box' },
    ],
    messages: [],
  },
  {
    labStatus: 'Not Approved',
    id: 'SG-28511', appointment: { at: at(11, 10, 0), kind: 'Fit', room: 'Surgery 1' }, patientId: 'P-10231', practice: 'cds', lab: 'brightarch', clinician: 'reed', createdBy: 'Dr Olivia Reed',
    service: 'Onlay', teeth: ['LL6'], material: 'Lithium disilicate (e.max)', shade: 'A3', funding: 'Private',
    instructions: 'Onlay covering MB and DB cusps.',
    returnBy: at(9), stage: 'at-lab', attachments: ['Prescription.pdf', 'Intraoral scan link'], source: 'manual',
    events: [
      { stage: 'authorised', at: at(-3, 9, 0), by: 'Dr Olivia Reed' },
      { stage: 'dispatched', at: at(-3, 15, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-1, 9, 0), by: 'Bright Arch Laboratory' },
      { stage: 'note', at: at(-1, 11, 0), by: 'Bright Arch Laboratory', text: 'Status changed to Not Approved' },
    ],
    messages: [{ from: 'lab', author: 'Bright Arch Laboratory', text: 'We can’t approve this one: the scan margins on LL6 aren’t clear. Please send a new scan.', at: at(-1, 11, 0) }],
  },
  {
    deliveryChanged: { from: at(3), reason: 'Waiting for the framework to come back from milling' },
    id: 'SG-28514', patientId: 'P-10342', practice: 'isc', lab: 'precision', clinician: 'okafor', createdBy: 'Dr Samuel Okafor',
    service: 'Bridge', teeth: ['UR4', 'UR5', 'UR6'], material: 'Porcelain fused to metal', shade: 'A2', funding: 'NHS',
    instructions: 'Three-unit bridge, UR5 pontic.',
    returnBy: at(6), stage: 'production', attachments: ['Prescription.pdf'], source: 'manual',
    events: [
      { stage: 'authorised', at: at(-6, 9, 0), by: 'Dr Samuel Okafor' },
      { stage: 'dispatched', at: at(-6, 15, 0), by: 'Reception' },
      { stage: 'at-lab', at: at(-5, 9, 0), by: 'Precision Dental Works' },
      { stage: 'production', at: at(-4, 9, 0), by: 'Precision Dental Works' },
      { stage: 'note', at: at(0, 10, 0), by: 'Precision Dental Works', text: 'Delivery date changed' },
    ],
    messages: [],
  },
  {
    id: 'SG-D1004', patientId: 'P-10119', practice: 'isc', lab: 'northstar', clinician: 'okafor', createdBy: 'John Carter',
    service: 'Crown', teeth: ['UR1'], material: 'Zirconia', funding: 'Private', instructions: '', returnBy: '', stage: 'draft',
    attachments: [], events: [], messages: [], source: 'manual',
    draftForm: {
      practice: 'isc', clinician: 'okafor', patientId: 'P-10119', lab: 'northstar', funding: 'Private', returnBy: '', apptDate: '', apptKind: 'Fit',
      caseSource: null, instructions: 'Match UL1 incisal translucency.', attachments: [],
      items: [{ uid: 'd1-1', itemId: 'su-crown', teeth: ['UR1'], sameForAll: true, material: 'Zirconia', shade: null, perTooth: {}, details: {} }],
    },
  },
  {
    id: 'SG-D1007', patientId: 'P-10402', practice: 'isc', lab: 'precision', clinician: 'okafor', createdBy: 'John Carter',
    service: 'Full Denture', teeth: ['Upper arch'], material: 'Acrylic', funding: 'NHS', instructions: '', returnBy: '', stage: 'draft',
    attachments: [], events: [], messages: [], source: 'manual',
    items: [{ service: 'Night Guard', teeth: ['Lower arch'], material: '' }],
    draftForm: {
      practice: 'isc', clinician: 'okafor', patientId: 'P-10402', lab: 'precision', funding: 'NHS', returnBy: '', apptDate: '', apptKind: 'Fit',
      caseSource: 'Impressions (By Post)', instructions: '', attachments: [],
      items: [
        { uid: 'd2-1', itemId: 'de-full-denture', teeth: ['Upper arch'], sameForAll: true, material: 'Acrylic', shade: 'A3', perTooth: {}, details: {} },
        { uid: 'd2-2', itemId: 'ap-night-guard', teeth: ['Lower arch'], sameForAll: true, material: null, shade: null, perTooth: {}, details: { applianceOption: 'Hard' } },
      ],
    },
  },
];

export const isOverdue = (c: LabCase) =>
  c.stage !== 'received' && c.stage !== 'shipped' && c.stage !== 'draft' && !c.onHold && !!c.returnBy && dayOffset(c.returnBy) < 0;

/** The one thing the practice should do next — drives the case's CTA. */
export type NextAction = 'finish' | 'on-hold' | 'dispatch' | 'reply' | 'chase' | 'check-in' | 'wait' | 'done';
export function nextAction(c: LabCase): NextAction {
  if (c.stage === 'draft') return 'finish';
  if (c.onHold) return 'on-hold';
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
  if (c.stage === 'draft') return { level: 'attention', label: 'Draft', detail: 'Not submitted yet. Finish and create the case' };
  if (c.onHold) return { level: 'attention', label: 'On hold', detail: c.onHold.side === 'Practice' ? 'Lab is waiting on the practice' : 'Paused by the lab' };
  if (c.labStatus === 'Not Approved') return { level: 'at-risk', label: 'Not approved', detail: 'Rejected by lab · see comments' };
  if (c.stage === 'received') return { level: 'in-practice', label: 'In practice', detail: c.receipt ? `In ${c.receipt.storedIn.toLowerCase()}` : 'Received' };
  if (!c.returnBy) return c.stage === 'ready'
    ? { level: 'attention', label: 'Ready to dispatch', detail: 'Not sent to the lab yet · no delivery date' }
    : { level: 'on-track', label: 'No date', detail: 'No delivery date set' };
  // Dates only — no times are captured for due dates or appointments.
  const ad = c.appointment ? dayOffset(c.appointment.at) : null;
  const dd = dayOffset(c.returnBy);
  if (isOverdue(c)) {
    const n = Math.max(1, -dayOffset(c.returnBy));
    return { level: 'at-risk', label: 'Late', detail: `Lab is ${n} day${n > 1 ? 's' : ''} late${c.chasedAt ? ' · chased' : ''}` };
  }
  if (ad !== null && dd > ad) return { level: 'at-risk', label: 'At risk', detail: `Back ${relDay(c.returnBy).toLowerCase()}, after the ${c.appointment!.kind.toLowerCase()}` };
  if (ad !== null && dd === ad && c.stage !== 'shipped') return { level: 'at-risk', label: 'At risk', detail: `Back the same day as the ${c.appointment!.kind.toLowerCase()}` };
  if (c.questionOpen) return { level: 'attention', label: 'Info required', detail: 'Lab needs more information' };
  if (c.stage === 'ready') return { level: 'attention', label: 'Ready to dispatch', detail: 'Not sent to the lab yet' };
  if (c.stage === 'shipped') return { level: 'arriving', label: 'Arriving', detail: `Expected ${relDay(c.returnBy).toLowerCase()}` };
  return { level: 'on-track', label: 'On track', detail: `Back ${relDay(c.returnBy).toLowerCase()}` };
}
export const READINESS_ORDER: ReadinessLevel[] = ['at-risk', 'attention', 'arriving', 'on-track', 'in-practice'];

/** Day buckets used to group work by appointment. */
export function dayOffset(iso: string) {
  const s = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  return Math.round((s(new Date(iso)) - s(new Date())) / DAY);
}

/** Status shortcuts. The first four (home: true) are the Home tiles and the Lab work status chips, in this order. */
export type Attention = 'overdue' | 'ready' | 'on-hold' | 'draft' | 'arriving' | 'questions' | 'not-approved' | 'date-changed';
export const ATTENTION: { id: Attention; label: string; short: string; hint: string; home?: boolean }[] = [
  { id: 'overdue', label: 'Overdue', short: 'Overdue', hint: 'Chase the lab', home: true },
  { id: 'ready', label: 'Ready to dispatch', short: 'To dispatch', hint: 'Print the label and book a courier', home: true },
  { id: 'on-hold', label: 'On hold', short: 'On hold', hint: 'Paused by the lab', home: true },
  { id: 'draft', label: 'Draft', short: 'Draft', hint: 'Finish and create the case', home: true },
  { id: 'arriving', label: 'Arriving from lab', short: 'Arriving', hint: 'Mark as received when it arrives' },
  { id: 'questions', label: 'Additional information required', short: 'Info required', hint: 'Reply to the lab' },
  { id: 'not-approved', label: 'Lab work not approved', short: 'Not approved', hint: 'Rejected by lab' },
  { id: 'date-changed', label: 'Delivery date changed', short: 'Date changed', hint: 'Needs review' },
];
export const matchesAttention = (c: LabCase, a: Attention) =>
  a === 'draft' ? c.stage === 'draft'
  : a === 'on-hold' ? !!c.onHold
  : a === 'ready' ? c.stage === 'ready' && !c.onHold
  : a === 'arriving' ? c.stage === 'shipped'
  : a === 'questions' ? !!c.questionOpen
  : a === 'not-approved' ? labStatusOf(c) === 'Not Approved'
  : a === 'date-changed' ? !!c.deliveryChanged
  : isOverdue(c);

// ─── Finance ────────────────────────────────────────────────────────────────

/** Same statuses as the portal's Invoices page. 'main' ones are the summary
 *  tiles at the top; 'more' ones are the secondary filters at the bottom. */
export type InvoiceStatus = 'qc' | 'duplicate' | 'awaiting' | 'approved' | 'xero' | 'paid'
  | 'disputed' | 'rejected' | 'xero-failed' | 'exported' | 'archived' | 'not-invoice' | 'zero-value';
export const INVOICE_STATUSES: { id: InvoiceStatus; label: string; group: 'main' | 'more' }[] = [
  { id: 'qc', label: 'QC · Needs review', group: 'main' },
  { id: 'duplicate', label: 'Duplicates', group: 'main' },
  { id: 'awaiting', label: 'Awaiting approval', group: 'main' },
  { id: 'approved', label: 'Approved', group: 'main' },
  { id: 'xero', label: 'Sent to Xero', group: 'main' },
  { id: 'paid', label: 'Payment processed', group: 'main' },
  { id: 'disputed', label: 'Disputed', group: 'more' },
  { id: 'rejected', label: 'Rejected', group: 'more' },
  { id: 'xero-failed', label: 'Sent to Xero failed', group: 'more' },
  { id: 'exported', label: 'Exported for payment', group: 'more' },
  { id: 'archived', label: 'Archived', group: 'more' },
  { id: 'not-invoice', label: 'Not an invoice', group: 'more' },
  { id: 'zero-value', label: 'Zero value', group: 'more' },
];
/** Still needs someone at the practice. */
export const invoiceNeedsAction = (s: InvoiceStatus) => s === 'qc' || s === 'duplicate' || s === 'awaiting' || s === 'disputed' || s === 'xero-failed';

/** pass/warn/fail are QC checks; info is a note that doesn't block (portal: "3 info"). */
export type CheckState = 'pass' | 'warn' | 'fail' | 'info';
export interface Invoice {
  id: string;
  /** Supplier's invoice number, as printed. */
  number: string;
  docType: 'Invoice' | 'Credit note';
  supplier: string;
  practice: PracticeId;
  /** Who it's billed to. registered: false = name on the invoice isn't a user here ("Not registered"). */
  billTo: { name: string; registered: boolean };
  net: number;
  vat: number;
  status: InvoiceStatus;
  /** "Approved · System" when auto-approved after passing every check. */
  approvedBy?: string;
  /** How sure the read was, 0–100. */
  confidence: number;
  issued: string;
  received: string;
  due: string;
  source: string;
  caseId?: string;
  lines: { label: string; qty: number; unit: number }[];
  checks: { label: string; detail: string; state: CheckState }[];
  activity: { text: string; at: string }[];
}
export const invoiceIssues = (i: Invoice) => i.checks.filter(c => c.state === 'warn' || c.state === 'fail').length;
export const invoiceInfo = (i: Invoice) => i.checks.filter(c => c.state === 'info').length;

const chk = (label: string, detail: string, state: CheckState = 'pass') => ({ label, detail, state });
const PASS_BASICS = [chk('Duplicate check', 'No matching invoice found'), chk('Supplier VAT number', 'Verified')];

export const SEED_INVOICES: Invoice[] = [
  {
    id: 'PDW-7731', number: 'PDW-7731', docType: 'Invoice', supplier: 'Precision Dental Works', practice: 'isc',
    billTo: { name: 'Dr Samuel Okafor', registered: true }, net: 1940, vat: 388, status: 'qc', confidence: 85,
    issued: at(-2), received: at(-1, 11, 41), due: at(13), source: 'Received via supplier upload', caseId: 'SG-28488',
    lines: [
      { label: 'Full denture · J. Williams', qty: 1, unit: 1290 },
      { label: 'Remake, upper denture', qty: 1, unit: 650 },
    ],
    checks: [
      chk('Lab order match', 'Matches SG-28488'),
      ...PASS_BASICS,
      chk('Amount vs usual', '38% above usual for full dentures', 'warn'),
      chk('Line not on lab order', 'Remake, upper denture isn’t on SG-28488', 'warn'),
    ],
    activity: [{ text: 'Received via supplier upload', at: at(-1, 11, 41) }, { text: 'Sent to QC: 2 issues', at: at(-1, 11, 42) }],
  },
  {
    id: 'OVR-07DC99', number: '#07dc99', docType: 'Invoice', supplier: 'Oakview Restorations', practice: 'cds',
    billTo: { name: 'Dr Olivia Reed', registered: true }, net: 109.58, vat: 21.92, status: 'qc', confidence: 85,
    issued: at(-6), received: at(-5, 9, 10), due: at(24), source: 'Received via email and read automatically',
    lines: [{ label: 'Crown · A. Taylor', qty: 1, unit: 109.58 }],
    checks: [
      chk('Lab order match', 'No lab order found for this patient', 'fail'),
      chk('Patient name', 'Spelling differs from patient record', 'warn'),
      chk('Due date', 'Missing on the invoice', 'warn'),
      chk('Invoice number', 'Unusual format', 'warn'),
      chk('Line total', 'Rounding difference of £0.02', 'warn'),
      ...PASS_BASICS,
    ],
    activity: [{ text: 'Received via email and read automatically', at: at(-5, 9, 10) }, { text: 'Sent to QC: 5 issues', at: at(-5, 9, 11) }],
  },
  {
    id: 'DNH-136484', number: 'INV136484', docType: 'Invoice', supplier: 'DNH Lab Ltd', practice: 'cds',
    billTo: { name: 'Dr Olivia Reed', registered: true }, net: 38.13, vat: 7.62, status: 'qc', confidence: 82,
    issued: at(-4), received: at(-3, 15, 0), due: at(26), source: 'Received via email and read automatically',
    lines: [{ label: 'Night guard repair · R. Evans', qty: 1, unit: 38.13 }],
    checks: [
      chk('Lab order match', 'No lab order found', 'fail'),
      chk('Supplier', 'Not in your supplier list yet', 'warn'),
      ...PASS_BASICS,
    ],
    activity: [{ text: 'Received via email and read automatically', at: at(-3, 15, 0) }],
  },
  {
    id: 'OVR-DL1409', number: 'INV-DL1409-W-1', docType: 'Invoice', supplier: 'Oakview Restorations', practice: 'cds',
    billTo: { name: 'Dr Sami Hassan', registered: false }, net: 109.58, vat: 21.92, status: 'qc', confidence: 82,
    issued: at(-9), received: at(-8, 10, 0), due: at(21), source: 'Received via email and read automatically',
    lines: [{ label: 'Veneer · S. Khan', qty: 1, unit: 109.58 }],
    checks: [
      chk('Bill to', 'Dr Sami Hassan isn’t registered at this practice', 'fail'),
      chk('Lab order match', 'No lab order found', 'warn'),
      chk('Due date', 'Missing on the invoice', 'warn'),
      chk('VAT', 'VAT rate not shown', 'warn'),
    ],
    activity: [{ text: 'Received via email and read automatically', at: at(-8, 10, 0) }],
  },
  {
    id: 'DE-2026-118', number: 'DE-2026-118', docType: 'Invoice', supplier: 'Dentaurum GmbH', practice: 'isc',
    billTo: { name: 'Dr Hannah Lee', registered: true }, net: 1320, vat: 0, status: 'duplicate', confidence: 93,
    issued: at(-6), received: at(-5, 16, 45), due: at(9), source: 'Received via email',
    lines: [{ label: 'Orthodontic wire assortment', qty: 4, unit: 330 }],
    checks: [
      chk('Duplicate check', 'Same number and amount as DE-2026-112', 'fail'),
      chk('Reverse charge VAT', 'Zero-rated EU supply noted', 'info'),
    ],
    activity: [{ text: 'Received via email', at: at(-5, 16, 45) }, { text: 'Flagged as possible duplicate', at: at(-5, 16, 46) }],
  },
  {
    id: 'NDL-10482', number: 'NDL-10482', docType: 'Invoice', supplier: 'Northstar Dental Lab', practice: 'cds',
    billTo: { name: 'Dr Olivia Reed', registered: true }, net: 1070, vat: 214, status: 'awaiting', confidence: 94,
    issued: at(-3), received: at(-2, 9, 13), due: at(12), source: 'Received via email and read automatically', caseId: 'SG-28452',
    lines: [
      { label: 'Gold onlay · P. Novak', qty: 1, unit: 820 },
      { label: 'Implant components · D. Morgan', qty: 1, unit: 250 },
    ],
    checks: [chk('Lab order match', 'Matches SG-28452, received at practice'), ...PASS_BASICS, chk('Amount vs usual', 'Within normal range')],
    activity: [{ text: 'Received via email and read automatically', at: at(-2, 9, 13) }, { text: 'All checks passed', at: at(-2, 9, 14) }],
  },
  {
    id: 'HSD-55120', number: 'HSD-55120', docType: 'Invoice', supplier: 'Henry Schein Dental', practice: 'cds',
    billTo: { name: 'Camden Dental Studio', registered: true }, net: 642.5, vat: 128.5, status: 'awaiting', confidence: 96,
    issued: at(-4), received: at(-3, 14, 2), due: at(20), source: 'Received via email and read automatically',
    lines: [
      { label: 'Nitrile gloves (M) × 20 boxes', qty: 20, unit: 8.75 },
      { label: 'Composite A2 syringes', qty: 10, unit: 46.75 },
    ],
    checks: [chk('Purchase order match', 'PO-4471 · all lines delivered'), ...PASS_BASICS],
    activity: [{ text: 'Received via email and read automatically', at: at(-3, 14, 2) }],
  },
  {
    id: 'SDC-2601-0037', number: '2601/0037', docType: 'Invoice', supplier: 'Scarborough Denture Centre', practice: 'isc',
    billTo: { name: 'Dr Hannah Lee', registered: true }, net: 118.75, vat: 23.75, status: 'approved', approvedBy: 'System', confidence: 90,
    issued: at(-8), received: at(-7, 9, 0), due: at(22), source: 'Received via email and read automatically', caseId: 'SG-28460',
    lines: [{ label: 'Partial denture · E. Brooks', qty: 1, unit: 118.75 }],
    checks: [
      chk('Lab order match', 'Matches SG-28460'), ...PASS_BASICS,
      chk('Price list', 'Matches the agreed price', 'info'),
      chk('Delivery', 'Work received at practice', 'info'),
      chk('Payment terms', '30 days', 'info'),
    ],
    activity: [{ text: 'Received via email and read automatically', at: at(-7, 9, 0) }, { text: 'Approved automatically: all checks passed', at: at(-7, 9, 1) }],
  },
  {
    id: 'S4S-116434', number: '116434', docType: 'Invoice', supplier: 'S4S London Ltd', practice: 'isc',
    billTo: { name: 'Dr Samuel Okafor', registered: true }, net: 30.42, vat: 6.08, status: 'approved', approvedBy: 'System', confidence: 91,
    issued: at(-5), received: at(-5, 12, 0), due: at(25), source: 'Received via email and read automatically',
    lines: [{ label: 'Study models · L. Chen', qty: 1, unit: 30.42 }],
    checks: [...PASS_BASICS, chk('Price list', 'Matches the agreed price', 'info'), chk('Payment terms', '30 days', 'info')],
    activity: [{ text: 'Approved automatically: all checks passed', at: at(-5, 12, 1) }],
  },
  {
    id: 'BAL-2209', number: 'BAL-2209', docType: 'Invoice', supplier: 'Bright Arch Laboratory', practice: 'isc',
    billTo: { name: 'Dr Hannah Lee', registered: true }, net: 480, vat: 96, status: 'xero', approvedBy: 'Dr Olivia Reed', confidence: 97,
    issued: at(-9), received: at(-8, 10, 0), due: at(6), source: 'Received via supplier upload', caseId: 'SG-28460',
    lines: [{ label: 'Retainers (pair) · L. Chen', qty: 1, unit: 480 }],
    checks: [chk('Lab order match', 'Matches SG-28460'), ...PASS_BASICS],
    activity: [{ text: 'Approved by Dr Olivia Reed', at: at(-7, 9, 30) }, { text: 'Sent to Xero', at: at(-7, 9, 31) }],
  },
  {
    id: '32CO-20228', number: 'INV-20228', docType: 'Invoice', supplier: '32Co', practice: 'cds',
    billTo: { name: 'Dr Olivia Reed', registered: true }, net: 1020.83, vat: 204.17, status: 'paid', approvedBy: 'John Carter', confidence: 90,
    issued: at(-30), received: at(-29, 9, 0), due: at(-1), source: 'Received via supplier upload',
    lines: [{ label: 'Clear aligners · M. Patel', qty: 1, unit: 1020.83 }],
    checks: [...PASS_BASICS],
    activity: [{ text: 'Approved by John Carter', at: at(-27, 10, 0) }, { text: 'Payment processed', at: at(-2, 8, 0) }],
  },
  {
    id: 'NDL-10391', number: 'NDL-10391', docType: 'Invoice', supplier: 'Northstar Dental Lab', practice: 'cds',
    billTo: { name: 'Dr Olivia Reed', registered: true }, net: 410, vat: 82, status: 'disputed', confidence: 92,
    issued: at(-12), received: at(-11, 9, 0), due: at(18), source: 'Received via email and read automatically',
    lines: [{ label: 'Bridge · R. Evans', qty: 1, unit: 410 }],
    checks: [chk('Price', '£60 above the quote', 'fail'), ...PASS_BASICS],
    activity: [{ text: 'Disputed by John Carter: price differs from quote', at: at(-10, 11, 0) }],
  },
  {
    id: 'PDW-7650', number: 'PDW-7650', docType: 'Invoice', supplier: 'Precision Dental Works', practice: 'isc',
    billTo: { name: 'Dr Samuel Okafor', registered: true }, net: 320, vat: 64, status: 'xero-failed', approvedBy: 'System', confidence: 95,
    issued: at(-6), received: at(-6, 9, 0), due: at(24), source: 'Received via supplier upload',
    lines: [{ label: 'Night guard · R. Evans', qty: 1, unit: 320 }],
    checks: [...PASS_BASICS, chk('Xero', 'Supplier contact not found in Xero', 'fail')],
    activity: [{ text: 'Approved automatically', at: at(-6, 9, 1) }, { text: 'Sending to Xero failed', at: at(-6, 9, 2) }],
  },
  {
    id: 'OVR-CN0042', number: 'CN-0042', docType: 'Credit note', supplier: 'Oakview Restorations', practice: 'cds',
    billTo: { name: 'Dr Olivia Reed', registered: true }, net: 0, vat: 0, status: 'zero-value', confidence: 88,
    issued: at(-10), received: at(-10, 9, 0), due: at(-10), source: 'Received via email and read automatically',
    lines: [{ label: 'Remake at no charge · A. Taylor', qty: 1, unit: 0 }],
    checks: [chk('Zero value', 'Nothing to pay', 'info')],
    activity: [{ text: 'Received via email and read automatically', at: at(-10, 9, 0) }],
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

export const INVOICE_REASONS = ['Price differs from quote', 'Not on lab order or PO', 'Possible duplicate', 'Work not received', 'Wrong practice or entity', 'VAT incorrect'];
export const EXCEPTION_RESOLUTIONS = ['Requested copy invoice from supplier', 'Invoice found and linked', 'Not ours, queried with supplier', 'Credit note requested for difference', 'Accept supplier amount'];

// ─── Formatting ─────────────────────────────────────────────────────────────

export const gbp = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
export const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Not set');
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
  if (!iso) return 'No date';
  const diff = Math.round((start(new Date(iso)) - start(new Date())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
export const nowIso = () => new Date().toISOString();
