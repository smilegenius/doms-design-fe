import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, Check, CheckCheck, CloudOff, Landmark, PauseCircle, PlayCircle, RefreshCw, Send, X } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import type { BillingState, Invoice, SyncIssue } from '../types';
import { account, exposure, toInvoice, toolName, totals } from '../engine';
import { daysBetween, fmtDate, fmtShort, money, monthOf, pl, today } from '../format';
import { approveInvoices, confirmBankMatch, dismiss, likelyMatches, releaseAccount, releaseCase, resolveIssue, statementDay, useBilling } from '../billingStore';
import { assists, headline, heldCases, pendingInvoices } from '../insights';
import { btn, btnPrimary, Card, Empty, Note, Pill, Stat, td, th } from '../ui';

// ── Billing home: one list for everything that needs a person ────────────────
// Requirements v2: after the first 30 days a normal month costs one extra
// click ("Send statements"). Flag-free invoices send themselves; Needs you
// holds the rest in one place: invoices waiting, sync and payment problems,
// the smart-assist nudges and accounts on hold. Empty on a normal day.

const TONE = { red: 'border-l-[#E53935]', amber: 'border-l-[#F59E0B]', blue: 'border-l-[#4D8EF7]' };

export default function BillingHome() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const h = headline(s);
  const pending = pendingInvoices(s);
  const [ticked, setTicked] = useState<string[]>([]);
  // ?filter=pending (What's new, month-end check) jumps to Needs you.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('filter') !== 'pending') return;
    const t = window.setTimeout(() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    return () => window.clearTimeout(t);
  }, []);
  // Flags on waiting invoices already show in their row: list each thing once.
  const nudges = assists(s).filter(n => !/^(unusual-price|nhs-unclear|remake-inv|design-diff|review|new-order-type|type)-/.test(n.id));
  const held = s.settings.limitsOn ? heldCases(s) : [];
  const sd = statementDay(s);
  const daysToSd = daysBetween(today(), sd);
  const pot = toInvoice(s);
  const potAccounts = new Set(pot.map(x => x.meta.accountId)).size;
  const ym = monthOf(today());
  const statementsSent = s.statements.filter(x => x.period === ym && x.status === 'sent').length;
  const blocked = (i: Invoice) => i.lines.some(l => l.source.kind === 'unmapped');
  const tool = toolName(s);
  const total = pending.length + s.issues.length + nudges.length + held.length;

  function approve(ids: string[]) {
    const ok = ids.filter(id => { const i = s.invoices.find(x => x.id === id); return i && !blocked(i); });
    if (ok.length < ids.length) toast.error(`${ids.length - ok.length} need an order type mapped first`);
    if (!ok.length) return;
    const n = approveInvoices(ok);
    setTicked([]);
    toast.success(`${pl(n, 'invoice')} approved${tool ? `, posted to ${tool}` : ''} and emailed`);
  }

  const heldByAccount = [...held.reduce((m, c) => m.set(s.cases[c.id].accountId, [...(m.get(s.cases[c.id].accountId) ?? []), c]), new Map<string, typeof held>())];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Invoiced this month" value={money(h.invoicedThisMonth, 'GBP', { round: true })} sub={`${s.invoices.filter(i => i.issuedAt && monthOf(i.issuedAt) === ym).length} invoices`} onClick={() => navigate('/growth/billing/invoices?tab=sent')} />
        <Stat label="Paid this month" value={money(h.paidThisMonth, 'GBP', { round: true })} tone="green" sub={tool ? `Read back from ${tool}` : 'Marked paid'} onClick={() => navigate('/growth/billing/invoices?tab=paid')} />
        <Stat label="Needs you" value={String(total)} sub={total ? `${pl(pending.length, 'invoice')} waiting · ${pl(s.issues.length + nudges.length + held.length, 'other item')}` : 'Empty: nothing to do'} tone={total ? 'amber' : 'green'} onClick={() => document.getElementById('needs-you')?.scrollIntoView({ behavior: 'smooth' })} />
        <Stat label="Owed to the lab" value={money(h.owed, 'GBP', { round: true })} sub={<span className="text-[#C62828]">{money(h.overdue, 'GBP', { round: true })} overdue</span>} onClick={() => navigate('/growth/billing/invoices?tab=sent&overdue=1')} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2" id="needs-you">
          <Card
            title={<span className="inline-flex items-center gap-2">Needs you <Pill tone={total ? 'amber' : 'green'}>{total}</Pill></span>}
            sub={total ? 'Everything else went out on its own. Act on each item, or dismiss it.' : undefined}
            pad={false}
          >
            {total === 0 && <Empty>Nothing needs you. Invoices are going out and payments are coming back on their own.</Empty>}

            {pending.length > 0 && (
              <Section
                title={`Invoices waiting (${pending.length})`}
                sub={s.settings.approval === 'review-all' ? 'Every invoice waits for approval (Settings).' : 'Flagged, or in the first 30 days after go-live.'}
                actions={<>
                  <button className={btn} onClick={() => setTicked(ticked.length === pending.length ? [] : pending.map(i => i.id))}>{ticked.length === pending.length ? 'Clear' : 'Select all'}</button>
                  <button className={btnPrimary} disabled={!ticked.length} onClick={() => approve(ticked)}><CheckCheck className="w-3.5 h-3.5" /> Approve {ticked.length || ''}</button>
                </>}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead><tr><th className={th} /><th className={th}>Invoice for</th><th className={th}>Account</th><th className={th}>Why it waits</th><th className={`${th} text-right`}>Amount</th><th className={th} /></tr></thead>
                    <tbody>
                      {pending.map(i => {
                        const acc = account(s, i.accountId);
                        return (
                          <tr key={i.id} className="hover:bg-[#FAFAFD]">
                            <td className={td}><input type="checkbox" checked={ticked.includes(i.id)} onChange={() => setTicked(t => t.includes(i.id) ? t.filter(x => x !== i.id) : [...t, i.id])} aria-label={`Select ${i.caseId}`} /></td>
                            <td className={td}><button onClick={() => navigate(`/growth/billing/invoices/${i.id}`)} className="text-left">{i.cases?.length ? <><span className="font-semibold">Month invoice</span><span className="block text-[#717182]">{pl(i.cases.length, 'case')}</span></> : <><span className="font-mono font-semibold">{i.caseId}</span><span className="block text-[#717182]">{i.patient}{i.stage ? ` · ${i.stage}` : ''}</span></>}{i.keepIssuedAt && <span className="block text-[11px] text-[#7C3AED]">Edit of {i.replaces}</span>}</button></td>
                            <td className={td}>{acc?.name}{acc?.paused && s.settings.limitsOn && <Pill tone="red"><PauseCircle className="w-3 h-3" /> On hold</Pill>}</td>
                            <td className={td}>{i.flags.length ? i.flags.map((f, k) => <p key={k} className="flex items-start gap-1 text-[#B45309]"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{f.message}</p>) : <span className="text-[#717182]">{i.keepIssuedAt ? 'Change a line if needed, then approve' : 'Waiting for approval'}</span>}</td>
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
              </Section>
            )}

            {s.issues.length > 0 && (
              <Section title={`Sync and payments (${s.issues.length})`} sub={tool ? `Things ${tool} changed, or that didn't sync.` : 'Bank payments that need a match.'}>
                <ul className="divide-y divide-[#F0EFF6]">{s.issues.map(is => <IssueRow key={is.id} s={s} is={is} />)}</ul>
              </Section>
            )}

            {nudges.length > 0 && (
              <Section title={`To check (${nudges.length})`} sub="Spotted for you. Each links to the fix.">
                <ul className="divide-y divide-[#F0EFF6]">
                  {nudges.map(n => (
                    <li key={n.id} className={`px-4 py-2.5 border-l-[3px] ${TONE[n.tone]} flex items-start gap-3`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#717182] mr-1.5">{n.kind}</span><span className="font-semibold text-[#030213]">{n.title}</span></p>
                        <p className="text-xs text-[#5A5568] mt-0.5">{n.message}</p>
                      </div>
                      <button onClick={() => navigate(n.link)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:underline flex-shrink-0">Fix it <ArrowRight className="w-3 h-3" /></button>
                      <button onClick={() => dismiss(n.id)} title="Dismiss" aria-label="Dismiss" className="text-[#A0A0B0] hover:text-[#030213] flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {heldByAccount.length > 0 && (
              <Section title={`On hold (${held.length})`} sub="New cases from accounts at their credit limit. Work already in progress carries on.">
                {heldByAccount.map(([accId, cs]) => {
                  const acc = account(s, accId)!;
                  const ex = exposure(s, accId);
                  return (
                    <div key={accId} className="px-4 py-3 border-b border-[#F0EFF6] last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button onClick={() => navigate(`/growth/billing/accounts/${accId}`)} className="text-xs font-semibold text-[#030213] hover:underline">{acc.name}</button>
                          <p className="text-[11px] text-[#717182]">{money(ex.total, acc.currency, { round: true })} against a {money(acc.limit?.amount ?? 0, acc.currency, { round: true })} limit. A payment releases them automatically.</p>
                        </div>
                        <button className={btn} onClick={() => { releaseAccount(accId); toast.success(`Hold lifted on ${acc.name}: ${pl(cs.length, 'case')} moved into production`); }}><PlayCircle className="w-3.5 h-3.5" /> Lift hold</button>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {cs.map(c => (
                          <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate"><span className="font-mono font-semibold">{c.id}</span> <span className="text-[#717182]">{c.patientName} · {c.services.join(', ')}</span></span>
                            <button className="text-[11px] font-semibold text-[#4D8EF7] hover:underline flex-shrink-0" onClick={() => { releaseCase(c.id); toast.success(`${c.id} released`); }}>Release this case</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </Section>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={<span className="inline-flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-[#4D8EF7]" /> This month</span>} sub={`Statement day: ${fmtDate(sd)}${daysToSd >= 0 ? ` (${daysToSd === 0 ? 'today' : `in ${pl(daysToSd, 'day')}`})` : ''}`}>
            <ol className="space-y-3">
              <li className="flex items-start gap-2.5">
                <Step n={1} done={!pot.length} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#030213]">Invoice month</p>
                  {pot.length
                    ? <p className="text-[11px] text-[#5A5568]">{pl(pot.length, 'shipped case')} for {pl(potAccounts, 'month-end account')}, {money(pot.reduce((n, x) => n + x.value, 0), 'GBP', { round: true })}.</p>
                    : <p className="text-[11px] text-[#717182]">Nothing waiting. Per-case accounts invoice on Shipped.</p>}
                  {pot.length > 0 && <button className={`${btnPrimary} mt-1.5`} onClick={() => navigate('/growth/billing/invoices?tab=to-invoice')}>Open To invoice <ArrowRight className="w-3.5 h-3.5" /></button>}
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Step n={2} done={statementsSent > 0} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#030213]">Send statements</p>
                  {pending.length > 0 && <Note tone={daysToSd <= 2 ? 'red' : 'amber'}>{pl(pending.length, 'invoice')} still waiting would miss them. Approve before {fmtShort(sd)}.</Note>}
                  <p className="text-[11px] text-[#717182] mt-1">{statementsSent ? `${pl(statementsSent, 'statement')} sent this month.` : 'One per paying account; practices show each dentist.'}</p>
                  <button className={`${btn} mt-1.5`} onClick={() => navigate('/growth/billing/statements')}><Send className="w-3.5 h-3.5" /> Statements</button>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Step n={3} done />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#030213]">Payments</p>
                  <p className="text-[11px] text-[#717182]">{tool ? `Reconciled in ${tool} by your accountant; marked paid here automatically.` : s.bank ? `Matched from ${s.bank === 'revolut' ? 'Revolut' : 'Wise'} automatically.` : 'No accounting tool yet: mark paid on the invoice, or in bulk on Invoices.'}</p>
                </div>
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${done ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#EEF4FF] text-[#1565C0]'}`}>{done ? <Check className="w-3 h-3" /> : n}</span>;
}

function Section({ title, sub, actions, children }: { title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#F0EFF6] first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div><p className="text-xs font-semibold text-[#030213]">{title}</p>{sub && <p className="text-[11px] text-[#717182]">{sub}</p>}</div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** A sync or payment problem (Payment reconciliation, P5) with its one-click fix. */
function IssueRow({ s, is }: { s: BillingState; is: SyncIssue }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const inv = is.invoiceId ? s.invoices.find(i => i.id === is.invoiceId) : undefined;
  const tool = toolName(s) ?? 'Xero';
  const open = inv ? <button className="font-mono font-semibold hover:underline" onClick={() => navigate(`/growth/billing/invoices/${inv.id}`)}>{inv.number}</button> : null;
  const bp = is.bankPaymentId ? s.bankPayments.find(b => b.id === is.bankPaymentId) : undefined;
  const act = (a: Parameters<typeof resolveIssue>[1], msg: string) => { resolveIssue(is.id, a); toast.success(msg); };
  return (
    <li className="px-4 py-2.5 border-l-[3px] border-l-[#E53935]">
      {is.kind === 'edited-in-tool' && inv && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0 text-xs">
            <p><span className="font-semibold">Edited in {tool}:</span> {open} · {account(s, inv.accountId)?.name}</p>
            <p className="text-[#5A5568] mt-0.5">Ours: {is.ours}. {tool}: {is.theirs}.</p>
          </div>
          <button className={btn} onClick={() => act('accept-theirs', `${tool}'s version accepted (credit note for the difference)`)}>Accept {tool}'s</button>
          <button className={btnPrimary} onClick={() => act('push-ours', `Our version re-pushed to ${tool}`)}>Re-push ours</button>
        </div>
      )}
      {is.kind === 'voided-in-tool' && inv && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0 text-xs"><p><span className="font-semibold">Voided in {tool}:</span> {open} · {account(s, inv.accountId)?.name}</p><p className="text-[#5A5568] mt-0.5">It shows as Void here, and its cases are back in To invoice.</p></div>
          <button className={btn} onClick={() => navigate('/growth/billing/invoices?tab=to-invoice')}>To invoice</button>
          <button className={btnPrimary} onClick={() => act('ok', 'Noted')}>OK</button>
        </div>
      )}
      {is.kind === 'sync-failed' && inv && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0 text-xs"><p><span className="font-semibold">Didn't reach {tool}:</span> {open}</p><p className="text-[#5A5568] mt-0.5">Posting failed {is.attempts ?? 3} times. The dentist still got it by email.</p></div>
          <button className={btnPrimary} onClick={() => act('retry', `${inv.number} posted to ${tool}`)}><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
        </div>
      )}
      {is.kind === 'connection-expired' && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0 text-xs"><p className="font-semibold inline-flex items-center gap-1"><CloudOff className="w-3.5 h-3.5 text-[#C62828]" /> {tool} connection expired</p><p className="text-[#5A5568] mt-0.5">Invoices still go out by email; they post to {tool} when you reconnect.</p></div>
          <button className={btnPrimary} onClick={() => act('reconnect', `${tool} reconnected`)}>Reconnect</button>
        </div>
      )}
      {is.kind === 'bank-unmatched' && bp && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-semibold inline-flex items-center gap-1"><Landmark className="w-3.5 h-3.5 text-[#4D8EF7]" /> {money(bp.amount)} from {bp.payer}</p>
            <p className="text-[#5A5568] mt-0.5">Reference "{bp.ref}" didn't name an invoice. Pick the match; we'll remember this payer.</p>
          </div>
          {likelyMatches(s, bp).map(m => (
            <button key={m.id} className={btn} onClick={() => { confirmBankMatch(is.id, m.id); toast.success(`Matched to ${m.number}; ${bp.payer} remembered`); }}>{m.number} · {account(s, m.accountId)?.name?.replace(/^Smile Genius /, '')} · {money(totals(m).gross, m.currency)}</button>
          ))}
        </div>
      )}
    </li>
  );
}
