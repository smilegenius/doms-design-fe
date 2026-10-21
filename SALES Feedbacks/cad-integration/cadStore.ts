import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { MOCK_NOTIFICATIONS } from '../../src/app/pages/NotificationsPage';
import { detectProvider, type DesignFile } from '../design-studio/data/designStudio';
import { ensureStudioCase, getStudio, shareDesign } from '../design-studio/store/studioStore';
import { applyDesignToBilling, getBilling } from '../lab-billing/billingStore';
import type { ApprovalRound, CadEvent, CadOrder, CadSettings, CadSoftware, CadState, Connector, DesignedLine, DesignStatus, Partner, PartnerJob } from './types';
import {
  cadCases, cadFor, caseOf, designDiff, dueIso, hoursSince, initials, isCadCase, needsApproval, orderLines, scansFor, STATUS_LABEL, techFor,
} from './engine';
import { CAD_VERSION, seedCad } from './seed';

// ── CAD integration store ────────────────────────────────────────────────────
// localStorage (Growth Team Feedback only), with a storage listener so the
// partner's upload page in another tab and the lab stay in step.

const KEY = 'salesFeedbacks.cad.v1';
const listeners = new Set<() => void>();
let state: CadState | null = null;

function load(): CadState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as CadState; if (s.version === CAD_VERSION) return s; }
  } catch { /* reseed */ }
  const s = seedCad();
  save(s);
  return s;
}
function save(s: CadState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* keep in memory */ } }
export function getCad(): CadState { if (!state) state = load(); return state; }
function commit(next: CadState) { state = next; save(next); listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === KEY) { state = null; listeners.forEach(l => l()); } });
}
export function useCad(): CadState { return useSyncExternalStore(subscribe, getCad); }

function update<T>(fn: (s: CadState) => T): T {
  const s = structuredClone(getCad());
  const out = fn(s);
  commit(s);
  return out;
}

const now = () => new Date().toISOString();
const me = () => 'Sajid Mahmood';

