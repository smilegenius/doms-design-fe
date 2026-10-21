import type { Case } from '../../src/app/pages/CasesPage';
import type { BillingAccount, BillingState, CaseBilling, Invoice } from './types';
import {
  account, accountFor, billingCases, dueDate, flagsFor, isDispatched, limitStage, linesFor, outstanding, practiceAccountId, stagesDone, itemFor, stagedMode, totals,
} from './engine';
import { daysBetween, hash, round2, today } from './format';

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
      currency: 'GBP', country: 'United Kingdom', som: 'inherit',
    });
    log(s, 'contact', `Matched ${practice} to a Xero contact`);
  }
  return id;
}

/** Billing record for a case, created the first time Billing sees it. */
export function ensureCase(s: BillingState, c: Case, at = today()): CaseBilling {
  let m = s.cases[c.id];
  if (m) return m;
  ensurePracticeAccount(s, c.practice);
  const accountId = accountFor(s, c);
  m = { caseId: c.id, accountId, receivedAt: at, dispatchedAt: null };
  // Account check on arrival: a paused account's new cases go On hold.
  const acc = account(s, accountId);
  if (acc?.paused) { m.held = true; m.heldAt = at; }
  s.cases[c.id] = m;
  return m;
}

export function refreshInvoice(s: BillingState, inv: Invoice) {
  if (inv.status !== 'draft' && inv.status !== 'flagged') return;
  const c = billingCases().find(x => x.id === inv.caseId);
  const meta = s.cases[inv.caseId];
  if (!c || !meta) return;
  if (!inv.stage) inv.lines = linesFor(s, c, meta);
  inv.flags = flagsFor(s, c, meta, inv);
  inv.status = inv.flags.length ? 'flagged' : 'draft';
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
  inv.issuedAt = at;
  inv.dueAt = dueDate(s, at, acc);
  // Disconnected: numbered and emailed now, posted when the connection is back.
  inv.xeroId = s.setup.provider ? `xr-${hash(inv.id).toString(36)}` : null;
  inv.status = 'sent';
  inv.vatNumber = s.settings.vatRegistered ? s.settings.vatNumber : undefined;
  inv.flags = [];
  inv.emailedTo = acc?.emails ?? [];
  inv.timeline.push({ at, text: by === 'Auto-sent' ? `Auto-sent as ${inv.number}` : `Approved by ${by} as ${inv.number}` });
  inv.timeline.push({ at, text: s.setup.provider ? `Posted to ${s.setup.provider === 'quickbooks' ? 'QuickBooks' : 'Xero'} and emailed to ${inv.emailedTo.join(', ') || 'no address'}` : `Emailed to ${inv.emailedTo.join(', ') || 'no address'}; posts to the accounts package when it's reconnected` });
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
export function syncAll(s: BillingState, at = today()) {
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
    if (s.invoices.some(i => i.caseId === c.id && !i.stage && i.status !== 'void')) continue;
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
    if (s.invoices.some(i => i.caseId === c.id && i.issuedAt)) continue;
    ensurePracticeAccount(s, c.practice);
    const to = accountFor(s, c);
    if (to === m.accountId) continue;
    m.accountId = to; n++;
    s.invoices.filter(i => i.caseId === c.id && !i.issuedAt).forEach(i => { i.accountId = to; i.currency = account(s, to)?.currency ?? i.currency; refreshInvoice(s, i); });
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
  if (skipsInvoice(s, meta)) s.invoices = s.invoices.filter(i => !(i.caseId === c.id && !i.issuedAt));
}
