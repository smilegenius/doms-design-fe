import { AlertTriangle } from 'lucide-react';

// Red "Urgent" pill shown on chat messages the sender flagged as urgent.
// Follows the app's pill recipe (see ScoreBadge / typeChip) using the
// danger-red family already established by the AI callouts and confirms.
export default function UrgentBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[9px] font-bold uppercase tracking-wider ${className}`}
    >
      <AlertTriangle className="w-2.5 h-2.5" />
      Urgent
    </span>
  );
}
