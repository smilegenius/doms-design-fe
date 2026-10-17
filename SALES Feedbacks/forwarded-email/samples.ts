import type { DesignFile } from '../design-studio/data/designStudio';
import { fid, putBlob } from '../design-studio/store/fileStore';
import { arch, pdf, stl } from '../intake-form/intakeDemo';
import { receiveEmail, type ForwardedEmail } from './emailStore';

// ── Sample emails to forward (Prescription inbox bar → Forward an email) ─────

export interface EmailSample { id: string; label: string; hint: string }
export const EMAIL_SAMPLES: EmailSample[] = [
  { id: 'update', label: 'Case update with photos', hint: 'Dr. Webb, about Isabella Hughes, quotes ITR-CASE-55984' },
  { id: 'new', label: 'New crown request in an email', hint: 'Dr. Anderson asks for an e.max crown on UL5 for Liam Foster' },
  { id: 'vague', label: '"Please see attached"', hint: 'Front desk, no patient named. Search or dismiss it.' },
  { id: 'hannah', label: 'Shade follow-up on a case', hint: 'Dr. Murphy about Hannah Price, quotes SG-2026-0519' },
  { id: 'chloe', label: 'Night guard request', hint: 'Dr. Campbell asks for an NHS night guard for Chloe Bennett' },
];

async function file(name: string, blob: Blob | null, kind: DesignFile['kind'], at: string): Promise<DesignFile | null> {
  if (!blob) return null;
  const id = fid();
  if (!(await putBlob(id, blob))) return null;
  return { id, name, size: blob.size, mime: blob.type, kind, uploadedBy: 'clinician', uploadedAt: at };
}

export async function forwardSample(sample: string, forwardedBy: string, msAgo = 0): Promise<ForwardedEmail> {
  const at = new Date(Date.now() - msAgo).toISOString();
  const photo = await fetch('/teeth-3d.png').then(r => (r.ok ? r.blob() : null)).catch(() => null);
  const keep = (f: DesignFile | null): f is DesignFile => !!f;

  if (sample === 'update') {
    return receiveEmail({
      forwardedBy, fromName: 'Dr. Webb', fromEmail: 'dr.webb@smilegenius.co.uk',
      subject: 'Re: Isabella Hughes, UR6 crown (ITR-CASE-55984), contact point',
      body: 'Hi team,\n\nFollowing up on patient Isabella Hughes (ITR-CASE-55984). Attached is a bitewing of the UR6 and a photo of the contact with UR5. Please keep the mesial contact tight; the old crown packed food there.\n\nThanks,\nDr. Webb\nSmile Genius Manchester',
      files: (await Promise.all([file('bitewing_UR6.png', photo, 'image', at), file('contact_UR5-UR6.png', photo, 'image', at)])).filter(keep),
    }, at);
  }
  if (sample === 'new') {
    return receiveEmail({
      forwardedBy, fromName: 'Dr. Anderson', fromEmail: 'anderson@smilegenius.co.uk',
      subject: 'New crown please, patient Liam Foster',
      body: 'Hello,\n\nCould you make an e.max crown for patient Liam Foster on UL5 (25), shade A2, private. Prep photo and the upper scan are attached. Margin is a light chamfer, slightly subgingival on the mesial. Needed by the end of next week if possible.\n\nKind regards,\nDr. Anderson\nSmile Genius Belfast',
      files: (await Promise.all([
        file('prep_UL5.png', photo, 'image', at),
        file('upper-arch_UL5-prep.stl', stl(arch((i, s) => i === 5 && s === 'L')), 'mesh', at),
      ])).filter(keep),
    }, at);
  }
  if (sample === 'hannah') {
    return receiveEmail({
      forwardedBy, fromName: 'Dr. Murphy', fromEmail: 'dr.murphy@smilegenius.co.uk',
      subject: 'Hannah Price veneers SG-2026-0519: shade follow-up',
      body: 'Hi,\n\nQuick follow-up on patient Hannah Price (SG-2026-0519). She came back in and we took another shade photo in daylight: BL2 still looks right but she would like the incisal edges a touch more translucent. Photo attached.\n\nThanks,\nDr. Murphy\nSmile Genius Manchester',
      files: (await Promise.all([file('shade_daylight_BL2.png', photo, 'image', at)])).filter(keep),
    }, at);
  }
  if (sample === 'chloe') {
    return receiveEmail({
      forwardedBy, fromName: 'Dr. Campbell', fromEmail: 'dr.campbell@smilegenius.co.uk',
      subject: 'Night guard request, patient Chloe Bennett',
      body: 'Hello,\n\nPlease make a hard night guard for patient Chloe Bennett, upper arch, NHS. She grinds heavily at night. Upper and lower scans are attached. Needed in 10 days if you can.\n\nMany thanks,\nDr. Campbell\nSmile Genius Glasgow',
      files: (await Promise.all([
        file('upper-arch.stl', stl(arch(() => false)), 'mesh', at),
        file('lower-arch.stl', stl(arch(() => false, true)), 'mesh', at),
      ])).filter(keep),
    }, at);
  }
  return receiveEmail({
    forwardedBy, fromName: 'Riverside Dental reception', fromEmail: 'reception@riversidedental.co.uk',
    subject: 'Fwd: files',
    body: 'Hi,\n\nPlease see attached from Dr. Patel.\n\nThanks,\nFront desk',
    files: (await Promise.all([
      file('IMG_2291.png', photo, 'image', at),
      file('referral.pdf', pdf(['Referral', '', 'Please see the attached photos.', 'Dr. Patel']), 'pdf', at),
    ])).filter(keep),
  }, at);
}

