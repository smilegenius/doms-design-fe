import type { Case, CaseStatus } from '../../src/app/pages/CasesPage';
import { mockCases } from '../../src/app/pages/CasesPage';
import { addCreatedCase, getCreatedCases, nextCaseId, removeCreatedCases } from '../../src/app/data/createdCases';
import { portalDate } from '../lab-prescription-inbox/data';
import { SANDBOX_ID_PREFIX } from '../lab-prescription-inbox/data';
import { FILES_ID_PREFIX, INTAKE_ID_PREFIX, linkConfirmedCase } from '../intake-form/intakeStore';
import { hideSeededDrafts } from '../growthIsolation';
import { EMAIL_DRAFT_PREFIX, linkEmailCase } from '../forwarded-email/emailStore';

// ── Drafts → cases, in bulk ──────────────────────────────────────────────────
// Every draft the lab can turn into a case: inbox photo drafts, LabLink
// new-case drafts, emailed drafts the portal seeds, and drafts made from
// forwarded emails. LabLink "files for an existing case" drafts are left
// out: those are matched to a case, not created (Match files).

export type DraftOrigin = 'Prescription photo' | 'LabLink' | 'Email' | 'Draft';

export function originOf(c: Case): DraftOrigin {
  if (c.id.startsWith(SANDBOX_ID_PREFIX)) return 'Prescription photo';
  if (c.id.startsWith(EMAIL_DRAFT_PREFIX)) return 'Email';
  if (c.id.startsWith(INTAKE_ID_PREFIX)) return 'LabLink';
  if (c.source === 'email') return 'Email';
  return 'Draft';
}

// Which draft each new case came from, so its original order form (the
// prescription photo, the email) can still be found and printed.
const FROM_KEY = 'salesFeedbacks.draftConversions.v1';
function conversions(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(FROM_KEY) ?? '{}'); } catch { return {}; }
}
export const convertedFrom = (caseId: string): string | undefined => conversions()[caseId];

export function listDrafts(): Case[] {
  const created = getCreatedCases();
  const ids = new Set(created.map(c => c.id));
  return [...created, ...mockCases.filter(c => !ids.has(c.id))]
    .filter(c => c.status === 'draft' && !c.archived && !c.id.startsWith(FILES_ID_PREFIX));
}

/** Create a real case from each draft; returns the new case IDs. */
export function createCasesFromDrafts(drafts: Case[], status: Extract<CaseStatus, 'new' | 'in-production'>, by: string): { from: string; to: string }[] {
  const today = portalDate();
  const out: { from: string; to: string }[] = [];
  const seeded: string[] = [];
  for (const d of drafts) {
    const id = nextCaseId();
    addCreatedCase({
      ...d,
      id,
      status,
      createdAt: today,
      updatedAt: today,
      createdBy: by,
      serviceItems: d.serviceItems.map(si => ({ ...si, status })),
    });
    out.push({ from: d.id, to: id });
    if (d.id.startsWith(INTAKE_ID_PREFIX)) linkConfirmedCase(d.id, id, by);
    if (d.id.startsWith(EMAIL_DRAFT_PREFIX)) linkEmailCase(d.id, id, by);
    if (getCreatedCases().some(c => c.id === d.id)) removeCreatedCases(c => c.id === d.id);
    else seeded.push(d.id);
  }
  if (seeded.length) hideSeededDrafts(seeded);
  try { localStorage.setItem(FROM_KEY, JSON.stringify({ ...conversions(), ...Object.fromEntries(out.map(o => [o.to, o.from])) })); } catch { /* keep going */ }
  return out;
}
