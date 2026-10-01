import type { Case } from '../pages/CasesPage';
import { connectionStatus, type ScannerConnection } from './scannerConnections';

// ─── Case provenance & status reach (hotfixes, 30-Sep-2026) ──────────────────
// Two small questions every portal asks about a case:
//   • WHO made it — a person, or Smile Genius itself (email → draft). Drives
//     the creator avatar on the Cases list and the case header.
//   • Will a status change made on the clinic side actually REACH the lab?
//     Only when the case came in through a scanner whose integration is live.
//     Anything else (email / manual / post, or an expired / missing scanner
//     connection) the lab never sees, so the clinic has to tell them directly.

export interface CaseCreator {
  kind: 'person' | 'system';
  /** "Smile Genius" for system-made cases, otherwise the person's name. */
  name: string;
  /** One line on how the case was made — the avatar tooltip. */
  detail: string;
}

// Clinic users who key cases in by hand. Deterministic per case so a row
// always shows the same creator.
const CLINIC_STAFF = ['Emma Roberts', 'Liam Doyle', 'Priya Shah', 'Chloe Martin', 'Aaron Kelly'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function caseCreator(c: {
  id: string; source?: Case['source']; scanner?: string; dentist: string;
  emailPrescription?: { fromName: string }; createdBy?: string;
}): CaseCreator {
  if (c.source === 'email') {
    const from = c.emailPrescription ? ` from ${c.emailPrescription.fromName}` : '';
    const reviewed = c.createdBy ? ` · reviewed and submitted by ${c.createdBy}` : '';
    return { kind: 'system', name: 'Smile Genius', detail: `Auto-created from an email${from}${reviewed}` };
  }
  if (c.createdBy) return { kind: 'person', name: c.createdBy, detail: 'Created in Smile Genius' };
  if (c.source === 'scanner') return { kind: 'person', name: c.dentist, detail: `Sent from ${c.scanner}` };
  const name = CLINIC_STAFF[hash(c.id) % CLINIC_STAFF.length];
  return { kind: 'person', name, detail: c.source === 'post' ? 'Logged from impressions sent by post' : 'Entered manually' };
}

/** Email-made drafts nobody has reviewed yet — the "Needs your review" state. */
export function needsReview(c: { status: string; source?: Case['source'] }): boolean {
  return c.status === 'draft' && c.source === 'email';
}

// ── Status reach ──────────────────────────────────────────────────────────────
export type StatusReach =
  | { reaches: true; scanner: string }
  | { reaches: false; why: 'no-scanner' | 'not-connected' | 'expired'; scanner?: string };

export function statusReach(c: { source?: Case['source']; scanner?: string }, connections: ScannerConnection[]): StatusReach {
  if (c.source !== 'scanner') return { reaches: false, why: 'no-scanner' };
  const conn = connections.find(x => x.brand === c.scanner);
  if (!conn) return { reaches: false, why: 'not-connected', scanner: c.scanner };
  if (connectionStatus(conn).health === 'expired') return { reaches: false, why: 'expired', scanner: conn.name };
  return { reaches: true, scanner: conn.name };
}

/** Why the lab won't see it — one sentence, used by the modal, banner and toast. */
export function statusReachReason(r: Extract<StatusReach, { reaches: false }>): string {
  if (r.why === 'no-scanner') return 'This case didn’t come in through a connected scanner, so status changes made here aren’t sent to the lab.';
  if (r.why === 'expired') return `The ${r.scanner} connection has expired, so status changes made here aren’t reaching the lab.`;
  return `${r.scanner} isn’t connected, so status changes made here aren’t sent to the lab.`;
}

/** Ready-to-send text for telling the lab by hand. */
export function statusUpdateMessage(c: Pick<Case, 'id' | 'patientName' | 'lab'>, statusLabel: string): string {
  return `Hi ${c.lab} team — quick update on case ${c.id} (${c.patientName}): we’ve moved it to “${statusLabel}”. Thanks!`;
}
