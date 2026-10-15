import type { Case } from '../../src/app/pages/CasesPage';
import type { DesignFile } from '../design-studio/data/designStudio';
import { fid, putBlob } from '../design-studio/store/fileStore';
import { portalDate } from '../lab-prescription-inbox/data';
import { addSeededRequests, INTAKE_ID_PREFIX, IntakeSubmission, isIntakeSeeded, getIntakeConfig } from './intakeStore';

// ── Example website requests ─────────────────────────────────────────────────
// Two requests so the flow can be shown without filling the form in:
//   WEB-0005: a draft that's just come in (unknown practice, unverified sender)
//   WEB-0004: already confirmed by the lab, now a real case (SG-2026-0519)
// Attachments are real files (generated STL scans, photos, a PDF) stored like
// any upload, so they open in the 3D preview, lightbox and PDF tab.

export const CONFIRMED_EXAMPLE_CASE = 'SG-2026-0519';
export const DRAFT_EXAMPLE_CASE = `${INTAKE_ID_PREFIX}DEMO05`;

// ── Generated files ──────────────────────────────────────────────────────────
type V = [number, number, number];

/** A tooth as a lathed crown shape at (cx, cy). `prep` makes it a tapered preparation. */
// Viewer convention: y is up (crowns point down on the upper jaw, up on the
// lower), x across the arch, z front to back.
function tooth(cx: number, cz: number, w: number, h: number, prep = false, lower = false): [V, V, V][] {
  const prof: [number, number][] = prep
    ? [[w * 0.62, 0], [w * 0.6, h * 0.12], [w * 0.5, h * 0.45], [w * 0.4, h * 0.62], [w * 0.2, h * 0.7], [0, h * 0.72]]
    : [[w * 0.55, 0], [w * 0.62, h * 0.3], [w * 0.64, h * 0.55], [w * 0.56, h * 0.78], [w * 0.38, h * 0.93], [0, h]];
  const seg = 18;
  const tris: [V, V, V][] = [];
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * Math.PI * 2, a1 = ((j + 1) / seg) * Math.PI * 2;
      const p = (k: number, a: number): V => [cx + prof[k][0] * Math.cos(a), (lower ? 1 : -1) * prof[k][1], cz + prof[k][0] * Math.sin(a) * 0.85];
      tris.push([p(i, a0), p(i, a1), p(i + 1, a1)], [p(i, a0), p(i + 1, a1), p(i + 1, a0)]);
    }
  }
  return tris;
}

/** A 14-tooth arch along a parabola; `preps` are FDI positions (1–7 per side) cut as preparations. */
function arch(preps: (i: number, side: 'L' | 'R') => boolean, lower = false): [V, V, V][] {
  const widths = [8.5, 6.8, 7.6, 7.0, 7.0, 10.5, 10.0];
  const heights = [10.5, 9.5, 11, 9, 8.5, 7.5, 7];
  const out: [V, V, V][] = [];
  (['R', 'L'] as const).forEach(side => {
    let x = 0;
    for (let i = 0; i < 7; i++) {
      x += widths[i] * 0.55;
      const sx = side === 'R' ? x : -x;
      const z = 0.016 * sx * sx;
      out.push(...tooth(sx, z, widths[i] * 0.86, heights[i], preps(i + 1, side), lower));
      x += widths[i] * 0.45;
    }
  });
  return out;
}

function stl(tris: [V, V, V][]): Blob {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  tris.forEach(([a, b, c], i) => {
    const o = 84 + i * 50;
    [a, b, c].forEach((v, k) => v.forEach((n, m) => dv.setFloat32(o + 12 + k * 12 + m * 4, n, true)));
  });
  return new Blob([buf], { type: 'model/stl' });
}

