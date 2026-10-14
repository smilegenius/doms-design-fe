// ─── Smile Genius Go · Light version ─────────────────────────────────────────
// The short flow: sign in → home → create (from a prescription photo, one page)
// → received → to dispatch (print label). No audio, no step-by-step form, no
// lab-work list, no invoices. Mounted at /go/lite/*.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight, FlaskConical, Home, ImageUp, LogOut, PackageCheck, Plus, PlusCircle, Printer, RotateCcw, Trash, Truck, User, X, Zap, ZapOff,
} from '../icons';
import { ME, useGo, useScoped } from '../store';
import {
  CLINICIANS, LabCase, PRACTICES, PracticeId, SERVICE_CATEGORIES, caseTitle, fmtDate, initials, labName, patientById, shortName,
} from '../data';
import { Btn, Card, EmptyState, GoMark, Input, Label, PickerField, Pill, Screen, Segmented, TextArea, TopBar, cx, useBack } from '../ui';
import { CaseForm, FormItem, LabPicker, PatientPicker, ToothPicker, buildCase, emptyForm, newItem } from '../screens/ManualCase';
import { PaperRx } from '../screens/ReadSource';
import { PracticeSwitcher } from '../screens/Home';
import { DispatchScreen, ReceiveSheet } from '../screens/Logistics';

export const LITE = '/go/lite';

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const iso = (d: string) => (d ? new Date(`${d}T12:00`).toISOString() : undefined);

// ─── Tab bar: Home · To dispatch · + · Received · Me ────────────────────────

function LiteTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { cases } = useScoped();
  const toDispatch = cases.filter(c => c.stage === 'ready' && !c.onHold).length;
  const arriving = cases.filter(c => c.stage === 'shipped').length;
  const tabs = [
    { to: `${LITE}/home`, label: 'Home', icon: Home },
    { to: `${LITE}/dispatch`, label: 'To dispatch', icon: Truck, badge: toDispatch },
    null,
    { to: `${LITE}/received`, label: 'Received', icon: PackageCheck, badge: arriving },
    { to: `${LITE}/account`, label: 'Me', icon: User },
  ];
  return (
    <nav className="go-tabbar absolute bottom-0 inset-x-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 pointer-events-none">
      <div className="pointer-events-auto relative flex items-center justify-around h-16 rounded-[26px] bg-go-surface/80 backdrop-blur-2xl border border-go-line go-card-shadow">
        {tabs.map((t, i) => {
          if (!t) {
            return (
              <button key="new" onClick={() => navigate(`${LITE}/new`)} aria-label="Create lab work"
                className="-mt-7 w-14 h-14 rounded-[20px] go-grad go-glow text-white flex items-center justify-center active:scale-95 transition ring-4 ring-go-bg">
                <Plus className="w-6 h-6" strokeWidth={2.5} />
              </button>
            );
          }
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <button key={t.to} onClick={() => navigate(t.to)} className="relative flex-1 flex flex-col items-center gap-0.5 py-1">
              <span className={cx('relative flex items-center justify-center w-10 h-7 rounded-full transition', active && 'bg-go-brand-soft')}>
                <Icon className={cx('w-[20px] h-[20px] transition', active ? 'text-go-brand' : 'text-go-muted')} />
                {!!t.badge && <span className="absolute -top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-go-bad text-white text-[9px] font-bold flex items-center justify-center">{t.badge}</span>}
              </span>
              <span className={cx('text-[10px] font-semibold', active ? 'text-go-brand' : 'text-go-muted')}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

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
  const toDispatch = cases.filter(c => c.stage === 'ready' && !c.onHold);
  const arriving = cases.filter(c => c.stage === 'shipped');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const tile = (label: string, n: number, chip: string, icon: React.ReactNode, to: string) => (
    <button onClick={() => navigate(to)} aria-label={`${label}: ${n}`}
      className="relative text-left overflow-hidden rounded-[24px] border border-go-line bg-go-surface go-card-shadow p-3.5 active:scale-[.98] transition">
      <span className={cx('go-chip w-10 h-10 rounded-[14px] flex items-center justify-center', chip)}>{icon}</span>
      <span className="block text-[34px] font-bold tabular-nums leading-none tracking-tight mt-3 text-go-ink">{n}</span>
      <span className="mt-1.5 flex items-center gap-1 text-[13.5px] font-semibold text-go-ink">{label}<ChevronRight className="w-3.5 h-3.5 text-go-faint" /></span>
    </button>
  );
  return (
    <Screen tabs={<LiteTabBar />}>
      <div className="px-5 pt-3">
        <p className="text-[12.5px] text-go-muted">
          {greet}, <span className="font-semibold text-go-ink2">{ME.first}</span> · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
        <h1 className="mt-0.5"><PracticeSwitcher inline /></h1>
      </div>

      <div className="px-4 mt-5">
        <button onClick={() => navigate(`${LITE}/new`)}
          className="go-rise relative w-full overflow-hidden text-left rounded-[28px] border border-go-brand/25 bg-gradient-to-br from-go-brand-soft via-go-surface to-go-violet-soft go-card-shadow p-5 active:scale-[.99] transition">
          <span className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-go-lav/30 blur-3xl" />
          <span className="relative w-14 h-14 rounded-[20px] go-grad go-glow text-white flex items-center justify-center"><Plus className="w-7 h-7" strokeWidth={2.5} /></span>
          <span className="relative flex items-center gap-1.5 mt-3">
            <span className="text-[22px] font-bold text-go-ink tracking-tight leading-tight">Create lab work</span>
            <ChevronRight className="w-5 h-5 text-go-brand" />
          </span>
          <span className="relative block text-[13px] text-go-ink2 mt-1 leading-snug">Take a photo of the prescription, then choose the patient, service and teeth.</span>
        </button>
      </div>

      <div className="px-4 mt-3 grid grid-cols-2 gap-2.5">
        {tile('To dispatch', toDispatch.length, 'go-chip-ready', <Truck className="w-5 h-5" />, `${LITE}/dispatch`)}
        {tile('Arriving', arriving.length, 'go-chip-date', <PackageCheck className="w-5 h-5" />, `${LITE}/received`)}
      </div>
    </Screen>
  );
}

// ─── To dispatch → print label ──────────────────────────────────────────────

export function LiteToDispatch() {
  const navigate = useNavigate();
  const { cases } = useScoped();
  const list = cases.filter(c => c.stage === 'ready' && !c.onHold).sort((a, b) => (a.returnBy || '9').localeCompare(b.returnBy || '9'));
  return (
    <Screen tabs={<LiteTabBar />} header={<TopBar large title="To dispatch" sub={list.length ? 'Print the label, pack it and send it to the lab.' : undefined} />}>
      <div className="px-4 space-y-2.5">
        {list.map(c => (
          <CaseRow key={c.id} c={c} onClick={() => navigate(`${LITE}/dispatch/${c.id}`)}
            right={<span className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-go-brand-soft text-go-brand-ink text-[12.5px] font-semibold flex-shrink-0"><Printer className="w-4 h-4" />Print</span>} />
        ))}
        {!list.length && <EmptyState icon={<Truck className="w-7 h-7" />} title="Nothing to dispatch" body="New lab work you create will appear here, ready to print and send." />}
      </div>
    </Screen>
  );
}

// ─── Received ───────────────────────────────────────────────────────────────

export function LiteReceived() {
  const { cases } = useScoped();
  const [tab, setTab] = useState<'arriving' | 'received'>('arriving');
  const [target, setTarget] = useState<LabCase | null>(null);
  const arriving = cases.filter(c => c.stage === 'shipped');
  const received = cases.filter(c => c.stage === 'received');
  const list = tab === 'arriving' ? arriving : received;
  return (
    <Screen tabs={<LiteTabBar />} header={<TopBar large title="Received" />}>
      <div className="px-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'arriving', label: 'Arriving', count: arriving.length }, { value: 'received', label: 'Received', count: received.length }]} />
      </div>
      <div className="px-4 mt-3 space-y-2.5">
        {list.map(c => (
          <CaseRow key={c.id} c={c}
            right={tab === 'received' ? <Pill tone="ok" dot>Received</Pill> : undefined}
            action={tab === 'arriving'
              ? <Btn block size="md" icon={<PackageCheck className="w-4 h-4" />} onClick={() => setTarget(c)}>Mark as received</Btn>
              : undefined} />
        ))}
        {!list.length && (tab === 'arriving'
          ? <EmptyState icon={<PackageCheck className="w-7 h-7" />} title="Nothing on its way" body="Work the lab has shipped will appear here." />
          : <EmptyState icon={<PackageCheck className="w-7 h-7" />} title="Nothing received yet" body="Work you mark as received will appear here." />)}
      </div>
      {target && <ReceiveSheet c={target} open onClose={() => setTarget(null)} />}
    </Screen>
  );
}

// ─── Me ─────────────────────────────────────────────────────────────────────

export function LiteAccount() {
  const { signOut, themePref, setThemePref } = useGo();
  const navigate = useNavigate();
  return (
    <Screen tabs={<LiteTabBar />} header={<TopBar large title="Me" />}>
      <div className="px-4 space-y-4">
        <Card className="p-4 flex items-center gap-3.5">
          <span className="go-grad text-white font-bold rounded-full w-12 h-12 flex items-center justify-center text-[16px]">{initials(ME.name)}</span>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-go-ink">{ME.name}</p>
            <p className="text-[12.5px] text-go-muted truncate">{ME.role} · {ME.email}</p>
          </div>
        </Card>
        <div>
          <Label>Appearance</Label>
          <Segmented value={themePref} onChange={setThemePref}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Auto' }]} />
        </div>
        <Btn block variant="secondary" icon={<LogOut className="w-5 h-5" />} onClick={() => { signOut(); navigate(`${LITE}/signin`, { replace: true }); }}>Sign out</Btn>
      </div>
    </Screen>
  );
}

// ─── Dispatch wrapper (reuses the portal's label + courier screen) ──────────

export const LiteDispatch = () => <DispatchScreen list={`${LITE}/dispatch`} />;

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
    <div role="dialog" aria-modal="true" aria-label="Prescription photo" className="absolute inset-0 z-50 bg-[#05050B] text-white flex flex-col go-fade-in">
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

interface Block { uid: string; itemId: string | null; teeth: string[]; returnBy: string }
let blockSeq = 0;
const newBlock = (): Block => ({ uid: `b${++blockSeq}`, itemId: null, teeth: [], returnBy: plusDays(14) });

const SERVICE_OPTIONS = SERVICE_CATEGORIES.flatMap(cat => cat.items.map(s => ({ value: s.id, label: s.label, sub: cat.label })));

export function LiteCreate() {
  const { addCase, toast } = useGo();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [viewing, setViewing] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [practice, setPractice] = useState<PracticeId | null>(PRACTICES[0].id);
  const [blocks, setBlocks] = useState<Block[]>(() => [newBlock()]);
  const [instructions, setInstructions] = useState('');
  const [lab, setLab] = useState<string | null>('northstar');
  const [clinician, setClinician] = useState<string>('reed');
  const [more, setMore] = useState(false);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<LabCase | null>(null);

  if (created) return <Created c={created} onAnother={() => { setCreated(null); setPhoto(null); setPatientId(null); setBlocks([newBlock()]); setInstructions(''); setTried(false); }} />;
  if (!photo) return <CameraView onShot={setPhoto} />;

  const patch = (uid: string, p: Partial<Block>) => setBlocks(bs => bs.map(b => (b.uid === uid ? { ...b, ...p } : b)));
  const bad = (v: unknown) => tried && !v;

  const submit = () => {
    if (!patientId || !practice || !lab || blocks.some(b => !b.itemId)) { setTried(true); return; }
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

  return (
    <Screen
      header={<TopBar back fallback={`${LITE}/home`} title="Create lab work" sub="From the prescription" />}
      footer={<Btn block icon={<CheckCircle2 className="w-5 h-5" />} onClick={submit}>Create case</Btn>}>
      {tried && (!patientId || blocks.some(b => !b.itemId)) && <p className="px-5 pt-1 pb-2 text-[13px] text-go-warn font-medium">Please fill in the highlighted details.</p>}
      <div className="px-4 pt-2 space-y-5">
        {/* The prescription — tap to view it full size */}
        <div className="relative">
          <button onClick={() => setViewing(true)} aria-label="View the prescription full size"
            className="block w-full h-44 rounded-[22px] overflow-hidden border border-go-line bg-go-raised go-card-shadow relative">
            <Prescription photo={photo} className="w-full h-full object-cover object-top" />
            <span className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute left-3.5 bottom-2.5 text-[12.5px] font-semibold text-white">Tap to view full size</span>
          </button>
          <button onClick={() => setPhoto(null)} className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 h-8 px-3 rounded-full bg-black/55 backdrop-blur text-white text-[12px] font-semibold">
            <RotateCcw className="w-3.5 h-3.5" />Retake
          </button>
        </div>

        <PatientPicker value={patientId} onChange={setPatientId} invalid={bad(patientId)} />
        <PickerField label="Practice" value={practice} onChange={v => setPractice(v as PracticeId)} invalid={bad(practice)}
          options={PRACTICES.map(p => ({ value: p.id, label: p.name }))} />

        {/* Service · teeth · delivery date, together */}
        {blocks.map((b, i) => (
          <Card key={b.uid} className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Service{blocks.length > 1 ? ` ${i + 1}` : ''}</p>
              {blocks.length > 1 && (
                <button onClick={() => setBlocks(bs => bs.filter(x => x.uid !== b.uid))} aria-label={`Remove service ${i + 1}`}
                  className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-go-muted hover:text-go-bad hover:bg-go-bad-soft"><Trash className="w-4 h-4" /></button>
              )}
            </div>
            <PickerField label="Service type" value={b.itemId} onChange={v => patch(b.uid, { itemId: v })} placeholder="Choose a service" searchable
              invalid={tried && !b.itemId} options={SERVICE_OPTIONS} />
            <div><Label optional>Teeth or arch</Label><ToothPicker value={b.teeth} onChange={v => patch(b.uid, { teeth: v })} /></div>
            <div>
              <Label optional>Delivery date</Label>
              <Input type="date" value={b.returnBy} min={plusDays(1)} onChange={e => patch(b.uid, { returnBy: e.target.value })} />
              <div className="flex gap-2 mt-2">
                {[7, 10, 14, 21].map(n => (
                  <button key={n} onClick={() => patch(b.uid, { returnBy: plusDays(n) })}
                    className={cx('flex-1 h-9 rounded-xl text-[12.5px] font-semibold border transition', b.returnBy === plusDays(n) ? 'border-go-brand bg-go-brand-soft text-go-brand-ink' : 'border-go-line text-go-ink2')}>
                    +{n} days
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ))}
        <button onClick={() => setBlocks(bs => [...bs, newBlock()])}
          className="w-full h-12 -mt-2 rounded-[20px] border-2 border-dashed border-go-line text-go-brand hover:border-go-brand/60 flex items-center justify-center gap-2 text-[14px] font-semibold transition">
          <PlusCircle className="w-5 h-5" />Add another service
        </button>

        <div><Label optional>Case instructions</Label><TextArea rows={4} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Any specific instructions for the lab…" /></div>

        {/* Pre-filled so the case can go to a lab; change if the prescription says otherwise */}
        <div className="rounded-2xl bg-go-raised px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="flex-1 min-w-0 text-[12.5px] text-go-ink2 leading-snug">
              Sending to <span className="font-semibold text-go-ink">{lab ? labName(lab) : 'no lab yet'}</span> · prescribed by <span className="font-semibold text-go-ink">{CLINICIANS.find(c => c.id === clinician)!.name}</span>
            </p>
            <button onClick={() => setMore(m => !m)} className="text-[12.5px] font-semibold text-go-brand">{more ? 'Done' : 'Change'}</button>
          </div>
          {more && (
            <div className="mt-3 space-y-4">
              <LabPicker value={lab} onChange={setLab} invalid={bad(lab)} />
              <PickerField label="Dentist" value={clinician} onChange={setClinician} options={CLINICIANS.map(c => ({ value: c.id, label: c.name, sub: `GDC ${c.gdc}` }))} />
            </div>
          )}
        </div>
      </div>
      {viewing && <PhotoViewer photo={photo} onClose={() => setViewing(false)} />}
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
