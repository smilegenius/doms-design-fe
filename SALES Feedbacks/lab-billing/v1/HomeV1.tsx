import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCheck, CloudOff, FileText, Landmark, MailWarning, PauseCircle, PhoneCall, RefreshCw, Search, Send, Sparkles, UserPlus, X } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import type { Invoice } from '../types';
import { account, exposure, toInvoice, toolName, totals } from '../engine';
import { daysBetween, fmtMonth, fmtShort, money, monthOf, pl, prevMonth, today } from '../format';
import { approveInvoices, confirmBankMatch, dismiss, likelyMatches, previewStatements, releaseAccount, resendAccountEmail, resolveIssue, sendStatements, statementDay, useBilling } from '../billingStore';
import { assists, headline, heldCases, pendingInvoices } from '../insights';
import { whoToCall } from '../labInsights';
import { btn, btnPrimary, Card, Note } from '../ui';
import { ConfirmPracticeModal, dentistUrl, Hint, invoiceUrl, payers, practiceUrl, unconfirmed } from './shared';

// ── V1 Home ──────────────────────────────────────────────────────────────────
// Top: three numbers and the month in three steps (invoice monthly practices →
// send statements → payments in). Below: one Needs you list, most money first,
// each item one sentence and one button. No section headings. Then a short
// "How do I…" strip so nothing needs a support call.

type Item = { key: string; tone: 'red' | 'amber' | 'blue'; icon: ReactNode; text: ReactNode; sub?: ReactNode; actions: ReactNode; weight: number; dismiss?: () => void };
const BORDER = { red: 'border-l-[#E53935]', amber: 'border-l-[#F59E0B]', blue: 'border-l-[#4D8EF7]' };

