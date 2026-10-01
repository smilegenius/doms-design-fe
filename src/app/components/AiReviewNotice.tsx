import { Sparkles } from 'lucide-react';

// PM copy, verbatim — shown wherever an email-made (AI-enriched) draft appears:
// the creation screen, the case page and the list tag's tooltip.
export const AI_REVIEW_COPY =
  'This case has been enriched using AI. AI-generated information may be inaccurate or incomplete. Please review all case details carefully and verify their accuracy before proceeding';

/** Red banner for AI-enriched drafts. Same look on every screen. */
export function AiReviewNotice({ className = '' }: { className?: string }) {
  return (
    <div role="note" className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] ${className}`}>
      <span className="w-6 h-6 rounded-lg bg-white border border-[#FECACA] text-[#D4183D] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5" />
      </span>
      <p className="text-[11px] text-[#991B1B] leading-snug pt-1">{AI_REVIEW_COPY}</p>
    </div>
  );
}

/** Compact red chip for the Cases / Lab Work list. Tooltip carries the full copy. */
export function AiReviewTag() {
  return (
    <span
      title={AI_REVIEW_COPY}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] text-[#D4183D] border border-[#FECACA] cursor-help"
    >
      <Sparkles className="w-2.5 h-2.5" />
      Needs your review
    </span>
  );
}
