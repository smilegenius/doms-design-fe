// ─── Photo / audio prescription capture ──────────────────────────────────────
// Same review for both: the photo (or the voice-note transcript) sits on top,
// then one tab per service item + a Shared tab, then an editable Case
// instructions box and attachments. Low-confidence reads must be confirmed.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, ImagePlus, ImageUp, Mic, Paperclip, Pause, Play, RotateCcw, Sparkles, Stop, X, Zap, ZapOff } from '../icons';
import { useGo } from '../store';
import { LabCase, MATERIALS, SERVICE_EXTRAS, SHADES, clinicianName, fmtDate, labName, patientById } from '../data';
import { Btn, Card, Chips, Input, Label, Pill, Screen, Sheet, TextArea, TopBar, cx, useBack } from '../ui';
import { CaseCreated, CaseForm, buildCase, emptyForm, newItem } from './ManualCase';

type Mode = 'photo' | 'audio';
type Phase = 'capture' | 'reading' | 'review' | 'done';
type Conf = 'read' | 'unclear' | 'missing';
type Kind = 'text' | 'shade' | 'funding' | 'date' | 'material' | 'extra';
/** group: 'shared' for prescription-wide details, 'i1', 'i2'… for each service item. */
interface Extracted { key: string; group: string; label: string; value: string; conf: Conf; note?: string; kind: Kind; optional?: boolean; options?: string[] }
export type RxScenario = 'single' | 'multi' | 'clean';

// Fade the tab strip's edges so overflowing tabs read as scrollable
const FADE = 'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 28px), transparent 100%)';
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// What the read (photo OCR or voice transcription) returns, per demo scenario.
function readFor(rx: RxScenario, mode: Mode): Extracted[] {
  const clean = rx === 'clean';
  const heard = mode === 'audio';
  const f = (group: string, key: string, label: string, value: string, conf: Conf = 'read', note?: string, kind: Kind = 'text', optional?: boolean): Extracted =>
    ({ key: `${group}.${key}`, group, label, value, conf, note, kind, optional });
  const withOpts = (x: Extracted, options: string[]) => ({ ...x, options });
  // Case details — same compulsory fields as the clinic portal's create-case form:
  // Patient, Lab, Dentist, Order type, Delivery date, Case source (+ practice, optional appointment).
  const shared = [
    f('shared', 'patient', 'Patient', 'Tom Hughes · DOB 03/08/1985', 'read', 'Matched P-10450'),
    f('shared', 'lab', 'Dental laboratory', 'Northstar Dental Lab'),
    f('shared', 'clinician', 'Dentist', 'Dr Olivia Reed', 'read', heard ? 'Recognised voice' : 'Signature found'),
    clean ? f('shared', 'funding', 'Order type', 'Private', 'read', undefined, 'funding')
      : f('shared', 'funding', 'Order type', '', 'missing', heard ? 'NHS or Private wasn’t mentioned' : 'Not found on the form', 'funding'),
    clean ? f('shared', 'returnBy', 'Delivery date', plusDays(9), 'read', undefined, 'date')
      : f('shared', 'returnBy', 'Delivery date', heard ? '“Wednesday the ninth”' : 'Wed/09', 'unclear', 'Month missing. Pick the date', 'date'),
    f('shared', 'source', 'Case source', heard ? 'Voice note' : 'Photo of Rx', 'read', 'From how you created it'),
    f('shared', 'practice', 'Practice', 'Camden Dental Studio', 'read', 'From your login'),
    f('shared', 'appointment', 'Patient appointment', '', 'missing', heard ? 'Optional · not mentioned' : 'Optional · not on the form', 'date', true),
  ];
  const item1 = [
    f('i1', 'service', 'Service', 'Crown'),
    f('i1', 'teeth', 'Tooth notation', 'LL5'),
    f('i1', 'material', 'Material', 'Lithium disilicate (e.max)', 'read', undefined, 'material'),
    clean ? f('i1', 'shade', 'Shade', 'A2', 'read', undefined, 'shade')
      : f('i1', 'shade', 'Shade', heard ? '“A2… maybe A3”' : 'A2 or A3?', 'unclear', 'Unclear. Please confirm', 'shade'),
  ];
  // Appliances take a type instead of material + shade (as on the web form)
  const item2 = [
    f('i2', 'service', 'Service', 'Night guard'),
    f('i2', 'teeth', 'Teeth / arch', 'Upper arch'),
    withOpts(f('i2', 'extra', 'Type', heard ? '“hard-ish”' : 'Hard?', 'unclear', heard ? 'Unclear. Pick the type' : 'Handwriting unclear. Pick the type', 'extra'), SERVICE_EXTRAS['Night guard'].options),
  ];
  const item3 = [
    f('i3', 'service', 'Service', 'Bridge'),
    f('i3', 'teeth', 'Tooth notation', 'UR4–UR6'),
    f('i3', 'material', 'Material', 'Porcelain fused to metal', 'read', undefined, 'material'),
    f('i3', 'shade', 'Shade', 'A3', 'read', undefined, 'shade'),
    withOpts(f('i3', 'extra', 'Abutment material', 'Chrome cobalt', 'read', undefined, 'extra'), SERVICE_EXTRAS.Bridge.options),
  ];
  const item4 = [
    f('i4', 'service', 'Service', 'Whitening trays'),
    f('i4', 'teeth', 'Teeth / arch', 'Both arches'),
    withOpts(f('i4', 'extra', 'Reservoirs', 'Yes', 'read', undefined, 'extra'), SERVICE_EXTRAS['Whitening trays'].options),
  ];
  return rx === 'multi' ? [...shared, ...item1, ...item2, ...item3, ...item4] : [...shared, ...item1];
}

