import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckSquare, Hand, PauseCircle, PlayCircle, Truck, Undo2, SkipForward, PackageCheck, QrCode } from 'lucide-react';
import Modal from '../../src/app/components/Modal';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import { invoiceServiceLine } from '../lab-billing/billingStore';
import { btn, btnPrimary, Field, input } from '../lab-billing/ui';
import {
  type Line, STAFF, ackNotes, doneNext, holdLine, markDelivered, markInvoiced, markShipped, needsAck, pickUp,
  releaseHold, routeOf, sendBack, skipStage, unreadFor, useWorkflow, acceptCase,
} from './workflowStore';
import { checkbox } from './ui';

export { LinePill } from './ui';

// ── V2 workflow: shared pieces ────────────────────────────────────────────────

/** Who "me" is: the signed-in lab member, unless the demo is viewing as someone else. */
export function useMe(): string {
  const s = useWorkflow();
  const { user } = useAuth();
  return s.viewAs || teamMemberFor(user?.email)?.name || 'Sajid Mahmood';
}

export const caseUrl = (caseId: string) => `/growth/cases/${encodeURIComponent(caseId)}?sf=workflow`;
export const benchUrl = (lineId: string) => `/growth/bench/${encodeURIComponent(lineId)}`;

/** Delivered → the line's own invoice (one per service line). */
export function deliver(lineIds: string[], by: string) {
  const done = markDelivered(lineIds, by);
  const out: string[] = [];
  for (const d of done) {
    const inv = invoiceServiceLine(d.caseId, d.siId);
    markInvoiced(d.lineId, inv?.number ?? null);
    out.push(inv?.number ?? 'a draft invoice');
  }
  return out;
}

