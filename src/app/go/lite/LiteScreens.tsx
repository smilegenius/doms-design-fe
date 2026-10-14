// ─── Smile Genius Go · Light version ─────────────────────────────────────────
// The short flow: sign in → home → create (from a prescription photo, one page)
// → received → to dispatch (print label). No audio, no step-by-step form, no
// lab-work list, no invoices. Mounted at /go/lite/*.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Building2, Check, CheckCircle2, HelpCircle, ChevronDown, ChevronRight, FlaskConical, Home, ImageUp, LogOut, PackageCheck, Plus, PlusCircle, Printer, RotateCcw, Sparkles, Trash, Truck, User, X, Zap, ZapOff,
} from '../icons';
import { ME, useGo, useScoped } from '../store';
import {
  CLINICIANS, LabCase, clinicianName, practiceName, PRACTICES, PracticeId, SERVICE_CATEGORIES, caseTitle, fmtDate, initials, labName, patientById, serviceLabel, shortName,
} from '../data';
import { Btn, Card, EmptyState, GoMark, Input, Label, PickerField, Pill, Screen, SearchBox, Segmented, Sheet, TextArea, TopBar, cx, useBack } from '../ui';
import { CaseForm, FormItem, LabPicker, PatientPicker, ToothPicker, buildCase, emptyForm, newItem } from '../screens/ManualCase';
import { PaperRx } from '../screens/ReadSource';
import { PracticeSwitcher, StatusTiles } from '../screens/Home';
import { DispatchScreen, ReceiveSheet } from '../screens/Logistics';

export const LITE = '/go/lite';

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const iso = (d: string) => (d ? new Date(`${d}T12:00`).toISOString() : undefined);

// ─── Case row (To dispatch and Received) ────────────────────────────────────

