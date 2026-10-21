import { DragEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Copy, Hourglass, Link2, PhoneCall, Search, ServerOff, Unlink, UserRound } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import type { CadOrder, DesignStatus } from '../types';
import { CAD_LABEL, COLUMNS, hoursSince, STATUS_LABEL, TECHNICIANS, waitingLabel } from '../engine';
import { assignTech, moveTo, useCad } from '../cadStore';
import { Pill, inputSm } from '../../lab-billing/ui';
import { billNow, getBilling } from '../../lab-billing/billingStore';

// ── 1. Design board ──────────────────────────────────────────────────────────
// Columns by design status. The connector and the dentist move the early
// columns; the lab drags cards through Ready → Manufacturing → Finishing →
// Dispatched, and drops a card on a technician to assign it.

const LAB_STATUS: Record<string, DesignStatus> = { ready: 'ready', manufacturing: 'manufacturing', finishing: 'finishing', dispatched: 'dispatched' };
const today = () => new Date().toISOString().slice(0, 10);

export function orderFlags(o: CadOrder) {
  const f: { tone: 'red' | 'amber' | 'blue' | 'purple'; text: string; icon: typeof AlertTriangle }[] = [];
  const r = o.rounds[o.rounds.length - 1];
  if (o.status === 'awaiting-dentist' && r && !r.decision) f.push({ tone: hoursSince(r.sentAt) >= 24 ? 'red' : 'amber', text: `Dentist ${waitingLabel(r.sentAt)}`, icon: Hourglass });
  if (o.status === 'waiting-scans') f.push({ tone: 'amber', text: 'Waiting for scans', icon: Hourglass });
  if (o.queued) f.push({ tone: 'red', text: 'Queued: connector offline', icon: ServerOff });
  if (o.duplicate) f.push({ tone: 'amber', text: 'Possible duplicate', icon: Copy });
  if (o.lines.some(l => !l.indication) && o.cad !== 'partner') f.push({ tone: 'amber', text: 'Pick the indication', icon: AlertTriangle });
  if (o.callDentist) f.push({ tone: 'red', text: 'Call the dentist', icon: PhoneCall });
  if (o.design?.diff.length) f.push({ tone: 'purple', text: 'Design differs from case', icon: AlertTriangle });
  if (o.linkedFromInbox) f.push({ tone: 'blue', text: '3Shape inbox', icon: Link2 });
  if (o.dueDate && o.dueDate < today() && !['dispatched', 'cancelled'].includes(o.status)) f.push({ tone: 'red', text: 'Overdue', icon: CalendarClock });
  return f;
}

