import { useState } from 'react';
import {
  Wallet, Clock, AlertTriangle, FolderKanban, TrendingUp,
  FileText, ArrowRight, Building2, CheckCircle2,
} from 'lucide-react';

// ─── Clinic Portal — Analytics ───────────────────────────────────────────────
// A practice-scoped analytics page. Deliberately NARROW: a clinic only cares
// about its own day-to-day money + lab work — what it's spending, what it owes,
// what's overdue, and where its cases are. None of the group-HQ / AP-automation
// surfaces (RAG scoring, payment-export folders, supplier-risk queues) belong
// here, so they're left out.

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

// ── Period (display-only for the prototype) ──────────────────────────────────
type Period = 'Month' | 'Quarter' | 'Year';

// ── Mock data — practice-scoped, self-contained ──────────────────────────────
const KPI = {
  spend: 12480,          // spend this period
  spendDelta: '+6.2%',
  outstanding: 8940,     // billed but not yet paid
  outstandingCount: 12,
  overdue: 2310,         // past due date, unpaid
  overdueCount: 3,
  casesInProgress: 9,
};

// Monthly spend by what a clinic actually buys.
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

// Where the clinic's lab spend goes.
const SPEND_BY_LAB = [
  { name: 'S4S London',          value: 4820, color: '#4D8EF7' },
  { name: 'Kingsbridge Dental',  value: 3110, color: '#A59DFF' },
  { name: 'Smile Ceramics',      value: 2240, color: '#34D399' },
  { name: 'Eurodontic Ltd',      value: 1460, color: '#FB923C' },
  { name: 'Apex Dental Lab',     value: 850,  color: '#F87171' },
];
const LAB_MAX = Math.max(...SPEND_BY_LAB.map(l => l.value));

// Clinic AP pipeline — the only invoice "stages" a practice deals with.
// `filter` is the token InvoicesPage understands, so each bar deep-links to
// the matching filtered list.
const INVOICE_STATUS = [
  { label: 'Awaiting your approval', count: 5,  color: '#FB923C', filter: 'awaiting_approval' },
  { label: 'Approved · to pay',      count: 7,  color: '#4D8EF7', filter: 'approved' },
  { label: 'Paid',                   count: 31, color: '#34D399', filter: 'payment_processed' },
  { label: 'Overdue',                count: 3,  color: '#F87171', filter: 'overdue' },
  { label: 'Disputed',               count: 2,  color: '#D4183D', filter: 'disputed' },
];
const STATUS_MAX = Math.max(...INVOICE_STATUS.map(s => s.count));

// Cases the clinic has sent to labs, by stage.
const CASES_BY_STAGE = [
  { label: 'Submitted',     count: 4,  color: '#A59DFF' },
  { label: 'In Production', count: 5,  color: '#4D8EF7' },
  { label: 'Quality Check', count: 2,  color: '#FB923C' },
  { label: 'Shipped',       count: 3,  color: '#34D399' },
  { label: 'Delivered',     count: 18, color: '#22C55E' },
];
const CASES_MAX = Math.max(...CASES_BY_STAGE.map(c => c.count));

