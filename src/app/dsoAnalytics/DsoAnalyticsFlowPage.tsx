// ─── DSO Analytics · Group Overview (flow preview) ──────────────────────────
// A proposed executive view for the DSO portal's Analytics: lab spend,
// delivery, remakes and where the group can save. It lives only in Flows until
// it's approved, so /supplier/analytics (SpendAnalyticsPage) is untouched. The
// page sits in the DSO portal shell; every other sidebar item opens the real
// portal.
//
// About one screen at 1440×900: the KPI card across the top, then everything
// else as a bento grid of different-sized tiles. One card style throughout
// (white on #F8F9FC, hairline border, small header), brand blue/purple for
// data, green/red only for good/bad. Hover a chart for its values; click a
// clinic (clinic donut or a benchmarking row) to filter to it, click again to
// show every clinic.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, Building2, Calendar, Check, ChevronDown, Clock, FlaskConical,
  Lightbulb, PieChart, RefreshCw, Sparkles, TrendingDown, TrendingUp, UserRound, X,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import {
  CLINICS, DATA_FROM, DATA_TO, DENTIST_OPPORTUNITY, LAB_OPPORTUNITY, LATEST_MONTH, PRESETS, TARGETS,
  benchmarkRow, byClinic, byTreatment, isFullMonth, monthLabel, monthName, rangeLabel, rangeScale, summarise, trend,
  type BenchmarkRow, type DsoClinic, type Range, type Slice, type Summary, type TrendPoint,
} from './data';

// Sidebar ids → real DSO portal paths (App.tsx PAGE_TO_PATH). Analytics stays here.
const PORTAL_PATH: Record<string, string> = { overview: '', 'practice-management': 'practices', 'vat-hub': 'vat' };

export default function DsoAnalyticsFlowPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  // Walkthroughs never stop at the login page.
  useEffect(() => { if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo'); }, [user, login]);
  if (!user) return null;
  return (
    <Layout
      portal="supplier"
      activePage="spend-analytics"
      onNavigate={page => {
        if (page === 'spend-analytics') return;
        const path = PORTAL_PATH[page] ?? page;
        navigate(path ? `/supplier/${path}` : '/supplier');
      }}
    >
      <GroupOverview />
    </Layout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}
/** £2.4m · £248k · £22.4k · £50k */
function fmtK(n: number) {
  if (n >= 1_000_000) return `£${+(n / 1_000_000).toFixed(1)}m`;
  if (n >= 100_000) return `£${Math.round(n / 1000)}k`;
  if (n >= 1000) return `£${+(n / 1000).toFixed(1)}k`;
  return `£${Math.round(n)}`;
}
const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const pct1 = (n: number) => `${n.toFixed(1)}%`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ─── Page ─────────────────────────────────────────────────────────────────────
function GroupOverview() {
  // Defaults to the current month; Month / Quarter / Year live on as presets in the date filter.
  const [range, setRange] = useState<Range>(PRESETS[0].range);
  const [selected, setSelected] = useState<string[]>(() => CLINICS.map(c => c.id));

  const clinics = useMemo(() => CLINICS.filter(c => selected.includes(c.id)), [selected]);
  const s = useMemo(() => summarise(clinics, range), [clinics, range]);
  // The benchmark yardstick: every clinic over the same range.
  const group = useMemo(() => summarise(CLINICS, range), [range]);
  const bench = useMemo(() => clinics.map(c => benchmarkRow(c, range, group)).sort((a, b) => b.savings - a.savings), [clinics, range, group]);
  const treatments = useMemo(() => byTreatment(clinics, range), [clinics, range]);
  const clinicSlices = useMemo(() => byClinic(clinics, range), [clinics, range]);
  const series = useMemo(() => trend(clinics, range), [clinics, range]);
  const scale = useMemo(() => rangeScale(range), [range]);
  // "in Oct 2026" for a whole month, else the dates.
  const when = isFullMonth(range) ? `in ${monthLabel(range.from.slice(0, 7))}` : rangeLabel(range);
  // A range inside one month is compared with the month before; longer ranges show no comparison.
  const vs = s.comparedWith && (range.from.slice(0, 7) === LATEST_MONTH ? 'last month' : monthName(s.comparedWith));

  // Cross-filter: a clinic click shows only that clinic; clicking it again shows them all.
  const picked = selected.length === 1 ? selected[0] : null;
  const pick = (id: string) => setSelected(sel => (sel.length === 1 && sel[0] === id ? CLINICS.map(c => c.id) : [id]));

  const empty = clinics.length === 0;
  const kpis = !empty && <KpiCard s={s} vs={vs} series={series} />;
  const trendCard = !empty && (
    <Card
      title="Lab Spend Trend"
      subtitle={`${series[0].label} – ${series[series.length - 1].label}`}
      action={<div className="flex items-center gap-3"><LegendDot color="#A59DFF" label="Total spend" /><LegendDot color="#4D8EF7" label="Lab spend" /></div>}
      bodyClassName="flex flex-col"
    >
      <TrendChart data={series} />
    </Card>
  );
  const treatCard = !empty && <BreakdownCard title="By Treatment" subtitle="share of lab spend" slices={treatments} />;
  const clinicCard = !empty && (
    <BreakdownCard
      title="By Clinic"
      subtitle={picked ? 'click again for all' : 'click a clinic to filter'}
      slices={clinicSlices}
      onPick={pick}
      picked={picked}
    />
  );
  const benchCard = !empty && <BenchmarkCard bench={bench} group={group} onPick={pick} picked={picked} />;
  const highlights = !empty && <HighlightLines s={s} bench={bench} treatments={treatments} vs={vs} />;
  const opps = !empty && <OpportunityList bench={bench} clinics={clinics} scale={scale} total={s.savings} />;

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC] tabular-nums">
      {/* Header — title + subtitle on the left, the filters on the right */}
      <div className="px-4 sm:px-8 pt-5 pb-1 flex items-start justify-between gap-3 flex-wrap">
        {/* Full width on small screens, so the filters wrap below instead of squeezing the title */}
        <div className="min-w-0 w-full lg:w-auto lg:flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-[#030213]">Analytics</h1>
          <p className="text-xs text-[#717182] mt-0.5">Financial, operational and cost-saving view across the group’s clinics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ClinicSelect selected={selected} onChange={setSelected} />
          <DateRangeSelect range={range} onChange={setRange} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4">
        {empty ? (
          <div className="bg-white border border-[#F0EFF6] rounded-2xl px-6 py-14 text-center">
            <p className="text-sm font-semibold text-[#030213]">No clinics selected</p>
            <p className="text-xs text-[#717182] mt-1">Pick at least one clinic to see the group overview.</p>
            <button
              onClick={() => setSelected(CLINICS.map(c => c.id))}
              className="mt-4 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-md hover:opacity-90"
            >
              Select all clinics
            </button>
          </div>
        ) : (
          // The KPI card across the top, then a bento. From xl, four columns (the first two
          // wide enough for the table, the third for the donut legends):
          //   Trend (2)             │ Treatment │ Key Opportunities
          //   Benchmarking (2,      │ Clinic    │ (tall, rows 1–2)
          //   rows 2–3)             │ Highlights (2)
          // At lg (1024–1279px), three columns (the donut columns a little wider):
          //   Trend (2)             │ Key Opportunities
          //   Treatment │ Clinic    │ (tall, rows 1–2)
          //   Benchmarking (2)      │ Highlights
          // Placed explicitly; below lg the tiles stack in source order.
          <div className="space-y-4">
            {kpis}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1.08fr)_minmax(0,0.84fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-4">
              <div className="sm:col-span-2 lg:col-start-1 lg:row-start-1">{trendCard}</div>
              <div className="sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-3 xl:col-span-2">
                <Card title="Highlights" subtitle={when}>{highlights}</Card>
              </div>
              <div className="lg:col-start-1 lg:row-start-2 xl:col-start-3 xl:row-start-1">{treatCard}</div>
              <div className="lg:col-start-2 lg:row-start-2 xl:col-start-3">{clinicCard}</div>
              <div className="sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:row-span-2 xl:col-start-4">
                <Card title="Key Opportunities" subtitle={`${fmtK(s.savings)} total`} bodyClassName="flex flex-col">{opps}</Card>
              </div>
              <div className="sm:col-span-2 lg:col-start-1 lg:row-start-3 xl:row-start-2 xl:row-span-2">{benchCard}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI card — one card, six cells split by hairlines ────────────────────────
/** `vs` names the month compared with; null (a range longer than a month) hides every comparison. */
function KpiCard({ s, vs, series }: { s: Summary; vs: string | null; series: TrendPoint[] }) {
  const c = vs ? s.change : null;
  const against = <>vs {vs}</>;
  const cells: { label: string; value: string; foot: ReactNode; values: number[]; hero?: boolean }[] = [
    { label: 'Total Lab Spend', value: fmt(s.spend), values: series.map(p => p.lab), foot: c && <><Delta value={c.spend} better="down" /> {against}</> },
    { label: 'Total Lab Orders', value: num(s.cases), values: series.map(p => p.cases), foot: c && <><Delta value={c.cases} better="up" /> {against}</> },
    { label: 'Avg Cost per Case', value: fmt(s.costPerCase), values: series.map(p => p.costPerCase), foot: c && <><Delta value={c.costPerCase} better="down" /> {against}</> },
    { label: 'On-Time Delivery', value: pct1(s.onTime), values: series.map(p => p.onTime), foot: <>{c && <Delta value={c.onTime} better="up" unit=" pts" />} target {TARGETS.onTime}%</> },
    { label: 'Remake Rate', value: pct1(s.remake), values: series.map(p => p.remake), foot: <>{c && <Delta value={c.remake} better="down" unit=" pts" />} target under {TARGETS.remake}%</> },
    { label: 'Potential Savings', value: fmt(s.savings), values: series.map(p => p.savings), foot: <>{s.opportunities} {s.opportunities === 1 ? 'opportunity' : 'opportunities'}</>, hero: true },
  ];
  return (
    <div className="bg-white rounded-2xl border border-[#F0EFF6] shadow-[0_1px_2px_rgba(3,2,19,0.04)] overflow-hidden">
      {/* gap-px over the hairline colour draws the dividers at every breakpoint */}
      {/* Six across from 1120px; narrower than that the labels and values need 3 across */}
      <div className="grid gap-px bg-[#F0EFF6] grid-cols-2 md:grid-cols-3 min-[1120px]:grid-cols-6">
        {cells.map(cell => <KpiCell key={cell.label} {...cell} />)}
      </div>
    </div>
  );
}

// The hero (Potential Savings) is filled with the deeper brand gradient the new-case flow uses
// for white text (newCase/ui GRADIENT_BTN), so its white figures pass contrast.
function KpiCell({ label, value, foot, values, hero }: { label: string; value: string; foot: ReactNode; values: number[]; hero?: boolean }) {
  return (
    <div className={`p-3.5 min-w-0 flex flex-col justify-center gap-1 ${hero ? 'bg-gradient-to-br from-[#3F6FE8] to-[#6A5CE8]' : 'bg-white'}`}>
      <div className={`text-[11px] font-medium truncate flex items-center gap-1 ${hero ? 'text-white/85' : 'text-[#717182]'}`}>
        {hero && <Sparkles className="w-3 h-3 flex-shrink-0" />}{label}
      </div>
      {/* The value always shows in full; the sparkline takes whatever room is left (up to 64px) */}
      <div className="flex items-end gap-2">
        {/* A year's spend (£2,427,780) steps down a size */}
        <div className={`${value.length > 8 ? 'text-lg' : 'text-xl'} font-semibold tracking-tight whitespace-nowrap flex-shrink-0 ${hero ? 'text-white' : 'text-[#030213]'}`}>
          {value}
        </div>
        <Sparkline values={values} hero={hero} className="hidden sm:block flex-1 min-w-0 max-w-[64px] ml-auto mb-1" />
      </div>
      {/* Kept even when empty, so the cells line up */}
      <div className={`text-[10px] flex items-center gap-1 flex-wrap min-h-[14px] ${hero ? 'text-white/80' : 'text-[#A0A0B0]'}`}>{foot}</div>
    </div>
  );
}

/** Arrow + size of a change, green when it moved the good way. */
function Delta({ value, better, unit = '%' }: { value: number; better: 'up' | 'down'; unit?: string }) {
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : (value > 0) === (better === 'up');
  const color = good === null ? '#717182' : good ? '#2E7D32' : '#D4183D';
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color }}>
      {!flat && <Icon className="w-3 h-3" strokeWidth={2.5} />}
      {Math.abs(value).toFixed(1)}{unit}
    </span>
  );
}

/** The KPI's own months (the same ones the trend shows), last point marked. White on the hero.
 *  It stretches to the width it's given (`className` sets it); the dot is HTML so it stays round. */
function Sparkline({ values, hero, className = '' }: { values: number[]; hero?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const W = 100, H = 26, P = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [P + (i / Math.max(values.length - 1, 1)) * (W - 2 * P), P + (1 - (v - min) / span) * (H - 2 * P)]);
  const line = pts.map(p => p.join(',')).join(' ');
  const last = pts[pts.length - 1];
  const color = hero ? '#FFFFFF' : '#4D8EF7';
  return (
    <div className={`relative h-[26px] ${className}`} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={hero ? 0.3 : 0.2} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${pts[0][0]},${H} ${line} ${last[0]},${H}`} fill={`url(#${id}-a)`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span
        className="absolute w-[6px] h-[6px] rounded-full -translate-x-1/2 -translate-y-1/2 border"
        style={{ left: `${last[0]}%`, top: `${(last[1] / H) * 100}%`, background: color, borderColor: hero ? '#6A5CE8' : '#FFFFFF' }}
      />
    </div>
  );
}

// ─── Lab spend trend — two series, £ axis, hover crosshair ────────────────────
function niceStep(rough: number) {
  const mag = 10 ** Math.floor(Math.log10(rough));
  return ([1, 2, 2.5, 5, 10].find(s => s * mag >= rough) ?? 10) * mag;
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const peak = Math.max(...data.map(d => d.total));
  const step = niceStep(peak / 4);
  const top = Math.ceil(peak / step) * step;
  const ticks: number[] = [];
  for (let v = top; v >= 0; v -= step) ticks.push(v);
  // Points sit inside a 4% gutter so the end dots aren't clipped.
  const x = (i: number) => 4 + (i / (n - 1)) * 92;
  const y = (v: number) => 100 - (v / top) * 100;
  const line = (key: 'lab' | 'total') => data.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');
  const area = (key: 'lab' | 'total') => `${x(0)},100 ${line(key)} ${x(n - 1)},100`;
  const SERIES = [
    { key: 'total' as const, label: 'Total spend', color: '#A59DFF', grad: 'dso-trend-total' },
    { key: 'lab' as const, label: 'Lab spend', color: '#4D8EF7', grad: 'dso-trend-lab' },
  ];
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - r.left) / r.width) * 100;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((pct - 4) / 92) * (n - 1)))));
  };
  const h = hover != null ? data[hover] : null;
  const shown = hover ?? n - 1; // the latest month is marked until the pointer picks another

  return (
    <div className="flex-1 flex flex-col min-h-[150px]">
      <div className="flex-1 flex gap-2 min-h-0">
        <div className="relative w-9 flex-shrink-0">
          {ticks.map(t => (
            <span key={t} className="absolute right-0 -translate-y-1/2 text-[10px] text-[#A0A0B0]" style={{ top: `${y(t)}%` }}>{fmtK(t)}</span>
          ))}
        </div>
        <div className="relative flex-1 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {ticks.map(t => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-[#F0EFF6]" style={{ top: `${y(t)}%` }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              {SERIES.map(sr => (
                <linearGradient key={sr.grad} id={sr.grad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sr.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={sr.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {SERIES.map(sr => <polygon key={sr.key} points={area(sr.key)} fill={`url(#${sr.grad})`} />)}
            {SERIES.map(sr => (
              <polyline key={sr.key} points={line(sr.key)} fill="none" stroke={sr.color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>
          {/* Crosshair */}
          {h && <div className="absolute top-0 bottom-0 border-l border-dashed border-[#A0A0B0] pointer-events-none" style={{ left: `${x(hover!)}%` }} />}
          {/* Dots (HTML so they stay round on a stretched chart): the hovered month, else the latest */}
          {SERIES.map(sr => (
            <span
              key={sr.key}
              className={`absolute rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 shadow-sm pointer-events-none transition-all ${h ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}
              style={{ left: `${x(shown)}%`, top: `${y(data[shown][sr.key])}%`, background: sr.color }}
            />
          ))}
          {h && (
            <div
              className={`absolute top-1 z-10 pointer-events-none bg-white border border-[#F0EFF6] rounded-lg shadow-lg px-2.5 py-2 whitespace-nowrap ${
                hover! > (n - 1) / 2 ? '-translate-x-full -ml-2' : 'ml-2'
              }`}
              style={{ left: `${x(hover!)}%` }}
            >
              <p className="text-[10px] font-semibold text-[#030213] mb-1">{h.label}</p>
              {SERIES.map(sr => (
                <p key={sr.key} className="text-[10px] text-[#717182] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sr.color }} />
                  {sr.label} <span className="ml-auto pl-2 font-semibold text-[#030213]">{fmt(h[sr.key])}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-1.5">
        <div className="w-9 flex-shrink-0" />
        <div className="relative flex-1 h-3">
          {data.map((d, i) => (
            <span
              key={d.key}
              className={`absolute -translate-x-1/2 text-[10px] leading-none ${i === hover ? 'text-[#030213] font-semibold' : 'text-[#A0A0B0]'}`}
              style={{ left: `${x(i)}%` }}
            >
              {d.month}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[11px] text-[#717182]">{label}</span>
    </span>
  );
}

// ─── Donut breakdown — one design for treatment type and clinic ──────────────
// Hovering a segment or a legend row lights both up and puts its value in the
// centre. With `onPick` (clinics) a click filters the page to that clinic.
function BreakdownCard({ title, subtitle, slices, onPick, picked }: {
  title: string; subtitle: string; slices: Slice[]; onPick?: (id: string) => void; picked?: string | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = sum(slices.map(sl => sl.value));
  const a = active != null ? slices[active] : null;
  const pickAt = onPick ? (i: number) => { const id = slices[i].id; if (id) onPick(id); } : undefined;
  return (
    <Card title={title} subtitle={subtitle} bodyClassName="flex items-center">
      <div className="flex items-center gap-2.5 min-[1440px]:gap-3 w-full">
        {/* 68px until the window reaches 1440px (96px after), so the legend names fit in full in a narrow tile */}
        <div className="relative flex-shrink-0">
          <Donut data={slices} size={96} thickness={12} active={active} onHover={setActive} onPick={pickAt} className="w-[68px] h-[68px] min-[1440px]:w-24 min-[1440px]:h-24" />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-[#030213]" title={fmt(a ? a.value : total)}>{fmtK(a ? a.value : total)}</span>
            <span className="text-[9px] text-[#717182] max-w-[48px] min-[1440px]:max-w-[64px] truncate">{a ? `${Math.round((a.value / total) * 100)}% · ${a.label}` : 'Total'}</span>
          </div>
        </div>
        <ul className="flex-1 min-w-0" onMouseLeave={() => setActive(null)}>
          {slices.map((sl, i) => {
            const on = active === i || (picked != null && sl.id === picked);
            return (
              <li
                key={sl.label}
                onMouseEnter={() => setActive(i)}
                onClick={pickAt ? () => pickAt(i) : undefined}
                title={pickAt ? `${sl.label}: ${fmt(sl.value)} · click to ${picked === sl.id ? 'show all clinics' : `show only ${sl.label}`}` : `${sl.label}: ${fmt(sl.value)}`}
                className={`flex items-center justify-between gap-1.5 px-1 py-[3px] rounded-md transition-all ${on ? 'bg-[#F8F9FC]' : ''} ${
                  active != null && active !== i ? 'opacity-40' : ''
                } ${pickAt ? 'cursor-pointer' : ''}`}
              >
                <span className="text-[11px] text-[#030213] flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sl.color }} />
                  <span className={`truncate ${on ? 'font-semibold' : ''}`}>{sl.label}</span>
                </span>
                <span className="text-[11px] font-semibold text-[#030213] flex-shrink-0">{total ? Math.round((sl.value / total) * 100) : 0}%</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

/** `size` is the drawing's own scale; `className` can set a different display size. */
function Donut({ data, size, thickness, active, onHover, onPick, className = '' }: {
  data: Slice[]; size: number; thickness: number;
  active: number | null; onHover: (i: number | null) => void; onPick?: (i: number) => void; className?: string;
}) {
  const total = sum(data.map(d => d.value));
  // Room for the hovered segment to grow without clipping.
  const r = size / 2 - (thickness + 4) / 2;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 2 : 0; // a hairline of white between segments
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`-rotate-90 ${className}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F3F5" strokeWidth={thickness} />
      {data.map((d, i) => {
        const len = total ? (d.value / total) * c : 0;
        const drawn = Math.max(len - gap, 0.01);
        const seg = (
          <circle
            key={d.label}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={d.color}
            strokeWidth={active === i ? thickness + 4 : thickness}
            strokeDasharray={`${drawn} ${c - drawn}`} strokeDashoffset={-offset}
            opacity={active != null && active !== i ? 0.35 : 1}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={onPick ? () => onPick(i) : undefined}
            style={{ cursor: onPick ? 'pointer' : 'default', transition: 'stroke-width 150ms, opacity 150ms' }}
          >
            <title>{`${d.label}: ${fmt(d.value)}`}</title>
          </circle>
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}

// ─── Clinic benchmarking — bullet bars against the group average ─────────────
/** A value, then a slim bar with a marker at the group average. The bar is
 *  tinted green when the clinic does better than average, red when worse. */
function Bullet({ text, value, avg, min, max, better }: {
  text: string; value: number; avg: number; min: number; max: number; better: 'up' | 'down';
}) {
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const diff = ((value - avg) / avg) * 100;
  const tone = Math.abs(diff) < 2 ? '#C8C8D0' : (diff > 0) === (better === 'up') ? '#34D399' : '#F87171';
  return (
    <span className="inline-flex items-center gap-2" title={`${diff > 0 ? '+' : ''}${Math.round(diff)}% vs the group average`}>
      <span className="w-10 min-[1440px]:w-11 font-semibold text-[#030213]">{text}</span>
      {/* Shorter until the window reaches 1440px, so the table fits its tile without scrolling */}
      <span className="relative w-8 min-[1440px]:w-12 h-1.5 rounded-full bg-[#F0EFF6]">
        <span className="absolute inset-y-0 left-0 rounded-full opacity-80" style={{ width: `${pos(value)}%`, background: tone }} />
        <span className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-full bg-[#030213]/45" style={{ left: `calc(${pos(avg)}% - 1px)` }} />
      </span>
    </span>
  );
}

function BenchmarkCard({ bench: rows, group, onPick, picked }: {
  bench: BenchmarkRow[]; group: Summary; onPick: (id: string) => void; picked: string | null;
}) {
  // A little tighter until the window reaches 1440px, so the table fits its tile without scrolling.
  const th = 'px-2 min-[1440px]:px-2.5 py-2 text-left text-[11px] font-medium text-[#A0A0B0]';
  const td = 'px-2 min-[1440px]:px-2.5 py-2';
  // Scales: from zero for £ and remakes, 80–100% for on-time (where the differences live).
  const costMax = Math.max(group.costPerCase, ...rows.map(r => r.costPerCase)) * 1.1;
  const remakeMax = Math.max(group.remake, ...rows.map(r => r.remake)) * 1.15;
  return (
    <Card
      title="Clinic Benchmarking"
      subtitle="vs the group average · click a clinic to filter"
      action={
        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#A0A0B0]">
          <span className="w-[2px] h-2.5 rounded-full bg-[#030213]/45" /> group avg
          <span className="w-2 h-1.5 rounded-full bg-[#34D399] opacity-80 ml-1.5" /> better
          <span className="w-2 h-1.5 rounded-full bg-[#F87171] opacity-80 ml-1.5" /> worse
        </span>
      }
      flush
    >
      {/* Full height, so the rows share out a tile taller than the table (no gap at the foot) */}
      <div className="h-full overflow-x-auto">
        <table className="w-full h-full min-w-[460px] text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#F0EFF6]">
              <th className={`${th} pl-4`}>Clinic</th>
              <th className={th}>Spend / Case</th>
              <th className={th}>On-Time</th>
              <th className={th}>Remakes</th>
              <th className={`${th} pr-4 text-right`}>Savings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.clinic.id}
                onClick={() => onPick(r.clinic.id)}
                title={picked === r.clinic.id ? 'Click to show all clinics' : `Show only ${r.clinic.name}`}
                className={`cursor-pointer transition-colors ${picked === r.clinic.id ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}
              >
                <td className={`${td} pl-4 font-semibold text-[#030213]`}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.clinic.color }} />
                    {r.clinic.short}
                  </span>
                </td>
                <td className={td}><Bullet text={fmt(r.costPerCase)} value={r.costPerCase} avg={group.costPerCase} min={0} max={costMax} better="down" /></td>
                <td className={td}><Bullet text={pct1(r.onTime)} value={r.onTime} avg={group.onTime} min={80} max={100} better="up" /></td>
                <td className={td}><Bullet text={pct1(r.remake)} value={r.remake} avg={group.remake} min={0} max={remakeMax} better="down" /></td>
                <td className={`${td} pr-4 text-right font-semibold text-[#030213]`}>{fmt(r.savings)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Group-wide yardstick over the same dates — doesn't move with the clinic filter */}
            <tr className="border-t border-[#F0EFF6] text-[#717182]">
              <td className={`${td} pl-4`}>Group avg <span className="text-[#A0A0B0]">· all {CLINICS.length}</span></td>
              <td className={td}>{fmt(group.costPerCase)}</td>
              <td className={td}>{pct1(group.onTime)}</td>
              <td className={td}>{pct1(group.remake)}</td>
              <td className={`${td} pr-4 text-right`}>{fmt(group.savings)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ─── Highlights — four one-liners read off the numbers ───────────────────────
const TONES = {
  green:  { bg: '#ECFDF5', fg: '#059669' },
  amber:  { bg: '#FFF7ED', fg: '#E65100' },
  red:    { bg: '#FEF2F2', fg: '#D4183D' },
  brand:  { bg: '#EEF4FF', fg: '#4D8EF7' },
};

function HighlightLines({ s, bench, treatments, vs }: { s: Summary; bench: BenchmarkRow[]; treatments: Slice[]; vs: string | null }) {
  const many = bench.length > 1;
  const lowestOnTime = [...bench].sort((a, b) => a.onTime - b.onTime)[0];
  const highestRemake = [...bench].sort((a, b) => b.remake - a.remake)[0];
  const word = (v: number) => (v >= 0 ? 'up' : 'down');

  // With a month to compare: how spend moved. Over a longer range (no comparisons): where it goes.
  const c = vs ? s.change : null;
  const top2 = [...treatments].sort((a, b) => b.value - a.value).slice(0, 2);
  const top2Share = s.spend ? Math.round(((top2[0].value + top2[1].value) / s.spend) * 100) : 0;
  type Row = { tone: keyof typeof TONES; icon: ReactNode; title: string; body: string };
  const spendRow: Row = c
    ? {
        tone: c.spend > c.cases ? 'amber' : 'green',
        icon: c.spend >= 0 ? <TrendingUp /> : <TrendingDown />,
        title: c.spend >= 0 ? 'Spend increasing' : 'Spend decreasing',
        body: `Lab spend ${word(c.spend)} ${Math.abs(c.spend).toFixed(1)}% vs ${vs} · orders ${word(c.cases)} ${Math.abs(c.cases).toFixed(1)}%`,
      }
    : {
        tone: 'brand',
        icon: <PieChart />,
        title: 'Where lab spend goes',
        body: `${top2[0].label} and ${top2[1].label} are ${top2Share}% of lab spend`,
      };
  const rows: Row[] = [
    spendRow,
    {
      tone: s.onTime >= TARGETS.onTime ? 'green' : s.onTime >= 90 ? 'amber' : 'red',
      icon: <Clock />,
      title: s.onTime >= TARGETS.onTime ? 'Delivery on target' : s.onTime >= 90 ? 'Delivery close to target' : 'Delivery below target',
      body: `${pct1(s.onTime)} on time (target ${TARGETS.onTime}%)${many ? ` · ${lowestOnTime.clinic.short} lowest at ${pct1(lowestOnTime.onTime)}` : ''}`,
    },
    {
      tone: s.remake <= TARGETS.remake ? 'green' : 'red',
      icon: <RefreshCw />,
      title: s.remake <= TARGETS.remake ? 'Remake rate within target' : 'Remake rate above target',
      body: `${pct1(s.remake)} remade (target under ${TARGETS.remake}%)${many ? ` · ${highestRemake.clinic.short} highest at ${pct1(highestRemake.remake)}` : ''}`,
    },
    {
      tone: 'brand',
      icon: <Lightbulb />,
      title: 'Savings opportunity',
      body: `${fmt(s.savings)} to save across ${s.opportunities} ${s.opportunities === 1 ? 'opportunity' : 'opportunities'}`,
    },
  ];

  // One line each: a toned icon (good / close / off target) and the short line; the title is its tooltip.
  return (
    <ul className="space-y-1.5">
      {rows.map(r => (
        <li key={r.title} className="flex items-center gap-2.5" title={`${r.title}: ${r.body}`}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5" style={{ background: TONES[r.tone].bg, color: TONES[r.tone].fg }}>
            {r.icon}
          </div>
          {/* One line in the wide bento tile; wraps full width on a phone */}
          <p className="min-w-0 text-xs text-[#5A5568] leading-snug xl:truncate">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

// ─── Key opportunities — ranked, each with a bar sized against total savings ──
/** `bench` is sorted by savings, so its first row is the clinic with the most to save.
 *  Always a tall tile in the bento: the rows share out its height and their lines wrap. */
function OpportunityList({ bench, clinics, scale, total }: { bench: BenchmarkRow[]; clinics: DsoClinic[]; scale: number; total: number }) {
  const ids = clinics.map(c => c.id);
  const top = bench[0];
  const pricey = top.costDiff > 2;

  const items: { key: string; eyebrow: string; icon: ReactNode; title: string; body: string; amount: number }[] = [
    {
      key: 'clinic',
      eyebrow: 'Clinic',
      icon: <Building2 className="w-3 h-3" />,
      title: `${top.clinic.short} — ${pricey ? 'higher spend per case' : 'remakes and late cases'}`,
      body: pricey
        ? `Cost per case ${Math.round(top.costDiff)}% above average · standardise pricing`
        : `${pct1(top.remake)} remakes, ${pct1(top.onTime)} on time · cut both`,
      amount: top.savings,
    },
  ];
  if (DENTIST_OPPORTUNITY.clinicIds.some(id => ids.includes(id))) {
    items.push({ key: 'dentist', eyebrow: 'Dentist', icon: <UserRound className="w-3 h-3" />, title: DENTIST_OPPORTUNITY.title, body: DENTIST_OPPORTUNITY.body, amount: Math.round(DENTIST_OPPORTUNITY.amount * scale) });
  }
  if (LAB_OPPORTUNITY.clinicIds.some(id => ids.includes(id))) {
    items.push({ key: 'lab', eyebrow: 'Lab', icon: <FlaskConical className="w-3 h-3" />, title: LAB_OPPORTUNITY.title, body: LAB_OPPORTUNITY.body, amount: Math.round(LAB_OPPORTUNITY.amount * scale) });
  }
  items.sort((a, b) => b.amount - a.amount);

  return (
    <ol className="flex-1 flex flex-col justify-around gap-3">
      {items.map((it, i) => (
        <li key={it.key} className="flex gap-2.5">
          <span className="w-5 h-5 mt-px rounded-full bg-[#F3F3F5] text-[10px] font-semibold text-[#717182] flex items-center justify-center flex-shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 text-xs font-semibold text-[#030213]">{it.title}</p>
              <p className="text-xs font-semibold text-[#030213] flex-shrink-0">{fmt(it.amount)}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-[11px] text-[#717182]">{it.body}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-[#A0A0B0] flex-shrink-0">{it.icon}{it.eyebrow}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-[#F0EFF6] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]" style={{ width: `${total ? Math.min(100, (it.amount / total) * 100) : 0}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Shared look for the two filter buttons.
const FILTER_BTN = 'inline-flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg border bg-white transition-colors';

// ─── Date range — presets (the old Month / Quarter / Year) + a custom range ──
// The custom part is SpendAnalyticsPage's popover: From / To, Cancel / Apply.
function DateRangeSelect({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const active = PRESETS.find(p => p.range.from === range.from && p.range.to === range.to)?.id ?? 'custom';
  const valid = !!from && !!to && from <= to && from >= DATA_FROM && to <= DATA_TO;
  const label = 'block text-[10px] font-semibold text-[#717182] uppercase tracking-wide mb-1';
  const input = 'w-full px-2 py-1.5 text-xs border border-[#E0E0E6] rounded focus:outline-none focus:border-[#4D8EF7]';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setFrom(range.from); setTo(range.to); setOpen(v => !v); }}
        className={`${FILTER_BTN} ${open ? 'border-[#4D8EF7]' : 'border-[#E0E0E6] hover:border-[#C8D8FC]'}`}
      >
        <Calendar className="w-3.5 h-3.5 text-[#4D8EF7]" />
        <span className="font-medium text-[#030213]">{rangeLabel(range)}</span>
        <ChevronDown className={`w-3 h-3 text-[#A0A0B0] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 right-0 w-72 bg-white border border-[#E0E0E6] rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 border-b border-[#F0EFF6]">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => { onChange(p.range); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#FAFBFF] transition-colors"
              >
                <span className="w-3.5 flex-shrink-0">{active === p.id && <Check className="w-3.5 h-3.5 text-[#4D8EF7]" strokeWidth={3} />}</span>
                <span className={`flex-1 text-xs ${active === p.id ? 'font-semibold text-[#030213]' : 'text-[#5A5568]'}`}>{p.label}</span>
                <span className="text-[10px] text-[#A0A0B0]">{rangeLabel(p.range)}</span>
              </button>
            ))}
          </div>
          <div className="p-3">
            <p className="text-xs font-semibold text-[#030213] mb-2 flex items-center gap-1.5">
              Custom range
              {active === 'custom' && <Check className="w-3.5 h-3.5 text-[#4D8EF7]" strokeWidth={3} />}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>From</label>
                <input type="date" value={from} min={DATA_FROM} max={to || DATA_TO} onChange={e => setFrom(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>To</label>
                <input type="date" value={to} min={from || DATA_FROM} max={DATA_TO} onChange={e => setTo(e.target.value)} className={input} />
              </div>
            </div>
            <p className="text-[10px] text-[#A0A0B0] mt-2">Data from {rangeLabel({ from: DATA_FROM, to: DATA_TO })}</p>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-medium border border-[#E0E0E6] text-[#717182] rounded-md hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onChange({ from, to }); setOpen(false); }}
                disabled={!valid}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Clinic filter — multi-select, all clinics on by default ─────────────────
// The × clears a narrowed filter (e.g. after clicking a clinic in a chart).
function ClinicSelect({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const allOn = selected.length === CLINICS.length;
  const summary = allOn ? 'All Clinics'
    : selected.length === 0 ? 'No clinics'
    : selected.length === 1 ? CLINICS.find(c => c.id === selected[0])!.name
    : `${selected.length} of ${CLINICS.length} clinics`;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`${FILTER_BTN} ${open ? 'border-[#4D8EF7]' : allOn ? 'border-[#E0E0E6] hover:border-[#C8D8FC]' : 'border-[#C8D8FC] bg-[#EEF4FF]'}`}
      >
        <Building2 className="w-3.5 h-3.5 text-[#4D8EF7]" />
        <span className={`font-medium ${allOn ? 'text-[#030213]' : 'text-[#4D8EF7]'}`}>{summary}</span>
        {allOn
          ? <ChevronDown className={`w-3 h-3 text-[#A0A0B0] transition-transform ${open ? 'rotate-180' : ''}`} />
          : (
            <span
              role="button"
              aria-label="Show all clinics"
              title="Show all clinics"
              onClick={e => { e.stopPropagation(); onChange(CLINICS.map(c => c.id)); setOpen(false); }}
              className="-mr-1 w-4 h-4 rounded flex items-center justify-center text-[#4D8EF7] hover:bg-white"
            >
              <X className="w-3 h-3" />
            </span>
          )}
      </button>
      {open && (
        <div className="absolute z-40 mt-1 left-0 sm:left-auto sm:right-0 w-64 bg-white border border-[#E0E0E6] rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              onClick={() => onChange(allOn ? [] : CLINICS.map(c => c.id))}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#FAFBFF] transition-colors border-b border-[#F0EFF6]"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${allOn ? 'bg-[#4D8EF7] border-[#4D8EF7]' : selected.length > 0 ? 'bg-[#EEF4FF] border-[#4D8EF7]' : 'border-[#C8C8D0] bg-white'}`}>
                {allOn ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} /> : selected.length > 0 ? <span className="w-1.5 h-[2px] bg-[#4D8EF7] rounded-full" /> : null}
              </span>
              <span className="text-xs font-semibold text-[#030213]">All Clinics</span>
            </button>
            {CLINICS.map(c => {
              const on = selected.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#FAFBFF] transition-colors">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#C8C8D0] bg-white'}`}>
                    {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className={`text-xs truncate ${on ? 'font-semibold text-[#030213]' : 'text-[#5A5568]'}`}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card — one style for every tile ──────────────────────────────────────────
// White on the page's #F8F9FC, a hairline border, a small header with the
// subtitle inline, no divider under it.
function Card({ title, subtitle, action, children, flush, bodyClassName = '' }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode;
  /** No body padding — for a table that runs edge to edge. */
  flush?: boolean;
  bodyClassName?: string;
}) {
  return (
    <section className="bg-white rounded-2xl border border-[#F0EFF6] shadow-[0_1px_2px_rgba(3,2,19,0.04)] h-full flex flex-col overflow-hidden">
      <header className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-x-3 gap-y-1 flex-wrap">
        {/* One line in the bento (lg+): the title never wraps; only the subtitle may truncate.
            On narrower screens, where tiles are full width, the subtitle wraps instead. */}
        <h2 className="min-w-0 flex flex-wrap lg:flex-nowrap items-baseline gap-x-1.5 text-[13px] font-semibold text-[#030213] leading-tight">
          <span className="whitespace-nowrap">{title}</span>
          {subtitle && <span className="min-w-0 lg:truncate text-[11px] font-normal text-[#A0A0B0]" title={subtitle}>{subtitle}</span>}
        </h2>
        {action}
      </header>
      <div className={`flex-1 ${flush ? 'pb-1' : 'px-4 pb-4'} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
