import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlarmClock, ArrowLeft, ArrowRight, CalendarDays, Hand, Inbox, PauseCircle, StickyNote, Wrench, X } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { fmtShort, pl } from '../lab-billing/format';
import { btn, btnPrimary, Card, Empty, td, th } from '../lab-billing/ui';
import { type Line, type WorkflowState, IN_LAB, STAFF, daysIn, doneNext, dueOf, isHidden, isOpen, isOverdue, needsAck, routeOf, setViewAs, today, addDays, unreadFor, useWorkflow } from './workflowStore';
import { caseUrl, DocketQr, HoldModal, LineActions, LinePill, useMe } from './shared';
import { Avatar, checkbox, IconTitle, Owner, PageHeader, ServiceIcon, StatTile } from './ui';

// ── V2 My queue (and the filtered line lists the dashboard opens) ────────────
// Each person opens to their queue: lines they own, and Incoming (lines
// waiting in the queue for a stage they work, or just assigned), sorted by
// due date, with the unread-note dot and overdue in red. ?filter= turns it
// into the list behind a dashboard number.

export function linesFor(s: WorkflowState, filter: string, me: string): { title: string; lines: Line[] } {
  const t = today();
  const all = Object.values(s.lines).filter(l => !isHidden(l));
  const open = all.filter(isOpen);
  const byDue = (a: Line, b: Line) => (dueOf(s, a) ?? '9999').localeCompare(dueOf(s, b) ?? '9999');
  if (filter === 'overdue') return { title: 'Overdue', lines: open.filter(l => isOverdue(s, l)).sort(byDue) };
  if (filter === 'due-soon') return { title: 'Due soon', lines: open.filter(l => { const d = dueOf(s, l); return !!d && d >= t && d <= addDays(t, 1); }).sort(byDue) };
  if (filter === 'to-accept') return { title: 'To accept', lines: all.filter(l => l.status === 'received' || l.status === 'under-review').sort(byDue) };
  if (filter === 'hold-practice') return { title: 'On hold: practice', lines: all.filter(l => l.status === 'on-hold-practice') };
  if (filter === 'hold-lab') return { title: 'On hold: lab', lines: all.filter(l => l.status === 'on-hold-lab') };
  if (filter === 'unassigned') return { title: 'Unassigned', lines: open.filter(l => l.status === 'in-queue' || (l.status === 'qc' && !l.owner && !l.qcPassed)).sort(byDue) };
  if (filter === 'ready-to-ship') return { title: 'Ready to ship', lines: all.filter(l => l.status === 'qc' && l.qcPassed) };
  if (filter === 'hidden') return { title: 'Not approved & cancelled', lines: Object.values(s.lines).filter(isHidden) };
  if (filter.startsWith('day:')) { const d = filter.slice(4); return { title: `Due ${fmtShort(d)}`, lines: open.filter(l => dueOf(s, l) === d).sort(byDue) }; }
  if (filter.startsWith('stage:')) {
    const [, name, kind] = filter.split(':');
    return { title: `${name}: ${kind === 'queue' ? 'In Queue' : 'In Production'}`, lines: open.filter(l => IN_LAB.includes(l.status) && routeOf(s, l).stages[l.stage]?.name === name && (kind === 'queue' ? l.status === 'in-queue' || (l.status === 'qc' && !l.owner) : l.status !== 'in-queue' && !!l.owner)).sort(byDue) };
  }
  return { title: 'Lines', lines: open.filter(l => l.owner === me).sort(byDue) };
}

