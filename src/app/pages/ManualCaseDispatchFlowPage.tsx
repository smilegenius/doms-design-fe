import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FilePlus2, ListChecks, Truck } from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';

// ─── New stage in manual case creation · Impressions → print & dispatch ──────
// Runs on the real clinic screens. New Lab Work now starts on Impressions (By
// Post); creating the case does not send it to the lab. It lands as Ready for
// Dispatch and opens on the case, where the receptionist prints the order form
// and label, picks a courier and sends it — which submits the case.

interface Nav {
  title: string;
  note: string;
  icon: React.ReactNode;
  path: string;
}

const STEPS: { label: string; blurb: string; navs: Nav[] }[] = [
  {
    label: 'Dentist — create New Lab Work',
    blurb: 'The clinic portal’s New Lab Work form opens with the scan source already set to Impressions (By Post), and it can be changed. Add the patient, lab, service (tooth, material, shade), delivery date and any files, then create the case.',
    navs: [
      {
        title: 'New Lab Work',
        note: 'Scan source preselected · Impressions (By Post)',
        icon: <FilePlus2 className="w-4 h-4" />,
        path: '/clinic/cases/quick-new',
      },
    ],
  },
  {
    label: 'Receptionist — print, ship, submit',
    blurb: 'The case is created as Ready for Dispatch and opens straight away: it is not with the lab yet. The receptionist prints the order form and label, picks Lab Courier, Royal Mail, DPD or DHL, bag or box, and an optional tracking number. Dispatching sets the case to Submitted.',
    navs: [
      {
        title: 'Case detail — Ready for Dispatch',
        note: 'CASE-DISP-4001 · Print label & dispatch opens the courier dialog',
        icon: <Truck className="w-4 h-4" />,
        path: '/clinic/cases/CASE-DISP-4001',
      },
      {
        title: 'Lab Work list',
        note: 'Ready for Dispatch cases are pinned to the top',
        icon: <ListChecks className="w-4 h-4" />,
        path: '/clinic/cases',
      },
    ],
  },
];

export default function ManualCaseDispatchFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const open = (nav: Nav) => {
    // Walkthroughs never stop at the login page: sign in with the demo account.
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    navigate(nav.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="manualdispatch_grad" />
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
                <Truck className="w-7 h-7 text-[#B45309]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FFF8E1] border border-[#FDE68A] text-[#B45309] mb-3">
              October 2026 · Simulation
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">New stage in manual case creation</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Creating New Lab Work in the clinic portal no longer sends the case straight to the lab. Walk it through on the real screens.
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
