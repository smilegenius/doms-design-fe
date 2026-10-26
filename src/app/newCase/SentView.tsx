// ─── New Case Flow · Sent screen and Undo ────────────────────────────────────
// What happens next, then one card per case read live from the store: its
// status, the lab, prescriber and scans, and each service with its own back-by
// date. A posted case carries the portal's own Ready for dispatch panel (Print
// label, Mark as dispatched), so the page is the portal's dispatch flow; once
// it's posted the card says what went, and when it's back. View Case opens the
// portal's own Case Details (FlowCaseDetail).

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Undo2, Clock, Package, ScanLine, Building2, Stethoscope, type LucideIcon } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { useCase } from './CaseContext';
import { recordsSummary } from './CaseSteps';
import { Lab, Patient } from './data';
import { fmtDay, fromISO } from './dates';
import { CaseDraft, Ctx, ServiceItem, caseDates, isPosted, itemTitle, plural, recordsState, stagesShort } from './rules';
import { buildCtx, scanArchesText } from './derive';
import { useFlowStore } from './store';
import { DispatchPanel, StatusChip, dispatchLine, useShipped } from './dispatch';
import { Notice, SecondaryButton, FOCUS } from './ui';

export interface SentCase { id: string }
export interface SentResult {
  heading: string;
  cases: SentCase[];
  posted: boolean;
  /** Scan to follow: it goes to the lab when the scan arrives. */
  follow: boolean;
  approval: boolean;
  /** The prescriber. */
  dentist?: string;
  lab: Lab;
  patient: Patient;
  next?: { id: string; text: string };
}