export default function QueuePage() {
  const s = useWorkflow();
  const me = useMe();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const filter = params.get('filter');
  const [ticked, setTicked] = useState<string[]>([]);
  const [hold, setHold] = useState(false);
  const person = STAFF.find(p => p.name === me);

  const { mine, incoming, waiting, toAccept } = useMemo(() => {
    const open = Object.values(s.lines).filter(isOpen);
    const byDue = (a: Line, b: Line) => (dueOf(s, a) ?? '9999').localeCompare(dueOf(s, b) ?? '9999');
    // Stages this person works by default: their team's incoming lines.
    const myStages = new Set(s.routes.flatMap(r => r.stages.filter(x => x.assign.mode === 'person' && x.assign.person === me).map(x => `${r.key}:${x.id}`)));
    const mine = open.filter(l => l.owner === me && (l.status === 'in-production' || l.status === 'qc')).sort(byDue);
    // The intake owner's new work: lines to check and accept.
    const toAccept = open.filter(l => l.owner === me && (l.status === 'received' || l.status === 'under-review')).sort(byDue);
    const incoming = open.filter(l => !l.owner && (l.status === 'in-queue' || (l.status === 'qc' && !l.qcPassed)) && (myStages.has(`${l.route}:${routeOf(s, l).stages[l.stage]?.id}`) || routeOf(s, l).stages[l.stage]?.assign.mode === 'anyone')).sort(byDue);
    const waiting = open.filter(l => l.owner === me && l.hold);
    return { mine, incoming, waiting, toAccept };
  }, [s, me]);

  if (filter) {
    const { title, lines } = linesFor(s, filter, me);
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
        <PageHeader title={title} count={lines.length} sub="Service lines, not cases." />
        <Card pad={false}><LineTable s={s} lines={lines} me={me} ticked={ticked} setTicked={setTicked} showOwner /></Card>
      </div>
    );
  }

  const selected = [...mine, ...incoming].filter(l => ticked.includes(l.id));
  const overdue = [...mine, ...toAccept].filter(l => isOverdue(s, l)).length;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        title="My queue"
        count={mine.length + toAccept.length}
        sub={person ? `${person.role} · ${person.team}` : 'Your lines, by due date'}
        actions={<>
          <label className="inline-flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-lg border border-[#E0E0E6] bg-white text-xs text-[#717182]" title="Demo: see the queue as someone else">
            <Avatar name={me} />
            <select value={me} onChange={e => setViewAs(e.target.value)} className="bg-transparent text-xs font-semibold text-[#030213] focus:outline-none pr-1">{STAFF.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
          </label>
          <button className={btn} onClick={() => navigate('/growth/calendar')}><CalendarDays className="w-3.5 h-3.5" /> Calendar</button>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={AlarmClock} tint="bg-[#FFEBEE] text-[#C62828]" label="Overdue" value={overdue} sub="In your hands" alert={overdue > 0} />
        <StatTile icon={Inbox} tint="bg-[#EEF4FF] text-[#4D8EF7]" label="To accept" value={toAccept.length} sub="New cases" />
        <StatTile icon={Wrench} tint="bg-[#F5F3FF] text-[#7C3AED]" label="Working on" value={mine.length} sub={waiting.length ? `${waiting.length} on hold` : 'Yours now'} />
        <StatTile icon={Hand} tint="bg-[#E0F7FA] text-[#00838F]" label="Incoming" value={incoming.length} sub="Ready to pick up" />
      </div>

      {ticked.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 bg-[#030213] text-white rounded-xl px-4 py-2.5 shadow-lg">
          <span className="text-xs font-semibold mr-2">{ticked.length} selected</span>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#030213]" onClick={() => { const ids = selected.filter(l => l.owner === me).map(l => l.id); const n = doneNext(ids, me); toast.success(n ? `${pl(n, 'line')} moved on` : 'Read their notes first'); setTicked([]); }}>Done <ArrowRight className="w-3.5 h-3.5" /> next stage</button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/30" onClick={() => setHold(true)}><PauseCircle className="w-3.5 h-3.5" /> Hold</button>
          <button className="ml-auto p-1 text-white/70 hover:text-white" aria-label="Clear selection" onClick={() => setTicked([])}><X className="w-4 h-4" /></button>
        </div>
      )}

      {toAccept.length > 0 && (
        <Card title={<IconTitle icon={Inbox} tint="text-[#4D8EF7]">To accept · {toAccept.length}</IconTitle>} sub="Check the Rx, then accept. Every line enters its first stage." pad={false}>
          <LineTable s={s} lines={toAccept} me={me} ticked={ticked} setTicked={setTicked} />
        </Card>
      )}
      <Card title={<IconTitle icon={Wrench} tint="text-[#7C3AED]">Working on · {mine.length}</IconTitle>} sub="Done hands the line to the next stage and its owner." pad={false}>
        {mine.length ? <LineTable s={s} lines={mine} me={me} ticked={ticked} setTicked={setTicked} /> : <Empty>Nothing in your hands. Pick one up from Incoming.</Empty>}
      </Card>
      <Card title={<IconTitle icon={Hand} tint="text-[#00838F]">Incoming · {incoming.length}</IconTitle>} sub="Waiting at a stage you work, or open to anyone." pad={false}>
        {incoming.length ? <LineTable s={s} lines={incoming} me={me} ticked={ticked} setTicked={setTicked} showOwner /> : <Empty>Nothing waiting for you.</Empty>}
      </Card>
      {waiting.length > 0 && (
        <Card title={<IconTitle icon={PauseCircle} tint="text-[#B45309]">On hold · {waiting.length}</IconTitle>} pad={false}>
          <LineTable s={s} lines={waiting} me={me} ticked={ticked} setTicked={setTicked} />
        </Card>
      )}
      {hold && <HoldModal lines={selected} me={me} onClose={() => { setHold(false); setTicked([]); }} />}
    </div>
  );
}

