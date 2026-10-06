import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, ChevronRight, ImageUp, RotateCcw, Sparkles, X, Zap, ZapOff } from '../icons';
import { useGo } from '../store';
import { LabCase, MATERIALS, RxItem, SHADES, clinicianName, fmtDate, labName, patientById } from '../data';
import { Btn, Card, Chips, Input, Pill, Screen, Sheet, TopBar, cx, useBack } from '../ui';
import { CaseCreated, CaseForm, buildCase, emptyForm } from './ManualCase';

type Phase = 'camera' | 'reading' | 'review' | 'done';
type Conf = 'read' | 'unclear' | 'missing';
type Kind = 'text' | 'shade' | 'funding' | 'date' | 'material';
/** group: 'shared' for prescription-wide details, 'i1', 'i2'… for each service item. */
interface Extracted { key: string; group: string; label: string; value: string; conf: Conf; note?: string; kind: Kind }
export type RxScenario = 'single' | 'multi' | 'clean';

// Fade the tab strip's edges so overflowing tabs read as scrollable
const FADE = 'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 28px), transparent 100%)';

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// What the "AI read" of the demo prescription returns, per demo scenario.
function readFor(rx: RxScenario): Extracted[] {
  const clean = rx === 'clean';
  const f = (group: string, key: string, label: string, value: string, conf: Conf = 'read', note?: string, kind: Kind = 'text'): Extracted =>
    ({ key: `${group}.${key}`, group, label, value, conf, note, kind });
  const shared = [
    f('shared', 'patient', 'Patient', 'Tom Hughes · DOB 03/08/1985', 'read', 'Matched P-10450'),
    f('shared', 'clinician', 'Prescribing clinician', 'Dr Olivia Reed', 'read', 'Signature found'),
    f('shared', 'lab', 'Dental laboratory', 'Northstar Dental Lab'),
    clean ? f('shared', 'returnBy', 'Requested return date', plusDays(9), 'read', undefined, 'date')
      : f('shared', 'returnBy', 'Requested return date', 'Wed/09', 'unclear', 'Wed/09 — month required', 'date'),
    clean ? f('shared', 'funding', 'NHS / Private', 'Private', 'read', undefined, 'funding')
      : f('shared', 'funding', 'NHS / Private', '', 'missing', 'Not found on the form', 'funding'),
    f('shared', 'instructions', 'Case instructions', rx === 'multi'
      ? 'Crown: light contacts, match LL4. Night guard: hard, 2 mm. Bridge: modified ridge lap pontic. Trays: reservoirs on.'
      : 'Light contacts. Match adjacent LL4 characterisation.'),
  ];
  const item1 = [
    f('i1', 'service', 'Service', 'Crown'),
    f('i1', 'teeth', 'Tooth notation', 'LL5'),
    f('i1', 'material', 'Material', 'Lithium disilicate (e.max)', 'read', undefined, 'material'),
    clean ? f('i1', 'shade', 'Shade', 'A2', 'read', undefined, 'shade') : f('i1', 'shade', 'Shade', 'A2 or A3?', 'unclear', 'Unclear — please confirm', 'shade'),
  ];
  const item2 = [
    f('i2', 'service', 'Service', 'Night guard'),
    f('i2', 'teeth', 'Teeth / arch', 'Upper arch'),
    f('i2', 'material', 'Material', 'Hard acr…?', 'unclear', 'Handwriting unclear — pick the material', 'material'),
  ];
  const item3 = [
    f('i3', 'service', 'Service', 'Bridge'),
    f('i3', 'teeth', 'Tooth notation', 'UR4–UR6'),
    f('i3', 'material', 'Material', 'Porcelain fused to metal', 'read', undefined, 'material'),
    f('i3', 'shade', 'Shade', 'A3', 'read', undefined, 'shade'),
  ];
  const item4 = [
    f('i4', 'service', 'Service', 'Whitening trays'),
    f('i4', 'teeth', 'Teeth / arch', 'Both arches'),
    f('i4', 'material', 'Material', 'Flexible nylon', 'read', undefined, 'material'),
  ];
  return rx === 'multi' ? [...shared, ...item1, ...item2, ...item3, ...item4] : [...shared, ...item1];
}

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

