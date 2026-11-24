import type { BillingState, CaseBilling } from './types';
import { account, billingCases, covers, expectedValue, isOverdue, lineNet, outstanding, totals } from './engine';
import { addDays, daysBetween, monthOf, prevMonth, round2, today } from './format';
import { payHabit } from './insights';

// ── Lab insights (Requirements v2, "Lab insights") ───────────────────────────
// One word for health per practice and dentist, worked out from its own
// history only: New, Growing, Steady, Slowing, Gone quiet. Plus the Overview
// numbers, Who to call, and the Practices / Dentists / Products views. Every
// number comes from cases, billing lines and payments already held.

export type Health = 'New' | 'Growing' | 'Steady' | 'Slowing' | 'Gone quiet';
export const HEALTH_TONE: Record<Health, 'blue' | 'green' | 'gray' | 'amber' | 'red'> = { New: 'blue', Growing: 'green', Steady: 'gray', Slowing: 'amber', 'Gone quiet': 'red' };

/** One case as Insights sees it. */
export interface Activity { caseId: string; date: string; practice: string; dentist: string; accountId: string; value: number; nhs: number; items: string[]; scanner?: string; onTime?: boolean; remake: boolean }

/** A case's billed value: its invoice (or its share of a month-end invoice), else what it would bill now. */
function caseValue(s: BillingState, m: CaseBilling): { value: number; nhs: number; items: string[] } {
  const inv = s.invoices.find(i => covers(i, m.caseId) && i.status !== 'void' && !i.stage);
  if (inv) {
    const lines = inv.cases?.length ? inv.lines.filter(l => l.id.startsWith(`${m.caseId}:`)) : inv.lines;
    const value = round2(lines.reduce((n, l) => n + lineNet(l), 0));
    return { value, nhs: round2(lines.filter(l => l.kind === 'NHS').reduce((n, l) => n + lineNet(l), 0)), items: lines.map(l => (inv.cases?.length ? l.description.split(' · ')[2] : l.description).split(' (')[0].split(' ·')[0]) };
  }
  const c = billingCases().find(x => x.id === m.caseId);
  if (c) return { value: round2(expectedValue(s, c, m)), nhs: 0, items: c.services };
  const item = s.catalog.find(i => i.name === m.info?.item);
  return { value: item?.priv ?? 0, nhs: 0, items: m.info?.item ? [m.info.item] : [] };
}

export function activity(s: BillingState): Activity[] {
  const list = new Map(billingCases().map(c => [c.id, c]));
  return Object.values(s.cases).flatMap(m => {
    const c = list.get(m.caseId);
    const acc = account(s, m.accountId);
    const practice = c?.practice ?? (acc?.kind === 'practice' ? acc.name : acc?.practices?.[0] ?? acc?.name ?? '');
    const dentist = c?.dentist ?? m.info?.dentist ?? (acc?.kind === 'dentist' ? acc.name : '');
    if (!practice) return [];
    const v = caseValue(s, m);
    const due = c?.requestedDelivery;
    return [{ caseId: m.caseId, date: m.receivedAt, practice, dentist, accountId: m.accountId, ...v, scanner: c?.scanner ?? (m.history ? 'iTero' : undefined), remake: !!m.remakeOf, onTime: c && m.dispatchedAt && due ? m.dispatchedAt <= isoOf(due) : undefined }];
  });
}
const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "28-May-2026" → "2026-05-28" (case list dates). */
function isoOf(d: string) { const [dd, mon, yy] = d.split('-'); return MONTHS[mon] ? `${yy}-${MONTHS[mon]}-${dd.padStart(2, '0')}` : d; }

export interface HealthRow {
  key: string; status: Health; last30: number; avg: number; change: number | null;
  moneyAtRisk: number; lastCase: string | null; firstCase: string | null; cases90: number; trend: number[];
}

