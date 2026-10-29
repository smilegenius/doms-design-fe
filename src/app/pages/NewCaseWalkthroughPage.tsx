import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, RotateCcw, FilePlus2, Play, Crown, Moon, Smile, Stethoscope, Boxes, List,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { LabId, PATIENTS, ProductId, USERS, UserId, userById } from '../newCase/data';
import { resetDemo, setUserId, setUx, useFlowStore } from '../newCase/store';
import { UX_OPTIONS } from '../newCase/controller';

// ─── New Case Flow · Oct-2026 — walkthrough ──────────────────────────────────
// The simplest way for a clinic to create lab work, in Guided steps: lab first,
// then each service on one card (the Teeth Chart or arch picker beside its
// questions, its own Delivery date), Scan Source and Review. Five flows, one per
// kind of order, each opening a new case for a patient picked for it on the
// service's card, with the lab already picked (NewCaseFlowPage presetDraft). It lives
// in the Flows section only, with its own Lab Work list and demo data, so the
// portal's Cases screens are unchanged.

/** Where a flow's Open lands: the lab already picked and, with a service (or a Services chip), that service's card. */
interface Start {
  lab: LabId;
  service?: ProductId;
  /** The Services step's chip instead of a tile: her Repeat, or his Next stage. */
  chip?: 'repeat' | 'next';
}
interface Script {
  /** "One tooth", "Night guard"… — only shown when a flow has more than one. */
  label: string;
  taps: string[];
  /** Opens somewhere other than the flow's own start (another service, a chip): every row then gets its own Open. */
  start?: Start;
}
interface Flow {
  title: string;
  icon: React.ReactNode;
  as: UserId;
  /** The demo patient the new case opens for (data.ts PATIENTS). */
  patient: string;
  start: Start;
  description: string;
  scripts: Script[];
  shows: string[];
  /** A second patient that shows a check this flow mentions (e.g. the under-18 block). */
  alt?: { label: string; patient: string; start: Start };
}

/** A new case for the patient, opened on the service's card with the lab (and service) already chosen. */
const newCaseFor = (patientId: string, start: Start) => {
  const q = new URLSearchParams({ patient: patientId, lab: start.lab });
  if (start.chip) q.set('start', start.chip);
  else if (start.service) q.set('service', start.service);
  return `/flows/new-case/case/new?${q}`;
};

