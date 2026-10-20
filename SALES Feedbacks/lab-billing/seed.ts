import type { Case } from '../../src/app/pages/CasesPage';
import { parseCaseDate } from '../../src/app/data/rescanDetection';
import { getIntakeConfig } from '../intake-form/intakeStore';
import type { BillingState, CatalogItem, Department } from './types';
import { billingCases, buildStatement, dentistAccountId, exposure, IN_PROGRESS, isDispatched, practiceAccountId } from './engine';
import { addDays, endOfMonth, fmtMonth as fmtMonthName, hash, lastWorkingDay, monthOf, prevMonth, round2, startOfMonth, today } from './format';
import { applyRemake, approve, createInvoice, ensureCase, ensurePracticeAccount, log, pay, skipsInvoice, syncAll } from './ops';

// ── The Billing demo ─────────────────────────────────────────────────────────
// Built from the Growth case list. The lab went live on Smile Genius 75 days
// ago: cases dispatched before then were billed by the old system (some still
// owed in Xero), everything after was invoiced here. Cases in the list get
// recent billing dates, and five months of completed cases (no longer in the
// list) give the history. A few exceptions are left for the admin.

export const BILLING_VERSION = 14;

/** The dentist in the demo who pays their own bills. */
export const DIRECT_DENTIST = 'Dr. Campbell';

const CATALOG: CatalogItem[] = [
  { id: 'crn', code: 'CB-CRN', name: 'Crown', department: 'Crown & Bridge', unit: 'per unit', nhs: 95, priv: 185, staged: 'end', vat: 'exempt' },
  { id: 'ven', code: 'CB-VEN', name: 'Veneers', department: 'Crown & Bridge', unit: 'per unit', nhs: null, priv: 295, staged: 'end', vat: 'exempt' },
  { id: 'inl', code: 'CB-INL', name: 'Inlay/Onlay', department: 'Crown & Bridge', unit: 'per unit', nhs: 80, priv: 160, staged: 'end', vat: 'exempt' },
  { id: 'pcc', code: 'CB-PCC', name: 'Post & Core Crown', department: 'Crown & Bridge', unit: 'per unit', nhs: 110, priv: 210, staged: 'end', vat: 'exempt' },
  { id: 'brg', code: 'CB-BRG', name: 'Bridge', department: 'Crown & Bridge', unit: 'per unit', nhs: 90, priv: 175, staged: 'end', vat: 'exempt' },
  { id: 'abt', code: 'IMP-ABT', name: 'Implant Abutment', department: 'Implants', unit: 'per unit', nhs: null, priv: 240, staged: 'end', vat: 'exempt' },
  { id: 'src', code: 'IMP-SRC', name: 'Screw-Retained Crown', department: 'Implants', unit: 'per unit', nhs: null, priv: 395, staged: 'end', vat: 'exempt' },
  { id: 'imp-parts', code: 'IMP-CMP', name: 'Implant components', department: 'Implants', unit: 'per item', nhs: null, priv: null, staged: 'end', vat: 'exempt', passThrough: { rule: 'cost-plus', value: 25, showPart: true } },
  { id: 'aln', code: 'ORT-ALN', name: 'Clear Aligners', department: 'Orthodontics', unit: 'per case', nhs: null, priv: 950, staged: 'end', vat: 'exempt', stages: [{ name: 'Phase 1', price: 500 }, { name: 'Phase 2', price: 450 }] },
  { id: 'ret', code: 'ORT-RET', name: 'Retainer', department: 'Orthodontics', unit: 'per arch', nhs: 45, priv: 90, staged: 'end', vat: 'exempt' },
  { id: 'fden', code: 'DEN-FUL', name: 'Full Denture', department: 'Dentures', unit: 'per arch', nhs: 180, priv: 420, staged: 'end', vat: 'exempt', stages: [{ name: 'Special Tray', price: 35 }, { name: 'Bite Registration', price: 60 }, { name: 'Try In', price: 85 }, { name: 'Retry', price: 45 }, { name: 'Finish', price: 240 }] },
  { id: 'pden', code: 'DEN-PAR', name: 'Partial Denture', department: 'Dentures', unit: 'per arch', nhs: 150, priv: 360, staged: 'each', vat: 'exempt', stages: [{ name: 'Special Tray', price: 30 }, { name: 'Bite Registration', price: 55 }, { name: 'Try In', price: 75 }, { name: 'Retry', price: 40 }, { name: 'Finish', price: 200 }] },
  { id: 'iden', code: 'DEN-IMM', name: 'Immediate Denture', department: 'Dentures', unit: 'per arch', nhs: 140, priv: 320, staged: 'end', vat: 'exempt' },
  { id: 'ng', code: 'APP-NG', name: 'Night Guard', department: 'Appliances', unit: 'per arch', nhs: 55, priv: 120, staged: 'end', vat: 'exempt' },
  { id: 'wt', code: 'APP-WT', name: 'Whitening Tray', department: 'Appliances', unit: 'per arch', nhs: null, priv: 85, staged: 'end', vat: 'standard' },
  { id: 'spl', code: 'APP-SPL', name: 'Splint', department: 'Appliances', unit: 'per arch', nhs: 70, priv: 140, staged: 'end', vat: 'exempt' },
  { id: 'oth', code: 'OTH', name: 'Other', department: 'Other', unit: 'per item', nhs: null, priv: null, staged: 'end', vat: 'exempt' },
  { id: 'cour', code: 'COUR', name: 'Courier & pick-up', department: 'Other', unit: 'per case', nhs: 8.5, priv: 8.5, staged: 'end', vat: 'standard' },
];

