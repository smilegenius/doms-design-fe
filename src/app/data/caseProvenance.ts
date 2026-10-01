import type { Case } from '../pages/CasesPage';
import { connectionStatus, type ScannerConnection } from './scannerConnections';

// ─── Case provenance & status reach (hotfixes, 30-Sep-2026) ──────────────────
// Two small questions every portal asks about a case:
//   • WHICH SIDE made it — the clinic or the lab. Drives the lab / clinic
//     icon on the Cases list and the case header.
//   • Will a status change made on the clinic side actually REACH the lab?
//     Only when the case came in through a scanner whose integration is live.
//     Anything else (email / manual / post, or an expired / missing scanner
//     connection) the lab never sees, so the clinic has to tell them directly.

/** Which side of the order made the case — the icon on the list and header. */
export type CreatedSide = 'clinic' | 'lab';
/** The portal looking at the case. DSO sees cases the way a clinic does. */
export type ViewerPortal = 'clinic' | 'lab' | 'dso';

export interface CaseCreatedBy {
  side: CreatedSide;
  /** The practice or lab that made it. */
  org: string;
  /** How it was made (+ who, when known) — the icon tooltip. */
  detail: string;
}

export function caseCreatedBy(
  c: {
    source?: Case['source']; scanner?: string; practice: string; lab?: string;
    createdBy?: string; createdBySide?: CreatedSide;
  },
  viewer: ViewerPortal = 'clinic',
): CaseCreatedBy {
  // An email draft is built from whichever inbox received the prescription —
  // the lab's own inbox in the Lab portal, the practice's everywhere else.
  const side: CreatedSide = c.createdBySide ?? (c.source === 'email' && viewer === 'lab' ? 'lab' : 'clinic');
  const how =
    c.source === 'email' ? 'Auto-created from an email'
    : c.source === 'scanner' ? `Sent from ${c.scanner ?? 'a scanner'}`
    : c.source === 'post' ? 'Impressions sent by post'
    : 'Entered manually';
  const who = c.createdBy ? ` · ${c.source === 'email' ? 'reviewed by' : 'by'} ${c.createdBy}` : '';
  return { side, org: side === 'lab' ? (c.lab ?? 'Lab') : c.practice, detail: `${how}${who}` };
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

// ── Scanner-portal sync ───────────────────────────────────────────────────────
// iTero only has an "On Hold" status of its own. Any other status set on an
// iTero case stays in Smile Genius — PM copy, verbatim.
export const SCANNER_SYNC_COPY =
  'This update is reflected in Smile Genius only. It will not be synchronised with the scanner portal because this status or action is not supported by the scanner.';

const SCANNER_SUPPORTED_STATUSES: Record<string, string[]> = {
  iTero: ['on-hold'],
};

/** True when `toStatus` can't be pushed back to the case's scanner portal. */
export function scannerSyncUnsupported(c: { source?: Case['source']; scanner?: string }, toStatus: string): boolean {
  if (c.source !== 'scanner' || !c.scanner) return false;
  const supported = SCANNER_SUPPORTED_STATUSES[c.scanner];
  return !!supported && !supported.includes(toStatus);
}
