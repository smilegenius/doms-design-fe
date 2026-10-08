import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Wrench, Stethoscope, FlaskConical, Building2, Cpu, Sparkles, Mail,
  FilePen, Info, UserCircle2, List, RefreshCw, Unlink,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { connectionStatus, reconnectScanner, simulateStage, useScannerConnections } from '../data/scannerConnections';
import { SCANNER_SYNC_COPY } from '../data/caseProvenance';

// ─── Hotfixes · 30-Sep-2026 — flow walkthrough ───────────────────────────────
// Same shape as the CareStack / WhatsApp walkthroughs, for a round of small
// fixes that land across the Clinic, Lab and DSO portals together:
//   1. Email-made drafts say they need a person's review (list, creation
//      screen, case page).
//   2. A status the clinic changes only reaches the lab through a live scanner
//      integration — otherwise the clinic is told to let the lab know.
//   3. Lab Work (clinic) follows the live clinic portal's naming + columns,
//      and every case shows a lab / clinic icon for the side that created it.

type Persona = 'clinic' | 'lab' | 'dso' | 'system';
type Portal = 'clinic' | 'lab' | 'supplier';

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
  dso:    { label: 'DSO',                 cls: 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]', icon: <Building2 className="w-3 h-3" /> },
  system: { label: 'Smile Genius (auto)', cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', icon: <Cpu className="w-3 h-3" /> },
};

