// ─── New Case Flow · start from scratch ──────────────────────────────────────
// A blank create page in the chosen experience: nothing is known yet, so the
// page itself asks "Who is this case for?" with the patient picker right on it
// (no popup). Picking a patient (or a waiting scan) lands on that experience's
// case page. "Add new Case" on Lab Work opens here too.
//
// Guided and One page show their step timeline on the left from the start:
// Patient is the current step, everything after it not reached yet, the line
// still grey; One page's list also carries its optional Case Instructions.
// Conversation is one column by design, so the picker stands alone.
// No page header, like the case page: the corner above the steps holds
// ← Back to Lab Work and what this is, so the picker's lanes start high.
// The experience is chosen on the walkthrough, not here.

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { userById } from './data';
import { UX_OPTIONS } from './controller';
import { useFlowStore } from './store';
import PatientPicker from './PatientLauncher';
import { FOCUS } from './ui';
import { StepTimeline, TimelineRow, lineBelow } from './StepTimeline';

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

/** The case's steps before there is a case: only Patient can be acted on (it puts you in the search). */
function BlankSteps({ label, canvas, onPatient }: { label: string; canvas?: boolean; onPatient: () => void }) {
  const later = canvas ? LATER_CANVAS : LATER;
  const lines = lineBelow(['todo', ...later.map(() => 'todo' as const)]);
  return (
    <StepTimeline label={label}>
      <TimelineRow state="todo" label="Patient" value="Choose a patient" current onClick={onPatient} below={lines[0]} />
      {later.map((s, i) => <TimelineRow key={s.id} state="todo" label={s.label} value={s.value} disabled below={lines[i + 1]} />)}
    </StepTimeline>
  );
}

export default function BlankStart() {
  const navigate = useNavigate();
  const store = useFlowStore();
  const user = userById(store.userId)!;
  const ux = UX_OPTIONS.find(o => o.id === store.ux) ?? UX_OPTIONS[0];
  const chat = store.ux === 'chat';
  const pickerRef = useRef<HTMLDivElement>(null);
  const toSearch = () => pickerRef.current?.querySelector<HTMLElement>('input, button')?.focus();

  const picker = (
    <div ref={pickerRef} className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 mb-3">
        <h2 className="text-lg leading-6 font-semibold text-[#030213]">Who is this case for?</h2>
        <p className="text-[13px] leading-5 text-[#4A4A5A]">Search by name, date of birth or patient ID, pick up a waiting scan, or add a new patient.</p>
      </div>
      <PatientPicker
        mode="new"
        user={user}
        onOpenDraft={r => navigate(`/flows/new-case/case/${r.id}`, { replace: true, state: { session: `${r.id}-${Date.now()}` } })}
        onPick={pid => navigate(`/flows/new-case/case/new?patient=${encodeURIComponent(pid)}`, { replace: true, state: { session: `new-${Date.now()}` } })}
      />
    </div>
  );

  const corner = (
    <div className="mb-5 px-1">
      <button type="button" onClick={() => navigate('/flows/new-case/cases')} className={`inline-flex items-center gap-1.5 text-xs text-[#717182] hover:text-[#030213] transition-colors rounded ${FOCUS}`}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />Back to Lab Work
      </button>
      <p className="mt-3 text-sm font-semibold text-[#030213]">New case</p>
      <p className="mt-0.5 text-[11px] text-[#4A4A5A]">Starting from scratch · {ux.name}</p>
    </div>
  );

  return (
    <div className="min-w-[1100px] min-h-[calc(100vh-56px)] flex flex-col">
      <h1 className="sr-only">Create new Case</h1>
      {chat ? (
        <div className="flex-1 flex justify-center px-8 pt-6 pb-10">
          <div className="w-full max-w-[860px]">{corner}{picker}</div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[220px_minmax(0,1fr)] gap-6 px-8 pt-6 pb-10 items-start">
          <div className="sticky top-4">
            {corner}
            {store.ux === 'canvas' ? (
              // One page's navigator chrome: a card titled "Case sections".
              <div className="bg-white border border-[#E0E0E6] rounded-2xl">
                <p className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A4A5A]" aria-hidden>Case sections</p>
                <div className="px-2 pt-1 pb-2"><BlankSteps label="Case sections" canvas onPatient={toSearch} /></div>
              </div>
            ) : (
              <BlankSteps label="Case steps" onPatient={toSearch} />
            )}
          </div>
          {picker}
        </div>
      )}
    </div>
  );
}
