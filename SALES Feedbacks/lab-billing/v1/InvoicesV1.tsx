import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, CheckCheck, CircleDollarSign, Download, FileText, Mail, Search } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import type { Invoice } from '../types';
import { account, isOverdue, outstanding, toInvoice, toolName, totals } from '../engine';
import { fmtShort, money, pl, today } from '../format';
import { approveInvoices, archiveInvoices, markPaid, useBilling } from '../billingStore';
import { pendingInvoices } from '../insights';
import { saveBlob } from '../../bulk-actions/zip';
import { useReadOnly } from '../BillingApp';
import { ToInvoice } from '../screens/Invoices';
import { btn, btnPrimary, Card, Empty, Pill, td, th } from '../ui';
import { Hint, invoiceUrl, plainStatus, practiceUrl, SendInvoicesModal } from './shared';

// ── V1 Invoices: one list, filter chips, actions appear when you tick ────────
// Waiting · Unpaid · Overdue · Paid · All. Archived invoices are hidden from
// every chip and come back with "Show archived". Monthly practices' shipped
// cases show as one banner ("ready to invoice"), not a tab.

type Chip = 'waiting' | 'unpaid' | 'overdue' | 'paid' | 'all';
const TONE: Record<string, 'amber' | 'blue' | 'red' | 'green' | 'gray'> = { 'Needs a look': 'amber', 'Ready to send': 'blue', Overdue: 'red', Paid: 'green', 'Part paid': 'amber', Sent: 'gray', Cancelled: 'gray' };

