// ─── New Case Flow · Lab Work list (demo) ────────────────────────────────────
// A stand-in for the clinic's Lab Work list inside the flow, so every entry
// point can be tried without touching the real Cases page: "Add new Case",
// scanner Draft rows, and the bell notifications (new scan, approval, scan
// arrived). Who is signed in is set by the walkthrough's steps. Posted cases are handled
// as the portal's list does: Ready for Dispatch rows pinned to the top, a
// quick filter, and tick-to-print labels in bulk. Each case is still marked as
// dispatched from its own Case Details (the portal's page), so there is no
// per-row dispatch action here.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Plus, ScanLine, UserCheck, Inbox, X, FlaskConical, Building2, Package, Printer } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalPortal from '../components/ModalPortal';
import { PrintLabelsModal } from '../components/DispatchLabel';
import { offlineLabStatusFor } from '../components/OfflineLabNotice';
import FlowFrame from './FlowFrame';
import { CLINIC, labById, userById } from './data';
import { fmtDay, fromISO, demoNow, receivedDate, addWorkingDays, toISO } from './dates';
import { caseDates, gapCount, plural } from './rules';
import { CaseRow, dismissEvent, getPatient, nextCaseId, saveRow, saveRows, useFlowStore } from './store';
import { buildCtx, sentCtx } from './derive';
import { StatusChip } from './dispatch';
import { PrimaryButton, SecondaryButton, Segmented, Notice, FOCUS } from './ui';

export default function FlowCasesPage() {
  return (
    <FlowFrame>
      <CasesBody />
    </FlowFrame>
  );
}

type Filter = 'all' | 'Ready for Dispatch';

// The portal's rule (CasesPage isSelectable): the clinic can only tick cases waiting to be posted,
// and an offline lab's cases are left out (it prints an order form, not a label).
const isSelectable = (r: CaseRow) => r.status === 'Ready for Dispatch' && !offlineLabStatusFor(labById(r.labId).name);

