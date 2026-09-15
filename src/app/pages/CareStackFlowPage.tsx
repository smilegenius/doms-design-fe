import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Plug, ShieldCheck, Stethoscope, FlaskConical, Cpu, RotateCcw, LogIn,
  UserCheck, CalendarCheck2, CalendarPlus, CalendarX2, Link2, Truck, PackageCheck, CalendarClock,
  Mail, ScrollText, ListChecks, Search, Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { resetCareStackDemo, setCareStackEnabled, useCareStackSettings } from '../data/carestack';

// ─── CareStack integration — flow walkthrough ────────────────────────────────
// The middle screen between the portal-select "Flows" card and the portals.
// Every step of the epic is listed in order with the persona, what the screen
// shows and a button that deep-links straight to that screen (signing in
// first if needed). Standalone — no shell, no auth — like the downtime page.

type Persona = 'admin' | 'practice' | 'lab' | 'system';
type Portal = 'admin' | 'clinic' | 'supplier';

interface Step {
  title: string;
  persona: Persona;
  icon: React.ReactNode;
  description: string;
  /** How to try it once the screen is open. */
  tryIt?: string[];
  /** States the user will see on that screen. */
  shows?: string[];
  path: string;
  portal: Portal;
  /** The one the PM asked to see first. */
  highlight?: boolean;
}

interface Stage {
  label: string;
  blurb: string;
  steps: Step[];
}

const PERSONA: Record<Persona, { label: string; cls: string; icon: React.ReactNode }> = {
  admin:    { label: 'Smile Genius Admin', cls: 'bg-[#F7F4FF] text-[#7C3AED] border-[#DDD6FE]', icon: <ShieldCheck className="w-3 h-3" /> },
  practice: { label: 'Practice user',      cls: 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]', icon: <Stethoscope className="w-3 h-3" /> },
  lab:      { label: 'Lab',                cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]', icon: <FlaskConical className="w-3 h-3" /> },
  system:   { label: 'Smile Genius (auto)',cls: 'bg-[#ECFEFF] text-[#0F766E] border-[#99F6E4]', icon: <Cpu className="w-3 h-3" /> },
};

