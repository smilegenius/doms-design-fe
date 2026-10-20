import type { Case } from '../../src/app/pages/CasesPage';
import type { ServiceItem } from '../../src/app/pages/CaseDetailPage';
import { archOf } from '../../src/app/data/dentureStages';
import { allCases } from '../bulk-actions/caseContent';
import type {
  BillingAccount, BillingState, CaseBilling, CatalogItem, Currency, Flag, Invoice, InvoiceLine, OrderKind, PriceSource, Statement,
} from './types';
import { addDays, daysBetween, endOfMonth, fmtShort, hash, monthOf, prevMonth, RATES, round2, startOfMonth, today } from './format';

// ── Billing engine: pure functions over the billing state ────────────────────
// Pricing (which price wins, price lock, currency, VAT, stages, parts),
// building an invoice for a case, totals, account exposure for limits, and
// month-end statements. The store (billingStore.ts) calls these.

export const DISPATCHED = ['shipped', 'delivered', 'completed'];
export const IN_PROGRESS = ['new', 'submitted', 'sent-for-review', 'in-production', 'quality-check', 'refinement', 'on-hold'];

/** Every case Billing can see (the Growth list: created + seeded), drafts excluded. */
export function billingCases(): Case[] {
  return allCases().filter(c => c.status !== 'draft');
}
export const caseById = (id: string) => billingCases().find(c => c.id === id);

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const practiceAccountId = (name: string) => `acc-p-${slug(name)}`;
export const dentistAccountId = (name: string) => `acc-d-${slug(name)}`;

/** Who pays for a case: the dentist when they pay directly, otherwise the practice. */
export function accountFor(s: BillingState, c: Pick<Case, 'practice' | 'dentist'>): string {
  // A dentist who pays directly takes the cases from the practices they're linked to;
  // a case from any other practice bills to that practice.
  const d = s.accounts.find(a => a.kind === 'dentist' && a.name === c.dentist && a.payer === 'dentist' && (!a.practices?.length || a.practices.includes(c.practice)));
  return d ? d.id : practiceAccountId(c.practice || 'No practice');
}

export const dentistPractices = (a: BillingAccount) => a.practices ?? [];
/** "Floating: Leeds, Glasgow" / "at Manchester". */
export function dentistWhere(a: BillingAccount) {
  const ps = dentistPractices(a).map(p => p.replace(/^Smile Genius /, ''));
  if (!ps.length) return 'no practice linked';
  return a.scope === 'floating' || ps.length > 1 ? `Floating: ${ps.join(', ')}` : `at ${dentistPractices(a)[0]}`;
}
export const account = (s: BillingState, id: string) => s.accounts.find(a => a.id === id);

export function isDispatched(s: BillingState, c: Case) {
  return s.settings.invoiceOn === 'completed' ? c.status === 'completed' : DISPATCHED.includes(c.status);
}

// ── Catalog lookup ────────────────────────────────────────────────────────────

export function itemFor(s: BillingState, si: ServiceItem, meta?: CaseBilling): CatalogItem | null {
  if (meta?.scannerOrderType && (!meta.scannerItemId || meta.scannerItemId === si.id)) {
    const mapped = s.orderTypeMap[meta.scannerOrderType];
    return mapped ? s.catalog.find(i => i.id === mapped && !i.archived) ?? null : null;
  }
  return s.catalog.find(i => !i.archived && i.name.toLowerCase() === si.name.toLowerCase()) ?? null;
}

export function qtyFor(item: CatalogItem, si: ServiceItem) {
  const teeth = si.fdi ?? [];
  if (item.unit === 'per unit') return Math.max(1, teeth.length);
  if (item.unit === 'per arch') return archOf(teeth) === 'both' ? 2 : 1;
  return 1;
}

export function kindFor(si: ServiceItem, meta?: CaseBilling): OrderKind {
  if (meta?.kindOverride) return meta.kindOverride;
  return si.orderType === 'NHS' ? 'NHS' : 'Private';
}

