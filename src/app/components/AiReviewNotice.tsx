import { AiSparkle } from './AiSparkle';

// PM copy, verbatim — shown wherever an email-made (AI-enriched) draft appears:
// the creation screen, the case page and the list badge's tooltip.
export const AI_REVIEW_COPY =
  'This case has been enriched using AI. AI-generated information may be inaccurate or incomplete. Please review all case details carefully and verify their accuracy before proceeding';

/**
 * The badge for AI-enriched drafts — the app's AI logo (the same "✦ AI" pill
 * auto-filled fields carry) + "Need Attention". Used on the Cases / Lab Work
 * list AND at the head of the banner, so both read the same.
 */
export function AiReviewTag() {
  return (
    <span
      title={AI_REVIEW_COPY}
      className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] text-[#D4183D] border border-[#FECACA] cursor-help whitespace-nowrap"
    >
      <AiSparkle label title={AI_REVIEW_COPY} className="bg-white" />
      Need Attention
    </span>
  );
}

/** Red banner for AI-enriched drafts: the list badge, then the PM copy. */
export function AiReviewNotice({ className = '' }: { className?: string }) {
  return (
    <div role="note" className={`flex items-start gap-3 px-3.5 py-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] ${className}`}>
      <span className="flex-shrink-0 pt-px"><AiReviewTag /></span>
      <p className="text-[11px] text-[#991B1B] leading-snug pt-0.5">{AI_REVIEW_COPY}</p>
    </div>
  );
}
