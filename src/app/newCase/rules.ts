// ─── New Case Flow · rules ───────────────────────────────────────────────────
// Every rule the flow runs on — catalogue, defaults, slots and gaps, pricing
// (internal only: never shown), turnaround, delivery dates, notes and send
// wording — as pure functions of the
// draft plus a context (patient, lab, signed-in user, prescriber). Components
// never work these out themselves, so the rules can be unit-tested on their own.

import {
  Arch, CLINIC, Funding, IMPLANT_SYSTEMS, LABS, Lab, LabId, Patient, Preferences, PriorWork, ProductId,
  Scanner, USUALS, User, UserId, labById,
} from './data';
import {
  addWorkingDays, ageOn, dobFromString, firstClinicDayAfter, fmtCutoff, fmtDay, fmtShort, fromISO,
  lastWorkingDayBefore, receivedDate, toISO, workingDaysBetween, isWorkingDay,
} from './dates';

// ─── Draft shape ─────────────────────────────────────────────────────────────

export interface Photo { label: string }
export type FileRole = 'upper' | 'lower' | 'bite' | 'other';

export interface ServiceItem {
  id: string;
  product: ProductId;
  /** FDI ids ("36"). For a bridge: the whole span. For a partial: teeth to replace. */
  teeth: string[];
  teethDone: boolean;
  teethSrc?: string;
  bridge?: { a?: string; b?: string; pontics: string[] };
  rbb?: boolean;
  wings?: string[];
  wingsDone?: boolean;
  arch?: Arch;
  archSrc?: string;
  material?: string;
  matSrc?: string;
  /** Raw scanner value that didn't map cleanly ("Zirconia"). */
  ambiguous?: string;
  shade?: string;
  shadeSrc?: string;
  incisal?: string;
  cervical?: string;
  stump?: string;
  photos: Photo[];
  prefs?: Partial<Preferences>;
  saveUsual?: boolean;
  /** Night guard / retainer type. */
  type?: string;
  typeSrc?: string;
  /**
   * Partial denture: its one stage. Full denture: never written any more (read
   * once by seedDenturePlan: 'stf' / 'immediate' → treatment, a stage id →
   * that stage ordered). stageSrc 'Next stage' stays the full denture's marker
   * that it continues the patient's earlier case (CaseSteps and the pickers read it).
   */
  stage?: string;
  stageSrc?: string;
  /** Full denture: Staged (default, the stage plan) · Straight to Finish · Immediate. */
  treatment?: DentureTreatment;
  treatmentSrc?: string;
  /** Full denture: the stages in play (a stage not listed is "Not now"). Read it through stagePlan(). */
  stages?: StagePlan[];
  /** The plan's "that's it" (several rows, like teethDone). */
  stagesDone?: boolean;
  base?: string;
  design?: string;
  work?: string;
  desc?: string;
  acrylic?: string;
  mould?: string;
  postdam?: string;
  extract?: string[];
  extractDone?: boolean;
  splint?: 'separate' | 'splinted';
  retention?: 'screw' | 'cement';
  abutment?: string;
  system?: string;
  systemSrc?: string;
  platform?: string;
  platformSrc?: string;
  scanBody?: string;
  inlayType?: 'inlay' | 'onlay';
  implantDecision?: 'keep' | 'switched';
  remake?: 'yes' | 'no';
  remakeReason?: string;
  descDone?: boolean;
  /** Instructions for this service only; merged into the case instructions at Review. */
  note?: string;
  /** Slots reopened by a funding or patient change: they need a deliberate pick again. */
  reopen?: SlotId[];
}

export interface Records {
  route?: 'follow' | 'post' | 'upload';
  box: Record<string, boolean>;
  disinfected: boolean;
  /** "22 Oct 11:32" and who ticked it, for the box label. */
  disinfectedAt?: string;
  disinfectedBy?: string;
  files: { name: string; role?: FileRole }[];
}

export interface ScanInfo {
  scanner: Scanner;
  /** "10:42", today */
  time: string;
  arches: { upper: boolean; lower: boolean; bite: boolean };
  patientId: string;
}

export interface CaseDraft {
  id?: string;
  patientId: string;
  funding: Funding;
  lab: LabId;
  labSrc: string;
  /** false until someone picks the lab (the suggested lab is listed first, not chosen). */
  labPicked?: boolean;
  items: ServiceItem[];
  scan?: ScanInfo;
  /** "Medit:skhan" */
  login?: string;
  records: Records;
  prescriber?: UserId;
  prescriberSrc?: string;
  rememberLogin: boolean;
  /** ISO date of the fit appointment. */
  fit?: string;
  /** The case instructions as edited at Review; undefined = merged from the services' instructions. */
  instructions?: string;
  /** What the merge said when the user started editing, to spot a service note changing after. */
  instructionsBase?: string;
  fastTrack: boolean;
  split: boolean;
  keepTogether: boolean;
  note: string;
  step: string;
  dismissedNotes: string[];
  /** Set when a staff user sends it to a dentist to approve. */
  preparedBy?: UserId;
  groupIds?: string[];
  /** "Continuing the iTero draft from today 09:12 …" */
  continuing?: string;
}

