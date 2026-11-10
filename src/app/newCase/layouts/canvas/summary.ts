// ─── Experience C · case summary lines ───────────────────────────────────────
// The few lines the footer, the navigator and the Review card all say the same
// way: when it's back, and how much of the case is answered. The flow shows no
// prices.

import type { CaseApi } from '../../CaseContext';
import { fmtDay } from '../../dates';
import { PriceInfo, plural, slotsFor } from '../../rules';

/**
 * Always ''. The flow shows no prices, so the case has no amount to show; kept
 * so existing callers compile. Use backLine for the case's one-line summary.
 */
export function caseAmount(_api: CaseApi): string {
  return '';
}

/** "Back by Mon 2 Nov", "Back 5 working days after the scan", … */
export function backLine(api: CaseApi): string {
  const { draft, dates } = api;
  // A day the clinic asked for is fixed: only a lab's lead time counts from the scan.
  if (dates.route === 'follow' && dates.ta != null && !dates.fixed) return `Back ${plural(dates.ta, 'working day')} after the scan`;
  if (dates.backBy) return `Back by ${fmtDay(dates.backBy)}`;
  return draft.items.length ? 'Back-by date once every item is chosen' : 'Add a service to see the date';
}

/** One service's lead time in a list: "7 days", or '' when it isn't known yet. No price. */
export function shortPrice(p: PriceInfo): string {
  if (p.kind === 'none') return '';
  return p.ta != null ? plural(p.ta, 'day') : '';
}

/**
 * Answered required items out of all of them: the lab, a first service, every
 * service's required answers, the scans source and the prescriber. The same
 * things gapCount counts, so `done` is simply total less the gaps.
 */
export function progressOf(api: CaseApi): { done: number; total: number; ratio: number } {
  const { draft, ctx, gaps } = api;
  const slots = draft.items.reduce((n, it) => n + slotsFor(it, ctx, draft).filter(s => s.required).length, 0);
  const total = 3 + (draft.items.length === 0 ? 1 : 0) + slots;
  const done = Math.max(0, Math.min(total, total - gaps));
  return { done, total, ratio: total ? done / total : 0 };
}