/** An item's NHS and private prices in force on a date (the latest change from on or before it). */
export function pricesOn(item: CatalogItem, on: string): { nhs: number | null; priv: number | null; from: string | null } {
  const ch = [...(item.priceHistory ?? [])].filter(h => h.from <= on).sort((a, b) => a.from.localeCompare(b.from)).pop();
  return ch ? { nhs: ch.nhs, priv: ch.priv, from: ch.from } : { nhs: item.nhs, priv: item.priv, from: null };
}
/** A change scheduled after today, if any. */
export function scheduledChange(item: CatalogItem, after: string) {
  return [...(item.priceHistory ?? [])].filter(h => h.from > after).sort((a, b) => a.from.localeCompare(b.from))[0];
}

/** The catalog price in force on `on` (price lock: the case's received date). */
export function catalogPrice(item: CatalogItem, kind: OrderKind, on: string): { price: number | null; locked: boolean } {
  const then = pricesOn(item, on);
  const now = pricesOn(item, today());
  const price = kind === 'NHS' ? then.nhs ?? then.priv : then.priv;
  const current = kind === 'NHS' ? now.nhs ?? now.priv : now.priv;
  return { price, locked: price !== current };
}

/** Units an account was invoiced last month (volume tiers). */
export function unitsLastMonth(s: BillingState, accountId: string, on: string) {
  const ym = prevMonth(monthOf(on));
  return s.invoices.filter(i => i.accountId === accountId && i.status !== 'void' && i.issuedAt && monthOf(i.issuedAt) === ym)
    .reduce((n, i) => n + i.lines.reduce((m, l) => m + (l.itemId ? l.qty : 0), 0), 0);
}

/**
 * Which price wins, most specific first, no stacking:
 * line override → price list → promotion → volume tier → catalog (NHS or private).
 * Returned in GBP; the caller converts to the account's currency.
 */
export function priceFor(s: BillingState, acc: BillingAccount, item: CatalogItem, kind: OrderKind, on: string, override?: { price: number; reason: string; by: string }): { price: number; list: number; source: PriceSource } {
  const cat = catalogPrice(item, kind, on);
  const list = cat.price ?? 0;
  if (override) return { price: override.price, list, source: { kind: 'override', reason: override.reason, by: override.by } };
  const pl = acc.priceListId ? s.priceLists.find(p => p.id === acc.priceListId) : undefined;
  const custom = pl?.prices[item.id];
  const cp = custom ? (kind === 'NHS' ? custom.nhs ?? (item.nhs == null ? custom.priv : undefined) : custom.priv) : undefined;
  if (pl && cp != null) return { price: cp, list, source: { kind: 'price-list', list: pl.name } };
  const promo = s.promotions.find(p => p.active && on >= p.from && on <= p.to && (
    p.scope.kind === 'all'
    || (p.scope.kind === 'items' && p.scope.ids.includes(item.id))
    || (p.scope.kind === 'departments' && p.scope.ids.includes(item.department))
    || (p.scope.kind === 'accounts' && p.scope.ids.includes(acc.id))));
  if (promo && list) return { price: round2(promo.type === 'percent' ? list * (1 - promo.value / 100) : promo.value), list, source: { kind: 'promotion', promo: promo.name } };
  const units = unitsLastMonth(s, acc.id, on);
  const tier = [...s.tiers].filter(t => t.active && units >= t.minUnits).sort((a, b) => b.minUnits - a.minUnits)[0];
  if (tier && list) return { price: round2(list * (1 - tier.percentOff / 100)), list, source: { kind: 'tier', tier: tier.name } };
  return { price: list, list, source: { kind: 'catalog', locked: cat.locked } };
}

export function vatPctFor(s: BillingState, item: CatalogItem | null) {
  if (!s.settings.vatRegistered || !item) return 0;
  return item.vat === 'standard' ? 20 : 0;
}

const conv = (n: number, cur: Currency) => round2(n * RATES[cur]);

export function stagedMode(acc: BillingAccount, item: CatalogItem) {
  return acc.stagedOverride?.[item.id] ?? item.staged;
}

/** Stages of a staged service done so far (from the case's stage orders). */
export function stagesDone(si: ServiceItem): string[] {
  const out: string[] = [];
  for (const o of si.stageOrders ?? []) for (const st of o.stages) {
    const status = o.stageStatuses?.[st] ?? o.status;
    if (DISPATCHED.includes(status)) out.push(st);
  }
  if (!si.stageOrders?.length && si.phases?.length) si.phases.forEach(p => { if (p.status === 'completed' || p.status === 'received') out.push(p.label); });
  return out;
}

