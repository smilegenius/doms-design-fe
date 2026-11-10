import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Boxes, Crown, Download, FileText, Link2, Loader2, Smile } from 'lucide-react';
import { useAuth, DEMO_ACCOUNT_EMAIL } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { BRIDGE_CASE_ID, MULTI_CASE_ID, ensureBridgeDemo, ensureMultiCaseDemo } from '../newCase/orderFormDemo';
import { orderFormModelFor } from '../newCase/FlowCaseDetail';
import { OrderFormPdfJob, type OrderFormModel } from '../newCase/OrderForm';

// ─── Order form in Case Details · Oct-2026 ───────────────────────────────────
// The new Dental Order Form, shown on the New Case Flow's View Case (the
// portal's own Case Details, fed from the flow): in the service's Order form
// panel, in Full View and in the Order Form modal. The portal's Cases screens
// keep their current form; only the flow sets the page's OrderFormSlot.
// Four examples, as the user listed them (5-Nov-2026): a crown, a crown with a
// full denture's every stage, a denture with two stages, and a bridge.

interface Nav {
  title: string;
  note: string;
  icon: React.ReactNode;
  /** The flow case it opens (View Case) or downloads the order form of. */
  caseId: string;
  /** Puts the demo case in the flow's Lab Work first, when it isn't there. */
  before?: () => void;
}

const STEPS: { label: string; blurb: string; navs: Nav[] }[] = [
  {
    label: 'Crown',
    blurb: 'William Grant’s crown on 46 at Northfield. Open Order form beside the 3D viewer, or Full View for the whole sheet, which prints on one A4 page (or Download PDF): the patient at the top with the QR and the Smile Genius logo, then dentist, practice, lab, ship-to address, received via and treatments in two rows, the Tooth Chart in the user’s tooth system, the service details and the instruction.',
    navs: [
      {
        title: 'View Case — CAS-2026-098',
        note: 'William Grant · Crown 46 · Monolithic zirconia · Delivered',
        icon: <Crown className="w-4 h-4" />,
        caseId: 'CAS-2026-098',
      },
    ],
  },
  {
    label: 'Crown + full denture, all stages',
    blurb: 'Margaret Hill’s order at Northfield: a crown on 45 and a new upper full denture with all five stages ordered at once, each with its own day. Each treatment has a number and a colour, on the chart and in Treatments. The Denture Stage History lists the five stages, and one instruction covers them all, as the New case flow takes it.',
    navs: [
      {
        title: `View Case — ${MULTI_CASE_ID}`,
        note: 'Margaret Hill · Crown 45 + Full denture (upper), 5 stages · In production',
        icon: <Boxes className="w-4 h-4" />,
        caseId: MULTI_CASE_ID,
        before: ensureMultiCaseDemo,
      },
    ],
  },
  {
    label: 'Full denture, 2 stages',
    blurb: 'Edward Thomas’s upper denture: Pennine made the Special Tray and the Bite Registration on CAS-2026-117. The Denture Stage History has those two stages with their dates and status (the other three not ordered), and one instruction covers both.',
    navs: [
      {
        title: 'View Case — CAS-2026-117',
        note: 'Edward Thomas · Special Tray · Bite Registration · Done',
        icon: <Smile className="w-4 h-4" />,
        caseId: 'CAS-2026-117',
      },
    ],
  },
  {
    label: 'Bridge',
    blurb: 'Ben Ortiz’s three-unit bridge 35–37 at Northfield, over his missing 36, from a Medit scan. The chart shows the span with 36 as the pontic, and the service details give the units, material, shade and delivery date.',
    navs: [
      {
        title: `View Case — ${BRIDGE_CASE_ID}`,
        note: 'Ben Ortiz · Bridge 35–37 (36 pontic) · In production',
        icon: <Link2 className="w-4 h-4" />,
        caseId: BRIDGE_CASE_ID,
        before: ensureBridgeDemo,
      },
    ],
  },
];

export default function OrderFormFlowPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const { toast } = useToast();
  // The order form being saved as a PDF, straight from here (no View Case on the way).
  const [job, setJob] = useState<{ caseId: string; model: OrderFormModel } | null>(null);

  const open = (nav: Nav) => {
    // Walkthroughs never stop at the login page: sign in with the demo account.
    if (!user) login(DEMO_ACCOUNT_EMAIL, 'demo');
    nav.before?.();
    navigate(`/flows/new-case/view/${nav.caseId}`);
  };
  const download = (nav: Nav) => {
    if (job) return;
    nav.before?.();
    const model = orderFormModelFor(nav.caseId);
    if (!model) { toast.error(`${nav.caseId} isn’t in the demo data. Reset the demo data on the New case flow, then try again.`); return; }
    setJob({ caseId: nav.caseId, model });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      {job && (
        <OrderFormPdfJob
          key={job.caseId}
          model={job.model}
          onDone={ok => {
            if (!ok) toast.error('The PDF couldn’t be made. Open the case and use Print, choosing “Save as PDF”.');
            setJob(null);
          }}
        />
      )}
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
                        onClick={() => download(nav)}
                        disabled={!!job}
                        aria-label={`Download the order form of ${nav.caseId} as a PDF`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] disabled:opacity-60 disabled:cursor-wait transition-colors flex-shrink-0"
                      >
                        {job?.caseId === nav.caseId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        {job?.caseId === nav.caseId ? 'Preparing…' : 'Download PDF'}
                      </button>
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
