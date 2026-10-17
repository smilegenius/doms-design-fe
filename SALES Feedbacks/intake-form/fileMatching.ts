import type { Case } from '../../src/app/pages/CasesPage';
import { mockCases } from '../../src/app/pages/CasesPage';
import { getCreatedCases } from '../../src/app/data/createdCases';
import { normaliseTooth, parseCaseDate, type MatchReason, type RescanMatch } from '../../src/app/data/rescanDetection';

// ── LabLink: which case do these files belong to? ────────────────────────────
// A dentist sends files, comments or extra details for a case they've already
// sent. Two outcomes:
//   • Exact: the reference they gave is the case's ID or its scanner case ref,
//     and the practice matches. The files sync straight into that case.
//   • Otherwise: candidates are scored and shown to the lab, which decides.
//     Like rescan detection (src/app/data/rescanDetection.ts), nothing fuzzy is
//     ever attached automatically. Results use the same RescanMatch shape so
//     the portal's RescanMatchCard renders them unchanged.

export interface FileSubject {
  patientName: string;
  practice: string;
  dentist: string;
  reference?: string;
  service?: string;
  teeth?: number[];
}

const CLOSED = new Set(['completed', 'delivered']);
const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const refNorm = (s?: string) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const words = (s: string) => norm(s).replace(/^(dr|mr|mrs|ms|miss)\.?\s+/, '').split(' ').filter(Boolean);
const surname = (s: string) => words(s).slice(-1)[0] ?? '';

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

/** Same name, or close enough to be a typo (Reid / Reed), or same surname and first initial. */
function nameMatch(a: string, b: string): 'exact' | 'close' | null {
  const x = words(a).join(' '), y = words(b).join(' ');
  if (!x || !y) return null;
  if (x === y) return 'exact';
  if (distance(x, y) <= 2) return 'close';
  const [xf] = words(a), [yf] = words(b);
  if (surname(a) === surname(b) && xf?.[0] === yf?.[0]) return 'close';
  return null;
}

/** "Smile Genius Manchester" ≈ "SG Manchester" ≈ "smile genius manchester". */
function practiceMatch(a: string, b: string): boolean {
  const strip = (s: string) => norm(s).replace(/^(smile genius|sg)\s+/, '').replace(/\b(dental|clinic|practice|care)\b/g, '').trim();
  return norm(a) === norm(b) || (strip(a).length > 2 && strip(a) === strip(b));
}

/** The cases a dentist could be sending more for: open, not drafts. */
export function candidateCases(): Case[] {
  const created = getCreatedCases();
  const ids = new Set(created.map(c => c.id));
  return [...created, ...mockCases.filter(c => !ids.has(c.id))]
    .filter(c => c.status !== 'draft' && !c.archived && !CLOSED.has(c.status));
}

/**
 * Exact sync: the reference is this case's ID or scanner case ref, and the
 * practice matches. Practice is optional on the form; without it, the
 * patient's name has to agree with the case instead.
 */
export function exactMatch(s: FileSubject, cases = candidateCases()): Case | undefined {
  const r = refNorm(s.reference);
  if (r.length < 4) return undefined;
  return cases.find(c => (refNorm(c.id) === r || refNorm(c.scannerCaseRef) === r)
    && (s.practice.trim() ? practiceMatch(c.practice, s.practice) : !!nameMatch(s.patientName, c.patientName)));
}

export interface FileMatch extends RescanMatch { exact?: boolean }

/** Score one case against what the dentist told us. */
export function scoreCase(s: FileSubject, c: Case): FileMatch & { name: 'exact' | 'close' | null } {
  const teethA = new Set((s.teeth ?? []).map(t => normaliseTooth(t)).filter(Boolean));
  const name = nameMatch(s.patientName, c.patientName);
  const practice = practiceMatch(s.practice, c.practice);
  const dentist = !!surname(s.dentist) && surname(s.dentist) === surname(c.dentist);
  const service = !!s.service && c.services.some(x => norm(x) === norm(s.service));
  const caseTeeth = (c.serviceItems ?? []).flatMap(si => si.fdi ?? []);
  const teeth = teethA.size > 0 && caseTeeth.some(t => teethA.has(normaliseTooth(t)));
  const open = !CLOSED.has(c.status);
  const r = refNorm(s.reference);
  const partialRef = r.length >= 3 && [c.id, c.scannerCaseRef].some(x => refNorm(x).includes(r) || (refNorm(x).length > 3 && r.includes(refNorm(x))));

  const score = (name === 'exact' ? 35 : name === 'close' ? 28 : 0) + (practice ? 20 : 0) + (dentist ? 15 : 0)
    + (service ? 10 : 0) + (teeth ? 10 : 0) + (open ? 10 : 0);
  const reasons: MatchReason[] = [
    { id: 'patient', label: name === 'close' ? 'Patient name is close' : 'Same Patient', matched: !!name, detail: name === 'close' ? `"${s.patientName}" here, "${c.patientName}" on the case` : c.patientName },
    { id: 'clinic', label: 'Same Clinic', matched: practice, detail: c.practice },
    { id: 'dentist', label: 'Same Dentist', matched: dentist, detail: c.dentist },
    { id: 'service', label: 'Same Service', matched: service, detail: s.service ? c.services.join(', ') : 'No service given' },
    { id: 'teeth', label: 'Same Tooth Number', matched: teeth, detail: caseTeeth.length ? caseTeeth.join(', ') : 'No teeth recorded' },
    { id: 'open', label: 'Case still open', matched: open, detail: `Status: ${c.status.replace(/-/g, ' ')} · created ${c.createdAt}` },
  ];
  const supporting: MatchReason[] = s.reference
    ? [{ id: 'reference', label: 'Reference given', matched: partialRef, detail: `"${s.reference}" · case ${c.id}${c.scannerCaseRef ? ` / ${c.scannerCaseRef}` : ''}` }]
    : [];
  return { case: c, score, reasons, supporting, name };
}

export function suggestMatches(s: FileSubject, cases = candidateCases(), limit = 3): FileMatch[] {
  return cases
    .map(c => scoreCase(s, c))
    // A suggestion needs the patient to look right, plus enough else to be plausible.
    .filter(m => m.name && m.score >= 40)
    // Same score: the most recent case is the likelier one to still need files.
    .sort((a, b) => b.score - a.score || parseCaseDate(b.case.createdAt).getTime() - parseCaseDate(a.case.createdAt).getTime())
    .slice(0, limit)
    .map(({ name: _n, ...m }) => m);
}

/** Case search for the lab ("pick another case"). */
export function searchCases(q: string, cases = candidateCases()): Case[] {
  const t = norm(q);
  if (t.length < 2) return [];
  return cases.filter(c => [c.id, c.patientName, c.practice, c.dentist, c.scannerCaseRef].some(x => norm(x).includes(t))).slice(0, 8);
}
