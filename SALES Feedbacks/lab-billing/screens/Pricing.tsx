import { useState } from 'react';
import { BadgePercent, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import type { BillingState, Promotion, VolumeTier } from '../types';
import { unitsLastMonth } from '../engine';
import { addDays, endOfMonth, fmtDate, pl, startOfMonth, today } from '../format';
import { deletePromotion, deleteTier, savePromotion, saveTier, useBilling } from '../billingStore';
import { billingAccounts } from '../insights';
import { btn, btnPrimary, Card, Empty, Field, input, Note, Pill, Seg, td, th, Toggle } from '../ui';

// ── 6. Promotions and volume tiers (optional pricing) ────────────────────────
// Both are off until the admin creates one. Precedence, most specific first:
// typed price → custom price list → promotion → volume tier → catalog.

function scopeText(s: BillingState, p: Promotion) {
  if (p.scope.kind === 'all') return 'Everything';
  const names = p.scope.ids.map(id => p.scope.kind === 'items' ? s.catalog.find(i => i.id === id)?.name : p.scope.kind === 'accounts' ? s.accounts.find(a => a.id === id)?.name : id).filter(Boolean);
  return `${p.scope.kind === 'items' ? 'Items' : p.scope.kind === 'departments' ? 'Departments' : 'Accounts'}: ${names.join(', ')}`;
}

function qualifiers(s: BillingState, p: Promotion) {
  const accs = billingAccounts(s).filter(a => p.scope.kind !== 'accounts' || p.scope.ids.includes(a.id));
  const cases = Object.values(s.cases).filter(m => accs.some(a => a.id === m.accountId) && m.receivedAt >= p.from && m.receivedAt <= p.to).length;
  return { accounts: accs.length, cases };
}

export default function Pricing() {
  const s = useBilling();
  const { toast } = useToast();
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [tier, setTier] = useState<VolumeTier | null>(null);
  const t = today();
  return (
    <div className="space-y-4">
      <Note>Which price wins, most specific first, no stacking: a price typed on the invoice line → the account's custom price list → an active promotion → the account's volume tier → the catalog price.</Note>
      <Card title={<span className="inline-flex items-center gap-1.5"><BadgePercent className="w-4 h-4 text-[#7C3AED]" /> Promotions</span>} sub="A date range, a scope, and a fixed price or a percentage off. Applies by the case's received date." actions={<button className={btnPrimary} onClick={() => setPromo({ id: `pr-${Date.now().toString(36)}`, name: '', from: t, to: endOfMonth(t), scope: { kind: 'items', ids: [] }, type: 'percent', value: 10, active: true })}><Plus className="w-3.5 h-3.5" /> New promotion</button>} pad={false}>
        {s.promotions.length === 0 ? <Empty>No promotions.</Empty> : (
          <table className="w-full">
            <thead><tr><th className={th}>Promotion</th><th className={th}>Dates</th><th className={th}>Scope</th><th className={th}>Offer</th><th className={th}>Who qualifies</th><th className={th} /></tr></thead>
            <tbody>{s.promotions.map(p => { const q = qualifiers(s, p); const live = p.active && t >= p.from && t <= p.to; return (
              <tr key={p.id}>
                <td className={td}><span className="font-semibold">{p.name}</span> {live ? <Pill tone="green">Running</Pill> : p.active ? <Pill tone="gray">{t < p.from ? 'Scheduled' : 'Ended'}</Pill> : <Pill tone="gray">Off</Pill>}</td>
                <td className={td}>{fmtDate(p.from)} – {fmtDate(p.to)}</td>
                <td className={td}>{scopeText(s, p)}</td>
                <td className={td}>{p.type === 'percent' ? `${p.value}% off` : `Fixed £${p.value}`}</td>
                <td className={td}>{pl(q.accounts, 'account')} · {pl(q.cases, 'case')} received in the dates</td>
                <td className={`${td} text-right whitespace-nowrap`}><Toggle on={p.active} onChange={v => savePromotion({ ...p, active: v })} /> <button className={`${btn} ml-1`} onClick={() => setPromo(p)}><Pencil className="w-3 h-3" /></button> <button className={btn} onClick={() => { deletePromotion(p.id); toast.success('Promotion removed'); }}><Trash2 className="w-3 h-3" /></button></td>
              </tr>
            ); })}</tbody>
          </table>
        )}
      </Card>

      <Card title={<span className="inline-flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[#4D8EF7]" /> Volume tiers</span>} sub="Thresholds per account: units invoiced last month earn a discount this month." actions={<button className={btnPrimary} onClick={() => setTier({ id: `tier-${Date.now().toString(36)}`, name: '', minUnits: 50, percentOff: 5, active: true })}><Plus className="w-3.5 h-3.5" /> New tier</button>} pad={false}>
        {s.tiers.length === 0 ? <Empty>No tiers.</Empty> : (
          <table className="w-full">
            <thead><tr><th className={th}>Tier</th><th className={th}>Threshold</th><th className={th}>Discount</th><th className={th}>Qualifies this month</th><th className={th} /></tr></thead>
            <tbody>{s.tiers.map(x => { const q = billingAccounts(s).map(a => ({ a, u: unitsLastMonth(s, a.id, t) })).filter(r => r.u >= x.minUnits); return (
              <tr key={x.id}>
                <td className={td}><span className="font-semibold">{x.name}</span> {!x.active && <Pill>Off</Pill>}</td>
                <td className={td}>{x.minUnits}+ units last month</td>
                <td className={td}>{x.percentOff}% off</td>
                <td className={td}>{q.length ? q.map(r => `${r.a.name} (${r.u})`).join(', ') : <span className="text-[#717182]">No account yet</span>}</td>
                <td className={`${td} text-right whitespace-nowrap`}><Toggle on={x.active} onChange={v => saveTier({ ...x, active: v })} /> <button className={`${btn} ml-1`} onClick={() => setTier(x)}><Pencil className="w-3 h-3" /></button> <button className={btn} onClick={() => deleteTier(x.id)}><Trash2 className="w-3 h-3" /></button></td>
              </tr>
            ); })}</tbody>
          </table>
        )}
        <div className="px-4 py-3 border-t border-[#F0EFF6]">
          <p className="text-[11px] text-[#717182] mb-1.5">Units last month, by account</p>
          <div className="flex flex-wrap gap-1.5">{billingAccounts(s).map(a => <Pill key={a.id} tone="gray">{a.name}: {unitsLastMonth(s, a.id, t)}</Pill>)}</div>
        </div>
      </Card>

      {promo && <PromoModal p={promo} onClose={() => setPromo(null)} />}
      {tier && <TierModal x={tier} onClose={() => setTier(null)} />}
    </div>
  );
}

function PromoModal({ p, onClose }: { p: Promotion; onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [d, setD] = useState(p);
  const options = d.scope.kind === 'items' ? s.catalog.map(i => ({ id: i.id, name: i.name })) : d.scope.kind === 'departments' ? s.departments.map(x => ({ id: x.name, name: x.name })) : d.scope.kind === 'accounts' ? billingAccounts(s).map(a => ({ id: a.id, name: a.name })) : [];
  const q = qualifiers(s, d);
  return (
    <Modal isOpen onClose={onClose} title={p.name ? `Edit ${p.name}` : 'New promotion'} footer={<div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!d.name.trim() || (d.scope.kind !== 'all' && !d.scope.ids.length)} onClick={() => { savePromotion(d); toast.success('Promotion saved; waiting invoices repriced'); onClose(); }}>Save</button></div>}>
      <div className="space-y-3">
        <Field label="Name"><input className={input} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="e.g. Spring whitening" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="From"><input className={input} type="date" value={d.from} onChange={e => setD({ ...d, from: e.target.value })} /></Field>
          <Field label="To"><input className={input} type="date" value={d.to} onChange={e => setD({ ...d, to: e.target.value })} /></Field>
        </div>
        <Field label="Applies to"><Seg value={d.scope.kind} onChange={v => setD({ ...d, scope: { kind: v, ids: [] } })} options={[{ value: 'items', label: 'Items' }, { value: 'departments', label: 'Departments' }, { value: 'accounts', label: 'Accounts' }, { value: 'all', label: 'Everything' }]} /></Field>
        {options.length > 0 && <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1">{options.map(o => <label key={o.id} className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={d.scope.ids.includes(o.id)} onChange={() => setD({ ...d, scope: { ...d.scope, ids: d.scope.ids.includes(o.id) ? d.scope.ids.filter(x => x !== o.id) : [...d.scope.ids, o.id] } })} /> {o.name}</label>)}</div>}
        <div className="flex items-end gap-2">
          <Field label="Offer"><Seg value={d.type} onChange={v => setD({ ...d, type: v })} options={[{ value: 'percent', label: '% off' }, { value: 'fixed', label: 'Fixed price' }]} /></Field>
          <input className={`${input} w-28`} type="number" value={d.value} onChange={e => setD({ ...d, value: Number(e.target.value) })} />
        </div>
        <Note>Who qualifies: {pl(q.accounts, 'account')}, {pl(q.cases, 'case')} received between {fmtDate(d.from)} and {fmtDate(d.to)}. Accounts with their own price list keep it.</Note>
      </div>
    </Modal>
  );
}

function TierModal({ x, onClose }: { x: VolumeTier; onClose: () => void }) {
  const s = useBilling();
  const [d, setD] = useState(x);
  const q = billingAccounts(s).filter(a => unitsLastMonth(s, a.id, today()) >= d.minUnits);
  return (
    <Modal isOpen onClose={onClose} title={x.name ? `Edit ${x.name}` : 'New volume tier'} footer={<div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!d.name.trim()} onClick={() => { saveTier(d); onClose(); }}>Save</button></div>}>
      <div className="space-y-3">
        <Field label="Name"><input className={input} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="e.g. Tier 2" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Units last month, at least"><input className={input} type="number" value={d.minUnits} onChange={e => setD({ ...d, minUnits: Number(e.target.value) })} /></Field>
          <Field label="Discount %"><input className={input} type="number" value={d.percentOff} onChange={e => setD({ ...d, percentOff: Number(e.target.value) })} /></Field>
        </div>
        <Note>Qualifies this month: {q.length ? q.map(a => a.name).join(', ') : 'no account yet'}.</Note>
        <p className="text-[11px] text-[#A0A0B0]">Recalculated on the 1st from the previous month's invoiced units ({fmtDate(startOfMonth(addDays(startOfMonth(today()), -1)))} onwards).</p>
      </div>
    </Modal>
  );
}
