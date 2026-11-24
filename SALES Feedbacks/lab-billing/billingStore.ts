import { useSyncExternalStore } from 'react';
import type {
  AccountLimit, BankPayment, BillingAccount, BillingState, CatalogItem, Currency, Invoice, LabBillingSettings, MondaySettings, OrderKind, PriceList, Promotion, Provider, SetupState, Templates, VolumeTier,
} from './types';
import { covers, NEW_PRACTICE_FLAG, PROVIDER_NAME, statementRef, account, billingCases, buildStatement, caseById, dentistAccountId, flagsFor, isDispatched, linesFor, outstanding, practiceAccountId, pricesOn, totals } from './engine';
import { lastWorkingDay, monthOf, round2, today } from './format';
import { addScanPractice, createLineInvoice, applyRemake, approve, checkHold, checkLimit, createInvoice, createMonthInvoice, ensureCase, ensurePracticeAccount, log, pay, reassignCases, refreshInvoice, syncAll, uid } from './ops';
import { BILLING_VERSION, seedBilling } from './seed';

// ── Billing store ────────────────────────────────────────────────────────────
// One state object in localStorage (Growth Team Feedback only). Every action
// clones the state, applies an operation from ops.ts, and commits.

const KEY = 'salesFeedbacks.billing.v1';
const listeners = new Set<() => void>();
let state: BillingState | null = null;

function load(): BillingState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as BillingState; if (s.version === BILLING_VERSION) return s; }
  } catch { /* reseed */ }
  const s = seedBilling();
  save(s);
  return s;
}
function save(s: BillingState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* keep in memory */ } }
export function getBilling(): BillingState { if (!state) state = load(); return state; }
function commit(next: BillingState) { state = next; save(next); listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Apply a change to a working copy and commit it. Returns the callback's result. */
function update<T>(fn: (s: BillingState) => T): T {
  const s = structuredClone(getBilling());
  const out = fn(s);
  commit(s);
  return out;
}

export function useBilling(): BillingState { return useSyncExternalStore(subscribe, getBilling); }

export function resetBillingDemo() { commit(seedBilling()); }

/** Bring billing up to date with the case list (new cases, dispatches, stages). */
export function syncBilling() {
  const s = getBilling();
  const before = Object.keys(s.cases).length;
  const needs = billingCases().some(c => {
    const m = s.cases[c.id];
    if (!m) return true;
    return isDispatched(s, c) && !m.billedElsewhere && !m.skipAuto && !m.held && account(s, m.accountId)?.invoiceMode !== 'month-end' && !s.invoices.some(i => covers(i, c.id) && !i.stage && i.status !== 'void');
  });
  if (needs || before === 0) update(x => syncAll(x));
}

const me = () => 'Sajid Mahmood';

// ── Invoices ──────────────────────────────────────────────────────────────────

export function approveInvoices(ids: string[], by = me()) {
  return update(s => {
    let n = 0;
    for (const id of ids) { const inv = s.invoices.find(i => i.id === id); if (inv && (inv.status === 'draft' || inv.status === 'flagged')) { approve(s, inv, today(), by); n++; } }
    return n;
  });
}

export function overrideLine(invId: string, lineId: string, price: number, reason: string, by = me()) {
  update(s => {
    const inv = s.invoices.find(i => i.id === invId);
    if (!inv) return;
    // An Edit (void and reissue) keeps its own lines: change the line itself.
    if (inv.keepIssuedAt || inv.cases?.length) {
      const l = inv.lines.find(x => x.id === lineId); if (!l) return;
      l.unitPrice = price; l.source = { kind: 'override', reason, by };
      inv.timeline.push({ at: today(), text: `Price on a line typed by ${by}: ${price.toFixed(2)} (${reason})` });
      if (!inv.cases?.length) return;
    }
    const meta = s.cases[inv.caseId];
    if (meta) meta.lineOverrides = { ...meta.lineOverrides, [lineId]: { price, reason, by } };
    refreshInvoice(s, inv);
    inv.timeline.push({ at: today(), text: `Price on a line typed by ${by}: ${price.toFixed(2)} (${reason})` });
  });
}

export function setCaseKind(caseId: string, kind: OrderKind) {
  update(s => {
    const m = s.cases[caseId]; if (!m) return;
    m.kindOverride = kind;
    s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i));
  });
}

export function mapOrderType(orderType: string, itemId: string) {
  return update(s => {
    s.orderTypeMap[orderType] = itemId;
    let n = 0;
    for (const inv of s.invoices) if (s.cases[inv.caseId]?.scannerOrderType === orderType && (inv.status === 'flagged' || inv.status === 'draft')) { refreshInvoice(s, inv); n++; }
    log(s, 'read', `Order type "${orderType}" mapped to ${s.catalog.find(i => i.id === itemId)?.name}; remembered for future orders`);
    return n;
  });
}

export function decideRemake(caseId: string, decision: 'no-charge' | 'charge') {
  const c = caseById(caseId);
  update(s => {
    const m = s.cases[caseId]; if (!m || !c) return;
    applyRemake(s, c, m, decision);
    s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i));
  });
}
export function notRemake(caseId: string) {
  update(s => { const m = s.cases[caseId]; if (m) { delete m.remakeOf; delete m.remakeDecision; } s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i)); });
}

/** Invoice a case now (dispatched with no invoice, or billed early on request). */
export function billNow(caseId: string): Invoice | null {
  const c = caseById(caseId); if (!c) return null;
  return update(s => {
    const m = ensureCase(s, c);
    m.skipAuto = false;
    m.dispatchedAt = m.dispatchedAt ?? today();
    return createInvoice(s, c, m);
  });
}

export function billStage(caseId: string, itemId: string, stage: string) {
  const c = caseById(caseId); if (!c) return null;
  return update(s => createInvoice(s, c, ensureCase(s, c), today(), { itemId, stage }));
}