export function event(s: CadState, title: string, body: string, caseId?: string) {
  s.events.unshift({ id: `cad-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: now(), title, body, caseId });
  if (s.events.length > 80) s.events.length = 80;
}

export function setStatus(o: CadOrder, status: DesignStatus, by: string) {
  if (o.status === status) return;
  o.status = status;
  o.history.push({ at: now(), status, by });
}

/** The connector that writes this CAD's orders (null if none is set up). */
export const connectorFor = (s: CadState, cad: CadSoftware) => s.connectors.find(c => c.cad === cad) ?? null;

/** Build a CAD order from a case (order mapping) and hand it to the connector. */
export function buildOrder(s: CadState, c: Case, opts: { cad?: CadSoftware | 'partner'; by?: string } = {}): CadOrder {
  const cad = opts.cad ?? cadFor(s.settings, c) ?? 'partner';
  const lines = orderLines(s.settings, c, cad);
  const scans = scansFor(c);
  const due = dueIso(c);
  const fallbackDue = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const tech = cad === 'partner' ? null : techFor(s, c);
  if (s.settings.assign === 'round-robin' && tech) s.rr++;
  const o: CadOrder = {
    caseId: c.id, cad, ref: c.id,
    patientSent: s.settings.patientDetails === 'initials' ? `${initials(c.patientName)} · ${c.id}` : c.patientName,
    client: `${c.practice} · ${c.dentist}`,
    dueDate: due && due >= fallbackDue.slice(0, 10) ? due : fallbackDue,
    shade: c.serviceItems?.[0]?.shade ?? null,
    lines, scans,
    implant: lines.some(l => l.itemId === 'abt' || l.itemId === 'src') ? { system: 'Straumann BLX', platform: 'RB' } : undefined,
    instructions: c.serviceItems?.map(si => si.instructions).filter(Boolean).join(' ') || undefined,
    notes: [], technician: tech,
    status: scans.some(x => x.kind !== 'photo') ? 'order-created' : 'waiting-scans',
    history: [{ at: now(), status: 'order-created', by: opts.by ?? 'Connector' }],
    createdAt: now(), connectorId: null,
    approvalNeeded: needsApproval(s.settings, lines),
    rounds: [],
  };
  if (o.status === 'waiting-scans') o.history.push({ at: now(), status: 'waiting-scans', by: 'Smile Genius' });
  if (cad !== 'partner') {
    const con = connectorFor(s, cad);
    o.connectorId = con?.id ?? null;
    // 3Shape scans already sit in 3Shape's own inbox: link to that order instead of creating a second.
    if (cad === '3shape' && c.scanner === '3Shape' && c.source === 'scanner') o.linkedFromInbox = `TRIOS-${c.scannerCaseRef ?? c.id.slice(-4)}`;
    if (!con || con.status !== 'online') { o.queued = true; if (con && !con.queue.includes(c.id)) con.queue.push(c.id); }
  }
  s.orders[c.id] = o;
  return o;
}

/**
 * Keep CAD in step: orders for newly accepted cases, the dentist's decisions
 * from Design Studio, reminders, partner turnaround and connector health.
 */
export function syncCad() {
  const s0 = getCad();
  const studio = getStudio();
  let changed = false;
  const s = structuredClone(s0);
  // New accepted digital cases → CAD orders (when set to create on accept).
  for (const c of cadCases()) {
    if (s.seen.includes(c.id)) continue;
    s.seen.push(c.id); changed = true;
    if (s.settings.createOn !== 'accepted' || s.settings.cad === 'none' || s.orders[c.id] || !isCadCase(c)) continue;
    if (['new', 'in-production', 'submitted'].includes(c.status)) { buildOrder(s, c); event(s, `CAD order created for ${c.id}`, `${c.patientName} · ${c.services.join(', ')}`, c.id); }
  }
  for (const o of Object.values(s.orders)) {
    const r = o.rounds[o.rounds.length - 1];
    if (o.status === 'awaiting-dentist' && r && !r.decision) {
      const v = Object.values(studio.cases).flatMap(x => x.versions).find(x => x.id === r.versionId);
      if (v?.decision) {
        changed = true;
        r.decision = v.decision; r.decidedAt = v.reviewedAt; r.by = v.reviewedBy; r.versionHash = v.signOff?.versionHash;
        if (v.decision === 'approved') {
          setStatus(o, 'ready', v.reviewedBy ?? 'Dentist');
          event(s, `${v.reviewedBy ?? 'The dentist'} approved the design for ${o.caseId}`, `Round ${o.rounds.length} · ready to manufacture`, o.caseId);
        } else {
          r.comments = [v.decisionNote, ...v.captures.map(cp => `${cp.teeth.length ? `[${cp.teeth.join(', ')}] ` : ''}${cp.comment}`)].filter(Boolean) as string[];
          o.notes.push(`Changes requested (round ${o.rounds.length}, ${v.reviewedBy ?? 'dentist'}): ${r.comments.join(' · ') || 'see Design Studio'}`);
          setStatus(o, 'in-design', v.reviewedBy ?? 'Dentist');
          if (o.rounds.filter(x => x.decision === 'changes-requested').length >= 2) o.callDentist = true;
          event(s, `${v.reviewedBy ?? 'The dentist'} requested changes on ${o.caseId}`, `${r.comments.length} comment${r.comments.length === 1 ? '' : 's'} added to the CAD order notes`, o.caseId);
        }
      }
    }
    // Reminder once at the set time, then alert the lab.
    if (o.status === 'awaiting-dentist' && r && !r.decision) {
      const h = hoursSince(r.sentAt);
      if (h >= s.settings.reminderHours && !o.reminderSentAt) { o.reminderSentAt = now(); changed = true; event(s, `Reminder sent to the dentist for ${o.caseId}`, `No reply after ${Math.round(h)} hours`, o.caseId); }
      if (h >= s.settings.reminderHours * 2 && !o.labAlertedAt) { o.labAlertedAt = now(); changed = true; event(s, `${o.caseId} still waiting for the dentist`, `${Math.round(h)} hours since the design was sent; call the practice`, o.caseId); }
    }
  }
  for (const j of s.jobs) {
    const late = Date.now() - new Date(j.dueAt).getTime() > s.settings.partnerOverdueDays * 86_400_000;
    if (late && ['sent', 'downloaded'].includes(j.status) && !j.overdueAlertedAt) {
      j.overdueAlertedAt = now(); j.remindedAt = now(); changed = true;
      const p = s.partners.find(x => x.id === j.partnerId);
      event(s, `${p?.name ?? 'Partner'} is late on ${j.caseId}`, 'Past their usual turnaround; they were reminded through their link', j.caseId);
    }
  }
  for (const con of s.connectors) {
    if (con.status === 'offline' && hoursSince(con.lastSeen) >= 2 && !s.events.some(e => e.id.startsWith(`cad-off-${con.id}`))) {
      changed = true;
      s.events.unshift({ id: `cad-off-${con.id}-${con.lastSeen}`, at: now(), title: `${con.pc} connector offline`, body: `Not seen for ${Math.round(hoursSince(con.lastSeen))} hours; ${con.queue.length} order${con.queue.length === 1 ? '' : 's'} waiting` });
    }
  }
  if (changed) commit(s);
  // Designs recorded before Billing knew about them (e.g. the demo) price the invoice draft.
  const billing = getBilling();
  for (const o of Object.values(getCad().orders)) {
    if (o.design?.lines.length && !billing.cases[o.caseId]?.designOverride && o.design.diff.length) applyDesignToBilling(o.caseId, o.design.lines, o.design.diff);
  }
}

/** Mirror CAD events into the bell (MOCK_NOTIFICATIONS, `cad-` ids). */
export function syncCadNotifications() {
  for (const e of [...getCad().events].reverse()) {
    if (MOCK_NOTIFICATIONS.some(n => n.id === e.id)) continue;
    MOCK_NOTIFICATIONS.unshift({ id: e.id, title: e.title, body: e.body, timestamp: new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), read: false } as (typeof MOCK_NOTIFICATIONS)[number]);
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function resetCadDemo() { commit(seedCad()); }

export function createOrder(caseId: string, cad?: CadSoftware) {
  const c = caseOf(caseId); if (!c) return;
  update(s => { buildOrder(s, c, { cad, by: me() }); event(s, `CAD order created for ${caseId}`, 'Created by hand from the case', caseId); });
}

export function moveTo(caseId: string, status: DesignStatus, by = me()) {
  update(s => { const o = s.orders[caseId]; if (o) setStatus(o, status, by); });
}

export function assignTech(caseId: string, tech: string | null) {
  update(s => { const o = s.orders[caseId]; if (!o) return; o.technician = tech; if (o.cad === 'partner' && tech) o.cad = 'exocad'; });
}

export function setOrderCad(caseId: string, cad: CadSoftware) {
  const c = caseOf(caseId);
  update(s => {
    const o = s.orders[caseId]; if (!o || !c) return;
    o.cad = cad; o.lines = orderLines(s.settings, c, cad); o.linkedFromInbox = undefined;
    const con = connectorFor(s, cad); o.connectorId = con?.id ?? null;
    o.queued = !con || con.status !== 'online';
    if (o.queued && con && !con.queue.includes(caseId)) con.queue.push(caseId);
  });
}

/** A technician picked the indication on an unmapped order; optionally save it as a rule. */
export function pickIndication(caseId: string, lineId: string, indication: string, material: string, saveRule: boolean) {
  update(s => {
    const o = s.orders[caseId]; if (!o) return;
    const l = o.lines.find(x => x.id === lineId); if (!l) return;
    l.indication = indication; l.material = material;
    if (saveRule && l.itemId && o.cad !== 'partner') {
      s.settings.mapping[l.itemId] = { ...s.settings.mapping[l.itemId], [o.cad]: { indication, material } };
      // Other open orders for the same item pick the rule up.
      for (const x of Object.values(s.orders)) for (const xl of x.lines) if (xl.itemId === l.itemId && !xl.indication && x.cad === o.cad) { xl.indication = indication; xl.material = material; }
    }
  });
}

export function resolveDuplicate(caseId: string, keep: 'ours' | 'theirs') {
  update(s => {
    const o = s.orders[caseId]; if (!o?.duplicate) return;
    o.notes.push(keep === 'ours' ? `Kept the Smile Genius order linked; ${o.duplicate.otherRef} left unlinked in ${o.cad}` : `Linked to ${o.duplicate.otherRef} (created by ${o.duplicate.createdBy}); the Smile Genius order was marked unused`);
    if (keep === 'theirs') o.ref = `${o.caseId} → ${o.duplicate.otherRef}`;
    o.duplicate = undefined;
  });
}

export function scansArrived(caseId: string) {
  update(s => { const o = s.orders[caseId]; if (!o) return; o.scans = o.scans.length ? o.scans : [{ name: `${caseId}_prep.stl`, kind: 'prep' }, { name: `${caseId}_antagonist.stl`, kind: 'antagonist' }, { name: `${caseId}_bite.stl`, kind: 'bite' }]; if (o.status === 'waiting-scans') setStatus(o, 'order-created', 'Smile Genius'); event(s, `Scans added to ${caseId}`, 'Downloaded from the scanner portal and written to the CAD order', caseId); });
}

/** The technician opened the order in CAD (the connector reads this; simulated here). */
export function openedInCad(caseId: string) {
  update(s => { const o = s.orders[caseId]; if (o && (o.status === 'order-created')) setStatus(o, 'in-design', `Connector (${o.technician ?? 'technician'} opened it)`); });
}

/**
 * Bring the finished design back (manual: a share link or files). Records what
 * was designed, compares it with the case (fed to the invoice draft), and moves
 * the case on: ready to manufacture if no approval is needed.
 */
export function bringInDesign(caseId: string, input: { url?: string; files: DesignFile[]; lines: DesignedLine[]; by?: string }) {
  const res = update(s => {
    const o = s.orders[caseId]; if (!o) return null;
    const provider = input.url ? detectProvider(input.url).provider : 'upload';
    const diff = designDiff(o, input.lines);
    o.design = { at: now(), by: input.by ?? o.technician ?? me(), sourceUrl: input.url ? (/^https?:\/\//i.test(input.url) ? input.url : `https://${input.url}`) : undefined, provider, files: input.files, lines: input.lines, diff };
    if (o.status === 'order-created' || o.status === 'waiting-scans' || o.status === 'sent-to-partner') setStatus(o, o.status === 'sent-to-partner' ? 'design-received' : 'in-design', o.design.by);
    if (!o.approvalNeeded) setStatus(o, 'ready', `${o.design.by} (no approval needed)`);
    if (diff.length) event(s, `Design differs from the case on ${caseId}`, `${diff.join('; ')}. Invoice draft updated; admin to check`, caseId);
    return { diff, lines: input.lines };
  });
  if (res) applyDesignToBilling(caseId, res.lines, res.diff);
  return res;
}

