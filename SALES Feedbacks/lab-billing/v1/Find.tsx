import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, Search, Stethoscope, Users, Wand2 } from 'lucide-react';
import { useBilling } from '../billingStore';
import { account, totals } from '../engine';
import { money } from '../format';
import { dentistRows } from '../labInsights';
import { dentistUrl, invoiceUrl, practiceUrl } from './shared';

// ── V1 Find (⌘K): "how do I…" and "where is…" in one box ─────────────────────
// So a lab never has to ask support where something is: every task Billing
// can do is listed with the words people actually use, and shows the path
// ("Practices › the practice › Prices") as well as taking you there.

const B = '/growth/billing';
interface Task { label: string; path: string; to: string; words: string }
const TASKS: Task[] = [
  { label: 'Send a practice its statement', path: 'Practices › the practice › Send statement', to: `${B}/practices`, words: 'statement resend email monthly account balance' },
  { label: 'Send statements to every practice', path: 'Home › This month › Send statements', to: B, words: 'statements all month end bulk' },
  { label: 'Send a copy of an invoice', path: 'Invoices › tick it › Send a copy (or the invoice › Send a copy)', to: `${B}/invoices?show=unpaid`, words: 'resend invoice copy email again forward' },
  { label: 'Send a dentist their invoices', path: 'Practices › Dentists › the dentist › Send their invoices', to: `${B}/practices?view=dentists`, words: 'dentist invoices copy associate' },
  { label: 'Give money back (credit note)', path: 'The invoice › Fix this invoice › Give money back', to: `${B}/invoices?show=unpaid`, words: 'credit note refund money back discount after sending partial' },
  { label: 'Correct a price on a sent invoice', path: 'The invoice › Fix this invoice › A price or a line is wrong', to: `${B}/invoices?show=unpaid`, words: 'edit change price wrong mistake void reissue amend' },
  { label: 'Move an invoice to another practice', path: 'The invoice › Fix this invoice › Wrong practice', to: `${B}/invoices?show=unpaid`, words: 're-issue reissue wrong account practice dentist bill to' },
  { label: 'Cancel an invoice', path: 'The invoice › Fix this invoice (credit all of it, or correct it)', to: `${B}/invoices?show=unpaid`, words: 'void cancel delete invoice' },
  { label: 'Change a price before an invoice is sent', path: 'Invoices › Waiting for you › the invoice › Change price', to: `${B}/invoices?show=waiting`, words: 'override price line draft waiting' },
  { label: 'Mark an invoice paid', path: 'Invoices › tick › Mark paid (no accounting tool)', to: `${B}/invoices?show=unpaid`, words: 'paid payment cash cheque transfer received' },
  { label: 'Approve waiting invoices', path: 'Home › Needs you, or Invoices › Waiting for you', to: `${B}/invoices?show=waiting`, words: 'approve send draft flagged waiting pending' },
  { label: 'See who owes money / overdue invoices', path: 'Invoices › Overdue, or Practices › Overdue', to: `${B}/invoices?show=overdue`, words: 'overdue debt owe owed late chase unpaid aged debtors' },
  { label: 'Archive paid invoices', path: 'Invoices › Paid › tick › Archive', to: `${B}/invoices?show=paid`, words: 'archive hide clear old paid tidy' },
  { label: 'Invoice the month for monthly practices', path: 'Invoices › Review and invoice month', to: `${B}/invoices?show=to-invoice`, words: 'month end monthly to invoice pot batch' },
  { label: 'Bill a practice once a month', path: 'Practices › the practice › Setup › How do they pay?', to: `${B}/practices`, words: 'monthly month end per case invoice mode rhythm' },
  { label: 'Give a practice its own prices', path: 'Practices › the practice › Prices', to: `${B}/practices`, words: 'account based pricing price list discount special agreed custom practice prices' },
  { label: 'Change my standard prices', path: 'Settings › Prices', to: `${B}/settings/prices`, words: 'catalog price list increase rise products items fee schedule' },
  { label: 'Plan a price rise from a date', path: 'Settings › Prices › the item (or bulk change)', to: `${B}/settings/prices`, words: 'price increase rise schedule future date annual' },
  { label: 'Run a promotion or volume discount', path: 'Settings › More options › Promotions', to: `${B}/settings/promotions`, words: 'promotion offer discount tier volume deal sale' },
  { label: 'Change payment terms for a practice', path: 'Practices › the practice › Setup', to: `${B}/practices`, words: 'terms days due net 30 45 credit' },
  { label: 'Change payment terms for everyone', path: 'Settings › The basics › question 3', to: `${B}/settings`, words: 'terms days due default lab' },
  { label: 'Change where invoices are emailed', path: 'Practices › the practice › Setup › Billing email', to: `${B}/practices`, words: 'email address billing contact accounts bounced' },
  { label: 'Send case updates to reception', path: 'Practices › the practice › Setup › Updates for reception', to: `${B}/practices`, words: 'reception status updates notifications' },
  { label: 'Let a dentist pay for their own cases', path: 'Practices › the practice › Dentists › Who pays', to: `${B}/practices?view=dentists`, words: 'dentist pays directly own account associate self employed' },
  { label: 'Check a new practice from a scan', path: 'Practices › New from scans', to: `${B}/practices`, words: 'new practice scan unknown confirm create account add practice' },
  { label: 'See who is sending less', path: 'Practices › Worth a call', to: `${B}/practices`, words: 'slowing quiet churn lost drop insights trend health call' },
  { label: 'Add a note after a call', path: 'Practices › the practice › Add a note', to: `${B}/practices`, words: 'note call log comment' },
  { label: 'Download for my accountant', path: 'Invoices › Download', to: `${B}/invoices?show=all`, words: 'export csv download accountant spreadsheet' },
  { label: 'NHS / private split per dentist', path: 'Practices › Download › Billing by practice and dentist', to: `${B}/practices`, words: 'nhs private split associate pay dentist report' },
  { label: 'Reports: remakes, given away, not billed, cash', path: 'Practices › Download', to: `${B}/practices`, words: 'report remakes given away unbilled cash flow' },
  { label: 'Connect Xero, QuickBooks, Sage or FreeAgent', path: 'Settings › The basics › question 1', to: `${B}/settings`, words: 'xero quickbooks sage freeagent accounting connect integration sync' },
  { label: 'Connect my bank (Revolut, Wise)', path: 'Settings › The basics › None of these › bank', to: `${B}/settings`, words: 'bank revolut wise reconcile match payments' },
  { label: 'Let my accountant check invoices in Xero first', path: 'Settings › More options', to: `${B}/settings/more`, words: 'draft accountant approve xero check' },
  { label: 'Approve every invoice before it goes', path: 'Settings › More options › Check invoices before they\'re sent', to: `${B}/settings/more`, words: 'approval review auto send manual' },
  { label: 'Credit limits and cases on hold', path: 'Settings › More options › Credit limits', to: `${B}/settings/more`, words: 'limit hold pause credit stop work' },
  { label: 'VAT number on invoices', path: 'Settings › The basics › Your lab on invoices', to: `${B}/settings`, words: 'vat tax number' },
  { label: 'Statement of manufacture on invoices', path: 'Settings › More options', to: `${B}/settings/more`, words: 'statement of manufacture som mdr conformity' },
  { label: 'One line per case on invoices', path: 'Settings › More options › Invoice layout', to: `${B}/settings/more`, words: 'layout simple detailed lines' },
  { label: 'Monday email summary', path: 'Settings › More options › Monday email', to: `${B}/settings/more`, words: 'monday weekly email summary digest' },
];

