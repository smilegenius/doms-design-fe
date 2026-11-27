// ─── Order form walkthrough · demo orders ───────────────────────────────────
// Two of the walkthrough's four examples are orders made for it (the crown and
// the two-stage denture are the flow's seed cases):
//   · Margaret Hill, CAS-2026-128 at Northfield: a crown on 45 and a new upper
//     full denture with all five stages ordered at once. As the New case flow
//     takes it, one instruction covers all the stages it orders.
//   · Ben Ortiz, CAS-2026-125 at Northfield: a three-unit bridge 35–37 over his
//     missing 36, from a Medit scan.
// A saved flow store replaces the seed's rows, so a seed row would only show
// after Reset demo data: the walkthrough adds these when they're missing, and
// leaves them as they are once there (dispatched, received), unless it's an
// older copy of the order (before 5-Nov CAS-2026-128 was another order).

import { PATIENTS, userById } from './data';
import { buildCtx, serviceSummary } from './derive';
import { toISO } from './dates';
import { CaseDraft, caseDates } from './rules';
import { CaseRow, blankDraft, getRow, newItem, saveRow } from './store';

export const MULTI_CASE_ID = 'CAS-2026-128';
export const BRIDGE_CASE_ID = 'CAS-2026-125';

/** A sent order as a send writes it (NewCaseFlowPage send): its back-by day counted from `sent`, on the demo clock. */
function sentRow(id: string, patientId: string, sent: Date, extra: Partial<CaseDraft>, fallbackDelivery?: string): CaseRow {
  const patient = PATIENTS.find(p => p.id === patientId)!;
  const khan = userById('khan')!;
  const draft = blankDraft(patient, { id, prescriber: 'khan', labPicked: true, ...extra });
  const ctx = buildCtx(draft, khan)?.ctx;
  const back = ctx ? caseDates(draft, { ...ctx, now: sent }).backBy : undefined;
  return {
    id, patientId, status: 'In production', source: 'clinic', createdBy: 'khan',
    draft, service: serviceSummary(draft, khan),
    delivery: back ? toISO(back) : fallbackDelivery, dentist: khan.name, labId: draft.lab,
    updatedAt: Date.now(), sentAt: Date.now(), sentDemoAt: sent.toISOString(),
  };
}

/** Margaret Hill: a crown and an upper full denture with every stage, each stage with its own day. */
export function ensureMultiCaseDemo(): string {
  const live = getRow(MULTI_CASE_ID);
  if (live?.draft?.items.some(it => it.id === 'mc-crown')) return MULTI_CASE_ID;
  saveRow(sentRow(MULTI_CASE_ID, 'P-2025-083', new Date(2026, 9, 19, 10, 20), {
    lab: 'northfield', labSrc: "Clinic's usual lab",
    records: { route: 'post', courier: 'Royal Mail', box: {}, disinfected: true, files: [] },
    note: 'Crown and upper denture in one parcel: the impression of the 45 preparation and the upper primary impression.',
    items: [
      newItem('crown', {
        id: 'mc-crown', teeth: ['45'], teethDone: true, material: 'mono', shade: 'A3',
        note: 'Please match the shade of 44 and keep the occlusal contact light.',
      }),
      newItem('denture', {
        id: 'mc-denture', arch: 'upper', archSrc: 'You', treatment: 'staged', stagesDone: true,
        stages: [
          { id: 'tray', state: 'order', date: '2026-10-26' },
          { id: 'blocks', state: 'order', date: '2026-11-02' },
          { id: 'tryin', state: 'order', date: '2026-11-09' },
          { id: 'retry', state: 'order', date: '2026-11-16' },
          { id: 'finish', state: 'order', date: '2026-11-23' },
        ],
        shade: 'A3', mould: 'Match the photos', postdam: 'Marked on the model',
        photos: [{ label: 'Smile line' }],
        note: 'Upper full denture from the primary impression: a special tray spaced 2 mm with a handle, a bite block (mark the centre line and the smile line), the teeth in wax for try in (shade A3, mould to match the photos), a retry if the try in needs one, then finish.',
      }),
    ],
  }, '2026-11-23'));
  return MULTI_CASE_ID;
}

/** Ben Ortiz: a three-unit bridge 35–37, 36 the pontic, from a Medit scan. */
export function ensureBridgeDemo(): string {
  if (getRow(BRIDGE_CASE_ID)) return BRIDGE_CASE_ID;
  saveRow(sentRow(BRIDGE_CASE_ID, 'P-2025-060', new Date(2026, 9, 20, 9, 40), {
    lab: 'northfield', labSrc: "Clinic's usual lab",
    scan: { scanner: 'Medit', time: '09:30', arches: { upper: true, lower: true, bite: true }, patientId: 'P-2025-060' },
    items: [
      newItem('bridge', {
        id: 'br-bridge', teeth: ['35', '36', '37'], teethDone: true, bridge: { a: '35', b: '37', pontics: ['36'] },
        material: 'mono', shade: 'A3',
        note: 'Replacing the missing 36. Please give the pontic a modified ridge-lap and keep the connectors at least 3 mm high.',
      }),
    ],
  }));
  return BRIDGE_CASE_ID;
}