export function LineTable({ s, lines, me, ticked, setTicked, showOwner }: { s: WorkflowState; lines: Line[]; me: string; ticked: string[]; setTicked: (f: (t: string[]) => string[]) => void; showOwner?: boolean }) {
  const navigate = useNavigate();
  if (!lines.length) return <Empty>No service lines here.</Empty>;
  return (
    <div className="overflow-x-auto bg-white rounded-b-xl">
      <table className="w-full min-w-[900px]">
        <thead><tr><th className={`${th} w-8`} /><th className={th}>Service</th><th className={th}>Due</th><th className={th}>Practice</th><th className={th}>Status</th>{showOwner && <th className={th}>Owner</th>}<th className={th}>In stage</th><th className={th} /></tr></thead>
        <tbody>
          {lines.map(l => {
            const due = dueOf(s, l);
            const od = isOverdue(s, l);
            const unread = unreadFor(s, l, l.owner ?? me).length;
            return (
              <tr key={l.id} className="hover:bg-[#FAFAFD] cursor-pointer" onClick={() => navigate(caseUrl(l.caseId))}>
                <td className={`${td} align-middle`} onClick={e => e.stopPropagation()}><input type="checkbox" className={checkbox} aria-label={`Select ${l.service}`} checked={ticked.includes(l.id)} onChange={() => setTicked(t => t.includes(l.id) ? t.filter(x => x !== l.id) : [...t, l.id])} /></td>
                <td className={td}>
                  <div className="flex items-start gap-2.5">
                    <ServiceIcon service={l.service} />
                    <div className="min-w-0">
                      <p className="font-semibold inline-flex items-center gap-1.5">{l.service}{unread > 0 && <span className="w-2 h-2 rounded-full bg-[#E53935]" title={`${pl(unread, 'unread note')}`} />}</p>
                      <p className="text-[#717182]"><span className="font-mono">{l.caseId}</span> · {l.patient}</p>
                      {needsAck(s, l) && <p className="text-[10px] text-[#B45309] font-semibold inline-flex items-center gap-1"><StickyNote className="w-3 h-3" /> Read notes first</p>}
                    </div>
                  </div>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {due ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold ${od ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-[#F3F3F7] text-[#030213]'}`}>{fmtShort(due)}</span> : <span className="text-[#A0A0B0]">No date</span>}
                  {od && <span className="block text-[10px] text-[#C62828] font-semibold mt-0.5">Overdue</span>}
                </td>
                <td className={td}>{l.practice}<span className="block text-[#717182]">{l.dentist}</span></td>
                <td className={td}><LinePill s={s} l={l} />{l.hold && <span className="block text-[10px] text-[#717182] mt-0.5">{l.hold.reason}</span>}{l.reworks > 0 && <span className="block text-[10px] text-[#B45309]">Rework ×{l.reworks}</span>}</td>
                {showOwner && <td className={td}><Owner name={l.owner} /></td>}
                <td className={`${td} whitespace-nowrap text-[#717182]`}>{pl(daysIn(l), 'day')}</td>
                <td className={`${td} text-right`}><div className="flex items-center justify-end gap-1"><LineActions l={l} me={me} /><DocketQr lineId={l.id} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { btnPrimary };