/** Status from the entity's own history: last 30 days against its own 3-month average. */
export function health(acts: Activity[], key: string, t = today()): HealthRow {
  const dates = acts.map(a => a.date).sort();
  const sum = (from: number, to: number) => round2(acts.filter(a => { const d = daysBetween(a.date, t); return d >= from && d < to; }).reduce((n, a) => n + a.value, 0));
  const last30 = sum(0, 30);
  const avg = round2((sum(30, 60) + sum(60, 90) + sum(90, 120)) / 3);
  const first = dates[0] ?? null, last = dates[dates.length - 1] ?? null;
  const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).filter(g => g > 0).sort((a, b) => a - b);
  const usualGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 30;
  const quietFor = last ? daysBetween(last, t) : 999;
  let status: Health = 'Steady';
  if (first && daysBetween(first, t) <= 60) status = 'New';
  else if (quietFor > Math.max(21, usualGap * 2)) status = 'Gone quiet';
  else if (avg && last30 <= avg * 0.75) status = 'Slowing';
  else if (avg && last30 >= avg * 1.25) status = 'Growing';
  // Six months of value, oldest first (for the trend line).
  const trend = [5, 4, 3, 2, 1, 0].map(k => { const ym = monthsBack(t, k); return round2(acts.filter(a => monthOf(a.date) === ym).reduce((n, a) => n + a.value, 0)); });
  return { key, status, last30, avg, change: avg ? round2((last30 - avg) / avg * 100) : null, moneyAtRisk: avg, lastCase: last, firstCase: first, cases90: acts.filter(a => daysBetween(a.date, t) < 90).length, trend };
}
export function monthsBack(t: string, k: number) { let ym = monthOf(t); for (let i = 0; i < k; i++) ym = prevMonth(ym); return ym; }

/** Slow payer: average days to pay more than 15 past terms, or anything over 30 days overdue. */
export function slowPayer(s: BillingState, accountId: string): boolean {
  const acc = account(s, accountId);
  const terms = acc?.termsDays ?? 30;
  const habit = payHabit(s, accountId);
  const t = today();
  const late = s.invoices.some(i => i.accountId === accountId && isOverdue(i, t) && i.dueAt && daysBetween(i.dueAt, t) > 30)
    || s.xeroOnly.some(x => x.accountId === accountId && x.amount > x.paid && daysBetween(x.due, t) > 30);
  return late || (habit != null && habit > terms + 15);
}

export interface PracticeRow extends HealthRow {
  practice: string; accountId: string | null; slow: boolean; thisMonth: number; dentistsActive: number; dentistsTotal: number;
  daysToPay: number | null; owed: number; nhsShare: number | null;
}

export function practiceRows(s: BillingState, ym = monthOf(today())): PracticeRow[] {
  const acts = activity(s);
  const names = [...new Set(acts.map(a => a.practice))];
  return names.map(p => {
    const mine = acts.filter(a => a.practice === p);
    const accId = s.accounts.find(a => a.kind === 'practice' && a.name === p)?.id ?? null;
    const h = health(mine, p);
    const dentists = new Set(mine.map(a => a.dentist).filter(Boolean));
    const active = new Set(mine.filter(a => daysBetween(a.date, today()) < 90).map(a => a.dentist).filter(Boolean));
    const value = mine.reduce((n, a) => n + a.value, 0);
    const nhs = mine.reduce((n, a) => n + a.nhs, 0);
    const owed = accId ? round2(s.invoices.filter(i => i.accountId === accId).reduce((n, i) => n + outstanding(i), 0) + s.xeroOnly.filter(x => x.accountId === accId).reduce((n, x) => n + (x.amount - x.paid), 0)) : 0;
    return {
      ...h, practice: p, accountId: accId, slow: accId ? slowPayer(s, accId) : false,
      thisMonth: round2(mine.filter(a => monthOf(a.date) === ym).reduce((n, a) => n + a.value, 0)),
      dentistsActive: active.size, dentistsTotal: dentists.size, daysToPay: accId ? payHabit(s, accId) : null, owed,
      nhsShare: value ? nhs / value : null,
    };
  }).sort((a, b) => riskRank(b) - riskRank(a));
}

/** Who to call sorts by money at risk, Slowing and Gone quiet first. */
const riskRank = (r: HealthRow) => (r.status === 'Gone quiet' || r.status === 'Slowing' ? 1e9 : 0) + r.moneyAtRisk;

export interface DentistRow extends HealthRow {
  dentist: string; practices: string[]; avgCaseValue: number; topProducts: string[]; scanner: string | null; onTimePct: number | null; remakeRate: number | null;
}