const INSTRUCTIONS: Record<RxScenario, string> = {
  single: 'Light contacts. Match adjacent LL4 characterisation.',
  clean: 'Light contacts. Match adjacent LL4 characterisation.',
  multi: 'Crown: light contacts, match LL4. Night guard: hard, 2 mm. Bridge: modified ridge lap pontic. Trays: reservoirs on.',
};

/** Voice-note transcript; flagged bits are what the review asks you to confirm. */
const TRANSCRIPT: Record<RxScenario, { t: string; flag?: boolean }[]> = {
  single: [
    { t: 'New crown for Tom Hughes, date of birth third of August eighty-five. Lower left five, e.max, shade ' },
    { t: 'A2… maybe A3', flag: true }, { t: '. Send it to Northstar, back by ' }, { t: 'Wednesday the ninth', flag: true },
    { t: '. Light contacts, match the lower left four.' },
  ],
  clean: [
    { t: 'New private crown for Tom Hughes, date of birth third of August eighty-five. Lower left five, e.max, shade A2. Send it to Northstar, back in nine days. Light contacts, match the lower left four.' },
  ],
  multi: [
    { t: 'Four items for Tom Hughes, all to Northstar. One: crown, lower left five, e.max, shade ' }, { t: 'A2… maybe A3', flag: true },
    { t: '. Two: upper night guard, ' }, { t: 'hard acrylic-ish', flag: true }, { t: ', two mil. Three: bridge upper right four to six, PFM, A3. Four: whitening trays both arches, reservoirs on. Back by ' },
    { t: 'Wednesday the ninth', flag: true }, { t: '.' },
  ],
};