/**
 * The lines a case would be invoiced with now. `stage` bills one stage of a
 * staged item; otherwise staged-each items are left out (they bill per stage).
 */
export function linesFor(s: BillingState, c: Case, meta: CaseBilling, opts: { stage?: { itemId: string; stage: string }; includeStaged?: boolean } = {}): InvoiceLine[] {
  const acc = account(s, meta.accountId) ?? s.accounts[0];
  const on = meta.receivedAt;
  const lines: InvoiceLine[] = [];
  const remake = meta.remakeOf && meta.remakeDecision === 'no-charge';
  // Priced from what was designed, when the CAD integration has recorded it.
  const services: ServiceItem[] = meta.designOverride
    ? meta.designOverride.lines.map(l => {
        const base = c.serviceItems?.[0];
        const item = s.catalog.find(i => i.id === l.itemId);
        return { id: `design-${l.id}`, name: item?.name ?? 'Other', status: base?.status ?? 'in-production', deliveryDate: null, fdi: l.fdi, material: base?.material, orderType: base?.orderType } as ServiceItem;
      })
    : c.serviceItems ?? [];
  for (const si of services) {
    const item = itemFor(s, si, meta);
    const kind = kindFor(si, meta);
    if (!item) {
      if (opts.stage) continue;
      lines.push({ id: si.id, itemId: null, description: meta.scannerOrderType ?? si.name, qty: 1, unitPrice: 0, listPrice: 0, kind, source: { kind: 'unmapped' }, vat: 'exempt', vatPct: 0 });
      continue;
    }
    const mode = item.stages?.length ? stagedMode(acc, item) : 'end';
    if (opts.stage) {
      if (opts.stage.itemId !== item.id) continue;
      const st = item.stages?.find(x => x.name === opts.stage!.stage);
      const p0 = pricesOn(item, on);
      const ratio = kind === 'NHS' && p0.nhs != null && p0.priv ? p0.nhs / p0.priv : 1;
      const p = conv((st?.price ?? 0) * ratio, acc.currency);
      lines.push({ id: `${si.id}-${slug(opts.stage.stage)}`, itemId: item.id, description: `${item.name} · ${opts.stage.stage}`, qty: 1, unitPrice: remake ? 0 : p, listPrice: p, kind, source: remake ? { kind: 'remake' } : { kind: 'stage', stage: opts.stage.stage }, vat: item.vat, vatPct: vatPctFor(s, item) });
      continue;
    }
    if (mode === 'each' && !opts.includeStaged) continue;
    const qty = qtyFor(item, si);
    const pr = priceFor(s, acc, item, kind, on, meta.lineOverrides?.[si.id]);
    const unit = pr.source.kind === 'override' ? pr.price : conv(pr.price, acc.currency);
    const list = conv(pr.list, acc.currency);
    lines.push({
      id: si.id, itemId: item.id,
      description: `${item.name}${si.fdi?.length && item.unit === 'per unit' ? ` (${si.fdi.join(', ')})` : ''}${si.material ? ` · ${si.material}` : ''}`,
      qty, unitPrice: remake ? 0 : unit, listPrice: list, kind, source: remake ? { kind: 'remake' } : pr.source, vat: item.vat, vatPct: vatPctFor(s, item),
    });
  }
  if (!opts.stage) for (const part of meta.parts ?? []) {
    const item = s.catalog.find(i => i.id === part.itemId);
    const rule = item?.passThrough ?? { rule: 'cost-plus' as const, value: s.settings.passThroughMarkupPct, showPart: true };
    const price = rule.rule === 'cost' ? part.cost : rule.rule === 'fixed' ? rule.value : round2(part.cost * (1 + rule.value / 100));
    const p = conv(price, acc.currency);
    lines.push({ id: part.id, itemId: item?.id ?? null, description: `${item?.name ?? 'Component'} · ${part.manufacturer}`, qty: 1, unitPrice: remake ? 0 : p, listPrice: p, kind: 'Private', source: { kind: 'pass-through', rule: rule.rule, cost: part.cost }, vat: item?.vat ?? 'exempt', vatPct: vatPctFor(s, item ?? null), part: rule.showPart ? { manufacturer: part.manufacturer, partNo: part.partNo } : undefined });
  }
  if (!opts.stage && s.settings.courierAddOn) {
    const item = s.catalog.find(i => i.id === 'cour' && !i.archived);
    const cp = item ? pricesOn(item, on).priv ?? 0 : 0;
    if (item) lines.push({ id: 'courier', itemId: item.id, description: item.name, qty: 1, unitPrice: conv(cp, acc.currency), listPrice: conv(cp, acc.currency), kind: 'Private', source: { kind: 'catalog' }, vat: item.vat, vatPct: vatPctFor(s, item) });
  }
  return lines;
}

