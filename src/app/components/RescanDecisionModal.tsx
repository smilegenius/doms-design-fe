import { useState } from 'react';
import { Copy, Info } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import RescanMatchCard from './RescanMatchCard';
import { RESCAN_LOOKBACK_DAYS, RescanMatch } from '../data/rescanDetection';

// ─── "Potential Related Case Found" decision ─────────────────────────────────
// Shown before a case is completed (and again from Case Details for a case
// that was never resolved). Smile Genius never classifies a rescan on its own:
// this modal presents the evidence and the user picks one of the two outcomes
// the spec allows — Continue as New Case, or Mark as Rescan of a chosen
// original. Copy is the product spec's.
export default function RescanDecisionModal({
  matches,
  onContinueAsNew,
  onMarkAsRescan,
  onClose,
  busyLabel,
}: {
  matches: RescanMatch[];
  onContinueAsNew: () => void;
  onMarkAsRescan: (match: RescanMatch) => void;
  onClose: () => void;
  /** Label for the "continue" action — the creation flow says "Continue as New Case". */
  busyLabel?: string;
}) {
  // Highest-confidence match is pre-selected; the user can pick another.
  const [selectedId, setSelectedId] = useState(matches[0]?.case.id ?? '');
  const selected = matches.find(m => m.case.id === selectedId) ?? matches[0];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Potential Related Case Found"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onContinueAsNew}>
            {busyLabel ?? 'Continue as New Case'}
          </Button>
          <Button
            icon={<Copy className="w-4 h-4" />}
            disabled={!selected}
            onClick={() => selected && onMarkAsRescan(selected)}
          >
            Mark as Rescan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#1565C0] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#1565C0]">
              We found {matches.length === 1 ? 'an existing case' : 'one or more existing cases'} that closely
              {matches.length === 1 ? ' matches' : ' match'} this submission.
            </p>
            <p className="text-[11px] text-[#3B6BAE] leading-relaxed mt-0.5">
              Please review the suggested case before continuing. Smile Genius never marks a case as a rescan on its
              own — the decision is yours.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {matches.map(m => (
            <RescanMatchCard
              key={m.case.id}
              match={m}
              selected={m.case.id === selectedId}
              onSelect={() => setSelectedId(m.case.id)}
            />
          ))}
        </div>

        <p className="text-[10px] text-[#A0A0B0] leading-relaxed">
          Cases created in the last {RESCAN_LOOKBACK_DAYS} days at the same clinic, for the same patient, dentist, lab
          and service are considered. Confidence weighs each matching attribute equally.
        </p>
      </div>
    </Modal>
  );
}
