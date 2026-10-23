// ─── New Case Flow · derived context ─────────────────────────────────────────
// Builds the rules context for a draft (patient, lab, prescriber) so the case
// page, the launcher and the Cases list count gaps the same way.

import { User, labById, userById } from './data';
import { demoNow } from './dates';
import { CaseDraft, Ctx, gapCount, itemTitle, resolvePrescriber } from './rules';
import { getPatient, loginMap } from './store';

export function buildCtx(draft: CaseDraft, user: User): { ctx: Ctx; prescriber?: User; prescriberSrc?: string } | null {
  const patient = getPatient(draft.patientId);
  if (!patient) return null;
  const pres = resolvePrescriber(draft, user, loginMap());
  const prescriber = userById(pres.id);
  return {
    ctx: { patient, lab: labById(draft.lab), user, prescriber, funding: draft.funding, now: demoNow() },
    prescriber,
    prescriberSrc: pres.src,
  };
}
export function draftGaps(draft: CaseDraft, user: User): number {
  const b = buildCtx(draft, user);
  return b ? gapCount(draft, b.ctx) : 0;
}
/** "Crown · 36 · LL6 + Night guard · UPPER" for the Cases list. */
export function serviceSummary(draft: CaseDraft, user: User): string {
  if (!draft.items.length) return '—';
  return draft.items.map(i => itemTitle(i, user.notation)).join(' + ');
}
export function scanArchesText(draft: CaseDraft): string {
  const a = draft.scan?.arches;
  if (!a) return '';
  const parts = [a.upper && 'upper', a.lower && 'lower', a.bite && 'bite'].filter(Boolean) as string[];
  return parts.length === 3 ? 'upper, lower, bite' : parts.join(', ');
}