function CaseRow({ c, onClick, right, action }: { c: LabCase; onClick?: () => void; right?: React.ReactNode; action?: React.ReactNode }) {
  const p = patientById(c.patientId);
  return (
    <Card onClick={onClick} className="p-3.5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-go-brand-soft text-go-brand-ink text-[12px] font-bold flex items-center justify-center flex-shrink-0">{initials(p.name)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-go-ink truncate">{p.name} <span className="font-mono text-[11.5px] text-go-faint font-medium">{c.id}</span></p>
          <p className="text-[12.5px] text-go-ink2 truncate">{caseTitle(c)}</p>
          <p className="text-[12px] text-go-muted truncate inline-flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5 text-go-violet flex-shrink-0" />{labName(c.lab)}{c.returnBy && ` · ${fmtDate(c.returnBy)}`}</p>
        </div>
        {right}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

// ─── Home ───────────────────────────────────────────────────────────────────

export function LiteHome() {
  const navigate = useNavigate();
  const { cases } = useScoped();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <Screen tabs>
      <div className="flex items-start justify-between gap-3 px-5 pt-3">
        <div className="min-w-0">
          <p className="text-[12.5px] text-go-muted">
            {greet}, <span className="font-semibold text-go-ink2">{ME.first}</span> · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <h1 className="mt-0.5"><PracticeSwitcher inline /></h1>
        </div>
        <button onClick={() => navigate(`${LITE}/account`)} aria-label="Me"
          className="go-grad text-white font-bold rounded-full w-10 h-10 flex items-center justify-center text-[13px] flex-shrink-0">{initials(ME.name)}</button>
      </div>

      <div className="px-4 mt-4">
        <button onClick={() => navigate(`${LITE}/new`)}
          className="go-rise relative w-full overflow-hidden text-left rounded-[24px] border border-go-brand/25 bg-gradient-to-br from-go-brand-soft via-go-surface to-go-violet-soft go-card-shadow p-4 flex items-center gap-3.5 active:scale-[.99] transition">
          <span className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-go-lav/30 blur-3xl" />
          <span className="relative w-12 h-12 rounded-[16px] go-grad go-glow text-white flex items-center justify-center flex-shrink-0"><Plus className="w-6 h-6" strokeWidth={2.5} /></span>
          <span className="relative flex-1 min-w-0">
            <span className="block text-[17px] font-bold text-go-ink tracking-tight leading-tight">Create lab work</span>
            <span className="block text-[12.5px] text-go-ink2 mt-0.5 leading-snug">Scan the prescription. We’ll fill in the details.</span>
          </span>
          <ChevronRight className="relative w-5 h-5 text-go-brand flex-shrink-0" />
        </button>
      </div>

      <div className="px-4 mt-3"><StatusTiles cases={cases} /></div>
    </Screen>
  );
}

// ─── Deliveries: to dispatch (print label) · arriving · received ───────────

type DeliveryTab = 'dispatch' | 'arriving' | 'received';

export function LiteDeliveries() {
  const navigate = useNavigate();
  const { cases } = useScoped();
  const [params, setParams] = useSearchParams();
  const tab = (['dispatch', 'arriving', 'received'].includes(params.get('tab') ?? '') ? params.get('tab') : 'dispatch') as DeliveryTab;
  const [target, setTarget] = useState<LabCase | null>(null);
  const toDispatch = cases.filter(c => c.stage === 'ready' && !c.onHold).sort((a, b) => (a.returnBy || '9').localeCompare(b.returnBy || '9'));
  const arriving = cases.filter(c => c.stage === 'shipped');
  const received = cases.filter(c => c.stage === 'received');
  const list = tab === 'dispatch' ? toDispatch : tab === 'arriving' ? arriving : received;
  const empty = {
    dispatch: { icon: <Truck className="w-7 h-7" />, title: 'Nothing to dispatch', body: 'New lab work you create will appear here, ready to print and send.' },
    arriving: { icon: <PackageCheck className="w-7 h-7" />, title: 'Nothing on its way', body: 'Work the lab has shipped will appear here.' },
    received: { icon: <PackageCheck className="w-7 h-7" />, title: 'Nothing received yet', body: 'Work you mark as received will appear here.' },
  }[tab];
  return (
    <Screen tabs header={<TopBar large title="Deliveries" />}>
      <div className="px-4">
        <Segmented value={tab} onChange={t => setParams(t === 'dispatch' ? {} : { tab: t }, { replace: true })}
          options={[{ value: 'dispatch', label: 'To dispatch', count: toDispatch.length }, { value: 'arriving', label: 'Arriving', count: arriving.length }, { value: 'received', label: 'Received', count: received.length }]} />
      </div>
      <div className="px-4 mt-3 space-y-2.5">
        {list.map(c => (
          <CaseRow key={c.id} c={c}
            onClick={tab === 'dispatch' ? () => navigate(`${LITE}/dispatch/${c.id}`) : undefined}
            right={tab === 'dispatch'
              ? <span className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-go-brand-soft text-go-brand-ink text-[12.5px] font-semibold flex-shrink-0"><Printer className="w-4 h-4" />Print</span>
              : tab === 'received' ? <Pill tone="ok" dot>Received</Pill> : undefined}
            action={tab === 'arriving' ? <Btn block size="md" icon={<PackageCheck className="w-4 h-4" />} onClick={() => setTarget(c)}>Mark as received</Btn> : undefined} />
        ))}
        {!list.length && <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />}
      </div>
      {target && <ReceiveSheet c={target} open onClose={() => setTarget(null)} />}
    </Screen>
  );
}

// ─── Dispatch wrapper (reuses the portal's label + courier screen) ──────────

export const LiteDispatch = () => <DispatchScreen list={`${LITE}/deliveries`} />;

// ─── Create: photo of the prescription, then ONE page ───────────────────────

interface Photo { url: string | null; name: string }

function Prescription({ photo, className }: { photo: Photo; className?: string }) {
  return photo.url
    ? <img src={photo.url} alt="Prescription" className={className} />
    : <PaperRx className={className} />;
}

function CameraView({ onShot }: { onShot: (p: Photo) => void }) {
  const back = useBack(`${LITE}/home`);
  const [flash, setFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="absolute inset-0 bg-[#05050B] text-white flex flex-col">
      <div className="flex items-center justify-between px-4 h-14">
        <button onClick={back} aria-label="Close camera" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <span className="text-[15px] font-semibold">Photograph the prescription</span>
        <button onClick={() => setFlash(f => !f)} aria-label="Turn the flash on or off" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          {flash ? <Zap className="w-5 h-5 text-[#FBBF24]" /> : <ZapOff className="w-5 h-5" />}
        </button>
      </div>
      <div className="relative flex-1 mx-5 my-2 rounded-[28px] overflow-hidden bg-gradient-to-b from-[#2B2B36] to-[#14141C]">
        <PaperRx className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[72%] rotate-[-4deg] drop-shadow-2xl opacity-95" />
        {['top-5 left-5 border-t-[3px] border-l-[3px] rounded-tl-2xl', 'top-5 right-5 border-t-[3px] border-r-[3px] rounded-tr-2xl',
          'bottom-5 left-5 border-b-[3px] border-l-[3px] rounded-bl-2xl', 'bottom-5 right-5 border-b-[3px] border-r-[3px] rounded-br-2xl'].map(p => (
          <span key={p} className={cx('absolute w-10 h-10 border-[#7FB0FF]', p)} />
        ))}
      </div>
      <p className="text-center text-[12.5px] text-white/70 px-10 leading-relaxed">Lay the whole prescription flat in good light.</p>
      <div className="flex items-center justify-between px-10 pt-5 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onShot({ url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null, name: f.name });
            e.target.value = '';
          }} />
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 text-[11px] text-white/80">
          <span className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><ImageUp className="w-5 h-5" /></span>Upload
        </button>
        <button onClick={() => onShot({ url: null, name: 'Prescription photo' })} aria-label="Take photo" className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition">
          <span className="w-[60px] h-[60px] rounded-full bg-white" />
        </button>
        <span className="w-12 text-center text-[11px] text-white/60 leading-tight">JPG, PNG<br />or PDF</span>
      </div>
    </div>
  );
}

