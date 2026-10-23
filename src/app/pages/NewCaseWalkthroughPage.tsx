import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ScanLine, UserPlus, Layers, Anchor, Smile, RotateCcw, ShieldAlert, Stethoscope, UserCheck,
  CalendarDays, Inbox, FilePlus2, Repeat, Keyboard, Play,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { USERS, UserId, userById } from '../newCase/data';
import { resetDemo, setUserId, setUx, useFlowStore } from '../newCase/store';
import { UX_OPTIONS, Ux } from '../newCase/controller';

// ─── New Case Flow · Oct-2026 — walkthrough ──────────────────────────────────
// The simplest way for a clinic to create lab work, from "Add new Case" or a
// scanner Draft to "Sent to lab": lab first, one question at a time on a step
// timeline, the existing Teeth Chart per service, and Send as the prescriber's
// signature with a 10-second Undo. It lives in the Flows section only, with its
// own Lab Work list and demo data, so the portal's Cases screens are unchanged.
// Each step signs in as the right person and opens the exact screen.

interface Step {
  title: string;
  icon: React.ReactNode;
  as: UserId;
  description: string;
  shows: string[];
  tryIt?: string[];
  path: string;
  /** Starts on the blank create page, which asks for the patient on the page. */
  launch?: boolean;
}
interface Stage { label: string; blurb: string; steps: Step[] }

