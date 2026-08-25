import { useSyncExternalStore } from 'react';
import type { Case } from '../pages/CasesPage';

// ─── Rescan detection & case relationships ───────────────────────────────────
// A clinic re-scanning a patient usually submits a brand-new case rather than
// re-opening the old one, so the clinical history fragments and nobody can see
// how many rescans a case has had. This module finds those likely duplicates
// at creation time, scores how confident the match is, and owns the
// original ⇄ rescan links the user confirms.
//
// Two hard rules from the spec drive the design:
//   • Smile Genius NEVER auto-classifies a case as a rescan — detection only
//     ever produces a recommendation; the link is created by a user decision.
//   • Only cases inside the lookback period are considered.

/**
 * Lookback period for candidate cases. "Configurable through code" per the
 * spec — change this constant (a settings toggle is not part of the ticket).
 */
export const RESCAN_LOOKBACK_DAYS = 14;

/**
 * The demo clock. Mock cases are dated Jan–May 2026 and the Cases list already
 * filters against this date, so detection has to share it — using the wall
 * clock would put every seeded case far outside the lookback window.
 */
export const DEMO_TODAY = new Date(2026, 4, 19);

// ── Date helpers (mock data is "DD-MMM-YYYY") ─────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseCaseDate(d: string): Date {
  const [day, mon, year] = d.split('-');
  const m = MONTHS.indexOf(mon);
  return new Date(Number(year), m < 0 ? 0 : m, Number(day));
}

export function formatCaseDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

