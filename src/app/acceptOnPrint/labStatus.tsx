// ─── Accept case on print · lab statuses ─────────────────────────────────────
// How the flow's lab statuses look and are picked. Statuses the portal already
// has keep its colours (pages/CaseDetailPage STATUS_MAP); Received and Accepted
// are the live portal's, which the prototype hasn't adopted yet.

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, Package, RefreshCw, Truck } from 'lucide-react';
import { STATUS_MAP, type CaseForDetail, type CaseStatusHost } from '../pages/CaseDetailPage';
import { isPosted, type LabCase, type LabStatus } from './store';

type Look = CaseStatusHost['look'];

export const LOOK: Record<LabStatus, Look> = {
  Submitted: STATUS_MAP.submitted,
  Received: { label: 'Received', bg: '#FFF8E1', color: '#A16207', border: '#FDE68A', dot: '#F59E0B' },
  Accepted: { label: 'Accepted', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0', dot: '#22C55E' },
  'On Hold': STATUS_MAP['on-hold'],
  'In Production': STATUS_MAP['in-production'],
  'Quality Check': STATUS_MAP['quality-check'],
  Shipped: STATUS_MAP.shipped,
};

const ICON: Record<LabStatus, typeof Package> = {
  Submitted: Package, Received: Package, Accepted: CheckCircle2, 'On Hold': Clock,
  'In Production': RefreshCw, 'Quality Check': CheckCircle2, Shipped: Truck,
};

/** The portal status each lab status reads as wherever the portal page works from its own (pipeline rules, menus). */
export const TO_PORTAL: Record<LabStatus, CaseForDetail['status']> = {
  Submitted: 'submitted', Received: 'submitted', Accepted: 'submitted', 'On Hold': 'on-hold',
  'In Production': 'in-production', 'Quality Check': 'quality-check', Shipped: 'shipped',
};

/** What the lab can pick. Received only applies to a case sent by post, and only until it's received. */
export function pickableStatuses(c: LabCase): LabStatus[] {
  const all: LabStatus[] = ['Received', 'Accepted', 'On Hold', 'In Production', 'Quality Check', 'Shipped'];
  return all.filter(s => s !== 'Received' || (isPosted(c) && !c.receivedAt) || c.status === 'Received');
}

/** The list's status badge (the portal's StatusBadge look). */
export function LabStatusChip({ status }: { status: LabStatus }) {
  const s = LOOK[status];
  const Icon = ICON[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap border px-2.5 py-0.5 text-xs" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

/** The identity card's split pill (the portal's StatusDropdown): the status | ▾ the lab's status list. */
export function LabStatusControl({ c, onPick }: { c: LabCase; onPick: (s: LabStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const s = LOOK[c.status];

  return (
    <div ref={ref} className="relative inline-flex">
      <div className="inline-flex items-stretch rounded-full overflow-hidden text-[13px] font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
        <span className="inline-flex items-center gap-1.5 pl-3 pr-3 py-1.5">
          <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
          {s.label}
        </span>
        <button
          onClick={() => setOpen(o => !o)}
          title="Change case status"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="px-2.5 flex items-center hover:brightness-95 transition"
          style={{ background: s.border, color: s.color }}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div role="listbox" className="absolute left-0 top-full mt-1.5 z-40 w-60 max-h-[340px] overflow-y-auto bg-white border border-[#E0E0E6] rounded-xl shadow-xl py-1">
          {pickableStatuses(c).map(st => (
            <button
              key={st}
              role="option"
              aria-selected={st === c.status}
              onClick={() => { setOpen(false); if (st !== c.status) onPick(st); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-[#030213] border-b border-[#F0EFF6] last:border-b-0 hover:bg-[#F8F9FC] transition-colors"
            >
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                {st === c.status && <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />}
              </span>
              {LOOK[st].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "02-Nov-2026 16:20" → "02 Nov, 16:20" */
export const shortWhen = (at: string) => {
  const [date, time] = at.split(' ');
  const [d, m] = date.split('-');
  return time ? `${d} ${m}, ${time}` : `${d} ${m}`;
};

/** The status strip above the case card: Created, then every status the case has had, the latest one marked. */
export function statusSteps(c: LabCase): CaseStatusHost['steps'] {
  const last = c.history.length - 1;
  return [
    { label: 'Created', actor: c.practice, when: shortWhen(c.createdAt) },
    ...c.history.map((e, i) => ({
      label: LOOK[e.status].label,
      actor: e.by,
      when: shortWhen(e.at),
      state: i === last ? (e.status === 'On Hold' ? 'blocked' as const : 'current' as const) : undefined,
    })),
  ];
}
