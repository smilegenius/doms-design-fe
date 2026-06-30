import { useState, type ReactNode } from 'react';
import {
  Wallet, Clock, AlertTriangle, FileText, ArrowRight, CheckCircle2,
  TrendingUp, TrendingDown, Building2, Users, BarChart3,
  ChevronRight, Info,
} from 'lucide-react';

// ─── Clinic Portal — Analytics ───────────────────────────────────────────────
// Practice-scoped analytics, restyled to mirror the group/supplier portal
// (gradient-pill sub-tabs + grey period selector) so the two surfaces feel like
// one product. Four tabs:
//   • Invoice Intelligence — the AP pipeline a practice owns: what's been
//     received, approved, paid, and what's stuck (overdue / disputed), grouped
//     by the lab or supplier it came from. Invoice £ figures throughout.
//   • Spend     — what the practice buys, by month and by GL category.
//   • Suppliers — who it buys from: labs AND general suppliers combined.
//   • Clinical  — financial exposure pipeline + six-month performance trends
//     (moved off the dashboard, which now stays operational/at-a-glance).

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

// ── Period (display-only for the prototype) ──────────────────────────────────
type Period = 'Month' | 'Quarter' | 'Year';
type Tab = 'intelligence' | 'spend' | 'suppliers' | 'clinical';

// Sub-tabs + per-tab subtitle. Styled to match the group/supplier portal
// (gradient pills) so the two analytics surfaces feel like one product.
const TABS: { id: Tab; label: string }[] = [
  { id: 'clinical',     label: 'Clinical' },
  { id: 'intelligence', label: 'Invoice Intelligence' },
  { id: 'spend',        label: 'Spend' },
  { id: 'suppliers',    label: 'Suppliers' },
];
const SUBTITLE: Record<Tab, string> = {
  intelligence: 'Your invoice pipeline — received, approved, paid and what needs action.',
  spend:        'What your practice buys, by month and category.',
  suppliers:    'Who you buy from — dental labs and general suppliers.',
  clinical:     'Lab performance and six-month clinical trends.',
};

// ── Invoice Intelligence — clinic AP pipeline (counts + £) ────────────────────
const INV_KPI = {
  received: 101,
  approved: 24, approvedValue: 8450,
  paid: 31,     paidValue: 21450,
  awaiting: 5,  awaitingValue: 2150,
  overdue: 9,   overdueValue: 3100,
};
// `filter` is the token InvoicesPage understands, so each row deep-links to the
// matching filtered list.
const INV_PIPELINE = [
  { label: 'Paid',              count: 31, value: 21450, color: '#34D399', filter: 'payment_processed' },
  { label: 'Approved · to pay', count: 24, value: 8450,  color: '#4D8EF7', filter: 'unpaid' },
  { label: 'Needs review',      count: 18, value: 5800,  color: '#A59DFF', filter: 'qc_review' },
  { label: 'Overdue',           count: 9,  value: 3100,  color: '#F87171', filter: 'overdue' },
  { label: 'Rejected',          count: 8,  value: 1900,  color: '#FB923C', filter: 'rejected' },
  { label: 'Disputed',          count: 6,  value: 1150,  color: '#D4183D', filter: 'disputed' },
  { label: 'Awaiting approval', count: 5,  value: 2150,  color: '#FBBF24', filter: 'awaiting_approval' },
];
const INV_PIPELINE_MAX = Math.max(...INV_PIPELINE.map(p => p.count));

// Invoices needing action, grouped by the lab / supplier they came from.
const ACTION_OVERDUE  = [
  { name: 'Eurodontic Ltd',     count: 4, value: 1480, filter: 'overdue' },
  { name: 'Apex Dental Lab',    count: 3, value: 920,  filter: 'overdue' },
  { name: 'Smile Ceramics',     count: 2, value: 700,  filter: 'overdue' },
];
const ACTION_DISPUTED = [
  { name: 'Kingsbridge Dental', count: 3, value: 560, filter: 'disputed' },
  { name: 'Henry Schein',       count: 2, value: 410, filter: 'disputed' },
  { name: 'S4S London',         count: 1, value: 180, filter: 'disputed' },
];

