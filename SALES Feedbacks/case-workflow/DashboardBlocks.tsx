import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CalendarDays, Clock, Factory, Inbox, PauseCircle, Timer } from 'lucide-react';
import { allCases } from '../bulk-actions/caseContent';
import { addDays, daysBetween, fmtShort, parse, iso, pl } from '../lab-billing/format';
import { Card } from '../lab-billing/ui';
import { type Line, IN_LAB, dueOf, isHidden, isOpen, isOverdue, routeOf, today, useWorkflow } from './workflowStore';
import { useMe } from './shared';

// ── V2 dashboard: the spec's blocks, above the existing Overview ─────────────
// Immediate Actions (every tile opens the lines behind it), Case Processing
// (turnaround in days), Work in the lab (per stage: In Queue / In Production,
// plus Unassigned) and This week (due per day, Mon–Fri). All counts are
// service lines. Not Approved and Cancelled are left out, with a banner.

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default function DashboardBlocks() {
  const s = useWorkflow();
  const me = useMe();
  const navigate = useNavigate();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [service, setService] = useState('all');
  const t = today();
  const open = (f: string) => navigate(`/growth/queue?filter=${encodeURIComponent(f)}`);

  const d = useMemo(() => {
    const all = Object.values(s.lines).filter(l => (scope === 'all' || l.owner === me) && (service === 'all' || l.service === service));
    const hidden = all.filter(isHidden);
    const lines = all.filter(l => !isHidden(l));
    const live = lines.filter(isOpen);
    const holds = (k: string) => lines.filter(l => l.status === k);
    const oldest = (ls: Line[]) => Math.max(0, ...ls.map(l => daysBetween(l.hold?.since ?? l.since, t)));
    const onTheWay = allCases().filter(c => c.status === 'ready-for-dispatch' && !c.archived).length;
    // Work in the lab: one row per stage on the lab's routes (by name, in route order).
    const stageNames: string[] = [];
    s.routes.forEach(r => r.stages.forEach(x => { if (!stageNames.includes(x.name)) stageNames.push(x.name); }));
    const qcLast = stageNames.filter(n => n !== 'Quality Control').concat('Quality Control');
    const inLab = live.filter(l => IN_LAB.includes(l.status) && !l.qcPassed);
    const stages = qcLast.map(name => {
      const here = inLab.filter(l => routeOf(s, l).stages[l.stage]?.name === name);
      return { name, queue: here.filter(l => l.status === 'in-queue' || !l.owner).length, prod: here.filter(l => l.status !== 'in-queue' && !!l.owner).length };
    }).filter(r => r.queue + r.prod > 0);
    const wk = (() => { const x = parse(t); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); })();
    const week = [0, 1, 2, 3, 4].map(i => { const day = addDays(wk, i); return { day, n: live.filter(l => dueOf(s, l) === day).length }; });
    const ttp = avg(lines.filter(l => l.acceptedAt && l.firstProdAt).map(l => daysBetween(l.acceptedAt!, l.firstProdAt!)));
    const tat = avg(lines.filter(l => l.shippedAt).map(l => daysBetween(l.receivedAt, l.shippedAt!)));
    return {
      hidden, overdue: live.filter(l => isOverdue(s, l)).length,
      soon: live.filter(l => { const x = dueOf(s, l); return !!x && x >= t && x <= addDays(t, 1); }).length,
      toAccept: lines.filter(l => l.status === 'received' || l.status === 'under-review').length, onTheWay,
      holdP: holds('on-hold-practice'), holdL: holds('on-hold-lab'), oldest,
      noDate: live.filter(l => !l.requested).length,
      stages, unassigned: inLab.filter(l => !l.owner).length, week, ttp, tat, services: [...new Set(Object.values(s.lines).map(l => l.service))].sort(),
    };
  }, [s, scope, service, me, t]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7C3AED]">V2 · Case handoff workflow</p>
          <h2 className="text-lg font-semibold text-[#030213]">Work in the lab today</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex rounded-lg border border-[#E0E0E6] overflow-hidden bg-white">{(['all', 'mine'] as const).map(x => <button key={x} onClick={() => setScope(x)} className={`px-3 py-1.5 font-semibold ${scope === x ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#5A5568]'}`}>{x === 'all' ? 'All Cases' : 'My Cases'}</button>)}</div>
          <select value={service} onChange={e => setService(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[#E0E0E6] bg-white"><option value="all">All Services</option>{d.services.map(x => <option key={x}>{x}</option>)}</select>
        </div>
      </div>

      {d.hidden.length > 0 && <button onClick={() => open('hidden')} className="w-full text-left rounded-lg bg-[#F8F9FC] border border-[#E0E0E6] px-3 py-2 text-xs text-[#5A5568]">Left out of every count: {d.hidden.filter(l => l.status === 'not-approved').length} not approved · {d.hidden.filter(l => l.status === 'cancelled').length} cancelled. <span className="font-semibold text-[#4D8EF7]">Show</span></button>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Tile icon={<AlertTriangle className="w-4 h-4 text-[#C62828]" />} label="Overdue" value={d.overdue} sub="Open services, oldest first" tone={d.overdue ? 'red' : undefined} onClick={() => open('overdue')} />
        <Tile icon={<Clock className="w-4 h-4 text-[#B45309]" />} label="Due today + tomorrow" value={d.soon} sub="Due back to the practice" onClick={() => open('due-soon')} />
        <Tile icon={<Inbox className="w-4 h-4 text-[#4D8EF7]" />} label="To accept" value={d.toAccept} sub={`${d.onTheWay} on the way`} onClick={() => open('to-accept')} />
        <Tile icon={<PauseCircle className="w-4 h-4 text-[#B45309]" />} label="On hold" value={d.holdP.length + d.holdL.length} sub={<><button className="underline" onClick={e => { e.stopPropagation(); open('hold-practice'); }}>Practice {d.holdP.length}</button> · <button className="underline" onClick={e => { e.stopPropagation(); open('hold-lab'); }}>Lab {d.holdL.length}</button>{d.holdP.length + d.holdL.length ? ` · oldest ${pl(d.oldest([...d.holdP, ...d.holdL]), 'day')}` : ''}</>} onClick={() => open('hold-lab')} />
        <Tile icon={<CalendarDays className="w-4 h-4 text-[#717182]" />} label="No delivery date" value={d.noDate} sub="Opens the calendar's No date set" onClick={() => navigate('/growth/calendar')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title={<span className="inline-flex items-center gap-2"><Factory className="w-4 h-4 text-[#7C3AED]" /> Work in the lab</span>} sub="Services at each stage. Click a number to see them." className="xl:col-span-2" pad={false}>
          <table className="w-full">
            <thead><tr><th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[#717182] px-4 py-2">Stage</th><th className="text-right text-[10px] font-semibold uppercase tracking-wide text-[#717182] px-4 py-2">In Queue</th><th className="text-right text-[10px] font-semibold uppercase tracking-wide text-[#717182] px-4 py-2">In Production</th></tr></thead>
            <tbody>
              {d.stages.map(r => (
                <tr key={r.name} className="border-t border-[#F0EFF6]">
                  <td className="px-4 py-2 text-xs font-semibold text-[#030213]">{r.name}</td>
                  <td className="px-4 py-2 text-right"><Num n={r.queue} onClick={() => open(`stage:${r.name}:queue`)} /></td>
                  <td className="px-4 py-2 text-right"><Num n={r.prod} onClick={() => open(`stage:${r.name}:prod`)} /></td>
                </tr>
              ))}
              <tr className="border-t border-[#E0E0E6] bg-[#FAFAFD]"><td className="px-4 py-2 text-xs font-semibold">Unassigned</td><td className="px-4 py-2 text-right" colSpan={2}><Num n={d.unassigned} onClick={() => open('unassigned')} /></td></tr>
            </tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card title={<span className="inline-flex items-center gap-2"><CalendarClock className="w-4 h-4 text-[#4D8EF7]" /> This week</span>} sub="Services due each day. Click a day for the calendar.">
            <div className="grid grid-cols-5 gap-1.5">
              {d.week.map(w => (
                <button key={w.day} onClick={() => navigate(`/growth/calendar?day=${w.day}`)} className={`rounded-lg px-1 py-2 text-center border ${w.day === t ? 'border-[#4D8EF7] bg-[#EEF4FF]' : 'border-[#F0EFF6] hover:border-[#C7DAFF]'}`}>
                  <p className="text-[10px] text-[#717182]">{parse(w.day).toLocaleDateString('en-GB', { weekday: 'short' })} {fmtShort(w.day).split(' ')[0]}</p>
                  <p className="text-lg font-semibold text-[#030213]">{w.n}</p>
                  {w.day === t && d.overdue > 0 && <p className="text-[10px] text-[#C62828] font-semibold">+{d.overdue} overdue</p>}
                </button>
              ))}
            </div>
          </Card>
          <Card title={<span className="inline-flex items-center gap-2"><Timer className="w-4 h-4 text-[#2E7D32]" /> Case processing</span>}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-[#717182]">Time to production</p><p className="text-lg font-semibold">{d.ttp != null ? `${d.ttp.toFixed(1)} days` : '—'}</p><p className="text-[10px] text-[#A0A0B0]">Accepted → first In Production</p></div>
              <div><p className="text-[#717182]">Average turnaround</p><p className="text-lg font-semibold">{d.tat != null ? `${d.tat.toFixed(1)} days` : '—'}</p><p className="text-[10px] text-[#A0A0B0]">Received → Shipped</p></div>
            </div>
          </Card>
        </div>
      </div>
      <p className="text-[11px] text-[#717182]">Below: the existing Overview, unchanged.</p>
    </div>
  );
}

function Tile({ icon, label, value, sub, onClick, tone }: { icon: React.ReactNode; label: string; value: number; sub: React.ReactNode; onClick: () => void; tone?: 'red' }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()} className={`text-left bg-white border rounded-xl px-4 py-3 cursor-pointer hover:border-[#C7DAFF] ${tone === 'red' ? 'border-[#F5C2C2]' : 'border-[#E0E0E6]'}`}>
      <p className="text-[11px] font-semibold text-[#717182] flex items-center gap-1.5">{icon} {label}</p>
      <p className={`text-2xl font-semibold mt-0.5 ${tone === 'red' ? 'text-[#C62828]' : 'text-[#030213]'}`}>{value}</p>
      <p className="text-[11px] text-[#717182]">{sub}</p>
    </div>
  );
}

function Num({ n, onClick }: { n: number; onClick: () => void }) {
  return n ? <button onClick={onClick} className="text-sm font-semibold text-[#4D8EF7] hover:underline">{n}</button> : <span className="text-sm text-[#A0A0B0]">0</span>;
}