/** Send the design to the dentist through Design Studio (a new version and review link). */
export function sendForApproval(caseId: string, input: { note: string; channel: ApprovalRound['channel']; extraFiles: DesignFile[] }) {
  const c = caseOf(caseId); const o = getCad().orders[caseId];
  if (!c || !o?.design) return null;
  const sc = ensureStudioCase(c);
  const link = shareDesign({
    caseId, sourceUrl: o.design.sourceUrl ?? '', provider: o.design.sourceUrl ? o.design.provider : 'upload', kind: 'smile-design',
    recipientName: c.dentist, recipientEmail: sc.dentistEmail, note: input.note, expiresInDays: 14, uploadedBy: o.design.by,
    files: [...o.design.files, ...input.extraFiles].length ? [...o.design.files, ...input.extraFiles] : undefined,
  });
  const version = getStudio().cases[caseId]?.versions.find(v => v.id === link.versionId);
  update(s => {
    const x = s.orders[caseId]; if (!x) return;
    x.rounds.push({ versionId: link.versionId, token: link.token, number: x.rounds.length + 1, sentAt: now(), channel: input.channel, note: input.note || undefined });
    x.reminderSentAt = undefined; x.labAlertedAt = undefined;
    setStatus(x, 'awaiting-dentist', o.design!.by);
    event(s, `Design sent to ${c.dentist} for ${caseId}`, `Round ${x.rounds.length}${version ? ` (Design Studio V${version.number})` : ''} by ${input.channel === 'whatsapp' ? 'WhatsApp' : input.channel === 'email' ? 'email' : 'the practice portal'}`, caseId);
  });
  return link;
}