// Labs / suppliers whose invoices carry active flags — chase the vendor, not docs.
const VENDOR_ISSUES = [
  { name: 'Eurodontic Ltd',     flagged: 4, total: 12, worst: 'High',   flags: ['Overdue', 'Amount above norm'] },
  { name: 'Apex Dental Lab',    flagged: 3, total: 7,  worst: 'High',   flags: ['Overdue', 'PO number missing'] },
  { name: 'Kingsbridge Dental', flagged: 3, total: 18, worst: 'Medium', flags: ['Disputed amount'] },
  { name: 'Henry Schein',       flagged: 2, total: 9,  worst: 'Medium', flags: ['VAT number missing'] },
];

// ── Spend — what the practice buys ───────────────────────────────────────────
const SPEND_KPI = [
  { label: 'Total Spend',   value: fmt(12480), sub: 'this period',        accent: '#4D8EF7', icon: <TrendingUp className="w-5 h-5 text-[#4D8EF7]" /> },
  { label: 'Lab Spend',     value: fmt(8100),  sub: '65% of total',       accent: '#2E7D32', icon: <FileText className="w-5 h-5 text-[#2E7D32]" /> },
  { label: 'Non-Lab Spend', value: fmt(4380),  sub: '35% of total',       accent: '#7C3AED', icon: <FileText className="w-5 h-5 text-[#7C3AED]" /> },
  { label: 'Avg Invoice',   value: fmt(144),   sub: 'across all invoices',accent: '#1565C0', icon: <BarChart3 className="w-5 h-5 text-[#1565C0]" /> },
];

const SPEND_CATEGORIES = [
  { key: 'lab',         label: 'Lab Work',    color: '#4D8EF7' },
  { key: 'consumables', label: 'Consumables', color: '#A59DFF' },
  { key: 'equipment',   label: 'Equipment',   color: '#34D399' },
] as const;
const MONTHLY_SPEND = [
  { month: 'Jan', lab: 6200, consumables: 2100, equipment: 900 },
  { month: 'Feb', lab: 5800, consumables: 2400, equipment: 1200 },
  { month: 'Mar', lab: 7100, consumables: 2000, equipment: 600 },
  { month: 'Apr', lab: 6800, consumables: 2600, equipment: 1500 },
  { month: 'May', lab: 7400, consumables: 2200, equipment: 800 },
  { month: 'Jun', lab: 8100, consumables: 2900, equipment: 1480 },
];
const SPEND_MAX = Math.max(...MONTHLY_SPEND.map(m => m.lab + m.consumables + m.equipment));

const SPEND_BY_LAB = [
  { name: 'S4S London',          value: 4820, color: '#4D8EF7' },
  { name: 'Kingsbridge Dental',  value: 3110, color: '#A59DFF' },
  { name: 'Smile Ceramics',      value: 2240, color: '#34D399' },
  { name: 'Eurodontic Ltd',      value: 1460, color: '#FB923C' },
  { name: 'Apex Dental Lab',     value: 850,  color: '#F87171' },
];
const LAB_MAX = Math.max(...SPEND_BY_LAB.map(l => l.value));

const GL_CATEGORIES = [
  { label: 'Lab & Prosthetics', amount: 8100, pct: 65 },
  { label: 'Consumables',       amount: 2900, pct: 23 },
  { label: 'Equipment',         amount: 1480, pct: 12 },
];

