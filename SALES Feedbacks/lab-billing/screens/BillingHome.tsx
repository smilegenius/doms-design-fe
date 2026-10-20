import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, Check, CheckCheck, Eye, Lock, PauseCircle, PlayCircle, Search, Send, Sparkles, X } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { printPages } from '../../bulk-actions/printForms';
import type { BillingState, Invoice } from '../types';
import { account, exposure, isOverdue, outstanding, totals } from '../engine';
import { daysBetween, fmtDate, fmtMonth, fmtShort, money, monthOf, pl, today } from '../format';
import { approveInvoices, dismiss, previewStatements, releaseAccount, releaseCase, sendStatements, statementDay, useBilling } from '../billingStore';
import { assists, headline, heldCases, pendingInvoices } from '../insights';
import { StatementDoc } from '../BillingDocs';
import { btn, btnPrimary, Card, Empty, InvoiceStatusPill, Note, Pill, Stat, td, th } from '../ui';

// ── 1. Billing home: the admin's daily inbox ─────────────────────────────────

const TONE = { red: 'border-l-[#E53935]', amber: 'border-l-[#F59E0B]', blue: 'border-l-[#4D8EF7]' };

export default function BillingHome() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const h = headline(s);
  const pending = pendingInvoices(s);
  const [ticked, setTicked] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'overdue' | 'paid' | 'void'>(() => (new URLSearchParams(window.location.search).get('filter') as never) || 'all');
  const [q, setQ] = useState('');
  const [statements, setStatements] = useState(false);
  const nudges = assists(s);
  const held = heldCases(s);
  const sd = statementDay(s);
  const daysToSd = daysBetween(today(), sd);
  const blocked = (i: Invoice) => i.lines.some(l => l.source.kind === 'unmapped');

  function approve(ids: string[]) {
    const ok = ids.filter(id => { const i = s.invoices.find(x => x.id === id); return i && !blocked(i); });
    if (ok.length < ids.length) toast.error(`${ids.length - ok.length} need an order type mapped first`);
    if (!ok.length) return;
    const n = approveInvoices(ok);
    setTicked([]);
    toast.success(`${pl(n, 'invoice')} approved, posted to Xero and emailed`);
  }

  const list = useMemo(() => {
    const t = today();
    return s.invoices.filter(i => i.issuedAt || i.status === 'void').filter(i =>
      filter === 'all' ? true : filter === 'overdue' ? isOverdue(i, t) : filter === 'sent' ? (i.status === 'sent' || i.status === 'part-paid') && !isOverdue(i, t) : i.status === filter)
      .filter(i => !q || `${i.number} ${i.caseId} ${i.patient} ${i.practice} ${i.dentist}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''));
  }, [s, filter, q]);

  const heldByAccount = [...held.reduce((m, c) => m.set(s.cases[c.id].accountId, [...(m.get(s.cases[c.id].accountId) ?? []), c]), new Map<string, typeof held>())];
  const ym = monthOf(today());
  const previews = s.statements.filter(x => x.period === ym && x.status === 'preview');
  const sentThisMonth = s.statements.filter(x => x.period === ym && x.status === 'sent').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Invoiced this month" value={money(h.invoicedThisMonth, 'GBP', { round: true })} sub={`${s.invoices.filter(i => i.issuedAt && monthOf(i.issuedAt) === ym).length} invoices`} />
        <Stat label="Paid this month" value={money(h.paidThisMonth, 'GBP', { round: true })} tone="green" sub="Read back from Xero" />
        <Stat label="Pending" value={String(h.pending)} sub={`${money(h.pendingVal, 'GBP', { round: true })} waiting or flagged`} tone={h.pending ? 'amber' : undefined} onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth' })} />
        <Stat label="Owed to the lab" value={money(h.owed, 'GBP', { round: true })} sub={<span className="text-[#C62828]">{money(h.overdue, 'GBP', { round: true })} overdue</span>} onClick={() => setFilter('overdue')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <div id="needs-you">
          <Card
            title={<span className="inline-flex items-center gap-2">Needs you <Pill tone={pending.length ? 'amber' : 'green'}>{pending.length}</Pill></span>}
            sub={s.settings.approval === 'review-all' ? 'Every invoice waits for approval (Billing settings).' : 'Everything else went out on its own. These were flagged or are waiting for approval.'}
            actions={pending.length > 0 && <>
              <button className={btn} onClick={() => setTicked(ticked.length === pending.length ? [] : pending.map(i => i.id))}>{ticked.length === pending.length ? 'Clear' : 'Select all'}</button>
              <button className={btnPrimary} disabled={!ticked.length} onClick={() => approve(ticked)}><CheckCheck className="w-3.5 h-3.5" /> Approve {ticked.length || ''}</button>
            </>}
            pad={false}
          >
            {pending.length === 0 ? <Empty>Nothing waiting. Every invoice has gone out.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead><tr><th className={th} /><th className={th}>Case</th><th className={th}>Account</th><th className={th}>Why</th><th className={`${th} text-right`}>Amount</th><th className={th} /></tr></thead>
                  <tbody>
                    {pending.map(i => {
                      const acc = account(s, i.accountId);
                      return (
                        <tr key={i.id} className="hover:bg-[#FAFAFD]">
                          <td className={td}><input type="checkbox" checked={ticked.includes(i.id)} onChange={() => setTicked(t => t.includes(i.id) ? t.filter(x => x !== i.id) : [...t, i.id])} /></td>
                          <td className={td}><button onClick={() => navigate(`/growth/billing/invoices/${i.id}`)} className="text-left"><span className="font-mono font-semibold">{i.caseId}</span><span className="block text-[#717182]">{i.patient}{i.stage ? ` · ${i.stage}` : ''}</span></button></td>
                          <td className={td}>{acc?.name}{acc?.paused && <Pill tone="red"><PauseCircle className="w-3 h-3" /> On hold</Pill>}</td>
                          <td className={td}>
                            {i.flags.length ? i.flags.map((f, k) => <p key={k} className="flex items-start gap-1 text-[#B45309]"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{f.message}</p>) : <span className="text-[#717182]">Waiting for approval</span>}
                          </td>
                          <td className={`${td} text-right whitespace-nowrap font-semibold`}>{money(totals(i).gross, i.currency)}</td>
                          <td className={`${td} text-right whitespace-nowrap`}>
                            <button className={`${btn} mr-1.5`} onClick={() => navigate(`/growth/billing/invoices/${i.id}`)}>Open</button>
                            <button className={btnPrimary} disabled={blocked(i)} title={blocked(i) ? 'Map the order type first' : undefined} onClick={() => approve([i.id])}><Check className="w-3.5 h-3.5" /> Approve</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          </div>

          <Card
            title="Invoices"
            sub="One per case, posted to Xero and emailed when approved. Payments are read back from Xero."
            actions={<div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A0A0B0]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search number, case, patient…" className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-56 focus:outline-none focus:border-[#4D8EF7]" /></div>}
            pad={false}
          >
            <div className="flex flex-wrap gap-1 px-4 pt-3">
              {(['all', 'sent', 'overdue', 'paid', 'void'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${filter === f ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] text-[#5A5568] hover:bg-[#F8F9FC]'}`}>{{ all: 'All', sent: 'Sent', overdue: 'Overdue', paid: 'Paid', void: 'Void' }[f]}</button>
              ))}
            </div>
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto mt-2">
              <table className="w-full min-w-[720px]">
                <thead className="sticky top-0"><tr><th className={th}>Number</th><th className={th}>Date</th><th className={th}>Case</th><th className={th}>Account</th><th className={th}>Status</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Owed</th></tr></thead>
                <tbody>
                  {list.slice(0, 150).map(i => (
                    <tr key={i.id} onClick={() => navigate(`/growth/billing/invoices/${i.id}`)} className="cursor-pointer hover:bg-[#FAFAFD]">
                      <td className={`${td} font-mono font-semibold whitespace-nowrap`}>{i.number}</td>
                      <td className={`${td} whitespace-nowrap`}>{fmtShort(i.issuedAt)}</td>
                      <td className={td}><span className="font-mono">{i.caseId}</span> <span className="text-[#717182]">{i.patient}</span>{i.stage && <span className="text-[#717182]"> · {i.stage}</span>}</td>
                      <td className={td}>{account(s, i.accountId)?.name}</td>
                      <td className={td}><InvoiceStatusPill status={i.status} overdue={isOverdue(i)} /></td>
                      <td className={`${td} text-right whitespace-nowrap`}>{money(totals(i).gross, i.currency)}</td>
                      <td className={`${td} text-right whitespace-nowrap ${isOverdue(i) ? 'text-[#C62828] font-semibold' : ''}`}>{outstanding(i) ? money(outstanding(i), i.currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!list.length && <Empty>No invoices match.</Empty>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={<span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[#7C3AED]" /> Smart assists</span>} sub="Exceptions to look at. Each links to the fix." pad={false}>
            {nudges.length === 0 ? <Empty>All clear.</Empty> : (
              <ul className="divide-y divide-[#F0EFF6] max-h-[440px] overflow-y-auto">
                {nudges.map(n => (
                  <li key={n.id} className={`px-4 py-2.5 border-l-[3px] ${TONE[n.tone]}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717182]">{n.kind}</p>
                      <button onClick={() => dismiss(n.id)} title="Dismiss" className="text-[#A0A0B0] hover:text-[#030213]"><X className="w-3 h-3" /></button>
                    </div>
                    <p className="text-xs font-semibold text-[#030213]">{n.title}</p>
                    <p className="text-xs text-[#5A5568] mt-0.5">{n.message}</p>
                    <button onClick={() => navigate(n.link)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:underline">Fix it <ArrowRight className="w-3 h-3" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={<span className="inline-flex items-center gap-1.5"><PauseCircle className="w-4 h-4 text-[#C62828]" /> On hold <Pill tone={held.length ? 'red' : 'gray'}>{held.length}</Pill></span>} sub="New cases from accounts at their limit. Work already in progress carries on." pad={false}>
            {heldByAccount.length === 0 ? <Empty>No cases on hold.</Empty> : heldByAccount.map(([accId, cs]) => {
              const acc = account(s, accId)!;
              const ex = exposure(s, accId);
              return (
                <div key={accId} className="px-4 py-3 border-b border-[#F0EFF6] last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button onClick={() => navigate(`/growth/billing/accounts/${accId}`)} className="text-xs font-semibold text-[#030213] hover:underline">{acc.name}</button>
                      <p className="text-[11px] text-[#717182]">{money(ex.total, acc.currency, { round: true })} against a {money(acc.limit?.amount ?? 0, acc.currency, { round: true })} limit</p>
                    </div>
                    <button className={btn} onClick={() => { releaseAccount(accId); toast.success(`Hold lifted on ${acc.name}: ${pl(cs.length, 'case')} moved into production`); }}><PlayCircle className="w-3.5 h-3.5" /> Lift hold</button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {cs.map(c => (
                      <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate"><span className="font-mono font-semibold">{c.id}</span> <span className="text-[#717182]">{c.patientName} · {c.services.join(', ')}</span></span>
                        <button className="text-[11px] font-semibold text-[#4D8EF7] hover:underline flex-shrink-0" onClick={() => { releaseCase(c.id); toast.success(`${c.id} released: it moves into production. The account stays on hold.`); }}>Release this case</button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </Card>

          <Card title={<span className="inline-flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-[#4D8EF7]" /> Month end</span>} sub={`Statement day: ${fmtDate(sd)}${daysToSd >= 0 ? ` (${daysToSd === 0 ? 'today' : `in ${pl(daysToSd, 'day')}`})` : ''}`}>
            <div className="space-y-2.5">
              {pending.length > 0 && <Note tone={daysToSd <= 2 ? 'red' : 'amber'}>{pl(pending.length, 'invoice')} still waiting. Approve {pending.length === 1 ? 'it' : 'them'} before {fmtShort(sd)} to make this month's statements.</Note>}
              <p className="text-xs text-[#5A5568]">One statement per billing account, built from Xero so it includes old-system balances. {s.firstStatementPreviewed ? 'They go out automatically on the statement day.' : 'The first one is previewed by an admin before it goes.'}</p>
              {sentThisMonth > 0 && <p className="text-xs text-[#2E7D32]">{pl(sentThisMonth, 'statement')} for {fmtMonth(ym)} sent.</p>}
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => { const n = previewStatements(); setStatements(true); toast.success(`${pl(n, 'statement')} ready to preview`); }}><Eye className="w-3.5 h-3.5" /> Preview {fmtMonth(ym)} statements</button>
                {previews.length > 0 && <button className={btnPrimary} onClick={() => setStatements(true)}><Send className="w-3.5 h-3.5" /> Review & send {previews.length}</button>}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {statements && <StatementsModal s={s} onClose={() => setStatements(false)} />}
    </div>
  );
}

function StatementsModal({ s, onClose }: { s: BillingState; onClose: () => void }) {
  const { toast } = useToast();
  const ym = monthOf(today());
  const list = s.statements.filter(x => x.period === ym);
  const [open, setOpen] = useState(list[0]?.id);
  const st = list.find(x => x.id === open);
  return (
    <Modal isOpen onClose={onClose} size="xl" title={`Statements · ${fmtMonth(ym)}`} footer={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[#717182]"><Lock className="w-3 h-3 inline -mt-0.5" /> Dentists who pay directly get their own; their cases aren't on the practice's statement.</span>
        <div className="flex gap-2">
          {st && <button className={btn} onClick={() => printPages([{ key: st.id, node: <StatementDoc st={st} acc={account(s, st.accountId)} /> }], 'Statement')}>Print this one</button>}
          <button className={btnPrimary} disabled={!list.some(x => x.status === 'preview')} onClick={() => { const n = sendStatements(); toast.success(`${pl(n, 'statement')} sent`); onClose(); }}><Send className="w-3.5 h-3.5" /> Send {list.filter(x => x.status === 'preview').length} statements</button>
        </div>
      </div>
    }>
      <div className="flex flex-col md:flex-row gap-4 min-h-[420px]">
        <ul className="md:w-56 flex-shrink-0 space-y-1 max-h-[460px] overflow-y-auto">
          {list.map(x => (
            <li key={x.id}>
              <button onClick={() => setOpen(x.id)} className={`w-full text-left px-2.5 py-2 rounded-lg text-xs ${open === x.id ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}>
                <span className="block font-semibold text-[#030213] truncate">{account(s, x.accountId)?.name}</span>
                <span className="text-[#717182]">{money(x.closing, x.currency)} · {x.status === 'sent' ? 'sent' : 'preview'}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex-1 min-w-0 border border-[#E0E0E6] rounded-xl p-5 overflow-y-auto max-h-[460px]">{st ? <StatementDoc st={st} acc={account(s, st.accountId)} /> : <Empty>No statements.</Empty>}</div>
      </div>
    </Modal>
  );
}
