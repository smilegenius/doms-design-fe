import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Wrench, Stethoscope, FlaskConical, Building2, Cpu, Sparkles, Mail,
  FilePen, Info, UserCircle2, List, Plug, RefreshCw, Unlink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { connectionStatus, reconnectScanner, simulateStage, useScannerConnections } from '../data/scannerConnections';

// ─── Hotfixes · 30-Sep-2026 — flow walkthrough ───────────────────────────────
// Same shape as the CareStack / WhatsApp walkthroughs, for a round of small
// fixes that land across the Clinic, Lab and DSO portals together:
//   1. Email-made drafts say they need a person's review (list, creation
//      screen, case page).
//   2. A status the clinic changes only reaches the lab through a live scanner
//      integration — otherwise the clinic is told to let the lab know.
//   3. The Cases list shows who created each case.

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
        title: 'Flagged in the Cases list',
        persona: 'clinic',
        icon: <List className="w-4 h-4" />,
        description: 'Email drafts sit at the top of the list. Under the Draft status each one now carries a violet “Needs your review” tag, in both the table and the grid view.',
        shows: ['Draft', 'Needs your review'],
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
        tryIt: ['Read the banner, check the fields, press Submit', 'Back on the list, the new case shows the Smile Genius creator avatar'],
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
        description: 'The DSO portal has no creation flow, so a draft opens on the Case Details page instead. The same review banner sits above the status strip, and the header shows “Created by Smile Genius”.',
        shows: ['Review banner on Case Details', 'Created by Smile Genius'],
        path: '/supplier/cases/CASE-DRAFT-001',
        portal: 'supplier',
      },
    ],
  },
  {
    label: 'Status changes the lab won’t see',
    blurb: 'When the clinic changes a case’s status, the lab only hears about it through a live scanner integration. Email, manual and posted cases have none, and neither does a scanner whose connection is missing or expired. In those cases the clinic is now told — and handed a message to pass on. Nothing is blocked.',
    steps: [
      {
        title: 'Posted case — no scanner at all',
        persona: 'clinic',
        icon: <Info className="w-4 h-4" />,
        description: 'CASE-054 (Harry Lewis) came in by post. The case page shows a blue notice under the header, and the Change status popup repeats it the moment a new status is picked, with a “Copy update message” button.',
        shows: ['“Status updates won’t reach Smile Genius Lab automatically.”', 'Copy update message', 'Toast after saving: “…please let them know”'],
        tryIt: ['Click the status pill → pick In Production', 'Press “Copy update message” and paste it anywhere', 'Save — the reminder toast follows'],
        path: '/clinic/cases/CASE-054',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Scanner case — connection expired',
        persona: 'clinic',
        icon: <Unlink className="w-4 h-4" />,
        description: 'CASE-002 was scanned on 3Shape, but the 3Shape TRIOS token has expired, so the notice names the connection. Reconnect it from the demo controls above and the notice disappears — the status reaches the lab again.',
        shows: ['“The 3Shape TRIOS 5 connection has expired…”'],
        tryIt: ['Open the case, then press “Reconnect 3Shape” above and reopen it'],
        path: '/clinic/cases/CASE-002',
        portal: 'clinic',
      },
      {
        title: 'Scanner case — connected',
        persona: 'clinic',
        icon: <Plug className="w-4 h-4" />,
        description: 'CASE-001 came from iTero, whose connection is live. No notice on the page or in the popup — the change goes through to the lab as before.',
        path: '/clinic/cases/CASE-001',
        portal: 'clinic',
      },
      {
        title: 'Same notice in the DSO portal',
        persona: 'dso',
        icon: <Building2 className="w-4 h-4" />,
        description: 'The DSO portal changes status on the clinics’ behalf, so it gets the same notice. The Lab portal doesn’t — the lab is the side being told.',
        path: '/supplier/cases/CASE-054',
        portal: 'supplier',
      },
    ],
  },
  {
    label: 'Who created the case',
    blurb: 'Every row now shows who made the case, beside its Created On date — in every portal, because the list is shared.',
    steps: [
      {
        title: 'Creator avatar on the Cases list',
        persona: 'system',
        icon: <UserCircle2 className="w-4 h-4" />,
        description: 'A person’s initials, or the Smile Genius sparkle when the platform created the case from an email. Hover for the name and how it was made: sent from a scanner, entered manually, logged from a posted impression, or auto-created from an email (plus who reviewed and submitted it).',
        shows: ['Sparkle — Smile Genius', 'Initials — a person', 'Tooltip: “Created by … · …”'],
        tryIt: ['Hover a few avatars in the Created On column', 'Create a case with Quick Create — your name is on the new row'],
        path: '/lab/cases',
        portal: 'lab',
      },
      {
        title: 'And on the case page',
        persona: 'clinic',
        icon: <Sparkles className="w-4 h-4" />,
        description: 'The case header carries the same avatar with the name written out, next to the status pill.',
        shows: ['Created by <name>', 'Hover for how it was made'],
        path: '/clinic/cases/CASE-001',
        portal: 'clinic',
      },
    ],
  },
];

export default function HotfixesFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthed = !!user;
  const connections = useScannerConnections();
  const trios = connections.find(c => c.id === 'scanner-trios');
  const triosExpired = !!trios && connectionStatus(trios).health === 'expired';

  const open = (step: Step) => {
    if (isAuthed) navigate(step.path);
    else navigate(`/login?portal=${step.portal}&next=${encodeURIComponent(step.path)}`);
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Case review, status reach &amp; case creator</h1>
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
                {!isAuthed && <span className="text-[#A0A0B0]"> · you’ll be asked to sign in first (any email / password)</span>}
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