const STAGES: Stage[] = [
  {
    label: 'The three main scripts',
    blurb: 'T1 to T3 from the requirements. Patient, then the lab (the clinic’s usual lab is listed first), then each service with its own Teeth Chart, then records, prescriber and delivery. Answering a question moves on to the next gap by itself.',
    steps: [
      {
        title: 'T1 · Amelia’s Medit draft → crown → sent (7 taps)',
        icon: <ScanLine className="w-4 h-4" />, as: 'khan',
        description: 'Opens on Select Lab, with Northfield (the clinic’s usual lab) first. Northfield → Crown → 36 → Done → A2 → Send. Material defaults to Monolithic zirconia (Your usual, 7 days). Sent to Northfield, back by Mon 2 Nov, Undo for 10 seconds.',
        shows: ['Opens on the first gap', 'Your usual material', 'Back by Mon 2 Nov', 'Undo (10)'],
        tryIt: ['Crown → tap 36 → Done → A2 → Send to Lab'],
        path: '/flows/new-case/case/CAS-2026-142',
      },
      {
        title: 'T2 · New patient, bridge 14–16, posted, fit booked (16 taps)',
        icon: <UserPlus className="w-4 h-4" />, as: 'khan',
        description: 'Add new Case → type “Oliver Bennett” → Add new patient (or Enter Patient Details Manually) → DOB 14051979 → Male → Create → Northfield → Bridge → 14, 16 → Done → Layered (on the shade step) → A3 → Impression by Post → tick disinfection → Add Fit Appointment → Thu 12 Nov → Send. 15 is a pontic; back by Fri 6 Nov; 3 working days spare; Print Box Label.',
        shows: ['New patient on the page', 'Bridge pontics', 'Disinfection tick', 'Fit calendar'],
        path: '/flows/new-case/cases', launch: true,
      },
      {
        title: 'T3 · Priya: night guard + veneer in one draft (14 taps)',
        icon: <Layers className="w-4 h-4" />, as: 'khan',
        description: 'Add new Case → “shah” → Priya (opens her iTero draft) → Northfield → Night Guard (Hard pre-selected) → Select Arch upper → Add Another Service → Veneer → 21 → arrow → Match from Photos → Add Photos → phone photos → Done → Send. Back by Tue 3 Nov, split suggestion for the night guard, stump-shade note, a chart per service in the summary.',
        shows: ['Opens the scan draft', 'Two services, two charts', 'Split suggestion', 'Phone photo hand-off'],
        path: '/flows/new-case/cases', launch: true,
      },
    ],
  },
  {
    label: 'Checks the flow makes for you',
    blurb: 'What Smile Genius already knows about the patient and the lab turns into a one-tap decision, a blocker, or an option that simply can’t be picked.',
    steps: [
      {
        title: 'A1 · Grace: crown on an implant site',
        icon: <Anchor className="w-4 h-4" />, as: 'khan',
        description: 'Crown on 46 at Northfield: “Northfield Dental Lab doesn’t make implant crowns. Harbour Ceramics Studio does.” Change Lab → Harbour → Switch to Implant Crown: the system is pre-filled from the record, back Mon 9 Nov. Pennine is then disabled on the Lab step.',
        shows: ['Implant on record', 'Change Lab', 'Patient record defaults'],
        path: '/flows/new-case/case/new?patient=P-2025-027',
      },
      {
        title: 'A2 · Edward: next denture stage at Pennine (NHS)',
        icon: <Smile className="w-4 h-4" />, as: 'khan',
        description: 'Lab defaults to Pennine (“Made the previous stage”) and only Pennine’s services show. The Next stage chip sets up the Try-In. Soft Reline is disabled: “Not available on the NHS.”',
        shows: ['Made the previous stage', 'Next stage chip', 'NHS-disabled options'],
        path: '/flows/new-case/case/new?patient=P-2025-009',
      },
      {
        title: 'A3 · William: remake check on 46',
        icon: <Repeat className="w-4 h-4" />, as: 'khan',
        description: 'Crown on 46: it had a monolithic zirconia crown from Northfield delivered 3 Oct (CAS-2026-098). Yes, a Remake → What went wrong? → Shade: the shade is asked again, the material is copied (“Made the original”).',
        shows: ['Remake decision', 'Copied values', 'Shade asked again'],
        path: '/flows/new-case/case/new?patient=P-2025-018',
      },
      {
        title: 'A4 · Ben: missing 36 and an open night guard',
        icon: <ShieldAlert className="w-4 h-4" />, as: 'khan',
        description: 'Crown: 36 can’t be picked (recorded missing). A night guard on the upper shows the open-case note for CAS-2026-131.',
        shows: ['Missing teeth unpickable', 'Open case note'],
        path: '/flows/new-case/case/new?patient=P-2025-060',
      },
      {
        title: 'A5 · Hannah (16): whitening trays',
        icon: <ShieldAlert className="w-4 h-4" />, as: 'khan',
        description: 'Whitening Trays is blocked for an under-18 patient, and the case can’t be sent until the item is removed.',
        shows: ['Under-18 blocker'],
        path: '/flows/new-case/case/new?patient=P-2025-052',
      },
      {
        title: 'A7 · Daniel: Medit form “36 · Crown · Zirconia”',
        icon: <FilePlus2 className="w-4 h-4" />, as: 'khan',
        description: 'Opens with the crown and teeth set from the scan, on the gap “Medit says ‘Zirconia’. Which one?”',
        shows: ['Scanner Rx', 'Ambiguous value as a gap'],
        path: '/flows/new-case/case/CAS-2026-141',
      },
    ],
  },
  {
    label: 'Staff, approval and delivery',
    blurb: 'A nurse can prepare a case but the prescription is always in a dentist’s name. Delivery dates come from the lab’s turnaround, its cut-off and UK working days.',
    steps: [
      {
        title: 'A6 · Jess (nurse) prepares Priya’s iTero draft for Dr Ellery',
        icon: <Stethoscope className="w-4 h-4" />, as: 'jess',
        description: 'The iTero login isn’t linked, so it asks who is prescribing. Pick Dr Ellery (Remember for this iTero login stays ticked) and finish the case: the button reads “Send to Dr Ellery to Approve” and the row stays Draft · Awaiting approval.',
        shows: ['Who is prescribing?', 'Send to Dr Ellery to Approve', 'Login remembered'],
        path: '/flows/new-case/case/CAS-2026-143',
      },
      {
        title: 'A6 · Dr Ellery approves from the bell',
        icon: <UserCheck className="w-4 h-4" />, as: 'ellery',
        description: 'The notification “Jess Ward prepared a case for Priya Shah” opens a read-only case with Change Something and Approve and Send. Approving keeps the same case ID; Jess is told.',
        shows: ['Approval view', 'Same case ID', 'Preparer notified'],
        path: '/flows/new-case/cases',
      },
      {
        title: 'A8 · Fit set, then a slower material',
        icon: <CalendarDays className="w-4 h-4" />, as: 'khan',
        description: 'Book a fit with no spare day, then switch the material to a slower one: the fit is cleared with a toast. Hatched dates explain the fixes (Fast-Track, another lab) or say no approved lab can make it.',
        shows: ['Fit re-validated', 'Hatched dates and fixes'],
        path: '/flows/new-case/case/CAS-2026-142',
      },
      {
        title: 'Scan to Follow → the scan arrives → Attach',
        icon: <Inbox className="w-4 h-4" />, as: 'khan',
        description: 'Send a case with Scan to Follow: Sent. Waiting for the Scan, row Received · Awaiting scan. On Lab Work, “Scan Arrives” then Attach: the delivery is recalculated against the lab’s cut-off.',
        shows: ['Awaiting scan', 'Attach Scan modal'],
        path: '/flows/new-case/cases',
      },
      {
        title: 'Keyboard and Undo',
        icon: <Keyboard className="w-4 h-4" />, as: 'khan',
        description: 'Teeth are buttons with names (“Tooth 36, lower left 6, selected”). Ctrl + Enter sends when ready, else jumps to the next gap; a double press sends once. Esc closes a drawer, else saves and closes. Undo restores only the rows the send changed.',
        shows: ['Keyboard teeth', 'Ctrl + Enter', 'One send only'],
        path: '/flows/new-case/case/CAS-2026-142',
      },
    ],
  },
];

