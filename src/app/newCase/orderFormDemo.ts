// ─── Order form walkthrough · multi-case order ───────────────────────────────
// Margaret Hill's order at Pennine Denture Lab: three cases in one parcel. Her
// upper full denture's Finish (Special Tray, Bite Registration and Try In were
// each made on a case of their own), a lower cobalt-chrome partial at Framework
// Try-In, and a repair of her current upper denture to wear until the new one
// is fitted. A saved flow store replaces the seed's rows, so a seed row would
// only show after Reset demo data: the walkthrough adds this one when it's
// missing instead, and leaves it as it is once it's there (dispatched, received).

import { PATIENTS, userById } from './data';
import { buildCtx, serviceSummary } from './derive';
import { toISO } from './dates';
import { caseDates } from './rules';
import { CaseRow, blankDraft, getRow, newItem, saveRow } from './store';

export const MULTI_CASE_ID = 'CAS-2026-128';
/** Sent on Mon 19 Oct 2026, 10:20 on the demo clock: every date on it counts from then. */
const SENT = new Date(2026, 9, 19, 10, 20);

export function ensureMultiCaseDemo(): string {
  if (getRow(MULTI_CASE_ID)) return MULTI_CASE_ID;
  const patient = PATIENTS.find(p => p.id === 'P-2025-083')!;
  const draft = blankDraft(patient, {
    id: MULTI_CASE_ID,
    lab: 'pennine', labSrc: 'Made the previous stage', labPicked: true,
    prescriber: 'khan',
    records: { route: 'post', courier: 'Royal Mail', box: {}, disinfected: true, files: [] },
    note: 'Three cases in one parcel: the upper master model with the approved try in, the lower impression for the partial, and her current upper denture for the repair.',
    items: [
      newItem('denture', {
        id: 'mc-denture', arch: 'upper', archSrc: 'You', treatment: 'staged', stagesDone: true,
        stages: [
          { id: 'tray', state: 'here', caseId: 'CAS-2026-086' },
          { id: 'blocks', state: 'here', caseId: 'CAS-2026-102' },
          { id: 'tryin', state: 'here', caseId: 'CAS-2026-115' },
          { id: 'finish', state: 'order', date: '2026-10-29' },
        ],
        shade: 'A3', mould: 'Match the photos', postdam: 'Marked on the model',
        photos: [{ label: 'Try in smile line' }],
        note: 'Finish the upper from the approved try in: keep the tooth position and the centre line as tried in.',
      }),
      newItem('partial', {
        id: 'mc-partial', arch: 'lower', teeth: ['36', '37', '46', '47'], teethDone: true,
        base: 'chrome', stage: 'framework', design: 'drawn', shade: 'A3',
        photos: [{ label: 'Lower arch occlusal' }],
        note: 'Rests on 35 and 45, clasps on 34 and 44, design drawn on the model. Set the occlusion to the new upper denture.',
      }),
      newItem('reline', {
        id: 'mc-repair', arch: 'upper', work: 'repair', requestedDelivery: '2026-10-23',
        photos: [{ label: 'Upper denture crack' }],
        note: 'A crack through the palate of her current upper denture. Please repair it so she has a denture to wear until the new one is fitted.',
      }),
    ],
  });
  // As a send writes it (NewCaseFlowPage send): the case's last back-by day, counted from the send.
  const khan = userById('khan')!;
  const ctx = buildCtx(draft, khan)?.ctx;
  const back = ctx ? caseDates(draft, { ...ctx, now: SENT }).backBy : undefined;
  const row: CaseRow = {
    id: MULTI_CASE_ID, patientId: patient.id, status: 'In production', source: 'clinic', createdBy: 'khan',
    draft, service: serviceSummary(draft, khan),
    delivery: back ? toISO(back) : undefined, dentist: khan.name, labId: 'pennine',
    updatedAt: Date.now(), sentAt: Date.now(), sentDemoAt: SENT.toISOString(),
  };
  saveRow(row);
  return MULTI_CASE_ID;
}