export function dentistRows(s: BillingState): DentistRow[] {
  const acts = activity(s).filter(a => a.dentist);
  return [...new Set(acts.map(a => a.dentist))].map(d => {
    const mine = acts.filter(a => a.dentist === d);
    const h = health(mine, d);
    const counts = new Map<string, number>();
    mine.flatMap(a => a.items).forEach(i => counts.set(i, (counts.get(i) ?? 0) + 1));
    const scanners = new Map<string, number>();
    mine.forEach(a => a.scanner && scanners.set(a.scanner, (scanners.get(a.scanner) ?? 0) + 1));
    const timed = mine.filter(a => a.onTime != null);
    return {
      ...h, dentist: d, practices: [...new Set(mine.map(a => a.practice))],
      avgCaseValue: mine.length ? round2(mine.reduce((n, a) => n + a.value, 0) / mine.length) : 0,
      topProducts: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k),
      scanner: [...scanners].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      onTimePct: timed.length ? timed.filter(a => a.onTime).length / timed.length : null,
      remakeRate: mine.length ? mine.filter(a => a.remake).length / mine.length : null,
    };
  }).sort((a, b) => riskRank(b) - riskRank(a));
}

/** Overview: four numbers for the month, against last month and the same month last year. */
export function overview(s: BillingState, ym = monthOf(today())) {
  const acts = activity(s);
  // Month to date, compared with the same days of the other months (a part-month never looks like a drop).
  const day = Number(today().slice(8, 10));
  const upTo = (d: string) => Number(d.slice(8, 10)) <= day;
  const billed = (m: string) => round2(s.invoices.filter(i => i.issuedAt && i.status !== 'void' && monthOf(i.issuedAt) === m && upTo(i.issuedAt)).reduce((n, i) => n + totals(i).gross, 0));
  const inMonth = (m: string) => acts.filter(a => monthOf(a.date) === m && upTo(a.date));
  const lastYear = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
  const nums = (m: string) => ({
    billed: billed(m), cases: inMonth(m).length,
    practices: new Set(inMonth(m).map(a => a.practice)).size, dentists: new Set(inMonth(m).map(a => a.dentist).filter(Boolean)).size,
  });
  const cur = nums(ym), prev = nums(prevMonth(ym)), ly = nums(lastYear);
  // Concentration: share of the last 3 months' billing from the top 10 practices.
  const from = addDays(today(), -90);
  const byP = new Map<string, number>();
  acts.filter(a => a.date >= from).forEach(a => byP.set(a.practice, (byP.get(a.practice) ?? 0) + a.value));
  const total = [...byP.values()].reduce((a, b) => a + b, 0);
  const top10 = [...byP.values()].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0);
  const top1 = [...byP].sort((a, b) => b[1] - a[1])[0];
  return { cur, prev, ly: ly.cases || ly.billed ? ly : null, concentration: total ? top10 / total : null, practices: byP.size, top1: top1 ? { name: top1[0], share: total ? top1[1] / total : 0 } : null };
}

/** Who to call: the five practices or dentists Slowing or Gone quiet, by money at risk. */
export function whoToCall(s: BillingState) {
  const ps = practiceRows(s).filter(r => r.status === 'Slowing' || r.status === 'Gone quiet').map(r => ({ kind: 'Practice' as const, name: r.practice, accountId: r.accountId, row: r }));
  const ds = dentistRows(s).filter(r => r.status === 'Slowing' || r.status === 'Gone quiet').map(r => ({ kind: 'Dentist' as const, name: r.dentist, accountId: s.accounts.find(a => a.kind === 'dentist' && a.name === r.dentist)?.id ?? null, row: r as HealthRow, practices: r.practices }));
  return [...ps, ...ds].sort((a, b) => b.row.moneyAtRisk - a.row.moneyAtRisk).slice(0, 5);
}

/** Twelve months of value for one practice, and each dentist's own status within it. */
export function practiceDetail(s: BillingState, practice: string) {
  const acts = activity(s).filter(a => a.practice === practice);
  const months = Array.from({ length: 12 }, (_, i) => monthsBack(today(), 11 - i));
  const bars = months.map(ym => ({ ym, value: round2(acts.filter(a => monthOf(a.date) === ym).reduce((n, a) => n + a.value, 0)) }));
  const dentists = [...new Set(acts.map(a => a.dentist).filter(Boolean))].map(d => ({ dentist: d, ...health(acts.filter(a => a.dentist === d), d), cases: acts.filter(a => a.dentist === d).length }))
    .sort((a, b) => b.avg - a.avg);
  const mix = new Map<string, number>();
  acts.forEach(a => a.items.forEach(i => mix.set(i, (mix.get(i) ?? 0) + a.value / Math.max(1, a.items.length))));
  return { bars, dentists, mix: [...mix].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ item: k, value: round2(v) })) };
}
