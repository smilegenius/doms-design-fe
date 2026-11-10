// ─── DSO Analytics · Group Overview (flow preview) · mock data ──────────────
// Lab work for six of the group's practices: Oct 2026 and Sep 2026 as real
// months per clinic, and the ten months before that following the group's
// curve. Every figure on the page is worked out from the clinics and the date
// range the viewer picked: spend ÷ cases is the cost per case, rates are
// weighted by case volume, savings add up. A range that starts or ends
// mid-month takes that share of the month. The Group Average used for
// benchmarking is always the whole group over the same range, so a filtered
// clinic is still compared with it.

export const TARGETS = { onTime: 95, remake: 3 };

// Data colours stay in the brand: blue and purple, alternating, from strong to
// pale, so the biggest slice is the strongest. Green and red are kept for
// good / bad only.
export const PALETTE = ['#4D8EF7', '#A59DFF', '#86B1FA', '#C9C3FF', '#B9D1FC', '#E2DEFF'];
const OTHER_GREY = '#E0E0E6';

export const TREATMENTS = [
  { key: 'crowns',     label: 'Crowns & Bridges', color: PALETTE[0] },
  { key: 'implants',   label: 'Implants',         color: PALETTE[1] },
  { key: 'aligners',   label: 'Aligners',         color: PALETTE[2] },
  { key: 'dentures',   label: 'Dentures',         color: PALETTE[3] },
  { key: 'removables', label: 'Removables',       color: PALETTE[4] },
  { key: 'other',      label: 'Other',            color: OTHER_GREY },
] as const;
export type TreatmentKey = typeof TREATMENTS[number]['key'];

interface Month { cases: number; spend: number; onTime: number; remake: number }

export interface DsoClinic {
  id: string;
  name: string;
  /** City only — for the donut legend and narrow cells. */
  short: string;
  color: string;
  /** Oct 2026 (the latest month) and Sep 2026. */
  now: Month;
  prev: Month;
  /** £ that could be saved in Oct, and how many separate actions make it up. */
  savings: number;
  opportunities: number;
  /** Share of the clinic's lab spend per treatment type (adds up to 100). */
  mix: Record<TreatmentKey, number>;
}

export const CLINICS: DsoClinic[] = [
  {
    // Clinic colours follow October's spend ranking, so the clinic donut runs strong → pale.
    id: 'london', name: 'Smile Genius London', short: 'London', color: PALETTE[2],
    now:  { cases: 420, spend: 41160, onTime: 94, remake: 2.9 },
    prev: { cases: 400, spend: 37600, onTime: 93, remake: 3.2 },
    savings: 2100, opportunities: 1,
    mix: { crowns: 30, implants: 26, aligners: 18, dentures: 10, removables: 8, other: 8 },
  },
  {
    id: 'manchester', name: 'Smile Genius Manchester', short: 'Manchester', color: PALETTE[5],
    now:  { cases: 380, spend: 39900, onTime: 92, remake: 3.5 },
    prev: { cases: 360, spend: 36700, onTime: 91, remake: 3.9 },
    savings: 3000, opportunities: 2,
    mix: { crowns: 34, implants: 20, aligners: 14, dentures: 14, removables: 10, other: 8 },
  },
  {
    id: 'leeds', name: 'Smile Genius Leeds', short: 'Leeds', color: PALETTE[0],
    now:  { cases: 310, spend: 44950, onTime: 88, remake: 5.2 },
    prev: { cases: 290, spend: 40600, onTime: 86, remake: 6.1 },
    savings: 8200, opportunities: 3,
    mix: { crowns: 36, implants: 28, aligners: 10, dentures: 12, removables: 6, other: 8 },
  },
  {
    id: 'birmingham', name: 'Smile Genius Birmingham', short: 'Birmingham', color: PALETTE[3],
    now:  { cases: 360, spend: 40320, onTime: 91, remake: 3.6 },
    prev: { cases: 350, spend: 38900, onTime: 90, remake: 4.1 },
    savings: 2400, opportunities: 2,
    mix: { crowns: 32, implants: 22, aligners: 16, dentures: 12, removables: 9, other: 9 },
  },
  {
    id: 'bristol', name: 'Smile Genius Bristol', short: 'Bristol', color: PALETTE[1],
    now:  { cases: 330, spend: 41250, onTime: 89, remake: 4.8 },
    prev: { cases: 310, spend: 37400, onTime: 88, remake: 5.5 },
    savings: 5600, opportunities: 3,
    mix: { crowns: 30, implants: 26, aligners: 15, dentures: 13, removables: 8, other: 8 },
  },
  {
    id: 'glasgow', name: 'Smile Genius Glasgow', short: 'Glasgow', color: PALETTE[4],
    now:  { cases: 346, spend: 40136, onTime: 93, remake: 3.1 },
    prev: { cases: 330, spend: 38100, onTime: 91, remake: 3.6 },
    savings: 1100, opportunities: 1,
    mix: { crowns: 30, implants: 22, aligners: 17, dentures: 13, removables: 9, other: 9 },
  },
];