export interface Ctx {
  patient: Patient;
  lab: Lab;
  user: User;
  prescriber?: User;
  funding: Funding;
  now: Date;
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export type ProductGroup = 'Fixed' | 'Implant' | 'Dentures' | 'Repairs and Relines' | 'Appliances' | 'Other';
export const PRODUCTS: Record<ProductId, { label: string; noun: string; group: ProductGroup; privateOnly?: boolean; archItem?: boolean }> = {
  crown:      { label: 'Crown',            noun: 'crown',            group: 'Fixed' },
  bridge:     { label: 'Bridge',           noun: 'bridge',           group: 'Fixed' },
  implant:    { label: 'Implant Crown',    noun: 'implant crown',    group: 'Implant', privateOnly: true },
  veneer:     { label: 'Veneer',           noun: 'veneer',           group: 'Fixed', privateOnly: true },
  inlay:      { label: 'Inlay or Onlay',   noun: 'inlay or onlay',   group: 'Fixed' },
  nightguard: { label: 'Night Guard',      noun: 'night guard',      group: 'Appliances', archItem: true },
  denture:    { label: 'Full Denture',     noun: 'full denture',     group: 'Dentures', archItem: true },
  partial:    { label: 'Partial Denture',  noun: 'partial denture',  group: 'Dentures' },
  reline:     { label: 'Reline or Repair', noun: 'reline or repair', group: 'Repairs and Relines' },
  retainer:   { label: 'Retainer',         noun: 'retainer',         group: 'Appliances', archItem: true },
  whitening:  { label: 'Whitening Trays',  noun: 'whitening trays',  group: 'Appliances', archItem: true, privateOnly: true },
  other:      { label: 'Something Else',   noun: 'item',             group: 'Other' },
};
/** Tiles on the services step, in their fixed order; the rest live under More. */
export const TILE_ORDER: ProductId[] = ['crown', 'bridge', 'implant', 'veneer', 'inlay', 'nightguard', 'denture'];
export const GROUP_ORDER: ProductGroup[] = ['Fixed', 'Implant', 'Dentures', 'Repairs and Relines', 'Appliances', 'Other'];
export const ALL_PRODUCTS = Object.keys(PRODUCTS) as ProductId[];

export interface Option { id: string; name: string }
export const OPTIONS: Record<ProductId, Option[]> = {
  crown: [
    { id: 'mono', name: 'Monolithic zirconia' }, { id: 'emax', name: 'e.max' }, { id: 'layered', name: 'Layered zirconia' },
    { id: 'pbc', name: 'PBC non-precious' }, { id: 'metal', name: 'Full metal non-precious' },
  ],
  bridge: [
    { id: 'mono', name: 'Monolithic zirconia' }, { id: 'emax', name: 'e.max' }, { id: 'layered', name: 'Layered zirconia' },
    { id: 'pbc', name: 'PBC non-precious' }, { id: 'metal', name: 'Full metal non-precious' },
    { id: 'rbb-metal', name: 'Metal wing' }, { id: 'rbb-zirc', name: 'Zirconia wing' },
  ],
  veneer: [{ id: 'emax', name: 'e.max' }, { id: 'composite', name: 'Composite' }, { id: 'feldspathic', name: 'Feldspathic' }],
  inlay: [{ id: 'emax', name: 'e.max' }, { id: 'composite', name: 'Composite' }],
  implant: [{ id: 'mono', name: 'Monolithic zirconia · Ti-base' }, { id: 'layered', name: 'Layered zirconia · Ti-base' }],
  nightguard: [{ id: 'hard', name: 'Hard (Michigan)' }, { id: 'soft', name: 'Soft' }, { id: 'dual', name: 'Dual laminate' }],
  retainer: [{ id: 'essix', name: 'Essix 1.0 mm' }, { id: 'hawley', name: 'Hawley' }],
  whitening: [{ id: 'trays', name: 'Whitening trays' }],
  // The five stages (DENTURE_STAGES) and the two treatments that skip them.
  denture: [
    { id: 'tray', name: 'Special Tray' }, { id: 'blocks', name: 'Bite Registration' }, { id: 'tryin', name: 'Try In' },
    { id: 'retry', name: 'Retry' }, { id: 'finish', name: 'Finish' },
    { id: 'stf', name: 'Straight to Finish' }, { id: 'immediate', name: 'Immediate' },
  ],
  partial: [{ id: 'acrylic', name: 'Acrylic' }, { id: 'chrome', name: 'Cobalt-chrome' }, { id: 'flexible', name: 'Flexible' }],
  reline: [
    { id: 'repair', name: 'Repair' }, { id: 'addtooth', name: 'Add Tooth' }, { id: 'addclasp', name: 'Add Clasp' },
    { id: 'hard', name: 'Hard Reline' }, { id: 'soft', name: 'Soft Reline' },
  ],
  other: [{ id: 'tbc', name: 'Something else' }],
};
export const optionName = (product: ProductId, id?: string) =>
  OPTIONS[product].find(o => o.id === id)?.name ?? id ?? '';

export const MATERIAL_GROUP: Record<string, string> = {
  mono: 'Zirconia', layered: 'Zirconia', 'rbb-zirc': 'Zirconia',
  emax: 'Glass ceramic', feldspathic: 'Glass ceramic',
  pbc: 'Metal-ceramic',
  metal: 'Metal', 'rbb-metal': 'Metal',
  composite: 'Composite',
};
export const MATERIAL_GROUPS = ['Zirconia', 'Glass ceramic', 'Metal-ceramic', 'Metal', 'Composite'];

export const PARTIAL_STAGES: Option[] = [
  { id: 'tray', name: 'Special Tray' }, { id: 'blocks', name: 'Bite Blocks' }, { id: 'framework', name: 'Framework Try-In' },
  { id: 'tryin', name: 'Try-In' }, { id: 'finish', name: 'Finish' },
];
export const PARTIAL_DESIGNS: Option[] = [
  { id: 'drawn', name: 'Drawn on the Model' }, { id: 'attached', name: 'Design Attached' }, { id: 'propose', name: 'Lab to Propose' },
];
export const REMAKE_REASONS = ['Fit', 'Contacts', 'Occlusion', 'Shade', 'Fracture or Chip', 'Debond', 'Other'];
export const POSTDAM_OPTIONS = ['Marked on the model', 'Marked on the impression', 'Lab to place at the vibrating line'];
export const MOULD_OPTIONS = ['Lab to select', 'Match the old denture', 'Match the photos'];
export const ACRYLIC_OPTIONS = ['Veined pink', 'Plain pink'];
export const ABUTMENTS = ['Stock titanium', 'Custom titanium', 'Custom zirconia on Ti-base'];
export const PREF_FIELDS: { key: keyof Preferences; label: string; options: string[] }[] = [
  { key: 'occlusal', label: 'Occlusal contacts', options: ['Light', 'Medium', 'Heavy', 'Out of occlusion'] },
  { key: 'proximal', label: 'Proximal contacts', options: ['Light', 'Medium', 'Tight'] },
  { key: 'staining', label: 'Occlusal staining', options: ['None', 'Light', 'Medium', 'Dark'] },
  { key: 'anatomy', label: 'Anatomy', options: ['Follow adjacent teeth', 'Ideal anatomy'] },
  { key: 'clearance', label: "If there isn't enough clearance", options: ['Call me', 'Reduce the opposing tooth', 'Lab to decide'] },
];

export const VITA_CLASSICAL = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4'];
export const VITA_3D = ['0M1', '0M2', '0M3', '1M1', '1M2', '2L1.5', '2L2.5', '2M1', '2M2', '2M3', '2R1.5', '2R2.5', '3L1.5', '3L2.5', '3M1', '3M2', '3M3', '3R1.5', '3R2.5', '4L1.5', '4L2.5', '4M1', '4M2', '4M3', '4R1.5', '4R2.5', '5M1', '5M2', '5M3'];
export const BLEACH = ['BL1', 'BL2', 'BL3', 'BL4'];
export const STUMP = ['ND1', 'ND2', 'ND3', 'ND4', 'ND5', 'ND6', 'ND7', 'ND8', 'ND9'];
/** Rough on-screen swatches. Colours on screen are only a guide. */
export function shadeSwatch(shade: string): string {
  const table: Record<string, string> = {
    A1: '#F3E7CF', A2: '#EEDDBE', A3: '#E7D1AB', 'A3.5': '#DFC598', A4: '#D4B583',
    B1: '#F4EBD6', B2: '#EEE0BF', B3: '#E5D2A3', B4: '#DCC48E',
    C1: '#E8DFCB', C2: '#DED2B6', C3: '#D4C6A2', C4: '#C6B48C',
    D2: '#E9DEC6', D3: '#E0D2B2', D4: '#D8C8A4',
    BL1: '#FBF8F1', BL2: '#F8F3E8', BL3: '#F5EEDF', BL4: '#F2E9D6',
  };
  if (table[shade]) return table[shade];
  if (shade.startsWith('ND')) return ['#F1E6D0', '#EAD9BB', '#E2CCA6', '#D7BC8F', '#C9A877', '#B59466', '#A08057', '#8A6C49', '#735A3C'][Number(shade.slice(2)) - 1] ?? '#E7D1AB';
  const lightness = Number(shade[0]);
  return ['#FAF5EA', '#F3E9D3', '#ECDDBD', '#E3CEA4', '#D8BE8C', '#CBAE77'][lightness] ?? '#E7D1AB';
}

// ─── Teeth ───────────────────────────────────────────────────────────────────

export const UPPER_ORDER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
export const LOWER_ORDER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
export const ALL_TEETH = [...UPPER_ORDER, ...LOWER_ORDER];
export const jawOf = (id: string): 'upper' | 'lower' => (id[0] === '1' || id[0] === '2' ? 'upper' : 'lower');
export const archTeethIds = (arch: Arch) => (arch === 'both' ? ALL_TEETH : arch === 'upper' ? UPPER_ORDER : LOWER_ORDER);
const QUAD = ['', 'UR', 'UL', 'LL', 'LR'];
export const palmerOf = (id: string) => `${QUAD[Number(id[0])]}${id[1]}`;
export const isFront = (id: string) => Number(id[1]) <= 3;
export const isMolar = (id: string) => Number(id[1]) >= 6;
const QUAD_NAME = ['', 'upper right', 'upper left', 'lower left', 'lower right'];
export const toothName = (id: string) => `${QUAD_NAME[Number(id[0])]} ${id[1]}`;
const sortNum = (ids: string[]) => [...ids].sort((a, b) => Number(a) - Number(b));
const posInArch = (id: string) => (jawOf(id) === 'upper' ? UPPER_ORDER : LOWER_ORDER).indexOf(id);

export type Notation = 'fdi' | 'palmer';
/** "36 · LL6" (or "LL6 · 36" for a user whose setting is UR6 first). Never Universal. */
export function toothText(id: string, n: Notation = 'fdi'): string {
  return n === 'palmer' ? `${palmerOf(id)} · ${id}` : `${id} · ${palmerOf(id)}`;
}
export function teethText(ids: string[], n: Notation = 'fdi'): string {
  if (ids.length === 0) return '';
  const s = sortNum(ids);
  const fdi = s.join(', ');
  const pal = s.map(palmerOf).join(', ');
  return n === 'palmer' ? `${pal} · ${fdi}` : `${fdi} · ${pal}`;
}
/** Bridge span, "14–16 · UR4–UR6". */
export function spanText(ids: string[], n: Notation = 'fdi'): string {
  if (ids.length < 2) return teethText(ids, n);
  const ends = [ids[0], ids[ids.length - 1]].sort((a, b) => Number(a) - Number(b));
  const fdi = `${ends[0]}–${ends[1]}`;
  const pal = `${palmerOf(ends[0])}–${palmerOf(ends[1])}`;
  return n === 'palmer' ? `${pal} · ${fdi}` : `${fdi} · ${pal}`;
}
export const archCaps = (a?: Arch) => (a === 'both' ? 'UPPER AND LOWER' : a ? a.toUpperCase() : '');
export const archWord = (a?: Arch) => (a === 'both' ? 'upper and lower' : a ?? '');

/** Contiguous teeth between two ends of the same arch, in arch order. */
export function spanBetween(a: string, b: string): string[] {
  const order = jawOf(a) === 'upper' ? UPPER_ORDER : LOWER_ORDER;
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
}
export function hasAdjacent(ids: string[]): boolean {
  return ids.some(a => ids.some(b => a !== b && jawOf(a) === jawOf(b) && Math.abs(posInArch(a) - posInArch(b)) === 1));
}

// ─── Bridge ──────────────────────────────────────────────────────────────────

export function bridgeParts(item: ServiceItem) {
  const pontics = item.bridge?.pontics ?? [];
  const span = item.teeth;
  const abutments = span.filter(t => !pontics.includes(t));
  const ends = span.length ? [span[0], span[span.length - 1]] : [];
  const cantilever = ends.some(e => pontics.includes(e));
  return { span, pontics, abutments, cantilever };
}
export type BridgeIssue =
  | { kind: 'incomplete' } | { kind: 'arch' } | { kind: 'long' } | { kind: 'noAbutment' } | { kind: 'noPontic' };
export const BRIDGE_ERRORS: Record<Exclude<BridgeIssue['kind'], 'incomplete' | 'noPontic'>, string> = {
  arch: 'Bridge teeth must be in the same arch.',
  long: 'Bridges over 6 units go through Something Else, so the lab can plan them with you.',
  noAbutment: 'A bridge needs at least one abutment. Tap a tooth to make it an abutment.',
};
export function bridgeIssue(item: ServiceItem): BridgeIssue | null {
  const b = item.bridge;
  if (!b?.a || !b?.b) return { kind: 'incomplete' };
  const { span, abutments, pontics } = bridgeParts(item);
  if (span.length > 6) return { kind: 'long' };
  if (abutments.length === 0) return { kind: 'noAbutment' };
  if (pontics.length === 0 && !item.rbb) return { kind: 'noPontic' };
  return null;
}
/** "14–16 · UR4–UR6 · 3 units · abutments 14, 16 · pontic 15 · conventional" */
export function bridgeReadback(item: ServiceItem, n: Notation): string {
  const { span, pontics, abutments, cantilever } = bridgeParts(item);
  if (span.length < 2) return span.length ? `${toothText(span[0], n)} · tap the other end` : '';
  const kind = item.rbb ? 'resin-bonded' : cantilever ? 'cantilever' : 'conventional';
  return [
    spanText(span, n),
    plural(span.length, 'unit'),
    `${abutments.length === 1 ? 'abutment' : 'abutments'} ${sortNum(abutments).join(', ') || 'none'}`,
    pontics.length ? `${pontics.length === 1 ? 'pontic' : 'pontics'} ${sortNum(pontics).join(', ')}` : 'no pontic',
    kind,
  ].join(' · ');
}

// ─── Words ───────────────────────────────────────────────────────────────────

const PLURALS: Record<string, string> = {
  tooth: 'teeth', day: 'days', 'working day': 'working days', thing: 'things', photo: 'photos', unit: 'units',
  note: 'notes', case: 'cases', tray: 'trays', service: 'services', file: 'files', 'Thing Left': 'Things Left',
};
export function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : PLURALS[word] ?? `${word}s`}`;
}
export const initials = (p: Patient) => `${p.first[0]}.${p.last[0]}.`;
export const fullName = (p: Patient) => `${p.first} ${p.last}`;
export const sexLabel = (s: Patient['sex']) => (s === 'X' ? 'Not stated' : s);
export function patientAge(p: Patient, now: Date) { return ageOn(dobFromString(p.dob), now); }
/** "Amelia Clarke · F · 42 · P-2025-031" */
export function patientLine(p: Patient, now: Date) {
  return [fullName(p), p.sex === 'X' ? null : p.sex, patientAge(p, now), p.id].filter(Boolean).join(' · ');
}
/** What the lab sees: "A.C. · F · 42 · P-2025-031" */
export function labSees(p: Patient, now: Date) {
  return [initials(p), p.sex === 'X' ? null : p.sex, patientAge(p, now), p.practiceId || p.id].filter(Boolean).join(' · ');
}
export const userTitle = (u: User) => (u.gdc ? `${u.name} · GDC ${u.gdc}` : u.name);

// ─── Lab catalogue checks ────────────────────────────────────────────────────

export const labMakes = (lab: Lab, product: ProductId) => Object.keys(lab.prices).some(k => k.startsWith(`${product}:`));
export const labProducts = (lab: Lab) => ALL_PRODUCTS.filter(p => labMakes(lab, p));
export const itemFunding = (product: ProductId, funding: Funding): Funding => (PRODUCTS[product].privateOnly ? 'private' : funding);

/** Is this option offered for this item at this lab and funding? Disabled options carry a reason. */
export function optionAvail(lab: Lab, product: ProductId, option: string, funding: Funding, item?: ServiceItem): { ok: boolean; reason?: string } {
  const entry = lab.prices[`${product}:${option}`];
  if (!entry) return { ok: false, reason: `${lab.name} doesn't make this.` };
  if (itemFunding(product, funding) === 'nhs' && entry[1] == null) return { ok: false, reason: 'Not available on the NHS.' };
  if (product === 'bridge' && option === 'emax' && item && item.teeth.length > 0 && (item.teeth.length > 3 || item.teeth.some(isMolar))) {
    return { ok: false, reason: 'e.max bridges: up to 3 units, premolars forward.' };
  }
  return { ok: true };
}

