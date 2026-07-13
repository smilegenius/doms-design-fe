import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  Wallet, Clock, AlertTriangle, FileText, ArrowRight, CheckCircle2,
  TrendingUp, TrendingDown, Building2, Users, BarChart3,
  ChevronRight, ChevronDown, Check, Info, X,
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';

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
// One per-lab table drives every lab card (orders / turnaround / spend /
// remakes) AND the KPI row — so a lab's numbers match everywhere and each
// ranking card can show a top-5 with a "See all" popup for the full list.
const LABS = [
  { name: 'S4S London',            orders: 42, turnaround: 5.2, spend: 4820, remakes: 9, color: '#4D8EF7' },
  { name: 'Kingsbridge Dental',    orders: 31, turnaround: 6.8, spend: 3110, remakes: 6, color: '#A59DFF' },
  { name: 'Smile Ceramics',        orders: 28, turnaround: 6.1, spend: 2240, remakes: 4, color: '#34D399' },
  { name: 'Eurodontic Ltd',        orders: 26, turnaround: 8.4, spend: 1460, remakes: 7, color: '#FB923C' },
  { name: 'Apex Dental Lab',       orders: 22, turnaround: 7.0, spend: 850,  remakes: 5, color: '#F87171' },
  { name: 'Northgate Dental Lab',  orders: 18, turnaround: 6.4, spend: 1180, remakes: 3, color: '#22C55E' },
  { name: 'Crown & Bridge Co',     orders: 15, turnaround: 7.6, spend: 920,  remakes: 3, color: '#93C5FD' },
  { name: 'Precision Prosthetics', orders: 12, turnaround: 5.9, spend: 760,  remakes: 2, color: '#C4B5FD' },
  { name: 'Aesthetic Labs',        orders: 9,  turnaround: 8.1, spend: 540,  remakes: 2, color: '#FDBA74' },
  { name: 'Meridian Dental',       orders: 6,  turnaround: 6.7, spend: 410,  remakes: 1, color: '#FCA5A5' },
];
const LAB_COUNT = LABS.length;                                        // 10
const TOTAL_ORDERS = LABS.reduce((s, l) => s + l.orders, 0);          // 209
const TOTAL_LAB_SPEND = LABS.reduce((s, l) => s + l.spend, 0);        // 16,290
const TOTAL_REMAKES = LABS.reduce((s, l) => s + l.remakes, 0);        // 42
const PAYMENT_PROCESSED = 21450;                                     // paid this period
const DELAYED_ORDERS = 7;
const DELAYED_VALUE = 1850;
const AVG_TURNAROUND = 6.5;                                          // days, order → delivery
const AVG_COST_PER_LAB = Math.round(TOTAL_LAB_SPEND / LAB_COUNT);     // 1,629
const ORDERS_PER_LAB = (TOTAL_ORDERS / LAB_COUNT).toFixed(1);        // 20.9
const AVG_ORDER_VALUE = Math.round(PAYMENT_PROCESSED / TOTAL_ORDERS); // 103
const PROJECTED_YEAR = TOTAL_LAB_SPEND * 12;                         // 195,480

