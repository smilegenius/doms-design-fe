import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Kanban, RotateCcw, ServerOff, Settings2, Users } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { reconnect, resetCadDemo, simulateHours, syncCad, useCad } from './cadStore';
import { hoursSince } from './engine';
import DesignBoard from './screens/DesignBoard';
import Partners from './screens/Partners';
import { Note } from '../lab-billing/ui';

// ── Design (Growth Team Feedback): CAD integration with exocad and 3Shape ────
// /growth/design (board) · /growth/design/partners. Settings live under
// Settings → CAD & design.

export default function DesignApp() {
  const s = useCad();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => { syncCad(); }, []);
  const tab = pathname.includes('/partners') ? 'partners' : 'board';
  const offline = s.connectors.filter(c => c.status !== 'online');
  const awaiting = Object.values(s.orders).filter(o => o.status === 'awaiting-dentist').length;
  const late = s.jobs.filter(j => ['sent', 'downloaded'].includes(j.status) && j.overdueAlertedAt).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Design</h1>
          <p className="text-sm text-[#717182] mt-1">Every digital case as a CAD order in {s.settings.cad === 'both' ? 'exocad or 3Shape' : s.settings.cad === 'exocad' ? 'exocad' : s.settings.cad === '3shape' ? '3Shape' : 'your partners'}, tracked until it's approved and made. {awaiting} waiting on dentists{late ? ` · ${late} late with partners` : ''}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { simulateHours(24); toast.success('24 hours later: reminders and partner alerts checked'); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-[#717182] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]" title="Demo: move the clock forward"><Clock className="w-3 h-3" /> Simulate 24h</button>
          <button onClick={() => navigate('/growth/settings?tab=cad')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-[#717182] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]"><Settings2 className="w-3 h-3" /> CAD settings</button>
          <button onClick={() => { resetCadDemo(); toast.success('Design demo reset'); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-[#717182] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]"><RotateCcw className="w-3 h-3" /> Reset demo</button>
        </div>
      </div>

      {offline.map(c => (
        <Note key={c.id} tone="red">
          <ServerOff className="w-3 h-3 inline -mt-0.5" /> <b>{c.pc}</b> ({c.cad === 'exocad' ? 'exocad' : '3Shape'}) {c.status === 'needs-update' ? 'needs an update: its test order failed after a CAD update.' : `connector offline, last seen ${Math.round(hoursSince(c.lastSeen))}h ago.`} {c.queue.length} order{c.queue.length === 1 ? '' : 's'} queued; they're written as soon as it's back.{' '}
          <button className="underline font-semibold" onClick={() => { reconnect(c.id); toast.success(`${c.pc} back online: ${c.queue.length} order(s) written`); }}>It's back on (demo)</button>
        </Note>
      ))}

      <nav className="flex gap-1 border-b border-[#E0E0E6]">
        {([['board', 'Design board', Kanban, '/growth/design'], ['partners', 'Partners', Users, '/growth/design/partners']] as const).map(([id, label, Icon, to]) => (
          <button key={id} onClick={() => navigate(to)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 ${tab === id ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}><Icon className="w-3.5 h-3.5" /> {label}</button>
        ))}
      </nav>

      {tab === 'board' ? <DesignBoard /> : <Partners />}
    </div>
  );
}
