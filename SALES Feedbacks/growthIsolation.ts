import { mockCases, type Case } from '../src/app/pages/CasesPage';
import { addCreatedCase, getCreatedCases, removeCreatedCases } from '../src/app/data/createdCases';
import { MOCK_NOTIFICATIONS } from '../src/app/pages/NotificationsPage';
import { DEMO_CASE_IDS } from './design-studio/data/designStudio';
import { SANDBOX_ID_PREFIX } from './lab-prescription-inbox/data';
import { INTAKE_ID_PREFIX } from './intake-form/intakeStore';

// ── Keep Growth Team Feedback out of the other portals ───────────────────────
// The sandbox serves the real, unchanged app next to /growth, and both use the
// portal's shared stores: the created-cases list (localStorage) and the bell
// list (MOCK_NOTIFICATIONS). So while /growth is open its cases and bell
// entries are added, and when it closes they're moved out again. The real
// Lab, Clinic and DSO portals never see them.

export const GROWTH_BASE = '/growth';

const STASH_KEY = 'salesFeedbacks.growthCases.v1';
/** Bell entries the Growth features add (Design Studio, LabLink). */
const GROWTH_BELL = /^(ds-|web-|lf-|fe-|cad-)/;

interface Stash { cases: Case[]; ids: string[] }

function readStash(): Stash {
  try {
    const p = JSON.parse(localStorage.getItem(STASH_KEY) ?? 'null');
    if (p && Array.isArray(p.cases)) return { cases: p.cases, ids: Array.isArray(p.ids) ? p.ids : p.cases.map((c: Case) => c.id) };
  } catch { /* corrupt or blocked */ }
  return { cases: [], ids: [] };
}
function writeStash(s: Stash) {
  try { localStorage.setItem(STASH_KEY, JSON.stringify(s)); } catch { /* keep going */ }
}

const isGrowthId = (id: string, known: Set<string>) =>
  known.has(id) || id.startsWith(SANDBOX_ID_PREFIX) || id.startsWith(INTAKE_ID_PREFIX) || id.startsWith('SF-FE-') || DEMO_CASE_IDS.includes(id);

/** Cases that existed before /growth opened (the other portals' own cases). */
let baseline: Set<string> | null = null;

// ── Seeded drafts turned into cases (Bulk Actions) ───────────────────────────
// The portal's own seeded drafts live in its mockCases array. When Growth
// turns one into a real case, the draft is taken out of that array while
// /growth is open and put back on the way out, so the real portals still
// have it.
const HIDDEN_KEY = 'salesFeedbacks.hiddenDrafts.v1';
const removed: { index: number; c: Case }[] = [];

function hiddenIds(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]'); } catch { return []; }
}
function applyHiddenDrafts() {
  const hide = new Set(hiddenIds());
  for (let i = mockCases.length - 1; i >= 0; i--) {
    if (hide.has(mockCases[i].id)) removed.unshift({ index: i, c: mockCases.splice(i, 1)[0] });
  }
}
function restoreHiddenDrafts() {
  for (const { index, c } of removed.splice(0)) mockCases.splice(Math.min(index, mockCases.length), 0, c);
}
/** Growth turned these seeded drafts into cases: hide them from now on (inside /growth only). */
export function hideSeededDrafts(ids: string[]) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set([...hiddenIds(), ...ids])])); } catch { /* keep going */ }
  applyHiddenDrafts();
}

/** Opening /growth: put its cases back into the shared list. */
export function enterGrowth() {
  if (!removed.length) applyHiddenDrafts();
  const stash = readStash();
  const known = new Set(stash.ids);
  if (!baseline) baseline = new Set(getCreatedCases().filter(c => !isGrowthId(c.id, known)).map(c => c.id));
  const present = new Set(getCreatedCases().map(c => c.id));
  [...stash.cases].reverse().forEach(c => { if (!present.has(c.id)) addCreatedCase(c); });
}

/** While /growth is open: keep the stash in step with the shared list, so a
 *  reload (which never runs leaveGrowth) restores exactly what's there now. */
export function saveGrowthStash() {
  if (!baseline) return;
  const base = baseline;
  const mine = getCreatedCases().filter(c => !base.has(c.id));
  writeStash({ cases: mine, ids: mine.map(c => c.id) });
}

/** Leaving /growth (and on any load outside it): move its cases (including ones confirmed there) out, and clear its bell entries. */
export function leaveGrowth() {
  const stash = readStash();
  const known = new Set(stash.ids);
  const base = baseline;
  const current = getCreatedCases();
  const mine = current.filter(c => (base ? !base.has(c.id) : isGrowthId(c.id, known)));
  // After a /growth visit the list is the truth (confirmed drafts were removed
  // on purpose); on a plain page load, keep what's already stashed too.
  const presentIds = new Set(current.map(c => c.id));
  const next = base ? mine : [...mine, ...stash.cases.filter(c => !presentIds.has(c.id))];
  if (mine.length || base) {
    const ids = new Set(mine.map(c => c.id));
    writeStash({ cases: next, ids: next.map(c => c.id) });
    removeCreatedCases(c => ids.has(c.id));
  }
  baseline = null;
  restoreHiddenDrafts();
  for (let i = MOCK_NOTIFICATIONS.length - 1; i >= 0; i--) {
    if (GROWTH_BELL.test(MOCK_NOTIFICATIONS[i].id)) MOCK_NOTIFICATIONS.splice(i, 1);
  }
}
