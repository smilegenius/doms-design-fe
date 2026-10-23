// ─── New Case Flow · drawers ─────────────────────────────────────────────────
// More services, materials, shades, photos, preferences, the fit appointment
// calendar and the scan viewer. All use the portal's SideDrawer chrome.

import { useMemo, useState, DragEvent } from 'react';
import { CalendarDays, Check, Layers, Palette, Search, SlidersHorizontal, Smartphone, Upload, Box } from 'lucide-react';
import SideDrawer from '../components/SideDrawer';
import { useCase, DrawerState } from './CaseContext';
import { CLINIC } from './data';
import {
  addDays, fmtDay, fmtShort, isBankHoliday, isClinicOpen, startOfDay, toISO, fromISO,
} from './dates';
import {
  BLEACH, GROUP_ORDER, MATERIAL_GROUP, MATERIAL_GROUPS, PREF_FIELDS, PRODUCTS, STUMP, VITA_3D, VITA_CLASSICAL, effective,
  fitCheck, fitFixes, labProducts, materialOptions, optionAvail, optionName, plural, priceOf, shadeSwatch,
  ServiceItem,
} from './rules';
import { PrimaryButton, SecondaryButton, Notice, FOCUS, LinkButton } from './ui';
import { PRODUCT_ICON } from './ServiceSteps';

export default function Drawers({ drawer, onClose }: { drawer: DrawerState | null; onClose: () => void }) {
  if (!drawer) return null;
  switch (drawer.kind) {
    case 'moreServices': return <MoreServices onClose={onClose} />;
    case 'materials': return <Materials itemId={drawer.itemId} onClose={onClose} />;
    case 'shades': return <Shades itemId={drawer.itemId} field={drawer.field} tab={drawer.tab} onClose={onClose} />;
    case 'photos': return <Photos itemId={drawer.itemId} onClose={onClose} />;
    case 'prefs': return <Prefs itemId={drawer.itemId} onClose={onClose} />;
    case 'fit': return <Fit onClose={onClose} />;
    case 'scan': return <Scan onClose={onClose} />;
  }
}

