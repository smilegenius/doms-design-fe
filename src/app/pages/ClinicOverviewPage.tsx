import type { ReactNode } from 'react';
import {
  Sparkles, ArrowRight, FolderKanban, Plus, Wallet, ChevronRight,
  CheckCircle2, FileText, BarChart3, Upload, Layers, PauseCircle, CalendarClock,
  CalendarX2, XCircle, MessageSquare, TrendingUp, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─── Clinic Portal — Overview ────────────────────────────────────────────────
// A practice's home dashboard. Mirrors the data shown in the product spec
// prototype — case operations (where lab work stands), financial control
// (invoice-lifecycle exposure), six-month trends, the priority to-do list and a
// live activity feed — rebuilt entirely in this app's existing dashboard styling
// (cards, charts and lists shared with the Group/Lab overviews). All figures are
// demo mocks; clicking a number deep-links into the matching Cases/Invoices view.

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

// Open financial exposure, split into the five invoice-lifecycle buckets that
// make it up (their values sum to OPEN_EXPOSURE). Each row is click-through to
// the matching filtered invoice list. This single pipeline replaces the old
// banner + 7 duplicate tiles.
const OPEN_EXPOSURE = 20400;
const FINANCE_BUCKETS = [
  { label: 'Needs review', value: 5800, count: 18, color: '#E65100', filter: 'qc_review' },
  { label: 'Disputed',     value: 1150, count: 6,  color: '#D4183D', filter: 'disputed' },
  { label: 'Rejected',     value: 1900, count: 8,  color: '#F87171', filter: 'rejected' },
  { label: 'To pay',       value: 8450, count: 24, color: '#4D8EF7', filter: 'unpaid' },
  { label: 'Overdue',      value: 3100, count: 9,  color: '#BE123C', filter: 'overdue' },
];
const EXPOSURE_COUNT = FINANCE_BUCKETS.reduce((s, b) => s + b.count, 0);

// Six-month trend series (mock).
const CLINICAL_TREND = [82, 95, 101, 98, 112, 128];                 // cases submitted / month
const FINANCIAL_TREND = [27, 29, 31, 30, 33, 34.25];               // invoice value £k / month
const PAYMENT_TREND = [                                             // paid vs outstanding £k
  { paid: 15, out: 6 }, { paid: 17, out: 6 }, { paid: 18, out: 7 },
  { paid: 18, out: 7 }, { paid: 20, out: 8 }, { paid: 21.5, out: 12.8 },
];
const DELIVERY_TREND = { onTime: [88, 90, 91, 89, 95, 98], delayed: [6, 7, 9, 9, 11, 9] };

export default function ClinicOverviewPage({ onOpenCases, onCreateCase, onOpenInvoices, onOpenAnalytics }: {
  onOpenCases: () => void;
  onCreateCase: () => void;
  onOpenInvoices?: (filter?: string) => void;
  onOpenAnalytics?: () => void;
}) {
  const { user } = useAuth();
  const displayName = (user?.email || 'there').split('@')[0];

  // Hero summary chips — the at-a-glance headline (matches the spec's header row).
  const chips = [
    { label: 'Need attention', value: '14 cases', color: '#E65100', onClick: onOpenCases },
    { label: 'At delivery risk', value: '7 cases', color: '#D4183D', onClick: onOpenCases },
    { label: 'Awaiting payment', value: fmt(8450), color: '#7C3AED', onClick: () => onOpenInvoices?.('unpaid') },
    { label: 'Overdue', value: fmt(3100), color: '#BE123C', onClick: () => onOpenInvoices?.('overdue') },
  ];

  // Case operations — every tile is an "attention" metric: it gets a red outline
  // when it holds anything, and greys out (cleared / on-track) when it reads 0.
  // The exception is Cases submitted, a neutral throughput KPI. Beyond delivery
  // date is shown at 0 to demonstrate the cleared/greyscale state.
  const caseOps: TileProps[] = [
    { label: 'Cases submitted',     icon: <Layers className="w-4 h-4" />,       accent: '#4D8EF7', value: '128', delta: '+12%', sub: 'Est. £18,450 · £144 avg / case', onClick: onOpenCases },
    { label: 'On hold',             icon: <PauseCircle className="w-4 h-4" />,   attention: true, value: '14', sub: '9 awaiting clinic · oldest 12 days', onClick: onOpenCases },
    { label: 'Approaching delivery',icon: <CalendarClock className="w-4 h-4" />, attention: true, value: '23', sub: '£4,250 value · due tomorrow',        onClick: onOpenCases },
    { label: 'Beyond delivery date',icon: <CalendarX2 className="w-4 h-4" />,    attention: true, value: '0',  sub: 'None past delivery — all on track',   onClick: onOpenCases },
    { label: 'Case not approved',   icon: <XCircle className="w-4 h-4" />,       attention: true, value: '5',  sub: '£950 affected · resubmit to lab',     onClick: onOpenCases },
  ];

  // Priority to-do list — what to action next.
  const actions = [
    { dot: '#D4183D', title: '7 Cases beyond delivery date', sub: 'Delayed lab work — chase suppliers', value: '£1,850', onClick: onOpenCases },
    { dot: '#BE123C', title: '9 Overdue invoices',           sub: 'Past due — risk of supplier hold',  value: '£3,100', onClick: () => onOpenInvoices?.('overdue') },
    { dot: '#E65100', title: '18 Invoices awaiting review',   sub: 'Blocking the next payment run',      value: '£5,800', onClick: () => onOpenInvoices?.('qc_review') },
    { dot: '#E65100', title: '5 Cases not approved',          sub: 'Require resubmission to lab',        value: '£950',   onClick: onOpenCases },
    { dot: '#2E7D32', title: '23 Cases due within 3 days',    sub: 'On track — monitor delivery',        value: '£4,250', onClick: onOpenCases },
  ];

  // Live activity feed across cases & invoices.
  const activity = [
    { icon: FileText,     color: 'text-[#4D8EF7]', bg: 'bg-[#EEF4FF]', text: 'Case #10234 submitted',          meta: 'Crown · 3Shape Lab',          time: '2m ago' },
    { icon: CheckCircle2, color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Invoice INV-129 approved',        meta: '£1,340 · Patterson Dental',   time: '18m ago' },
    { icon: PauseCircle,  color: 'text-[#E65100]', bg: 'bg-[#FFF7ED]', text: 'Case #10320 placed on hold',      meta: 'Awaiting clinic response',    time: '1h ago' },
    { icon: MessageSquare,color: 'text-[#D4183D]', bg: 'bg-[#FFEBEE]', text: 'Invoice INV-555 disputed',        meta: '£562 · Henry Schein',         time: '3h ago' },
    { icon: Wallet,       color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Payment of £1,250 completed',     meta: 'INV-118 · Patterson Dental',  time: 'Yesterday' },
    { icon: CheckCircle2, color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Case #10198 delivered on time',   meta: 'Bridge · 3Shape Lab',         time: 'Yesterday' },
  ];

  const paymentMax = Math.max(...PAYMENT_TREND.map(p => p.paid + p.out)) * 1.1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Hero — welcome + headline + create */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E0E0E6] p-6 sm:p-7">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: 'radial-gradient(circle at top right, #EEF4FF, transparent 65%), radial-gradient(circle at bottom left, #F5F3FF, transparent 70%)' }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white border border-[#E0E0E6] text-[#5A5568] mb-3">
              <Sparkles className="w-3 h-3 text-[#A59DFF]" />
              Clinic Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] capitalize">Good morning, {displayName}</h1>
            <p className="text-sm text-[#717182] mt-1.5 leading-relaxed max-w-xl">
              Here's your practice today — <span className="font-semibold text-[#030213]">16 urgent items</span> need action
              and <span className="font-semibold text-[#030213]">{fmt(OPEN_EXPOSURE)}</span> open across invoices.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
            <button
              onClick={onCreateCase}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New case
            </button>
            <button
              onClick={onOpenCases}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] hover:text-[#030213] hover:bg-[#F8F9FC] transition-colors"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              Open Cases
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Headline chips */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={c.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E0E0E6] text-xs hover:border-[#4D8EF7] hover:shadow-sm transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
              <span className="text-[#717182]">{c.label}</span>
              <span className="font-semibold text-[#030213]">{c.value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Two-column dashboard — operations & to-dos on the left, trends + feed on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6 min-w-0">

          {/* Case operations */}
          <section>
            <SectionLabel info="Where your lab work stands today — counts, value and delivery risk across active cases.">Case operations</SectionLabel>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {caseOps.map((c) => <StatTile key={c.label} {...c} />)}
            </div>
          </section>

          {/* Financial control — concise exposure pipeline */}
          <section>
            <SectionLabel info="Total exposure across the invoice lifecycle — review, approve, pay.">Financial control</SectionLabel>
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-5">
              {/* Headline + context */}
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0]">Open exposure</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-[#030213] leading-none">{fmt(OPEN_EXPOSURE)}</span>
                    <span className="text-[11px] text-[#717182]">{EXPOSURE_COUNT} invoices unsettled</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <MiniStat label="Total invoiced" value="£34,250" delta="+8%" onClick={() => onOpenInvoices?.()} />
                  <MiniStat label="Paid this month" value="£21,450" sub="94% on-time" onClick={() => onOpenInvoices?.('payment_processed')} />
                </div>
              </div>

              {/* Lifecycle pipeline bar */}
              <div className="mt-4 flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-[#F3F3F5]">
                {FINANCE_BUCKETS.map((b) => (
                  <div key={b.label} title={`${b.label}: ${fmt(b.value)}`} style={{ flexGrow: b.value, background: b.color }} />
                ))}
              </div>

              {/* Breakdown list — each row deep-links to the filtered invoices */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {FINANCE_BUCKETS.map((b) => (
                  <button key={b.label} onClick={() => onOpenInvoices?.(b.filter)} className="flex items-center gap-2.5 py-1.5 text-left group border-b border-[#F6F5FA] last:border-0 sm:[&:nth-last-child(2)]:border-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
                    <span className="text-xs text-[#030213] flex-1 truncate group-hover:text-[#4D8EF7] transition-colors">{b.label}</span>
                    <span className="text-[11px] text-[#A0A0B0] tabular-nums">{b.count} inv</span>
                    <span className="text-xs font-semibold text-[#030213] tabular-nums w-14 text-right">{fmt(b.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Action required */}
          <section>
            <SectionLabel info="Priority-ordered tasks that need your attention next.">Action required</SectionLabel>
            <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F0EFF6] flex items-center justify-between">
                <p className="text-xs text-[#717182]">Priority ordered — what to do next</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#C62828]">5 items</span>
              </div>
              <div className="p-2">
                {actions.map((a) => (
                  <button key={a.title} onClick={a.onClick} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.dot }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#030213] truncate">{a.title}</p>
                      <p className="text-[11px] text-[#A0A0B0] truncate">{a.sub}</p>
                    </div>
                    <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0">{a.value}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C0C0CC] flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT COLUMN — trends + activity ────────────────────── */}
        <div className="space-y-6 min-w-0">

          {/* Trends & performance */}
          <section>
            <SectionLabel info="Six-month view of clinical throughput, spend and delivery reliability.">Trends &amp; performance</SectionLabel>
            <div className="space-y-3">
              <ChartCard title="Clinical trend" subtitle="Cases submitted per month">
                <BarChart data={CLINICAL_TREND} max={Math.max(...CLINICAL_TREND) * 1.12} />
              </ChartCard>
              <ChartCard title="Financial trend" subtitle="Invoice value per month (£)">
                <AreaChart data={FINANCIAL_TREND} max={Math.max(...FINANCIAL_TREND) * 1.12} />
              </ChartCard>
              <ChartCard
                title="Payment trend" subtitle="Paid vs outstanding (£)"
                legend={<><LegendDot color="#34D399" label="Paid" /><LegendDot color="#FB923C" label="Outstanding" /></>}
              >
                <StackedBars data={PAYMENT_TREND} max={paymentMax} />
              </ChartCard>
              <ChartCard
                title="Delivery performance" subtitle="On-time vs delayed cases"
                legend={<><LegendDot color="#2E7D32" label="On time" /><LegendDot color="#D4183D" label="Delayed" /></>}
              >
                <LineChart
                  max={100}
                  series={[
                    { values: DELIVERY_TREND.onTime, color: '#2E7D32' },
                    { values: DELIVERY_TREND.delayed, color: '#D4183D' },
                  ]}
                />
              </ChartCard>
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <SectionLabel info="Live feed of case and invoice events across the practice.">Recent activity</SectionLabel>
            <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F0EFF6] flex items-center justify-between">
                <p className="text-xs text-[#717182]">Across cases &amp; invoices</p>
                <button onClick={() => onOpenInvoices?.()} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="p-2">
                {activity.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={i} className="w-full flex items-start gap-3 px-3 py-2 rounded-lg">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                        <Icon className={`w-4 h-4 ${a.color}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#030213] truncate">{a.text}</p>
                        <p className="text-[10px] text-[#A0A0B0] truncate">{a.meta}</p>
                      </div>
                      <span className="text-[10px] text-[#A0A0B0] flex-shrink-0">{a.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction icon={<Plus className="w-4 h-4 text-[#4D8EF7]" />} bg="bg-[#EEF4FF]" title="New case" sub="Send work to a lab" onClick={onCreateCase} />
        <QuickAction icon={<Upload className="w-4 h-4 text-[#7C3AED]" />} bg="bg-[#F5F3FF]" title="Invoices" sub="Review & pay bills" onClick={() => onOpenInvoices?.()} />
        <QuickAction icon={<BarChart3 className="w-4 h-4 text-[#2E7D32]" />} bg="bg-[#F0FDF4]" title="Analytics" sub="Spend & lab insights" onClick={onOpenAnalytics} />
      </div>
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

// Section heading — the flagship gradient-bar label shared with the Group overview.
function SectionLabel({ children, info }: { children: ReactNode; info?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <div className="w-0.5 h-3 rounded-full bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
      <h2 className="text-xs font-semibold text-[#030213] uppercase tracking-wide">{children}</h2>
      {info && <InfoTip text={info} />}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      title={text}
      className="group relative inline-flex items-center justify-center w-4 h-4 rounded-full text-[#A0A0B0] hover:text-[#4D8EF7] focus:text-[#4D8EF7] focus:outline-none cursor-help"
      onClick={(e) => e.stopPropagation()}
    >
      <Info className="w-3 h-3" />
      <span className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block group-focus:block bg-[#030213] text-white text-[10px] font-medium leading-snug px-2 py-1.5 rounded-md shadow-lg whitespace-normal w-48 text-center">
        {text}
      </span>
    </span>
  );
}

// Small inline metric — used for the context figures in the Financial panel.
function MiniStat({ label, value, delta, sub, onClick }: {
  label: string; value: string; delta?: string; sub?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left group">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A0A0B0]">{label}</p>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-base font-bold text-[#030213] group-hover:text-[#4D8EF7] transition-colors">{value}</span>
        {delta && <span className="text-[10px] font-semibold text-[#2E7D32]">{delta}</span>}
      </div>
      {sub && <p className="text-[10px] text-[#A0A0B0] mt-0.5">{sub}</p>}
    </button>
  );
}

interface TileProps {
  label: string;
  icon: ReactNode;
  accent?: string;
  value: string;
  delta?: string;
  sub: string;
  onClick?: () => void;
  // Attention metric: red outline + red icon while it holds anything, greyscale
  // ("cleared / on-track") the moment its value reads 0.
  attention?: boolean;
}

// Compact KPI tile — the same anatomy as the Lab overview StatCard: label + value
// on the left, the icon in a soft circle on the right, both sub-metrics folded
// into one faint line.
function StatTile({ label, icon, accent = '#4D8EF7', value, delta, sub, onClick, attention }: TileProps) {
  const numeric = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  const clear = attention && numeric === 0;   // resolved → greyscale
  const risk = attention && numeric !== 0;    // active → red outline
  const border = risk ? 'border-2 border-[#F87171]' : clear ? 'border border-[#E5E5EA]' : 'border border-[#E0E0E6]';
  const iconTone = risk ? '#D4183D' : clear ? '#A0A0B0' : accent;
  const hover = onClick ? (attention ? 'hover:shadow-md' : 'hover:shadow-md hover:border-[#D4CEE1]') : '';
  return (
    <button onClick={onClick} className={`bg-white rounded-xl p-4 text-left transition-all ${border} ${hover}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs truncate ${clear ? 'text-[#A0A0B0]' : 'text-[#717182]'}`}>{label}</p>
          <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
            <span className={`text-xl font-semibold leading-none ${clear ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{value}</span>
            {delta && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0FDF4] text-[#2E7D32]">
                <TrendingUp className="w-2.5 h-2.5" />{delta}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#A0A0B0] mt-1.5 leading-snug">{sub}</p>
        </div>
        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconTone + (clear ? '14' : '1A'), color: iconTone }}>
          {icon}
        </span>
      </div>
    </button>
  );
}

function QuickAction({ icon, bg, title, sub, onClick }: {
  icon: ReactNode; bg: string; title: string; sub: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3 hover:border-[#4D8EF7] hover:shadow-sm transition-all text-left">
      <span className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#030213]">{title}</p>
        <p className="text-[11px] text-[#717182]">{sub}</p>
      </div>
    </button>
  );
}

// ─── Charts (SVG / CSS — shared dashboard style) ──────────────────────────────

function ChartCard({ title, subtitle, legend, children }: {
  title: string; subtitle: string; legend?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-[#030213]">{title}</h3>
          <p className="text-[10px] text-[#717182] mt-0.5">{subtitle}</p>
        </div>
        {legend && <div className="flex items-center gap-3 flex-shrink-0">{legend}</div>}
      </div>
      {children}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-[10px] text-[#717182]">{label}</span>
    </span>
  );
}

function MonthLabels() {
  return (
    <div className="flex gap-2 mt-1.5">
      {MONTHS.map((m) => <div key={m} className="flex-1 text-center text-[9px] text-[#717182]">{m}</div>)}
    </div>
  );
}

function BarChart({ data, max }: { data: number[]; max: number }) {
  return (
    <div>
      <div className="h-28 flex items-end gap-2">
        {data.map((v, i) => {
          const last = i === data.length - 1;
          return (
            <div key={i} className="flex-1 h-full flex items-end group relative">
              <div
                className={`w-full rounded-t-md transition-all ${last ? 'bg-gradient-to-t from-[#4D8EF7] to-[#A59DFF]' : 'bg-[#DBEAFE] group-hover:bg-[#BFDBFE]'}`}
                style={{ height: `${(v / max) * 100}%` }}
              />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-[#030213] text-white text-[9px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap">{v}</span>
              </div>
            </div>
          );
        })}
      </div>
      <MonthLabels />
    </div>
  );
}

function StackedBars({ data, max }: { data: { paid: number; out: number }[]; max: number }) {
  return (
    <div>
      <div className="h-28 flex items-end gap-2">
        {data.map((d, i) => {
          const paidPct = (d.paid / max) * 100;
          const outPct = (d.out / max) * 100;
          return (
            <div key={i} className="flex-1 h-full relative group">
              <div className="absolute bottom-0 inset-x-0 rounded-b-sm bg-[#34D399]" style={{ height: `${paidPct}%` }} />
              <div className="absolute inset-x-0 rounded-t-md bg-[#FB923C]" style={{ bottom: `${paidPct}%`, height: `${outPct}%` }} />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-[#030213] text-white text-[9px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap">£{(d.paid + d.out).toFixed(1)}k</span>
              </div>
            </div>
          );
        })}
      </div>
      <MonthLabels />
    </div>
  );
}

function AreaChart({ data, max }: { data: number[]; max: number }) {
  const n = data.length;
  const pts = data.map((v, i) => `${(i / (n - 1)) * 100},${38 - (v / max) * 34}`);
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-28">
        <defs>
          <linearGradient id="clinic-fin-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4D8EF7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4D8EF7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,40 ${pts.join(' ')} 100,40`} fill="url(#clinic-fin-grad)" />
        <polyline points={pts.join(' ')} fill="none" stroke="#4D8EF7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <MonthLabels />
    </div>
  );
}

function LineChart({ series, max }: { series: { values: number[]; color: string }[]; max: number }) {
  const n = series[0].values.length;
  const toPts = (vals: number[]) => vals.map((v, i) => `${(i / (n - 1)) * 100},${38 - (v / max) * 34}`).join(' ');
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-28">
        {series.map((s, si) => (
          <polyline key={si} points={toPts(s.values)} fill="none" stroke={s.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <MonthLabels />
    </div>
  );
}
