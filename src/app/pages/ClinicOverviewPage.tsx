import { useState, type ReactNode } from 'react';
import {
  Sparkles, ArrowRight, FolderKanban, Plus, Wallet,
  CheckCircle2, FileText, Layers, PauseCircle, CalendarClock,
  CalendarX2, XCircle, MessageSquare, TrendingUp, Info,
  Reply, Check, Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// ─── Clinic Portal — Overview ────────────────────────────────────────────────
// A practice's home dashboard. Kept deliberately operational / at-a-glance:
// case operations (where lab work stands), the live activity feed, and the
// unread-messages inbox. The heavier analytical surfaces — the financial
// exposure pipeline and the six-month performance trends — now live on the
// Analytics page (Clinical tab), so the dashboard stays a fast morning glance.
// All figures are demo mocks; clicking a number deep-links into the matching
// Cases / Invoices / Messages view.

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

// Open financial exposure — referenced in the hero headline only; the full
// pipeline breakdown now lives on Analytics ▸ Clinical.
const OPEN_EXPOSURE = 20400;

// Unread inbox preview — mirrors the conversations on the Messages page.
type ConvType = 'Clinic' | 'Lab' | 'Supplier';
interface Convo { name: string; type: ConvType; initials: string; unread: number; last: string; time: string }
const UNREAD: Convo[] = [
  { name: 'Laburnum Dental',       type: 'Clinic',   initials: 'LD', unread: 14, last: 'Sent the updated impressions — can you confirm the shade?', time: '2m' },
  { name: 'S4S',                   type: 'Lab',      initials: 'S',  unread: 9,  last: 'Crown case #10234 is ready to ship today.',                  time: '1h' },
  { name: 'Patterson Dental',      type: 'Supplier', initials: 'PD', unread: 3,  last: 'Invoice INV-129 has been updated and re-sent.',              time: '3h' },
  { name: 'Northwood Dental Labs', type: 'Lab',      initials: 'ND', unread: 5,  last: 'The bridge case is back from QC — please review.',           time: '5h' },
  { name: 'City Orthodontics',     type: 'Clinic',   initials: 'CO', unread: 4,  last: 'Patient referral details have been sent over.',              time: 'Yesterday' },
  { name: 'DD Group',              type: 'Supplier', initials: 'DD', unread: 2,  last: 'Updated quote attached for the consumables order.',          time: 'Yesterday' },
  { name: 'Medit Ireland',         type: 'Supplier', initials: 'MI', unread: 1,  last: 'Scanner firmware update is now available.',                  time: '2d' },
];

function typeChip(type: ConvType) {
  switch (type) {
    case 'Clinic':   return 'bg-[#FFE4E6] text-[#BE123C]';
    case 'Lab':      return 'bg-[#EEF4FF] text-[#1565C0]';
    case 'Supplier': return 'bg-[#F0FDF4] text-[#2E7D32]';
  }
}

export default function ClinicOverviewPage({ onOpenCases, onCreateCase, onOpenInvoices, onOpenAnalytics, onOpenMessages }: {
  onOpenCases: () => void;
  onCreateCase: () => void;
  onOpenInvoices?: (filter?: string) => void;
  onOpenAnalytics?: () => void;
  onOpenMessages?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const displayName = (user?.email || 'there').split('@')[0];

  // Unread inbox — local state so "mark as read" and "quick reply" actually
  // clear the conversation from the list (prototype: no backend).
  const [convos, setConvos] = useState<Convo[]>(UNREAD);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const unreadTotal = convos.reduce((s, c) => s + c.unread, 0);

  const markRead = (name: string) => {
    setConvos((prev) => prev.filter((c) => c.name !== name));
    if (replyTo === name) setReplyTo(null);
    toast.success(`Marked ${name} as read`);
  };
  const sendReply = (name: string) => {
    if (!replyText.trim()) return;
    toast.success(`Reply sent to ${name}`);
    setReplyText('');
    setReplyTo(null);
    setConvos((prev) => prev.filter((c) => c.name !== name));
  };

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

  // Live activity feed across cases & invoices.
  const activity = [
    { icon: FileText,     color: 'text-[#4D8EF7]', bg: 'bg-[#EEF4FF]', text: 'Case #10234 submitted',          meta: 'Crown · 3Shape Lab',          time: '2m ago' },
    { icon: CheckCircle2, color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Invoice INV-129 approved',        meta: '£1,340 · Patterson Dental',   time: '18m ago' },
    { icon: PauseCircle,  color: 'text-[#E65100]', bg: 'bg-[#FFF7ED]', text: 'Case #10320 placed on hold',      meta: 'Awaiting clinic response',    time: '1h ago' },
    { icon: MessageSquare,color: 'text-[#D4183D]', bg: 'bg-[#FFEBEE]', text: 'Invoice INV-555 disputed',        meta: '£562 · Henry Schein',         time: '3h ago' },
    { icon: Wallet,       color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Payment of £1,250 completed',     meta: 'INV-118 · Patterson Dental',  time: 'Yesterday' },
    { icon: CheckCircle2, color: 'text-[#2E7D32]', bg: 'bg-[#F0FDF4]', text: 'Case #10198 delivered on time',   meta: 'Bridge · 3Shape Lab',         time: 'Yesterday' },
  ];

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

      {/* Two-column dashboard — operations & activity on the left, inbox on the
          right. No items-start: the columns stretch to equal height so the
          sticky inbox fills the same height as the left side. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6 min-w-0">

          {/* Case operations */}
          <section>
            <SectionLabel info="Where your lab work stands today — counts, value and delivery risk across active cases.">Case operations</SectionLabel>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {caseOps.map((c) => <StatTile key={c.label} {...c} />)}
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
              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-x-2">
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

        {/* ── RIGHT COLUMN — unread messages (sticky, full-height) ── */}
        <div className="min-w-0">
          <section className="flex flex-col lg:sticky lg:top-6 lg:h-full">
            <SectionLabel info="Conversations from clinics, labs and suppliers waiting on a reply.">Unread messages</SectionLabel>
            <div className="bg-white border border-[#E0E0E6] rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-[#F0EFF6] flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-[#717182]">Across clinics, labs &amp; suppliers</p>
                {unreadTotal > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#C62828]">{unreadTotal} unread</span>
                )}
              </div>

              {/* Scrollable conversation list */}
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                {convos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                    <span className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                    </span>
                    <p className="text-sm font-semibold text-[#030213]">All caught up</p>
                    <p className="text-[11px] text-[#A0A0B0] mt-0.5">No unread messages right now.</p>
                  </div>
                ) : convos.map((c) => (
                  <div key={c.name} className="rounded-lg hover:bg-[#FAFBFD] transition-colors group">
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <button onClick={onOpenMessages} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${typeChip(c.type)}`}>
                          {c.initials}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-[#030213] truncate">{c.name}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeChip(c.type)}`}>{c.type}</span>
                          </div>
                          <p className="text-[11px] text-[#A0A0B0] truncate mt-0.5">{c.last}</p>
                        </div>
                      </button>
                      {/* Default: time + unread badge. On hover: quick actions. */}
                      <div className="flex-shrink-0">
                        <div className="flex flex-col items-end gap-1 group-hover:hidden">
                          <span className="text-[10px] text-[#A0A0B0]">{c.time}</span>
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#4D8EF7] text-white text-[10px] font-bold flex items-center justify-center">{c.unread}</span>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={() => { setReplyTo(replyTo === c.name ? null : c.name); setReplyText(''); }}
                            title="Quick reply"
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${replyTo === c.name ? 'text-[#4D8EF7] bg-[#EEF4FF]' : 'text-[#5A5568] hover:text-[#4D8EF7] hover:bg-[#EEF4FF]'}`}
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => markRead(c.name)}
                            title="Mark as read"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5A5568] hover:text-[#2E7D32] hover:bg-[#F0FDF4] transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Inline quick-reply composer */}
                    {replyTo === c.name && (
                      <div className="px-3 pb-2.5 pl-[3.75rem] flex items-center gap-2">
                        <input
                          autoFocus
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') sendReply(c.name); if (e.key === 'Escape') setReplyTo(null); }}
                          placeholder={`Reply to ${c.name}…`}
                          className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-[#E0E0E6] rounded-lg focus:outline-none focus:border-[#4D8EF7] bg-white"
                        />
                        <button
                          onClick={() => sendReply(c.name)}
                          disabled={!replyText.trim()}
                          title="Send reply"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity disabled:opacity-40 flex-shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <button
                onClick={onOpenMessages}
                className="w-full px-5 py-3 border-t border-[#F0EFF6] text-[11px] font-semibold text-[#4D8EF7] hover:bg-[#FAFBFD] inline-flex items-center justify-center gap-1 transition-colors flex-shrink-0"
              >
                Open all messages <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </section>
        </div>
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
