import { useSyncExternalStore } from 'react';

// ── Growth Team Feedback: which design version is showing ────────────────────
// V1 is the foundation: every feature as built, with the simpler Billing
// (lab-billing/v1). The first designs (old "V0") were folded into V1 and the
// simpler Billing replaced V0's Billing everywhere.
// V2 = V1 + the Lab Case Handoff Workflow (case-workflow/): services moving
//      through stages with handoffs, My queue, the delivery calendar, dashboard
//      blocks, bench mode, and one invoice per service on Delivered. Still in
//      progress, so it stays behind the switch.
// Both read the same demo data, so switching never loses anything.

export type PortalVersion = 'v1' | 'v2';
export const VERSIONS: { id: PortalVersion; label: string; about: string }[] = [
  { id: 'v0', label: 'V0', about: 'Foundation' },
  { id: 'v1', label: 'V1', about: 'V0 + simpler billing' },
  { id: 'v2', label: 'V2', about: 'V0 + lab workflow' },
];

const KEY = 'salesFeedbacks.version';
const listeners = new Set<() => void>();

/** Any stored or linked value, as a version. The old V0 is now part of V1. */
export function asVersion(v: string | null | undefined): PortalVersion | null {
  if (v === 'v2') return 'v2';
  if (v === 'v1' || v === 'v0') return 'v1';
  return null;
}
export function getVersion(): PortalVersion {
  try { return asVersion(localStorage.getItem(KEY)) ?? 'v2'; } catch { return 'v2'; }
}
export function setVersion(v: PortalVersion) {
  try { localStorage.setItem(KEY, v); } catch { /* memory only */ }
  listeners.forEach(l => l());
}
export function useVersion(): PortalVersion {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, getVersion);
}
