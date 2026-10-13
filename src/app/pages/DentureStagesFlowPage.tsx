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
//   2. Denture stages are dated one by one; a date set on one ticked stage
//      autofills the other ticked stages (no manual copy button).
//   3. A follow-up prescription for an existing denture case is appended to
//      that case as a new stage order (no duplicate case, no duplicate stage).
//   4. No matching case → a new case; stages done before it reached Smile
//      Genius are marked "Done elsewhere" (done, but not on this portal).
//   5. The service / stage dates appear in the creation summary.
// Round 2 (9-Oct-2026 feedback): dentures pick an arch instead of teeth; stage
// dates are edited upfront on the service card, one stage per row; no
// "Initial / Order N" grouping — one row per stage everywhere; no case-level
// date on multi-service cases and no service-level date on a denture.
// Round 3 (team walkthrough): upcoming stages never take a past date (only the
// user marks "Done elsewhere"); stages are received one by one or all at once;
// the list shows Updated On per stage, a count pill on stage parents and no
// status on parents with sub-items; a follow-up draft hangs under its matched
// case as "Draft - New Stage"; the submit button can also "Create a new case".
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
    label: 'Single manual case',
    blurb: 'A clinic user creates a case by hand with one denture service. Stages are picked and dated upfront (a date set on one stage fills the other ticked stages), past dates are refused, and there is no “Done elsewhere” on manual entry. The case then reads the same way on the list, the detail page and the creation screen.',
    steps: [
      {
        title: 'List — one denture case',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'CASE-DN-3001 (John Smith): the parent row shows a count pill (“1 Stage”) instead of a status. Its chevron opens one row per stage order. The three stages were ordered together, so they read as one row, “Special Tray, Bite Registration, Try In”, with one status, its Updated On and delivery date.',
        shows: ['Count pill, no parent status', 'Stages ordered together = one row', 'Updated On per stage row'],
        tryIt: ['Find CASE-DN-3001 and open the chevron'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
      {
        title: 'Detail — stage orders',
        persona: 'clinic',
        icon: <ClipboardList className="w-4 h-4" />,
        description: 'The header has no case status. The stage orders card groups the stage tabs by order (one tight group here), lists each stage with status, created / updated on and an editable date, and has “Mark received” at the end of each open stage (not on Completed ones), plus “Mark all as Received”. Receiving marks only those stages. “New Stage Order” opens Quick Stage Order, with case instructions for the picked stages and “Edit full case”.',
        shows: ['Grouped stage tabs', 'Mark received per stage / all', 'Quick Stage Order'],
        tryIt: ['Mark Try In as received', 'Open New Stage Order and pick Retry + Finish: one date fills both'],
        path: '/clinic/cases/CASE-DN-3001',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Create — manual Quick Create',
        persona: 'clinic',
        icon: <FilePen className="w-4 h-4" />,
        description: 'Add a Partial Denture. The service card lists the picked stages one per row, each with its delivery date, aligned to the right like a single-unit service. A both-arch denture shows an Upper arch row and a Lower arch row. A past date on an upcoming stage is refused, and “Done elsewhere” is not offered on a manual case.',
        shows: ['Dates autofill across ticked stages', 'No past dates', 'No “Done elsewhere”'],
        tryIt: ['Tick Special Tray, give it a date, then tick Try In: it takes the same date'],
        path: '/clinic/cases/quick-new',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Multi-service manual case (with a denture)',
    blurb: 'One manual case with a denture and another service. Nothing at case level: no status or date on the parent, and each service carries its own.',
    steps: [
      {
        title: 'List — services and stages',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'CASE-DN-3002 (Amira Khan): “2 Services” opens the services. The Partial Denture service row shows “3 Stages” with no status, and one row per stage order (three separate orders here), each with its status, Updated On and date. The Crown keeps its own status and date.',
        shows: ['“2 Services” → “3 Stages”', 'Three separate stage orders', 'Crown · own status and date'],
        tryIt: ['Open “2 Services”, then the chevron on the Partial Denture row'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
      {
        title: 'Detail — case summary and stage tabs',
        persona: 'clinic',
        icon: <Layers className="w-4 h-4" />,
        description: 'No case status or Mark as Received in the header. On Case Summary, the Partial Denture card lists each stage with status, date and “Mark received” at the end (not on Completed), with “Mark all as Received” and “New Stage Order” in the footer. The Crown card shows its delivery date next to its timeline, and a faint icon fills any leftover space. In the Partial Denture tab, each of the three orders is its own tab group.',
        shows: ['Mark received per stage · Mark all', 'Crown date beside its timeline', 'Three separate order groups'],
        tryIt: ['Tick Mark received on Bite Registration, then use Mark all as Received'],
        path: '/clinic/cases/CASE-DN-3002',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Create — manual, denture + Crown',
        persona: 'clinic',
        icon: <FilePen className="w-4 h-4" />,
        description: 'Add a Partial Denture and a Crown. The Crown has its own delivery date on its card; the denture has dated stages. Neither takes a past date, and nothing can be marked as done elsewhere.',
        shows: ['Crown date on its card', 'Denture stages on its card'],
        tryIt: ['Add both services and give the Crown a different date'],
        path: '/clinic/cases/quick-new',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Scanner case matches a multi-service case — earlier stages matched',
    blurb: 'A scanner-created Finish prescription for Priya Shah arrives as a draft. She already has CASE-DN-3004 (Partial Denture + Crown), and the denture’s earlier stages were all ordered here, so they show as Completed. Only the new stage is a draft.',
    steps: [
      {
        title: 'List — the draft under its case',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'CASE-DRAFT-DN3 has no status of its own and is not clickable. Its chevron lists the earlier stages from CASE-DN-3004 (Special Tray, Bite Registration, Try In as one Completed row) and then Finish as “Draft - New Stage”. Clicking the earlier row opens CASE-DN-3004; clicking the draft row opens the prescription.',
        shows: ['Earlier stages: Completed', 'Finish: Draft - New Stage', 'Earlier row opens CASE-DN-3004'],
        tryIt: ['Find CASE-DRAFT-DN3 (Priya Shah) and open the chevron'],
        path: '/clinic/cases',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Detail — the matched case',
        persona: 'clinic',
        icon: <ClipboardList className="w-4 h-4" />,
        description: 'CASE-DN-3004 is a multi-service case. Its Partial Denture stages are all Completed, so no receive buttons show on them, and a new stage order is what moves the work on. The Crown card has its own date and status.',
        shows: ['Stages Completed', 'No receive buttons on Completed'],
        path: '/clinic/cases/CASE-DN-3004',
        portal: 'clinic',
      },
      {
        title: 'Draft — matching case found',
        persona: 'system',
        icon: <GitMerge className="w-4 h-4" />,
        description: 'The draft opens in Quick Create with a green “Matching case found — CASE-DN-3004” panel, the earlier stages locked as Completed, and only Finish to date. The submit button reads “Add to CASE-DN-3004”. Its arrow offers “Create a new case” instead, with an info icon explaining the choice.',
        shows: ['Matching case found', 'Earlier stages locked · Completed', 'Add to CASE-DN-3004 / Create a new case'],
        tryIt: ['Open the arrow beside the button and look at both options'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-DN3',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Scanner case matches a multi-service case — earlier stages not matched',
    blurb: 'A scanner-created Finish prescription for Daniel Ortiz matches CASE-DN-3005 (Full Denture + Night Guard), but that case’s earlier stages were not done on this portal. They were done at his previous lab, so they show as “Done elsewhere”, not as a status.',
    steps: [
      {
        title: 'List — the draft under its case',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'CASE-DRAFT-DN4 hangs the earlier stages from CASE-DN-3005 under it, with the Special Tray and Bite Registration rows tagged “Done elsewhere” and their done-on dates, then Try In, then Finish as “Draft - New Stage”.',
        shows: ['Earlier stages: Done elsewhere', 'Finish: Draft - New Stage'],
        tryIt: ['Find CASE-DRAFT-DN4 (Daniel Ortiz) and open the chevron'],
        path: '/clinic/cases',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Detail — the matched case',
        persona: 'clinic',
        icon: <History className="w-4 h-4" />,
        description: 'CASE-DN-3005 lists Special Tray and Bite Registration as “Done elsewhere” in a note above the stage tabs, with their done-on dates. Try In is the open stage and has the receive button. The Night Guard card has its own date.',
        shows: ['Done elsewhere · done-on dates', 'Try In: open'],
        path: '/clinic/cases/CASE-DN-3005',
        portal: 'clinic',
      },
      {
        title: 'Draft — matching case found',
        persona: 'system',
        icon: <GitMerge className="w-4 h-4" />,
        description: 'The draft opens in Quick Create with “Matching case found — CASE-DN-3005”. The earlier stages are locked and shown as Done elsewhere, only Finish is dated, and the submit button reads “Add to CASE-DN-3005” with the “Create a new case” option beside it.',
        shows: ['Matching case found', 'Earlier stages locked · Done elsewhere', 'Add to CASE-DN-3005'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-DN4',
        portal: 'clinic',
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
  const demoCreated = created;
  const dirty = appends.length > 0 || demoCreated.length > 0;

  const open = (step: Step) => {
    // Walkthroughs never stop at the login page: sign in with the demo
    // account behind the scenes and land on the step's screen.
    if (!isAuthed) login(DEMO_ACCOUNT_EMAIL, 'demo');
    navigate(step.path);
  };

  const resetDemo = () => {
    resetStageAppends();
    removeCreatedCases(() => true);
    toast.success('Demo data reset: added stage orders and newly created cases removed.');
  };

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
              October 2026 · 4 scenarios
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Denture stages &amp; service-level dates</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Four clinic scenarios for a denture treatment that arrives in several prescriptions over time. Each one is shown on three screens: the case list, the case detail page and the creation / draft screen. Each step opens the exact screen.
            </p>
          </div>

          {/* Demo controls — the follow-up + new-case steps write demo data */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dirty ? 'bg-[#F59E0B]' : 'bg-[#2E7D32]'}`} />
              <p className="text-xs text-[#5A5568] min-w-0">
                {dirty
                  ? <>Demo data changed: <span className="font-semibold text-[#030213]">{appends.length}</span> follow-up stage order{appends.length === 1 ? '' : 's'}, <span className="font-semibold text-[#030213]">{demoCreated.length}</span> new denture case{demoCreated.length === 1 ? '' : 's'}</>
                  : <>Demo data is fresh: no stage orders added and no new cases created</>}
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

          {/* Scenarios — one compact card each, with a navigation per screen */}
          <div className="space-y-4">
            {STAGES.map((stage, si) => (
              <section key={stage.label} className="bg-white border border-[#E0E0E6] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[11px] font-bold flex items-center justify-center tabular-nums flex-shrink-0">{si + 1}</span>
                    <h2 className="text-sm font-bold text-[#030213] leading-snug">{stage.label}</h2>
                  </div>
                  <p className="text-xs text-[#717182] leading-relaxed mt-1.5">{stage.blurb}</p>
                </div>
                <div className="divide-y divide-[#F0EFF6] border-t border-[#F0EFF6]">
                  {stage.steps.map(step => (
                    <div key={step.title} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                      <span className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#5A5568] flex items-center justify-center flex-shrink-0">{step.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#030213] leading-snug">{step.title}</p>
                        {step.shows && (
                          <p className="text-[11px] text-[#717182] leading-snug truncate" title={step.description}>{step.shows.join(' · ')}</p>
                        )}
                      </div>
                      <button
                        onClick={() => open(step)}
                        title={step.description}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
                      >
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
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
