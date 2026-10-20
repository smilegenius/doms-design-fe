// ─── Smile Genius Go · Light version ─────────────────────────────────────────
// The short flow: sign in → home → create (from a prescription photo, one page)
// → received → to dispatch (print label). No audio, no step-by-step form, no
// lab-work list, no invoices. Mounted at /go/lite/*.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Bell, Building2, Check, CheckCircle2, HelpCircle, ChevronDown, ChevronRight, FlaskConical, Home, ImageUp, Link2, LogOut, PackageCheck, Plus, PlusCircle, Printer, RotateCcw, Sparkles, Trash, Truck, User, X, Zap, ZapOff,
} from '../icons';
import { ME, useGo, useScoped } from '../store';
import { LAB_BASE, LAB_ID, LAB_ME, LAB_NAME } from '../lab/labData';
import { DENTURE_STAGES, isDentureItem } from '../../data/dentureStages';
import {
  CLINICIANS, LabCase, StageLine, allItems, patchItemStages, clinicianName, practiceName, PRACTICES, PracticeId, SERVICE_CATEGORIES, caseTitle, fmtDate, initials, labName, patientById, serviceLabel, shortName, itemIdForLabel,
} from '../data';
import { Btn, Card, EmptyState, GoMark, Input, Label, PickerField, Pill, Screen, SearchBox, Segmented, Sheet, TeethChips, TextArea, Toggle, TopBar, cx, useBack } from '../ui';
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
  const unread = useGo().notices.some(n => !n.read);
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
        <button onClick={() => navigate(`${LITE}/notifications`)} aria-label="Notifications"
          className="relative w-10 h-10 rounded-full bg-go-surface border border-go-line flex items-center justify-center text-go-ink flex-shrink-0">
          <Bell className="w-5 h-5" />
          {unread && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-go-bad ring-2 ring-go-surface" />}
        </button>
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

/** A denture is ordered stage by stage: order it (with a delivery date), say it was done elsewhere, or leave it out. */
type StageMode = 'order' | 'elsewhere' | 'skip';
interface BStage { name: string; mode: StageMode; date: string }
interface Block { uid: string; itemId: string | null; teeth: string[]; returnBy: string; /** Denture only: what to do with each stage. */ stages?: BStage[]; /** What the prescription actually says, when the app had to guess the service. */ written?: string }
const isDenture = (b: Block) => !!b.itemId && isDentureItem(b.itemId);
const skipAll = (): BStage[] => DENTURE_STAGES.map(name => ({ name, mode: 'skip', date: '' }));
let blockSeq = 0;
const newBlock = (): Block => ({ uid: `b${++blockSeq}`, itemId: null, teeth: [], returnBy: plusDays(14) });

/** Stages the prescription asks for: a number = order it, delivered in that many days; 'elsewhere' = already done somewhere else. */
const dentureBlock = (itemId: string, teeth: string[], spec: Record<string, number | 'elsewhere'>): Block => ({
  uid: `b${++blockSeq}`, itemId, teeth, returnBy: '',
  stages: DENTURE_STAGES.map(name => { const v = spec[name]; return v === undefined ? { name, mode: 'skip' as const, date: '' } : v === 'elsewhere' ? { name, mode: 'elsewhere' as const, date: '' } : { name, mode: 'order' as const, date: plusDays(v) }; }),
});

/** A follow-up prescription: same patient, practice, dentist and denture service as a case already on the portal. */
interface FollowUp { c: LabCase; index: number; done: Set<string> }
function followUpOf(cases: LabCase[], who: { patientId: string | null; practice: string | null; clinician: string | null }, b: Block): FollowUp | null {
  if (!who.patientId || !who.practice || !who.clinician || !b.itemId || !isDenture(b)) return null;
  const name = serviceLabel(b.itemId).toLowerCase();
  for (const c of cases) {
    if (c.patientId !== who.patientId || c.practice !== who.practice || c.clinician !== who.clinician || c.stage === 'draft') continue;
    const index = allItems(c).findIndex(it => it.service.toLowerCase() === name && it.stages?.length);
    if (index >= 0) return { c, index, done: new Set(allItems(c)[index].stages!.map(x => x.name)) };
  }
  return null;
}
type StageKind = StageMode | 'matched';
/** What will happen to each stage: matched ones are already on the existing case and are never ordered twice. */
const stageView = (b: Block, m: FollowUp | null): { name: string; kind: StageKind; date: string }[] =>
  (b.stages ?? skipAll()).map(s => ({ name: s.name, date: s.date, kind: m?.done.has(s.name) ? 'matched' : s.mode }));
const stageProblem = (b: Block, m: FollowUp | null) => {
  const v = stageView(b, m);
  if (!v.some(s => s.kind === 'order')) return 'Choose a stage to order';
  return v.some(s => s.kind === 'order' && !s.date) ? 'Choose a delivery date' : null;
};
const incomplete = (b: Block, m: FollowUp | null) => !b.itemId || (isDenture(b) ? !!stageProblem(b, m) : !b.returnBy);
const stageLines = (b: Block): StageLine[] => stageView(b, null).filter(s => s.kind === 'order' || s.kind === 'elsewhere')
  .map(s => (s.kind === 'order' ? { name: s.name, date: iso(s.date)! } : { name: s.name, date: '', state: 'done-earlier' as const }));

const SERVICE_OPTIONS = SERVICE_CATEGORIES.flatMap(cat => cat.items.map(s => ({ value: s.id, label: s.label, sub: cat.label })));

/** What the scan found on the prescription.
 *  clean = everything read · partial = some details missing · multi = several services detected ·
 *  memory = names written differently from our records (the app asks, and can remember the answer). */
export type RxScenario = 'clean' | 'partial' | 'multi' | 'memory' | 'denture' | 'denture-match';
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
const readPrescription = (rx: RxScenario): Read => rx === 'denture'
  ? {
    // A full denture with its stages. The Special Tray was done at another lab, and no case here has it
    practice: 'cds', clinician: 'reed', lab: 'northstar', patientId: 'P-10231', instructions: 'Upper and lower. Patient wants a natural shade.', written: {},
    blocks: [dentureBlock('de-full-denture', ['Both arches'], { 'Special Tray': 'elsewhere', 'Bite Registration': 7, 'Try In': 14 })],
  }
  : rx === 'denture-match'
  ? {
    // The next stage of a denture already on the portal (SG-28488): earlier stages are found on that case
    practice: 'isc', clinician: 'okafor', lab: 'precision', patientId: 'P-10188', instructions: 'Final finish after the try-in.', written: {},
    blocks: [dentureBlock('de-full-denture', ['Both arches'], { 'Special Tray': 'elsewhere', 'Bite Registration': 'elsewhere', 'Try In': 'elsewhere', Finish: 10 })],
  }
  : rx === 'partial'
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

/** Top of a picker opened from "It's a different …": what the prescription says, and whether to remember the new choice. */
function RememberHeader({ kind, written, on, onChange }: { kind: string; written: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-3 rounded-2xl border border-go-line bg-go-raised p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">On the prescription</p>
      <p className="text-[16px] font-semibold text-go-ink mt-0.5">“{written}”</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex-1 min-w-0 text-[13px] text-go-ink2 leading-snug">Remember “{written}” as the {kind} I choose</span>
        <Toggle on={on} onChange={onChange} label={`Remember “${written}” as the ${kind} I choose`} />
      </div>
    </div>
  );
}

/** A short list in a bottom sheet (practice, dentist). */
function OptionSheet({ open, onClose, title, options, value, onChange, header }: {
  open: boolean; onClose: () => void; title: string; options: { value: string; label: string; sub?: string }[]; value: string | null; onChange: (v: string) => void; header?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const shown = options.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const close = () => { setQ(''); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={title}>
      {header}
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

/** Denture stages: order each one with its delivery date, or say it was done elsewhere. Stages found on the patient's case show as done. */
function StageEditor({ block, match, onChange }: { block: Block; match: FollowUp | null; onChange: (s: BStage[]) => void }) {
  const stages = block.stages ?? skipAll();
  // Tick a stage to order it. A date typed on one stage is copied to every stage after it, ticked or not.
  const toggle = (k: number) => onChange(stages.map((s, i) => {
    if (i !== k) return s;
    if (s.mode === 'order') return { ...s, mode: 'skip' };
    const before = stages.slice(0, k).reverse().find(x => x.date)?.date;
    return { ...s, mode: 'order', date: s.date || before || plusDays(14) };
  }));
  // A stage cannot be delivered before the ticked stage ahead of it. Stages done elsewhere need no date.
  const minFor = (k: number) => stages.slice(0, k).filter(x => x.mode === 'order' && x.date).map(x => x.date).concat(plusDays(1)).sort().pop()!;
  const setDate = (k: number, date: string) => { const d = date && date < minFor(k) ? minFor(k) : date; onChange(stages.map((s, i) => (i < k ? s : { ...s, date: d }))); };
  const elsewhere = (k: number) => onChange(stages.map((s, i) => (i === k ? { ...s, mode: s.mode === 'elsewhere' ? 'skip' : 'elsewhere' } : s)));
  return (
    <div>
      <Label>Stages to order</Label>
      {match && <p className="mb-2 rounded-xl bg-go-brand-soft px-3 py-2 text-[12.5px] text-go-brand-ink">Found on <span className="font-semibold">{match.c.id}</span>. New stages are added to that case.</p>}
      <div className="rounded-2xl border border-go-line bg-go-surface divide-y divide-go-line">
        {stages.map((s, k) => {
          const matched = match?.done.has(s.name);
          const on = !matched && s.mode === 'order';
          return (
            <div key={s.name} className="px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                {matched
                  ? <span className="w-6 h-6 rounded-lg bg-go-ok-soft text-go-ok flex items-center justify-center flex-shrink-0"><Check className="w-4 h-4" strokeWidth={3} /></span>
                  : <button type="button" role="checkbox" aria-checked={on} aria-label={`Order ${s.name}`} onClick={() => toggle(k)}
                    className={cx('w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition', on ? 'go-grad border-transparent text-white' : 'border-go-line bg-go-surface')}>
                    {on && <Check className="w-4 h-4" strokeWidth={3} />}
                  </button>}
                <span className={cx('flex-1 text-[14.5px] font-semibold', matched || s.mode === 'elsewhere' ? 'text-go-muted' : 'text-go-ink')}>{s.name}</span>
                {matched && <Pill tone="ok">Done · {match!.c.id}</Pill>}
                {!matched && !on && (
                  <button type="button" onClick={() => elsewhere(k)}
                    className={cx('h-7 px-2.5 rounded-full text-[11.5px] font-semibold transition', s.mode === 'elsewhere' ? 'bg-go-raised text-go-ink2 border border-go-line' : 'text-go-brand-ink')}>
                    {s.mode === 'elsewhere' ? 'Done elsewhere ✓' : 'Done elsewhere?'}
                  </button>
                )}
              </div>
              {on && (() => {
                const days = daysUntil(s.date);
                return (
                  <div className="mt-2 flex gap-2">
                    <Input type="date" aria-label={`${s.name} delivery date`} className="flex-1 min-w-0 !h-11" value={s.date} min={minFor(k)} onChange={e => setDate(k, e.target.value)} />
                    <label className="flex items-center gap-1.5 h-11 px-3 rounded-2xl bg-go-surface border border-go-line focus-within:border-go-brand focus-within:ring-4 focus-within:ring-go-brand/15 transition">
                      <span className="text-[13px] text-go-muted">In</span>
                      <input type="number" inputMode="numeric" min={1} max={365} aria-label={`${s.name} delivery in how many days`} placeholder="14"
                        value={days !== null && days > 0 ? days : ''}
                        onChange={e => { const v = parseInt(e.target.value, 10); setDate(k, v > 0 ? plusDays(Math.min(v, 365)) : ''); }}
                        className="w-10 bg-transparent outline-none text-[15px] text-go-ink text-center tabular-nums" />
                      <span className="text-[13px] text-go-muted">days</span>
                    </label>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Edit one service in a bottom sheet: type (searchable), teeth, delivery date or days. Dentures get a stage list instead of one date. */
function ServiceEditSheet({ block, isNew, canRemove, matchFor, onSave, onRemove, onClose, header }: {
  block: Block | null; isNew: boolean; canRemove: boolean; matchFor: (b: Block) => FollowUp | null; onSave: (b: Block) => void; onRemove: () => void; onClose: () => void; header?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<Block | null>(block);
  const [last, setLast] = useState<Block | null>(null);
  if (block !== last) { setLast(block); setDraft(block); } // reset each time a different service is opened
  if (!block || !draft) return null;
  const set = (p: Partial<Block>) => setDraft(d => (d ? { ...d, ...p } : d));
  const days = daysUntil(draft.returnBy);
  const denture = isDenture(draft);
  const match = matchFor(draft);
  const problem = denture ? stageProblem(draft, match) : !draft.returnBy ? 'Choose a delivery date' : null;
  return (
    <Sheet open onClose={onClose} tall title={isNew ? 'Add a service' : 'Edit service'} sub={denture ? 'Service type, arch and the stages to order.' : 'Service type, teeth and delivery date.'}
      footer={(
        <div className="flex gap-2">
          {canRemove && !isNew && <Btn variant="secondary" className="!px-4" icon={<Trash className="w-5 h-5" />} onClick={onRemove}>Remove</Btn>}
          <Btn block disabled={!draft.itemId || !!problem} onClick={() => onSave(draft)}>{!draft.itemId ? 'Choose a service' : problem ?? 'Save service'}</Btn>
        </div>
      )}>
      <div className="space-y-5">
        {header}
        <PickerField label="Service type" value={draft.itemId} onChange={v => set({ itemId: v, stages: isDentureItem(v) ? draft.stages ?? skipAll() : undefined })} placeholder="Choose a service" searchable options={SERVICE_OPTIONS} />
        {denture && <StageEditor block={draft} match={match} onChange={stages => set({ stages })} />}
        {!denture && <div>
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
        </div>}
        <div><Label optional>Teeth or arch</Label><ToothPicker value={draft.teeth} onChange={v => set({ teeth: v })} /></div>
      </div>
    </Sheet>
  );
}

type Edit = 'practice' | 'dentist' | 'lab' | 'patient';

/** labMode: the same prescription flow, used from the lab side (the lab is always Northstar, the case starts out accepted). */
export function LiteCreate({ labMode }: { labMode?: boolean } = {}) {
  const { addCase, updateCase, cases, toast } = useGo();
  const rxParam = new URLSearchParams(useLocation().search).get('rx');
  const rx: RxScenario = rxParam === 'partial' || rxParam === 'multi' || rxParam === 'memory' || rxParam === 'denture' || rxParam === 'denture-match' ? rxParam : 'clean';
  // Lab side: finishing a saved draft opens this same review page, already filled in
  const draftId = new URLSearchParams(useLocation().search).get('draft');
  const draftCase = labMode && draftId ? cases.find(c => c.id === draftId && c.labMade) : undefined;
  const [photo, setPhoto] = useState<Photo | null>(draftCase ? { url: null, name: 'Prescription' } : null);
  const [scanned, setScanned] = useState(!!draftCase);
  const [viewing, setViewing] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(draftCase?.patientId ?? null);
  const [practice, setPractice] = useState<PracticeId | null>(draftCase?.practice ?? null);
  const [blocks, setBlocks] = useState<Block[]>(() => (draftCase
    ? allItems(draftCase).map(it => ({ ...newBlock(), itemId: itemIdForLabel(it.service), teeth: it.teeth, returnBy: (it.returnBy ?? draftCase.returnBy ?? '').slice(0, 10) }))
    : [newBlock()]));
  const [instructions, setInstructions] = useState(draftCase?.instructions ?? '');
  const [lab, setLab] = useState<string | null>(labMode ? LAB_ID : null);
  const [clinician, setClinician] = useState<string | null>(draftCase?.clinician ?? null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [svc, setSvc] = useState<{ block: Block; isNew: boolean } | null>(null);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<{ c: LabCase; added?: string[] } | null>(null);
  // Names the scan only partly matched (key = practice | dentist | lab | a service's uid) and what the prescription says
  const [unsure, setUnsure] = useState<Set<string>>(new Set());
  const [written, setWritten] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  // Set when the user said "It's a different …": the picker then shows what the prescription says and offers to remember the choice
  const [fixing, setFixing] = useState<string | null>(null);
  const [rememberNext, setRememberNext] = useState(true);
  const search = useLocation().search;
  const navigate = useNavigate();

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
    if (!labMode) check('lab', 'lab', r.written.lab, r.lab, r.lab ? labName(r.lab) : '');
    r.blocks.forEach(b => check(b.uid, 'service', b.written, b.itemId, b.itemId ? serviceLabel(b.itemId) : ''));
    setUnsure(guess); setWritten(w); setConfirm(null);
    setPractice(r.practice); setClinician(r.clinician); setLab(labMode ? LAB_ID : r.lab); setPatientId(r.patientId); setBlocks(r.blocks); setInstructions(r.instructions);
    setScanned(true);
    if (known.length) toast(`Read from what you taught us: ${known.join(', ')}`, 'info');
  };
  const doneScanning = useCallback(applyRead, [rx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (created) return <Created c={created.c} added={created.added} onAnother={reset} labMode={labMode} />;
  if (!photo) return <CameraView onShot={setPhoto} />;
  if (!scanned) return <Scanning photo={photo} onDone={doneScanning} />;

  // A follow-up denture prescription is matched to the patient's existing case (one denture service only)
  const matchFor = (b: Block) => (labMode ? null : blocks.some(x => x.uid !== b.uid && isDenture(x)) ? null : followUpOf(cases, { patientId, practice, clinician }, b));
  const followUp = blocks.length === 1 ? matchFor(blocks[0]) : null;
  const notFound = [!practice && 'practice', !clinician && 'dentist', !lab && 'lab', !patientId && 'patient', blocks.some(b => incomplete(b, matchFor(b))) && 'service'].filter(Boolean) as string[];

  /** Lab side: the lab made this case itself. A draft only needs a patient. */
  const labOwn = (draft: boolean): Partial<LabCase> => ({
    createdBy: LAB_ME.name, labMade: true, labSeen: true, practice: practice ?? 'cds', clinician: clinician ?? 'reed',
    ...(draft ? { stage: 'draft' as const, events: [], attachments: [] } : { stage: 'at-lab' as const, labStatus: 'Accepted' as const, events: [{ stage: 'note' as const, at: new Date().toISOString(), by: LAB_ME.name, text: 'Case created by the lab' }] }),
  });
  const submit = (forceNew = false, asDraft = false) => {
    if (asDraft ? !patientId : (notFound.length || (forceNew && blocks.some(b => incomplete(b, null))))) {
      setTried(true);
      const first = !practice ? 'practice' : !clinician ? 'dentist' : !lab ? 'lab' : !patientId ? 'patient' : null;
      if (first) setEdit(first); else setSvc({ block: blocks.find(b => incomplete(b, forceNew ? null : matchFor(b)))!, isNew: false });
      return;
    }
    const items: FormItem[] = blocks.map(b => newItem(b.itemId!, { teeth: b.teeth, returnBy: b.returnBy }));
    const form: CaseForm = { ...emptyForm(), practice, clinician, patientId, lab, instructions: instructions.trim(), caseSource: 'Photo of lab form', attachments: [photo.name], items };
    const built = buildCase(form, 'photo');
    // A denture follow-up: the new stages go onto the case that already has the earlier ones
    const only = !forceNew && blocks.length === 1 ? matchFor(blocks[0]) : null;
    if (only) {
      const now = new Date().toISOString();
      const added = stageView(blocks[0], only).filter(s => s.kind === 'order' || s.kind === 'elsewhere')
        .map(s => (s.kind === 'order' ? { name: s.name, date: iso(s.date)!, orderedAt: now } : { name: s.name, date: '', state: 'done-earlier' as const }));
      const ordered = added.filter(s => !s.state).map(s => s.name);
      updateCase(only.c.id, x => ({
        ...patchItemStages(x, only.index, [...(allItems(x)[only.index].stages ?? []), ...added].sort((p, q) => DENTURE_STAGES.indexOf(p.name) - DENTURE_STAGES.indexOf(q.name))),
        events: [...x.events, { stage: 'note', at: now, by: ME.name, text: `Ordered ${ordered.join(', ')} · ${allItems(x)[only.index].service}` }],
      }));
      toast(`${ordered.join(', ')} added to ${only.c.id}`);
      setCreated({ c: only.c, added: ordered });
      return;
    }
    // One delivery date per service; a denture has a date per stage instead
    const per = blocks.map(b => (isDenture(b) ? { stages: stageLines(b), returnBy: undefined } : { stages: undefined, returnBy: iso(b.returnBy) }));
    const c: LabCase = {
      ...built,
      ...(labMode ? labOwn(asDraft) : {}),
      firstReturnBy: per[0].returnBy, firstStaged: per[0].stages ? 'stage' : undefined, firstStages: per[0].stages,
      items: built.items?.map((it, i) => ({ ...it, returnBy: per[i + 1].returnBy, staged: per[i + 1].stages ? 'stage' as const : undefined, stages: per[i + 1].stages })),
      returnBy: per.flatMap(p => (p.stages ? p.stages.filter(x => !x.state).map(x => x.date) : [p.returnBy ?? ''])).filter(Boolean).sort()[0] ?? '',
    };
    if (draftCase) updateCase(draftCase.id, { ...c, id: draftCase.id, createdAt: draftCase.createdAt }); else addCase(c);
    if (labMode && asDraft) { toast('Draft saved'); navigate(`${LAB_BASE}/cases?f=draft`, { replace: true }); return; }
    toast(labMode ? `Case created for ${LAB_NAME}` : 'Case created. Ready to dispatch');
    setCreated({ c });
  };

  const saveService = (b: Block) => {
    if (blocks.find(x => x.uid === b.uid)?.itemId !== b.itemId) { // a different service chosen: nothing left to confirm
      clearUnsure(b.uid);
      if (b.itemId) finishFix(b.uid, 'service', b.itemId, serviceLabel(b.itemId));
    }
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
  const closeEdit = () => { setEdit(null); setFixing(null); };
  /** A different practice / dentist / lab / service was chosen: remember what the prescription said, if asked to. */
  const finishFix = (key: string, kind: MemKind, id: string, label: string) => {
    if (fixing !== key) return;
    if (rememberNext && written[key]) { remember(kind, written[key], id); toast(`Remembered: “${written[key]}” = ${label}`); }
    setFixing(null);
  };
  const fixHeader = (key: string, kind: string) => (fixing === key && written[key]
    ? <RememberHeader kind={kind} written={written[key]} on={rememberNext} onChange={setRememberNext} /> : undefined);
  const differentOne = () => {
    const key = confirm; setConfirm(null);
    if (key) { setFixing(key); setRememberNext(true); }
    if (key === 'practice' || key === 'dentist' || key === 'lab') setEdit(key);
    else if (confirmBlock) setSvc({ block: confirmBlock, isNew: false });
  };
  const unclear = rx === 'partial' && (!patientId || !clinician || !lab);
  const patient = patientId ? patientById(patientId) : null;
  return (
    <Screen
      header={<TopBar back fallback={`${labMode ? LAB_BASE : LITE}/home`} title={labMode ? 'Create a case' : 'Create lab work'} sub="From the prescription" />}
      footer={followUp
        // The earlier stages are already on a case: adding to it is the main action, a separate case is the alternative
        ? <div className="flex gap-2"><Btn variant="secondary" className="!px-4 whitespace-nowrap" onClick={() => submit(true)}>Create new</Btn><Btn block icon={<CheckCircle2 className="w-5 h-5" />} onClick={() => submit()}>Add to {followUp.c.id}</Btn></div>
        : labMode ? <div className="flex gap-2"><Btn variant="secondary" className="flex-1" onClick={() => submit(false, true)}>Save draft</Btn><Btn className="flex-[1.4]" icon={<CheckCircle2 className="w-5 h-5" />} onClick={() => submit()}>Create case</Btn></div>
        : <Btn block icon={<CheckCircle2 className="w-5 h-5" />} onClick={() => submit()}>Create case</Btn>}>
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
          {labMode && <div className="w-full flex items-center gap-3 px-4 py-1.5"><span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-go-brand-soft text-go-brand"><FlaskConical className="w-4 h-4" /></span><span className="w-[58px] text-[12px] text-go-muted flex-shrink-0">Lab</span><span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-go-ink">{labName(LAB_ID)}</span><CheckCircle2 className="w-4 h-4 text-go-ok flex-shrink-0" aria-label="Always Northstar" /><ChevronRight className="w-4 h-4 flex-shrink-0 text-go-faint opacity-40" aria-hidden="true" /></div>}
          <DetailRow icon={<Building2 className="w-4 h-4" />} label="Practice" value={practice ? practiceName(practice) : null} unsure={unsure.has('practice')} onClick={() => (unsure.has('practice') ? setConfirm('practice') : setEdit('practice'))} />
          <DetailRow icon={<User className="w-4 h-4" />} label="Dentist" value={clinician ? clinicianName(clinician) : null} unsure={unsure.has('dentist')} onClick={() => (unsure.has('dentist') ? setConfirm('dentist') : setEdit('dentist'))} />
          {!labMode && <DetailRow icon={<FlaskConical className="w-4 h-4" />} label="Lab" value={lab ? labName(lab) : null} unsure={unsure.has('lab')} onClick={() => (unsure.has('lab') ? setConfirm('lab') : setEdit('lab'))} />}
          <DetailRow icon={patient ? <span className="text-[9.5px] font-bold">{initials(patient.name)}</span> : <User className="w-4 h-4" />} label="Patient"
            value={patient ? patient.name : null} onClick={() => setEdit('patient')} />
        </Card>

        {/* Services: one line each, name and delivery date. Tap to edit in a bottom sheet. */}
        <Card className="overflow-hidden py-0.5">
          {/* A follow-up denture: say which case it joins */}
          {followUp && (
            <div className="mx-2 mt-1.5 mb-1 flex items-start gap-2.5 rounded-xl bg-go-ok-soft px-3 py-2">
              <Link2 className="w-[18px] h-[18px] text-go-ok flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] leading-snug text-go-ok">
                <span className="font-semibold">Matched to {followUp.c.id}.</span> The earlier stages are already on that case, so the new ones will be added there.
              </p>
            </div>
          )}
          <p className="px-4 pt-2 pb-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Services{blocks.length > 1 ? ` · ${blocks.length}` : ''}</p>
          {blocks.map((b, i) => {
            const m = matchFor(b);
            const bad = incomplete(b, m);
            const dent = isDenture(b);
            return (
              <div key={b.uid} onClick={() => (unsure.has(b.uid) ? setConfirm(b.uid) : setSvc({ block: b, isNew: false }))} className="cursor-pointer active:bg-go-raised transition">
                <button className="w-full flex items-center gap-3 px-4 py-2 text-left">
                  <span className={cx('w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center flex-shrink-0', b.itemId ? 'bg-go-brand-soft text-go-brand' : 'bg-go-warn-soft text-go-warn')}>{i + 1}</span>
                  <span className={cx('flex-1 min-w-0', !b.teeth.some(x => /arch/i.test(x)) && 'truncate')}>
                    {b.itemId
                      ? <><span className="text-[14px] font-semibold text-go-ink">{serviceLabel(b.itemId)}</span>{b.teeth.length > 0 && <span className="text-[12px] text-go-muted">{b.teeth.some(x => /arch/i.test(x)) ? ' ' : ' · '}<TeethChips teeth={b.teeth} /></span>}</>
                      : <span className="text-[14px] font-medium text-go-warn">Choose a service</span>}
                  </span>
                  {!dent && <span className={cx('text-[12.5px] flex-shrink-0', b.returnBy ? 'text-go-ink2' : 'text-go-warn font-medium')}>{b.returnBy ? shortDate(b.returnBy) : 'No date'}</span>}
                  {b.itemId && !bad && (unsure.has(b.uid) ? <HelpCircle className="w-[18px] h-[18px] text-go-warn flex-shrink-0" aria-label="Please confirm" /> : <CheckCircle2 className="w-4 h-4 text-go-ok flex-shrink-0" />)}
                  <ChevronRight className={cx('w-4 h-4 flex-shrink-0', b.itemId && !bad && !unsure.has(b.uid) ? 'text-go-faint' : 'text-go-warn')} />
                </button>
                {/* Denture: each stage with its delivery date, or where it was already done */}
                {dent && (
                  <div className="ml-[52px] mr-4 mb-2 -mt-0.5">
                    <div className="divide-y divide-go-line">
                      {stageView(b, m).filter(s => s.kind !== 'skip').map(s => (
                        <div key={s.name} className="flex items-center gap-2 py-1.5">
                          <span className={cx('flex-1 min-w-0 truncate text-[13px] font-medium', s.kind === 'order' ? 'text-go-ink' : 'text-go-muted')}>{s.name}</span>
                          {s.kind === 'order'
                            ? <span className={cx('text-[12.5px]', s.date ? 'text-go-ink2' : 'text-go-warn font-medium')}>{s.date ? shortDate(s.date) : 'No date'}</span>
                            : s.kind === 'matched' ? <Pill tone="ok" className="!h-[22px] !px-2">Done · {m!.c.id}</Pill>
                            : <Pill tone="neutral" className="!h-[22px] !px-2">Done elsewhere</Pill>}
                        </div>
                      ))}
                      {!stageView(b, m).some(s => s.kind === 'order') && <p className="py-1.5 text-[12.5px] text-go-warn font-medium">Choose a stage to order</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="px-3 pt-1.5 pb-2.5">
            <Btn block size="md" variant="secondary" icon={<PlusCircle className="w-4 h-4 text-go-brand" />} onClick={() => setSvc({ block: newBlock(), isNew: true })}>Add another service</Btn>
          </div>
        </Card>

        <div><Label optional>Case instructions</Label><TextArea rows={2} className="!py-2" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Any specific instructions for the lab…" /></div>
      </div>

      {viewing && <PhotoViewer photo={photo} onClose={() => setViewing(false)} />}

      <OptionSheet open={edit === 'practice'} onClose={closeEdit} title="Practice" value={practice} header={fixHeader('practice', 'practice')}
        onChange={v => { setPractice(v as PracticeId); clearUnsure('practice'); finishFix('practice', 'practice', v, practiceName(v as PracticeId)); }}
        options={PRACTICES.map(p => ({ value: p.id, label: p.name, sub: p.area }))} />
      <OptionSheet open={edit === 'dentist'} onClose={closeEdit} title="Dentist" value={clinician} header={fixHeader('dentist', 'dentist')}
        onChange={v => { setClinician(v); clearUnsure('dentist'); finishFix('dentist', 'dentist', v, clinicianName(v)); }}
        options={CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `GDC ${c.gdc}` }))} />
      <LabPicker bare value={lab} header={fixHeader('lab', 'lab')} onChange={v => { setLab(v); clearUnsure('lab'); finishFix('lab', 'lab', v, labName(v)); }} open={edit === 'lab'} onOpenChange={o => !o && closeEdit()} />
      <PatientPicker bare value={patientId} onChange={setPatientId} open={edit === 'patient'} onOpenChange={o => !o && closeEdit()} />
      <ConfirmSheet info={confirmInfo && confirm ? { kind: confirmInfo.kind, written: written[confirm], matched: confirmInfo.matched } : null}
        onRemember={() => settle(true)} onOnce={() => settle(false)} onDifferent={differentOne} onClose={() => setConfirm(null)} />
      <ServiceEditSheet matchFor={matchFor} block={svc?.block ?? null} isNew={svc?.isNew ?? false} canRemove={blocks.length > 1} onSave={saveService} onClose={() => { setSvc(null); setFixing(null); }} header={svc ? fixHeader(svc.block.uid, 'service') : undefined}
        onRemove={() => { setBlocks(bs => bs.filter(x => x.uid !== svc!.block.uid)); setSvc(null); }} />
    </Screen>
  );
}

function Created({ c, added, onAnother, labMode }: { c: LabCase; added?: string[]; onAnother: () => void; labMode?: boolean }) {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="relative flex flex-col items-center text-center px-6 pt-16">
        <div className="absolute top-0 w-80 h-80 rounded-full bg-go-brand/20 blur-3xl" />
        <div className="relative go-rise"><GoMark size={84} /></div>
        <span className="relative mt-6 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-go-ok-soft text-go-ok text-[12px] font-semibold"><CheckCircle2 className="w-4 h-4" />{added ? 'Stage ordered' : 'Case created'}</span>
        <h1 className="relative text-[26px] font-bold text-go-ink tracking-tight mt-3">{added ? `Added to ${c.id}` : labMode ? 'Ready to work on' : 'Ready to dispatch'}</h1>
        <p className="relative text-[14px] text-go-muted mt-1.5 leading-relaxed">
          {added
            ? <>{added.join(', ')} for {shortName(patientById(c.patientId).name)} was added to the same case. {labName(c.lab)} will see it there.</>
            : labMode ? <><span className="font-mono font-semibold text-go-ink">{c.id}</span> for {shortName(patientById(c.patientId).name)} is with {LAB_NAME}. {practiceName(c.practice)} will see it as accepted.</>
            : <><span className="font-mono font-semibold text-go-ink">{c.id}</span> for {shortName(patientById(c.patientId).name)} is ready to send to {labName(c.lab)}.</>}
        </p>
      </div>
      <div className="px-4 mt-8 space-y-2.5">
        {added
          ? <Btn block onClick={() => navigate(`${LITE}/work/${c.id}`, { replace: true })}>View the case</Btn>
          : labMode ? <Btn block onClick={() => navigate(`${LAB_BASE}/cases/${c.id}`, { replace: true })}>View the case</Btn>
          : <Btn block icon={<Printer className="w-5 h-5" />} onClick={() => navigate(`${LITE}/dispatch/${c.id}`, { replace: true })}>Print label and dispatch</Btn>}
        <Btn block variant="secondary" icon={<Plus className="w-5 h-5" />} onClick={onAnother}>Create another</Btn>
        <Btn block variant="ghost" size="md" onClick={() => navigate(`${labMode ? LAB_BASE : LITE}/home`, { replace: true })}>Back to home</Btn>
      </div>
      {!added && !labMode && <p className="text-center text-[12px] text-go-faint mt-4">You can also send it later from To dispatch.</p>}
    </Screen>
  );
}
