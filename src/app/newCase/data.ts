// ─── New Case Flow · demo data ───────────────────────────────────────────────
// Elmfield Dental Practice, its three approved labs with their price lists,
// the signed-in users and the demo patients. Every name, price and number is a
// placeholder (see the requirements, §15 and §19).

export type ProductId =
  | 'crown' | 'bridge' | 'implant' | 'veneer' | 'inlay' | 'nightguard' | 'denture'
  | 'partial' | 'reline' | 'retainer' | 'aligner' | 'whitening' | 'other';
export type Funding = 'private' | 'nhs';
export type Arch = 'upper' | 'lower' | 'both';
export type UserId = 'khan' | 'ellery' | 'jess';
export type LabId = 'northfield' | 'harbour' | 'pennine';
export type Scanner = 'Medit' | 'iTero' | '3Shape' | 'DS Core';

/** [private price, NHS price, turnaround in working days]; null = not offered. */
export type PriceEntry = [number | null, number | null, number];

export interface Lab {
  id: LabId;
  name: string;
  initials: string;
  city: string;
  /** Street address shown in the lab picker (demo). */
  address: string;
  mhra: string;
  cutoffMin: number;
  nhs: boolean;
  /** Tile colours — same avatar idiom as the existing lab grid. */
  avatar: string;
  fastTrack?: { products: ProductId[]; materials: string[]; daysFaster: number; perUnit: number };
  /** key `${product}:${option}` */
  prices: Record<string, PriceEntry>;
}

export const LABS: Lab[] = [
  {
    id: 'northfield',
    name: 'Northfield Dental Lab',
    initials: 'ND',
    city: 'Sheffield',
    address: '14 Kelham Island Works, Alma Street, Sheffield S3 8RY',
    mhra: 'DEMO-1001',
    cutoffMin: 15 * 60,
    nhs: true,
    avatar: 'bg-[#E3F2FD] text-[#1565C0]',
    fastTrack: { products: ['crown'], materials: ['mono', 'emax'], daysFaster: 2, perUnit: 20 },
    prices: {
      'crown:mono': [95, 68, 7], 'crown:emax': [120, null, 8], 'crown:layered': [135, null, 10],
      'crown:pbc': [85, 62, 9], 'crown:metal': [70, 55, 7],
      'bridge:mono': [95, 68, 7], 'bridge:emax': [120, null, 8], 'bridge:layered': [135, null, 10],
      'bridge:pbc': [85, 62, 9], 'bridge:metal': [70, 55, 7],
      'bridge:rbb-metal': [150, 110, 9], 'bridge:rbb-zirc': [180, null, 9],
      'veneer:emax': [125, null, 8], 'veneer:composite': [70, null, 6],
      'inlay:emax': [110, null, 7], 'inlay:composite': [75, 60, 6],
      'nightguard:hard': [55, 55, 5], 'nightguard:soft': [40, 40, 5], 'nightguard:dual': [65, null, 5],
      'retainer:essix': [40, 40, 4], 'retainer:hawley': [60, 60, 5],
      // Clear aligners are private work, and the set is planned before it's made: a longer lead than a retainer.
      'aligner:clear': [450, null, 10],
      'whitening:trays': [25, null, 4],
      'other:tbc': [null, null, 10],
    },
  },
  {
    id: 'harbour',
    name: 'Harbour Ceramics Studio',
    initials: 'HC',
    city: 'Bristol',
    address: 'Unit 6, Wapping Wharf, Gaol Ferry Steps, Bristol BS1 6WP',
    mhra: 'DEMO-1002',
    cutoffMin: 14 * 60,
    nhs: false,
    avatar: 'bg-[#F3E5F5] text-[#6A1B9A]',
    prices: {
      'crown:mono': [99, null, 6], 'crown:emax': [118, null, 7], 'crown:layered': [140, null, 9],
      'bridge:mono': [99, null, 6], 'bridge:emax': [118, null, 7], 'bridge:layered': [135, null, 9],
      'veneer:emax': [120, null, 7], 'veneer:feldspathic': [165, null, 9],
      'implant:mono': [240, null, 12], 'implant:layered': [285, null, 12], 'implant:cement': [310, null, 14],
      'aligner:clear': [480, null, 12],
    },
  },
  {
    id: 'pennine',
    name: 'Pennine Denture Lab',
    initials: 'PD',
    city: 'Huddersfield',
    address: '3 Lockside Mills, Firth Street, Huddersfield HD1 3BL',
    mhra: 'DEMO-1003',
    cutoffMin: 12 * 60,
    nhs: true,
    avatar: 'bg-[#FFF3E0] text-[#E65100]',
    prices: {
      'nightguard:hard': [50, 50, 5], 'nightguard:soft': [38, 38, 5], 'nightguard:dual': [60, null, 5],
      'retainer:essix': [38, 38, 4],
      'whitening:trays': [24, null, 4],
      'denture:tray': [18, 15, 5], 'denture:blocks': [22, 18, 5], 'denture:tryin': [35, 28, 5], 'denture:retry': [35, 28, 5],
      'denture:finish': [135, 95, 5], 'denture:stf': [160, 115, 7], 'denture:immediate': [150, 110, 7],
      'partial:acrylic': [120, 85, 5], 'partial:chrome': [260, 190, 5], 'partial:flexible': [180, null, 5],
      'reline:repair': [35, 28, 1], 'reline:addtooth': [40, 32, 1], 'reline:addclasp': [45, 35, 1],
      'reline:hard': [60, 48, 1], 'reline:soft': [75, null, 2],
    },
  },
];
export const labById = (id: string) => LABS.find(l => l.id === id) ?? LABS[0];

