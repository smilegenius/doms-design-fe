import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { allCases } from '../bulk-actions/caseContent';
import { addDays, daysBetween, hash, today } from '../lab-billing/format';

// ── Lab Case Handoff Workflow (V2): the data ─────────────────────────────────
// Spec: "Lab Case Handoff Workflow — Spec (Draft)", 23 Nov 2026, MVP.
// The handoff unit is the SERVICE LINE, not the case: each line has its own
// status, current stage on its service's route, and one owner (or none = in
// the team queue). Handoffs are one tap; the next person is auto-assigned by
// the stage's rule (a default person, the same person continues, or anyone).
// Everything is mock data in this browser (localStorage), Growth only.

export type LineStatus =
  | 'received' | 'under-review' | 'on-hold-lab' | 'on-hold-practice' | 'accepted'
  | 'in-queue' | 'in-production' | 'qc' | 'shipped' | 'delivered' | 'not-approved' | 'cancelled';

/** Lab status → what the clinic sees, and whether the practice is notified (the practice icon). */
export const STATUS: Record<LineStatus, { label: string; clinic: string; notifies?: boolean; tone: 'gray' | 'blue' | 'amber' | 'red' | 'green' | 'purple' }> = {
  received: { label: 'Received', clinic: 'Submitted', tone: 'blue' },
  'under-review': { label: 'Under Review', clinic: 'Submitted', tone: 'blue' },
  'on-hold-lab': { label: 'On Hold (Lab)', clinic: 'Submitted', tone: 'amber' },
  'on-hold-practice': { label: 'On Hold (Practice)', clinic: 'Submitted', notifies: true, tone: 'red' },
  accepted: { label: 'Accepted', clinic: 'Submitted', notifies: true, tone: 'blue' },
  'in-queue': { label: 'In Queue', clinic: 'Submitted', tone: 'gray' },
  'in-production': { label: 'In Production', clinic: 'Submitted', tone: 'purple' },
  qc: { label: 'Quality Control', clinic: 'Submitted', tone: 'purple' },
  shipped: { label: 'Shipped', clinic: 'Shipped', notifies: true, tone: 'green' },
  delivered: { label: 'Delivered', clinic: 'Received', tone: 'green' },
  'not-approved': { label: 'Not Approved', clinic: 'Cancelled', notifies: true, tone: 'gray' },
  cancelled: { label: 'Cancelled', clinic: 'Cancelled', tone: 'gray' },
};
export const OPEN: LineStatus[] = ['received', 'under-review', 'on-hold-lab', 'on-hold-practice', 'accepted', 'in-queue', 'in-production', 'qc'];
export const IN_LAB: LineStatus[] = ['in-queue', 'in-production', 'qc'];
export const isOpen = (l: Line) => OPEN.includes(l.status);
export const isHidden = (l: Line) => l.status === 'not-approved' || l.status === 'cancelled';

export type Assign = { mode: 'person'; person: string } | { mode: 'same' } | { mode: 'anyone' };
export interface Stage { id: string; name: string; assign: Assign; qc?: boolean }
export interface Route { key: string; name: string; stages: Stage[] }

export interface Line {
  id: string; caseId: string; siId: string; service: string; patient: string; practice: string; dentist: string;
  status: LineStatus;
  /** Index into its route's stages (the last stage is Quality Control). */
  stage: number;
  route: string;
  owner: string | null;
  /** When it entered the current stage / status (ISO date). */
  since: string;
  /** Requested delivery date (ISO) or null = No date set. */
  requested: string | null;
  hold?: { kind: 'lab' | 'practice'; reason: string; since: string; back: { status: LineStatus; owner: string | null } };
  qcPassed?: boolean;
  skipped: string[];
  reworks: number;
  receivedAt: string; acceptedAt?: string; firstProdAt?: string; shippedAt?: string; deliveredAt?: string;
  invoiced?: boolean;
}

export interface Note {
  id: string; caseId: string;
  /** Lines it is about; empty = the whole case. */
  lineIds: string[];
  kind: 'internal' | 'dentist';
  text: string; by: string; at: string;
  /** Pinned to a stage by name ("for Ceramics"): acknowledged when a line reaches it. */
  stage?: string;
  readBy: string[];
  /** A dentist reply that changes the prescription: unread for whoever holds the line. */
  fromDentist?: boolean;
}

