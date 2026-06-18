import { useMemo, useState } from 'react';
import {
  Inbox, Factory, Gauge, Truck, ArrowRight, Building2, Stethoscope, Sliders,
} from 'lucide-react';
import { useCaseScoring } from '../context/CaseScoringContext';
import { computeCaseScore, resolveTier } from '../data/caseScoring';
import { mockCases } from './CasesPage';

// ─── Lab Portal — Analytics ──────────────────────────────────────────────────
// The lab's view of its own throughput and the quality of the work coming in.
// Volume + pipeline are derived from the shared case data; the "completeness by
// service" chart reads the live scoring config — so it reflects exactly what
// the lab set up in Configuration.

type Period = 'Month' | 'Quarter' | 'Year';

const BAR_COLORS = ['#4D8EF7', '#A59DFF', '#34D399', '#FB923C', '#F87171', '#22C55E', '#7C3AED', '#0EA5E9'];
const BAND_COLOR: Record<'red' | 'amber' | 'green', string> = {
  green: '#22C55E', amber: '#F59E0B', red: '#EF4444',
};
const CLIENT_TYPE: Record<string, 'Clinic' | 'Dental Group'> = {
  'Smile Genius London Central': 'Dental Group',
  'Smile Genius Manchester': 'Dental Group',
};

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

function Kpi({ icon, label, value, sub, accent, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent: string; onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <div className="text-xs text-[#717182] mb-1">{label}</div>
        <div className="text-xl font-semibold text-[#030213]">{value}</div>
        <div className="text-[10px] mt-0.5 text-[#A0A0B0]">{sub}</div>
      </div>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accent + '1A' }}>{icon}</div>
    </div>
  );
  const base = `bg-white rounded-xl border border-[#E0E0E6] p-4 w-full text-left transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`;
  return onClick ? <button onClick={onClick} className={base}>{inner}</button> : <div className={base}>{inner}</div>;
}