export const lineNet = (l: InvoiceLine) => round2(l.qty * l.unitPrice);
export const lineVat = (l: InvoiceLine) => round2(lineNet(l) * l.vatPct / 100);
export function totals(inv: Pick<Invoice, 'lines'>) {
  const net = round2(inv.lines.reduce((n, l) => n + lineNet(l), 0));
  const vat = round2(inv.lines.reduce((n, l) => n + lineVat(l), 0));
  return { net, vat, gross: round2(net + vat) };
}
export const credited = (inv: Invoice) => round2(inv.creditNotes.reduce((n, c) => n + c.amount, 0));
export const paid = (inv: Invoice) => round2(inv.payments.reduce((n, p) => n + p.amount, 0));
/** What's still owed on an issued invoice. */
export function outstanding(inv: Invoice) {
  if (!inv.issuedAt || inv.status === 'void') return 0;
  return Math.max(0, round2(totals(inv).gross - credited(inv) - paid(inv)));
}
export const isOverdue = (inv: Invoice, on = today()) => outstanding(inv) > 0 && !!inv.dueAt && inv.dueAt < on;

export function dueDate(s: BillingState, issued: string, acc?: BillingAccount) {
  void acc;
  if (s.settings.terms === 'eom-following') return endOfMonth(addDays(endOfMonth(issued), 1));
  if (s.settings.terms === 'custom') return addDays(issued, s.settings.customTermsDays);
  return addDays(issued, 30);
}

/** Expected value of a case not yet invoiced (work in progress), in the account's currency. */
export function expectedValue(s: BillingState, c: Case, meta: CaseBilling) {
  return totals({ lines: linesFor(s, c, meta, { includeStaged: true }) }).gross;
}

// ── Flags ─────────────────────────────────────────────────────────────────────

/** What this account usually pays for an item (mean unit price of earlier invoices). */
export function usualPrice(s: BillingState, accountId: string, itemId: string, kind: OrderKind, excludeId?: string) {
  const prices = s.invoices.filter(i => i.accountId === accountId && i.id !== excludeId && i.status !== 'void' && i.issuedAt)
    .flatMap(i => i.lines.filter(l => l.itemId === itemId && l.kind === kind && l.source.kind !== 'remake').map(l => l.unitPrice));
  return prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
}

/** Share of a dentist's work that is NHS (from invoice lines, else the case list). */
export function nhsShare(s: BillingState, dentist: string) {
  const lines = s.invoices.filter(i => i.dentist === dentist && i.status !== 'void').flatMap(i => i.lines.filter(l => l.itemId));
  if (lines.length >= 4) return lines.filter(l => l.kind === 'NHS').length / lines.length;
  const cs = billingCases().filter(c => c.dentist === dentist).flatMap(c => c.serviceItems ?? []);
  if (!cs.length) return null;
  return cs.filter(si => si.orderType === 'NHS').length / cs.length;
}

export function flagsFor(s: BillingState, c: Case, meta: CaseBilling, inv: Pick<Invoice, 'id' | 'lines' | 'accountId'>): Flag[] {
  const flags: Flag[] = [];
  for (const l of inv.lines) {
    if (l.source.kind === 'unmapped') flags.push({ kind: 'new-order-type', message: `"${l.description}" isn't mapped to a catalog item yet` });
    if (l.itemId && l.source.kind !== 'remake' && l.source.kind !== 'pass-through' && l.source.kind !== 'stage') {
      const usual = usualPrice(s, inv.accountId, l.itemId, l.kind, inv.id);
      if (usual && Math.abs(l.unitPrice - usual) / usual > s.settings.unusualPricePct / 100) {
        flags.push({ kind: 'unusual-price', message: `${l.description.split(' ·')[0]} at ${l.unitPrice.toFixed(2)} is ${Math.round(Math.abs(l.unitPrice - usual) / usual * 100)}% ${l.unitPrice > usual ? 'above' : 'below'} what this account usually pays (${usual.toFixed(2)})` });
      }
    }
  }
  if (meta.kindUnclear && !meta.kindOverride) {
    const share = nhsShare(s, c.dentist);
    flags.push({ kind: 'nhs-unclear', message: `The order doesn't say NHS or private${share != null ? `, and ${c.dentist} sends ${Math.round(share * 100)}% NHS` : ''}` });
  }
  if (meta.remakeOf && !meta.remakeDecision) flags.push({ kind: 'remake', message: `Is this a remake of ${meta.remakeOf}?` });
  if (meta.designOverride?.diff.length && !meta.designOverride.checked) flags.push({ kind: 'design-diff', message: `Design differs from the case: ${meta.designOverride.diff.join('; ')}` });
  return flags.filter((f, i) => flags.findIndex(g => g.message === f.message) === i);
}