const DEPARTMENTS: Department[] = [
  { name: 'Crown & Bridge', accountCode: '200 · Sales: Crown & Bridge', taxRate: 'Exempt Income' },
  { name: 'Implants', accountCode: '205 · Sales: Implants', taxRate: 'Exempt Income' },
  { name: 'Orthodontics', accountCode: '210 · Sales: Orthodontics', taxRate: 'Exempt Income' },
  { name: 'Dentures', accountCode: '220 · Sales: Dentures', taxRate: 'Exempt Income' },
  { name: 'Appliances', accountCode: '230 · Sales: Appliances', taxRate: 'Exempt Income' },
  { name: 'Other', accountCode: '240 · Sales: Other', taxRate: 'Exempt Income' },
];

/** Payment habit per account (days from invoice to payment), drifting for the slow payer. */
function payDays(accountId: string, issued: string, todayIso: string): number | null {
  const age = (new Date(todayIso).getTime() - new Date(issued).getTime()) / 86_400_000;
  const h = hash(accountId + issued);
  if (accountId === practiceAccountId('Smile Genius Birmingham 2')) return age > 70 ? 28 + (h % 6) : null; // stopped paying
  if (accountId === practiceAccountId('Smile Genius Glasgow')) return Math.round(22 + (75 - Math.min(75, age)) * 0.55) + (h % 4); // slower each month
  return 16 + (h % 18);
}