// ── Suppliers — labs + general suppliers combined ────────────────────────────
const VENDOR_KPI = [
  { label: 'Active Vendors',      value: '18',      sub: 'labs & suppliers', accent: '#4D8EF7', icon: <Building2 className="w-5 h-5 text-[#4D8EF7]" /> },
  { label: 'New This Period',     value: '2',       sub: 'first invoice',    accent: '#2E7D32', icon: <Users className="w-5 h-5 text-[#2E7D32]" /> },
  { label: 'Avg Invoices/Vendor', value: '5.6',     sub: 'this period',      accent: '#E65100', icon: <FileText className="w-5 h-5 text-[#E65100]" /> },
  { label: 'Avg Spend/Vendor',    value: fmt(693),  sub: 'this period',      accent: '#1565C0', icon: <BarChart3 className="w-5 h-5 text-[#1565C0]" /> },
];
const TOP_VENDORS = [
  { name: 'S4S London',         category: 'Lab',      invoices: 14, spend: 4820, trend: 'up'   },
  { name: 'Kingsbridge Dental', category: 'Lab',      invoices: 11, spend: 3110, trend: 'down' },
  { name: 'Henry Schein',       category: 'Supplier', invoices: 9,  spend: 2240, trend: 'up'   },
  { name: 'Smile Ceramics',     category: 'Lab',      invoices: 8,  spend: 1460, trend: 'up'   },
  { name: 'Patterson Dental',   category: 'Supplier', invoices: 6,  spend: 1180, trend: 'down' },
  { name: 'Apex Dental Lab',    category: 'Lab',      invoices: 5,  spend: 850,  trend: 'up'   },
];
const VENDOR_COLORS = ['#34D399', '#4D8EF7', '#A59DFF', '#FB923C', '#F87171', '#6EE7B7'];
const CATEGORY_SPEND = [
  { label: 'Dental Labs', amount: 8100, color: '#34D399' },
  { label: 'Consumables', amount: 2900, color: '#4D8EF7' },
  { label: 'Equipment',   amount: 1480, color: '#A59DFF' },
];

// ── Trends (six-month, mock) — split across the Invoice Intelligence and
// Clinical tabs. Financial control now lives back on the dashboard. ──────────
const CLINICAL_TREND = [82, 95, 101, 98, 112, 128];                 // cases submitted / month
const FINANCIAL_TREND = [27, 29, 31, 30, 33, 34.25];               // invoice value £k / month
const PAYMENT_TREND = [                                             // paid vs outstanding £k
  { paid: 15, out: 6 }, { paid: 17, out: 6 }, { paid: 18, out: 7 },
  { paid: 18, out: 7 }, { paid: 20, out: 8 }, { paid: 21.5, out: 12.8 },
];
const DELIVERY_TREND = { onTime: [88, 90, 91, 89, 95, 98], delayed: [6, 7, 9, 9, 11, 9] };