// ── Small building blocks ────────────────────────────────────────────────────
function Card({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
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

function ClinicKpi({ icon, label, value, sub, accent, alert, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  accent: string; alert?: boolean; onClick?: () => void;
}) {
  const color = alert ? '#D4183D' : accent;
  const inner = (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-xs text-[#717182] mb-1">{label}</div>
        <div className={`text-xl font-semibold ${alert ? 'text-[#D4183D]' : 'text-[#030213]'}`}>{value}</div>
        <div className={`text-[10px] mt-0.5 ${alert ? 'text-[#D4183D]' : 'text-[#A0A0B0]'}`}>{sub}</div>
      </div>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: color + '1A' }}>
        {icon}
      </div>
    </div>
  );
  const base = `bg-white rounded-xl border p-4 w-full text-left transition-all ${alert ? 'border-[#FECACA]' : 'border-[#E0E0E6]'} ${onClick ? 'cursor-pointer hover:shadow-md hover:border-current' : ''}`;
  return onClick
    ? <button onClick={onClick} className={base} style={{ color }}>{inner}</button>
    : <div className={base}>{inner}</div>;
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
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: r.color }}
            />
          </div>
          {/* Value sits outside the bar, on white, so it's always legible */}
          <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0 w-16 text-right">{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ClinicAnalyticsPage({ onOpenInvoices, onOpenCases }: {
  onOpenInvoices?: (filter?: string) => void;
  onOpenCases?: () => void;
}) {
  const [period, setPeriod] = useState<Period>('Month');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl space-y-5">
      {/* Header + period */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213]">Analytics</h1>
          <p className="text-sm text-[#717182] mt-0.5">Your practice's spend, invoices and lab cases at a glance.</p>
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E0E0E6] rounded-lg">
          {(['Month', 'Quarter', 'Year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                period === p ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#717182] hover:text-[#030213]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs — the four numbers a practice checks daily */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ClinicKpi
          icon={<Wallet className="w-5 h-5 text-[#4D8EF7]" />}
          label="Spend" value={fmt(KPI.spend)} sub={`${KPI.spendDelta} vs last ${period.toLowerCase()}`}
          accent="#4D8EF7"
        />
        <ClinicKpi
          icon={<Clock className="w-5 h-5 text-[#7C3AED]" />}
          label="Outstanding to pay" value={fmt(KPI.outstanding)} sub={`${KPI.outstandingCount} invoices`}
          accent="#7C3AED" onClick={() => onOpenInvoices?.('unpaid')}
        />
        <ClinicKpi
          icon={<AlertTriangle className="w-5 h-5 text-[#E65100]" />}
          label="Overdue" value={fmt(KPI.overdue)} sub={`${KPI.overdueCount} invoices · pay now`}
          accent="#E65100" alert onClick={() => onOpenInvoices?.('overdue')}
        />
        <ClinicKpi
          icon={<FolderKanban className="w-5 h-5 text-[#2E7D32]" />}
          label="Cases in progress" value={String(KPI.casesInProgress)} sub="with the lab"
          accent="#2E7D32" onClick={onOpenCases}
        />
      </div>

      {/* Spend trend + spend by lab */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Monthly Spend" subtitle="What your practice buys, by category">
          <div className="flex items-end gap-3 h-44">
            {MONTHLY_SPEND.map((m) => {
              const total = m.lab + m.consumables + m.equipment;
              const totalH = (total / SPEND_MAX) * 150;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-[#A0A0B0] font-medium">{fmt(total)}</span>
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: `${totalH}px` }}>
                    {SPEND_CATEGORIES.map((cat, idx) => {
                      const v = (m as any)[cat.key] as number;
                      const h = (v / total) * totalH;
                      const isFirst = idx === 0;
                      const isLast = idx === SPEND_CATEGORIES.length - 1;
                      return (
                        <div
                          key={cat.key}
                          className="w-full max-w-[34px] mx-auto"
                          style={{
                            height: `${h}px`,
                            background: cat.color,
                            borderTopLeftRadius: isFirst ? 4 : 0,
                            borderTopRightRadius: isFirst ? 4 : 0,
                            borderBottomLeftRadius: isLast ? 4 : 0,
                            borderBottomRightRadius: isLast ? 4 : 0,
                          }}
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
      </div>

      {/* Invoice status + cases by stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card
          title="Invoices"
          subtitle="Where your bills stand right now"
          action={
            <button onClick={() => onOpenInvoices?.()} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="space-y-2.5">
            {INVOICE_STATUS.map((s) => (
              <button
                key={s.label}
                onClick={() => onOpenInvoices?.(s.filter)}
                className="w-full group flex items-center gap-3 hover:bg-[#FAFBFD] -mx-1 px-1 py-0.5 rounded-lg transition-colors"
              >
                <span className="text-xs text-[#5A5568] w-40 flex-shrink-0 text-right group-hover:text-[#1565C0] transition-colors">{s.label}</span>
                <div className="flex-1 h-5 bg-[#F3F3F5] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (s.count / STATUS_MAX) * 100)}%`, background: s.color }} />
                </div>
                {/* Count outside the bar for clean readability */}
                <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0 w-8 text-right">{s.count}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card
          title="Cases by Stage"
          subtitle="Lab cases you've sent"
          action={
            <button onClick={onOpenCases} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <BarList
            rows={CASES_BY_STAGE.map(c => ({ label: c.label, value: c.count, color: c.color }))}
            max={CASES_MAX}
            formatValue={(v) => String(v)}
          />
        </Card>
      </div>

      {/* Quick links footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => onOpenInvoices?.('unpaid')} className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3 hover:border-[#4D8EF7] hover:shadow-sm transition-all text-left">
          <span className="w-9 h-9 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-[#4D8EF7]" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#030213]">Pay invoices</p>
            <p className="text-[11px] text-[#717182]">{KPI.outstandingCount} outstanding</p>
          </div>
        </button>
        <button onClick={() => onOpenInvoices?.('overdue')} className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3 hover:border-[#E65100] hover:shadow-sm transition-all text-left">
          <span className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-[#E65100]" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#030213]">Clear overdue</p>
            <p className="text-[11px] text-[#717182]">{fmt(KPI.overdue)} past due</p>
          </div>
        </button>
        <button onClick={onOpenCases} className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3 hover:border-[#2E7D32] hover:shadow-sm transition-all text-left">
          <span className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0"><FolderKanban className="w-4 h-4 text-[#2E7D32]" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#030213]">Track cases</p>
            <p className="text-[11px] text-[#717182]">{KPI.casesInProgress} with the lab</p>
          </div>
        </button>
      </div>
    </div>
  );
}
// Silence unused-import churn if a future trim removes a usage.
void TrendingUp; void Building2; void CheckCircle2;