// ── Limits ────────────────────────────────────────────────────────────────────

export interface Exposure { unpaid: number; xero: number; wip: number; total: number; overdueOldest: number; wipCases: number }

export function exposure(s: BillingState, accountId: string): Exposure {
  const unpaid = round2(s.invoices.filter(i => i.accountId === accountId).reduce((n, i) => n + outstanding(i), 0));
  const xero = round2(s.xeroOnly.filter(x => x.accountId === accountId).reduce((n, x) => n + (x.amount - x.paid), 0));
  let wip = 0, wipCases = 0;
  for (const c of billingCases()) {
    const m = s.cases[c.id];
    if (!m || m.accountId !== accountId || m.billedElsewhere) continue;
    if (s.invoices.some(i => i.caseId === c.id && i.status !== 'void' && !i.stage)) continue;
    if (!IN_PROGRESS.includes(c.status) && !(isDispatched(s, c))) continue;
    wip += expectedValue(s, c, m); wipCases++;
  }
  const t = today();
  const overdueOldest = Math.max(0,
    ...s.invoices.filter(i => i.accountId === accountId && isOverdue(i, t)).map(i => daysBetween(i.dueAt!, t)),
    ...s.xeroOnly.filter(x => x.accountId === accountId && x.amount - x.paid > 0 && x.due < t).map(x => daysBetween(x.due, t)));
  return { unpaid, xero, wip: round2(wip), total: round2(unpaid + xero + wip), overdueOldest, wipCases };
}

export type LimitStage = 'none' | 'ok' | 'approaching' | 'at' | 'paused';

export function limitStage(s: BillingState, acc: BillingAccount, ex = exposure(s, acc.id)): LimitStage {
  if (!acc.limit) return 'none';
  if (acc.paused) return 'paused';
  const over = (acc.limit.amount != null && ex.total >= acc.limit.amount) || (acc.limit.overdueDays != null && ex.overdueOldest > acc.limit.overdueDays);
  if (over) return 'at';
  if (acc.limit.amount != null && ex.total >= acc.limit.amount * s.settings.limitWarnPct / 100) return 'approaching';
  return 'ok';
}

/** Days until the limit at the recent pace (new work received over the last 30 days, minus payments). */
export function limitForecast(s: BillingState, acc: BillingAccount, ex = exposure(s, acc.id)): number | null {
  if (!acc.limit?.amount) return null;
  const from = addDays(today(), -30);
  let added = 0;
  for (const c of billingCases()) {
    const m = s.cases[c.id];
    if (m?.accountId === acc.id && m.receivedAt >= from && !m.billedElsewhere) added += expectedValue(s, c, m);
  }
  const paidIn = s.invoices.filter(i => i.accountId === acc.id).flatMap(i => i.payments).filter(p => p.at >= from).reduce((n, p) => n + p.amount, 0);
  const perDay = (added - paidIn) / 30;
  const left = acc.limit.amount - ex.total;
  if (left <= 0) return 0;
  if (perDay <= 0) return null;
  const days = Math.max(1, Math.round(left / perDay));
  return days > 90 ? null : days; // only worth saying when it's near
}

// ── Statements ────────────────────────────────────────────────────────────────

