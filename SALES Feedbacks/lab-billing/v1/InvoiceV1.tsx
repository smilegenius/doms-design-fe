import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Archive, ArrowLeft, Check, ChevronDown, ChevronRight, CircleDollarSign, Mail, Pencil, Printer, Wrench } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { printPages } from '../../bulk-actions/printForms';
import type { Invoice, InvoiceLine } from '../types';
import { account, caseById, credited, isOverdue, lineNet, NEW_PRACTICE_FLAG, outstanding, sourceShort, sourceText, toolName, totals } from '../engine';
import { useReadOnly } from '../BillingApp';
import { fmtDate, money } from '../format';
import {
  approveInvoices, archiveInvoices, checkDesignDiff, creditNote, decideRemake, mapOrderType, markPaid, notRemake, overrideLine, resolveIssue, setCaseKind, simulatePayment, useBilling, voidAndReissue,
} from '../billingStore';
import { InvoiceDoc, SomDoc } from '../BillingDocs';
import { btn, btnPrimary, Card, Empty, Field, input, Note, Pill, td, th } from '../ui';
import { ConfirmPracticeModal, dentistUrl, invoiceUrl, plainStatus, practiceUrl, SendInvoicesModal } from './shared';

// ── V1 one invoice ───────────────────────────────────────────────────────────
// Primary actions: Approve & send (if waiting) · Send a copy · Print. Anything
// wrong after it's sent goes through one button, "Fix this invoice", which
// asks what's wrong in plain words and does the right accounting underneath:
//   The price or a line is wrong  → void + reissue at the original date and prices (Edit)
//   It's for the wrong practice   → void + reissue to another account
//   Give money back               → credit note (CN series), partial or full
//   They paid another way         → mark paid (no accounting tool) / read back (tool)

type Fix = null | 'menu' | 'price' | 'practice' | 'credit' | 'paid';

