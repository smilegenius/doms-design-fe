import {
  Sparkles, ArrowRight, FolderKanban, Plus, Wallet, AlertTriangle, Clock,
  CheckCircle2, FileText, BarChart3, Upload, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INVOICES } from './InvoicesPage';

// ─── Clinic Portal — Overview ────────────────────────────────────────────────
// A practice's home dashboard: the few numbers and to-dos a clinic checks each
// morning — what they owe, what's overdue, what needs approving, and where
// their lab cases are. Invoice figures derive from the shared INVOICES mock so
// the lists show real rows; case figures are a small practice-scoped mock.

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

const DEMO_TODAY = new Date('2026-06-16');

// Statuses that mean "the clinic still owes money on this".
const UNPAID = new Set(['awaiting_approval', 'qc_review', 'disputed', 'approved', 'exported_for_payment']);

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  qc_review:            { label: 'Needs review',  cls: 'bg-[#FFF7ED] text-[#C2410C]' },
  awaiting_approval:    { label: 'To approve',    cls: 'bg-[#FFF7ED] text-[#C2410C]' },
  disputed:             { label: 'Disputed',      cls: 'bg-[#FFEBEE] text-[#C62828]' },
  rejected:             { label: 'Rejected',      cls: 'bg-[#FFEBEE] text-[#C62828]' },
  approved:             { label: 'To pay',        cls: 'bg-[#EEF4FF] text-[#1565C0]' },
  exported_for_payment: { label: 'Scheduled',     cls: 'bg-[#EEF4FF] text-[#1565C0]' },
  payment_processed:    { label: 'Paid',          cls: 'bg-[#F0FDF4] text-[#15803D]' },
  archived:             { label: 'Archived',      cls: 'bg-[#F3F3F5] text-[#5A5568]' },
};

// Practice-scoped case snapshot (mock — mirrors the Analytics page).
const CASE_STATS = { inProgress: 9, awaitingDelivery: 2, delivered: 18 };

