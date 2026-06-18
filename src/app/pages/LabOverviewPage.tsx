import { useMemo } from 'react';
import {
  Sparkles, ArrowRight, FolderKanban, Inbox, Factory, Gauge, AlertTriangle,
  ChevronRight, Sliders, BarChart3, ScanLine, Building2, Stethoscope, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCaseScoring } from '../context/CaseScoringContext';
import { mockCases } from './CasesPage';

// ─── Lab Portal — Overview ───────────────────────────────────────────────────
// The manufacturing lab's home. Cases flow IN from the lab's clients — both
// individual clinics and dental groups (all "suppliers" in the platform's
// vocabulary). The lab triages incoming work, watches production, and chases
// clinics for incomplete prescriptions (surfaced by the completeness score).

// A couple of clients are dental groups rather than single clinics, so the lab
// sees it serves both. Anything not listed defaults to a clinic.
const CLIENT_TYPE: Record<string, 'Clinic' | 'Dental Group'> = {
  'Smile Genius London Central': 'Dental Group',
  'Smile Genius Manchester': 'Dental Group',
};

const SCORE_PILL: Record<'red' | 'amber' | 'green', string> = {
  green: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  amber: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]',
  red:   'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
};

export default function LabOverviewPage({ onOpenCases, onOpenConfiguration, onOpenAnalytics }: {
  onOpenCases: () => void;
  onOpenConfiguration: () => void;
  onOpenAnalytics?: () => void;
}) {
  const { user } = useAuth();
  const { scoreCase } = useCaseScoring();
  const displayName = (user?.email || 'there').split('@')[0];

  const stats = useMemo(() => {
    const cases = mockCases.filter(c => !c.archived);
    const by = (pred: (s: string) => boolean) => cases.filter(c => pred(c.status)).length;
    const incoming = by(s => s === 'new' || s === 'submitted');
    const inProduction = by(s => s === 'in-production' || s === 'refinement');
    const qc = by(s => s === 'quality-check');

    // Completeness across every case that has a scored service.
    const scored = cases.map(c => scoreCase(c)).filter(s => s.applicable);
    const avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.percent, 0) / scored.length) : 0;
    const lowScore = cases.filter(c => { const s = scoreCase(c); return s.applicable && s.band === 'red'; });

    // Cases missing 3D scans where the service is one we score on scans.
    const missingScans = cases.filter(c =>
      c.serviceItems.some(si => (si.scanFileCount ?? 0) === 0) &&
      scoreCase(c).applicable,
    );

    // Top clients by case volume.
    const counts: Record<string, number> = {};
    for (const c of cases) counts[c.practice] = (counts[c.practice] ?? 0) + 1;
    const topClients = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, n]) => ({ name, n, type: CLIENT_TYPE[name] ?? 'Clinic' as const }));

    // Recent incoming work — newest first (drafts + new sit at the top).
    const recent = cases.filter(c => c.status === 'new' || c.status === 'submitted' || c.status === 'draft').slice(0, 6);

    return { incoming, inProduction, qc, avg, lowScore, missingScans, topClients, recent, total: cases.length };
  }, [scoreCase]);

  const actions = [
    stats.lowScore.length > 0 && {
      icon: <AlertTriangle className="w-4 h-4 text-[#D4183D]" />, bg: 'bg-[#FFEBEE]',
      text: `${stats.lowScore.length} case${stats.lowScore.length === 1 ? '' : 's'} with low-completeness prescriptions — chase the clinic for missing info`,
      cta: 'Review', onClick: onOpenCases,
    },
    stats.missingScans.length > 0 && {
      icon: <ScanLine className="w-4 h-4 text-[#C2410C]" />, bg: 'bg-[#FFF7ED]',
      text: `${stats.missingScans.length} case${stats.missingScans.length === 1 ? '' : 's'} missing 3D scan files`,
      cta: 'Open', onClick: onOpenCases,
    },
    stats.qc > 0 && {
      icon: <Gauge className="w-4 h-4 text-[#7C3AED]" />, bg: 'bg-[#F5F3FF]',
      text: `${stats.qc} case${stats.qc === 1 ? '' : 's'} in quality check`,
      cta: 'Open', onClick: onOpenCases,
    },
  ].filter(Boolean) as { icon: React.ReactNode; bg: string; text: string; cta: string; onClick?: () => void }[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E0E0E6] p-6 sm:p-7">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: 'radial-gradient(circle at top right, #EEF4FF, transparent 65%), radial-gradient(circle at bottom left, #ECFEFF, transparent 70%)' }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white border border-[#E0E0E6] text-[#5A5568] mb-3">
              <Sparkles className="w-3 h-3 text-[#4D8EF7]" />
              Lab Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] capitalize">Welcome back, {displayName}</h1>
            <p className="text-sm text-[#717182] mt-1.5 leading-relaxed max-w-xl">
              Here's the work coming in from your clinics and dental groups — what to triage, what's in production, and how complete the prescriptions are.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
            <button
              onClick={onOpenConfiguration}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity shadow-sm"
            >
              <Sliders className="w-4 h-4" />
              Configure scoring
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Inbox className="w-5 h-5 text-[#4D8EF7]" />} accent="#4D8EF7" label="Incoming" value={String(stats.incoming)} sub="new · to triage" onClick={onOpenCases} />
        <StatCard icon={<Factory className="w-5 h-5 text-[#7C3AED]" />} accent="#7C3AED" label="In production" value={String(stats.inProduction)} sub="being made" onClick={onOpenCases} />
        <StatCard icon={<Gauge className="w-5 h-5 text-[#2E7D32]" />} accent="#2E7D32" label="Avg. completeness" value={`${stats.avg}%`} sub="incoming Rx quality" onClick={onOpenAnalytics} />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-[#E65100]" />} accent="#E65100" alert={stats.lowScore.length > 0} label="Needs info" value={String(stats.lowScore.length)} sub="incomplete Rx" onClick={onOpenCases} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Needs attention */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFF6]">
            <p className="text-sm font-semibold text-[#030213]">Needs your attention</p>
            <p className="text-xs text-[#717182] mt-0.5">Triage queue for the lab</p>
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

        {/* Top clients */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#030213]">Top clients</p>
              <p className="text-xs text-[#717182] mt-0.5">Clinics &amp; dental groups by case volume</p>
            </div>
            <button onClick={onOpenAnalytics} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
              Analytics <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-2">
            {stats.topClients.map((cl) => (
              <div key={cl.name} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cl.type === 'Dental Group' ? 'bg-[#EEF4FF]' : 'bg-[#F5F3FF]'}`}>
                  {cl.type === 'Dental Group'
                    ? <Building2 className="w-4 h-4 text-[#1565C0]" />
                    : <Stethoscope className="w-4 h-4 text-[#7C3AED]" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#030213] truncate">{cl.name}</p>
                  <p className="text-[10px] text-[#A0A0B0]">{cl.type}</p>
                </div>
                <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0">{cl.n} cases</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent incoming */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center justify-between">
          <p className="text-sm font-semibold text-[#030213]">Recent incoming cases</p>
          <button onClick={onOpenCases} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {stats.recent.map((c) => {
            const s = scoreCase(c);
            return (
              <button key={c.id} onClick={onOpenCases} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left">
                <span className="w-8 h-8 rounded-lg bg-[#F8F9FC] border border-[#E8E8EC] flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="w-3.5 h-3.5 text-[#717182]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#030213] truncate">{c.patientName}</p>
                  <p className="text-[10px] text-[#A0A0B0] truncate">{c.services[0]} · {c.practice}</p>
                </div>
                {s.applicable ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${SCORE_PILL[s.band]}`}>{s.percent}%</span>
                ) : (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-[#F3F3F5] text-[#A0A0B0] border-[#E0E0E6] flex-shrink-0">No score</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction icon={<FolderKanban className="w-4 h-4 text-[#4D8EF7]" />} bg="bg-[#EEF4FF]" title="Cases" sub="Triage & track production" onClick={onOpenCases} />
        <QuickAction icon={<Sliders className="w-4 h-4 text-[#7C3AED]" />} bg="bg-[#F5F3FF]" title="Case scoring" sub="Weight prescription fields" onClick={onOpenConfiguration} />
        <QuickAction icon={<BarChart3 className="w-4 h-4 text-[#2E7D32]" />} bg="bg-[#F0FDF4]" title="Analytics" sub="Volume & quality insights" onClick={onOpenAnalytics} />
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
