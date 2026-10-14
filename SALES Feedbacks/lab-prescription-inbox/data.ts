import type { Case } from '../../src/app/pages/CasesPage';
// Photo-style sample prescriptions, made by scripts/generate-rx-photos.mjs.
import rxS1P1 from './assets/rx-s1-p1.jpg';
import rxS2P1 from './assets/rx-s2-p1.jpg';
import rxS2P2 from './assets/rx-s2-p2.jpg';
import rxS3P1 from './assets/rx-s3-p1.jpg';

// ── Lab prescription email inbox: sandbox data ───────────────────────────────

/** The lab's unique address: photos of paper prescriptions are emailed here. */
export const RX_INBOX = 'prescriptions+smilegeniuslab@smilegeniusdental.com';
export const LAB_NAME = 'Smile Genius Lab';

/** Every sandbox-made case id starts with this, so the demo can clean up after itself. */
export const SANDBOX_ID_PREFIX = 'SF-RX-';

export interface LabTeamMember {
  name: string;
  email: string;
  role: string;
}

// Mirrors the team listed under Settings → User Management (mockMembers in
// src/app/pages/SettingsPage.tsx, which isn't exported), so the recipient
// list shows the same people as the rest of the portal.
export const LAB_TEAM: LabTeamMember[] = [
  { name: 'Riverdale Admin', email: 'super_admin_riverdale_dev@yopmail.com', role: 'Super Admin' },
  { name: 'Sajid Mahmood',   email: 'sajid@smilegenius.com',                 role: 'Admin' },
  { name: 'Sophie Wilson',   email: 'sophie@smilegenius.com',                role: 'Practice Manager' },
  { name: 'Dr. Murphy',      email: 'murphy@smilegenius.com',                role: 'Dentist' },
];

/** The team member behind the signed-in account. The demo sign-in
 *  (sajid@smilegenius.co.uk) maps to Sajid Mahmood by mailbox name. */
export function teamMemberFor(email?: string | null): LabTeamMember | undefined {
  if (!email) return undefined;
  const local = email.split('@')[0].toLowerCase();
  return LAB_TEAM.find(m => m.email === email) ?? LAB_TEAM.find(m => m.email.split('@')[0].toLowerCase() === local);
}

/** What the AI reads off each sample photo: a Case minus the per-email fields. */
export interface SamplePrescription {
  id: string;
  label: string;
  photoName: string;
  /** One image per photographed page, in order. */
  pages: string[];
  draft: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'emailPrescription'>;
}

// scanner is not 'iTero': QuickCreate treats an iTero email as a scan export
// and shows its zip-upload pane instead of the source-email pane.
// Practices / dentists come from the portal's existing mock data so the
// QuickCreate prefill resolves them the same way it does for the seeded drafts.
export const SAMPLE_PRESCRIPTIONS: SamplePrescription[] = [
  {
    id: 's1',
    label: 'Single crown',
    photoName: 'IMG_4821.jpg',
    pages: [rxS1P1],
    draft: {
      patientName: 'Emily Carter',
      practice: 'Smile Genius Manchester',
      dentist: 'Dr. Murphy',
      lab: LAB_NAME,
      services: ['Crown'],
      serviceItems: [{
        id: 'sf1-s1', name: 'Crown', status: 'submitted', deliveryDate: null,
        fdi: [16], material: 'Zirconia', shade: 'A2', orderType: 'Private',
        instructions: 'Monolithic zirconia crown UR6. Light occlusal contact please, pt clenches.',
        scanFileCount: 0, attachmentCount: 1,
      }],
      status: 'draft', requestedDelivery: '26-Oct-2026', hasAlert: false,
      scanner: '3Shape', source: 'email', createdBySide: 'lab',
    },
  },
  {
    id: 's2',
    label: 'Veneers, form + sketch overleaf',
    photoName: 'IMG_4830.jpg',
    pages: [rxS2P1, rxS2P2],
    draft: {
      patientName: "James O'Neill",
      practice: 'Smile Genius Birmingham 1',
      dentist: 'Dr. Davies',
      lab: LAB_NAME,
      services: ['Veneers'],
      serviceItems: [{
        id: 'sf2-s1', name: 'Veneers', status: 'submitted', deliveryDate: null,
        fdi: [11, 21], material: 'E.max', shade: 'B1', orderType: 'Private',
        instructions: '2x e.max veneers UR1 + UL1, minimal prep. Pt wants natural, not too white. From the sketch overleaf: +0.5mm incisal length, subtle mamelons, match translucency to 12/22.',
        scanFileCount: 0, attachmentCount: 1,
      }],
      status: 'draft', requestedDelivery: '30-Oct-2026', hasAlert: false,
      scanner: '3Shape', source: 'email', createdBySide: 'lab',
    },
  },
  {
    id: 's3',
    label: 'Night guard, dim angled shot',
    photoName: 'IMG_4877.jpg',
    pages: [rxS3P1],
    draft: {
      patientName: 'Margaret Hughes',
      practice: 'Smile Genius Leeds',
      dentist: 'Dr. Foster',
      lab: LAB_NAME,
      services: ['Night Guard'],
      serviceItems: [{
        id: 'sf3-s1', name: 'Night Guard', status: 'submitted', deliveryDate: null,
        fdi: [16, 17, 26, 27], material: 'Soft EVA', shade: 'Clear', orderType: 'Private',
        instructions: 'Upper soft splint 2mm, full coverage. Pt grinds at night. Upper imp + bite enclosed.',
        scanFileCount: 0, attachmentCount: 1,
      }],
      status: 'draft', requestedDelivery: null, hasAlert: false,
      scanner: '3Shape', source: 'email', createdBySide: 'lab',
    },
  },
];

/** Portal date format, e.g. "12-Oct-2026". */
export function portalDate(d = new Date()): string {
  const m = d.toLocaleString('en-GB', { month: 'short' });
  return `${String(d.getDate()).padStart(2, '0')}-${m}-${d.getFullYear()}`;
}

export function portalDateTime(iso: string): string {
  const d = new Date(iso);
  return `${portalDate(d)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
