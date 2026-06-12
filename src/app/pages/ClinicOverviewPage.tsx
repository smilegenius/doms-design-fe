import { Sparkles, ArrowRight, FolderKanban, Construction, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─── Clinic Portal — Overview ────────────────────────────────────────────────
// Lean overview for the Clinic Portal. Hosts the welcome header and a
// placeholder where future clinic-specific metrics will live (case throughput,
// open cases, upcoming deliveries, etc. — to be defined together).
// Wired to the same Layout chrome and visual language as the supplier overview
// so the move between portals doesn't feel like a different product.
//
// Props:
//   - onOpenCases: navigates the Clinic Portal to its Cases list. Kept as a
//     prop (rather than `navigate('/clinic/cases')` here) so this page stays
//     decoupled from the route shape.
export default function ClinicOverviewPage({ onOpenCases, onCreateCase }: {
  onOpenCases: () => void;
  onCreateCase: () => void;
}) {
  const { user } = useAuth();
  const displayName = (user?.email || 'there').split('@')[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      {/* Hero — welcome strip */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E0E0E6] p-6 sm:p-8 mb-6">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: 'radial-gradient(circle at top right, #EEF4FF, transparent 65%), radial-gradient(circle at bottom left, #F5F3FF, transparent 70%)' }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white border border-[#E0E0E6] text-[#5A5568] mb-3">
              <Sparkles className="w-3 h-3 text-[#A59DFF]" />
              Clinic Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] capitalize">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-[#717182] mt-1.5 leading-relaxed max-w-xl">
              This is the home of your clinic workspace. Track cases through the lab pipeline, open prescriptions, and check on outstanding deliveries — all from one place.
            </p>
          </div>
          {/* Stack: primary "Create Case" CTA on top, secondary "Open Cases" link below */}
          <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
            <button
              onClick={onCreateCase}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Case
            </button>
            <button
              onClick={onOpenCases}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] hover:text-[#030213] hover:bg-[#F8F9FC] transition-colors"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              Open Cases
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics placeholder — explicit so we remember to fill it in later */}
      <div className="bg-white border border-dashed border-[#E0E0E6] rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-[#FFF8E1] border border-[#FDE68A] flex items-center justify-center mb-4">
          <Construction className="w-5 h-5 text-[#B45309]" />
        </div>
        <p className="text-base font-semibold text-[#030213] mb-1">Metrics coming soon</p>
        <p className="text-sm text-[#717182] max-w-md leading-relaxed">
          We'll wire up the right clinic-side metrics here together — open cases by stage, lab turnaround time, upcoming deliveries, and anything else that earns its place.
        </p>
      </div>
    </div>
  );
}