// Horizontal bar list — value sits OUTSIDE the bar for legibility.
function BarList({ rows, max, formatValue }: {
  rows: { label: string; value: number; color: string; tag?: string }[];
  max: number;
  formatValue: (v: number) => string;
}) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="text-xs text-[#5A5568] w-40 flex-shrink-0 truncate text-right">
            {r.label}{r.tag && <span className="ml-1 text-[9px] text-[#A0A0B0]">· {r.tag}</span>}
          </span>
          <div className="flex-1 h-5 bg-[#F3F3F5] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
          <span className="text-xs font-bold text-[#030213] tabular-nums flex-shrink-0 w-12 text-right">{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function LabAnalyticsPage({ onOpenCases, onOpenConfiguration }: {
  onOpenCases?: () => void;
  onOpenConfiguration?: () => void;
}) {
  const [period, setPeriod] = useState<Period>('Month');
  const { config, thresholds } = useCaseScoring();

  const data = useMemo(() => {
    const cases = mockCases.filter(c => !c.archived);
    const incoming = cases.filter(c => c.status === 'new' || c.status === 'submitted').length;
    const inProduction = cases.filter(c => c.status === 'in-production' || c.status === 'refinement').length;

    // Avg completeness across all scored cases.
    const scored = cases.map(c => computeCaseScore(c, config, thresholds)).filter(s => s.applicable);
    const avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.percent, 0) / scored.length) : 0;

    // Volume by service + completeness by service (per service item).
    const volume: Record<string, number> = {};
    const scoreAgg: Record<string, { sum: number; n: number }> = {};
    for (const c of cases) {
      for (const si of c.serviceItems ?? []) {
        volume[si.name] = (volume[si.name] ?? 0) + 1;
        if ((config[si.name]?.length ?? 0) > 0) {
          const s = computeCaseScore({ ...c, serviceItems: [si] }, config, thresholds);
          if (s.applicable) {
            const agg = scoreAgg[si.name] ?? { sum: 0, n: 0 };
            agg.sum += s.percent; agg.n += 1;
            scoreAgg[si.name] = agg;
          }
        }
      }
    }
    const byService = Object.entries(volume).sort((a, b) => b[1] - a[1])
      .map(([name, n], i) => ({ label: name, value: n, color: BAR_COLORS[i % BAR_COLORS.length] }));

    const completeness = Object.entries(scoreAgg)
      .map(([name, { sum, n }]) => ({ name, pct: Math.round(sum / n) }))
      .sort((a, b) => b.pct - a.pct)
      .map(r => ({ label: r.name, value: r.pct, color: BAND_COLOR[resolveTier(r.pct, thresholds).band] }));

    // Pipeline by stage.
    const STAGE_DEFS: { label: string; statuses: string[]; color: string }[] = [
      { label: 'Incoming',      statuses: ['new', 'submitted'],   color: '#A59DFF' },
      { label: 'In Production', statuses: ['in-production', 'refinement'], color: '#4D8EF7' },
      { label: 'Quality Check', statuses: ['quality-check'],      color: '#FB923C' },
      { label: 'Shipped',       statuses: ['shipped'],            color: '#34D399' },
      { label: 'Delivered',     statuses: ['delivered', 'completed'], color: '#22C55E' },
    ];
    const pipeline = STAGE_DEFS.map(s => ({
      label: s.label, color: s.color,
      value: cases.filter(c => s.statuses.includes(c.status)).length,
    }));

    // Top clients by volume.
    const clientCounts: Record<string, number> = {};
    for (const c of cases) clientCounts[c.practice] = (clientCounts[c.practice] ?? 0) + 1;
    const clients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, n], i) => ({ label: name, value: n, color: BAR_COLORS[i % BAR_COLORS.length], tag: CLIENT_TYPE[name] ?? 'Clinic' }));

    return { incoming, inProduction, avg, byService, completeness, pipeline, clients, total: cases.length };
  }, [config, thresholds]);

  const volMax = Math.max(1, ...data.byService.map(r => r.value));
  const pipeMax = Math.max(1, ...data.pipeline.map(r => r.value));
  const clientMax = Math.max(1, ...data.clients.map(r => r.value));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header + period */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213]">Analytics</h1>
          <p className="text-sm text-[#717182] mt-0.5">Your lab's throughput and the quality of incoming prescriptions.</p>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Inbox className="w-5 h-5 text-[#4D8EF7]" />} label="Cases received" value={String(data.total)} sub={`this ${period.toLowerCase()}`} accent="#4D8EF7" onClick={onOpenCases} />
        <Kpi icon={<Factory className="w-5 h-5 text-[#7C3AED]" />} label="In production" value={String(data.inProduction)} sub="being made" accent="#7C3AED" onClick={onOpenCases} />
        <Kpi icon={<Gauge className="w-5 h-5 text-[#2E7D32]" />} label="Avg. completeness" value={`${data.avg}%`} sub="incoming Rx quality" accent="#2E7D32" onClick={onOpenConfiguration} />
        <Kpi icon={<Truck className="w-5 h-5 text-[#E65100]" />} label="On-time delivery" value="94%" sub="last 30 days" accent="#E65100" />
      </div>

      {/* Volume by service + completeness by service */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Cases by Service" subtitle="Volume across all clients">
          <BarList rows={data.byService} max={volMax} formatValue={(v) => String(v)} />
        </Card>

        <Card
          title="Completeness by Service"
          subtitle="Avg. prescription score — reflects your scoring setup"
          action={
            <button onClick={onOpenConfiguration} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
              <Sliders className="w-3 h-3" /> Configure
            </button>
          }
        >
          {data.completeness.length > 0 ? (
            <BarList rows={data.completeness} max={100} formatValue={(v) => `${v}%`} />
          ) : (
            <p className="text-sm text-[#717182] py-6 text-center">No services scored yet. Set weights in Configuration.</p>
          )}
        </Card>
      </div>

      {/* Pipeline + clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card
          title="Production Pipeline"
          subtitle="Where cases sit right now"
          action={
            <button onClick={onOpenCases} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <BarList rows={data.pipeline} max={pipeMax} formatValue={(v) => String(v)} />
        </Card>

        <Card title="Top Clients" subtitle="Clinics & dental groups by volume">
          <BarList rows={data.clients} max={clientMax} formatValue={(v) => String(v)} />
        </Card>
      </div>

      {/* Quick links footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={onOpenCases} className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3 hover:border-[#4D8EF7] hover:shadow-sm transition-all text-left">
          <span className="w-9 h-9 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0"><Inbox className="w-4 h-4 text-[#4D8EF7]" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#030213]">Triage cases</p>
            <p className="text-[11px] text-[#717182]">{data.incoming} incoming</p>
          </div>
        </button>
        <button onClick={onOpenConfiguration} className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3 hover:border-[#7C3AED] hover:shadow-sm transition-all text-left">
          <span className="w-9 h-9 rounded-lg bg-[#F5F3FF] flex items-center justify-center flex-shrink-0"><Sliders className="w-4 h-4 text-[#7C3AED]" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#030213]">Case scoring</p>
            <p className="text-[11px] text-[#717182]">Tune field weights</p>
          </div>
        </button>
        <div className="bg-white border border-[#E0E0E6] rounded-xl p-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-[#2E7D32]" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#030213]">{data.clients.length} active clients</p>
            <p className="text-[11px] text-[#717182]">Clinics &amp; dental groups</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep the clinic-vs-group icon import referenced even if a future trim drops a usage.
void Stethoscope;
