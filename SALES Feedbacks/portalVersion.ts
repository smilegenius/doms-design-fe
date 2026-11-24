import { useSyncExternalStore } from 'react';

// ── Growth Team Feedback: which design version is showing ────────────────────
// V0 is the foundation: every feature as first built (Billing as Requirements v2).
// V1 = V0 + the simpler Billing design (lab-billing/v1).
// V2 = V0 + the Lab Case Handoff Workflow (case-workflow/): service lines,
//      stages and handoffs, My queue, the delivery calendar, dashboard blocks,
//      bench mode, and one invoice per service line on Delivered.
// V1 and V2 are both built on V0, not on each other. All three read the same
// demo data, so switching never loses anything.

export type PortalVersion = 'v0' | 'v1' | 'v2';
export const VERSIONS: { id: PortalVersion; label: string; about: string }[] = [
  { id: 'v0', label: 'V0', about: 'Foundation' },
  { id: 'v1', label: 'V1', about: 'V0 + simpler billing' },
  { id: 'v2', label: 'V2', about: 'V0 + lab workflow' },
];

const KEY = 'salesFeedbacks.version';
const OLD_BILLING_KEY = 'salesFeedbacks.billing.ui';
const listeners = new Set<() => void>();

export function getVersion(): PortalVersion {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'v0' || v === 'v1' || v === 'v2') return v;
    // Before V2 the only switch was Billing's (v0 / v1).
    if (localStorage.getItem(OLD_BILLING_KEY) === 'v0') return 'v0';
  } catch { /* storage blocked */ }
  return 'v2';
}
export function setVersion(v: PortalVersion) {
  try { localStorage.setItem(KEY, v); } catch { /* memory only */ }
  listeners.forEach(l => l());
}
export function useVersion(): PortalVersion {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, getVersion);
}
