import type { Case } from '../../src/app/pages/CasesPage';
import type { BillingAccount, BillingState, CaseBilling, Invoice } from './types';
import { covers, linesForCases, PROVIDER_NAME,
  account, accountFor, billingCases, NEW_PRACTICE_FLAG, priceFor, vatPctFor, dueDate, flagsFor, isDispatched, limitStage, linesFor, outstanding, practiceAccountId, stagesDone, itemFor, stagedMode, totals,
} from './engine';
import { daysBetween, hash, round2, today } from './format';
import { getVersion } from '../portalVersion';

// ── Billing operations ───────────────────────────────────────────────────────
// Mutate a working copy of the state (the store clones, applies, commits).
// Shared by the store's actions and the demo seed, so seeded history goes
// through exactly the same steps as live use.

let seq = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export function log(s: BillingState, kind: BillingState['sync'][number]['kind'], text: string, at = today()) {
  s.sync.unshift({ id: uid('sy'), at, kind, text });
  if (s.sync.length > 400) s.sync.length = 400;
}

export function approvalNeeded(s: BillingState, on = today()) {
  if (s.settings.approval === 'review-all') return true;
  if (s.settings.approval === 'auto') return false;
  return !s.setup.liveAt || daysBetween(s.setup.liveAt, on) < 30;
}

export function somFor(s: BillingState, acc?: BillingAccount) {
  if (s.settings.som === 'off') return false;
  if (s.settings.som === 'all') return acc?.som !== 'off';
  return acc?.som === 'on';
}

export function ensurePracticeAccount(s: BillingState, practice: string) {
  const id = practiceAccountId(practice || 'No practice');
  if (!account(s, id)) {
    s.accounts.push({
      id, kind: 'practice', name: practice || 'No practice', payer: 'practice', xeroContactId: `xc-${hash(id) % 99999}`, xeroContactName: practice,
      emails: [`accounts@${(practice || 'practice').toLowerCase().replace(/[^a-z0-9]+/g, '')}.co.uk`], priceListId: null, limit: null, paused: false,
      currency: 'GBP', country: 'United Kingdom', som: 'inherit', fromScan: true,
    });
    log(s, 'contact', `Matched ${practice} to a Xero contact`);
  }
  return id;
}

/** Billing record for a case, created the first time Billing sees it. `detect` = run the arrival checks (the demo seed sets its own). */
export function ensureCase(s: BillingState, c: Case, at = today(), detect = true): CaseBilling {
  let m = s.cases[c.id];
  if (m) return m;
  ensurePracticeAccount(s, c.practice);
  const accountId = accountFor(s, c);
  m = { caseId: c.id, accountId, receivedAt: at, dispatchedAt: null };
  // Account check on arrival: a paused account's new cases go On hold.
  const acc = account(s, accountId);
  if (acc?.paused && s.settings.limitsOn) { m.held = true; m.heldAt = at; }
  if (detect) detectOnArrival(s, c, m);
  s.cases[c.id] = m;
  return m;
}

/**
 * Checks every live case gets on arrival (v2: not only the demo seed):
 * the scanner's order type (mapped once, then remembered), NHS or private
 * unclear, and a possible remake (same patient and service within the window).
 */
export function detectOnArrival(s: BillingState, c: Case, m: CaseBilling) {
  const si = c.serviceItems?.[0];
  if (c.source === 'scanner' && si && !m.scannerOrderType) {
    m.scannerOrderType = `${c.scanner ?? 'Scanner'} · ${si.name}`;
    m.scannerItemId = si.id;
    // A scanner name that matches a catalog item maps itself; anything else waits for the admin.
    if (!s.orderTypeMap[m.scannerOrderType]) {
      const hit = s.catalog.find(i => !i.archived && i.name.toLowerCase() === si.name.toLowerCase());
      if (hit) s.orderTypeMap[m.scannerOrderType] = hit.id;
    }
  }
  if ((c.serviceItems ?? []).some(x => x.orderType !== 'NHS' && x.orderType !== 'Private')) m.kindUnclear = true;
  if (!m.remakeOf) {
    const prior = Object.values(s.cases).filter(o => o.caseId !== c.id && o.accountId === m.accountId && o.receivedAt <= m.receivedAt && daysBetween(o.receivedAt, m.receivedAt) <= s.settings.remakeDays)
      .find(o => {
        const oc = billingCases().find(x => x.id === o.caseId);
        const patient = oc?.patientName ?? o.info?.patient;
        const item = oc?.services[0] ?? o.info?.item;
        return patient === c.patientName && item === c.services[0];
      });
    if (prior) m.remakeOf = prior.caseId;
  }
}

