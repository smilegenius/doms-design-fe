import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronLeft, ChevronRight, CircleDot, ExternalLink, EyeOff, Stethoscope, Users } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { addDays, fmtShort, parse, iso } from '../lab-billing/format';
import { btn, Pill, Seg } from '../lab-billing/ui';
import { type Line, type WorkflowState, STAFF, STATUS, isHidden, isOpen, isOverdue, reassign, routeOf, setRequested, stageOf, today, unreadFor, useWorkflow } from './workflowStore';
import { caseUrl, LineActions, LinePill, useMe } from './shared';
import { Avatar, PageHeader, ServiceIcon } from './ui';

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
      <PageHeader
        title="Delivery calendar"
        sub="Service lines by due date. Overdue lines sit on today."
        actions={<>
          <div className="inline-flex items-center rounded-lg border border-[#E0E0E6] bg-white">
            <button className="p-2 text-[#717182] hover:text-[#030213]" onClick={() => go(addDays(anchor, mode === 'week' ? -7 : -28))} aria-label="Previous"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-[#030213] min-w-[150px] text-center">{label}</span>
            <button className="p-2 text-[#717182] hover:text-[#030213]" onClick={() => go(addDays(anchor, mode === 'week' ? 7 : 31))} aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button className={btn} onClick={() => go(t)}>Today</button>
          <Seg value={mode} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} onChange={m => { setMode(m); setParams({ day: anchor, ...(m === 'month' ? { view: 'month' } : {}) }, { replace: true }); }} />
        </>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Sel icon={Users} value={who} onChange={setWho} options={[['everyone', 'Everyone'], ['me', `Me (${me.split(' ')[0]})`], ...STAFF.filter(p => p.name !== me).map(p => [p.name, p.name] as [string, string])]} />
        <Sel icon={Stethoscope} value={service} onChange={setService} options={[['all', 'All services'], ...services.map(x => [x, x] as [string, string])]} />
        <Sel icon={Building2} value={practice} onChange={setPractice} options={[['all', 'All practices'], ...practices.map(x => [x, x] as [string, string])]} />
        <Sel icon={CircleDot} value={status} onChange={setStatus} options={[['all', 'All statuses'], ...(['received', 'in-queue', 'in-production', 'qc', 'on-hold-lab', 'on-hold-practice', 'shipped', 'delivered'] as const).map(x => [x, STATUS[x].label] as [string, string])]} />
        {hidden.length > 0 && (
          <button className="ml-auto inline-flex items-center gap-1.5 text-xs text-[#717182] hover:text-[#030213]" onClick={() => setShowHidden(x => !x)}>
            <EyeOff className="w-3.5 h-3.5" /> {hidden.filter(l => l.status === 'not-approved').length} not approved · {hidden.filter(l => l.status === 'cancelled').length} cancelled
            <span className="font-semibold text-[#4D8EF7]">{showHidden ? 'Hide' : 'Show'}</span>
          </button>
        )}
      </div>
      {showHidden && hidden.length > 0 && <p className="rounded-lg bg-[#F8F9FC] border border-[#E0E0E6] px-3 py-2 text-xs text-[#717182]">{hidden.map(l => `${l.service} · ${l.patient} (${STATUS[l.status].label})`).join(' · ')}</p>}

      {mode === 'week' ? (
        <div className="grid gap-2 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(7, minmax(170px, 1fr))' }}>
          <Column title="No date" sub={`${noDate.length}`} tone="gray">{noDate.map(l => <CalCard key={l.id} s={s} l={l} me={me} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />)}</Column>
          {days.map((d, i) => {
            const here = lines.filter(l => place(l) === d);
            return (
              <Column key={d} title={`${DOW[i]} ${fmtShort(d)}`} sub={`${here.length}`} tone={d === t ? 'blue' : 'white'}>
                {here.map(l => <CalCard key={l.id} s={s} l={l} me={me} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />)}
              </Column>
            );
          })}
          <Column title="Done" sub={`${completed.length}`} tone="green">{completed.map(l => <CalCard key={l.id} s={s} l={l} me={me} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />)}</Column>
        </div>
      ) : (
        <MonthGrid anchor={anchor} lines={lines} place={place} onDay={d => { setMode('week'); setParams({ day: d }, { replace: true }); }} />
      )}
      <p className="text-[11px] text-[#717182]">Click a card to act on it. Shipped lines move to Done; weekend dates show on Friday.</p>
      {open && !lines.some(l => l.id === open) && <p className="text-[11px] text-[#717182]">The open line is filtered out. <button className="text-[#4D8EF7]" onClick={() => navigate(caseUrl(open.split(':')[0]))}>Open case</button></p>}
    </div>
  );
}

