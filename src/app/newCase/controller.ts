// ─── New Case Flow · page controller ─────────────────────────────────────────
// Everything a layout needs beyond the case itself (CaseContext): which view
// the case is in, saving, sending, banners and the header line. The three
// experiences (Guided, Conversation, Canvas) all render from this one
// controller, so every rule, default and send path behaves the same in each.

import { createContext, RefObject, useContext } from 'react';
import type { User } from './data';
import type { CaseRow } from './store';

export type CaseView = 'edit' | 'approve' | 'waiting' | 'sent';
export type Ux = 'guided' | 'chat' | 'canvas';

export const UX_OPTIONS: { id: Ux; letter: string; name: string; short: string; blurb: string }[] = [
  { id: 'guided', letter: 'A', name: 'Guided steps', short: 'Guided', blurb: 'A step timeline on the left; each service on one card, its chart beside its questions; the footer finishes the case.' },
  { id: 'chat', letter: 'B', name: 'Conversation', short: 'Conversation', blurb: 'One column, one question at a time. Answers stack up as a short thread you can tap to change.' },
  { id: 'canvas', letter: 'C', name: 'Whole case on one page', short: 'One page', blurb: 'A step navigator on the left, the whole case in the middle and the Teeth Chart on the right. Tap teeth, pick what to make, fill the few gaps inline.' },
];

export interface CaseController {
  ux: Ux;
  view: CaseView;
  /** Approval view → edit, with the prescriber as the user. */
  changeSomething: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
  saveState: 'saved' | 'saving' | 'unsaved';
  sending: boolean;
  /** Send (or jump to the first gap when something is missing). Guarded against double sends. */
  send: (approving?: boolean) => void;
  /** "Send to Lab", "Send to Dr Ellery to Approve", "Send 2 Cases"… */
  sendLabel: string;
  saveAndClose: (withToast: boolean) => void;
  requestDelete: () => void;
  showHelp: () => void;
  banner: string | null;
  dismissBanner: () => void;
  startSeparate: () => void;
  row?: CaseRow;
  preparedBy?: User;
  /** "11:20" on the demo clock */
  preparedAt?: string;
  /** Position among navigable steps (1-based) and their count. */
  stepIndex: number;
  stepTotal: number;
  /** "Teeth · Crown", "Review and Send"… */
  stepTitle: string;
  /** "New case · from Medit scan, today 10:42 · Amelia Clarke" */
  sub: string;
  firstGapId: string;
  /** Next gap after the current step, else the first gap, else 'review'. */
  nextGapId: string;
}

export const ControllerContext = createContext<CaseController | null>(null);
export function useController(): CaseController {
  const c = useContext(ControllerContext);
  if (!c) throw new Error('useController outside the case page');
  return c;
}
