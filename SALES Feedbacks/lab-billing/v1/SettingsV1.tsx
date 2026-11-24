import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgePercent, Check, ChevronDown, Landmark, Plug, TrendingUp } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import { getIntakeConfig } from '../../intake-form/intakeStore';
import type { LabBillingSettings, Provider } from '../types';
import { PROVIDER_NAME, toolName } from '../engine';
import { endOfMonth, pl, today } from '../format';
import { connectBank, connectProvider, disconnectProvider, savePromotion, saveTier, setInvoiceMode, updateMonday, updateSettings, useBilling } from '../billingStore';
import Catalog from '../screens/Catalog';
import Pricing from '../screens/Pricing';
import { btn, btnPrimary, Card, input, Note, Pill, Seg, Toggle } from '../ui';
import { Hint, practiceUrl } from './shared';

// ── V1 Settings: the basics (three questions), prices, and More options ──────
// Three questions are all a lab answers to start: where the books are, how
// most practices pay, and payment terms. Everything else has a sensible
// default and sits under More options, each with one plain sentence.

type Section = 'basics' | 'prices' | 'more';

export default function SettingsV1({ section }: { section?: string }) {
  const navigate = useNavigate();
  const sec: Section = section === 'prices' ? 'prices' : section === 'more' || section === 'promotions' ? 'more' : 'basics';
  const go = (x: Section) => navigate(`/growth/billing/settings${x === 'basics' ? '' : `/${x}`}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([['basics', 'The basics'], ['prices', 'Prices'], ['more', 'More options']] as [Section, string][]).map(([id, label]) => (
          <button key={id} onClick={() => go(id)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${sec === id ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] bg-white text-[#5A5568]'}`}>{label}</button>
        ))}
      </div>
      {sec === 'basics' && <Basics />}
      {sec === 'prices' && <Prices />}
      {sec === 'more' && <More openPromotions={section === 'promotions'} />}
    </div>
  );
}

