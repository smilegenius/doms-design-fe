import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Layers } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { fmtShort } from '../lab-billing/format';
import { type Line, STATUS, caseLines, isHidden, isOpen, setRequested, useWorkflow } from './workflowStore';
import { useMe } from './shared';

// ── V2: the case page follows the workflow's delivery dates ──────────────────
// Each service has its own date back to the practice (the calendar moves it by
// drag and drop). On the case page:
//   • Header: one service → the Delivery Date field shows (and edits) that
//     service's date. Several services → a "Delivery dates" cell lists each
//     one. CaseDetailPage's own field is hidden while this is showing.
//   • Case timeline (the modal from the progress strip): a "Lab workflow"
//     section lists what happened on the case, date changes included.
// Both are placed at runtime from this folder; CaseDetailPage is unchanged.

const VIA = 'on the case page';

function findHeader(): { input: HTMLInputElement | null; grid: HTMLElement } | null {
  const labels = [...document.querySelectorAll<HTMLElement>('main p')].filter(p => p.children.length === 0);
  const input = labels.find(p => p.textContent?.trim() === 'Delivery Date' && p.nextElementSibling instanceof HTMLInputElement)?.nextElementSibling as HTMLInputElement | undefined;
  const grid = (input ?? labels.find(p => p.textContent?.trim() === 'Assignee'))?.closest<HTMLElement>('.grid');
  return grid ? { input: input ?? null, grid } : null;
}
function findTimeline(): HTMLElement | null {
  const title = [...document.querySelectorAll<HTMLElement>('p')].find(p => p.children.length === 0 && p.textContent?.trim() === 'Case Timeline');
  return title?.closest<HTMLElement>('.rounded-2xl') ?? null;
}

/** Re-run `find` whenever the page changes; returns the current match. */
function useFound<T>(find: () => T | null, same: (a: T, b: T) => boolean): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    const sync = () => setV(prev => { const n = find(); return prev && n && same(prev, n) ? prev : n; });
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => mo.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

export default function CaseDeliveryDates({ caseId }: { caseId: string }) {
  const s = useWorkflow();
  const lines = caseLines(s, caseId).filter(l => !isHidden(l));
  const header = useFound(findHeader, (a, b) => a.grid === b.grid && a.input === b.input);
  const timeline = useFound(findTimeline, (a, b) => a === b);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [tlHost, setTlHost] = useState<HTMLElement | null>(null);
  const has = lines.length > 0;

  // Header: hide the case-level field and put ours where it was (or add a cell).
  useEffect(() => {
    if (!header || !has) { setHost(null); return; }
    const el = document.createElement('div');
    el.dataset.sfDelivery = caseId;
    if (header.input) {
      header.input.style.display = 'none';
      header.input.insertAdjacentElement('afterend', el);
    } else header.grid.appendChild(el);
    setHost(el);
    return () => { el.remove(); if (header.input) header.input.style.display = ''; };
  }, [header, has, caseId]);

  useEffect(() => {
    if (!timeline || !has) { setTlHost(null); return; }
    const el = document.createElement('div');
    el.dataset.sfWorkflowTimeline = caseId;
    timeline.appendChild(el);
    setTlHost(el);
    return () => { el.remove(); };
  }, [timeline, has, caseId]);

  if (!has) return null;
  return (
    <>
      {host && createPortal(<HeaderDates lines={lines} label={!header?.input} />, host)}
      {tlHost && createPortal(<WorkflowTimeline caseId={caseId} />, tlHost)}
    </>
  );
}

function HeaderDates({ lines, label }: { lines: Line[]; label: boolean }) {
  const me = useMe();
  const { toast } = useToast();
  const field = 'w-full text-xs px-2 py-1.5 rounded-md border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20 disabled:bg-[#F8F9FC] disabled:text-[#717182]';
  const save = (l: Line, v: string) => { if (setRequested([l.id], v || null, me, VIA)) toast.success(`${l.service}: delivery date ${v ? `set to ${fmtShort(v)}` : 'cleared'}. Recorded on the case timeline`); };
  if (lines.length === 1) {
    const l = lines[0];
    return (
      <>
        {label && <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[#A0A0B0]">Delivery Date</p>}
        <input type="date" className={field} value={l.requested ?? ''} disabled={!isOpen(l)} onChange={e => save(l, e.target.value)} title={isOpen(l) ? 'Due back to the practice' : STATUS[l.status].label} />
      </>
    );
  }
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[#A0A0B0] inline-flex items-center gap-1"><Layers className="w-3 h-3 text-[#7C6BFF]" /> Delivery dates · {lines.length} services</p>
      <div className="space-y-1">
        {lines.map(l => (
          <label key={l.id} className="flex items-center gap-2 text-[11px] text-[#5A5568]">
            <span className="w-20 truncate font-medium text-[#030213]" title={l.service}>{l.service}</span>
            <input type="date" className={`${field} py-1`} value={l.requested ?? ''} disabled={!isOpen(l)} onChange={e => save(l, e.target.value)} title={isOpen(l) ? 'Due back to the practice' : STATUS[l.status].label} />
          </label>
        ))}
      </div>
    </div>
  );
}

function WorkflowTimeline({ caseId }: { caseId: string }) {
  const s = useWorkflow();
  const events = s.events.filter(e => e.caseId === caseId).sort((a, b) => b.at.localeCompare(a.at));
  if (!events.length) return null;
  return (
    <div className="border-t border-[#F0EFF6] px-5 py-4 bg-white">
      <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-2.5">Lab workflow</p>
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
        {events.map(e => {
          const date = e.kind === 'date';
          const when = new Date(e.at);
          const stamp = Number.isNaN(when.getTime()) ? e.at : `${when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
          return (
            <div key={e.id} className="flex items-start gap-2.5">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${date ? 'bg-[#FFF7E6]' : 'bg-[#F5F3FF]'}`}>
                {date ? <CalendarClock className="w-3 h-3 text-[#B45309]" /> : <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#030213] leading-relaxed">{date ? 'Delivery date changed' : e.text.split(':')[0]}<span className="font-normal text-[#717182]"> · {e.by}</span></p>
                <p className="text-[11px] text-[#5A5568] mt-0.5">{date ? e.text : e.text.includes(':') ? e.text.slice(e.text.indexOf(':') + 1).trim() : ''}</p>
                <p className="text-[10px] text-[#A0A0B0] mt-0.5">{stamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