/** A staged case stopped partway: optionally bill the stages done so far. */
export function stopCase(caseId: string, bill: { itemId: string; stage: string }[]) {
  const c = caseById(caseId); if (!c) return;
  update(s => {
    const m = ensureCase(s, c);
    m.stoppedAt = today();
    for (const b of bill) createInvoice(s, c, m, today(), b);
  });
}

export function addPart(caseId: string, part: { itemId: string; manufacturer: string; partNo: string; cost: number }) {
  update(s => {
    const m = s.cases[caseId]; if (!m) return;
    m.parts = [...(m.parts ?? []), { id: uid('part'), ...part }];
    s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i));
  });
}
export function removePart(caseId: string, partId: string) {
  update(s => { const m = s.cases[caseId]; if (!m) return; m.parts = (m.parts ?? []).filter(p => p.id !== partId); s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i)); });
}

export function creditNote(invId: string, amount: number, reason: string, full: boolean) {
  update(s => {
    const inv = s.invoices.find(i => i.id === invId); if (!inv) return;
    const amt = round2(full ? totals(inv).gross - inv.creditNotes.reduce((n, c) => n + c.amount, 0) : amount);
    const cn = { id: uid('cn'), number: creditNumber(s), at: today(), amount: amt, reason, full };
    inv.creditNotes.push(cn);
    if (outstanding(inv) <= 0.005 && inv.status !== 'paid') inv.status = 'paid';
    inv.timeline.push({ at: today(), text: `${full ? 'Full' : 'Partial'} credit note ${cn.number} for ${amt.toFixed(2)}: ${reason}. Posted to Xero` });
    log(s, 'credit', `${cn.number} on ${inv.number} posted (${reason})`);
    checkHold(s, inv.accountId);
  });
}

/** Credit notes have their own series (CN-0001), so invoice numbers have no gaps. */
function creditNumber(s: BillingState) { const n = s.nextCredit ?? 1; s.nextCredit = n + 1; return `CN-${String(n).padStart(4, '0')}`; }

/**
 * Edit a sent invoice (I5): a sent invoice never changes, so Edit voids it and
 * reissues it at the original prices and issue date, ready to change a line
 * and approve. Re-issue to another account does the same for a different
 * bill-to account. Statements update because the void drops out of them.
 */
export function voidAndReissue(invId: string, by = me(), toAccountId?: string): string | null {
  return update(s => {
    const inv = s.invoices.find(i => i.id === invId); if (!inv || !inv.issuedAt) return null;
    const to = toAccountId ? account(s, toAccountId) : account(s, inv.accountId);
    if (!to) return null;
    inv.status = 'void';
    const tool = s.setup.provider ? ` and in ${PROVIDER_NAME[s.setup.provider]}` : '';
    inv.timeline.push({ at: today(), text: toAccountId ? `Voided by ${by}${tool}: re-issued to ${to.name}` : `Voided by ${by}${tool} to edit it` });
    log(s, 'void', `${inv.number} voided`);
    const next: Invoice = {
      ...structuredClone(inv), id: uid('inv'), number: null, accountId: to.id, status: 'draft', flags: [], payments: [], creditNotes: [], xeroId: null,
      issuedAt: null, dueAt: null, keepIssuedAt: inv.issuedAt, createdAt: today(), archived: false, replacedBy: undefined,
      replaces: inv.number ?? undefined, currency: to.currency, emailedTo: undefined,
      timeline: [{ at: today(), text: `${toAccountId ? `Re-issue of ${inv.number} to ${to.name}` : `Edit of ${inv.number}`}: original prices and issue date (${inv.issuedAt}) kept. Change a line, then approve` }],
    };
    if (toAccountId) {
      // The cases now bill to the new account.
      for (const id of inv.cases ?? [inv.caseId]) if (s.cases[id]) s.cases[id].accountId = to.id;
    }
    s.invoices.unshift(next);
    inv.replacedBy = next.id;
    return next.id;
  });
}

/** No accounting tool connected (P6): mark paid by hand, single or bulk. */
export function markPaid(ids: string[]) {
  return update(s => {
    let n = 0;
    for (const id of ids) { const inv = s.invoices.find(i => i.id === id); if (inv && outstanding(inv) > 0) { pay(s, inv, outstanding(inv), today(), 'Marked paid by hand'); n++; checkHold(s, inv.accountId); } }
    return n;
  });
}
/** Clear settled invoices from view (they stay in statements and reports). */
export function archiveInvoices(ids: string[], archived = true) {
  return update(s => { let n = 0; for (const id of ids) { const inv = s.invoices.find(i => i.id === id); if (inv) { inv.archived = archived; n++; } } return n; });
}

/**
 * "To invoice" → invoices (I2). Month-end accounts get one invoice from all
 * the ticked cases; any other account gets one invoice per ticked case.
 */
export function invoiceFromPot(accountId: string, caseIds: string[]) {
  return update(s => {
    const cs = caseIds.map(id => ({ c: caseById(id), meta: s.cases[id] })).filter((x): x is { c: NonNullable<ReturnType<typeof caseById>>; meta: NonNullable<typeof x.meta> } => !!x.c && !!x.meta);
    cs.forEach(x => { x.meta.skipAuto = false; });
    if (account(s, accountId)?.invoiceMode === 'month-end') { const inv = createMonthInvoice(s, accountId, cs); return inv ? [inv] : []; }
    return cs.map(x => createInvoice(s, x.c, x.meta));
  });
}

/** Per case on dispatch, or one invoice a month (an account setting). */
export function setInvoiceMode(accountId: string, mode: 'per-case' | 'month-end') {
  update(s => {
    const acc = account(s, accountId); if (!acc) return;
    acc.invoiceMode = mode;
    log(s, 'read', `${acc.name}: ${mode === 'month-end' ? 'one invoice a month from To invoice' : 'one invoice per case on dispatch'}`);
  });
  if (mode === 'per-case') syncBilling();
}

