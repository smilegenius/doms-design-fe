// ─── New Case Flow · start from scratch ──────────────────────────────────────
// A blank create page in the chosen experience: nothing is known yet. Two tabs
// sit at the top of the page:
//   Describe with AI (the default, every visit) — the portal's "✨ AI ·
//     Describe the case" made the whole page: type into the template (or plain
//     words, or drop a prescription) and watch what Smile Genius understood;
//     Create Case builds the draft and opens it at what's missing (AiStart).
//   Enter Manually — the case step by step, starting at the step the timeline
//     shows: Patient, "Who is this case for?" with the patient picker right
//     on the page (no popup). Picking a patient moves on to
//     that experience's case page at its next step.
// "Add new Case" on Lab Work opens here too.
//
// Guided and One page show their step timeline on the left from the start:
// Patient is the current step, everything after it not reached yet, the line
// still grey; One page's list also carries its optional Case Instructions.
// While describing, the timeline fills in as the description is understood
// (patient, lab, services) and its rows jump to those lines of the template.
// Conversation is one column by design, so the tabs sit beside its corner.
// No page header, like the case page: the corner above the steps holds
// ← Back to Lab Work and what this is, so the content starts high.
// The experience is chosen on the walkthrough, not here.

import { KeyboardEvent, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, PenLine, Sparkles } from 'lucide-react';
import { userById } from './data';
import { UX_OPTIONS } from './controller';
import { useFlowStore } from './store';
import PatientPicker from './PatientLauncher';
import AiStart, { AiStartHandle, AiUnderstood } from './AiStart';
import { FOCUS } from './ui';
import { NodeState, StepTimeline, TimelineRow, lineBelow } from './StepTimeline';

type Later = { id: string; label: string; value?: string };
/** Everything after Patient, not reached yet. */
const LATER: Later[] = [
  { id: 'lab', label: 'Lab', value: 'After the patient' },
  { id: 'services', label: 'Services', value: 'What are we making?' },
  { id: 'records', label: 'Scans Source' },
  { id: 'prescriber', label: 'Prescriber' },
  { id: 'review', label: 'Review and Send' },
];
/** One page's navigator has Case Instructions just before Review. */
const LATER_CANVAS: Later[] = [...LATER.slice(0, -1), { id: 'instructions', label: 'Case Instructions', value: 'Optional' }, ...LATER.slice(-1)];

type Tab = 'ai' | 'pick';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ai', label: 'Describe with AI' },
  { id: 'pick', label: 'Enter Manually' },
];
type StepTarget = 'patient' | 'lab' | 'service';

/**
 * The case's steps before there is a case. Picking: only Patient can be acted
 * on (it puts you in the search). Describing (`understood`): Patient, Lab and
 * Services fill in as they're understood and take you to their template line.
 */
function BlankSteps({ label, canvas, onStep, understood }: {
  label: string; canvas?: boolean; onStep: (to: StepTarget) => void; understood?: AiUnderstood | null;
}) {
  const later = canvas ? LATER_CANVAS : LATER;
  const u = understood;
  const stateOf = (id: string): NodeState => {
    if (!u) return 'todo';
    if (id === 'patient') return u.patientReady ? 'done' : 'todo';
    if (id === 'lab') return u.labReady ? 'done' : 'todo';
    if (id === 'services') return u.servicesReady ? 'done' : 'todo';
    return 'todo';
  };
  const lines = lineBelow(['patient', ...later.map(s => s.id)].map(stateOf));
  const live = (id: string) => !!u && (id === 'lab' || id === 'services');
  // Until the description names it, a row says so (not "From your description", which reads as already taken).
  const WAITING = 'Not read yet';
  const valueOf = (s: Later) => {
    if (!u) return s.value;
    if (s.id === 'lab') return (u.labReady && u.lab) || WAITING;
    if (s.id === 'services') return u.services ?? WAITING;
    return s.value;
  };
  return (
    <StepTimeline label={label}>
      <TimelineRow
        state={stateOf('patient')}
        label="Patient"
        value={u ? u.patient ?? WAITING : 'Choose a patient'}
        current
        onClick={() => onStep('patient')}
        below={lines[0]}
      />
      {later.map((s, i) => (
        <TimelineRow
          key={s.id}
          state={stateOf(s.id)}
          label={s.label}
          value={valueOf(s)}
          disabled={!live(s.id)}
          onClick={live(s.id) ? () => onStep(s.id === 'lab' ? 'lab' : 'service') : undefined}
          below={lines[i + 1]}
        />
      ))}
    </StepTimeline>
  );
}