/** Full-size view of the prescription. Tap the page to zoom in and out. */
function PhotoViewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { sheetRoot } = useGo();
  const [zoom, setZoom] = useState(false);
  if (!sheetRoot) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Prescription photo" className="absolute inset-0 z-50 bg-[#05050B] text-white flex flex-col go-fade-in sm:pt-[50px]">
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0">
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <span className="text-[15px] font-semibold">Prescription</span>
        <span className="w-10" />
      </div>
      <div className="flex-1 min-h-0 overflow-auto go-scroll">
        <button onClick={() => setZoom(z => !z)} aria-label={zoom ? 'Zoom out' : 'Zoom in'} className="block mx-auto p-4" style={{ width: zoom ? '240%' : '100%' }}>
          <Prescription photo={photo} className="w-full h-auto rounded-xl bg-white" />
        </button>
      </div>
      <p className="text-center text-[12px] text-white/60 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">Tap the page to {zoom ? 'zoom out' : 'zoom in'}</p>
    </div>,
    sheetRoot,
  );
}

interface Block { uid: string; itemId: string | null; teeth: string[]; returnBy: string; /** What the prescription actually says, when the app had to guess the service. */ written?: string }
let blockSeq = 0;
const newBlock = (): Block => ({ uid: `b${++blockSeq}`, itemId: null, teeth: [], returnBy: plusDays(14) });

const SERVICE_OPTIONS = SERVICE_CATEGORIES.flatMap(cat => cat.items.map(s => ({ value: s.id, label: s.label, sub: cat.label })));

/** What the scan found on the prescription.
 *  clean = everything read · partial = some details missing · multi = several services detected ·
 *  memory = names written differently from our records (the app asks, and can remember the answer). */
export type RxScenario = 'clean' | 'partial' | 'multi' | 'memory';
interface Read {
  practice: PracticeId | null; clinician: string | null; lab: string | null; patientId: string | null; blocks: Block[]; instructions: string;
  /** What the prescription says for a practice / dentist / lab it only partly matched. */
  written: Partial<Record<'practice' | 'dentist' | 'lab', string>>;
}

// What the app has been taught: "Dr Hannah" = Dr Hannah Lee. Kept on this device; the AI reads it next time.
const MEMORY_KEY = 'sg-go-lite-memory';
type MemKind = 'practice' | 'dentist' | 'lab' | 'service';
const memKey = (k: MemKind, text: string) => `${k}:${text.trim().toLowerCase()}`;
const readMemory = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}'); } catch { return {}; } };
const remember = (k: MemKind, text: string, id: string) => { try { localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...readMemory(), [memKey(k, text)]: id })); } catch { /* private mode */ } };
const forgetAll = () => { try { localStorage.removeItem(MEMORY_KEY); } catch { /* ignore */ } };
const blockOf = (itemId: string | null, teeth: string[], days: number): Block => ({ uid: `b${++blockSeq}`, itemId, teeth, returnBy: days ? plusDays(days) : '' });
const readPrescription = (rx: RxScenario): Read => rx === 'partial'
  ? {
    // Handwriting unclear: no dentist, lab or patient, and no teeth or date
    practice: 'cds', clinician: null, lab: null, patientId: null, instructions: '', written: {},
    blocks: [blockOf('su-crown', [], 0)],
  }
  : rx === 'memory'
  ? {
    // Everything found, but written differently from our records: "Dr Hannah" is Dr Hannah Lee in the database
    practice: 'cds', clinician: 'lee', lab: 'northstar', patientId: 'P-10231', instructions: 'Light contacts. Match adjacent LL4 shade.',
    written: { practice: 'Camden Dental', dentist: 'Dr Hannah', lab: 'Northstar' },
    blocks: [{ ...blockOf('su-crown', ['LL5'], 14), written: 'PFM crown' }, { ...blockOf('ap-night-guard', ['Upper arch'], 21), written: 'Night splint' }],
  }
  : {
    practice: 'cds', clinician: 'reed', lab: 'northstar', patientId: 'P-10231', instructions: 'Light contacts. Match adjacent LL4 shade.', written: {},
    blocks: rx === 'multi'
      ? [blockOf('su-crown', ['LL5'], 14), blockOf('br-pontic', ['LL6'], 14), blockOf('ap-night-guard', ['Upper arch'], 21), blockOf('or-clear-aligners', ['Both arches'], 28)]
      : [blockOf('su-crown', ['LL5'], 14)],
  };

