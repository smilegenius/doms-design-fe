// ─── New Case Flow · dispatch ────────────────────────────────────────────────
// A case whose impressions go by post is created Ready for Dispatch: it isn't
// with the lab yet. As in the portal ("Dispatch added to shipping"): Print
// label, post it, then Mark as dispatched (courier, bag or box, date, comment,
// tracking) and the case is Submitted to the lab. The portal's own
// ReadyForDispatchPanel, dispatch record (data/dispatchRecords) and Shipping
// row are reused; only the row's status and back-by day live in this flow's
// store, so the real Cases list is never touched.

import { useEffect, useRef } from 'react';
import { CheckCircle2, Inbox, Package, PenLine, RefreshCw, type LucideIcon } from 'lucide-react';
import { ReadyForDispatchPanel, ShippingTab } from '../pages/CaseDetailPage';
import { DispatchRecord, recordDispatch, useDispatchRecord } from '../data/dispatchRecords';
import { offlineLabStatusFor } from '../components/OfflineLabNotice';
import { useToast } from '../context/ToastContext';
import { CLINIC, User, labById, userById } from './data';
import { demoNow, fmtDay, fromISO, toISO } from './dates';
import { caseDates, itemTitle } from './rules';
import { CaseRow, RowStatus, getPatient, getRow, markDispatched, saveRow, useFlowStore } from './store';
import { sentCtx } from './derive';

/** The portal's status colours and icons (CasesPage STATUS_STYLE). Received has no portal twin and keeps a blue of its own. */
export const STATUS_STYLE: Record<RowStatus, { bg: string; text: string; border: string; icon: LucideIcon }> = {
  Draft: { bg: '#FFF8E1', text: '#A16207', border: '#FDE68A', icon: PenLine },
  'Ready for Dispatch': { bg: '#FFF8E1', text: '#B45309', border: '#FDE68A', icon: Package },
  Submitted: { bg: '#EEF4FF', text: '#1565C0', border: '#C8D8FC', icon: Package },
  Received: { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD', icon: Inbox },
  'In production': { bg: '#F5F3FF', text: '#7C3AED', border: '#EDE9FE', icon: RefreshCw },
  Delivered: { bg: '#E0F7FA', text: '#00838F', border: '#B2EBF2', icon: CheckCircle2 },
};

/** The portal's status badge (CasesPage StatusBadge) for a flow row. */
export function StatusChip({ status, compact }: { status: RowStatus; compact?: boolean }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap border ${compact ? 'px-2 py-px text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden />
      {status}
    </span>
  );
}

export interface DispatchDetails { courier: string; packaging: string; tracking: string; dispatchedOn: string; comment: string }

/**
 * The case's back-by day counted from the day it was posted: the same engine as everywhere else
 * (caseDates), so a denture's fixed stage dates stay put and the rest count from the post.
 * Counted for the case's own maker; `user` is only the fallback.
 */
export function postedBackBy(row: CaseRow, dispatchedOn: string, user: User): string | undefined {
  const ctx = sentCtx(row, user)?.ctx;
  const back = row.draft && ctx ? caseDates(row.draft, { ...ctx, now: fromISO(dispatchedOn) }).backBy : undefined;
  return back ? toISO(back) : undefined;
}

/**
 * What Mark as dispatched does (the portal's onDispatch): record what was posted, the case is Submitted,
 * its back-by day is counted from the post day, and one toast says so.
 */
export function useMarkDispatched() {
  const { toast } = useToast();
  const store = useFlowStore();
  return (row: CaseRow, d: DispatchDetails) => {
    const user = userById(store.userId)!;
    recordDispatch(row.id, { courier: d.courier, packaging: d.packaging, tracking: d.tracking, comment: d.comment || undefined, dispatchedOn: d.dispatchedOn, by: user.name, at: new Date().toISOString() });
    markDispatched(row.id, postedBackBy(row, d.dispatchedOn, user));
    toast.success(`${row.id} marked as dispatched — ${d.courier} (${d.packaging.toLowerCase()})${d.tracking ? `, tracking ${d.tracking}` : ''}. Case submitted to the lab.`);
  };
}

/** The portal's "Ready for dispatch" banner for a flow case: Print label, then Mark as dispatched. */
export function DispatchPanel({ row, className = '' }: { row: CaseRow; className?: string }) {
  const mark = useMarkDispatched();
  const lab = labById(row.labId);
  const p = getPatient(row.patientId);
  return (
    <ReadyForDispatchPanel
      lab={lab.name}
      caseId={row.id}
      patient={p ? `${p.first} ${p.last}` : ''}
      dentist={row.dentist ?? ''}
      clinic={CLINIC.name}
      offline={!!offlineLabStatusFor(lab.name)}
      onDispatch={d => mark(row, d)}
      className={className}
      // The demo's clock, not the real one.
      today={toISO(demoNow())}
    />
  );
}

/**
 * The dispatch recorded for this row, if it was posted after the row was sent. Case IDs come back after
 * Reset demo, so an older record for the same ID never shows on a newer case.
 */
export function useShipped(row: CaseRow | undefined): DispatchRecord | undefined {
  const rec = useDispatchRecord(row?.id ?? '');
  if (!row || !rec || row.status === 'Draft' || row.status === 'Ready for Dispatch') return undefined;
  return Date.parse(rec.at) >= (row.sentAt ?? 0) ? rec : undefined;
}

/** "Dispatched Thu 22 Oct · Royal Mail (bag) · tracking RM123" */
export function dispatchLine(rec: DispatchRecord): string {
  return `Dispatched ${fmtDay(fromISO(rec.dispatchedOn))} · ${rec.courier} (${rec.packaging.toLowerCase()})${rec.tracking ? ` · tracking ${rec.tracking}` : ''}`;
}

/** After dispatch: the portal's Shipping row (Clinic → Lab, courier, tracking, date); its details open from the row. */
export function ShippingDetails({ row }: { row: CaseRow }) {
  const store = useFlowStore();
  const rec = useShipped(row);
  const user = userById(store.userId)!;
  // The clinic can correct the dispatch (the portal's details modal): a new post day moves the back-by day too.
  // Only a post day changed since mount: opening the page keeps a date the clinic set by hand.
  const seenPostDay = useRef({ id: row.id, day: rec?.dispatchedOn });
  useEffect(() => {
    const was = seenPostDay.current;
    seenPostDay.current = { id: row.id, day: rec?.dispatchedOn };
    if (!rec || was.id !== row.id || !was.day || was.day === rec.dispatchedOn) return;
    const live = getRow(row.id) ?? row;
    const delivery = postedBackBy(live, rec.dispatchedOn, user);
    if (delivery && delivery !== live.delivery) saveRow({ ...live, delivery, updatedAt: Date.now() });
  }, [row.id, rec?.dispatchedOn]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rec) return null;
  const services = row.draft?.items.map(i => itemTitle(i, user.notation)).join(', ');
  return <ShippingTab dispatch={rec} dispatchServices={services} serviceName={services} caseId={row.id} canEdit currentUser={user.name} />;
}