/** The one-tap actions for a line, depending on where it is and who is looking. */
export function LineActions({ l, me, size = 'sm', onAck }: { l: Line; me: string; size?: 'sm' | 'lg'; onAck?: () => void }) {
  const s = useWorkflow();
  const { toast } = useToast();
  const [modal, setModal] = useState<null | 'hold' | 'back' | 'ack'>(null);
  const big = size === 'lg' ? '!px-4 !py-3 !text-sm !rounded-xl' : '';
  const route = routeOf(s, l);
  const next = route.stages[l.stage + 1];
  const ack = needsAck(s, l) && l.owner === me;
  const mine = l.owner === me;
  const b = (cls: string) => `${cls} ${big}`;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${size === 'lg' ? 'gap-2' : ''}`} onClick={e => e.stopPropagation()}>
      {(l.status === 'received' || l.status === 'under-review') && <button className={b(btnPrimary)} onClick={() => { const n = acceptCase(l.caseId, me); toast.success(`Accepted: ${n} line${n === 1 ? '' : 's'} in production. Practice notified`); }}><PlayCircle className="w-3.5 h-3.5" /> Accept</button>}
      {l.hold && <button className={b(btnPrimary)} onClick={() => { releaseHold(l.id, me); toast.success('Hold released'); }}><PlayCircle className="w-3.5 h-3.5" /> Release</button>}
      {l.status === 'in-queue' && <button className={b(btnPrimary)} onClick={() => { pickUp(l.id, me); toast.success(`Picked up: ${l.service}`); }}><Hand className="w-3.5 h-3.5" /> Pick up</button>}
      {(l.status === 'in-production' || (l.status === 'qc' && !l.qcPassed)) && !mine && l.owner && <button className={b(btn)} onClick={() => { if (window.confirm(`${l.owner} has this line. Take it over? It's logged on the case.`)) { pickUp(l.id, me); toast.success('Taken over'); } }}><Hand className="w-3.5 h-3.5" /> Take over</button>}
      {(l.status === 'qc' && !l.qcPassed && !l.owner) && <button className={b(btn)} onClick={() => pickUp(l.id, me)}><Hand className="w-3.5 h-3.5" /> Pick up</button>}
      {ack && <button className={b(btnPrimary)} onClick={() => (onAck ? onAck() : setModal('ack'))}><CheckSquare className="w-3.5 h-3.5" /> Read notes ({unreadFor(s, l, me).length})</button>}
      {!ack && mine && (l.status === 'in-production' || (l.status === 'qc' && !l.qcPassed)) && (
        <button className={b(btnPrimary)} onClick={() => { doneNext([l.id], me); toast.success(l.status === 'qc' ? 'Passed QC: ready to ship' : `Done → ${next?.name}`); }}>
          {l.status === 'qc' ? <><PackageCheck className="w-3.5 h-3.5" /> Passed QC</> : <>Done <ArrowRight className="w-3.5 h-3.5" /> {next?.name}</>}
        </button>
      )}
      {l.status === 'qc' && l.qcPassed && <button className={b(btnPrimary)} onClick={() => { markShipped([l.id], me); toast.success('Shipped: practice notified'); }}><Truck className="w-3.5 h-3.5" /> Ship</button>}
      {l.status === 'shipped' && <button className={b(btn)} title="Demo: the clinic marks it received" onClick={() => { const inv = deliver([l.id], 'Clinic'); toast.success(`Delivered: ${inv[0] ?? 'invoice'} raised`); }}><PackageCheck className="w-3.5 h-3.5" /> Demo: received</button>}
      {['in-queue', 'in-production', 'qc', 'received', 'under-review'].includes(l.status) && !l.hold && !l.qcPassed && <button className={b(btn)} onClick={() => setModal('hold')}><PauseCircle className="w-3.5 h-3.5" /> Hold</button>}
      {mine && l.status === 'in-production' && !ack && !route.stages[l.stage].qc && <button className={b(btn)} title={`Skip ${route.stages[l.stage].name} (not needed here)`} onClick={() => { skipStage(l.id, me); toast.success(`Skipped ${route.stages[l.stage].name}`); }}><SkipForward className="w-3.5 h-3.5" /> Skip</button>}
      {(l.status === 'in-production' || l.status === 'qc') && l.stage > 0 && <button className={b(btn)} onClick={() => setModal('back')}><Undo2 className="w-3.5 h-3.5" /> Send back</button>}
      {modal === 'hold' && <HoldModal lines={[l]} me={me} onClose={() => setModal(null)} />}
      {modal === 'back' && <SendBackModal l={l} me={me} onClose={() => setModal(null)} />}
      {modal === 'ack' && <AckModal l={l} me={me} onClose={() => setModal(null)} />}
    </div>
  );
}

const LAB_REASONS = ['Waiting on material', 'Machine down', 'Rework', 'Other'];
export function HoldModal({ lines, me, onClose }: { lines: Line[]; me: string; onClose: () => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<'lab' | 'practice'>('lab');
  const [reason, setReason] = useState(LAB_REASONS[0]);
  const [detail, setDetail] = useState('');
  const text = kind === 'practice' ? detail.trim() : `${reason}${detail.trim() ? `: ${detail.trim()}` : ''}`;
  return (
    <Modal isOpen onClose={onClose} title={lines.length > 1 ? `Hold ${lines.length} lines` : `Hold ${lines[0].service}`} footer={
      <div className="flex justify-end gap-2"><button className={btnPrimary} disabled={!text} onClick={() => { holdLine(lines.map(l => l.id), kind, text, me); toast.success(kind === 'practice' ? 'On hold (Practice): practice notified' : 'On hold (Lab)'); onClose(); }}><PauseCircle className="w-3.5 h-3.5" /> Hold</button></div>
    }>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['lab', 'practice'] as const).map(k => (
            <button key={k} onClick={() => setKind(k)} className={`text-left rounded-xl border px-3 py-2.5 ${kind === k ? 'border-[#4D8EF7] bg-[#F5F9FF]' : 'border-[#E0E0E6]'}`}>
              <p className="text-sm font-semibold">{k === 'lab' ? 'Lab issue' : 'Waiting on dentist'}</p>
              <p className="text-[11px] text-[#717182]">{k === 'lab' ? 'On Hold (Lab). Clinic not told.' : 'On Hold (Practice). Practice notified.'}</p>
            </button>
          ))}
        </div>
        {kind === 'lab' && <Field label="Why"><div className="flex flex-wrap gap-1.5">{LAB_REASONS.map(r => <button key={r} onClick={() => setReason(r)} className={`px-2.5 py-1 rounded-full border text-xs ${reason === r ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6]'}`}>{r}</button>)}</div></Field>}
        <Field label={kind === 'lab' ? 'Detail (optional)' : 'What you need'}><input className={input} value={detail} onChange={e => setDetail(e.target.value)} placeholder={kind === 'lab' ? 'e.g. Mill 2' : 'e.g. A bite scan'} autoFocus /></Field>
      </div>
    </Modal>
  );
}