export function addAccountNote(accountId: string, text: string, by = me()) {
  update(s => { const acc = account(s, accountId); if (acc && text.trim()) acc.notes = [{ at: today(), by, text: text.trim() }, ...(acc.notes ?? [])]; });
}
export function setViewAs(v: 'admin' | 'accountant') { update(s => { s.viewAs = v; }); }

// ── v2: payment reconciliation (simulated change notices from the accounting tool) ──

/** Demo: something happens in Xero that needs a person (P5). */
export function simulateToolEvent(kind: 'edited' | 'voided' | 'failed' | 'expired') {
  return update(s => {
    const tool = s.setup.provider ? PROVIDER_NAME[s.setup.provider] : 'Xero';
    const open = s.invoices.filter(i => i.issuedAt && (i.status === 'sent' || i.status === 'part-paid') && !s.issues.some(x => x.invoiceId === i.id));
    const pick = open[open.length > 3 ? 2 : 0];
    if (kind === 'expired') { s.issues.unshift({ id: uid('is'), at: today(), kind: 'connection-expired' }); log(s, 'error', `${tool} connection expired: posting paused until reconnected`); return 'The connection expired'; }
    if (!pick) return null;
    if (kind === 'edited') {
      const t = totals(pick).gross;
      const theirs = round2(t - Math.max(5, Math.round(t * 0.1)));
      s.issues.unshift({ id: uid('is'), at: today(), kind: 'edited-in-tool', invoiceId: pick.id, ours: `Total ${t.toFixed(2)}`, theirs: `Total ${theirs.toFixed(2)} (a line was changed in ${tool})`, theirsTotal: theirs });
      log(s, 'read', `${pick.number} was edited in ${tool}`);
      return `${pick.number} edited in ${tool}`;
    }
    if (kind === 'voided') {
      pick.status = 'void';
      pick.timeline.push({ at: today(), text: `Voided in ${tool}: its cases are back in To invoice` });
      for (const id of pick.cases ?? [pick.caseId]) if (s.cases[id]) s.cases[id].skipAuto = true;
      s.issues.unshift({ id: uid('is'), at: today(), kind: 'voided-in-tool', invoiceId: pick.id });
      log(s, 'read', `${pick.number} voided in ${tool}`);
      return `${pick.number} voided in ${tool}`;
    }
    s.issues.unshift({ id: uid('is'), at: today(), kind: 'sync-failed', invoiceId: pick.id, attempts: 3 });
    log(s, 'error', `Posting ${pick.number} failed 3 times`);
    return `Posting ${pick.number} failed`;
  });
}

/** Resolve a sync issue: accept the tool's version, re-push ours, retry, reconnect, or note it. */
export function resolveIssue(issueId: string, action: 'accept-theirs' | 'push-ours' | 'retry' | 'reconnect' | 'ok') {
  update(s => {
    const is = s.issues.find(x => x.id === issueId); if (!is) return;
    const inv = is.invoiceId ? s.invoices.find(i => i.id === is.invoiceId) : undefined;
    const tool = s.setup.provider ? PROVIDER_NAME[s.setup.provider] : 'Xero';
    if (action === 'accept-theirs' && inv && is.theirsTotal != null) {
      // Our invoice never changes: the difference becomes a credit note, so both sides agree.
      const diff = round2(totals(inv).gross - is.theirsTotal);
      if (diff > 0) {
        inv.creditNotes.push({ id: uid('cn'), number: creditNumber(s), at: today(), amount: diff, reason: `Matched to the version edited in ${tool}`, full: false });
        inv.timeline.push({ at: today(), text: `${tool}'s version accepted: credit note for ${diff.toFixed(2)}` });
        if (outstanding(inv) <= 0.005) inv.status = 'paid';
      }
    }
    if (action === 'push-ours' && inv) { inv.timeline.push({ at: today(), text: `Smile Genius version re-pushed to ${tool}` }); log(s, 'post', `${inv.number} re-pushed to ${tool}`); }
    if (action === 'retry' && inv) { inv.xeroId = inv.xeroId ?? `xr-${inv.id.slice(-6)}`; log(s, 'post', `${inv.number} posted on retry`); }
    if (action === 'reconnect') log(s, 'read', `${tool} reconnected: queued invoices posted`);
    s.issues = s.issues.filter(x => x.id !== issueId);
  });
}

// ── v2: bank connection (labs with no accounting tool) ──────────────────────

export function connectBank(bank: 'revolut' | 'wise' | null) {
  update(s => { s.bank = bank; log(s, 'read', bank ? `${bank === 'revolut' ? 'Revolut Business' : 'Wise Business'} connected: incoming payments are matched to invoices` : 'Bank disconnected'); });
}

/** Match a bank payment (K4): reference with an invoice or statement number → known payer + exact amount → ask a person. */
function matchPayment(s: BillingState, bp: BankPayment): string[] | null {
  const open = s.invoices.filter(i => outstanding(i) > 0).sort((a, b) => (a.issuedAt ?? '').localeCompare(b.issuedAt ?? ''));
  const byRef = open.filter(i => i.number && bp.ref.toUpperCase().includes(i.number.toUpperCase()));
  if (byRef.length) return byRef.map(i => i.id);
  const st = s.statements.find(x => bp.ref.toUpperCase().includes(statementRef(x)));
  if (st) return open.filter(i => i.accountId === st.accountId).map(i => i.id);
  const known = s.payers[bp.payer];
  if (known) {
    const mine = open.filter(i => i.accountId === known);
    const one = mine.find(i => Math.abs(outstanding(i) - bp.amount) < 0.01);
    if (one) return [one.id];
    const bal = round2(mine.reduce((n, i) => n + outstanding(i), 0));
    if (Math.abs(bal - bp.amount) < 0.01) return mine.map(i => i.id);
  }
  return null;
}
function applyPayment(s: BillingState, bp: BankPayment, ids: string[]) {
  let left = bp.amount;
  for (const id of ids) { const inv = s.invoices.find(i => i.id === id); if (!inv || left <= 0) continue; const p = Math.min(left, outstanding(inv)); pay(s, inv, p, bp.at, `Bank: ${bp.ref}`); left = round2(left - p); }
  bp.matched = ids;
  bp.accountId = s.invoices.find(i => i.id === ids[0])?.accountId;
  // Overpayments stay as credit on the account and reduce the next statement.
  if (left > 0.005) bp.credit = left;
  if (bp.accountId) checkHold(s, bp.accountId);
}

