// ─── New Case Flow · describe the case ───────────────────────────────────────
// The Start from Scratch page's "Describe with AI" tab. A description, either
// the template (Patient Name: / Lab Name: / Service 1: / Teeth/Arch: /
// Material/Shade: / Delivery: / Instruction:) or plain sentences ("Emax crown
// on 26, shade A2, patient Sarah Whitfield, deliver by 12 Nov"), is read into
// a structured result, which then builds a Draft. Pure functions of the text
// and a context (patients, labs, signed-in user, the demo clock), so they can
// be unit-tested on their own.
//
// Nothing is guessed past the rules: an option the lab doesn't offer, a date
// too soon for the lab or a lab that isn't one of the clinic's stays a gap,
// so the case opens at what's missing. Words it can't place are listed back.

import { Arch, CLINIC, DENTISTS, Funding, LABS, Lab, LabId, Patient, ProductId, User, UserId, labById, userById } from './data';
import { addDays, firstClinicDayAfter, isClinicOpen, parseDOB, startOfDay, toISO } from './dates';
import {
  BRIDGE_ERRORS, BLEACH, CaseDraft, Ctx, LOWER_ORDER, Notation, OPTIONS, PARTIAL_STAGES, PRODUCTS, STUMP, ServiceItem,
  UPPER_ORDER, VITA_3D, VITA_CLASSICAL, buildSteps, caseDates, fastTrackEligible, firstGap, fitCheck, fullName,
  gapCount, itemTitle, jawOf, labMakes, optionAvail, optionName, resolvePrescriber, spanBetween,
} from './rules';
import { blankDraft, loginMap, newItem } from './store';
import { stepName } from './footerArrow';

/** The source tag on every field the description filled. */
export const AI_SRC = 'From your description';

// ─── Template ────────────────────────────────────────────────────────────────

// Delivery and Instruction belong to each service (a service carries its own date and note).
export const TEMPLATE = 'Patient Name: \nLab Name: \n\nService 1: \nTeeth/Arch: \nMaterial/Shade: \nDelivery: \nInstruction: ';
/** One service's lines: what, where, which material and shade, when, and its own instruction for the lab. */
export const serviceBlock = (n: number) => `Service ${n}: \nTeeth/Arch: \nMaterial/Shade: \nDelivery: \nInstruction: `;

/** Demo examples: real demo patients and labs, one template and two plain sentences. */
export const EXAMPLES: { id: string; label: string; text: string }[] = [
  {
    id: 'crown',
    label: 'Crown for Amelia',
    text: 'Patient Name: Amelia Clarke\nLab Name: Northfield Dental Lab\n\nService 1: Crown\nTeeth/Arch: 36\nMaterial/Shade: e.max A2\nDelivery: 12 Nov\nInstruction: Match the shade of 35, light occlusal contacts.',
  },
  { id: 'bridge', label: 'Bridge for Ben', text: 'Bridge 35-37 for Ben Ortiz, monolithic zirconia, shade A3, needed by 13 Nov' },
  { id: 'guard', label: 'Night Guard for Priya', text: 'Upper soft night guard for Priya Shah at Pennine Denture Lab. Patient grinds at night, please keep it 2 mm thick.' },
];

/** What the mock prescription reader "finds" in an uploaded order form. */
export const OCR_TEXT = 'Patient Name: William Grant\nLab Name: Northfield Dental Lab\n\nService 1: Crown\nTeeth/Arch: 16 (UR6)\nMaterial/Shade: Monolithic zirconia A3\nDelivery: 13 Nov\nInstruction: Single crown UR6, match the adjacent shade A3. Patient sensitive to nickel.';