export interface WEvent { id: string; caseId: string; lineId?: string; at: string; by: string; kind: 'accept' | 'handoff' | 'pickup' | 'takeover' | 'ack' | 'hold' | 'release' | 'send-back' | 'skip' | 'note' | 'ship' | 'deliver' | 'assign' | 'status' | 'date'; text: string }

export interface Staff { name: string; role: string; team: string; pin: string }
export interface WorkflowSettings {
  /** Note acknowledgement (Simply C&B's tick-box): the new owner ticks unread notes before changing status. */
  ackRequired: boolean;
  /** Shared bench tablets: pick your name + a 4-digit PIN. */
  pinOn: boolean;
  intakeOwner: string;
  /** Internal due date = requested delivery minus this many days. */
  bufferDays: number;
  shipPartial: boolean;
  notify: Record<string, { inApp: boolean; email: boolean }>;
  /** Premium: routes, queues and the calendar. Free labs keep Received → Accepted → Shipped. */
  enabled: boolean;
}

export interface WorkflowState {
  version: number;
  settings: WorkflowSettings;
  routes: Route[];
  /** Service name → route key (each service has its own route). */
  serviceRoute: Record<string, string>;
  lines: Record<string, Line>;
  notes: Note[];
  events: WEvent[];
  /** Demo: who the queue and bench are looking as. */
  viewAs: string;
}

export const STAFF: Staff[] = [
  { name: 'Sajid Mahmood', role: 'Admin · intake', team: 'Office', pin: '1234' },
  { name: 'Alan Brooks', role: 'CAD designer', team: 'Digital (upstairs)', pin: '1111' },
  { name: 'Priya Nair', role: 'Milling & printing', team: 'Digital (upstairs)', pin: '2222' },
  { name: 'Tom Hughes', role: 'Ceramist', team: 'Ceramics (downstairs)', pin: '3333' },
  { name: 'Maria Lopez', role: 'Quality control', team: 'Ceramics (downstairs)', pin: '4444' },
  { name: 'Dev Patel', role: 'Dispatch', team: 'Dispatch', pin: '5555' },
];

const P = (person: string): Assign => ({ mode: 'person', person });
const st = (id: string, name: string, assign: Assign, qc = false): Stage => ({ id, name, assign, ...(qc ? { qc } : {}) });
export const DEFAULT_ROUTES: Route[] = [
  { key: 'crown', name: 'Crown & bridge', stages: [st('model', 'Model', P('Priya Nair')), st('design', 'Design', P('Alan Brooks')), st('mill', 'Mill', P('Priya Nair')), st('sinter', 'Sinter', { mode: 'same' }), st('ceramics', 'Ceramics', P('Tom Hughes')), st('qc', 'Quality Control', P('Maria Lopez'), true)] },
  { key: 'implant', name: 'Implants', stages: [st('design', 'Design', P('Alan Brooks')), st('mill', 'Mill', P('Priya Nair')), st('finishing', 'Finishing', P('Tom Hughes')), st('qc', 'Quality Control', P('Maria Lopez'), true)] },
  { key: 'denture', name: 'Dentures', stages: [st('model', 'Model', P('Tom Hughes')), st('setup', 'Set-up', { mode: 'same' }), st('finishing', 'Finishing', { mode: 'same' }), st('qc', 'Quality Control', P('Maria Lopez'), true)] },
  { key: 'ortho', name: 'Ortho & appliances', stages: [st('design', 'Design', P('Alan Brooks')), st('print', 'Print', P('Priya Nair')), st('finishing', 'Finishing', { mode: 'anyone' }), st('qc', 'Quality Control', P('Maria Lopez'), true)] },
  { key: 'simple', name: 'Everything else', stages: [st('design', 'Design', { mode: 'anyone' }), st('production', 'Production', { mode: 'anyone' }), st('qc', 'Quality Control', P('Maria Lopez'), true)] },
];
/** Every service gets a simple default route by what it is; the lab can change it per service. */
export function defaultRouteFor(service: string): string {
  const s = service.toLowerCase();
  if (/implant|abutment|screw/.test(s)) return 'implant';
  if (/denture|partial|full arch|obturator/.test(s)) return 'denture';
  if (/align|retain|guard|splint|ortho|tray|appliance|whiten/.test(s)) return 'ortho';
  if (/crown|bridge|veneer|inlay|onlay|post|core|emax|zirconia/.test(s)) return 'crown';
  return 'simple';
}