/** Demo: money arrives in the connected bank. */
export function simulateBankPayment(kind: 'reference' | 'known' | 'unknown') {
  return update(s => {
    const open = s.invoices.filter(i => outstanding(i) > 0 && i.issuedAt).sort((a, b) => (a.issuedAt ?? '').localeCompare(b.issuedAt ?? ''));
    const inv = open[0]; if (!inv) return null;
    const acc = account(s, inv.accountId);
    const bp: BankPayment = kind === 'reference'
      ? { id: uid('bp'), at: today(), amount: outstanding(inv), ref: `${inv.number} ${acc?.name ?? ''}`.trim(), payer: (acc?.name ?? 'Practice').toUpperCase() }
      : kind === 'known'
        ? { id: uid('bp'), at: today(), amount: outstanding(inv), ref: 'LAB FEES', payer: Object.keys(s.payers).find(p => s.payers[p] === inv.accountId) ?? (acc?.name ?? 'Practice').toUpperCase() }
        : { id: uid('bp'), at: today(), amount: outstanding(inv), ref: 'DENTAL LAB PAYMENT', payer: `${(acc?.name ?? 'Practice').replace(/^Smile Genius /, 'SG ').toUpperCase()} LTD` };
    if (kind === 'known') s.payers[bp.payer] = inv.accountId;
    s.bankPayments.unshift(bp);
    const ids = matchPayment(s, bp);
    if (ids) { applyPayment(s, bp, ids); return `${money2(bp.amount)} from ${bp.payer}: matched to ${ids.map(id => s.invoices.find(i => i.id === id)?.number).join(', ')}`; }
    s.issues.unshift({ id: uid('is'), at: today(), kind: 'bank-unmatched', bankPaymentId: bp.id });
    return `${money2(bp.amount)} from ${bp.payer}: needs you to confirm the match`;
  });
}
const money2 = (n: number) => `£${n.toFixed(2)}`;

/** Likeliest two matches for an unmatched bank payment. */
export function likelyMatches(s: BillingState, bp: BankPayment) {
  return s.invoices.filter(i => outstanding(i) > 0 && i.issuedAt)
    .map(i => ({ inv: i, score: Math.abs(outstanding(i) - bp.amount) + (bp.payer.toLowerCase().includes((account(s, i.accountId)?.name ?? '').replace(/^Smile Genius /, '').toLowerCase()) ? -1000 : 0) }))
    .sort((a, b) => a.score - b.score).slice(0, 2).map(x => x.inv);
}
/** Confirm an unmatched bank payment; the payer is remembered for next time. */
export function confirmBankMatch(issueId: string, invoiceId: string) {
  update(s => {
    const is = s.issues.find(x => x.id === issueId); const bp = s.bankPayments.find(b => b.id === is?.bankPaymentId);
    const inv = s.invoices.find(i => i.id === invoiceId);
    if (!is || !bp || !inv) return;
    applyPayment(s, bp, [inv.id]);
    s.payers[bp.payer] = inv.accountId;
    log(s, 'payment', `${bp.payer} remembered as ${account(s, inv.accountId)?.name}`);
    s.issues = s.issues.filter(x => x.id !== issueId);
  });
}

export function resendInvoice(invId: string) {
  update(s => {
    const inv = s.invoices.find(i => i.id === invId); if (!inv) return;
    const acc = account(s, inv.accountId);
    s.emails.unshift({ id: uid('em'), at: today(), to: acc?.emails ?? [], subject: `Invoice ${inv.number} (resent)`, what: 'invoice', ref: inv.id });
    inv.timeline.push({ at: today(), text: `Resent to ${(acc?.emails ?? []).join(', ')}` });
    if (acc?.bounced) acc.bounced = acc.bounced.filter(b => !acc.emails.includes(b.email));
  });
}

/** Mock: a payment arrives in Xero and Smile Genius reads it back. */
export function simulatePayment(invId: string, amount?: number) {
  return update(s => {
    const inv = s.invoices.find(i => i.id === invId); if (!inv) return [] as string[];
    pay(s, inv, amount ?? outstanding(inv));
    return checkHold(s, inv.accountId);
  });
}
/** Mock: the account pays its oldest invoices (old-system balances first). */
export function simulateAccountPayment(accountId: string, amount: number) {
  return update(s => {
    let left = amount;
    for (const x of s.xeroOnly.filter(x => x.accountId === accountId && x.amount > x.paid).sort((a, b) => a.date.localeCompare(b.date))) {
      const p = Math.min(left, x.amount - x.paid); x.paid = round2(x.paid + p); left -= p;
      if (p > 0) log(s, 'payment', `Payment ${p.toFixed(2)} on old-system ${x.number} read back`);
    }
    for (const inv of s.invoices.filter(i => i.accountId === accountId && outstanding(i) > 0).sort((a, b) => (a.issuedAt ?? '').localeCompare(b.issuedAt ?? ''))) {
      if (left <= 0) break;
      const p = Math.min(left, outstanding(inv)); pay(s, inv, p); left -= p;
    }
    return checkHold(s, accountId);
  });
}

// ── Holds ─────────────────────────────────────────────────────────────────────