export function refreshInvoice(s: BillingState, inv: Invoice) {
  if (inv.status !== 'draft' && inv.status !== 'flagged') return;
  // An Edit keeps the original prices: its lines are only changed by hand.
  if (inv.keepIssuedAt) { inv.status = inv.flags.length ? 'flagged' : 'draft'; return; }
  if (inv.cases?.length) {
    const cs = inv.cases.map(id => ({ c: billingCases().find(x => x.id === id), meta: s.cases[id] })).filter((x): x is { c: Case; meta: CaseBilling } => !!x.c && !!x.meta);
    inv.lines = linesForCases(s, cs);
    inv.flags = cs.flatMap(x => flagsFor(s, x.c, x.meta, { id: inv.id, accountId: inv.accountId, lines: inv.lines.filter(l => l.id.startsWith(`${x.c.id}:`)) }));
    inv.status = inv.flags.length ? 'flagged' : 'draft';
    return;
  }
  const c = billingCases().find(x => x.id === inv.caseId);
  const meta = s.cases[inv.caseId];
  if (!c || !meta) return;
  if (!inv.stage) inv.lines = linesFor(s, c, meta);
  inv.flags = flagsFor(s, c, meta, inv);
  inv.status = inv.flags.length ? 'flagged' : 'draft';
}

/**
 * Month end (v2, I2): one invoice per bill-to account from the cases in
 * "To invoice". The invoice number is written onto each case (it shows on the
 * case's Billing tab), and approval works as for any invoice.
 */
export function createMonthInvoice(s: BillingState, accountId: string, cases: { c: Case; meta: CaseBilling }[], at = today()): Invoice | null {
  if (!cases.length) return null;
  const acc = account(s, accountId)!;
  const first = cases[0].c;
  const dentists = [...new Set(cases.map(x => x.c.dentist))];
  const inv: Invoice = {
    id: uid('inv'), number: null, caseId: first.id, cases: cases.map(x => x.c.id), accountId, patient: `${cases.length} case${cases.length === 1 ? '' : 's'}`,
    dentist: dentists.length === 1 ? dentists[0] : `${dentists.length} dentists`, practice: first.practice,
    createdAt: at, issuedAt: null, dueAt: null, currency: acc.currency, lines: linesForCases(s, cases), status: 'draft', flags: [], payments: [], creditNotes: [], xeroId: null, som: somFor(s, acc),
    timeline: [{ at, text: `Created at month end from ${cases.length} shipped case${cases.length === 1 ? '' : 's'}` }],
  };
  inv.flags = cases.flatMap(x => flagsFor(s, x.c, x.meta, { id: inv.id, accountId, lines: inv.lines.filter(l => l.id.startsWith(`${x.c.id}:`)) }));
  for (const x of cases) x.meta.dispatchedAt = x.meta.dispatchedAt ?? at;
  s.invoices.unshift(inv);
  if (inv.flags.length) { inv.status = 'flagged'; inv.timeline.push({ at, text: `Flagged: ${inv.flags.map(f => f.message).join('; ')}` }); }
  else if (approvalNeeded(s, at)) inv.timeline.push({ at, text: 'Waiting for approval' });
  else approve(s, inv, at, 'Auto-sent');
  return inv;
}