/** Material choices for the item (bridges split conventional / resin-bonded). */
export function materialOptions(item: ServiceItem): Option[] {
  if (item.product === 'bridge') return OPTIONS.bridge.filter(o => (item.rbb ? o.id.startsWith('rbb') : !o.id.startsWith('rbb')));
  if (item.ambiguous === 'Zirconia') return OPTIONS[item.product].filter(o => o.id === 'mono' || o.id === 'layered');
  return OPTIONS[item.product];
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export function usualsFor(ctx: Ctx) {
  const p = ctx.prescriber;
  if (p && (p.id === 'khan' || p.id === 'ellery')) {
    return { usual: USUALS[p.id], tag: p.id === ctx.user.id ? 'Your usual' : `${p.short}'s usual` };
  }
  return { usual: USUALS.group, tag: 'Group standard' };
}

function pickAvailable(ctx: Ctx, item: ServiceItem, candidates: [string | undefined, string][], options: Option[]) {
  for (const [id, src] of candidates) {
    if (id && options.some(o => o.id === id) && optionAvail(ctx.lab, item.product, id, ctx.funding, item).ok) return { value: id, src };
  }
  const first = options.find(o => optionAvail(ctx.lab, item.product, o.id, ctx.funding, item).ok);
  return first ? { value: first.id, src: 'Lab standard' } : { value: undefined, src: undefined };
}

export interface Effective {
  material?: string; matSrc?: string;
  type?: string; typeSrc?: string;
  prefs: Preferences; prefsSrc: string; prefsChanged: boolean;
  splint?: 'separate' | 'splinted'; splintSrc?: string;
  retention: 'screw' | 'cement'; retentionSrc: string;
  acrylic: string; acrylicSrc: string; acrylicLocked: boolean;
  mould: string; mouldSrc: string;
  system?: string; systemSrc?: string;
  platform?: string; platformSrc?: string;
}

export function implantOnRecord(item: ServiceItem, patient: Patient) {
  return patient.implants?.find(i => item.teeth.includes(i.tooth));
}

/** What each slot holds right now: the user's answer, else the default with its source tag. */
export function effective(item: ServiceItem, ctx: Ctx): Effective {
  const { usual, tag } = usualsFor(ctx);
  const fi = itemFunding(item.product, ctx.funding) === 'nhs' ? 1 : 0;
  const opts = materialOptions(item);
  let material: string | undefined;
  let matSrc: string | undefined;
  if (item.material) {
    material = item.material;
    matSrc = item.matSrc ?? 'You';
  } else if (!item.ambiguous) {
    const front = item.teeth.some(isFront);
    let picked: { value?: string; src?: string } = {};
    if (item.product === 'crown') {
      const u = front ? usual.crownFront[fi] : usual.crownBack[fi];
      const g = front ? USUALS.group.crownFront[fi] : USUALS.group.crownBack[fi];
      picked = pickAvailable(ctx, item, [[u, tag], [g, 'Group standard']], opts);
    } else if (item.product === 'bridge') {
      if (item.rbb) picked = pickAvailable(ctx, item, [], opts);
      else {
        const u = front ? usual.bridgeFront : usual.bridgeBack;
        const g = front ? USUALS.group.bridgeFront : USUALS.group.bridgeBack;
        picked = pickAvailable(ctx, item, [[u, tag], [g, 'Group standard']], opts);
      }
    } else if (item.product === 'veneer' || item.product === 'inlay') {
      picked = pickAvailable(ctx, item, [['emax', 'Group standard']], opts);
    } else if (item.product === 'implant') {
      picked = pickAvailable(ctx, item, [['mono', 'Group standard']], opts);
    }
    material = picked.value;
    matSrc = picked.src;
  }

  let type = item.type;
  let typeSrc = item.typeSrc ?? (item.type ? 'You' : undefined);
  if (!type && (item.product === 'nightguard' || item.product === 'retainer')) {
    const u = item.product === 'nightguard' ? usual.nightguard : usual.retainer;
    const g = item.product === 'nightguard' ? USUALS.group.nightguard : USUALS.group.retainer;
    const p = pickAvailable(ctx, item, [[u, tag], [g, 'Group standard']], OPTIONS[item.product]);
    type = p.value;
    typeSrc = p.src;
  }
  if (item.product === 'whitening') { type = 'trays'; typeSrc = 'Lab standard'; }

  const pontic = item.product === 'bridge'
    ? (bridgeParts(item).pontics.some(isFront) ? 'Ovate' : 'Modified ridge lap')
    : undefined;
  const base: Preferences = { ...usual.prefs, ...(pontic ? { pontic } : {}), ...(material === 'pbc' ? { pbcMargin: 'Metal collar lingual' } : {}) };
  const prefs = { ...base, ...(item.prefs ?? {}) } as Preferences;
  const prefsChanged = !!item.prefs && Object.keys(item.prefs).length > 0;

  const nhs = itemFunding(item.product, ctx.funding) === 'nhs';
  const rec = implantOnRecord(item, ctx.patient);
  const sysDef = IMPLANT_SYSTEMS.find(s => s.name === (item.system ?? rec?.system));
  return {
    material, matSrc,
    type, typeSrc,
    prefs, prefsSrc: prefsChanged ? 'Changed for this case' : tag, prefsChanged,
    splint: item.splint ?? 'separate', splintSrc: item.splint ? 'You' : 'Lab standard',
    retention: item.retention ?? 'screw', retentionSrc: item.retention ? 'You' : 'Lab standard',
    acrylic: nhs ? 'Plain pink' : item.acrylic ?? 'Veined pink',
    acrylicSrc: nhs ? 'NHS standard' : item.acrylic ? 'You' : 'Group standard',
    acrylicLocked: nhs,
    mould: item.mould ?? 'Lab to select', mouldSrc: item.mould ? 'You' : 'Lab standard',
    system: item.system ?? rec?.system,
    systemSrc: item.systemSrc ?? (item.system ? 'You' : rec ? 'Patient record' : undefined),
    platform: item.platform ?? (rec && (!item.system || item.system === rec.system) ? rec.platform : sysDef?.platforms.length === 1 ? sysDef.platforms[0] : undefined),
    platformSrc: item.platformSrc ?? (item.platform ? 'You' : rec ? 'Patient record' : sysDef?.platforms.length === 1 ? 'Calculated' : undefined),
  };
}

// ─── History checks ──────────────────────────────────────────────────────────

/** Same tooth and product delivered within 12 months → ask whether it's a remake. */
export function remakeCandidate(item: ServiceItem, patient: Patient, now: Date): PriorWork | undefined {
  if (!['crown', 'veneer', 'inlay'].includes(item.product)) return undefined;
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return patient.history?.find(h =>
    h.product === item.product && !h.open && h.teeth?.some(t => item.teeth.includes(t)) && fromISO(h.date) >= yearAgo);
}
export function openCaseFor(item: ServiceItem, patient: Patient): PriorWork | undefined {
  if (!item.arch) return undefined;
  return patient.history?.find(h => h.open && h.product === item.product && (h.arch === item.arch || item.arch === 'both' || h.arch === 'both'));
}
export const isUnder18 = (p: Patient, now: Date) => patientAge(p, now) < 18;
export const isDentureLike = (p: ProductId) => p === 'denture' || p === 'partial' || p === 'reline';

// ─── Denture stages ──────────────────────────────────────────────────────────
// The portal's rules (data/dentureStages.ts): five stages in order, picked for
// an arch. A full denture has no date of its own, only its stages do. A stage
// in play is ordered (with the day it's needed back: today or later), done
// elsewhere (done, not on this portal; an optional done-on day) or done here on
// the patient's earlier case (a follow-up: never ordered twice). A stage not in
// the plan is "Not now". Straight to Finish and Immediate skip the stages: their
// plan is one ordered Finish.

export type DentureStageId = 'tray' | 'blocks' | 'tryin' | 'retry' | 'finish';
export const DENTURE_STAGES: { id: DentureStageId; name: string }[] = [
  { id: 'tray', name: 'Special Tray' }, { id: 'blocks', name: 'Bite Registration' }, { id: 'tryin', name: 'Try In' },
  { id: 'retry', name: 'Retry' }, { id: 'finish', name: 'Finish' },
];
export type DentureTreatment = 'staged' | 'stf' | 'immediate';
export const DENTURE_TREATMENTS: { id: DentureTreatment; name: string }[] = [
  { id: 'staged', name: 'Staged' }, { id: 'stf', name: 'Straight to Finish' }, { id: 'immediate', name: 'Immediate' },
];
export interface StagePlan {
  id: DentureStageId;
  state: 'order' | 'elsewhere' | 'here';
  /** ISO yyyy-mm-dd: needed back by ('order'), or the optional day it was done ('elsewhere'). */
  date?: string;
  /** 'here': the case it was done on. */
  caseId?: string;
  src?: string;
}

export const isStageId = (id?: string): id is DentureStageId => DENTURE_STAGES.some(s => s.id === id);
export const stageName = (id: DentureStageId) => DENTURE_STAGES.find(s => s.id === id)?.name ?? id;
export const treatmentName = (t: DentureTreatment) => DENTURE_TREATMENTS.find(x => x.id === t)!.name;
const stageRank = (id: DentureStageId) => DENTURE_STAGES.findIndex(s => s.id === id);

export function dentureTreatment(item: ServiceItem): DentureTreatment {
  if (item.treatment) return item.treatment;
  return item.stage === 'stf' || item.stage === 'immediate' ? item.stage : 'staged';
}

/** The stages in play, in stage order. Straight to Finish / Immediate: their one Finish. An older single `stage` reads as that stage ordered. */
export function stagePlan(item: ServiceItem): StagePlan[] {
  if (item.product !== 'denture') return [];
  if (dentureTreatment(item) !== 'staged') {
    return [item.stages?.find(s => s.id === 'finish' && s.state === 'order') ?? { id: 'finish', state: 'order' }];
  }
  const rows = item.stages ?? (isStageId(item.stage) ? [{ id: item.stage, state: 'order' as const, src: item.stageSrc }] : []);
  return [...rows].sort((a, b) => stageRank(a.id) - stageRank(b.id));
}
export const orderedStages = (item: ServiceItem) => stagePlan(item).filter(s => s.state === 'order');

/** The lab's catalogue key for a row: the stage, or the treatment that replaces the stages. */
export const stageOption = (item: ServiceItem, id: DentureStageId) => {
  const t = dentureTreatment(item);
  return t === 'staged' ? id : t;
};
/** The lab's working days for a stage (or for the treatment). */
export function stageDays(item: ServiceItem, id: DentureStageId, lab: Lab): number | null {
  return lab.prices[`denture:${stageOption(item, id)}`]?.[2] ?? null;
}
/** Dentures always go by post: the day the lab counts the case as received. */
export const dentureReceived = (ctx: Ctx, lab: Lab = ctx.lab) => receivedDate('post', ctx.now, lab.cutoffMin, CLINIC.courierDays);

/**
 * Every stage's suggested needed-by day (ISO), in order: the previous ordered
 * stage's day (or the day the lab receives the case) plus this stage's lab
 * working days. Ordered or not, so ordering a stage can take its suggestion.
 */
export function suggestedStageDates(item: ServiceItem, ctx: Ctx, lab: Lab = ctx.lab): Record<DentureStageId, string> {
  const plan = stagePlan(item);
  let base = dentureReceived(ctx, lab);
  const out = {} as Record<DentureStageId, string>;
  for (const { id } of DENTURE_STAGES) {
    const sugg = addWorkingDays(base, stageDays(item, id, lab) ?? 5);
    out[id] = toISO(sugg);
    const row = plan.find(r => r.id === id && r.state === 'order');
    if (row) base = row.date ? fromISO(row.date) : sugg;
  }
  return out;
}

/** Is the plan good to go: a stage ordered, and every ordered stage made by the lab and dated today or later. */
export function dentureStageReady(item: ServiceItem, ctx: Ctx): boolean {
  const ordered = orderedStages(item);
  const today = toISO(ctx.now);
  return ordered.length > 0 && ordered.every(s =>
    !!s.date && s.date >= today && optionAvail(ctx.lab, 'denture', stageOption(item, s.id), ctx.funding).ok);
}
/** Ordered stages dated on or before an earlier ordered stage: warned about, never blocked. */
export function stagesOutOfOrder(item: ServiceItem): DentureStageId[] {
  const out: DentureStageId[] = [];
  let last: string | undefined;
  for (const s of orderedStages(item)) {
    if (!s.date) continue;
    if (last && s.date <= last) out.push(s.id);
    else last = s.date;
  }
  return out;
}
/** The ordered stage due back first (the denture's one date for the case's Back by). */
export function firstStageDue(item: ServiceItem): StagePlan | undefined {
  return orderedStages(item).filter(s => s.date).sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
}
/** It continues the patient's earlier case: the lab has the models. */
export const isFollowUp = (item: ServiceItem) =>
  item.stageSrc === 'Next stage' || stagePlan(item).some(s => s.state === 'here');

/** "Try In · Thu 12 Nov, Finish · Thu 26 Nov · Bite Registration done elsewhere" */
export function stagesSummary(item: ServiceItem): string {
  const plan = stagePlan(item);
  const t = dentureTreatment(item);
  const day = (iso?: string) => (iso ? fmtDay(fromISO(iso)) : 'date needed');
  if (t !== 'staged') return `${treatmentName(t)} · ${day(plan[0]?.date)}`;
  const here = plan.filter(s => s.state === 'here');
  const away = plan.filter(s => s.state === 'elsewhere');
  return [
    plan.filter(s => s.state === 'order').map(s => `${stageName(s.id)} · ${day(s.date)}`).join(', '),
    here.length ? `${andList(here.map(s => stageName(s.id)))} done here${here[0].caseId ? ` (${here[0].caseId})` : ''}` : '',
    away.length ? `${andList(away.map(s => stageName(s.id)))} done elsewhere` : '',
  ].filter(Boolean).join(' · ');
}
/** The ordered stages in one short line: "Try In 12 Nov, Finish 26 Nov", "Straight to Finish 6 Nov". */
export function stagesShort(item: ServiceItem): string {
  const t = dentureTreatment(item);
  return orderedStages(item)
    .map(s => `${t === 'staged' ? stageName(s.id) : treatmentName(t)}${s.date ? ` ${fmtShort(fromISO(s.date))}` : ''}`)
    .join(', ');
}

/**
 * A full denture made ready (idempotent; every way a denture comes in goes
 * through it): an older single `stage` becomes the treatment or that stage
 * ordered; a plan for the arch and lab of the patient's next stage starts as
 * that follow-up — the stages before it done here on the earlier case, the next
 * one ordered (src 'Next stage', settled); the follow-up's rows go once they no
 * longer match the patient, arch or lab; every ordered stage without a day gets
 * its suggested one.
 */
export function seedDenturePlan(item: ServiceItem, ctx: Ctx): ServiceItem {
  if (item.product !== 'denture') return item;
  const it: ServiceItem = { ...item };
  if (it.stage) {
    if (it.stage === 'stf' || it.stage === 'immediate') {
      it.treatment = it.treatment ?? it.stage;
      it.treatmentSrc = it.treatmentSrc ?? it.stageSrc;
    } else if (isStageId(it.stage) && !it.stages) {
      it.stages = [{ id: it.stage, state: 'order', src: it.stageSrc }];
    }
    it.stage = undefined;
  }
  const ns = ctx.patient.nextStage;
  const follows = !!ns && ns.product === 'denture' && isStageId(ns.stage) && it.arch === ns.arch && ctx.lab.id === ns.lab
    && dentureTreatment(it) === 'staged';
  // The follow-up's rows go with it (another arch, lab or patient); the plan starts again.
  const stale = (s: StagePlan) => (follows ? s.state === 'here' && s.caseId !== ns!.caseId : s.state === 'here' || s.src === 'Next stage');
  if (it.stages?.some(stale)) {
    it.stages = it.stages.filter(s => !stale(s));
    it.stagesDone = false;
  }
  if (it.stageSrc === 'Next stage' && !follows) it.stageSrc = undefined;
  // Nothing planned yet, or just that next stage ordered (an older `stage`, or the arch switched back).
  const only = it.stages?.length === 1 && it.stages[0].state === 'order' && it.stages[0].id === ns?.stage ? it.stages[0] : undefined;
  if (follows && (!it.stages?.length || only)) {
    const at = stageRank(ns!.stage as DentureStageId);
    it.stages = [
      ...DENTURE_STAGES.slice(0, at).map((s): StagePlan => ({ id: s.id, state: 'here', caseId: ns!.caseId, src: 'Next stage' })),
      { id: ns!.stage as DentureStageId, state: 'order', date: only?.date, src: 'Next stage' },
    ];
    it.stagesDone = true;
    it.stageSrc = 'Next stage';
  }
  if (dentureTreatment(it) !== 'staged') it.stages = stagePlan(it);
  if (it.stages?.some(s => s.state === 'order' && !s.date)) {
    const sugg = suggestedStageDates(it, ctx);
    it.stages = it.stages.map(s => (s.state === 'order' && !s.date ? { ...s, date: sugg[s.id] } : s));
  }
  return it;
}

// ─── Slots ───────────────────────────────────────────────────────────────────

export type SlotId =
  | 'labCheck' | 'teeth' | 'implantRecord' | 'remake' | 'remakeReason' | 'splint' | 'material' | 'shade' | 'photos'
  | 'prefs' | 'wings' | 'system' | 'platform' | 'scanBody' | 'retention' | 'abutment' | 'inlayType' | 'type' | 'arch'
  | 'under18' | 'stage' | 'stages' | 'acrylic' | 'extract' | 'mould' | 'postdam' | 'base' | 'design' | 'work' | 'desc';

export interface Slot {
  id: SlotId;
  label: string;
  required: boolean;
  answered: boolean;
  value?: string;
  src?: string;
}

export function shadeText(item: ServiceItem): string {
  if (!item.shade) return '';
  if (item.shade === 'photos') return 'Match from photos';
  return [item.shade, item.incisal && `incisal ${item.incisal}`, item.cervical && `cervical ${item.cervical}`, item.stump && `stump ${item.stump}`]
    .filter(Boolean).join(' · ');
}

export function slotsFor(item: ServiceItem, ctx: Ctx): Slot[] {
  const n = ctx.user.notation;
  const e = effective(item, ctx);
  const s: Slot[] = [];
  const push = (slot: Slot) => s.push(slot);
  const reopened = (id: SlotId) => !!item.reopen?.includes(id);
  const matOk = !!e.material && optionAvail(ctx.lab, item.product, e.material, ctx.funding, item).ok && !reopened('material');
  const materialSlot = (label = 'Material'): Slot => ({
    id: 'material', label, required: true, answered: matOk,
    value: matOk ? optionName(item.product, e.material) : undefined, src: matOk ? e.matSrc : undefined,
  });
  const shadeSlot = (label = 'Shade'): Slot => ({ id: 'shade', label, required: true, answered: !!item.shade, value: shadeText(item), src: item.shadeSrc });
  const prefsSlot = (): Slot => ({ id: 'prefs', label: 'Preferences', required: false, answered: true, value: e.prefsChanged ? 'Changed for this case' : e.prefsSrc, src: e.prefsChanged ? 'You' : e.prefsSrc });
  const teethSlot = (label: string, value: string): Slot => ({ id: 'teeth', label, required: true, answered: item.teethDone && item.teeth.length > 0, value, src: item.teethSrc });

  if (!labMakes(ctx.lab, item.product)) push({ id: 'labCheck', label: 'Lab', required: true, answered: false });

  switch (item.product) {
    case 'crown': {
      push(teethSlot('Teeth', teethText(item.teeth, n)));
      if (item.teethDone && implantOnRecord(item, ctx.patient)) {
        push({ id: 'implantRecord', label: 'Implant on record', required: true, answered: !!item.implantDecision, value: item.implantDecision === 'keep' ? 'Crown on natural tooth' : undefined });
      }
      if (item.teethDone && remakeCandidate(item, ctx.patient, ctx.now)) {
        push({ id: 'remake', label: 'Remake?', required: true, answered: !!item.remake, value: item.remake === 'yes' ? 'Remake' : item.remake === 'no' ? 'New work' : undefined });
        if (item.remake === 'yes') push({ id: 'remakeReason', label: 'What went wrong', required: true, answered: !!item.remakeReason, value: item.remakeReason });
      }
      if (item.teethDone && item.teeth.length > 1 && hasAdjacent(item.teeth)) {
        push({ id: 'splint', label: 'Separate or splinted', required: false, answered: true, value: e.splint === 'splinted' ? 'Splinted' : 'Separate', src: e.splintSrc });
      }
      push(materialSlot());
      if (e.material !== 'metal') push(shadeSlot());
      if (item.shade === 'photos') push({ id: 'photos', label: 'Photos', required: true, answered: item.photos.length > 0, value: item.photos.length ? plural(item.photos.length, 'photo') : undefined });
      push(prefsSlot());
      break;
    }
    case 'bridge': {
      const issue = bridgeIssue(item);
      push({ id: 'teeth', label: 'End teeth', required: true, answered: item.teethDone && !issue, value: item.teeth.length > 1 ? spanText(item.teeth, n) : undefined });
      if (item.rbb) push({ id: 'wings', label: 'Wings', required: true, answered: !!item.wingsDone && (item.wings?.length ?? 0) > 0, value: item.wings?.length ? sortNum(item.wings).join(', ') : undefined });
      push(materialSlot());
      if (e.material !== 'metal') push(shadeSlot());
      if (item.shade === 'photos') push({ id: 'photos', label: 'Photos', required: true, answered: item.photos.length > 0, value: item.photos.length ? plural(item.photos.length, 'photo') : undefined });
      push(prefsSlot());
      break;
    }
    case 'implant': {
      push({ id: 'teeth', label: 'Site', required: true, answered: item.teethDone && item.teeth.length === 1, value: teethText(item.teeth, n), src: item.teethSrc });
      push({ id: 'system', label: 'System', required: true, answered: !!e.system, value: e.system, src: e.systemSrc });
      const sys = IMPLANT_SYSTEMS.find(x => x.name === e.system);
      if (!sys || sys.platforms.length > 1 || e.platform) {
        push({ id: 'platform', label: 'Platform', required: true, answered: !!e.platform, value: e.platform, src: e.platformSrc });
      }
      push({ id: 'scanBody', label: 'Scan body', required: true, answered: !!item.scanBody, value: item.scanBody });
      push(materialSlot());
      push({ id: 'retention', label: 'Retention', required: false, answered: true, value: e.retention === 'cement' ? 'Cement-retained' : 'Screw-retained', src: e.retentionSrc });
      if (e.retention === 'cement') push({ id: 'abutment', label: 'Abutment', required: true, answered: !!item.abutment, value: item.abutment });
      push(shadeSlot());
      push(prefsSlot());
      break;
    }
    case 'veneer': {
      push(teethSlot('Teeth', teethText(item.teeth, n)));
      if (item.teethDone && remakeCandidate(item, ctx.patient, ctx.now)) {
        push({ id: 'remake', label: 'Remake?', required: true, answered: !!item.remake, value: item.remake === 'yes' ? 'Remake' : item.remake === 'no' ? 'New work' : undefined });
        if (item.remake === 'yes') push({ id: 'remakeReason', label: 'What went wrong', required: true, answered: !!item.remakeReason, value: item.remakeReason });
      }
      push(materialSlot());
      push(shadeSlot());
      push({ id: 'photos', label: 'Photos', required: true, answered: item.photos.length > 0, value: item.photos.length ? plural(item.photos.length, 'photo') : undefined });
      break;
    }
    case 'inlay': {
      push({ id: 'teeth', label: 'Tooth', required: true, answered: item.teethDone && item.teeth.length === 1, value: teethText(item.teeth, n), src: item.teethSrc });
      if (item.teethDone && remakeCandidate(item, ctx.patient, ctx.now)) {
        push({ id: 'remake', label: 'Remake?', required: true, answered: !!item.remake, value: item.remake === 'yes' ? 'Remake' : item.remake === 'no' ? 'New work' : undefined });
        if (item.remake === 'yes') push({ id: 'remakeReason', label: 'What went wrong', required: true, answered: !!item.remakeReason, value: item.remakeReason });
      }
      push({ id: 'inlayType', label: 'Inlay or onlay', required: true, answered: !!item.inlayType, value: item.inlayType === 'inlay' ? 'Inlay' : item.inlayType === 'onlay' ? 'Onlay' : undefined });
      push(materialSlot());
      push(shadeSlot());
      push(prefsSlot());
      break;
    }
    case 'nightguard':
    case 'retainer': {
      const typeOk = !!e.type && optionAvail(ctx.lab, item.product, e.type, ctx.funding).ok && !reopened('type');
      push({ id: 'type', label: 'Type', required: true, answered: typeOk, value: typeOk ? optionName(item.product, e.type) : undefined, src: typeOk ? e.typeSrc : undefined });
      push({ id: 'arch', label: 'Arch', required: true, answered: !!item.arch, value: archCaps(item.arch), src: item.archSrc });
      break;
    }
    case 'whitening': {
      if (isUnder18(ctx.patient, ctx.now)) push({ id: 'under18', label: 'Age check', required: true, answered: false });
      push({ id: 'arch', label: 'Arch', required: true, answered: !!item.arch, value: archCaps(item.arch), src: item.archSrc });
      break;
    }
    case 'denture': {
      push({ id: 'arch', label: 'Arch', required: true, answered: !!item.arch, value: archCaps(item.arch), src: item.archSrc });
      // The plan: answered once it's good to go and the user said that's it (several rows, like teeth).
      const ordered = orderedStages(item);
      const srcs = ordered.map(s => s.src);
      push({
        id: 'stages', label: 'Stages', required: true,
        answered: !!item.stagesDone && dentureStageReady(item, ctx) && !reopened('stages'),
        value: stagesShort(item) || undefined,
        src: (dentureTreatment(item) !== 'staged' ? item.treatmentSrc : undefined) ?? (srcs.length && srcs.every(x => x === srcs[0]) ? srcs[0] : undefined),
      });
      push({ id: 'acrylic', label: 'Acrylic', required: false, answered: true, value: e.acrylic, src: e.acrylicSrc });
      const treatment = dentureTreatment(item);
      if (treatment === 'immediate') {
        push({ id: 'extract', label: 'Teeth to extract', required: true, answered: !!item.extractDone && (item.extract?.length ?? 0) > 0, value: teethText(item.extract ?? [], n) });
      }
      // Teeth are set up from the Try In on (and for the treatments that go straight to a finished denture).
      if (treatment !== 'staged' || ordered.some(s => s.id === 'tryin' || s.id === 'retry' || s.id === 'finish')) {
        push({ id: 'shade', label: 'Tooth shade', required: true, answered: !!item.shade, value: item.shade });
        push({ id: 'mould', label: 'Mould', required: false, answered: true, value: e.mould, src: e.mouldSrc });
      }
      // A post-dam (the palatal seal) is an upper denture's only.
      if (item.arch !== 'lower' && ordered.some(s => s.id === 'finish')) push({ id: 'postdam', label: 'Post-dam', required: true, answered: !!item.postdam, value: item.postdam });
      break;
    }
    case 'partial': {
      push({ id: 'arch', label: 'Arch', required: true, answered: !!item.arch && item.arch !== 'both', value: archCaps(item.arch) });
      push(teethSlot('Teeth to replace', teethText(item.teeth, n)));
      const baseOk = !!item.base && optionAvail(ctx.lab, 'partial', item.base, ctx.funding).ok;
      push({ id: 'base', label: 'Base', required: true, answered: baseOk, value: baseOk ? optionName('partial', item.base) : undefined });
      const stageOk = !!item.stage && (item.stage !== 'framework' || item.base === 'chrome');
      push({ id: 'stage', label: 'Stage', required: true, answered: stageOk, value: stageOk ? PARTIAL_STAGES.find(x => x.id === item.stage)?.name : undefined });
      push({ id: 'design', label: 'Design', required: true, answered: !!item.design, value: PARTIAL_DESIGNS.find(x => x.id === item.design)?.name });
      push({ id: 'shade', label: 'Tooth shade', required: true, answered: !!item.shade, value: item.shade });
      break;
    }
    case 'reline': {
      const workOk = !!item.work && optionAvail(ctx.lab, 'reline', item.work, ctx.funding).ok;
      push({ id: 'work', label: 'Work needed', required: true, answered: workOk, value: workOk ? optionName('reline', item.work) : undefined });
      push({ id: 'arch', label: 'Arch', required: true, answered: !!item.arch && item.arch !== 'both', value: archCaps(item.arch) });
      if (item.work === 'addtooth') push(teethSlot('Tooth to add', teethText(item.teeth, n)));
      break;
    }
    case 'other': {
      push({ id: 'desc', label: 'Description', required: true, answered: !!item.descDone && (item.desc?.trim().length ?? 0) >= 10, value: item.desc?.trim() ? `${item.desc.trim().slice(0, 28)}${item.desc.trim().length > 28 ? '…' : ''}` : undefined });
      break;
    }
  }
  return s;
}

export const slotGaps = (slots: Slot[]) => slots.filter(x => x.required && !x.answered);

// ─── Pricing and turnaround ──────────────────────────────────────────────────

export function priceKey(item: ServiceItem, ctx: Ctx): string | undefined {
  const e = effective(item, ctx);
  switch (item.product) {
    case 'crown': case 'bridge': case 'veneer': case 'inlay':
      return e.material ? `${item.product}:${e.material}` : undefined;
    case 'implant':
      return e.retention === 'cement' ? 'implant:cement' : e.material ? `implant:${e.material}` : undefined;
    case 'nightguard': case 'retainer':
      return e.type ? `${item.product}:${e.type}` : undefined;
    case 'whitening': return 'whitening:trays';
    // The first ordered stage (its turnaround is the fallback lead time), or the treatment.
    case 'denture': { const first = orderedStages(item)[0]; return first ? `denture:${stageOption(item, first.id)}` : undefined; }
    case 'partial': return item.base ? `partial:${item.base}` : undefined;
    case 'reline': return item.work ? `reline:${item.work}` : undefined;
    case 'other': return 'other:tbc';
  }
}
export function unitsOf(item: ServiceItem): number {
  if (item.product === 'crown' || item.product === 'veneer') return Math.max(1, item.teeth.length);
  if (item.product === 'bridge') return item.rbb ? 1 : Math.max(1, item.teeth.length);
  if (item.product === 'retainer' || item.product === 'whitening') return item.arch === 'both' ? 2 : 1;
  return 1;
}
export const fastTrackEligible = (item: ServiceItem, ctx: Ctx, lab: Lab = ctx.lab) => {
  const ft = lab.fastTrack;
  const e = effective(item, { ...ctx, lab });
  return !!ft && ft.products.includes(item.product) && !!e.material && ft.materials.includes(e.material) && item.remake !== 'yes';
};

export interface PriceInfo {
  kind: 'price' | 'remake' | 'tbc' | 'included' | 'none';
  total: number | null;
  unit: number | null;
  units: number;
  ta: number | null;
  /**
   * Always ''. The flow shows no prices, so there is nothing to label; the
   * numbers above stay for sorting and defaults only. Use priceLine (the lead
   * time) or `ta` for anything shown.
   */
  label: string;
  /** Always undefined (it used to carry the unit price). */
  detail?: string;
  privateCharge?: boolean;
}

export function turnaround(item: ServiceItem, ctx: Ctx, fastTrack: boolean, lab: Lab = ctx.lab): number | null {
  const lctx = { ...ctx, lab };
  const key = priceKey(item, lctx);
  if (!key) {
    // Not chosen yet: use the lab's quickest option for that product as a guide.
    const tas = Object.entries(lab.prices).filter(([k]) => k.startsWith(`${item.product}:`)).map(([, v]) => v[2]);
    return tas.length ? Math.min(...tas) : null;
  }
  const entry = lab.prices[key];
  if (!entry) return null;
  let ta = entry[2];
  if (item.product === 'bridge' && !item.rbb && item.teeth.length >= 4) ta += 2;
  if (item.product === 'partial') {
    if (item.stage === 'framework') ta = 10;
    if (item.design === 'propose') ta += 2;
  }
  if (fastTrack && fastTrackEligible(item, ctx, lab)) ta -= lab.fastTrack!.daysFaster;
  return ta;
}

export function priceOf(item: ServiceItem, ctx: Ctx, fastTrack: boolean, lab: Lab = ctx.lab): PriceInfo {
  const lctx = { ...ctx, lab };
  const ta = turnaround(item, ctx, fastTrack, lab);
  const units = unitsOf(item);
  const privateCharge = PRODUCTS[item.product].privateOnly && ctx.funding === 'nhs';
  const key = priceKey(item, lctx);
  if (item.product === 'other') return { kind: 'tbc', total: null, unit: null, units, ta, label: '' };
  if (item.remake === 'yes') return { kind: 'remake', total: null, unit: null, units, ta, label: '' };
  if (!key || !lab.prices[key]) return { kind: 'none', total: null, unit: null, units, ta, label: '' };
  if (item.product === 'partial' && item.stage && item.stage !== 'finish') {
    return { kind: 'included', total: 0, unit: null, units, ta, label: '' };
  }
  if (item.product === 'denture') {
    // Each ordered stage is charged (internal only); stages done here or elsewhere aren't.
    const fi = itemFunding('denture', ctx.funding) === 'nhs' ? 1 : 0;
    const each = orderedStages(item).map(s => lab.prices[`denture:${stageOption(item, s.id)}`]?.[fi]);
    if (each.some(v => v == null)) return { kind: 'none', total: null, unit: null, units, ta, label: '' };
    const total = each.reduce<number>((a, v) => a + (v ?? 0), 0);
    return { kind: 'price', total, unit: total, units, ta, label: '' };
  }
  const entry = lab.prices[key];
  const unit = itemFunding(item.product, ctx.funding) === 'nhs' ? entry[1] : entry[0];
  if (unit == null) return { kind: 'none', total: null, unit: null, units, ta, label: '' };
  const ft = fastTrack && fastTrackEligible(item, ctx, lab) ? lab.fastTrack!.perUnit : 0;
  const total = (unit + ft) * units;
  // The amounts stay internal (sorting, defaults); nothing here is for the screen.
  return { kind: 'price', total, unit: unit + ft, units, ta, label: '', privateCharge };
}
/** The lead time for a service or option: "7 days" ('' when it can't be made as chosen). No price. */
export function priceLine(p: PriceInfo): string {
  if (p.kind === 'none') return '';
  return p.ta != null ? plural(p.ta, 'day') : '';
}

// ─── Records ─────────────────────────────────────────────────────────────────

export type RecordsState = 'scan' | 'nextStage' | 'follow' | 'post' | 'upload' | 'none';
export function recordsState(d: CaseDraft, ctx: Ctx): RecordsState {
  const dentureOnly = d.items.length > 0 && d.items.every(i => isDentureLike(i.product));
  if (dentureOnly) return d.items.some(isFollowUp) ? 'nextStage' : 'post';
  if (d.scan) return 'scan';
  return d.records.route ?? 'none';
}
export const isPosted = (s: RecordsState) => s === 'post' || s === 'nextStage';
export function recordsGap(d: CaseDraft, ctx: Ctx): boolean {
  const s = recordsState(d, ctx);
  if (s === 'none') return true;
  // Impressions by post: nothing to tick here (no disinfection check at Scans Source).
  if (isPosted(s)) return false;
  if (s === 'upload') return d.records.files.length === 0 || d.records.files.some(f => !f.role);
  return false;
}
export function defaultBox(d: CaseDraft): Record<string, boolean> {
  const dentures = d.items.some(i => isDentureLike(i.product));
  const reline = d.items.some(i => i.product === 'reline');
  const next = d.items.some(isFollowUp);
  return {
    'Upper impression': !next && !reline,
    'Lower impression': !next && !reline,
    'Bite registration': !next && !dentures,
    'Shade tab': false,
    'Old denture': reline,
    'Implant components': d.items.some(i => i.product === 'implant'),
    'Recorded bite blocks': next,
  };
}
export const BOX_ITEMS = ['Upper impression', 'Lower impression', 'Bite registration', 'Shade tab', 'Old denture', 'Implant components', 'Recorded bite blocks'];
export function guessFileRole(name: string): FileRole | undefined {
  const n = name.toLowerCase();
  if (/(^|[^a-z])(bite|occlus|bucc)/.test(n)) return 'bite';
  if (/(upper|maxill|\bup\b|_u\.|-u\.)/.test(n)) return 'upper';
  if (/(lower|mandib|\blow\b|_l\.|-l\.)/.test(n)) return 'lower';
  return undefined;
}

// ─── Prescriber ──────────────────────────────────────────────────────────────

export function resolvePrescriber(d: CaseDraft, user: User, loginMap: Record<string, UserId | undefined>): { id?: UserId; src?: string } {
  if (d.prescriber) return { id: d.prescriber, src: d.prescriberSrc ?? 'You' };
  if (d.login && loginMap[d.login]) return { id: loginMap[d.login], src: `From ${d.login.split(':')[0]} login` };
  if (user.role === 'dentist') return { id: user.id, src: 'You' };
  return {};
}
export const prescriberGap = (p?: User) => !p || !p.gdc;
export type SendMode = 'self' | 'delegated' | 'approval';
export function sendMode(user: User, prescriber?: User): SendMode {
  if (!prescriber || prescriber.id === user.id) return 'self';
  return prescriber.delegation ? 'delegated' : 'approval';
}

// ─── Gaps ────────────────────────────────────────────────────────────────────

export function gapCount(d: CaseDraft, ctx: Ctx): number {
  let n = (d.items.length === 0 ? 1 : 0) + (d.labPicked === false ? 1 : 0);
  for (const it of d.items) n += slotGaps(slotsFor(it, ctx)).length;
  if (recordsGap(d, ctx)) n++;
  if (prescriberGap(ctx.prescriber)) n++;
  return n;
}

export type StepKind = 'patient' | 'lab' | 'services' | 'slot' | 'records' | 'prescriber' | 'delivery' | 'review';
export interface StepNode { id: string; kind: StepKind; gap: boolean; navigable: boolean; itemId?: string; slot?: Slot }
export const slotStepId = (itemId: string, slot: SlotId) => `svc:${itemId}:${slot}`;
export function parseStep(id: string): { kind: StepKind; itemId?: string; slot?: SlotId } {
  if (id.startsWith('svc:')) {
    const [, itemId, slot] = id.split(':');
    return { kind: 'slot', itemId, slot: slot as SlotId };
  }
  return { kind: id as StepKind };
}

/** Every step in order. Sub-steps after a service's first gap are not navigable. */
export function buildSteps(d: CaseDraft, ctx: Ctx, current: string): StepNode[] {
  const out: StepNode[] = [
    { id: 'patient', kind: 'patient', gap: false, navigable: true },
    { id: 'lab', kind: 'lab', gap: d.labPicked === false, navigable: true },
  ];
  if (d.items.length === 0 || current === 'services') {
    out.push({ id: 'services', kind: 'services', gap: d.items.length === 0, navigable: true });
  }
  for (const it of d.items) {
    let seenGap = false;
    for (const sl of slotsFor(it, ctx)) {
      const gap = sl.required && !sl.answered;
      out.push({ id: slotStepId(it.id, sl.id), kind: 'slot', gap, navigable: !seenGap, itemId: it.id, slot: sl });
      if (gap) seenGap = true;
    }
  }
  out.push({ id: 'records', kind: 'records', gap: recordsGap(d, ctx), navigable: true });
  out.push({ id: 'prescriber', kind: 'prescriber', gap: prescriberGap(ctx.prescriber), navigable: true });
  // No Delivery step: each service carries its own back-by date, shown with the
  // fit appointment and fast track on Review and Send.
  out.push({ id: 'review', kind: 'review', gap: false, navigable: true });
  return out;
}
/** Next gap after `from`, else the first gap, else Review. */
export function nextGap(steps: StepNode[], from: string): string {
  const i = steps.findIndex(s => s.id === from);
  const after = steps.slice(i + 1).find(s => s.gap && s.navigable);
  if (after) return after.id;
  const first = steps.find(s => s.gap && s.navigable);
  return first?.id ?? 'review';
}
export const firstGap = (steps: StepNode[]) => steps.find(s => s.gap && s.navigable)?.id ?? 'review';

// ─── Delivery dates ──────────────────────────────────────────────────────────

export type DateRoute = 'digital' | 'post' | 'follow';
export function dateRoute(d: CaseDraft, ctx: Ctx): DateRoute {
  const s = recordsState(d, ctx);
  if (isPosted(s)) return 'post';
  if (s === 'follow') return 'follow';
  return 'digital';
}

export interface CaseDates {
  route: DateRoute;
  received?: Date;
  backBy?: Date;
  earliestFit?: Date;
  /** Working days after the scan arrives (scan to follow). */
  ta?: number;
  perItem: { id: string; backBy?: Date; ta: number | null }[];
}
export function caseDates(d: CaseDraft, ctx: Ctx, opts: { lab?: Lab; fastTrack?: boolean; items?: ServiceItem[] } = {}): CaseDates {
  const lab = opts.lab ?? ctx.lab;
  const fast = opts.fastTrack ?? d.fastTrack;
  const items = opts.items ?? d.items;
  const route = dateRoute(d, ctx);
  const received = receivedDate(route === 'post' ? 'post' : 'digital', ctx.now, lab.cutoffMin, CLINIC.courierDays);
  const perItem = items.map(it => {
    if (!labMakes(lab, it.product)) return { id: it.id, ta: null };
    // A full denture has no date of its own: it's back when its first ordered stage is (else that stage's suggested day).
    if (it.product === 'denture' && orderedStages(it).length) {
      const first = firstStageDue(it);
      const back = first ? fromISO(first.date!) : fromISO(suggestedStageDates(it, ctx, lab)[orderedStages(it)[0].id]);
      return { id: it.id, ta: workingDaysBetween(received, back), backBy: back };
    }
    const ta = turnaround(it, ctx, fast, lab);
    return { id: it.id, ta, backBy: ta != null ? addWorkingDays(received, ta) : undefined };
  });
  if (items.length === 0 || perItem.some(p => p.ta == null)) return { route, received, perItem };
  const ta = Math.max(...perItem.map(p => p.ta!));
  const backBy = perItem.reduce((a, p) => (p.backBy! > a ? p.backBy! : a), perItem[0].backBy!);
  return { route, received, backBy, earliestFit: firstClinicDayAfter(backBy), ta, perItem };
}

/** With a fit date F: the lab must deliver by the last working day before F. */
export function fitCheck(fitISO: string, backBy: Date) {
  const fit = fromISO(fitISO);
  const neededBy = lastWorkingDayBefore(fit);
  const ok = neededBy >= backBy;
  return { fit, neededBy, ok, spare: ok ? workingDaysBetween(backBy, neededBy) : 0 };
}

/** "Fit Thu 12 Nov · lab delivers by Wed 11 Nov · 3 working days spare" */
export function fitLine(f: ReturnType<typeof fitCheck>): string {
  return `Fit ${fmtDay(f.fit)} · lab delivers by ${fmtDay(f.neededBy)} · ${f.spare ? `${plural(f.spare, 'working day')} spare` : 'no spare day if the lab has a question'}`;
}

/** Ways to make a too-soon fit date work. */
export function fitFixes(d: CaseDraft, ctx: Ctx, fitISO: string, approvedLabs: Lab[] = LABS): { kind: 'fast' | 'lab'; label: string; labId?: LabId; backBy: Date }[] {
  const fixes: { kind: 'fast' | 'lab'; label: string; labId?: LabId; backBy: Date }[] = [];
  const ft = ctx.lab.fastTrack;
  if (ft && !d.fastTrack && d.items.some(i => fastTrackEligible(i, ctx))) {
    const dates = caseDates(d, ctx, { fastTrack: true });
    if (dates.backBy && fitCheck(fitISO, dates.backBy).ok) {
      fixes.push({ kind: 'fast', label: `Use Fast-Track · ${plural(ft.daysFaster, 'working day')} faster · back ${fmtDay(dates.backBy)}`, backBy: dates.backBy });
    }
  }
  for (const lab of approvedLabs) {
    if (lab.id === ctx.lab.id) continue;
    if (!d.items.every(i => labMakes(lab, i.product))) continue;
    const lctx = { ...ctx, lab };
    if (!d.items.every(i => { const k = priceKey(i, lctx); const opt = k?.split(':')[1]; return !opt || optionAvail(lab, i.product, opt, ctx.funding, i).ok; })) continue;
    const dates = caseDates(d, lctx, { lab, fastTrack: false });
    if (dates.backBy && fitCheck(fitISO, dates.backBy).ok) {
      fixes.push({ kind: 'lab', label: `Switch to ${lab.name} · back ${fmtDay(dates.backBy)}`, labId: lab.id, backBy: dates.backBy });
    }
  }
  return fixes;
}

/** Two services back three or more working days apart → offer to send them separately. */
export function splitSuggestion(d: CaseDraft, ctx: Ctx, dates: CaseDates) {
  if (d.items.length < 2 || !dates.backBy) return null;
  const withDates = dates.perItem.filter(p => p.backBy);
  if (withDates.length < 2) return null;
  const earliest = withDates.reduce((a, b) => (a.backBy! <= b.backBy! ? a : b));
  if (workingDaysBetween(earliest.backBy!, dates.backBy) < 3) return null;
  const item = d.items.find(i => i.id === earliest.id)!;
  return { item, backBy: earliest.backBy! };
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** "Crown · 36 · LL6", "Night guard · UPPER", "Bridge · 14–16 · UR4–UR6" */
export function itemTitle(item: ServiceItem, n: Notation = 'fdi'): string {
  const label = PRODUCTS[item.product].label;
  const name = item.product === 'other' ? 'Something Else' : label;
  if (item.product === 'bridge') return item.teeth.length > 1 ? `${name} · ${spanText(item.teeth, n)}` : name;
  if (['nightguard', 'retainer', 'whitening', 'denture', 'reline'].includes(item.product)) {
    const noun = item.product === 'nightguard' ? 'Night guard' : item.product === 'denture' ? 'Full denture' : label;
    return item.arch ? `${noun} · ${archCaps(item.arch)}` : noun;
  }
  if (item.product === 'partial') return item.arch ? `Partial denture · ${archCaps(item.arch)}` : 'Partial denture';
  // Past four teeth a title reads as a count; the chart beside it shows which.
  if (item.teeth.length > 4) return `${name} · ${item.teeth.length} teeth`;
  return item.teeth.length ? `${name} · ${teethText(item.teeth, n)}` : name;
}
/** Lower-case noun phrase for sentences: "crown 21 · UL1", "night guard (upper)". */
export function itemPhrase(item: ServiceItem, n: Notation = 'fdi'): string {
  const noun = PRODUCTS[item.product].noun;
  if (item.arch && PRODUCTS[item.product].archItem) return `${noun} (${archWord(item.arch)})`;
  if (item.product === 'bridge' && item.teeth.length > 1) return `bridge ${spanText(item.teeth, n)}`;
  return item.teeth.length ? `${noun} ${teethText(item.teeth, n)}` : noun;
}
/** "Monolithic zirconia · A2" */
export function itemSpec(item: ServiceItem, ctx: Ctx): string {
  const e = effective(item, ctx);
  const parts: string[] = [];
  if (['crown', 'bridge', 'veneer', 'inlay', 'implant'].includes(item.product) && e.material) parts.push(optionName(item.product, e.material));
  if (item.product === 'implant' && e.retention === 'cement') parts.push('cement-retained');
  if ((item.product === 'nightguard' || item.product === 'retainer') && e.type) parts.push(optionName(item.product, e.type));
  if (item.product === 'denture') {
    const t = dentureTreatment(item);
    const ordered = orderedStages(item);
    if (t !== 'staged') parts.push(treatmentName(t));
    else if (ordered.length) parts.push(ordered.map(s => stageName(s.id)).join(' + '));
  }
  if (item.product === 'partial' && item.base) parts.push(`${optionName('partial', item.base)}${item.stage ? ` · ${PARTIAL_STAGES.find(s => s.id === item.stage)?.name}` : ''}`);
  if (item.product === 'reline' && item.work) parts.push(optionName('reline', item.work));
  if (item.product === 'inlay' && item.inlayType) parts.push(item.inlayType === 'inlay' ? 'Inlay' : 'Onlay');
  if (item.shade) parts.push(item.shade === 'photos' ? 'shade from photos' : item.shade);
  if (item.product === 'other' && item.desc) parts.push(item.desc.trim().slice(0, 40));
  return parts.join(' · ');
}

/** The one button that finishes the case: impressions by post wait for the courier (Ready for Dispatch); everything else is created straight away. */
export function sendLabel(mode: SendMode, prescriber: User | undefined, split: boolean, posted = false): string {
  if (mode === 'approval' && prescriber) return `Send to ${prescriber.short} to Approve`;
  const what = posted ? 'Ready for Dispatch' : split ? 'Create 2 Cases' : 'Create Case';
  if (mode === 'delegated' && prescriber) return `${what} for ${prescriber.short}`;
  return what;
}
export function attestation(mode: SendMode, user: User, prescriber: User | undefined, patient: Patient, follow: boolean): string {
  let s = '';
  if (!prescriber) return '';
  if (mode === 'self') {
    s = `Prescribed by ${prescriber.name}, GDC ${prescriber.gdc}, ${CLINIC.name}. Sending signs this prescription for ${initials(patient)} (${patient.practiceId || patient.id}).`;
  } else if (mode === 'delegated') {
    s = `You're sending this on behalf of ${prescriber.name} (GDC ${prescriber.gdc}). Both your names go on the prescription record, and ${prescriber.short} is told.`;
  } else {
    s = `${prescriber.short} approves and sends it with one tap. It stays a draft until then.`;
  }
  if (follow) s += ' The lab gets the prescription now and starts when the scan arrives.';
  return s;
}

// ─── Case instructions ───────────────────────────────────────────────────────

/** Each service's instructions, under its name, after any case-level note. */
export function mergedInstructions(d: CaseDraft, n: Notation = 'fdi'): string {
  return [
    d.note.trim(),
    ...d.items.filter(i => i.note?.trim()).map(i => `${itemTitle(i, n)}: ${i.note!.trim()}`),
  ].filter(Boolean).join('\n\n');
}
/** What goes to the lab: the user's edit of the merge, else the merge itself. */
export function caseInstructions(d: CaseDraft, n: Notation = 'fdi'): string {
  return d.instructions ?? mergedInstructions(d, n);
}
/** The user edited the merged text, then a service's instructions changed. */
export function instructionsStale(d: CaseDraft, n: Notation = 'fdi'): boolean {
  return d.instructions !== undefined && d.instructionsBase !== mergedInstructions(d, n);
}

// ─── Notes (never counted as gaps) ───────────────────────────────────────────

export interface NoteDef { id: string; text: string; itemId?: string; step: string; kind: 'openCase' | 'unlinked' | 'plain'; caseId?: string }
export function notesFor(d: CaseDraft, ctx: Ctx, dates: CaseDates): NoteDef[] {
  const out: NoteDef[] = [];
  for (const it of d.items) {
    const e = effective(it, ctx);
    const front = it.teeth.some(isFront);
    if (['crown', 'bridge', 'implant'].includes(it.product) && front && it.photos.length === 0 && it.teethDone) {
      out.push({ id: `photos:${it.id}`, text: 'Photos help the lab match the shade on front teeth.', itemId: it.id, step: slotStepId(it.id, 'shade'), kind: 'plain' });
    }
    const glass = e.material === 'emax' || e.material === 'feldspathic';
    if (!it.stump && it.teethDone && (it.product === 'veneer' || (glass && front && (it.product === 'crown' || it.product === 'bridge')))) {
      out.push({ id: `stump:${it.id}`, text: 'Prep discoloured? Add a stump shade so the lab can mask it.', itemId: it.id, step: slotStepId(it.id, 'shade'), kind: 'plain' });
    }
    const open = openCaseFor(it, ctx.patient);
    if (open) {
      out.push({
        id: `open:${it.id}`, itemId: it.id, step: slotStepId(it.id, 'arch'), kind: 'openCase', caseId: open.caseId,
        text: `${ctx.patient.first} has an open case for a ${PRODUCTS[open.product].noun} (${archWord(open.arch)}) sent on ${fmtShort(fromISO(open.date))} (${open.caseId}).`,
      });
    }
    if (PRODUCTS[it.product].privateOnly && ctx.funding === 'nhs') {
      const word = it.product === 'veneer' ? 'Veneers are' : it.product === 'implant' ? 'Implant crowns are' : 'Whitening trays are';
      out.push({ id: `private:${it.id}`, text: `${word} private only. This item goes to the lab as private work, not NHS.`, itemId: it.id, step: 'services', kind: 'plain' });
    }
  }
  if (dates.route === 'digital' && dates.backBy && isWorkingDay(ctx.now)) {
    const mins = ctx.now.getHours() * 60 + ctx.now.getMinutes();
    const left = ctx.lab.cutoffMin - mins;
    if (left > 0 && left <= 60) {
      out.push({
        id: 'cutoff', step: 'delivery', kind: 'plain',
        text: `Send by ${fmtCutoff(ctx.lab.cutoffMin)} to keep ${fmtDay(dates.backBy)}. ${ctx.lab.name.split(' ')[0]} counts later cases as received the next working day.`,
      });
    }
  }
  if (d.fit && dates.backBy) {
    const f = fitCheck(d.fit, dates.backBy);
    if (f.ok && f.spare === 0) out.push({ id: 'spare', text: 'No spare day if the lab has a question.', step: 'delivery', kind: 'plain' });
  }
  if (ctx.user.role === 'dentist' && d.login && !d.prescriber && d.login.split(':')[1] && LOGIN_UNLINKED(d.login)) {
    const [scanner, login] = d.login.split(':');
    out.push({ id: 'unlinked', text: `${scanner} login '${login}' isn't linked to anyone.`, step: 'prescriber', kind: 'unlinked' });
  }
  return out.filter(x => !d.dismissedNotes.includes(x.id));
}
/** Injected by the store so the rules stay free of persistence. */
let LOGIN_UNLINKED: (login: string) => boolean = () => false;
export function setLoginLookup(fn: (login: string) => boolean) { LOGIN_UNLINKED = fn; }

export const labsThatMake = (product: ProductId) => LABS.filter(l => labMakes(l, product));
export { labById };

/** "A", "A and B", "A, B and C" */
function andList(words: string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