export default function NewCaseWalkthroughPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { toast } = useToast();
  const store = useFlowStore();
  const signedIn = userById(store.userId)!;
  const dirty = store.rows.some(r => r.sentAt || (r.draft?.items.length && r.id !== 'CAS-2026-141')) || store.patients.length > 0 || store.events.length > 0;

  /** Play an experience from scratch: a blank create page in that style. */
  const play = (ux: Ux) => {
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    setUx(ux);
    setUserId('khan');
    navigate('/flows/new-case/case/new', { state: { session: `scratch-${Date.now()}` } });
  };

  const open = (step: Step) => {
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    setUserId(step.as);
    navigate(step.launch ? '/flows/new-case/case/new' : step.path, { state: { session: `wt-${Date.now()}` } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="newcaseflow_grad" />
        <button onClick={() => navigate('/flows')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to flows
        </button>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-16 pt-2">
        <div className="w-full max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] opacity-15 blur-xl" />
              <div className="relative w-16 h-16 rounded-3xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center">
                <FilePlus2 className="w-7 h-7 text-[#2F62D6]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#EEF4FF] border border-[#C8D8FC] text-[#1E40AF] mb-3">
              October 2026 · Clinic · 3 scripts + 10 checks
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">New case flow</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              From “Add new Case” or a scanner draft to “Sent to lab”: lab first, one question at a time, the Teeth Chart against every service, and Send as the prescriber’s signature with a 10-second Undo. Desktop only (1280 px and up). Each step opens the exact screen, signed in as the right person.
            </p>
          </div>

          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dirty ? 'bg-[#F59E0B]' : 'bg-[#2E7D32]'}`} />
              <p className="text-xs text-[#5A5568] min-w-0">
                {dirty ? 'Demo data changed by earlier runs.' : 'Demo data is fresh.'} Signed in as <span className="font-semibold text-[#030213]">{signedIn.name}</span>.
                {' '}Today in the demo is Thu 22 Oct 2026, 11:05.
              </p>
            </div>
            <button
              onClick={() => { resetDemo(); toast.success('Demo data reset: drafts, patients and sent cases are back to the start.'); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset demo data
            </button>
          </div>

          {/* Three experiences of the same flow. Each card plays its own create page:
              Start from Scratch opens a blank create page in that style. */}
          <section aria-labelledby="ux-heading" className="mb-8">
            <h2 id="ux-heading" className="text-sm font-bold text-[#030213] mb-1">Choose an experience</h2>
            <p className="text-xs text-[#717182] mb-3">Same case, same rules and defaults, three ways of presenting it. Start a blank case in any of them. The scenarios below open in the selected experience.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {UX_OPTIONS.map(o => {
                const on = store.ux === o.id;
                return (
                  <div
                    key={o.id}
                    className={`flex flex-col bg-white rounded-2xl border p-4 transition-all ${on ? 'border-[#3F6FE8] ring-2 ring-[#3F6FE8]/25 shadow-sm' : 'border-[#E0E0E6] hover:border-[#C8D8FC]'}`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setUx(o.id)}
                      className="text-left flex-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6FE8]"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${on ? 'bg-gradient-to-br from-[#3F6FE8] to-[#6A5CE8] text-white' : 'bg-[#F3F3F5] text-[#3A3A4A]'}`}>{o.letter}</span>
                        <span className="text-sm font-semibold text-[#030213]">{o.name}</span>
                        {on && <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[#2F62D6]">Selected</span>}
                      </span>
                      <span className="block text-xs text-[#5A5A6A] leading-relaxed mt-2">{o.blurb}</span>
                    </button>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => play(o.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8] hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6FE8] focus-visible:ring-offset-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" aria-hidden />
                        Start from Scratch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
                        <p className="text-[11px] text-[#717182] leading-snug truncate" title={step.description}>
                          {USERS.find(u => u.id === step.as)!.name} · {step.shows.join(' · ')}
                        </p>
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
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-xs text-[#8B8B9E] hover:text-[#030213] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to demo
        </button>
      </footer>
    </div>
  );
}
