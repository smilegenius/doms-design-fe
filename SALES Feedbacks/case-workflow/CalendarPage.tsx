import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { addDays, fmtShort, parse, iso } from '../lab-billing/format';
import { btn, Pill } from '../lab-billing/ui';
import { type Line, type WorkflowState, STAFF, STATUS, isHidden, isOpen, isOverdue, reassign, routeOf, setRequested, stageOf, today, unreadFor, useWorkflow } from './workflowStore';
import { caseUrl, LineActions, LinePill, useMe } from './shared';

// ── V2 Delivery calendar ─────────────────────────────────────────────────────
// One card per service line on its requested delivery date. Two fixed
// columns: No date set (left) and Completed (right: shipped or delivered in
// the visible week). Overdue open lines roll forward to today's column with a
// badge. Not Approved / Cancelled are hidden behind a one-line banner.

const monday = (d: string) => { const x = parse(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return iso(x); };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function CalendarPage() {
  const s = useWorkflow();
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const t = today();
  const [mode, setMode] = useState<'week' | 'month'>(params.get('view') === 'month' ? 'month' : 'week');
  const anchor = params.get('day') ?? t;
  const [who, setWho] = useState<string>('everyone');
  const [service, setService] = useState('all');
  const [practice, setPractice] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState<string | null>(params.get('line'));
  const [showHidden, setShowHidden] = useState(false);
  const go = (day: string) => setParams({ day, ...(mode === 'month' ? { view: 'month' } : {}) }, { replace: true });

  const all = Object.values(s.lines);
  const match = (l: Line) => (who === 'everyone' || (who === 'me' ? l.owner === me : l.owner === who))
    && (service === 'all' || l.service === service) && (practice === 'all' || l.practice === practice)
    && (status === 'all' || l.status === status);
  const lines = all.filter(l => !isHidden(l) && match(l));
  /** Where a line sits: its requested date, today if overdue, or a fixed column. */
  const place = (l: Line): string => {
    if (!isOpen(l)) return 'done';
    if (!l.requested) return 'none';
    const d = isOverdue(s, l) || l.requested < t ? t : l.requested;
    // Weekend deliveries sit on the Friday before.
    const k = parse(d).getDay();
    return k === 6 ? addDays(d, -1) : k === 0 ? addDays(d, -2) : d;
  };
  const services = [...new Set(all.map(l => l.service))].sort();
  const practices = [...new Set(all.map(l => l.practice))].sort();

  const wk = monday(anchor);
  const days = DOW.map((_, i) => addDays(wk, i));
  const from = mode === 'week' ? wk : `${anchor.slice(0, 7)}-01`;
  const to = mode === 'week' ? addDays(wk, 6) : addDays(`${addDays(`${anchor.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1);
  const hidden = all.filter(l => isHidden(l) && (l.requested ?? l.since) >= from && (l.requested ?? l.since) <= to);
  const completed = lines.filter(l => place(l) === 'done' && (l.shippedAt ?? l.since) >= from && (l.shippedAt ?? l.since) <= to);
  const noDate = lines.filter(l => place(l) === 'none');
  const label = mode === 'week' ? `${fmtShort(wk)} – ${fmtShort(addDays(wk, 4))}` : parse(anchor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Delivery calendar</h1>
          <p className="text-sm text-[#717182] mt-1">Every service line on the day it's due back to the practice. Overdue ones sit on today with a badge.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => go(addDays(anchor, mode === 'week' ? -7 : -28))} aria-label="Previous"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button className={btn} onClick={() => go(t)}>Today</button>
          <button className={btn} onClick={() => go(addDays(anchor, mode === 'week' ? 7 : 31))} aria-label="Next"><ChevronRight className="w-3.5 h-3.5" /></button>
          <span className="text-sm font-semibold text-[#030213] min-w-[140px] text-center">{label}</span>
          <div className="inline-flex rounded-lg border border-[#E0E0E6] overflow-hidden">{(['week', 'month'] as const).map(m => <button key={m} onClick={() => { setMode(m); setParams({ day: anchor, ...(m === 'month' ? { view: 'month' } : {}) }, { replace: true }); }} className={`px-3 py-1.5 text-xs font-semibold ${mode === m ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-white text-[#5A5568]'}`}>{m === 'week' ? 'Week' : 'Month'}</button>)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Sel value={who} onChange={setWho} label="Assigned" options={[['everyone', 'Everyone'], ['me', `Me (${me.split(' ')[0]})`], ...STAFF.filter(p => p.name !== me).map(p => [p.name, p.name] as [string, string])]} />
        <Sel value={service} onChange={setService} label="Service" options={[['all', 'All services'], ...services.map(x => [x, x] as [string, string])]} />
        <Sel value={practice} onChange={setPractice} label="Practice" options={[['all', 'All practices'], ...practices.map(x => [x, x] as [string, string])]} />
        <Sel value={status} onChange={setStatus} label="Status" options={[['all', 'All statuses'], ...(['received', 'in-queue', 'in-production', 'qc', 'on-hold-lab', 'on-hold-practice', 'shipped', 'delivered'] as const).map(x => [x, STATUS[x].label] as [string, string])]} />
      </div>

      {hidden.length > 0 && (
        <div className="rounded-lg bg-[#F8F9FC] border border-[#E0E0E6] px-3 py-2 text-xs text-[#5A5568] flex items-center gap-2">
          {hidden.filter(l => l.status === 'not-approved').length} not approved · {hidden.filter(l => l.status === 'cancelled').length} cancelled {mode === 'week' ? 'this week' : 'this month'}
          <button className="font-semibold text-[#4D8EF7]" onClick={() => setShowHidden(x => !x)}>{showHidden ? 'Hide' : 'Show'}</button>
          {showHidden && <span className="text-[#717182]">{hidden.map(l => `${l.service} · ${l.patient} (${STATUS[l.status].label})`).join(' · ')}</span>}
        </div>
      )}

      {mode === 'week' ? (
        <div className="grid gap-2 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(7, minmax(170px, 1fr))' }}>
          <Column title="No date set" sub={`${noDate.length}`} tone="gray">{noDate.map(l => <CalCard key={l.id} s={s} l={l} me={me} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />)}</Column>
          {days.map((d, i) => {
            const here = lines.filter(l => place(l) === d);
            return (
              <Column key={d} title={`${DOW[i]} ${fmtShort(d)}`} sub={`${here.length}`} tone={d === t ? 'blue' : 'white'}>
                {here.map(l => <CalCard key={l.id} s={s} l={l} me={me} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />)}
              </Column>
            );
          })}
          <Column title="Completed" sub={`${completed.length}`} tone="green">{completed.map(l => <CalCard key={l.id} s={s} l={l} me={me} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />)}</Column>
        </div>
      ) : (
        <MonthGrid anchor={anchor} lines={lines} place={place} onDay={d => { setMode('week'); setParams({ day: d }, { replace: true }); }} />
      )}
      <p className="text-[11px] text-[#717182]">Click a card to open it in place; Open case goes to the full case. Shipped and delivered lines move to Completed. Weekend deliveries show on the Friday before.</p>
      {open && !lines.some(l => l.id === open) && <p className="text-[11px] text-[#717182]">The line you opened is filtered out. <button className="text-[#4D8EF7]" onClick={() => navigate(caseUrl(open.split(':')[0]))}>Open its case</button></p>}
    </div>
  );
}

function Sel({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return <label className="inline-flex items-center gap-1.5 text-[11px] text-[#717182]">{label}<select value={value} onChange={e => onChange(e.target.value)} className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs bg-white text-[#030213] max-w-[180px]">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}

function Column({ title, sub, tone, children }: { title: string; sub: string; tone: 'gray' | 'blue' | 'white' | 'green'; children: React.ReactNode }) {
  const bg = { gray: 'bg-[#F3F3F7]', blue: 'bg-[#EEF4FF]', white: 'bg-[#F8F9FC]', green: 'bg-[#EEF8EF]' }[tone];
  return (
    <div className={`rounded-xl ${bg} p-2 min-h-[300px]`}>
      <p className="text-[11px] font-semibold text-[#030213] px-1 mb-2 flex justify-between"><span>{title}</span><span className="text-[#717182]">{sub}</span></p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CalCard({ s, l, me, open, onToggle }: { s: WorkflowState; l: Line; me: string; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const unread = unreadFor(s, l, l.owner ?? me).length;
  const od = isOverdue(s, l);
  const stg = stageOf(s, l);
  return (
    <div className={`rounded-lg bg-white border ${od ? 'border-[#F5C2C2]' : 'border-[#E0E0E6]'} px-2.5 py-2 text-xs cursor-pointer hover:border-[#C7DAFF]`} onClick={onToggle}>
      <p className="font-semibold text-[#030213] flex items-center gap-1.5">{unread > 0 && <span className="w-2 h-2 rounded-full bg-[#E53935] flex-shrink-0" title="Unread notes" />}<span className="truncate">{l.service}</span>{od && <Pill tone="red">Overdue</Pill>}</p>
      <p className="text-[#717182] truncate">{l.practice}</p>
      <p className="text-[#5A5568] truncate">{l.owner ?? 'Team queue'}{stg ? ` · ${stg.name}` : l.status === 'qc' ? ' · QC' : ''}</p>
      {open && (
        <div className="mt-2 pt-2 border-t border-[#F0EFF6] space-y-1.5" onClick={e => e.stopPropagation()}>
          <p>{l.dentist} · patient {l.patient}</p>
          <LinePill s={s} l={l} />
          <label className="flex items-center gap-1.5 text-[11px] text-[#717182]">Due back <input type="date" className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px]" value={l.requested ?? ''} onChange={e => { setRequested([l.id], e.target.value || null, me); toast.success(e.target.value ? 'Date set' : 'Moved to No date set'); }} /></label>
          {(l.status === 'in-queue' || l.status === 'in-production' || l.status === 'qc') && (
            <label className="flex items-center gap-1.5 text-[11px] text-[#717182]">Assigned <select className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px]" value={l.owner ?? ''} onChange={e => { reassign(l.id, e.target.value || null, me); toast.success('Reassigned'); }}><option value="">Team queue</option>{STAFF.map(p => <option key={p.name}>{p.name}</option>)}</select></label>
          )}
          {unread > 0 && <p className="text-[11px] text-[#C62828]">{unread} unread note{unread === 1 ? '' : 's'}</p>}
          <p className="text-[10px] text-[#717182]">Route: {routeOf(s, l).name}</p>
          <LineActions l={l} me={me} />
          <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7]" onClick={() => navigate(caseUrl(l.caseId))}><ExternalLink className="w-3 h-3" /> Open case</button>
        </div>
      )}
    </div>
  );
}

function MonthGrid({ anchor, lines, place, onDay }: { anchor: string; lines: Line[]; place: (l: Line) => string; onDay: (d: string) => void }) {
  const first = `${anchor.slice(0, 7)}-01`;
  const start = monday(first);
  const t = today();
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 5 }, (__, d) => addDays(start, w * 7 + d))).filter(wk => wk.some(d => d.slice(0, 7) === anchor.slice(0, 7)));
  return (
    <div className="rounded-xl border border-[#E0E0E6] bg-white overflow-hidden">
      <div className="grid grid-cols-5 bg-[#F8F9FC] text-[10px] font-semibold uppercase tracking-wide text-[#717182]">{DOW.map(d => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
      {weeks.map((wk, i) => (
        <div key={i} className="grid grid-cols-5 border-t border-[#F0EFF6]">
          {wk.map(d => {
            // Weekend deliveries count on the Friday.
            const here = lines.filter(l => place(l) === d);
            return (
              <button key={d} onClick={() => onDay(d)} className={`text-left px-2 py-1.5 min-h-[84px] border-r border-[#F0EFF6] hover:bg-[#F5F9FF] ${d.slice(0, 7) !== anchor.slice(0, 7) ? 'opacity-40' : ''} ${d === t ? 'bg-[#EEF4FF]' : ''}`}>
                <p className="text-[11px] font-semibold">{parse(d).getDate()}</p>
                {here.slice(0, 3).map(l => <p key={l.id} className="text-[10px] truncate text-[#5A5568]">{l.service} · {l.practice.replace(/^Smile Genius /, '')}</p>)}
                {here.length > 3 && <p className="text-[10px] text-[#4D8EF7] font-semibold">+{here.length - 3} more</p>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