function Reading({ onDone }: { onDone: () => void }) {
  const steps = ['Finding the prescription', 'Reading handwriting', 'Matching patient, clinician and lab'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => x + 1), 650);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (i >= steps.length) onDone(); }, [i, onDone, steps.length]);
  return (
    <Screen>
      <div className="flex flex-col items-center px-8 pt-20">
        <div className="relative w-40 h-52">
          <PaperRx className="w-full h-full rounded-xl" />
          <span className="go-scanline absolute left-0 right-0 h-1 go-grad shadow-[0_0_20px_4px_rgba(77,142,247,.5)]" />
        </div>
        <p className="mt-8 inline-flex items-center gap-2 text-[17px] font-semibold text-go-ink"><Sparkles className="w-5 h-5 text-go-lav" />Reading prescription…</p>
        <div className="mt-6 w-full space-y-3">
          {steps.map((s, k) => (
            <div key={s} className={cx('flex items-center gap-3 text-[14px] transition', k <= i ? 'text-go-ink' : 'text-go-faint')}>
              <span className={cx('w-6 h-6 rounded-full flex items-center justify-center', k < i ? 'go-grad text-white' : k === i ? 'border-2 border-go-brand' : 'border-2 border-go-line')}>
                {k < i ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : k === i ? <span className="w-2 h-2 rounded-full bg-go-brand go-pulse" /> : null}
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

export default function CaptureScreen() {
  const { addCase } = useGo();
  const [params] = useSearchParams();
  const rx = (['multi', 'clean'].includes(params.get('rx') ?? '') ? params.get('rx') : 'single') as RxScenario;
  const [phase, setPhase] = useState<Phase>('camera');
  const [fields, setFields] = useState<Extracted[]>(() => readFor(rx));
  const [editing, setEditing] = useState<Extracted | null>(null);
  const [draft, setDraft] = useState('');
  const [created, setCreated] = useState<LabCase | null>(null);
  // Jumping between scenarios on the same route restarts the flow.
  useEffect(() => { setFields(readFor(rx)); setPhase('camera'); setCreated(null); }, [rx]);
  const pending = fields.filter(x => x.conf !== 'read');
  const groups = [...new Set(fields.map(x => x.group))];
  const itemGroups = groups.filter(g => g !== 'shared');
  // One tab per service item + one for the shared details (patient, lab, return).
  const tabs = [...itemGroups, 'shared'];
  const [tab, setTab] = useState<string>('i1');
  useEffect(() => { setTab('i1'); }, [rx]);
  const pendingIn = (g: string, fs = fields) => fs.filter(x => x.group === g && x.conf !== 'read').length;

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
    // Container follows the active panel's height so short tabs don't leave a gap
    const p = panelEls.current[tab];
    if (p) setPanelH(p.offsetHeight);
    const i = tabs.indexOf(tab);
    if (panels && i >= 0 && Math.round(panels.scrollLeft / panels.clientWidth) !== i) {
      autoScrolling.current = true;
      panels.scrollTo({ left: i * panels.clientWidth, behavior: 'smooth' });
      setTimeout(() => { autoScrolling.current = false; }, 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, phase, fields]);
  const onPanelsScroll = () => {
    const p = panelsRef.current;
    if (!p || autoScrolling.current) return;
    const g = tabs[Math.round(p.scrollLeft / p.clientWidth)];
    if (g && g !== tab) setTab(g);
  };

  const confirm = (key: string, value: string) => {
    const next = fields.map(x => (x.key === key ? { ...x, value, conf: 'read' as Conf, note: 'Confirmed by you' } : x));
    setFields(next);
    setEditing(null);
    // Tab finished → hop to the next one that still needs a look
    if (!pendingIn(tab, next)) {
      const after = [...tabs.slice(tabs.indexOf(tab) + 1), ...tabs.slice(0, tabs.indexOf(tab))].find(g => pendingIn(g, next));
      if (after) setTimeout(() => setTab(after), 250);
    }
  };
  const open = (x: Extracted) => {
    setDraft(x.kind === 'date' ? plusDays(9) : x.kind === 'shade' ? 'A2' : x.kind === 'material' && x.value.startsWith('Hard acr') ? 'Acrylic' : '');
    setEditing(x);
  };

  const create = () => {
    const get = (k: string) => fields.find(x => x.key === k)?.value ?? '';
    const items: RxItem[] = itemGroups.map(g => ({
      service: get(`${g}.service`), teeth: [get(`${g}.teeth`)], material: get(`${g}.material`), shade: get(`${g}.shade`) || undefined,
    }));
    const f: CaseForm = {
      ...emptyForm(), practice: 'cds', clinician: 'reed', patientId: 'P-10450', lab: 'northstar', service: items[0].service,
      teeth: items[0].teeth, material: items[0].material, shade: items[0].shade ?? null, funding: get('shared.funding') as 'NHS' | 'Private',
      returnBy: get('shared.returnBy'), instructions: get('shared.instructions'), attachments: ['Prescription photo'],
    };
    const c: LabCase = { ...buildCase(f, 'photo'), items: items.length > 1 ? items.slice(1) : undefined };
    addCase(c);
    setCreated(c);
    setPhase('done');
  };

  if (phase === 'camera') return <CameraView onShot={() => setPhase('reading')} />;
  if (phase === 'reading') return <Reading onDone={() => setPhase('review')} />;
  if (phase === 'done' && created) return <CaseCreated c={created} />;

  const Row = (x: Extracted) => {
    const c = CONF[x.conf];
    const needs = x.conf !== 'read';
    const shown = x.kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(x.value) ? fmtDate(new Date(x.value).toISOString()) : x.value;
    return (
      <button key={x.key} disabled={!needs} onClick={() => open(x)}
        className={cx('w-full text-left flex items-center gap-3 px-3.5 py-3 transition',
          needs && (x.conf === 'missing' ? 'bg-go-bad-soft/70' : 'bg-go-warn-soft/70'))}>
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] text-go-muted">{x.label}</p>
          <p className={cx('text-[14px] font-semibold mt-0.5', x.value ? 'text-go-ink' : 'text-go-faint italic')}>{shown || 'Not found'}</p>
          {x.note && <p className={cx('text-[11.5px] mt-0.5', needs ? (x.conf === 'missing' ? 'text-go-bad' : 'text-go-warn') : 'text-go-muted')}>{x.note}</p>}
        </div>
        {needs ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-go-brand">Confirm<ChevronRight className="w-4 h-4" /></span>
          : <Pill tone={c.tone} className="!h-[22px] !px-2"><CheckCircle2 className="w-3.5 h-3.5" />{c.label}</Pill>}
      </button>
    );
  };

  return (
    <Screen
      header={<TopBar back fallback="/go/home" title="Check every detail" sub={itemGroups.length > 1 ? `Multi-service · ${itemGroups.length} items` : 'Extraction review'}
        right={<button onClick={() => { setFields(readFor(rx)); setPhase('camera'); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-go-brand pr-1"><RotateCcw className="w-4 h-4" />Retake</button>} />}
      footer={<Btn block disabled={!!pending.length} onClick={create}>{pending.length ? `Confirm ${pending.length} detail${pending.length > 1 ? 's' : ''} to continue` : 'Authorise & create lab work'}</Btn>}>
      <div className="px-4 pt-1">
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
        {pending.length ? (
          <div className="mt-3 flex items-center gap-2.5 p-3 rounded-2xl bg-go-warn-soft text-go-warn">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-[13px] font-medium">{pending.length} need review. Tap each one to confirm.</p>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2.5 p-3 rounded-2xl bg-go-ok-soft text-go-ok">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-[13px] font-medium">Everything was read. Check it over, then authorise.</p>
          </div>
        )}
      </div>

      {/* Tab bar — one tab per service + Shared. Scrolls sideways with faded
          edges; a gradient underline slides to the active tab. Sticky so it
          stays reachable while reading a long tab. */}
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
                {g !== 'shared' && (
                  <span className={cx('w-[18px] h-[18px] rounded-md text-[10.5px] font-bold flex items-center justify-center transition',
                    on ? 'go-grad text-white' : 'bg-go-raised text-go-muted border border-go-line')}>{i + 1}</span>
                )}
                {g === 'shared' ? 'Patient & lab' : <>{svc} <span className="font-medium opacity-60">{teeth}</span></>}
                {n ? <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-go-warn text-white text-[10.5px] font-bold flex items-center justify-center">{n}</span>
                  : <CheckCircle2 className="w-4 h-4 text-go-ok" />}
              </button>
            );
          })}
          <span aria-hidden className="absolute bottom-0 h-[3px] rounded-t-full go-grad transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ left: bar.left + 8, width: Math.max(0, bar.width - 16) }} />
        </div>
      </div>

      {/* Panels — swipe sideways between tabs; synced with the tab bar */}
      <div ref={panelsRef} onScroll={onPanelsScroll} style={{ height: panelH }}
        className="flex items-start overflow-x-auto overflow-y-hidden go-scroll snap-x snap-mandatory mt-3 transition-[height] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]">
        {tabs.map(g => (
          <div key={g} ref={el => { panelEls.current[g] = el; }} role="tabpanel" className="w-full flex-shrink-0 snap-center px-4">
            <Card className="divide-y divide-go-line overflow-hidden">{fields.filter(x => x.group === g).map(Row)}</Card>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {tabs.map(g => (
          <button key={g} onClick={() => setTab(g)} aria-label={`Go to ${g === 'shared' ? 'Patient & lab' : g}`}
            className={cx('h-1.5 rounded-full transition-all duration-300', tab === g ? 'w-5 go-grad' : pendingIn(g) ? 'w-1.5 bg-go-warn' : 'w-1.5 bg-go-line')} />
        ))}
      </div>
      <p className="px-5 mt-4 text-[12px] text-go-muted leading-relaxed">
        Read for {clinicianName('reed')} · {labName('northstar')} · {patientById('P-10450').name}. You stay responsible for the prescription. Check it before you authorise.
      </p>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.label} sub={editing?.note}
        footer={<Btn block disabled={!draft} onClick={() => editing && confirm(editing.key, draft)}>Confirm</Btn>}>
        {editing?.kind === 'shade' && <Chips options={SHADES} value={draft} onChange={setDraft} />}
        {editing?.kind === 'material' && <Chips options={MATERIALS} value={draft} onChange={setDraft} />}
        {editing?.kind === 'funding' && <Chips options={['NHS', 'Private'] as const} value={draft as 'NHS' | 'Private'} onChange={setDraft} />}
        {editing?.kind === 'date' && (
          <>
            <Input type="date" value={draft} onChange={e => setDraft(e.target.value)} />
            {draft && <p className="text-[12.5px] text-go-muted mt-2 px-1">Return by {fmtDate(new Date(draft).toISOString())}</p>}
          </>
        )}
        {editing && (
          <div className="mt-4 p-3 rounded-2xl bg-go-raised flex items-center gap-3">
            <PaperRx className="w-10 h-12 rounded" />
            <p className="text-[12px] text-go-muted">Written on the form: <span className="font-semibold text-go-ink">{editing.value || 'nothing'}</span></p>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
