import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Layers, Stethoscope, FlaskConical, Cpu, CalendarDays, CopyCheck,
  GitMerge, History, List, FilePen, ClipboardList, RotateCcw, Plus,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { resetStageAppends, useStageAppends, DENTURE_STAGES } from '../data/dentureStages';
import { removeCreatedCases, useCreatedCases } from '../data/createdCases';

// ─── Denture stages & service-level dates · Oct-2026 — flow walkthrough ──────
// Five developer tasks that change the case-creation and case screens of the
// Clinic and Lab portals together:
//   1. The requested delivery date moves from the case to each service.
//   2. Denture stages are dated one by one, with "Copy date to selected".
//   3. A follow-up prescription for an existing denture case is appended to
//      that case as a new stage order (no duplicate case, no duplicate stage).
//   4. No matching case → a new case; stages dated before it reached DOMS
//      show as "Done earlier".
//   5. The service / stage dates appear in the creation summary.
// Same shape as the other walkthroughs: each step opens the exact screen.

type Persona = 'clinic' | 'lab' | 'system';
type Portal = 'clinic' | 'lab';

interface Step {
  title: string;
  persona: Persona;
  icon: React.ReactNode;
  description: string;
  shows?: string[];
  tryIt?: string[];
  path: string;
  portal: Portal;
  highlight?: boolean;
}

interface Stage {
  label: string;
  blurb: string;
  steps: Step[];
}

