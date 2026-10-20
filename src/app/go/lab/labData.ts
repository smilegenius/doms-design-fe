// ─── Smile Genius Go · Lab version — data and status rules ──────────────────
// The lab app is the other side of the same cases: Northstar Dental Lab receives
// work from many practices, accepts it, moves it through production and sends it
// back. It shares ONE set of cases with the clinic view, so what happens on one
// side shows on the other.
import {
  LabCase, LabStatus, StageLine, dayOffset, labStatusOf, nowIso,
} from '../data';

export const LAB_ID = 'northstar';
export const LAB_NAME = 'Northstar Dental Lab';
export const LAB_ME = { name: 'Maya Brooks', first: 'Maya', role: 'Lab manager', email: 'maya.brooks@northstar.example.test' };
/** The lab view lives inside the Light version, next to the clinic view, on the same cases. */
export const LAB_BASE = '/go/lite/lab';

const DAY = 864e5;
const at = (days: number, h = 12, m = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

type Seed = Partial<LabCase> & Pick<LabCase, 'id' | 'patientId' | 'practice' | 'clinician' | 'service' | 'teeth' | 'material' | 'stage'>;
const mk = (s: Seed): LabCase => ({
  lab: LAB_ID, createdBy: 'Reception', funding: 'Private', instructions: '', returnBy: '', attachments: ['Prescription photo'], events: [], messages: [],
  source: 'photo', ...s,
});
const sent = (d: number, by = 'Reception') => [{ stage: 'authorised' as const, at: at(d, 9), by }, { stage: 'dispatched' as const, at: at(d, 15), by }];

/** The cases the lab can see: everything for Northstar that a practice has sent (or the lab made itself), never a practice's own drafts. */
export const isLabCase = (c: LabCase) => c.lab === LAB_ID && c.stage !== 'ready' && (c.stage !== 'draft' || !!c.labMade);

export const LAB_SEEDS: LabCase[] = [
  mk({ pin: 1, id: 'SG-L101', patientId: 'P-10231', practice: 'cds', clinician: 'reed', createdBy: 'Dr Olivia Reed', service: 'Crown', teeth: ['UR6'], material: 'Layered zirconia', shade: 'A2',
    instructions: 'Light contacts mesial and distal. Natural characterisation.', returnBy: at(5), stage: 'dispatched', events: sent(0, 'Dr Olivia Reed') }),
  mk({ pin: 2, id: 'SG-L102', patientId: 'P-10188', practice: 'isc', clinician: 'okafor', createdBy: 'Dr Samuel Okafor', service: 'Veneer', teeth: ['UR1', 'UL1'], material: 'Lithium disilicate (e.max)', shade: 'BL2',
    instructions: 'Minimal prep, match the mock-up.', returnBy: at(2), stage: 'at-lab', labStatus: 'Under Review', labSeen: true, events: [...sent(-1, 'Dr Samuel Okafor'), { stage: 'at-lab', at: at(0, 9), by: LAB_NAME }] }),
  mk({ id: 'SG-L103', patientId: 'P-10342', practice: 'cds', clinician: 'lee', createdBy: 'Dr Hannah Lee', service: 'Night guard', teeth: ['Upper arch'], material: 'Acrylic',
    instructions: 'Hard acrylic, 2 mm. No date given. Please confirm when you can return it.', returnBy: '', stage: 'dispatched', attachments: [], events: sent(0, 'Dr Hannah Lee') }),
  mk({ id: 'SG-L104', patientId: 'P-10402', practice: 'isc', clinician: 'okafor', createdBy: 'Dr Samuel Okafor', service: 'Partial denture', teeth: ['Upper arch'], material: 'Cobalt chrome', funding: 'NHS',
    instructions: 'Clasps on UR5 and UL6.', returnBy: at(8), stage: 'at-lab', labStatus: 'Under Review', labSeen: true, events: [...sent(-2), { stage: 'at-lab', at: at(-1, 9), by: LAB_NAME }] }),
  mk({ pin: 3, id: 'SG-L105', patientId: 'P-10415', practice: 'cds', clinician: 'reed', createdBy: 'Dr Olivia Reed', service: 'Bridge', teeth: ['LL5', 'LL6', 'LL7'], material: 'Layered zirconia', shade: 'A3',
    instructions: 'Three-unit bridge, pontic LL6.', returnBy: at(3), stage: 'production', labStatus: 'In Production', labSeen: true,
    events: [...sent(-6), { stage: 'at-lab', at: at(-5, 9), by: LAB_NAME }, { stage: 'production', at: at(-3, 10), by: LAB_NAME }] }),
  mk({ id: 'SG-L106', patientId: 'P-10450', practice: 'cds', clinician: 'reed', createdBy: 'Dr Olivia Reed', service: 'Crown', teeth: ['UL6'], material: 'Monolithic zirconia', shade: 'A2',
    instructions: 'Tight contacts, flat fossae.', returnBy: at(1), stage: 'production', labStatus: 'Quality Control', labSeen: true,
    events: [...sent(-8), { stage: 'at-lab', at: at(-7, 9), by: LAB_NAME }, { stage: 'production', at: at(-5, 10), by: LAB_NAME }] }),
  mk({ id: 'SG-L107', patientId: 'P-10077', practice: 'isc', clinician: 'lee', createdBy: 'Dr Hannah Lee', service: 'Implant restoration', teeth: ['LL6'], material: 'Monolithic zirconia', shade: 'A3',
    instructions: 'Screw-retained on Straumann BL RC. Scan body and analogue enclosed.', returnBy: at(-2), stage: 'production', labStatus: 'In Production', labSeen: true,
    events: [...sent(-14), { stage: 'at-lab', at: at(-12, 9), by: LAB_NAME }, { stage: 'production', at: at(-9, 10), by: LAB_NAME }] }),
  mk({ id: 'SG-L108', patientId: 'P-10290', practice: 'cds', clinician: 'reed', createdBy: 'Dr Olivia Reed', service: 'Veneer', teeth: ['UR2'], material: 'Lithium disilicate (e.max)', shade: 'BL3',
    instructions: 'Match to digital smile design.', returnBy: at(6), stage: 'at-lab', labSeen: true,
    onHold: { side: 'Practice', reason: 'Waiting for the practice to confirm the shade', by: LAB_NAME, since: at(0, 9) },
    events: [...sent(-3), { stage: 'at-lab', at: at(-2, 9), by: LAB_NAME }, { stage: 'note', at: at(0, 9), by: LAB_NAME, text: 'Status changed to On Hold (Practice)' }],
    messages: [{ from: 'lab', author: `${LAB_ME.name} · Northstar`, text: 'The mock-up shows BL2 but the form says BL3. Which shade should we use?', at: at(0, 9) }] }),
  mk({ id: 'SG-L109', patientId: 'P-10356', practice: 'isc', clinician: 'okafor', createdBy: 'Dr Samuel Okafor', service: 'Full denture', teeth: ['Lower arch'], material: 'Acrylic', funding: 'NHS',
    instructions: 'Final finish after try-in.', returnBy: at(9), stage: 'at-lab', labSeen: true,
    onHold: { side: 'Lab', reason: 'Waiting for a replacement tooth set from our supplier', by: LAB_NAME, since: at(-1, 14) },
    events: [...sent(-5), { stage: 'at-lab', at: at(-4, 9), by: LAB_NAME }, { stage: 'note', at: at(-1, 14), by: LAB_NAME, text: 'Status changed to On Hold (Lab)' }] }),
  mk({ id: 'SG-L110', patientId: 'P-10119', practice: 'isc', clinician: 'okafor', createdBy: 'Dr Samuel Okafor', service: 'Whitening trays', teeth: ['Both arches'], material: 'Flexible nylon',
    instructions: 'No date agreed yet.', returnBy: '', stage: 'at-lab', labStatus: 'Accepted', labSeen: true, events: [...sent(-2), { stage: 'at-lab', at: at(-1, 9), by: LAB_NAME }] }),
  mk({ id: 'SG-L111', patientId: 'P-10231', practice: 'cds', clinician: 'reed', createdBy: LAB_ME.name, service: 'Inlay / onlay', teeth: ['LR7'], material: 'Full gold',
    instructions: 'Posted prescription, details still to check with the practice.', returnBy: '', stage: 'draft', labMade: true, labSeen: true, source: 'manual', createdAt: at(-1, 16), attachments: [] }),
  mk({ id: 'SG-L112', patientId: 'P-10402', practice: 'isc', clinician: 'okafor', createdBy: LAB_ME.name, service: 'Retainer', teeth: ['Both arches'], material: 'Essix', returnBy: at(7), stage: 'draft', labMade: true, labSeen: true,
    source: 'manual', createdAt: at(0, 8), attachments: [] }),
  mk({ id: 'SG-L113', patientId: 'P-10188', practice: 'isc', clinician: 'okafor', createdBy: 'Dr Samuel Okafor', service: 'Crown', teeth: ['UR4'], material: 'Monolithic zirconia', shade: 'A2',
    returnBy: at(1), stage: 'shipped', labStatus: 'Shipped', labSeen: true, labShipment: { courier: 'DPD', tracking: 'DPD15501907', services: 'All' },
    events: [...sent(-9), { stage: 'at-lab', at: at(-8, 9), by: LAB_NAME }, { stage: 'production', at: at(-6, 9), by: LAB_NAME }, { stage: 'shipped', at: at(0, 8), by: LAB_NAME, text: 'DPD · DPD15501907' }] }),
  mk({ id: 'SG-L114', patientId: 'P-10077', practice: 'cds', clinician: 'lee', createdBy: 'Dr Hannah Lee', service: 'Night guard', teeth: ['Lower arch'], material: 'Acrylic',
    returnBy: at(-4), stage: 'received', labStatus: 'Delivered', labSeen: true,
    events: [...sent(-16), { stage: 'at-lab', at: at(-15, 9), by: LAB_NAME }, { stage: 'production', at: at(-12, 9), by: LAB_NAME }, { stage: 'shipped', at: at(-5, 9), by: LAB_NAME }, { stage: 'received', at: at(-4, 11), by: 'Reception' }] }),
];

// ─── Which cases belong to which dashboard count ────────────────────────────

export const isClosed = (c: LabCase) => c.labStatus === 'Not Approved' || c.labStatus === 'Cancelled' || c.stage === 'shipped' || c.stage === 'received';
/** Sent by the practice and not yet accepted by the lab. */
export const waitingAccept = (c: LabCase) => !isClosed(c) && !c.onHold && c.stage !== 'draft' && (c.stage === 'dispatched' || c.labStatus === 'Under Review');
/** Accepted and not yet shipped (queued, in production, quality control). */
export const waitingShip = (c: LabCase) => !isClosed(c) && !c.onHold && c.stage !== 'draft' && !waitingAccept(c);
const live = (c: LabCase) => !isClosed(c) && c.stage !== 'draft';

export type LabFilter = 'new' | 'draft' | 'accept' | 'ship' | 'due3' | 'nodate' | 'overdue' | 'hold';
/** Tiles and chips are worded as the lab's next action. Each is what the clinic's last action leads to
 *  (clinic "To dispatch" → lab "Accept cases"; lab ships → clinic "Arriving"; and so on). */
/** Review new cases = status Received (nobody has looked yet). Accept cases = status Under Review (checked, waiting for a decision). */
export const LAB_FILTERS: { id: LabFilter; label: string; short: string }[] = [
  { id: 'new', label: 'Review new cases', short: 'New' },
  { id: 'accept', label: 'Accept cases', short: 'To accept' },
  { id: 'ship', label: 'Ship finished work', short: 'To ship' },
  { id: 'overdue', label: 'Ship overdue work', short: 'Overdue' },
  { id: 'due3', label: 'Due within 3 days', short: 'Due soon' },
  { id: 'nodate', label: 'Set a delivery date', short: 'No date' },
  { id: 'hold', label: 'Resume on-hold cases', short: 'On hold' },
  { id: 'draft', label: 'Finish draft cases', short: 'Drafts' },
];
export const matchesLab = (c: LabCase, f: LabFilter): boolean => {
  switch (f) {
    case 'new': return waitingAccept(c) && statusOf(c) === 'Received';
    case 'draft': return c.stage === 'draft';
    case 'accept': return waitingAccept(c) && statusOf(c) === 'Under Review';
    case 'ship': return waitingShip(c);
    case 'due3': return waitingShip(c) && !!c.returnBy && dayOffset(c.returnBy) >= 0 && dayOffset(c.returnBy) <= 3;
    case 'nodate': return live(c) && !c.returnBy;
    case 'overdue': return waitingShip(c) && !!c.returnBy && dayOffset(c.returnBy) < 0;
    case 'hold': return live(c) && !!c.onHold;
  }
};
export const byDue = (a: LabCase, b: LabCase) => (a.pin ?? 99) - (b.pin ?? 99) || (a.returnBy || '9').localeCompare(b.returnBy || '9');

// ─── Status changes (what the lab can set, and what each one does) ──────────

/** Kept as a hook for display names. The live lab portal uses the same names as the clinic apps. */
export const labLabel = (s: string) => s;
export const isHold = (s: string) => s === 'On Hold (Lab)' || s === 'On Hold (Practice)';

/** The live lab portal's status list, in its order. Shipped goes through "Ship" (courier + tracking). */
export const LAB_STATUS_CHOICES: { status: LabStatus; hint: string }[] = [
  { status: 'Received', hint: 'Case arrived, not looked at yet' },
  { status: 'Under Review', hint: 'Checking the prescription' },
  { status: 'On Hold (Lab)', hint: 'Paused by the lab (materials, equipment)' },
  { status: 'On Hold (Practice)', hint: 'Waiting for the practice to reply' },
  { status: 'Accepted', hint: 'The lab takes the case' },
  { status: 'In Queue', hint: 'Waiting for a technician' },
  { status: 'In Production', hint: 'Being made' },
  { status: 'Quality Control', hint: 'Final checks before sending' },
  { status: 'Delivered', hint: 'The practice has it' },
  { status: 'Not Approved', hint: 'The lab cannot accept this case' },
  { status: 'Cancelled', hint: 'The case will not go ahead' },
];
/** The portal marks these with "Clinic will be notified of this action." The others stay inside the lab. */
export const NOTIFIES_CLINIC = new Set<LabStatus>(['On Hold (Practice)', 'Accepted', 'Shipped', 'Not Approved']);
export const needsReason = (s: LabStatus) => isHold(s) || s === 'Not Approved' || s === 'Cancelled';

/** The portal asks for an override reason when a case with missing required information moves on without waiting for the dentist. */
export const OVERRIDE_REASONS = [
  'Dentist confirmed the missing details verbally',
  'Missing information not required for this case',
  'Urgent case — proceeding now, will follow up',
  'Clinical judgement — enough to begin production',
  'Other (explain in notes)',
];
export const missingInfo = (c: LabCase): string[] => [!c.teeth.length && 'Teeth', !c.attachments.length && 'Scan or photo', !c.instructions.trim() && 'Case instructions'].filter(Boolean) as string[];
const NO_OVERRIDE: LabStatus[] = ['Received', 'Under Review', 'On Hold (Lab)', 'On Hold (Practice)', 'Not Approved', 'Cancelled', 'Delivered'];
export const needsOverride = (c: LabCase, s: LabStatus) => missingInfo(c).length > 0 && !NO_OVERRIDE.includes(s);

/** What the practice sees for this case, from the lab's side. */
export const statusOf = (c: LabCase): LabStatus | 'Draft' | 'Received' =>
  c.stage === 'draft' ? 'Draft' : labStatusOf(c) ?? 'Received';

export function statusPatch(c: LabCase, status: LabStatus, reason = '', override?: string): Partial<LabCase> {
  const now = nowIso();
  const note = { stage: 'note' as const, at: now, by: LAB_NAME, text: `Status changed to ${status}${reason ? ` · ${reason}` : ''}${override ? ` · Override: ${override}` : ''}` };
  const base: Partial<LabCase> = { labStatus: status, onHold: undefined, events: [...c.events, note] };
  const msg = reason && needsReason(status) ? { messages: [...c.messages, { from: 'lab' as const, author: `${LAB_ME.name} · Northstar`, text: reason, at: now }] } : {};
  const stage = (s: LabCase['stage']) => (c.stage === s ? {} : { stage: s, events: [...c.events, { stage: s, at: now, by: LAB_NAME }, note] });
  switch (status) {
    case 'On Hold (Lab)': case 'On Hold (Practice)':
      return { ...base, ...msg, stage: c.stage === 'dispatched' ? 'at-lab' : c.stage, onHold: { side: status === 'On Hold (Lab)' ? 'Lab' : 'Practice', reason, by: LAB_NAME, since: now }, questionOpen: status === 'On Hold (Practice)' ? true : c.questionOpen };
    case 'Not Approved': case 'Cancelled': return { ...base, ...msg };
    case 'Delivered': return { ...base, ...stage('received') };
    case 'In Production': case 'Quality Control': return { ...base, ...stage('production'), questionOpen: false };
    case 'Received': return { ...base, ...stage('dispatched') };
    case 'Under Review': case 'Accepted': case 'In Queue': return { ...base, ...stage('at-lab'), questionOpen: false };
    default: return base;
  }
}

export type ShipDetails = NonNullable<LabCase['labShipment']>;
/** Shipped: every shipping detail is optional, as in the portal's Shipping Details popup. */
export function shipPatch(c: LabCase, d: ShipDetails, override?: string): Partial<LabCase> {
  const now = nowIso();
  const text = [d.courier, d.tracking, d.eta && `arriving ${d.eta}`].filter(Boolean).join(' · ');
  return {
    stage: 'shipped', labStatus: 'Shipped', onHold: undefined,
    labShipment: d,
    events: [...c.events, { stage: 'shipped', at: now, by: LAB_NAME, text: [text, override && `Override: ${override}`].filter(Boolean).join(' · ') || undefined }],
  };
}