export function releaseCase(caseId: string, by = me()) {
  update(s => { const m = s.cases[caseId]; if (m) { m.held = false; m.releasedBy = by; log(s, 'read', `${caseId} released from hold by ${by}`); } });
  syncBilling();
}
export function releaseAccount(accountId: string, by = me()) {
  update(s => {
    const acc = account(s, accountId); if (!acc) return;
    acc.paused = false;
    for (const m of Object.values(s.cases)) if (m.accountId === accountId && m.held) { m.held = false; m.releasedBy = by; }
    log(s, 'read', `Hold on ${acc.name} lifted by ${by}`);
  });
  syncBilling();
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function updateAccount(id: string, patch: Partial<BillingAccount>) {
  update(s => {
    const acc = account(s, id); if (!acc) return;
    Object.assign(acc, patch);
    if ('limit' in patch) { if (!acc.limit) acc.paused = false; checkHold(s, id, today(), 'Limit changed'); checkLimit(s, id); }
    if ('priceListId' in patch || 'currency' in patch || 'stagedOverride' in patch) s.invoices.filter(i => i.accountId === id).forEach(i => refreshInvoice(s, i));
  });
}

/** Who pays for a dentist's cases. Cases not yet invoiced move to the new payer. */
export function setPayer(dentist: string, payer: 'practice' | 'dentist') {
  update(s => {
    const acc = account(s, dentistAccountId(dentist)); if (!acc) return;
    acc.payer = payer;
    if (payer === 'dentist') ensureXeroContact(s, acc);
    reassignCases(s, dentist);
  });
}

function ensureXeroContact(s: BillingState, acc: BillingAccount, match?: string) {
  if (acc.xeroContactId && !match) return;
  acc.xeroContactId = `xc-${acc.name.replace(/\W+/g, '').toLowerCase()}`;
  acc.xeroContactName = match ?? acc.name;
  log(s, 'contact', match ? `Matched ${acc.name} to Xero contact "${match}"` : `Created Xero contact "${acc.name}"`);
}

export type NewAccount =
  | { kind: 'practice'; name: string; emails: string[]; currency: Currency; country: string; priceListId: string | null; limit: AccountLimit | null; xero: string | null }
  | { kind: 'single' | 'floating'; name: string; practices: string[]; payer: 'practice' | 'dentist'; emails: string[]; currency: Currency; xero: string | null };

/** Add a billing account: a practice, a dentist at one practice, or a dentist across several. */
export function addAccount(input: NewAccount): { id?: string; error?: string } {
  return update(s => {
    const name = input.name.trim();
    if (!name) return { error: 'Add a name' };
    if (input.kind === 'practice') {
      const id = practiceAccountId(name);
      if (account(s, id)) return { error: `${name} already has an account` };
      const acc: BillingAccount = { id, kind: 'practice', name, payer: 'practice', xeroContactId: null, emails: input.emails, priceListId: input.priceListId, limit: input.limit, paused: false, currency: input.currency, country: input.country, som: 'inherit' };
      s.accounts.push(acc);
      ensureXeroContact(s, acc, input.xero ?? undefined);
      // Cases already in the list for this practice bill here now.
      for (const c of billingCases().filter(c => c.practice === name)) reassignCases(s, c.dentist);
      return { id };
    }
    if (!input.practices.length) return { error: 'Link at least one practice' };
    const id = dentistAccountId(name);
    let acc = account(s, id);
    if (!acc) { acc = { id, kind: 'dentist', name, payer: input.payer, xeroContactId: null, emails: input.emails, priceListId: null, limit: null, paused: false, currency: input.currency, country: 'United Kingdom', som: 'inherit' }; s.accounts.push(acc); }
    Object.assign(acc, { practices: input.practices, scope: input.kind === 'floating' || input.practices.length > 1 ? 'floating' : 'single', payer: input.kind === 'floating' ? 'dentist' : input.payer, emails: input.emails.length ? input.emails : acc.emails, currency: input.currency });
    input.practices.forEach(p => ensurePracticeAccount(s, p));
    if (acc.payer === 'dentist') ensureXeroContact(s, acc, input.xero ?? undefined);
    reassignCases(s, name);
    return { id };
  });
}

/** Which practices a dentist works at (one = single, several = floating). */
export function setDentistPractices(dentist: string, practices: string[]) {
  return update(s => {
    const acc = account(s, dentistAccountId(dentist)); if (!acc) return 0;
    acc.practices = [...new Set(practices)];
    acc.scope = acc.practices.length > 1 ? 'floating' : 'single';
    acc.practices.forEach(p => ensurePracticeAccount(s, p));
    return reassignCases(s, dentist);
  });
}
export function linkDentist(practice: string, dentist: string) {
  return update(s => {
    const name = dentist.trim(); if (!name) return 0;
    let acc = account(s, dentistAccountId(name));
    if (!acc) { acc = { id: dentistAccountId(name), kind: 'dentist', name, practices: [], scope: 'single', payer: 'practice', xeroContactId: null, emails: [], priceListId: null, limit: null, paused: false, currency: 'GBP', country: 'United Kingdom', som: 'inherit' }; s.accounts.push(acc); }
    acc.practices = [...new Set([...(acc.practices ?? []), practice])];
    acc.scope = acc.practices.length > 1 ? 'floating' : 'single';
    return reassignCases(s, name);
  });
}
export function unlinkDentist(practice: string, dentist: string) {
  return update(s => {
    const acc = account(s, dentistAccountId(dentist)); if (!acc) return 0;
    acc.practices = (acc.practices ?? []).filter(p => p !== practice);
    acc.scope = acc.practices.length > 1 ? 'floating' : 'single';
    return reassignCases(s, dentist);
  });
}

export function resendAccountEmail(accountId: string) {
  update(s => {
    const acc = account(s, accountId); if (!acc?.bounced?.length) return;
    for (const b of acc.bounced) s.emails.unshift({ id: uid('em'), at: today(), to: acc.emails, subject: `${b.what} (resent)`, what: 'statement', ref: acc.id });
    acc.bounced = [];
  });
}

// ── Catalog, pricing ──────────────────────────────────────────────────────────

/**
 * Edit an item. Price changes are recorded with the date they apply from
 * (default today), so cases received earlier keep their price and a future
 * change can be scheduled.
 */
export function updateItem(id: string, patch: Partial<CatalogItem>, opts: { from?: string; note?: string } = {}) {
  update(s => {
    const it = s.catalog.find(i => i.id === id); if (!it) return;
    const { nhs, priv, ...rest } = patch;
    Object.assign(it, rest);
    if ('nhs' in patch || 'priv' in patch) setPrices(it, { nhs: 'nhs' in patch ? nhs ?? null : undefined, priv: 'priv' in patch ? priv ?? null : undefined }, opts.from ?? today(), opts.note);
    if (rest.department && !s.departments.some(d => d.name === rest.department)) addDepartment(s, rest.department);
    s.invoices.forEach(i => refreshInvoice(s, i));
  });
}

function setPrices(it: CatalogItem, next: { nhs?: number | null; priv?: number | null }, from: string, note?: string) {
  const cur = pricesOn(it, from);
  const nhs = next.nhs === undefined ? cur.nhs : next.nhs;
  const priv = next.priv === undefined ? cur.priv : next.priv;
  if (nhs === cur.nhs && priv === cur.priv) return false;
  // An item never priced before (or priced from today with no history) just takes the price.
  if (!it.priceHistory?.length && from <= today() && cur.nhs == null && cur.priv == null) { it.nhs = nhs; it.priv = priv; return true; }
  it.priceHistory = [...(it.priceHistory ?? []).filter(h => h.from !== from), { from, nhs, priv, by: me(), note }].sort((a, b) => a.from.localeCompare(b.from));
  return true;
}

function addDepartment(s: BillingState, name: string) {
  const code = 200 + s.departments.length * 5 + 10;
  s.departments.push({ name, accountCode: `${code} · Sales: ${name}`, taxRate: 'Exempt Income' });
}

/** Add a new catalog item. */
export function addItem(item: Omit<CatalogItem, 'id'>): { id?: string; error?: string } {
  return update(s => {
    const code = item.code.trim().toUpperCase();
    if (!code || !item.name.trim()) return { error: 'Add a code and a name' };
    if (s.catalog.some(i => i.code.toUpperCase() === code)) return { error: `Code ${code} is already used` };
    const id = `it-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    s.catalog.push({ ...item, id, code, name: item.name.trim() });
    if (!s.departments.some(d => d.name === item.department)) addDepartment(s, item.department);
    log(s, 'read', `Catalog: added ${code} ${item.name.trim()}`);
    s.invoices.forEach(i => refreshInvoice(s, i));
    return { id };
  });
}

export function archiveItem(id: string, archived: boolean) {
  update(s => {
    const it = s.catalog.find(i => i.id === id); if (!it) return;
    it.archived = archived;
    s.invoices.forEach(i => refreshInvoice(s, i));
  });
}

export interface BulkChange { department: string; which: 'both' | 'nhs' | 'priv'; pct: number; round: 0.5 | 1 | 5; from: string }

/** What a bulk price change would do, item by item (for the preview). */
export function bulkPreview(s: BillingState, b: BulkChange) {
  const r = (n: number) => Math.round(n / b.round) * b.round;
  return s.catalog.filter(i => !i.archived && !i.passThrough && (b.department === 'all' || i.department === b.department)).map(i => {
    const cur = pricesOn(i, b.from);
    const nhs = b.which !== 'priv' && cur.nhs != null ? r(cur.nhs * (1 + b.pct / 100)) : cur.nhs;
    const priv = b.which !== 'nhs' && cur.priv != null ? r(cur.priv * (1 + b.pct / 100)) : cur.priv;
    return { item: i, cur, nhs, priv, changed: nhs !== cur.nhs || priv !== cur.priv };
  }).filter(x => x.cur.nhs != null || x.cur.priv != null);
}
export function bulkPriceChange(b: BulkChange, note?: string) {
  return update(s => {
    let n = 0;
    for (const x of bulkPreview(s, b)) {
      const it = s.catalog.find(i => i.id === x.item.id)!;
      if (x.changed && setPrices(it, { nhs: x.nhs, priv: x.priv }, b.from, note)) n++;
    }
    log(s, 'read', `Catalog: ${n} price${n === 1 ? '' : 's'} changed ${b.pct > 0 ? '+' : ''}${b.pct}% from ${b.from}`);
    s.invoices.forEach(i => refreshInvoice(s, i));
    return n;
  });
}

export function addItems(items: CatalogItem[]) {
  update(s => {
    for (const it of items) {
      const ex = s.catalog.find(i => i.code === it.code);
      if (!ex) { s.catalog.push(it); if (!s.departments.some(d => d.name === it.department)) addDepartment(s, it.department); continue; }
      const { nhs, priv, id: _id, ...rest } = it;
      void _id;
      Object.assign(ex, rest);
      setPrices(ex, { nhs, priv }, today(), 'CSV import');
    }
    log(s, 'read', `Catalog import: ${items.length} item${items.length === 1 ? '' : 's'}`);
    s.invoices.forEach(i => refreshInvoice(s, i));
  });
}
export function updateDepartment(name: string, patch: { accountCode?: string; taxRate?: string }) {
  update(s => { const d = s.departments.find(x => x.name === name); if (d) Object.assign(d, patch); });
}
export function savePriceList(pl: PriceList) {
  update(s => { const i = s.priceLists.findIndex(p => p.id === pl.id); if (i >= 0) s.priceLists[i] = pl; else s.priceLists.push(pl); s.invoices.forEach(x => refreshInvoice(s, x)); });
}
export function savePromotion(p: Promotion) {
  update(s => { const i = s.promotions.findIndex(x => x.id === p.id); if (i >= 0) s.promotions[i] = p; else s.promotions.push(p); s.invoices.forEach(x => refreshInvoice(s, x)); });
}
export function deletePromotion(id: string) { update(s => { s.promotions = s.promotions.filter(p => p.id !== id); s.invoices.forEach(x => refreshInvoice(s, x)); }); }
export function saveTier(t: VolumeTier) {
  update(s => { const i = s.tiers.findIndex(x => x.id === t.id); if (i >= 0) s.tiers[i] = t; else s.tiers.push(t); s.invoices.forEach(x => refreshInvoice(s, x)); });
}
export function deleteTier(id: string) { update(s => { s.tiers = s.tiers.filter(t => t.id !== id); s.invoices.forEach(x => refreshInvoice(s, x)); }); }

// ── Settings ──────────────────────────────────────────────────────────────────

export function updateSettings(patch: Partial<LabBillingSettings>) {
  update(s => {
    Object.assign(s.settings, patch);
    if ('vatRegistered' in patch || 'courierAddOn' in patch || 'unusualPricePct' in patch) s.invoices.forEach(i => refreshInvoice(s, i));
    if ('limitWarnPct' in patch) s.accounts.forEach(a => checkLimit(s, a.id));
  });
}
export function updateTemplates(t: Templates) { update(s => { s.templates = t; }); }
export function updateMonday(m: MondaySettings) { update(s => { s.monday = m; }); }
export function dismiss(key: string) { update(s => { if (!s.dismissed.includes(key)) s.dismissed.push(key); }); }

// ── Statements ────────────────────────────────────────────────────────────────

/** Build this month's statements as previews (the admin previews before they go). */
export function previewStatements(period = monthOf(today())) {
  return update(s => {
    s.statements = s.statements.filter(x => !(x.period === period && x.status === 'preview'));
    let n = 0;
    for (const a of s.accounts.filter(a => a.kind === 'practice' || a.payer === 'dentist')) {
      if (s.statements.some(x => x.accountId === a.id && x.period === period)) continue;
      const st = buildStatement(s, a.id, period);
      if (!st.invoices.length && Math.abs(st.opening) < 0.005 && !st.payments.length) continue;
      s.statements.push(st); n++;
    }
    log(s, 'read', `Statements for ${period} built from Xero: ${n}`);
    return n;
  });
}
export function sendStatements(period = monthOf(today())) {
  return update(s => {
    let n = 0;
    for (const st of s.statements.filter(x => x.period === period && x.status === 'preview')) {
      const acc = account(s, st.accountId);
      st.status = 'sent'; st.sentAt = today(); n++;
      s.emails.unshift({ id: uid('em'), at: today(), to: acc?.emails ?? [], subject: `Statement for ${period}`, what: 'statement', ref: st.id });
    }
    s.firstStatementPreviewed = true;
    log(s, 'post', `${n} statements for ${period} sent`);
    return n;
  });
}
export const statementDay = (s: BillingState, ym = monthOf(today())) => (s.settings.statementDay === 'first' ? `${ym}-01` : lastWorkingDay(ym));

// ── From the CAD integration ───────────────────────────────────────────────────

/**
 * What was actually designed for a case: the draft invoice is repriced from it,
 * and any difference from the case is flagged for the admin before invoicing.
 * Invoices already sent don't change.
 */
export function applyDesignToBilling(caseId: string, lines: { id: string; itemId: string; fdi: number[] }[], diff: string[]) {
  const c = caseById(caseId);
  update(s => {
    const m = c ? ensureCase(s, c) : s.cases[caseId]; if (!m) return;
    m.designOverride = { lines, diff, at: today() };
    s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i));
    if (diff.length) log(s, 'read', `${caseId}: design differs from the case (${diff.join('; ')}); invoice draft updated`);
  });
}
export function checkDesignDiff(caseId: string) {
  update(s => { const m = s.cases[caseId]; if (m?.designOverride) { m.designOverride.checked = true; s.invoices.filter(i => covers(i, caseId)).forEach(i => refreshInvoice(s, i)); } });
}

// ── Accounting connection ────────────────────────────────────────────────────

export function updateSetup(patch: Partial<SetupState>) { update(s => { Object.assign(s.setup, patch); }); }
export function connectProvider(provider: Provider, org: string) {
  update(s => {
    Object.assign(s.setup, { provider, org });
    // One source of truth for "paid": a connected accounting tool switches the bank connection off.
    if (s.bank) { s.bank = null; log(s, 'read', 'Bank connection switched off: payments now come from the accounting tool'); }
    s.issues = s.issues.filter(x => x.kind !== 'connection-expired');
    log(s, 'read', `Connected to ${PROVIDER_NAME[provider]} organisation "${org}": contacts matched by name and email, sales account and the VAT rate for exempt prostheses preselected, last invoice number read`);
    // Anything approved while disconnected posts now.
    const waiting = s.invoices.filter(i => i.issuedAt && !i.xeroId && i.status !== 'void');
    for (const i of waiting) { i.xeroId = `xr-${i.id.slice(-6)}`; i.timeline.push({ at: today(), text: `Posted to ${PROVIDER_NAME[provider]} on reconnecting` }); }
    if (waiting.length) log(s, 'post', `${waiting.length} invoice${waiting.length === 1 ? '' : 's'} approved while disconnected posted`);
  });
}
export function disconnectProvider() {
  update(s => { log(s, 'read', `Disconnected from ${s.setup.provider ? PROVIDER_NAME[s.setup.provider] : 'the accounting tool'}`); Object.assign(s.setup, { provider: null, org: null }); s.issues = s.issues.filter(x => x.kind === 'bank-unmatched'); });
}

/** Lines a case would invoice with now (for the Billing tab before an invoice exists). */
export function previewLines(caseId: string) {
  const s = getBilling(); const c = caseById(caseId); const m = s.cases[caseId];
  if (!c || !m) return { lines: [], flags: [] };
  const lines = linesFor(s, c, m);
  return { lines, flags: flagsFor(s, c, m, { id: 'preview', lines, accountId: m.accountId }) };
}

// ── V1 (simpler Billing) ─────────────────────────────────────────────────────

/**
 * A practice that arrived with a scan: someone checks who to bill. Its waiting
 * invoices lose the "new practice" flag and, if nothing else is wrong, go out.
 */
export function confirmPractice(accountId: string, patch: { emails: string[]; invoiceMode: 'per-case' | 'month-end'; termsDays: number | null; xero?: string | null }, sendNow = true) {
  return update(s => {
    const acc = account(s, accountId); if (!acc) return 0;
    Object.assign(acc, { emails: patch.emails, invoiceMode: patch.invoiceMode, termsDays: patch.termsDays, confirmedAt: today() });
    if (s.setup.provider && !acc.xeroContactId) ensureXeroContact(s, acc, patch.xero ?? undefined);
    let sent = 0;
    for (const inv of s.invoices.filter(i => i.accountId === accountId && (i.status === 'draft' || i.status === 'flagged'))) {
      inv.flags = inv.flags.filter(f => f.message !== NEW_PRACTICE_FLAG(acc.name));
      refreshInvoice(s, inv);
      inv.status = inv.flags.length ? 'flagged' : 'draft';
      inv.timeline.push({ at: today(), text: `${acc.name} confirmed by ${me()}` });
      if (sendNow && !inv.flags.length) { approve(s, inv, today(), me()); sent++; }
    }
    log(s, 'contact', `${acc.name} confirmed: invoices to ${patch.emails.join(', ') || 'no address'}`);
    return sent;
  });
}

/** Send (or resend) one account's statement for a month: built fresh from the tool. */
export function sendStatementFor(accountId: string, period = monthOf(today())) {
  return update(s => {
    const acc = account(s, accountId); if (!acc) return null;
    s.statements = s.statements.filter(x => !(x.accountId === accountId && x.period === period && x.status === 'preview'));
    const old = s.statements.find(x => x.accountId === accountId && x.period === period);
    const st = old ?? buildStatement(s, accountId, period);
    st.status = 'sent'; st.sentAt = today();
    if (!old) s.statements.push(st);
    s.emails.unshift({ id: uid('em'), at: today(), to: acc.emails, subject: `Statement for ${period}${old ? ' (resent)' : ''}`, what: 'statement', ref: st.id });
    if (acc.bounced) acc.bounced = [];
    log(s, 'post', `Statement for ${period} sent to ${acc.name}`);
    return st.id;
  });
}

/** Send chosen invoices again, to the account's billing email or another address. */
export function sendInvoices(ids: string[], to?: string[]) {
  return update(s => {
    let n = 0;
    for (const id of ids) {
      const inv = s.invoices.find(i => i.id === id); if (!inv?.number) continue;
      const acc = account(s, inv.accountId);
      const addr = to?.length ? to : acc?.emails ?? [];
      s.emails.unshift({ id: uid('em'), at: today(), to: addr, subject: `Invoice ${inv.number} (copy)`, what: 'invoice', ref: inv.id });
      inv.timeline.push({ at: today(), text: `Copy sent to ${addr.join(', ')}` });
      n++;
    }
    return n;
  });
}

/** Account-based pricing: set (or clear) this account's own price for one item. */
export function setAccountPrice(accountId: string, itemId: string, price: { nhs?: number; priv?: number } | null) {
  update(s => {
    const acc = account(s, accountId); if (!acc) return;
    let pl = acc.priceListId ? s.priceLists.find(p => p.id === acc.priceListId) : undefined;
    if (!pl) { pl = { id: uid('pl'), name: `${acc.name} prices`, prices: {} }; s.priceLists.push(pl); acc.priceListId = pl.id; }
    if (price && (price.nhs != null || price.priv != null)) pl.prices[itemId] = price; else delete pl.prices[itemId];
    s.invoices.filter(i => i.accountId === accountId).forEach(i => refreshInvoice(s, i));
  });
}

/** Account-based pricing: a percentage off the standard price, on every item (rounded to 50p). */
export function setAccountDiscount(accountId: string, pct: number) {
  update(s => {
    const acc = account(s, accountId); if (!acc) return;
    let pl = acc.priceListId ? s.priceLists.find(p => p.id === acc.priceListId) : undefined;
    if (!pl) { pl = { id: uid('pl'), name: `${acc.name} prices`, prices: {} }; s.priceLists.push(pl); acc.priceListId = pl.id; }
    const r = (n: number | null) => (n == null ? undefined : Math.round(n * (1 - pct / 100) * 2) / 2);
    for (const it of s.catalog.filter(i => !i.archived && !i.passThrough)) pl.prices[it.id] = { nhs: r(it.nhs), priv: r(it.priv) };
    s.invoices.filter(i => i.accountId === accountId).forEach(i => refreshInvoice(s, i));
  });
}

/** Use the lab's standard prices again (or another practice's list). */
export function usePriceList(accountId: string, listId: string | null) {
  update(s => { const acc = account(s, accountId); if (!acc) return; acc.priceListId = listId; s.invoices.filter(i => i.accountId === accountId).forEach(i => refreshInvoice(s, i)); });
}

/** Demo: a scan arrives from a practice the lab hasn't billed before. */
export function simulateScanFromNewPractice() {
  const names = ['Harbour View Dental', 'Oakfield Family Dentistry', 'The Smile Studio Bath'];
  return update(s => { const name = names.find(n => !s.accounts.some(a => a.name === n)) ?? `New Practice ${s.accounts.length}`; addScanPractice(s, name, 'Dr. Mensah'); return name; });
}

/** V2 workflow: a service line was Delivered → its own invoice. Returns the invoice number (or "draft"). */
export function invoiceServiceLine(caseId: string, siId: string): { id: string; number: string | null } | null {
  const c = caseById(caseId);
  if (!c) return null;
  return update(s => {
    const meta = ensureCase(s, c);
    const inv = createLineInvoice(s, c, meta, siId);
    return inv ? { id: inv.id, number: inv.number } : null;
  });
}