/**
 * First visit, so each path has an example:
 *   Isabella Hughes update (quotes ITR-CASE-55984) · draft → add to CASE-RS-2002
 *   Liam Foster crown request                    · draft → create a new case
 *   Hannah Price shade follow-up                 · already added to SG-2026-0519
 *   Chloe Bennett night guard                    · already made into case SG-2026-0527 (Email tab)
 *   "Please see attached"                        · draft → search or dismiss
 */
export const EMAIL_CASE_EXAMPLE = 'SG-2026-0527';
let seeding = false;
export async function ensureEmailDemo() {
  const { isEmailSeeded, markEmailSeeded, settleEmail, readEmail } = await import('./emailStore');
  const { addCreatedCase, getCreatedCases } = await import('../../src/app/data/createdCases');
  const { portalDate } = await import('../lab-prescription-inbox/data');
  if (isEmailSeeded() || seeding) return;
  seeding = true;
  try {
    // Older email drafts from before every email became a draft.
    const { removeCreatedCases } = await import('../../src/app/data/createdCases');
    removeCreatedCases(c => c.id.startsWith('SF-FE-') || c.id === EMAIL_CASE_EXAMPLE);

    const chloe = await forwardSample('chloe', 'Sajid Mahmood', 30 * 3_600_000);
    const r = readEmail(chloe);
    const madeAt = new Date(Date.now() - 28 * 3_600_000).toISOString();
    if (!getCreatedCases().some(c => c.id === EMAIL_CASE_EXAMPLE)) {
      addCreatedCase({
        id: EMAIL_CASE_EXAMPLE, patientName: 'Chloe Bennett', practice: 'Smile Genius Glasgow', dentist: 'Dr. Campbell', lab: 'Smile Genius Lab',
        services: ['Night Guard'],
        serviceItems: [{ id: `${EMAIL_CASE_EXAMPLE}-s1`, name: 'Night Guard', status: 'new', deliveryDate: r.delivery, fdi: [], material: 'Acrylic', orderType: 'NHS', instructions: chloe.body.trim(), scanFileCount: 2, attachmentCount: 0 }],
        status: 'new', createdAt: portalDate(new Date(madeAt)), updatedAt: portalDate(new Date(madeAt)), requestedDelivery: r.delivery, hasAlert: false,
        scanner: '3Shape', source: 'email', createdBy: 'Sajid Mahmood', createdBySide: 'lab',
        emailPrescription: { fromName: chloe.fromName, fromEmail: chloe.fromEmail, subject: chloe.subject, receivedAt: portalDate(new Date(chloe.at)), attachmentName: '2 attachments', bodyPreview: chloe.body.trim().slice(0, 280) },
      });
    }
    settleEmail(chloe.id, 'case', EMAIL_CASE_EXAMPLE, 'Sajid Mahmood', madeAt);

    const hannah = await forwardSample('hannah', 'Sophie Wilson', 6 * 3_600_000);
    settleEmail(hannah.id, 'added', 'SG-2026-0519', 'Sophie Wilson');

    await forwardSample('vague', 'Sophie Wilson', 3 * 3_600_000);
    await forwardSample('update', 'Sajid Mahmood', 90 * 60_000);
    await forwardSample('new', 'Sajid Mahmood', 20 * 60_000);
    markEmailSeeded();
  } finally { seeding = false; }
}