const KEY = 'salesFeedbacks.workflow.v1';
const VERSION = 4;
const listeners = new Set<() => void>();
let state: WorkflowState | null = null;

function load(): WorkflowState {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as WorkflowState; if (s.version === VERSION) return s; } } catch { /* reseed */ }
  const s = seed(); save(s); return s;
}
function save(s: WorkflowState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* memory only */ } }
export function getWorkflow(): WorkflowState { if (!state) state = load(); return state; }
function commit(next: WorkflowState) { state = next; save(next); listeners.forEach(l => l()); }
export function useWorkflow(): WorkflowState { return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, getWorkflow); }
function update<T>(fn: (s: WorkflowState) => T): T { const s = structuredClone(getWorkflow()); const out = fn(s); commit(s); return out; }
let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

export const routeOf = (s: WorkflowState, l: Line) => s.routes.find(r => r.key === l.route) ?? s.routes[s.routes.length - 1];
export const stageOf = (s: WorkflowState, l: Line): Stage | undefined => IN_LAB.includes(l.status) || l.status === 'on-hold-lab' ? routeOf(s, l).stages[l.stage] : undefined;
/** "In Production · Design" — the stage is a label on In Queue / In Production, not a status. */
export function statusText(s: WorkflowState, l: Line) {
  const stg = stageOf(s, l);
  if (l.status === 'qc' && l.qcPassed) return 'Passed QC · ready to ship';
  return stg && l.status !== 'qc' ? `${STATUS[l.status].label} · ${stg.name}` : STATUS[l.status].label;
}
/** Internal due date: requested delivery minus the lab's buffer. */
export const dueOf = (s: WorkflowState, l: Line) => (l.requested ? addDays(l.requested, -s.settings.bufferDays) : null);
export const isOverdue = (s: WorkflowState, l: Line, t = today()) => isOpen(l) && !!l.requested && dueOf(s, l)! < t;
export const daysIn = (l: Line, t = today()) => Math.max(0, daysBetween(l.since, t));
export const caseLines = (s: WorkflowState, caseId: string) => Object.values(s.lines).filter(l => l.caseId === caseId).sort((a, b) => a.siId.localeCompare(b.siId));

/** Notes this person hasn't read that apply to a line now (pinned ones only once it reaches that stage). */
export function unreadFor(s: WorkflowState, l: Line, person: string | null): Note[] {
  if (!person) return [];
  const stg = stageOf(s, l)?.name;
  return s.notes.filter(n => n.caseId === l.caseId && (!n.lineIds.length || n.lineIds.includes(l.id)) && n.by !== person && !n.readBy.includes(person) && (!n.stage || n.stage === stg));
}
/** With acknowledgement on, the owner ticks unread notes before changing the line's status. */
export const needsAck = (s: WorkflowState, l: Line) => s.settings.ackRequired && !!l.owner && unreadFor(s, l, l.owner).length > 0;

/** Who gets a line arriving at stage i, by the stage's rule. */
function assignee(s: WorkflowState, l: Line, i: number, from: string | null): string | null {
  const a = routeOf(s, l).stages[i]?.assign;
  if (!a) return null;
  if (a.mode === 'person') return a.person;
  if (a.mode === 'same') return from;
  return null;
}
function log(s: WorkflowState, l: { caseId: string; id?: string }, by: string, kind: WEvent['kind'], text: string) {
  s.events.unshift({ id: uid('ev'), caseId: l.caseId, lineId: l.id, at: new Date().toISOString(), by, kind, text });
}
function moveTo(s: WorkflowState, l: Line, i: number, by: string, from: string | null, verb: string) {
  const route = routeOf(s, l);
  // Skipped stages are passed over.
  while (i < route.stages.length - 1 && l.skipped.includes(route.stages[i].id)) i++;
  l.stage = i; l.qcPassed = false;
  const who = assignee(s, l, i, from);
  l.owner = who;
  const qc = route.stages[i].qc;
  l.status = qc ? 'qc' : who ? 'in-production' : 'in-queue';
  l.since = today();
  if (l.status === 'in-production' && !l.firstProdAt) l.firstProdAt = today();
  log(s, l, by, 'handoff', `${l.service}: ${verb} ${route.stages[i].name}${who ? `, assigned to ${who}` : ', waiting in the team queue'}`);
}

// ── Actions (the spec's "How a handoff works") ───────────────────────────────