const PERSONA: Record<Persona, { label: string; cls: string; icon: React.ReactNode }> = {
  clinic: { label: 'Clinic',              cls: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]', icon: <Stethoscope className="w-3 h-3" /> },
  lab:    { label: 'Lab',                 cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]', icon: <FlaskConical className="w-3 h-3" /> },
  system: { label: 'Smile Genius (auto)', cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', icon: <Cpu className="w-3 h-3" /> },
};

const STAGES: Stage[] = [
  {
    label: 'Delivery date moves from the case to each service',
    blurb: 'The case no longer has one Requested Delivery date. Every non-denture service (crown, bridge, veneer, aligner…) carries its own date. A denture has no service-level date at all: each stage is dated instead (task 2). The case list and the case page show the earliest date that is still ahead.',
    steps: [
      {
        title: 'Quick Create — clinic',
        persona: 'clinic',
        icon: <CalendarDays className="w-4 h-4" />,
        description: 'Case Details is down to Patient, Lab, Dentist and Order Type. Each service card in the Services card has its own “Requested delivery” date, and the same field opens at the top of the service drawer. A newly added service starts on the default date (14 days out).',
        shows: ['No case-level Delivery', 'Requested delivery on every service card'],
        tryIt: ['Add a second service and give it a different date'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-001',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Quick Create — lab',
        persona: 'lab',
        icon: <FlaskConical className="w-4 h-4" />,
        description: 'The lab enters cases on the same screen, so it gets the same per-service date.',
        shows: ['Same per-service date, lab wording'],
        path: '/lab/cases/quick-new/CASE-DRAFT-002',
        portal: 'lab',
      },
      {
        title: 'Detailed Create Case — clinic',
        persona: 'clinic',
        icon: <FilePen className="w-4 h-4" />,
        description: 'The “Case Order Details” card keeps Dentist on Record and Order Type only. The service editor asks for the Requested Delivery Date, or for stages and their dates when the service is a denture.',
        shows: ['Case Order Details without a date', 'Requested Delivery Date in the service editor'],
        path: '/clinic/cases/new',
        portal: 'clinic',
      },
      {
        title: 'Multi-service case: crown + denture',
        persona: 'clinic',
        icon: <Layers className="w-4 h-4" />,
        description: 'CASE-DN-3002 (Amira Khan) has a Crown with its own date (17-Jul-2026) and a Partial Denture dated per stage. The Case Summary cards show the crown’s date and, for the denture, the next open stage and its date.',
        shows: ['Crown · 17-Jul-2026', 'Partial Denture · Delivery · Bite Registration'],
        path: '/clinic/cases/CASE-DN-3002',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Date each denture stage, and copy a date across stages',
    blurb: `A denture has five stages: ${DENTURE_STAGES.join(', ')}. Ticking a stage enables its own date. “Copy date to selected” takes the first dated stage and writes that date onto every other ticked stage. A note under the list says there is no service-level date for dentures.`,
    steps: [
      {
        title: 'Stages & delivery dates in the service drawer',
        persona: 'clinic',
        icon: <CopyCheck className="w-4 h-4" />,
        description: 'CASE-DRAFT-DN2 is a Full Denture for Margaret Lee. Open the service (“Set stage dates”): the denture block lists all five stages, each with a date field. The service card shows every stage with its date. A stage with no date is flagged, and the service is not complete until every ticked stage has one.',
        shows: ['5 stages, one date each', 'Copy date to selected', 'No service-level delivery date for dentures'],
        tryIt: ['Tick Try In, give it a date, then tick Retry', 'Press “Copy date to selected”'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-DN2',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'New Stage Order on the case page — lab',
        persona: 'lab',
        icon: <Plus className="w-4 h-4" />,
        description: 'On a denture case, “New Stage Order” uses the same picker. Stages already ordered are listed, locked, with their date and status, and each new stage needs its own date before the order can be created. The stage table under the tabs shows every stage of the service, its status, its requested delivery date and the order it belongs to.',
        shows: ['Already-ordered stages locked', 'Stages · requested delivery table'],
        tryIt: ['Open Partial Denture → New Stage Order', 'Pick Try In + Finish, date one, copy it to the other'],
        path: '/lab/cases/CASE-DN-3002',
        portal: 'lab',
      },
      {
        title: 'Stages in the case list',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'The Status column is an accordion, and stages are listed the way the case page groups them: by stage order. On a denture case, the status pill has a chevron and an “N stage orders” count. Opening it shows one row per order, “Initial” then “Order 2”…, with the stages it covers, its status and the next open stage’s date. On a multi-service case, “N Services” opens the services, and the denture’s service row has its own chevron (a third level) for its stage orders.',
        shows: ['Status ▾ · N stage orders', 'Initial · Special Tray, Bite Registration, Try In', 'Case → service → stage orders'],
        tryIt: ['CASE-DN-3001 and CASE-DN-3002 sit at the top of the list: open the chevron by the status', 'On CASE-DN-3002, open “2 Services”, then the chevron on the Partial Denture row'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Follow-up prescription → add the stage to the existing case',
    blurb: 'When a denture prescription arrives for a patient who already has that denture case (same practice, patient, dentist and denture service), Smile Genius doesn’t create a new case. The new stages are appended to the existing case as a new stage order. Stages the case already has are skipped, never ordered twice.',
    steps: [
      {
        title: 'The follow-up is matched while you fill it',
        persona: 'system',
        icon: <GitMerge className="w-4 h-4" />,
        description: 'CASE-DRAFT-DN1 is a Finish prescription for John Smith, who already has CASE-DN-3001 (Special Tray, Bite Registration, Try In). A green “Matching case found” panel lists what is already ordered, and the submit button reads “Add to CASE-DN-3001”. In the drawer, those stages appear locked.',
        shows: ['Matching case found — CASE-DN-3001', 'Already ordered on CASE-DN-3001', 'Add to CASE-DN-3001'],
        tryIt: ['Open the service: Special Tray, Bite Registration and Try In are locked as already ordered', 'Tick Retry, copy Finish’s date onto it, then press “Add to CASE-DN-3001”'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-DN1',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Same from the lab side',
        persona: 'lab',
        icon: <FlaskConical className="w-4 h-4" />,
        description: 'The lab opening the same prescription sees the same match. The lab doesn’t need to pick the clinic first, because the existing case already has it.',
        path: '/lab/cases/quick-new/CASE-DRAFT-DN1',
        portal: 'lab',
      },
      {
        title: 'The case gains a stage order',
        persona: 'clinic',
        icon: <Layers className="w-4 h-4" />,
        description: 'After submitting, CASE-DN-3001 has a second stage-order tab. Finish (plus any other new stage) is listed in the stage table with its own date and a “Follow-up Rx” tag. No new case appears in the list.',
        shows: ['Order 2', 'Follow-up Rx', 'No duplicate case'],
        path: '/clinic/cases/CASE-DN-3001',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'No matching case → a new case, earlier stages marked done',
    blurb: 'If no existing case matches, the prescription creates a new case, even when it only asks for a later stage. Stages it lists with a date in the past were done before the case reached Smile Genius, so the case shows them as “Done earlier” instead of as open work.',
    steps: [
      {
        title: 'Past dates are called out while you fill it',
        persona: 'clinic',
        icon: <History className="w-4 h-4" />,
        description: 'CASE-DRAFT-DN2 lists Special Tray (20-Mar-2026) and Bite Registration (10-Apr-2026), both done at the patient’s previous lab, plus Finish (05-Jun-2026). In the picker, a past date shows “Past date — this stage will show as done earlier”. On the service card, it reads “· done earlier”.',
        shows: ['Past date — this stage will show as done earlier'],
        tryIt: ['Pick a lab and press Create case'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-DN2',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'The new case shows them as “Done earlier”',
        persona: 'system',
        icon: <History className="w-4 h-4" />,
        description: 'The created case (SG-…) shows Special Tray and Bite Registration with a “Done earlier” tag instead of a status, in the list’s stage rows and in the case’s stage table. Finish is the open stage, and its date leads the Delivery Date column.',
        shows: ['Done earlier', 'Finish · New'],
        tryIt: ['Search “Margaret” and expand the stages'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Service-level dates in the creation summary',
    blurb: 'Whatever summarises the case before it is submitted now carries the per-service dates, and the per-stage dates for a denture.',
    steps: [
      {
        title: 'Case Summary panel — detailed Create Case',
        persona: 'clinic',
        icon: <ClipboardList className="w-4 h-4" />,
        description: 'Each service in the Case Summary panel (left column) shows “Delivery · <date>”. A denture lists each selected stage with its date. A missing date shows in amber.',
        shows: ['Delivery · 02-Jun-2026', 'Special Tray · 05-May-2026 …'],
        path: '/clinic/cases/new',
        portal: 'clinic',
      },
      {
        title: 'Lab Order Form — Quick Create',
        persona: 'lab',
        icon: <ClipboardList className="w-4 h-4" />,
        description: 'The order-form preview (the left pane on scanner cases) drops the single Requested Delivery field. Each service lists its own Delivery, and a denture lists “Stages · requested delivery”.',
        shows: ['Delivery per service', 'Stages · requested delivery'],
        path: '/lab/cases/quick-new/CASE-DRAFT-DN2',
        portal: 'lab',
      },
    ],
  },
];

export default function DentureStagesFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { toast } = useToast();
  const isAuthed = !!user;
  const appends = useStageAppends();
  const created = useCreatedCases();
  const demoCreated = created.filter(c => c.patientName === 'Margaret Lee');
  const dirty = appends.length > 0 || demoCreated.length > 0;

  const open = (step: Step) => {
    // Walkthroughs never stop at the login page: sign in with the demo
    // account behind the scenes and land on the step's screen.
    if (!isAuthed) login(DEMO_ACCOUNT_EMAIL, 'demo');
    navigate(step.path);
  };

  const resetDemo = () => {
    resetStageAppends();
    removeCreatedCases(c => c.patientName === 'Margaret Lee');
    toast.success('Demo data reset: follow-up stages removed and the Margaret Lee case cleared.');
  };

  let n = 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="dentureflow_grad" />
        <button
          onClick={() => navigate('/flows')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to flows
        </button>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-16 pt-2">
        <div className="w-full max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] opacity-15 blur-xl" />
              <div className="relative w-16 h-16 rounded-3xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center">
                <Layers className="w-7 h-7 text-[#B45309]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FFF8E1] border border-[#FDE68A] text-[#B45309] mb-3">
              October 2026 · 5 tasks
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Denture stages &amp; service-level dates</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              One denture treatment, several prescriptions over time, every stage under a single case. These changes cover the case-creation and case screens in the Clinic and Lab portals. Each step opens the exact screen.
            </p>
          </div>

          {/* Demo controls — the follow-up + new-case steps write demo data */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dirty ? 'bg-[#F59E0B]' : 'bg-[#2E7D32]'}`} />
              <p className="text-xs text-[#5A5568] min-w-0">
                {dirty
                  ? <>Demo data changed: <span className="font-semibold text-[#030213]">{appends.length}</span> follow-up stage order{appends.length === 1 ? '' : 's'}, <span className="font-semibold text-[#030213]">{demoCreated.length}</span> new denture case{demoCreated.length === 1 ? '' : 's'}</>
                  : <>Demo data is fresh: CASE-DN-3001 has three stages and Margaret Lee has no case yet</>}
              </p>
            </div>
            <button
              onClick={resetDemo}
              disabled={!dirty}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset demo data
            </button>
          </div>

          {/* Tasks */}
          <div className="space-y-8">
            {STAGES.map((stage, si) => (
              <section key={stage.label}>
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A59DFF]">Task {si + 1}</span>
                  <h2 className="text-base font-bold text-[#030213]">{stage.label}</h2>
                </div>
                <p className="text-xs text-[#717182] leading-relaxed mb-3 max-w-2xl">{stage.blurb}</p>
                <div className="space-y-3">
                  {stage.steps.map(step => {
                    n += 1;
                    const p = PERSONA[step.persona];
                    return (
                      <div
                        key={step.title}
                        className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md ${
                          step.highlight ? 'border-[#DDD6FE] ring-1 ring-[#DDD6FE]' : 'border-[#E0E0E6]'
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-xs font-bold flex items-center justify-center tabular-nums">{n}</span>
                            <span className="w-8 h-8 rounded-lg bg-[#F3F3F5] text-[#5A5568] flex items-center justify-center">{step.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-[#030213] leading-snug">{step.title}</h3>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${p.cls}`}>
                                {p.icon}{p.label}
                              </span>
                              {step.highlight && (
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]">Key demo</span>
                              )}
                            </div>
                            <p className="text-xs text-[#5A5568] leading-relaxed mt-1.5">{step.description}</p>
                            {step.shows && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {step.shows.map(s => (
                                  <span key={s} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F8F9FC] text-[#5A5568] border border-[#F0EFF6]">{s}</span>
                                ))}
                              </div>
                            )}
                            {step.tryIt && (
                              <div className="mt-3 rounded-xl bg-[#F8F9FC] border border-[#F0EFF6] px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0B0] mb-1">Try it</p>
                                <ol className="space-y-0.5">
                                  {step.tryIt.map((t, i) => (
                                    <li key={t} className="text-[11px] text-[#5A5568] flex gap-2">
                                      <span className="text-[#A0A0B0] tabular-nums flex-shrink-0">{i + 1}.</span>
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                              <code className="text-[10px] text-[#A0A0B0] font-mono truncate">{step.path}</code>
                              <button
                                onClick={() => open(step)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity shadow-sm"
                              >
                                Open screen
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="px-6 pb-6 flex justify-center">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-[#8B8B9E] hover:text-[#030213] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to demo
        </button>
      </footer>
    </div>
  );
}