const STAGES: Stage[] = [
  {
    label: 'Set up',
    blurb: 'CareStack is configured once per dental group — never by individual clinics.',
    steps: [
      {
        title: 'Enable CareStack for the group and review the mappings',
        persona: 'admin',
        icon: <Building2 className="w-4 h-4" />,
        description: 'Super Admin → Organizations → Smile Genius Group → Integrations. The enable switch, connection and last-sync state, and the three mapping tables Smile Genius keeps against CareStack IDs.',
        shows: ['Practice ↔ Location', 'Dentist ↔ Provider (active / inactive)', 'Patients — mapped / unmapped, never auto-created'],
        tryIt: ['Toggle the integration off and on', 'Press "Sync now"', 'Map an unmapped practice to a CareStack location'],
        path: '/admin?org=org-dso-1&tab=integrations',
        portal: 'admin',
      },
      {
        title: 'Clinic settings — Integrations (read-only status & figures)',
        persona: 'practice',
        icon: <Plug className="w-4 h-4" />,
        description: 'What a practice sees: whether CareStack is on, last sync with a "Sync now" action, the patient / dentist / practice mapping figures, this practice’s own location mapping and the patients still needing review. Nothing is editable — the DSO admin owns the configuration.',
        path: '/clinic/settings?tab=integrations',
        portal: 'clinic',
      },
      {
        title: 'DSO portal settings — Integrations (read-only status & figures)',
        persona: 'admin',
        icon: <Plug className="w-4 h-4" />,
        description: 'The same status card at group level in the DSO portal: connection, last sync, Sync now and the mapping figures for the whole group.',
        path: '/supplier/settings?tab=integrations',
        portal: 'supplier',
      },
      {
        title: 'Cases list — "Appointment" column, filter, and the Delivery Date column',
        persona: 'practice',
        icon: <ListChecks className="w-4 h-4" />,
        description: 'Every case shows its CareStack appointment state — linked ones with the appointment date and time. Cases still needing an appointment show a "Choose" button whose dropdown offers Link Appointment (opens the picker) or Not Required. The filter drawer can narrow the list by appointment state. The date column shows the lab’s latest due date with a "Changed" tag.',
        shows: ['Linked · Fri 29 May · 14:00', 'Choose → Link Appointment / Not Required', 'Not required', 'Mapping incomplete', '"Changed" tag on CASE-RS-2003'],
        tryIt: ['Press "Choose" on a row that needs an appointment → Link Appointment', 'Filter → Appointment → Linked', 'Search CASE-RS-2003 and hover the Changed tag'],
        path: '/clinic/cases',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Case created → CareStack validation',
    blurb: 'After a scanner or email case is created, Smile Genius checks the patient, dentist and practice against CareStack. Creation is never blocked.',
    steps: [
      {
        title: 'Happy path — everything matched, appointment already linked',
        persona: 'system',
        icon: <UserCheck className="w-4 h-4" />,
        description: 'All three entities resolve on the first pass and the lookup found exactly one confident appointment, so it was linked automatically.',
        shows: ['Loading spinners → green ticks (hover a tick for the CareStack ID)', 'Appointment: Linked · date/time · dentist · practice'],
        path: '/clinic/cases/CASE-RS-2001',
        portal: 'clinic',
      },
      {
        title: 'iTero case — patient not found → correct details → appointment found',
        persona: 'practice',
        icon: <Search className="w-4 h-4" />,
        description: 'The scanner sent a different date of birth, so exact matching fails. The user picks the right CareStack patient, the lookup re-runs, and the appointment search kicks in and links CS-APT-7745.',
        shows: ['Patient: red cross + reason', 'Appointment: unavailable until mapping is completed', 'After retry: Finding appointment… → Linked'],
        tryIt: ['Click "Correct details" on the Patient card', 'Pick Isabella Hughes · CS-PAT-30011 and press "Retry lookup"'],
        path: '/clinic/cases/CASE-RS-2002',
        portal: 'clinic',
        highlight: true,
      },
      {
        title: 'Dentist not found — provider is inactive in CareStack',
        persona: 'practice',
        icon: <Stethoscope className="w-4 h-4" />,
        description: 'The provider record exists but is inactive at this location. The correct-details search greys out inactive providers so the user must pick an active one.',
        tryIt: ['Click "Correct details" on the Dentist card', 'Notice Sophie Wilson (Belfast) is greyed as Inactive; pick Dr. Davies'],
        path: '/clinic/cases/CASE-004',
        portal: 'clinic',
      },
      {
        title: 'Practice not mapped — managed at group level',
        persona: 'practice',
        icon: <Building2 className="w-4 h-4" />,
        description: 'No CareStack location is mapped to this practice. The practice user cannot fix that — the card tells them to ask the DSO admin. Lab processing continues regardless.',
        path: '/clinic/cases/CASE-054',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'CareStack appointment',
    blurb: 'Once the three mappings exist, the appointment lookup runs in the background. Exactly one confident match links automatically; anything else becomes Appointment Required.',
    steps: [
      {
        title: 'Ambiguous match → Appointment Required → link an existing appointment',
        persona: 'practice',
        icon: <Link2 className="w-4 h-4" />,
        description: 'Two possible appointments were found, so none was auto-selected. The one nearest to the case due date is suggested and preselected; the user confirms it. The end-of-day "Appointment Required" email is queued to the dentist and practice manager (cc reception).',
        tryIt: ['Link Appointment → the list opens directly, "Nearest to due date" preselected → Link appointment', 'Open the sync log and press "Send digest now (demo)"'],
        path: '/clinic/cases/CASE-RS-2003',
        portal: 'clinic',
      },
      {
        title: 'No match → create a new appointment in CareStack',
        persona: 'practice',
        icon: <CalendarPlus className="w-4 h-4" />,
        description: 'Smile Genius creates the appointment in CareStack from the mapped Patient, Provider and Location IDs, then links it. Only active, mapped providers are offered.',
        tryIt: ['Link Appointment → "Create a new appointment instead" → Create & link in CareStack'],
        path: '/clinic/cases/CASE-RS-2004',
        portal: 'clinic',
      },
      {
        title: 'Appointment Not Required — with a reason',
        persona: 'practice',
        icon: <CalendarX2 className="w-4 h-4" />,
        description: 'For lab work that needs no patient visit (e.g. a retainer). Records the reason, user and timestamp; no CareStack appointment is created or updated afterwards.',
        tryIt: ['Press "Appointment Not Required", pick a reason, confirm'],
        path: '/clinic/cases/CASE-010',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Lab milestones → appointment notes + practice emails',
    blurb: 'While a case is linked, each milestone is added to the CareStack appointment as a timestamped note and emailed to the dentist and practice manager (cc reception). Not linked → the update stays in Smile Genius and the skip is logged.',
    steps: [
      {
        title: 'Accepted by Lab',
        persona: 'lab',
        icon: <CalendarCheck2 className="w-4 h-4" />,
        description: 'Moving the case to In Production posts the "Lab Work Accepted" note and sends the acceptance email.',
        tryIt: ['Click the status pill → In Production → Change status', 'Expand the CareStack sync log to see the note and the email'],
        path: '/clinic/cases/CASE-RS-2004',
        portal: 'clinic',
      },
      {
        title: 'Shipped — courier, tracking, expected delivery',
        persona: 'lab',
        icon: <Truck className="w-4 h-4" />,
        description: 'Moving the case to Shipped asks for the shipment details, fills the Shipping sub-tab, posts the "Lab Work Shipped" note and sends the shipment email.',
        tryIt: ['Status pill → Shipped → fill the shipment details', 'Open the Shipping sub-tab under the service'],
        path: '/clinic/cases/CASE-RS-2002',
        portal: 'clinic',
      },
      {
        title: 'Received by practice',
        persona: 'practice',
        icon: <PackageCheck className="w-4 h-4" />,
        description: '"Mark as Received" captures the date/time, the confirming user and delivery notes, moves the case to Delivered, posts the receipt note and sends the receipt email.',
        tryIt: ['On a shipped case press "Mark as Received" in the CareStack section (or on a service card)'],
        path: '/clinic/cases/CASE-RS-2002',
        portal: 'clinic',
      },
      {
        title: 'Due date changed by the lab',
        persona: 'lab',
        icon: <CalendarClock className="w-4 h-4" />,
        description: 'Editing the Delivery Date asks for a reason, records previous → new, posts the "Lab Work Due Date Changed" note and emails the practice. Smile Genius never reschedules the appointment itself.',
        tryIt: ['Show details → change the Delivery Date → give a reason → Save', 'Back on the list the new date carries the "Changed" tag'],
        path: '/clinic/cases/CASE-RS-2003',
        portal: 'clinic',
      },
    ],
  },
  {
    label: 'Notifications & audit',
    blurb: 'Everything the integration sends or posts is recorded against the case.',
    steps: [
      {
        title: 'Practice emails in the Conversation hub',
        persona: 'system',
        icon: <Mail className="w-4 h-4" />,
        description: 'Each CareStack notification appears in the case’s Email tab with the verbatim copy, recipients and the "CareStack" tag — queued digests are marked as such.',
        path: '/clinic/cases/CASE-RS-2002?conversation=1',
        portal: 'clinic',
      },
      {
        title: 'CareStack sync log — timestamped, auditable',
        persona: 'system',
        icon: <ScrollText className="w-4 h-4" />,
        description: 'Validation results, appointment lookups, notes posted (or skipped, with the reason) and emails sent — newest first, each expandable to the full note or email body.',
        tryIt: ['Expand "CareStack sync log" at the bottom of the CareStack section'],
        path: '/clinic/cases/CASE-RS-2003',
        portal: 'clinic',
      },
    ],
  },
];

export default function CareStackFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const settings = useCareStackSettings();
  const isAuthed = !!user;

  const open = (step: Step) => {
    // Every screen in this flow assumes the group has CareStack on.
    setCareStackEnabled(true);
    if (isAuthed) navigate(step.path);
    else navigate(`/login?portal=${step.portal}&next=${encodeURIComponent(step.path)}`);
  };

  const reset = () => {
    resetCareStackDemo();
    toast.success('CareStack demo data reset — every case will validate afresh');
  };

  let n = 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="csflow_grad" />
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to portals
        </button>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-16 pt-2">
        <div className="w-full max-w-3xl mx-auto reveal">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] opacity-15 blur-xl" />
              <div className="relative w-16 h-16 rounded-3xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center">
                <Plug className="w-7 h-7 text-[#0F766E]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#ECFEFF] border border-[#99F6E4] text-[#0F766E] mb-3">
              Flow walkthrough · Integration
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">CareStack integration, step by step</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Each step below opens the exact screen inside the portal. The steps read in order, but every button works on its own.
            </p>
          </div>

          {/* Demo controls */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${settings.enabled ? 'bg-[#2E7D32] animate-pulse' : 'bg-[#A0A0B0]'}`} />
              <p className="text-xs text-[#5A5568] min-w-0">
                CareStack is <span className="font-semibold text-[#030213]">{settings.enabled ? 'enabled' : 'disabled'}</span> for Smile Genius Group
                {!isAuthed && <span className="text-[#A0A0B0]"> · you’ll be asked to sign in first (any email / password)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setCareStackEnabled(!settings.enabled)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
              >
                <Plug className="w-3.5 h-3.5" />
                {settings.enabled ? 'Turn off' : 'Turn on'}
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
                title="Clears every case's CareStack result, the sync log and the notifications it raised"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset demo data
              </button>
              {!isAuthed && (
                <button
                  onClick={() => navigate('/login?portal=clinic&next=%2Fflows%2Fcarestack')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in
                </button>
              )}
            </div>
          </div>

          {/* Stages */}
          <div className="space-y-8">
            {STAGES.map((stage, si) => (
              <section key={stage.label}>
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A59DFF]">Stage {String.fromCharCode(65 + si)}</span>
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
                          step.highlight ? 'border-[#99F6E4] ring-1 ring-[#99F6E4]' : 'border-[#E0E0E6]'
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
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#ECFEFF] text-[#0F766E] border border-[#99F6E4]">Key demo</span>
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
