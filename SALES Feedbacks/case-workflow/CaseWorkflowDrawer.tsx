import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, GitBranch, MessageSquare, StickyNote, X } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { fmtShort, pl } from '../lab-billing/format';
import { btn, btnPrimary, input, Pill } from '../lab-billing/ui';
import { type Line, STATUS, ackNotes, addNote, caseLines, doneNext, dueOf, isOverdue, routeOf, unreadFor, useWorkflow } from './workflowStore';
import { DocketQr, LineActions, LinePill, useMe } from './shared';

// ── V2: the case's workflow, in a drawer on the case page ────────────────────
// Service lines with their own status, stage route and owner, the one-tap
// actions, notes (internal vs dentist-visible, pinned to a stage, ticked as
// read) and the case timeline (every handoff, ack, block and note).

export default function CaseWorkflowDrawer({ caseId }: { caseId: string }) {
  const s = useWorkflow();
  const me = useMe();
  const { toast } = useToast();
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('sf') === 'workflow');
  const [ticked, setTicked] = useState<string[]>([]);
  const [tab, setTab] = useState<'lines' | 'notes' | 'timeline'>('lines');
  const lines = caseLines(s, caseId);
  if (!lines.length) return null;
  const unread = lines.reduce((n, l) => n + unreadFor(s, l, me).length, 0);
  const caseUnread = s.notes.filter(n => n.caseId === caseId && n.by !== me && !n.readBy.includes(me));

  if (!open) {
    return createPortal(
      <button onClick={() => setOpen(true)} className="fixed right-0 top-1/3 z-40 flex flex-col items-center gap-1 px-2 py-3 rounded-l-xl bg-[#030213] text-white shadow-lg" title="Open the case workflow">
        <GitBranch className="w-4 h-4" />
        <span className="text-[10px] font-semibold [writing-mode:vertical-rl] rotate-180">Workflow · {pl(lines.length, 'line')}</span>
        {unread > 0 && <span className="w-2 h-2 rounded-full bg-[#E53935]" />}
      </button>,
      document.body,
    );
  }
  const first = lines[0];
  return createPortal(
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-white shadow-2xl border-l border-[#E0E0E6] flex flex-col">
      <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717182]">Case workflow</p>
          <h2 className="text-lg font-semibold text-[#030213]">{first.patient} <span className="font-mono text-sm text-[#717182]">{caseId}</span></h2>
          <p className="text-xs text-[#717182]">{first.practice} · {first.dentist} · {pl(lines.length, 'service line')}, each with its own status. The clinic sees {STATUS[first.status].clinic}.</p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close"><X className="w-5 h-5 text-[#717182]" /></button>
      </div>
      <nav className="flex gap-1 px-5 border-b border-[#F0EFF6]">
        {([['lines', 'Service lines'], ['notes', `Notes${caseUnread.length ? ` (${caseUnread.length} unread)` : ''}`], ['timeline', 'Timeline']] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-2.5 text-xs font-semibold border-b-2 ${tab === id ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182]'}`}>{label}</button>)}
      </nav>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {tab === 'lines' && (
          <>
            {lines.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button className="text-[#4D8EF7] font-semibold" onClick={() => setTicked(ticked.length === lines.length ? [] : lines.map(l => l.id))}>{ticked.length === lines.length ? 'Clear' : 'Select all'}</button>
                {ticked.length > 0 && <button className={btnPrimary} onClick={() => { const n = doneNext(ticked, me); toast.success(n ? `${pl(n, 'line')} pushed on${n < ticked.length ? `; ${ticked.length - n} need their notes read or aren't yours` : ''}` : 'Nothing moved: read the notes first, or pick them up'); setTicked([]); }}>Done <ArrowRight className="w-3.5 h-3.5" /> next stage ({ticked.length})</button>}
              </div>
            )}
            {lines.map(l => <LineCard key={l.id} l={l} me={me} ticked={ticked.includes(l.id)} onTick={() => setTicked(t => t.includes(l.id) ? t.filter(x => x !== l.id) : [...t, l.id])} multi={lines.length > 1} />)}
            <p className="text-[11px] text-[#717182]">Lines move independently. The case ships when every line passes Quality Control{s.settings.shipPartial ? ', or one at a time (partial shipping is on)' : ''}. Each line is invoiced on its own when the clinic marks it received.</p>
          </>
        )}
        {tab === 'notes' && <Notes caseId={caseId} lines={lines} me={me} />}
        {tab === 'timeline' && (
          <ol className="space-y-2">
            {s.events.filter(e => e.caseId === caseId).map(e => (
              <li key={e.id} className="text-xs flex gap-3"><span className="w-24 flex-shrink-0 text-[#A0A0B0]">{fmtShort(e.at.slice(0, 10))} {e.at.slice(11, 16)}</span><span><b>{e.by}</b> · {e.text}</span></li>
            ))}
            {!s.events.some(e => e.caseId === caseId) && <p className="text-xs text-[#A0A0B0]">Nothing yet.</p>}
          </ol>
        )}
      </div>
    </div>
  , document.body);
}

function LineCard({ l, me, ticked, onTick, multi }: { l: Line; me: string; ticked: boolean; onTick: () => void; multi: boolean }) {
  const s = useWorkflow();
  const route = routeOf(s, l);
  const due = dueOf(s, l);
  const inLab = ['in-queue', 'in-production', 'qc', 'on-hold-lab'].includes(l.status);
  const after = ['shipped', 'delivered'].includes(l.status);
  return (
    <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        {multi && <input type="checkbox" className="mt-1" checked={ticked} onChange={onTick} aria-label={`Select ${l.service}`} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#030213]">{l.service}</p>
          <p className="text-xs text-[#717182]">{l.owner ? `With ${l.owner}` : inLab ? 'In the team queue' : ''}{due ? ` · due ${fmtShort(due)}` : ' · no delivery date'}{isOverdue(s, l) && <span className="text-[#C62828] font-semibold"> · overdue</span>}{l.reworks ? ` · rework ×${l.reworks}` : ''}</p>
        </div>
        <LinePill s={s} l={l} />
      </div>
      {l.hold && <p className="text-xs rounded-lg bg-[#FFF8E1] text-[#92400E] px-2.5 py-1.5">{STATUS[l.status].label}: {l.hold.reason} (since {fmtShort(l.hold.since)})</p>}
      <ol className="flex flex-wrap items-center gap-1">
        {route.stages.map((x, i) => {
          const done = after || (inLab && i < l.stage) || (l.qcPassed && i <= l.stage);
          const cur = inLab && i === l.stage && !l.qcPassed;
          const skipped = l.skipped.includes(x.id);
          return (
            <li key={x.id} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${skipped ? 'border-dashed border-[#D0D0DA] text-[#A0A0B0] line-through' : cur ? 'border-[#7C3AED] bg-[#F5F3FF] text-[#7C3AED]' : done ? 'border-[#C8E6C9] bg-[#F1F8F1] text-[#2E7D32]' : 'border-[#E0E0E6] text-[#717182]'}`}>{done && !skipped && <Check className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />}{x.name}</span>
              {i < route.stages.length - 1 && <span className="text-[#D0D0DA]">›</span>}
            </li>
          );
        })}
        <span className="text-[#D0D0DA]">›</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${after ? 'border-[#C8E6C9] bg-[#F1F8F1] text-[#2E7D32]' : 'border-[#E0E0E6] text-[#717182]'}`}>Shipped</span>
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LineActions l={l} me={me} />
        <span className="flex items-center gap-3">{l.invoiced && <Pill tone="green">Invoiced</Pill>}<DocketQr lineId={l.id} /></span>
      </div>
    </div>
  );
}

function Notes({ caseId, lines, me }: { caseId: string; lines: Line[]; me: string }) {
  const s = useWorkflow();
  const { toast } = useToast();
  const [kind, setKind] = useState<'internal' | 'dentist'>('internal');
  const [text, setText] = useState('');
  const [line, setLine] = useState('');
  const [stage, setStage] = useState('');
  const stages = [...new Set(lines.flatMap(l => routeOf(s, l).stages.map(x => x.name)))];
  const notes = s.notes.filter(n => n.caseId === caseId);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-2">
        <div className="flex gap-1.5">
          <button onClick={() => setKind('internal')} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border ${kind === 'internal' ? 'border-[#F59E0B] bg-[#FFFBEB] text-[#92400E]' : 'border-[#E0E0E6] text-[#5A5568]'}`}><StickyNote className="w-3.5 h-3.5 inline -mt-0.5" /> Internal note</button>
          <button onClick={() => setKind('dentist')} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border ${kind === 'dentist' ? 'border-[#4D8EF7] bg-[#F5F9FF] text-[#1565C0]' : 'border-[#E0E0E6] text-[#5A5568]'}`}><MessageSquare className="w-3.5 h-3.5 inline -mt-0.5" /> Comment to the dentist</button>
        </div>
        <textarea className={input} rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={kind === 'internal' ? 'Only the lab sees this' : 'The dentist sees this'} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {lines.length > 1 && <select className="px-2 py-1 rounded-md border border-[#E0E0E6]" value={line} onChange={e => setLine(e.target.value)}><option value="">Whole case</option>{lines.map(l => <option key={l.id} value={l.id}>{l.service}</option>)}</select>}
          {kind === 'internal' && <select className="px-2 py-1 rounded-md border border-[#E0E0E6]" value={stage} onChange={e => setStage(e.target.value)}><option value="">Any stage</option>{stages.map(x => <option key={x} value={x}>For {x}</option>)}</select>}
          <button className={`${btnPrimary} ml-auto`} disabled={!text.trim()} onClick={() => { addNote(caseId, line ? [line] : [], kind, text, me, kind === 'internal' ? stage : undefined); setText(''); toast.success(kind === 'internal' ? 'Internal note added' : 'Comment sent to the dentist'); }}>Add</button>
        </div>
        {kind === 'internal' && stage && <p className="text-[11px] text-[#717182]">Pinned to {stage}: whoever has the line when it reaches {stage} sees it{s.settings.ackRequired ? ' and ticks it before starting' : ''}.</p>}
      </div>
      {notes.map(n => {
        const unread = n.by !== me && !n.readBy.includes(me);
        return (
          <div key={n.id} className={`rounded-xl border px-3 py-2.5 text-sm ${n.kind === 'internal' ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#C7DAFF] bg-[#F5F9FF]'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717182] flex items-center gap-1.5">
              {unread && <span className="w-2 h-2 rounded-full bg-[#E53935]" />}
              {n.kind === 'internal' ? 'Internal' : n.fromDentist ? 'From the dentist' : 'To the dentist'}{n.stage ? ` · for ${n.stage}` : ''}{n.lineIds.length ? ` · ${n.lineIds.map(id => s.lines[id]?.service).join(', ')}` : ' · whole case'} · {n.by} · {fmtShort(n.at.slice(0, 10))}
            </p>
            <p className="mt-0.5">{n.text}</p>
            <p className="text-[10px] text-[#717182] mt-1">{n.readBy.length ? `Read by ${n.readBy.join(', ')}` : 'Nobody has read it yet'}{unread && <> · <button className="font-semibold text-[#4D8EF7]" onClick={() => { ackNotes([n.id], me); toast.success('Marked as read'); }}>Mark read</button></>}</p>
          </div>
        );
      })}
      {!notes.length && <p className="text-xs text-[#A0A0B0]">No notes yet.</p>}
    </div>
  );
}

export { btn };