// Lab performance — manager-requested KPIs. Every headline figure is computed
// from this single per-lab table so the maths is self-consistent (and the
// formula is shown in each card's sub-line).
const LAB_PERFORMANCE = [
  { name: 'S4S London',         orders: 42, turnaround: 5.2, spend: 4820, color: '#4D8EF7' },
  { name: 'Kingsbridge Dental', orders: 31, turnaround: 6.8, spend: 3110, color: '#A59DFF' },
  { name: 'Smile Ceramics',     orders: 28, turnaround: 6.1, spend: 2240, color: '#34D399' },
  { name: 'Eurodontic Ltd',     orders: 26, turnaround: 8.4, spend: 1460, color: '#FB923C' },
  { name: 'Apex Dental Lab',    orders: 22, turnaround: 7.0, spend: 850,  color: '#F87171' },
];
const LAB_COUNT = LAB_PERFORMANCE.length;                                    // 5
const TOTAL_ORDERS = LAB_PERFORMANCE.reduce((s, l) => s + l.orders, 0);      // 149
const TOTAL_LAB_SPEND = LAB_PERFORMANCE.reduce((s, l) => s + l.spend, 0);    // 12,480
const PAYMENT_PROCESSED = 21450;                                            // paid this period
const DELAYED_ORDERS = 7;
const DELAYED_VALUE = 1850;
const AVG_TURNAROUND = 6.5;                                                 // days, order → delivery
const AVG_COST_PER_LAB = Math.round(TOTAL_LAB_SPEND / LAB_COUNT);            // 2,496
const ORDERS_PER_LAB = (TOTAL_ORDERS / LAB_COUNT).toFixed(1);               // 29.8
const AVG_ORDER_VALUE = Math.round(PAYMENT_PROCESSED / TOTAL_ORDERS);        // 144
const PROJECTED_YEAR = TOTAL_LAB_SPEND * 12;                                // 149,760
const ORDERS_MAX = Math.max(...LAB_PERFORMANCE.map(l => l.orders));
const TURNAROUND_MAX = Math.max(...LAB_PERFORMANCE.map(l => l.turnaround));

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClinicAnalyticsPage({ onOpenInvoices }: {
  onOpenInvoices?: (filter?: string) => void;
  onOpenCases?: () => void;
}) {
  const [period, setPeriod] = useState<Period>('Month');
  const [tab, setTab] = useState<Tab>('clinical');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl space-y-5">
      {/* Header + period */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213]">Analytics</h1>
          <p className="text-sm text-[#717182] mt-0.5">{SUBTITLE[tab]}</p>
        </div>
        {/* Period selector — matches the group/supplier portal */}
        <div className="flex items-center gap-1 bg-[#F3F3F5] rounded-lg p-1">
          {(['Month', 'Quarter', 'Year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                period === p ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs — gradient pills, matching the group/supplier portal */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.id
                ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                : 'text-[#717182] hover:text-[#030213] hover:bg-[#F3F3F5]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INVOICE INTELLIGENCE TAB ─────────────────────────────── */}
      {tab === 'intelligence' && (
        <>
          {/* KPI row — pipeline outcomes, with £ figures */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard accent="#4D8EF7" icon={<FileText className="w-5 h-5 text-[#4D8EF7]" />}     label="Invoices Received" value={INV_KPI.received} sub={`this ${period.toLowerCase()}`} />
            <KpiCard accent="#2E7D32" icon={<CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />} label="Approved · to pay"  value={INV_KPI.approved} sub={fmt(INV_KPI.approvedValue)} onClick={() => onOpenInvoices?.('unpaid')} />
            <KpiCard accent="#1565C0" icon={<Wallet className="w-5 h-5 text-[#1565C0]" />}       label="Paid this period"   value={INV_KPI.paid}     sub={fmt(INV_KPI.paidValue)} onClick={() => onOpenInvoices?.('payment_processed')} />
            <KpiCard accent="#E65100" icon={<Clock className="w-5 h-5 text-[#E65100]" />}        label="Awaiting approval"  value={INV_KPI.awaiting} sub={fmt(INV_KPI.awaitingValue)} onClick={() => onOpenInvoices?.('awaiting_approval')} />
            <KpiCard alert            icon={<AlertTriangle className="w-5 h-5 text-[#D4183D]" />} label="Overdue"           value={INV_KPI.overdue}  sub={`${fmt(INV_KPI.overdueValue)} · pay now`} onClick={() => onOpenInvoices?.('overdue')} />
          </div>

          {/* Pipeline + action-needed-by-vendor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Invoice Pipeline" subtitle="Invoices by status — count and value">
              <div className="space-y-2.5">
                {INV_PIPELINE.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => onOpenInvoices?.(p.filter)}
                    className="w-full group flex items-center gap-3 hover:bg-[#FAFBFD] -mx-1 px-1 py-0.5 rounded-lg transition-colors"
                  >
                    <span className="text-xs text-[#5A5568] w-32 flex-shrink-0 text-right group-hover:text-[#1565C0] transition-colors">{p.label}</span>
                    <div className="flex-1 h-5 bg-[#F3F3F5] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (p.count / INV_PIPELINE_MAX) * 100)}%`, background: p.color }} />
                    </div>
                    <span className="text-[11px] text-[#A0A0B0] tabular-nums flex-shrink-0 w-8 text-right">{p.count}</span>
                    <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0 w-14 text-right">{fmt(p.value)}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card
              title="By Vendor — Action Needed"
              subtitle="Overdue and disputed invoices, grouped by lab / supplier"
              action={
                <button onClick={() => onOpenInvoices?.('overdue')} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
                  View unpaid <ChevronRight className="w-3 h-3" />
                </button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-0 sm:divide-x sm:divide-[#F0EFF6]">
                <div className="sm:pr-4">
                  <VendorActionList title="Overdue" tone="red" items={ACTION_OVERDUE} onSelect={(f) => onOpenInvoices?.(f)} />
                </div>
                <div className="sm:pl-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-[#F0EFF6]">
                  <VendorActionList title="Disputed" tone="amber" items={ACTION_DISPUTED} onSelect={(f) => onOpenInvoices?.(f)} />
                </div>
              </div>
            </Card>
          </div>

          {/* Vendors with issues */}
          <Card
            title="Labs & Suppliers With Issues"
            subtitle="Invoices from these vendors have active flags"
            action={
              <button onClick={() => onOpenInvoices?.('disputed')} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {VENDOR_ISSUES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onOpenInvoices?.('disputed')}
                  className="group w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                    s.worst === 'High' ? 'bg-[#FFF7ED] text-[#E65100]' : 'bg-[#F3F3F5] text-[#5A5568]'
                  }`}>
                    {s.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#030213] truncate group-hover:text-[#1565C0] transition-colors">{s.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.worst === 'High' ? 'bg-[#FFF7ED] text-[#E65100]' : 'bg-[#F3F3F5] text-[#5A5568]'}`}>{s.worst}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.flags.map((f, j) => (
                        <span key={j} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#9A3412]">{f}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                    <div>
                      <p className="text-sm font-bold text-[#030213] leading-none">{s.flagged}</p>
                      <p className="text-[9px] text-[#A0A0B0] mt-0.5">of {s.total}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#C8C8D0] group-hover:text-[#4D8EF7] transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Invoice value & payment trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Financial trend" subtitle="Invoice value per month (£)">
              <AreaChart data={FINANCIAL_TREND} max={Math.max(...FINANCIAL_TREND) * 1.12} />
            </ChartCard>
            <ChartCard
              title="Payment trend" subtitle="Paid vs outstanding (£)"
              legend={<><LegendDot color="#34D399" label="Paid" /><LegendDot color="#FB923C" label="Outstanding" /></>}
            >
              <StackedBars data={PAYMENT_TREND} max={Math.max(...PAYMENT_TREND.map(p => p.paid + p.out)) * 1.1} />
            </ChartCard>
          </div>
        </>
      )}

      {/* ── SPEND TAB ────────────────────────────────────────────── */}
      {tab === 'spend' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SPEND_KPI.map((k) => (
              <KpiCard key={k.label} accent={k.accent} icon={k.icon} label={k.label} value={k.value} sub={k.sub} />
            ))}
          </div>

          {/* Monthly spend — stacked by category */}
          <Card title="Monthly Spend" subtitle="What your practice buys, by category">
            <div className="flex items-end gap-3 h-48">
              {MONTHLY_SPEND.map((m) => {
                const total = m.lab + m.consumables + m.equipment;
                const totalH = (total / SPEND_MAX) * 168;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#A0A0B0] font-medium">{fmt(total)}</span>
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: `${totalH}px` }}>
                      {SPEND_CATEGORIES.map((cat, idx) => {
                        const v = (m as any)[cat.key] as number;
                        const h = (v / total) * totalH;
                        const isFirst = idx === 0;
                        const isLast = idx === SPEND_CATEGORIES.length - 1;
                        return (
                          <div
                            key={cat.key}
                            className={`w-full max-w-[30px] mx-auto ${isLast ? 'rounded-t-md' : ''} ${isFirst ? 'rounded-b-sm' : ''}`}
                            style={{ height: `${h}px`, background: cat.color }}
                            title={`${cat.label}: ${fmt(v)}`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-[#717182] font-medium">{m.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[#F0EFF6]">
              {SPEND_CATEGORIES.map((c) => (
                <div key={c.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="text-[11px] text-[#5A5568]">{c.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Spend by lab + GL category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card
              title="Spend by Lab"
              subtitle="Top labs this period"
              action={
                <button onClick={() => onOpenInvoices?.()} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
                  Invoices <ArrowRight className="w-3 h-3" />
                </button>
              }
            >
              <BarList rows={SPEND_BY_LAB.map(l => ({ label: l.name, value: l.value, color: l.color }))} max={LAB_MAX} formatValue={fmt} />
            </Card>

            <Card title="Spend by GL Category" subtitle="Top cost categories">
              <div className="space-y-3">
                {GL_CATEGORIES.map((g) => (
                  <div key={g.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#717182] w-36 flex-shrink-0 truncate">{g.label}</span>
                    <div className="flex-1 h-5 bg-[#F3F3F5] rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all duration-500" style={{ width: `${g.pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-[#030213] w-14 text-right tabular-nums">{fmt(g.amount)}</span>
                    <span className="text-[10px] text-[#A0A0B0] w-8 text-right tabular-nums">{g.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ── SUPPLIERS TAB — labs + suppliers combined ───────────────── */}
      {tab === 'suppliers' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VENDOR_KPI.map((k) => (
              <KpiCard key={k.label} accent={k.accent} icon={k.icon} label={k.label} value={k.value} sub={k.sub} />
            ))}
          </div>

          {/* Top vendors — table + donut */}
          <Card title="Top Vendors by Spend" subtitle="Labs and suppliers · this period">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-center">
              <div className="space-y-0">
                <div className="grid grid-cols-[2fr_auto_auto_auto] text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest pb-2 border-b border-[#F0EFF6] mb-1 gap-3">
                  <span>Vendor</span>
                  <span className="text-right">Invoices</span>
                  <span className="text-right">Spend</span>
                  <span className="text-center">Trend</span>
                </div>
                {TOP_VENDORS.map((s, i) => (
                  <div key={i} className="grid grid-cols-[2fr_auto_auto_auto] items-center py-3 border-b border-[#F8F8F8] last:border-b-0 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: VENDOR_COLORS[i % VENDOR_COLORS.length] }} />
                      <p className="text-xs font-semibold text-[#030213] truncate">{s.name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.category === 'Lab' ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-[#F0FDF4] text-[#2E7D32]'}`}>{s.category}</span>
                    </div>
                    <span className="text-xs font-medium text-[#717182] text-right">{s.invoices}</span>
                    <span className="text-xs font-bold text-[#030213] text-right">{fmt(s.spend)}</span>
                    <div className="flex justify-center">
                      {s.trend === 'up'
                        ? <TrendingUp className="w-3.5 h-3.5 text-[#2E7D32]" />
                        : <TrendingDown className="w-3.5 h-3.5 text-[#D4183D]" />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  <Donut data={TOP_VENDORS.map((s, i) => ({ label: s.name, value: s.spend, color: VENDOR_COLORS[i % VENDOR_COLORS.length] }))} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider">Total</span>
                    <span className="text-sm font-bold text-[#030213]">{fmt(TOP_VENDORS.reduce((a, s) => a + s.spend, 0))}</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#A0A0B0] mt-2">Spend share by vendor</p>
              </div>
            </div>
          </Card>

          {/* Spend by category + concentration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Spend by Category" subtitle="Across labs and suppliers">
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-center">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Donut data={CATEGORY_SPEND.map(c => ({ label: c.label, value: c.amount, color: c.color }))} size={150} thickness={24} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider">Total</span>
                      <span className="text-sm font-bold text-[#030213]">{fmt(CATEGORY_SPEND.reduce((a, c) => a + c.amount, 0))}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {CATEGORY_SPEND.map((c) => {
                    const total = CATEGORY_SPEND.reduce((a, x) => a + x.amount, 0);
                    const pct = Math.round((c.amount / total) * 100);
                    return (
                      <div key={c.label} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                        <span className="text-xs text-[#717182] w-28 flex-shrink-0 truncate">{c.label}</span>
                        <div className="flex-1 h-4 bg-[#F3F3F5] rounded-lg overflow-hidden">
                          <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                        <span className="text-xs font-bold text-[#030213] w-14 text-right tabular-nums">{fmt(c.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card title="Spend Concentration" subtitle="Share of total spend per vendor">
              <div className="space-y-3">
                {TOP_VENDORS.map((s, i) => {
                  const totalSpend = TOP_VENDORS.reduce((acc, x) => acc + x.spend, 0);
                  const pct = Math.round((s.spend / totalSpend) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: VENDOR_COLORS[i % VENDOR_COLORS.length] }} />
                      <span className="text-xs text-[#717182] w-36 flex-shrink-0 truncate">{s.name}</span>
                      <div className="flex-1 h-5 bg-[#F3F3F5] rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${pct}%`, background: VENDOR_COLORS[i % VENDOR_COLORS.length] }} />
                      </div>
                      <span className="text-xs font-semibold text-[#030213] w-8 text-right tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ── CLINICAL TAB — moved off the dashboard ───────────────── */}
      {tab === 'clinical' && (
        <>
          {/* Lab performance — manager-requested KPIs */}
          <section>
            <SectionLabel info="Lab order performance — delays, turnaround, cost and order value across your labs.">Lab performance</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard alert            icon={<AlertTriangle className="w-5 h-5 text-[#D4183D]" />} label="Delayed Orders"       value={DELAYED_ORDERS}        sub={`${fmt(DELAYED_VALUE)} at risk · past delivery`} />
              <KpiCard accent="#4D8EF7" icon={<Clock className="w-5 h-5 text-[#4D8EF7]" />}         label="Avg Turnaround Time" value={`${AVG_TURNAROUND} days`} sub="order → delivery" />
              <KpiCard accent="#7C3AED" icon={<Building2 className="w-5 h-5 text-[#7C3AED]" />}     label="Avg Cost per Lab"    value={fmt(AVG_COST_PER_LAB)}  sub={`${fmt(TOTAL_LAB_SPEND)} ÷ ${LAB_COUNT} labs`} />
              <KpiCard accent="#1565C0" icon={<TrendingUp className="w-5 h-5 text-[#1565C0]" />}    label="Projected Cost (Year)" value={fmt(PROJECTED_YEAR)}  sub={`${fmt(TOTAL_LAB_SPEND)}/mo run-rate`} />
              <KpiCard accent="#2E7D32" icon={<FileText className="w-5 h-5 text-[#2E7D32]" />}      label="Orders per Lab"      value={ORDERS_PER_LAB}         sub={`${TOTAL_ORDERS} orders ÷ ${LAB_COUNT} labs`} />
              <KpiCard accent="#E65100" icon={<Wallet className="w-5 h-5 text-[#E65100]" />}        label="Avg Order Value"     value={fmt(AVG_ORDER_VALUE)}   sub={`${fmt(PAYMENT_PROCESSED)} paid ÷ ${TOTAL_ORDERS} orders`} />
            </div>
          </section>

          {/* Orders & turnaround per lab */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Orders by Lab" subtitle="Order volume per lab this period">
              <BarList rows={LAB_PERFORMANCE.map(l => ({ label: l.name, value: l.orders, color: l.color }))} max={ORDERS_MAX} formatValue={(v) => String(v)} />
            </Card>
            <Card title="Turnaround by Lab" subtitle="Avg days from order to delivery">
              <BarList rows={LAB_PERFORMANCE.map(l => ({ label: l.name, value: l.turnaround, color: l.color }))} max={TURNAROUND_MAX} formatValue={(v) => `${v} days`} />
            </Card>
          </div>

          {/* Trends & performance */}
          <section>
            <SectionLabel info="Six-month view of clinical throughput and delivery reliability.">Trends &amp; performance</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Clinical trend" subtitle="Cases submitted per month">
                <BarChart data={CLINICAL_TREND} max={Math.max(...CLINICAL_TREND) * 1.12} />
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
        </>
      )}
    </div>
  );
}

// ─── Shared building blocks ───────────────────────────────────────────────────

function Card({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#030213]">{title}</p>
          {subtitle && <p className="text-xs text-[#717182] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 mt-0.5">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, alert, accent = '#4D8EF7', onClick }: {
  icon: ReactNode; label: string; value: string | number;
  sub?: string; alert?: boolean; accent?: string; onClick?: () => void;
}) {
  const color = alert ? '#D4183D' : accent;
  const baseClasses = `bg-white rounded-lg border p-3 transition-all w-full text-left ${alert ? 'border-[#FECACA]' : 'border-[#E0E0E6]'} ${onClick ? 'cursor-pointer hover:shadow-md hover:border-current' : ''}`;
  const inner = (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-xs text-[#717182] mb-1 truncate">{label}</div>
        <div className={`text-xl font-semibold ${alert ? 'text-[#D4183D]' : 'text-[#030213]'}`}>{value}</div>
        {sub && <div className={`text-[10px] mt-0.5 ${alert ? 'text-[#D4183D]' : 'text-[#A0A0B0]'}`}>{sub}</div>}
      </div>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '1A' }}>
        {icon}
      </div>
    </div>
  );
  return onClick
    ? <button onClick={onClick} className={baseClasses} style={alert ? { color: '#D4183D' } : undefined}>{inner}</button>
    : <div className={baseClasses}>{inner}</div>;
}

// A simple labelled horizontal bar list (count or £).
function BarList({ rows, max, formatValue }: {
  rows: { label: string; value: number; color: string }[];
  max: number;
  formatValue: (v: number) => string;
}) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="text-xs text-[#5A5568] w-36 flex-shrink-0 truncate text-right">{r.label}</span>
          <div className="flex-1 h-5 bg-[#F3F3F5] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
          <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0 w-16 text-right">{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Compact "action needed" ranking — vendors with stuck invoices (count + £),
// each row a proportional tinted bar that deep-links to the filtered list.
function VendorActionList({ title, items, tone, onSelect }: {
  title: string;
  items: { name: string; count: number; value: number; filter: string }[];
  tone: 'red' | 'amber';
  onSelect: (filter: string) => void;
}) {
  const p = tone === 'red'
    ? { text: '#D4183D', soft: '#FFF1F2', track: '#FEE2E2', barFrom: '#F87171', barTo: '#FB7185' }
    : { text: '#C2410C', soft: '#FFF7ED', track: '#FFEDD5', barFrom: '#FB923C', barTo: '#F59E0B' };
  const max = Math.max(1, ...items.map(i => i.count));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-xs font-bold text-[#030213]">{title}</p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ background: p.soft, color: p.text }}>{fmt(total)}</span>
      </div>
      <div className="space-y-0.5">
        {items.map((s, i) => {
          const pct = Math.round((s.count / max) * 100);
          return (
            <button
              key={i}
              onClick={() => onSelect(s.filter)}
              className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: p.soft, color: p.text }}>
                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#030213] truncate group-hover:text-[#1565C0] transition-colors">{s.name}</span>
                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: p.text }}>{fmt(s.value)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: p.track }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.barFrom}, ${p.barTo})` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donut chart (SVG) ────────────────────────────────────────────────────────
function Donut({ data, size = 180, thickness = 28 }: {
  data: { label: string; value: number; color: string }[];
  size?: number; thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F3F5" strokeWidth={thickness} />
      {data.map(d => {
        const len = (d.value / total) * c;
        const seg = (
          <circle
            key={d.label}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
          />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}

// ─── Clinical-tab building blocks (moved off the dashboard) ───────────────────

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