/** 1. Accept: every service line enters the first stage of its route (the practice is notified). */
export function acceptCase(caseId: string, by: string) {
  return update(s => {
    let n = 0;
    for (const l of caseLines(s, caseId).filter(x => x.status === 'received' || x.status === 'under-review')) {
      l.acceptedAt = today();
      moveTo(s, l, 0, by, null, 'accepted into'); n++;
    }
    if (n) log(s, { caseId }, by, 'accept', 'Case accepted: practice notified');
    return n;
  });
}
export function reviewCase(caseId: string, by: string) {
  update(s => { for (const l of caseLines(s, caseId).filter(x => x.status === 'received')) { l.status = 'under-review'; l.owner = s.settings.intakeOwner; l.since = today(); } log(s, { caseId }, by, 'status', 'Under review: checking the prescription and case score'); });
}
export function declineCase(caseId: string, by: string, reason: string) {
  update(s => { for (const l of caseLines(s, caseId).filter(isOpen)) { l.status = 'not-approved'; l.owner = null; l.since = today(); } log(s, { caseId }, by, 'status', `Not approved: ${reason}. Practice notified`); });
}

/** 2. Pick up a line from the queue (or take it over from someone else, logged). */
export function pickUp(lineId: string, person: string) {
  update(s => {
    const l = s.lines[lineId]; if (!l) return;
    if (l.owner && l.owner !== person) log(s, l, person, 'takeover', `${l.service}: taken over from ${l.owner}`);
    else log(s, l, person, 'pickup', `${l.service}: picked up at ${stageOf(s, l)?.name ?? STATUS[l.status].label}`);
    l.owner = person;
    if (l.status === 'in-queue') { l.status = 'in-production'; if (!l.firstProdAt) l.firstProdAt = today(); }
    l.since = today();
  });
}

/** 3. Done → next stage, one tap (several lines at once = bulk). QC done = passed, ready for dispatch. */
export function doneNext(lineIds: string[], by: string, note?: string) {
  return update(s => {
    let n = 0;
    for (const id of lineIds) {
      const l = s.lines[id]; if (!l || !IN_LAB.includes(l.status) || l.qcPassed) continue;
      if (s.settings.ackRequired && l.owner && unreadFor(s, l, l.owner).length) continue;
      const route = routeOf(s, l);
      if (note?.trim()) s.notes.unshift({ id: uid('nt'), caseId: l.caseId, lineIds: [l.id], kind: 'internal', text: note.trim(), by, at: new Date().toISOString(), readBy: [by] });
      if (route.stages[l.stage].qc) {
        l.qcPassed = true; l.owner = null; l.since = today();
        log(s, l, by, 'handoff', `${l.service}: passed Quality Control, ready for dispatch`);
      } else moveTo(s, l, l.stage + 1, by, l.owner, `${route.stages[l.stage].name} done →`);
      n++;
    }
    return n;
  });
}

/** Skip a stage that isn't needed (e.g. no model). Logged, no reason. */
export function skipStage(lineId: string, by: string) {
  update(s => {
    const l = s.lines[lineId]; if (!l) return;
    const route = routeOf(s, l); const cur = route.stages[l.stage];
    if (cur.qc) return;
    l.skipped.push(cur.id);
    log(s, l, by, 'skip', `${l.service}: skipped ${cur.name}`);
    moveTo(s, l, l.stage + 1, by, l.owner, 'moved on to');
  });
}

/** Hold: On Hold (Lab) for internal blockers; On Hold (Practice) notifies the practice and can trigger the chase. */
export function holdLine(lineIds: string[], kind: 'lab' | 'practice', reason: string, by: string) {
  update(s => {
    for (const id of lineIds) {
      const l = s.lines[id]; if (!l || !isOpen(l) || l.hold) continue;
      l.hold = { kind, reason, since: today(), back: { status: l.status, owner: l.owner } };
      l.status = kind === 'lab' ? 'on-hold-lab' : 'on-hold-practice';
      l.since = today();
      log(s, l, by, 'hold', `${l.service}: ${STATUS[l.status].label}: ${reason}${kind === 'practice' ? '. Practice notified' : ''}`);
    }
  });
}
/** Releasing a hold returns the line to where it was. */
export function releaseHold(lineId: string, by: string) {
  update(s => {
    const l = s.lines[lineId]; if (!l?.hold) return;
    l.status = l.hold.back.status; l.owner = l.hold.back.owner; l.since = today();
    log(s, l, by, 'release', `${l.service}: hold released (${l.hold.reason}), back to ${statusText(s, l)}`);
    delete l.hold;
  });
}

