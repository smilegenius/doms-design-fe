import { useState } from 'react';
import ModalPortal from '../components/ModalPortal';
import {
  FileText,
  CheckCircle2,
  Wallet,
  Receipt,
  Building2,
  Users,
  Package,
  ArrowRight,
  Activity,
  Send,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  X,
  Search,
  Calendar,
  Info,
  XCircle,
} from 'lucide-react';
import { INVOICES } from './InvoicesPage';
import { mockSuppliers } from '../data/suppliersData';

type InvoiceStatus = 'awaiting_approval' | 'disputed' | 'approved' | 'exported_for_payment' | 'payment_processed' | 'archived';
type PlanFilter = InvoiceStatus | 'low_confidence';

// ─── Data ─────────────────────────────────────────────────────────────────────

interface KpiCardData {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  accent: string;
  delta?: string;
  filter?: PlanFilter;
}

// ─── Period filter ────────────────────────────────────────────────────────────
// Driver for period-scoped metrics. Lifetime metrics (Flagged, Suppliers, etc.)
// ignore this. The selector lives in the hero header.
type Period = 'month' | 'quarter' | 'ytd' | '12m' | 'lifetime';
const PERIODS: { id: Period; label: string; chip: string }[] = [
  { id: 'month',    label: 'Month',     chip: 'this month' },
  { id: 'quarter',  label: 'Quarter',   chip: 'this quarter' },
  { id: 'ytd',      label: 'YTD',       chip: 'year to date' },
  { id: '12m',      label: '12 Months', chip: 'last 12 months' },
  { id: 'lifetime', label: 'Lifetime',  chip: 'all time' },
];