function CasesBody() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const [attach, setAttach] = useState<CaseRow | null>(null);
  const [highlight, setHighlight] = useState<string[]>(() => ((location.state as { highlight?: string[] } | null)?.highlight ?? []));
  useEffect(() => { if (highlight.length) { const t = setTimeout(() => setHighlight([]), 2400); return () => clearTimeout(t); } }, [highlight]);

  // Ready for Dispatch first, as the portal pins them for the clinic (someone has to post them), then newest.
  const rows = useMemo(
    () => [...store.rows].sort((a, b) => Number(b.status === 'Ready for Dispatch') - Number(a.status === 'Ready for Dispatch') || b.updatedAt - a.updatedAt),
    [store.rows],
  );
  const ready = rows.filter(r => r.status === 'Ready for Dispatch');
  const [filter, setFilter] = useState<Filter>('all');
  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  // Bulk label print. Ticks are kept by ID and read against the live rows, so a case
  // dispatched meanwhile (now Submitted) drops out of the count and the sheets.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [printOpen, setPrintOpen] = useState(false);
  const picked = rows.filter(r => selected.has(r.id) && isSelectable(r));
  const pageSelectable = visible.filter(isSelectable);
  const pageAll = pageSelectable.length > 0 && pageSelectable.every(r => selected.has(r.id));
  const pageSome = pageSelectable.some(r => selected.has(r.id));
  const toggle = (r: CaseRow) => setSelected(prev => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next; });
  const toggleAll = () => setSelected(prev => { const next = new Set(prev); pageSelectable.forEach(r => (pageAll ? next.delete(r.id) : next.add(r.id))); return next; });
  const clearSelection = () => setSelected(new Set());

  // Add new Case opens the create page, which asks who it's for on the page itself.
  const startNew = () => navigate('/flows/new-case/case/new', { state: { session: `new-${Date.now()}` } });
  // Older links with ?launch=1 land on the same create page.
  useEffect(() => { if (new URLSearchParams(location.search).has('launch')) startNew(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Finished work (history rows too) opens in the portal's own Case Details; a draft, or one waiting
  // for approval, stays in the flow's editor.
  const open = (r: CaseRow) => {
    if (r.status !== 'Draft') { navigate(`/flows/new-case/view/${r.id}`); return; }
    navigate(`/flows/new-case/case/${r.id}`, { state: { session: `${r.id}-${Date.now()}` } });
  };

  // Bell notifications, derived from the demo data.
  const scanDrafts = rows.filter(r => r.status === 'Draft' && r.source === 'scanner' && !r.flag && r.draft);
  const approvals = rows.filter(r => r.flag === 'Awaiting approval' && r.draft?.prescriber === user.id);
  const awaitingScan = rows.filter(r => r.flag === 'Awaiting scan');
  const events = store.events.filter(e => e.forUser === user.id);

  return (
    <div className="p-8 max-w-[1440px]">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-[28px] font-semibold text-[#030213] leading-tight">Lab Work</h1>
          <p className="text-sm text-[#4A4A5A] mt-1">New case flow demo · Elmfield Dental Practice, Leeds · today Thu 22 Oct 2026</p>
        </div>
        {/* No "signed in as" switch here: the walkthrough's steps sign in whoever each one is for. */}
        <PrimaryButton onClick={startNew}><Plus className="w-4 h-4" aria-hidden />Add new Case</PrimaryButton>
      </div>

      {/* Notifications */}
      <section aria-label="Notifications" className="bg-white border border-[#E0E0E6] rounded-2xl mb-6">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#F0EFF6]">
          <Bell className="w-4 h-4 text-[#3A3A4A]" aria-hidden />
          <h2 className="text-sm font-semibold text-[#030213]">Notifications</h2>
          <span className="text-xs text-[#4A4A5A]">· for {user.name}</span>
        </div>
        <ul className="divide-y divide-[#F0EFF6]">
          {ready.length > 0 && (
            <Note
              icon={<Package className="w-4 h-4 text-[#B45309]" />}
              text={`${plural(ready.length, 'case')} waiting to be posted`}
              sub={`${ready.map(r => r.id).join(', ')} · ${ready.length === 1 ? 'print the label, post the impressions, then mark it as dispatched' : 'print the labels, post the impressions, then mark each as dispatched'}`}
              action={<SecondaryButton onClick={() => setFilter('Ready for Dispatch')}>Show Cases</SecondaryButton>}
            />
          )}
          {scanDrafts.map(r => {
            const p = getPatient(r.patientId)!;
            return (
              <Note key={`scan-${r.id}`} icon={<ScanLine className="w-4 h-4 text-[#2F62D6]" />} text={`New ${r.scanLabel?.split(' · ')[0]} scan: ${p.first} ${p.last}`} sub={`${r.scanLabel} · ${r.id}`} action={<SecondaryButton onClick={() => open(r)}>Open</SecondaryButton>} />
            );
          })}
          {approvals.map(r => {
            const p = getPatient(r.patientId)!;
            const prep = userById(r.draft?.preparedBy);
            return <Note key={`ap-${r.id}`} icon={<UserCheck className="w-4 h-4 text-[#B45309]" />} text={`${prep?.name ?? 'A colleague'} prepared a case for ${p.first} ${p.last}`} sub={`${r.id} · waiting for you to approve`} action={<PrimaryButton onClick={() => open(r)}>Review</PrimaryButton>} />;
          })}
          {awaitingScan.map(r => {
            const p = getPatient(r.patientId)!;
            return r.scanArrived
              ? <Note key={`sa-${r.id}`} icon={<Inbox className="w-4 h-4 text-[#15803D]" />} text={`${p.first} ${p.last}’s scan arrived (${r.scanArrived.scanner}, ${r.scanArrived.time}). Attach it to ${r.id}?`} action={<PrimaryButton onClick={() => setAttach(r)}>Attach</PrimaryButton>} />
              : <Note key={`sw-${r.id}`} icon={<Inbox className="w-4 h-4 text-[#4A4A5A]" />} text={`${r.id} · ${p.first} ${p.last} is waiting for a scan`} sub="Demo: make the scan arrive from the Medit at 14:10" action={<SecondaryButton onClick={() => saveRow({ ...r, scanArrived: { scanner: 'Medit', time: '14:10' } })}>Scan Arrives</SecondaryButton>} />;
          })}
          {events.map(e => (
            <Note key={e.id} icon={<UserCheck className="w-4 h-4 text-[#15803D]" />} text={e.text} sub={e.caseId} action={<button type="button" aria-label="Dismiss" onClick={() => dismissEvent(e.id)} className={`p-1 rounded text-[#4A4A5A] ${FOCUS}`}><X className="w-4 h-4" /></button>} />
          ))}
          {(ready.length ? 1 : 0) + scanDrafts.length + approvals.length + awaitingScan.length + events.length === 0 && <li className="px-5 py-4 text-sm text-[#4A4A5A]">Nothing new.</li>}
        </ul>
      </section>

      {/* Quick status filter (the portal's Status filter, cut down to what the clinic acts on here) */}
      <div className="mb-3">
        <Segmented<Filter>
          label="Status"
          value={filter}
          onChange={setFilter}
          options={[{ id: 'all', label: 'All Cases' }, { id: 'Ready for Dispatch', label: `Ready for Dispatch (${ready.length})` }]}
        />
      </div>

      {/* Bulk bar: the portal's, with Print labels as the clinic's only bulk action */}
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 bg-[#EEF4FF] border border-[#C8D8FC] rounded-xl">
          <span className="text-sm font-semibold text-[#1565C0]">{picked.length} case{picked.length === 1 ? '' : 's'} selected</span>
          <button type="button" onClick={clearSelection} className={`text-sm text-[#4A4A5A] hover:text-[#030213] underline underline-offset-2 rounded transition-colors ${FOCUS}`}>
            Clear selection
          </button>
          <PrimaryButton onClick={() => setPrintOpen(true)} className="ml-auto"><Printer className="w-4 h-4" aria-hidden />Print labels</PrimaryButton>
        </div>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-white border border-[#E0E0E6] rounded-2xl flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-12 h-12 text-[#E0E0E6] mb-4" aria-hidden />
          {filter === 'Ready for Dispatch' ? (
            <>
              <p className="text-[#030213] font-medium mb-1">No cases ready for dispatch</p>
              <p className="text-sm text-[#4A4A5A] mb-4">Cases with impressions by post wait here until they’re marked as dispatched.</p>
              <SecondaryButton onClick={() => setFilter('all')}>Show All Cases</SecondaryButton>
            </>
          ) : (
            <>
              <p className="text-[#030213] font-medium mb-1">No lab work yet</p>
              <p className="text-sm text-[#4A4A5A] mb-4">Cases you create, and scans from the practice’s scanners, show here.</p>
              <PrimaryButton onClick={startNew}><Plus className="w-4 h-4" aria-hidden />Add new Case</PrimaryButton>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E0E0E6] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FC] text-left">
              <tr className="text-[11px] uppercase tracking-wider text-[#4A4A5A]">
                <th className="w-8 pl-4 pr-1 py-3">
                  <Tick checked={pageAll} indeterminate={!pageAll && pageSome} onChange={toggleAll} disabled={pageSelectable.length === 0} label="Select all on this page" />
                </th>
                <th className="px-4 py-3 font-semibold">Case</th>
                <th className="px-4 py-3 font-semibold">Patient</th>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Delivery / Due Date</th>
                <th className="px-4 py-3 font-semibold">Dentist</th>
                <th className="px-4 py-3 font-semibold">Lab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFF6]">
              {visible.map(r => {
                const p = getPatient(r.patientId);
                const gaps = r.status === 'Draft' && !r.flag && r.draft ? (() => { const b = buildCtx(r.draft!, user); return b ? gapCount(r.draft!, b.ctx) : 0; })() : 0;
                return (
                  <tr key={r.id} onClick={() => open(r)} className={`cursor-pointer hover:bg-[#FAFBFF] ${highlight.includes(r.id) ? 'newly-added' : ''}`}>
                    {/* Ticking never opens the row. */}
                    <td className="pl-4 pr-1 py-3" onClick={e => e.stopPropagation()}>
                      {isSelectable(r) && <Tick checked={selected.has(r.id)} onChange={() => toggle(r)} label={`Select case ${r.id}`} />}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={e => { e.stopPropagation(); open(r); }} className={`font-semibold text-[#030213] whitespace-nowrap hover:underline rounded ${FOCUS}`}>{r.id}</button>
                      <span className="flex items-center gap-1 text-[11px] text-[#4A4A5A] mt-0.5">
                        {r.source === 'scanner' ? <><ScanLine className="w-3 h-3" aria-hidden />{r.scanLabel}</> : <><Building2 className="w-3 h-3" aria-hidden />Clinic</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#030213]">{p ? `${p.first} ${p.last}` : r.patientId}</td>
                    <td className="px-4 py-3 text-[#1F1F2E] max-w-[260px]"><span className="line-clamp-2">{r.service}</span></td>
                    <td className="px-4 py-3">
                      <StatusChip status={r.status} />
                      {r.flag && <span className="block text-[11px] font-semibold text-[#8A4B08] mt-1">{r.flag}</span>}
                      {gaps > 0 && <span className="block text-[11px] font-semibold text-[#8A4B08] mt-1">▲ {plural(gaps, 'thing')} left</span>}
                    </td>
                    <td className="px-4 py-3 text-[#1F1F2E]">{r.delivery ? fmtDay(fromISO(r.delivery)) : '—'}</td>
                    <td className="px-4 py-3 text-[#1F1F2E]">{r.dentist ?? '—'}</td>
                    <td className="px-4 py-3 text-[#1F1F2E]"><span className="inline-flex items-center gap-1"><FlaskConical className="w-3 h-3 text-[#4A4A5A]" aria-hidden />{labById(r.labId).name}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {attach && <AttachScan row={attach} onClose={() => setAttach(null)} />}
      {printOpen && picked.length > 0 && (
        <PrintLabelsModal
          caseNumbers={picked.map(r => r.id)}
          labNames={picked.map(r => labById(r.labId).name)}
          details={picked.map(r => { const p = getPatient(r.patientId); return { patient: p ? `${p.first} ${p.last}` : undefined, dentist: r.dentist, clinic: CLINIC.name }; })}
          title={`Print labels · ${picked.length} case${picked.length === 1 ? '' : 's'}`}
          subtitle="One A4 sheet per case. Put each in its parcel with the impressions."
          onClose={() => setPrintOpen(false)}
          onPrinted={clearSelection}
        />
      )}
    </div>
  );
}

/** The portal's tick (CasesPage TriCheckbox): a dash when only some of the page is ticked. */
function Tick({ checked, indeterminate, onChange, disabled, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !checked && !!indeterminate; }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      title={label}
      aria-label={label}
      className={`w-4 h-4 rounded accent-[#3F6FE8] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
    />
  );
}

function Note({ icon, text, sub, action }: { icon: React.ReactNode; text: string; sub?: string; action?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="w-8 h-8 rounded-full bg-[#F3F3F5] flex items-center justify-center flex-shrink-0" aria-hidden>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#030213]">{text}</p>
        {sub && <p className="text-xs text-[#4A4A5A]">{sub}</p>}
      </div>
      {action}
    </li>
  );
}

// ─── Attach Scan (Scan to Follow arrival) ────────────────────────────────────

function AttachScan({ row, onClose }: { row: CaseRow; onClose: () => void }) {
  const { toast } = useToast();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const draft = row.draft!;
  const p = getPatient(row.patientId)!;
  const lab = labById(draft.lab);
  const arrived = row.scanArrived!;
  const scan = { scanner: arrived.scanner, time: arrived.time, arches: { upper: true, lower: true, bite: true }, patientId: row.patientId };
  const needs = { upper: true, lower: true, bite: true };
  const missing = (Object.keys(needs) as (keyof typeof needs)[]).filter(k => needs[k] && !scan.arches[k]);
  const [h, m] = arrived.time.split(':').map(Number);
  const at = new Date(demoNow()); at.setHours(h, m, 0, 0);
  const received = receivedDate('digital', at, lab.cutoffMin);
  const ctx = sentCtx(row, user)?.ctx;
  const ta = ctx ? caseDates(draft, ctx).ta : undefined;
  const backBy = ta != null ? addWorkingDays(received, ta) : undefined;
  const attachIt = () => {
    saveRow({
      ...row, flag: undefined, scanArrived: undefined, scanAt: at.getTime(), updatedAt: Date.now(),
      delivery: backBy ? toISO(backBy) : row.delivery,
      draft: { ...draft, scan, records: { ...draft.records, route: undefined } },
    });
    toast.success(`Scan attached. ${row.id} is with ${lab.name}${backBy ? `, back by ${fmtDay(backBy)}` : ''}.`);
    onClose();
  };
  const notThis = () => {
    const id = nextCaseId();
    saveRows([
      { ...row, scanArrived: undefined },
      { id, patientId: row.patientId, status: 'Draft', source: 'scanner', scanLabel: `${arrived.scanner} · ${arrived.time}`, service: '—', labId: draft.lab, updatedAt: Date.now(), draft: { ...draft, id, items: [], scan, note: '', fit: undefined, groupIds: undefined } },
    ]);
    toast.info('Kept apart: the scan is now its own draft.');
    onClose();
  };
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div role="dialog" aria-modal="true" aria-label="Attach scan" className="relative w-[560px] bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-lg font-semibold text-[#030213]">Attach this scan to {row.id}?</h2>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div className="rounded-xl border border-[#E0E0E6] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A5A] mb-1">Scan</p>
              <p className="font-semibold text-[#030213]">{p.first} {p.last}</p>
              <p className="text-xs text-[#4A4A5A]">{arrived.scanner} · today {arrived.time} · 0 days old</p>
            </div>
            <div className="rounded-xl border border-[#E0E0E6] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A5A] mb-1">Case</p>
              <p className="font-semibold text-[#030213]">{p.first} {p.last} · {row.id}</p>
              <p className="text-xs text-[#4A4A5A]">{row.service}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {(['upper', 'lower', 'bite'] as const).map(a => (
              <div key={a} className="flex-1 rounded-lg border border-[#E0E0E6] overflow-hidden">
                <div className="h-14 bg-gradient-to-br from-[#F7E2F8] to-[#AEE3E6]" aria-hidden />
                <p className="text-xs px-2 py-1.5 text-[#1F1F2E] capitalize">{a} {scan.arches[a] ? '✓' : '—'} <span className="text-[#4A4A5A]">{needs[a] ? '· needed' : ''}</span></p>
              </div>
            ))}
          </div>
          {backBy && (
            <p className="text-sm text-[#1F1F2E] mt-4">{arrived.time} is before {lab.name.split(' ')[0]}’s cut-off, so it’s received today. Back by <span className="font-semibold">{fmtDay(backBy)}</span>.</p>
          )}
          {missing.length > 0 && <div className="mt-3"><Notice tone="block">The scan has no {missing.join(' or ')}, which this case needs.</Notice></div>}
          <div className="mt-6 flex justify-end gap-2">
            <SecondaryButton onClick={notThis}>Not This Scan</SecondaryButton>
            <PrimaryButton onClick={attachIt} disabled={missing.length > 0} title={missing.length ? `Missing ${missing.join(', ')}` : undefined}>Attach and Release to Lab</PrimaryButton>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