export function createInvoice(s: BillingState, c: Case, meta: CaseBilling, at = today(), stage?: { itemId: string; stage: string }): Invoice {
  const acc = account(s, meta.accountId)!;
  const inv: Invoice = {
    id: uid('inv'), number: null, caseId: c.id, accountId: meta.accountId, patient: c.patientName, dentist: c.dentist, practice: c.practice,
    stage: stage?.stage, createdAt: at, issuedAt: null, dueAt: null, currency: acc.currency,
    lines: linesFor(s, c, meta, { stage }), status: 'draft', flags: [], payments: [], creditNotes: [], xeroId: null, som: somFor(s, acc),
    timeline: [{ at, text: stage ? `Created: stage "${stage.stage}" dispatched` : `Created: case ${s.settings.invoiceOn === 'completed' ? 'completed' : 'dispatched'}` }],
  };
  inv.flags = stage ? [] : flagsFor(s, c, meta, inv);
  s.invoices.unshift(inv);
  if (inv.flags.length) { inv.status = 'flagged'; inv.timeline.push({ at, text: `Flagged: ${inv.flags.map(f => f.message).join('; ')}` }); }
  else if (approvalNeeded(s, at)) inv.timeline.push({ at, text: 'Waiting for approval' });
  else approve(s, inv, at, 'Auto-sent');
  if (stage) meta.stagesBilled = [...(meta.stagesBilled ?? []), `${stage.itemId}:${stage.stage}`];
  return inv;
}

export function approve(s: BillingState, inv: Invoice, at = today(), by = 'Admin') {
  if (inv.status !== 'draft' && inv.status !== 'flagged') return;
  const acc = account(s, inv.accountId);
  inv.number = `${s.settings.prefix}${s.nextNumber++}`;
  // An Edit is reissued with the original issue date (and so the original due date).
  inv.issuedAt = inv.keepIssuedAt ?? at;
  inv.dueAt = dueDate(s, inv.issuedAt, acc);
  inv.postedAsDraft = !!s.setup.provider && s.settings.postAs === 'draft';
  // Disconnected: numbered and emailed now, posted when the connection is back.
  inv.xeroId = s.setup.provider ? `xr-${hash(inv.id).toString(36)}` : null;
  inv.status = 'sent';
  inv.vatNumber = s.settings.vatRegistered ? s.settings.vatNumber : undefined;
  inv.flags = [];
  inv.emailedTo = acc?.emails ?? [];
  inv.timeline.push({ at, text: by === 'Auto-sent' ? `Auto-sent as ${inv.number}` : `Approved by ${by} as ${inv.number}` });
  const tool = s.setup.provider ? PROVIDER_NAME[s.setup.provider] : null;
  inv.timeline.push({ at, text: tool ? `Posted to ${tool}${inv.postedAsDraft ? ' as a draft for your accountant' : ' as approved'} and emailed to ${inv.emailedTo.join(', ') || 'no address'}` : `Emailed to ${inv.emailedTo.join(', ') || 'no address'}${s.setup.provider === null && s.bank ? '' : '; no accounting tool connected, so mark it paid when the money arrives'}` });
  if (s.setup.provider) log(s, 'post', `${inv.number} posted (${inv.patient}, ${inv.caseId})`, at);
  s.emails.unshift({ id: uid('em'), at, to: inv.emailedTo, subject: `Invoice ${inv.number} · ${inv.patient}`, what: 'invoice', ref: inv.id, bounced: acc?.bounced?.some(b => inv.emailedTo!.includes(b.email)) });
}

export function pay(s: BillingState, inv: Invoice, amount: number, at = today(), ref = `Xero payment ${hash(inv.id + at) % 9000 + 1000}`) {
  const amt = round2(Math.min(amount, outstanding(inv)));
  if (amt <= 0) return;
  inv.payments.push({ id: uid('pay'), at, amount: amt, ref });
  inv.status = outstanding(inv) <= 0.005 ? 'paid' : 'part-paid';
  inv.timeline.push({ at, text: `Payment ${amt.toFixed(2)} read from Xero${inv.status === 'paid' ? ': paid in full' : ''}` });
  log(s, 'payment', `Payment ${amt.toFixed(2)} on ${inv.number} read back`, at);
}

/** After a payment or a limit change: lift a pause when the account is back under its limit. */
export function checkHold(s: BillingState, accountId: string, at = today(), by = 'Payment in Xero'): string[] {
  const acc = account(s, accountId);
  if (!acc?.paused) return [];
  acc.paused = false;
  if (limitStage(s, acc) === 'at' && acc.limit?.atLimit === 'pause') { acc.paused = true; return []; }
  const released: string[] = [];
  for (const m of Object.values(s.cases)) if (m.accountId === accountId && m.held) { m.held = false; m.releasedBy = by; released.push(m.caseId); }
  log(s, 'read', `${acc.name} back under its limit: hold lifted (${released.length} case${released.length === 1 ? '' : 's'} released)`, at);
  return released;
}