function Sel({ icon: Icon, value, onChange, options }: { icon: typeof Users; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const on = value !== options[0][0];
  return (
    <label className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg border bg-white text-xs ${on ? 'border-[#4D8EF7] text-[#1565C0]' : 'border-[#E0E0E6] text-[#030213]'}`}>
      <Icon className="w-3.5 h-3.5 text-[#717182]" />
      <select value={value} onChange={e => onChange(e.target.value)} className="bg-transparent font-medium focus:outline-none max-w-[170px]">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}

function Column({ title, sub, tone, children }: { title: string; sub: string; tone: 'gray' | 'blue' | 'white' | 'green'; children: React.ReactNode }) {
  const bg = { gray: 'bg-[#F3F3F7]', blue: 'bg-[#EEF4FF]', white: 'bg-[#F8F9FC]', green: 'bg-[#EEF8EF]' }[tone];
  return (
    <div className={`rounded-xl ${bg} p-2 min-h-[300px] ${tone === 'blue' ? 'ring-1 ring-[#C8D8FC]' : ''}`}>
      <p className="text-xs font-semibold text-[#030213] px-1 mb-2 flex items-center justify-between"><span className={tone === 'blue' ? 'text-[#1565C0]' : ''}>{title}</span><span className="px-1.5 rounded-full bg-white text-[10px] text-[#717182]">{sub}</span></p>
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
      <div className="flex items-start gap-2">
        <ServiceIcon service={l.service} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#030213] flex items-center gap-1.5"><span className="truncate">{l.service}</span>{unread > 0 && <span className="w-2 h-2 rounded-full bg-[#E53935] flex-shrink-0" title="Unread notes" />}</p>
          <p className="text-[#717182] truncate">{l.practice}</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1.5 min-w-0 text-[#5A5568]" title={l.owner ?? 'Team queue'}><Avatar name={l.owner} /><span className="truncate">{stg ? stg.name : l.status === 'qc' ? 'QC' : STATUS[l.status].label}</span></span>
        {od && <Pill tone="red">Overdue</Pill>}
      </div>
      {open && (
        <div className="mt-2 pt-2 border-t border-[#F0EFF6] space-y-1.5" onClick={e => e.stopPropagation()}>
          <p>{l.dentist} · patient {l.patient}</p>
          <LinePill s={s} l={l} />
          <label className="flex items-center gap-1.5 text-[11px] text-[#717182]">Due back <input type="date" className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px]" value={l.requested ?? ''} onChange={e => { setRequested([l.id], e.target.value || null, me); toast.success(e.target.value ? 'Date set' : 'Moved to No date'); }} /></label>
          {(l.status === 'in-queue' || l.status === 'in-production' || l.status === 'qc') && (
            <label className="flex items-center gap-1.5 text-[11px] text-[#717182]">Owner <select className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px]" value={l.owner ?? ''} onChange={e => { reassign(l.id, e.target.value || null, me); toast.success('Reassigned'); }}><option value="">Team queue</option>{STAFF.map(p => <option key={p.name}>{p.name}</option>)}</select></label>
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
