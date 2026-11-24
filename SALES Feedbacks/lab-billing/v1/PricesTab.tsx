import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Percent, RotateCcw } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import type { BillingAccount } from '../types';
import { pricesOn } from '../engine';
import { money, today } from '../format';
import { savePriceList, setAccountDiscount, setAccountPrice, updateAccount, usePriceList, useBilling } from '../billingStore';
import { btn, btnPrimary, Card, inputSm, Note, Pill, td, th } from '../ui';
import { Hint } from './shared';

// ── V1 account-based pricing, on the practice's own page ─────────────────────
// Two states: "your standard prices" or "their own prices". Their own prices
// start from three quick ways (a % off everything, copy another practice, or
// type a price on any item) and are edited in one table: leave a box empty to
// use the standard price. Applies to invoices not sent yet; sent ones never change.

export default function PricesTab({ a }: { a: BillingAccount }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const pl = a.priceListId ? s.priceLists.find(p => p.id === a.priceListId) : undefined;
  const [pct, setPct] = useState('10');
  const [from, setFrom] = useState('');
  const [q, setQ] = useState('');
  const others = s.accounts.filter(x => x.id !== a.id && x.priceListId && s.priceLists.some(p => p.id === x.priceListId));
  const sharedWith = pl ? s.accounts.filter(x => x.id !== a.id && x.priceListId === pl.id) : [];
  const items = s.catalog.filter(i => !i.archived && !i.passThrough && (!q || `${i.name} ${i.code} ${i.department}`.toLowerCase().includes(q.toLowerCase())));
  const t = today();
  const custom = pl ? Object.keys(pl.prices).length : 0;
  const set = (itemId: string, which: 'nhs' | 'priv', v: string) => {
    const cur = pl?.prices[itemId] ?? {};
    const next = { ...cur, [which]: v === '' ? undefined : Number(v) };
    setAccountPrice(a.id, itemId, next.nhs == null && next.priv == null ? null : next);
  };
  const copyFrom = (accId: string) => {
    const src = s.priceLists.find(p => p.id === s.accounts.find(x => x.id === accId)?.priceListId);
    if (!src) return;
    const id = `pl-${Date.now().toString(36)}`;
    savePriceList({ id, name: `${a.name} prices`, prices: structuredClone(src.prices) });
    updateAccount(a.id, { priceListId: id });
    toast.success(`Copied ${Object.keys(src.prices).length} prices; change any of them below`);
  };

  return (
    <div className="space-y-4">
      <Card title={`What ${a.name} pays`} sub={pl ? `Their own prices on ${custom} item${custom === 1 ? '' : 's'}; everything else at your standard price.` : 'Your standard prices (Settings › Prices). Give them their own when you\'ve agreed something different.'}
        actions={pl ? <button className={btn} onClick={() => { usePriceList(a.id, null); toast.success('Back on your standard prices'); }}><RotateCcw className="w-3.5 h-3.5" /> Use standard prices</button> : <button className={btn} onClick={() => navigate('/growth/billing/settings/prices')}>See standard prices</button>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#E0E0E6] p-3">
            <p className="text-xs font-semibold text-[#030213] flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-[#4D8EF7]" /> A discount on everything</p>
            <p className="text-[11px] text-[#717182] mt-0.5">Every item at your standard price minus this, rounded to 50p.</p>
            <div className="flex items-center gap-1.5 mt-2"><input className={`${inputSm} w-16`} type="number" min="0" max="90" value={pct} onChange={e => setPct(e.target.value)} /><span className="text-xs">% off</span><button className={btnPrimary} disabled={!(Number(pct) > 0)} onClick={() => { setAccountDiscount(a.id, Number(pct)); toast.success(`${pct}% off everything for ${a.name}`); }}>Apply</button></div>
          </div>
          <div className="rounded-xl border border-[#E0E0E6] p-3">
            <p className="text-xs font-semibold text-[#030213] flex items-center gap-1.5"><Copy className="w-3.5 h-3.5 text-[#4D8EF7]" /> Same as another practice</p>
            <p className="text-[11px] text-[#717182] mt-0.5">Copy their prices, then change any you like.</p>
            <div className="flex items-center gap-1.5 mt-2">
              <select className={`${inputSm} flex-1`} value={from} onChange={e => setFrom(e.target.value)}><option value="">{others.length ? 'Pick a practice…' : 'No other practice has its own prices'}</option>{others.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <button className={btn} disabled={!from} onClick={() => copyFrom(from)}>Copy</button>
            </div>
          </div>
          <div className="rounded-xl border border-[#E0E0E6] p-3">
            <p className="text-xs font-semibold text-[#030213]">Just a few items</p>
            <p className="text-[11px] text-[#717182] mt-0.5">Type their price next to any item below. Empty means your standard price.</p>
          </div>
        </div>
        {sharedWith.length > 0 && <Note tone="amber">This price list is shared with {sharedWith.map(x => x.name).join(', ')}: changes apply to them too.</Note>}
      </Card>

      <Card pad={false} title="Prices" actions={<input className={`${inputSm} w-48`} value={q} onChange={e => setQ(e.target.value)} placeholder="Find an item…" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr><th className={th}>Item</th><th className={`${th} text-right`}>Your price</th><th className={th}>Their price (NHS)</th><th className={th}>Their price (private)</th><th className={th} /></tr></thead>
            <tbody>
              {items.map(i => {
                const std = pricesOn(i, t);
                const mine = pl?.prices[i.id];
                const diff = mine?.priv != null && std.priv ? Math.round((mine.priv - std.priv) / std.priv * 100) : mine?.nhs != null && std.nhs ? Math.round((mine.nhs - std.nhs) / std.nhs * 100) : null;
                return (
                  <tr key={i.id} className={mine ? 'bg-[#FAFBFF]' : ''}>
                    <td className={td}>{i.name}<span className="block text-[10px] text-[#717182]">{i.department} · {i.unit}</span></td>
                    <td className={`${td} text-right whitespace-nowrap text-[#717182]`}>{std.nhs != null && <span className="block">NHS {money(std.nhs)}</span>}{std.priv != null && <span className="block">Private {money(std.priv)}</span>}</td>
                    <td className={td}>{std.nhs != null ? <input key={`${i.id}-n-${mine?.nhs}`} className={`${inputSm} w-24`} type="number" min="0" step="0.5" defaultValue={mine?.nhs ?? ''} placeholder={money(std.nhs)} onBlur={e => { if (e.target.value !== String(mine?.nhs ?? '')) set(i.id, 'nhs', e.target.value); }} /> : <span className="text-[#A0A0B0]">—</span>}</td>
                    <td className={td}>{std.priv != null ? <input key={`${i.id}-p-${mine?.priv}`} className={`${inputSm} w-24`} type="number" min="0" step="0.5" defaultValue={mine?.priv ?? ''} placeholder={money(std.priv)} onBlur={e => { if (e.target.value !== String(mine?.priv ?? '')) set(i.id, 'priv', e.target.value); }} /> : <span className="text-[#A0A0B0]">—</span>}</td>
                    <td className={td}>{diff != null && diff !== 0 && <Pill tone={diff < 0 ? 'amber' : 'green'}>{diff > 0 ? '+' : ''}{diff}%</Pill>}{mine && <button className="ml-2 text-[11px] text-[#717182] hover:text-[#C62828]" onClick={() => setAccountPrice(a.id, i.id, null)}>Reset</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Hint>Their prices apply to invoices not sent yet (waiting ones update now). Sent invoices never change. A price typed on one invoice still wins for that invoice; promotions don't stack on top of a practice's own price.</Hint>
    </div>
  );
}
