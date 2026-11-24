import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, X } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import { resetBillingDemo, setViewAs, simulateBankPayment, simulateScanFromNewPractice, simulateToolEvent, useBilling } from '../billingStore';
import { toolName } from '../engine';

// ── V1 Demo panel: everything that exists only for the demo, out of the product ──
// View as accountant, pretend events from the accounting tool or the bank,
// a scan from a new practice, and reset. Bottom-left, collapsed by default.

export default function DemoPanel() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const tool = toolName(s);
  const b = 'w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] hover:bg-white/10 disabled:opacity-40';
  if (!open) return createPortal(<button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#030213] text-white text-[11px] font-semibold shadow-lg opacity-80 hover:opacity-100" title="Demo controls (not part of the product)"><FlaskConical className="w-3.5 h-3.5" /> Demo</button>, document.body);
  return createPortal(
    <div className="fixed bottom-4 left-4 z-40 w-64 rounded-2xl bg-[#030213] text-white shadow-2xl p-3 space-y-2">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold inline-flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Demo controls</p><button onClick={() => setOpen(false)} aria-label="Close"><X className="w-4 h-4 opacity-70" /></button></div>
      <p className="text-[10px] text-white/60">Not part of the product. Pretend things happen so you can see how Billing reacts.</p>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Look at it as</p>
        <div className="flex gap-1">
          {(['admin', 'accountant'] as const).map(v => <button key={v} onClick={() => { setViewAs(v); navigate(v === 'accountant' ? '/growth/billing/invoices' : '/growth/billing'); }} className={`flex-1 px-2 py-1 rounded-md text-[11px] font-semibold ${s.viewAs === v ? 'bg-white text-[#030213]' : 'bg-white/10'}`}>{v === 'admin' ? 'Lab admin' : 'Accountant'}</button>)}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-white/50 mb-1">Something happens</p>
        <button className={b} onClick={() => { const n = simulateScanFromNewPractice(); toast.success(`A scan arrived from ${n}`); }}>A scan from a new practice</button>
        <button className={b} disabled={!tool} onClick={() => { simulateToolEvent('edited'); toast.success(`An invoice was changed in ${tool}`); }}>Someone edits an invoice in {tool ?? 'Xero'}</button>
        <button className={b} disabled={!tool} onClick={() => { simulateToolEvent('voided'); toast.success(`An invoice was cancelled in ${tool}`); }}>Someone cancels one in {tool ?? 'Xero'}</button>
        <button className={b} disabled={!tool} onClick={() => { simulateToolEvent('failed'); toast.success('An invoice failed to post'); }}>An invoice fails to post</button>
        <button className={b} disabled={!tool} onClick={() => { simulateToolEvent('expired'); toast.success(`${tool} connection expired`); }}>{tool ?? 'Xero'} sign-in expires</button>
        <button className={b} disabled={!s.bank} onClick={() => { simulateBankPayment('reference'); toast.success('Payment with an invoice number arrived'); }}>Bank: payment quoting an invoice</button>
        <button className={b} disabled={!s.bank} onClick={() => { simulateBankPayment('unknown'); toast.success('Payment from an unknown payer arrived'); }}>Bank: payment with no reference</button>
        {!s.bank && <p className="text-[10px] text-white/40 px-2.5">Bank events: choose "None of these" › a bank in Settings first.</p>}
      </div>
      <button className="w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20" onClick={() => { resetBillingDemo(); toast.success('Demo data reset'); navigate('/growth/billing'); }}>Reset demo data</button>
    </div>
  , document.body);
}