// Period-scoped totals (mock — in production these would be query-derived)
const SPEND_BY_PERIOD: Record<Period, { spend: number; spendPrev: number; invoiced: number; invCount: number; pending: number; approved: number; delta: string }> = {
  month:    { spend: 148920,  spendPrev: 137500,  invoiced: 162340,  invCount: 124,  pending: 28,  approved: 87,   delta: '+8.4%' },
  quarter:  { spend: 432180,  spendPrev: 415000,  invoiced: 478220,  invCount: 361,  pending: 41,  approved: 251,  delta: '+4.1%' },
  ytd:      { spend: 712400,  spendPrev: 668000,  invoiced: 781050,  invCount: 612,  pending: 56,  approved: 432,  delta: '+6.7%' },
  '12m':    { spend: 1612340, spendPrev: 1486120, invoiced: 1762400, invCount: 1452, pending: 56,  approved: 1041, delta: '+8.5%' },
  lifetime: { spend: 4382100, spendPrev: 0,       invoiced: 4612300, invCount: 3892, pending: 56,  approved: 2891, delta: '' },
};

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 10_000)    return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n.toLocaleString('en-GB')}`;
}

// Lifetime snapshot — Flagged & Awaiting are always "right now"; Suppliers,
// Practices and Staff are lifetime totals. The +N delta on Network cards is
// scope-aware (we surface it in the chip).
const networkDeltasByPeriod: Record<Period, { suppliers: string; practices: string; staff: string }> = {
  month:    { suppliers: '+2',  practices: '+3',  staff: '+8'  },
  quarter:  { suppliers: '+5',  practices: '+7',  staff: '+18' },
  ytd:      { suppliers: '+11', practices: '+12', staff: '+34' },
  '12m':    { suppliers: '+14', practices: '+15', staff: '+42' },
  lifetime: { suppliers: '47',  practices: '32',  staff: '184' },
};

const monthlySpend = [
  { month: 'Jun', value: 96 },  { month: 'Jul', value: 108 }, { month: 'Aug', value: 112 },
  { month: 'Sep', value: 124 }, { month: 'Oct', value: 134 }, { month: 'Nov', value: 128 },
  { month: 'Dec', value: 156 }, { month: 'Jan', value: 142 }, { month: 'Feb', value: 138 },
  { month: 'Mar', value: 131 }, { month: 'Apr', value: 137 }, { month: 'May', value: 149 },
];

const spendByClinic = [
  // Shared dashboard palette — green leads. Order: Green · Blue · Purple · Orange · Red · Light Green.
  { name: 'Belfast',          value: 32400, color: '#34D399' },  // green-400
  { name: 'Manchester',       value: 27800, color: '#4D8EF7' },  // brand blue
  { name: 'London Central',   value: 24100, color: '#A59DFF' },  // brand purple
  { name: 'Birmingham 1',     value: 19600, color: '#FB923C' },  // orange-400
  { name: 'Leeds',            value: 16800, color: '#F87171' },  // red-400
  { name: 'Others (5)',       value: 28220, color: '#6EE7B7' },  // emerald-300 (light green)
];

type ActivityTarget =
  | { kind: 'invoice'; id?: string }
  | { kind: 'case';    id?: string }
  | { kind: 'supplier' }
  | { kind: 'practice' }
  | { kind: 'staff' }
  | { kind: 'extraction' }
  | { kind: 'none' };

const activityFeed: { icon: React.ElementType; color: string; bg: string; text: string; meta: string; time: string; daysAgo: number; target: ActivityTarget }[] = [
  { icon: Send,          color: 'text-[#4D8EF7]', bg: 'bg-[#EEF4FF]', text: 'Invite sent to Dr. Anderson',         meta: 'Glasgow',                time: '5m',  daysAgo: 0,  target: { kind: 'staff' } },
  { icon: CheckCircle2,  color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'CSE-2399 marked Shipped',             meta: 'Sophie Wilson',          time: '12m', daysAgo: 0,  target: { kind: 'case', id: 'CSE-2399' } },
  { icon: FileText,      color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]', text: 'Invoice #INV-1042 received',          meta: '£1,240.00',              time: '1h',  daysAgo: 0,  target: { kind: 'invoice' } },
  { icon: AlertTriangle, color: 'text-[#E65100]', bg: 'bg-[#FFF7ED]', text: 'CSE-2386 flagged for refinement',     meta: 'Dr. Murphy',             time: '3h',  daysAgo: 0,  target: { kind: 'case', id: 'CSE-2386' } },
  { icon: Receipt,       color: 'text-[#BE123C]', bg: 'bg-[#FFF1F2]', text: 'Invoice #INV-1038 flagged',           meta: 'Amount mismatch',        time: '4h',  daysAgo: 0,  target: { kind: 'invoice' } },
  { icon: Users,         color: 'text-[#1565C0]', bg: 'bg-[#EEF4FF]', text: 'Practice Manager added',              meta: 'Daniel Jones · Belfast', time: '5h',  daysAgo: 0,  target: { kind: 'staff' } },
  { icon: CheckCircle2,  color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'CSE-2412 marked Delivered',           meta: 'Manchester',             time: '6h',  daysAgo: 0,  target: { kind: 'case', id: 'CSE-2412' } },
  { icon: Package,       color: 'text-[#E65100]', bg: 'bg-[#FFF7ED]', text: 'New supplier requested approval',     meta: 'Eurodontic Ltd',         time: '8h',  daysAgo: 0,  target: { kind: 'supplier' } },
  { icon: Building2,     color: 'text-[#DB2777]', bg: 'bg-[#FDF2F8]', text: 'New practice onboarded',              meta: 'Smile Genius York',      time: '1d',  daysAgo: 1,  target: { kind: 'practice' } },
  { icon: CheckCircle2,  color: 'text-[#1565C0]', bg: 'bg-[#EEF4FF]', text: 'Invoice #INV-1029 approved',          meta: '£3,420.00 · NHS',        time: '1d',  daysAgo: 1,  target: { kind: 'invoice' } },
  { icon: FileText,      color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]', text: 'Bulk import — 12 practices added',    meta: 'CSV upload',             time: '1d',  daysAgo: 1,  target: { kind: 'practice' } },
  { icon: AlertTriangle, color: 'text-[#E65100]', bg: 'bg-[#FFF7ED]', text: 'Low AI confidence on INV-1021',        meta: '42% confidence',         time: '2d',  daysAgo: 2,  target: { kind: 'invoice' } },
  { icon: Send,          color: 'text-[#4D8EF7]', bg: 'bg-[#EEF4FF]', text: 'Reminder sent to 8 dentists',         meta: 'Pending invites',        time: '2d',  daysAgo: 2,  target: { kind: 'staff' } },
  { icon: CheckCircle2,  color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'CSE-2370 marked Complete',            meta: 'Dr. Davies',             time: '2d',  daysAgo: 2,  target: { kind: 'case', id: 'CSE-2370' } },
  { icon: Receipt,       color: 'text-[#BE123C]', bg: 'bg-[#FFF1F2]', text: 'Duplicate invoice detected',          meta: 'INV-20250502-001',       time: '3d',  daysAgo: 3,  target: { kind: 'invoice' } },
  { icon: Wallet,        color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Payment processed — £4,820.00',       meta: 'Henry Schein Dental',    time: '3d',  daysAgo: 3,  target: { kind: 'invoice' } },
  { icon: Users,         color: 'text-[#DB2777]', bg: 'bg-[#FDF2F8]', text: 'Dr. Emma Thompson activated',         meta: 'London Central',         time: '3d',  daysAgo: 3,  target: { kind: 'staff' } },
  { icon: Send,          color: 'text-[#4D8EF7]', bg: 'bg-[#EEF4FF]', text: 'Bulk invite — 24 practices',          meta: 'Operations team',        time: '5d',  daysAgo: 5,  target: { kind: 'practice' } },
  { icon: Building2,     color: 'text-[#DB2777]', bg: 'bg-[#FDF2F8]', text: 'Practice archived',                   meta: 'Smile Genius Leeds 4',   time: '7d',  daysAgo: 7,  target: { kind: 'practice' } },
  { icon: Wallet,        color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Monthly extraction file generated',   meta: 'April payroll · 312 inv', time: '14d', daysAgo: 14, target: { kind: 'extraction' } },
  { icon: FileText,      color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]', text: 'GL mapping updated — Dentsply Sirona', meta: 'Equipment → 5400',       time: '21d', daysAgo: 21, target: { kind: 'supplier' } },
];

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data, size = 120, stroke = 16 }: { data: { name: string; value: number; color: string }[]; size?: number; stroke?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F3F5" strokeWidth={stroke} />
      {data.map((d, i) => {
        const length = (d.value / total) * c;
        const seg = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={stroke}
            strokeDasharray={`${length} ${c - length}`} strokeDashoffset={-offset} />
        );
        offset += length;
        return seg;
      })}
    </svg>
  );
}

function SectionLabel({ children, info }: { children: React.ReactNode; info?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <div className="w-0.5 h-3 rounded-full bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
      <h2 className="text-xs font-semibold text-[#030213] uppercase tracking-wide">{children}</h2>
      {info && <InfoTip text={info} />}
    </div>
  );
}

// Reusable info icon with hover tooltip
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

// ─── Page ─────────────────────────────────────────────────────────────────────

interface OverviewPageProps {
  onNavigateToInvoices?: (filter: PlanFilter) => void;
  onNavigateToSuppliers?: (statusFilter?: string) => void;
  onActivityClick?: (target: ActivityTarget) => void;
}

type DateFilter = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d',        label: 'Last 7 days' },
  { id: '30d',       label: 'Last 30 days' },
  { id: 'all',       label: 'All time' },
  { id: 'custom',    label: 'Custom' },
];

function ActivityModal({ onClose, onActivityClick }: { onClose: () => void; onActivityClick?: (target: ActivityTarget) => void }) {
  const [filter, setFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  // Custom date range — ISO yyyy-mm-dd strings
  const today = new Date();
  const toIso = (d: Date) => d.toISOString().split('T')[0];
  const defaultStart = new Date(today); defaultStart.setDate(today.getDate() - 14);
  const [customStart, setCustomStart] = useState<string>(toIso(defaultStart));
  const [customEnd, setCustomEnd] = useState<string>(toIso(today));

  // daysAgo from ISO string (today = 0)
  const daysFromIso = (iso: string) => {
    const d = new Date(iso);
    const ms = today.getTime() - d.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const matchesDate = (daysAgo: number) => {
    switch (filter) {
      case 'today':     return daysAgo === 0;
      case 'yesterday': return daysAgo === 1;
      case '7d':        return daysAgo <= 7;
      case '30d':       return daysAgo <= 30;
      case 'all':       return true;
      case 'custom': {
        const minDays = daysFromIso(customEnd);   // most recent boundary → smallest daysAgo
        const maxDays = daysFromIso(customStart); // oldest boundary → largest daysAgo
        return daysAgo >= Math.max(0, minDays) && daysAgo <= maxDays;
      }
    }
  };

  const filtered = activityFeed.filter(a => {
    if (!matchesDate(a.daysAgo)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.text.toLowerCase().includes(q) && !a.meta.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by daysAgo bucket
  const groups: Record<string, typeof activityFeed> = {};
  filtered.forEach(a => {
    let key = '';
    if (a.daysAgo === 0) key = 'Today';
    else if (a.daysAgo === 1) key = 'Yesterday';
    else if (a.daysAgo <= 7) key = 'This week';
    else if (a.daysAgo <= 30) key = 'This month';
    else key = 'Earlier';
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });
  const groupOrder = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'].filter(k => groups[k]);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#4D8EF7]" />
            <h2 className="text-base font-semibold text-[#030213]">All Activity</h2>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#2E7D32] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
              Live
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] hover:text-[#030213] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 pt-4 pb-3 border-b border-[#F0EFF6] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717182]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search activity..."
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-[#E0E0E6] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mr-1">
              <Calendar className="w-3 h-3" /> Date
            </span>
            {DATE_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === f.id
                    ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white'
                    : 'text-[#717182] hover:bg-[#F3F3F5] border border-[#E0E0E6]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Custom date range — only when Custom is selected */}
          {filter === 'custom' && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-[#717182] mb-1">From</label>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-[#717182] mb-1">To</label>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={toIso(today)}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                />
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#717182]">No activity matches the filter.</div>
          ) : (
            <div className="space-y-5">
              {groupOrder.map(group => (
                <div key={group}>
                  <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-2">{group}</p>
                  <div className="space-y-1">
                    {groups[group].map((a, i) => {
                      const Icon = a.icon;
                      const clickable = a.target.kind !== 'none' && !!onActivityClick;
                      return (
                        <button
                          key={`${group}-${i}`}
                          type="button"
                          onClick={clickable ? () => { onActivityClick!(a.target); onClose(); } : undefined}
                          disabled={!clickable}
                          className={`w-full text-left flex items-start gap-3 px-2 py-2 rounded-lg transition-colors ${clickable ? 'hover:bg-[#F8F9FC] cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                            <Icon className={`w-4 h-4 ${a.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#030213] leading-snug">{a.text}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-[#717182] truncate">{a.meta}</span>
                              <span className="text-xs text-[#A0A0B0]">·</span>
                              <span className="text-xs text-[#A0A0B0] flex-shrink-0">{a.time}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer summary */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#F0EFF6] text-xs text-[#717182]">
          <span>{filtered.length} {filtered.length === 1 ? 'event' : 'events'}</span>
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-[#5A5568] hover:text-[#030213] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

export default function OverviewPage({ onNavigateToInvoices, onNavigateToSuppliers, onActivityClick }: OverviewPageProps) {
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const stats = SPEND_BY_PERIOD.month; // Snapshot uses current-month values

  // Live counts derived from the canonical invoice list so the cards match the listing.
  const flaggedCount = INVOICES.filter(i =>
    i.status !== 'archived' && i.status !== 'payment_processed' && (i.ragColor !== 'green' || i.issues.length > 0)
  ).length;
  const awaitingCount = INVOICES.filter(i => i.status === 'awaiting_approval').length;
  const disputedCount = INVOICES.filter(i => i.status === 'disputed').length;
  const disputedThreadCount = INVOICES.filter(i => i.status === 'disputed' && (i.disputeEmails?.length ?? 0) > 0).length;
  // Derive supplier counts from the canonical suppliers list so the Overview
  // card matches the Suppliers page exactly.
  const pendingSuppliersCount = mockSuppliers.filter(s => s.relationshipStatus === 'Pending review').length;
  const activeSuppliersCount  = mockSuppliers.filter(s => s.relationshipStatus !== 'Archived').length;

  // Top headline cards — Flagged / Awaiting / Disputed / New Suppliers.
  // Each card can route via either a PlanFilter (→ Invoices) or a custom onClick (→ Suppliers/etc).
  const headlineCards: (KpiCardData & { info: string; onClick?: () => void; alertCount?: number; alertLabel?: string })[] = [
    { label: 'Flagged invoices',              value: flaggedCount,  sub: 'Need your review',         icon: AlertTriangle, accent: '#D4183D', filter: 'low_confidence',  info: 'Invoices below the AI confidence threshold or with active issues.' },
    { label: 'Awaiting approvals',            value: awaitingCount, sub: 'Pending sign-off',         icon: CheckCircle2,  accent: '#E65100', filter: 'awaiting_approval', info: 'Invoices waiting on a human approval step before they can move to payment.' },
    { label: 'Disputed invoices',             value: disputedCount, sub: disputedThreadCount > 0 ? `${disputedThreadCount} active email thread${disputedThreadCount === 1 ? '' : 's'}` : 'No active threads', icon: XCircle, accent: '#C62828', filter: 'disputed', info: 'Invoices currently under dispute with the supplier. The email thread is tracked on each invoice.' },
    {
      label: 'New suppliers · Awaiting approval',
      value: pendingSuppliersCount,
      sub: 'Pending review',
      icon: Package,
      accent: '#E65100',
      onClick: () => onNavigateToSuppliers?.('Pending review'),
      info: 'Supplier requests waiting for your review and activation.',
    },
  ];

  // Your Network — pure reference counts (not actionable), so the icons take a
  // muted neutral tone instead of the saturated red/orange/green of the Actionable row.
  const moduleCounts: { label: string; value: number; icon: React.ElementType; accent: string; info: string; onClick?: () => void; alertCount?: number; alertLabel?: string }[] = [
    { label: 'Suppliers',  value: activeSuppliersCount, icon: Package, accent: '#8B8B9E', info: 'Suppliers across all your practices (excludes archived).' },
    { label: 'Practices',  value: 32,  icon: Building2, accent: '#8B8B9E', info: 'Practices currently onboarded to the platform.' },
    { label: 'Staff',      value: 184, icon: Users,     accent: '#8B8B9E', info: 'Total staff (dentists, managers, admins) across all practices.' },
  ];

  return (
    <div className="p-4 sm:p-5">

      {/* Compact hero — now hosts the period filter */}
      <div className="relative rounded-xl overflow-hidden border border-[#E0E0E6] mb-4 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-[#4D8EF7]/[0.06] via-white to-[#A59DFF]/[0.08]" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
        <div className="relative px-4 sm:px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Date block (replaces sparkles icon) */}
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white border border-[#E0E0E6] shadow-sm flex-shrink-0">
              <span className="text-[9px] font-bold text-[#A59DFF] uppercase tracking-widest leading-none">
                {new Date().toLocaleDateString('en-GB', { month: 'short' })}
              </span>
              <span className="text-lg font-bold text-[#030213] leading-none mt-0.5">
                {new Date().getDate()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold text-[#030213] leading-tight truncate">Good afternoon, Sajid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout — right column height matches left exactly */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">

        {/* ── MAIN COLUMN ─────────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">

          {/* Actionable — items that need your attention today */}
          <section>
          <SectionLabel info="Items that need your attention right now — flagged or disputed invoices, approvals waiting on you, and new supplier requests.">Actionable</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 reveal-stagger">
            {headlineCards.map((c) => {
              const Icon = c.icon;
              const clickable = !!c.filter || !!c.onClick;
              const Comp: any = clickable ? 'button' : 'div';
              return (
                <Comp
                  key={c.label}
                  onClick={
                    c.onClick
                      ? c.onClick
                      : c.filter
                        ? () => onNavigateToInvoices?.(c.filter!)
                        : undefined
                  }
                  className={`relative bg-white rounded-2xl border border-[#E8E8EC] px-4 sm:px-5 py-4 sm:py-5 hover:shadow-lg hover:border-[#D4CEE1] transition-all text-left w-full ${clickable ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: c.accent + '14' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: c.accent }} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.delta && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0FDF4] text-[#2E7D32]">
                          <TrendingUp className="w-2.5 h-2.5" />
                          {c.delta}
                        </span>
                      )}
                      {c.alertCount && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-[#FFF3E0] text-[#E65100]">
                          {c.alertCount} {c.alertLabel}
                        </span>
                      )}
                      <InfoTip text={c.info} />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-[#030213] leading-none">{c.value}</div>
                  <div className="text-xs font-medium text-[#030213] mt-2 truncate">{c.label}</div>
                  <div className="text-[11px] text-[#A0A0B0] mt-0.5 truncate">{c.sub}</div>
                </Comp>
              );
            })}
          </div>
          </section>

          {/* Module counts */}
          <section>
            <SectionLabel info="Headline counts for your core directories — suppliers, practices, and staff currently onboarded.">Your network</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 reveal-stagger">
              {moduleCounts.map((m) => {
                const Icon = m.icon;
                const clickable = !!m.onClick;
                const Comp: any = clickable ? 'button' : 'div';
                return (
                  <Comp
                    key={m.label}
                    onClick={clickable ? m.onClick : undefined}
                    className={`bg-white border ${m.alertCount ? 'border-[#FFCC80]' : 'border-[#E8E8EC]'} rounded-2xl px-4 sm:px-5 py-4 sm:py-5 flex items-center justify-between gap-3 hover:shadow-lg hover:border-[#D4CEE1] transition-all text-left w-full ${clickable ? 'cursor-pointer' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <div className="text-xs font-medium text-[#5A5568] truncate">{m.label}</div>
                        <InfoTip text={m.info} />
                        {m.alertCount && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-[#FFF3E0] text-[#E65100]">
                            {m.alertCount} {m.alertLabel}
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-bold text-[#030213] leading-none">{m.value}</span>
                    </div>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: m.accent + '14' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: m.accent }} />
                    </div>
                  </Comp>
                );
              })}
            </div>
          </section>

          {/* Charts — stacked, each full width */}
          <div className="space-y-4">

            {/* Monthly spend trend */}
            <section className="bg-white border border-[#E0E0E6] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <div>
                    <h2 className="text-xs font-semibold text-[#030213]">Monthly spend trend</h2>
                    <p className="text-[10px] text-[#717182]">Last 12 months</p>
                  </div>
                  <InfoTip text="Total invoice spend per calendar month over the last 12 months. Hover any bar to see the exact value." />
                </div>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#F0FDF4] text-[#2E7D32] border border-[#BBF7D0]">
                  <TrendingUp className="w-2 h-2" />
                  +8.4%
                </span>
              </div>

              <div className="relative h-28">
                <div className="absolute inset-0 flex flex-col justify-between">
                  {[160, 80, 0].map((v) => (
                    <div key={v} className="flex items-center gap-1.5">
                      <span className="text-[8px] text-[#A0A0B0] w-6 text-right">£{v}k</span>
                      <div className="flex-1 border-t border-dashed border-[#F0EFF6]" />
                    </div>
                  ))}
                </div>

                <div className="absolute inset-0 pl-8 flex items-end gap-1">
                  {monthlySpend.map((m, i) => {
                    const isLast = i === monthlySpend.length - 1;
                    return (
                      <div key={m.month} className="flex-1 h-full flex flex-col items-center group">
                        <div className="flex-1 w-full flex items-end relative">
                          <div
                            className={`w-full rounded-t transition-all ${
                              isLast
                                ? 'bg-gradient-to-t from-[#4D8EF7] to-[#A59DFF]'
                                : 'bg-[#DBEAFE] group-hover:bg-[#BFDBFE]'
                            }`}
                            style={{ height: `${(m.value / 180) * 100}%` }}
                          />
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-[#030213] text-white text-[9px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap">£{m.value}k</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pl-8 flex gap-1 mt-1">
                {monthlySpend.map((m) => (
                  <div key={m.month} className="flex-1 text-center text-[9px] text-[#717182]">{m.month}</div>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* ── RIGHT COLUMN — Recent activity (matches left column height exactly) ── */}
        <div className="relative self-stretch">
        <aside className="lg:absolute lg:inset-0 flex flex-col min-h-0">
          <div className="bg-white border border-[#E0E0E6] rounded-xl p-3 flex flex-col flex-1 w-full min-h-0">
            <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#717182]" />
                <h2 className="text-xs font-semibold text-[#030213]">Recent Activity</h2>
                <InfoTip text="Live feed of invoices, cases, supplier, practice and staff events. Click any item to jump to its detail." />
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] text-[#2E7D32] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
              {activityFeed.map((a, i) => {
                const Icon = a.icon;
                const clickable = a.target.kind !== 'none' && !!onActivityClick;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={clickable ? () => onActivityClick!(a.target) : undefined}
                    disabled={!clickable}
                    className={`w-full text-left flex items-start gap-2 px-1 py-1 rounded-md transition-colors ${clickable ? 'hover:bg-[#F8F9FC] cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                      <Icon className={`w-3 h-3 ${a.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#030213] leading-snug">{a.text}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-[#717182] truncate">{a.meta}</span>
                        <span className="text-[9px] text-[#A0A0B0]">·</span>
                        <span className="text-[9px] text-[#A0A0B0] flex-shrink-0">{a.time}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setActivityModalOpen(true)}
              className="w-full mt-2 px-2 py-1.5 text-[10px] font-medium text-[#4D8EF7] hover:bg-[#F8F9FC] rounded-md transition-colors border border-[#E0E0E6] flex-shrink-0"
            >
              View all
            </button>
          </div>
        </aside>
        </div>
      </div>

      {activityModalOpen && <ActivityModal onClose={() => setActivityModalOpen(false)} onActivityClick={onActivityClick} />}
    </div>
  );
}
