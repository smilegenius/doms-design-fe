import { useRef, useState } from 'react';
import { AlertTriangle, Archive, ArchiveRestore, Download, FileUp, Layers, Link2, Pencil, Percent, Plus, Search, Upload } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { saveBlob } from '../../bulk-actions/zip';
import type { CatalogItem, PassRule, Unit, VatTreatment } from '../types';
import { addItem, addItems, archiveItem, bulkPreview, bulkPriceChange, mapOrderType, updateDepartment, updateItem, useBilling, type BulkChange } from '../billingStore';
import { pricesOn, scheduledChange } from '../engine';
import { unmappedTypes } from '../insights';
import { addDays, endOfMonth, fmtDate, pl, today } from '../format';
import { btn, btnPrimary, Card, Empty, Field, input, inputSm, Note, Pill, Seg, td, th, Toggle } from '../ui';

// ── 5. Catalog: items and prices ─────────────────────────────────────────────

const UNITS: Unit[] = ['per unit', 'per arch', 'per case', 'per item'];
const TAX_RATES = ['Exempt Income', 'Standard Rate Income (20%)', 'Zero Rated Income', 'No VAT'];
const num = (v: string) => (v.trim() === '' ? null : Number(v));

export default function Catalog() {
  const s = useBilling();
  const { toast } = useToast();
  const [stagesFor, setStagesFor] = useState<CatalogItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const t = today();
  const rows = s.catalog.filter(i => (showArchived || !i.archived) && (dept === 'all' || i.department === dept) && (!q || `${i.code} ${i.name}`.toLowerCase().includes(q.toLowerCase())));
  const mapParam = new URLSearchParams(window.location.search).get('map');
  const unmapped = unmappedTypes(s);
  const vat = s.settings.vatRegistered;
  const gap = (i: CatalogItem) => !i.archived && !i.passThrough && i.id !== 'oth' && pricesOn(i, t).priv == null;

  return (
    <div className="space-y-4">
      {unmapped.length > 0 && (
        <Card title={<span className="inline-flex items-center gap-1.5"><Link2 className="w-4 h-4 text-[#4D8EF7]" /> Order types to map <Pill tone="amber">{unmapped.length}</Pill></span>} sub="Scanner order types with no catalog match. Pick the item once; every future order of that type uses it.">
          <ul className="space-y-2">
            {unmapped.map(u => (
              <li key={u.type} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border ${mapParam === u.type ? 'border-[#4D8EF7] bg-[#F5F9FF]' : 'border-[#E0E0E6]'}`}>
                <span className="text-xs"><b>{u.type}</b> <span className="text-[#717182]">· {u.cases.join(', ')}</span></span>
                <select className={inputSm} defaultValue="" onChange={e => { if (!e.target.value) return; const n = mapOrderType(u.type, e.target.value); toast.success(`Mapped and remembered; ${pl(n, 'invoice')} repriced`); }}>
                  <option value="">Map to…</option>{s.catalog.filter(i => !i.archived).map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Catalog"
        sub="One catalog sets every price. Each item has an NHS and a private price; a blank NHS price uses the private one. A price change applies from a date: cases received earlier keep the price they came in at."
        actions={<>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-[#5A5568] mr-1"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived ({s.catalog.filter(i => i.archived).length})</label>
          <button className={btn} onClick={() => saveBlob(new Blob([sampleCsv(s.catalog)], { type: 'text/csv' }), 'catalog.csv')}><Download className="w-3.5 h-3.5" /> Export CSV</button>
          <button className={btn} onClick={() => setImporting(true)}><FileUp className="w-3.5 h-3.5" /> Import CSV</button>
          <button className={btn} onClick={() => setBulk(true)}><Percent className="w-3.5 h-3.5" /> Change prices</button>
          <button className={btnPrimary} onClick={() => setEditing('new')}><Plus className="w-3.5 h-3.5" /> Add item</button>
        </>}
        pad={false}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[#F0EFF6]">
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A0A0B0]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or item…" className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs w-52 focus:outline-none focus:border-[#4D8EF7]" /></div>
          <select className={inputSm} value={dept} onChange={e => setDept(e.target.value)}><option value="all">All departments</option>{s.departments.map(d => <option key={d.name}>{d.name}</option>)}</select>
          <span className="text-[11px] text-[#A0A0B0]">Type a price and press Enter to change it from today, or use Edit to pick the date.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead><tr>
              <th className={th}>Code</th><th className={th}>Item</th><th className={th}>Department</th><th className={th}>Unit</th><th className={th}>NHS £</th><th className={th}>Private £</th><th className={th}>Billing</th><th className={th}>Component pricing</th>{vat && <th className={th}>VAT</th>}<th className={th} />
            </tr></thead>
            <tbody>
              {rows.map(i => {
                const now = pricesOn(i, t);
                const next = scheduledChange(i, t);
                return (
                  <tr key={i.id} className={i.archived ? 'opacity-50' : gap(i) ? 'bg-[#FFFBEB]' : ''}>
                    <td className={`${td} font-mono whitespace-nowrap`}>{i.code}</td>
                    <td className={td}>
                      <span className="font-semibold">{i.name}</span> {i.archived && <Pill>Archived</Pill>}
                      {gap(i) && <span className="flex items-center gap-1 text-[10px] text-[#B45309]"><AlertTriangle className="w-3 h-3" /> No price</span>}
                      {now.from && <span className="block text-[10px] text-[#717182]">Price since {fmtDate(now.from)}</span>}
                      {next && <span className="block text-[10px] text-[#1565C0]">From {fmtDate(next.from)}: {next.nhs != null ? `NHS £${next.nhs} · ` : ''}private £{next.priv ?? '—'}{(i.priceHistory ?? []).filter(h => h.from > t).length > 1 ? ` (+${(i.priceHistory ?? []).filter(h => h.from > t).length - 1} more)` : ''}</span>}
                    </td>
                    <td className={td}>{i.department}</td>
                    <td className={td}>{i.unit}</td>
                    <td className={td}><PriceInput key={`n-${i.id}-${now.nhs}`} value={now.nhs} placeholder={now.priv != null ? 'as private' : ''} disabled={i.archived} onSave={v => { updateItem(i.id, { nhs: v }); toast.success(`${i.name} NHS price ${v == null ? 'cleared' : `£${v}`} from today; earlier cases keep their price`); }} /></td>
                    <td className={td}><PriceInput key={`p-${i.id}-${now.priv}`} value={now.priv} disabled={i.archived} onSave={v => { updateItem(i.id, { priv: v }); toast.success(`${i.name} private price ${v == null ? 'cleared' : `£${v}`} from today; earlier cases keep their price`); }} /></td>
                    <td className={td}>{i.stages?.length ? <button className="text-left text-[11px] text-[#4D8EF7] hover:underline" onClick={() => setStagesFor(i)}><Layers className="w-3 h-3 inline -mt-0.5" /> {i.staged === 'each' ? 'Each stage' : 'At the end'} · {i.stages.length} stages</button> : <span className="text-[11px] text-[#717182]">At the end</span>}</td>
                    <td className={td}>{i.passThrough ? <span className="text-[11px]">{i.passThrough.rule === 'cost' ? 'At cost' : i.passThrough.rule === 'fixed' ? `Fixed £${i.passThrough.value}` : `Cost + ${i.passThrough.value}%`}{i.passThrough.showPart ? ' · part no.' : ''}</span> : <span className="text-[11px] text-[#A0A0B0]">—</span>}</td>
                    {vat && <td className={td}><span className="text-[11px]">{{ exempt: 'Exempt', standard: 'Standard', zero: 'Zero-rated' }[i.vat]}</span></td>}
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <button className={`${btn} mr-1`} onClick={() => setEditing(i.id)}><Pencil className="w-3 h-3" /> Edit</button>
                      <button className={btn} title={i.archived ? 'Use it again' : 'Hide from new pricing; invoices keep it'} onClick={() => { archiveItem(i.id, !i.archived); toast.success(i.archived ? `${i.name} restored` : `${i.name} archived; invoices that used it keep it`); }}>{i.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <Empty>No items match.</Empty>}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Account codes and tax rates" sub="Mapped once per department, not per item. Pulled from your Xero chart of accounts.">
          <table className="w-full">
            <thead><tr><th className={th}>Department</th><th className={th}>Xero account code</th>{vat && <th className={th}>Tax rate</th>}</tr></thead>
            <tbody>
              {s.departments.map(d => (
                <tr key={d.name}>
                  <td className={td}>{d.name}</td>
                  <td className={td}><input className={`${inputSm} w-full`} defaultValue={d.accountCode} onBlur={e => updateDepartment(d.name, { accountCode: e.target.value })} /></td>
                  {vat && <td className={td}><select className={inputSm} value={d.taxRate} onChange={e => updateDepartment(d.name, { taxRate: e.target.value })}>{TAX_RATES.map(r => <option key={r}>{r}</option>)}</select></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!vat && <p className="text-[11px] text-[#A0A0B0] mt-2">Tax rates appear when the lab is VAT-registered (Billing settings).</p>}
        </Card>
        <Card title="Remembered order types" sub="Scanner order types already mapped to an item.">
          {Object.keys(s.orderTypeMap).length === 0 ? <Empty>None yet.</Empty> : (
            <ul className="max-h-56 overflow-y-auto divide-y divide-[#F0EFF6]">
              {Object.entries(s.orderTypeMap).map(([t, id]) => (
                <li key={t} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <span className="truncate">{t}</span>
                  <select className={inputSm} value={id} onChange={e => mapOrderType(t, e.target.value)}>{s.catalog.filter(i => !i.archived || i.id === id).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {stagesFor && <StagesModal item={s.catalog.find(i => i.id === stagesFor.id)!} onClose={() => setStagesFor(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {editing && <ItemModal item={editing === 'new' ? null : s.catalog.find(i => i.id === editing) ?? null} onClose={() => setEditing(null)} />}
      {bulk && <BulkModal onClose={() => setBulk(false)} />}
    </div>
  );
}

function StagesModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const [stages, setStages] = useState(item.stages ?? []);
  const total = stages.reduce((n, x) => n + x.price, 0);
  return (
    <Modal isOpen onClose={onClose} title={`${item.name}: stage prices`} footer={<div className="flex justify-end gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={() => { updateItem(item.id, { stages }); onClose(); }}>Save</button></div>}>
      <div className="space-y-2">
        <p className="text-xs text-[#717182]">Private prices per stage; NHS stages scale by the item's NHS/private ratio. Used when the item (or an account) bills each stage.</p>
        {stages.map((st, i) => (
          <div key={i} className="flex gap-2">
            <input className={input} value={st.name} onChange={e => setStages(x => x.map((y, k) => k === i ? { ...y, name: e.target.value } : y))} />
            <input className={`${input} w-28`} type="number" value={st.price} onChange={e => setStages(x => x.map((y, k) => k === i ? { ...y, price: Number(e.target.value) } : y))} />
            <button className={btn} onClick={() => setStages(x => x.filter((_, k) => k !== i))}>Remove</button>
          </div>
        ))}
        <button className={btn} onClick={() => setStages(x => [...x, { name: `Stage ${x.length + 1}`, price: 0 }])}>Add stage</button>
        <p className="text-xs text-[#5A5568]">All stages: £{total.toFixed(2)} (billed at the end: £{(item.priv ?? 0).toFixed(2)})</p>
      </div>
    </Modal>
  );
}

function sampleCsv(items: CatalogItem[]) {
  return ['code,name,department,unit,nhs_price,private_price', ...items.map(i => [i.code, i.name, i.department, i.unit, i.nhs ?? '', i.priv ?? ''].join(','))].join('\n');
}

const SAMPLE_IMPORT = `code,name,department,unit,nhs_price,private_price
CB-CRN,Crown,Crown & Bridge,per unit,95,185
CB-ZRB,Zirconia bridge unit,Crown & Bridge,per unit,,210
APP-SPT,Sports guard,Appliances,per arch,,95
DEN-REL,Denture reline,Dentures,per arch,45,
IMP-BAR,Implant bar,Implants,per item,,`;

function ImportModal({ onClose }: { onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [text, setText] = useState(SAMPLE_IMPORT);
  const [what, setWhat] = useState<'price list' | 'practices' | 'open cases'>('price list');
  const file = useRef<HTMLInputElement>(null);
  const rows = text.trim().split(/\r?\n/).slice(1).map(l => l.split(',').map(x => x.trim())).filter(r => r.length >= 2 && r[0]);
  const parsed = rows.map(([code, name, department, unit, nhs, priv]) => {
    const exists = s.catalog.find(i => i.code === code);
    const item: CatalogItem = { id: exists?.id ?? `it-${code.toLowerCase()}`, code, name, department: department || 'Other', unit: (UNITS.includes(unit as Unit) ? unit : 'per item') as Unit, nhs: num(nhs ?? ''), priv: num(priv ?? ''), staged: exists?.staged ?? 'end', stages: exists?.stages, passThrough: exists?.passThrough, vat: exists?.vat ?? 'exempt' };
    const gaps = [item.priv == null && 'No private price', !UNITS.includes(unit as Unit) && `Unit "${unit}" not recognised`].filter(Boolean) as string[];
    return { item, exists: !!exists, gaps };
  });
  return (
    <Modal isOpen onClose={onClose} size="lg" title="Import from the old system" footer={
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#717182]">{parsed.filter(p => !p.exists).length} new · {parsed.filter(p => p.exists).length} updated · {parsed.filter(p => p.gaps.length).length} with gaps</span>
        <div className="flex gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!parsed.length || what !== 'price list'} onClick={() => { addItems(parsed.map(p => p.item)); toast.success(`${pl(parsed.length, 'item')} imported`); onClose(); }}><Upload className="w-3.5 h-3.5" /> Import {parsed.length}</button></div>
      </div>
    }>
      <div className="space-y-3">
        <Seg value={what} onChange={setWhat} options={[{ value: 'price list', label: 'Price list (NHS and private)' }, { value: 'practices', label: 'Practices & dentists' }, { value: 'open cases', label: 'Open cases' }]} />
        {what !== 'price list' ? <Note>Practices, dentists and open cases are imported in the setup wizard, where they're matched to Xero contacts and the switch-over date.</Note> : <>
          <div className="flex items-center gap-2">
            <button className={btn} onClick={() => file.current?.click()}><FileUp className="w-3.5 h-3.5" /> Choose a CSV</button>
            <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
            <span className="text-[11px] text-[#717182]">or paste below. Columns: code, name, department, unit, nhs_price, private_price</span>
          </div>
          <textarea className={`${input} font-mono text-[11px]`} rows={5} value={text} onChange={e => setText(e.target.value)} />
          <table className="w-full">
            <thead><tr><th className={th}>Code</th><th className={th}>Item</th><th className={th}>NHS</th><th className={th}>Private</th><th className={th}>Preview</th></tr></thead>
            <tbody>{parsed.map(p => (
              <tr key={p.item.code} className={p.gaps.length ? 'bg-[#FFFBEB]' : ''}>
                <td className={`${td} font-mono`}>{p.item.code}</td><td className={td}>{p.item.name}</td><td className={td}>{p.item.nhs ?? '—'}</td><td className={td}>{p.item.priv ?? '—'}</td>
                <td className={td}>{p.gaps.length ? <span className="text-[#B45309] inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{p.gaps.join('; ')}</span> : <Pill tone={p.exists ? 'blue' : 'green'}>{p.exists ? 'Update' : 'New'}</Pill>}</td>
              </tr>
            ))}</tbody>
          </table>
        </>}
      </div>
    </Modal>
  );
}


/** A price cell: saves on Enter or when leaving the field; Escape undoes. */
function PriceInput({ value, placeholder, disabled, onSave }: { value: number | null; placeholder?: string; disabled?: boolean; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  const commit = () => { const n = num(v); if (n !== value && (n == null || n >= 0)) onSave(n); };
  return (
    <input className={`${inputSm} w-20`} type="number" min="0" step="0.5" value={v} placeholder={placeholder} disabled={disabled}
      onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setV(value == null ? '' : String(value)); }} />
  );
}

type Draft = Omit<CatalogItem, 'id'>;
const BLANK: Draft = { code: '', name: '', department: 'Crown & Bridge', unit: 'per unit', nhs: null, priv: null, staged: 'end', vat: 'exempt' };

/** Add a new item, or edit one: details, prices from a date, billing, component pricing, VAT. */
function ItemModal({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const t = today();
  const now = item ? pricesOn(item, t) : { nhs: null, priv: null, from: null };
  const [d, setD] = useState<Draft>(item ? { ...item, nhs: now.nhs, priv: now.priv } : BLANK);
  const [newDept, setNewDept] = useState('');
  const [from, setFrom] = useState(t);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const vat = s.settings.vatRegistered;
  const dept = d.department === '__new' ? newDept.trim() : d.department;
  const priceChanged = !!item && (d.nhs !== now.nhs || d.priv !== now.priv);
  const history = item ? [{ from: null as string | null, nhs: item.nhs, priv: item.priv, by: undefined as string | undefined, note: 'Original price' }, ...(item.priceHistory ?? [])] : [];

  function save() {
    if (!d.code.trim() || !d.name.trim()) { setError('Add a code and a name'); return; }
    if (!dept) { setError('Name the new department'); return; }
    if (d.priv == null && !d.passThrough) { setError('Add a private price (or make it a component priced from cost)'); return; }
    if (!item) {
      const r = addItem({ ...d, department: dept });
      if (r.error) { setError(r.error); return; }
      toast.success(`${d.name} added to the catalog`);
    } else {
      const { nhs, priv, ...rest } = d;
      updateItem(item.id, { ...rest, department: dept });
      // Only the prices that were edited: the other keeps whatever is in force on that date.
      if (priceChanged) updateItem(item.id, { ...(nhs !== now.nhs ? { nhs } : {}), ...(priv !== now.priv ? { priv } : {}) }, { from, note: note.trim() || undefined });
      toast.success(priceChanged ? `${d.name} saved; new price ${from > t ? `from ${fmtDate(from)}` : 'from today'}` : `${d.name} saved`);
    }
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} size="lg" title={item ? `Edit ${item.name}` : 'Add a catalog item'} footer={
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#C62828]">{error}</span>
        <div className="flex gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} onClick={save}>{item ? 'Save' : 'Add item'}</button></div>
      </div>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Code"><input className={`${input} font-mono uppercase`} value={d.code} disabled={!!item} onChange={e => setD({ ...d, code: e.target.value })} placeholder="APP-SPT" /></Field>
          <div className="sm:col-span-2"><Field label="Name"><input className={input} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="Sports guard" /></Field></div>
          <Field label="Department">
            <select className={input} value={d.department} onChange={e => setD({ ...d, department: e.target.value })}>{s.departments.map(x => <option key={x.name}>{x.name}</option>)}<option value="__new">+ New department…</option></select>
          </Field>
          {d.department === '__new' && <Field label="New department"><input className={input} value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="e.g. Digital" /></Field>}
          <Field label="Unit"><select className={input} value={d.unit} onChange={e => setD({ ...d, unit: e.target.value as Unit })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></Field>
        </div>

        <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-3">
          <p className="text-xs font-semibold text-[#030213]">Prices</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="NHS £" hint="Blank: uses the private price"><input className={input} type="number" min="0" step="0.5" value={d.nhs ?? ''} onChange={e => setD({ ...d, nhs: num(e.target.value) })} /></Field>
            <Field label="Private £"><input className={input} type="number" min="0" step="0.5" value={d.priv ?? ''} onChange={e => setD({ ...d, priv: num(e.target.value) })} /></Field>
            {item && <Field label="Applies to cases received from"><input className={input} type="date" value={from} min={addDays(t, -60)} onChange={e => setFrom(e.target.value)} /></Field>}
            {item && <Field label="Note (optional)"><input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Zirconia cost rise" /></Field>}
          </div>
          {priceChanged && <Note tone={from > t ? 'blue' : 'amber'}>{from > t ? `Scheduled: cases received from ${fmtDate(from)} get the new price; until then they get today's.` : from < t ? `Back-dated to ${fmtDate(from)}: waiting invoices for cases received since then are repriced; sent invoices don't change.` : 'From today. Cases already received keep the price they came in at.'}</Note>}
          {history.length > 1 && (
            <div>
              <p className="text-[11px] text-[#717182] mb-1">Price history</p>
              <ul className="text-[11px] space-y-0.5">
                {history.map((h, i) => <li key={i} className={h.from && h.from > t ? 'text-[#1565C0]' : 'text-[#5A5568]'}>{h.from ? `From ${fmtDate(h.from)}` : 'Before that'}: {h.nhs != null ? `NHS £${h.nhs} · ` : ''}private £{h.priv ?? '—'}{h.note ? ` · ${h.note}` : ''}{h.by ? ` · ${h.by}` : ''}{h.from && h.from > t ? ' (scheduled)' : ''}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#030213]">Billing</p>
            <Seg value={d.staged} onChange={v => setD({ ...d, staged: v, stages: v === 'each' && !d.stages?.length ? [{ name: 'Stage 1', price: 0 }, { name: 'Finish', price: d.priv ?? 0 }] : d.stages })} options={[{ value: 'end', label: 'Bill at the end' }, { value: 'each', label: 'Bill each stage' }]} />
            {(d.staged === 'each' || !!d.stages?.length) && (
              <div className="space-y-1.5">
                {(d.stages ?? []).map((st, k) => (
                  <div key={k} className="flex gap-1.5">
                    <input className={inputSm + ' flex-1'} value={st.name} onChange={e => setD({ ...d, stages: d.stages!.map((x, j) => j === k ? { ...x, name: e.target.value } : x) })} />
                    <input className={`${inputSm} w-20`} type="number" value={st.price} onChange={e => setD({ ...d, stages: d.stages!.map((x, j) => j === k ? { ...x, price: Number(e.target.value) } : x) })} />
                    <button className="text-[#A0A0B0] hover:text-[#C62828] text-xs" onClick={() => setD({ ...d, stages: d.stages!.filter((_, j) => j !== k) })}>✕</button>
                  </div>
                ))}
                <button className="text-[11px] font-semibold text-[#4D8EF7]" onClick={() => setD({ ...d, stages: [...(d.stages ?? []), { name: `Stage ${(d.stages?.length ?? 0) + 1}`, price: 0 }] })}>+ Add stage</button>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#030213]">Component pricing</p>
            <p className="text-[11px] text-[#717182]">For bought-in parts: the technician enters the cost on the case.</p>
            <Toggle on={!!d.passThrough} onChange={v => setD({ ...d, passThrough: v ? { rule: 'cost-plus', value: s.settings.passThroughMarkupPct, showPart: true } : undefined })} label={d.passThrough ? 'Priced from the part cost' : 'Not a component'} />
            {d.passThrough && (
              <div className="flex flex-wrap items-center gap-1.5">
                <select className={inputSm} value={d.passThrough.rule} onChange={e => setD({ ...d, passThrough: { ...d.passThrough!, rule: e.target.value as PassRule } })}><option value="cost">At cost</option><option value="cost-plus">Cost plus %</option><option value="fixed">Fixed price</option></select>
                {d.passThrough.rule !== 'cost' && <input className={`${inputSm} w-16`} type="number" value={d.passThrough.value} onChange={e => setD({ ...d, passThrough: { ...d.passThrough!, value: Number(e.target.value) } })} />}
                <label className="text-[11px] inline-flex items-center gap-1"><input type="checkbox" checked={d.passThrough.showPart} onChange={e => setD({ ...d, passThrough: { ...d.passThrough!, showPart: e.target.checked } })} /> Part number on the invoice</label>
              </div>
            )}
            {vat && <Field label="VAT treatment"><select className={input} value={d.vat} onChange={e => setD({ ...d, vat: e.target.value as VatTreatment })}><option value="exempt">Exempt</option><option value="standard">Standard-rated</option><option value="zero">Zero-rated</option></select></Field>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Raise or lower prices across the catalog or one department, from a date. */
function BulkModal({ onClose }: { onClose: () => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [b, setB] = useState<BulkChange>({ department: 'all', which: 'both', pct: 3, round: 1, from: addDays(endOfMonth(today()), 1) });
  const [note, setNote] = useState('');
  const preview = bulkPreview(s, b);
  const changed = preview.filter(x => x.changed);
  const fmt = (n: number | null) => (n == null ? '—' : `£${n % 1 ? n.toFixed(2) : n}`);
  return (
    <Modal isOpen onClose={onClose} size="lg" title="Change prices" footer={
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#717182]">{pl(changed.length, 'item')} change{changed.length === 1 ? 's' : ''} from {fmtDate(b.from)}</span>
        <div className="flex gap-2"><button className={btn} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={!changed.length} onClick={() => { const n = bulkPriceChange(b, note.trim() || undefined); toast.success(`${pl(n, 'price')} changed from ${fmtDate(b.from)}`); onClose(); }}>Apply to {changed.length}</button></div>
      </div>
    }>
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Items"><select className={input} value={b.department} onChange={e => setB({ ...b, department: e.target.value })}><option value="all">All items</option>{s.departments.map(d => <option key={d.name}>{d.name}</option>)}</select></Field>
          <Field label="Prices"><select className={input} value={b.which} onChange={e => setB({ ...b, which: e.target.value as BulkChange['which'] })}><option value="both">NHS and private</option><option value="priv">Private only</option><option value="nhs">NHS only</option></select></Field>
          <Field label="Change %" hint="Negative to lower"><input className={input} type="number" step="0.5" value={b.pct} onChange={e => setB({ ...b, pct: Number(e.target.value) })} /></Field>
          <Field label="Round to"><select className={input} value={b.round} onChange={e => setB({ ...b, round: Number(e.target.value) as BulkChange['round'] })}><option value={0.5}>£0.50</option><option value={1}>£1</option><option value={5}>£5</option></select></Field>
          <Field label="Applies to cases received from"><input className={input} type="date" value={b.from} onChange={e => setB({ ...b, from: e.target.value })} /></Field>
          <Field label="Note (optional)"><input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Annual price review" /></Field>
        </div>
        <Note>Components priced from cost aren't changed. Cases received before {fmtDate(b.from)} keep their prices.</Note>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-[#E0E0E6]">
          <table className="w-full">
            <thead className="sticky top-0"><tr><th className={th}>Item</th><th className={th}>NHS</th><th className={th}>Private</th></tr></thead>
            <tbody>{preview.map(x => (
              <tr key={x.item.id} className={x.changed ? '' : 'opacity-50'}>
                <td className={td}>{x.item.name}</td>
                <td className={td}>{fmt(x.cur.nhs)}{x.nhs !== x.cur.nhs && <> → <b>{fmt(x.nhs)}</b></>}</td>
                <td className={td}>{fmt(x.cur.priv)}{x.priv !== x.cur.priv && <> → <b>{fmt(x.priv)}</b></>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