// Remake case list — feeds the filterable "Remake cases" card (by doctor / lab).
const REMAKE_DOCTORS = ['Dr. Webb', 'Dr. Sharma', 'Dr. Reid', 'Dr. Cole', 'Dr. Bell'];
const REMAKE_CASE_LABS = ['S4S London', 'Eurodontic Ltd', 'Kingsbridge Dental', 'Apex Dental Lab', 'Smile Ceramics'];
const REMAKE_CASES: { id: string; doctor: string; lab: string; reason: string; value: number }[] = [
  { id: 'RMK-1001', doctor: 'Dr. Webb',   lab: 'S4S London',         reason: 'Shade mismatch', value: 180 },
  { id: 'RMK-1002', doctor: 'Dr. Webb',   lab: 'Eurodontic Ltd',     reason: 'Poor fit',       value: 220 },
  { id: 'RMK-1003', doctor: 'Dr. Sharma', lab: 'S4S London',         reason: 'Fracture',       value: 260 },
  { id: 'RMK-1004', doctor: 'Dr. Reid',   lab: 'Kingsbridge Dental', reason: 'Contact point',  value: 150 },
  { id: 'RMK-1005', doctor: 'Dr. Cole',   lab: 'Apex Dental Lab',    reason: 'Poor fit',       value: 190 },
  { id: 'RMK-1006', doctor: 'Dr. Bell',   lab: 'Smile Ceramics',     reason: 'Margin issue',   value: 210 },
  { id: 'RMK-1007', doctor: 'Dr. Webb',   lab: 'S4S London',         reason: 'Poor fit',       value: 175 },
  { id: 'RMK-1008', doctor: 'Dr. Sharma', lab: 'Eurodontic Ltd',     reason: 'Shade mismatch', value: 200 },
  { id: 'RMK-1009', doctor: 'Dr. Reid',   lab: 'Apex Dental Lab',    reason: 'Fracture',       value: 240 },
  { id: 'RMK-1010', doctor: 'Dr. Cole',   lab: 'Kingsbridge Dental', reason: 'Margin issue',   value: 165 },
  { id: 'RMK-1011', doctor: 'Dr. Bell',   lab: 'S4S London',         reason: 'Contact point',  value: 185 },
  { id: 'RMK-1012', doctor: 'Dr. Webb',   lab: 'Eurodontic Ltd',     reason: 'Fracture',       value: 255 },
  { id: 'RMK-1013', doctor: 'Dr. Sharma', lab: 'Kingsbridge Dental', reason: 'Poor fit',       value: 160 },
  { id: 'RMK-1014', doctor: 'Dr. Reid',   lab: 'Smile Ceramics',     reason: 'Shade mismatch', value: 205 },
  { id: 'RMK-1015', doctor: 'Dr. Cole',   lab: 'S4S London',         reason: 'Margin issue',   value: 195 },
  { id: 'RMK-1016', doctor: 'Dr. Bell',   lab: 'Apex Dental Lab',    reason: 'Poor fit',       value: 180 },
  { id: 'RMK-1017', doctor: 'Dr. Webb',   lab: 'Kingsbridge Dental', reason: 'Shade mismatch', value: 170 },
  { id: 'RMK-1018', doctor: 'Dr. Sharma', lab: 'Apex Dental Lab',    reason: 'Contact point',  value: 230 },
  { id: 'RMK-1019', doctor: 'Dr. Reid',   lab: 'Eurodontic Ltd',     reason: 'Margin issue',   value: 215 },
  { id: 'RMK-1020', doctor: 'Dr. Cole',   lab: 'Smile Ceramics',     reason: 'Fracture',       value: 245 },
  { id: 'RMK-1021', doctor: 'Dr. Bell',   lab: 'Kingsbridge Dental', reason: 'Shade mismatch', value: 155 },
  { id: 'RMK-1022', doctor: 'Dr. Webb',   lab: 'Smile Ceramics',     reason: 'Poor fit',       value: 200 },
];

// ── Service-category analytics — orders / remakes / delays per category ───────
// One deterministic (index-seeded, not random) case-level table drives all
// three category cards, so filtering by doctor + lab stays consistent.
const SVC_CATEGORIES = [
  { name: 'Crowns & Bridges', color: '#4D8EF7' },
  { name: 'Implants',         color: '#34D399' },
  { name: 'Veneers',          color: '#EC4899' },
  { name: 'Orthodontics',     color: '#FB923C' },
  { name: 'Dentures',         color: '#A59DFF' },
  { name: 'Night Guards',     color: '#F87171' },
];
const SVC_DOCTORS = REMAKE_DOCTORS;
const SVC_LABS = REMAKE_CASE_LABS;
type ServiceCase = { category: string; doctor: string; lab: string; remake: boolean; delayed: boolean };
const SERVICE_CASES: ServiceCase[] = (() => {
  const counts   = [40, 28, 22, 16, 15, 7];   // 128 orders total
  const remakeN  = [3, 2, 1, 1, 1, 1];         // 9 remakes total
  const delayedN = [0, 3, 0, 1, 2, 1];         // 7 delayed total (4 categories)
  const out: ServiceCase[] = [];
  let g = 0;
  SVC_CATEGORIES.forEach((cat, ci) => {
    for (let i = 0; i < counts[ci]; i++) {
      out.push({
        category: cat.name,
        doctor: SVC_DOCTORS[g % SVC_DOCTORS.length],
        lab: SVC_LABS[(g + ci) % SVC_LABS.length],
        remake: i < remakeN[ci],
        delayed: i >= counts[ci] - delayedN[ci],
      });
      g++;
    }
  });
  return out;
})();

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

          {/* Orders / turnaround / remakes per lab — one row, top 5 + "See all" */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <LabRankCard
              title="Orders by Lab" subtitle={`Top 5 of ${LAB_COUNT} labs`}
              rows={LABS.map(l => ({ label: l.name, value: l.orders, color: l.color }))} formatValue={(v) => String(v)}
            />
            <LabRankCard
              title="Turnaround by Lab" subtitle={`Slowest 5 of ${LAB_COUNT} · days`}
              rows={LABS.map(l => ({ label: l.name, value: l.turnaround, color: l.color }))} formatValue={(v) => `${v} days`}
            />
            <LabRankCard
              title="Remakes by Lab" subtitle={`Top 5 of ${LAB_COUNT} · ${TOTAL_REMAKES} total`}
              rows={LABS.map(l => ({ label: l.name, value: l.remakes, color: l.color }))} formatValue={(v) => String(v)}
            />
          </div>

          {/* Service-category breakdowns — orders / remakes / delays, one row */}
          <ServiceCategorySection />

          {/* Remake cases — filterable case list */}
          <RemakeCasesCard doctors={REMAKE_DOCTORS} labs={REMAKE_CASE_LABS} cases={REMAKE_CASES} />

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

// ─── See-all button + modal (shared by the lab ranking cards) ───────────────
function SeeAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
      See all <ChevronRight className="w-3 h-3" />
    </button>
  );
}

