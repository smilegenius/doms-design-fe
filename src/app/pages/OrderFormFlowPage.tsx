import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Crown, FileText, Moon, Smile } from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { setUserId, setUx } from '../newCase/store';

// ─── Order form in Case Details · Oct-2026 ───────────────────────────────────
// The new Dental Order Form, shown on the New Case Flow's View Case (the
// portal's own Case Details, fed from the flow): in the service's Order form
// panel, in Full View and in the Order Form modal. The portal's Cases screens
// keep their current form; only the flow sets the page's OrderFormSlot.

interface Nav {
  title: string;
  note: string;
  icon: React.ReactNode;
  path: string;
  /** Opens a new flow case (Guided, as Dr Khan), not an existing one. */
  newCase?: boolean;
}

const STEPS: { label: string; blurb: string; navs: Nav[] }[] = [
  {
    label: 'A full denture with two stages made',
    blurb: 'Edward Thomas’s upper denture: Pennine made the Special Tray and the Bite Registration on CAS-2026-117. Open Order form beside the 3D viewer, or Full View for the whole sheet: patient, dentist, practice, lab, ship-to address and case type, the Tooth Chart in the user’s tooth system, the Denture Stage History with each stage’s dates and status, the service details, one instruction card per stage, and the scan and attachment files.',
    navs: [
      {
        title: 'View Case — CAS-2026-117',
        note: 'Special Tray · Bite Registration · Done',
        icon: <Smile className="w-4 h-4" />,
        path: '/flows/new-case/view/CAS-2026-117',
      },
    ],
  },
  {
    label: 'The next stage adds to the same history',
    blurb: 'Order Edward’s next stage: the case opens with the earlier stages done and Try In ordered (tick Finish too if you like), then press Ready for Dispatch and View Case. Its order form keeps Special Tray and Bite Registration as Done, with CAS-2026-117’s dates and instructions, and adds Try In (and Finish) with this case’s dates, status and instructions.',
    navs: [
      {
        title: 'New case — Edward Thomas, next stage',
        note: 'Pennine Denture Lab · Try In ordered · then View Case',
        icon: <Smile className="w-4 h-4" />,
        path: '/flows/new-case/case/new?patient=P-2025-009&lab=pennine&start=next',
        newCase: true,
      },
    ],
  },
  {
    label: 'Any other case',
    blurb: 'Every finished case in the flow’s Lab Work opens with the same form. Without a denture there is no stage history: the Service Details table lists each service with its teeth, material, shade and delivery date, and each service’s instructions get their own card. A case made from a scan lists its scan files; impressions by post say they come in the parcel.',
    navs: [
      {
        title: 'View Case — CAS-2026-098',
        note: 'William Grant · Crown 46 · Delivered',
        icon: <Crown className="w-4 h-4" />,
        path: '/flows/new-case/view/CAS-2026-098',
      },
      {
        title: 'View Case — CAS-2026-131',
        note: 'Ben Ortiz · Night guard, upper · In production',
        icon: <Moon className="w-4 h-4" />,
        path: '/flows/new-case/view/CAS-2026-131',
      },
    ],
  },
];

export default function OrderFormFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const open = (nav: Nav) => {
    // Walkthroughs never stop at the login page: sign in with the demo account.
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    if (!nav.newCase) { navigate(nav.path); return; }
    // As the New case walkthrough launches a flow: Guided, signed in as Dr Khan.
    setUx('guided');
    setUserId('khan');
    navigate(nav.path, { state: { session: `wt-${Date.now()}` } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="orderform_grad" />
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
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] opacity-15 blur-xl" />
              <div className="relative w-16 h-16 rounded-3xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center">
                <FileText className="w-7 h-7 text-[#1565C0]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#EEF4FF] border border-[#C8D8FC] text-[#1565C0] mb-3">
              October 2026 · Walkthrough
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Order form in Case Details</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              The new Dental Order Form on the New case flow’s View Case. The portal’s Cases screens keep their current form until this is approved.
            </p>
          </div>

          <div className="space-y-4">
            {STEPS.map((sc, i) => (
              <section key={sc.label} className="bg-white border border-[#E0E0E6] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 sm:px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[11px] font-bold flex items-center justify-center tabular-nums flex-shrink-0">{i + 1}</span>
                    <h2 className="text-sm font-bold text-[#030213] leading-snug">{sc.label}</h2>
                  </div>
                  <p className="text-xs text-[#717182] leading-relaxed mt-1.5">{sc.blurb}</p>
                </div>
                <div className="divide-y divide-[#F0EFF6] border-t border-[#F0EFF6]">
                  {sc.navs.map(nav => (
                    <div key={nav.title} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                      <span className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#5A5568] flex items-center justify-center flex-shrink-0">{nav.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#030213] leading-snug">{nav.title}</p>
                        <p className="text-[11px] text-[#717182] leading-snug truncate">{nav.note}</p>
                      </div>
                      <button
                        onClick={() => open(nav)}
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
