import type { BillingAccount, BillingState, Invoice } from './types';
import {
  account, billingCases, catalogPrice, credited, DISPATCHED, expectedValue, exposure, IN_PROGRESS, isOverdue, itemFor, limitForecast, limitStage, outstanding, stagesDone, stagedMode, totals,
} from './engine';
import { addDays, daysBetween, fmtShort, money, monthOf, prevMonth, RATES, round2, today } from './format';

/** Amounts in an account's currency, back to GBP for lab-wide totals. */
const gbpOf = (n: number, cur: keyof typeof RATES) => n / RATES[cur];
import { statementDay } from './billingStore';

// ── Smart assists and reports ────────────────────────────────────────────────
// What Smile Genius sees that Xero can't: work not yet billed, accounts
// drifting away, money given away, and when cash will actually land.

export interface Assist { id: string; kind: string; title: string; message: string; link: string; tone: 'red' | 'amber' | 'blue' }

/** Mean days from invoice to payment, for invoices paid in a month (by payment month). */
export function payHabit(s: BillingState, accountId: string, ym?: string) {
  const d = s.invoices.filter(i => i.accountId === accountId && i.issuedAt && i.status === 'paid')
    .map(i => ({ at: i.payments[i.payments.length - 1]?.at, days: i.payments.length ? daysBetween(i.issuedAt!, i.payments[i.payments.length - 1].at) : 0 }))
    .filter(x => x.at && (!ym || monthOf(x.at) === ym));
  return d.length ? d.reduce((n, x) => n + x.days, 0) / d.length : null;
}

export const billingAccounts = (s: BillingState) => s.accounts.filter(a => a.kind === 'practice' || a.payer === 'dentist');

export function pendingInvoices(s: BillingState) { return s.invoices.filter(i => i.status === 'draft' || i.status === 'flagged'); }

export function unbilledDispatched(s: BillingState) {
  const t = today();
  return billingCases().filter(c => {
    const m = s.cases[c.id];
    if (!m || m.billedElsewhere || !m.dispatchedAt) return false;
    if (!DISPATCHED.includes(c.status) || s.invoices.some(i => i.caseId === c.id && !i.stage && i.status !== 'void')) return false;
    return daysBetween(m.dispatchedAt, t) >= s.settings.notBilledDays;
  });
}

export function stoppedUnbilled(s: BillingState) {
  return billingCases().flatMap(c => {
    const m = s.cases[c.id];
    if (!m?.stoppedAt) return [];
    const acc = account(s, m.accountId);
    return (c.serviceItems ?? []).flatMap(si => {
      const item = itemFor(s, si, m);
      if (!item?.stages?.length || !acc || stagedMode(acc, item) !== 'each') return [];
      return stagesDone(si).filter(st => !m.stagesBilled?.includes(`${item.id}:${st}`)).map(st => ({ c, item, stage: st }));
    });
  });
}

export function unmappedTypes(s: BillingState) {
  const out = new Map<string, string[]>();
  for (const m of Object.values(s.cases)) if (m.scannerOrderType && !s.orderTypeMap[m.scannerOrderType]) out.set(m.scannerOrderType, [...(out.get(m.scannerOrderType) ?? []), m.caseId]);
  return [...out].map(([type, cases]) => ({ type, cases }));
}

export function heldCases(s: BillingState) {
  return billingCases().filter(c => s.cases[c.id]?.held);
}