export function seedBilling(): BillingState {
  const t = today();
  const live = addDays(t, -90);
  const lab = getIntakeConfig().labName;
  const s: BillingState = {
    version: BILLING_VERSION,
    settings: {
      vatRegistered: false, vatNumber: 'GB 284 1937 62', invoiceOn: 'dispatched', approval: 'review-30', statementDay: 'last-working',
      terms: '30', customTermsDays: 45, som: 'per-account', warrantyRemakes: 'none', prefix: 'INV-',
      limitWarnPct: 80, unusualPricePct: 20, remakeDays: 30, notBilledDays: 2, passThroughMarkupPct: 25, courierAddOn: false,
    },
    setup: { provider: 'xero', org: `${lab} Ltd`, plan: 'standard', steps: { connect: true, import: true, match: true, date: true, wip: true, test: true }, switchOver: live, liveAt: live, testInvoiceId: null },
    accounts: [], catalog: CATALOG.map(i => ({ ...i })), departments: DEPARTMENTS.map(d => ({ ...d })),
    priceLists: [{ id: 'pl-london', name: 'London Central agreed prices', prices: { crn: { priv: 165, nhs: 92 }, ven: { priv: 275 } } }],
    promotions: [], tiers: [], orderTypeMap: {}, cases: {}, invoices: [], xeroOnly: [], statements: [], sync: [], emails: [],
    templates: {
      invoice: { subject: 'Invoice {number} from {lab} · {patient}', body: 'Hello {account},\n\nPlease find invoice {number} for {patient} (case {case}), {amount}, due {due}.\n\nYou can also see it in your Smile Genius invoices.\n\nThank you,\n{lab}' },
      statement: { subject: '{lab} statement for {month}', body: 'Hello {account},\n\nYour statement for {month} is attached. Balance due: {balance}, of which {overdue} is overdue.\n\nThank you,\n{lab}' },
      limit: { subject: 'Your account with {lab}', body: 'Hello {account},\n\nYour account has reached its limit of {limit}, so new cases are on hold until a payment is received. Cases already in progress carry on as normal.\n\nPlease get in touch if you have any questions.\n{lab}' },
    },
    monday: { enabled: true, to: 'owner@brightsmilelab.co.uk', time: '07:30' },
    nextNumber: 2418, firstStatementPreviewed: true, dismissed: [],
  };
  log(s, 'read', `Connected to Xero organisation "${lab} Ltd": 214 contacts, 18 account codes, 6 tax rates; last invoice INV-2417`, addDays(live, -3));

  const cases = billingCases().filter(c => !c.archived);
  // Billing dates for the cases in the list: work in progress arrived in the
  // last four weeks, dispatched cases in the last two months (kept in the
  // list's own order).
  const order = [...cases].sort((a, b) => parseCaseDate(a.createdAt).getTime() - parseCaseDate(b.createdAt).getTime()).map(c => c.id);
  const received = (c: Case) => {
    const r = order.indexOf(c.id) / Math.max(1, order.length - 1);
    return isDispatched(s, c) ? addDays(t, -Math.round(60 - r * 45)) : addDays(t, -Math.round(28 - r * 26));
  };

  // Accounts: every practice, every dentist (one pays directly), and an Irish practice in EUR.
  const practices = [...new Set(cases.map(c => c.practice).filter(Boolean))];
  practices.forEach(p => ensurePracticeAccount(s, p));
  const dentists = [...new Set(cases.map(c => c.dentist).filter(Boolean))];
  for (const d of dentists) {
    const mine = cases.filter(c => c.dentist === d);
    const home = [...mine.reduce((m, c) => m.set(c.practice, (m.get(c.practice) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];
    s.accounts.push({
      id: dentistAccountId(d), kind: 'dentist', name: d,
      // The direct payer floats: their own practice plus Leeds.
      practices: d === DIRECT_DENTIST ? [...new Set([home ?? 'Smile Genius Glasgow', 'Smile Genius Leeds'])] : home ? [home] : [],
      scope: d === DIRECT_DENTIST ? 'floating' : 'single',
      payer: d === DIRECT_DENTIST ? 'dentist' : 'practice',
      xeroContactId: d === DIRECT_DENTIST ? 'xc-campbell' : null, xeroContactName: d === DIRECT_DENTIST ? 'Dr Fiona Campbell' : undefined,
      emails: [`${d.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@smilegenius.com`], priceListId: null, limit: null, paused: false, currency: 'GBP', country: 'United Kingdom', som: 'inherit',
    });
  }
  ensurePracticeAccount(s, 'Smile Genius Dublin');
  Object.assign(s.accounts.find(a => a.id === practiceAccountId('Smile Genius Dublin'))!, { currency: 'EUR', country: 'Ireland', emails: ['accounts@sgdublin.ie'] });
  Object.assign(s.accounts.find(a => a.id === practiceAccountId('Smile Genius London Central')) ?? {}, { priceListId: 'pl-london' });
  Object.assign(s.accounts.find(a => a.id === practiceAccountId('Smile Genius Manchester')) ?? {}, { som: 'on' });
  const leeds = s.accounts.find(a => a.id === practiceAccountId('Smile Genius Leeds'));
  log(s, 'contact', `Matched ${practices.length} practices and 1 dentist to Xero contacts; created "Smile Genius Dublin" (EUR)`, addDays(live, -2));

  // Billing records, in the order cases arrived.
  const sorted = [...cases].sort((a, b) => received(a).localeCompare(received(b)));
  for (const c of sorted) {
    const m = ensureCase(s, c, received(c));
    m.receivedAt = received(c);
    if (c.source === 'scanner') {
      m.scannerOrderType = `${c.scanner} · ${c.serviceItems?.[0]?.name ?? c.services[0]}`;
      m.scannerItemId = c.serviceItems?.[0]?.id;
      s.orderTypeMap[m.scannerOrderType] = CATALOG.find(i => i.name === (c.serviceItems?.[0]?.name ?? c.services[0]))?.id ?? 'oth';
    }
    if (isDispatched(s, c)) m.dispatchedAt = [addDays(m.receivedAt, 7 + (hash(c.id) % 9)), addDays(t, -1)].sort()[0];
  }
  // Possible remakes: same patient and item within the remake window.
  for (const c of sorted) {
    const m = s.cases[c.id];
    // Judged on the cases' own creation dates (the mock list reuses patient names).
    const made = (x: Case) => parseCaseDate(x.createdAt).getTime();
    const earlier = sorted.find(o => o.id !== c.id && o.patientName === c.patientName && o.services[0] === c.services[0] && made(o) <= made(c) && made(c) - made(o) <= s.settings.remakeDays * 86_400_000);
    if (earlier) m.remakeOf = earlier.id;
  }

  // Five months of completed cases that are no longer in the list.
  const history = historyCases(s, sorted, t);

  // The exceptions left for the admin, all among recently dispatched cases.
  // The latest dispatches (moved into the last week) carry them.
  const recent = sorted.filter(c => s.cases[c.id].dispatchedAt && (c.serviceItems?.length ?? 0) > 0 && !s.cases[c.id].remakeOf).sort((a, b) => s.cases[b.id].dispatchedAt!.localeCompare(s.cases[a.id].dispatchedAt!));
  const used = new Set<string>();
  const pick = (fn: (c: Case) => boolean) => { const c = recent.find(x => fn(x) && !used.has(x.id)); if (c) { used.add(c.id); s.cases[c.id].dispatchedAt = addDays(t, -(1 + used.size)); } return c; };
  const notBilled = [pick(() => true), pick(() => true)].filter(Boolean) as Case[];
  notBilled.forEach((c, i) => { Object.assign(s.cases[c.id], { skipAuto: true, dispatchedAt: addDays(t, -(3 + i * 2)) }); });
  const common = (c: Case) => ['Crown', 'Night Guard', 'Retainer', 'Bridge', 'Veneers'].includes(c.serviceItems[0]?.name);
  // Unusual price: needs earlier invoices for the same account, item and NHS/private.
  const hasHistory = (c: Case) => history.filter(h => s.cases[h.id].accountId === s.cases[c.id].accountId && h.services[0] === c.serviceItems[0]?.name && h.serviceItems[0].orderType === c.serviceItems[0]?.orderType).length >= 2;
  const unusual = pick(c => common(c) && hasHistory(c)) ?? pick(hasHistory) ?? pick(common);
  const unclear = pick(c => c.source !== 'scanner') ?? pick(() => true);
  if (unclear) s.cases[unclear.id].kindUnclear = true;
  const unmapped = pick(c => c.source === 'scanner') ?? pick(() => true);
  if (unmapped) { const ot = `${unmapped.scanner ?? '3Shape'} · Monolithic Zr ${unmapped.services[0]} (full contour)`; Object.assign(s.cases[unmapped.id], { scannerOrderType: ot, scannerItemId: unmapped.serviceItems[0]?.id }); }
  if (unusual) {
    const si = unusual.serviceItems[0];
    const item = CATALOG.find(i => i.name === si.name);
    const base = (si.orderType === 'NHS' ? item?.nhs ?? item?.priv : item?.priv) ?? 100;
    s.cases[unusual.id].lineOverrides = { [si.id]: { price: round2(base * 0.6), reason: 'Agreed by phone with the practice', by: 'Sajid Mahmood' } };
  }
  const flaggedOnPurpose = new Set([unclear?.id, unmapped?.id, unusual?.id].filter(Boolean) as string[]);

  // Pricing extras (v3), in force before the history so invoices show them: an
  // October promotion, a volume tier, and a crown price rise 20 days ago (price lock).
  s.promotions.push({ id: 'pr-ng', name: `Night guards, ${new Date().toLocaleDateString('en-GB', { month: 'long' })}`, from: startOfMonth(t), to: endOfMonth(t), scope: { kind: 'items', ids: ['ng'] }, type: 'percent', value: 15, active: true });
  s.tiers.push({ id: 'tier-2', name: 'Tier 2 (30+ units last month)', minUnits: 30, percentOff: 5, active: true });
  const crown = s.catalog.find(i => i.id === 'crn')!;
  // Crown went up 20 days ago (cases received before keep £175), and a rise is scheduled for next month.
  Object.assign(crown, { nhs: 95, priv: 175, priceHistory: [{ from: addDays(t, -20), nhs: 95, priv: 185, by: 'Sajid Mahmood' }, { from: startOfMonth(addDays(endOfMonth(t), 1)), nhs: 98, priv: 195, by: 'Sajid Mahmood', note: 'Zirconia cost rise' }] });

  // History: walk dispatches in date order through the same steps as live use.
  const dispatched = [...sorted, ...history].filter(c => s.cases[c.id].dispatchedAt).sort((a, b) => s.cases[a.id].dispatchedAt!.localeCompare(s.cases[b.id].dispatchedAt!));
  let oldNo = 2310;
  for (const c of dispatched) {
    const m = s.cases[c.id];
    const at = m.dispatchedAt!;
    if (at < live) {
      m.billedElsewhere = true;
      // Some old-system invoices are still owed: they stay in Xero.
      if (at >= addDays(live, -50) && hash(c.id) % 3 === 0) {
        const amt = round2((c.serviceItems ?? []).reduce((n, si) => n + ((si.orderType === 'NHS' ? CATALOG.find(i => i.name === si.name)?.nhs : CATALOG.find(i => i.name === si.name)?.priv) ?? 120) * Math.max(1, Math.min(4, si.fdi?.length ?? 1)), 0));
        s.xeroOnly.push({ number: `INV-${oldNo++}`, accountId: m.accountId, date: at, due: addDays(at, 30), amount: amt, paid: 0, currency: 'GBP', from: 'old-system' });
      }
      continue;
    }
    if (m.skipAuto) continue;
    if (m.remakeOf) {
      applyRemake(s, c, m, hash(c.id) % 3 ? 'no-charge' : 'charge');
      if (skipsInvoice(s, m)) continue; // remake under warranty: no invoice
    }
    const inv = createInvoice(s, c, m, at);
    if (!flaggedOnPurpose.has(c.id) && (inv.status === 'draft' || inv.status === 'flagged')) {
      // Reviewed by the admin the next working day during the first 30 days.
      if (inv.status === 'flagged') { inv.flags = []; inv.status = 'draft'; }
      approve(s, inv, [addDays(at, 1), t].sort()[0], 'Sajid Mahmood');
    }
  }
  // Staged items billed per stage (the partial denture's finished stages).
  syncAll(s, t);
  for (const inv of s.invoices) if (inv.stage && inv.status === 'draft') approve(s, inv, inv.createdAt, 'Sajid Mahmood');

  // Payments read back from Xero, by each account's habit.
  for (const inv of [...s.invoices].reverse()) {
    if (!inv.issuedAt || inv.status === 'void') continue;
    const d = payDays(inv.accountId, inv.issuedAt, t);
    if (d == null) continue;
    const at = addDays(inv.issuedAt, d);
    if (at > t) continue;
    if (hash(inv.id) % 11 === 0) pay(s, inv, round2(inv.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0) / 2), at);
    else pay(s, inv, 1e9, at);
  }
  // Older old-system balances: mostly paid in Xero since.
  for (const x of s.xeroOnly) if (hash(x.number) % 2 && x.accountId !== practiceAccountId('Smile Genius Birmingham 2')) x.paid = x.amount;

  // A credit note on one paid invoice (a shade adjustment).
  const cnTarget = s.invoices.find(i => i.status === 'paid' && i.lines.length > 0 && i.issuedAt! < addDays(t, -20));
  if (cnTarget) {
    const amt = round2(cnTarget.lines[0].unitPrice * 0.25);
    cnTarget.creditNotes.push({ id: 'cn-seed', number: `CN-${s.nextNumber++}`, at: addDays(cnTarget.issuedAt!, 9), amount: amt, reason: 'Shade adjustment agreed with the practice', full: false });
    cnTarget.timeline.push({ at: addDays(cnTarget.issuedAt!, 9), text: `Credit note for ${amt.toFixed(2)}: shade adjustment, posted to Xero` });
    log(s, 'credit', `Credit note on ${cnTarget.number} posted`, addDays(cnTarget.issuedAt!, 9));
  }

  // Dublin (EUR): one old-system balance and a recent Smile Genius invoice.
  const dub = practiceAccountId('Smile Genius Dublin');
  s.xeroOnly.push({ number: 'INV-2401', accountId: dub, date: addDays(live, -12), due: addDays(live, 18), amount: 1240, paid: 0, currency: 'EUR', from: 'old-system' });
  const ieCase = { id: 'SG-IE-0412', patientName: 'Aoife Byrne', practice: 'Smile Genius Dublin', dentist: 'Dr. Ní Bhriain', services: ['Crown', 'Night Guard'], serviceItems: [{ id: 'ie-1', name: 'Crown', status: 'shipped', deliveryDate: null, fdi: [21, 22], material: 'E.max', orderType: 'Private' }, { id: 'ie-2', name: 'Night Guard', status: 'shipped', deliveryDate: null, fdi: [11, 21], orderType: 'Private' }] } as unknown as Case;
  s.cases[ieCase.id] = { caseId: ieCase.id, accountId: dub, receivedAt: addDays(t, -16), dispatchedAt: addDays(t, -6) };
  const ie = createInvoice(s, ieCase, s.cases[ieCase.id], addDays(t, -6));
  if (ie.status !== 'sent') approve(s, ie, addDays(t, -6), 'Sajid Mahmood');

  // Limits: Birmingham 2 has stopped paying and is paused; Manchester is approaching.
  const b2 = s.accounts.find(a => a.id === practiceAccountId('Smile Genius Birmingham 2'));
  if (b2) {
    const ex = exposure(s, b2.id);
    b2.limit = { amount: Math.max(1000, Math.floor(ex.total * 0.9 / 500) * 500), overdueDays: 60, atLimit: 'pause', tellPractice: true, message: '' };
    b2.paused = true;
    const wip = sorted.filter(c => s.cases[c.id].accountId === b2.id && IN_PROGRESS.includes(c.status)).sort((a, b) => s.cases[b.id].receivedAt.localeCompare(s.cases[a.id].receivedAt));
    const held = wip.filter(c => ['submitted', 'new', 'sent-for-review'].includes(c.status));
    (held.length ? held : wip.slice(0, 2)).forEach(c => { s.cases[c.id].held = true; s.cases[c.id].heldAt = addDays(t, -4); });
    s.emails.unshift({ id: 'em-b2-hold', at: addDays(t, -4), to: b2.emails, subject: `Your account with ${lab}`, what: 'limit', ref: b2.id });
    log(s, 'read', `Smile Genius Birmingham 2 reached its limit: new cases on hold`, addDays(t, -4));
  }
  const man = s.accounts.find(a => a.id === practiceAccountId('Smile Genius Manchester'));
  if (man) {
    const ex = exposure(s, man.id);
    man.limit = { amount: Math.ceil(ex.total / 0.86 / 500) * 500, overdueDays: null, atLimit: 'notify', tellPractice: false, message: '' };
  }

  // Last month's statements went out on the statement day.
  const last = prevMonth(monthOf(t));
  for (const a of s.accounts.filter(a => a.kind === 'practice' || a.payer === 'dentist')) {
    const st = buildStatement(s, a.id, last);
    if (!st.invoices.length && !st.opening && !st.payments.length) continue;
    st.status = 'sent'; st.sentAt = lastWorkingDay(last); st.createdAt = lastWorkingDay(last);
    s.statements.push(st);
    s.emails.push({ id: `em-st-${a.id}`, at: st.sentAt, to: a.emails, subject: `Statement for ${last}`, what: 'statement', ref: st.id, bounced: a.id === leeds?.id });
  }
  log(s, 'read', `Statements for ${last} built from Xero (including old-system balances) and sent`, lastWorkingDay(last));
  // Leeds' statement email bounced (its accounts address changed).
  if (leeds) leeds.bounced = [{ at: lastWorkingDay(last), email: leeds.emails[0], what: `Statement for ${fmtMonthName(last)}` }];
  s.emails.sort((a, b) => b.at.localeCompare(a.at));
  s.sync.sort((a, b) => b.at.localeCompare(a.at));
  return s;
}

const FIRST = ['Olivia', 'Noah', 'Ava', 'Leo', 'Grace', 'Harry', 'Freya', 'Jack', 'Isla', 'George', 'Poppy', 'Arthur', 'Ruby', 'Oscar', 'Lily', 'Theo', 'Evie', 'Finn', 'Rosie', 'Alfie'];
const LAST = ['Patel', 'Hughes', 'Evans', 'Walsh', 'Kelly', 'Begum', 'Clarke', 'Lewis', 'Murray', 'Hall', 'Ward', 'Turner', 'Moore', 'Wright', 'Scott', 'Green', 'Baker', 'Hill', 'Wood', 'Cooper'];
const MIX: [string, number][] = [['Crown', 30], ['Bridge', 8], ['Veneers', 8], ['Night Guard', 14], ['Retainer', 10], ['Inlay/Onlay', 6], ['Full Denture', 6], ['Immediate Denture', 3], ['Clear Aligners', 5], ['Splint', 5], ['Whitening Tray', 3], ['Post & Core Crown', 2]];
const MATERIALS: Record<string, string> = { Crown: 'Zirconia', Bridge: 'PFM', Veneers: 'E.max', 'Inlay/Onlay': 'E.max', 'Post & Core Crown': 'PFM' };

/** Completed cases from the last five months, billed through the same steps (history only). */
function historyCases(s: BillingState, listCases: Case[], t: string): Case[] {
  const weights: Record<string, number> = {};
  for (const a of s.accounts) if (a.kind === 'practice' || a.payer === 'dentist') weights[a.id] = 0.5;
  const set = (name: string, w: number, dentist = false) => { const id = dentist ? dentistAccountId(name) : practiceAccountId(name); if (id in weights) weights[id] = w; };
  set('Smile Genius Manchester', 1.1); set('Smile Genius London Central', 0.8); set('Smile Genius Birmingham 1', 0.6); set('Smile Genius Birmingham 2', 0.55);
  set('Smile Genius Glasgow', 0.6); set('Smile Genius Leeds', 1.0); set('Smile Genius Belfast', 0.45); set(DIRECT_DENTIST, 0.35, true); set('Smile Genius Dublin', 0);
  const dentistsAt = (practice: string) => {
    const ds = [...new Set(listCases.filter(c => c.practice === practice && c.dentist !== DIRECT_DENTIST).map(c => c.dentist))];
    return ds.length ? ds : ['Dr. Patel', 'Dr. Hughes'];
  };
  const out: Case[] = [];
  let n = 0;
  const pickSvc = (h: number) => { let r = h % MIX.reduce((x, [, w]) => x + w, 0); for (const [name, w] of MIX) { if (r < w) return name; r -= w; } return 'Crown'; };
  for (let day = 150; day >= 8; day--) {
    const date = addDays(t, -day);
    const dow = new Date(date).getDay();
    if (dow === 0 || dow === 6) continue;
    for (const [accId, w0] of Object.entries(weights)) {
      // Leeds is quietly sending less in the last month.
      const w = accId === practiceAccountId('Smile Genius Leeds') && day < 35 ? 0.1 : w0;
      const h = hash(`${accId}:${date}`);
      if ((h % 1000) / 1000 > w * 0.55) continue;
      const acc = s.accounts.find(a => a.id === accId)!;
      const ps = acc.practices ?? [];
      const practice = acc.kind === 'dentist' ? ps[h % Math.max(1, ps.length)] ?? '' : acc.name;
      const dentist = acc.kind === 'dentist' ? acc.name : dentistsAt(practice)[h % dentistsAt(practice).length];
      const svc = pickSvc(h >> 3);
      const item = CATALOG.find(i => i.name === svc)!;
      const nhs = item.nhs != null && (h >> 5) % 100 < (accId === practiceAccountId('Smile Genius Glasgow') ? 60 : 40);
      const teeth = item.unit === 'per unit' ? [11, 12, 21, 22, 13, 23].slice(0, 1 + ((h >> 7) % (svc === 'Bridge' ? 3 : 2)) + (svc === 'Bridge' ? 2 : 0)) : (h >> 9) % 4 === 0 ? [16, 46] : [16, 26];
      const id = `CASE-${String(3100 + n++)}`;
      const c = {
        id, patientName: `${FIRST[(h >> 2) % FIRST.length]} ${LAST[(h >> 4) % LAST.length]}`, practice, dentist, lab: '', services: [svc],
        serviceItems: [{ id: `${id}-s1`, name: svc, status: 'completed', deliveryDate: null, fdi: teeth, material: MATERIALS[svc], orderType: nhs ? 'NHS' : 'Private' }],
        status: 'completed', createdAt: date, updatedAt: date, requestedDelivery: null, hasAlert: false, scanner: 'iTero', source: 'scanner',
      } as unknown as Case;
      // Now and then a remake: same patient and item as a case 1–3 weeks earlier.
      const prior = (h >> 11) % 22 === 0 ? out.find(o => s.cases[o.id].accountId === accId && o.services[0] === svc && s.cases[o.id].receivedAt >= addDays(date, -21) && s.cases[o.id].receivedAt <= addDays(date, -7)) : undefined;
      if (prior) Object.assign(c, { patientName: prior.patientName, dentist: prior.dentist });
      s.cases[id] = { caseId: id, accountId: accId, receivedAt: date, dispatchedAt: addDays(date, 5 + (h % 6)), history: true, remakeOf: prior?.id, info: { patient: c.patientName, dentist: c.dentist, item: svc } };
      out.push(c);
    }
  }
  return out;
}