/** At the limit with "pause": hold the account. */
export function checkLimit(s: BillingState, accountId: string, at = today()) {
  const acc = account(s, accountId);
  if (!acc?.limit || acc.paused) return;
  if (limitStage(s, acc) === 'at' && acc.limit.atLimit === 'pause') {
    acc.paused = true;
    if (acc.limit.tellPractice) s.emails.unshift({ id: uid('em'), at, to: acc.emails, subject: `Your account with the lab is on hold`, what: 'limit', ref: acc.id });
  }
}

/**
 * Bring Billing up to date with the case list: new cases get a billing record
 * (with the account check), dispatched cases get their invoice, staged items
 * an invoice per finished stage.
 */
export function syncAll(s: BillingState, at = today(), perLine = getVersion() === 'v2') {
  for (const c of billingCases()) {
    const meta = ensureCase(s, c, at);
    if (meta.billedElsewhere || meta.held) continue;
    const acc = account(s, meta.accountId);
    // Staged items billed per stage: one invoice per finished stage.
    for (const si of c.serviceItems ?? []) {
      const item = itemFor(s, si, meta);
      if (!item?.stages?.length || !acc || stagedMode(acc, item) !== 'each') continue;
      for (const st of stagesDone(si)) {
        if (meta.stagesBilled?.includes(`${item.id}:${st}`) || !item.stages.some(x => x.name === st)) continue;
        createInvoice(s, c, meta, at, { itemId: item.id, stage: st });
      }
    }
    if (!isDispatched(s, c) || meta.skipAuto) continue;
    if (skipsInvoice(s, meta)) continue;
    // V2 (case handoff workflow): each service line is invoiced when the clinic
    // marks it received (Delivered), from the workflow, not when the case ships.
    if (perLine) continue;
    // Month-end accounts: the case waits in "To invoice" until Invoice month.
    if (acc?.invoiceMode === 'month-end') { meta.dispatchedAt = meta.dispatchedAt ?? at; continue; }
    if (s.invoices.some(i => covers(i, c.id) && !i.stage && i.status !== 'void')) continue;
    meta.dispatchedAt = meta.dispatchedAt ?? at;
    const lines = linesFor(s, c, meta);
    if (!lines.length) continue; // everything on the case bills per stage
    createInvoice(s, c, meta, at);
  }
}

export const invoiceGross = (inv: Invoice) => totals(inv).gross;

/**
 * After who-pays or practice links change for a dentist: cases not invoiced yet
 * move to the account that now pays. Invoices already sent stay where they are.
 */
export function reassignCases(s: BillingState, dentist: string) {
  let n = 0;
  for (const c of billingCases().filter(c => c.dentist === dentist)) {
    const m = s.cases[c.id]; if (!m || m.billedElsewhere) continue;
    if (s.invoices.some(i => covers(i, c.id) && i.issuedAt)) continue;
    ensurePracticeAccount(s, c.practice);
    const to = accountFor(s, c);
    if (to === m.accountId) continue;
    m.accountId = to; n++;
    s.invoices.filter(i => covers(i, c.id) && !i.issuedAt).forEach(i => { i.accountId = to; i.currency = account(s, to)?.currency ?? i.currency; refreshInvoice(s, i); });
  }
  return n;
}

/** A remake under warranty with "No invoice": nothing is billed. */
export const skipsInvoice = (s: BillingState, meta: CaseBilling) => meta.remakeDecision === 'no-charge' && s.settings.warrantyRemakes === 'none';

/** Record a remake decision; a no-charge remake keeps its value for reporting and, with "No invoice", drops any draft. */
export function applyRemake(s: BillingState, c: Case, meta: CaseBilling, decision: 'no-charge' | 'charge') {
  meta.remakeDecision = decision;
  if (decision !== 'no-charge') { delete meta.remakeValue; return; }
  meta.remakeValue = totals({ lines: linesFor(s, c, { ...meta, remakeDecision: 'charge' }, { includeStaged: true }) }).gross;
  if (skipsInvoice(s, meta)) s.invoices = s.invoices.filter(i => !(covers(i, c.id) && !i.issuedAt));
}