/** Send back to an earlier stage, with a reason. Reassigned by the same rules; logged as rework. */
export function sendBack(lineId: string, toStage: number, reason: string, by: string) {
  update(s => {
    const l = s.lines[lineId]; if (!l) return;
    l.reworks++;
    l.skipped = l.skipped.filter(id => id !== routeOf(s, l).stages[toStage]?.id);
    s.notes.unshift({ id: uid('nt'), caseId: l.caseId, lineIds: [l.id], kind: 'internal', text: `Sent back: ${reason}`, by, at: new Date().toISOString(), stage: routeOf(s, l).stages[toStage]?.name, readBy: [by] });
    log(s, l, by, 'send-back', `${l.service}: sent back to ${routeOf(s, l).stages[toStage]?.name} (rework): ${reason}`);
    moveTo(s, l, toStage, by, null, 'reworked at');
  });
}

export function reassign(lineId: string, person: string | null, by: string) {
  update(s => {
    const l = s.lines[lineId]; if (!l) return;
    l.owner = person;
    if (l.status === 'in-queue' && person) l.status = 'in-production';
    if (l.status === 'in-production' && !person) l.status = 'in-queue';
    log(s, l, by, 'assign', `${l.service}: ${person ? `assigned to ${person}` : 'back to the team queue'}`);
  });
}

/** Dispatch scans the tray QR: Shipped (clinic sees Shipped, practice notified). */
export function markShipped(lineIds: string[], by: string) {
  return update(s => {
    let n = 0;
    for (const id of lineIds) { const l = s.lines[id]; if (!l || l.status !== 'qc' || !l.qcPassed) continue; l.status = 'shipped'; l.owner = null; l.shippedAt = today(); l.since = today(); log(s, l, by, 'ship', `${l.service}: shipped. Practice notified`); n++; }
    return n;
  });
}
/** The clinic marks it received: Delivered, the invoice trigger (one invoice per service line). */
export function markDelivered(lineIds: string[], by: string) {
  return update(s => {
    const done: Line[] = [];
    for (const id of lineIds) { const l = s.lines[id]; if (!l || l.status !== 'shipped') continue; l.status = 'delivered'; l.deliveredAt = today(); l.since = today(); log(s, l, by, 'deliver', `${l.service}: the clinic marked it received. Delivered`); done.push(l); }
    return done.map(l => ({ caseId: l.caseId, siId: l.siId, lineId: l.id }));
  });
}
export function markInvoiced(lineId: string, number: string | null) {
  update(s => { const l = s.lines[lineId]; if (!l) return; l.invoiced = true; log(s, l, 'Billing', 'status', `${l.service}: invoice ${number ?? 'drafted'} for this line`); });
}

export function addNote(caseId: string, lineIds: string[], kind: 'internal' | 'dentist', text: string, by: string, stage?: string) {
  update(s => {
    s.notes.unshift({ id: uid('nt'), caseId, lineIds, kind, text: text.trim(), by, at: new Date().toISOString(), stage: stage || undefined, readBy: [by] });
    log(s, { caseId }, by, 'note', `${kind === 'internal' ? 'Internal note' : 'Comment to the dentist'}${stage ? ` for ${stage}` : ''}: ${text.trim()}`);
  });
}
/** Tick notes as read (the acknowledgement). */
export function ackNotes(noteIds: string[], person: string, lineId?: string) {
  update(s => {
    for (const n of s.notes.filter(x => noteIds.includes(x.id))) if (!n.readBy.includes(person)) n.readBy.push(person);
    if (noteIds.length) log(s, lineId ? s.lines[lineId] ?? { caseId: s.notes.find(n => n.id === noteIds[0])!.caseId } : { caseId: s.notes.find(n => n.id === noteIds[0])!.caseId }, person, 'ack', `${person} read ${noteIds.length} note${noteIds.length === 1 ? '' : 's'}`);
  });
}
export function setRequested(lineIds: string[], date: string | null, by: string) {
  update(s => { for (const id of lineIds) { const l = s.lines[id]; if (!l) continue; l.requested = date; log(s, l, by, 'date', `${l.service}: requested delivery ${date ?? 'cleared'}`); } });
}