/** Scanning screen: the prescription is read and the form is filled in. */
function Scanning({ photo, onDone }: { photo: Photo; onDone: () => void }) {
  const steps = ['Finding the prescription', 'Reading the handwriting', 'Finding the patient, dentist and lab'];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(x => x + 1), 650); return () => clearInterval(t); }, []);
  useEffect(() => { if (i >= steps.length) onDone(); }, [i, onDone, steps.length]);
  return (
    <Screen>
      <div className="flex flex-col items-center px-8 pt-16">
        <div className="relative w-40 h-52 rounded-xl overflow-hidden bg-white border border-go-line">
          <Prescription photo={photo} className="w-full h-full object-cover" />
          <span className="go-scanline absolute left-0 right-0 h-1 go-grad shadow-[0_0_20px_4px_rgba(77,142,247,.5)]" />
        </div>
        <p className="mt-8 inline-flex items-center gap-2 text-[17px] font-semibold text-go-ink"><Sparkles className="w-5 h-5 text-go-lav" />Reading the prescription…</p>
        <div className="mt-6 w-full space-y-3">
          {steps.map((s, k) => (
            <div key={s} className={cx('flex items-center gap-3 text-[14px] transition', k <= i ? 'text-go-ink' : 'text-go-faint')}>
              <span className={cx('w-6 h-6 rounded-full flex items-center justify-center', k < i ? 'go-grad text-white' : k === i ? 'border-2 border-go-brand' : 'border-2 border-go-line')}>
                {k < i ? <Check className="w-3.5 h-3.5" /> : k === i ? <span className="w-2 h-2 rounded-full bg-go-brand go-pulse" /> : null}
              </span>
              {s}
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

/** One line of a card: icon · label · value · tick (or warning) · arrow. Tap to change in a bottom sheet. */
function DetailRow({ icon, label, value, unsure, onClick }: { icon: React.ReactNode; label: string; value: string | null; unsure?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-1.5 text-left active:bg-go-raised transition">
      <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', value ? 'bg-go-brand-soft text-go-brand' : 'bg-go-warn-soft text-go-warn')}>{icon}</span>
      <span className="w-[58px] text-[12px] text-go-muted flex-shrink-0">{label}</span>
      {value
        ? <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-go-ink">{value}</span>
        : <span className="flex-1 min-w-0 inline-flex items-center gap-1 text-[12.5px] font-medium text-go-warn"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />Not found</span>}
      {value && (unsure ? <HelpCircle className="w-[18px] h-[18px] text-go-warn flex-shrink-0" aria-label="Please confirm" /> : <CheckCircle2 className="w-4 h-4 text-go-ok flex-shrink-0" />)}
      <ChevronRight className={cx('w-4 h-4 flex-shrink-0', value && !unsure ? 'text-go-faint' : 'text-go-warn')} />
    </button>
  );
}

/** "Dr Hannah" on the prescription, Dr Hannah Lee in our records: ask once, and offer to remember it. */
function ConfirmSheet({ info, onRemember, onOnce, onDifferent, onClose }: {
  info: { kind: string; written: string; matched: string } | null; onRemember: () => void; onOnce: () => void; onDifferent: () => void; onClose: () => void;
}) {
  if (!info) return null;
  return (
    <Sheet open onClose={onClose} title={`Is this the right ${info.kind}?`} sub="The prescription doesn’t match our records word for word."
      footer={(
        <div className="space-y-2">
          <Btn block icon={<Sparkles className="w-5 h-5" />} onClick={onRemember}>Yes, remember this</Btn>
          <Btn block variant="secondary" onClick={onOnce}>Yes, just this time</Btn>
          <Btn block variant="ghost" size="md" onClick={onDifferent}>It’s a different {info.kind}</Btn>
        </div>
      )}>
      <div className="space-y-2">
        <div className="rounded-2xl border border-go-line bg-go-surface px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">On the prescription</p>
          <p className="text-[17px] font-semibold text-go-ink mt-0.5">“{info.written}”</p>
        </div>
        <div className="rounded-2xl border border-go-brand/40 bg-go-brand-soft px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-brand-ink">We matched it to</p>
          <p className="text-[17px] font-semibold text-go-ink mt-0.5">{info.matched}</p>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-go-ink2 leading-relaxed">
        Remember this and next time “{info.written}” will be read as <span className="font-semibold">{info.matched}</span>. It also helps us choose better for you.
      </p>
    </Sheet>
  );
}

/** A short list in a bottom sheet (practice, dentist). */
function OptionSheet({ open, onClose, title, options, value, onChange }: {
  open: boolean; onClose: () => void; title: string; options: { value: string; label: string; sub?: string }[]; value: string | null; onChange: (v: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = options.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const close = () => { setQ(''); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="sticky top-0 bg-go-surface pb-3 z-10"><SearchBox value={q} onChange={setQ} placeholder={`Search ${title.toLowerCase()}`} /></div>
      <div className="space-y-1">
        {shown.map(o => (
          <button key={o.value} onClick={() => { onChange(o.value); close(); }}
            className={cx('w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition', o.value === value ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium text-go-ink">{o.label}</span>
              {o.sub && <span className="block text-[12px] text-go-muted mt-0.5">{o.sub}</span>}
            </span>
            {o.value === value && <Check className="w-5 h-5 text-go-brand" strokeWidth={2.5} />}
          </button>
        ))}
        {!shown.length && <p className="text-center text-[13px] text-go-muted py-8">Nothing found</p>}
      </div>
    </Sheet>
  );
}

const daysUntil = (d: string) => (d ? Math.round((new Date(`${d}T12:00`).getTime() - new Date().setHours(12, 0, 0, 0)) / 864e5) : null);
const shortDate = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Edit one service in a bottom sheet: type (searchable), teeth, delivery date or days. */
function ServiceEditSheet({ block, isNew, canRemove, onSave, onRemove, onClose }: {
  block: Block | null; isNew: boolean; canRemove: boolean; onSave: (b: Block) => void; onRemove: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Block | null>(block);
  const [last, setLast] = useState<Block | null>(null);
  if (block !== last) { setLast(block); setDraft(block); } // reset each time a different service is opened
  if (!block || !draft) return null;
  const set = (p: Partial<Block>) => setDraft(d => (d ? { ...d, ...p } : d));
  const days = daysUntil(draft.returnBy);
  return (
    <Sheet open onClose={onClose} tall title={isNew ? 'Add a service' : 'Edit service'} sub="Service type, teeth and delivery date."
      footer={(
        <div className="flex gap-2">
          {canRemove && !isNew && <Btn variant="secondary" className="!px-4" icon={<Trash className="w-5 h-5" />} onClick={onRemove}>Remove</Btn>}
          <Btn block disabled={!draft.itemId || !draft.returnBy} onClick={() => onSave(draft)}>{!draft.itemId ? 'Choose a service' : !draft.returnBy ? 'Choose a delivery date' : 'Save service'}</Btn>
        </div>
      )}>
      <div className="space-y-5">
        <PickerField label="Service type" value={draft.itemId} onChange={v => set({ itemId: v })} placeholder="Choose a service" searchable options={SERVICE_OPTIONS} />
        <div>
          <Label>Delivery date</Label>
          <div className="flex gap-2">
            <Input type="date" aria-label="Delivery date" value={draft.returnBy} min={plusDays(1)} onChange={e => set({ returnBy: e.target.value })} className="flex-1 min-w-0" />
            <label className="flex items-center gap-1.5 h-[52px] px-3 rounded-2xl bg-go-surface border border-go-line focus-within:border-go-brand focus-within:ring-4 focus-within:ring-go-brand/15 transition">
              <span className="text-[13px] text-go-muted">In</span>
              <input type="number" inputMode="numeric" min={1} max={365} aria-label="Delivery in how many days" placeholder="14"
                value={days !== null && days > 0 ? days : ''}
                onChange={e => { const v = parseInt(e.target.value, 10); set({ returnBy: v > 0 ? plusDays(Math.min(v, 365)) : '' }); }}
                className="w-10 bg-transparent outline-none text-[15px] text-go-ink text-center tabular-nums" />
              <span className="text-[13px] text-go-muted">days</span>
            </label>
          </div>
        </div>
        <div><Label optional>Teeth or arch</Label><ToothPicker value={draft.teeth} onChange={v => set({ teeth: v })} /></div>
      </div>
    </Sheet>
  );
}

type Edit = 'practice' | 'dentist' | 'lab' | 'patient';

export function LiteCreate() {
  const { addCase, toast } = useGo();
  const rxParam = new URLSearchParams(useLocation().search).get('rx');
  const rx: RxScenario = rxParam === 'partial' || rxParam === 'multi' || rxParam === 'memory' ? rxParam : 'clean';
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [scanned, setScanned] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [practice, setPractice] = useState<PracticeId | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(() => [newBlock()]);
  const [instructions, setInstructions] = useState('');
  const [lab, setLab] = useState<string | null>(null);
  const [clinician, setClinician] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [svc, setSvc] = useState<{ block: Block; isNew: boolean } | null>(null);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<LabCase | null>(null);
  // Names the scan only partly matched (key = practice | dentist | lab | a service's uid) and what the prescription says
  const [unsure, setUnsure] = useState<Set<string>>(new Set());
  const [written, setWritten] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const search = useLocation().search;

  const reset = () => { setCreated(null); setPhoto(null); setScanned(false); setEdit(null); setSvc(null); setTried(false); setConfirm(null); };
  const applyRead = () => {
    const r = readPrescription(rx);
    if (rx === 'memory' && new URLSearchParams(search).get('reset') === '1') forgetAll();
    const mem = readMemory();
    const w: Record<string, string> = {}; const guess = new Set<string>(); const known: string[] = [];
    const check = (key: string, kind: MemKind, text: string | undefined, id: string | null, label: string) => {
      if (!text || !id) return;
      w[key] = text;
      if (mem[memKey(kind, text)] === id) known.push(`“${text}” = ${label}`); else guess.add(key);
    };
    check('practice', 'practice', r.written.practice, r.practice, r.practice ? practiceName(r.practice) : '');
    check('dentist', 'dentist', r.written.dentist, r.clinician, r.clinician ? clinicianName(r.clinician) : '');
    check('lab', 'lab', r.written.lab, r.lab, r.lab ? labName(r.lab) : '');
    r.blocks.forEach(b => check(b.uid, 'service', b.written, b.itemId, b.itemId ? serviceLabel(b.itemId) : ''));
    setUnsure(guess); setWritten(w); setConfirm(null);
    setPractice(r.practice); setClinician(r.clinician); setLab(r.lab); setPatientId(r.patientId); setBlocks(r.blocks); setInstructions(r.instructions);
    setScanned(true);
    if (known.length) toast(`Read from what you taught us: ${known.join(', ')}`, 'info');
  };
  const doneScanning = useCallback(applyRead, [rx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (created) return <Created c={created} onAnother={reset} />;
  if (!photo) return <CameraView onShot={setPhoto} />;
  if (!scanned) return <Scanning photo={photo} onDone={doneScanning} />;

  const notFound = [!practice && 'practice', !clinician && 'dentist', !lab && 'lab', !patientId && 'patient', blocks.some(b => !b.itemId || !b.returnBy) && 'service'].filter(Boolean) as string[];

  const submit = () => {
    if (notFound.length) {
      setTried(true);
      const first = !practice ? 'practice' : !clinician ? 'dentist' : !lab ? 'lab' : !patientId ? 'patient' : null;
      if (first) setEdit(first); else setSvc({ block: blocks.find(b => !b.itemId || !b.returnBy)!, isNew: false });
      return;
    }
    const items: FormItem[] = blocks.map(b => newItem(b.itemId!, { teeth: b.teeth, returnBy: b.returnBy }));
    const form: CaseForm = { ...emptyForm(), practice, clinician, patientId, lab, instructions: instructions.trim(), caseSource: 'Photo of lab form', attachments: [photo.name], items };
    const built = buildCase(form, 'photo');
    // One delivery date per service. A denture would otherwise wait on stage dates the light form doesn't ask for.
    const dates = blocks.map(b => iso(b.returnBy));
    const c: LabCase = {
      ...built,
      firstReturnBy: dates[0], firstStaged: undefined, firstStages: undefined,
      items: built.items?.map((it, i) => ({ ...it, returnBy: dates[i + 1], staged: undefined, stages: undefined })),
      returnBy: dates.filter(Boolean).sort()[0] ?? '',
    };
    addCase(c);
    toast('Case created. Ready to dispatch');
    setCreated(c);
  };

  const saveService = (b: Block) => {
    if (blocks.find(x => x.uid === b.uid)?.itemId !== b.itemId) clearUnsure(b.uid); // a different service chosen: nothing left to confirm
    setBlocks(bs => (bs.some(x => x.uid === b.uid) ? bs.map(x => (x.uid === b.uid ? b : x)) : [...bs, b]));
    setSvc(null);
  };
  const clearUnsure = (key: string) => setUnsure(s => { const n = new Set(s); n.delete(key); return n; });
  const confirmBlock = blocks.find(b => b.uid === confirm);
  const confirmInfo = !confirm ? null
    : confirm === 'practice' && practice ? { kind: 'practice', matched: practiceName(practice), id: practice, mem: 'practice' as MemKind }
    : confirm === 'dentist' && clinician ? { kind: 'dentist', matched: clinicianName(clinician), id: clinician, mem: 'dentist' as MemKind }
    : confirm === 'lab' && lab ? { kind: 'lab', matched: labName(lab), id: lab, mem: 'lab' as MemKind }
    : confirmBlock?.itemId ? { kind: 'service', matched: serviceLabel(confirmBlock.itemId), id: confirmBlock.itemId, mem: 'service' as MemKind } : null;
  const settle = (rememberIt: boolean) => {
    if (!confirm || !confirmInfo) return;
    if (rememberIt) { remember(confirmInfo.mem, written[confirm], confirmInfo.id); toast(`Remembered: “${written[confirm]}” = ${confirmInfo.matched}`); }
    clearUnsure(confirm); setConfirm(null);
  };
  const differentOne = () => {
    const key = confirm; setConfirm(null);
    if (key === 'practice' || key === 'dentist' || key === 'lab') setEdit(key);
    else if (confirmBlock) setSvc({ block: confirmBlock, isNew: false });
  };
  const unclear = rx === 'partial' && (!patientId || !clinician || !lab);
  const patient = patientId ? patientById(patientId) : null;
  return (
    <Screen
      header={<TopBar back fallback={`${LITE}/home`} title="Create lab work" sub="From the prescription" />}
      footer={<Btn block icon={<CheckCircle2 className="w-5 h-5" />} onClick={submit}>Create case</Btn>}>
      {tried && notFound.length > 0
        ? <p className="px-5 pt-1 text-[13px] text-go-warn font-medium">Please fill in the highlighted details.</p>
        : unclear ? <p className="mx-4 mt-1 px-3 py-2 rounded-2xl bg-go-warn-soft text-[12.5px] text-go-warn font-medium">Some details weren’t clear on the prescription. Please check them.</p>
        : unsure.size > 0 && <p className="mx-4 mt-1 px-3 py-2 rounded-2xl bg-go-warn-soft text-[12.5px] text-go-warn font-medium">A few names don’t match exactly. Tap the ? to confirm them.</p>}
      <div className="px-4 pt-1.5 space-y-2.5">
        {/* The prescription: tap to view it full size */}
        <Card className="flex items-center gap-3 p-2">
          <button onClick={() => setViewing(true)} aria-label="View the prescription full size" className="flex-1 min-w-0 flex items-center gap-3 text-left">
            <span className="w-10 h-[52px] rounded-lg overflow-hidden border border-go-line bg-white flex-shrink-0 shadow-sm">
              <Prescription photo={photo} className="w-full h-full object-cover object-top" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-go-ink">Prescription</span>
              <span className="block text-[12px] text-go-muted">Tap to view full size</span>
            </span>
          </button>
          <button onClick={() => { setPhoto(null); setScanned(false); }} className="inline-flex items-center gap-1 h-8 px-3 mr-1 rounded-full bg-go-brand-soft text-go-brand-ink text-[12px] font-semibold flex-shrink-0">
            <RotateCcw className="w-3.5 h-3.5" />Retake
          </button>
        </Card>

        {/* Practice · dentist · lab · patient: one card. Tap a line to change it in a bottom sheet. */}
        <Card className="overflow-hidden py-0.5">
          <DetailRow icon={<Building2 className="w-4 h-4" />} label="Practice" value={practice ? practiceName(practice) : null} unsure={unsure.has('practice')} onClick={() => (unsure.has('practice') ? setConfirm('practice') : setEdit('practice'))} />
          <DetailRow icon={<User className="w-4 h-4" />} label="Dentist" value={clinician ? clinicianName(clinician) : null} unsure={unsure.has('dentist')} onClick={() => (unsure.has('dentist') ? setConfirm('dentist') : setEdit('dentist'))} />
          <DetailRow icon={<FlaskConical className="w-4 h-4" />} label="Lab" value={lab ? labName(lab) : null} unsure={unsure.has('lab')} onClick={() => (unsure.has('lab') ? setConfirm('lab') : setEdit('lab'))} />
          <DetailRow icon={patient ? <span className="text-[9.5px] font-bold">{initials(patient.name)}</span> : <User className="w-4 h-4" />} label="Patient"
            value={patient ? patient.name : null} onClick={() => setEdit('patient')} />
        </Card>

        {/* Services: one line each, name and delivery date. Tap to edit in a bottom sheet. */}
        <Card className="overflow-hidden py-0.5">
          <p className="px-4 pt-2 pb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Services{blocks.length > 1 ? ` · ${blocks.length}` : ''}</p>
          {blocks.map((b, i) => (
            <button key={b.uid} onClick={() => (unsure.has(b.uid) ? setConfirm(b.uid) : setSvc({ block: b, isNew: false }))} className="w-full flex items-center gap-3 px-4 py-2 text-left active:bg-go-raised transition">
              <span className={cx('w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center flex-shrink-0', b.itemId ? 'bg-go-brand-soft text-go-brand' : 'bg-go-warn-soft text-go-warn')}>{i + 1}</span>
              <span className="flex-1 min-w-0 truncate">
                {b.itemId
                  ? <><span className="text-[14px] font-semibold text-go-ink">{serviceLabel(b.itemId)}</span>{b.teeth.length > 0 && <span className="text-[12px] text-go-muted"> · {b.teeth.join(', ')}</span>}</>
                  : <span className="text-[14px] font-medium text-go-warn">Choose a service</span>}
              </span>
              <span className={cx('text-[12.5px] flex-shrink-0', b.returnBy ? 'text-go-ink2' : 'text-go-warn font-medium')}>{b.returnBy ? shortDate(b.returnBy) : 'No date'}</span>
              {b.itemId && b.returnBy && (unsure.has(b.uid) ? <HelpCircle className="w-[18px] h-[18px] text-go-warn flex-shrink-0" aria-label="Please confirm" /> : <CheckCircle2 className="w-4 h-4 text-go-ok flex-shrink-0" />)}
              <ChevronRight className={cx('w-4 h-4 flex-shrink-0', b.itemId && b.returnBy && !unsure.has(b.uid) ? 'text-go-faint' : 'text-go-warn')} />
            </button>
          ))}
          <div className="px-3 pt-1.5 pb-2.5">
            <Btn block size="md" variant="secondary" icon={<PlusCircle className="w-4 h-4 text-go-brand" />} onClick={() => setSvc({ block: newBlock(), isNew: true })}>Add another service</Btn>
          </div>
        </Card>

        <div><Label optional>Case instructions</Label><TextArea rows={2} className="!py-2" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Any specific instructions for the lab…" /></div>
      </div>

      {viewing && <PhotoViewer photo={photo} onClose={() => setViewing(false)} />}

      <OptionSheet open={edit === 'practice'} onClose={() => setEdit(null)} title="Practice" value={practice} onChange={v => { setPractice(v as PracticeId); clearUnsure('practice'); }}
        options={PRACTICES.map(p => ({ value: p.id, label: p.name, sub: p.area }))} />
      <OptionSheet open={edit === 'dentist'} onClose={() => setEdit(null)} title="Dentist" value={clinician} onChange={v => { setClinician(v); clearUnsure('dentist'); }}
        options={CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `GDC ${c.gdc}` }))} />
      <LabPicker bare value={lab} onChange={v => { setLab(v); clearUnsure('lab'); }} open={edit === 'lab'} onOpenChange={o => !o && setEdit(null)} />
      <PatientPicker bare value={patientId} onChange={setPatientId} open={edit === 'patient'} onOpenChange={o => !o && setEdit(null)} />
      <ConfirmSheet info={confirmInfo && confirm ? { kind: confirmInfo.kind, written: written[confirm], matched: confirmInfo.matched } : null}
        onRemember={() => settle(true)} onOnce={() => settle(false)} onDifferent={differentOne} onClose={() => setConfirm(null)} />
      <ServiceEditSheet block={svc?.block ?? null} isNew={svc?.isNew ?? false} canRemove={blocks.length > 1} onSave={saveService} onClose={() => setSvc(null)}
        onRemove={() => { setBlocks(bs => bs.filter(x => x.uid !== svc!.block.uid)); setSvc(null); }} />
    </Screen>
  );
}

function Created({ c, onAnother }: { c: LabCase; onAnother: () => void }) {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="relative flex flex-col items-center text-center px-6 pt-16">
        <div className="absolute top-0 w-80 h-80 rounded-full bg-go-brand/20 blur-3xl" />
        <div className="relative go-rise"><GoMark size={84} /></div>
        <span className="relative mt-6 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-go-ok-soft text-go-ok text-[12px] font-semibold"><CheckCircle2 className="w-4 h-4" />Case created</span>
        <h1 className="relative text-[26px] font-bold text-go-ink tracking-tight mt-3">Ready to dispatch</h1>
        <p className="relative text-[14px] text-go-muted mt-1.5 leading-relaxed">
          <span className="font-mono font-semibold text-go-ink">{c.id}</span> for {shortName(patientById(c.patientId).name)} is ready to send to {labName(c.lab)}.
        </p>
      </div>
      <div className="px-4 mt-8 space-y-2.5">
        <Btn block icon={<Printer className="w-5 h-5" />} onClick={() => navigate(`${LITE}/dispatch/${c.id}`, { replace: true })}>Print label and dispatch</Btn>
        <Btn block variant="secondary" icon={<Plus className="w-5 h-5" />} onClick={onAnother}>Create another</Btn>
        <Btn block variant="ghost" size="md" onClick={() => navigate(`${LITE}/home`, { replace: true })}>Back to home</Btn>
      </div>
      <p className="text-center text-[12px] text-go-faint mt-4">You can also send it later from To dispatch.</p>
    </Screen>
  );
}
