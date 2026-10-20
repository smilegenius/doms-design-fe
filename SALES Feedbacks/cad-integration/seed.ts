import type { Case } from '../../src/app/pages/CasesPage';
import { getStudio } from '../design-studio/store/studioStore';
import { DEMO_CASE_IDS } from '../design-studio/data/designStudio';
import type { CadOrder, CadState, DesignStatus } from './types';
import { cadCases, catalogItemFor, defaultMapping, isCadCase, TECHNICIANS } from './engine';
import { buildOrder, setStatus } from './cadStore';

// ── The CAD demo ─────────────────────────────────────────────────────────────
// The lab uses both CADs: crown & bridge in exocad, implants in 3Shape. The
// exocad connector runs on the shared CAD server; the 3Shape one has been
// offline for 3 hours. About a dozen cases sit across the design statuses,
// with the spec's edge cases, and two partners (one late, one shipped).

export const CAD_VERSION = 4;

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function seedCad(): CadState {
  const s: CadState = {
    version: CAD_VERSION,
    settings: {
      cad: 'both',
      cadByDepartment: { 'Crown & Bridge': 'exocad', Implants: '3shape', Dentures: 'exocad', Appliances: 'exocad', Other: 'exocad' },
      createOn: 'accepted', patientDetails: 'full', approval: 'selected',
      approvalTypes: { veneers: true, anterior4: true, implantBars: true, bridges: true, smileDesign: true },
      reminderHours: 24, partnerByDepartment: {}, partnerOverdueDays: 1,
      mapping: defaultMapping(), assign: 'manual', techByDepartment: { 'Crown & Bridge': 'Mark (CAD)', Implants: 'Priya (CAD)', Dentures: 'Tom (CAD)', Appliances: 'Tom (CAD)' },
    },
    connectors: [
      { id: 'con-exo', pc: 'CAD-SERVER', cad: 'exocad', path: '\\\\CAD-SERVER\\exocad\\DentalDB\\Orders', mode: 'shared', version: '1.4.2', lastSeen: ago(0.05), status: 'online', queue: [], testedAt: ago(20) },
      { id: 'con-3s', pc: 'CAD-PC-2', cad: '3shape', path: 'C:\\3Shape\\DentalSystem\\Orders', mode: 'per-pc', version: '1.4.2', lastSeen: ago(3.2), status: 'offline', queue: [], testedAt: ago(50) },
    ],
    orders: {},
    partners: [
      { id: 'p-precision', name: 'Precision Design Co', does: 'design', email: 'orders@precisiondesign.co.uk', turnaroundDays: 2, active: true },
      { id: 'p-millright', name: 'MillRight UK', does: 'milling', email: 'jobs@millright.co.uk', turnaroundDays: 3, active: true },
      { id: 'p-cadhub', name: 'CAD Hub Leeds', does: 'both', email: 'hello@cadhubleeds.co.uk', turnaroundDays: 2, active: true },
    ],
    jobs: [], events: [], seen: [], rr: 0,
  };

  const all = cadCases();
  // Every case already in the list counts as seen: only new cases get orders automatically.
  s.seen = all.map(c => c.id);
  const pool = all.filter(c => isCadCase(c) && !DEMO_CASE_IDS.includes(c.id) && c.serviceItems?.length);
  const used = new Set<string>();
  const pick = (fn: (c: Case) => boolean = () => true) => { const c = pool.find(x => !used.has(x.id) && fn(x)); if (c) used.add(c.id); return c; };
  const dept = (c: Case) => catalogItemFor(c.serviceItems[0].name)?.department;
  const make = (c: Case | undefined, status: DesignStatus, hoursAgo: number, extra: (o: CadOrder) => void = () => {}) => {
    if (!c) return undefined;
    const o = buildOrder(s, c, { by: 'Connector' });
    o.createdAt = ago(hoursAgo); o.history = [{ at: ago(hoursAgo), status: 'order-created', by: o.queued ? 'Queued (connector offline)' : 'Connector' }];
    if (status !== 'order-created') setStatus(o, status, 'Seed');
    o.history[o.history.length - 1].at = ago(Math.max(0.5, hoursAgo / 2));
    if (!o.technician && o.cad !== 'partner' && status !== 'order-created') o.technician = TECHNICIANS[s.rr++ % TECHNICIANS.length];
    extra(o);
    return o;
  };

  // The Design Studio veneers demo: design sent, waiting on the dentist for 30 hours.
  const sc = getStudio().cases[DEMO_CASE_IDS[0]];
  const amelia = all.find(c => c.id === DEMO_CASE_IDS[0]);
  if (amelia && sc) {
    const o = make(amelia, 'awaiting-dentist', 72, x => { x.technician = 'Mark (CAD)'; x.cad = 'exocad'; x.queued = false; x.connectorId = 'con-exo'; x.linkedFromInbox = undefined; });
    const v2 = sc.versions.find(v => v.status === 'awaiting-review') ?? sc.versions[0];
    const link = sc.links.find(l => l.versionId === v2?.id);
    if (o && v2 && link) {
      const v1 = sc.versions.find(v => v.number === 1);
      if (v1) o.rounds.push({ versionId: v1.id, token: sc.links.find(l => l.versionId === v1.id)?.token ?? '', number: 1, sentAt: ago(120), channel: 'whatsapp', decision: 'changes-requested', decidedAt: ago(96), by: sc.dentist, comments: v1.captures.map(c => c.comment) });
      o.rounds.push({ versionId: v2.id, token: link.token, number: v2.number, sentAt: ago(30), channel: 'whatsapp' });
      o.design = { at: ago(31), by: 'Mark (CAD)', sourceUrl: v2.sourceUrl || undefined, provider: v2.provider, files: v2.files ?? [], lines: o.lines.filter(l => l.itemId).map(l => ({ id: l.id, itemId: l.itemId!, fdi: l.fdi })), diff: [] };
      o.notes.push(`Changes requested (round 1, ${sc.dentist}): ${v1?.captures.map(c => c.comment).join(' · ') ?? ''}`);
    }
  }

  // Waiting for scans.
  make(pick(c => dept(c) === 'Crown & Bridge'), 'waiting-scans', 5, o => { o.scans = []; });
  // New order, unmapped indication (technician picks it; offered as a rule).
  // Prefer an item the lab hasn't mapped yet: its mapping is left empty, so the rule is a real one.
  const rare = ['Post & Core Crown', 'Inlay/Onlay', 'Screw-Retained Crown', 'Immediate Denture', 'Splint'];
  const unmappedCase = pick(c => rare.includes(c.serviceItems[0].name)) ?? pick(c => dept(c) === 'Crown & Bridge');
  const unmappedItem = unmappedCase && catalogItemFor(unmappedCase.serviceItems[0].name)?.id;
  if (unmappedItem && unmappedCase && rare.includes(unmappedCase.serviceItems[0].name)) delete s.settings.mapping[unmappedItem];
  make(unmappedCase, 'order-created', 3, o => {
    // No rarer item in this list: the scanner sent an order type the catalog doesn't know ("Other").
    if (!(unmappedCase && rare.includes(unmappedCase.serviceItems[0].name))) Object.assign(o.lines[0], { itemId: 'oth', itemName: 'Other ("Monolithic Zr full-contour" from the scanner)' });
    o.lines[0].indication = null; o.lines[0].material = null;
    o.notes.push('No mapping for this order type yet: pick the indication');
  });
  // Queued: the 3Shape connector is offline.
  make(pick(c => dept(c) === 'Implants' || dept(c) === 'Appliances'), 'order-created', 2.5, o => { if (o.cad !== '3shape') { o.cad = '3shape'; o.connectorId = 'con-3s'; } o.queued = true; const con = s.connectors.find(x => x.id === 'con-3s')!; if (!con.queue.includes(o.caseId)) con.queue.push(o.caseId); });
  // In design, with a second order made by hand in exocad.
  make(pick(c => dept(c) === 'Crown & Bridge'), 'in-design', 26, o => { o.duplicate = { otherRef: `EXO-${o.caseId.replace(/\D/g, '').slice(-4)}-B`, createdBy: 'Tom (CAD) in exocad' }; });
  // A TRIOS case linked to 3Shape's own inbox order.
  make(pick(c => c.scanner === '3Shape' && c.source === 'scanner'), 'in-design', 20, o => { o.cad = '3shape'; o.connectorId = 'con-3s'; o.queued = false; o.linkedFromInbox = o.linkedFromInbox ?? `TRIOS-${o.caseId.slice(-4)}`; });
  // Design brought in: a crown became an onlay (feeds the invoice draft).
  const diffCase = pick(c => c.serviceItems.some(si => si.name === 'Crown' && (si.fdi?.length ?? 0) >= 2));
  make(diffCase, 'ready', 40, o => {
    const l = o.lines.find(x => x.itemId === 'crn') ?? o.lines[0];
    const [first, ...rest] = l.fdi;
    const lines = [...o.lines.filter(x => x !== l && x.itemId).map(x => ({ id: x.id, itemId: x.itemId!, fdi: x.fdi })), ...(rest.length ? [{ id: l.id, itemId: 'crn', fdi: rest }] : []), { id: `${l.id}-onlay`, itemId: 'inl', fdi: [first] }];
    o.design = { at: ago(6), by: 'Mark (CAD)', sourceUrl: 'https://webview.exocad.com/share/9f2c41', provider: 'exocad', files: [], lines, diff: [`${first}: Crown changed to Inlay/Onlay`] };
    o.approvalNeeded = false;
  });
  // Two rounds of changes already: call the dentist before the third.
  make(pick(c => c.serviceItems.some(si => si.name === 'Veneers' || si.name === 'Bridge')), 'in-design', 160, o => {
    o.approvalNeeded = true;
    o.rounds = [
      { versionId: 'hist-1', token: '', number: 1, sentAt: ago(140), channel: 'email', decision: 'changes-requested', decidedAt: ago(120), by: 'the dentist', comments: ['Incisal edges too long on 11 and 21'] },
      { versionId: 'hist-2', token: '', number: 2, sentAt: ago(90), channel: 'email', decision: 'changes-requested', decidedAt: ago(70), by: 'the dentist', comments: ['Still too long; more translucency'] },
    ];
    o.callDentist = true;
    o.notes.push('Changes requested twice; flagged for a call before round 3');
  });
  // With partners: one design job late, one milling job shipped.
  make(pick(), 'sent-to-partner', 80, o => {
    o.cad = 'partner'; o.technician = null; o.queued = false;
    s.jobs.push({ token: 'pt_demo01', caseId: o.caseId, partnerId: 'p-precision', kind: 'design', sentAt: ago(80), dueAt: ago(32), status: 'downloaded', downloadedAt: ago(70), uploads: [] });
    o.partnerJobId = 'pt_demo01';
  });
  make(pick(), 'partner-manufacturing', 100, o => {
    o.queued = false;
    s.jobs.push({ token: 'pt_demo02', caseId: o.caseId, partnerId: 'p-millright', kind: 'milling', sentAt: ago(60), dueAt: ago(-12), status: 'shipped', uploads: [], tracking: 'RM 1094 2283 7GB', courier: 'Royal Mail Special Delivery' });
    o.partnerJobId = 'pt_demo02';
  });
  // Further along the line.
  make(pick(), 'ready', 50, o => { o.approvalNeeded = false; o.queued = false; });
  make(pick(), 'manufacturing', 70, o => { o.queued = false; });
  make(pick(), 'finishing', 90, o => { o.queued = false; });
  make(pick(), 'dispatched', 140, o => { o.queued = false; });
  make(pick(), 'cancelled', 60, o => { o.queued = false; o.cancelledAt = ago(10); o.notes.push('Case cancelled: marked cancelled in the exocad order notes (never deleted automatically)'); });

  // Clean up the queue: only queued orders stay in it.
  for (const con of s.connectors) con.queue = con.queue.filter(id => s.orders[id]?.queued);
  for (const o of Object.values(s.orders)) if (!o.queued && o.cad !== 'partner') o.connectorId = o.cad === '3shape' ? 'con-3s' : 'con-exo';

  s.events.push({ id: 'cad-seed-late', at: ago(8), title: 'Precision Design Co is late', body: 'Past their 2-day turnaround; reminded through their link', caseId: s.jobs[0]?.caseId });
  s.events.push({ id: 'cad-seed-off', at: ago(1), title: 'CAD-PC-2 connector offline', body: '3Shape orders are queuing; they\'ll be written when it reconnects' });
  for (const j of s.jobs) if (j.status === 'downloaded') j.overdueAlertedAt = ago(8);
  return s;
}
