import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Workflow, Wrench, Plug, MessageCircle, CalendarDays, Layers, UserX, Truck, Play, FilePlus2 } from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';

// ─── Flows ───────────────────────────────────────────────────────────────────
// Everything that isn't "sign in and look around a portal": the standalone
// client-facing pages and the step-by-step walkthroughs of an epic. The
// portal-select screen shows ONE card for this section — the grid lives here,
// so a new flow is added in a single place and the landing screen stays about
// picking a portal.

export interface FlowEntry {
  title: string;
  description: string;
  /** What the viewer actually does on the other side of the card. */
  detail: string;
  icon: React.ReactNode;
  badge: string;
  accent: string;
  accentSoft: string;
  path: string;
  /** When it shipped — shown as a chip so the newest round is easy to spot. */
  date?: string;
  /** Timeline group, as 'YYYY-MM'. The page lists months newest first. */
  month: string;
  /** Optional secondary button for flows that are a click-through simulation. */
  simulate?: { label: string; path: string };
}

export const FLOWS: FlowEntry[] = [
  {
    // From scratch: lab first, one question at a time, Send as the prescriber's signature.
    title: 'New case flow',
    description: 'The simplest way for a clinic to create lab work, from Add new Case or a scanner draft to Sent: lab first, a step timeline with one question at a time, the Teeth Chart against every service, smart defaults with their source, and Send with a 10-second Undo.',
    detail: 'Clinic · 3 scripts + 10 checks',
    icon: <FilePlus2 className="w-5 h-5 text-[#2F62D6]" />,
    badge: 'Walkthrough',
    accent: '#2F62D6',
    accentSoft: '#EEF4FF',
    path: '/flows/new-case',
    date: '22 Oct 2026',
    month: '2026-10',
    simulate: { label: 'Open Lab Work', path: '/flows/new-case/cases' },
  },
  {
    // Clinic manual creation now ends in print & ship, not a direct hand-off.
    title: 'Addition of new stage in manual case creation',
    description: 'A clinic creating New Lab Work starts on Impressions (By Post). The case does not go straight to the lab: it becomes Ready for dispatch, the receptionist prints the order form and label, picks a courier, and only then is it Submitted.',
    detail: 'Clinic · Simulation',
    icon: <Truck className="w-5 h-5 text-[#B45309]" />,
    badge: 'Simulation',
    accent: '#B45309',
    accentSoft: '#FFF8E1',
    path: '/flows/manual-case-dispatch',
    date: '20 Oct 2026',
    month: '2026-10',
    // Straight onto the real clinic screen, signed in as the demo account.
    simulate: { label: 'Run simulation', path: '/clinic/cases/quick-new' },
  },
  {
    // Negative scenarios: chasing a dentist who has no email / no number on file.
    title: 'Dentist with no contact on file',
    description: 'Email dentist and WhatsApp dentist when there is no email address or phone number for the dentist: nothing is sent, the lab is told why, and the private record opens on the missing field. Saving it retries the send. A third scenario shows a case where both channels are available.',
    detail: 'Lab · 3 scenarios',
    icon: <UserX className="w-5 h-5 text-[#D4183D]" />,
    badge: 'Negative',
    accent: '#D4183D',
    accentSoft: '#FEF2F2',
    path: '/flows/dentist-contact',
    date: '13 Oct 2026',
    month: '2026-10',
  },
  {
    // Five developer tasks across the clinic + lab creation and case screens.
    title: 'Denture stages & service-level dates',
    description: 'Four clinic scenarios, each on the list, detail and create / draft screens: a single manual case, a multi-service manual case with a denture, and a scanner case that matches a multi-service case with its earlier stages matched or done elsewhere.',
    detail: 'Clinic · 4 scenarios',
    icon: <Layers className="w-5 h-5 text-[#B45309]" />,
    badge: 'Walkthrough',
    accent: '#B45309',
    accentSoft: '#FFF8E1',
    path: '/flows/denture-stages',
    date: '8 Oct 2026',
    month: '2026-10',
  },
  {
    // A round of small cross-portal fixes, walked through like an epic.
    title: 'Hotfixes — review, status reach & Lab Work',
    description: 'Email-made drafts ask for a review, the clinic is told when a status change won’t reach the lab, the clinic’s Lab Work list matches live, and every case shows whether the lab or the clinic created it.',
    detail: 'Clinic · Lab · DSO',
    icon: <Wrench className="w-5 h-5 text-[#7C3AED]" />,
    badge: 'Hotfixes',
    accent: '#7C3AED',
    accentSoft: '#F5F3FF',
    path: '/flows/hotfixes-30-sep',
    date: '30 Sep 2026',
    month: '2026-09',
  },
  {
    // CareStack integration epic. The walkthrough deep-links into the exact
    // clinic / admin screens for each step.
    title: 'CareStack integration',
    description: 'Step-by-step walkthrough for a DSO-enabled clinic — mapping, appointment linking, lab milestones and notifications.',
    detail: 'Admin · Clinic · Lab',
    icon: <Plug className="w-5 h-5 text-[#0F766E]" />,
    badge: 'Walkthrough',
    accent: '#0F766E',
    accentSoft: '#ECFEFF',
    path: '/flows/carestack',
    month: '2026-09',
  },
  {
    // WhatsApp communication epic — lab settings + the case Conversation hub.
    title: 'WhatsApp communication',
    description: 'Step-by-step walkthrough of the lab’s WhatsApp channel — connecting the Business account, automated messages on scoring outcomes, manual sends from the Conversation hub and the recorded audit trail.',
    detail: 'Lab · Conversation hub',
    icon: <MessageCircle className="w-5 h-5 text-[#15803D]" />,
    badge: 'Walkthrough',
    accent: '#15803D',
    accentSoft: '#F0FDF4',
    path: '/flows/whatsapp',
    month: '2026-09',
  },
  {
    title: 'Downtime page',
    description: 'What clients see while the platform is under maintenance.',
    detail: 'Standalone page',
    icon: <Wrench className="w-5 h-5 text-[#E65100]" />,
    badge: 'Client-facing',
    accent: '#E65100',
    accentSoft: '#FFF3E0',
    path: '/downtime',
    month: '2026-09',
  },
];

