import type { Currency } from './types';

// ── Money and dates for Billing ──────────────────────────────────────────────
// Billing keeps its own dates as ISO days ("2026-10-18"), relative to today.

const SYMBOL: Record<Currency, string> = { GBP: '£', EUR: '€', USD: '$' };

export function money(n: number, cur: Currency = 'GBP', opts: { round?: boolean } = {}) {
  const v = Math.abs(n);
  const s = opts.round ? Math.round(v).toLocaleString('en-GB') : v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '−' : ''}${SYMBOL[cur]}${s}`;
}

/** GBP → other currencies, as Xero would convert (mock daily rate). */
export const RATES: Record<Currency, number> = { GBP: 1, EUR: 1.17, USD: 1.31 };
export const round2 = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
export const monthOf = (s: string) => s.slice(0, 7);
export const fmtDate = (s: string | null | undefined) => (s ? parse(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtShort = (s: string | null | undefined) => (s ? parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
export const fmtMonth = (ym: string) => parse(`${ym}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const startOfMonth = (s: string) => `${monthOf(s)}-01`;
export function endOfMonth(s: string) { const d = parse(startOfMonth(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); }
export function lastWorkingDay(ym: string) {
  let d = endOfMonth(`${ym}-01`);
  while ([0, 6].includes(parse(d).getDay())) d = addDays(d, -1);
  return d;
}
export const prevMonth = (ym: string) => monthOf(addDays(`${ym}-01`, -1));

/** Small deterministic hash so the seed is the same on every load. */
export function hash(s: string) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
export const pct = (n: number) => `${Math.round(n)}%`;
export const pl = (n: number, w: string, plural = `${w}s`) => `${n} ${n === 1 ? w : plural}`;