export const CLINIC = {
  name: 'Elmfield Dental Practice',
  city: 'Leeds',
  /** Where the lab sends the work back (the order form's Ship to). */
  address: '22 Elmfield Road, Headingley, Leeds LS6 2AB',
  disinfectant: 'ImpressSafe',
  usualLab: 'northfield' as LabId,
  defaultFunding: 'private' as Funding,
  nhsContract: true,
  courierDays: 1,
  practiceManager: 'Karen Moss',
};

export interface User {
  id: UserId;
  name: string;
  /** "Dr Khan" */
  short: string;
  first: string;
  role: 'dentist' | 'nurse';
  gdc?: string;
  /** The dentist lets staff send in their name. */
  delegation?: boolean;
  /** How teeth read for this user (FDI, Universal or Palmer); stored teeth are always FDI. */
  notation: 'fdi' | 'universal' | 'palmer';
}
export const USERS: User[] = [
  { id: 'khan', name: 'Dr Sarah Khan', short: 'Dr Khan', first: 'Sarah', role: 'dentist', gdc: '999101', delegation: true, notation: 'fdi' },
  { id: 'ellery', name: 'Dr Tom Ellery', short: 'Dr Ellery', first: 'Tom', role: 'dentist', gdc: '999102', delegation: false, notation: 'palmer' },
  { id: 'jess', name: 'Jess Ward', short: 'Jess Ward', first: 'Jess', role: 'nurse', notation: 'fdi' },
];
// The tooth numbering each user picked in the demo (kept in the store), applied wherever a user is looked up.
// One object per user and numbering, so a lookup only gives a new object when the numbering changes.
let notationFor: (id: UserId) => User['notation'] | undefined = () => undefined;
export function setNotationLookup(fn: (id: UserId) => User['notation'] | undefined) { notationFor = fn; }
const withNotation = new Map<string, User>();
export function userById(id?: string): User | undefined {
  const u = USERS.find(x => x.id === id);
  const n = u && notationFor(u.id);
  if (!u || !n || n === u.notation) return u;
  const key = `${u.id}:${n}`;
  if (!withNotation.has(key)) withNotation.set(key, { ...u, notation: n });
  return withNotation.get(key);
}
export const DENTISTS = USERS.filter(u => u.role === 'dentist');