/**
 * V1 demo: a scan arrives from a practice the lab hasn't billed before. Billing
 * creates the practice on its own (so the case isn't blocked), and its first
 * invoice waits until a person confirms who to bill.
 */
export function addScanPractice(s: BillingState, name = 'Riverside Dental Care', dentist = 'Dr. Okafor', at = today()) {
  const id = practiceAccountId(name);
  if (account(s, id)) return id;
  s.accounts.push({
    id, kind: 'practice', name, payer: 'practice', xeroContactId: null, emails: [], priceListId: null, limit: null, paused: false,
    currency: 'GBP', country: 'United Kingdom', som: 'inherit', fromScan: true,
  });
  const item = s.catalog.find(i => i.id === 'crn') ?? s.catalog[0];
  const acc = account(s, id)!;
  const caseId = `CASE-${4000 + (hash(name) % 900)}`;
  s.cases[caseId] = { caseId, accountId: id, receivedAt: at, dispatchedAt: at, history: true, scannerOrderType: `iTero · ${item.name}`, info: { patient: 'Amara Bello', dentist, item: item.name } };
  const pr = priceFor(s, acc, item, 'Private', at);
  const inv: Invoice = {
    id: uid('inv'), number: null, caseId, accountId: id, patient: 'Amara Bello', dentist, practice: name, createdAt: at, issuedAt: null, dueAt: null, currency: 'GBP',
    lines: [{ id: `${caseId}-s1`, itemId: item.id, description: `${item.name} (21)`, qty: 1, unitPrice: pr.price, listPrice: pr.list, kind: 'Private', source: pr.source, vat: item.vat, vatPct: vatPctFor(s, item) }],
    status: 'flagged', flags: [{ kind: 'review', message: NEW_PRACTICE_FLAG(name) }], payments: [], creditNotes: [], xeroId: null, som: false,
    timeline: [{ at, text: `Scan received from ${dentist} at ${name}, a practice not billed before: practice created automatically` }, { at, text: 'Waiting: confirm who to bill before it goes out' }],
  };
  s.invoices.unshift(inv);
  log(s, 'contact', `New practice from a scan: ${name} (not in ${s.setup.provider ? PROVIDER_NAME[s.setup.provider] : 'the accounting tool'} yet)`, at);
  return id;
}

/**
 * V2: one invoice per service line, created when the line is Delivered
 * (replaces one invoice per case). Month-end accounts collect it in To invoice.
 */
export function createLineInvoice(s: BillingState, c: Case, meta: CaseBilling, siId: string, at = today()): Invoice | null {
  if (s.invoices.some(i => i.status !== 'void' && i.lineOf === siId && covers(i, c.id))) return null;
  const lines = linesFor(s, c, meta).filter(l => l.id === siId || l.id.startsWith(`${siId}-`) || l.id === `design-${siId}`);
  if (!lines.length) return null;
  const acc = account(s, meta.accountId)!;
  meta.dispatchedAt = meta.dispatchedAt ?? at;
  const si = c.serviceItems?.find(x => x.id === siId);
  const inv: Invoice = {
    id: uid('inv'), number: null, caseId: c.id, accountId: meta.accountId, patient: c.patientName, dentist: c.dentist, practice: c.practice,
    createdAt: at, issuedAt: null, dueAt: null, currency: acc.currency, lines, status: 'draft', flags: [], payments: [], creditNotes: [], xeroId: null, som: somFor(s, acc),
    lineOf: siId, timeline: [{ at, text: `Created: ${si?.name ?? 'service line'} delivered (one invoice per service line)` }],
  };
  inv.flags = flagsFor(s, c, meta, inv);
  s.invoices.unshift(inv);
  if (inv.flags.length) { inv.status = 'flagged'; inv.timeline.push({ at, text: `Flagged: ${inv.flags.map(f => f.message).join('; ')}` }); }
  else if (approvalNeeded(s, at)) inv.timeline.push({ at, text: 'Waiting for approval' });
  else approve(s, inv, at, 'Auto-sent');
  return inv;
}