export default function HomeV1({ openFind }: { openFind: () => void }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [statements, setStatements] = useState(false);
  const tool = toolName(s) ?? 'Xero';
  const hasTool = !!toolName(s);
  const h = headline(s);
  const t = today();
  const ym = monthOf(t);
  const pending = pendingInvoices(s);
  const fresh = unconfirmed(s);
  const isNewPractice = (i: Invoice) => !!(account(s, i.accountId)?.fromScan && !account(s, i.accountId)?.confirmedAt);
  const clean = pending.filter(i => !i.flags.length && !isNewPractice(i) && !i.lines.some(l => l.source.kind === 'unmapped'));
  const flagged = pending.filter(i => i.flags.length && !isNewPractice(i));
  const pot = toInvoice(s);
  const sd = statementDay(s);
  // Early in the month, "statements" means last month's.
  const stPeriod = Number(t.slice(8)) <= 7 ? prevMonth(ym) : ym;
  const stSent = s.statements.filter(x => x.period === stPeriod && x.status === 'sent').length;
  // Done when every practice invoiced that month has its statement (sending one from a practice's page doesn't finish the step).
  const stExpected = payers(s).filter(a => s.invoices.some(i => i.accountId === a.id && i.issuedAt && i.status !== 'void' && monthOf(i.issuedAt) === stPeriod)).length;
  const stDone = stExpected > 0 && stSent >= stExpected;

  const items: Item[] = [];
  for (const a of fresh) {
    const n = s.invoices.filter(i => i.accountId === a.id && (i.status === 'draft' || i.status === 'flagged')).length;
    items.push({ key: `new-${a.id}`, tone: 'blue', weight: 900, icon: <UserPlus className="w-4 h-4 text-[#4D8EF7]" />,
      text: <>New practice from a scan: <b>{a.name}</b></>, sub: `Check who to bill there.${n ? ` ${pl(n, 'invoice')} waits until you do.` : ''}`,
      actions: <button className={btnPrimary} onClick={() => setConfirming(a.id)}>Check and confirm</button> });
  }
  for (const is of s.issues) {
    const inv = is.invoiceId ? s.invoices.find(i => i.id === is.invoiceId) : undefined;
    const accName = inv ? account(s, inv.accountId)?.name : '';
    const act = (a: Parameters<typeof resolveIssue>[1], msg: string) => { resolveIssue(is.id, a); toast.success(msg); };
    const num = inv ? <button className="font-mono font-semibold hover:underline" onClick={() => navigate(invoiceUrl(inv.id))}>{inv.number}</button> : null;
    if (is.kind === 'edited-in-tool' && inv) items.push({ key: is.id, tone: 'red', weight: 1000 + totals(inv).gross, icon: <RefreshCw className="w-4 h-4 text-[#C62828]" />,
      text: <>Someone changed {num} ({accName}) in {tool}</>, sub: `Ours: ${is.ours}. ${tool}: ${is.theirs}.`,
      actions: <><button className={btn} onClick={() => act('accept-theirs', `Kept ${tool}'s version (credit note for the difference)`)}>Keep {tool}'s</button><button className={btnPrimary} onClick={() => act('push-ours', `Ours put back in ${tool}`)}>Put ours back</button></> });
    if (is.kind === 'voided-in-tool' && inv) items.push({ key: is.id, tone: 'red', weight: 1000, icon: <RefreshCw className="w-4 h-4 text-[#C62828]" />,
      text: <>{num} ({accName}) was cancelled in {tool}</>, sub: 'It shows as cancelled here too. Its cases are back in Ready to invoice if they need billing again.',
      actions: <><button className={btn} onClick={() => navigate('/growth/billing/invoices?show=to-invoice')}>See cases</button><button className={btnPrimary} onClick={() => act('ok', 'Noted')}>OK</button></> });
    if (is.kind === 'sync-failed' && inv) items.push({ key: is.id, tone: 'red', weight: 1000, icon: <CloudOff className="w-4 h-4 text-[#C62828]" />,
      text: <>{num} didn't reach {tool}</>, sub: 'The practice still got it by email. Try again; if it fails, check the contact in ' + tool + '.',
      actions: <button className={btnPrimary} onClick={() => act('retry', `Posted to ${tool}`)}><RefreshCw className="w-3.5 h-3.5" /> Try again</button> });
    if (is.kind === 'connection-expired') items.push({ key: is.id, tone: 'red', weight: 5000, icon: <CloudOff className="w-4 h-4 text-[#C62828]" />,
      text: <>{tool} needs signing in again</>, sub: `Invoices still go out by email; they reach ${tool} when you reconnect.`,
      actions: <button className={btnPrimary} onClick={() => act('reconnect', `${tool} reconnected`)}>Reconnect</button> });
    if (is.kind === 'bank-unmatched') {
      const bp = s.bankPayments.find(b => b.id === is.bankPaymentId);
      if (bp) items.push({ key: is.id, tone: 'amber', weight: 800 + bp.amount, icon: <Landmark className="w-4 h-4 text-[#B45309]" />,
        text: <>{money(bp.amount)} arrived from {bp.payer}. Which invoice is it for?</>, sub: `Reference "${bp.ref}". Pick once and we'll recognise ${bp.payer} next time.`,
        actions: <>{likelyMatches(s, bp).map(m => <button key={m.id} className={btn} onClick={() => { confirmBankMatch(is.id, m.id); toast.success(`Matched to ${m.number}`); }}>{m.number} · {money(totals(m).gross, m.currency)}</button>)}</> });
    }
  }
  if (clean.length) items.push({ key: 'clean', tone: 'blue', weight: 700 + clean.reduce((n, i) => n + totals(i).gross, 0), icon: <CheckCheck className="w-4 h-4 text-[#4D8EF7]" />,
    text: <>{pl(clean.length, 'invoice')} ready to send, {money(clean.reduce((n, i) => n + totals(i).gross, 0), 'GBP', { round: true })}</>,
    sub: s.settings.approval === 'review-all' ? 'You asked to approve every invoice (Settings › More options).' : 'Nothing wrong with them; they wait because you approve invoices in your first 30 days.',
    actions: <><button className={btn} onClick={() => navigate('/growth/billing/invoices?show=waiting')}>Look first</button><button className={btnPrimary} onClick={() => { const n = approveInvoices(clean.map(i => i.id)); toast.success(`${pl(n, 'invoice')} sent`); }}><Send className="w-3.5 h-3.5" /> Send all</button></> });
  for (const i of flagged) items.push({ key: i.id, tone: 'amber', weight: 600 + totals(i).gross, icon: <FileText className="w-4 h-4 text-[#B45309]" />,
    text: <>{i.cases?.length ? `Month invoice for ${account(s, i.accountId)?.name}` : `${i.patient} · ${account(s, i.accountId)?.name}`}: {i.flags[0].message.charAt(0).toLowerCase() + i.flags[0].message.slice(1)}</>,
    sub: i.flags.length > 1 ? `And ${pl(i.flags.length - 1, 'other thing')} to check.` : `${money(totals(i).gross, i.currency)}, waiting.`,
    actions: <><button className={btnPrimary} onClick={() => navigate(invoiceUrl(i.id))}>Check it</button></> });
  const nudges = assists(s).filter(n => !/^(unusual-price|nhs-unclear|remake-inv|design-diff|review|new-order-type|type|monthend)-/.test(n.id));
  for (const n of nudges) items.push({ key: n.id, tone: n.tone, weight: 400, icon: <Sparkles className="w-4 h-4 text-[#7C6BFF]" />,
    text: <>{n.kind}: <b>{n.title}</b></>, sub: n.message, dismiss: () => dismiss(n.id),
    actions: <button className={btn} onClick={() => navigate(n.link)}>Fix it <ArrowRight className="w-3 h-3" /></button> });
  for (const a of s.accounts.filter(a => a.bounced?.length)) items.push({ key: `bounce-${a.id}`, tone: 'amber', weight: 500, icon: <MailWarning className="w-4 h-4 text-[#B45309]" />,
    text: <>An email to {a.name} bounced</>, sub: `${a.bounced![0].what} to ${a.bounced![0].email}. Fix the address on their page, then send again.`,
    actions: <><button className={btn} onClick={() => navigate(`${practiceUrl(a.id)}?tab=setup`)}>Fix address</button><button className={btnPrimary} onClick={() => { resendAccountEmail(a.id); toast.success('Sent again'); }}>Send again</button></> });
  if (s.settings.limitsOn) {
    const held = heldCases(s);
    const byAcc = [...new Set(held.map(c => s.cases[c.id].accountId))];
    for (const id of byAcc) {
      const a = account(s, id)!; const ex = exposure(s, id); const n = held.filter(c => s.cases[c.id].accountId === id).length;
      items.push({ key: `hold-${id}`, tone: 'red', weight: 950, icon: <PauseCircle className="w-4 h-4 text-[#C62828]" />,
        text: <>{pl(n, 'new case')} from <b>{a.name}</b> on hold</>, sub: `They owe ${money(ex.total, a.currency, { round: true })} against a ${money(a.limit?.amount ?? 0, a.currency, { round: true })} limit. A payment releases them on its own.`,
        actions: <><button className={btn} onClick={() => navigate(practiceUrl(id))}>Open</button><button className={btnPrimary} onClick={() => { releaseAccount(id); toast.success(`Released ${pl(n, 'case')}`); }}>Release</button></> });
    }
  }
  for (const w of whoToCall(s).slice(0, 2)) {
    const key = `call-${w.name}`;
    if (s.dismissed.includes(key)) continue;
    items.push({ key, tone: 'amber', weight: 300, icon: <PhoneCall className="w-4 h-4 text-[#B45309]" />, dismiss: () => dismiss(key),
      text: <><b>{w.name}</b> {w.row.status === 'Gone quiet' ? 'has gone quiet' : 'is sending less'}</>,
      sub: `Usually about ${money(w.row.avg, 'GBP', { round: true })} a month${w.row.lastCase ? `; last case ${fmtShort(w.row.lastCase)}` : ''}. Worth a call.`,
      actions: <button className={btn} onClick={() => navigate(w.kind === 'Practice' && w.accountId ? practiceUrl(w.accountId) : dentistUrl(w.name))}>Open</button> });
  }
  items.sort((a, b) => b.weight - a.weight);
  const a0 = confirming ? account(s, confirming) : undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Num label="Owed to you" value={money(h.owed, 'GBP', { round: true })} sub={h.overdue ? <span className="text-[#C62828]">{money(h.overdue, 'GBP', { round: true })} overdue</span> : 'Nothing overdue'} onClick={() => navigate('/growth/billing/invoices?show=unpaid')} />
        <Num label={`Invoiced in ${fmtMonth(ym).split(' ')[0]}`} value={money(h.invoicedThisMonth, 'GBP', { round: true })} sub={`${pl(s.invoices.filter(i => i.issuedAt && monthOf(i.issuedAt) === ym && i.status !== 'void').length, 'invoice')}`} onClick={() => navigate('/growth/billing/invoices?show=all')} />
        <Num label="Paid this month" value={money(h.paidThisMonth, 'GBP', { round: true })} sub={hasTool ? `Read back from ${tool}` : 'Marked paid by you'} onClick={() => navigate('/growth/billing/invoices?show=paid')} />
      </div>

      <Card title="This month, in three steps" sub={`Everything else happens on its own when cases ship. Statement day: ${fmtShort(sd)}${daysBetween(t, sd) >= 0 ? ` (${daysBetween(t, sd) === 0 ? 'today' : `in ${pl(daysBetween(t, sd), 'day')}`})` : ''}.`}>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Step n={1} done={!pot.length} title="Invoice monthly practices"
            body={pot.length ? `${pl(pot.length, 'shipped case')} ready, ${money(pot.reduce((n, x) => n + x.value, 0), 'GBP', { round: true })}.` : s.accounts.some(a => a.invoiceMode === 'month-end') ? 'Nothing waiting.' : 'No practice is billed monthly. Per-case practices are invoiced on Shipped.'}
            action={pot.length ? <button className={btnPrimary} onClick={() => navigate('/growth/billing/invoices?show=to-invoice')}>Review <ArrowRight className="w-3.5 h-3.5" /></button> : null} />
          <Step n={2} done={stDone} title={`Send ${fmtMonth(stPeriod).split(' ')[0]} statements`}
            body={stDone ? `All ${stSent} sent. Send one again from any practice's page.` : `${stSent ? `${stSent} of ${stExpected} sent. ` : ''}${pending.length ? `${pl(pending.length, 'invoice')} still waiting would be left off.` : 'One per practice, with each dentist\'s share.'}`}
            action={!stDone ? <button className={btn} onClick={() => setStatements(true)}><Send className="w-3.5 h-3.5" /> Send statements</button> : null} />
          <Step n={3} done title="Payments in"
            body={hasTool ? `${tool} matches payments; they show here as paid.` : s.bank ? `Matched from ${s.bank === 'revolut' ? 'Revolut' : 'Wise'}; anything unclear appears below.` : 'Mark invoices paid as money arrives (tick them in Invoices).'}
            action={null} />
        </ol>
      </Card>

      <Card title={items.length ? `Needs you (${items.length})` : 'Needs you'} sub={items.length ? 'Most money first. Each one is a sentence and a button.' : undefined} pad={false}>
        {!items.length ? (
          <div className="px-5 py-8 text-center"><Check className="w-6 h-6 text-[#43A047] mx-auto" /><p className="text-sm font-semibold text-[#030213] mt-2">All clear</p><p className="text-xs text-[#717182] mt-1">Invoices are going out and payments are coming back on their own.</p></div>
        ) : (
          <ul className="divide-y divide-[#F0EFF6]">
            {items.map(it => (
              <li key={it.key} className={`px-4 py-3 border-l-[3px] ${BORDER[it.tone]} flex flex-wrap items-center gap-3`}>
                <span className="flex-shrink-0">{it.icon}</span>
                <div className="flex-1 min-w-[220px]"><p className="text-sm text-[#030213]">{it.text}</p>{it.sub && <p className="text-xs text-[#717182] mt-0.5">{it.sub}</p>}</div>
                <div className="flex flex-wrap items-center gap-2">{it.actions}{it.dismiss && <button onClick={it.dismiss} title="Not now" aria-label="Dismiss" className="text-[#A0A0B0] hover:text-[#030213] p-1"><X className="w-3.5 h-3.5" /></button>}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="rounded-xl border border-dashed border-[#DCD8EC] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-semibold text-[#030213]">How do I…</span>
        {[
          ['Send a practice its statement', '/growth/billing/practices'],
          ['Give a practice its own prices', '/growth/billing/practices'],
          ['Fix or credit an invoice', '/growth/billing/invoices?show=unpaid'],
          ['Bill a practice once a month', '/growth/billing/practices'],
          ['Change my prices', '/growth/billing/settings/prices'],
        ].map(([label, to]) => <button key={label} onClick={() => navigate(to)} className="text-xs text-[#4D8EF7] hover:underline">{label}</button>)}
        <button onClick={openFind} className="ml-auto inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><Search className="w-3.5 h-3.5" /> Something else? Find it (⌘K)</button>
      </div>
      <Hint>Every practice and dentist has one page with their invoices, statements, prices and setup: Practices tab.</Hint>

      {a0 && <ConfirmPracticeModal a={a0} onClose={() => setConfirming(null)} />}
      {statements && <SendAllStatements period={stPeriod} onClose={() => setStatements(false)} />}
    </div>
  );
}

function Num({ label, value, sub, onClick }: { label: string; value: string; sub: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-white border border-[#E0E0E6] rounded-xl px-4 py-3 hover:border-[#C7DAFF]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#717182]">{label}</p>
      <p className="text-2xl font-semibold text-[#030213] mt-0.5">{value}</p>
      <p className="text-xs text-[#717182] mt-0.5">{sub}</p>
    </button>
  );
}

function Step({ n, done, title, body, action }: { n: number; done: boolean; title: string; body: string; action: ReactNode }) {
  return (
    <li className={`rounded-xl border px-4 py-3 flex flex-col gap-2 ${done ? 'border-[#D7EED9] bg-[#F7FCF7]' : 'border-[#DCE8FF] bg-[#F8FBFF]'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-[#43A047] text-white' : 'bg-[#4D8EF7] text-white'}`}>{done ? <Check className="w-3.5 h-3.5" /> : n}</span>
        <p className="text-sm font-semibold text-[#030213]">{title}</p>
      </div>
      <p className="text-xs text-[#5A5568] flex-1">{body}</p>
      {action && <div>{action}</div>}
    </li>
  );
}

/** Send every practice its statement for the month, after a one-screen check. */
function SendAllStatements({ period, onClose }: { period: string; onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [built, setBuilt] = useState(0);
  useEffect(() => { setBuilt(previewStatements(period)); }, [period]);
  const sts = s.statements.filter(x => x.period === period && x.status === 'preview');
  const noEmail = sts.filter(x => !account(s, x.accountId)?.emails.length);
  const waiting = pendingInvoices(s).length;
  const overdueTotal = headline(s).overdue;
  return (
    <Modal isOpen onClose={onClose} title={`Send ${fmtMonth(period)} statements`} footer={
      <div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Not yet</button><button className={btnPrimary} disabled={!sts.length} onClick={() => { const n = sendStatements(period); toast.success(`${pl(n, 'statement')} sent`); onClose(); }}><Send className="w-3.5 h-3.5" /> Send {pl(sts.length, 'statement')}</button></div>
    }>
      <div className="space-y-3 text-sm text-[#5A5568]">
        <p>{pl(built, 'practice')} with something to show get a statement: what they were invoiced, what they paid and what's still owed ({money(overdueTotal, 'GBP', { round: true })} overdue across everyone). Practices see each dentist's share.</p>
        {waiting > 0 && <Note tone="amber">{pl(waiting, 'invoice')} still waiting for you won't be on them. Send those first from Needs you if they should be.</Note>}
        {noEmail.length > 0 && <Note tone="amber">No billing email for {noEmail.map(x => account(s, x.accountId)?.name).join(', ')}: they'll be skipped by email. Print them from their page.</Note>}
        <p className="text-xs text-[#717182]">To check one first, or send just one, open that practice and press Send statement.</p>
      </div>
    </Modal>
  );
}