export default function BlankStart() {
  const navigate = useNavigate();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const ux = UX_OPTIONS.find(o => o.id === store.ux) ?? UX_OPTIONS[0];
  const chat = store.ux === 'chat';
  const uid = useId();
  // Describe with AI is the default on every visit; the picker mounts the first time it's opened.
  const [tab, setTab] = useState<Tab>('ai');
  // Back from a case's "Describe with AI": the case written as the template, to carry on from.
  const from = useLocation().state as { aiText?: string; fromCase?: string } | null;
  const carryOn = from?.aiText;
  const [pickSeen, setPickSeen] = useState(false);
  const [understood, setUnderstood] = useState<AiUnderstood | null>(null);
  const ai = tab === 'ai';
  const aiRef = useRef<AiStartHandle>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ ai: null, pick: null });
  const toSearch = () => pickerRef.current?.querySelector<HTMLElement>('input, button')?.focus();
  const onStep = (to: StepTarget) => (ai ? aiRef.current?.focusField(to) : toSearch());

  /** Arrow keys move along the tabs (and switch); a click or Enter also puts you in the tab's content. */
  const select = (t: Tab, via: 'key' | 'click') => {
    // Carrying on from a case: Enter Manually is that case, step by step.
    if (t === 'pick' && from?.fromCase) { navigate(`/flows/new-case/case/${from.fromCase}`, { replace: true, state: { session: `${from.fromCase}-${Date.now()}` } }); return; }
    setTab(t);
    if (t === 'pick') setPickSeen(true);
    if (via === 'key') { tabRefs.current[t]?.focus(); return; }
    requestAnimationFrame(() => (t === 'ai' ? aiRef.current?.focusField() : toSearch()));
  };
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex(t => t.id === tab);
    const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : -1;
    if (j < 0) return;
    e.preventDefault();
    select(TABS[j].id, 'key');
  };

  const tabBar = (
    <div role="tablist" aria-label="How to start the case" onKeyDown={onTabKey} className="inline-flex flex-shrink-0 p-1 rounded-xl bg-[#F0EFF6] border border-[#E0E0E6]">
      {TABS.map(t => {
        const on = tab === t.id;
        const Icon = t.id === 'ai' ? Sparkles : PenLine;
        return (
          <button
            key={t.id}
            ref={el => { tabRefs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => select(t.id, 'click')}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${FOCUS} ${
              on ? 'bg-white text-[#030213] shadow-[0_1px_3px_rgba(3,2,19,0.10),0_0_0_1px_rgba(224,224,230,0.9)]' : 'text-[#5A5A6A] hover:text-[#030213] hover:bg-white/60'
            }`}
          >
            <Icon className={`w-4 h-4 ${on ? (t.id === 'ai' ? 'text-[#6A5CE8]' : 'text-[#2F62D6]') : ''}`} strokeWidth={2} aria-hidden />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const picker = (
    <div ref={pickerRef} className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-3">
        {/* The timeline's current step, as the case page shows it. */}
        <p className="w-full text-[11px] font-bold uppercase tracking-widest text-[#5A5A6A]">Patient</p>
        <h2 className="text-lg leading-6 font-semibold text-[#030213]">Who is this case for?</h2>
        <p className="text-[13px] leading-5 text-[#4A4A5A]">Search by name, date of birth or patient ID, or add a new patient.</p>
      </div>
      <PatientPicker
        mode="new"
        user={user}
        autoFocus={false}
        onOpenDraft={r => navigate(`/flows/new-case/case/${r.id}`, { replace: true, state: { session: `${r.id}-${Date.now()}` } })}
        onPick={pid => navigate(`/flows/new-case/case/new?patient=${encodeURIComponent(pid)}`, { replace: true, state: { session: `new-${Date.now()}` } })}
      />
    </div>
  );

  const panels = (
    <>
      <div role="tabpanel" id={`${uid}-panel-ai`} aria-labelledby={`${uid}-tab-ai`} hidden={!ai} className="flex-1 min-h-0 mt-3">
        <AiStart ref={aiRef} onUnderstood={setUnderstood} initialText={carryOn} />
      </div>
      <div role="tabpanel" id={`${uid}-panel-pick`} aria-labelledby={`${uid}-tab-pick`} hidden={ai} className="mt-4">
        {(pickSeen || !ai) && picker}
      </div>
    </>
  );

  const corner = (margin: string) => (
    <div className={`${margin} px-1`}>
      <button type="button" onClick={() => navigate('/flows/new-case/cases')} className={`inline-flex items-center gap-1.5 text-xs text-[#717182] hover:text-[#030213] transition-colors rounded ${FOCUS}`}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />Back to Lab Work
      </button>
      <p className="mt-3 text-sm font-semibold text-[#030213]">New case</p>
      <p className="mt-0.5 text-[11px] text-[#4A4A5A]">Starting from scratch · {ux.name}</p>
    </div>
  );

  return (
    <div className={`min-w-[1100px] flex flex-col ${ai ? 'h-[calc(100vh-56px)] min-h-[560px]' : 'min-h-[calc(100vh-56px)]'}`}>
      <h1 className="sr-only">Create new Case</h1>
      {chat ? (
        <div className={`flex-1 min-h-0 flex justify-center px-8 pt-6 ${ai ? 'pb-5' : 'pb-10'}`}>
          <div className={`w-full min-h-0 flex flex-col transition-[max-width] duration-300 ease-out motion-reduce:transition-none ${ai ? 'max-w-[1180px]' : 'max-w-[860px]'}`}>
            <div className="flex items-end justify-between gap-4">
              {corner('')}
              {tabBar}
            </div>
            {panels}
          </div>
        </div>
      ) : (
        <div className={`flex-1 min-h-0 grid grid-cols-[220px_minmax(0,1fr)] gap-6 px-8 pt-6 ${ai ? 'pb-5 grid-rows-[minmax(0,1fr)]' : 'pb-10 items-start'}`}>
          <div className="sticky top-4 self-start">
            {corner('mb-5')}
            {store.ux === 'canvas' ? (
              // One page's navigator chrome: a card titled "Case sections".
              <div className="bg-white border border-[#E0E0E6] rounded-2xl">
                <p className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A4A5A]" aria-hidden>Case sections</p>
                <div className="px-2 pt-1 pb-2"><BlankSteps label="Case sections" canvas onStep={onStep} understood={ai ? understood : null} /></div>
              </div>
            ) : (
              <BlankSteps label="Case steps" onStep={onStep} understood={ai ? understood : null} />
            )}
          </div>
          <div className="min-w-0 min-h-0 flex flex-col">
            <div className="flex items-center gap-3">
              {tabBar}
              {ai && <p className="min-w-0 text-xs text-[#5A5A6A] truncate">Type it, paste it or drop a prescription. Smile Genius fills the case for you to check.</p>}
            </div>
            {panels}
          </div>
        </div>
      )}
    </div>
  );
}
