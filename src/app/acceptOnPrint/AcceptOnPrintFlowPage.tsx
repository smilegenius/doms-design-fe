import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Mail, Moon, Package, Printer, ScanLine, Smile } from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { casePath } from './LabFrame';
import { LabStatusChip } from './labStatus';
import { ensureDemo, resetCase, useLabCases } from './store';

// ─── [Lab] Accept case on print · Nov-2026 ───────────────────────────────────
// Pressing Print on the Smile Genius order form asks the lab first, so labs
// start moving statuses on: a case not yet accepted is accepted (or put On Hold
// with Something missing), a posted one not marked received is received too, and
// an accepted one only confirms the print. Lab Cases list and Case Details, for
// every lab and every case.
// Each scenario opens the portal's own Case Details with the popup already up, on
// its case as the demo starts it, so it can be tried again and again. Closing the
// popup or answering it stays on Case Details; Back comes here.

interface Scenario {
  caseId: string;
  title: string;
  note: string;
  icon: React.ReactNode;
}

const STEPS: { label: string; blurb: string; tryIt: string[]; cases: Scenario[] }[] = [
  {
    label: 'Digital · not accepted',
    blurb: 'Olivia Bennett’s crown came in from an iTero and is Submitted. Print asks “Do you have everything needed to process this case?”',
    tryIt: ['Accept & print: the case moves to Accepted and the form prints'],
    cases: [
      { caseId: 'CASE-ACC-5101', title: 'CASE-ACC-5101 · Olivia Bennett', note: 'Crown 36 · iTero', icon: <ScanLine className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Postal · not marked received',
    blurb: 'George Patel’s bridge was posted by Royal Mail and nobody has marked it as received. Print asks “Has the parcel arrived, and do you have everything needed to process this case?” and shows the courier and tracking number.',
    tryIt: ['Mark received, accept & print: Received, then Accepted'],
    cases: [
      { caseId: 'CASE-ACC-5102', title: 'CASE-ACC-5102 · George Patel', note: 'Bridge 14–16 · Sent via Post · not received', icon: <Package className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Postal · received, not accepted',
    blurb: 'Chloe Martin’s night guard was posted and the lab has already marked it as received. Print asks “Do you have everything needed to process this case?”, the same as a digital case.',
    tryIt: ['Accept & print: Accepted, and the form prints'],
    cases: [
      { caseId: 'CASE-ACC-5103', title: 'CASE-ACC-5103 · Chloe Martin', note: 'Night Guard · Sent via Post · Received', icon: <Moon className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Something missing',
    blurb: 'Amira Hassan’s veneers came in by email. Pick Something missing, then what’s missing (Shade, Photos…) and a message for the practice: the case goes On Hold and nothing prints. A posted case with something missing counts as received, unless the parcel hasn’t arrived.',
    tryIt: ['Something missing → Shade + Photos → Put on hold'],
    cases: [
      { caseId: 'CASE-ACC-5104', title: 'CASE-ACC-5104 · Amira Hassan', note: 'Veneers 11, 21 · Email', icon: <Mail className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Already accepted',
    blurb: 'Once a case is accepted, or moved past Accepted, Print only asks “Print the order form?”.',
    tryIt: ['Print form: the form prints and the status stays as it is'],
    cases: [
      { caseId: 'CASE-ACC-5105', title: 'CASE-ACC-5105 · Daniel Price', note: 'Crown 46 · Medit', icon: <Crown className="w-4 h-4" /> },
      { caseId: 'CASE-ACC-5106', title: 'CASE-ACC-5106 · Ruby Clarke', note: 'Retainer · 3Shape', icon: <Smile className="w-4 h-4" /> },
    ],
  },
];

export default function AcceptOnPrintFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const cases = useLabCases();

  const press = (s: Scenario) => {
    // Walkthroughs never stop at the login page: sign in with the demo account.
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    ensureDemo();
    resetCase(s.caseId);
    navigate(`${casePath(s.caseId)}?print=1`);
  };

  return (
    <div className="min-h-screen bg-white bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="acceptprint_grad" />
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
                <Printer className="w-7 h-7 text-[#15803D]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] mb-3">
              November 2026 · Lab · Walkthrough
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Accept case on print</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Pressing Print on the Smile Genius order form asks the lab first, so labs start changing statuses: a case not yet accepted is accepted as it prints, a posted one not marked received is received too, and an accepted one only confirms the print. Every lab and every case, on the Cases list and on Case Details.
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
                  <ul className="mt-2 space-y-0.5">
                    {sc.tryIt.map(t => (
                      <li key={t} className="flex items-start gap-1.5 text-[11px] text-[#5A5568] leading-snug">
                        <span className="text-[#4D8EF7] font-bold">›</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="divide-y divide-[#F0EFF6] border-t border-[#F0EFF6]">
                  {sc.cases.map(s => {
                    const c = cases.find(x => x.id === s.caseId);
                    return (
                      <div key={s.caseId} className="flex items-center gap-3 px-4 sm:px-5 py-2.5">
                        <span className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#5A5568] flex items-center justify-center flex-shrink-0">{s.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#030213] leading-snug">{s.title}</p>
                          <p className="text-[11px] text-[#717182] leading-snug truncate">{s.note}</p>
                        </div>
                        {/* Live: shows what the popup last did (Accepted, On Hold…). */}
                        {c && <LabStatusChip status={c.status} />}
                        <button
                          onClick={() => press(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
                        >
                          <Printer className="w-3 h-3" />
                          Open popup
                        </button>
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