/** Demo: make time pass for everything waiting on the dentist or a partner. */
export function simulateHours(h: number) {
  update(s => {
    const back = (iso: string) => new Date(new Date(iso).getTime() - h * 3_600_000).toISOString();
    for (const o of Object.values(s.orders)) { const r = o.rounds[o.rounds.length - 1]; if (o.status === 'awaiting-dentist' && r && !r.decision) r.sentAt = back(r.sentAt); }
    for (const j of s.jobs) if (['sent', 'downloaded'].includes(j.status)) { j.sentAt = back(j.sentAt); j.dueAt = back(j.dueAt); }
  });
  syncCad();
}

export function remindDentist(caseId: string) {
  update(s => { const o = s.orders[caseId]; if (o) { o.reminderSentAt = now(); event(s, `Reminder sent to the dentist for ${caseId}`, 'Sent by hand from the case', caseId); } });
}

export function cancelOrder(caseId: string) {
  update(s => { const o = s.orders[caseId]; if (!o) return; o.cancelledAt = now(); o.notes.push(`Case cancelled ${new Date().toLocaleDateString('en-GB')}: marked cancelled in the ${o.cad} order notes (never deleted automatically)`); setStatus(o, 'cancelled', me()); });
}

// ── Partners ──────────────────────────────────────────────────────────────────

