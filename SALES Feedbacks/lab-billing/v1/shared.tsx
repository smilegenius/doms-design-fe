import { useState } from 'react';
import { CheckCircle2, Mail, Printer, Send, Sparkles } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { printPages } from '../../bulk-actions/printForms';
import type { BillingAccount, BillingState, Invoice } from '../types';
import { account, buildStatement, isOverdue, outstanding, statementRef, termsLabel, toolName, totals } from '../engine';
import { fmtDate, fmtMonth, fmtShort, money, monthOf, pl, prevMonth, today } from '../format';
import { confirmPractice, sendInvoices, sendStatementFor, useBilling } from '../billingStore';
import { StatementDoc } from '../BillingDocs';
import { btn, btnPrimary, Field, input, InvoiceStatusPill, Note, Seg } from '../ui';

// ── V1 shared pieces: plain-language helpers and the three "send" dialogs ─────

export const practiceUrl = (id: string) => `/growth/billing/practices/${encodeURIComponent(id)}`;
export const dentistUrl = (name: string) => `/growth/billing/dentists/${encodeURIComponent(name)}`;
export const invoiceUrl = (id: string) => `/growth/billing/invoices/${encodeURIComponent(id)}`;

/** Practices created automatically from a scan that nobody has checked yet. */
export const unconfirmed = (s: BillingState) => s.accounts.filter(a => a.fromScan && !a.confirmedAt);

/** Accounts that get invoices and statements: practices, and dentists who pay directly. */
export const payers = (s: BillingState) => s.accounts.filter(a => a.kind === 'practice' || a.payer === 'dentist');

/** "Billed per case · 30 days · accounts@…": the whole billing setup in one line. */
export function setupLine(s: BillingState, a: BillingAccount) {
  return [
    a.invoiceMode === 'month-end' ? 'Billed once a month' : 'Billed per case',
    termsLabel(s, a).endsWith('days') ? `pays in ${termsLabel(s, a)}` : `pays ${termsLabel(s, a).toLowerCase()}`,
    a.emails.length ? a.emails.join(', ') : 'no billing email yet',
    a.currency !== 'GBP' ? a.currency : null,
  ].filter(Boolean).join(' · ');
}

export const owedBy = (s: BillingState, accountId: string) => s.invoices.filter(i => i.accountId === accountId).reduce((n, i) => n + outstanding(i), 0) + s.xeroOnly.filter(x => x.accountId === accountId).reduce((n, x) => n + (x.amount - x.paid), 0);
export const overdueBy = (s: BillingState, accountId: string) => s.invoices.filter(i => i.accountId === accountId && isOverdue(i)).reduce((n, i) => n + outstanding(i), 0) + s.xeroOnly.filter(x => x.accountId === accountId && x.amount > x.paid && x.due < today()).reduce((n, x) => n + (x.amount - x.paid), 0);

/** Plain status for a list row: what a person would say out loud. */
export function plainStatus(i: Invoice): string {
  if (i.status === 'draft' || i.status === 'flagged') return i.flags.length ? 'Needs a look' : 'Ready to send';
  if (i.status === 'void') return 'Cancelled';
  if (outstanding(i) <= 0.005) return 'Paid';
  if (isOverdue(i)) return 'Overdue';
  if (i.status === 'part-paid') return 'Part paid';
  return 'Sent';
}

