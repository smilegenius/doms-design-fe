// ─── New Case Flow · the footer's arrow ──────────────────────────────────────
// Guided keeps one "move on" control: the round arrow in the sticky footer. A
// step that needs an explicit "that's it" (several teeth, wings, a description)
// hands its action to that arrow instead of drawing its own; any other step's
// arrow just goes to the next gap. Conversation and One page have no such
// footer, so there the step keeps its own arrow.

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { itemTitle } from './rules';
import type { CaseDraft, Notation, StepNode } from './rules';

export interface ArrowAction {
  /** What a screen reader hears: "Done: 25 · UL5". */
  label: string;
  disabled: boolean;
  /** Why it can't go yet. */
  hint?: string;
  /** Where it lands: "Material". */
  next?: string;
  run: () => void;
}

const FooterArrow = createContext(false);
/** Wraps a layout whose footer carries the arrow. */
export const FooterArrowProvider = FooterArrow.Provider;
export const useFooterArrow = () => useContext(FooterArrow);

let current: ArrowAction | null = null;
const listeners = new Set<() => void>();
const publish = (a: ArrowAction | null) => { current = a; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** False around an editor that's on screen but isn't the current step (Guided's teeth chart beside another item's editor). */
const ArrowActive = createContext(true);
export const ArrowActiveProvider = ArrowActive.Provider;
export const useArrowActive = () => useContext(ArrowActive);

/** The action the current step handed over, if any. */
export const useStepArrow = () => useSyncExternalStore(subscribe, () => current, () => current);

/** Hand this step's "done" to the footer's arrow while `active`. */
export function useHandArrow(active: boolean, a: ArrowAction) {
  const run = useRef(a.run);
  run.current = a.run;
  useEffect(() => {
    if (!active) return;
    publish({ label: a.label, disabled: a.disabled, hint: a.hint, next: a.next, run: () => run.current() });
    return () => publish(null);
  }, [active, a.label, a.disabled, a.hint, a.next]);
}

const STEP_NAME: Record<string, string> = {
  patient: 'Patient', lab: 'Lab', services: 'Services', records: 'Scans Source', prescriber: 'Prescriber', delivery: 'Delivery', review: 'Review and Send',
};
/** A step's name as the timeline says it: "Lab", "Material", or "Crown · 26 · Shade" for another service. */
export function stepName(steps: StepNode[], id: string, draft: CaseDraft, n: Notation, ownItem?: string): string {
  const s = steps.find(x => x.id === id);
  if (!s) return STEP_NAME.review;
  if (!s.slot) return STEP_NAME[s.kind] ?? STEP_NAME.review;
  if (s.itemId === ownItem) return s.slot.label;
  const item = draft.items.find(x => x.id === s.itemId);
  return item ? `${itemTitle(item, n)} · ${s.slot.label}` : s.slot.label;
}