export default function InvoiceV1({ id }: { id: string }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const readOnly = useReadOnly();
  const [fix, setFix] = useState<Fix>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [edit, setEdit] = useState<InvoiceLine | null>(null);
  const [copy, setCopy] = useState(false);
  const [history, setHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const inv = s.invoices.find(i => i.id === id || i.number === id);
  if (!inv) return <Card><Empty>Invoice not found. <button className="text-[#4D8EF7]" onClick={() => navigate('/growth/billing/invoices')}>Back to invoices</button></Empty></Card>;
  const acc = account(s, inv.accountId);
  const pending = inv.status === 'draft' || inv.status === 'flagged';
  const sent = !!inv.issuedAt && inv.status !== 'void';
  const t = totals(inv);
  const cur = inv.currency;
  const tool = toolName(s);
  const unmapped = inv.lines.find(l => l.source.kind === 'unmapped');
  const newPractice = !!acc?.fromScan && !acc.confirmedAt;
  const meta = s.cases[inv.caseId];
  const toolEdit = s.issues.find(x => x.invoiceId === inv.id && x.kind === 'edited-in-tool');
  const blockApprove = unmapped ? 'Pick the catalog item first' : newPractice ? `Confirm ${acc?.name} first` : null;
  const print = () => { if (!printPages([{ key: inv.id, node: <InvoiceDoc inv={inv} acc={acc} s={s} /> }, ...(inv.som ? [{ key: `${inv.id}-som`, node: <SomDoc inv={inv} /> }] : [])], inv.number ?? 'Invoice')) toast.error('Allow pop-ups to print'); };
  const flags = inv.flags.filter(f => f.message !== (acc ? NEW_PRACTICE_FLAG(acc.name) : ''));
  const st = plainStatus(inv);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/growth/billing/invoices')} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Invoices</button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[#030213]">{inv.number ?? 'Not sent yet'}</h2>
            <Pill tone={st === 'Paid' ? 'green' : st === 'Overdue' ? 'red' : st === 'Needs a look' ? 'amber' : st === 'Ready to send' ? 'blue' : 'gray'}>{st}</Pill>
            {inv.cases?.length ? <Pill tone="blue">Month invoice · {inv.cases.length} cases</Pill> : null}
            {inv.archived && <Pill tone="gray">Archived</Pill>}
          </div>
          <p className="text-sm text-[#5A5568] mt-1">
            {money(t.gross, cur)} to <button className="font-semibold hover:underline" onClick={() => navigate(practiceUrl(inv.accountId))}>{acc?.name}</button>
            {!inv.cases?.length && <> for {inv.patient} (<button className="hover:underline" onClick={() => navigate(dentistUrl(inv.dentist))}>{inv.dentist}</button>{caseById(inv.caseId) && !readOnly ? <>, <button className="font-mono hover:underline" onClick={() => navigate(`/growth/cases/${inv.caseId}?sf=billing`)}>{inv.caseId}</button></> : null})</>}
            {sent && <> · {outstanding(inv) > 0 ? <span className={isOverdue(inv) ? 'text-[#C62828] font-semibold' : ''}>{money(outstanding(inv), cur)} owed, due {fmtDate(inv.dueAt)}</span> : 'paid in full'}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && pending && <button className={btnPrimary} disabled={!!blockApprove} title={blockApprove ?? undefined} onClick={() => { approveInvoices([inv.id]); toast.success(`Sent to ${acc?.emails.join(', ')}${tool ? ` and posted to ${tool}` : ''}`); }}><Check className="w-3.5 h-3.5" /> Approve & send</button>}
          {!readOnly && sent && <button className={btn} onClick={() => setCopy(true)}><Mail className="w-3.5 h-3.5" /> Send a copy</button>}
          <button className={btn} onClick={print}><Printer className="w-3.5 h-3.5" /> Print</button>
          {!readOnly && sent && <button className={btnPrimary} onClick={() => setFix('menu')}><Wrench className="w-3.5 h-3.5" /> Fix this invoice</button>}
          {!readOnly && (inv.status === 'paid' || inv.status === 'void') && <button className={btn} onClick={() => { archiveInvoices([inv.id], !inv.archived); toast.success(inv.archived ? 'Back in the list' : 'Archived: still in statements and reports'); }}><Archive className="w-3.5 h-3.5" /> {inv.archived ? 'Unarchive' : 'Archive'}</button>}
        </div>
      </div>

      {newPractice && !readOnly && acc && <Note tone="amber"><b>{acc.name} is new</b>: it arrived with a scan, so nobody has checked who to bill yet. <button className="font-semibold underline" onClick={() => setConfirming(true)}>Check and confirm</button> and this invoice can go.</Note>}
      {toolEdit && !readOnly && (
        <Note tone="red"><b>Someone changed this in {tool}.</b> Ours: {toolEdit.ours}. {tool}: {toolEdit.theirs}.{' '}
          <button className="font-semibold underline" onClick={() => { resolveIssue(toolEdit.id, 'accept-theirs'); toast.success(`Kept ${tool}'s version (credit for the difference)`); }}>Keep {tool}'s</button>{' · '}
          <button className="font-semibold underline" onClick={() => { resolveIssue(toolEdit.id, 'push-ours'); toast.success(`Ours put back in ${tool}`); }}>Put ours back</button>
        </Note>
      )}
      {inv.keepIssuedAt && pending && <Note tone="blue">This replaces {inv.replaces}, with its original date ({fmtDate(inv.keepIssuedAt)}) and prices. Change a line below, then Approve & send.</Note>}
      {inv.replacedBy && <Note tone="amber">Cancelled and replaced by <button className="font-semibold underline" onClick={() => navigate(invoiceUrl(inv.replacedBy!))}>{s.invoices.find(i => i.id === inv.replacedBy)?.number ?? 'a new invoice'}</button>.</Note>}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3">
          <Card title="What the practice sees" sub={inv.issuedAt ? 'Sent invoices never change; Fix this invoice makes the right correction.' : 'Numbered when it\'s sent.'}>
            <div className="border border-[#F0EFF6] rounded-lg p-5 bg-white overflow-x-auto"><InvoiceDoc inv={inv} acc={acc} s={s} /></div>
          </Card>
        </div>
        <div className="xl:col-span-2 space-y-4">
          {!readOnly && pending && flags.length > 0 && (
            <Card title={<span className="inline-flex items-center gap-1.5 text-[#B45309]"><AlertTriangle className="w-4 h-4" /> Check before it goes</span>}>
              <div className="space-y-3">
                {flags.map((f, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-[#030213]">{f.message}</p>
                    {f.kind === 'new-order-type' && unmapped && meta?.scannerOrderType && (
                      <select className="mt-1.5 px-2 py-1 rounded-md border border-[#E0E0E6] text-xs" defaultValue="" onChange={e => { if (!e.target.value) return; mapOrderType(meta.scannerOrderType!, e.target.value); toast.success('Matched, and remembered for next time'); }}>
                        <option value="">Which item is it?</option>
                        {s.catalog.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                      </select>
                    )}
                    {f.kind === 'nhs-unclear' && <div className="mt-1.5 flex gap-2"><button className={btn} onClick={() => setCaseKind(inv.caseId, 'NHS')}>It's NHS</button><button className={btn} onClick={() => setCaseKind(inv.caseId, 'Private')}>It's private</button></div>}
                    {f.kind === 'remake' && <div className="mt-1.5 flex flex-wrap gap-2"><button className={btn} onClick={() => decideRemake(inv.caseId, 'no-charge')}>Remake, no charge</button><button className={btn} onClick={() => decideRemake(inv.caseId, 'charge')}>Remake, but charge</button><button className={btn} onClick={() => notRemake(inv.caseId)}>Not a remake</button></div>}
                    {f.kind === 'unusual-price' && <p className="text-[11px] text-[#717182] mt-1">If it's right, just send it. If not, change the line below.</p>}
                    {f.kind === 'design-diff' && <div className="mt-1.5 flex flex-wrap gap-2"><button className={btn} onClick={() => { checkDesignDiff(inv.caseId); toast.success('OK: billed as designed'); }}>Bill what was designed</button><button className={btn} onClick={() => navigate(`/growth/cases/${inv.caseId}?sf=cad`)}>Open the design</button></div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Lines" sub="Tap the price source to see why a line costs what it does." pad={false}>
            <table className="w-full">
              <tbody>
                {inv.lines.map(l => (
                  <tr key={l.id}>
                    <td className={td}>
                      {l.description}
                      <span className="block text-[#717182]">{l.qty} × {money(l.unitPrice, cur)} · {l.kind}</span>
                      <button onClick={() => setWhy(why === l.id ? null : l.id)} className="text-[11px] font-semibold text-[#4D8EF7] hover:underline">{sourceShort(l.source)} price</button>
                      {why === l.id && <span className="block mt-1 text-[11px] text-[#1565C0] bg-[#F5F9FF] rounded px-2 py-1">{sourceText(l.source, cur)}</span>}
                      {!readOnly && pending && (l.itemId || inv.keepIssuedAt) && <button onClick={() => setEdit(l)} className="ml-3 text-[11px] text-[#717182] hover:text-[#030213]"><Pencil className="w-3 h-3 inline -mt-0.5" /> Change price</button>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>{money(lineNet(l), cur)}</td>
                  </tr>
                ))}
                <tr><td className={`${td} font-semibold`}>Total{t.vat ? ` (incl. VAT ${money(t.vat, cur)})` : ''}</td><td className={`${td} text-right font-semibold`}>{money(t.gross, cur)}</td></tr>
              </tbody>
            </table>
          </Card>

          {sent && (
            <Card title="Money">
              <ul className="space-y-1.5 text-xs">
                {inv.payments.map(p => <li key={p.id} className="flex justify-between"><span>Paid {fmtDate(p.at)} · {p.ref}</span><span className="text-[#2E7D32] font-semibold">{money(p.amount, cur)}</span></li>)}
                {inv.creditNotes.map(c => <li key={c.id} className="flex justify-between"><span>Money back {fmtDate(c.at)} · {c.number}: {c.reason}</span><span className="text-[#B45309] font-semibold">−{money(c.amount, cur)}</span></li>)}
                {!inv.payments.length && !inv.creditNotes.length && <li className="text-[#A0A0B0]">Nothing paid yet. {tool ? `Payments come back from ${tool} on their own.` : 'Use Fix this invoice › They paid when the money arrives.'}</li>}
              </ul>
              <p className="text-xs mt-2 pt-2 border-t border-[#F0EFF6] flex justify-between"><span className="text-[#717182]">Still owed · payment reference <span className="font-mono">{inv.number}</span></span><span className={`font-semibold ${isOverdue(inv) ? 'text-[#C62828]' : ''}`}>{money(outstanding(inv), cur)}</span></p>
              {!readOnly && tool && outstanding(inv) > 0 && <button className="mt-2 text-[11px] text-[#717182] underline" onClick={() => { simulatePayment(inv.id); toast.success(`Demo: payment read back from ${tool}`); }}>Demo: it gets paid in {tool}</button>}
            </Card>
          )}

          <Card>
            <button className="w-full flex items-center justify-between text-xs font-semibold text-[#030213]" onClick={() => setHistory(h => !h)}>History ({inv.timeline.length}) {history ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
            {history && <ol className="space-y-1.5 mt-3">{[...inv.timeline].reverse().map((e, i) => <li key={i} className="text-xs flex gap-2"><span className="text-[#A0A0B0] w-20 flex-shrink-0">{fmtDate(e.at)}</span><span>{e.text}</span></li>)}</ol>}
          </Card>
        </div>
      </div>

      {fix && <FixModal inv={inv} fix={fix} setFix={setFix} />}
      {edit && <PriceModal inv={inv} line={edit} onClose={() => setEdit(null)} />}
      {copy && acc && <SendInvoicesModal invoices={[inv]} to={acc.emails} title={`Send a copy of ${inv.number}`} onClose={() => setCopy(false)} />}
      {confirming && acc && <ConfirmPracticeModal a={acc} onClose={() => setConfirming(false)} />}
    </div>
  );
}

function FixModal({ inv, fix, setFix }: { inv: Invoice; fix: Exclude<Fix, null>; setFix: (f: Fix) => void }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tool = toolName(s);
  const hasPay = inv.payments.length > 0;
  const max = totals(inv).gross - credited(inv);
  const [to, setTo] = useState('');
  const [full, setFull] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const close = () => setFix(null);
  const options: { id: Exclude<Fix, null | 'menu'>; title: string; body: string; off?: string }[] = [
    { id: 'price', title: 'A price or a line is wrong', body: `We cancel ${inv.number} and make a corrected copy with the same date and prices. Change what's wrong, then send it.`, off: hasPay ? 'It has a payment: give money back instead.' : undefined },
    { id: 'practice', title: 'It went to the wrong practice', body: `We cancel ${inv.number} and send the same invoice to the right practice or dentist. The cases move with it.`, off: hasPay ? 'It has a payment: give money back instead.' : undefined },
    { id: 'credit', title: 'Give some or all money back', body: 'A credit note (its own CN number) for part or all of it. The practice is emailed; it shows on their statement.' },
    { id: 'paid', title: tool ? 'It\'s been paid' : 'They paid (cash, card, transfer)', body: tool ? `Payments come back from ${tool} on their own once your accountant matches them there.` : 'Mark it paid. Nothing else changes.', off: outstanding(inv) <= 0 ? 'Already paid in full.' : undefined },
  ];
  const title = fix === 'menu' ? `What's wrong with ${inv.number}?` : options.find(o => o.id === fix)!.title;
  return (
    <Modal isOpen onClose={close} title={title} footer={fix === 'menu' ? undefined : (
      <div className="flex justify-between gap-2">
        <button className={btn} onClick={() => setFix('menu')}>Back</button>
        {fix === 'price' && <button className={btnPrimary} onClick={() => { const next = voidAndReissue(inv.id); close(); toast.success('Corrected copy ready: change the line, then send'); if (next) navigate(invoiceUrl(next)); }}>Make a corrected copy</button>}
        {fix === 'practice' && <button className={btnPrimary} disabled={!to} onClick={() => { const next = voidAndReissue(inv.id, undefined, to); close(); toast.success(`Ready for ${account(s, to)?.name}: check and send`); if (next) navigate(invoiceUrl(next)); }}>Move it</button>}
        {fix === 'credit' && <button className={btnPrimary} disabled={!reason.trim() || (!full && !(Number(amount) > 0 && Number(amount) <= max))} onClick={() => { creditNote(inv.id, Number(amount), reason.trim(), full); close(); toast.success('Credit note sent'); }}>Give money back</button>}
        {fix === 'paid' && !tool && <button className={btnPrimary} onClick={() => { markPaid([inv.id]); close(); toast.success('Marked paid'); }}><CircleDollarSign className="w-3.5 h-3.5" /> Mark paid</button>}
        {fix === 'paid' && tool && <button className={btn} onClick={close}>OK</button>}
      </div>
    )}>
      {fix === 'menu' && (
        <ul className="space-y-2">
          {options.map(o => (
            <li key={o.id}>
              <button disabled={!!o.off} onClick={() => setFix(o.id)} className="w-full text-left rounded-xl border border-[#E0E0E6] px-4 py-3 hover:border-[#4D8EF7] hover:bg-[#F5F9FF] disabled:opacity-50 disabled:hover:border-[#E0E0E6] disabled:hover:bg-white">
                <p className="text-sm font-semibold text-[#030213]">{o.title}</p>
                <p className="text-xs text-[#717182] mt-0.5">{o.off ?? o.body}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {fix !== 'menu' && <p className="text-xs text-[#5A5568] mb-3">{options.find(o => o.id === fix)!.body}{tool && fix !== 'paid' ? ` ${tool} is updated too.` : ''}</p>}
      {fix === 'practice' && (
        <Field label="Who should pay it?">
          <select className={input} value={to} onChange={e => setTo(e.target.value)}>
            <option value="">Pick a practice or dentist…</option>
            {s.accounts.filter(a => a.id !== inv.accountId && (a.kind === 'practice' || a.payer === 'dentist')).map(a => <option key={a.id} value={a.id}>{a.name}{a.kind === 'dentist' ? ' (dentist pays directly)' : ''}</option>)}
          </select>
        </Field>
      )}
      {fix === 'credit' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button className={`${btn} ${!full ? '!border-[#4D8EF7] !text-[#1565C0]' : ''}`} onClick={() => setFull(false)}>Some of it</button>
            <button className={`${btn} ${full ? '!border-[#4D8EF7] !text-[#1565C0]' : ''}`} onClick={() => setFull(true)}>All of it ({money(max, inv.currency)})</button>
          </div>
          {!full && <Field label={`How much (up to ${money(max, inv.currency)})`}><input className={input} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>}
          <Field label="Why" hint="Shows on the credit note."><input className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Shade adjustment" /></Field>
        </div>
      )}
    </Modal>
  );
}

function PriceModal({ inv, line, onClose }: { inv: Invoice; line: InvoiceLine; onClose: () => void }) {
  const { toast } = useToast();
  const [price, setPrice] = useState(String(line.unitPrice));
  const [reason, setReason] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="Change this line's price" footer={
      <div className="flex justify-end gap-2"><button className={btnPrimary} disabled={!reason.trim() || !(Number(price) >= 0)} onClick={() => { overrideLine(inv.id, line.id, Number(price), reason.trim()); toast.success('Price changed on this invoice only'); onClose(); }}>Save</button></div>
    }>
      <div className="space-y-3">
        <p className="text-xs text-[#717182]">{line.description} · now {money(line.unitPrice, inv.currency)}. This changes this invoice only; to change what a practice always pays, use its Prices tab.</p>
        <Field label={`Price (${inv.currency})`}><input className={input} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></Field>
        <Field label="Why" hint="Kept with the line, and in the Given away report."><input className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Agreed with the practice" /></Field>
      </div>
    </Modal>
  );
}

export { th };