export function assists(s: BillingState): Assist[] {
  const out: Assist[] = [];
  const t = today();
  for (const a of billingAccounts(s)) {
    if (!a.limit) continue;
    const ex = exposure(s, a.id);
    const stage = limitStage(s, a, ex);
    const days = limitForecast(s, a, ex);
    if (stage === 'approaching' || (stage === 'ok' && days != null && days <= 14)) {
      out.push({ id: `limit-${a.id}`, kind: 'Limit forecast', tone: 'amber', title: a.name, link: `/growth/billing/accounts/${a.id}`,
        message: `${a.name} is at ${Math.round(ex.total / a.limit.amount! * 100)}% of its ${money(a.limit.amount!, a.currency, { round: true })} limit${days ? `, and reaches it in about ${days} day${days === 1 ? '' : 's'} at this pace` : ''} (counting ${money(ex.wip, a.currency, { round: true })} of work in progress)` });
    }
  }
  const m0 = monthOf(t), m1 = prevMonth(m0), m2 = prevMonth(m1);
  for (const a of billingAccounts(s)) {
    const h = [payHabit(s, a.id, m2), payHabit(s, a.id, m1), payHabit(s, a.id, m0)];
    if (h.every(x => x != null) && h[2]! > h[0]! + 7 && h[2]! >= h[1]!) {
      out.push({ id: `slow-${a.id}`, kind: 'Slow-payer signal', tone: 'amber', title: a.name, link: `/growth/billing/accounts/${a.id}?limit=1`,
        message: `${a.name} is paying slower: ${h.map(x => Math.round(x!)).join(' → ')} days over three months. ${a.limit ? 'Consider lowering its limit.' : 'Consider setting a limit.'}` });
    }
  }
  for (const inv of pendingInvoices(s)) for (const f of inv.flags) {
    const kind = { 'unusual-price': 'Unusual price', 'new-order-type': 'New order type', 'nhs-unclear': 'NHS or private unclear', remake: 'Possible remake', review: 'Review', 'design-diff': 'Design differs from the case' }[f.kind];
    if (f.kind === 'new-order-type') continue; // grouped below
    out.push({ id: `${f.kind}-${inv.id}`, kind, tone: f.kind === 'unusual-price' ? 'red' : 'amber', title: `${inv.caseId} · ${inv.patient}`, message: f.message, link: `/growth/billing/invoices/${inv.id}` });
  }
  for (const c of billingCases()) {
    const m = s.cases[c.id];
    if (m?.remakeOf && !m.remakeDecision && !s.invoices.some(i => i.caseId === c.id)) {
      out.push({ id: `remake-${c.id}`, kind: 'Possible remake', tone: 'amber', title: `${c.id} · ${c.patientName}`, link: `/growth/cases/${c.id}?sf=billing`,
        message: `Same patient and ${c.services[0]} as ${m.remakeOf} within ${s.settings.remakeDays} days. Is this a remake? It can go out at no charge.` });
    }
  }
  for (const u of unmappedTypes(s)) out.push({ id: `type-${u.type}`, kind: 'New order type', tone: 'blue', title: u.type, link: `/growth/billing/catalog?map=${encodeURIComponent(u.type)}`, message: `A scanner order type with no catalog match on ${u.cases.join(', ')}. Pick the item once and it's remembered.` });
  for (const c of unbilledDispatched(s)) {
    const m = s.cases[c.id];
    out.push({ id: `unbilled-${c.id}`, kind: 'Not yet billed', tone: 'red', title: `${c.id} · ${c.patientName}`, link: `/growth/cases/${c.id}?sf=billing`, message: `Dispatched ${fmtShort(m.dispatchedAt)} (${daysBetween(m.dispatchedAt!, t)} days ago) with no invoice.` });
  }
  for (const x of stoppedUnbilled(s)) out.push({ id: `stopped-${x.c.id}-${x.stage}`, kind: 'Not yet billed', tone: 'amber', title: `${x.c.id} · ${x.c.patientName}`, link: `/growth/cases/${x.c.id}?sf=billing`, message: `Stopped partway: "${x.stage}" was done but not billed.` });
  const sd = statementDay(s);
  const left = daysBetween(t, sd);
  const pending = pendingInvoices(s).length;
  if (pending && left >= 0 && left <= 2) out.push({ id: `monthend-${sd}`, kind: 'Month-end check', tone: 'red', title: 'Statements', link: '/growth/billing?filter=pending', message: `${pending} invoice${pending === 1 ? '' : 's'} will miss this month's statements unless approved by ${fmtShort(sd)}.` });
  return out.filter(a => !s.dismissed.includes(a.id));
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface Filters { from: string; to: string; department: string; account: string }
export interface Report { title: string; question: string; columns: string[]; rows: (string | number)[][]; summary: { label: string; value: string; tone?: string }[]; note?: string }

const inRange = (d: string | null | undefined, f: Filters) => !!d && d >= f.from && d <= f.to;
const accOk = (f: Filters, id: string) => f.account === 'all' || f.account === id;
const deptOk = (s: BillingState, f: Filters, itemId: string | null) => f.department === 'all' || (!!itemId && s.catalog.find(i => i.id === itemId)?.department === f.department);
const name = (s: BillingState, id: string) => account(s, id)?.name ?? id;
const gbp = (n: number) => money(n, 'GBP', { round: true });

export function unbilledReport(s: BillingState, f: Filters): Report {
  const t = today();
  const rows: (string | number)[][] = [];
  let wip = 0, lost = 0;
  const ages = { '0–7 days': 0, '8–14 days': 0, '15–30 days': 0, '30+ days': 0 };
  for (const c of billingCases()) {
    const m = s.cases[c.id];
    if (!m || m.billedElsewhere || !accOk(f, m.accountId)) continue;
    if (s.invoices.some(i => i.caseId === c.id && !i.stage && i.status !== 'void')) continue;
    const dispatched = DISPATCHED.includes(c.status);
    if (!dispatched && !IN_PROGRESS.includes(c.status)) continue;
    if (f.department !== 'all' && !(c.serviceItems ?? []).some(si => itemFor(s, si, m)?.department === f.department)) continue;
    const v = expectedValue(s, c, m);
    const age = daysBetween(m.receivedAt, t);
    if (dispatched) lost += v; else wip += v;
    if (!dispatched) ages[age <= 7 ? '0–7 days' : age <= 14 ? '8–14 days' : age <= 30 ? '15–30 days' : '30+ days'] += v;
    rows.push([c.id, c.patientName, name(s, m.accountId), c.services.join(', '), dispatched ? 'Dispatched, not invoiced' : m.held ? 'On hold' : 'On the bench', age, round2(v)]);
  }
  rows.sort((a, b) => (a[4] === 'Dispatched, not invoiced' ? -1 : 0) - (b[4] === 'Dispatched, not invoiced' ? -1 : 0) || Number(b[5]) - Number(a[5]));
  return {
    title: 'Unbilled work', question: 'How much work is on the bench, and has anything gone out without an invoice?',
    columns: ['Case', 'Patient', 'Account', 'Services', 'State', 'Days since received', 'Expected value'], rows,
    summary: [{ label: 'On the bench', value: gbp(wip) }, { label: 'Dispatched, not invoiced', value: gbp(lost), tone: lost ? 'red' : undefined }, ...Object.entries(ages).map(([k, v]) => ({ label: k, value: gbp(v) }))],
  };
}

export function trendsReport(s: BillingState, f: Filters): Report {
  const t = today();
  const rows: (string | number)[][] = [];
  let flagged = 0;
  for (const a of billingAccounts(s)) {
    if (!accOk(f, a.id)) continue;
    const mine = Object.values(s.cases).filter(m => m.accountId === a.id);
    const inWindow = (from: number, to: number) => mine.filter(m => { const d = daysBetween(m.receivedAt, t); return d >= from && d < to; }).length;
    const last30 = inWindow(0, 30);
    const avg = (inWindow(30, 60) + inWindow(60, 90) + inWindow(90, 120)) / 3;
    if (!avg && !last30) continue;
    const change = avg ? (last30 - avg) / avg * 100 : 100;
    if (change <= -25) flagged++;
    rows.push([a.name, a.kind === 'dentist' ? 'Dentist (pays directly)' : 'Practice', round2(avg), last30, `${change >= 0 ? '+' : ''}${Math.round(change)}%`, change <= -25 ? 'Down 25%+' : '']);
  }
  rows.sort((a, b) => parseInt(String(a[4])) - parseInt(String(b[4])));
  return {
    title: 'Account trends', question: 'Which dentists are sending me less work?',
    columns: ['Account', 'Type', 'Cases / month (3-month avg)', 'Cases, last 30 days', 'Change', 'Flag'], rows,
    summary: [{ label: 'Accounts down 25%+', value: String(flagged), tone: flagged ? 'red' : undefined }],
  };
}

export function givenAwayReport(s: BillingState, f: Filters): Report {
  const rows: (string | number)[][] = [];
  const by: Record<string, number> = { 'Free remakes': 0, 'Price overrides': 0, Promotions: 0, 'Volume tiers': 0, 'Credit notes': 0 };
  for (const inv of s.invoices) {
    if (!inv.issuedAt || inv.status === 'void' || !accOk(f, inv.accountId)) continue;
    if (inRange(inv.issuedAt, f)) for (const l of inv.lines) {
      if (!deptOk(s, f, l.itemId)) continue;
      const gap = round2((l.listPrice - l.unitPrice) * l.qty);
      if (gap <= 0) continue;
      const reason = l.source.kind === 'remake' ? 'Free remakes' : l.source.kind === 'override' ? 'Price overrides' : l.source.kind === 'promotion' ? 'Promotions' : l.source.kind === 'tier' ? 'Volume tiers' : l.source.kind === 'price-list' ? 'Price overrides' : null;
      if (!reason) continue;
      by[reason] += gap;
      rows.push([inv.number ?? '—', inv.issuedAt, name(s, inv.accountId), l.description.split(' ·')[0], reason, l.source.kind === 'override' ? l.source.reason : l.source.kind === 'promotion' ? l.source.promo : l.source.kind === 'tier' ? l.source.tier : l.source.kind === 'price-list' ? l.source.list : 'Remake', gap]);
    }
    for (const cn of inv.creditNotes) if (inRange(cn.at, f)) { by['Credit notes'] += cn.amount; rows.push([cn.number, cn.at, name(s, inv.accountId), inv.number ?? '', 'Credit notes', cn.reason, cn.amount]); }
  }
  // Remakes under warranty with no invoice at all.
  for (const m of Object.values(s.cases)) {
    if (m.remakeDecision !== 'no-charge' || !m.remakeValue || !accOk(f, m.accountId) || !inRange(m.dispatchedAt ?? m.receivedAt, f)) continue;
    if (s.invoices.some(i => i.caseId === m.caseId && i.status !== 'void')) continue;
    by['Free remakes'] += m.remakeValue;
    rows.push([m.caseId, m.dispatchedAt ?? m.receivedAt, name(s, m.accountId), '', 'Free remakes', `Remake of ${m.remakeOf} (no invoice)`, m.remakeValue]);
  }
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return {
    title: 'Given away', question: 'What did I give away this month?',
    columns: ['Document', 'Date', 'Account', 'Item', 'Type', 'Reason', 'Amount'], rows: rows.sort((a, b) => String(b[1]).localeCompare(String(a[1]))),
    summary: [{ label: 'Total given away', value: gbp(total), tone: 'red' }, ...Object.entries(by).map(([k, v]) => ({ label: k, value: gbp(v) }))],
  };
}

export function remakesReport(s: BillingState, f: Filters): Report {
  const list = new Map(billingCases().map(c => [c.id, c]));
  const historyInfo = new Map(Object.values(s.cases).filter(m => m.history && m.info).map(m => [m.caseId, m.info!]));
  const byDentist = new Map<string, { total: number; remakes: number; value: number }>();
  const rows: (string | number)[][] = [];
  for (const m of Object.values(s.cases)) {
    if (!accOk(f, m.accountId) || !inRange(m.receivedAt, f)) continue;
    // Case details from the list, or from its invoice for completed cases no longer listed.
    const c = list.get(m.caseId);
    const inv = s.invoices.find(i => i.caseId === m.caseId && i.status !== 'void');
    const hc = !c && !inv ? historyInfo.get(m.caseId) : undefined;
    if (!c && !inv && !hc) continue;
    const dentist = c?.dentist ?? inv?.dentist ?? hc!.dentist;
    const d = byDentist.get(dentist) ?? { total: 0, remakes: 0, value: 0 };
    d.total++;
    if (m.remakeOf) {
      d.remakes++;
      const v = m.remakeValue ?? (c ? expectedValue(s, c, { ...m, remakeDecision: 'charge' }) : round2((inv?.lines ?? []).reduce((n, l) => n + l.listPrice * l.qty, 0)));
      d.value += v;
      rows.push([m.caseId, c?.patientName ?? inv?.patient ?? hc!.patient, dentist, c?.services[0] ?? inv?.lines[0]?.description.split(' (')[0].split(' ·')[0] ?? hc!.item, m.remakeOf, m.billedElsewhere ? 'Before the switch-over (old system)' : m.remakeDecision === 'no-charge' ? 'Remake (no charge)' : m.remakeDecision === 'charge' ? 'Charged (not a warranty remake)' : 'Not decided', round2(v)]);
    }
    byDentist.set(dentist, d);
  }
  const all = [...byDentist.values()].reduce((a, b) => ({ total: a.total + b.total, remakes: a.remakes + b.remakes, value: a.value + b.value }), { total: 0, remakes: 0, value: 0 });
  const worst = [...byDentist].filter(([, v]) => v.remakes).sort((a, b) => b[1].remakes / b[1].total - a[1].remakes / a[1].total)[0];
  return {
    title: 'Remakes', question: 'Which dentists, items and causes drive my remakes?',
    columns: ['Case', 'Patient', 'Dentist', 'Item', 'Remake of', 'Outcome', 'Value'], rows,
    summary: [
      { label: 'Remake rate', value: all.total ? `${(all.remakes / all.total * 100).toFixed(1)}%` : '—' },
      { label: 'Remake value', value: gbp(all.value), tone: 'red' },
      { label: 'Highest rate', value: worst ? `${worst[0]} (${Math.round(worst[1].remakes / worst[1].total * 100)}%)` : '—' },
    ],
    note: 'Causes come from the remake reason on the case once it\'s recorded; this version groups by outcome.',
  };
}

export function mixReport(s: BillingState, f: Filters): Report {
  const items = new Map<string, { units: number; value: number; list: number; nhs: number }>();
  const dentists = new Map<string, { nhs: number; all: number }>();
  for (const inv of s.invoices) {
    if (!inv.issuedAt || inv.status === 'void' || !inRange(inv.issuedAt, f) || !accOk(f, inv.accountId)) continue;
    for (const l of inv.lines) {
      if (!l.itemId || !deptOk(s, f, l.itemId)) continue;
      const it = items.get(l.itemId) ?? { units: 0, value: 0, list: 0, nhs: 0 };
      it.units += l.qty; it.value += l.qty * l.unitPrice; it.list += l.qty * l.listPrice; if (l.kind === 'NHS') it.nhs += l.qty;
      items.set(l.itemId, it);
      const d = dentists.get(inv.dentist) ?? { nhs: 0, all: 0 };
      d.all += l.qty; if (l.kind === 'NHS') d.nhs += l.qty; dentists.set(inv.dentist, d);
    }
  }
  const rows = [...items].map(([id, v]) => {
    const it = s.catalog.find(i => i.id === id);
    return [it?.name ?? id, it?.department ?? '', v.units, round2(v.value), v.units ? round2(v.value / v.units) : 0, v.units ? round2(v.list / v.units) : 0, v.list ? `${Math.round((v.value / v.list) * 100)}%` : '—', `${Math.round(v.nhs / v.units * 100)}% NHS`] as (string | number)[];
  }).sort((a, b) => Number(b[3]) - Number(a[3]));
  return {
    title: 'Product and price mix', question: 'What do I actually sell, and at what price?',
    columns: ['Item', 'Department', 'Units', 'Value', 'Average price', 'List price', 'Achieved vs list', 'NHS mix'], rows,
    summary: [...dentists].sort((a, b) => b[1].all - a[1].all).slice(0, 4).map(([d, v]) => ({ label: d, value: `${Math.round(v.nhs / v.all * 100)}% NHS` })),
  };
}

export function cashReport(s: BillingState, f: Filters): Report {
  const t = today();
  const weeks = [0, 1, 2, 3].map(w => ({ from: addDays(t, w * 7), to: addDays(t, w * 7 + 6), invoiced: 0, wip: 0 }));
  const rows: (string | number)[][] = [];
  const expectAt = (a: BillingAccount | undefined, issued: string, due: string | null) => {
    const habit = a ? payHabit(s, a.id) : null;
    const at = habit != null ? addDays(issued, Math.round(habit)) : due ?? addDays(issued, 30);
    return at < t ? addDays(t, 3) : at; // already late: expect it soon
  };
  for (const inv of s.invoices) {
    const owed = outstanding(inv);
    if (!owed || !accOk(f, inv.accountId)) continue;
    const at = expectAt(account(s, inv.accountId), inv.issuedAt!, inv.dueAt);
    const w = weeks.find(w => at >= w.from && at <= w.to);
    if (!w) continue;
    w.invoiced += owed;
    rows.push([inv.number ?? '—', name(s, inv.accountId), inv.dueAt ?? '', at, 'Invoiced', round2(owed)]);
  }
  for (const c of billingCases()) {
    const m = s.cases[c.id];
    if (!m || m.billedElsewhere || m.held || !accOk(f, m.accountId) || !['quality-check', 'in-production'].includes(c.status)) continue;
    if (s.invoices.some(i => i.caseId === c.id && !i.stage)) continue;
    const issue = addDays(t, c.status === 'quality-check' ? 2 : 7);
    const at = expectAt(account(s, m.accountId), issue, null);
    const w = weeks.find(w => at >= w.from && at <= w.to);
    if (!w) continue;
    const v = expectedValue(s, c, m);
    w.wip += v;
    rows.push([c.id, name(s, m.accountId), '', at, 'About to be invoiced', round2(v)]);
  }
  rows.sort((a, b) => String(a[3]).localeCompare(String(b[3])));
  return {
    title: 'Cash forecast', question: 'How much cash comes in over the next 30 days?',
    columns: ['Invoice / case', 'Account', 'Due', 'Expected', 'Type', 'Amount'], rows,
    summary: weeks.map((w, i) => ({ label: i === 0 ? 'This week' : `Week of ${fmtShort(w.from)}`, value: gbp(w.invoiced + w.wip) })),
    note: 'Expected dates use each account\'s real days-to-pay, not the due date.',
  };
}

export const REPORTS = [
  { id: 'unbilled', fn: unbilledReport },
  { id: 'trends', fn: trendsReport },
  { id: 'given-away', fn: givenAwayReport },
  { id: 'remakes', fn: remakesReport },
  { id: 'mix', fn: mixReport },
  { id: 'cash', fn: cashReport },
] as const;

export function toCsv(r: Report) {
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [r.columns, ...r.rows].map(row => row.map(esc).join(',')).join('\n');
}

export function mondayEmail(s: BillingState) {
  const t = today();
  const all: Filters = { from: '2000-01-01', to: '2999-12-31', department: 'all', account: 'all' };
  const unb = unbilledReport(s, all);
  const bench = unb.rows.filter(r => r[4] !== 'Dispatched, not invoiced').reduce((n, r) => n + Number(r[6]), 0);
  const lost = unb.rows.filter(r => r[4] === 'Dispatched, not invoiced').reduce((n, r) => n + Number(r[6]), 0);
  const cash = cashReport(s, all);
  const week = cash.rows.filter(r => String(r[3]) <= addDays(t, 6)).reduce((n, r) => n + Number(r[5]), 0);
  const overdue = s.invoices.filter(i => isOverdue(i, t)).reduce((n, i) => n + gbpOf(outstanding(i), i.currency), 0)
    + s.xeroOnly.filter(x => x.due < t).reduce((n, x) => n + gbpOf(x.amount - x.paid, x.currency), 0);
  const trend = trendsReport(s, all).rows[0];
  return [
    { label: 'Work on the bench', value: gbp(bench), link: '/growth/billing/reports?r=unbilled' },
    { label: 'Dispatched, not invoiced', value: gbp(lost), link: '/growth/billing/reports?r=unbilled' },
    { label: 'Cash expected this week', value: gbp(week), link: '/growth/billing/reports?r=cash' },
    { label: 'Overdue', value: gbp(overdue), link: '/growth/billing/accounts' },
    { label: 'Trending down most', value: trend ? `${trend[0]} (${trend[4]})` : '—', link: '/growth/billing/reports?r=trends' },
  ];
}

/** Paid, pending and overdue totals for Billing home (GBP-equivalent). */
export function headline(s: BillingState) {
  const t = today();
  const ym = monthOf(t);
  const issued = s.invoices.filter(i => i.issuedAt && i.status !== 'void');
  const paidThisMonth = issued.flatMap(i => i.payments.map(p => ({ ...p, cur: i.currency }))).filter(p => monthOf(p.at) === ym).reduce((n, p) => n + gbpOf(p.amount, p.cur), 0);
  const pendingVal = pendingInvoices(s).reduce((n, i) => n + gbpOf(totals(i).gross, i.currency), 0);
  const owed = issued.reduce((n, i) => n + gbpOf(outstanding(i), i.currency), 0);
  const overdue = issued.filter(i => isOverdue(i, t)).reduce((n, i) => n + gbpOf(outstanding(i), i.currency), 0);
  const xeroOwed = s.xeroOnly.reduce((n, x) => n + gbpOf(x.amount - x.paid, x.currency), 0);
  const xeroOverdue = s.xeroOnly.filter(x => x.due < t).reduce((n, x) => n + gbpOf(x.amount - x.paid, x.currency), 0);
  const invoicedThisMonth = issued.filter(i => monthOf(i.issuedAt!) === ym).reduce((n, i) => n + gbpOf(totals(i).gross - credited(i), i.currency), 0);
  return { paidThisMonth: round2(paidThisMonth), pending: pendingInvoices(s).length, pendingVal: round2(pendingVal), owed: round2(owed + xeroOwed), overdue: round2(overdue + xeroOverdue), invoicedThisMonth: round2(invoicedThisMonth) };
}

export { catalogPrice, limitStage, exposure, limitForecast };
export type { Invoice };