/** Whole days between two case dates (positive = `later` is after `earlier`). */
export function daysBetween(earlier: string | Date, later: string | Date): number {
  const a = typeof earlier === 'string' ? parseCaseDate(earlier) : earlier;
  const b = typeof later === 'string' ? parseCaseDate(later) : later;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/** "18 days ago" / "today" — used in the match reasons. */
export function relativeAge(createdAt: string, now: Date = DEMO_TODAY): string {
  const days = daysBetween(createdAt, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ── Normalisation ─────────────────────────────────────────────────────────────
function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Teeth arrive as FDI numbers (16, 26) from case records and as in-app codes
 * (UR6, UL6) from the creation form, so both sides normalise to codes before
 * they're compared.
 */
export function normaliseTooth(t: string | number): string {
  if (typeof t === 'number') {
    const quadrant = Math.floor(t / 10);
    const position = t % 10;
    const prefix = ['', 'UR', 'UL', 'LL', 'LR'][quadrant] ?? '';
    return !prefix || position < 1 || position > 8 ? '' : `${prefix}${position}`;
  }
  return t.trim().toUpperCase();
}

function toothSet(teeth: (string | number)[]): string[] {
  return Array.from(new Set(teeth.map(normaliseTooth).filter(Boolean))).sort();
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]);
}

// ── The thing being matched ───────────────────────────────────────────────────
/**
 * A case (existing or half-built in the creation form) reduced to the
 * attributes the matching engine compares.
 */
export interface RescanSubject {
  /** Absent while the case is still being created. */
  id?: string;
  patientName: string;
  practice: string;
  dentist: string;
  lab: string;
  services: string[];
  teeth: (string | number)[];
  /** How many 3D scan files this case carries — drives "Scan file changed". */
  scanFileCount: number;
  createdAt: string;
  /** Supporting signals, when the scanner supplied them. */
  scannerPatientId?: string;
  scannerCaseRef?: string;
}

/** Reduce a stored case to a matchable subject. */
export function subjectFromCase(c: Case): RescanSubject {
  return {
    id: c.id,
    patientName: c.patientName,
    practice: c.practice,
    dentist: c.dentist,
    lab: c.lab,
    services: c.services,
    teeth: (c.serviceItems ?? []).flatMap(si => si.fdi ?? []),
    scanFileCount: (c.serviceItems ?? []).reduce((n, si) => n + (si.scanFileCount ?? 0), 0),
    createdAt: c.createdAt,
    scannerPatientId: c.scannerPatientId,
    scannerCaseRef: c.scannerCaseRef,
  };
}

// ── Matching ──────────────────────────────────────────────────────────────────
export interface MatchReason {
  id: string;
  /** "Same Patient", "Scan file changed", "Created 18 days ago"… */
  label: string;
  matched: boolean;
  /** Extra context shown under the reason when it helps (values compared). */
  detail?: string;
}

export interface RescanMatch {
  case: Case;
  /** 0–100, equal weight per high-confidence attribute. */
  score: number;
  /** The scored attributes, matched or not. */
  reasons: MatchReason[];
  /** Corroborating signals — displayed, deliberately NOT scored (see below). */
  supporting: MatchReason[];
}

/**
 * AC1's gate: a case is only ever suggested when the lab, clinic, dentist,
 * patient AND service all match. Everything else adjusts confidence.
 */
function passesGate(a: RescanSubject, b: RescanSubject): boolean {
  const sharedService = a.services.some(s => b.services.some(t => norm(s) === norm(t)));
  return (
    norm(a.patientName) === norm(b.patientName) &&
    norm(a.practice) === norm(b.practice) &&
    norm(a.dentist) === norm(b.dentist) &&
    norm(a.lab) === norm(b.lab) &&
    sharedService
  );
}

/**
 * The seven high-confidence attributes, each carrying equal weight (AC2).
 * Five of them are also the gate above, so a suggested case always scores at
 * least 5/7 — tooth numbers and a changed scan file are what separate a
 * likely rescan from a repeat order.
 */
function scoredReasons(subject: RescanSubject, candidate: RescanSubject, now: Date): MatchReason[] {
  const subjectTeeth = toothSet(subject.teeth);
  const candidateTeeth = toothSet(candidate.teeth);
  const sharedServices = subject.services.filter(s => candidate.services.some(t => norm(s) === norm(t)));
  const ageDays = daysBetween(candidate.createdAt, now);

  return [
    {
      id: 'patient', label: 'Same Patient',
      matched: norm(subject.patientName) === norm(candidate.patientName),
      detail: candidate.patientName,
    },
    {
      id: 'dentist', label: 'Same Dentist',
      matched: norm(subject.dentist) === norm(candidate.dentist),
      detail: candidate.dentist,
    },
    {
      id: 'clinic', label: 'Same Clinic',
      matched: norm(subject.practice) === norm(candidate.practice),
      detail: candidate.practice,
    },
    {
      id: 'teeth', label: 'Same Tooth Number',
      matched: sameSet(subjectTeeth, candidateTeeth),
      // Codes are the comparison form; the detail shows the teeth the way the
      // rest of the case record does (FDI numbers).
      detail: candidate.teeth.length ? candidate.teeth.join(', ') : 'No teeth recorded',
    },
    {
      id: 'service', label: 'Same Service',
      matched: sharedServices.length > 0,
      detail: sharedServices.length ? sharedServices.join(', ') : candidate.services.join(', '),
    },
    {
      // A rescan is a NEW capture of the same prescription, so the scan files
      // differing from the original is the strongest single signal.
      id: 'scan', label: 'Scan file changed',
      matched: subject.scanFileCount !== candidate.scanFileCount && candidate.scanFileCount > 0,
      detail: `${candidate.scanFileCount} file${candidate.scanFileCount === 1 ? '' : 's'} on the original · ${subject.scanFileCount} on this case`,
    },
    {
      id: 'recency', label: `Created ${relativeAge(candidate.createdAt, now)}`,
      matched: ageDays >= 0 && ageDays <= RESCAN_LOOKBACK_DAYS,
      detail: candidate.createdAt,
    },
  ];
}

/**
 * Supporting attributes from the spec. They corroborate a match but are NOT
 * folded into the score: they're optional (most cases carry no scanner IDs),
 * so scoring them would drag every score down for data the clinic never had.
 */
function supportingReasons(subject: RescanSubject, candidate: RescanSubject, now: Date): MatchReason[] {
  const out: MatchReason[] = [];
  const gap = daysBetween(candidate.createdAt, subject.createdAt || formatCaseDate(now));
  out.push({
    id: 'created-date', label: 'Order Created Date',
    matched: gap >= 0 && gap <= RESCAN_LOOKBACK_DAYS,
    detail: `${candidate.createdAt} → ${subject.createdAt || formatCaseDate(now)} (${Math.abs(gap)} day${Math.abs(gap) === 1 ? '' : 's'} apart)`,
  });
  if (candidate.scannerPatientId || subject.scannerPatientId) {
    out.push({
      id: 'scanner-patient', label: 'Scanner Patient ID',
      matched: !!candidate.scannerPatientId && norm(candidate.scannerPatientId) === norm(subject.scannerPatientId),
      detail: candidate.scannerPatientId ?? '—',
    });
  }
  if (candidate.scannerCaseRef || subject.scannerCaseRef) {
    out.push({
      id: 'scanner-ref', label: 'Scanner Case Reference',
      matched: !!candidate.scannerCaseRef && norm(candidate.scannerCaseRef) === norm(subject.scannerCaseRef),
      detail: candidate.scannerCaseRef ?? '—',
    });
  }
  return out;
}

/**
 * Every existing case that could be the original this submission re-scans,
 * best match first. Returns nothing unless a case clears the AC1 gate and
 * falls inside the lookback period.
 */
export function detectRescanMatches(
  subject: RescanSubject,
  cases: Case[],
  now: Date = DEMO_TODAY,
): RescanMatch[] {
  const submittedAt = subject.createdAt ? parseCaseDate(subject.createdAt) : now;

  return cases
    .filter(c => {
      if (c.id === subject.id) return false;
      if (c.status === 'draft' || c.archived) return false;
      // Lookback: only cases created in the window BEFORE this submission.
      const age = daysBetween(c.createdAt, submittedAt);
      if (age < 0 || age > RESCAN_LOOKBACK_DAYS) return false;
      return passesGate(subject, subjectFromCase(c));
    })
    .map(c => {
      const candidate = subjectFromCase(c);
      const reasons = scoredReasons(subject, candidate, now);
      const matched = reasons.filter(r => r.matched).length;
      return {
        case: c,
        score: Math.round((matched / reasons.length) * 100),
        reasons,
        supporting: supportingReasons(subject, candidate, now),
      };
    })
    .sort((a, b) => b.score - a.score || daysBetween(a.case.createdAt, b.case.createdAt));
}

// ── Relationships ─────────────────────────────────────────────────────────────
export interface RescanLink {
  /** The newer case, submitted as a rescan of `originalId`. */
  rescanId: string;
  originalId: string;
  /** Confidence at the moment the user confirmed the link. */
  score: number;
  /** DD-MMM-YYYY — shown on both timelines. */
  linkedAt: string;
  linkedBy: string;
}

const LS_KEY = 'cases.rescanLinks';

// Seeded relationship so the Related Cases section, the timeline entries and
// the rescan filter all have something to show before anyone creates a case.
// Pairs with the seeded cases in CasesPage (RESCAN_DEMO_CASES).
function seed(): RescanLink[] {
  return [
    {
      rescanId: 'CASE-RS-2002',
      originalId: 'CASE-RS-2001',
      score: 100,
      linkedAt: '14-May-2026',
      linkedBy: 'Sophie Wilson',
    },
  ];
}

function load(): RescanLink[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as RescanLink[];
    }
  } catch { /* corrupt — fall back to the seed */ }
  return seed();
}