export default function DesignBoard() {
  const s = useCad();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [cad, setCad] = useState<'all' | 'exocad' | '3shape' | 'partner'>('all');
  const [tech, setTech] = useState('all');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  useEffect(() => { const end = () => { setDragging(null); setOver(null); }; window.addEventListener('dragend', end); return () => window.removeEventListener('dragend', end); }, []);

  const orders = useMemo(() => Object.values(s.orders).filter(o =>
    (showCancelled || o.status !== 'cancelled')
    && (cad === 'all' || o.cad === cad)
    && (tech === 'all' || (tech === 'none' ? !o.technician && o.cad !== 'partner' : o.technician === tech))
    && (!onlyFlagged || orderFlags(o).some(f => f.tone === 'red' || f.tone === 'amber'))
    && (!q || `${o.caseId} ${o.patientSent} ${o.client}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9')), [s, q, cad, tech, onlyFlagged, showCancelled]);

  const drop = (col: string) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain'); setOver(null); setDragging(null);
    const o = s.orders[id]; if (!o) return;
    const target = LAB_STATUS[col];
    if (!target) { toast.error('The connector and the dentist move cards into that column. Use "Set status" on the card to override.'); return; }
    if (o.status === target) return;
    if (o.approvalNeeded && !o.rounds.some(r => r.decision === 'approved') && ['awaiting-dentist', 'in-design', 'design-received', 'order-created', 'waiting-scans'].includes(o.status)) {
      if (!window.confirm(`${o.caseId} needs the dentist's approval and hasn't got it. Move it to ${STATUS_LABEL[target]} anyway?`)) return;
    }
    moveTo(id, target);
    // Dispatch starts the invoice in Billing, as it does from the case.
    const inv = target === 'dispatched' && !getBilling().invoices.some(i => i.caseId === id && !i.stage && i.status !== 'void') ? billNow(id) : null;
    toast.success(`${o.caseId} → ${STATUS_LABEL[target]}${inv ? `; invoice ${inv.number ?? 'draft'} started in Billing` : ''}`);
  };
  const dropOnTech = (t: string) => (e: DragEvent) => {
    e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); setDragging(null);
    if (!s.orders[id]) return;
    assignTech(id, t); toast.success(`${id} assigned to ${t}`);
  };

  const load = (t: string) => Object.values(s.orders).filter(o => o.technician === t && !['dispatched', 'cancelled', 'ready', 'manufacturing', 'finishing'].includes(o.status)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A0A0B0]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search case, patient, practice…" className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-56 bg-white focus:outline-none focus:border-[#4D8EF7]" /></div>
        <select className={inputSm} value={cad} onChange={e => setCad(e.target.value as typeof cad)}><option value="all">All CAD</option><option value="exocad">exocad</option><option value="3shape">3Shape</option><option value="partner">Partners</option></select>
        <select className={inputSm} value={tech} onChange={e => setTech(e.target.value)}><option value="all">All technicians</option><option value="none">Unassigned</option>{TECHNICIANS.map(t => <option key={t}>{t}</option>)}</select>
        <label className="inline-flex items-center gap-1.5 text-xs text-[#5A5568]"><input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} /> Needs attention</label>
        <label className="inline-flex items-center gap-1.5 text-xs text-[#5A5568]"><input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> Cancelled</label>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#717182]">Drag a card onto a technician to assign:</span>
          {TECHNICIANS.map(t => (
            <span key={t} onDragOver={e => { e.preventDefault(); setOver(`tech:${t}`); }} onDragLeave={() => setOver(null)} onDrop={dropOnTech(t)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-colors ${over === `tech:${t}` ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : dragging ? 'border-dashed border-[#C8D8FC] bg-white' : 'border-[#E0E0E6] bg-white text-[#5A5568]'}`}>
              <UserRound className="w-3 h-3" /> {t} <span className="text-[#A0A0B0]">{load(t)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {COLUMNS.map(col => {
          const cards = orders.filter(o => col.statuses.includes(o.status));
          return (
            <div key={col.id} onDragOver={e => { e.preventDefault(); setOver(col.id); }} onDragLeave={() => setOver(o => (o === col.id ? null : o))} onDrop={drop(col.id)}
              className={`flex-shrink-0 w-64 rounded-xl border p-2 transition-colors ${over === col.id ? (col.lab ? 'border-[#4D8EF7] bg-[#F5F9FF]' : 'border-[#F5C2C2] bg-[#FFF5F5]') : 'border-[#E0E0E6] bg-[#F8F9FC]'}`}>
              <div className="flex items-center justify-between px-1.5 pb-2">
                <p className="text-xs font-semibold text-[#030213]">{col.label}</p>
                <span className="text-[11px] text-[#717182]">{cards.length}</span>
              </div>
              {!col.lab && dragging && <p className="text-[10px] text-[#A0A0B0] px-1.5 pb-1">Set by the connector or dentist</p>}
              <div className="space-y-2 min-h-[60px]">
                {cards.map(o => <Card key={o.caseId} o={o} onOpen={() => navigate(`/growth/cases/${encodeURIComponent(o.caseId)}?sf=cad`)} onDrag={setDragging} />)}
                {cards.length === 0 && <p className="text-[11px] text-[#A0A0B0] text-center py-4">Nothing here</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ o, onOpen, onDrag }: { o: CadOrder; onOpen: () => void; onDrag: (id: string | null) => void }) {
  const s = useCad();
  const { toast } = useToast();
  const flags = orderFlags(o);
  const teeth = [...new Set(o.lines.flatMap(l => l.fdi))];
  const job = s.jobs.find(j => j.token === o.partnerJobId);
  const partner = job ? s.partners.find(p => p.id === job.partnerId) : undefined;
  const tone = { red: 'red', amber: 'amber', blue: 'blue', purple: 'purple' } as const;
  return (
    <div draggable onDragStart={e => { e.dataTransfer.setData('text/plain', o.caseId); e.dataTransfer.effectAllowed = 'move'; onDrag(o.caseId); }}
      className={`bg-white rounded-lg border p-2.5 cursor-grab active:cursor-grabbing hover:border-[#C8D8FC] ${o.status === 'cancelled' ? 'opacity-60' : ''} ${flags.some(f => f.tone === 'red') ? 'border-[#F5C2C2]' : 'border-[#E0E0E6]'}`}>
      <div className="flex items-start justify-between gap-1">
        <button onClick={onOpen} className="text-left min-w-0">
          <p className="font-mono text-[11px] font-semibold text-[#030213] truncate">{o.caseId}</p>
          <p className="text-xs text-[#030213] truncate">{o.patientSent}</p>
        </button>
        <Pill tone={o.cad === 'exocad' ? 'blue' : o.cad === '3shape' ? 'purple' : 'gray'}>{CAD_LABEL[o.cad]}</Pill>
      </div>
      <p className="text-[11px] text-[#717182] mt-1 truncate">{o.lines.map(l => l.indication ?? l.itemName).join(', ')}{teeth.length ? ` · ${teeth.join(', ')}` : ''}</p>
      <div className="flex items-center justify-between mt-1.5 text-[11px]">
        <span className={o.dueDate && o.dueDate < today() && o.status !== 'dispatched' ? 'text-[#C62828] font-semibold' : 'text-[#5A5568]'}>Due {o.dueDate ? new Date(o.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
        <span className="text-[#5A5568] truncate max-w-[120px]">{partner ? partner.name : o.technician ?? <span className="text-[#A0A0B0] inline-flex items-center gap-0.5"><Unlink className="w-3 h-3" /> Unassigned</span>}</span>
      </div>
      {flags.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{flags.map(f => <Pill key={f.text} tone={tone[f.tone]}><f.icon className="w-2.5 h-2.5" /> {f.text}</Pill>)}</div>}
      <select className="mt-1.5 w-full text-[10px] text-[#717182] bg-transparent border-0 p-0 cursor-pointer focus:outline-none" value="" onChange={e => { if (!e.target.value) return; moveTo(o.caseId, e.target.value as DesignStatus); toast.success(`${o.caseId} set to ${STATUS_LABEL[e.target.value as DesignStatus]} by hand`); }}>
        <option value="">{STATUS_LABEL[o.status]} · Set status…</option>
        {(Object.keys(STATUS_LABEL) as DesignStatus[]).filter(x => x !== o.status).map(x => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
      </select>
    </div>
  );
}
