// ─── Create case by audio / by photo ─────────────────────────────────────────
// Record (or photograph the lab form) → read it → open the same step-by-step
// form as "Manually", prefilled. Anything the read wasn't sure about is left
// empty and flagged, so the form highlights it until it's checked.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ImageUp, Mic, Pause, Play, RotateCcw, Sparkles, Stop, X, Zap, ZapOff } from '../icons';
import { Screen, TopBar, cx, useBack } from '../ui';
import { CaseForm, emptyForm, newItem } from './ManualCase';
import { PaperRx, ReadFlag, ReadMode, ReadSource, RxScenario, fmtDur } from './ReadSource';

type Mode = ReadMode;
type Phase = 'capture' | 'reading';
export type { RxScenario };

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const INSTRUCTIONS: Record<RxScenario, string> = {
  single: 'Light contacts. Match adjacent LL4 characterisation.',
  clean: 'Light contacts. Match adjacent LL4 characterisation.',
  multi: 'Crown: light contacts, match LL4. Night guard: hard, 2 mm. Bridge: modified ridge lap pontic. Trays: reservoirs on.',
};

/** Voice-note transcript; flagged bits are what the form asks you to check. */
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

/** What the read (voice transcription or photo OCR) returns, as a prefilled case form + flags. */
function readCase(rx: RxScenario, mode: Mode): { form: CaseForm; flags: ReadFlag[] } {
  const clean = rx === 'clean';
  const heard = mode === 'audio';
  const flags: ReadFlag[] = [];
  const flag = (field: string, label: string, heardAs: string, missing?: boolean) => flags.push({ field, label, heard: heardAs, missing });

  const crown = newItem('su-crown', { teeth: ['LL5'], material: 'Lithium Disilicate (e.max)', shade: clean ? 'A2' : null });
  if (!clean) flag(`${crown.uid}.shade`, 'Shade', heard ? 'A2… maybe A3' : 'A2/3 ?');
  const items = [crown];
  if (rx === 'multi') {
    const guard = newItem('ap-night-guard', { teeth: ['Upper arch'] });
    flag(`${guard.uid}.applianceOption`, 'Type', heard ? 'hard acrylic-ish' : 'Hard?');
    items.push(
      guard,
      newItem('br-screw-retained', { teeth: ['UR4', 'UR5', 'UR6'], material: 'Porcelain Fused to Metal (PFM)', shade: 'A3', details: { brand: 'Straumann · BLX · RB', abutmentMaterial: 'Chrome Cobalt' } }),
      newItem('ap-whitening-tray', { teeth: ['Both arches'], details: { applianceOption: 'Yes' } }),
    );
  }
  if (!clean) {
    flag('funding', 'Order type', '', true);
    flag('returnBy', 'Delivery date', heard ? 'Wednesday the ninth' : 'Wed/09');
  }
  const form: CaseForm = {
    ...emptyForm(),
    practice: 'cds', clinician: 'reed', patientId: 'P-10450', lab: 'northstar',
    funding: clean ? 'Private' : null, returnBy: clean ? plusDays(9) : '',
    caseSource: heard ? 'Voice note' : 'Photo of lab form',
    instructions: INSTRUCTIONS[rx],
    // The photo of the lab form is kept on the case; a voice note only fills the form
    attachments: heard ? [] : ['Lab form photo'],
    items,
  };
  return { form, flags };
}

function CameraView({ onShot }: { onShot: () => void }) {
  const back = useBack('/go/home');
  const [flash, setFlash] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="absolute inset-0 bg-[#05050B] text-white flex flex-col">
      <div className="flex items-center justify-between px-4 h-14">
        <button onClick={back} aria-label="Close camera" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
        <span className="text-[15px] font-semibold">Photograph a lab form</span>
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
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] go-pulse" />Form detected
        </span>
      </div>
      <p className="text-center text-[12.5px] text-white/70 px-10 leading-relaxed">Lay the whole form flat in good light. Demo only: nothing is uploaded.</p>
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
    <Screen header={<TopBar back fallback="/go/home" title="Dictate a case" />}>
      <div className="flex flex-col items-center px-6 pt-6">
        <p className="text-[13px] text-go-muted text-center leading-relaxed max-w-[280px]">
          Say the patient’s name, each item with teeth, material and shade, the lab and the delivery date.
        </p>

        {/* Waveform */}
        <div className="mt-10 h-24 w-full flex items-center justify-center gap-[3px]" aria-hidden>
          {bars.map((h, i) => (
            <span key={i} className={cx('w-[5px] rounded-full transition-all duration-100', rec ? 'go-grad' : 'bg-go-line')} style={{ height: `${Math.round(h * 96)}px` }} />
          ))}
        </div>
        <p className={cx('mt-4 text-[34px] font-bold tabular-nums tracking-tight', rec ? 'text-go-ink' : 'text-go-faint')}>{fmtDur(secs)}</p>
        <p className="text-[12.5px] text-go-muted h-5">{rec ? 'Listening… tap stop when you’re done' : secs ? 'Paused' : 'Tap to start'}</p>

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
    ? ['Transcribing your voice note', 'Picking out the case details', 'Matching patient, dentist and lab']
    : ['Finding the form', 'Reading the handwriting', 'Matching patient, dentist and lab'];
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
        <p className="mt-8 inline-flex items-center gap-2 text-[17px] font-semibold text-go-ink"><Sparkles className="w-5 h-5 text-go-lav" />{mode === 'audio' ? 'Writing up your note…' : 'Reading the form…'}</p>
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

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CaptureScreen({ mode = 'photo' }: { mode?: Mode }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rx = (['multi', 'clean'].includes(params.get('rx') ?? '') ? params.get('rx') : 'single') as RxScenario;
  const [phase, setPhase] = useState<Phase>('capture');
  const [secs, setSecs] = useState(42);
  // Jumping between scenarios on the same route restarts the flow.
  useEffect(() => setPhase('capture'), [rx, mode]);

  // Read done → the same form as "Manually", prefilled, with the unsure bits flagged
  const toForm = () => {
    const { form, flags } = readCase(rx, mode);
    const read: ReadSource = { mode, rx, secs, transcript: TRANSCRIPT[rx], flags };
    navigate('/go/new/manual', { replace: true, state: { prefill: form, read } });
  };

  if (phase === 'capture') return mode === 'audio'
    ? <RecordView onDone={s => { setSecs(s); setPhase('reading'); }} />
    : <CameraView onShot={() => setPhase('reading')} />;
  return <Reading mode={mode} onDone={toForm} />;
}