const FLOWS: Flow[] = [
  {
    // Daniel has no history, missing teeth or implants: no remake or implant check on the way.
    title: 'Crown · one tooth or several',
    icon: <Crown className="w-4 h-4" />, as: 'khan', patient: 'P-2025-071',
    start: { lab: 'northfield', service: 'crown' },
    description: 'Opens on the Crown card, with Daniel and Northfield (the clinic’s usual lab) already chosen; ← goes back to change them. The Teeth Chart is in its first column, with Material, Shade and Delivery date beside it. Material starts on your usual, the Delivery date on the lab’s earliest day (pick a later one if you like), and Scan Source on Impressions (By Post). Several teeth are a crown each; teeth side by side add Separate or splinted (Separate unless changed).',
    scripts: [
      { label: 'One tooth', taps: ['tap 16 and the → arrow', 'Shade A2', 'Review', 'Ready for Dispatch'] },
      { label: 'Three teeth', taps: ['tap 14, 15 and 16 and the → arrow', 'Shade A2', 'Review: Separate (unless changed)', 'Ready for Dispatch'] },
    ],
    shows: ['Opens on the Crown card', 'Teeth Chart beside the questions', 'Your usual material', 'Separate or splinted', 'Ready for Dispatch'],
  },
  {
    // Whitening is private and blocked under 18, so an adult private patient; Hannah (16) shows the block.
    title: 'Whitening trays · Night guard',
    icon: <Moon className="w-4 h-4" />, as: 'khan', patient: 'P-2025-044',
    start: { lab: 'northfield', service: 'nightguard' },
    // A night guard is one arch (ArchEditor offers Both only for retainers, aligners, whitening trays and dentures).
    description: 'Each Open lands on its service’s card at Northfield for Priya, an adult private patient. Arch services: the card’s first column is the arch picker, Upper or Lower for a night guard and Upper, Lower or Both for whitening trays. Night Guard’s Type starts on Hard (your usual). Repeat opens her soft upper night guard from June 2025 with Upper and Soft filled in. Whitening Trays is private only and blocked for patients under 18: the age check opens Services for Hannah (16), where it shows as blocked under More.',
    scripts: [
      { label: 'Night guard', taps: ['Upper or Lower', 'Review', 'Ready for Dispatch'] },
      // Every item is filled (the Delivery date starts on the lab's earliest), so the → arrow goes on to Review.
      { label: 'Repeat', start: { lab: 'northfield', chip: 'repeat' }, taps: ['Upper and Soft are filled in from last time', 'the → arrow', 'Ready for Dispatch'] },
      { label: 'Whitening trays', start: { lab: 'northfield', service: 'whitening' }, taps: ['Both', 'Review', 'Ready for Dispatch'] },
    ],
    shows: ['Arch picker', 'Repeat', 'Private only', 'Delivery date', 'Ready for Dispatch'],
    alt: { label: 'Age check · Hannah Lowe (16)', patient: 'P-2025-052', start: { lab: 'northfield' } },
  },
  {
    // Edward is the follow-up patient: CAS-2026-117 made his tray and bite registration at Pennine.
    title: 'Full denture',
    icon: <Smile className="w-4 h-4" />, as: 'khan', patient: 'P-2025-009',
    start: { lab: 'pennine', chip: 'next' },
    description: 'Edward’s Special Tray and Bite Registration were made at Pennine on CAS-2026-117, so both Opens land at Pennine Denture Lab (Made the previous stage). Next stage opens his upper denture with those stages done and Try In ordered; New denture opens a fresh Full Denture card. The stages use the portal’s own stage picker: tick a stage and give it its date, or mark it Done elsewhere (with an optional done-on date). A full denture has no Delivery date of its own: each stage carries its day, and the impressions always go by post.',
    scripts: [
      { label: 'Next stage', taps: ['Tooth shade', 'Stages: Try In is filled in; tick Finish and give it a later date', 'Post-dam', 'Ready for Dispatch'] },
      { label: 'New denture', start: { lab: 'pennine', service: 'denture' }, taps: ['Lower', 'Stages: tick Special Tray, then Done elsewhere', 'tick Bite Registration and its date', 'Ready for Dispatch'] },
    ],
    shows: ['Made the previous stage', 'Next stage', 'Portal stage picker', 'Done elsewhere', 'A date per stage'],
  },
  {
    // Aligners are private work (Northfield and Harbour make them): an adult private patient with nothing in the way.
    title: 'Aligners',
    icon: <Stethoscope className="w-4 h-4" />, as: 'khan', patient: 'P-2025-018',
    start: { lab: 'northfield', service: 'aligner' },
    description: 'Opens on the Aligners card at Northfield for William, private work. An arch service: the Upper, Lower or Both picker in the first column, and the portal’s aligner specifics beside it (Duration, then the dropdowns for the corrections and assessment, from the portal’s own lists), then its Delivery date.',
    scripts: [
      { label: 'Aligners', taps: ['Upper, Lower or Both', 'Duration (Treatment setup)', 'the other aligner dropdowns, if you like', 'the → arrow', 'Ready for Dispatch'] },
    ],
    shows: ['Opens on the Aligners card', 'Arch picker', 'Aligner specifics', 'Portal dropdowns', 'Delivery date'],
  },
  {
    // Amelia's earlier crown is on 26, so 16 and 34–36 raise no remake check.
    title: 'Multi-service order',
    icon: <Boxes className="w-4 h-4" />, as: 'khan', patient: 'P-2025-031',
    start: { lab: 'northfield', service: 'crown' },
    description: 'A crown, a bridge and a night guard in one case at Northfield; it opens on the Crown card. Each service is its own card with its own Delivery date, so the night guard can come back before the bridge. Add Another Service on the timeline starts the next one, and Review’s Back by lists each service’s date by its name.',
    scripts: [
      {
        label: 'Crown + Bridge + Night Guard',
        taps: [
          'tap 16 and the → arrow', 'Shade', 'Add Another Service', 'Bridge',
          'tap 34 and 36 (35 is the pontic) and the → arrow', 'Shade', 'Add Another Service', 'Night Guard',
          'Delivery date: a later day', 'Upper', 'Review: Back by per service', 'Ready for Dispatch',
        ],
      },
    ],
    shows: ['Opens on the Crown card', 'Add Another Service', 'A card per service', 'Delivery date per service', 'Back by per service'],
  },
];

const patientById = (id: string) => PATIENTS.find(p => p.id === id);

