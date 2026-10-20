import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, Check, CircleDollarSign, FileMinus, HelpCircle, Mail, Pencil, Printer, RefreshCw } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { printPages } from '../../bulk-actions/printForms';
import type { Invoice, InvoiceLine } from '../types';
import { account, caseById, credited, isOverdue, lineNet, outstanding, sourceShort, sourceText, totals } from '../engine';
import { fmtDate, money } from '../format';
import {
  approveInvoices, checkDesignDiff, creditNote, decideRemake, mapOrderType, notRemake, overrideLine, resendInvoice, setCaseKind, simulatePayment, useBilling, voidAndReissue,
} from '../billingStore';
import { InvoiceDoc, SomDoc } from '../BillingDocs';
import { btn, btnDanger, btnPrimary, Card, Empty, Field, input, InvoiceStatusPill, Note, Pill, td, th } from '../ui';

// ── 3. Invoice detail: one invoice end to end ────────────────────────────────

export default function InvoiceDetail({ id }: { id: string }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const inv = s.invoices.find(i => i.id === id || i.number === id);
  const [why, setWhy] = useState<string | null>(null);
  const [edit, setEdit] = useState<InvoiceLine | null>(null);
  const [credit, setCredit] = useState(false);
  const [voiding, setVoiding] = useState(false);
  if (!inv) return <Card><Empty>Invoice not found. <button className="text-[#4D8EF7]" onClick={() => navigate('/growth/billing')}>Back to Billing</button></Empty></Card>;
  const acc = account(s, inv.accountId);
  const pending = inv.status === 'draft' || inv.status === 'flagged';
  const t = totals(inv);
  const meta = s.cases[inv.caseId];
  const unmapped = inv.lines.find(l => l.source.kind === 'unmapped');
  const cur = inv.currency;

  const print = () => {
    const pages = [{ key: inv.id, node: <InvoiceDoc inv={inv} acc={acc} s={s} /> }, ...(inv.som ? [{ key: `${inv.id}-som`, node: <SomDoc inv={inv} /> }] : [])];
    if (!printPages(pages, inv.number ?? 'Draft invoice')) toast.error('Allow pop-ups to print');
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/growth/billing')} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Billing home</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[#030213]">{inv.number ?? 'Draft invoice'}</h2>
            <InvoiceStatusPill status={inv.status} overdue={isOverdue(inv)} />
            {inv.replaces && <Pill tone="gray">Replaces {inv.replaces}</Pill>}
            {inv.som && <Pill tone="blue">Statement of manufacture attached</Pill>}
          </div>
          <p className="text-xs text-[#717182] mt-1">
            <button className="hover:underline" onClick={() => navigate(`/growth/billing/accounts/${inv.accountId}`)}>{acc?.name}</button>
            {' · '}{caseById(inv.caseId) ? <button className="font-mono hover:underline" onClick={() => navigate(`/growth/cases/${inv.caseId}?sf=billing`)}>{inv.caseId}</button> : <span className="font-mono" title="Completed case, no longer in the case list">{inv.caseId}</span>} · {inv.patient} · {inv.dentist}{inv.stage ? ` · stage ${inv.stage}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pending && <button className={btnPrimary} disabled={!!unmapped} onClick={() => { approveInvoices([inv.id]); toast.success('Approved, posted to Xero and emailed'); }}><Check className="w-3.5 h-3.5" /> Approve & send</button>}
          <button className={btn} onClick={print}><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
          {inv.issuedAt && inv.status !== 'void' && <>
            <button className={btn} onClick={() => { resendInvoice(inv.id); toast.success(`Resent to ${acc?.emails.join(', ')}`); }}><Mail className="w-3.5 h-3.5" /> Resend</button>
            {outstanding(inv) > 0 && <button className={btn} onClick={() => { const rel = simulatePayment(inv.id); toast.success(`Payment read from Xero${rel.length ? `; hold lifted, ${rel.length} case(s) released` : ''}`); }} title="Mock: the practice pays in Xero"><CircleDollarSign className="w-3.5 h-3.5" /> Payment arrives in Xero</button>}
            <button className={btn} onClick={() => setCredit(true)}><FileMinus className="w-3.5 h-3.5" /> Credit note</button>
            <button className={btnDanger} disabled={inv.payments.length > 0} title={inv.payments.length ? 'Has payments in Xero: use a credit note instead' : undefined} onClick={() => setVoiding(true)}><Ban className="w-3.5 h-3.5" /> Void & reissue</button>
          </>}
        </div>
      </div>

      {inv.replacedBy && <Note tone="amber">Voided and reissued as <button className="font-semibold underline" onClick={() => navigate(`/growth/billing/invoices/${inv.replacedBy}`)}>{s.invoices.find(i => i.id === inv.replacedBy)?.number ?? 'a new draft'}</button>.</Note>}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 space-y-4">
          <Card title="PDF preview" sub={inv.issuedAt ? 'As emailed and posted to Xero. Sent invoices never change: fixes are a credit note or void & reissue.' : 'Not numbered until approved.'}>
            <div className="border border-[#F0EFF6] rounded-lg p-5 bg-white overflow-x-auto"><InvoiceDoc inv={inv} acc={acc} s={s} /></div>
            {inv.som && <div className="border border-[#F0EFF6] rounded-lg p-5 bg-white mt-3 overflow-x-auto"><SomDoc inv={inv} /></div>}
          </Card>
        </div>
        <div className="xl:col-span-2 space-y-4">
          {pending && inv.flags.length > 0 && (
            <Card title={<span className="inline-flex items-center gap-1.5 text-[#B45309]"><AlertTriangle className="w-4 h-4" /> Flagged before sending</span>}>
              <div className="space-y-3">
                {inv.flags.map((f, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-[#030213]">{f.message}</p>
                    {f.kind === 'new-order-type' && unmapped && meta?.scannerOrderType && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <select className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs" defaultValue="" onChange={e => { if (!e.target.value) return; mapOrderType(meta.scannerOrderType!, e.target.value); toast.success('Mapped and remembered for every future order'); }}>
                          <option value="">Pick the catalog item…</option>
                          {s.catalog.map(it => <option key={it.id} value={it.id}>{it.code} · {it.name}</option>)}
                        </select>
                      </div>
                    )}
                    {f.kind === 'nhs-unclear' && (
                      <div className="mt-1.5 flex gap-2"><button className={btn} onClick={() => setCaseKind(inv.caseId, 'NHS')}>It's NHS</button><button className={btn} onClick={() => setCaseKind(inv.caseId, 'Private')}>It's private</button></div>
                    )}
                    {f.kind === 'remake' && (
                      <div className="mt-1.5 flex flex-wrap gap-2"><button className={btn} onClick={() => decideRemake(inv.caseId, 'no-charge')}>Remake: no charge</button><button className={btn} onClick={() => decideRemake(inv.caseId, 'charge')}>Remake, but charge</button><button className={btn} onClick={() => notRemake(inv.caseId)}>Not a remake</button></div>
                    )}
                    {f.kind === 'unusual-price' && <p className="text-[11px] text-[#717182] mt-1">Check the line below; approve if it's right.</p>}
                    {f.kind === 'design-diff' && <div className="mt-1.5 flex flex-wrap gap-2"><button className={btn} onClick={() => { checkDesignDiff(inv.caseId); toast.success('Checked: priced from what was designed'); }}>Checked: bill what was designed</button><button className={btn} onClick={() => navigate(`/growth/cases/${inv.caseId}?sf=cad`)}>Open the design</button></div>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Lines and where each price came from" pad={false}>
            <table className="w-full">
              <thead><tr><th className={th}>Line</th><th className={th}>Price from</th><th className={`${th} text-right`}>Amount</th></tr></thead>
              <tbody>
                {inv.lines.map(l => (
                  <tr key={l.id}>
                    <td className={td}>
                      {l.description}
                      <span className="block text-[#717182]">{l.qty} × {money(l.unitPrice, cur)} · {l.kind}{l.listPrice !== l.unitPrice && l.listPrice ? ` · list ${money(l.listPrice, cur)}` : ''}</span>
                      {why === l.id && <span className="block mt-1 text-[11px] text-[#1565C0] bg-[#F5F9FF] rounded px-2 py-1">{sourceText(l.source, cur)}</span>}
                    </td>
                    <td className={td}>
                      <button onClick={() => setWhy(why === l.id ? null : l.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:underline"><HelpCircle className="w-3 h-3" /> {sourceShort(l.source)}</button>
                      {pending && l.itemId && <button onClick={() => setEdit(l)} className="block mt-1 text-[11px] text-[#717182] hover:text-[#030213]"><Pencil className="w-3 h-3 inline -mt-0.5" /> Type a price</button>}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>{money(lineNet(l), cur)}</td>
                  </tr>
                ))}
                <tr><td className={`${td} font-semibold`} colSpan={2}>Total{t.vat ? ` (incl. VAT ${money(t.vat, cur)})` : ''}</td><td className={`${td} text-right font-semibold`}>{money(t.gross, cur)}</td></tr>
              </tbody>
            </table>
          </Card>

          <Card title="Payments and credits" sub="Read back from Xero.">
            {inv.payments.length + inv.creditNotes.length === 0 ? <p className="text-xs text-[#A0A0B0]">{inv.issuedAt ? 'Nothing paid yet.' : 'Not sent yet.'}</p> : (
              <ul className="space-y-1.5 text-xs">
                {inv.payments.map(p => <li key={p.id} className="flex justify-between"><span>{fmtDate(p.at)} · {p.ref}</span><span className="text-[#2E7D32] font-semibold">{money(p.amount, cur)}</span></li>)}
                {inv.creditNotes.map(c => <li key={c.id} className="flex justify-between"><span>{fmtDate(c.at)} · {c.number} ({c.full ? 'full' : 'partial'}): {c.reason}</span><span className="text-[#B45309] font-semibold">−{money(c.amount, cur)}</span></li>)}
              </ul>
            )}
            {inv.issuedAt && <p className="text-xs mt-2 pt-2 border-t border-[#F0EFF6] flex justify-between"><span className="text-[#717182]">Still owed{inv.dueAt ? ` · due ${fmtDate(inv.dueAt)}` : ''}</span><span className={`font-semibold ${isOverdue(inv) ? 'text-[#C62828]' : ''}`}>{money(outstanding(inv), cur)}</span></p>}
          </Card>

          <Card title="Timeline">
            <ol className="space-y-1.5">
              {[...inv.timeline].reverse().map((e, i) => <li key={i} className="text-xs flex gap-2"><span className="text-[#A0A0B0] w-20 flex-shrink-0">{fmtDate(e.at)}</span><span className="text-[#030213]">{e.text}</span></li>)}
            </ol>
            {inv.xeroId && <p className="text-[11px] text-[#A0A0B0] mt-2">{s.setup.provider === 'quickbooks' ? 'QuickBooks' : 'Xero'} reference {inv.xeroId}{inv.emailedTo?.length ? ` · emailed to ${inv.emailedTo.join(', ')}` : ''}</p>}
          </Card>
        </div>
      </div>

      {edit && <OverrideModal inv={inv} line={edit} onClose={() => setEdit(null)} />}
      {credit && <CreditModal inv={inv} onClose={() => setCredit(false)} />}
      {voiding && (
        <Modal isOpen onClose={() => setVoiding(false)} title={`Void ${inv.number} and reissue?`} footer={
          <div className="flex justify-end gap-2"><button className={btn} onClick={() => setVoiding(false)}>Cancel</button><button className={btnDanger} onClick={() => { const next = voidAndReissue(inv.id); setVoiding(false); toast.success('Voided in Smile Genius and Xero; a new invoice is ready'); if (next) navigate(`/growth/billing/invoices/${next}`); }}><RefreshCw className="w-3.5 h-3.5" /> Void & reissue</button></div>
        }>
          <p className="text-sm text-[#5A5568]">The invoice is voided here and in Xero, and a new one is created from the case as it is now, with a new number. Use this when the details were wrong; use a credit note to reduce what's owed.</p>
        </Modal>
      )}
    </div>
  );
}

function OverrideModal({ inv, line, onClose }: { inv: Invoice; line: InvoiceLine; onClose: () => void }) {
  const { toast } = useToast();
  const [price, setPrice] = useState(String(line.unitPrice));
  const [reason, setReason] = useState('');
  return (
    <Modal isOpen onClose={onClose} title="Type a price for this line" footer={
      <div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!reason.trim() || !(Number(price) >= 0)} onClick={() => { overrideLine(inv.id, line.id, Number(price), reason.trim()); toast.success('Price set; shown as "Typed" with your reason'); onClose(); }}>Save</button></div>
    }>
      <div className="space-y-3">
        <p className="text-xs text-[#717182]">{line.description} · now {money(line.unitPrice, inv.currency)} ({sourceShort(line.source)})</p>
        <Field label={`Unit price (${inv.currency})`}><input className={input} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></Field>
        <Field label="Reason" hint="Needed: it shows on the line and in the Given away report."><input className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Agreed with the practice" /></Field>
      </div>
    </Modal>
  );
}

function CreditModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { toast } = useToast();
  const max = totals(inv).gross - credited(inv);
  const [full, setFull] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Modal isOpen onClose={onClose} title={`Credit note on ${inv.number}`} footer={
      <div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!reason.trim() || (!full && !(Number(amount) > 0 && Number(amount) <= max))} onClick={() => { creditNote(inv.id, Number(amount), reason.trim(), full); toast.success('Credit note posted to Xero and emailed'); onClose(); }}>Issue credit note</button></div>
    }>
      <div className="space-y-3">
        <div className="flex gap-2">
          <button className={`${btn} ${!full ? '!border-[#4D8EF7] !text-[#1565C0]' : ''}`} onClick={() => setFull(false)}>Partial</button>
          <button className={`${btn} ${full ? '!border-[#4D8EF7] !text-[#1565C0]' : ''}`} onClick={() => setFull(true)}>Full ({money(max, inv.currency)})</button>
        </div>
        {!full && <Field label={`Amount (${inv.currency}), up to ${money(max, inv.currency)}`}><input className={input} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>}
        <Field label="Reason"><input className={input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Shade adjustment" /></Field>
      </div>
    </Modal>
  );
}