function MoreServices({ onClose }: { onClose: () => void }) {
  const { lab, addService, ctx } = useCase();
  const [q, setQ] = useState('');
  const made = labProducts(lab).filter(p => PRODUCTS[p].label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <SideDrawer open onClose={onClose} title="More products" subtitle={`Showing what ${lab.name} makes.`} icon={<Layers className="w-4 h-4 text-[#2F62D6]" />} width="md:w-[480px]">
      <div className="flex items-center border border-[#D4D4DD] rounded-lg bg-white focus-within:border-[#3F6FE8] mb-4">
        <Search className="w-4 h-4 text-[#6B6B7B] ml-3" aria-hidden />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="flex-1 px-2 py-2.5 text-sm outline-none rounded-lg" />
      </div>
      <div className="space-y-5">
        {GROUP_ORDER.map(g => {
          const items = made.filter(p => PRODUCTS[p].group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A4A5A] mb-2">{g}</p>
              <div className="space-y-1.5">
                {items.map(p => {
                  const Icon = PRODUCT_ICON[p];
                  return (
                    <button key={p} type="button" onClick={() => { addService(p); onClose(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-[#E0E0E6] hover:border-[#3F6FE8] text-left ${FOCUS}`}>
                      <Icon className="w-4 h-4 text-[#2F62D6]" aria-hidden />
                      <span className="text-sm font-semibold text-[#030213] flex-1">{PRODUCTS[p].label}</span>
                      {ctx.funding === 'nhs' && PRODUCTS[p].privateOnly && <span className="text-[10px] font-semibold text-[#4A4A5A]">Private</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {made.length === 0 && <p className="text-sm text-[#5A5A6A]">No products match. Something Else covers anything not listed.</p>}
      </div>
      <p className="mt-6 text-xs text-[#5A5A6A]">Showing what {lab.name} makes.</p>
    </SideDrawer>
  );
}

function Materials({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { draft, ctx, lab, updateItem, toast } = useCase();
  const item = draft.items.find(i => i.id === itemId);
  if (!item) return null;
  const e = effective(item, ctx);
  const opts = materialOptions(item);
  const pick = (id: string) => {
    updateItem(item.id, i => ({ ...i, material: id, matSrc: 'You', ambiguous: undefined, reopen: i.reopen?.filter(r => r !== 'material'), shade: id === 'metal' ? undefined : i.shade }));
    if (id === 'metal' && item.shade) toast.info('Shade removed: not needed for full metal.');
    onClose();
  };
  return (
    <SideDrawer open onClose={onClose} title="More Materials" subtitle={`${PRODUCTS[item.product].label} · ${lab.name}`} icon={<Layers className="w-4 h-4 text-[#2F62D6]" />} width="md:w-[480px]">
      <div className="space-y-5">
        {MATERIAL_GROUPS.map(g => {
          const list = opts.filter(o => MATERIAL_GROUP[o.id] === g);
          if (!list.length) return null;
          return (
            <div key={g}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A4A5A] mb-2">{g}</p>
              <div role="radiogroup" aria-label={g} className="space-y-1.5">
                {list.map(o => {
                  const a = optionAvail(lab, item.product, o.id, ctx.funding, item);
                  // The material's lead time with this lab ("7 days"); no prices in this flow.
                  const p = priceOf({ ...item, material: o.id }, ctx, draft.fastTrack);
                  const days = p.kind !== 'none' && p.ta != null ? plural(p.ta, 'day') : '';
                  const sel = e.material === o.id;
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={sel} aria-disabled={!a.ok} onClick={() => a.ok && pick(o.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left ${FOCUS} ${!a.ok ? 'border-dashed border-[#D4D4DD] bg-[#FAFAFB] cursor-not-allowed' : sel ? 'border-[#3F6FE8] bg-[#EEF4FF]' : 'border-[#E0E0E6] bg-white hover:border-[#3F6FE8]'}`}>
                      <span className="flex-1">
                        <span className={`block text-sm font-semibold ${a.ok ? 'text-[#030213]' : 'text-[#6B6B7B]'}`}>{o.name}</span>
                        {(a.ok ? days : a.reason) && <span className="block text-[11px] text-[#4A4A5A]">{a.ok ? days : a.reason}</span>}
                      </span>
                      {sel && <Check className="w-4 h-4 text-[#2F62D6]" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SideDrawer>
  );
}

const TAB_KEY = 'newCaseFlow.shadeTab';
function Shades({ itemId, field, tab: initialTab, onClose }: { itemId: string; field: 'shade' | 'incisal' | 'cervical' | 'stump'; tab?: 'classical' | '3d' | 'bleach'; onClose: () => void }) {
  const { draft, updateItem } = useCase();
  const [tab, setTab] = useState<'classical' | '3d' | 'bleach'>(() => {
    if (initialTab) return initialTab;
    try { return (localStorage.getItem(TAB_KEY) as 'classical' | '3d' | 'bleach') || 'classical'; } catch { return 'classical'; }
  });
  const item = draft.items.find(i => i.id === itemId);
  if (!item) return null;
  const choose = (t: typeof tab) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };
  const list = field === 'stump' ? STUMP : tab === 'classical' ? VITA_CLASSICAL : tab === '3d' ? VITA_3D : BLEACH;
  const current = item[field];
  const pick = (s: string) => { updateItem(item.id, field === 'shade' ? { shade: s, shadeSrc: 'You' } : { [field]: s } as Partial<ServiceItem>); onClose(); };
  const title = field === 'shade' ? 'More Shades' : field === 'stump' ? 'Stump shade' : `${field.charAt(0).toUpperCase()}${field.slice(1)} shade`;
  return (
    <SideDrawer open onClose={onClose} title={title} subtitle="Colours on screen are a guide. Use your shade tab." icon={<Palette className="w-4 h-4 text-[#2F62D6]" />} width="md:w-[480px]">
      {field !== 'stump' && (
        <div role="tablist" className="flex items-center gap-5 border-b border-[#ECECF2] mb-4">
          {([['classical', 'VITA Classical'], ['3d', '3D-Master'], ['bleach', 'Bleach']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => choose(id)} className={`pb-2 -mb-px text-sm font-medium border-b-2 ${FOCUS} ${tab === id ? 'text-[#030213] border-[#030213]' : 'text-[#5A5A6A] border-transparent'}`}>{label}</button>
          ))}
        </div>
      )}
      <div role="radiogroup" aria-label={title} className="grid grid-cols-4 gap-2">
        {list.map(s => (
          <button key={s} type="button" role="radio" aria-checked={current === s} onClick={() => pick(s)} className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border ${FOCUS} ${current === s ? 'border-[#3F6FE8] bg-[#EEF4FF]' : 'border-[#E0E0E6] bg-white hover:border-[#3F6FE8]'}`}>
            <span className="w-8 h-10 rounded-md border border-black/10" style={{ background: shadeSwatch(s) }} aria-hidden />
            <span className="text-xs font-semibold text-[#030213]">{s}</span>
          </button>
        ))}
      </div>
      {field !== 'shade' && current && <div className="mt-4"><LinkButton onClick={() => { updateItem(item.id, { [field]: undefined } as Partial<ServiceItem>); onClose(); }}>Clear {field} shade</LinkButton></div>}
      <p className="mt-5 text-xs text-[#5A5A6A]">Colours on screen are a guide. Use your shade tab.</p>
    </SideDrawer>
  );
}

function Photos({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { draft, updateItem, patient } = useCase();
  const [staged, setStaged] = useState<{ label: string; from: 'phone' | 'upload' }[]>([]);
  const [over, setOver] = useState(false);
  const item = draft.items.find(i => i.id === itemId);
  if (!item) return null;
  const phone = staged.filter(s => s.from === 'phone').length;
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); setStaged(s => [...s, ...Array.from(e.dataTransfer.files).map(f => ({ label: f.name, from: 'upload' as const }))]); };
  const done = () => { updateItem(item.id, i => ({ ...i, photos: [...i.photos, ...staged.map(s => ({ label: s.label }))] })); onClose(); };
  return (
    <SideDrawer open onClose={onClose} title="Photos for the lab" subtitle={`${patient.first} ${patient.last} · ${PRODUCTS[item.product].label}`} icon={<Smartphone className="w-4 h-4 text-[#2F62D6]" />} width="md:w-[520px]">
      <div className="space-y-4">
        <div className="flex gap-4 p-4 rounded-xl bg-white border border-[#E0E0E6]">
          <FakeQr />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#030213]">Use your phone</p>
            <p className="text-xs text-[#3A3A4A] mt-1 leading-relaxed">Scan with your phone’s camera to take photos. They go straight into this case and aren’t kept on your phone.</p>
            <button type="button" onClick={() => setStaged(s => [...s, { label: 'Retracted smile', from: 'phone' }, { label: 'Close-up with shade tab', from: 'phone' }])} className={`mt-3 text-xs font-semibold text-[#2F62D6] hover:underline rounded ${FOCUS}`}>
              Demo: take 2 photos on the phone
            </button>
          </div>
        </div>
        <div
          tabIndex={0}
          role="button"
          aria-label="Drop photos here or browse"
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStaged(s => [...s, { label: `Photo ${s.length + 1}.jpg`, from: 'upload' }]); } }}
          onClick={() => setStaged(s => [...s, { label: `Photo ${s.length + 1}.jpg`, from: 'upload' }])}
          className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer ${over ? 'border-[#3F6FE8] bg-[#F5F8FF]' : 'border-[#C9C9D6] bg-white'} ${FOCUS}`}
        >
          <Upload className="w-5 h-5 text-[#4A4A5A]" aria-hidden />
          <p className="text-sm text-[#1F1F2E]">Drop photos here or <span className="font-semibold text-[#2F62D6]">Browse</span></p>
        </div>
        <p className="text-xs text-[#4A4A5A]">Take one retracted smile and one close-up with the shade tab next to the tooth. Two to four photos is plenty.</p>
        <div role="status" aria-live="polite">
          {staged.length > 0 && (
            <Notice tone="success">
              {phone > 0 ? `${phone} ${phone === 1 ? 'photo' : 'photos'} received from your phone` : `${staged.length} ${staged.length === 1 ? 'photo' : 'photos'} added`}
              {phone > 0 && staged.length > phone ? `, ${staged.length - phone} uploaded` : ''}
            </Notice>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={staged.length === 0} onClick={done}>Done</PrimaryButton>
        </div>
      </div>
    </SideDrawer>
  );
}
function FakeQr() {
  // A decorative stand-in for the hand-off QR code.
  const cells = useMemo(() => Array.from({ length: 121 }, (_, i) => ((i * 7919) % 13) % 3 === 0 || [0, 1, 2, 10, 11, 12, 22, 23, 24, 96, 97, 98, 108, 109, 110, 120].includes(i)), []);
  return (
    <div className="w-24 h-24 p-1.5 rounded-lg bg-white border border-[#E0E0E6] grid grid-cols-11 gap-[1px] flex-shrink-0" role="img" aria-label="QR code for this case's photo hand-off">
      {cells.map((on, i) => <span key={i} className={on ? 'bg-[#030213]' : 'bg-white'} />)}
    </div>
  );
}

function Prefs({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { draft, ctx, user, prescriber, updateItem } = useCase();
  const item = draft.items.find(i => i.id === itemId);
  const e = item ? effective(item, ctx) : null;
  const [vals, setVals] = useState(() => (e ? { ...e.prefs } : null));
  const [saveUsual, setSaveUsual] = useState(!!item?.saveUsual);
  if (!item || !e || !vals) return null;
  const isPbc = e.material === 'pbc';
  const metal = isPbc || e.material === 'metal';
  const fields = PREF_FIELDS.map(f => f.key === 'clearance' && metal ? { ...f, options: [...f.options, 'Metal occlusal island'] } : f);
  const save = () => {
    // Keep only what differs from the usual, so "changed for this case" is honest.
    const base = effective({ ...item, prefs: undefined }, ctx).prefs;
    const changed = (Object.keys(vals) as (keyof typeof vals)[]).filter(k => vals[k] !== base[k]);
    updateItem(item.id, { prefs: changed.length ? Object.fromEntries(changed.map(k => [k, vals[k]])) : undefined, saveUsual });
    onClose();
  };
  const noun = PRODUCTS[item.product].noun;
  return (
    <SideDrawer open onClose={onClose} title="Preferences for this case" subtitle={`${PRODUCTS[item.product].label} · ${e.prefsSrc}`} icon={<SlidersHorizontal className="w-4 h-4 text-[#2F62D6]" />} width="md:w-[480px]">
      <div className="space-y-4">
        {fields.map(f => (
          <label key={f.key} className="block">
            <span className="block text-xs font-semibold text-[#3A3A4A] mb-1">{f.label}</span>
            <select value={vals[f.key] as string} onChange={ev => setVals(v => ({ ...v!, [f.key]: ev.target.value }))} className="w-full rounded-lg border border-[#D4D4DD] px-3 py-2 text-sm bg-white focus:border-[#3F6FE8] outline-none">
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
        ))}
        {isPbc && (
          <label className="block">
            <span className="block text-xs font-semibold text-[#3A3A4A] mb-1">PBC margin</span>
            <select value={vals.pbcMargin} onChange={ev => setVals(v => ({ ...v!, pbcMargin: ev.target.value }))} className="w-full rounded-lg border border-[#D4D4DD] px-3 py-2 text-sm bg-white">
              {['Metal collar lingual', 'Porcelain butt margin', 'Metal collar 360°'].map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
        )}
        {item.product === 'bridge' && (
          <label className="block">
            <span className="block text-xs font-semibold text-[#3A3A4A] mb-1">Pontic design</span>
            <select value={vals.pontic} onChange={ev => setVals(v => ({ ...v!, pontic: ev.target.value }))} className="w-full rounded-lg border border-[#D4D4DD] px-3 py-2 text-sm bg-white">
              {['Ovate', 'Modified ridge lap', 'Ridge lap', 'Hygienic'].map(o => <option key={o}>{o}</option>)}
            </select>
          </label>
        )}
        {prescriber?.id === user.id && (
          <label className="flex items-center gap-2.5 text-sm text-[#1F1F2E] cursor-pointer">
            <input type="checkbox" checked={saveUsual} onChange={ev => setSaveUsual(ev.target.checked)} className="w-4 h-4 accent-[#3F6FE8]" />
            Save as My Usual for {noun.charAt(0).toUpperCase() + noun.slice(1)}s
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save}>Use for This Case</PrimaryButton>
        </div>
      </div>
    </SideDrawer>
  );
}

function Fit({ onClose }: { onClose: () => void }) {
  const { draft, update, ctx, dates, patient, changeLab } = useCase();
  const [picked, setPicked] = useState<string | null>(null);
  const today = startOfDay(ctx.now);
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(monday, i));
  const backBy = dates.backBy;
  if (!backBy) return null;
  const fixes = picked ? fitFixes(draft, ctx, picked) : [];
  const setFit = (iso: string, extra: Partial<typeof draft> = {}) => { update(d => ({ ...d, ...extra, fit: iso })); onClose(); };
  return (
    <SideDrawer open onClose={onClose} title={`When’s ${patient.first}’s Fit Appointment?`} subtitle={`Earliest fit ${dates.earliestFit ? fmtDay(dates.earliestFit) : ''} · ${CLINIC.name} opens Mon–Sat`} icon={<CalendarDays className="w-4 h-4 text-[#2F62D6]" />} width="md:w-[560px]">
      <div className="grid grid-cols-7 gap-1.5 mb-2" aria-hidden>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <p key={d} className="text-[11px] font-semibold text-[#4A4A5A] text-center">{d}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Fit appointment dates">
        {days.map(d => {
          const iso = toISO(d);
          const past = d <= today;
          const closed = !isClinicOpen(d);
          const chk = fitCheck(iso, backBy);
          const tooSoon = !past && !closed && !chk.ok;
          const sel = draft.fit === iso;
          const label = `${fmtDay(d)}${past ? ', past' : closed ? ', closed' : tooSoon ? ', too soon for the lab' : `, lab delivers by ${fmtDay(chk.neededBy)}`}`;
          return (
            <button
              key={iso}
              type="button"
              disabled={past || closed}
              aria-label={label}
              aria-pressed={sel}
              onClick={() => (tooSoon ? setPicked(iso) : setFit(iso))}
              className={`h-14 rounded-lg border text-left px-1.5 py-1 ${FOCUS} ${
                sel ? 'border-[#3F6FE8] bg-[#EEF4FF] ring-1 ring-[#3F6FE8]'
                  : past ? 'border-transparent bg-[#F3F3F5] text-[#9A9AAA] cursor-not-allowed'
                  : closed ? 'border-transparent bg-[#F3F3F5] text-[#6B6B7B] cursor-not-allowed'
                  : tooSoon ? `border-[#E0E0E6] text-[#4A4A5A] ${picked === iso ? 'ring-2 ring-[#B45309]' : ''}`
                  : 'border-[#BFE3C9] bg-white hover:border-[#2E7D32] text-[#030213]'
              }`}
              style={tooSoon ? { backgroundImage: 'repeating-linear-gradient(135deg, #F3F3F5 0 6px, #FFFFFF 6px 12px)' } : undefined}
            >
              <span className="block text-sm font-semibold">{d.getDate()}</span>
              <span className="block text-[9px] leading-tight">{closed && !past ? (isBankHoliday(d) ? 'Holiday' : 'Closed') : d.getDate() === 1 || d === days[0] ? fmtShort(d).split(' ')[1] : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-[#4A4A5A]">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-[#BFE3C9] bg-white" />Lab can make it</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-[#E0E0E6]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #E5E5EA 0 3px, #fff 3px 6px)' }} />Too soon for the lab</span>
      </div>

      {picked && (
        <div className="mt-5" role="status" aria-live="polite">
          <p className="text-sm font-semibold text-[#030213] mb-2">{fmtDay(fromISO(picked))} is too soon for the lab (back by {fmtDay(backBy)}).</p>
          {fixes.length ? (
            <div className="space-y-2">
              {fixes.map(f => (
                <button key={f.label} type="button" onClick={() => (f.kind === 'fast' ? setFit(picked, { fastTrack: true }) : (changeLab(f.labId!), setFit(picked)))} className={`w-full text-left px-3.5 py-2.5 rounded-lg border border-[#C8D8FC] bg-[#F5F8FF] text-sm font-semibold text-[#1E3A8A] hover:bg-[#EEF4FF] ${FOCUS}`}>
                  {/* Fast-Track shows only the date it brings the case back by. */}
                  {f.kind === 'fast' ? `Use Fast-Track · back ${fmtDay(f.backBy)}` : f.label}
                </button>
              ))}
            </div>
          ) : (
            <Notice tone="decision">No approved lab can make this by then. Pick a later fit date.</Notice>
          )}
        </div>
      )}
      <div className="mt-6 pt-4 border-t border-[#ECECF2]">
        <button type="button" onClick={() => { update(d => ({ ...d, fit: undefined })); onClose(); }} className={`text-sm font-semibold text-[#2F62D6] hover:underline rounded ${FOCUS}`}>
          No Fit Booked Yet? Use the Earliest Date
        </button>
      </div>
    </SideDrawer>
  );
}

function Scan({ onClose }: { onClose: () => void }) {
  const { draft, patient } = useCase();
  const s = draft.scan;
  if (!s) return null;
  return (
    <SideDrawer open onClose={onClose} title={`${s.scanner} scan · today ${s.time}`} subtitle={`${patient.first} ${patient.last}`} icon={<Box className="w-4 h-4 text-[#2F62D6]" />}>
      <div className="rounded-xl bg-[#0F1222] p-6 flex items-center justify-center">
        <img src="/teeth-3d.png" alt="3D preview of the scan" className="max-h-[360px] object-contain" />
      </div>
      <div className="mt-4 flex gap-2">
        {(['upper', 'lower', 'bite'] as const).map(a => (
          <span key={a} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${s.arches[a] ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]' : 'bg-[#F3F3F5] border-[#E0E0E6] text-[#6B6B7B]'}`}>
            {a === 'bite' ? 'Bite' : a === 'upper' ? 'Upper' : 'Lower'} {s.arches[a] ? '✓' : '—'}
          </span>
        ))}
      </div>
      <p className="text-xs text-[#4A4A5A] mt-3">Drag to rotate in the full viewer. This preview is for checking the arches only.</p>
    </SideDrawer>
  );
}
export { optionName };
