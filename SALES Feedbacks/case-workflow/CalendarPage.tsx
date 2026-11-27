import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, GripVertical, Layers } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { addDays, fmtShort, parse, iso } from '../lab-billing/format';
import { btn, Pill } from '../lab-billing/ui';
import { type Line, type WorkflowState, STAFF, STATUS, caseLines, isHidden, isOpen, isOverdue, reassign, routeOf, setRequested, stageOf, today, unreadFor, useWorkflow } from './workflowStore';
import { caseUrl, LineActions, LinePill, useMe } from './shared';

// ── V2 Delivery calendar ─────────────────────────────────────────────────────
// One card per service on the date it's due back to the practice. A case with
// three services can show three cards on three dates; those cards carry a
// violet edge and "1 of 3 services" so they read as one case, and hovering one
// lights up the others. Drag a card to another day (or to No date set) to move
// that service's delivery date: the case page follows and the change is
// recorded on the case timeline. Columns: No date set | Mon–Fri |
// Shipped/Delivered (newest first, can be hidden). Overdue services roll
// forward to today with a badge; Not Approved / Cancelled sit behind a banner.

const monday = (d: string) => { const x = parse(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return iso(x); };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DONE_KEY = 'salesFeedbacks.calendar.showDone';
const VIA = 'on the delivery calendar';
const dayName = (d: string) => parse(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const finishedOn = (l: Line) => l.deliveredAt ?? l.shippedAt ?? l.since;

function readShowDone() { try { return localStorage.getItem(DONE_KEY) !== '0'; } catch { return true; } }

/** Drag-and-drop state shared by the week columns and the month grid. */
interface Drag { id: string | null; over: string | null; start: (id: string) => void; enter: (day: string) => void; drop: (day: string) => void; end: () => void; can: (day: string) => boolean }

export default function CalendarPage() {
  const s = useWorkflow();
  const me = useMe();
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [showDone, setShowDoneState] = useState(readShowDone);
  const setShowDone = (v: boolean) => { setShowDoneState(v); try { localStorage.setItem(DONE_KEY, v ? '1' : '0'); } catch { /* per-visit only */ } };
  const [hoverCase, setHoverCase] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const go = (day: string) => setParams({ day, ...(mode === 'month' ? { view: 'month' } : {}) }, { replace: true });

  const all = Object.values(s.lines);
  const match = (l: Line) => (who === 'everyone' || (who === 'me' ? l.owner === me : l.owner === who))
    && (service === 'all' || l.service === service) && (practice === 'all' || l.practice === practice)
    && (status === 'all' || l.status === status);
  const shown = all.filter(l => !isHidden(l) && match(l));
  /** Where a service sits: its delivery date, today if overdue, or a fixed column. */
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
  // Shipped / delivered in the visible range, the most recent on top.
  const finished = shown.filter(l => place(l) === 'done' && finishedOn(l) >= from && finishedOn(l) <= to).sort((a, b) => finishedOn(b).localeCompare(finishedOn(a)));
  const noDate = shown.filter(l => place(l) === 'none');
  const label = mode === 'week' ? `${fmtShort(wk)} – ${fmtShort(addDays(wk, 4))}` : parse(anchor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const drag: Drag = {
    id: dragId,
    over,
    // Past days can't take a delivery; No date set always can.
    can: day => day === 'none' || day >= t,
    start: id => { setDragId(id); setOpen(null); },
    enter: day => setOver(day),
    end: () => { setDragId(null); setOver(null); },
    drop: day => {
      const l = dragId ? s.lines[dragId] : null;
      setDragId(null); setOver(null);
      if (!l || !(day === 'none' || day >= t)) return;
      const n = setRequested([l.id], day === 'none' ? null : day, me, VIA);
      if (n) toast.success(`${l.service} for ${l.patient}: ${day === 'none' ? 'delivery date cleared' : `due back ${dayName(day)}`}. Saved on the case and its timeline`);
    },
  };
  const card = (l: Line) => (
    <CalCard key={l.id} s={s} l={l} me={me} drag={drag} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)}
      lit={hoverCase === l.caseId} onHover={on => setHoverCase(on ? l.caseId : null)} place={place} />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Delivery calendar</h1>
          <p className="text-sm text-[#717182] mt-1">Every service on the day it's due back to the practice. Drag a card to another day to change its delivery date.</p>
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
        {mode === 'week' && (
          <button className={`${btn} ml-auto`} onClick={() => setShowDone(!showDone)}>
            {showDone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {showDone ? 'Hide' : 'Show'} Shipped/Delivered{!showDone && finished.length ? ` (${finished.length})` : ''}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#717182]">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-[#E0E0E6]" /> One service</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#F7F5FF] border border-[#DCD6FF] border-l-[3px] border-l-[#7C6BFF]" /> Part of a case with several services (hover to see the others)</span>
      </div>

      {hidden.length > 0 && (
        <div className="rounded-lg bg-[#F8F9FC] border border-[#E0E0E6] px-3 py-2 text-xs text-[#5A5568] flex items-center gap-2">
          {hidden.filter(l => l.status === 'not-approved').length} not approved · {hidden.filter(l => l.status === 'cancelled').length} cancelled {mode === 'week' ? 'this week' : 'this month'}
          <button className="font-semibold text-[#4D8EF7]" onClick={() => setShowHidden(x => !x)}>{showHidden ? 'Hide' : 'Show'}</button>
          {showHidden && <span className="text-[#717182]">{hidden.map(l => `${l.service} · ${l.patient} (${STATUS[l.status].label})`).join(' · ')}</span>}
        </div>
      )}

      {mode === 'week' ? (
        <div className="grid gap-2 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${showDone ? 7 : 6}, minmax(170px, 1fr))` }}>
          <Column day="none" drag={drag} title="No date set" sub={`${noDate.length}`} tone="gray">{noDate.map(card)}</Column>
          {days.map((d, i) => {
            const here = shown.filter(l => place(l) === d);
            return <Column key={d} day={d} drag={drag} title={`${DOW[i]} ${fmtShort(d)}`} sub={`${here.length}`} tone={d === t ? 'blue' : 'white'}>{here.map(card)}</Column>;
          })}
          {showDone && (
            <Column title="Shipped/Delivered" sub={`${finished.length}`} tone="green" note="Newest first" onHide={() => setShowDone(false)}>{finished.map(card)}</Column>
          )}
        </div>
      ) : (
        <MonthGrid s={s} anchor={anchor} lines={shown} place={place} drag={drag} onDay={d => { setMode('week'); setParams({ day: d }, { replace: true }); }} />
      )}
      <p className="text-[11px] text-[#717182]">Click a card to open it in place. Drag it to change its delivery date; past days are locked. Shipped and delivered services move to Shipped/Delivered. Weekend deliveries show on the Friday before.</p>
      {open && !shown.some(l => l.id === open) && <p className="text-[11px] text-[#717182]">The service you opened is filtered out. <button className="text-[#4D8EF7]" onClick={() => navigate(caseUrl(open.split(':')[0]))}>Open its case</button></p>}
    </div>
  );
}

function Sel({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return <label className="inline-flex items-center gap-1.5 text-[11px] text-[#717182]">{label}<select value={value} onChange={e => onChange(e.target.value)} className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs bg-white text-[#030213] max-w-[180px]">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}

function Column({ title, sub, tone, children, day, drag, note, onHide }: { title: string; sub: string; tone: 'gray' | 'blue' | 'white' | 'green'; children: React.ReactNode; day?: string; drag?: Drag; note?: string; onHide?: () => void }) {
  const bg = { gray: 'bg-[#F3F3F7]', blue: 'bg-[#EEF4FF]', white: 'bg-[#F8F9FC]', green: 'bg-[#EEF8EF]' }[tone];
  const dragging = !!drag?.id && !!day;
  const ok = dragging && drag!.can(day!);
  const hot = ok && drag!.over === day;
  return (
    <div
      className={`rounded-xl ${bg} p-2 min-h-[300px] transition-shadow ${hot ? 'ring-2 ring-[#4D8EF7] bg-[#E3EDFF]' : ok ? 'outline outline-1 outline-dashed outline-[#9DBBF5]' : ''} ${dragging && !ok ? 'opacity-50' : ''}`}
      onDragOver={day && drag ? e => { if (drag.id && drag.can(day)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (drag.over !== day) drag.enter(day); } } : undefined}
      onDrop={day && drag ? e => { e.preventDefault(); drag.drop(day); } : undefined}
    >
      <p className="text-[11px] font-semibold text-[#030213] px-1 mb-2 flex items-center justify-between gap-1">
        <span>{title}</span>
        <span className="inline-flex items-center gap-1.5 text-[#717182]">{note && <span className="font-normal">{note}</span>}{sub}{onHide && <button onClick={onHide} title="Hide this column" aria-label="Hide Shipped/Delivered" className="text-[#A0A0B0] hover:text-[#030213]"><EyeOff className="w-3 h-3" /></button>}</span>
      </p>
      <div className="space-y-1.5">{children}</div>
      {hot && <p className="mt-1.5 rounded-lg border-2 border-dashed border-[#4D8EF7] py-2 text-center text-[10px] font-semibold text-[#1565C0]">{day === 'none' ? 'Clear the date' : `Due back ${dayName(day!)}`}</p>}
    </div>
  );
}

function CalCard({ s, l, me, open, onToggle, drag, lit, onHover, place }: { s: WorkflowState; l: Line; me: string; open: boolean; onToggle: () => void; drag: Drag; lit: boolean; onHover: (on: boolean) => void; place: (l: Line) => string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const unread = unreadFor(s, l, l.owner ?? me).length;
  const od = isOverdue(s, l);
  const stg = stageOf(s, l);
  const movable = isOpen(l);
  const siblings = caseLines(s, l.caseId).filter(x => !isHidden(x));
  const multi = siblings.length > 1;
  const idx = siblings.findIndex(x => x.id === l.id) + 1;
  const others = siblings.filter(x => x.id !== l.id);
  const finished = !isOpen(l);
  const where = (x: Line) => { const p = place(x); return p === 'done' ? STATUS[x.status].label : p === 'none' ? 'no date' : fmtShort(p); };
  const frame = multi
    ? `bg-[#F7F5FF] border border-[#DCD6FF] border-l-[3px] border-l-[#7C6BFF] ${lit ? 'ring-2 ring-[#B9AEFF]' : ''}`
    : `bg-white border ${od ? 'border-[#F5C2C2]' : 'border-[#E0E0E6]'}`;
  return (
    <div
      draggable={movable}
      onDragStart={movable ? e => { e.dataTransfer.setData('text/plain', l.id); e.dataTransfer.effectAllowed = 'move'; drag.start(l.id); } : undefined}
      onDragEnd={drag.end}
      onMouseEnter={multi ? () => onHover(true) : undefined}
      onMouseLeave={multi ? () => onHover(false) : undefined}
      className={`group relative rounded-lg ${frame} px-2.5 py-2 text-xs ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:border-[#C7DAFF] ${drag.id === l.id ? 'opacity-40' : ''}`}
      onClick={onToggle}
      title={movable ? 'Drag to another day to change the delivery date' : undefined}
    >
      {movable && <GripVertical className="absolute top-2 right-1 w-3 h-3 text-[#C0C0CC] opacity-0 group-hover:opacity-100" />}
      {multi && (
        <p className="flex items-center gap-1 text-[10px] font-semibold text-[#6B5BEF] mb-0.5 pr-3">
          <Layers className="w-3 h-3 flex-shrink-0" /> <span className="flex-shrink-0">{idx} of {siblings.length} services</span><span className="truncate font-normal text-[#9A90E8]">· {l.caseId}</span>
        </p>
      )}
      <p className="font-semibold text-[#030213] flex items-center gap-1.5">
        {unread > 0 && <span className="w-2 h-2 rounded-full bg-[#E53935] flex-shrink-0" title="Unread notes" />}
        <span className="truncate">{l.service}</span>{od && <Pill tone="red">Overdue</Pill>}
      </p>
      <p className="text-[#717182] truncate">{l.patient} · {l.practice.replace(/^Smile Genius /, '')}</p>
      {finished
        ? <p className="text-[#2E7D32] truncate">{STATUS[l.status].label} {fmtShort(finishedOn(l))}</p>
        : <p className="text-[#5A5568] truncate">{l.owner ?? 'Team queue'}{stg ? ` · ${stg.name}` : l.status === 'qc' ? ' · QC' : ''}</p>}
      {multi && (
        <div className="mt-1.5 pt-1.5 border-t border-[#E6E1FF] space-y-0.5">
          {others.map(x => <p key={x.id} className="flex justify-between gap-2 text-[10px] text-[#5A5568]"><span className="truncate">{x.service}</span><span className="text-[#6B5BEF] flex-shrink-0">{where(x)}</span></p>)}
          <button className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B5BEF] hover:underline mt-0.5" onClick={e => { e.stopPropagation(); navigate(caseUrl(l.caseId)); }}><ExternalLink className="w-3 h-3" /> Open full case</button>
        </div>
      )}
      {open && (
        <div className="mt-2 pt-2 border-t border-[#F0EFF6] space-y-1.5 cursor-default" onClick={e => e.stopPropagation()}>
          <p>{l.dentist} · {l.caseId}</p>
          <LinePill s={s} l={l} />
          {movable && <label className="flex items-center gap-1.5 text-[11px] text-[#717182]">Due back <input type="date" className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px]" value={l.requested ?? ''} onChange={e => { if (setRequested([l.id], e.target.value || null, me, VIA)) toast.success(e.target.value ? 'Delivery date saved on the case' : 'Moved to No date set'); }} /></label>}
          {(l.status === 'in-queue' || l.status === 'in-production' || l.status === 'qc') && (
            <label className="flex items-center gap-1.5 text-[11px] text-[#717182]">Assigned <select className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px]" value={l.owner ?? ''} onChange={e => { reassign(l.id, e.target.value || null, me); toast.success('Reassigned'); }}><option value="">Team queue</option>{STAFF.map(p => <option key={p.name}>{p.name}</option>)}</select></label>
          )}
          {unread > 0 && <p className="text-[11px] text-[#C62828]">{unread} unread note{unread === 1 ? '' : 's'}</p>}
          <p className="text-[10px] text-[#717182]">Route: {routeOf(s, l).name}</p>
          <LineActions l={l} me={me} />
          {!multi && <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7]" onClick={() => navigate(caseUrl(l.caseId))}><ExternalLink className="w-3 h-3" /> Open case</button>}
        </div>
      )}
    </div>
  );
}

function MonthGrid({ s, anchor, lines, place, onDay, drag }: { s: WorkflowState; anchor: string; lines: Line[]; place: (l: Line) => string; onDay: (d: string) => void; drag: Drag }) {
  const first = `${anchor.slice(0, 7)}-01`;
  const start = monday(first);
  const t = today();
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 5 }, (__, d) => addDays(start, w * 7 + d))).filter(wk => wk.some(d => d.slice(0, 7) === anchor.slice(0, 7)));
  const multi = (l: Line) => caseLines(s, l.caseId).filter(x => !isHidden(x)).length > 1;
  return (
    <div className="rounded-xl border border-[#E0E0E6] bg-white overflow-hidden">
      <div className="grid grid-cols-5 bg-[#F8F9FC] text-[10px] font-semibold uppercase tracking-wide text-[#717182]">{DOW.map(d => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
      {weeks.map((wk, i) => (
        <div key={i} className="grid grid-cols-5 border-t border-[#F0EFF6]">
          {wk.map(d => {
            const here = lines.filter(l => place(l) === d);
            const ok = !!drag.id && drag.can(d);
            return (
              <div key={d} role="button" tabIndex={0} onClick={() => onDay(d)} onKeyDown={e => { if (e.key === 'Enter') onDay(d); }}
                onDragOver={e => { if (ok) { e.preventDefault(); if (drag.over !== d) drag.enter(d); } }}
                onDrop={e => { e.preventDefault(); drag.drop(d); }}
                className={`text-left px-2 py-1.5 min-h-[84px] border-r border-[#F0EFF6] cursor-pointer hover:bg-[#F5F9FF] ${d.slice(0, 7) !== anchor.slice(0, 7) ? 'opacity-40' : ''} ${d === t ? 'bg-[#EEF4FF]' : ''} ${ok && drag.over === d ? 'ring-2 ring-inset ring-[#4D8EF7] bg-[#E3EDFF]' : ''} ${drag.id && !ok ? 'opacity-40' : ''}`}>
                <p className="text-[11px] font-semibold">{parse(d).getDate()}</p>
                {here.slice(0, 3).map(l => (
                  <p key={l.id} draggable onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', l.id); drag.start(l.id); }} onDragEnd={drag.end}
                    className={`text-[10px] truncate cursor-grab rounded px-1 -mx-1 hover:bg-white ${multi(l) ? 'text-[#6B5BEF] border-l-2 border-[#7C6BFF] pl-1' : 'text-[#5A5568]'}`} title="Drag to another day">
                    {l.service} · {l.practice.replace(/^Smile Genius /, '')}
                  </p>
                ))}
                {here.length > 3 && <p className="text-[10px] text-[#4D8EF7] font-semibold">+{here.length - 3} more</p>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
