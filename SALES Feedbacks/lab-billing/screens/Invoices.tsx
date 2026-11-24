import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, CheckCheck, CircleDollarSign, Download, FileText, Search } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import type { Invoice } from '../types';
import { account, isOverdue, outstanding, toInvoice, toolName, totals } from '../engine';
import { fmtShort, money, pl, today } from '../format';
import { approveInvoices, archiveInvoices, invoiceFromPot, markPaid, useBilling } from '../billingStore';
import { pendingInvoices } from '../insights';
import { saveBlob } from '../../bulk-actions/zip';
import { useReadOnly } from '../BillingApp';
import { btn, btnPrimary, Card, Empty, InvoiceStatusPill, Pill, td, th } from '../ui';

// ── Invoices: one list with tabs (Requirements v2, I1–I6) ────────────────────
// To invoice · Waiting · Sent · Paid · Archived. "To invoice" is the holding
// pot: shipped, unbilled cases of month-end accounts (and cases whose invoice
// was voided in the accounting tool), per account with a running total.
// "Invoice month" makes one invoice per bill-to account from the ticked cases.

type Tab = 'to-invoice' | 'waiting' | 'sent' | 'paid' | 'archived';

export default function Invoices() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const readOnly = useReadOnly();
  const [params, setParams] = useSearchParams();
  const pot = toInvoice(s);
  const waiting = pendingInvoices(s);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    ...(readOnly ? [] : [{ id: 'to-invoice' as Tab, label: 'To invoice', count: pot.length }, { id: 'waiting' as Tab, label: 'Waiting', count: waiting.length }]),
    { id: 'sent', label: 'Sent' }, { id: 'paid', label: 'Paid' }, { id: 'archived', label: 'Archived' },
  ];
  const tab = (tabs.find(t => t.id === params.get('tab'))?.id ?? (!readOnly && pot.length ? 'to-invoice' : 'sent')) as Tab;
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const [q, setQ] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(params.get('overdue') === '1');
  const [ticked, setTicked] = useState<string[]>([]);
  const tool = toolName(s);

  const list = useMemo(() => {
    const t = today();
    const issued = s.invoices.filter(i => i.issuedAt || i.status === 'void');
    const byTab = tab === 'sent' ? issued.filter(i => !i.archived && (i.status === 'sent' || i.status === 'part-paid') && (!overdueOnly || isOverdue(i, t)))
      : tab === 'paid' ? issued.filter(i => !i.archived && i.status === 'paid')
        : tab === 'archived' ? issued.filter(i => i.archived || i.status === 'void')
          : tab === 'waiting' ? waiting : [];
    return byTab.filter(i => !q || `${i.number} ${i.caseId} ${i.patient} ${i.practice} ${i.dentist} ${account(s, i.accountId)?.name}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt));
  }, [s, tab, q, overdueOnly, waiting]);

  const exportCsv = () => {
    const rows = [['Number', 'Date', 'Account', 'For', 'Status', 'Total', 'Owed', 'Currency'], ...list.map(i => [i.number ?? '', i.issuedAt ?? '', account(s, i.accountId)?.name ?? '', i.cases?.length ? `${i.cases.length} cases` : `${i.caseId} ${i.patient}`, i.status, totals(i).gross.toFixed(2), outstanding(i).toFixed(2), i.currency])];
    saveBlob(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), `invoices-${tab}-${today()}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#F0EFF6] pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setTicked([]); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === t.id ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:bg-[#F8F9FC]'}`}>
            {t.label}{t.count ? <span className="ml-1.5 text-[10px] opacity-80">{t.count}</span> : null}
          </button>
        ))}
        <span className="flex-1" />
        {tab !== 'to-invoice' && <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A0A0B0]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search number, case, patient, practice…" aria-label="Search invoices" className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-64 focus:outline-none focus:border-[#4D8EF7]" /></div>}
        {tab !== 'to-invoice' && <button className={btn} onClick={exportCsv}><Download className="w-3.5 h-3.5" /> Export</button>}
      </div>

      {tab === 'to-invoice' && <ToInvoice />}

      {tab !== 'to-invoice' && (
        <Card pad={false}
          title={{ waiting: 'Waiting for approval', sent: 'Sent', paid: 'Paid', archived: 'Archived and void' }[tab]}
          sub={{
            waiting: 'Flagged, or in the first 30 days after go-live. Approve in bulk; the reasons are on Billing home.',
            sent: tool ? `Owed. ${tool} tells us when each is paid; overdue shows in red.` : 'Owed. Mark them paid when the money arrives (no accounting tool connected).',
            paid: 'Settled. Archive them to clear the list; they stay in statements and reports.',
            archived: 'Cleared from view, and voided invoices. Still in statements and reports where they count.',
          }[tab]}
          actions={!readOnly && <>
            {tab === 'sent' && <label className="inline-flex items-center gap-1.5 text-xs text-[#5A5568]"><input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} /> Overdue only</label>}
            {tab === 'waiting' && <button className={btnPrimary} disabled={!ticked.length} onClick={() => { const n = approveInvoices(ticked); setTicked([]); toast.success(`${pl(n, 'invoice')} approved and sent`); }}><CheckCheck className="w-3.5 h-3.5" /> Approve {ticked.length || ''}</button>}
            {tab === 'sent' && !tool && <button className={btnPrimary} disabled={!ticked.length} onClick={() => { const n = markPaid(ticked); setTicked([]); toast.success(`${pl(n, 'invoice')} marked paid`); }}><CircleDollarSign className="w-3.5 h-3.5" /> Mark paid {ticked.length || ''}</button>}
            {tab === 'paid' && <button className={btn} disabled={!ticked.length} onClick={() => { const n = archiveInvoices(ticked); setTicked([]); toast.success(`${pl(n, 'invoice')} archived`); }}><Archive className="w-3.5 h-3.5" /> Archive {ticked.length || ''}</button>}
            {tab === 'archived' && <button className={btn} disabled={!ticked.length} onClick={() => { const n = archiveInvoices(ticked, false); setTicked([]); toast.success(`${pl(n, 'invoice')} back in the list`); }}>Unarchive {ticked.length || ''}</button>}
          </>}
        >
          {list.length === 0 ? <Empty>{tab === 'waiting' ? 'Nothing waiting: every invoice has gone out.' : 'Nothing here.'}</Empty> : (
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              <table className="w-full min-w-[760px]">
                <thead className="sticky top-0"><tr>
                  {!readOnly && <th className={th}><input type="checkbox" aria-label="Select all" checked={ticked.length === list.length} onChange={() => setTicked(ticked.length === list.length ? [] : list.map(i => i.id))} /></th>}
                  <th className={th}>Number</th><th className={th}>Date</th><th className={th}>For</th><th className={th}>Account</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Owed</th>
                </tr></thead>
                <tbody>
                  {list.slice(0, 250).map(i => <Row key={i.id} i={i} ticked={ticked.includes(i.id)} onTick={() => setTicked(t => t.includes(i.id) ? t.filter(x => x !== i.id) : [...t, i.id])} onOpen={() => navigate(`/growth/billing/invoices/${i.id}`)} readOnly={readOnly} />)}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ i, ticked, onTick, onOpen, readOnly }: { i: Invoice; ticked: boolean; onTick: () => void; onOpen: () => void; readOnly: boolean }) {
  const s = useBilling();
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-[#FAFAFD]">
      {!readOnly && <td className={td} onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${i.number ?? i.caseId}`} checked={ticked} onChange={onTick} /></td>}
      <td className={`${td} font-mono font-semibold whitespace-nowrap`}>{i.number ?? 'Draft'}</td>
      <td className={`${td} whitespace-nowrap`}>{fmtShort(i.issuedAt ?? i.createdAt)}</td>
      <td className={td}>{i.cases?.length ? <span><span className="font-semibold">Month invoice</span> <span className="text-[#717182]">· {pl(i.cases.length, 'case')}</span></span> : <><span className="font-mono">{i.caseId}</span> <span className="text-[#717182]">{i.patient}</span>{i.stage && <span className="text-[#717182]"> · {i.stage}</span>}</>}</td>
      <td className={td}>{account(s, i.accountId)?.name}</td>
      <td className={td}><InvoiceStatusPill status={i.status} overdue={isOverdue(i)} /></td>
      <td className={`${td} text-right whitespace-nowrap`}>{money(totals(i).gross, i.currency)}</td>
      <td className={`${td} text-right whitespace-nowrap ${isOverdue(i) ? 'text-[#C62828] font-semibold' : ''}`}>{outstanding(i) ? money(outstanding(i), i.currency) : '—'}</td>
    </tr>
  );
}

/** The holding pot, per bill-to account, with tick boxes to leave cases out. */
export function ToInvoice() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const pot = toInvoice(s);
  const [left, setLeft] = useState<string[]>([]); // ticked off = left out
  const groups = [...pot.reduce((m, x) => m.set(x.meta.accountId, [...(m.get(x.meta.accountId) ?? []), x]), new Map<string, typeof pot>())];
  const run = (accId: string, cases: typeof pot) => {
    const ids = cases.filter(x => !left.includes(x.c.id)).map(x => x.c.id);
    if (!ids.length) return 0;
    return invoiceFromPot(accId, ids).length;
  };
  if (!groups.length) return <Card><Empty>Nothing to invoice. Shipped cases of month-end accounts collect here until you press Invoice month; everyone else is invoiced on Shipped.</Empty></Card>;
  const monthEndGroups = groups.filter(([id]) => account(s, id)?.invoiceMode === 'month-end');
  return (
    <div className="space-y-4">
      {monthEndGroups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F5F9FF] border border-[#DCE8FF] rounded-xl px-4 py-3">
          <p className="text-xs text-[#1565C0]"><b>Invoice month</b> makes one invoice per account from the ticked cases, writes its number onto each case, emails the billing contact{toolName(s) ? ` and posts it to ${toolName(s)}` : ''}.</p>
          <button className={btnPrimary} onClick={() => { const n = monthEndGroups.reduce((k, [id, cs]) => k + run(id, cs), 0); toast.success(`${pl(n, 'month invoice')} created`); }}><FileText className="w-3.5 h-3.5" /> Invoice month for all ({monthEndGroups.length})</button>
        </div>
      )}
      {groups.map(([accId, cases]) => {
        const acc = account(s, accId);
        const monthly = acc?.invoiceMode === 'month-end';
        const on = cases.filter(x => !left.includes(x.c.id));
        const total = on.reduce((n, x) => n + x.value, 0);
        return (
          <Card key={accId} pad={false}
            title={<span className="inline-flex items-center gap-2"><button className="hover:underline" onClick={() => navigate(`/growth/billing/accounts/${accId}`)}>{acc?.name}</button> <Pill tone={monthly ? 'blue' : 'gray'}>{monthly ? 'Invoiced monthly' : 'Shipped, not invoiced yet'}</Pill></span>}
            sub={`${pl(on.length, 'case')} ticked · ${money(total, acc?.currency)} so far · goes to ${acc?.emails.join(', ') || 'no billing email yet'}`}
            actions={<button className={btnPrimary} disabled={!on.length} onClick={() => { const n = run(accId, cases); toast.success(monthly ? `Month invoice created for ${acc?.name}` : `${pl(n, 'invoice')} created`); }}>{monthly ? `Invoice month (${on.length})` : `Invoice ${on.length}`}</button>}
          >
            <table className="w-full">
              <thead><tr><th className={th} /><th className={th}>Shipped</th><th className={th}>Case</th><th className={th}>Dentist</th><th className={th}>Work</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody>
                {cases.map(x => (
                  <tr key={x.c.id} className={left.includes(x.c.id) ? 'opacity-50' : ''}>
                    <td className={td}><input type="checkbox" aria-label={`Include ${x.c.id}`} checked={!left.includes(x.c.id)} onChange={() => setLeft(l => l.includes(x.c.id) ? l.filter(y => y !== x.c.id) : [...l, x.c.id])} /></td>
                    <td className={`${td} whitespace-nowrap`}>{fmtShort(x.meta.dispatchedAt)}</td>
                    <td className={td}><button className="font-mono font-semibold hover:underline" onClick={() => navigate(`/growth/cases/${x.c.id}?sf=billing`)}>{x.c.id}</button> <span className="text-[#717182]">{x.c.patientName}</span></td>
                    <td className={td}>{x.c.dentist}</td>
                    <td className={td}>{x.c.services.join(', ')}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>{money(x.value, acc?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