function Q({ n, title, sub, done, children }: { n: number; title: string; sub: string; done: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-[#43A047] text-white' : 'bg-[#4D8EF7] text-white'}`}>{done ? <Check className="w-4 h-4" /> : n}</span>
      <div className="flex-1 min-w-0 pb-5 border-b border-[#F0EFF6] last:border-0">
        <p className="text-sm font-semibold text-[#030213]">{title}</p>
        <p className="text-xs text-[#717182] mt-0.5 mb-2.5">{sub}</p>
        {children}
      </div>
    </li>
  );
}

function Basics() {
  const s = useBilling();
  const { toast } = useToast();
  const [picking, setPicking] = useState<Provider | null>(null);
  const [all, setAll] = useState<null | 'per-case' | 'month-end'>(null);
  const tool = toolName(s);
  const practices = s.accounts.filter(a => a.kind === 'practice');
  const monthly = practices.filter(a => a.invoiceMode === 'month-end').length;
  const lab = getIntakeConfig().labName;
  const books: Provider | 'none' = s.setup.provider ?? 'none';
  const st = s.settings;
  const termsVal = st.terms === 'custom' ? 'custom' : st.terms;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2" title="Three questions, then Billing runs itself" sub="Change any answer whenever you like. Anything a single practice does differently is set on that practice's page.">
        <ol className="space-y-5">
          <Q n={1} done title="Where do you keep your books?" sub={tool ? `Invoices post to ${tool} and payments come back from it, so "paid" is always right.` : 'Without an accounting tool you can connect your business bank, or mark invoices paid by hand.'}>
            <div className="flex flex-wrap gap-2">
              {(['xero', 'quickbooks', 'sage', 'freeagent'] as Provider[]).map(p => (
                <button key={p} onClick={() => { if (books === p) return; setPicking(p); window.setTimeout(() => { connectProvider(p, `${lab} Ltd`); setPicking(null); toast.success(`Connected to ${PROVIDER_NAME[p]}: contacts matched by name`); }, 600); }}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold ${books === p ? 'border-[#43A047] bg-[#F1F8F1] text-[#2E7D32]' : 'border-[#E0E0E6] bg-white hover:border-[#4D8EF7]'}`}>
                  {books === p && <Check className="w-3 h-3 inline mr-1" />}{picking === p ? 'Connecting…' : PROVIDER_NAME[p]}
                </button>
              ))}
              <button onClick={() => { if (books !== 'none') { disconnectProvider(); toast.success('Disconnected'); } }} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${books === 'none' ? 'border-[#43A047] bg-[#F1F8F1] text-[#2E7D32]' : 'border-[#E0E0E6] bg-white hover:border-[#4D8EF7]'}`}>None of these</button>
            </div>
            {books === 'none' && (
              <div className="mt-3 rounded-xl bg-[#F8F9FC] px-3 py-2.5">
                <p className="text-xs font-semibold text-[#030213] flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> Match payments from your bank instead?</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Seg value={s.bank ?? 'none'} onChange={v => { connectBank(v === 'none' ? null : v); toast.success(v === 'none' ? 'You\'ll mark invoices paid by hand' : `${v === 'revolut' ? 'Revolut' : 'Wise'} Business connected`); }} options={[{ value: 'revolut', label: 'Revolut Business' }, { value: 'wise', label: 'Wise Business' }, { value: 'none', label: 'No, I\'ll mark them paid' }]} />
                </div>
                <p className="text-[11px] text-[#717182] mt-2">A payment that quotes the invoice number is matched on its own; anything unclear lands in Needs you once, then we remember the payer.</p>
              </div>
            )}
            {tool && <p className="text-[11px] text-[#717182] mt-2">Connected to {s.setup.org}{s.issues.some(x => x.kind === 'connection-expired') ? ' · needs signing in again (Home)' : ''}. <button className="underline" onClick={() => { disconnectProvider(); toast.success(`Disconnected from ${tool}`); }}>Disconnect</button></p>}
          </Q>
          <Q n={2} done title="How do most practices pay?" sub={`Now: ${pl(practices.length - monthly, 'practice')} per case, ${monthly} once a month. Your choice here sets every practice; change any one on its page.`}>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => setAll('per-case')}>An invoice per case (most labs)</button>
              <button className={btn} onClick={() => setAll('month-end')}>One invoice a month</button>
            </div>
            {all && (
              <Note tone="amber">
                Set all {pl(practices.length, 'practice')} to {all === 'month-end' ? 'one invoice a month' : 'an invoice per case'}? {pl(practices.filter(a => (a.invoiceMode ?? 'per-case') !== all).length, 'practice')} would change.{' '}
                <button className="font-semibold underline" onClick={() => { practices.forEach(a => (a.invoiceMode ?? 'per-case') !== all && setInvoiceMode(a.id, all)); toast.success(all === 'month-end' ? 'Every practice: one invoice a month' : 'Every practice: an invoice per case'); setAll(null); }}>Yes, change them all</button>{' · '}
                <button className="underline" onClick={() => setAll(null)}>Cancel</button>
              </Note>
            )}
          </Q>
          <Q n={3} done title="When should they pay?" sub="Your usual terms. A practice can have its own on its page.">
            <div className="flex flex-wrap items-center gap-2">
              <Seg value={termsVal} onChange={v => { updateSettings({ terms: v as LabBillingSettings['terms'] }); toast.success('Terms saved: new invoices use them'); }} options={[{ value: '30', label: '30 days' }, { value: 'eom-following', label: 'End of next month' }, { value: 'custom', label: 'Other' }]} />
              {termsVal === 'custom' && <><input className={`${input} w-20`} type="number" min="0" defaultValue={st.customTermsDays} onBlur={e => updateSettings({ customTermsDays: Number(e.target.value) || 30 })} /><span className="text-xs">days</span></>}
            </div>
          </Q>
        </ol>
      </Card>
      <div className="space-y-4">
        <Card title="Your lab on invoices">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2"><span>VAT registered</span><Seg value={st.vatRegistered ? 'yes' : 'no'} onChange={v => updateSettings({ vatRegistered: v === 'yes' })} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} /></div>
            {st.vatRegistered && <input className={input} defaultValue={st.vatNumber} onBlur={e => updateSettings({ vatNumber: e.target.value })} placeholder="VAT number" />}
            <p className="text-[#717182]">Name, address and logo come from your lab details (DSO Info). Invoice numbers carry on from {tool ?? 'your last invoice'}; credit notes have their own CN-0001 series.</p>
          </div>
        </Card>
        <Card title="Where things live">
          <ul className="space-y-1.5 text-xs text-[#5A5568]">
            <li><b>A practice's own prices, terms, billing email, monthly billing</b> → Practices › the practice</li>
            <li><b>Who pays for a dentist</b> → the practice › Dentists</li>
            <li><b>Your standard prices</b> → Settings › Prices</li>
            <li><b>Promotions, limits, approvals</b> → Settings › More options</li>
          </ul>
          <p className="text-[11px] text-[#717182] mt-2">Or press ⌘K anywhere and type what you want to do.</p>
        </Card>
      </div>
    </div>
  );
}

function Prices() {
  const s = useBilling();
  const navigate = useNavigate();
  const own = s.accounts.filter(a => a.priceListId);
  return (
    <div className="space-y-4">
      <Card title="Practices with their own prices" sub="Account-based pricing. Set or change it on the practice's page › Prices.">
        {own.length ? (
          <div className="flex flex-wrap gap-2">{own.map(a => <button key={a.id} onClick={() => navigate(`${practiceUrl(a.id)}?tab=prices`)} className="px-3 py-1.5 rounded-full border border-[#E0E0E6] text-xs hover:border-[#4D8EF7]">{a.name} <span className="text-[#717182]">· {Object.keys(s.priceLists.find(p => p.id === a.priceListId)?.prices ?? {}).length} items</span></button>)}</div>
        ) : <p className="text-xs text-[#A0A0B0]">None yet: every practice pays your standard prices.</p>}
        <div className="mt-3"><Hint>To give a practice its own prices: Practices › pick the practice › Prices › a % off everything, copy another practice, or type prices on a few items.</Hint></div>
      </Card>
      <div>
        <p className="text-sm font-semibold text-[#030213] mb-1">Your standard prices</p>
        <p className="text-xs text-[#717182] mb-3">What every practice pays unless it has its own. Price changes can start on a date; cases already received keep their price.</p>
        <Catalog />
      </div>
    </div>
  );
}

function Opt({ title, sub, children }: { title: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3.5 border-b border-[#F0EFF6] last:border-0">
      <div className="flex-1 min-w-[240px]"><p className="text-sm font-semibold text-[#030213]">{title}</p><p className="text-xs text-[#717182] mt-0.5">{sub}</p></div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function More({ openPromotions }: { openPromotions: boolean }) {
  const s = useBilling();
  const { toast } = useToast();
  const st = s.settings;
  const tool = toolName(s);
  const set = (patch: Partial<LabBillingSettings>, msg = 'Saved') => { updateSettings(patch); toast.success(msg); };
  const [promoOpen, setPromoOpen] = useState(openPromotions || st.promotionsOn);
  useEffect(() => { if (openPromotions) window.setTimeout(() => document.getElementById('sf-promotions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); }, [openPromotions]);
  const t = today();
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <Card title="How invoices go out">
          <Opt title="Check invoices before they're sent" sub="Flagged invoices (an odd price, a possible remake…) always wait for you, whatever you pick.">
            <Seg value={st.approval} onChange={v => set({ approval: v })} options={[{ value: 'review-30', label: 'First 30 days' }, { value: 'review-all', label: 'Always' }, { value: 'auto', label: 'Never' }]} />
          </Opt>
          {tool && <Opt title={`Let your accountant check them in ${tool} first`} sub={`Invoices still email the practice, but land in ${tool} as drafts for your accountant to approve.`}>
            <Toggle on={st.postAs === 'draft'} onChange={v => set({ postAs: v ? 'draft' : 'approved' }, v ? `Invoices land in ${tool} as drafts` : `Invoices land in ${tool} approved`)} />
          </Opt>}
          <Opt title="Invoice layout" sub="Detailed: one line per product. Simple: one line per case.">
            <Seg value={st.layout} onChange={v => set({ layout: v })} options={[{ value: 'detailed', label: 'Detailed' }, { value: 'simple', label: 'Simple' }]} />
          </Opt>
          <Opt title="Invoice when the case…" sub="Most labs invoice when the case ships.">
            <Seg value={st.invoiceOn} onChange={v => set({ invoiceOn: v })} options={[{ value: 'dispatched', label: 'Ships' }, { value: 'completed', label: 'Is completed' }]} />
          </Opt>
          <Opt title="Remakes under warranty" sub="When you mark a remake as no charge.">
            <Seg value={st.warrantyRemakes} onChange={v => set({ warrantyRemakes: v })} options={[{ value: 'none', label: 'No invoice' }, { value: 'zero', label: 'A £0 invoice' }]} />
          </Opt>
          <Opt title="Statement of manufacture" sub="Attach one to each invoice.">
            <Seg value={st.som} onChange={v => set({ som: v })} options={[{ value: 'off', label: 'Off' }, { value: 'all', label: 'Every practice' }, { value: 'per-account', label: 'Chosen practices' }]} />
          </Opt>
          <Opt title="Statement day" sub="When monthly statements are due to go.">
            <Seg value={st.statementDay} onChange={v => set({ statementDay: v })} options={[{ value: 'last-working', label: 'Last working day' }, { value: 'first', label: '1st of the month' }]} />
          </Opt>
        </Card>

        <div id="sf-promotions" />
        <Card title={<span className="inline-flex items-center gap-2"><BadgePercent className="w-4 h-4 text-[#7C3AED]" /> Promotions and volume discounts {st.promotionsOn ? <Pill tone="green">On</Pill> : <Pill tone="gray">Off</Pill>}</span>}
          sub="A % or fixed price for a while, or a discount for practices that send a lot. Off until you need it."
          actions={<Toggle on={st.promotionsOn} onChange={v => { set({ promotionsOn: v }, v ? 'Promotions and volume discounts on' : 'Off: invoices use standard and practice prices only'); setPromoOpen(v); }} />}>
          {st.promotionsOn ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-[#717182] self-center">Quick start:</span>
                <button className={btn} onClick={() => { savePromotion({ id: `pr-${Date.now().toString(36)}`, name: '10% off this month', from: t, to: endOfMonth(t), scope: { kind: 'all', ids: [] }, type: 'percent', value: 10, active: true }); toast.success('10% off everything until the end of the month: edit it below'); }}><BadgePercent className="w-3.5 h-3.5" /> 10% off this month</button>
                <button className={btn} onClick={() => { saveTier({ id: `tier-${Date.now().toString(36)}`, name: 'Busy practices', minUnits: 50, percentOff: 5, active: true }); toast.success('5% off for practices that sent 50+ units last month: edit it below'); }}><TrendingUp className="w-3.5 h-3.5" /> 5% off over 50 units a month</button>
              </div>
              <Note>Which price wins (no stacking): a price typed on the invoice → the practice's own prices → a promotion → a volume discount → your standard price.</Note>
              <button className="text-xs font-semibold text-[#4D8EF7] inline-flex items-center gap-1" onClick={() => setPromoOpen(o => !o)}>{promoOpen ? 'Hide' : 'Show'} promotions and discounts <ChevronDown className={`w-3.5 h-3.5 ${promoOpen ? 'rotate-180' : ''}`} /></button>
              {promoOpen && <Pricing />}
            </div>
          ) : <p className="text-xs text-[#717182]">For a practice that always pays less, give it its own prices instead (its page › Prices).</p>}
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Credit limits" actions={<Toggle on={st.limitsOn} onChange={v => set({ limitsOn: v }, v ? 'Limits on: set one on a practice\'s page › Setup › More' : 'Limits off: nothing goes on hold')} />}>
          <p className="text-xs text-[#717182]">{st.limitsOn ? `New cases from a practice over its limit wait On hold until it pays. ${pl(s.accounts.filter(a => a.limit?.amount).length, 'practice')} have a limit.` : 'Off: no practice is ever put on hold.'}</p>
        </Card>
        <Card title="Monday email" actions={<Toggle on={s.monday.enabled} onChange={v => { updateMonday({ ...s.monday, enabled: v }); toast.success(v ? 'Monday email on' : 'Monday email off'); }} />}>
          <p className="text-xs text-[#717182]">Every Monday at {s.monday.time}: money owed and coming in, and who's sending less. To {s.monday.to}.</p>
        </Card>
        <Card title={<span className="inline-flex items-center gap-1.5"><Plug className="w-4 h-4" /> Connections</span>}>
          <p className="text-xs text-[#717182]">{tool ? `${tool} · ${s.setup.org}` : s.bank ? `${s.bank === 'revolut' ? 'Revolut' : 'Wise'} Business (no accounting tool)` : 'None: invoices are marked paid by hand.'} Change it in The basics.</p>
          <p className="text-[11px] text-[#A0A0B0] mt-2">Pay-now links on invoices: later.</p>
        </Card>
        <Card title="Spotting problems">
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between gap-2">Flag a price this far from usual <span className="inline-flex items-center gap-1"><input className="w-14 px-2 py-1 rounded-md border border-[#E0E0E6]" type="number" defaultValue={st.unusualPricePct} onBlur={e => updateSettings({ unusualPricePct: Number(e.target.value) || 20 })} />%</span></label>
            <label className="flex items-center justify-between gap-2">Possible remake within <span className="inline-flex items-center gap-1"><input className="w-14 px-2 py-1 rounded-md border border-[#E0E0E6]" type="number" defaultValue={st.remakeDays} onBlur={e => updateSettings({ remakeDays: Number(e.target.value) || 30 })} />days</span></label>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { btnPrimary };
