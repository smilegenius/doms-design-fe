import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, HelpCircle, PauseCircle, Plus, Receipt, Trash2 } from 'lucide-react';
import Modal from '../../src/app/components/Modal';
import { useToast } from '../../src/app/context/ToastContext';
import OrderPanelTab from '../intake-form/OrderPanelTab';
import { account, caseById, DISPATCHED, itemFor, lineNet, sourceShort, sourceText, stagedMode, stagesDone, totals } from './engine';
import { fmtDate, money } from './format';
import { addPart, billNow, billStage, decideRemake, notRemake, previewLines, releaseCase, setCaseKind, stopCase, syncBilling, useBilling } from './billingStore';
import { btn, btnPrimary, InvoiceStatusPill, inputSm, Note, Pill } from './ui';

// ── 2. Case billing panel: a "Billing" tab in the case's order form panel ─────
// Lines with where each price came from, NHS / private, stages billed so far,
// components (pass-through parts), invoice status and the on-hold banner.

/** Set before a deep link clicks through the Cases list (?sf=billing is lost on the way). */
export const pendingBillingTab = { value: false };

export default function CaseBillingTab({ caseId }: { caseId: string }) {
  const [open] = useState(() => { const v = new URLSearchParams(window.location.search).get('sf') === 'billing' || pendingBillingTab.value; pendingBillingTab.value = false; return v; });
  useEffect(() => { syncBilling(); }, [caseId]);
  // Multi-service cases open on "Case Summary", which has no order form panel:
  // for the deep link, step into the first service so the Billing tab shows.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if ([...document.querySelectorAll('main button')].some(b => b.textContent?.trim() === 'Lab Documents')) return;
      const summary = [...document.querySelectorAll<HTMLElement>('main button')].find(b => b.textContent?.trim() === 'Case Summary');
      (summary?.nextElementSibling as HTMLElement | null)?.click();
    }, 700);
    return () => window.clearTimeout(t);
  }, [open, caseId]);
  const s = useBilling();
  const meta = s.cases[caseId];
  const c = caseById(caseId);
  if (!c || !meta) return null;
  const held = meta.held;
  return (
    <OrderPanelTab tabKey="billing" label="Billing" icon={held ? <PauseCircle className="w-3.5 h-3.5 text-[#C62828]" /> : <Receipt className="w-3.5 h-3.5" />} openOnLoad={open}>
      <Body caseId={caseId} />
    </OrderPanelTab>
  );
}

