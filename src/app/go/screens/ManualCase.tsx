// ─── Create manually ─────────────────────────────────────────────────────────
// Mirrors the web Quick create-case form, laid out for a phone:
//   1 Patient & lab — search existing or create on the spot (patient, offline lab)
//   2 Services      — one or more items, each with teeth / material / shade /
//                     category extra (same catalogue + extras as the web form)
//   3 Delivery & notes — order type, delivery date, appointment, source, notes, files
//   4 Review
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, CheckCircle2, ChevronRight, ImagePlus, Paperclip, PlusCircle, Search, Star, Trash, Truck, UserPlus, X,
} from '../icons';
import { ME, useGo } from '../store';
import {
  CASE_SOURCES, CLINICIANS, LABS, LabCase, MATERIALS, PATIENTS, PRACTICES, PracticeId, RxItem, SERVICE_CATEGORIES, SERVICE_EXTRAS, SHADES,
  addLab, addPatient, allItems, clinicianName, fmtDate, labName, needsMaterial, nowIso, patientById, practiceName,
} from '../data';
import { Btn, Card, Chips, GoMark, Input, KV, Label, Pill, PickerField, Screen, SearchBox, Segmented, Sheet, TextArea, TopBar, cx } from '../ui';

// ─── Shared form model (also used by photo / audio capture) ─────────────────

export interface FormItem { uid: string; service: string; teeth: string[]; material: string | null; shade: string | null; extra: string[] }
export interface CaseForm {
  practice: PracticeId | null;
  clinician: string | null;
  patientId: string | null;
  lab: string | null;
  funding: 'NHS' | 'Private';
  returnBy: string;           // Delivery date (date only)
  apptDate: string;           // Patient appointment (date only, optional)
  apptKind: 'Fit' | 'Try-in' | 'Issue';
  caseSource: string | null;
  instructions: string;
  attachments: string[];
  items: FormItem[];
}

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let uidSeq = 0;
export const newItem = (service: string, patch: Partial<FormItem> = {}): FormItem =>
  ({ uid: `it-${++uidSeq}`, service, teeth: [], material: null, shade: null, extra: [], ...patch });

export const emptyForm = (): CaseForm => ({
  practice: 'cds', clinician: 'reed', patientId: null, lab: null, funding: 'NHS', returnBy: plusDays(14),
  apptDate: '', apptKind: 'Fit', caseSource: null, instructions: '', attachments: [], items: [],
});

export const itemComplete = (it: FormItem) =>
  !!it.teeth.length && (!needsMaterial(it.service) || (!!it.material && !!it.shade)) && (!SERVICE_EXTRAS[it.service] || !!it.extra.length);
const extraText = (it: FormItem) => (it.extra.length && SERVICE_EXTRAS[it.service] ? `${SERVICE_EXTRAS[it.service].label}: ${it.extra.join(', ')}` : undefined);
export const itemLine = (it: { material?: string | null; shade?: string | null; extra?: string }) =>
  [it.material, it.shade && `shade ${it.shade}`, it.extra].filter(Boolean).join(' · ');

export function buildCase(f: CaseForm, source: LabCase['source']): LabCase {
  const ret = new Date(f.returnBy); ret.setHours(12, 0, 0, 0);
  const toRx = (it: FormItem): RxItem => ({ service: it.service, teeth: it.teeth, material: it.material ?? '', shade: it.shade ?? undefined, extra: extraText(it) });
  const [first, ...rest] = f.items.map(toRx);
  return {
    id: `SG-${28510 + Math.floor(Math.random() * 400)}`,
    patientId: f.patientId!, practice: f.practice!, lab: f.lab!, clinician: f.clinician!, createdBy: ME.name,
    service: first.service, teeth: first.teeth, material: first.material, shade: first.shade, extra: first.extra,
    items: rest.length ? rest : undefined,
    funding: f.funding, instructions: f.instructions || 'No extra instructions.', returnBy: ret.toISOString(), stage: 'ready',
    attachments: f.attachments, source, caseSource: f.caseSource ?? undefined,
    events: [{ stage: 'authorised', at: nowIso(), by: clinicianName(f.clinician!) }], messages: [],
    appointment: f.apptDate ? { at: new Date(`${f.apptDate}T09:00`).toISOString(), kind: f.apptKind, room: 'Surgery 1' } : undefined,
  };
}