export default function ClinicOverviewPage({ onOpenCases, onCreateCase, onOpenInvoices, onOpenAnalytics }: {
  onOpenCases: () => void;
  onCreateCase: () => void;
  onOpenInvoices?: (filter?: string) => void;
  onOpenAnalytics?: () => void;
}) {
  const { user } = useAuth();
  const displayName = (user?.email || 'there').split('@')[0];

  // ── Derive the practice's invoice numbers from the shared mock ──
  const unpaid = INVOICES.filter(i => UNPAID.has(i.status));
  const toPay = unpaid.reduce((s, i) => s + i.amount, 0);
  const overdueInv = unpaid.filter(i => new Date(i.dueDate) < DEMO_TODAY);
  const overdue = overdueInv.reduce((s, i) => s + i.amount, 0);
  const awaiting = INVOICES.filter(i => i.status === 'awaiting_approval' || i.status === 'qc_review');
  const paidThisMonth = INVOICES.filter(i => i.status === 'payment_processed').reduce((s, i) => s + i.amount, 0);
  const recent = [...INVOICES]
    .sort((a, b) => new Date(b.receivedAt || b.date).getTime() - new Date(a.receivedAt || a.date).getTime())
    .slice(0, 5);

  const actions = [
    awaiting.length > 0 && {
      icon: <Clock className="w-4 h-4 text-[#C2410C]" />,
      bg: 'bg-[#FFF7ED]',
      text: `${awaiting.length} invoice${awaiting.length === 1 ? '' : 's'} awaiting your approval`,
      cta: 'Review',
      onClick: () => onOpenInvoices?.('awaiting_approval'),
    },
    overdueInv.length > 0 && {
      icon: <AlertTriangle className="w-4 h-4 text-[#D4183D]" />,
      bg: 'bg-[#FFEBEE]',
      text: `${overdueInv.length} payment${overdueInv.length === 1 ? '' : 's'} overdue — ${fmt(overdue)}`,
      cta: 'Pay now',
      onClick: () => onOpenInvoices?.('overdue'),
    },
    CASE_STATS.awaitingDelivery > 0 && {
      icon: <FolderKanban className="w-4 h-4 text-[#7C3AED]" />,
      bg: 'bg-[#F5F3FF]',
      text: `${CASE_STATS.awaitingDelivery} case${CASE_STATS.awaitingDelivery === 1 ? '' : 's'} need a requested delivery date`,
      cta: 'Open',
      onClick: onOpenCases,
    },
  ].filter(Boolean) as { icon: React.ReactNode; bg: string; text: string; cta: string; onClick?: () => void }[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl space-y-5">
      {/* Hero — welcome + create */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E0E0E6] p-6 sm:p-7">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: 'radial-gradient(circle at top right, #EEF4FF, transparent 65%), radial-gradient(circle at bottom left, #F5F3FF, transparent 70%)' }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white border border-[#E0E0E6] text-[#5A5568] mb-3">
              <Sparkles className="w-3 h-3 text-[#A59DFF]" />
              Clinic Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] capitalize">Welcome back, {displayName}</h1>
            <p className="text-sm text-[#717182] mt-1.5 leading-relaxed max-w-xl">
              Here's your practice today — what's due, what needs approving, and how your lab cases are moving.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
            <button
              onClick={onCreateCase}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Case
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
      </div>

      {/* Daily numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<FolderKanban className="w-5 h-5 text-[#2E7D32]" />} accent="#2E7D32" label="Cases in progress" value={String(CASE_STATS.inProgress)} sub="with the lab" onClick={onOpenCases} />
        <StatCard icon={<Wallet className="w-5 h-5 text-[#7C3AED]" />} accent="#7C3AED" label="To pay" value={fmt(toPay)} sub={`${unpaid.length} invoices`} onClick={() => onOpenInvoices?.('unpaid')} />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-[#E65100]" />} accent="#E65100" alert label="Overdue" value={fmt(overdue)} sub={`${overdueInv.length} invoices`} onClick={() => onOpenInvoices?.('overdue')} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-[#1565C0]" />} accent="#1565C0" label="Paid this month" value={fmt(paidThisMonth)} sub="settled" onClick={() => onOpenInvoices?.('payment_processed')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Needs attention */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFF6]">
            <p className="text-sm font-semibold text-[#030213]">Needs your attention</p>
            <p className="text-xs text-[#717182] mt-0.5">Today's to-dos for the practice</p>
          </div>
          <div className="p-3">
            {actions.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-6 justify-center text-center">
                <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                <span className="text-sm text-[#15803D] font-medium">All caught up — nothing needs action.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {actions.map((a, i) => (
                  <button key={i} onClick={a.onClick} className="w-full group flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left">
                    <span className={`w-9 h-9 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}>{a.icon}</span>
                    <span className="flex-1 min-w-0 text-sm text-[#030213]">{a.text}</span>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#4D8EF7] flex-shrink-0">
                      {a.cta} <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent invoices */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center justify-between">
            <p className="text-sm font-semibold text-[#030213]">Recent invoices</p>
            <button onClick={() => onOpenInvoices?.()} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-2">
            {recent.map((inv) => {
              const pill = STATUS_PILL[inv.status] ?? { label: inv.status, cls: 'bg-[#F3F3F5] text-[#5A5568]' };
              return (
                <button key={inv.id} onClick={() => onOpenInvoices?.()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left">
                  <span className="w-8 h-8 rounded-lg bg-[#F8F9FC] border border-[#E8E8EC] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-[#717182]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#030213] truncate">{inv.supplier}</p>
                    <p className="text-[10px] text-[#A0A0B0] truncate">{inv.number}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${pill.cls}`}>{pill.label}</span>
                  <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0 w-16 text-right">{fmt(inv.amount)}</span>
                </button>
              );
            })}
          </div>
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

function StatCard({ icon, accent, label, value, sub, alert, onClick }: {
  icon: React.ReactNode; accent: string; label: string; value: string; sub: string; alert?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 text-left transition-all ${alert ? 'border-[#FECACA]' : 'border-[#E0E0E6]'} ${onClick ? 'hover:shadow-md' : ''}`}
      style={onClick ? { } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs text-[#717182] mb-1">{label}</div>
          <div className={`text-xl font-semibold ${alert ? 'text-[#D4183D]' : 'text-[#030213]'}`}>{value}</div>
          <div className={`text-[10px] mt-0.5 ${alert ? 'text-[#D4183D]' : 'text-[#A0A0B0]'}`}>{sub}</div>
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: (alert ? '#D4183D' : accent) + '1A' }}>
          {icon}
        </div>
      </div>
    </button>
  );
}

function QuickAction({ icon, bg, title, sub, onClick }: {
  icon: React.ReactNode; bg: string; title: string; sub: string; onClick?: () => void;
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
