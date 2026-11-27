import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckSquare, LogOut } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { fmtShort } from '../lab-billing/format';
import { btnPrimary } from '../lab-billing/ui';
import { STAFF, STATUS, ackNotes, caseLines, dueOf, isOverdue, unreadFor, useWorkflow } from './workflowStore';
import { LineActions, LinePill } from './shared';
import { Avatar, ServiceIcon } from './ui';

// ── V2 Bench mode: what scanning a docket QR opens ───────────────────────────
// One line at a time, big buttons, made for a shared bench tablet or a phone.
// No login: pick your name from the lab's staff list and enter a 4-digit PIN
// (the lab can turn the PIN off). Pick up · Done → next · Block · Mark shipped.

const WHO = 'salesFeedbacks.bench.who';

export default function BenchPage({ lineId }: { lineId: string }) {
  const s = useWorkflow();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [who, setWho] = useState<string | null>(() => { try { return sessionStorage.getItem(WHO); } catch { return null; } });
  const [pick, setPick] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const l = s.lines[lineId];
  const signIn = (name: string) => { try { sessionStorage.setItem(WHO, name); } catch { /* memory only */ } setWho(name); setPick(null); setPin(''); };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#F3F4F8] flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/growth/queue')} className="inline-flex items-center gap-1 text-xs text-[#717182]"><ArrowLeft className="w-3.5 h-3.5" /> My queue</button>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#717182]">Bench mode</span>
          {who ? <button onClick={() => { try { sessionStorage.removeItem(WHO); } catch { /* */ } setWho(null); }} className="inline-flex items-center gap-1 text-xs text-[#717182]"><LogOut className="w-3.5 h-3.5" /> {who.split(' ')[0]}</button> : <span />}
        </div>
        {children}
      </div>
    </div>
  );

  if (!l) return shell(<div className="bg-white rounded-2xl p-6 text-sm">This QR doesn't match a service. Ask the office to reprint the docket.</div>);

  if (!who) {
    const person = STAFF.find(p => p.name === pick);
    return shell(
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div><p className="text-lg font-semibold text-[#030213]">Who's working on this?</p><p className="text-xs text-[#717182]">{l.service} · {l.patient}</p></div>
        <div className="grid grid-cols-2 gap-2">
          {STAFF.map(p => <button key={p.name} onClick={() => (s.settings.pinOn ? setPick(p.name) : signIn(p.name))} className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left ${pick === p.name ? 'border-[#4D8EF7] bg-[#F5F9FF]' : 'border-[#E0E0E6]'}`}><Avatar name={p.name} size="md" /><span className="min-w-0"><span className="block text-sm font-semibold truncate">{p.name}</span><span className="block text-[11px] text-[#717182] truncate">{p.role}</span></span></button>)}
        </div>
        {person && (
          <div className="space-y-2">
            <p className="text-xs text-[#717182]">Your 4-digit PIN <span className="text-[#A0A0B0]">(demo: {person.pin})</span></p>
            <input autoFocus inputMode="numeric" maxLength={4} value={pin} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setPin(v); if (v.length === 4) { if (v === person.pin) signIn(person.name); else { toast.error('That PIN doesn\'t match'); setPin(''); } } }} className="w-full text-center tracking-[0.6em] text-2xl font-semibold px-3 py-3 rounded-xl border border-[#E0E0E6]" placeholder="••••" />
          </div>
        )}
      </div>,
    );
  }

  const unread = unreadFor(s, l, who);
  const due = dueOf(s, l);
  const others = caseLines(s, l.caseId).filter(x => x.id !== l.id);
  return shell(
    <>
      <div className="bg-white rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ServiceIcon service={l.service} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-semibold text-[#030213]">{l.service}</p>
            <p className="text-sm text-[#5A5568]">{l.patient} · <span className="font-mono">{l.caseId}</span></p>
            <p className="text-sm text-[#717182]">{l.practice} · {l.dentist}</p>
          </div>
          <LinePill s={s} l={l} />
        </div>
        <p className={`text-sm ${isOverdue(s, l) ? 'text-[#C62828] font-semibold' : 'text-[#5A5568]'}`}>{due ? `Due ${fmtShort(due)}${isOverdue(s, l) ? ' · overdue' : ''}` : 'No date'} · {l.owner ?? 'Team queue'}</p>
        {l.hold && <p className="text-sm rounded-xl bg-[#FFF8E1] text-[#92400E] px-3 py-2">On hold: {l.hold.reason}</p>}
      </div>
      {unread.length > 0 && (
        <div className="bg-white rounded-2xl p-5 space-y-2">
          <p className="text-sm font-semibold text-[#B45309]">{unread.length} note{unread.length === 1 ? '' : 's'} for you</p>
          {unread.map(n => <p key={n.id} className={`text-sm rounded-xl px-3 py-2 ${n.kind === 'internal' ? 'bg-[#FFFBEB]' : 'bg-[#F5F9FF]'}`}><span className="block text-[10px] uppercase tracking-wide text-[#717182]">{n.kind === 'internal' ? 'Internal' : 'Dentist'}{n.stage ? ` · for ${n.stage}` : ''} · {n.by}</span>{n.text}</p>)}
          <button className={`${btnPrimary} w-full !py-3 !text-sm !rounded-xl`} onClick={() => { ackNotes(unread.map(n => n.id), who, l.id); toast.success('Notes read'); }}><CheckSquare className="w-4 h-4" /> I've read {unread.length === 1 ? 'it' : 'them'}</button>
        </div>
      )}
      <div className="bg-white rounded-2xl p-5"><LineActions l={l} me={who} size="lg" onAck={() => toast.error('Read the notes above first')} /></div>
      {others.length > 0 && <p className="text-xs text-[#717182] text-center">Also on this case: {others.map(o => `${o.service} (${STATUS[o.status].label})`).join(', ')}</p>}
    </>,
  );
}