type Hit = { key: string; icon: 'task' | 'practice' | 'dentist' | 'invoice'; label: string; sub: string; to: string };

export default function Find({ onClose }: { onClose: () => void }) {
  const s = useBilling();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const dentists = useMemo(() => dentistRows(s).map(r => r.dentist), [s]);
  const hits = useMemo<Hit[]>(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (text: string) => words.every(w => text.toLowerCase().includes(w));
    const tasks = TASKS.filter(t => !words.length || match(`${t.label} ${t.words}`)).map(t => ({ key: t.label, icon: 'task' as const, label: t.label, sub: t.path, to: t.to }));
    if (!words.length) return tasks.slice(0, 8);
    const practices = s.accounts.filter(a => a.kind === 'practice' && match(a.name)).slice(0, 5).map(a => ({ key: a.id, icon: 'practice' as const, label: a.name, sub: 'Practice: invoices, statements, prices, setup', to: practiceUrl(a.id) }));
    const ds = dentists.filter(d => match(d)).slice(0, 4).map(d => ({ key: `d-${d}`, icon: 'dentist' as const, label: d, sub: 'Dentist', to: dentistUrl(d) }));
    const invs = s.invoices.filter(x => match(`${x.number ?? ''} ${x.caseId} ${x.patient}`)).slice(0, 5).map(x => ({ key: x.id, icon: 'invoice' as const, label: `${x.number ?? 'Not sent'} · ${x.patient}`, sub: `${account(s, x.accountId)?.name} · ${money(totals(x).gross, x.currency)}`, to: invoiceUrl(x.id) }));
    return [...tasks.slice(0, 6), ...practices, ...ds, ...invs];
  }, [q, s, dentists]);
  const go = (h: Hit) => { navigate(h.to); onClose(); };
  const ICON = { task: Wand2, practice: Users, dentist: Stethoscope, invoice: FileText };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/30 flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-[#F0EFF6]">
          <Search className="w-4 h-4 text-[#A0A0B0]" />
          <input ref={ref} value={q} onChange={e => { setQ(e.target.value); setI(0); }} placeholder='What do you want to do? e.g. "credit", "own prices", "Leeds"'
            className="flex-1 py-3.5 text-sm outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(hits.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
              if (e.key === 'Enter' && hits[i]) go(hits[i]);
            }} />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F3F7] border border-[#E0E0E6] text-[#717182]">Esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {!q && <li className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#A0A0B0]">Things people often look for</li>}
          {hits.map((h, k) => {
            const Icon = ICON[h.icon];
            return (
              <li key={h.key}>
                <button onMouseEnter={() => setI(k)} onClick={() => go(h)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${k === i ? 'bg-[#F5F9FF]' : ''}`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${h.icon === 'task' ? 'text-[#7C6BFF]' : 'text-[#717182]'}`} />
                  <span className="flex-1 min-w-0"><span className="block text-sm text-[#030213] truncate">{h.label}</span><span className="block text-[11px] text-[#717182] truncate">{h.sub}</span></span>
                  {k === i && <CornerDownLeft className="w-3.5 h-3.5 text-[#A0A0B0]" />}
                </button>
              </li>
            );
          })}
          {!hits.length && <li className="px-4 py-6 text-center text-xs text-[#717182]">Nothing matches "{q}". Try a word like statement, credit, prices, terms or a practice's name.</li>}
        </ul>
      </div>
    </div>
  , document.body);
}
