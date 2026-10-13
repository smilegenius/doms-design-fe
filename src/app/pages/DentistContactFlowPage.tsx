import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, MessageCircle, List, FileText, UserX } from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';

// ─── Chasing a dentist with no contact on file · negative scenarios ──────────
// "Email dentist" and "WhatsApp dentist" both need somewhere to send to. When
// the lab has no email / no number for the dentist, nothing is sent: the lab is
// told why and the dentist's private record opens on the missing field. Saving
// it retries the send straight away. Same compact shape as the other
// walkthroughs: one card per scenario, one navigation per screen.

interface Nav {
  title: string;
  note: string;
  icon: React.ReactNode;
  path: string;
}

interface Scenario {
  label: string;
  blurb: string;
  navs: Nav[];
}

const SCENARIOS: Scenario[] = [
  {
    label: 'Email dentist — no email on file',
    blurb: 'CASE-051 arrived from the scanner incomplete, and Dr. Harper has no private email and did not write in. Pressing “Email dentist” sends nothing: an error says there is no email on file and the dentist’s private information opens on the email field. Saving an address sends the missing-info email and sets the case to Sent for Review.',
    navs: [
      {
        title: 'List — the incomplete case',
        note: 'CASE-051 · Need Attention · Dr. Harper',
        icon: <List className="w-4 h-4" />,
        path: '/lab/cases',
      },
      {
        title: 'Detail — press Email dentist',
        note: 'Error toast · private info opens on Email · save to send',
        icon: <Mail className="w-4 h-4" />,
        path: '/lab/cases/CASE-051',
      },
    ],
  },
  {
    label: 'WhatsApp dentist — no number on file',
    blurb: 'The same case, over WhatsApp (the button appears beside Email dentist once WhatsApp automation is on). Dr. Harper has no number in the clinic directory and no private one, so nothing is sent: an error says there is no phone number on file and the private information opens on the phone field. Saving a number retries the send.',
    navs: [
      {
        title: 'Detail — press WhatsApp dentist',
        note: 'Error toast · private info opens on Phone · save to send',
        icon: <MessageCircle className="w-4 h-4" />,
        path: '/lab/cases/CASE-051',
      },
      {
        title: 'Detail — the lock beside the dentist',
        note: 'Same private record, opened by hand: email · phone · notes',
        icon: <UserX className="w-4 h-4" />,
        path: '/lab/cases/CASE-051',
      },
    ],
  },
];

export default function DentistContactFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const isAuthed = !!user;

  const open = (nav: Nav) => {
    // Walkthroughs never stop at the login page: sign in with the demo account.
    if (!isAuthed) login(DEMO_ACCOUNT_EMAIL, 'demo');
    navigate(nav.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="dentistcontact_grad" />
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
                <UserX className="w-7 h-7 text-[#D4183D]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#FEF2F2] border border-[#FECACA] text-[#D4183D] mb-3">
              October 2026 · 2 negative scenarios
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">Dentist with no contact on file</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              What the lab sees when it chases a dentist by email or WhatsApp and there is no email address or phone number to send to. Each step opens the exact screen.
            </p>
          </div>

          <div className="space-y-4">
            {SCENARIOS.map((sc, i) => (
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
