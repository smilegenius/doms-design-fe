import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CheckCheck, Search, Link2, Undo2, Repeat, ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import Button from '../components/Button';
import SideDrawer from '../components/SideDrawer';
import DropdownFilter from '../components/DropdownFilter';
import WhatsAppIcon from '../components/icons/WhatsAppIcon';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { mockCases, StatusBadge, type Case, type CaseStatus } from './CasesPage';
import {
  UNMATCHED_REASON,
  assignManyUnmatchedWhatsApp,
  dismissUnmatchedWhatsApp,
  isResolved,
  unassignUnmatchedWhatsApp,
  useUnmatchedWhatsApp,
  type UnmatchedWhatsApp,
} from '../data/whatsappUnmatched';
import { BLOCK_REASON_TEXT, useWhatsAppComms, whatsappBlockReason } from '../data/whatsappComms';

// ─── Lab · WhatsApp inbox ────────────────────────────────────────────────────
// Inbound WhatsApp messages that couldn't be matched to a case on their own.
// Built from the portal's own pieces: the Notifications header + search/tabs,
// the Cases table + bulk bar, and the SideDrawer the Conversation hub uses.
//   • Action required → open a message, pick one of the dentist's open cases
//     and it joins that case's thread; or Mark as resolved (no case needed).
//   • Filter by dentist → select several and assign them to one case at once.
//   • Resolved → Unassign / Reassign / Move back puts it in Action required.
// URL-addressable: /lab/whatsapp?view=action|resolved&dentist=<name>&msg=<id>.

type View = 'action' | 'resolved';

const WA_SETTINGS = '/lab/settings?tab=case-scoring&sub=case-emails&channel=whatsapp';

// Cases the lab is still working on — what a message can be assigned to.
const CLOSED: CaseStatus[] = ['draft', 'ready-for-dispatch', 'shipped', 'delivered', 'completed'];
function openCasesFor(dentist: string): Case[] {
  return mockCases.filter(c => c.dentist === dentist && !c.archived && !CLOSED.includes(c.status));
}
const DENTISTS_WITH_OPEN_CASES = Array.from(
  new Set(mockCases.filter(c => !c.archived && !CLOSED.includes(c.status)).map(c => c.dentist)),
).sort();

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function senderName(m: UnmatchedWhatsApp) {
  return m.assignment?.dentist ?? m.dentist ?? m.profileName;
}

function reasonDetail(m: UnmatchedWhatsApp) {
  if (m.reason === 'several-cases' && m.dentist) {
    return `${m.dentist} has ${openCasesFor(m.dentist).length} open cases and the message doesn’t say which.`;
  }
  return UNMATCHED_REASON[m.reason].detail;
}

function ReasonChip({ m }: { m: UnmatchedWhatsApp }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]">
      <AlertTriangle className="w-3 h-3" />
      {UNMATCHED_REASON[m.reason].label}
    </span>
  );
}

function WaAvatar() {
  return (
    <span className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
      <WhatsAppIcon className="w-4 h-4 text-white" />
    </span>
  );
}

// Same checkbox as the Cases table (TriCheckbox there), incl. the dash state.
function Checkbox({ checked, indeterminate, onChange, title }: { checked: boolean; indeterminate?: boolean; onChange: () => void; title?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !checked && !!indeterminate; }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title={title}
      className="w-4 h-4 rounded border-[#E0E0E6] accent-[#4D8EF7] cursor-pointer"
    />
  );
}