// ─── Tooth picker (UK Palmer-style notation: UR6, LL5…) ─────────────────────

const ARCHES = ['Upper arch', 'Lower arch', 'Both arches'] as const;
const QUADS = [
  { id: 'UR', label: 'Upper right', order: [8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'UL', label: 'Upper left', order: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 'LR', label: 'Lower right', order: [8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'LL', label: 'Lower left', order: [1, 2, 3, 4, 5, 6, 7, 8] },
] as const;

export function ToothPicker({ value, onChange, invalid }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean }) {
  const [quad, setQuad] = useState<(typeof QUADS)[number]['id']>('UR');
  const q = QUADS.find(x => x.id === quad)!;
  const isArch = value.some(v => (ARCHES as readonly string[]).includes(v));
  const toggle = (t: string) => {
    const base = value.filter(v => !(ARCHES as readonly string[]).includes(v));
    onChange(base.includes(t) ? base.filter(x => x !== t) : [...base, t]);
  };
  return (
    <div className={cx('rounded-[22px] border p-3.5 bg-go-surface', invalid ? 'border-go-warn ring-4 ring-go-warn/15' : 'border-go-line')}>
      <Chips options={ARCHES} value={isArch ? value[0] : null} onChange={(a: string) => onChange(value[0] === a ? [] : [a])} />
      <div className="flex items-center gap-2 my-3"><span className="h-px flex-1 bg-go-line" /><span className="text-[11px] text-go-faint">or individual teeth</span><span className="h-px flex-1 bg-go-line" /></div>
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-go-raised">
        {QUADS.map(x => {
          const n = value.filter(v => v.startsWith(x.id)).length;
          return (
            <button key={x.id} onClick={() => setQuad(x.id)} className={cx('h-9 rounded-xl text-[12.5px] font-semibold relative transition', quad === x.id ? 'bg-go-surface text-go-ink go-card-shadow' : 'text-go-muted')}>
              {x.id}{n > 0 && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-go-brand" />}
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-go-muted text-center mt-2.5">{q.label} · {q.order[0] === 8 ? 'back → front' : 'front → back'}</p>
      <div className="grid grid-cols-8 gap-1.5 mt-2">
        {q.order.map(n => {
          const t = `${q.id}${n}`;
          const on = value.includes(t);
          return (
            <button key={t} onClick={() => toggle(t)} aria-pressed={on} aria-label={t}
              className={cx('aspect-[3/4] rounded-xl text-[14px] font-bold transition flex items-center justify-center',
                on ? 'go-grad text-white go-glow' : 'bg-go-raised text-go-ink2 border border-go-line')}>
              {n}
            </button>
          );
        })}
      </div>
      {!!value.length && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-go-line">
          <span className="text-[12px] text-go-muted mr-1 self-center">Selected</span>
          {value.map(t => (
            <button key={t} onClick={() => onChange(value.filter(x => x !== t))} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-go-brand-soft text-go-brand-ink text-[12px] font-semibold">
              {t}<X className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Patient: search existing or create on the spot ─────────────────────────

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

export function PatientPicker({ value, onChange, invalid }: { value: string | null; onChange: (id: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [np, setNp] = useState({ name: '', id: '', dob: '', phone: '', email: '', gender: '' });
  const [, force] = useState(0);
  const p = value ? patientById(value) : null;
  // Same as the web: match on name or patient ID
  const hits = PATIENTS.filter(x => `${x.name} ${x.id}`.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = PATIENTS.some(x => x.name.toLowerCase() === q.trim().toLowerCase());
  const close = () => { setOpen(false); setCreating(false); setQ(''); };
  const startCreate = () => { setNp({ name: q.trim(), id: '', dob: '', phone: '', email: '', gender: '' }); setCreating(true); };
  const create = () => {
    const dob = np.dob ? new Date(np.dob).toLocaleDateString('en-GB') : '—';
    const id = addPatient({ name: np.name.trim(), id: np.id.trim() || undefined, dob, phone: np.phone || undefined, email: np.email || undefined, gender: np.gender || undefined });
    onChange(id); force(n => n + 1); close();
  };

  return (
    <div>
      <Label>Patient</Label>
      <button type="button" onClick={() => setOpen(true)}
        className={cx('w-full min-h-[52px] rounded-2xl bg-go-surface border px-3 py-2 flex items-center gap-3 text-left transition',
          invalid ? 'border-go-warn ring-4 ring-go-warn/15' : 'border-go-line')}>
        {p ? (
          <>
            <span className="w-9 h-9 rounded-full go-grad text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{p.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5"><span className="text-[15px] font-semibold text-go-ink truncate">{p.name}</span>{p.isNew && <Pill tone="brand" className="!h-5 !px-2">New</Pill>}</span>
              <span className="block text-[12px] text-go-muted">{p.id} · DOB {p.dob}</span>
            </span>
          </>
        ) : (
          <>
            <Search className="w-[18px] h-[18px] text-go-muted ml-1" />
            <span className="flex-1 text-[15px] text-go-faint">Search name or patient ID</span>
          </>
        )}
        <ChevronRight className="w-[18px] h-[18px] text-go-muted" />
      </button>

      <Sheet open={open} onClose={close} tall title={creating ? 'New patient' : 'Patient'}
        sub={creating ? 'Only the name is required. Add what you have.' : 'Search existing, or type a new name to create them.'}
        footer={creating ? (
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setCreating(false)}>Back</Btn>
            <Btn block disabled={!np.name.trim()} onClick={create} icon={<UserPlus className="w-[18px] h-[18px]" />}>Add patient</Btn>
          </div>
        ) : undefined}>
        {!creating ? (
          <>
            <div className="sticky top-0 bg-go-surface pb-3 z-10"><SearchBox value={q} onChange={setQ} placeholder="Name or patient ID" /></div>
            {q.trim() && !exact && (
              <button onClick={startCreate} className="w-full flex items-center gap-3 p-3 mb-2 rounded-2xl border border-dashed border-go-brand/50 bg-go-brand-soft text-left">
                <span className="w-9 h-9 rounded-full go-grad text-white flex items-center justify-center flex-shrink-0"><UserPlus className="w-[18px] h-[18px]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-go-brand-ink truncate">Add “{q.trim()}” as a new patient</span>
                  <span className="block text-[12px] text-go-muted">Created with this case</span>
                </span>
              </button>
            )}
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted px-1 mb-1">Existing patients · {hits.length}</p>
            <div className="space-y-1">
              {hits.map(x => (
                <button key={x.id} onClick={() => { onChange(x.id); close(); }}
                  className={cx('w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition', x.id === value ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
                  <span className="w-9 h-9 rounded-full bg-go-raised border border-go-line text-go-ink2 text-[12px] font-bold flex items-center justify-center flex-shrink-0">{x.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-medium text-go-ink truncate">{x.name}</span>
                    <span className="block text-[12px] text-go-muted">{x.id} · DOB {x.dob}</span>
                  </span>
                  {x.id === value && <Check className="w-5 h-5 text-go-brand" />}
                </button>
              ))}
              {!hits.length && <p className="text-center text-[13px] text-go-muted py-6">No patients match. Add them as new above.</p>}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div><Label>Full name</Label><Input value={np.name} onChange={e => setNp(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Grace Mitchell" /></div>
            <div className="flex gap-3">
              <div className="flex-1"><Label optional>Patient ID</Label><Input value={np.id} onChange={e => setNp(s => ({ ...s, id: e.target.value }))} placeholder="PAT-2026-0118" /></div>
              <div className="flex-1"><Label optional>Date of birth</Label><Input type="date" value={np.dob} onChange={e => setNp(s => ({ ...s, dob: e.target.value }))} /></div>
            </div>
            <div><Label optional>Phone</Label><Input type="tel" value={np.phone} onChange={e => setNp(s => ({ ...s, phone: e.target.value }))} placeholder="+44 7700 900123" /></div>
            <div><Label optional>Email</Label><Input type="email" value={np.email} onChange={e => setNp(s => ({ ...s, email: e.target.value }))} placeholder="name@example.com" /></div>
            <div><Label optional>Gender</Label><Chips options={GENDERS} value={np.gender || null} onChange={(v: string) => setNp(s => ({ ...s, gender: v }))} /></div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

// ─── Lab: search, favourites, or add an offline lab on the spot ─────────────

export function LabPicker({ value, onChange, invalid }: { value: string | null; onChange: (id: string) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'fav'>('all');
  const [favs, setFavs] = useState<string[]>(['northstar']);
  const [creating, setCreating] = useState(false);
  const [nl, setNl] = useState({ name: '', town: '', email: '', phone: '' });
  const lab = value ? LABS.find(l => l.id === value) : null;
  const term = q.trim().toLowerCase();
  const hits = LABS.filter(l => (tab === 'all' || favs.includes(l.id)) && `${l.name} ${l.town}`.toLowerCase().includes(term));
  const exact = LABS.some(l => l.name.toLowerCase() === term);
  const close = () => { setOpen(false); setCreating(false); setQ(''); };
  const create = () => { const id = addLab({ name: nl.name.trim(), town: nl.town.trim() || '—', email: nl.email || undefined, phone: nl.phone || undefined }); onChange(id); close(); };

  return (
    <div>
      <Label>Dental laboratory</Label>
      <button type="button" onClick={() => setOpen(true)}
        className={cx('w-full min-h-[52px] rounded-2xl bg-go-surface border px-3 py-2 flex items-center gap-3 text-left transition',
          invalid ? 'border-go-warn ring-4 ring-go-warn/15' : 'border-go-line')}>
        {lab ? (
          <>
            <span className="w-9 h-9 rounded-xl bg-go-violet-soft text-go-violet text-[12px] font-bold flex items-center justify-center flex-shrink-0">{lab.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5"><span className="text-[15px] font-semibold text-go-ink truncate">{lab.name}</span>{lab.offline && <Pill tone="warn" className="!h-5 !px-2">Offline</Pill>}</span>
              <span className="block text-[12px] text-go-muted">{lab.town}</span>
            </span>
          </>
        ) : (
          <>
            <Search className="w-[18px] h-[18px] text-go-muted ml-1" />
            <span className="flex-1 text-[15px] text-go-faint">Search or pick a lab</span>
          </>
        )}
        <ChevronRight className="w-[18px] h-[18px] text-go-muted" />
      </button>

      <Sheet open={open} onClose={close} tall title={creating ? 'Add a lab' : 'Dental laboratory'}
        sub={creating ? 'Added as an offline lab. They get the case by email.' : 'Search by name or town.'}
        footer={creating ? (
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setCreating(false)}>Back</Btn>
            <Btn block disabled={!nl.name.trim()} onClick={create} icon={<PlusCircle className="w-[18px] h-[18px]" />}>Add lab</Btn>
          </div>
        ) : undefined}>
        {!creating ? (
          <>
            <div className="sticky top-0 bg-go-surface pb-3 z-10 space-y-2">
              <SearchBox value={q} onChange={setQ} placeholder="Lab name or town" />
              <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All labs', count: LABS.length }, { value: 'fav', label: 'Favourites', count: favs.length }]} />
            </div>
            {term && !exact && (
              <button onClick={() => { setNl({ name: q.trim(), town: '', email: '', phone: '' }); setCreating(true); }}
                className="w-full flex items-center gap-3 p-3 mb-2 rounded-2xl border border-dashed border-go-brand/50 bg-go-brand-soft text-left">
                <span className="w-9 h-9 rounded-xl go-grad text-white flex items-center justify-center flex-shrink-0"><PlusCircle className="w-[18px] h-[18px]" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-go-brand-ink truncate">Add “{q.trim()}” as a new lab</span>
                  <span className="block text-[12px] text-go-muted">Not on Smile Genius yet</span>
                </span>
              </button>
            )}
            <div className="space-y-1">
              {hits.map(l => {
                const fav = favs.includes(l.id);
                return (
                  <div key={l.id} className={cx('flex items-center gap-3 px-3 py-2.5 rounded-2xl transition', l.id === value ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
                    <button onClick={() => { onChange(l.id); close(); }} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                      <span className="w-9 h-9 rounded-xl bg-go-violet-soft text-go-violet text-[12px] font-bold flex items-center justify-center flex-shrink-0">{l.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5"><span className="text-[14.5px] font-medium text-go-ink truncate">{l.name}</span>{l.offline && <Pill tone="warn" className="!h-5 !px-2">Offline</Pill>}</span>
                        <span className="block text-[12px] text-go-muted">{l.town}</span>
                      </span>
                    </button>
                    <button onClick={() => setFavs(f => (fav ? f.filter(x => x !== l.id) : [...f, l.id]))} aria-label={fav ? 'Remove favourite' : 'Add favourite'}
                      className={cx('w-9 h-9 rounded-full flex items-center justify-center', fav ? 'text-go-warn' : 'text-go-line')}>
                      <Star className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
              {!hits.length && <p className="text-center text-[13px] text-go-muted py-6">{tab === 'fav' ? 'No favourites yet. Tap the star on a lab.' : 'No labs match. Add it as new above.'}</p>}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div><Label>Lab name</Label><Input value={nl.name} onChange={e => setNl(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Westport Denture Works" /></div>
            <div><Label optional>Town</Label><Input value={nl.town} onChange={e => setNl(s => ({ ...s, town: e.target.value }))} placeholder="e.g. Bristol" /></div>
            <div><Label optional>Email</Label><Input type="email" value={nl.email} onChange={e => setNl(s => ({ ...s, email: e.target.value }))} placeholder="cases@lab.co.uk" /></div>
            <div><Label optional>Phone</Label><Input type="tel" value={nl.phone} onChange={e => setNl(s => ({ ...s, phone: e.target.value }))} placeholder="+44 117 496 0000" /></div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

// ─── Service editor sheet (pick a service, then its details) ────────────────

export function ServiceSheet({ open, item, onSave, onClose }: { open: boolean; item: FormItem | null; onSave: (it: FormItem) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<FormItem | null>(item);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) setDraft(item); } // reset on open
  const set = (patch: Partial<FormItem>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const extra = draft ? SERVICE_EXTRAS[draft.service] : undefined;

  return (
    <Sheet open={open} onClose={onClose} tall title={draft ? draft.service : 'Add a service'} sub={draft ? 'Teeth, material and shade for this item.' : 'Pick from the catalogue.'}
      footer={draft ? (
        <div className="flex gap-2">
          {!item && <Btn variant="secondary" onClick={() => setDraft(null)}>Change</Btn>}
          <Btn block disabled={!itemComplete(draft)} onClick={() => onSave(draft)}>{itemComplete(draft) ? 'Save service' : 'Add the missing details'}</Btn>
        </div>
      ) : undefined}>
      {!draft ? (
        <div className="space-y-4">
          {SERVICE_CATEGORIES.map(cat => (
            <div key={cat.id}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mb-2">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map(s => (
                  <button key={s} onClick={() => setDraft(newItem(s))}
                    className="h-10 px-3.5 rounded-full text-[13.5px] font-medium border border-go-line bg-go-surface text-go-ink hover:border-go-brand/50 transition">{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div><Label>Teeth or arch</Label><ToothPicker value={draft.teeth} onChange={v => set({ teeth: v })} /></div>
          {needsMaterial(draft.service) && (
            <>
              <div><Label>Material</Label><Chips options={MATERIALS} value={draft.material} onChange={(v: string) => set({ material: v })} /></div>
              <div><Label>Shade (VITA classical)</Label><Chips options={SHADES} value={draft.shade} onChange={(v: string) => set({ shade: v })} /></div>
            </>
          )}
          {extra && (
            <div>
              <Label>{extra.label}</Label>
              {extra.multi
                ? <Chips options={extra.options} value={draft.extra} onChange={(v: string[]) => set({ extra: v })} multi />
                : <Chips options={extra.options} value={draft.extra[0] ?? null} onChange={(v: string) => set({ extra: [v] })} />}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ─── Success ────────────────────────────────────────────────────────────────

export function CaseCreated({ c }: { c: LabCase }) {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="relative flex flex-col items-center text-center px-6 pt-16">
        <div className="absolute top-0 w-80 h-80 rounded-full bg-go-brand/20 blur-3xl" />
        <div className="relative go-rise"><GoMark size={84} /></div>
        <span className="relative mt-6 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-go-ok-soft text-go-ok text-[12px] font-semibold"><CheckCircle2 className="w-4 h-4" />Prescription authorised</span>
        <h1 className="relative text-[26px] font-bold text-go-ink tracking-tight mt-3">Lab work created</h1>
        <p className="relative text-[14px] text-go-muted mt-1.5 leading-relaxed">
          <span className="font-mono font-semibold text-go-ink">{c.id}</span> is ready to dispatch to {labName(c.lab)}.
        </p>
      </div>
      <div className="px-4 mt-8">
        <Card className="px-4 py-1">
          <KV rows={[
            ['Patient', patientById(c.patientId).name],
            ...allItems(c).map((it, i, all) => [all.length > 1 ? `Item ${i + 1}` : 'Service', `${it.service} · ${it.teeth.join(', ')}`] as [string, string]),
            ['Delivery date', fmtDate(c.returnBy)],
          ]} />
        </Card>
      </div>
      <div className="px-4 mt-6 space-y-2.5">
        <Btn block icon={<Truck className="w-5 h-5" />} onClick={() => navigate(`/go/work/${c.id}/dispatch`, { replace: true })}>Print label & dispatch</Btn>
        <Btn block variant="secondary" onClick={() => navigate(`/go/work/${c.id}`, { replace: true })}>View lab work</Btn>
        <Btn block variant="ghost" size="md" onClick={() => navigate('/go/home', { replace: true })}>Back to home</Btn>
      </div>
      <p className="text-center text-[12px] text-go-faint mt-4">Demo only. Nothing is sent to a laboratory.</p>
    </Screen>
  );
}

// ─── Manual create ──────────────────────────────────────────────────────────

const STEPS = ['Patient & lab', 'Services', 'Delivery & notes', 'Review'];

export default function ManualCaseScreen() {
  const { addCase } = useGo();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<CaseForm>(emptyForm);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<LabCase | null>(null);
  const [svcOpen, setSvcOpen] = useState(false);
  const [editing, setEditing] = useState<FormItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof CaseForm>(k: K, v: CaseForm[K]) => setF(s => ({ ...s, [k]: v }));

  const okByStep = useMemo(() => [
    !!(f.practice && f.clinician && f.patientId && f.lab),
    f.items.length > 0 && f.items.every(itemComplete),
    !!f.returnBy,
    true,
  ], [f]);
  const ok = okByStep[step];
  const bad = (v: unknown) => tried && !v;

  const next = () => {
    if (!ok) { setTried(true); return; }
    setTried(false);
    if (step < 3) { setStep(step + 1); return; }
    const c = buildCase(f, 'manual');
    addCase(c);
    setCreated(c);
  };
  const saveItem = (it: FormItem) => {
    setF(s => ({ ...s, items: s.items.some(x => x.uid === it.uid) ? s.items.map(x => (x.uid === it.uid ? it : x)) : [...s.items, it] }));
    setSvcOpen(false);
  };

  if (created) return <CaseCreated c={created} />;
  const apptClash = f.apptDate && f.returnBy >= f.apptDate;

  return (
    <Screen
      header={
        <div>
          <TopBar back fallback="/go/home" title="Create a case" sub={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} />
          <div className="flex gap-1.5 px-4 pb-3 bg-go-bg/85 backdrop-blur-xl">
            {STEPS.map((s, i) => <span key={s} className={cx('h-1 flex-1 rounded-full transition', i <= step ? 'go-grad' : 'bg-go-line')} />)}
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2.5">
          {step > 0 && <Btn variant="secondary" onClick={() => { setStep(step - 1); setTried(false); }}>Back</Btn>}
          <Btn block onClick={next} icon={step === 3 ? <Check className="w-5 h-5" /> : undefined}>
            {step === 3 ? 'Authorise & create' : step === 1 && !f.items.length ? 'Add a service to continue' : 'Continue'}
          </Btn>
        </div>
      }>
      {tried && !ok && <p className="px-5 pt-1 pb-2 text-[13px] text-go-warn font-medium">Complete the highlighted details to continue.</p>}

      {step === 0 && (
        <div className="px-4 pt-2 space-y-5">
          <PatientPicker value={f.patientId} onChange={v => set('patientId', v)} invalid={bad(f.patientId)} />
          <LabPicker value={f.lab} onChange={v => set('lab', v)} invalid={bad(f.lab)} />
          <PickerField label="Dentist" value={f.clinician} onChange={v => set('clinician', v)} placeholder="Pick a dentist" invalid={bad(f.clinician)}
            options={CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `GDC ${c.gdc}` }))} />
          <PickerField label="Practice" value={f.practice} onChange={v => set('practice', v as PracticeId)} invalid={bad(f.practice)}
            options={PRACTICES.map(p => ({ value: p.id, label: p.name }))} />
        </div>
      )}

      {step === 1 && (
        <div className="px-4 pt-2">
          <div className="space-y-2.5">
            {f.items.map((it, i) => {
              const done = itemComplete(it);
              return (
                <Card key={it.uid} className={cx('p-3.5', tried && !done && 'border-go-warn ring-4 ring-go-warn/15')}>
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-lg go-grad text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <button onClick={() => { setEditing(it); setSvcOpen(true); }} className="flex-1 min-w-0 text-left">
                      <p className="text-[15px] font-semibold text-go-ink">{it.service} <span className="text-go-muted font-medium">{it.teeth.join(', ')}</span></p>
                      <p className={cx('text-[12px] mt-0.5', done ? 'text-go-muted' : 'text-go-warn')}>{done ? itemLine({ ...it, extra: extraText(it) }) || 'Ready' : 'Details missing. Tap to finish'}</p>
                    </button>
                    <button onClick={() => set('items', f.items.filter(x => x.uid !== it.uid))} aria-label={`Remove ${it.service}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-go-muted hover:text-go-bad hover:bg-go-bad-soft"><Trash className="w-4 h-4" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
          <button onClick={() => { setEditing(null); setSvcOpen(true); }}
            className={cx('w-full mt-3 h-14 rounded-[20px] border-2 border-dashed flex items-center justify-center gap-2 text-[14px] font-semibold transition',
              bad(f.items.length) ? 'border-go-warn text-go-warn' : 'border-go-line text-go-brand hover:border-go-brand/60')}>
            <PlusCircle className="w-5 h-5" />{f.items.length ? 'Add another service' : 'Add a service'}
          </button>
          {f.items.length > 1 && <p className="text-[12px] text-go-muted text-center mt-3">{f.items.length} services on one prescription · one delivery date</p>}
        </div>
      )}

      {step === 2 && (
        <div className="px-4 pt-2 space-y-5">
          <div><Label>Order type</Label><Segmented value={f.funding} onChange={v => set('funding', v)} options={[{ value: 'NHS', label: 'NHS' }, { value: 'Private', label: 'Private' }]} /></div>
          <div>
            <Label>Delivery date</Label>
            <Input type="date" value={f.returnBy} min={plusDays(1)} onChange={e => set('returnBy', e.target.value)} />
            <div className="flex gap-2 mt-2">
              {[7, 10, 14, 21].map(n => (
                <button key={n} onClick={() => set('returnBy', plusDays(n))}
                  className={cx('flex-1 h-9 rounded-xl text-[12.5px] font-semibold border transition', f.returnBy === plusDays(n) ? 'border-go-brand bg-go-brand-soft text-go-brand-ink' : 'border-go-line text-go-ink2')}>
                  +{n} days
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label optional>Patient appointment</Label>
            <div className="flex gap-2 items-center">
              <Input type="date" value={f.apptDate} onChange={e => set('apptDate', e.target.value)} className="flex-1" />
              {f.apptDate && <button onClick={() => set('apptDate', '')} aria-label="Clear appointment" className="w-10 h-10 rounded-full bg-go-raised text-go-muted flex items-center justify-center"><X className="w-4 h-4" /></button>}
            </div>
            {f.apptDate && <div className="mt-2"><Chips options={['Fit', 'Try-in', 'Issue'] as const} value={f.apptKind} onChange={v => set('apptKind', v)} /></div>}
            {apptClash && <p className="text-[12px] text-go-bad mt-2 px-1">Delivery is on or after the appointment. Pick an earlier delivery date.</p>}
          </div>
          <div><Label optional>Case source</Label><Chips options={CASE_SOURCES} value={f.caseSource} onChange={(v: string) => set('caseSource', v)} /></div>
          <div><Label optional>Case instructions</Label><TextArea rows={4} value={f.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Any specific instructions for the lab…" /></div>
          <div>
            <Label optional>Attachments</Label>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
              onChange={e => { set('attachments', [...f.attachments, ...Array.from(e.target.files ?? []).map(x => x.name)]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full h-20 rounded-[22px] border-2 border-dashed border-go-line hover:border-go-brand/60 text-go-muted flex flex-col items-center justify-center gap-1 transition">
              <ImagePlus className="w-6 h-6 text-go-brand" />
              <span className="text-[13px] font-semibold text-go-ink">Upload photos, x-rays or references</span>
            </button>
            {!!f.attachments.length && (
              <div className="mt-3 space-y-2">
                {f.attachments.map((a, i) => (
                  <div key={a + i} className="flex items-center gap-2.5 h-11 px-3.5 rounded-2xl bg-go-surface border border-go-line">
                    <Paperclip className="w-4 h-4 text-go-muted" /><span className="flex-1 truncate text-[13px] text-go-ink">{a}</span>
                    <button onClick={() => set('attachments', f.attachments.filter((_, j) => j !== i))} aria-label={`Remove ${a}`}><X className="w-4 h-4 text-go-muted" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="px-4 pt-2 space-y-3">
          <Card className="px-4 py-1">
            <div className="flex items-center justify-between pt-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Patient & lab</p><button onClick={() => setStep(0)} className="text-[12.5px] font-semibold text-go-brand">Edit</button></div>
            <KV rows={[
              ['Patient', `${patientById(f.patientId!).name}${patientById(f.patientId!).isNew ? ' (new)' : ''}`],
              ['Lab', labName(f.lab!)],
              ['Dentist', clinicianName(f.clinician!)],
              ['Practice', practiceName(f.practice!)],
            ]} />
          </Card>
          <Card className="px-4 py-1">
            <div className="flex items-center justify-between pt-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Services · {f.items.length}</p><button onClick={() => setStep(1)} className="text-[12.5px] font-semibold text-go-brand">Edit</button></div>
            <KV rows={f.items.map((it, i) => [`${i + 1}. ${it.service}`, <span key={it.uid}>{it.teeth.join(', ')}<span className="block text-[12px] text-go-muted font-normal">{itemLine({ ...it, extra: extraText(it) })}</span></span>] as [string, React.ReactNode])} />
          </Card>
          <Card className="px-4 py-1">
            <div className="flex items-center justify-between pt-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Delivery & notes</p><button onClick={() => setStep(2)} className="text-[12.5px] font-semibold text-go-brand">Edit</button></div>
            <KV rows={[
              ['Order type', f.funding],
              ['Delivery date', fmtDate(new Date(f.returnBy).toISOString())],
              ['Appointment', f.apptDate ? `${f.apptKind} · ${fmtDate(new Date(f.apptDate).toISOString())}` : 'Not booked'],
              ['Case source', f.caseSource ?? '—'],
              ['Attachments', f.attachments.length ? `${f.attachments.length} file${f.attachments.length > 1 ? 's' : ''}` : 'None'],
            ]} />
            {f.instructions && <p className="text-[13.5px] text-go-ink py-3 border-t border-go-line leading-relaxed">{f.instructions}</p>}
          </Card>
          <p className="px-1 text-[12px] text-go-muted leading-relaxed">
            Created by {ME.name} on behalf of {clinicianName(f.clinician!)} (GDC {CLINICIANS.find(c => c.id === f.clinician)!.gdc}), the prescribing dentist.
          </p>
        </div>
      )}

      <ServiceSheet open={svcOpen} item={editing} onSave={saveItem} onClose={() => setSvcOpen(false)} />
    </Screen>
  );
}