const TOKEN = 'abcdefghjkmnpqrstuvwxyz23456789';
const mint = () => `pt_${Array.from(crypto.getRandomValues(new Uint8Array(8)), b => TOKEN[b % TOKEN.length]).join('')}`;

export function sendToPartner(caseId: string, partnerId: string, kind: 'design' | 'milling', message?: string) {
  const c = caseOf(caseId);
  return update(s => {
    const p = s.partners.find(x => x.id === partnerId); if (!p) return null;
    let o = s.orders[caseId];
    if (!o && c) o = buildOrder(s, c, { cad: 'partner', by: me() });
    if (!o) return null;
    const token = mint();
    const job: PartnerJob = { token, caseId, partnerId, kind, sentAt: now(), dueAt: new Date(Date.now() + p.turnaroundDays * 86_400_000).toISOString(), status: 'sent', uploads: [], message };
    s.jobs.unshift(job);
    o.partnerJobId = token;
    if (kind === 'design') { o.cad = 'partner'; o.technician = null; }
    setStatus(o, kind === 'design' ? 'sent-to-partner' : 'partner-manufacturing', me());
    event(s, `${caseId} sent to ${p.name}`, `${kind === 'design' ? 'Design' : 'Milling'} · due ${new Date(job.dueAt).toLocaleDateString('en-GB')}`, caseId);
    return token;
  });
}

export function reassignJob(token: string, partnerId: string) {
  const j = getCad().jobs.find(x => x.token === token); if (!j) return null;
  update(s => { const x = s.jobs.find(y => y.token === token); if (x) { x.status = 'received'; x.message = `Reassigned to another partner`; } });
  const next = sendToPartner(j.caseId, partnerId, j.kind);
  update(s => { const x = s.jobs.find(y => y.token === next); if (x) x.reassignedFrom = j.partnerId; });
  return next;
}

export function remindPartner(token: string) {
  update(s => { const j = s.jobs.find(x => x.token === token); if (j) { j.remindedAt = now(); event(s, `Partner reminded on ${j.caseId}`, 'Reminder sent through their link'); } });
}

