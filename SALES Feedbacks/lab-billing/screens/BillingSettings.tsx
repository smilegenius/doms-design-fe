import { useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Ban, FileMinus, Landmark, Loader2, Mail, Paperclip, Plug, RefreshCw, UserPlus, Zap } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { accentFor, getIntakeConfig } from '../../intake-form/intakeStore';
import { LabLogo } from '../../bulk-actions/printForms';
import type { LabBillingSettings, Provider, Templates } from '../types';
import { fmtDate, pl } from '../format';
import { connectBank, connectProvider, disconnectProvider, simulateBankPayment, simulateToolEvent, updateSettings, updateSetup, updateTemplates, useBilling } from '../billingStore';
import { PROVIDER_NAME, toolName } from '../engine';
import { billingAccounts } from '../insights';
import { btn, btnPrimary, Card, Field, input, Note, Pill, Seg, Toggle } from '../ui';

// ── 8. Billing settings: the lab-level settings ──────────────────────────────
// Admins only. Most labs accept the defaults; practice and item settings only
// override these where they need to.

const SYNC_ICON = { post: ArrowUpRight, payment: ArrowDownLeft, contact: UserPlus, credit: FileMinus, void: Ban, read: RefreshCw, error: AlertCircle };

export default function BillingSettings() {
  const s = useBilling();
  const { toast } = useToast();
  const set = (patch: Partial<LabBillingSettings>, msg = 'Saved') => { updateSettings(patch); toast.success(msg); };
  const st = s.settings;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <Card title="Lab settings" sub="Set once. Accounts and catalog items override these only where they need to.">
          <div className="space-y-4">
            <Row label="VAT registered" hint="Most dental prostheses made by registered technicians are VAT-exempt. Confirm treatments with your accountant; Smile Genius doesn't advise on VAT.">
              <div className="flex flex-wrap items-center gap-2">
                <Seg value={st.vatRegistered ? 'yes' : 'no'} onChange={v => set({ vatRegistered: v === 'yes' }, v === 'yes' ? 'VAT fields turned on: VAT number on invoices, VAT treatment per item' : 'No VAT fields anywhere')} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
                {st.vatRegistered && <input className={`${input} w-44`} defaultValue={st.vatNumber} onBlur={e => updateSettings({ vatNumber: e.target.value })} placeholder="VAT number" />}
              </div>
            </Row>
            <Row label="When to create the invoice"><Seg value={st.invoiceOn} onChange={v => set({ invoiceOn: v })} options={[{ value: 'dispatched', label: 'Case dispatched' }, { value: 'completed', label: 'Case completed' }]} /></Row>
            <Row label="Approval" hint={st.approval === 'review-30' && s.setup.liveAt ? `Live since ${fmtDate(s.setup.liveAt)}: ${Math.max(0, 30 - Math.round((Date.now() - new Date(s.setup.liveAt).getTime()) / 86_400_000))} review days left.` : undefined}>
              <Seg value={st.approval} onChange={v => set({ approval: v })} options={[{ value: 'review-30', label: 'Review for 30 days, then auto' }, { value: 'review-all', label: 'Review every invoice' }, { value: 'auto', label: 'Auto-send unless flagged' }]} />
            </Row>
            <Row label="Statement day"><Seg value={st.statementDay} onChange={v => set({ statementDay: v })} options={[{ value: 'last-working', label: 'Last working day' }, { value: 'first', label: '1st of the month' }]} /></Row>
            <Row label="Payment terms">
              <div className="flex flex-wrap items-center gap-2">
                <Seg value={st.terms} onChange={v => set({ terms: v })} options={[{ value: '30', label: '30 days' }, { value: 'eom-following', label: 'End of following month' }, { value: 'custom', label: 'Custom' }]} />
                {st.terms === 'custom' && <input className={`${input} w-24`} type="number" defaultValue={st.customTermsDays} onBlur={e => updateSettings({ customTermsDays: Number(e.target.value) })} />}
              </div>
            </Row>
            <Row label="Attach statement of manufacture"><Seg value={st.som} onChange={v => set({ som: v })} options={[{ value: 'off', label: 'Off' }, { value: 'all', label: 'On for all' }, { value: 'per-account', label: 'Per practice' }]} /></Row>
            <Row label="Remakes under warranty"><Seg value={st.warrantyRemakes} onChange={v => set({ warrantyRemakes: v })} options={[{ value: 'none', label: 'No invoice' }, { value: 'zero', label: 'Zero-value invoice' }]} /></Row>
            <Row label="Send to the accounting tool as" hint="Approved by default: approval happens here, where the pricing is. Draft only if your accountant wants to sign off in the accounting tool.">
              <Seg value={st.postAs} onChange={v => set({ postAs: v })} options={[{ value: 'approved', label: 'Approved' }, { value: 'draft', label: 'Draft for my accountant' }]} />
            </Row>
            <Row label="Invoice layout" hint="Detailed lists every product; simple shows one line per case.">
              <Seg value={st.layout} onChange={v => set({ layout: v })} options={[{ value: 'detailed', label: 'Detailed' }, { value: 'simple', label: 'Simple' }]} />
            </Row>
            <Row label="Invoice numbering" hint={`Continues from ${toolName(s) ?? 'your accounting tool'}. Next: ${st.prefix}${s.nextNumber}. Credit notes have their own series (next CN-${String(s.nextCredit).padStart(4, '0')}).`}>
              <input className={`${input} w-28`} defaultValue={st.prefix} onBlur={e => set({ prefix: e.target.value }, 'Prefix saved')} />
            </Row>
            <Row label="Courier and pick-up charges" hint="Optional add-on item (still to validate with labs). Adds a courier line to every invoice."><Toggle on={st.courierAddOn} onChange={v => set({ courierAddOn: v })} label={st.courierAddOn ? 'On' : 'Off'} /></Row>
          </div>
        </Card>

        <Card title="Off until you need them" sub="Most labs never switch these on.">
          <div className="space-y-4">
            <Row label="Promotions and volume tiers" hint="Adds a Promotions & tiers tab. Off: prices come from price lists and the catalog only."><Toggle on={st.promotionsOn} onChange={v => set({ promotionsOn: v }, v ? 'Promotions & tiers tab added' : 'Promotions & tiers off')} label={st.promotionsOn ? 'On' : 'Off'} /></Row>
            <Row label="Credit limits and holds" hint="A limit per account that can pause new cases until a payment comes in."><Toggle on={st.limitsOn} onChange={v => set({ limitsOn: v }, v ? 'Credit limits on' : 'Credit limits off: no holds')} label={st.limitsOn ? 'On' : 'Off'} /></Row>
          </div>
        </Card>

        <Card title="Advanced" sub="The numbers the assists use. You shouldn't need to change them.">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Num label="Warn at % of a limit" value={st.limitWarnPct} onSave={v => set({ limitWarnPct: v })} />
            <Num label="Unusual price (% from usual)" value={st.unusualPricePct} onSave={v => set({ unusualPricePct: v })} />
            <Num label="Possible remake within (days)" value={st.remakeDays} onSave={v => set({ remakeDays: v })} />
            <Num label="Not yet billed after (days)" value={st.notBilledDays} onSave={v => set({ notBilledDays: v })} />
            <Num label="Default component markup %" value={st.passThroughMarkupPct} onSave={v => set({ passThroughMarkupPct: v })} />
          </div>
        </Card>

        <TemplatesCard />
      </div>

      <div className="space-y-4">
        <ConnectionCard />
        <Card title="Sync log" sub="Everything posted to and read from Xero." pad={false}>
          <ul className="divide-y divide-[#F0EFF6] max-h-[420px] overflow-y-auto">
            {s.sync.slice(0, 80).map(e => { const Icon = SYNC_ICON[e.kind]; return (
              <li key={e.id} className="flex gap-2 px-4 py-2 text-xs"><Icon className="w-3.5 h-3.5 mt-0.5 text-[#717182] flex-shrink-0" /><span className="flex-1 min-w-0">{e.text}</span><span className="text-[#A0A0B0] flex-shrink-0">{fmtDate(e.at)}</span></li>
            ); })}
          </ul>
        </Card>
        <Card title="Emails sent" sub={`${pl(s.emails.filter(e => e.bounced).length, 'bounce')} in the log.`} pad={false}>
          <ul className="divide-y divide-[#F0EFF6] max-h-[260px] overflow-y-auto">
            {s.emails.slice(0, 40).map(e => (
              <li key={e.id} className="flex gap-2 px-4 py-2 text-xs"><Mail className="w-3.5 h-3.5 mt-0.5 text-[#717182] flex-shrink-0" /><span className="flex-1 min-w-0 truncate">{e.subject} <span className="text-[#717182]">→ {e.to.join(', ')}</span></span>{e.bounced && <Pill tone="red">Bounced</Pill>}<span className="text-[#A0A0B0] flex-shrink-0">{fmtDate(e.at)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 pb-4 border-b border-[#F0EFF6] last:border-0 last:pb-0">
      <div><p className="text-xs font-semibold text-[#030213]">{label}</p>{hint && <p className="text-[11px] text-[#717182] mt-0.5">{hint}</p>}</div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}

function Num({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  return <Field label={label}><input className={input} type="number" defaultValue={value} onBlur={e => { const v = Number(e.target.value); if (v !== value) onSave(v); }} /></Field>;
}

const SAMPLE: Record<string, string> = { '{number}': 'INV-2481', '{lab}': '', '{patient}': 'Emma Smith', '{account}': 'Smile Genius Leeds', '{case}': 'CASE-1042', '{amount}': '£370.00', '{due}': '17 Nov 2026', '{month}': 'October 2026', '{balance}': '£2,140.00', '{overdue}': '£420.00', '{limit}': '£5,000' };

function TemplatesCard() {
  const s = useBilling();
  const { toast } = useToast();
  const [tab, setTab] = useState<keyof Templates>('invoice');
  const [t, setT] = useState<Templates>(s.templates);
  const cfg = getIntakeConfig();
  const fill = (x: string) => Object.entries({ ...SAMPLE, '{lab}': cfg.labName }).reduce((acc, [k, v]) => acc.split(k).join(v), x);
  return (
    <Card title="Email templates" sub="One each for invoices, statements and limit messages, with your logo (Settings → LabLink) and your wording." actions={<button className={btnPrimary} onClick={() => { updateTemplates(t); toast.success('Templates saved'); }}>Save templates</button>}>
      <Seg value={tab} onChange={setTab} options={[{ value: 'invoice', label: 'Invoice' }, { value: 'statement', label: 'Statement' }, { value: 'limit', label: 'Account limit' }]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
        <div className="space-y-2">
          <Field label="Subject"><input className={input} value={t[tab].subject} onChange={e => setT({ ...t, [tab]: { ...t[tab], subject: e.target.value } })} /></Field>
          <Field label="Message" hint="Placeholders: {account} {patient} {case} {number} {amount} {due} {month} {balance} {overdue} {limit} {lab}"><textarea className={`${input} font-mono text-[11px]`} rows={9} value={t[tab].body} onChange={e => setT({ ...t, [tab]: { ...t[tab], body: e.target.value } })} /></Field>
          <button className={btn} onClick={() => setT(s.templates)}>Undo changes</button>
        </div>
        <div className="rounded-xl border border-[#E0E0E6] p-4 bg-[#FAFAFD]">
          <p className="text-[10px] text-[#717182] mb-2">Preview</p>
          <div className="bg-white rounded-lg border border-[#F0EFF6] p-4">
            <LabLogo name={cfg.labName} logo={cfg.logo} accent={accentFor(cfg.accent)} />
            <p className="text-sm font-semibold text-[#030213] mt-3">{fill(t[tab].subject)}</p>
            <p className="text-xs text-[#5A5568] whitespace-pre-wrap mt-2 leading-relaxed">{fill(t[tab].body)}</p>
            {tab !== 'limit' && <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#1565C0] bg-[#EEF4FF] rounded px-2 py-1"><Paperclip className="w-3 h-3" /> {tab === 'invoice' ? 'INV-2481.pdf' : 'Statement-October-2026.pdf'}</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Connect / disconnect Xero or QuickBooks (simulated sign-in and organisation pick). */
function ConnectionCard() {
  const s = useBilling();
  const { toast } = useToast();
  const [picking, setPicking] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const lab = getIntakeConfig().labName;
  const overseas = billingAccounts(s).some(a => a.currency !== 'GBP');
  const name = toolName(s) ?? 'Xero';
  const tools: { id: Provider; label: string; note: string }[] = [
    { id: 'xero', label: 'Xero', note: 'Change notices + nightly catch-up' },
    { id: 'quickbooks', label: 'QuickBooks Online', note: 'Change notices' },
    { id: 'sage', label: 'Sage Accounting', note: 'Nightly check' },
    { id: 'freeagent', label: 'FreeAgent', note: 'Nightly check' },
  ];
  return (
    <Card title="Connections" sub="One accounting tool, or one bank if you have no accounting tool, so only one thing ever marks an invoice paid.">
      <div className="space-y-4 text-xs">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717182] mb-1.5">Accounting</p>
          {s.setup.provider ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#43A047]" /> <b>{name}</b> · {s.setup.org}</p>
              <p className="text-[#717182]">Invoices and credit notes go to {name} {st(s)}; your accountant reconciles payments there and the paid status comes back on its own.{s.setup.liveAt ? ` Invoicing since ${fmtDate(s.setup.liveAt)}.` : ''}</p>
              {overseas && s.setup.plan !== 'premium' && <Note tone="amber">You have an account in another currency. Multi-currency needs {name}'s premium plan. <button className="underline font-semibold" onClick={() => updateSetup({ plan: 'premium' })}>I've upgraded</button></Note>}
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => { disconnectProvider(); toast.success(`Disconnected from ${name}`); }}>Disconnect</button>
              </div>
              <div className="rounded-lg border border-dashed border-[#D4CEE1] p-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#5A5568] inline-flex items-center gap-1"><Zap className="w-3 h-3" /> Demo: something happens in {name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {([['edited', 'An invoice is edited'], ['voided', 'An invoice is voided'], ['failed', 'A post fails 3 times'], ['expired', 'The connection expires']] as const).map(([k, l]) => (
                    <button key={k} className={btn} onClick={() => { const r = simulateToolEvent(k); toast.success(r ? `${r}: see Needs you on Billing home` : 'Nothing to change'); }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Note tone="amber">No accounting tool. Invoices are still created, approved and emailed; mark them paid by hand, or connect a bank below. Most labs get Xero set up with their bank feed during onboarding.</Note>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {tools.map(t => <button key={t.id} className="text-left px-3 py-2 rounded-lg border border-[#E0E0E6] hover:border-[#4D8EF7] bg-white" onClick={() => setPicking(t.id)}><span className="font-semibold inline-flex items-center gap-1"><Plug className="w-3.5 h-3.5" /> {t.label}</span><span className="block text-[11px] text-[#717182]">{t.note}</span></button>)}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717182] mb-1.5">Bank</p>
          {s.setup.provider ? <p className="text-[#717182]">Off: {name} is the one source of truth for what's paid.</p> : s.bank ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2"><Landmark className="w-3.5 h-3.5 text-[#4D8EF7]" /> <b>{s.bank === 'revolut' ? 'Revolut Business' : 'Wise Business'}</b> · incoming payments matched to invoices</p>
              <p className="text-[#717182]">Matched by the invoice or statement number in the reference, then by a payer we know paying an exact amount. Anything else asks you once, and we remember the payer.</p>
              <div className="flex flex-wrap gap-1.5">
                <button className={btn} onClick={() => { const r = simulateBankPayment('reference'); toast.success(r ?? 'No open invoices'); }}>Demo: payment quoting an invoice</button>
                <button className={btn} onClick={() => { const r = simulateBankPayment('unknown'); toast.success(r ?? 'No open invoices'); }}>Demo: payment with no reference</button>
                <button className={btn} onClick={() => { connectBank(null); toast.success('Bank disconnected'); }}>Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => { connectBank('revolut'); toast.success('Revolut Business connected'); }}><Landmark className="w-3.5 h-3.5" /> Connect Revolut Business</button>
              <button className={btn} onClick={() => { connectBank('wise'); toast.success('Wise Business connected'); }}><Landmark className="w-3.5 h-3.5" /> Connect Wise Business</button>
              <p className="w-full text-[11px] text-[#717182]">Other UK banks need a paid open-banking provider; until then, Mark paid on the invoice or in bulk.</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717182] mb-1.5">Get paid</p>
          <p className="text-[#717182]">Pay now links on invoices and statements (Stripe, GoCardless, Revolut). Later: card fees mean each lab chooses.</p>
        </div>
      </div>
      {picking && (
        <Modal isOpen onClose={() => setPicking(null)} title={`Sign in to ${PROVIDER_NAME[picking]}`} footer={null}>
          <div className="space-y-3">
            <Note>Demo: no real sign-in. In the product this opens {PROVIDER_NAME[picking]}'s own sign-in window; Smile Genius never sees the password. Then one confirmation list: existing customers matched to practices and dentists, sales account and the VAT rate for exempt prostheses preselected.</Note>
            <p className="text-xs text-[#5A5568]">Pick the organisation to connect:</p>
            {[`${lab} Ltd`, `${lab} Holdings`].map(org => (
              <button key={org} disabled={busy} className="w-full text-left px-3 py-2.5 rounded-lg border border-[#E0E0E6] hover:border-[#4D8EF7] text-sm inline-flex items-center gap-2" onClick={() => {
                setBusy(true);
                window.setTimeout(() => { connectProvider(picking, org); setBusy(false); setPicking(null); toast.success(`Connected to ${org}`); }, 700);
              }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} {org}</button>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  );
}

const st = (s: ReturnType<typeof useBilling>) => (s.settings.postAs === 'draft' ? 'as drafts for your accountant' : 'as approved');