/** FLOWS grouped by month, newest month first; order within a month is kept. */
function flowsByMonth(flows: FlowEntry[]) {
  const months = [...new Set(flows.map(f => f.month))].sort().reverse();
  return months.map(month => {
    const [y, m] = month.split('-').map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return { month, label, flows: flows.filter(f => f.month === month) };
  });
}

export function FlowCard({ flow, onOpen }: { flow: FlowEntry; onOpen: () => void }) {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="group relative w-full h-full cursor-pointer text-left bg-white border border-[#E0E0E6] rounded-2xl p-5 overflow-hidden hover:shadow-xl hover:border-current transition-all"
      style={{ color: flow.accent }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: `radial-gradient(circle at top right, ${flow.accent}10, transparent 70%)` }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: flow.accentSoft }}
        >
          {flow.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[#030213] leading-tight">{flow.title}</h3>
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-[#F0EFF6] text-[#717182] border-[#E0E0E6] flex-shrink-0">
              {flow.badge}
            </span>
            {flow.date && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border flex-shrink-0" style={{ background: flow.accentSoft, color: flow.accent, borderColor: `${flow.accent}40` }}>
                <CalendarDays className="w-2.5 h-2.5" />
                {flow.date}
              </span>
            )}
          </div>
          <p className="text-xs text-[#717182] mt-1 leading-relaxed">{flow.description}</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest mt-2.5" style={{ color: flow.accent }}>
            {flow.detail}
          </p>
          {flow.simulate && (
            <button
              onClick={e => {
                e.stopPropagation();
                if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
                navigate(flow.simulate!.path);
              }}
              className="relative mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: flow.accent }}
            >
              <Play className="w-3 h-3 fill-current" />
              {flow.simulate.label}
            </button>
          )}
        </div>
        <ArrowRight className="w-4 h-4 flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}

export default function FlowsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="flows_grad" />
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to portals
        </button>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-16 pt-2">
        <div className="w-full max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] opacity-15 blur-xl" />
              <div className="relative w-16 h-16 rounded-3xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center">
                <Workflow className="w-7 h-7 text-[#A59DFF]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white border border-[#E0E0E6] text-[#5A5568] mb-3">
              Flows
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Flows &amp; walkthroughs</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Each walkthrough reads in order and opens the exact screen inside the portal for every step. Standalone pages open on their own.
            </p>
          </div>

          {/* Timeline — one section per month, newest on top. */}
          <div className="relative">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[#E0E0E6]" aria-hidden />
            <div className="space-y-10">
              {flowsByMonth(FLOWS).map(group => (
                <section key={group.month} className="relative pl-7">
                  <span className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full bg-white border-2 border-[#A59DFF]" aria-hidden />
                  <div className="flex items-baseline gap-2 mb-4">
                    <h2 className="text-sm font-bold text-[#030213]">{group.label}</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8B8B9E]">
                      {group.flows.length} {group.flows.length === 1 ? 'flow' : 'flows'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    {group.flows.map(f => (
                      <FlowCard key={f.title} flow={f} onOpen={() => navigate(f.path)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
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