/** Stylised paper Rx used as the "photo" — fixed light colours, like paper. */
function PaperRx({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 210 270" className={className}>
      <rect width="210" height="270" rx="6" fill="#FBFBF8" />
      <rect x="16" y="16" width="90" height="10" rx="3" fill="#4D8EF7" opacity=".85" />
      <rect x="150" y="14" width="44" height="14" rx="3" fill="#E0E0E6" />
      {[44, 58, 72].map(y => <rect key={y} x="16" y={y} width={y === 58 ? 120 : 160} height="5" rx="2.5" fill="#C9C9D3" />)}
      <rect x="16" y="92" width="178" height="62" rx="5" fill="none" stroke="#D4D4DD" />
      <path d="M30 128c10-14 20 14 30 0s20 14 30 0 20 14 30 0" stroke="#2A2A3A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <text x="140" y="130" fontSize="16" fontFamily="cursive" fill="#2A2A3A">LL5</text>
      {[168, 182, 196, 210].map((y, i) => <path key={y} d={`M16 ${y} q ${40 + i * 6} -6 ${120 - i * 14} 0`} stroke="#3A3A4A" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
      <text x="16" y="240" fontSize="13" fontFamily="cursive" fill="#2A2A3A">A2/3 ?</text>
      <path d="M120 244c10-16 18 10 26-4s12 8 22 0" stroke="#1565C0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CameraView({ onShot }: { onShot: () => void }) {
  const back = useBack('/go/home');
  const [flash, setFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="absolute inset-0 bg-[#05050B] text-white flex flex-col">
      <div className="flex items-center justify-between px-4 h-14">
        <button onClick={back} aria-label="Close camera" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <span className="text-[15px] font-semibold">Photograph prescription</span>
        <button onClick={() => setFlash(f => !f)} aria-label="Toggle flash" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          {flash ? <Zap className="w-5 h-5 text-[#FBBF24]" /> : <ZapOff className="w-5 h-5" />}
        </button>
      </div>
      <div className="relative flex-1 mx-5 my-2 rounded-[28px] overflow-hidden bg-gradient-to-b from-[#2B2B36] to-[#14141C]">
        <PaperRx className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[72%] rotate-[-4deg] drop-shadow-2xl opacity-95" />
        {/* Frame guides */}
        {['top-5 left-5 border-t-[3px] border-l-[3px] rounded-tl-2xl', 'top-5 right-5 border-t-[3px] border-r-[3px] rounded-tr-2xl',
          'bottom-5 left-5 border-b-[3px] border-l-[3px] rounded-bl-2xl', 'bottom-5 right-5 border-b-[3px] border-r-[3px] rounded-br-2xl'].map(p => (
          <span key={p} className={cx('absolute w-10 h-10 border-[#7FB0FF]', p)} />
        ))}
        <span className="go-scanline absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#7FB0FF] to-transparent shadow-[0_0_16px_2px_rgba(127,176,255,.6)]" />
        <span className="absolute top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-black/50 backdrop-blur text-[12px] font-medium whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] go-pulse" />Prescription detected
        </span>
      </div>
      <p className="text-center text-[12.5px] text-white/70 px-10 leading-relaxed">Place the full prescription on a flat surface in good light. Patient data stays in this demo.</p>
      <div className="flex items-center justify-between px-10 pt-5 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { if (e.target.files?.length) onShot(); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 text-[11px] text-white/80">
          <span className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><ImageUp className="w-5 h-5" /></span>Upload
        </button>
        <button onClick={onShot} aria-label="Take photo" className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition">
          <span className="w-[60px] h-[60px] rounded-full bg-white" />
        </button>
        <span className="w-12 text-center text-[11px] text-white/60 leading-tight">JPG, PNG<br />or PDF</span>
      </div>
    </div>
  );
}


// ─── Audio: record a voice note ─────────────────────────────────────────────

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function RecordView({ onDone }: { onDone: (secs: number) => void }) {
  const back = useBack('/go/home');
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(28).fill(0.12));
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!rec) return;
    const t1 = setInterval(() => setSecs(x => x + 1), 1000);
    const t2 = setInterval(() => setBars(b => [...b.slice(1), 0.2 + Math.random() * 0.8]), 110);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [rec]);
  const stop = () => { setRec(false); onDone(Math.max(secs, 18)); };
  // Once started, pause/resume and retake appear either side of the main button
  const started = rec || secs > 0;
  const retake = () => { setRec(false); setSecs(0); setBars(Array(28).fill(0.12)); };

  return (
    <Screen header={<TopBar back fallback="/go/home" title="Dictate prescription" />}>
      <div className="flex flex-col items-center px-6 pt-6">
        <p className="text-[13px] text-go-muted text-center leading-relaxed max-w-[280px]">
          Say the patient, each service with teeth, material and shade, the lab and when you need it back.
        </p>

        {/* Waveform */}
        <div className="mt-10 h-24 w-full flex items-center justify-center gap-[3px]" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className={cx('w-[5px] rounded-full transition-all duration-100', rec ? 'go-grad' : 'bg-go-line')} style={{ height: `${Math.round(h * 96)}px` }} />
          ))}
        </div>
        <p className={cx('mt-4 text-[34px] font-bold tabular-nums tracking-tight', rec ? 'text-go-ink' : 'text-go-faint')}>{fmtDur(secs)}</p>
        <p className="text-[12.5px] text-go-muted h-5">{rec ? 'Listening… tap ■ when you’re done' : secs ? 'Paused' : 'Tap to start'}</p>

        {/* Controls: pause/resume · big mic or finish · retake */}
        <div className="mt-8 flex items-center justify-center gap-7">
          <div className="w-14 flex flex-col items-center gap-1">
            {started && (
              <>
                <button onClick={() => setRec(r => !r)} aria-label={rec ? 'Pause recording' : 'Resume recording'}
                  className="w-14 h-14 rounded-full bg-white text-[#030213] border border-black/5 shadow-[0_6px_18px_-6px_rgba(16,24,64,.35)] flex items-center justify-center active:scale-95 transition">
                  {rec ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>
                <span className="text-[11px] font-medium text-go-muted">{rec ? 'Pause' : 'Resume'}</span>
              </>
            )}
          </div>

          <div className="relative">
            {rec && <span className="absolute inset-0 rounded-full go-grad opacity-30 animate-ping" />}
            <button onClick={() => (started ? stop() : setRec(true))} aria-label={started ? 'Finish recording' : 'Start recording'}
              className={cx('relative w-24 h-24 rounded-full flex items-center justify-center text-white active:scale-95 transition go-glow',
                started ? 'bg-go-bad' : 'go-grad')}>
              {started ? <Stop className="w-9 h-9" /> : <Mic className="w-10 h-10" />}
            </button>
          </div>

          <div className="w-14 flex flex-col items-center gap-1">
            {started && (
              <>
                <button onClick={retake} aria-label="Retake recording"
                  className="w-14 h-14 rounded-full bg-white text-[#030213] border border-black/5 shadow-[0_6px_18px_-6px_rgba(16,24,64,.35)] flex items-center justify-center active:scale-95 transition">
                  <RotateCcw className="w-6 h-6" />
                </button>
                <span className="text-[11px] font-medium text-go-muted">Retake</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-10 w-full rounded-[22px] bg-go-surface border border-go-line p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mb-2">Try saying</p>
          <p className="text-[13.5px] text-go-ink2 leading-relaxed">“Crown for Tom Hughes, lower left five, e.max shade A2, to Northstar, back by the 16th.”</p>
        </div>

        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => { if (e.target.files?.length) onDone(42); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-go-brand">
          <ImageUp className="w-4 h-4" />Upload a voice note instead
        </button>
        <button onClick={back} className="mt-3 text-[12.5px] text-go-muted">Cancel</button>
      </div>
    </Screen>
  );
}

// ─── Reading / transcribing ─────────────────────────────────────────────────

function Reading({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const steps = mode === 'audio'
    ? ['Transcribing your voice note', 'Picking out the prescription details', 'Matching patient, dentist and lab']
    : ['Finding the prescription', 'Reading handwriting', 'Matching patient, dentist and lab'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => x + 1), 650);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (i >= steps.length) onDone(); }, [i, onDone, steps.length]);
  return (
    <Screen>
      <div className="flex flex-col items-center px-8 pt-20">
        {mode === 'audio' ? (
          <div className="relative w-40 h-40 rounded-full go-grad go-glow flex items-center justify-center">
            <span className="absolute inset-0 rounded-full go-grad opacity-30 animate-ping" />
            <Mic className="relative w-14 h-14 text-white" />
          </div>
        ) : (
          <div className="relative w-40 h-52">
            <PaperRx className="w-full h-full rounded-xl" />
            <span className="go-scanline absolute left-0 right-0 h-1 go-grad shadow-[0_0_20px_4px_rgba(77,142,247,.5)]" />
          </div>
        )}
        <p className="mt-8 inline-flex items-center gap-2 text-[17px] font-semibold text-go-ink"><Sparkles className="w-5 h-5 text-go-lav" />{mode === 'audio' ? 'Writing up your note…' : 'Reading prescription…'}</p>
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

const CONF: Record<Conf, { tone: 'ok' | 'warn' | 'bad'; label: string }> = {
  read: { tone: 'ok', label: 'Read' },
  unclear: { tone: 'warn', label: 'Check' },
  missing: { tone: 'bad', label: 'Not found' },
};

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CaptureScreen({ mode = 'photo' }: { mode?: Mode }) {
  const { addCase } = useGo();
  const [params] = useSearchParams();
  const rx = (['multi', 'clean'].includes(params.get('rx') ?? '') ? params.get('rx') : 'single') as RxScenario;
  const [phase, setPhase] = useState<Phase>('capture');
  const [fields, setFields] = useState<Extracted[]>(() => readFor(rx, mode));
  const [notes, setNotes] = useState(INSTRUCTIONS[rx]);
  const [txOpen, setTxOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [secs, setSecs] = useState(42);
  const [editing, setEditing] = useState<Extracted | null>(null);
  const [draft, setDraft] = useState('');
  const [created, setCreated] = useState<LabCase | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const restart = () => { setFields(readFor(rx, mode)); setNotes(INSTRUCTIONS[rx]); setFiles([]); setPhase('capture'); setCreated(null); };
  // Jumping between scenarios on the same route restarts the flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(restart, [rx, mode]);

  const isPending = (x: Extracted) => x.conf !== 'read' && !x.optional;
  const pending = fields.filter(isPending);
  const groups = [...new Set(fields.map(x => x.group))];
  const itemGroups = groups.filter(g => g !== 'shared');
  // Case details (compulsory fields) · items · Instructions & files — nothing hidden below the fold
  const tabs = ['shared', ...itemGroups, 'notes'];
  const [tab, setTab] = useState<string>('shared');
  useEffect(() => { setTab('shared'); }, [rx, mode]);
  const pendingIn = (g: string, fs = fields) => fs.filter(x => x.group === g && isPending(x)).length;
  // Only the photo is kept as an attachment; a voice note is just input for filling the form.
  const sourceFile = mode === 'photo' ? 'Prescription photo' : null;

  // Tab bar ↔ swipe panels sync
  const stripRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const tabEls = useRef<Record<string, HTMLButtonElement | null>>({});
  const autoScrolling = useRef(false);
  const [bar, setBar] = useState({ left: 0, width: 0 });
  const panelEls = useRef<Record<string, HTMLDivElement | null>>({});
  const [panelH, setPanelH] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = tabEls.current[tab];
    const strip = stripRef.current;
    const panels = panelsRef.current;
    if (el && strip) {
      setBar({ left: el.offsetLeft, width: el.offsetWidth });
      strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
    }
    const p = panelEls.current[tab];
    if (p) setPanelH(p.offsetHeight);
    const i = tabs.indexOf(tab);
    if (panels && i >= 0 && Math.round(panels.scrollLeft / panels.clientWidth) !== i) {
      autoScrolling.current = true;
      panels.scrollTo({ left: i * panels.clientWidth, behavior: 'smooth' });
      setTimeout(() => { autoScrolling.current = false; }, 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, phase, fields, files]);
  const onPanelsScroll = () => {
    const p = panelsRef.current;
    if (!p || autoScrolling.current) return;
    const g = tabs[Math.round(p.scrollLeft / p.clientWidth)];
    if (g && g !== tab) setTab(g);
  };

  const confirm = (key: string, value: string) => {
    const next = fields.map(x => (x.key === key ? { ...x, value, conf: 'read' as Conf, note: x.optional ? 'Added by you' : 'Confirmed by you' } : x));
    setFields(next);
    setEditing(null);
    if (!pendingIn(tab, next)) {
      const after = [...tabs.slice(tabs.indexOf(tab) + 1), ...tabs.slice(0, tabs.indexOf(tab))].find(g => pendingIn(g, next));
      if (after) setTimeout(() => setTab(after), 250);
    }
  };
  const open = (x: Extracted) => {
    setDraft(x.kind === 'date' ? plusDays(x.optional ? 10 : 9) : x.kind === 'shade' ? 'A2' : x.kind === 'material' && x.conf !== 'read' ? 'Acrylic' : x.kind === 'extra' ? (x.options?.find(o => x.value.toLowerCase().includes(o.toLowerCase())) ?? '') : x.value);
    setEditing(x);
  };

  const create = () => {
    const get = (k: string) => fields.find(x => x.key === k)?.value ?? '';
    const f: CaseForm = {
      ...emptyForm(), practice: 'cds', clinician: 'reed', patientId: 'P-10450', lab: 'northstar',
      funding: get('shared.funding') as 'NHS' | 'Private', returnBy: get('shared.returnBy'), apptDate: get('shared.appointment'),
      caseSource: mode === 'audio' ? 'Voice note' : 'Photo of Rx', instructions: notes, attachments: sourceFile ? [sourceFile, ...files] : files,
      items: itemGroups.map(g => newItem(get(`${g}.service`), {
        teeth: [get(`${g}.teeth`)], material: get(`${g}.material`) || null, shade: get(`${g}.shade`) || null,
        extra: get(`${g}.extra`) ? [get(`${g}.extra`)] : [],
      })),
    };
    const c = buildCase(f, 'photo');
    addCase(c);
    setCreated(c);
    setPhase('done');
  };

  if (phase === 'capture') return mode === 'audio'
    ? <RecordView onDone={s => { setSecs(s); setPhase('reading'); }} />
    : <CameraView onShot={() => setPhase('reading')} />;
  if (phase === 'reading') return <Reading mode={mode} onDone={() => setPhase('review')} />;
  if (phase === 'done' && created) return <CaseCreated c={created} />;

  const Row = (x: Extracted) => {
    const c = CONF[x.conf];
    const needs = x.conf !== 'read';
    const shown = x.kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(x.value) ? fmtDate(new Date(x.value).toISOString()) : x.value;
    return (
      <button key={x.key} disabled={!needs && !x.optional} onClick={() => open(x)}
        className={cx('w-full text-left flex items-center gap-3 px-3.5 py-3 transition',
          needs && !x.optional && (x.conf === 'missing' ? 'bg-go-bad-soft/70' : 'bg-go-warn-soft/70'))}>
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] text-go-muted">{x.label}</p>
          <p className={cx('text-[14px] font-semibold mt-0.5', x.value ? 'text-go-ink' : 'text-go-faint italic')}>{shown || (x.optional ? 'Not set' : 'Not found')}</p>
          {x.note && <p className={cx('text-[11.5px] mt-0.5', needs && !x.optional ? (x.conf === 'missing' ? 'text-go-bad' : 'text-go-warn') : 'text-go-muted')}>{x.note}</p>}
        </div>
        {x.optional && needs ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-go-brand">Add<ChevronRight className="w-4 h-4" /></span>
          : needs ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-go-brand">Confirm<ChevronRight className="w-4 h-4" /></span>
          : <Pill tone={c.tone} className="!h-[22px] !px-2"><CheckCircle2 className="w-3.5 h-3.5" />{c.label}</Pill>}
      </button>
    );
  };

  return (
    <Screen
      header={<TopBar back fallback="/go/home" title="Check every detail" sub={itemGroups.length > 1 ? `Multi-service · ${itemGroups.length} items` : mode === 'audio' ? 'From your voice note' : 'From your photo'}
        right={<button onClick={restart} className="inline-flex items-center gap-1 text-[13px] font-semibold text-go-brand pr-1"><RotateCcw className="w-4 h-4" />{mode === 'audio' ? 'Re-record' : 'Retake'}</button>} />}
      footer={<Btn block disabled={!!pending.length} onClick={create}>{pending.length ? `Confirm ${pending.length} detail${pending.length > 1 ? 's' : ''} to continue` : 'Authorise & create lab work'}</Btn>}>
      <div className="px-4 pt-1">
        {mode === 'audio' ? (
          // Voice note: the fetched text sits on top, like the photo does
          <Card className="p-3.5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full go-grad text-white flex items-center justify-center flex-shrink-0"><Mic className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-go-ink">Voice note · {fmtDur(secs)}</p>
                <p className="text-[12px] text-go-muted">{itemGroups.length} service{itemGroups.length > 1 ? 's' : ''} · {fields.length - pending.length} of {fields.length} details heard</p>
              </div>
            </div>
            {/* Transcript — 3 lines by default, tap to expand / collapse */}
            <button onClick={() => setTxOpen(o => !o)} aria-expanded={txOpen} className="mt-3 w-full text-left p-3 rounded-2xl bg-go-raised">
              <p className={cx('text-[13px] leading-relaxed text-go-ink2', !txOpen && 'line-clamp-3')}>
                “{TRANSCRIPT[rx].map((s, i) => s.flag
                  ? <mark key={i} className="bg-go-warn-soft text-go-warn font-semibold rounded px-0.5">{s.t}</mark>
                  : <span key={i}>{s.t}</span>)}”
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-go-brand">
                {txOpen ? 'Show less' : 'Show full transcript'}
                <ChevronDown className={cx('w-3.5 h-3.5 transition-transform', txOpen && 'rotate-180')} />
              </span>
            </button>
          </Card>
        ) : (
          <Card className="p-3 flex items-center gap-3.5">
            <PaperRx className="w-14 h-[72px] rounded-lg flex-shrink-0 border border-go-line" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-go-ink">Prescription captured</p>
              <p className="text-[12px] text-go-muted mt-0.5">
                {itemGroups.length} service{itemGroups.length > 1 ? 's' : ''} · {fields.length - pending.length} of {fields.length} details read
              </p>
              <div className="h-1.5 rounded-full bg-go-line mt-2 overflow-hidden"><div className="h-full go-grad transition-all" style={{ width: `${((fields.length - pending.length) / fields.length) * 100}%` }} /></div>
            </div>
          </Card>
        )}
        {pending.length ? (
          <div className="mt-3 flex items-center gap-2.5 p-3 rounded-2xl bg-go-warn-soft text-go-warn">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-[13px] font-medium">{pending.length} need review. Tap each one to confirm.</p>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2.5 p-3 rounded-2xl bg-go-ok-soft text-go-ok">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-[13px] font-medium">Everything is in. Check it over, then authorise.</p>
          </div>
        )}
      </div>

      {/* Tab bar — one tab per service + Shared */}
      <div className="sticky top-0 z-10 mt-4 bg-go-bg/90 backdrop-blur-xl">
        <div ref={stripRef} role="tablist" aria-label="Prescription items"
          className="relative flex overflow-x-auto go-scroll px-3 border-b border-go-line"
          style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
          {tabs.map((g, i) => {
            const svc = fields.find(x => x.key === `${g}.service`)?.value;
            const teeth = fields.find(x => x.key === `${g}.teeth`)?.value;
            const n = pendingIn(g);
            const on = tab === g;
            return (
              <button key={g} ref={el => { tabEls.current[g] = el; }} role="tab" aria-selected={on} onClick={() => setTab(g)}
                className={cx('relative flex-shrink-0 h-12 px-3 flex items-center gap-1.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                  on ? 'text-go-ink' : 'text-go-muted hover:text-go-ink2')}>
                {g !== 'shared' && g !== 'notes' && (
                  <span className={cx('w-[18px] h-[18px] rounded-md text-[10.5px] font-bold flex items-center justify-center transition',
                    on ? 'go-grad text-white' : 'bg-go-raised text-go-muted border border-go-line')}>{itemGroups.indexOf(g) + 1}</span>
                )}
                {g === 'shared' ? 'Case details' : g === 'notes' ? 'Instructions & files' : <>{svc} <span className="font-medium opacity-60">{teeth}</span></>}
                {n ? <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-go-warn text-white text-[10.5px] font-bold flex items-center justify-center">{n}</span>
                  : <CheckCircle2 className="w-4 h-4 text-go-ok" />}
              </button>
            );
          })}
          <span aria-hidden className="absolute bottom-0 h-[3px] rounded-t-full go-grad transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ left: bar.left + 8, width: Math.max(0, bar.width - 16) }} />
        </div>
      </div>

      {/* Panels — swipe sideways between tabs */}
      <div ref={panelsRef} onScroll={onPanelsScroll} style={{ height: panelH }}
        className="flex items-start overflow-x-auto overflow-y-hidden go-scroll snap-x snap-mandatory mt-3 transition-[height] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]">
        {tabs.map(g => (
          <div key={g} ref={el => { panelEls.current[g] = el; }} role="tabpanel" className="w-full flex-shrink-0 snap-center px-4">
            {g === 'notes' ? (
              <Card className="p-3.5">
      {/* Case instructions — always editable, prefilled from the read */}
      <div>
        <Label optional>Case instructions</Label>
        <TextArea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific instructions for the lab…" />
      </div>

      {/* Attachments — the source photo / voice note is always attached */}
      <div className="mt-4">
        <Label optional>Attachments</Label>
        <div className="flex flex-wrap gap-2">
          {/* The Rx photo is part of the case; a voice note only fills the form, so it isn't attached */}
          {sourceFile && (
            <span className="inline-flex items-center gap-1.5 h-9 pl-3 pr-3 rounded-full bg-go-surface border border-go-line text-[12.5px] font-medium text-go-ink2">
              <ImagePlus className="w-3.5 h-3.5 text-go-brand" />{sourceFile}
            </span>
          )}
          {files.map((a, i) => (
            <span key={a + i} className="inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-full bg-go-surface border border-go-line text-[12.5px] font-medium text-go-ink2">
              <Paperclip className="w-3.5 h-3.5 text-go-muted" />{a}
              <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} aria-label={`Remove ${a}`}><X className="w-3.5 h-3.5 text-go-muted" /></button>
            </span>
          ))}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
            onChange={e => { setFiles(fs => [...fs, ...Array.from(e.target.files ?? []).map(x => x.name)]); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-dashed border-go-brand/50 text-[12.5px] font-semibold text-go-brand">
            <ImagePlus className="w-3.5 h-3.5" />Add files
          </button>
        </div>
      </div>

              </Card>
            ) : (
              <Card className="divide-y divide-go-line overflow-hidden">{fields.filter(x => x.group === g).map(Row)}</Card>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {tabs.map(g => (
          <button key={g} onClick={() => setTab(g)} aria-label={`Go to ${g === 'shared' ? 'Case details' : g === 'notes' ? 'Instructions & files' : g}`}
            className={cx('h-1.5 rounded-full transition-all duration-300', tab === g ? 'w-5 go-grad' : pendingIn(g) ? 'w-1.5 bg-go-warn' : 'w-1.5 bg-go-line')} />
        ))}
      </div>

      <p className="px-5 mt-4 text-[12px] text-go-muted leading-relaxed">
        {mode === 'audio' ? 'Heard' : 'Read'} for {clinicianName('reed')} · {labName('northstar')} · {patientById('P-10450').name}. You stay responsible for the prescription. Check it before you authorise.
      </p>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.label} sub={editing?.note}
        footer={<Btn block disabled={!draft} onClick={() => editing && confirm(editing.key, draft)}>{editing?.optional ? 'Add' : 'Confirm'}</Btn>}>
        {editing?.kind === 'shade' && <Chips options={SHADES} value={draft} onChange={setDraft} />}
        {editing?.kind === 'material' && <Chips options={MATERIALS} value={draft} onChange={setDraft} />}
        {editing?.kind === 'extra' && <Chips options={editing.options ?? []} value={draft} onChange={setDraft} />}
        {editing?.kind === 'funding' && <Chips options={['NHS', 'Private'] as const} value={draft as 'NHS' | 'Private'} onChange={setDraft} />}
        {editing?.kind === 'date' && (
          <>
            <Input type="date" value={draft} onChange={e => setDraft(e.target.value)} />
            {draft && <p className="text-[12.5px] text-go-muted mt-2 px-1">{editing.label} {fmtDate(new Date(draft).toISOString())}</p>}
          </>
        )}
        {editing && !editing.optional && (
          <div className="mt-4 p-3 rounded-2xl bg-go-raised flex items-center gap-3">
            {mode === 'audio' ? <span className="w-10 h-10 rounded-full go-grad text-white flex items-center justify-center flex-shrink-0"><Mic className="w-5 h-5" /></span> : <PaperRx className="w-10 h-12 rounded" />}
            <p className="text-[12px] text-go-muted">{mode === 'audio' ? 'You said' : 'Written on the form'}: <span className="font-semibold text-go-ink">{editing.value || 'nothing'}</span></p>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