// Partner page actions (public, no login).
export function partnerDownloaded(token: string) {
  update(s => { const j = s.jobs.find(x => x.token === token); if (j && j.status === 'sent') { j.status = 'downloaded'; j.downloadedAt = now(); } });
}
export function partnerUpload(token: string, files: DesignFile[], message?: string) {
  const r = update(s => {
    const j = s.jobs.find(x => x.token === token); if (!j) return null;
    j.uploads = [...j.uploads, ...files]; j.uploadedAt = now(); j.status = 'uploaded'; j.message = message || j.message;
    const o = s.orders[j.caseId];
    const p = s.partners.find(x => x.id === j.partnerId);
    if (o) {
      o.design = { at: now(), by: p?.name ?? 'Partner', provider: 'upload', files: [...(o.design?.files ?? []), ...files], lines: o.lines.filter(l => l.itemId).map(l => ({ id: l.id, itemId: l.itemId!, fdi: l.fdi })), diff: [] };
      setStatus(o, 'design-received', p?.name ?? 'Partner');
      if (!o.approvalNeeded) setStatus(o, 'ready', `${p?.name ?? 'Partner'} (no approval needed)`);
    }
    event(s, `${p?.name ?? 'Partner'} uploaded the design for ${j.caseId}`, `${files.length} file${files.length === 1 ? '' : 's'}${o?.approvalNeeded ? '; send it to the dentist for approval' : '; ready to manufacture'}`, j.caseId);
    return j.caseId;
  });
  return r;
}
export function partnerShipped(token: string, courier: string, tracking: string) {
  update(s => {
    const j = s.jobs.find(x => x.token === token); if (!j) return;
    j.status = 'shipped'; j.tracking = tracking; j.courier = courier;
    const o = s.orders[j.caseId]; if (o) setStatus(o, 'partner-manufacturing', s.partners.find(x => x.id === j.partnerId)?.name ?? 'Partner');
    event(s, `${j.caseId} dispatched by the milling partner`, `${courier} ${tracking}`, j.caseId);
  });
}
export function receivedBack(caseId: string) {
  update(s => {
    const o = s.orders[caseId]; if (!o) return;
    const j = s.jobs.find(x => x.token === o.partnerJobId); if (j) j.status = 'received';
    setStatus(o, 'received-back', me());
  });
}

export function savePartner(p: Partner) {
  update(s => { const i = s.partners.findIndex(x => x.id === p.id); if (i >= 0) s.partners[i] = p; else s.partners.push(p); });
}

// ── Settings and connectors ───────────────────────────────────────────────────

export function updateCadSettings(patch: Partial<CadSettings>) {
  update(s => {
    Object.assign(s.settings, patch);
    if ('approval' in patch || 'approvalTypes' in patch) for (const o of Object.values(s.orders)) if (!o.rounds.length) o.approvalNeeded = needsApproval(s.settings, o.lines);
  });
}
export function setMapping(itemId: string, cad: CadSoftware, m: { indication: string; material: string } | null) {
  update(s => {
    const cur = { ...s.settings.mapping[itemId] };
    if (m) cur[cad] = m; else delete cur[cad];
    s.settings.mapping[itemId] = cur;
  });
}

/** Connector back online: the queued orders are written to CAD. */
export function reconnect(id: string) {
  update(s => {
    const con = s.connectors.find(c => c.id === id); if (!con) return;
    const n = con.queue.length;
    con.status = 'online'; con.lastSeen = now();
    for (const caseId of con.queue) { const o = s.orders[caseId]; if (o) { o.queued = false; o.connectorId = con.id; o.history.push({ at: now(), status: o.status, by: `${con.pc} connector: order written to ${con.cad === 'exocad' ? 'exocad DentalDB' : '3Shape Dental System'}` }); } }
    con.queue = [];
    event(s, `${con.pc} connector back online`, `${n} queued order${n === 1 ? '' : 's'} written to CAD`);
  });
}
export function goOffline(id: string) {
  update(s => { const con = s.connectors.find(c => c.id === id); if (con) { con.status = 'offline'; } });
}
/** Health check: a test order in the CAD. Fails if the connector needs updating for a new CAD version. */
export function healthCheck(id: string): boolean {
  return update(s => {
    const con = s.connectors.find(c => c.id === id); if (!con) return false;
    if (con.status === 'needs-update') { event(s, `${con.pc}: test order failed`, `The ${con.cad} order format changed after a CAD update. Orders queue until the connector updates`); return false; }
    con.testedAt = now(); con.lastSeen = con.status === 'online' ? now() : con.lastSeen; return con.status === 'online';
  });
}
export function updateConnector(id: string) {
  update(s => { const con = s.connectors.find(c => c.id === id); if (con) { con.version = '1.4.2'; con.status = 'online'; con.lastSeen = now(); con.testedAt = now(); } });
  reconnect(id);
}
export function addConnector(con: Connector) {
  update(s => { s.connectors = [...s.connectors.filter(c => c.id !== con.id), con]; event(s, `Connector set up on ${con.pc}`, `${con.cad === 'exocad' ? 'exocad' : '3Shape'} · ${con.path}`); });
}
export function removeConnector(id: string) { update(s => { s.connectors = s.connectors.filter(c => c.id !== id); }); }

export const statusText = (st: DesignStatus) => STATUS_LABEL[st];
export type { CadEvent };