// Named opportunities below clinic level (Oct figures). Each belongs to
// clinics, so it is hidden once all of them are filtered out.
export const DENTIST_OPPORTUNITY = {
  dentist: 'Dr. Sharma',
  clinicIds: ['leeds'],
  title: 'Dr. Sharma — zirconia crowns',
  body: 'Zirconia crowns 32% above average · use the preferred lab',
  amount: 3400,
};
export const LAB_OPPORTUNITY = {
  lab: 'Kingsbridge Dental',
  clinicIds: ['leeds', 'bristol'],
  title: 'Kingsbridge Dental — late & remakes',
  body: '83% on time, 6.1% remakes · review or move the work',
  amount: 2900,
};

// ─── Months & date ranges ───────────────────────────────────────────────────

/** Inclusive dates, 'YYYY-MM-DD'. */
export interface Range { from: string; to: string }

export const DATA_FROM = '2025-11-01';
export const DATA_TO = '2026-10-31';
export const LATEST_MONTH = '2026-10';

export const PRESETS: { id: string; label: string; range: Range }[] = [
  { id: 'month', label: 'This month',     range: { from: '2026-10-01', to: '2026-10-31' } },
  { id: '3m',    label: 'Last 3 months',  range: { from: '2026-08-01', to: '2026-10-31' } },
  { id: '12m',   label: 'Last 12 months', range: { from: DATA_FROM, to: DATA_TO } },
];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymd = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
/** 'YYYY-MM' moved by n months. Keys compare correctly as strings. */
export function shiftMonth(key: string, n: number) {
  const [y, m] = key.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return monthKey(Math.floor(i / 12), (i % 12) + 1);
}
export const monthName = (key: string) => MON[Number(key.slice(5, 7)) - 1];
export const monthLabel = (key: string) => `${monthName(key)} ${key.slice(0, 4)}`;

/** "1 Oct – 31 Oct 2026"; the first year only shows when the years differ. */
export function rangeLabel(r: Range) {
  const [ay, am, ad] = ymd(r.from);
  const [by, bm, bd] = ymd(r.to);
  return `${ad} ${MON[am - 1]}${ay === by ? '' : ` ${ay}`} – ${bd} ${MON[bm - 1]} ${by}`;
}

export const isSingleMonth = (r: Range) => r.from.slice(0, 7) === r.to.slice(0, 7);
export function isFullMonth(r: Range) {
  const [y, m, d] = ymd(r.to);
  return isSingleMonth(r) && r.from.endsWith('-01') && d === daysIn(y, m);
}

/** Each month the range touches, with the share of it that's inside the range. */
export function monthsIn(r: Range): { key: string; fraction: number }[] {
  const [ay, am, ad] = ymd(r.from);
  const [by, bm, bd] = ymd(r.to);
  const first = monthKey(ay, am);
  const last = monthKey(by, bm);
  const out: { key: string; fraction: number }[] = [];
  for (let k = first; k <= last; k = shiftMonth(k, 1)) {
    const [y, m] = k.split('-').map(Number);
    const days = daysIn(y, m);
    const start = k === first ? ad : 1;
    const end = k === last ? bd : days;
    out.push({ key: k, fraction: (end - start + 1) / days });
  }
  return out;
}