// ── Settings (admin only) ─────────────────────────────────────────────────────

export function updateSettings(patch: Partial<WorkflowSettings>) { update(s => { Object.assign(s.settings, patch); }); }
/**
 * Route edits apply forward: a line keeps the stages it has done and follows
 * the new route at its next handoff. A line in a removed stage finishes it
 * (it keeps its place by stage id), then moves on along the new route.
 */
export function saveRoute(route: Route) {
  update(s => {
    const old = s.routes.find(r => r.key === route.key);
    s.routes = s.routes.map(r => (r.key === route.key ? route : r));
    if (!old) s.routes.push(route);
    for (const l of Object.values(s.lines).filter(x => x.route === route.key && IN_LAB.includes(x.status))) {
      const curId = old?.stages[l.stage]?.id;
      const idx = route.stages.findIndex(x => x.id === curId);
      if (idx >= 0) l.stage = idx;
      else {
        // Its stage was removed: it finishes there and moves to the next stage still on the route.
        const after = old ? old.stages.slice(l.stage + 1).map(x => route.stages.findIndex(y => y.id === x.id)).find(i => i >= 0) : undefined;
        l.stage = Math.max(0, (after ?? route.stages.length - 1) - 1);
      }
    }
  });
}
export function setServiceRoute(service: string, key: string) { update(s => { s.serviceRoute[service] = key; }); }
export function setViewAs(name: string) { update(s => { s.viewAs = name; }); }
export function resetWorkflowDemo() { commit(seed()); }

// ── Demo seed: lines for every case in the list, at believable places ────────

const STATUS_MAP: Record<string, LineStatus> = {
  new: 'received', submitted: 'received', 'sent-for-review': 'under-review', 'ready-for-dispatch': 'received',
  'in-production': 'in-production', refinement: 'in-production', 'quality-check': 'qc', 'on-hold': 'on-hold-lab',
  shipped: 'shipped', delivered: 'delivered', completed: 'delivered',
};