export default function SentView({ result, onView, onDispatched }: {
  result: SentResult;
  onView: (id: string) => void;
  /** A case on this page was marked as dispatched. */
  onDispatched?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const store = useFlowStore();
  const rows = result.cases.map(c => store.rows.find(r => r.id === c.id));
  const waiting = rows.filter(r => r?.status === 'Ready for Dispatch').length;
  const dispatched = rows.filter(r => r?.status === 'Submitted').length;
  // Posting is a real-world action, so once a case goes there's nothing left to undo.
  const dispatchedRef = useRef(onDispatched);
  dispatchedRef.current = onDispatched;
  useEffect(() => { if (dispatched) dispatchedRef.current?.(); }, [dispatched]);

  const lab = result.lab.name;
  const many = result.cases.length > 1;
  const allPosted = result.posted && !result.approval && dispatched > 0 && waiting === 0;
  const title = allPosted ? `Dispatched to ${lab}` : result.heading;
  const next = (() => {
    if (result.approval) return `Waiting for ${result.dentist ?? 'the prescriber'} to approve. Nothing goes to ${lab} until then.`;
    if (result.follow) return `It goes to ${lab} when the scan arrives. The dates count from then.`;
    if (result.posted) {
      if (allPosted) return `Posted to ${lab}. Back-by dates count from the post day.`;
      if (dispatched) return `One posted to ${lab}. Mark the other as dispatched when it goes.`;
      // The panel below spells out the steps; this line only says where the case stands.
      return `Created. ${many ? 'They go' : 'It goes'} to ${lab} once ${many ? 'they are' : 'it is'} posted.`;
    }
    return `${lab} has ${many ? 'the cases' : 'the case'} now. Nothing else to do.`;
  })();
  // Amber while the parcel still has to go (the portal's Ready for Dispatch colours), green once it's done.
  const Icon = result.approval ? Clock : waiting ? Package : CheckCircle2;
  const tone = waiting && !result.approval
    ? 'bg-[#FFF8E1] border-[#FDE68A] text-[#B45309]'
    : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]';

  return (
    <div className="max-w-[820px] mx-auto px-6 py-8">
      <div className="flex items-start gap-3 mb-5">
        <span className={`w-11 h-11 rounded-2xl border flex items-center justify-center flex-shrink-0 ${tone}`} aria-hidden>
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-[#030213] leading-tight focus:outline-none">{title}</h1>
          <p className="text-sm text-[#3A3A4A] mt-1">{next}</p>
        </div>
      </div>

      <div className="space-y-3">
        {result.cases.map(c => <SentCard key={c.id} id={c.id} result={result} onView={onView} />)}
      </div>
    </div>
  );
}

/** One case, live from the store: Mark as dispatched changes it on this screen. */
function SentCard({ id, result, onView }: { id: string; result: SentResult; onView: (id: string) => void }) {
  const api = useCase();
  const store = useFlowStore();
  const row = store.rows.find(r => r.id === id);
  const shipped = useShipped(row);
  const doneRef = useRef<HTMLDivElement>(null);
  const wasReady = useRef(row?.status === 'Ready for Dispatch');
  useEffect(() => {
    if (row?.status !== 'Submitted' || !wasReady.current) return;
    wasReady.current = false;
    // The panel and its button are gone: keep focus on this card, not <body>.
    setTimeout(() => { if (document.activeElement === document.body) doneRef.current?.focus({ preventScroll: true }); }, 0);
  }, [row?.status]);

  const built = row?.draft ? buildCtx(row.draft, api.user) : null;
  if (!row?.draft || !built) return null;
  const draft = row.draft;
  // Once posted, each service's date counts from the day it went (as the row's back-by does).
  const ctx: Ctx = shipped ? { ...built.ctx, now: fromISO(shipped.dispatchedOn) } : built.ctx;
  const dates = caseDates(draft, ctx);
  const ready = row.status === 'Ready for Dispatch';
  const scans = scansFact(api, draft, ctx);
  const n = api.user.notation;
  const p = result.patient;

  const when = (item: ServiceItem) => {
    // A full denture has no date of its own: its stages each have one.
    if (item.product === 'denture') return stagesShort(item) || 'Stage dates once a stage is ordered';
    if (result.approval) return null;
    const own = dates.perItem.find(x => x.id === item.id);
    if (own?.ta == null) return '—';
    // Waiting for the scan: a day the clinic asked for stands; the lab's earliest counts from the scan.
    if (dates.route === 'follow') return own.requested && !own.tooSoon && own.backBy ? `Back by ${fmtDay(own.backBy)}` : `${plural(own.ta, 'working day')} after the scan`;
    return own.backBy ? `Back by ${fmtDay(own.backBy)}` : '—';
  };

  return (
    <section aria-labelledby={`nc-sent-${row.id}`} className="bg-white border border-[#E0E0E6] rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`nc-sent-${row.id}`} className="flex-1 min-w-0 text-sm font-semibold text-[#030213] truncate">{row.id} · {p.first} {p.last}</h2>
        {row.flag && <span className="text-[11px] font-semibold text-[#8A4B08]">{row.flag}</span>}
        <StatusChip status={row.status} />
        {/* A finished case opens in the portal's Case Details; one waiting for approval in the flow's editor. */}
        <SecondaryButton onClick={() => onView(row.id)} title={row.status === 'Draft' ? `View ${row.id}` : `Open ${row.id} in Case Details`}>View Case</SecondaryButton>
      </div>

      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 rounded-xl border border-[#ECECF2] bg-[#F8F9FC] divide-y sm:divide-y-0 sm:divide-x divide-[#ECECF2]">
        <Fact icon={Building2} label="Lab" value={result.lab.name} />
        <Fact icon={Stethoscope} label="Prescriber" value={row.dentist ?? built.prescriber?.name ?? '—'} />
        <Fact icon={ScanLine} label="Scans Source" value={scans.value} sub={scans.sub} />
      </dl>

      <div className="mt-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">{plural(draft.items.length, 'service')}</h3>
          {ready && <p className="ml-auto text-[11px] text-[#5A5A6A]">Dates if posted today</p>}
        </div>
        <ul className="mt-1 divide-y divide-[#F0EFF6]">
          {draft.items.map(i => {
            const w = when(i);
            return (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 min-w-0 text-sm text-[#030213] truncate">{itemTitle(i, n)}</span>
                {w && <span className="min-w-0 max-w-[55%] truncate text-xs font-semibold text-[#3A3A4A] whitespace-nowrap" title={w}>{w}</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {ready && <DispatchPanel row={row} className="mt-4" />}
      {row.status === 'Submitted' && (
        <div ref={doneRef} tabIndex={-1} className={`mt-4 rounded-xl ${FOCUS}`}>
          <Notice tone="success">
            {shipped ? dispatchLine(shipped) : 'Dispatched'}. Submitted to {result.lab.name}
            {row.delivery ? `, back by ${fmtDay(fromISO(row.delivery))}` : ''}.
          </Notice>
        </div>
      )}
    </section>
  );
}

/** One cell of the facts band: icon and label, value, a muted line. */
function Fact({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 px-3.5 py-2.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">
        <Icon className="w-3.5 h-3.5 flex-shrink-0 text-[#2F62D6]" strokeWidth={1.75} aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd title={value} className="mt-1 text-sm font-semibold text-[#030213] leading-snug truncate">{value}</dd>
      {sub && <dd title={sub} className="mt-0.5 text-[11px] leading-snug text-[#5A5A6A] line-clamp-2">{sub}</dd>}
    </div>
  );
}

/** "Medit scan · today 10:42" (its arches below), or "Impressions by post" and what's in the box. */
function scansFact(api: ReturnType<typeof useCase>, draft: CaseDraft, ctx: Ctx): { value: string; sub?: string } {
  const s = recordsState(draft, ctx);
  if (s === 'scan' && draft.scan) {
    const arches = scanArchesText(draft);
    return { value: `${draft.scan.scanner} scan · today ${draft.scan.time}`, sub: arches ? arches.charAt(0).toUpperCase() + arches.slice(1) : undefined };
  }
  // Impressions (By Post): the courier, so the lab can track the parcel (the product's Scan Source field).
  if (s === 'post') return { value: 'Impressions (By Post)', sub: draft.records.courier ? `Courier: ${draft.records.courier}` : undefined };
  // Review's own words for the rest (models at the lab, scan to follow, Via Scanner, SMS, Email…).
  return { value: recordsSummary({ ...api, draft, ctx }) };
}

/** "Sent. Undo (10)": the lab isn't told until the countdown ends. */
export function UndoToast({ seconds = 10, message, onUndo, onExpire }: { seconds?: number; message?: string; onUndo: () => void; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    if (left <= 0) { expire.current(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <ModalPortal>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-4 pl-5 pr-3 py-3 rounded-2xl bg-[#030213] text-white shadow-2xl">
        {/* Announced once; the countdown itself is hidden from screen readers. */}
        <p className="text-sm font-medium" role="status">{message ?? `Sent. You can undo for ${seconds} seconds.`}</p>
        <span className="text-sm tabular-nums text-white/70" aria-hidden>({left})</span>
        <button type="button" onClick={onUndo} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#030213] text-sm font-semibold hover:bg-[#F0EFF6] ${FOCUS}`}>
          <Undo2 className="w-4 h-4" aria-hidden />Undo
        </button>
      </div>
    </ModalPortal>
  );
}