export function SendBackModal({ l, me, onClose }: { l: Line; me: string; onClose: () => void }) {
  const s = useWorkflow();
  const { toast } = useToast();
  const stages = routeOf(s, l).stages.slice(0, l.stage);
  const [to, setTo] = useState(Math.max(0, l.stage - 1));
  const [reason, setReason] = useState('');
  return (
    <Modal isOpen onClose={onClose} title={`Send ${l.service} back`} footer={
      <div className="flex justify-end gap-2"><button className={btnPrimary} disabled={!reason.trim()} onClick={() => { sendBack(l.id, to, reason, me); toast.success(`Sent back to ${stages[to]?.name} (rework)`); onClose(); }}><Undo2 className="w-3.5 h-3.5" /> Send back</button></div>
    }>
      <div className="space-y-3">
        <Field label="Back to"><div className="flex flex-wrap gap-1.5">{stages.map((x, i) => <button key={x.id} onClick={() => setTo(i)} className={`px-2.5 py-1 rounded-full border text-xs ${to === i ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6]'}`}>{x.name}</button>)}</div></Field>
        <Field label="Reason" hint="Pinned as a note to that stage."><input className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Contact too light on 25" autoFocus /></Field>
      </div>
    </Modal>
  );
}

/** Note acknowledgement: tick each unread note before the status can change. */
export function AckModal({ l, me, onClose }: { l: Line; me: string; onClose: () => void }) {
  const s = useWorkflow();
  const { toast } = useToast();
  const notes = unreadFor(s, l, me);
  const [ticked, setTicked] = useState<string[]>([]);
  return (
    <Modal isOpen onClose={onClose} title={`Notes: ${l.service}`} footer={
      <div className="flex justify-end gap-2"><button className={btnPrimary} disabled={ticked.length < notes.length} onClick={() => { ackNotes(notes.map(n => n.id), me, l.id); toast.success('Notes read'); onClose(); }}><CheckSquare className="w-3.5 h-3.5" /> I've read them</button></div>
    }>
      <ul className="space-y-2">
        {notes.map(n => (
          <li key={n.id}>
            <label className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${n.kind === 'internal' ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#C7DAFF] bg-[#F5F9FF]'}`}>
              <input type="checkbox" className={`${checkbox} mt-0.5`} checked={ticked.includes(n.id)} onChange={() => setTicked(t => t.includes(n.id) ? t.filter(x => x !== n.id) : [...t, n.id])} />
              <span className="text-sm"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#717182]">{n.kind === 'internal' ? 'Internal' : n.fromDentist ? 'From dentist · changes the Rx' : 'To dentist'}{n.stage ? ` · for ${n.stage}` : ''} · {n.by}</span>{n.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[#717182] mt-3">Required by Settings › Workflow. Each tick is logged.</p>
    </Modal>
  );
}

/** A demo stand-in for the docket's QR (no QR library in the sandbox): it opens bench mode. */
export function DocketQr({ lineId }: { lineId: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={e => { e.stopPropagation(); navigate(benchUrl(lineId)); }} title="Docket QR (demo): open in bench mode" aria-label="Open in bench mode" className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#F0F5FF] transition-colors"><QrCode className="w-4 h-4" /></button>
  );
}

export const staffNames = STAFF.map(p => p.name);