/** Scanner logins Smile Genius already knows. Learned links are added in the store. */
export const SCANNER_LOGINS: Record<string, UserId | undefined> = {
  'Medit:skhan': 'khan',
  'iTero:surgery2': undefined,
};

export interface PriorWork {
  caseId: string;
  product: ProductId;
  teeth?: string[];
  arch?: Arch;
  option?: string;
  shade?: string;
  lab: LabId;
  /** ISO date delivered (or sent, for open cases). */
  date: string;
  open?: boolean;
  /** A staged denture: each stage made on this case, when it was ordered, needed back and what it asked for (the order form's history). */
  stages?: { id: string; created: string; due: string; note: string }[];
}
export interface ImplantRecord { tooth: string; system: string; platform: string; diameter: string; placed: string }
export interface Patient {
  id: string;
  first: string;
  last: string;
  /** dd/mm/yyyy */
  dob: string;
  sex: 'F' | 'M' | 'X';
  funding: Funding;
  practiceId?: string;
  missing?: string[];
  implants?: ImplantRecord[];
  lastShade?: string;
  history?: PriorWork[];
  /** A denture stage that's due next: the stages before it were done on `caseId` (see seedDenturePlan). */
  nextStage?: { product: 'denture'; arch: Arch; stage: string; lab: LabId; caseId: string; note: string };
  /** Arch-level work to repeat. */
  repeat?: { product: ProductId; arch: Arch; option: string; date: string; label: string };
  /** Shown in the launcher's Recent Patients. */
  lastLabel?: string;
}

export const PATIENTS: Patient[] = [
  {
    id: 'P-2025-031', first: 'Amelia', last: 'Clarke', dob: '12/03/1984', sex: 'F', funding: 'private',
    lastShade: 'A2',
    history: [{ caseId: 'CAS-2026-061', product: 'crown', teeth: ['26'], option: 'emax', shade: 'A2', lab: 'northfield', date: '2026-03-18' }],
    lastLabel: 'Crown 26 · UL6, Mar 2026',
  },
  {
    id: 'P-2025-044', first: 'Priya', last: 'Shah', dob: '03/02/1990', sex: 'F', funding: 'private',
    repeat: { product: 'nightguard', arch: 'upper', option: 'soft', date: '2025-06-12', label: 'Soft night guard · Upper · Jun 2025' },
    history: [{ caseId: 'CAS-2025-212', product: 'nightguard', arch: 'upper', option: 'soft', lab: 'northfield', date: '2025-06-12' }],
    lastLabel: 'Night guard · UPPER, Jun 2025',
  },
  {
    id: 'P-2025-018', first: 'William', last: 'Grant', dob: '07/06/1981', sex: 'M', funding: 'private',
    lastShade: 'A3',
    history: [{ caseId: 'CAS-2026-098', product: 'crown', teeth: ['46'], option: 'mono', shade: 'A3', lab: 'northfield', date: '2026-10-03' }],
    lastLabel: 'Crown 46 · LR6, Oct 2026',
  },
  {
    id: 'P-2025-027', first: 'Grace', last: "O'Neill", dob: '12/05/1986', sex: 'F', funding: 'private',
    implants: [{ tooth: '46', system: 'Straumann BLT', platform: 'RC', diameter: 'Ø4.1', placed: '2026-07-14' }],
    lastLabel: 'Implant placed 46 · LR6, Jul 2026',
  },
  {
    id: 'P-2025-009', first: 'Edward', last: 'Thomas', dob: '19/08/1955', sex: 'M', funding: 'nhs',
    // Special Tray and Bite Registration were made on CAS-2026-117: a new upper denture at Pennine continues it.
    nextStage: { product: 'denture', arch: 'upper', stage: 'tryin', lab: 'pennine', caseId: 'CAS-2026-117', note: 'bite registration back 12 Oct' },
    history: [{
      caseId: 'CAS-2026-117', product: 'denture', arch: 'upper', option: 'blocks', lab: 'pennine', date: '2026-10-12',
      stages: [
        { id: 'tray', created: '2026-09-28', due: '2026-10-05', note: 'Please make a special tray for the upper arch from the primary impression, spaced 2 mm, with a handle. Check the border extension.' },
        { id: 'blocks', created: '2026-10-05', due: '2026-10-12', note: 'Please make an upper bite block on the master model to record the jaw relationship. Mark the centre line and smile line.' },
      ],
    }],
    lastLabel: 'Full denture · UPPER bite registration, Oct 2026',
  },
  {
    id: 'P-2025-052', first: 'Hannah', last: 'Lowe', dob: '30/01/2010', sex: 'F', funding: 'private',
    lastLabel: 'No lab work yet',
  },
  {
    id: 'P-2025-060', first: 'Ben', last: 'Ortiz', dob: '14/11/1996', sex: 'M', funding: 'nhs',
    missing: ['36'],
    history: [{ caseId: 'CAS-2026-131', product: 'nightguard', arch: 'upper', option: 'hard', lab: 'northfield', date: '2026-10-20', open: true }],
    lastLabel: 'Night guard · UPPER, Oct 2026',
  },
  {
    // A7 · Medit's form arrives with "36 · Crown · Zirconia".
    id: 'P-2025-071', first: 'Daniel', last: 'Hughes', dob: '21/09/1977', sex: 'M', funding: 'private',
    lastLabel: 'No lab work yet',
  },
];