export function seed(): WorkflowState {
  const t = today();
  const s: WorkflowState = {
    version: VERSION,
    settings: { ackRequired: true, pinOn: true, intakeOwner: 'Sajid Mahmood', bufferDays: 1, shipPartial: false, enabled: true, notify: Object.fromEntries(STAFF.map(p => [p.name, { inApp: true, email: p.team !== 'Dispatch' }])) },
    routes: structuredClone(DEFAULT_ROUTES), serviceRoute: {}, lines: {}, notes: [], events: [], viewAs: 'Sajid Mahmood',
  };
  const cases: Case[] = allCases().filter(c => c.status !== 'draft' && !c.archived);
  for (const c of cases) {
    const h = hash(c.id);
    (c.serviceItems ?? []).forEach((si, k) => {
      const hk = hash(`${c.id}:${k}`);
      if (!(si.name in s.serviceRoute)) s.serviceRoute[si.name] = defaultRouteFor(si.name);
      const route = s.routes.find(r => r.key === s.serviceRoute[si.name])!;
      let status: LineStatus = STATUS_MAP[c.status] ?? 'received';
      // Mixed cases: a second line is often a stage or two behind the first.
      let stage = 0;
      if (status === 'in-production') stage = (hk % (route.stages.length - 1));
      if (status === 'qc') stage = route.stages.length - 1;
      if (status === 'in-production' && k > 0 && hk % 3 === 0) status = 'in-queue';
      // Dates are the demo's own, around today, so the queue and calendar have something to show.
      const open = OPEN.includes(status);
      const fresh = status === 'received' || status === 'under-review';
      const requested = hk % 9 === 0 ? null : addDays(t, fresh ? (hk % 12) + 3 : open ? (hk % 15) - 2 : -((hk % 20) + 2));
      const received = addDays(t, -((h % 12) + 4));
      const l: Line = {
        id: `${c.id}:${si.id}`, caseId: c.id, siId: si.id, service: si.name, patient: c.patientName, practice: c.practice, dentist: c.dentist,
        status, stage, route: route.key, owner: null, since: addDays(t, -(hk % 4)), requested, skipped: [], reworks: 0, receivedAt: received,
      };
      if (status === 'received' || status === 'under-review') l.owner = s.settings.intakeOwner;
      if (status === 'in-production' || status === 'qc') {
        const a = route.stages[stage].assign;
        l.owner = a.mode === 'person' ? a.person : hk % 2 ? 'Alan Brooks' : 'Tom Hughes';
        l.acceptedAt = addDays(received, 1); l.firstProdAt = addDays(received, 2);
        if (status === 'qc' && hk % 4 === 0) { l.qcPassed = true; l.owner = null; }
      }
      if (status === 'in-queue') { l.acceptedAt = addDays(received, 1); }
      if (status === 'on-hold-lab') { const back = route.stages[Math.min(1, route.stages.length - 2)]; l.stage = route.stages.indexOf(back); l.hold = { kind: 'lab', reason: hk % 2 ? 'Machine down: mill 2' : 'Waiting on material (zirconia disc)', since: addDays(t, -(hk % 5) - 1), back: { status: 'in-production', owner: 'Priya Nair' } }; l.owner = 'Priya Nair'; l.acceptedAt = addDays(received, 1); }
      if (status === 'shipped' || status === 'delivered') { l.acceptedAt = addDays(received, 1); l.firstProdAt = addDays(received, 2); l.shippedAt = addDays(t, -((hk % 9) + 1)); if (status === 'delivered') { l.deliveredAt = addDays(l.shippedAt, 2); l.invoiced = true; } }
      s.lines[l.id] = l;
    });
  }
  const all = Object.values(s.lines);
  // A practice hold (waiting on the dentist), and a not-approved and a cancelled line for the banners.
  const recv = all.filter(l => l.status === 'received');
  if (recv[0]) { recv[0].hold = { kind: 'practice', reason: 'Waiting on bite scan', since: addDays(t, -3), back: { status: 'received', owner: recv[0].owner } }; recv[0].status = 'on-hold-practice'; }
  if (recv[1]) recv[1].status = 'not-approved';
  const shipped = all.filter(l => l.status === 'shipped');
  if (shipped[0]) shipped[0].status = 'cancelled';
  // Sajid has some production work too, so "My queue" isn't empty for the admin.
  all.filter(l => l.status === 'in-production').slice(0, 3).forEach(l => { l.owner = 'Sajid Mahmood'; });
  all.filter(l => l.status === 'in-queue').slice(0, 2).forEach(l => { l.requested = addDays(t, 1); });
  // Notes: an internal note pinned to Ceramics, a dentist reply that changes the shade, a note for the whole case.
  const prod = all.filter(l => l.status === 'in-production' && l.route === 'crown');
  const pick = prod.find(l => l.owner === 'Sajid Mahmood') ?? prod[0];
  if (pick) {
    s.notes.push({ id: 'nt-seed-1', caseId: pick.caseId, lineIds: [pick.id], kind: 'internal', text: 'Patient has a high smile line: keep the margin supragingival on the buccal.', by: 'Alan Brooks', at: `${addDays(t, -1)}T09:12:00`, readBy: ['Alan Brooks'] });
    s.notes.push({ id: 'nt-seed-2', caseId: pick.caseId, lineIds: [], kind: 'dentist', text: 'Dentist reply: please change the shade to A2 (was A3).', by: pick.dentist, at: `${t}T08:40:00`, readBy: [], fromDentist: true });
    s.notes.push({ id: 'nt-seed-3', caseId: pick.caseId, lineIds: [pick.id], kind: 'internal', text: 'Characterise the incisal third; photos attached on the case.', by: 'Sajid Mahmood', at: `${addDays(t, -2)}T15:30:00`, stage: 'Ceramics', readBy: ['Sajid Mahmood'] });
  }
  const multi = Object.values(s.lines).filter(l => caseLines(s, l.caseId).length > 1 && l.status === 'in-production');
  if (multi[0]) s.notes.push({ id: 'nt-seed-4', caseId: multi[0].caseId, lineIds: [], kind: 'internal', text: 'Two services on this case: ship together unless the practice asks for the crown first.', by: 'Sajid Mahmood', at: `${addDays(t, -3)}T11:00:00`, readBy: ['Sajid Mahmood'] });
  for (const l of Object.values(s.lines)) if (l.acceptedAt) s.events.push({ id: `ev-${l.id}`, caseId: l.caseId, lineId: l.id, at: `${l.acceptedAt}T09:00:00`, by: 'Sajid Mahmood', kind: 'accept', text: `${l.service}: accepted into ${routeOf(s, l).stages[0].name}` });
  return s;
}

export { today, daysBetween, addDays };