/** A one-page PDF with a few lines of text. */
function pdf(lines: string[]): Blob {
  const esc = (t: string) => t.replace(/[\\()]/g, m => `\\${m}`);
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 16 : 11} Tf 56 ${780 - i * 22} Td (${esc(l)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
}

async function save(name: string, blob: Blob, kind: DesignFile['kind'], at: string): Promise<DesignFile | null> {
  const id = fid();
  if (!(await putBlob(id, blob))) return null;
  return { id, name, size: blob.size, mime: blob.type, kind, uploadedBy: 'clinician', uploadedAt: at };
}

// ── Seed ─────────────────────────────────────────────────────────────────────
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const isoDay = (daysAhead: number) => new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
const portalIso = (d: string) => portalDate(new Date(`${d}T12:00:00`));

let seeding = false;
export async function ensureIntakeDemo() {
  if (isIntakeSeeded() || seeding) return;
  seeding = true;
  try {
    const labName = getIntakeConfig().labName;
    const photo = await fetch('/teeth-3d.png').then(r => (r.ok ? r.blob() : null)).catch(() => null);
    const keep = (f: DesignFile | null): f is DesignFile => !!f;

    // WEB-0005: just came in, still a draft
    const draftAt = iso(35 * 60_000);
    const draftFiles = (await Promise.all([
      save('LL6-prep_lower-arch.stl', stl(arch((i, s) => i === 6 && s === 'L', true)), 'mesh', draftAt),
      save('opposing_upper-arch.stl', stl(arch(() => false)), 'mesh', draftAt),
      photo && save('pre-op_LL6_occlusal.png', photo, 'image', draftAt),
    ])).filter(keep);
    const draftDelivery = isoDay(12);
    const draftOrder = {
      patientDob: '1968-11-04', patientRef: 'HDC-20417', teeth: [36], material: 'Zirconia', shade: 'A3', orderType: 'Private', delivery: draftDelivery,
      instructions: 'Monolithic zirconia crown LL6. Root-treated with a fibre post; 1 mm chamfer margin, supragingival on the buccal. Patient is a known bruxist: keep occlusal contacts light in ICP and check lateral excursions against UL6.',
      extras: {},
    };
    const draft: Case = {
      id: DRAFT_EXAMPLE_CASE, patientName: 'Thomas Reid', practice: 'Harbour Dental Care', dentist: 'Priya Raman', lab: labName,
      services: ['Crown'],
      serviceItems: [{
        id: `${DRAFT_EXAMPLE_CASE}-s1`, name: 'Crown', status: 'submitted', deliveryDate: null, fdi: [36], material: 'Zirconia', shade: 'A3', orderType: 'Private',
        instructions: `${draftOrder.instructions}\nClinic patient ref: HDC-20417\nPatient DOB: ${portalIso(draftOrder.patientDob)}`, scanFileCount: 2, attachmentCount: 1,
      }],
      status: 'draft', createdAt: portalDate(), updatedAt: portalDate(), requestedDelivery: portalIso(draftDelivery), hasAlert: false,
      scanner: '3Shape', source: 'email', createdBy: 'Priya Raman', createdBySide: 'clinic',
      emailPrescription: {
        fromName: 'Priya Raman · Harbour Dental Care', fromEmail: 'priya@harbourdental.co.uk', subject: 'Website intake form · WEB-0005', receivedAt: '35 min ago',
        attachmentName: `${draftFiles.length} files attached`,
        bodyPreview: `Submitted through ${labName}'s website intake form by Priya Raman (GDC 271834, 0117 496 0321). Sender not verified. New practice: "Harbour Dental Care", BS1 4QA, isn't linked yet.`,
      },
    };
    const draftSub: IntakeSubmission = {
      caseId: DRAFT_EXAMPLE_CASE, ref: 'WEB-0005', at: draftAt, dentist: 'Priya Raman', gdc: '271834', practice: 'Harbour Dental Care', postcode: 'BS1 4QA',
      email: 'priya@harbourdental.co.uk', phone: '0117 496 0321', patientName: 'Thomas Reid', service: 'Crown', knownPractice: false,
      files: draftFiles, notified: ['sajid@smilegenius.com'], order: draftOrder,
    };

    // WEB-0004: confirmed by the lab yesterday, now a real case
    const doneAt = iso(26 * 3_600_000);
    const confirmedAt = iso(24 * 3_600_000);
    const doneFiles = (await Promise.all([
      save('upper-arch_veneer-preps_13-23.stl', stl(arch(i => i <= 3)), 'mesh', doneAt),
      save('lower-arch.stl', stl(arch(() => false, true)), 'mesh', doneAt),
      photo && save('smile_retracted.png', photo, 'image', doneAt),
      photo && save('shade-tab_BL2.png', photo, 'image', doneAt),
      save('mock-up-approval_signed.pdf', pdf([
        'Smile Genius Manchester: mock-up approval', '', 'Patient: Hannah Price (SGM-55812)', 'Treatment: 6 x lithium disilicate veneers, 13-23',
        'Shade agreed: BL2, natural translucency', 'The patient has seen and approved the intra-oral mock-up.', '', 'Signed: Hannah Price', 'Clinician: Dr. Murphy (GDC 102938)',
      ]), 'pdf', doneAt),
    ])).filter(keep);
    const doneDelivery = isoDay(13);
    const doneOrder = {
      patientDob: '1989-05-17', patientRef: 'SGM-55812', teeth: [13, 12, 11, 21, 22, 23], material: 'Lithium Disilicate (e.max)', shade: 'BL2', orderType: 'Private', delivery: doneDelivery,
      instructions: '6 x e.max veneers 13-23. Prepped through the approved mock-up with a reduction guide: 0.5 mm facial, 1.0 mm incisal, butt-joint incisal edge, margins equigingival. Match translucency and incisal halo to the lower anteriors; natural BL2, not opaque. Shade-tab photos and the signed mock-up approval attached.',
      extras: {},
    };
    const confirmed: Case = {
      id: CONFIRMED_EXAMPLE_CASE, patientName: 'Hannah Price', practice: 'Smile Genius Manchester', dentist: 'Dr. Murphy', lab: labName,
      services: ['Veneers'],
      serviceItems: [{
        id: `${CONFIRMED_EXAMPLE_CASE}-s1`, name: 'Veneers', status: 'new', deliveryDate: null, fdi: doneOrder.teeth, material: doneOrder.material, shade: 'BL2', orderType: 'Private',
        instructions: doneOrder.instructions, scanFileCount: 2, attachmentCount: 3,
      }],
      status: 'new', createdAt: portalDate(new Date(confirmedAt)), updatedAt: portalDate(new Date(confirmedAt)), requestedDelivery: portalIso(doneDelivery), hasAlert: false,
      scanner: '3Shape', source: 'email', createdBy: 'Sajid Mahmood', createdBySide: 'clinic',
      emailPrescription: {
        fromName: 'Dr. Murphy · Smile Genius Manchester', fromEmail: 'dr.murphy@smilegenius.co.uk', subject: 'Website intake form · WEB-0004', receivedAt: portalDate(new Date(doneAt)),
        attachmentName: `${doneFiles.length} files attached`,
        bodyPreview: `Submitted through ${labName}'s website intake form by Dr. Murphy (GDC 102938). Checked and confirmed by Sajid Mahmood.`,
      },
    };
    const doneSub: IntakeSubmission = {
      caseId: `${INTAKE_ID_PREFIX}DEMO04`, ref: 'WEB-0004', at: doneAt, dentist: 'Dr. Murphy', gdc: '102938', practice: 'Smile Genius Manchester', postcode: 'M2 3AW',
      email: 'dr.murphy@smilegenius.co.uk', phone: '0161 496 0112', patientName: 'Hannah Price', service: 'Veneers', knownPractice: true,
      files: doneFiles, notified: ['sajid@smilegenius.com'], order: doneOrder,
      confirmedCaseId: CONFIRMED_EXAMPLE_CASE, confirmedAt, confirmedBy: 'Sajid Mahmood',
    };

    addSeededRequests([draftSub, doneSub], [confirmed, draft]);
  } finally { seeding = false; }
}