const LABEL_RE = /^\s*(patient(?:'?s)?(?:\s+name)?|name|lab(?:oratory)?(?:\s+name)?|service\s*#?\s*\d*|item\s*#?\s*\d*|teeth\s*\/\s*arch|teeth|tooth|arch|material\s*\/\s*shade|material|shade|delivery(?:\s+date)?|deliver\s+by|due(?:\s+date)?|needed\s+by|date\s+needed|fit(?:\s+date)?|instructions?|notes?|prescriber|dentist)\s*:\s?(.*)$/i;
type LabelKind = 'patient' | 'lab' | 'service' | 'attr' | 'delivery' | 'instr' | 'prescriber';
function labelKind(label: string): LabelKind {
  const s = label.toLowerCase();
  if (s.startsWith('patient') || s === 'name') return 'patient';
  if (s.startsWith('lab')) return 'lab';
  if (s.startsWith('service') || s.startsWith('item')) return 'service';
  if (/^(teeth|tooth|arch|material|shade)/.test(s)) return 'attr';
  if (/^(deliver|due|needed|date|fit)/.test(s)) return 'delivery';
  if (/^(instruction|note)/.test(s)) return 'instr';
  return 'prescriber';
}
const SERVICE_LINE = /^\s*(?:service|item)\s*#?\s*(\d+)\s*:/i;
const FIELD_LINE: Record<'patient' | 'lab' | 'service', RegExp> = {
  patient: /^\s*patient(?:'?s)?(?:\s+name)?\s*:/i,
  lab: /^\s*lab(?:oratory)?(?:\s+name)?\s*:/i,
  service: /^\s*(?:service|item)\s*#?\s*\d*\s*:/i,
};

/**
 * A case written back as the template, so "Describe with AI" can carry on from
 * where the case is: the patient, the lab, then each service's block with its
 * teeth or arch, material/shade, delivery and its own instruction; anything for
 * the whole case after a blank line.
 */
export function describeDraft(d: CaseDraft, patientName: string, labName: string | undefined): string {
  const lines = [`Patient Name: ${patientName}`, `Lab Name: ${d.labPicked === false ? '' : labName ?? ''}`];
  const items = d.items.length ? d.items : [null];
  items.forEach((it, k) => {
    lines.push('');
    if (!it) { lines.push(...serviceBlock(1).split('\n')); return; }
    const where = it.bridge?.a && it.bridge?.b ? `${it.bridge.a}-${it.bridge.b}`
      : it.teeth.length ? it.teeth.join(', ')
      : it.arch ? (it.arch === 'both' ? 'both arches' : it.arch) : '';
    const slot = OPT_SLOT[it.product];
    const opt = slot === 'material' ? it.material : slot === 'type' ? it.type : slot === 'stage' ? it.stage : slot === 'base' ? it.base : slot === 'work' ? it.work : undefined;
    const matShade = [opt ? optionName(it.product, opt) : '', it.shade ?? ''].filter(Boolean).join(' ');
    lines.push(
      `Service ${k + 1}: ${it.product === 'other' ? (it.desc ?? 'Something else') : PRODUCTS[it.product].label}`,
      `Teeth/Arch: ${where}`,
      `Material/Shade: ${matShade}`,
      `Delivery: ${d.fastTrack && k === 0 ? 'Fast-Track' : ''}`,
      `Instruction: ${(it.note ?? '').trim()}`,
    );
  });
  if (d.note.trim()) lines.push('', `Instruction: ${d.note.trim()}`);
  return lines.join('\n');
}

/** The number the next "Service N:" block takes. */
export function nextServiceNumber(text: string): number {
  let max = 0;
  for (const line of text.split('\n')) {
    const m = SERVICE_LINE.exec(line);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Adds a whole "Service N:" block (with its Delivery and Instruction) after the last service's lines, caret after "Service N: ". */
export function insertServiceBlock(text: string, n = nextServiceNumber(text)): { text: string; caret: number } {
  const block = serviceBlock(n).split('\n');
  if (!text.trim()) return { text: block.join('\n'), caret: block[0].length };
  const lines = text.split('\n');
  let last = -1;
  let inBlock = false;
  // A service's block runs until a blank line or the patient / lab lines (its Delivery, Instruction and note lines included).
  lines.forEach((l, i) => {
    if (SERVICE_LINE.test(l)) { inBlock = true; last = i; return; }
    if (inBlock && l.trim() !== '' && !/^\s*(patient|lab)\b[^:\n]*:/i.test(l)) { last = i; return; }
    inBlock = false;
  });
  let at = last + 1;
  if (last < 0) {
    const k = lines.findIndex(l => /^\s*(delivery|deliver\s+by|due|needed\s+by|instructions?|notes?)\b[^:\n]*:/i.test(l));
    at = k < 0 ? lines.length : k;
  }
  const before = lines.slice(0, at);
  const after = lines.slice(at);
  const gapBefore = before.length > 0 && before[before.length - 1].trim() !== '';
  const gapAfter = after.length > 0 && after[0].trim() !== '';
  const head = [...before, ...(gapBefore ? [''] : [])];
  const out = [...head, ...block, ...(gapAfter ? [''] : []), ...after];
  const caret = head.reduce((n0, l) => n0 + l.length + 1, 0) + block[0].length;
  return { text: out.join('\n'), caret };
}

/** Enter at the end of a template line jumps to the end of the next one (Instruction lines take new lines). */
export function nextFieldCaret(text: string, caret: number): number | null {
  const start = text.lastIndexOf('\n', caret - 1) + 1;
  let end = text.indexOf('\n', caret);
  if (end < 0) end = text.length;
  if (text.slice(caret, end).trim() !== '') return null;
  const m = LABEL_RE.exec(text.slice(start, end));
  if (!m || labelKind(m[1]) === 'instr') return null;
  let i = end;
  while (i < text.length) {
    const s = i + 1;
    let e = text.indexOf('\n', s);
    if (e < 0) e = text.length;
    const line = text.slice(s, e);
    if (line.trim() === '') { i = e; continue; }
    return LABEL_RE.test(line) ? e : null;
  }
  return null;
}

/** Where the caret goes to fill a field: the end of its template line, or -1 when there isn't one. */
export function fieldCaret(text: string, field: 'patient' | 'lab' | 'service'): number {
  let at = 0;
  for (const line of text.split('\n')) {
    if (FIELD_LINE[field].test(line)) return at + line.length;
    at += line.length + 1;
  }
  return -1;
}

/** Puts a patient's full name in the description (the Patient Name line, else where the name was heard). */
export function withPatientName(text: string, heard: string, name: string): string {
  const lines = text.split('\n');
  const i = lines.findIndex(l => FIELD_LINE.patient.test(l));
  if (i >= 0) {
    const label = lines[i].slice(0, lines[i].indexOf(':') + 1);
    const DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/;
    const dob = DATE.test(name) ? undefined : DATE.exec(lines[i].slice(label.length))?.[0];
    lines[i] = `${label} ${name}${dob ? `, ${dob}` : ''}`;
    return lines.join('\n');
  }
  const k = heard ? text.toLowerCase().indexOf(heard.toLowerCase()) : -1;
  if (k >= 0) return text.slice(0, k) + name + text.slice(k + heard.length);
  return `Patient Name: ${name}\n${text}`;
}

// ─── Result shape ────────────────────────────────────────────────────────────

export interface DescribeCtx {
  patients: Patient[];
  user: User;
  now: Date;
  labs?: Lab[];
  /** Labs to try first when the usual lab can't make everything. */
  favourites?: LabId[];
}

export type PatientRead =
  | { kind: 'none' }
  | { kind: 'matched'; patient: Patient; heard: string; dobMismatch?: boolean }
  | { kind: 'several'; heard: string; options: Patient[] }
  | { kind: 'new'; first: string; last: string; heard: string; dob?: string; suggest?: Patient };

export type LabRead =
  | { kind: 'matched'; lab: Lab; heard: string }
  /** Named, but not one of the clinic's labs: the case uses `lab` until someone picks. */
  | { kind: 'unknown'; heard: string; lab: Lab; src: string }
  | { kind: 'default'; lab: Lab; src: string };

export type OptSlot = 'material' | 'type' | 'stage' | 'base' | 'work';
export const SLOT_LABEL: Record<OptSlot, string> = { material: 'Material', type: 'Type', stage: 'Stage', base: 'Base', work: 'Work needed' };
const OPT_SLOT: Partial<Record<ProductId, OptSlot>> = {
  crown: 'material', bridge: 'material', veneer: 'material', inlay: 'material', implant: 'material',
  nightguard: 'type', retainer: 'type', denture: 'stage', partial: 'base', reline: 'work',
};
export const optSlotOf = (p: ProductId) => OPT_SLOT[p];
const SHADED: ProductId[] = ['crown', 'bridge', 'implant', 'veneer', 'inlay', 'denture', 'partial'];
export const takesShade = (p: ProductId) => SHADED.includes(p);

export interface ServiceRead {
  key: string;
  product?: ProductId;
  /** No product word, but a crown material on teeth: read as a crown. */
  assumed?: boolean;
  heard: string;
  teeth: string[];
  bridge?: { a: string; b: string; pontics: string[] };
  arch?: Arch;
  option?: { slot: OptSlot; id: string; name: string; ok: boolean; reason?: string };
  /** A partial denture's stage (its option is the base). */
  stage?: { id: string; name: string };
  inlayType?: 'inlay' | 'onlay';
  shade?: string;
  stump?: string;
  desc?: string;
  /** The case's lab makes this product. */
  makes: boolean;
  issues: string[];
  /** Its own Instruction line(s): goes to the lab as this service's instructions. */
  note?: string;
  /** Its own Delivery line: needed by / Fast-Track. */
  delivery?: { fastTrack: boolean; date?: Date; heard?: string };
}

/** `as`: a fit / appointment date, or the date the work is needed back (Delivery, due, needed by). */
export interface DeliveryRead { fastTrack: boolean; date?: Date; heard?: string; as: 'fit' | 'delivery' }

export interface Parsed {
  patient: PatientRead;
  lab: LabRead;
  services: ServiceRead[];
  delivery: DeliveryRead;
  instructions: string;
  funding?: Funding;
  prescriber?: UserId;
  unplaced: string[];
  /** Nothing at all was read yet. */
  empty: boolean;
}

// ─── Reading helpers ─────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
const title = (w: string) => w.toLowerCase().replace(/(^|['’-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
const cleanText = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,;:.\-–]+|[\s,;:\-–]+$/g, '').trim();

/** The text being read: matched spans are blanked (same length) so nothing is read twice. */
class Work {
  s: string;
  constructor(readonly src: string) { this.s = src; }
  /** Each match of `re` in what's still unread; `fn` returns false to leave a match unread. */
  each(re: RegExp, fn: (m: RegExpExecArray, at: number) => boolean | void, from = 0, to = this.s.length) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    const part = this.s.slice(from, to);
    const hits: [number, number][] = [];
    for (let m = r.exec(part); m; m = r.exec(part)) {
      if (!m[0]) { r.lastIndex++; continue; }
      if (fn(m, from + m.index) !== false) hits.push([from + m.index, from + m.index + m[0].length]);
    }
    for (const [a, b] of hits) this.eat(a, b);
  }
  eat(a: number, b: number) { this.s = this.s.slice(0, a) + ' '.repeat(b - a) + this.s.slice(b); }
  orig(at: number, len: number) { return this.src.slice(at, at + len); }
}

const STOP = new Set(`a an the and or of on for by with to at in into is are be it its this that these those please pls plz
kindly thanks thank you hi hello also plus then x shade shades colour color vita tooth teeth site sites patient pt name lab
labs laboratory deliver delivery delivered needed need needs required due back date fit fitting appointment appt service
services item items material materials arch arches type stage base unit units new case cases same as usual standard normal
regular via from send sent make made making want wants like would could should can will just only one single two both mm
ti-base tibase dr mr mrs ms miss mx full set work job order prescription rx dob born id practice clinic n/a na none tbc
no number upper lower top bottom left right # / & + - – — ( ) we i me my our their his her them they he she replacing
replace replaces replacement missing`.split(/\s+/));

const NAME_STOP = new Set(`january february march april may june july august september october november december jan feb mar
apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs
fri sat sun upper lower both left right top bottom dr mr mrs ms miss mx the a an crown crowns bridge bridges veneer veneers
inlay inlays onlay onlays implant implants night guard guards nightguard denture dentures partial partials retainer retainers
whitening reline relines repair emax zirconia layered monolithic mono metal composite pfm pbc nhs private fast track urgent
asap express priority fit today tomorrow next this lab labs dental ceramics studio denture northfield harbour harbor pennine
please thanks thank patient service shade delivery instruction instructions note notes material teeth tooth arch hard soft
dual essix hawley chrome acrylic flexible try special bite blocks finish immediate straight match matching keep make check
call avoid ensure use light tight heavy single double same new end`.split(/\s+/));

const INSTR_CUE = /^(?:please|pls|plz|kindly|note|notes|nb|n\.b\.?|instructions?|match(?:ing)?|check|call|ring|phone|keep|avoid|make\s+sure|ensure|leave|use|light|tight|heavy|reduce|thin|thicken|polish|glaze|contacts?|occlusion|margins?|allerg\w*|sensitive|nervous|anxious|(?:patient|pt)\s+(?:is|has|had|was|grinds|clenches|wants|prefers|likes|sensitive|allergic|nervous|anxious|reports))\b/i;
/** "to match 35", "same as 21": a tooth named as a reference for the lab, not as work. */
const REF_CUE = /\b(?:to\s+)?(?:match(?:ing|es)?|same\s+as|cop(?:y|ying)(?:\s+of)?)\b(?=[^,;]*?(?:\b[1-4][1-8]\b|\b(?:UR|UL|LL|LR)\s?[1-8]\b))/i;
const REF_TOOTH = '(?:[1-4][1-8]|(?:UR|UL|LL|LR)\\s?[1-8])';
const REF_TEETH = new RegExp(`\\b${REF_TOOTH}\\b(?:\\s*(?:and|&|\\/|\\+)\\s*${REF_TOOTH}\\b)*`, 'i');
/** Words after "patient" that say something about them rather than name them. */
const NOT_NAME = new Set('is has had was were grinds clenches wants prefers likes reports needs says said would will can could should does did sensitive allergic nervous anxious'.split(' '));

// Teeth
const VALID_TEETH = new Set([...UPPER_ORDER, ...LOWER_ORDER]);
const QUAD: Record<string, string> = { ur: '1', ul: '2', ll: '3', lr: '4' };
const TOOTH_WORD: Record<string, string> = {
  central: '1', 'central incisor': '1', lateral: '2', 'lateral incisor': '2', canine: '3', eyetooth: '3', 'eye tooth': '3',
  'first premolar': '4', 'second premolar': '5', 'first molar': '6', 'second molar': '7', 'third molar': '8', wisdom: '8', 'wisdom tooth': '8',
};
const archPos = (id: string) => (jawOf(id) === 'upper' ? UPPER_ORDER : LOWER_ORDER).indexOf(id);
const byArch = (ids: string[]) => [...ids].sort((a, b) => (jawOf(a) === jawOf(b) ? archPos(a) - archPos(b) : jawOf(a) === 'upper' ? -1 : 1));
const byNum = (ids: string[]) => [...ids].sort((a, b) => Number(a) - Number(b));

// Products, most specific first (a reline names the denture it relines; an implant crown is not a crown).
const PRODUCT_WORDS: [ProductId, RegExp][] = [
  ['implant', /\bimplant(?:[- ](?:supported|retained|borne))?(?:\s+crowns?)?\b|\bscrew[- ]retained\s+crowns?\b/gi],
  ['bridge', /\bbridges?\b|\bbridgework\b|\bfpds?\b/gi],
  ['veneer', /\bveneers?\b/gi],
  ['inlay', /\binlays?(?:\s+or\s+onlays?)?\b|\bonlays?\b/gi],
  ['nightguard', /\bnight[- ]?guards?\b|\bbite[- ]?guards?\b|\b(?:occlusal|michigan|bruxism|stabili[sz]ation)\s+(?:splints?|guards?|appliances?)\b|\bsplints?\b/gi],
  ['reline', /\brelines?\b|\brelining\b|\b(?:denture\s+)?repairs?\b|\badd(?:\s+an?)?\s+(?:tooth|clasp)\b/gi],
  ['partial', /\bpartials?(?:\s+(?:dentures?|plates?))?\b|\b(?:cobalt[- ]?)?chrome\s+dentures?\b|\bflexible\s+dentures?\b/gi],
  ['denture', /\b(?:full|complete)\s+dentures?\b|\bdentures?\b|\bf\/f\b|\bfull\s+(?:upper|lower)\b/gi],
  // Essix and Hawley are options; on their own they still imply a retainer (OPTION_WORDS).
  ['retainer', /\bretainers?\b/gi],
  ['whitening', /\b(?:teeth\s+)?whitening(?:\s+trays?)?\b|\bbleach(?:ing)?\s+trays?\b/gi],
  ['crown', /\bcrowns?\b|\bcaps?\b/gi],
  ['other', /\bsomething\s+else\b|\bsurgical\s+guides?\b|\bstudy\s+models?\b|\bsports?\s+guards?\b|\bmouth\s*guards?\b|\bsnor(?:e|ing)\s+(?:guards?|appliances?)\b|\bwax[- ]?ups?\b/gi],
];

// Options by synonym; `implies` names the product a word gives away on its own.
const OPTION_WORDS: { re: RegExp; id: string; implies?: ProductId }[] = [
  { re: /\bstraight[- ]to[- ]finish\b|\bstf\b/gi, id: 'stf', implies: 'denture' },
  { re: /\b(?:special|custom)\s+trays?\b/gi, id: 'tray', implies: 'denture' },
  { re: /\bbite\s+blocks?\b|\b(?:wax|occlusal|registration)\s+(?:rims?|blocks?)\b/gi, id: 'blocks', implies: 'denture' },
  { re: /\bframework(?:\s+try[- ]?in)?\b|\bmetal\s+try[- ]?in\b/gi, id: 'framework', implies: 'partial' },
  { re: /\b(?:wax\s+)?try[- ]?ins?\b/gi, id: 'tryin', implies: 'denture' },
  { re: /\bimmediate\b|\bimmed\b/gi, id: 'immediate' },
  { re: /\bfinish(?:ed)?\b|\bfinal\b|\bprocess(?:ed)?\b/gi, id: 'finish' },
  { re: /\blithium\s+disilicate\b|\bips\s+e[.\s-]?max\b|\be[.\s-]?max\b/gi, id: 'emax' },
  { re: /\blayered(?:\s+zirconia)?\b|\bzirconia\s+layered\b|\bporcelain[- ]layered(?:\s+zirconia)?\b/gi, id: 'layered' },
  { re: /\b(?:monolithic|mono|full[- ]contour)(?:\s+zirconia)?\b|\bsolid\s+zirconia\b|\bzirconia\b|\bzirc\b|\bbruxzir\b/gi, id: 'mono' },
  { re: /\bpfm\b|\bpbc\b|\bporcelain[- ](?:fused|bonded)(?:\s+to\s+(?:metal|crown))?\b|\bmetal[- ]ceramic\b/gi, id: 'pbc' },
  { re: /\bdual(?:[- ]laminate)?\b|\bhard[/ -]soft\b|\blaminated?\b/gi, id: 'dual' },
  { re: /\bsoft\s+relines?\b|\bsoft\s+lin(?:ing|er)\b/gi, id: 'soft', implies: 'reline' },
  { re: /\bhard\s+relines?\b|\brebase\b/gi, id: 'hard', implies: 'reline' },
  { re: /\badd(?:\s+an?)?\s+tooth\b|\btooth\s+addition\b/gi, id: 'addtooth', implies: 'reline' },
  { re: /\badd(?:\s+an?)?\s+clasp\b|\bclasp\s+addition\b/gi, id: 'addclasp', implies: 'reline' },
  { re: /\brepairs?\b|\bfix\b|\bbroken\b|\bcracked?\b|\bfractured?\b/gi, id: 'repair', implies: 'reline' },
  { re: /\b(?:cobalt[- ]?chrome|co[- ]?cr|chrome)\b/gi, id: 'chrome', implies: 'partial' },
  { re: /\bflexible\b|\bvalplast\b/gi, id: 'flexible', implies: 'partial' },
  { re: /\bacrylic\b/gi, id: 'acrylic' },
  { re: /\bfull[- ]metal(?:\s+non[- ]precious)?\b|\bnon[- ]precious(?:\s+metal)?\b|\bmetal\b/gi, id: 'metal' },
  { re: /\bcomposite\b/gi, id: 'composite' },
  { re: /\bfeldspathic\b|\bfeldspar\b/gi, id: 'feldspathic' },
  { re: /\bmichigan\b/gi, id: 'hard', implies: 'nightguard' },
  { re: /\bhard\b|\brigid\b/gi, id: 'hard' },
  { re: /\bsoft\b/gi, id: 'soft' },
  { re: /\bessix\b|\bvacuum[- ]formed\b/gi, id: 'essix', implies: 'retainer' },
  { re: /\bhawley\b/gi, id: 'hawley', implies: 'retainer' },
];
const CROWN_MATERIALS = new Set(['emax', 'mono', 'layered', 'pbc', 'metal']);
/** Words that are fine to hear with a product without being its option ("hard acrylic night guard"). */
const BENIGN: Partial<Record<ProductId, string[]>> = { nightguard: ['acrylic'], retainer: ['acrylic'], denture: ['acrylic'], reline: ['acrylic'] };

// Dates
const MONTH = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DOWS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DOW_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const CUE = '(?:(?:deliver(?:y|ed)?|needed|need\\s+it|required|due|back|ready|fit(?:ting)?|appointment|appt|seat(?:ing)?)(?:\\s+(?:by|on|for|before|date))?\\s*:?\\s*|(?:by|on|before|for)\\s+)?';
const NUMBER_WORD: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function dayMonth(d: number, m: number, y: number | undefined, now: Date): Date | null {
  const yr = y == null ? now.getFullYear() : y < 100 ? 2000 + y : y;
  let date = new Date(yr, m, d);
  if (date.getMonth() !== m || date.getDate() !== d) return null;
  if (y == null && startOfDay(date) < startOfDay(now)) date = new Date(yr + 1, m, d);
  return startOfDay(date);
}
function weekday(name: string, next: boolean, now: Date): Date {
  const dow = DOWS.indexOf(name.slice(0, 3).toLowerCase());
  let d = addDays(now, 1);
  while (d.getDay() !== dow) d = addDays(d, 1);
  // "next Friday" said on a Thursday is a week on; "next Monday" is the coming one.
  const sunday = addDays(now, (7 - now.getDay()) % 7);
  if (next && d <= sunday) d = addDays(d, 7);
  return d;
}
/** dd/mm/yyyy (zero-padded) if it's a real past date. */
function dobOf(d: string, m: string, y: string, now: Date): string | undefined {
  let yr = Number(y);
  if (y.length === 2) yr = yr > now.getFullYear() % 100 ? 1900 + yr : 2000 + yr;
  const s = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${yr}`;
  const r = parseDOB(s, now);
  return r.date && !r.error ? s : undefined;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// ─── Reading state ───────────────────────────────────────────────────────────

interface RawSvc {
  key: string;
  label?: boolean;
  product?: ProductId;
  productText?: string;
  heard: string[];
  teeth: string[];
  ranges: [string, string][];
  pontics: string[];
  arch?: Arch;
  opts: { id: string; heard: string; implies?: ProductId }[];
  shade?: string;
  stump?: string;
  /** Its own Instruction lines, and its own Delivery (needed by / Fast-Track). */
  note: string[];
  fast?: boolean;
  date?: Date;
  dateHeard?: string;
}
interface St {
  ctx: DescribeCtx;
  svcs: RawSvc[];
  cur?: RawSvc;
  patient?: PatientRead;
  dob?: string;
  lab?: { kind: 'matched'; lab: Lab; heard: string } | { kind: 'unknown'; heard: string };
  funding?: Funding;
  prescriber?: UserId;
  fast: boolean;
  date?: Date;
  dateHeard?: string;
  dateAs?: 'fit' | 'delivery';
  instr: string[];
  unplaced: string[];
  /** The services the line being read names, so a trailing "mono A3" goes to all of them. */
  line?: RawSvc[];
  /** The "Service N:" block being read: its Delivery and Instruction lines are its own. */
  block?: RawSvc;
  n: number;
}
function newSvc(st: St, label = false): RawSvc {
  const s: RawSvc = { key: `s${st.n++}`, label, heard: [], teeth: [], ranges: [], pontics: [], opts: [], note: [] };
  st.svcs.push(s);
  st.line?.push(s);
  st.cur = s;
  return s;
}
const labsOf = (ctx: DescribeCtx) => ctx.labs ?? LABS;

function labRe(l: Lab): RegExp {
  const words = l.name.split(/\s+/);
  const head = words[0].toLowerCase() === 'harbour' ? 'harbou?r' : esc(words[0]);
  const rest = words.slice(1).map(w => `(?:\\s+${esc(w)})?`).join('');
  return new RegExp(`(?:\\b(?:lab(?:oratory)?(?:\\s+name)?\\s*:?\\s*|(?:send(?:\\s+it)?\\s+|sent\\s+)?to\\s+|at\\s+|via\\s+|with\\s+|from\\s+))?(?:the\\s+)?\\b${head}${rest}(?:\\s+lab(?:oratory)?)?\\b`, 'gi');
}

/** A name heard in the description → one of the practice's patients, several, or a new one. */
function readName(words: string[], heard: string, ctx: DescribeCtx, dob?: string): PatientRead {
  const patients = ctx.patients;
  const full = norm(words.join(' '));
  const pickByDob = (list: Patient[]) => (dob ? list.find(p => p.dob === dob) : undefined);
  const exact = patients.filter(p => norm(fullName(p)) === full || norm(`${p.last} ${p.first}`) === full);
  if (exact.length) {
    const p = pickByDob(exact) ?? exact[0];
    return { kind: 'matched', patient: p, heard, dobMismatch: !!dob && p.dob !== dob };
  }
  if (words.length === 1) {
    const w = norm(words[0]);
    const hits = patients.filter(p => norm(p.first) === w || norm(p.last) === w);
    const byDob = pickByDob(hits);
    if (byDob) return { kind: 'matched', patient: byDob, heard };
    if (hits.length === 1) return { kind: 'matched', patient: hits[0], heard, dobMismatch: !!dob && hits[0].dob !== dob };
    if (hits.length > 1) return { kind: 'several', heard, options: hits };
  }
  const first = title(words[0]);
  const last = words.slice(1).map(title).join(' ');
  let suggest: Patient | undefined;
  if (words.length === 1) {
    // One word: a near miss of a first name or a surname, same first letter, tight for short words.
    const limit = full.length <= 6 ? 1 : 2;
    let best = limit + 1;
    for (const p of patients) {
      for (const n of [norm(p.first), norm(p.last)]) {
        if (n[0] !== full[0]) continue;
        const d = levenshtein(full, n);
        if (d < best || (dob && p.dob === dob && d <= limit + 1)) { best = Math.min(d, best); suggest = p; }
      }
    }
  } else {
    let best = 3;
    for (const p of patients) {
      const d = levenshtein(full, norm(fullName(p)));
      if (d < best || (dob && p.dob === dob && d <= 4)) { best = Math.min(d, best); suggest = p; }
    }
  }
  return { kind: 'new', first, last, heard, dob, suggest };
}

// ─── Reading passes ──────────────────────────────────────────────────────────

function takePrescriber(w: Work, st: St) {
  for (const u of DENTISTS) {
    const last = esc(u.name.split(' ').pop()!);
    const first = esc(u.first);
    const re = new RegExp(`(?:\\b(?:prescrib(?:ed|er)|dentist|clinician)(?:\\s+by)?\\s*:?\\s*)?(?:\\bdr\\.?\\s+(?:${first}\\s+)?${last}|\\b${first}\\s+${last})\\b`, 'gi');
    w.each(re, () => { st.prescriber ??= u.id; });
  }
}

function takePatientKnown(w: Work, st: St) {
  const cue = "(?:\\b(?:patient(?:'s)?(?:\\s+name)?|pt\\.?|for|name|mr|mrs|ms|miss|mx)\\s*:?\\s*)?";
  for (const p of st.ctx.patients) {
    const f = esc(p.first).replace(/'/g, "['’]?");
    const l = esc(p.last).replace(/'/g, "['’]?");
    w.each(new RegExp(`${cue}\\b(?:${f}\\s+${l}|${l},?\\s+${f})\\b`, 'gi'), (m, at) => {
      if (!st.patient || st.patient.kind === 'none') st.patient = { kind: 'matched', patient: p, heard: cleanText(w.orig(at, m[0].length)) };
    });
  }
  w.each(/\bP-\d{4}-\d{3}\b/gi, m => {
    const p = st.ctx.patients.find(x => x.id.toLowerCase() === m[0].toLowerCase());
    if (!p) return false;
    if (!st.patient || st.patient.kind === 'none') st.patient = { kind: 'matched', patient: p, heard: m[0] };
  });
}

function takeDob(w: Work, st: St) {
  const now = st.ctx.now;
  w.each(/\b(?:dob|d\.o\.b\.?|born(?:\s+on)?|date\s+of\s+birth)\s*:?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/gi, m => {
    const d = dobOf(m[1], m[2], m[3], now);
    if (!d) return false;
    st.dob ??= d;
  });
  w.each(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, m => {
    if (Number(m[3]) > now.getFullYear() - 2) return false;
    const d = dobOf(m[1], m[2], m[3], now);
    if (!d) return false;
    st.dob ??= d;
  });
}

function takeLab(w: Work, st: St) {
  for (const l of labsOf(st.ctx)) {
    w.each(labRe(l), (m, at) => { if (!st.lab) st.lab = { kind: 'matched', lab: l, heard: cleanText(w.orig(at, m[0].length)) }; });
  }
  w.each(/(?:\b(?:[Ll]ab(?:oratory)?(?:\s+[Nn]ame)?\s*:?\s*|(?:[Ss]end(?:\s+it)?\s+|[Ss]ent\s+)?to\s+|at\s+|via\s+))?\b((?:[A-Z][\w&'’.-]*\s+){1,3}(?:Dental\s+)?(?:Lab|Labs|Laboratory|Laboratories|Ceramics|Studio))\b/g, m => {
    if (!st.lab) st.lab = { kind: 'unknown', heard: cleanText(m[1]) };
  });
}

function takeFunding(w: Work, st: St) {
  w.each(/\bnhs\b/gi, () => { st.funding ??= 'nhs'; });
  w.each(/\bprivate(?:ly)?\b/gi, () => { st.funding ??= 'private'; });
}

function takeFast(w: Work, st: St) {
  w.each(/\b(?:fast[- ]?track(?:ed)?|urgent(?:ly)?|asap|a\.s\.a\.p\.?|rush|express|priority)\b/gi, () => { st.fast = true; });
}

function takeDates(w: Work, st: St) {
  const now = st.ctx.now;
  const found = (date: Date | null, heard: string): boolean => {
    if (!date) return false;
    if (!st.date) {
      st.date = date;
      st.dateHeard = cleanText(heard);
      st.dateAs = /\b(?:fit(?:ting)?|appointment|appt|seat(?:ing)?)\b/i.test(heard) ? 'fit' : 'delivery';
    } else st.unplaced.push(cleanText(heard));
    return true;
  };
  const src = (at: number, len: number) => w.orig(at, len);
  w.each(new RegExp(`${CUE}(?:${DOW_RE},?\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}\\.?(?:,?\\s+(\\d{4}))?\\b`, 'gi'), (m, at) =>
    found(dayMonth(Number(m[2]), MONTH.indexOf(m[3].slice(0, 3).toLowerCase()), m[4] ? Number(m[4]) : undefined, now), src(at, m[0].length)));
  w.each(new RegExp(`${CUE}(?:${DOW_RE},?\\s+)?${MON_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'), (m, at) =>
    found(dayMonth(Number(m[3]), MONTH.indexOf(m[2].slice(0, 3).toLowerCase()), m[4] ? Number(m[4]) : undefined, now), src(at, m[0].length)));
  w.each(new RegExp(`${CUE}(?:${DOW_RE},?\\s+)?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b`, 'gi'), (m, at) =>
    found(dayMonth(Number(m[2]), Number(m[3]) - 1, m[4] ? Number(m[4]) : undefined, now), src(at, m[0].length)));
  w.each(new RegExp(`${CUE}(\\d{1,2})[.-](\\d{1,2})[.-](\\d{4})\\b`, 'gi'), (m, at) =>
    found(dayMonth(Number(m[1]), Number(m[2]) - 1, Number(m[3]), now), src(at, m[0].length)));
  w.each(new RegExp(`${CUE}(tomorrow|today)\\b`, 'gi'), (m, at) =>
    found(addDays(now, m[1].toLowerCase() === 'tomorrow' ? 1 : 0), src(at, m[0].length)));
  w.each(new RegExp(`${CUE}in\\s+(\\d+|a|an|one|two|three|four|five|six)\\s+(days?|weeks?)\\b`, 'gi'), (m, at) => {
    const n = NUMBER_WORD[m[1].toLowerCase()] ?? Number(m[1]);
    return found(addDays(now, n * (m[2].toLowerCase().startsWith('week') ? 7 : 1)), src(at, m[0].length));
  });
  w.each(new RegExp(`${CUE}(?:the\\s+)?end\\s+of\\s+(?:the\\s+)?(week|month)\\b`, 'gi'), (m, at) => {
    if (m[1].toLowerCase() === 'week') return found(weekday('fri', false, addDays(now, -1)), src(at, m[0].length));
    let d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, -1);
    return found(startOfDay(d), src(at, m[0].length));
  });
  w.each(new RegExp(`${CUE}next\\s+week\\b`, 'gi'), (m, at) => found(addDays(now, 7), src(at, m[0].length)));
  w.each(new RegExp(`${CUE}(?:(this|next)\\s+)?${DOW_RE}\\b`, 'gi'), (m, at) =>
    found(weekday(m[2], (m[1] ?? '').toLowerCase() === 'next', now), src(at, m[0].length)));
}

function takeTimes(w: Work, st: St) {
  w.each(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b|\b\d{1,2}\s*(?:am|pm)\b/gi, m => { st.unplaced.push(m[0].trim()); });
}

/** "patient Sarah Whitfield", "for Priya": a name after a cue. */
function takePatientCue(w: Work, st: St) {
  if (st.patient && st.patient.kind !== 'none') return;
  const take = (words: string[], heard: string) => {
    const kept: string[] = [];
    for (const x of words) { if (NAME_STOP.has(x.toLowerCase().replace(/['’]s$/, ''))) break; kept.push(x); }
    if (!kept.length) return false;
    st.patient = readName(kept, heard, st.ctx, st.dob);
    return true;
  };
  // Capitalised names after any cue.
  w.each(/(?:\b[Pp]atient(?:'s)?(?:\s+[Nn]ame)?|\b[Pp]t\.?|\b[Ff]or|\b[Nn]ame)\s*:?\s+(?:(?:Mr|Mrs|Ms|Miss|Mx)\.?\s+)?([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){0,2})\b/g, (m, at) => {
    if (st.patient && st.patient.kind !== 'none') return false;
    return take(m[1].split(/\s+/), cleanText(w.orig(at, m[0].length)).replace(/^(?:patient(?:'s)?(?:\s+name)?|pt\.?|for|name)\s*:?\s*/i, ''));
  });
  // Lower-case after "patient": a name the practice knows, or two name-like words (someone new).
  const nameLike = (x?: string) => {
    const t = (x ?? '').toLowerCase().replace(/['’]s$/, '');
    return t.length >= 2 && !NAME_STOP.has(t) && !STOP.has(t) && !NOT_NAME.has(t);
  };
  w.each(/\b(?:patient(?:'s)?(?:\s+name)?|pt\.?|name)\s*:?\s+([a-z'’-]+)(?:\s+([a-z'’-]+))?/gi, m => {
    if (st.patient && st.patient.kind !== 'none') return false;
    const words = [m[1], m[2]].filter(Boolean) as string[];
    const r = readName(words, words.join(' '), st.ctx, st.dob);
    if (r.kind === 'matched' || r.kind === 'several') { st.patient = r; return true; }
    const one = readName([m[1]], m[1], st.ctx, st.dob);
    if (one.kind === 'matched' || one.kind === 'several') { st.patient = one; return true; }
    if (r.kind === 'new' && words.length === 2 && words.every(nameLike)) { st.patient = r; return true; }
    return false;
  });
}

/** A bare "Sarah Whitfield" left over once everything else was read. */
function takePatientBare(w: Work, st: St) {
  if (st.patient && st.patient.kind !== 'none') return;
  w.each(/\b([A-Z][a-z'’]+(?:-[A-Z][a-z'’]+)?)\s+([A-Z][a-z'’]+(?:-[A-Z][a-z'’]+)?)\b/g, m => {
    if (st.patient && st.patient.kind !== 'none') return false;
    if (NAME_STOP.has(m[1].toLowerCase()) || NAME_STOP.has(m[2].toLowerCase())) return false;
    st.patient = readName([m[1], m[2]], `${m[1]} ${m[2]}`, st.ctx, st.dob);
  });
}

interface Attrs { teeth: string[]; ranges: [string, string][]; pontics: string[]; arch?: Arch; opts: RawSvc['opts']; shades: string[]; stump?: string }
const hasAttrs = (a: Attrs) => !!(a.teeth.length || a.ranges.length || a.pontics.length || a.arch || a.opts.length || a.shades.length || a.stump);

/** Teeth, arch, options and shade in one stretch of text. */
function readAttrs(w: Work, from: number, to: number): Attrs {
  const a: Attrs = { teeth: [], ranges: [], pontics: [], opts: [], shades: [] };
  const fdi = (q: string, n: string) => `${QUAD[q.toLowerCase()]}${n}`;
  w.each(/\bpontics?\s*(?:at|on|is|are|=|:)?\s*([1-4][1-8](?:\s*(?:,|and|&|\+|\/)\s*[1-4][1-8])*)\b/gi, m => {
    a.pontics.push(...(m[1].match(/[1-4][1-8]/g) ?? []).filter(t => VALID_TEETH.has(t)));
  }, from, to);
  w.each(/\b(UR|UL|LL|LR)\s?([1-8])\s*(?:-|–|—|to|through|thru)\s*(?:(UR|UL|LL|LR)\s?)?([1-8])\b/gi, m => {
    a.ranges.push([fdi(m[1], m[2]), fdi(m[3] ?? m[1], m[4])]);
  }, from, to);
  w.each(/\b([1-4][1-8])\s*(?:-|–|—|to|through|thru)\s*([1-4][1-8])\b/gi, m => {
    if (!VALID_TEETH.has(m[1]) || !VALID_TEETH.has(m[2])) return false;
    a.ranges.push([m[1], m[2]]);
  }, from, to);
  w.each(/\b(upper|lower)\s+(right|left)\s+(?:([1-8])|(central(?:\s+incisor)?|lateral(?:\s+incisor)?|canine|eye\s?tooth|first\s+premolar|second\s+premolar|first\s+molar|second\s+molar|third\s+molar|wisdom(?:\s+tooth)?))\b/gi, m => {
    const q = `${m[1][0]}${m[2][0]}`.toLowerCase();
    const n = m[3] ?? TOOTH_WORD[m[4].toLowerCase().replace(/\s+/g, ' ')];
    if (!n) return false;
    a.teeth.push(fdi(q, n));
  }, from, to);
  w.each(/\b(UR|UL|LL|LR)\s?([1-8])\b/gi, m => { a.teeth.push(fdi(m[1], m[2])); }, from, to);
  w.each(/(?:#|\b)([1-4][1-8])\b/g, (m, at) => {
    const before = w.s[at - 1] ?? ' ';
    const after = w.s[at + m[0].length] ?? ' ';
    if (before === '.' || after === '.' || after === ':' || before === ':') return false;
    if (!VALID_TEETH.has(m[1])) return false;
    a.teeth.push(m[1]);
  }, from, to);
  w.each(/\b(?:upper\s*(?:and|&|\+|\/)\s*lower|lower\s*(?:and|&|\+|\/)\s*upper|both\s+arch(?:es)?|full\s+mouth|u\s*\/\s*l)\b/gi, () => { a.arch ??= 'both'; }, from, to);
  w.each(/\b(?:upper|maxillary|maxilla|top)(?:\s+arch)?\b/gi, () => { a.arch ??= 'upper'; }, from, to);
  w.each(/\b(?:lower|mandibular|mandible|bottom)(?:\s+arch)?\b/gi, () => { a.arch ??= 'lower'; }, from, to);
  w.each(/\bboth\b/gi, () => { a.arch ??= 'both'; }, from, to);
  for (const o of OPTION_WORDS) {
    w.each(o.re, (m, at) => { a.opts.push({ id: o.id, heard: cleanText(w.orig(at, m[0].length)), implies: o.implies }); }, from, to);
  }
  w.each(/\b(?:stump\s+(?:shade\s+)?)?ND\s?([1-9])\b/gi, m => {
    if (!STUMP.includes(`ND${m[1]}`)) return false;
    a.stump ??= `ND${m[1]}`;
  }, from, to);
  w.each(/\bBL\s?([1-4])\b/gi, m => {
    if (!BLEACH.includes(`BL${m[1]}`)) return false;
    a.shades.push(`BL${m[1]}`);
  }, from, to);
  w.each(/\b([A-Da-d])([1-4](?:\.5)?)\b/g, m => {
    const s = `${m[1].toUpperCase()}${m[2]}`;
    if (!VITA_CLASSICAL.includes(s)) return false;
    a.shades.push(s);
  }, from, to);
  w.each(/\b([0-5])\s?([LMRlmr])\s?([1-3](?:\.5)?)\b/g, m => {
    const s = `${m[1]}${m[2].toUpperCase()}${m[3]}`;
    if (!VITA_3D.includes(s)) return false;
    a.shades.push(s);
  }, from, to);
  return a;
}

function mergeAttrs(s: RawSvc, a: Attrs) {
  s.teeth.push(...a.teeth);
  s.ranges.push(...a.ranges);
  s.pontics.push(...a.pontics);
  s.arch ??= a.arch;
  s.opts.push(...a.opts);
  if (a.shades.length) s.shade ??= a.shades[0];
  s.stump ??= a.stump;
}

/** The option is one of this product's (or fine to hear with it). */
const optFits = (p: ProductId, id: string) =>
  OPTIONS[p].some(o => o.id === id) || !!BENIGN[p]?.includes(id) || (p === 'partial' && (id === 'metal' || PARTIAL_STAGES.some(x => x.id === id)));

/** Options and shade with no teeth of their own: each service that still lacks them and can take them; else the last one. */
function spread(line: RawSvc[], a: Attrs, last: RawSvc) {
  if (a.opts.length) {
    const to = line.filter(s => !s.opts.length && a.opts.every(o => optFits(s.product!, o.id)));
    for (const s of to.length ? to : [last]) s.opts.push(...a.opts);
  }
  if (a.shades.length) {
    const to = line.filter(s => !s.shade && takesShade(s.product!));
    for (const s of to.length ? to : [last]) s.shade ??= a.shades[0];
  }
  if (a.stump) {
    const to = line.filter(s => !s.stump && takesShade(s.product!));
    for (const s of to.length ? to : [last]) s.stump ??= a.stump;
  }
}

/** Products in the text, each with the stretch that describes it. */
function takeServices(w: Work, st: St) {
  const scan = new Work(w.s);
  const found: { product: ProductId; start: number; end: number; text: string }[] = [];
  for (const [product, re] of PRODUCT_WORDS) {
    scan.each(re, (m, at) => { found.push({ product, start: at, end: at + m[0].length, text: m[0] }); });
  }
  found.sort((a, b) => a.start - b.start);
  // A reline names the denture it relines; the same product named twice in a row
  // ("night guard (Michigan splint)") is one service unless "and" splits them.
  const CONJ = /\s(?:and|plus|also|then|&|\+)\s/i;
  const list = (found.some(f => f.product === 'reline') ? found.filter(f => f.product !== 'denture' && f.product !== 'partial') : found)
    .filter((f, k, all) => !(k > 0 && all[k - 1].product === f.product && !CONJ.test(w.s.slice(all[k - 1].end, f.start))));
  const segs: { from: number; to: number; prod?: (typeof list)[number] }[] = [];
  if (!list.length) segs.push({ from: 0, to: w.s.length });
  else {
    let from = 0;
    list.forEach((p, k) => {
      let to = w.s.length;
      const next = list[k + 1];
      if (next) {
        const between = w.s.slice(p.end, next.start);
        const conj = Array.from(between.matchAll(/\s(?:and|plus|also|then|&|\+)\s/gi)).pop();
        to = conj ? p.end + (conj.index ?? 0) : next.start;
      }
      segs.push({ from, to, prod: p });
      from = to;
    });
  }
  for (const seg of segs) {
    const attrs = readAttrs(w, seg.from, seg.to);
    if (!seg.prod && !hasAttrs(attrs)) continue;
    let svc: RawSvc;
    if (seg.prod) {
      svc = st.cur && !st.cur.product ? st.cur : newSvc(st);
      svc.product = seg.prod.product;
      svc.productText = seg.prod.text;
      if (st.line && !st.line.includes(svc)) st.line.push(svc);
    } else {
      svc = st.cur ?? newSvc(st);
      // "Crown 36 and crown 46, mono A3": material and shade alone go to each of the line's services still without them.
      const line = (st.line ?? []).filter(s => s.product);
      if (line.length > 1 && !attrs.teeth.length && !attrs.ranges.length && !attrs.pontics.length && !attrs.arch) {
        spread(line, attrs, svc);
        const heard = cleanText(w.src.slice(seg.from, seg.to));
        if (heard) svc.heard.push(heard);
        continue;
      }
    }
    mergeAttrs(svc, attrs);
    const heard = cleanText(w.src.slice(seg.from, seg.to));
    if (heard) svc.heard.push(heard);
    st.cur = svc;
  }
  for (const f of found) w.eat(f.start, f.end);
}

/** Whatever is left: words that aren't filler go back to the user. */
function leftovers(w: Work, st: St) {
  for (const run of w.s.split(/\s{2,}/)) {
    const words = run.trim().split(/\s+/).filter(Boolean);
    const meaningful = (x: string) => {
      const t = x.replace(/^[^\w#]+|[^\w]+$/g, '').toLowerCase();
      if (!t || STOP.has(t)) return false;
      if (/^\d+(?:\.\d+)?$/.test(t)) return /^\d{2,3}$/.test(t);
      return /[a-z0-9]/.test(t);
    };
    const i = words.findIndex(meaningful);
    if (i < 0) continue;
    let j = words.length - 1;
    while (j > i && !meaningful(words[j])) j--;
    const text = cleanText(words.slice(i, j + 1).join(' ').replace(/^[(]+|[)]+$/g, ''));
    if (text) st.unplaced.push(text);
  }
}

/** Split a plain line into clauses: commas, semicolons and full stops (not e.max, A3.5 or Dr.). */
function clauses(line: string): string[] {
  const t = line
    .replace(/\b(Dr|Mr|Mrs|Ms|Mx|St|approx)\.\s/gi, '$1 ')
    .replace(/\b((?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|rsday|urday)?),\s+/gi, '$1 ')
    .replace(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}),\s*(\d{4})/g, '$1 $2');
  return t.split(/[,;]|\.(?=\s|$)/).map(s => s.trim()).filter(Boolean);
}

/**
 * One clause of plain text, or a labelled line's value. A clause that opens like
 * an instruction goes to the lab as one (`cue`); a tooth named as a reference
 * ("shade to match 35") goes with it, and only what comes before it is read.
 */
function readPart(part: string, st: St, scope: 'any' | 'service', instr: string[], cue = true) {
  if (cue && INSTR_CUE.test(part)) { instr.push(part); return; }
  const w = new Work(part);
  const ref = REF_CUE.exec(part);
  if (ref) {
    // "Crown 36 to match 35 for Amelia": the lab gets "Crown 36 to match 35"; "to match 35" isn't read.
    const t = REF_TEETH.exec(part.slice(ref.index));
    const end = t ? ref.index + t.index + t[0].length : part.length;
    instr.push(cleanText(part.slice(0, end)));
    w.eat(ref.index, end);
  }
  if (scope === 'any') {
    takePrescriber(w, st);
    takePatientKnown(w, st);
    takeDob(w, st);
    takeLab(w, st);
    takeFunding(w, st);
    takeFast(w, st);
    takeDates(w, st);
    takeTimes(w, st);
    takePatientCue(w, st);
  }
  takeServices(w, st);
  if (scope === 'any') takePatientBare(w, st);
  leftovers(w, st);
}

const HONORIFIC = /^(?:mr|mrs|ms|miss|mx|dr|new|patient|name)$/i;
const NAME_WORD = /^[A-Za-z][A-Za-z'’-]*$/;
const SEX_WORD = /^(?:m|f|male|female|man|woman)$/i;
const NAME_END = new Set(['dob', 'born', 'id', 'age', 'aged', 'nhs', 'private', 'sex', 'gender']);
/** "42", "age 42", "42 yrs", "F", "female": said about the patient, not for the lab. */
const DEMOGRAPHIC = /^(?:\d{1,3}|aged?|y|yo|y\/o|yrs?|years?|old|m|f|male|female|man|woman|sex|gender)$/i;

/** The Patient Name line: the name (and date of birth or ID); anything else on it is read as plain text. */
function readPatientLine(value: string, st: St) {
  if (!value.trim()) return;
  // The labelled line wins over a name read earlier, unless it names no one.
  const before = st.patient;
  st.patient = undefined;
  readPatientValue(value, st);
  const got = st.patient as PatientRead | undefined;
  if (!got || got.kind === 'none') st.patient = before;
}
function readPatientValue(value: string, st: St) {
  const w = new Work(value);
  w.each(/(?:\b(?:dob|d\.o\.b\.?|born(?:\s+on)?|date\s+of\s+birth)\s*:?\s*)?\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/gi, m => {
    const d = dobOf(m[1], m[2], m[3], st.ctx.now);
    if (!d) return false;
    st.dob = d;
  });
  w.each(/\bP-\d{4}-\d{3}\b/gi, m => {
    const p = st.ctx.patients.find(x => x.id.toLowerCase() === m[0].toLowerCase());
    if (!p) return false;
    st.patient = { kind: 'matched', patient: p, heard: m[0] };
  });
  // A known full name anywhere on the line.
  takePatientKnown(w, st);
  takeFunding(w, st);

  // Otherwise the name is the first clause's leading words, up to anything that isn't one.
  const cut = /[,;(]|\s[-–]\s/.exec(w.s);
  const head = cut ? w.s.slice(0, cut.index) : w.s;
  const kept: string[] = [];
  let end = 0;
  for (const m of Array.from(head.matchAll(/\S+/g))) {
    const tok = m[0].replace(/^["'’[(]+|["'’\]).:]+$/g, '');
    if (!tok) continue;
    if (!kept.length && HONORIFIC.test(tok)) { end = (m.index ?? 0) + m[0].length; continue; }
    const low = tok.toLowerCase();
    if (!NAME_WORD.test(tok) || NAME_STOP.has(low) || NAME_END.has(low) || (kept.length >= 2 && SEX_WORD.test(tok))) break;
    kept.push(tok);
    end = (m.index ?? 0) + m[0].length;
  }
  if (kept.length && (!st.patient || st.patient.kind === 'none')) st.patient = readName(kept, kept.join(' '), st.ctx, st.dob);

  // The rest: age and sex are dropped; services, dates and notes are read as on a plain line.
  const rest = head.slice(end) + (cut ? w.s.slice(cut.index) : '');
  const instr: string[] = [];
  for (const part of clauses(rest)) {
    const words = part.replace(/[()[\]"]/g, ' ').split(/[\s,]+/).filter(x => /\w/.test(x));
    if (!words.length || words.every(x => DEMOGRAPHIC.test(x))) continue;
    const clean = part.replace(/\b(?:aged?\s*:?\s*\d{1,3}(?:\s*(?:yrs?|years?)(?:\s+old)?)?|\d{1,3}\s*(?:y\/o|yo|yrs?|years?(?:\s+old)?)(?![\w/]))|\b(?:male|female)\b/gi, ' ');
    if (cleanText(clean)) readPart(clean, st, 'any', instr);
  }
  if (instr.length) st.instr.push(instr.join(', '));
}

function readLabLine(value: string, st: St) {
  const v = value.trim();
  if (!v || /^(usual|default|any|our\s+usual(?:\s+lab)?|the\s+usual(?:\s+lab)?|same\s+as\s+(?:usual|last\s+time)|-|n\/a|none|tbc)$/i.test(v)) return;
  for (const l of labsOf(st.ctx)) {
    if (labRe(l).test(v) || v.toUpperCase() === l.initials) { st.lab = { kind: 'matched', lab: l, heard: v }; return; }
  }
  st.lab = { kind: 'unknown', heard: v };
}

function readDeliveryLine(value: string, st: St, fitLabel: boolean) {
  const w = new Work(value);
  const had = st.date;
  takeFast(w, st);
  takeDates(w, st);
  if (fitLabel && st.date && st.date !== had) st.dateAs = 'fit';
  takeTimes(w, st);
  w.each(/\b(?:standard|normal|usual|regular|routine|no\s+rush|whenever|n\/a|none|tbc)\b/gi, () => {});
  leftovers(w, st);
}

/**
 * A service's own Delivery line: its needed-by date or Fast-Track. The case
 * goes as fast as its fastest ask: Fast-Track if any service wants it, and the
 * earliest needed-by date of them all.
 */
function readServiceDelivery(value: string, st: St, svc: RawSvc) {
  const was = { fast: st.fast, date: st.date, heard: st.dateHeard, as: st.dateAs };
  st.fast = false;
  st.date = undefined;
  st.dateHeard = undefined;
  readDeliveryLine(value, st, false);
  // Read back what the line set (the call above changes st).
  const got = st.date as Date | undefined;
  const gotHeard = st.dateHeard as string | undefined;
  if (st.fast) svc.fast = true;
  if (got) { svc.date = got; svc.dateHeard = gotHeard; }
  const earlier = !!got && (!was.date || got.getTime() < was.date.getTime());
  st.fast = was.fast || st.fast;
  st.date = earlier ? got : was.date;
  st.dateHeard = earlier ? gotHeard : was.heard;
  st.dateAs = earlier ? 'delivery' : was.as;
}

// ─── Reading → result ────────────────────────────────────────────────────────

/** Reads a description (template lines and/or plain sentences). */
export function parseDescription(text: string, ctx: DescribeCtx): Parsed {
  const st: St = { ctx, svcs: [], fast: false, instr: [], unplaced: [], n: 0 };
  let inInstr = false;
  // Instruction lines (and their follow-on lines) go to the service block they sit in, else to the case.
  const instrTo = () => (st.block ? st.block.note : st.instr);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    // A blank line ends a service's block.
    if (!line) { inInstr = false; st.block = undefined; continue; }
    const lab = LABEL_RE.exec(line);
    if (lab) {
      const kind = labelKind(lab[1]);
      const value = (lab[2] ?? '').trim();
      inInstr = kind === 'instr';
      // A service's Teeth / Material lines keep its line's services; any other line starts afresh.
      if (kind !== 'attr') st.line = undefined;
      if (kind === 'patient' || kind === 'lab' || kind === 'prescriber') st.block = undefined;
      const instr: string[] = [];
      switch (kind) {
        case 'patient': readPatientLine(value, st); break;
        case 'lab': readLabLine(value, st); break;
        case 'service': {
          st.line = [];
          const c = st.cur;
          if (c && !c.product && !c.label) { c.label = true; st.line.push(c); }
          else newSvc(st, true);
          st.block = st.cur;
          // The first clause is the service; later ones may be instructions ("match the shade of 35").
          clauses(value).forEach((part, k) => readPart(part, st, 'any', instr, k > 0));
          break;
        }
        case 'attr':
          if (!st.cur) newSvc(st, true);
          clauses(value).forEach((part, k) => readPart(part, st, 'service', instr, k > 0));
          break;
        case 'delivery':
          if (st.block) readServiceDelivery(value, st, st.block);
          else readDeliveryLine(value, st, /^fit/i.test(lab[1]));
          break;
        case 'instr': if (value) instrTo().push(value); break;
        case 'prescriber': {
          if (!value) break;
          const w = new Work(value);
          takePrescriber(w, st);
          leftovers(w, st);
          break;
        }
      }
      if (instr.length) instrTo().push(instr.join(', '));
      continue;
    }
    if (inInstr) { instrTo().push(line); continue; }
    st.line = [];
    const instr: string[] = [];
    for (const part of clauses(line)) readPart(part, st, 'any', instr);
    if (instr.length) st.instr.push(instr.join(', '));
  }
  st.line = undefined;
  return finish(st);
}

function productOf(r: RawSvc): { product?: ProductId; assumed?: boolean } {
  if (r.product) return { product: r.product };
  const implied = r.opts.find(o => o.implies)?.implies;
  if (implied) return { product: implied };
  if ((r.teeth.length || r.ranges.length) && r.opts.some(o => CROWN_MATERIALS.has(o.id))) return { product: 'crown', assumed: true };
  return {};
}

function defaultLab(products: ProductId[], patient: Patient | undefined, ctx: DescribeCtx): { lab: Lab; src: string } {
  const labs = labsOf(ctx);
  const baseId = patient?.nextStage?.lab ?? CLINIC.usualLab;
  const base = labs.find(l => l.id === baseId) ?? labById(baseId);
  const src = patient?.nextStage ? 'Made the previous stage' : "Clinic's usual lab";
  if (!products.length || products.every(p => labMakes(base, p))) return { lab: base, src };
  for (const id of uniq([...(ctx.favourites ?? []), ...labs.map(l => l.id)])) {
    const l = labs.find(x => x.id === id);
    if (l && products.every(p => labMakes(l, p))) return { lab: l, src: 'Makes all these services' };
  }
  return { lab: base, src };
}

function resolveService(r: RawSvc, env: { lab: Lab; funding: Funding; patient?: Patient }): ServiceRead[] {
  const { product, assumed } = productOf(r);
  const missing = env.patient?.missing ?? [];
  const issues: string[] = [];
  const heard = r.heard.join(' · ');
  const singles = uniq(r.teeth);
  const expanded = uniq([...singles, ...r.ranges.flatMap(([a, b]) => (jawOf(a) === jawOf(b) ? spanBetween(a, b) : [a, b]))]);
  let teeth: string[] = [];
  let bridge: ServiceRead['bridge'];
  let arch = r.arch;
  const jawsOf = (ids: string[]) => uniq(ids.map(jawOf));

  if (!product) {
    return [{ key: r.key, heard, teeth: byNum(expanded), arch, makes: true, issues, shade: r.shade }];
  }
  switch (product) {
    case 'bridge': {
      let a: string | undefined;
      let b: string | undefined;
      if (r.ranges.length) [a, b] = r.ranges[0];
      else if (singles.length >= 2) { const s = byArch(singles); a = s[0]; b = s[s.length - 1]; }
      if (a && b) {
        if (jawOf(a) !== jawOf(b)) issues.push(BRIDGE_ERRORS.arch);
        else {
          const span = spanBetween(a, b);
          if (span.length > 6) issues.push(BRIDGE_ERRORS.long);
          else if (span.length < 2) issues.push('A bridge needs two different end teeth.');
          else {
            const explicit = r.pontics.filter(t => span.includes(t));
            const pontics = uniq([...(explicit.length ? explicit : span.slice(1, -1)), ...span.filter(t => missing.includes(t))]);
            teeth = span;
            bridge = { a: span[0], b: span[span.length - 1], pontics };
            if (!pontics.length) issues.push('No pontic in this span. Pick which tooth the bridge replaces on the case.');
          }
        }
      } else if (singles.length === 1) issues.push('A bridge needs both end teeth, for example 23-26.');
      break;
    }
    case 'crown': case 'veneer': case 'inlay': case 'implant': case 'other': {
      teeth = expanded;
      if (product !== 'implant' && product !== 'other') {
        const gone = teeth.filter(t => missing.includes(t));
        if (gone.length) {
          teeth = teeth.filter(t => !missing.includes(t));
          issues.push(`${gone.join(', ')} ${gone.length === 1 ? 'is' : 'are'} recorded as missing. Use Bridge or Implant Crown for ${gone.length === 1 ? 'this site' : 'these sites'}.`);
        }
      }
      break;
    }
    case 'nightguard': case 'retainer': case 'whitening': case 'denture':
      if (!arch && expanded.length) { const j = jawsOf(expanded); arch = j.length === 1 ? j[0] : 'both'; }
      break;
    case 'partial': case 'reline': {
      if (!arch && expanded.length) { const j = jawsOf(expanded); if (j.length === 1) arch = j[0]; }
      if (arch === 'both') {
        issues.push(`A ${PRODUCTS[product].noun} is for one arch. Add a second service for the other arch.`);
        arch = undefined;
      }
      teeth = arch ? expanded.filter(t => jawOf(t) === arch) : expanded;
      if (teeth.length < expanded.length) issues.push(`Only the ${arch} teeth go with this ${arch} ${PRODUCTS[product].noun}.`);
      break;
    }
  }

  // The option (material / type / stage / base / work), only if it's this product's.
  const slot = OPT_SLOT[product];
  const used = new Set<string>();
  let option: ServiceRead['option'];
  let stage: ServiceRead['stage'];
  const probe = newItem(product, { teeth, bridge, arch });
  if (slot) {
    const list = product === 'bridge' ? OPTIONS.bridge.filter(o => !o.id.startsWith('rbb')) : OPTIONS[product];
    const mapped = r.opts.map(o => ({ ...o, id: product === 'partial' && o.id === 'metal' ? 'chrome' : o.id }));
    const hit = mapped.find(o => list.some(x => x.id === o.id));
    if (hit) {
      used.add(hit.heard);
      const avail = optionAvail(env.lab, product, hit.id, env.funding, probe);
      option = { slot, id: hit.id, name: optionName(product, hit.id), ok: avail.ok, reason: avail.reason };
    }
    if (product === 'partial') {
      const st0 = r.opts.find(o => PARTIAL_STAGES.some(x => x.id === o.id));
      if (st0) {
        used.add(st0.heard);
        stage = { id: st0.id, name: PARTIAL_STAGES.find(x => x.id === st0.id)!.name };
        if (st0.id === 'framework' && option?.id !== 'chrome') issues.push('A framework try-in is for a cobalt-chrome base.');
      }
    }
  }
  for (const o of r.opts) {
    if (used.has(o.heard) || o.implies === product || BENIGN[product]?.includes(o.id)) continue;
    issues.push(`“${o.heard}” doesn't go with a ${PRODUCTS[product].noun}, so it was left out.`);
  }
  let shade = r.shade;
  if (shade && !takesShade(product)) {
    issues.push(`A ${PRODUCTS[product].noun} doesn't take a shade, so ${shade} was left out.`);
    shade = undefined;
  }
  const inlayType = product === 'inlay' && r.productText
    ? (/onlay/i.test(r.productText) && !/inlay/i.test(r.productText) ? 'onlay' : /inlay/i.test(r.productText) && !/onlay/i.test(r.productText) ? 'inlay' : undefined)
    : undefined;
  const base: ServiceRead = {
    key: r.key, product, assumed, heard, teeth: product === 'bridge' ? teeth : byNum(teeth), bridge, arch, option, stage,
    inlayType, shade, stump: r.stump, desc: product === 'other' ? heard : undefined, makes: labMakes(env.lab, product), issues,
  };
  // One site each: implant crowns and inlays are one item per tooth.
  if ((product === 'implant' || product === 'inlay') && base.teeth.length > 1) {
    return base.teeth.map((t, i) => ({ ...base, key: `${r.key}-${i}`, teeth: [t] }));
  }
  return [base];
}

function finish(st: St): Parsed {
  const ctx = st.ctx;
  const patient = st.patient ?? { kind: 'none' as const };
  const matched = patient.kind === 'matched' ? patient.patient : undefined;
  if (patient.kind === 'new' && st.dob) patient.dob = st.dob;
  if (patient.kind === 'matched' && st.dob && patient.patient.dob !== st.dob) patient.dobMismatch = true;
  const raws = st.svcs.filter(r => r.product || r.teeth.length || r.ranges.length || r.arch || r.opts.length || r.shade || r.stump);
  const products = raws.map(r => productOf(r).product).filter((p): p is ProductId => !!p);
  const fallback = defaultLab(products, matched, ctx);
  const lab: LabRead = st.lab?.kind === 'matched' ? st.lab
    : st.lab?.kind === 'unknown' ? { kind: 'unknown', heard: st.lab.heard, lab: fallback.lab, src: fallback.src }
    : { kind: 'default', lab: fallback.lab, src: fallback.src };
  const funding = st.funding ?? matched?.funding ?? CLINIC.defaultFunding;
  // Each service keeps its own instruction and delivery (an implant split per tooth shares them).
  const services = raws.flatMap(r => resolveService(r, { lab: lab.lab, funding, patient: matched }).map(s => ({
    ...s,
    note: r.note.join('\n').trim() || undefined,
    delivery: r.fast || r.date ? { fastTrack: !!r.fast, date: r.date, heard: r.dateHeard } : undefined,
  })));
  const instructions = st.instr.join('\n').trim();
  const unplaced = uniq(st.unplaced.map(cleanText).filter(Boolean));
  return {
    patient,
    lab,
    services,
    delivery: { fastTrack: st.fast, date: st.date, heard: st.dateHeard, as: st.dateAs ?? 'delivery' },
    instructions,
    funding: st.funding,
    prescriber: st.prescriber,
    unplaced,
    empty: patient.kind === 'none' && !services.length && !st.lab && !st.fast && !st.date && !instructions && !unplaced.length && !st.prescriber,
  };
}

// ─── Result → draft ──────────────────────────────────────────────────────────

function teethDone(s: ServiceRead): boolean {
  switch (s.product) {
    case 'bridge': return !!s.bridge && s.bridge.pontics.length > 0;
    case 'crown': case 'veneer': return s.teeth.length > 0;
    case 'implant': case 'inlay': return s.teeth.length === 1;
    case 'partial': return s.teeth.length > 0 && !!s.arch;
    case 'reline': return s.teeth.length > 0;
    default: return false;
  }
}

/** One ServiceItem per service the description names a product for (same order). */
export function itemsFor(p: Parsed): ServiceItem[] {
  return p.services.filter(s => s.product).map(s => {
    const x: Partial<ServiceItem> = {};
    if (s.teeth.length) { x.teeth = s.teeth; x.teethSrc = AI_SRC; x.teethDone = teethDone(s); }
    if (s.bridge) x.bridge = s.bridge;
    if (s.arch) { x.arch = s.arch; x.archSrc = AI_SRC; }
    if (s.option?.ok) {
      const { id } = s.option;
      switch (s.option.slot) {
        case 'material': x.material = id; x.matSrc = AI_SRC; break;
        case 'type': x.type = id; x.typeSrc = AI_SRC; break;
        case 'stage': x.stage = id; x.stageSrc = AI_SRC; break;
        case 'base': x.base = id; break;
        case 'work': x.work = id; break;
      }
    } else if (s.option && (s.option.slot === 'material' || s.option.slot === 'type')) {
      // Asked for, but not offered here: no usual stands in for it; the case asks.
      x.reopen = [s.option.slot];
    }
    if (s.stage) { x.stage = s.stage.id; x.stageSrc = AI_SRC; }
    if (s.inlayType) x.inlayType = s.inlayType;
    if (s.shade) { x.shade = s.shade; x.shadeSrc = AI_SRC; }
    if (s.stump) x.stump = s.stump;
    if (s.product === 'other' && s.desc) { x.desc = s.desc; x.descDone = s.desc.trim().length >= 10; }
    // The service's own instruction: merged into the case's at Review, like any service note.
    if (s.note) x.note = s.note;
    return newItem(s.product!, x);
  });
}

const sameTeeth = (a: string[], b: string[]) => a.length > 0 && a.length === b.length && byNum(a).join() === byNum(b).join();
/** The new item describes an item already on the draft (same product, same teeth or arch). */
function sameSpot(a: ServiceItem, b: ServiceItem) {
  if (a.product !== b.product) return false;
  if (sameTeeth(a.teeth, b.teeth)) return true;
  return PRODUCTS[a.product].archItem === true && !!a.arch && a.arch === b.arch;
}
function mergeItem(old: ServiceItem, it: ServiceItem): ServiceItem {
  const out: ServiceItem = { ...old };
  if (it.teeth.length) { out.teeth = it.teeth; out.teethDone = it.teethDone; out.teethSrc = it.teethSrc; out.bridge = it.bridge ?? out.bridge; }
  if (it.arch) { out.arch = it.arch; out.archSrc = it.archSrc; }
  if (it.material) { out.material = it.material; out.matSrc = it.matSrc; out.ambiguous = undefined; }
  if (it.type) { out.type = it.type; out.typeSrc = it.typeSrc; }
  if (it.stage) { out.stage = it.stage; out.stageSrc = it.stageSrc; }
  if (it.base) out.base = it.base;
  if (it.work) out.work = it.work;
  if (it.inlayType) out.inlayType = it.inlayType;
  if (it.shade) { out.shade = it.shade; out.shadeSrc = it.shadeSrc; }
  if (it.stump) out.stump = it.stump;
  if (it.desc) { out.desc = it.desc; out.descDone = it.descDone; }
  const reopen = uniq([...(out.reopen ?? []), ...(it.reopen ?? [])])
    .filter(r => !(r === 'material' && it.material) && !(r === 'type' && it.type));
  out.reopen = reopen.length ? reopen : undefined;
  return out;
}

/** The rules context for a draft, as the case page builds it. */
export function ctxFor(d: CaseDraft, patient: Patient, user: User, now: Date): Ctx {
  const pres = resolvePrescriber(d, user, loginMap());
  return { patient, lab: labById(d.lab), user, prescriber: userById(pres.id), funding: d.funding, now };
}

export type FitRead =
  | { state: 'none' }
  /** `fit`: the fit appointment saved on the case; `neededBy`: what the lab delivers by. */
  | { state: 'ok'; date: Date; fit: Date; neededBy: Date; backBy: Date }
  | { state: 'soon'; date: Date; backBy: Date; earliest?: Date }
  | { state: 'closed' | 'past' | 'unknown'; date: Date };
/**
 * Does the description's date work for the lab? A fit date: the clinic is open
 * and the lab delivers the working day before. A delivery date: the lab is back
 * by then, and the fit can be the next clinic day.
 */
export function fitFor(dl: DeliveryRead, d: CaseDraft, ctx: Ctx): FitRead {
  const date = dl.date;
  if (!date) return { state: 'none' };
  if (date <= startOfDay(ctx.now)) return { state: 'past', date };
  const asFit = dl.as === 'fit';
  if (asFit && !isClinicOpen(date)) return { state: 'closed', date };
  const dates = caseDates(d, ctx);
  if (!dates.backBy) return { state: 'unknown', date };
  const fit = asFit ? date : firstClinicDayAfter(date);
  const f = fitCheck(toISO(fit), dates.backBy);
  return f.ok
    ? { state: 'ok', date, fit, neededBy: f.neededBy, backBy: dates.backBy }
    : { state: 'soon', date, backBy: dates.backBy, earliest: dates.earliestFit };
}

/**
 * The Draft the description builds: lab, services (only options the lab
 * offers), instructions as the case note, Fast-Track when a service can take
 * it, and the date as the fit appointment when the lab can make it (a delivery
 * date: the fit the next clinic day). With `base` (the patient's open draft,
 * e.g. a waiting scan) it fills that draft.
 */
export function buildDraft(p: Parsed, patient: Patient, user: User, now: Date, base?: CaseDraft): CaseDraft {
  let d: CaseDraft = base ? { ...base, items: [...base.items] } : blankDraft(patient);
  if (p.funding) d.funding = p.funding;
  const keepLab = !!base && base.labPicked !== false;
  if (p.lab.kind === 'matched') d = { ...d, lab: p.lab.lab.id, labSrc: AI_SRC, labPicked: true };
  else if (!keepLab) {
    d = p.lab.kind === 'default'
      ? { ...d, lab: p.lab.lab.id, labSrc: p.lab.src, labPicked: true }
      : { ...d, lab: p.lab.lab.id, labSrc: p.lab.src, labPicked: false };
  }
  for (const it of itemsFor(p)) {
    const same = d.items.find(b => sameSpot(b, it));
    d.items = same ? d.items.map(b => (b === same ? mergeItem(b, it) : b)) : [...d.items, it];
  }
  // The patient's next denture stage, at the lab that made the last one, is that stage (its records are at the lab).
  const ns = patient.nextStage;
  if (ns && d.lab === ns.lab) {
    let tagged = false;
    d.items = d.items.map(i => {
      if (tagged || i.product !== ns.product || i.arch !== ns.arch || (i.stage && i.stage !== ns.stage)) return i;
      tagged = true;
      return { ...i, stage: ns.stage, stageSrc: 'Next stage', archSrc: 'Next stage' };
    });
  }
  if (p.prescriber) d = { ...d, prescriber: p.prescriber, prescriberSrc: AI_SRC };
  if (p.instructions) d = { ...d, note: [d.note.trim(), p.instructions].filter(Boolean).join('\n\n') };
  const ctx = ctxFor(d, patient, user, now);
  if (p.delivery.fastTrack) d = { ...d, fastTrack: d.items.some(i => fastTrackEligible(i, ctx)) };
  const fit = fitFor(p.delivery, d, ctx);
  if (fit.state === 'ok') d = { ...d, fit: toISO(fit.fit) };
  return d;
}

// ─── Preview for the panel ───────────────────────────────────────────────────

export interface Preview {
  draft: CaseDraft;
  ctx: Ctx;
  items: ServiceItem[];
  gaps: number;
  opensAt: string;
  fit: FitRead;
  fastTrack: boolean;
  backBy?: Date;
}
/** The draft as it would open: where the case starts, what's left, the dates. Null until there's a patient. */
export function previewCase(p: Parsed, user: User, now: Date, opts: { base?: CaseDraft; dob?: string } = {}): Preview | null {
  let patient: Patient | null = null;
  if (p.patient.kind === 'matched') patient = p.patient.patient;
  else if (p.patient.kind === 'new') {
    const dob = opts.dob && parseDOB(opts.dob, now).date ? opts.dob : '01/01/1990';
    patient = { id: 'P-NEW', first: p.patient.first, last: p.patient.last, dob, sex: 'X', funding: p.funding ?? CLINIC.defaultFunding };
  }
  if (!patient) return null;
  const draft = buildDraft(p, patient, user, now, opts.base);
  const ctx = ctxFor(draft, patient, user, now);
  const steps = buildSteps(draft, ctx, '');
  const first = firstGap(steps);
  const dates = caseDates(draft, ctx);
  return {
    draft, ctx,
    items: itemsFor(p),
    gaps: gapCount(draft, ctx),
    opensAt: stepName(steps, first, draft, user.notation),
    fit: fitFor(p.delivery, draft, ctx),
    fastTrack: draft.fastTrack,
    backBy: dates.backBy,
  };
}

/** The new patient can be created: a first and last name and a real date of birth. */
export function newPatientReady(p: Parsed, dob: string, now: Date): boolean {
  return p.patient.kind === 'new' && !!p.patient.first && !!p.patient.last && !parseDOB(dob, now).error;
}

/** What the step timeline and the screen reader hear. */
export function understood(p: Parsed, n: Notation) {
  const made = p.services.filter(s => s.product);
  const items = itemsFor(p);
  const patient = p.patient.kind === 'matched' ? fullName(p.patient.patient)
    : p.patient.kind === 'new' ? `${p.patient.first} ${p.patient.last}`.trim() : undefined;
  return {
    patient,
    patientNew: p.patient.kind === 'new',
    lab: p.lab.kind === 'unknown' ? undefined : p.lab.lab.name,
    labNamed: p.lab.kind === 'matched',
    services: items.length === 0 ? undefined : items.length === 1 ? itemTitle(items[0], n) : `${items.length} services`,
    count: made.length,
  };
}
export function announceText(p: Parsed): string {
  if (p.empty) return '';
  const u = understood(p, 'fdi');
  const who = u.patient ? `${u.patientNew ? 'new patient' : 'patient'} ${u.patient}` : 'no patient yet';
  return `Understood: ${who}, ${u.count} ${u.count === 1 ? 'service' : 'services'}`;
}