function Body({ caseId }: { caseId: string }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [why, setWhy] = useState<string | null>(null);
  const [part, setPart] = useState<{ manufacturer: string; partNo: string; cost: string } | null>(null);
  const [stopping, setStopping] = useState(false);
  const meta = s.cases[caseId];
  const c = caseById(caseId)!;
  const acc = account(s, meta.accountId);
  const invs = s.invoices.filter(i => i.caseId === caseId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const main = invs.find(i => !i.stage && i.status !== 'void');
  const preview = previewLines(caseId);
  const lines = main ? main.lines : preview.lines;
  const cur = acc?.currency ?? 'GBP';
  const kinds = [...new Set(c.serviceItems.map(si => meta.kindOverride ?? (si.orderType === 'NHS' ? 'NHS' : 'Private')))];
  const dispatched = DISPATCHED.includes(c.status);
  const staged = c.serviceItems.flatMap(si => { const it = itemFor(s, si, meta); return it?.stages?.length && acc && stagedMode(acc, it) === 'each' ? [{ si, it }] : []; });
  const components = s.catalog.filter(i => i.passThrough);
  const editable = !main || main.status === 'draft' || main.status === 'flagged';

  return (
    <div className="space-y-3 text-xs">
      {meta.held && (
        <Note tone="red">
          <b>On hold:</b> {acc?.name} is at its account limit, so this new case is waiting before production.{' '}
          <button className="underline font-semibold" onClick={() => { releaseCase(caseId); toast.success(`${caseId} released into production; the account stays on hold`); }}>Release this case</button>
        </Note>
      )}
      {meta.billedElsewhere && <Note>Billed by the old system before the switch-over. The balance, if any, is in Xero.</Note>}
      {meta.remakeOf && !meta.remakeDecision && (
        <Note tone="amber">
          Same patient and {c.services[0]} as <b>{meta.remakeOf}</b> within {s.settings.remakeDays} days. Is this a remake?
          <span className="flex flex-wrap gap-2 mt-1.5"><button className={btn} onClick={() => decideRemake(caseId, 'no-charge')}>Remake: no charge</button><button className={btn} onClick={() => decideRemake(caseId, 'charge')}>Remake, but charge</button><button className={btn} onClick={() => notRemake(caseId)}>Not a remake</button></span>
        </Note>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[#717182]">Bills to <button className="font-semibold text-[#030213] hover:underline" onClick={() => navigate(`/growth/billing/accounts/${meta.accountId}`)}>{acc?.name}</button>{acc?.kind === 'dentist' ? ' (pays directly)' : ''} · {acc?.priceListId ? s.priceLists.find(p => p.id === acc.priceListId)?.name : 'lab standard prices'} · received {fmtDate(meta.receivedAt)}</p>
        {editable && !meta.billedElsewhere && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#717182]">Case is</span>
            {(['NHS', 'Private'] as const).map(k => <button key={k} onClick={() => { setCaseKind(caseId, k); toast.success(`Marked ${k}; lines repriced`); }} className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${kinds.length === 1 && kinds[0] === k ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] text-[#5A5568]'}`}>{k}</button>)}
          </span>
        )}
      </div>
      {meta.kindUnclear && !meta.kindOverride && <Note tone="amber">The order doesn't say NHS or private. Pick one before it's invoiced.</Note>}

      {!meta.billedElsewhere && (
        <div className="rounded-lg border border-[#E0E0E6] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
            <span className="font-semibold text-[#030213]">{main ? (main.number ?? 'Draft invoice') : dispatched ? 'Not invoiced yet' : 'Expected when dispatched'}</span>
            {main ? <span className="inline-flex items-center gap-2"><InvoiceStatusPill status={main.status} /><button className="text-[#4D8EF7] font-semibold hover:underline" onClick={() => navigate(`/growth/billing/invoices/${main.id}`)}>Open invoice</button></span>
              : lines.length > 0 && <button className={dispatched ? btnPrimary : btn} onClick={() => { const inv = billNow(caseId); if (inv) toast.success(inv.status === 'sent' ? `Invoiced ${inv.number}` : 'Invoice created; it\'s waiting for approval'); }}>Bill now</button>}
          </div>
          {lines.length === 0 ? <p className="px-3 py-3 text-[#717182]">{staged.length ? 'Everything on this case bills per stage (below).' : 'No billable lines.'}</p> : (
            <table className="w-full">
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} className="border-b border-[#F0EFF6] last:border-0">
                    <td className="px-3 py-1.5">{l.description}<span className="text-[#717182]"> · {l.qty} × {money(l.unitPrice, cur)} · {l.kind}</span>{l.part && <span className="block text-[10px] text-[#717182]">{l.part.manufacturer} · part {l.part.partNo}</span>}{why === l.id && <span className="block mt-1 text-[11px] text-[#1565C0] bg-[#F5F9FF] rounded px-2 py-1">{sourceText(l.source, cur)}</span>}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap"><button onClick={() => setWhy(why === l.id ? null : l.id)} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${l.source.kind === 'unmapped' ? 'text-[#B45309]' : 'text-[#4D8EF7]'} hover:underline`}>{l.source.kind === 'unmapped' ? <AlertTriangle className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />} {sourceShort(l.source)}</button></td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(lineNet(l), cur)}</td>
                  </tr>
                ))}
                <tr><td className="px-3 py-1.5 font-semibold" colSpan={2}>Total</td><td className="px-3 py-1.5 text-right font-semibold">{money(totals({ lines }).gross, cur)}</td></tr>
              </tbody>
            </table>
          )}
          {!main && preview.flags.filter(f => f.kind !== 'remake').length > 0 && <div className="px-3 py-2 border-t border-[#F0EFF6] text-[#B45309]">{preview.flags.filter(f => f.kind !== 'remake').map((f, i) => <p key={i} className="flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5" />{f.message}</p>)}</div>}
        </div>
      )}

      {staged.length > 0 && (
        <div className="rounded-lg border border-[#E0E0E6] p-3 space-y-2">
          <div className="flex items-center justify-between"><p className="font-semibold text-[#030213]">Stages billed so far</p>{!meta.stoppedAt && <button className="text-[11px] text-[#717182] hover:text-[#C62828]" onClick={() => setStopping(true)}>Case stopped partway?</button>}</div>
          {staged.map(({ si, it }) => {
            const done = stagesDone(si);
            return (
              <div key={si.id}>
                <p className="text-[#717182] mb-1">{it.name} · billed each stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {it.stages!.map(st => {
                    const billed = meta.stagesBilled?.includes(`${it.id}:${st.name}`);
                    const inv = invs.find(i => i.stage === st.name && i.status !== 'void');
                    const isDone = done.includes(st.name);
                    return (
                      <span key={st.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${billed ? 'border-[#C8E6C9] bg-[#F1F8F2]' : isDone ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#E0E0E6]'}`}>
                        {st.name} · {money(st.price, cur)}
                        {billed ? (inv ? <button className="text-[#2E7D32] font-semibold hover:underline" onClick={() => navigate(`/growth/billing/invoices/${inv.id}`)}>{inv.number ?? 'draft'}</button> : <Pill tone="green">Billed</Pill>)
                          : isDone ? <button className="text-[#4D8EF7] font-semibold hover:underline" onClick={() => { billStage(caseId, it.id, st.name); toast.success(`Stage "${st.name}" invoiced`); }}>Bill now</button>
                          : <span className="text-[#A0A0B0]">not done</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {meta.stoppedAt && <p className="text-[#C62828]">Stopped on {fmtDate(meta.stoppedAt)}.</p>}
        </div>
      )}

      {!meta.billedElsewhere && (
        <div className="rounded-lg border border-[#E0E0E6] p-3 space-y-2">
          <div className="flex items-center justify-between"><p className="font-semibold text-[#030213]">Components (bought-in parts)</p>{editable && !part && <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7]" onClick={() => setPart({ manufacturer: '', partNo: '', cost: '' })}><Plus className="w-3 h-3" /> Add a part</button>}</div>
          {(meta.parts ?? []).length === 0 && !part && <p className="text-[#A0A0B0]">None. Implant parts and other bought-in items are priced by the item's rule ({components[0]?.passThrough?.rule === 'cost' ? 'at cost' : components[0]?.passThrough?.rule === 'fixed' ? 'fixed' : `cost + ${components[0]?.passThrough?.value ?? s.settings.passThroughMarkupPct}%`}).</p>}
          {(meta.parts ?? []).map(p => <p key={p.id} className="flex items-center justify-between"><span>{p.manufacturer} · part {p.partNo} · cost {money(p.cost)}</span></p>)}
          {part && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input className={`${inputSm} w-32`} placeholder="Manufacturer" value={part.manufacturer} onChange={e => setPart({ ...part, manufacturer: e.target.value })} />
              <input className={`${inputSm} w-28`} placeholder="Part number" value={part.partNo} onChange={e => setPart({ ...part, partNo: e.target.value })} />
              <input className={`${inputSm} w-20`} placeholder="Cost £" type="number" value={part.cost} onChange={e => setPart({ ...part, cost: e.target.value })} />
              <button className={btnPrimary} disabled={!part.manufacturer || !part.partNo || !(Number(part.cost) > 0)} onClick={() => { addPart(caseId, { itemId: components[0]?.id ?? 'imp-parts', manufacturer: part.manufacturer, partNo: part.partNo, cost: Number(part.cost) }); setPart(null); toast.success('Part added to the invoice'); }}>Add</button>
              <button className={btn} onClick={() => setPart(null)}><Trash2 className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      )}

      {invs.filter(i => i !== main).length > 0 && (
        <p className="text-[#717182]">Other invoices: {invs.filter(i => i !== main).map(i => <button key={i.id} className="mr-2 font-mono text-[#4D8EF7] hover:underline" onClick={() => navigate(`/growth/billing/invoices/${i.id}`)}>{i.number ?? 'draft'}{i.stage ? ` (${i.stage})` : ''}{i.status === 'void' ? ' void' : ''}</button>)}</p>
      )}

      {stopping && (
        <StopModal caseId={caseId} items={staged.map(({ si, it }) => ({ it, done: stagesDone(si).filter(st => !meta.stagesBilled?.includes(`${it.id}:${st}`)) }))} onClose={() => setStopping(false)} />
      )}
    </div>
  );
}

function StopModal({ caseId, items, onClose }: { caseId: string; items: { it: { id: string; name: string; stages?: { name: string; price: number }[] }; done: string[] }[]; onClose: () => void }) {
  const { toast } = useToast();
  const all = items.flatMap(x => x.done.map(st => ({ itemId: x.it.id, stage: st, label: `${x.it.name} · ${st}`, price: x.it.stages?.find(y => y.name === st)?.price ?? 0 })));
  const [pick, setPick] = useState(all.map(a => a.label));
  return (
    <Modal isOpen onClose={onClose} title="The case stopped partway" footer={<div className="flex justify-end gap-2"><button className={btn} onClick={() => { stopCase(caseId, []); toast.success('Marked stopped; nothing billed'); onClose(); }}>Don't bill</button><button className={btnPrimary} onClick={() => { stopCase(caseId, all.filter(a => pick.includes(a.label))); toast.success('Stages done so far billed'); onClose(); }}>Bill {pick.length} stage{pick.length === 1 ? '' : 's'}</button></div>}>
      <p className="text-sm text-[#5A5568] mb-3">Bill the stages done so far?</p>
      {all.length === 0 ? <p className="text-xs text-[#717182]">Every finished stage is already billed.</p> : all.map(a => (
        <label key={a.label} className="flex items-center gap-2 text-xs py-1"><input type="checkbox" checked={pick.includes(a.label)} onChange={() => setPick(p => p.includes(a.label) ? p.filter(x => x !== a.label) : [...p, a.label])} /> {a.label} · {money(a.price)}</label>
      ))}
    </Modal>
  );
}