let links: RescanLink[] = load();
const listeners = new Set<() => void>();

function commit(next: RescanLink[]) {
  links = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getRescanLinks(): RescanLink[] {
  return links;
}

/**
 * Record the user's decision (AC4). A case can only be a rescan of ONE
 * original, so re-marking replaces the previous link.
 */
export function markAsRescan(input: { rescanId: string; originalId: string; score: number; by: string; at?: Date }) {
  const link: RescanLink = {
    rescanId: input.rescanId,
    originalId: input.originalId,
    score: input.score,
    linkedAt: formatCaseDate(input.at ?? DEMO_TODAY),
    linkedBy: input.by,
  };
  commit([...links.filter(l => l.rescanId !== input.rescanId), link]);
}

/** Undo a relationship — the case reverts to a standalone case. */
export function unlinkRescan(rescanId: string) {
  commit(links.filter(l => l.rescanId !== rescanId));
}

// ── Lookups ───────────────────────────────────────────────────────────────────
/** The original this case was submitted as a rescan of, if any. */
export function originalIdOf(caseId: string, all: RescanLink[] = links): string | undefined {
  return all.find(l => l.rescanId === caseId)?.originalId;
}

/** Every rescan submitted against this case, oldest link first. */
export function rescanIdsOf(caseId: string, all: RescanLink[] = links): string[] {
  return all.filter(l => l.originalId === caseId).map(l => l.rescanId);
}

export function linkFor(rescanId: string, all: RescanLink[] = links): RescanLink | undefined {
  return all.find(l => l.rescanId === rescanId);
}

export type CaseRelationship = 'rescan' | 'original' | 'none';

/** How this case sits in the rescan graph — drives the Case Details pill. */
export function relationshipOf(caseId: string, all: RescanLink[] = links): CaseRelationship {
  if (originalIdOf(caseId, all)) return 'rescan';
  if (rescanIdsOf(caseId, all).length > 0) return 'original';
  return 'none';
}

/**
 * Case IDs related to `caseId` in either direction — the original, its
 * siblings, and its rescans. Lets the Cases list match a search on EITHER the
 * original or the rescan ID (AC7).
 */
export function relatedIdsOf(caseId: string, all: RescanLink[] = links): string[] {
  const ids = new Set<string>();
  const original = originalIdOf(caseId, all);
  if (original) {
    // The case it came from, and every sibling rescan of that original.
    ids.add(original);
    rescanIdsOf(original, all).forEach(id => ids.add(id));
  }
  // Its own rescans — a rescan can itself be re-scanned, so both directions
  // have to be walked or a chained case only finds half its family.
  rescanIdsOf(caseId, all).forEach(id => ids.add(id));
  ids.delete(caseId);
  return Array.from(ids);
}

// ── Reactive read ─────────────────────────────────────────────────────────────
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Components re-render whenever a rescan relationship is created or removed. */
export function useRescanLinks(): RescanLink[] {
  return useSyncExternalStore(subscribe, getRescanLinks);
}