/** Small "how this works" line under a heading: findability without a manual. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#717182] flex items-start gap-1.5"><Sparkles className="w-3 h-3 mt-0.5 text-[#7C6BFF] flex-shrink-0" /><span>{children}</span></p>;
}

// ── Confirm a practice that arrived with a scan ──────────────────────────────

export function ConfirmPracticeModal({ a, onClose }: { a: BillingAccount; onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [emails, setEmails] = useState(a.emails.join(', '));
  const [mode, setMode] = useState<'per-case' | 'month-end'>(a.invoiceMode ?? 'per-case');
  const [terms, setTerms] = useState(a.termsDays ? String(a.termsDays) : '');
  const tool = toolName(s);
  const waiting = s.invoices.filter(i => i.accountId === a.id && (i.status === 'draft' || i.status === 'flagged'));
  const dentists = [...new Set(waiting.map(i => i.dentist))];
  const list = emails.split(/[,;\s]+/).filter(Boolean);
  const ok = list.length > 0 && list.every(e => /.+@.+\..+/.test(e));
  return (
    <Modal isOpen onClose={onClose} title={`Who do we bill at ${a.name}?`} footer={
      <div className="flex justify-end gap-2">
        <button className={btn} onClick={onClose}>Later</button>
        <button className={btnPrimary} disabled={!ok} onClick={() => {
          const n = confirmPractice(a.id, { emails: list, invoiceMode: mode, termsDays: terms ? Number(terms) : null });
          toast.success(`${a.name} confirmed${n ? `: ${pl(n, 'invoice')} sent` : ''}${tool ? `, added to ${tool}` : ''}`);
          onClose();
        }}><CheckCircle2 className="w-3.5 h-3.5" /> Confirm{waiting.length ? ` and send ${pl(waiting.length, 'invoice')}` : ''}</button>
      </div>
    }>
      <div className="space-y-4">
        <Note tone="blue">A scan came in from {dentists.join(', ') || 'a dentist'} at <b>{a.name}</b>, a practice you haven't billed before. We added the practice so the case isn't held up; {waiting.length ? `its ${pl(waiting.length, 'invoice')} will wait` : 'invoices will wait'} until you check these three things.</Note>
        <Field label="1. Billing email" hint="Invoices and statements go here. Ask the practice if you're not sure.">
          <input className={input} value={emails} onChange={e => setEmails(e.target.value)} placeholder="accounts@practice.co.uk" autoFocus />
        </Field>
        <Field label="2. How do they pay?">
          <Seg value={mode} onChange={setMode} options={[{ value: 'per-case', label: 'An invoice per case' }, { value: 'month-end', label: 'One invoice a month' }]} />
        </Field>
        <Field label="3. Payment terms (days)" hint={`Leave empty for your usual terms (${termsLabel(s, undefined).toLowerCase()}).`}>
          <input className={input} type="number" min="0" value={terms} onChange={e => setTerms(e.target.value)} placeholder="Usual terms" />
        </Field>
        <p className="text-[11px] text-[#717182]">{tool ? `A ${tool} contact is created (or matched by name) when you confirm. ` : ''}Their own prices, dentists who pay directly and the rest are on the practice's page, any time.</p>
      </div>
    </Modal>
  );
}

// ── Send a statement for one practice (or a dentist who pays directly) ───────

export function SendStatementModal({ a, onClose }: { a: BillingAccount; onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const t = today();
  const months = [monthOf(t), prevMonth(monthOf(t)), prevMonth(prevMonth(monthOf(t)))];
  const [ym, setYm] = useState(Number(t.slice(8)) <= 7 ? months[1] : months[0]);
  const existing = s.statements.find(x => x.accountId === a.id && x.period === ym && x.status === 'sent');
  const st = existing ?? buildStatement(s, a.id, ym);
  const print = () => printPages([{ key: st.id, node: <StatementDoc st={st} acc={a} /> }], `Statement ${fmtMonth(ym)}`);
  return (
    <Modal isOpen onClose={onClose} size="lg" title={`Statement for ${a.name}`} footer={
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[#717182]">{existing ? `Sent ${fmtShort(existing.sentAt)}. Sending again emails the same statement.` : `Reference ${statementRef(st)}`}</span>
        <div className="flex gap-2">
          <button className={btn} onClick={print}><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
          <button className={btnPrimary} disabled={!a.emails.length} onClick={() => { sendStatementFor(a.id, ym); toast.success(`Statement for ${fmtMonth(ym)} sent to ${a.emails.join(', ')}`); onClose(); }}><Send className="w-3.5 h-3.5" /> {existing ? 'Send again' : 'Send'} to {a.emails[0] ?? 'no email'}{a.emails.length > 1 ? ` +${a.emails.length - 1}` : ''}</button>
        </div>
      </div>
    }>
      <div className="space-y-3">
        <Seg value={ym} onChange={setYm} options={months.map(m => ({ value: m, label: m === monthOf(t) ? `${fmtMonth(m)} so far` : fmtMonth(m) }))} />
        {!a.emails.length && <Note tone="amber">No billing email yet: add one on the practice's Setup tab, or print it.</Note>}
        <div className="border border-[#F0EFF6] rounded-lg p-5 bg-white overflow-x-auto max-h-[55vh] overflow-y-auto"><StatementDoc st={st} acc={a} /></div>
      </div>
    </Modal>
  );
}

// ── Send chosen invoices (a copy) to the practice, a dentist, or anyone ──────

export function SendInvoicesModal({ invoices, to, title, onClose }: { invoices: Invoice[]; to: string[]; title: string; onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const sendable = invoices.filter(i => i.number && i.status !== 'void');
  const [picked, setPicked] = useState<string[]>(() => sendable.filter(i => outstanding(i) > 0).map(i => i.id));
  const [addr, setAddr] = useState(to.join(', '));
  const list = addr.split(/[,;\s]+/).filter(Boolean);
  return (
    <Modal isOpen onClose={onClose} size="lg" title={title} footer={
      <div className="flex justify-end gap-2">
        <button className={btn} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} disabled={!picked.length || !list.length} onClick={() => { const n = sendInvoices(picked, list); toast.success(`${pl(n, 'invoice')} sent to ${list.join(', ')}`); onClose(); }}><Mail className="w-3.5 h-3.5" /> Send {picked.length ? pl(picked.length, 'invoice') : ''}</button>
      </div>
    }>
      <div className="space-y-3">
        <Field label="Send to" hint="Their billing email, or type any address (comma-separated)."><input className={input} value={addr} onChange={e => setAddr(e.target.value)} /></Field>
        {!sendable.length ? <p className="text-xs text-[#A0A0B0]">No sent invoices yet.</p> : (
          <>
            <div className="flex gap-3 text-[11px]">
              <button className="text-[#4D8EF7] font-semibold" onClick={() => setPicked(sendable.filter(i => outstanding(i) > 0).map(i => i.id))}>Unpaid only</button>
              <button className="text-[#4D8EF7] font-semibold" onClick={() => setPicked(sendable.map(i => i.id))}>All</button>
              <button className="text-[#717182]" onClick={() => setPicked([])}>None</button>
            </div>
            <ul className="max-h-[45vh] overflow-y-auto divide-y divide-[#F0EFF6] border border-[#F0EFF6] rounded-lg">
              {sendable.map(i => (
                <li key={i.id}>
                  <label className="flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-[#FAFAFD]">
                    <input type="checkbox" checked={picked.includes(i.id)} onChange={() => setPicked(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} />
                    <span className="font-mono font-semibold w-20">{i.number}</span>
                    <span className="flex-1 min-w-0 truncate">{i.cases?.length ? `Month invoice · ${pl(i.cases.length, 'case')}` : `${i.patient} · ${i.dentist}`}</span>
                    <span className="text-[#717182]">{fmtDate(i.issuedAt)}</span>
                    <InvoiceStatusPill status={i.status} overdue={isOverdue(i)} />
                    <span className="font-semibold w-20 text-right">{money(totals(i).gross, i.currency)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[11px] text-[#717182]">Sends a copy; nothing about the invoice changes{toolName(s) ? ` in ${toolName(s)}` : ''}.</p>
      </div>
    </Modal>
  );
}

export { account };