export default function WhatsAppInboxPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const all = useUnmatchedWhatsApp();
  const settings = useWhatsAppComms();
  const blocked = whatsappBlockReason(settings);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const view: View = params.get('view') === 'resolved' ? 'resolved' : 'action';
  const dentistFilter = params.get('dentist') ?? 'all';
  const sorted = useMemo(() => [...all].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)), [all]);
  const action = sorted.filter(m => !isResolved(m));
  const resolved = sorted.filter(isResolved);
  const inView = view === 'action' ? action : resolved;
  // Dentists the lab knows — an unknown number has none until it is assigned.
  const dentistOptions = [
    { value: 'all', label: 'All' },
    ...Array.from(new Set(inView.map(m => m.assignment?.dentist ?? m.dentist).filter((d): d is string => !!d))).sort().map(d => ({ value: d, label: d })),
  ];
  const q = search.trim().toLowerCase();
  const rows = inView
    .filter(m => dentistFilter === 'all' || (m.assignment?.dentist ?? m.dentist) === dentistFilter)
    .filter(m => !q || [senderName(m), m.profileName, m.fromNumber, m.body, m.assignment?.caseId ?? ''].some(v => v.toLowerCase().includes(q)));
  const open = all.find(m => m.id === params.get('msg')) ?? null;

  // Bulk assignment is one dentist at a time — the cases come from them.
  const bulkEnabled = view === 'action' && dentistFilter !== 'all';
  const selectedRows = rows.filter(m => selected.has(m.id));
  const allOnPage = bulkEnabled && rows.length > 0 && rows.every(m => selected.has(m.id));
  useEffect(() => { setSelected(new Set()); }, [view, dentistFilter]);

  const go = (next: { view?: View; msg?: string; dentist?: string }) => {
    const p = new URLSearchParams();
    const v = next.view ?? view;
    const d = next.dentist ?? dentistFilter;
    if (v === 'resolved') p.set('view', 'resolved');
    if (d !== 'all') p.set('dentist', d);
    if (next.msg) p.set('msg', next.msg);
    setParams(p, { replace: true });
  };

  const by = user?.name ? user.name.charAt(0).toUpperCase() + user.name.slice(1) : 'Lab team';

  const assign = (ms: UnmatchedWhatsApp[], c: Case) => {
    assignManyUnmatchedWhatsApp(ms.map(m => m.id), { caseId: c.id, dentist: c.dentist, by });
    toast.success(ms.length === 1
      ? `Assigned to ${c.id} — moved to Resolved`
      : `${ms.length} messages assigned to ${c.id} — moved to Resolved`);
    setSelected(new Set());
    setBulkOpen(false);
    go({ msg: undefined });
  };

  const dismiss = (ms: UnmatchedWhatsApp[]) => {
    dismissUnmatchedWhatsApp(ms.map(m => m.id), by);
    toast.success(ms.length === 1 ? 'Marked as resolved — not linked to a case' : `${ms.length} messages marked as resolved`);
    setSelected(new Set());
    setBulkOpen(false);
    go({ msg: undefined });
  };

  const reopen = (m: UnmatchedWhatsApp, pick: boolean) => {
    const from = m.assignment?.caseId;
    unassignUnmatchedWhatsApp(m.id);
    if (pick) {
      toast.success(from ? `Removed from ${from} — pick the right case` : 'Moved back — pick a case');
      go({ view: 'action', msg: m.id, dentist: 'all' });
    } else {
      toast.success(from ? `Removed from ${from} — moved back to Action required` : 'Moved back to Action required');
      go({ msg: undefined });
    }
  };

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const tabBtn = (id: View, label: string, count: number) => (
    <button
      key={id}
      onClick={() => go({ view: id, msg: undefined })}
      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
        view === id ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm' : 'text-[#717182] hover:text-[#030213]'
      }`}
    >
      {label} ({count})
    </button>
  );

  const th = 'text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">WhatsApp Inbox</h1>
          <p className="text-sm sm:text-base text-[#717182]">
            WhatsApp messages we couldn’t match to a case. Assign each one to the right case.
          </p>
        </div>
        <button
          onClick={() => navigate(WA_SETTINGS)}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#030213] hover:text-[#4D8EF7] transition-colors"
        >
          <SettingsIcon className="w-4 h-4" />
          WhatsApp settings
        </button>
      </div>

      {blocked && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#FDE68A] bg-[#FFF8E1] px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#92400E]">
            {BLOCK_REASON_TEXT[blocked]} New messages won’t arrive until it’s back on.
          </p>
        </div>
      )}

      {/* Search + dentist filter + tabs */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717182]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by sender, number, message or case ID"
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#E0E0E6] rounded-lg text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-56">
            <DropdownFilter label="Dentist" options={dentistOptions} value={dentistFilter} onChange={d => go({ dentist: d, msg: undefined })} />
          </div>
          <div className="flex items-center gap-1 p-1 bg-[#F3F3F5] rounded-lg">
            {tabBtn('action', 'Action required', action.length)}
            {tabBtn('resolved', 'Resolved', resolved.length)}
          </div>
        </div>
      </div>

      {/* Bulk bar — Cases style. Only once a dentist is picked: the cases to
          assign to are that dentist's. */}
      {view === 'action' && rows.length > 1 && dentistFilter === 'all' && (
        <p className="text-xs text-[#717182] mb-3">Filter by dentist to assign several messages at once.</p>
      )}
      {bulkEnabled && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 bg-[#EEF4FF] border border-[#C8D8FC] rounded-xl">
          <span className="text-sm font-semibold text-[#1565C0]">
            {selectedRows.length} message{selectedRows.length === 1 ? '' : 's'} selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-[#717182] hover:text-[#030213] underline underline-offset-2 transition-colors"
          >
            Clear selection
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<CheckCheck className="w-4 h-4" />} onClick={() => dismiss(selectedRows)}>
              Mark as resolved
            </Button>
            <Button size="sm" icon={<Link2 className="w-4 h-4" />} onClick={() => setBulkOpen(true)}>
              Assign to a case
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center py-20 text-center">
          {q || dentistFilter !== 'all' ? <Search className="w-12 h-12 text-[#E0E0E6] mb-4" /> : <CheckCircle2 className="w-12 h-12 text-[#E0E0E6] mb-4" />}
          <p className="text-[#030213] font-medium mb-1">
            {q || dentistFilter !== 'all' ? 'No messages found' : view === 'action' ? 'All caught up' : 'Nothing resolved yet'}
          </p>
          <p className="text-sm text-[#717182]">
            {q || dentistFilter !== 'all' ? 'Try a different search or dentist' : view === 'action' ? 'Every WhatsApp message is linked to a case.' : 'Messages you resolve show here.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#F3F3F5] rounded-xl border border-[#E0E0E6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-1">
              <thead>
                <tr className="bg-[#F3F3F5] [&>th]:border-b [&>th]:border-[#E0E0E6]">
                  {bulkEnabled && (
                    <th className="w-8 pl-4 pr-1 py-3">
                      <Checkbox
                        checked={allOnPage}
                        indeterminate={selectedRows.length > 0}
                        onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map(m => m.id)))}
                        title="Select all"
                      />
                    </th>
                  )}
                  <th className={th}>From</th>
                  <th className={th}>Message</th>
                  <th className={th}>{view === 'action' ? 'Why not matched' : 'Outcome'}</th>
                  <th className={th}>Received</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map(m => {
                  const assigned = m.assignment ? mockCases.find(c => c.id === m.assignment!.caseId) : undefined;
                  const on = selected.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => go({ msg: m.id })}
                      className={`${on ? 'bg-[#F5F8FF]' : 'bg-white'} hover:bg-[#F8F9FC] cursor-pointer transition-colors [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px]`}
                    >
                      {bulkEnabled && (
                        <td className="pl-4 pr-1 py-3" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={on} onChange={() => toggle(m.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <WaAvatar />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#030213] whitespace-nowrap">{senderName(m)}</p>
                            <p className="text-xs text-[#717182] whitespace-nowrap">{m.fromNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <p className="text-sm text-[#5A5568] truncate" title={m.body}>{m.body}</p>
                      </td>
                      <td className="px-4 py-3">
                        {m.assignment ? (
                          <div>
                            <p className="text-sm font-medium text-[#030213] whitespace-nowrap">{m.assignment.caseId}</p>
                            {assigned && <p className="text-xs text-[#717182] whitespace-nowrap">{assigned.patientName}</p>}
                          </div>
                        ) : m.dismissed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]">
                            <CheckCheck className="w-3 h-3" /> No case needed
                          </span>
                        ) : (
                          <ReasonChip m={m} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#717182] whitespace-nowrap">{fmtDateTime(m.receivedAt)}</td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => go({ msg: m.id })}>
                          {isResolved(m) ? 'View' : 'Assign'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* One message */}
      <SideDrawer
        open={!!open && !bulkOpen}
        onClose={() => go({ msg: undefined })}
        title={open ? senderName(open) : ''}
        subtitle={open ? `${open.fromNumber} · ${fmtDateTime(open.receivedAt)}` : undefined}
        icon={<WhatsAppIcon className="w-[18px] h-[18px] text-white" />}
        iconBg="bg-[#25D366]"
      >
        {open && (
          <div className="space-y-4">
            <MessageCard m={open} />
            {isResolved(open) ? (
              <ResolvedCard
                m={open}
                onOpenCase={id => navigate(`/lab/cases/${encodeURIComponent(id)}?conversation=1&channel=whatsapp`)}
                onReassign={() => reopen(open, true)}
                onMoveBack={() => reopen(open, false)}
              />
            ) : (
              <CasePicker
                key={open.id}
                dentist={open.dentist}
                previousCaseId={open.previousCaseId}
                onAssign={c => assign([open], c)}
                onDismiss={() => dismiss([open])}
              />
            )}
          </div>
        )}
      </SideDrawer>

      {/* Several messages, one dentist */}
      <SideDrawer
        open={bulkOpen && selectedRows.length > 0}
        onClose={() => setBulkOpen(false)}
        title={`Assign ${selectedRows.length} messages`}
        subtitle={`${dentistFilter} · all go to the same case`}
        icon={<WhatsAppIcon className="w-[18px] h-[18px] text-white" />}
        iconBg="bg-[#25D366]"
      >
        <div className="space-y-4">
          <div className="bg-white border border-[#E0E0E6] rounded-xl p-4 space-y-3">
            {selectedRows.map(m => (
              <div key={m.id} className="flex gap-2.5">
                <WaAvatar />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#A0A0B0] mb-1">{fmtDateTime(m.receivedAt)}</p>
                  <div className="rounded-xl border px-3 py-2 bg-[#F0FDF4] border-[#BBF7D0]">
                    <p className="text-xs text-[#030213] leading-relaxed">{m.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {bulkEnabled && (
            <CasePicker
              key={selectedRows.map(m => m.id).join()}
              dentist={dentistFilter}
              onAssign={c => assign(selectedRows, c)}
              onDismiss={() => dismiss(selectedRows)}
              count={selectedRows.length}
            />
          )}
        </div>
      </SideDrawer>
    </div>
  );
}

// The message — same bubble as an inbound WhatsApp in the Conversation hub.
function MessageCard({ m }: { m: UnmatchedWhatsApp }) {
  const time = new Date(m.receivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
      <div className="flex gap-2.5">
        <WaAvatar />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-[#030213]">{senderName(m)}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded bg-[#F3F3F5] text-[#717182]">Dentist</span>
            {!m.dentist && !m.assignment && <span className="text-[10px] text-[#717182]">WhatsApp name: {m.profileName}</span>}
            <span className="text-[10px] text-[#A0A0B0]">{time}</span>
          </div>
          <div className="rounded-xl border px-3 py-2.5 bg-[#F0FDF4] border-[#BBF7D0]">
            <pre className="text-xs text-[#030213] whitespace-pre-wrap font-sans leading-relaxed">{m.body}</pre>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#FFF8E1] border border-[#FDE68A] px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#92400E]">
          <span className="font-semibold">{UNMATCHED_REASON[m.reason].label}.</span> {reasonDetail(m)}
        </p>
      </div>
    </div>
  );
}

function ResolvedCard({ m, onOpenCase, onReassign, onMoveBack }: {
  m: UnmatchedWhatsApp;
  onOpenCase: (caseId: string) => void;
  onReassign: () => void;
  onMoveBack: () => void;
}) {
  const assignedCase = m.assignment ? mockCases.find(c => c.id === m.assignment!.caseId) : undefined;
  const who = m.assignment ?? m.dismissed!;
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
      <p className="text-sm font-semibold text-[#030213] mb-3">{m.assignment ? 'Assigned to' : 'Resolved without a case'}</p>
      {assignedCase && <CaseRow c={assignedCase} />}
      <p className="text-xs text-[#717182] mt-2">By {who.by} · {fmtDateTime(who.at)}</p>
      <div className="flex items-center gap-2 flex-wrap mt-4">
        {m.assignment ? (
          <>
            <Button size="sm" icon={<ArrowRight className="w-4 h-4" />} onClick={() => onOpenCase(m.assignment!.caseId)}>
              Open case thread
            </Button>
            <Button size="sm" variant="outline" icon={<Repeat className="w-4 h-4" />} onClick={onReassign}>
              Reassign
            </Button>
            <Button size="sm" variant="ghost" icon={<Undo2 className="w-4 h-4" />} onClick={onMoveBack}>
              Unassign
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" icon={<Link2 className="w-4 h-4" />} onClick={onReassign}>
              Assign to a case
            </Button>
            <Button size="sm" variant="ghost" icon={<Undo2 className="w-4 h-4" />} onClick={onMoveBack}>
              Move back to Action required
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function CaseRow({ c, picked, onPick, wasHere }: { c: Case; picked?: boolean; onPick?: () => void; wasHere?: boolean }) {
  const body = (
    <>
      {onPick && (
        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${picked ? 'border-[#4D8EF7]' : 'border-[#D4CEE1]'}`}>
          {picked && <span className="w-2 h-2 rounded-full bg-[#4D8EF7]" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#030213]">{c.id}</span>
          <span className="text-sm text-[#5A5568]">{c.patientName}</span>
          {wasHere && <span className="text-[10px] text-[#717182]">· was here</span>}
        </span>
        <span className="block text-xs text-[#717182] mt-0.5 truncate">{c.services.join(', ')} · {c.practice}</span>
      </span>
      <StatusBadge status={c.status} compact />
    </>
  );
  if (!onPick) return <div className="flex items-center gap-3 rounded-lg border border-[#E0E0E6] px-3 py-2.5">{body}</div>;
  return (
    <button
      role="radio"
      aria-checked={!!picked}
      onClick={onPick}
      className={`w-full text-left flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        picked ? 'border-[#4D8EF7] bg-[#F5F8FF]' : 'border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]'
      }`}
    >
      {body}
    </button>
  );
}

function CasePicker({ dentist: knownDentist, previousCaseId, onAssign, onDismiss, count = 1 }: {
  /** Null when the number is unknown — the lab picks the dentist first. */
  dentist: string | null;
  previousCaseId?: string;
  onAssign: (c: Case) => void;
  /** Resolve without linking a case. */
  onDismiss: () => void;
  count?: number;
}) {
  const [dentist, setDentist] = useState<string>(knownDentist ?? '');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { setPicked(null); setQuery(''); }, [dentist]);

  const cases = dentist ? openCasesFor(dentist) : [];
  const q = query.trim().toLowerCase();
  const shown = q
    ? cases.filter(c => [c.id, c.patientName, c.practice, ...c.services].some(v => v.toLowerCase().includes(q)))
    : cases;
  const pickedCase = cases.find(c => c.id === picked);

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
      <p className="text-sm font-semibold text-[#030213]">{count > 1 ? `Assign all ${count} to a case` : 'Assign to a case'}</p>
      <p className="text-xs text-[#717182] mt-0.5">
        {knownDentist ? `${knownDentist}’s open cases.` : 'This number isn’t on file. Pick the dentist first.'}
        {previousCaseId && <> Was on {previousCaseId}.</>}
      </p>

      {!knownDentist && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-[#030213] mb-1.5" htmlFor="wa-dentist">Dentist</label>
          <select
            id="wa-dentist"
            value={dentist}
            onChange={e => setDentist(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-[#E0E0E6] rounded-lg text-sm text-[#030213] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
          >
            <option value="">Select a dentist</option>
            {DENTISTS_WITH_OPEN_CASES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {dentist && (
        <>
          {cases.length > 5 && (
            <div className="relative mt-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717182]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search patient, case ID or service"
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E0E0E6] rounded-lg text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>
          )}
          <div className="mt-3 space-y-2" role="radiogroup" aria-label="Open cases">
            {cases.length === 0 && <p className="text-xs text-[#A0A0B0] italic py-3">{dentist} has no open cases.</p>}
            {cases.length > 0 && shown.length === 0 && <p className="text-xs text-[#A0A0B0] italic py-3">No case matches “{query}”.</p>}
            {shown.map(c => (
              <CaseRow key={c.id} c={c} picked={picked === c.id} onPick={() => setPicked(c.id)} wasHere={previousCaseId === c.id} />
            ))}
          </div>
        </>
      )}

      {/* Footer — pinned while the case list scrolls. Mark as resolved is for
          a message that needs no case (a thank-you, already handled…). */}
      <div className="sticky -bottom-4 -mx-4 -mb-4 mt-4 px-4 py-3 bg-white border-t border-[#F0EFF6] rounded-b-xl flex items-center gap-3">
        <span className="flex-1 min-w-0 text-xs text-[#717182] truncate">
          {pickedCase && `${pickedCase.patientName} · ${pickedCase.services.join(', ')}`}
        </span>
        <Button size="sm" variant="outline" icon={<CheckCheck className="w-4 h-4" />} onClick={onDismiss}>
          Mark as resolved
        </Button>
        <Button size="sm" icon={<Link2 className="w-4 h-4" />} disabled={!pickedCase} onClick={() => pickedCase && onAssign(pickedCase)}>
          {pickedCase ? `Assign to ${pickedCase.id}` : 'Assign'}
        </Button>
      </div>
    </div>
  );
}