export default function NewCaseWalkthroughPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { toast } = useToast();
  const store = useFlowStore();
  const signedIn = userById(store.userId)!;
  const dirty = store.rows.some(r => r.sentAt || (r.draft?.items.length && r.id !== 'CAS-2026-141')) || store.patients.length > 0 || store.events.length > 0;
  // Guided is the only experience: B and C stay in the code but nothing here opens them.
  const guided = UX_OPTIONS.find(o => o.id === 'guided')!;

  /** Every launch lands in Guided, whatever an earlier session left in the store. */
  const launch = (as: UserId, path: string) => {
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    setUx('guided');
    setUserId(as);
    navigate(path, { state: { session: `wt-${Date.now()}` } });
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
              October 2026 · Clinic · {FLOWS.length} flows
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">New case flow</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              From “Add new Case” to Ready for Dispatch in Guided steps: each service on one card with the Teeth Chart beside its questions and its own Delivery date, then Scan Source and Review. Desktop only (1280 px and up). Each flow opens a new case on its service’s card, with the patient and lab already chosen.
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

          {/* The one experience. Start from Scratch opens the blank create page, which asks for the patient. */}
          <section aria-labelledby="ux-heading" className="mb-8">
            <h2 id="ux-heading" className="text-sm font-bold text-[#030213] mb-1">Experience</h2>
            <p className="text-xs text-[#717182] mb-3">Every flow below opens in it. Start a blank case to try it with any patient.</p>
            <div className="flex flex-wrap items-center gap-4 bg-white rounded-2xl border border-[#3F6FE8] ring-2 ring-[#3F6FE8]/25 shadow-sm p-4">
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center bg-gradient-to-br from-[#3F6FE8] to-[#6A5CE8] text-white">{guided.letter}</span>
                  <span className="text-sm font-semibold text-[#030213]">{guided.name}</span>
                </span>
                <span className="block text-xs text-[#5A5A6A] leading-relaxed mt-2">{guided.blurb}</span>
              </div>
              <button
                type="button"
                onClick={() => launch('khan', '/flows/new-case/case/new')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8] hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6FE8] focus-visible:ring-offset-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden />
                Start from Scratch
              </button>
            </div>
          </section>

          <section aria-labelledby="flows-heading">
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <h2 id="flows-heading" className="text-sm font-bold text-[#030213] mb-1">Flows</h2>
                <p className="text-xs text-[#717182]">One per kind of order. Open signs in as the right person and starts a new case for the patient named, on the service’s card with the lab already picked; the taps are the shortest way through.</p>
              </div>
              <button
                type="button"
                onClick={() => launch('khan', '/flows/new-case/cases')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
              >
                <List className="w-3 h-3" aria-hidden />
                Open Lab Work
              </button>
            </div>

            <ol className="space-y-4">
              {FLOWS.map((flow, fi) => {
                const p = patientById(flow.patient);
                const alt = flow.alt && patientById(flow.alt.patient);
                const perScript = flow.scripts.some(s => s.start);
                return (
                  <li key={flow.title} className="bg-white border border-[#E0E0E6] rounded-2xl shadow-sm p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-lg bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0">{flow.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-[#030213] leading-snug">
                          <span className="tabular-nums text-[#8B8B9E] mr-1.5">{fi + 1}.</span>{flow.title}
                        </h3>
                        <p className="text-[11px] text-[#717182] leading-snug mt-0.5">
                          {USERS.find(u => u.id === flow.as)!.name}
                          {p && <> · for {p.first} {p.last} ({p.funding === 'nhs' ? 'NHS' : 'Private'})</>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => launch(flow.as, newCaseFor(flow.patient, flow.start))}
                        aria-label={`Open ${flow.title}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
                      >
                        Open
                        <ArrowRight className="w-3 h-3" aria-hidden />
                      </button>
                    </div>

                    <p className="text-xs text-[#5A5A6A] leading-relaxed mt-3">{flow.description}</p>

                    {/* The exact taps; arrows are visual only, so a screen reader hears "then". */}
                    <ul className="mt-3 space-y-1.5">
                      {flow.scripts.map(s => (
                        <li key={s.label} className="flex items-start gap-3 text-xs text-[#3A3A4A] leading-relaxed bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2">
                          <span className="min-w-0 flex-1">
                            {flow.scripts.length > 1 && <span className="font-semibold text-[#030213]">{s.label}: </span>}
                            {s.taps.map((t, i) => (
                              <Fragment key={i}>
                                {i > 0 && (<><ArrowRight aria-hidden className="inline w-3 h-3 mx-1 -mt-px text-[#A0A0B0]" /><span className="sr-only">, then </span></>)}
                                <span>{t}</span>
                              </Fragment>
                            ))}
                          </span>
                          {/* Scripts that start on different services each open their own case. */}
                          {perScript && (
                            <button
                              type="button"
                              onClick={() => launch(flow.as, newCaseFor(flow.patient, s.start ?? flow.start))}
                              aria-label={`Open ${flow.title}: ${s.label}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors flex-shrink-0"
                            >
                              Open
                              <ArrowRight className="w-3 h-3" aria-hidden />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {flow.shows.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#5A5568] bg-[#F3F3F5] border border-[#E0E0E6]">{s}</span>
                      ))}
                      {flow.alt && alt && (
                        <button
                          type="button"
                          onClick={() => launch(flow.as, newCaseFor(alt.id, flow.alt!.start))}
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
                        >
                          {flow.alt.label}
                          <ArrowRight className="w-3 h-3" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
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