export const IMPLANT_SYSTEMS: { name: string; platforms: string[]; scanBodies: string[] }[] = [
  { name: 'Straumann BLT', platforms: ['NC', 'RC'], scanBodies: ['Straumann CARES Mono Scanbody', 'Elos Accurate IO 2B', 'Dess scan body'] },
  { name: 'Nobel Biocare NobelActive', platforms: ['NP', 'RP'], scanBodies: ['Nobel Elos scan body', 'Elos Accurate IO 2B', 'Dess scan body'] },
  { name: 'Astra Tech EV', platforms: ['3.6', '4.2'], scanBodies: ['Atlantis FLO-S', 'Elos Accurate IO 2B'] },
  { name: 'Neodent GM', platforms: ['GM'], scanBodies: ['Neodent GM scan body', 'Elos Accurate IO 2B'] },
];

export interface Preferences {
  occlusal: string;
  proximal: string;
  staining: string;
  anatomy: string;
  clearance: string;
  pbcMargin?: string;
  pontic?: string;
}

export interface Usuals {
  crownBack: [string, string];
  crownFront: [string, string];
  bridgeBack: string;
  bridgeFront: string;
  nightguard: string;
  retainer: string;
  prefs: Preferences;
  shades: string[];
}
const KHAN_PREFS: Preferences = { occlusal: 'Light', proximal: 'Medium', staining: 'Light', anatomy: 'Follow adjacent teeth', clearance: 'Call me' };
export const USUALS: Record<'khan' | 'ellery' | 'group', Usuals> = {
  khan: {
    crownBack: ['mono', 'mono'], crownFront: ['emax', 'pbc'], bridgeBack: 'mono', bridgeFront: 'layered',
    nightguard: 'hard', retainer: 'essix', prefs: KHAN_PREFS, shades: ['A2', 'A3', 'A1', 'B1', 'A3.5'],
  },
  ellery: {
    crownBack: ['emax', 'pbc'], crownFront: ['layered', 'pbc'], bridgeBack: 'mono', bridgeFront: 'layered',
    nightguard: 'soft', retainer: 'essix',
    prefs: { occlusal: 'Medium', proximal: 'Tight', staining: 'None', anatomy: 'Ideal anatomy', clearance: 'Reduce the opposing tooth' },
    shades: ['A3', 'A2', 'B2', 'A3.5', 'B1'],
  },
  group: {
    crownBack: ['mono', 'mono'], crownFront: ['emax', 'pbc'], bridgeBack: 'mono', bridgeFront: 'emax',
    nightguard: 'hard', retainer: 'essix', prefs: KHAN_PREFS, shades: ['A2', 'A3', 'A1', 'B1', 'A3.5'],
  },
};