export default function InvoicesV1() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const readOnly = useReadOnly();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [ticked, setTicked] = useState<string[]>([]);
  const [archived, setArchived] = useState(false);
  const [sending, setSending] = useState(false);
  const tool = toolName(s);
  const pot = toInvoice(s);
  const waiting = pendingInvoices(s);
  const t = today();
  const live = s.invoices.filter(i => !i.archived && i.status !== 'void');
  const unpaid = live.filter(i => i.issuedAt && outstanding(i) > 0);
  const overdue = unpaid.filter(i => isOverdue(i, t));
  const chips: { id: Chip; label: string; count?: number; tone?: string }[] = [
    ...(readOnly ? [] : [{ id: 'waiting' as Chip, label: 'Waiting for you', count: waiting.length }]),
    { id: 'unpaid', label: 'Unpaid', count: unpaid.length }, { id: 'overdue', label: 'Overdue', count: overdue.length, tone: 'red' },
    { id: 'paid', label: 'Paid' }, { id: 'all', label: 'All' },
  ];
  // Old V0 links (?tab=sent&overdue=1, ?tab=to-invoice) still land somewhere sensible.
  const legacy = params.get('overdue') === '1' ? 'overdue' : ({ sent: 'unpaid', paid: 'paid', archived: 'all', waiting: 'waiting' } as Record<string, Chip>)[params.get('tab') ?? ''];
  const chip: Chip = (chips.find(c => c.id === params.get('show'))?.id ?? legacy ?? (!readOnly && waiting.length ? 'waiting' : 'unpaid'));
  const showPot = params.get('tab') === 'to-invoice' || params.get('show') === 'to-invoice';
  const setChip = (c: Chip) => { setParams({ show: c }, { replace: true }); setTicked([]); };

  const list = useMemo(() => {
    const base = archived ? s.invoices.filter(i => i.archived || i.status === 'void') : chip === 'waiting' ? waiting : chip === 'unpaid' ? unpaid : chip === 'overdue' ? overdue : chip === 'paid' ? live.filter(i => i.issuedAt && outstanding(i) <= 0.005) : live;
    return base.filter(i => !q || `${i.number} ${i.caseId} ${i.patient} ${i.practice} ${i.dentist} ${account(s, i.accountId)?.name}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt));
  }, [s, chip, q, archived]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = list.filter(i => ticked.includes(i.id));
  const canApprove = sel.filter(i => (i.status === 'draft' || i.status === 'flagged') && !i.lines.some(l => l.source.kind === 'unmapped'));
  const canPay = sel.filter(i => i.issuedAt && outstanding(i) > 0);
  const canArchive = sel.filter(i => i.status === 'paid' || i.status === 'void' || i.archived);
  const exportCsv = () => {
    const rows = [['Number', 'Date', 'Bill to', 'For', 'Status', 'Total', 'Still owed', 'Currency'], ...list.map(i => [i.number ?? '', i.issuedAt ?? '', account(s, i.accountId)?.name ?? '', i.cases?.length ? `${i.cases.length} cases` : `${i.caseId} ${i.patient}`, plainStatus(i), totals(i).gross.toFixed(2), outstanding(i).toFixed(2), i.currency])];
    saveBlob(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), `invoices-${chip}-${t}.csv`);
  };

  if (showPot && !readOnly) {
    return (
      <div className="space-y-4">
        <button onClick={() => setParams({}, { replace: true })} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> All invoices</button>
        <div><h2 className="text-lg font-semibold text-[#030213]">Ready to invoice</h2><Hint>Practices billed once a month: their shipped cases collect here. Untick a case to leave it for next month, then press Invoice month. Change a practice to monthly on its page › Setup.</Hint></div>
        <ToInvoice />
      </div>
    );
  }

  const potAccounts = new Set(pot.map(x => x.meta.accountId)).size;
  return (
    <div className="space-y-4">
      {!readOnly && pot.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F5F9FF] border border-[#DCE8FF] rounded-xl px-4 py-3">
          <p className="text-sm text-[#1565C0]"><b>{pl(pot.length, 'shipped case')}</b> for {pl(potAccounts, 'practice')} billed monthly, {money(pot.reduce((n, x) => n + x.value, 0), 'GBP', { round: true })} so far.</p>
          <button className={btnPrimary} onClick={() => setParams({ show: 'to-invoice' })}><FileText className="w-3.5 h-3.5" /> Review and invoice month</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chips.map(c => (
          <button key={c.id} onClick={() => { setArchived(false); setChip(c.id); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${chip === c.id && !archived ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#C7DAFF]'}`}>
            {c.label}{c.count != null && <span className={`text-[10px] px-1.5 rounded-full ${c.tone === 'red' && c.count ? 'bg-[#FDECEC] text-[#C62828]' : 'bg-[#F3F3F7] text-[#5A5568]'}`}>{c.count}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative"><Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Invoice, case, patient, practice…" className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-60" /></div>
        <button className={btn} onClick={exportCsv} title="Download this list for your accountant"><Download className="w-3.5 h-3.5" /> Download</button>
      </div>

      {ticked.length > 0 && !readOnly && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 bg-[#030213] text-white rounded-xl px-4 py-2.5 shadow-lg">
          <span className="text-xs font-semibold mr-2">{ticked.length} selected</span>
          {canApprove.length > 0 && <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#030213]" onClick={() => { const n = approveInvoices(canApprove.map(i => i.id)); toast.success(`${pl(n, 'invoice')} sent${tool ? ` and posted to ${tool}` : ''}`); setTicked([]); }}><CheckCheck className="w-3.5 h-3.5" /> Approve & send {canApprove.length}</button>}
          {sel.some(i => i.number) && <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/30" onClick={() => setSending(true)}><Mail className="w-3.5 h-3.5" /> Send a copy</button>}
          {canPay.length > 0 && !tool && <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/30" onClick={() => { const n = markPaid(canPay.map(i => i.id)); toast.success(`${pl(n, 'invoice')} marked paid`); setTicked([]); }}><CircleDollarSign className="w-3.5 h-3.5" /> Mark paid {canPay.length}</button>}
          {canArchive.length > 0 && <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/30" onClick={() => { const n = archiveInvoices(canArchive.map(i => i.id), !archived); toast.success(archived ? `${pl(n, 'invoice')} back in the list` : `${pl(n, 'invoice')} archived (still in statements and reports)`); setTicked([]); }}><Archive className="w-3.5 h-3.5" /> {archived ? 'Unarchive' : 'Archive'} {canArchive.length}</button>}
          {canArchive.length === 0 && !archived && sel.length > 0 && <span className="text-[11px] text-white/60">Archive is for paid or cancelled invoices.</span>}
          <button className="ml-auto text-[11px] text-white/70 hover:text-white" onClick={() => setTicked([])}>Clear</button>
        </div>
      )}

      <Card pad={false}>
        {list.length === 0 ? <Empty>{archived ? 'Nothing archived.' : chip === 'waiting' ? 'Nothing waiting: invoices are going out on their own.' : chip === 'overdue' ? 'Nothing overdue.' : 'No invoices here.'}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>
                {!readOnly && <th className={th}><input type="checkbox" aria-label="Select all" checked={ticked.length === list.length} onChange={() => setTicked(ticked.length === list.length ? [] : list.map(i => i.id))} /></th>}
                <th className={th}>Invoice</th><th className={th}>Bill to</th><th className={th}>For</th><th className={th}>Date</th><th className={th}>Status</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Still owed</th>
              </tr></thead>
              <tbody>{list.map(i => <Row key={i.id} i={i} ticked={ticked.includes(i.id)} readOnly={readOnly} onTick={() => setTicked(x => x.includes(i.id) ? x.filter(y => y !== i.id) : [...x, i.id])} onOpen={() => navigate(invoiceUrl(i.id))} onAccount={() => navigate(practiceUrl(i.accountId))} />)}</tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Hint>Tick invoices to approve, send a copy{tool ? '' : ', mark paid'} or archive. To send a practice everything it owes, open the practice and use Send statement.</Hint>
        <button className="text-[11px] font-semibold text-[#4D8EF7] hover:underline" onClick={() => { setArchived(a => !a); setTicked([]); }}>{archived ? 'Back to invoices' : `Show archived (${s.invoices.filter(i => i.archived || i.status === 'void').length})`}</button>
      </div>
      {sending && <SendInvoicesModal invoices={sel} to={[...new Set(sel.flatMap(i => account(s, i.accountId)?.emails ?? []))]} title={`Send a copy of ${pl(sel.filter(i => i.number).length, 'invoice')}`} onClose={() => { setSending(false); setTicked([]); }} />}
    </div>
  );
}

function Row({ i, ticked, onTick, onOpen, onAccount, readOnly }: { i: Invoice; ticked: boolean; onTick: () => void; onOpen: () => void; onAccount: () => void; readOnly: boolean }) {
  const s = useBilling();
  const st = plainStatus(i);
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-[#FAFAFD]">
      {!readOnly && <td className={td} onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${i.number ?? i.caseId}`} checked={ticked} onChange={onTick} /></td>}
      <td className={`${td} font-mono font-semibold whitespace-nowrap`}>{i.number ?? <span className="font-sans text-[#717182]">Not sent</span>}</td>
      <td className={td}><button className="hover:underline text-left" onClick={e => { e.stopPropagation(); onAccount(); }}>{account(s, i.accountId)?.name}</button></td>
      <td className={td}>{i.cases?.length ? <span><span className="font-semibold">Month invoice</span> <span className="text-[#717182]">· {pl(i.cases.length, 'case')}</span></span> : <><span>{i.patient}</span> <span className="text-[#717182]">· {i.dentist}</span></>}{i.flags[0] && <span className="block text-[11px] text-[#B45309]">{i.flags[0].message}</span>}</td>
      <td className={`${td} whitespace-nowrap`}>{fmtShort(i.issuedAt ?? i.createdAt)}</td>
      <td className={td}><Pill tone={TONE[st]}>{st}</Pill></td>
      <td className={`${td} text-right whitespace-nowrap`}>{money(totals(i).gross, i.currency)}</td>
      <td className={`${td} text-right whitespace-nowrap ${isOverdue(i) ? 'text-[#C62828] font-semibold' : ''}`}>{i.issuedAt && outstanding(i) > 0 ? money(outstanding(i), i.currency) : '—'}</td>
    </tr>
  );
}