// Months before Sep follow the group's curve: lab spend as a share of Oct.
// Oct 2025 is only there so Nov 2025 has a month to compare with.
const MONTH_SHARE: Record<string, number> = {
  '2025-10': 0.7, '2025-11': 0.72, '2025-12': 0.7, '2026-01': 0.74, '2026-02': 0.75, '2026-03': 0.78,
  '2026-04': 0.79, '2026-05': 0.8, '2026-06': 0.84, '2026-07': 0.885, '2026-08': 0.87,
};
// Lab spend as a share of all the group's buying (consumables, equipment…).
const LAB_SHARE_OF_TOTAL: Record<string, number> = { '2026-05': 0.71, '2026-08': 0.69 };

/** One clinic's figures for one whole month. */
function monthData(c: DsoClinic, key: string): Month {
  if (key === LATEST_MONTH) return c.now;
  if (key === shiftMonth(LATEST_MONTH, -1)) return c.prev;
  const spend = c.now.spend * (MONTH_SHARE[key] ?? 0);
  // Older months keep September's cost per case and run slightly worse on delivery and remakes.
  return { spend, cases: spend / (c.prev.spend / c.prev.cases), onTime: c.prev.onTime - 0.5, remake: c.prev.remake + 0.2 };
}

/** One clinic over a range: volumes add up, rates are weighted by cases. */
function clinicRange(c: DsoClinic, r: Range): Month {
  let cases = 0, spend = 0, onTime = 0, remake = 0;
  for (const { key, fraction } of monthsIn(r)) {
    const m = monthData(c, key);
    cases += m.cases * fraction;
    spend += m.spend * fraction;
    onTime += m.onTime * m.cases * fraction;
    remake += m.remake * m.cases * fraction;
  }
  return { cases, spend, onTime: cases ? onTime / cases : 0, remake: cases ? remake / cases : 0 };
}

/** Savings move with spend: Oct's figure scaled to the range. */
const clinicSavings = (c: DsoClinic, spend: number) => (c.savings * spend) / c.now.spend;

// ─── Sums ───────────────────────────────────────────────────────────────────

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface Summary {
  cases: number;
  spend: number;
  costPerCase: number;
  onTime: number;
  remake: number;
  savings: number;
  opportunities: number;
  /** Change vs the month before (% for volumes, points for rates). Only for a range inside one month. */
  change: { spend: number; cases: number; costPerCase: number; onTime: number; remake: number } | null;
  /** The month compared with, when there's a change. */
  comparedWith: string | null;
}

function totals(months: Month[]) {
  const cases = sum(months.map(m => m.cases));
  const spend = sum(months.map(m => m.spend));
  return {
    cases,
    spend,
    costPerCase: cases ? spend / cases : 0,
    onTime: cases ? sum(months.map(m => m.onTime * m.cases)) / cases : 0,
    remake: cases ? sum(months.map(m => m.remake * m.cases)) / cases : 0,
  };
}

export function summarise(clinics: DsoClinic[], r: Range): Summary {
  const per = clinics.map(c => ({ c, m: clinicRange(c, r) }));
  const t = totals(per.map(p => p.m));
  let change: Summary['change'] = null;
  let comparedWith: string | null = null;
  if (isSingleMonth(r)) {
    // Whole months either side, so a part-month range still compares like with like.
    const key = r.from.slice(0, 7);
    comparedWith = shiftMonth(key, -1);
    const cur = totals(clinics.map(c => monthData(c, key)));
    const before = totals(clinics.map(c => monthData(c, comparedWith!)));
    const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
    change = {
      spend: pct(cur.spend, before.spend),
      cases: pct(cur.cases, before.cases),
      costPerCase: pct(cur.costPerCase, before.costPerCase),
      onTime: cur.onTime - before.onTime,
      remake: cur.remake - before.remake,
    };
  }
  return {
    cases: Math.round(t.cases),
    spend: Math.round(t.spend),
    costPerCase: t.costPerCase,
    onTime: t.onTime,
    remake: t.remake,
    savings: Math.round(sum(per.map(p => clinicSavings(p.c, p.m.spend)))),
    opportunities: sum(clinics.map(c => c.opportunities)),
    change,
    comparedWith,
  };
}