export function buildStatement(s: BillingState, accountId: string, period: string): Statement {
  const acc = account(s, accountId)!;
  const start = `${period}-01`, end = endOfMonth(start);
  // Voided invoices are voided in Xero too, so they never reach a statement.
  const inv = s.invoices.filter(i => i.accountId === accountId && i.issuedAt && i.status !== 'void');
  let opening = 0;
  for (const i of inv) {
    if (i.issuedAt! < start) opening += totals(i).gross;
    for (const cn of i.creditNotes) if (cn.at < start) opening -= cn.amount;
    for (const p of i.payments) if (p.at < start) opening -= p.amount;
  }
  for (const x of s.xeroOnly.filter(x => x.accountId === accountId)) {
    if (x.date < start) opening += x.amount;
    // Old-system payments are counted before the period (Xero holds the detail).
    if (x.date < start) opening -= x.paid;
  }
  const invoices = [
    ...inv.filter(i => i.issuedAt! >= start && i.issuedAt! <= end).map(i => ({ number: i.number ?? '—', date: i.issuedAt!, amount: totals(i).gross })),
    ...s.xeroOnly.filter(x => x.accountId === accountId && x.date >= start && x.date <= end).map(x => ({ number: x.number, date: x.date, amount: x.amount })),
  ];
  const credits = inv.flatMap(i => i.creditNotes.filter(c => c.at >= start && c.at <= end).map(c => ({ number: c.number, date: c.at, amount: c.amount })));
  const payments = inv.flatMap(i => i.payments.filter(p => p.at >= start && p.at <= end).map(p => ({ ref: p.ref, date: p.at, amount: p.amount })));
  const closing = round2(opening + invoices.reduce((n, x) => n + x.amount, 0) - credits.reduce((n, x) => n + x.amount, 0) - payments.reduce((n, x) => n + x.amount, 0));
  const ageing = { current: 0, d30: 0, d60: 0, d90: 0 };
  const bucket = (due: string, amt: number) => {
    const late = daysBetween(due, end);
    if (late <= 0) ageing.current += amt; else if (late <= 30) ageing.d30 += amt; else if (late <= 60) ageing.d60 += amt; else ageing.d90 += amt;
  };
  for (const i of inv) {
    if (i.issuedAt! > end) continue;
    const owed = totals(i).gross - i.creditNotes.filter(c => c.at <= end).reduce((n, c) => n + c.amount, 0) - i.payments.filter(p => p.at <= end).reduce((n, p) => n + p.amount, 0);
    if (owed > 0.005) bucket(i.dueAt!, owed);
  }
  for (const x of s.xeroOnly.filter(x => x.accountId === accountId && x.date <= end)) if (x.amount - x.paid > 0) bucket(x.due, x.amount - x.paid);
  (Object.keys(ageing) as (keyof typeof ageing)[]).forEach(k => { ageing[k] = round2(ageing[k]); });
  return { id: `st-${accountId}-${period}`, accountId, period, status: 'preview', createdAt: today(), opening: round2(opening), invoices, credits, payments, closing, ageing, currency: acc.currency };
}

export function sourceText(src: PriceSource, cur: Currency = 'GBP'): string {
  void cur;
  switch (src.kind) {
    case 'override': return `Typed on the invoice by ${src.by}: "${src.reason}"`;
    case 'price-list': return `Custom price list: ${src.list}`;
    case 'promotion': return `Promotion: ${src.promo}`;
    case 'tier': return `Volume tier: ${src.tier}`;
    case 'catalog': return src.locked ? 'Catalog price in force when the case was received (price lock)' : 'Catalog price';
    case 'pass-through': return src.rule === 'cost' ? `At cost (${src.cost.toFixed(2)})` : src.rule === 'fixed' ? 'Fixed component price' : `Cost ${src.cost.toFixed(2)} plus markup`;
    case 'stage': return `Stage price: ${src.stage}`;
    case 'unmapped': return 'No catalog item yet: map the order type';
    case 'remake': return 'Remake under warranty: no charge';
  }
}
export const sourceShort = (src: PriceSource) => ({ override: 'Typed', 'price-list': 'Price list', promotion: 'Promotion', tier: 'Tier', catalog: 'Catalog', 'pass-through': 'Component', stage: 'Stage', unmapped: 'Unmapped', remake: 'Remake' }[src.kind]);

export const caseLabel = (c: Pick<Case, 'id' | 'patientName'>) => `${c.id} · ${c.patientName}`;
export const seedPick = <T,>(arr: T[], key: string) => arr[hash(key) % arr.length];
export const shortDate = fmtShort;
export { startOfMonth };
