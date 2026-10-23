// ─── New Case Flow · Lab Work list (demo) ────────────────────────────────────
// A stand-in for the clinic's Lab Work list inside the flow, so every entry
// point can be tried without touching the real Cases page: "Add new Case",
// scanner Draft rows, and the bell notifications (new scan, approval, scan
// arrived), plus a demo switch for who is signed in.

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Plus, ScanLine, UserCheck, Inbox, X, FlaskConical, Building2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalPortal from '../components/ModalPortal';
import FlowFrame from './FlowFrame';
import { USERS, UserId, labById, userById } from './data';
import { fmtDay, fromISO, demoNow, receivedDate, addWorkingDays, toISO } from './dates';
import { caseDates, gapCount, plural } from './rules';
import { CaseRow, dismissEvent, getPatient, nextCaseId, saveRow, saveRows, setUserId, useFlowStore } from './store';
import { buildCtx } from './derive';
import { PrimaryButton, SecondaryButton, Segmented, Notice, FOCUS } from './ui';

export default function FlowCasesPage() {
  return (
    <FlowFrame>
      <CasesBody />
    </FlowFrame>
  );
}

const STATUS_TONE: Record<string, string> = {
  Draft: 'bg-[#F3F3F5] text-[#3A3A4A] border-[#E0E0E6]',
  'Ready for Dispatch': 'bg-[#F3EEFF] text-[#5B3FC4] border-[#DCD3FB]',
  Received: 'bg-[#EEF4FF] text-[#1E40AF] border-[#C8D8FC]',
  'In production': 'bg-[#FFF8E1] text-[#8A4B08] border-[#F5D98B]',
  Delivered: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
};

function CasesBody() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const [attach, setAttach] = useState<CaseRow | null>(null);
  const [highlight, setHighlight] = useState<string[]>(() => ((location.state as { highlight?: string[] } | null)?.highlight ?? []));
  useEffect(() => { if (highlight.length) { const t = setTimeout(() => setHighlight([]), 2400); return () => clearTimeout(t); } }, [highlight]);

  const rows = useMemo(() => [...store.rows].sort((a, b) => b.updatedAt - a.updatedAt), [store.rows]);
  // Add new Case opens the create page, which asks who it's for on the page itself.
  const startNew = () => navigate('/flows/new-case/case/new', { state: { session: `new-${Date.now()}` } });
  // Older links with ?launch=1 land on the same create page.
  useEffect(() => { if (new URLSearchParams(location.search).has('launch')) startNew(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (r: CaseRow) => {
    if (!r.draft) { toast.info(`${r.id} was created before this flow, so its details aren’t in this demo.`); return; }
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A4A5A] mb-1">Signed in as (demo)</p>
            <Segmented<UserId> label="Signed in as" value={user.id} onChange={id => { setUserId(id); toast.info(`Signed in as ${userById(id)!.name}.`); }} options={USERS.map(u => ({ id: u.id, label: u.role === 'nurse' ? `${u.name} · Nurse` : u.name }))} />
          </div>
          <PrimaryButton onClick={startNew} className="self-end"><Plus className="w-4 h-4" aria-hidden />Add new Case</PrimaryButton>
        </div>
      </div>

      {/* Notifications */}
      <section aria-label="Notifications" className="bg-white border border-[#E0E0E6] rounded-2xl mb-6">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#F0EFF6]">
          <Bell className="w-4 h-4 text-[#3A3A4A]" aria-hidden />
          <h2 className="text-sm font-semibold text-[#030213]">Notifications</h2>
          <span className="text-xs text-[#4A4A5A]">· for {user.name}</span>
        </div>
        <ul className="divide-y divide-[#F0EFF6]">
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
          {scanDrafts.length + approvals.length + awaitingScan.length + events.length === 0 && <li className="px-5 py-4 text-sm text-[#4A4A5A]">Nothing new.</li>}
        </ul>
      </section>

      {/* List */}
      <div className="bg-white border border-[#E0E0E6] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FC] text-left">
            <tr className="text-[11px] uppercase tracking-wider text-[#4A4A5A]">
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
            {rows.map(r => {
              const p = getPatient(r.patientId);
              const gaps = r.status === 'Draft' && !r.flag && r.draft ? (() => { const b = buildCtx(r.draft!, user); return b ? gapCount(r.draft!, b.ctx) : 0; })() : 0;
              return (
                <tr key={r.id} onClick={() => open(r)} className={`cursor-pointer hover:bg-[#FAFBFF] ${highlight.includes(r.id) ? 'newly-added' : ''}`}>
                  <td className="px-4 py-3">
                    <button type="button" onClick={e => { e.stopPropagation(); open(r); }} className={`font-semibold text-[#030213] hover:underline rounded ${FOCUS}`}>{r.id}</button>
                    <span className="flex items-center gap-1 text-[11px] text-[#4A4A5A] mt-0.5">
                      {r.source === 'scanner' ? <><ScanLine className="w-3 h-3" aria-hidden />{r.scanLabel}</> : <><Building2 className="w-3 h-3" aria-hidden />Clinic</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#030213]">{p ? `${p.first} ${p.last}` : r.patientId}</td>
                  <td className="px-4 py-3 text-[#1F1F2E] max-w-[260px]"><span className="line-clamp-2">{r.service}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_TONE[r.status]}`}>{r.status}</span>
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

      {attach && <AttachScan row={attach} onClose={() => setAttach(null)} />}
    </div>
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
  const ctx = buildCtx(draft, user)?.ctx;
  const ta = ctx ? caseDates(draft, ctx).ta : undefined;
  const backBy = ta != null ? addWorkingDays(received, ta) : undefined;
  const attachIt = () => {
    saveRow({
      ...row, flag: undefined, scanArrived: undefined, updatedAt: Date.now(),
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