/** How the range's group spend compares with October — scales the named opportunities. */
export function rangeScale(r: Range) {
  return sum(CLINICS.map(c => clinicRange(c, r).spend)) / sum(CLINICS.map(c => c.now.spend));
}

// ─── Trend ──────────────────────────────────────────────────────────────────
// The months in the range when it spans three or more; otherwise the six
// months ending with it (pushed later if that runs before the data starts).

// Every KPI's sparkline reads from the same months.
export function trend(clinics: DsoClinic[], r: Range) {
  let keys = monthsIn(r).map(p => p.key);
  if (keys.length < 3) {
    let k = shiftMonth(r.to.slice(0, 7), -5);
    if (k < DATA_FROM.slice(0, 7)) k = DATA_FROM.slice(0, 7);
    keys = [];
    for (; keys.length < 6 && k <= LATEST_MONTH; k = shiftMonth(k, 1)) keys.push(k);
  }
  return keys.map(key => {
    const months = clinics.map(c => monthData(c, key));
    const t = totals(months);
    return {
      key,
      month: monthName(key),
      label: monthLabel(key),
      lab: t.spend,
      total: t.spend / (LAB_SHARE_OF_TOTAL[key] ?? 0.7),
      cases: t.cases,
      costPerCase: t.costPerCase,
      onTime: t.onTime,
      remake: t.remake,
      savings: sum(clinics.map((c, i) => clinicSavings(c, months[i].spend))),
    };
  });
}
export type TrendPoint = ReturnType<typeof trend>[number];

// ─── Breakdowns for the donuts ──────────────────────────────────────────────

/** `id` is set on clinic slices, so a click can filter to that clinic. */
export interface Slice { label: string; value: number; color: string; id?: string }

/** Whole pounds that still add up to the rounded total (the KPI), the
 *  rounding difference going to the largest slice. */
function wholePounds(slices: Slice[]): Slice[] {
  const rounded = slices.map(s => ({ ...s, value: Math.round(s.value) }));
  const gap = Math.round(sum(slices.map(s => s.value))) - sum(rounded.map(s => s.value));
  if (gap && rounded.length) rounded.reduce((a, b) => (b.value > a.value ? b : a)).value += gap;
  return rounded;
}

export function byTreatment(clinics: DsoClinic[], r: Range): Slice[] {
  const spend = clinics.map(c => ({ c, spend: clinicRange(c, r).spend }));
  return wholePounds(TREATMENTS.map(t => ({
    label: t.label,
    color: t.color,
    value: sum(spend.map(s => (s.spend * s.c.mix[t.key]) / 100)),
  })));
}

export function byClinic(clinics: DsoClinic[], r: Range): Slice[] {
  return wholePounds(clinics
    .map(c => ({ id: c.id, label: c.short, color: c.color, value: clinicRange(c, r).spend }))
    .sort((a, b) => b.value - a.value));
}

// ─── Benchmarking ───────────────────────────────────────────────────────────

export type Standing = 'Below' | 'Slightly below' | 'On par' | 'Slightly above' | 'Above';

/** Where a clinic's spend per case sits against the group average. */
export function standing(diffPct: number): Standing {
  if (diffPct <= -8) return 'Below';
  if (diffPct <= -2) return 'Slightly below';
  if (diffPct < 2) return 'On par';
  if (diffPct < 8) return 'Slightly above';
  return 'Above';
}

export type BenchmarkRow = ReturnType<typeof benchmarkRow>;

/** One clinic over the range against the group (summarise(CLINICS, r)). */
export function benchmarkRow(c: DsoClinic, r: Range, group: Summary) {
  const m = clinicRange(c, r);
  const costPerCase = m.spend / m.cases;
  const rel = (v: number, avg: number) => ((v - avg) / avg) * 100;
  return {
    clinic: c,
    costPerCase,
    costDiff: rel(costPerCase, group.costPerCase),
    onTime: m.onTime,
    onTimeDiff: rel(m.onTime, group.onTime),
    remake: m.remake,
    remakeDiff: rel(m.remake, group.remake),
    savings: Math.round(clinicSavings(c, m.spend)),
    standing: standing(rel(costPerCase, group.costPerCase)),
  };
}