function SeeAllModal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
            <div>
              <p className="text-sm font-semibold text-[#030213]">{title}</p>
              {subtitle && <p className="text-xs text-[#717182] mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 overflow-y-auto">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Lab ranking card — top 5 bar list + "See all" popup with every lab ─────
// Compact ranked bars — label + value on top, full-width thin bar below.
// Reads far better than side-by-side horizontal bars in narrow (⅓-width) cards.
function MiniBars({ rows, max, formatValue }: {
  rows: { label: string; value: number; color: string }[];
  max: number;
  formatValue: (v: number) => string;
}) {
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-[#5A5568] truncate">{r.label}</span>
            <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0">{formatValue(r.value)}</span>
          </div>
          <div className="h-2 bg-[#F3F3F5] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LabRankCard({ title, subtitle, rows, formatValue }: {
  title: string; subtitle?: string;
  rows: { label: string; value: number; color: string }[];
  formatValue: (v: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map(r => r.value));
  return (
    <Card title={title} subtitle={subtitle} action={sorted.length > 5 ? <SeeAllButton onClick={() => setOpen(true)} /> : undefined}>
      <MiniBars rows={sorted.slice(0, 5)} max={max} formatValue={formatValue} />
      {open && (
        <SeeAllModal title={title} subtitle={`All ${sorted.length} labs · this period`} onClose={() => setOpen(false)}>
          <MiniBars rows={sorted} max={max} formatValue={formatValue} />
        </SeeAllModal>
      )}
    </Card>
  );
}

// ─── Multi-select dropdown — all options selected by default ────────────────
function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const allOn = selected.length === options.length;
  const summary = allOn ? 'All' : selected.length === 0 ? 'None' : `${selected.length} selected`;
  const toggle = (o: string) => onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left border rounded-lg bg-white transition-colors ${open ? 'border-[#4D8EF7]' : 'border-[#E0E0E6] hover:border-[#BFDBFE]'}`}
      >
        <span className="truncate"><span className="text-[#A0A0B0]">{label}: </span><span className="font-semibold text-[#030213]">{summary}</span></span>
        <ChevronDown className={`w-3 h-3 text-[#A0A0B0] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 left-0 right-0 bg-white border border-[#E8EAF6] rounded-lg shadow-[0_10px_30px_rgba(77,142,247,0.15)] overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {/* "All" — always the top option; toggles the whole group */}
            <button
              onClick={() => onChange(allOn ? [] : [...options])}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#FAFBFF] transition-colors border-b border-[#F0EFF6]"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${allOn ? 'bg-[#4D8EF7] border-[#4D8EF7]' : selected.length > 0 ? 'bg-[#EEF4FF] border-[#4D8EF7]' : 'border-[#C8C8D0] bg-white'}`}>
                {allOn ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} /> : selected.length > 0 ? <span className="w-1.5 h-[2px] bg-[#4D8EF7] rounded-full" /> : null}
              </span>
              <span className="text-xs font-semibold text-[#030213]">All</span>
            </button>
            {options.map(o => {
              const on = selected.includes(o);
              return (
                <button key={o} onClick={() => toggle(o)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#FAFBFF] transition-colors">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#C8C8D0] bg-white'}`}>
                    {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`text-xs truncate ${on ? 'font-semibold text-[#030213]' : 'text-[#5A5568]'}`}>{o}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// A single remake-case row (shared by the card preview and the See-all popup).
function RemakeRow({ c }: { c: { id: string; doctor: string; lab: string; reason: string } }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] flex-shrink-0" />
      <span className="font-semibold text-[#030213] flex-shrink-0 tabular-nums">{c.id}</span>
      <span className="text-[#717182] truncate flex-1 min-w-0">{c.doctor} · {c.lab}</span>
      <span className="text-[10px] text-[#A0A0B0] flex-shrink-0">{c.reason}</span>
    </div>
  );
}

// ─── Remake cases — dropdown filters (doctor / lab) + compact preview ───────
function RemakeCasesCard({ doctors, labs, cases }: {
  doctors: string[]; labs: string[];
  cases: { id: string; doctor: string; lab: string; reason: string; value: number }[];
}) {
  const [selDoc, setSelDoc] = useState<string[]>(doctors);   // all selected by default
  const [selLab, setSelLab] = useState<string[]>(labs);      // all selected by default
  const [open, setOpen] = useState(false);
  const filtered = cases.filter(c => selDoc.includes(c.doctor) && selLab.includes(c.lab));
  const value = filtered.reduce((s, c) => s + c.value, 0);
  const PREVIEW = 4;
  const preview = filtered.slice(0, PREVIEW);

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl">
      <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-[#030213]">Remake cases</p>
          <p className="text-xs text-[#717182] mt-0.5">Filter by doctor and lab</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 w-[280px]">
            <MultiSelect label="Doctor" options={doctors} selected={selDoc} onChange={setSelDoc} />
            <MultiSelect label="Lab" options={labs} selected={selLab} onChange={setSelLab} />
          </div>
          {filtered.length > PREVIEW && <SeeAllButton onClick={() => setOpen(true)} />}
        </div>
      </div>
      <div className="p-5">
        {/* Filtered headline */}
        <p className="text-2xl font-bold text-[#030213] leading-none">
          {filtered.length}
          <span className="text-[11px] font-normal text-[#717182] ml-2">remake case{filtered.length === 1 ? '' : 's'} · {fmt(value)}</span>
        </p>

        {/* Compact preview */}
        <div className="mt-3 border-t border-[#F0EFF6] pt-3 space-y-1.5">
          {filtered.length === 0
            ? <p className="text-xs text-[#A0A0B0] italic text-center py-3">No remakes match the selected filters.</p>
            : preview.map(c => <RemakeRow key={c.id} c={c} />)}
          {filtered.length > PREVIEW && (
            <button onClick={() => setOpen(true)} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] pt-1">
              +{filtered.length - PREVIEW} more
            </button>
          )}
        </div>
      </div>

      {open && (
        <SeeAllModal title="Remake cases" subtitle={`${filtered.length} matching · ${fmt(value)}`} onClose={() => setOpen(false)}>
          <div className="space-y-1.5">{filtered.map(c => <RemakeRow key={c.id} c={c} />)}</div>
        </SeeAllModal>
      )}
    </div>
  );
}

// ─── Service-category breakdowns — three compact cards in one row, sharing a
// single Doctor + Lab filter. Minimal: label-over-thin-bar, no per-card chrome.
function ServiceCategorySection() {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-0.5 h-3 rounded-full bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
        <h2 className="text-xs font-semibold text-[#030213] uppercase tracking-wide">By service category</h2>
        <InfoTip text="Order volume, remakes and delays split by service category — filter each by doctor and lab." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniCategoryCard title="Orders" noun="orders" />
        <MiniCategoryCard title="Remakes" noun="remakes" predicate={c => c.remake} />
        <MiniCategoryCard title="Delayed" noun="delayed" predicate={c => c.delayed} />
      </div>
    </section>
  );
}

function MiniCategoryCard({ title, noun, predicate }: {
  title: string; noun: string; predicate?: (c: ServiceCase) => boolean;
}) {
  const [selDoc, setSelDoc] = useState<string[]>(SVC_DOCTORS);   // all selected by default
  const [selLab, setSelLab] = useState<string[]>(SVC_LABS);      // all selected by default
  const matched = SERVICE_CASES.filter(c =>
    selDoc.includes(c.doctor) && selLab.includes(c.lab) && (!predicate || predicate(c))
  );
  const rows = SVC_CATEGORIES
    .map(cat => ({ label: cat.name, value: matched.filter(c => c.category === cat.name).length, color: cat.color }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = matched.length;
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-sm font-semibold text-[#030213]">{title}</p>
        <p className="text-[11px] text-[#717182]">{rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</p>
      </div>
      {/* Per-card doctor + lab filters */}
      <div className="flex items-center gap-2 mb-4">
        <MultiSelect label="Doctor" options={SVC_DOCTORS} selected={selDoc} onChange={setSelDoc} />
        <MultiSelect label="Lab" options={SVC_LABS} selected={selLab} onChange={setSelLab} />
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[#A0A0B0] italic text-center py-8">None match.</p>
      ) : (
        <div className="flex flex-col items-center">
          {/* Donut — distinct from the bar-ranking cards above */}
          <div className="relative">
            <Donut data={rows} size={124} thickness={18} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-[#030213] leading-none tabular-nums">{total}</span>
              <span className="text-[10px] text-[#717182] mt-0.5">{noun}</span>
            </div>
          </div>
          {/* Legend */}
          <div className="mt-4 w-full space-y-1.5">
            {rows.map(r => (
              <div key={r.label} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: r.color }} />
                <span className="text-[#5A5568] truncate flex-1 min-w-0">{r.label}</span>
                <span className="font-bold text-[#030213] tabular-nums flex-shrink-0">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