const STAGES: Stage[] = [
  {
    label: 'Email-made drafts need your review',
    blurb: 'A prescription that arrives by email becomes a Draft case on its own. Nobody typed it, so every place the draft appears now says so — and that it isn’t a live case until a person has checked it and submitted it.',
    steps: [
      {
        title: 'Flagged in Lab Work (clinic) and Cases (lab)',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'Email drafts sit at the top of the list — the clinic portal’s Lab Work page, the lab’s Cases page. Under the Draft status each one now carries a red “AI · Need Attention” badge, in both the table and the grid view — the same badge leads the banner on the creation screen and the case page.',
        shows: ['Draft', 'AI · Need Attention'],
        tryIt: ['Hover the tag for the reason', 'Switch to grid view — the tag is on the card too'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
      {
        title: 'On the creation screen — clinic',
        persona: 'clinic',
        icon: <FilePen className="w-4 h-4" />,
        description: 'Opening an email draft lands on the Quick Create screen, pre-filled. The banner at the top replaces the old AI-extraction note: it says Smile Genius created the case, from whose email and when, and that it hasn’t gone anywhere yet.',
        shows: ['“This case was created automatically from an email — it needs your review”', 'Sender · subject · received'],
        tryIt: ['Read the banner, check the fields, press Submit', 'Back on Lab Work, the new case carries the clinic icon in Created On'],
        path: '/clinic/cases/quick-new/CASE-DRAFT-001',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'On the creation screen — lab',
        persona: 'lab',
        icon: <Mail className="w-4 h-4" />,
        description: 'The lab opens email drafts on the same screen, so it gets the same banner. CASE-DRAFT-002 arrived from Birmingham 1’s reception inbox.',
        shows: ['Same banner, lab wording'],
        path: '/lab/cases/quick-new/CASE-DRAFT-002',
        portal: 'lab',
      },
      {
        title: 'On the case page — DSO',
        persona: 'dso',
        icon: <Sparkles className="w-4 h-4" />,
        description: 'The DSO portal has no creation flow, so a draft opens on the Case Details page instead. The same review banner sits above the status strip.',
        shows: ['Review banner on Case Details'],
        path: '/supplier/cases/CASE-DRAFT-001',
        portal: 'supplier',
      },
    ],
  },
  {
    label: 'Status changes that stay in Smile Genius',
    blurb: 'Some status changes can’t be passed on to the scanner portal: iTero only supports On Hold, and a case with no live scanner link (posted, manual, email) has nowhere to send them. In every such case the user sees one message, word for word, on the case, in the Change status popup and as a toast. Nothing is blocked.',
    steps: [
      {
        title: 'iTero case — any status except On Hold',
        persona: 'lab',
        icon: <Info className="w-4 h-4" />,
        description: 'CASE-001 came from iTero. Picking In Production, Shipped or any status other than On Hold shows the message in the popup; picking On Hold doesn’t. Same in every portal, and in the bulk status summary.',
        shows: [SCANNER_SYNC_COPY],
        tryIt: ['Click the status pill → pick In Production, then On Hold', 'Save — the same message follows as a toast'],
        path: '/clinic/cases/CASE-001',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Case with no scanner link',
        persona: 'clinic',
        icon: <Unlink className="w-4 h-4" />,
        description: 'CASE-054 (Harry Lewis) came in by post, so no status change reaches a scanner portal. The case page carries the message under the header, and the popup repeats it for every status. CASE-002 (3Shape) behaves the same while its connection is down — toggle it with the demo controls above.',
        shows: ['Message on the case page', 'Message in the popup', 'Toast after saving'],
        path: '/clinic/cases/CASE-054',
        portal: 'clinic',
      },
      {
        title: 'Same message in the DSO portal',
        persona: 'dso',
        icon: <Building2 className="w-4 h-4" />,
        description: 'The DSO portal changes status on the clinics’ behalf, so it shows the same message on the same cases.',
        path: '/supplier/cases/CASE-054',
        portal: 'supplier',
      },
    ],
  },
  {
    label: 'Lab Work columns & who created the case',
    blurb: 'The clinic portal now matches the live one: the page is called Lab Work and its columns are Status · Case ID · Scanner Creation Date · Created On · Updated On · Delivery Date · Patient · Service · Dentist · Lab. Every portal also shows which side created each case — the clinic or the lab — as an icon beside Created On.',
    steps: [
      {
        title: 'Lab Work — the clinic’s list, as on live',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'The sidebar item, the page title and the case page’s back link all read “Lab Work”. The default columns match the live clinic portal: Scanner Creation Date (scanner cases only, “--” otherwise) and Dentist on its own replace Score and the merged Practice / Dentist, and Lab is on. The column picker still offers the rest, and the clinic’s choice is saved separately from the lab’s.',
        shows: ['Lab Work', 'Scanner Creation Date', 'Dentist', 'Lab'],
        tryIt: ['Open the column picker (gear) to add Score back'],
        path: '/clinic/cases',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Lab / clinic icon beside Created On',
        persona: 'system',
        icon: <UserCircle2 className="w-4 h-4" />,
        description: 'A violet clinic icon or a teal lab icon (the portal colours) shows which side created the case. Hover for the practice or lab and how it was made. Email drafts take the side whose inbox received them, and Quick Create stamps the portal it was submitted from. CASE-DRAFT-004 was keyed in by the lab on the practice’s behalf.',
        shows: ['Clinic icon', 'Lab icon', 'Tooltip: “Created by the clinic — <practice> · …”'],
        tryIt: ['Hover the icons in the Created On column', 'Compare the email drafts here with the same rows in the Lab portal'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
      {
        title: 'And on the case page',
        persona: 'clinic',
        icon: <Sparkles className="w-4 h-4" />,
        description: 'The case header carries the same icon with the side and the practice or lab written out, next to the status pill.',
        shows: ['Created by Clinic · <practice>'],
        path: '/clinic/cases/CASE-001',
        portal: 'clinic',
      },
    ],
  },
];

export default function HotfixesFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const isAuthed = !!user;
  const connections = useScannerConnections();
  const trios = connections.find(c => c.id === 'scanner-trios');
  const triosExpired = !!trios && connectionStatus(trios).health === 'expired';

  const open = (step: Step) => {
    // Walkthroughs never stop at the login page: sign in with the demo
    // account behind the scenes and land on the step's screen.
    if (!isAuthed) login(DEMO_ACCOUNT_EMAIL, 'demo');
    navigate(step.path);
  };

  let n = 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="hotfixflow_grad" />
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
                <Wrench className="w-7 h-7 text-[#7C3AED]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#F5F3FF] border border-[#DDD6FE] text-[#6D28D9] mb-3">
              Hotfixes · 30 Sep 2026
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Case review, status reach &amp; Lab Work</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Three fixes across the Clinic, Lab and DSO portals. Each step opens the exact screen; they read in order, but every button works on its own.
            </p>
          </div>

          {/* Demo controls — the scanner connection the status-reach steps depend on */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${triosExpired ? 'bg-[#C62828]' : 'bg-[#2E7D32] animate-pulse'}`} />
              <p className="text-xs text-[#5A5568] min-w-0">
                3Shape TRIOS connection is <span className="font-semibold text-[#030213]">{triosExpired ? 'expired' : 'live'}</span>
              </p>
            </div>
            {trios && (
              <button
                onClick={() => (triosExpired ? reconnectScanner(trios.id) : simulateStage(trios.id, 'expired'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
                title="The same connection the lab manages under Settings → Scanner Connections"
              >
                {triosExpired ? <RefreshCw className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
                {triosExpired ? 'Reconnect 3Shape' : 'Expire 3Shape'}
              </button>
            )}
          </div>

          {/* Stages */}
          <div className="space-y-8">
            {STAGES.map((stage, si) => (
              <section key={stage.label}>
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A59DFF]">Fix {si + 1}</span>
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
