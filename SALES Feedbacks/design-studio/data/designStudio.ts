// ── Design Studio: types, providers and demo seed ────────────────────────────
// Case-level design review and sign-off. A lab shares the link its CAD /
// planning software produces; the dentist reviews it from a secure link with
// no account, captures views, marks them up and approves or requests changes.
// Everything is mock data, local to the SALES Feedbacks sandbox.

export type DesignProvider =
  | 'exocad' | '3shape-communicate' | 'medit-link'
  | 'clincheck' | 'spark' | 'ulab' | 'blue-sky' | 'generic' | 'upload';

export type DesignKind = 'smile-design' | 'aligner-plan';

/** A file shared instead of (or alongside) a design link. Bytes live in IndexedDB (store/fileStore.ts). */
export interface DesignFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  /** dicom / archive come from clinician upload links: stored and listed, not viewed. */
  kind: 'mesh' | 'image' | 'pdf' | 'dicom' | 'archive';
  uploadedBy: 'lab' | 'clinician';
  uploadedAt: string;
  /** A DICOM series: the stored member files (this entry's id holds none). */
  parts?: string[];
}

export const ACCEPTED_FILES = '.stl,.obj,.ply,.png,.jpg,.jpeg,.webp,.pdf';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Which viewer a file belongs in, or null when we can't show it. */
export function fileKind(name: string, mime = ''): DesignFile['kind'] | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['stl', 'obj', 'ply'].includes(ext)) return 'mesh';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export interface ProviderMatch {
  provider: DesignProvider;
  label: string;
  hostPatterns: string[];
  embeddable: boolean;    // false → open in a new tab + show the static preview
  kindHint: DesignKind;
}

export interface CameraState { azimuth: number; elevation: number; zoom: number; target: [number, number, number]; }

export type MarkupTool = 'pen' | 'highlighter' | 'ellipse' | 'arrow' | 'text';

export interface MarkupStroke {
  id: string;
  tool: MarkupTool;
  color: string;
  points: [number, number][];    // normalised 0..1 of the capture frame
  text?: string;
  width: number;
}

export interface Capture {
  id: string;
  versionId: string;
  index: number;
  thumbnailLabel: string;
  camera: CameraState;
  strokes: MarkupStroke[];
  comment: string;
  teeth: number[];
  mentions: string[];            // LabMember.id
  createdAt: string;
  status: 'open' | 'addressed' | 'partially-addressed' | 'accepted';
  labResponse?: { by: string; at: string; note: string; outcome?: 'addressed' | 'partially' | 'cant-do' };
  /** Aligner plans: the stage the capture was taken at. */
  stage?: number;
  /** A screenshot uploaded instead of a viewer capture (non-embeddable providers). */
  uploadedImage?: string;
  /** Spawned from a V1 point the dentist re-opened in compare mode. */
  carriedFrom?: string;
  /** Uploaded-image designs: the image this capture froze. */
  imageFileId?: string;
  /** Files the dentist attached to this capture. */
  attachments?: DesignFile[];
}

export interface SignOff { name: string; at: string; versionId: string; versionHash: string; decision: 'approved' | 'changes-requested'; }

export interface DesignVersion {
  id: string;
  caseId: string;
  number: number;
  kind: DesignKind;
  provider: DesignProvider;
  sourceUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
  status: 'awaiting-review' | 'changes-requested' | 'approved' | 'superseded';
  captures: Capture[];
  reviewedBy?: string;
  reviewedAt?: string;
  decision?: 'approved' | 'changes-requested';
  decisionNote?: string;
  /** How the procedural preview of this version is built. */
  model: ModelParams;
  /** Compare mode: the dentist's verdict on each carried-forward point (previous version's capture id). */
  carryForward?: Record<string, 'confirmed' | 'reopened'>;
  /** Immutable record written on submit. */
  signOff?: SignOff;
  /** Uploaded design files (provider 'upload', or carried over from the dentist). */
  files?: DesignFile[];
  /** Files the dentist attached to the review as a whole. */
  reviewAttachments?: DesignFile[];
}

export interface ReviewLink {
  token: string;
  versionId: string;
  recipientName: string;
  recipientEmail: string;
  expiresAt: string;
  openedAt?: string;
  submittedAt?: string;
  /** Soft identity gate: who confirmed their name, and when. */
  confirmedName?: string;
  confirmedAt?: string;
}

export interface LabMember { id: string; name: string; role: string; initials: string; }

/** Inputs for the procedural arch preview (viewer/archModel.ts). */
export interface ModelParams {
  kind: DesignKind;
  shade: string;                               // VITA, drives enamel tint
  designedTeeth?: number[];                    // the restored teeth (smile designs)
  midlineShiftMm?: number;                     // + = dental midline towards patient's left
  incisalDeltaMm?: Record<number, number>;     // + = longer incisal edge
  buccalBulkMm?: Record<number, number>;       // + = more buccal contour
  stages?: { upper: number; lower: number };
  attachments?: { tooth: number; fromStage: number; raisedMm?: number }[];
  ipr?: { between: [number, number]; stage: number; mm: number }[];
  elasticsFromStage?: number;
  biteRamps?: number[];
  overcorrection?: boolean;
}

/** One case in Design Studio: the case facts plus its version history. */
export interface StudioCase {
  caseId: string;
  demoLabel: 'Smile design' | 'Aligner plan';
  patientName: string;
  practice: string;
  dentist: string;
  dentistEmail: string;
  lab: string;
  service: string;
  teeth: number[];
  material: string;
  shade: string;
  kind: DesignKind;
  versions: DesignVersion[];
  links: ReviewLink[];
}

// ── Providers ─────────────────────────────────────────────────────────────────
export const PROVIDERS: ProviderMatch[] = [
  { provider: 'exocad',             label: 'exocad webview',     hostPatterns: ['webview.exocad.com', 'dentalshare.exocad.com'], embeddable: true,  kindHint: 'smile-design' },
  { provider: '3shape-communicate', label: '3Shape Communicate', hostPatterns: ['communicate.3shape.com'],                       embeddable: false, kindHint: 'smile-design' },
  { provider: 'medit-link',         label: 'Medit Link',         hostPatterns: ['meditlink.com', 'medit.link'],                  embeddable: false, kindHint: 'smile-design' },
  { provider: 'clincheck',          label: 'ClinCheck',          hostPatterns: ['iap.invisalign.com', 'invisalign.com'],         embeddable: false, kindHint: 'aligner-plan' },
  { provider: 'spark',              label: 'Spark Approver',     hostPatterns: ['sparkaligners.com', 'ormco.com'],               embeddable: false, kindHint: 'aligner-plan' },
  { provider: 'ulab',               label: 'uLab',               hostPatterns: ['ulabsystems.com'],                              embeddable: true,  kindHint: 'aligner-plan' },
  { provider: 'blue-sky',           label: 'Blue Sky Plan',      hostPatterns: ['blueskybio.com'],                               embeddable: true,  kindHint: 'smile-design' },
];

export const GENERIC_PROVIDER: ProviderMatch = { provider: 'generic', label: 'Design link', hostPatterns: [], embeddable: false, kindHint: 'smile-design' };
export const UPLOAD_PROVIDER: ProviderMatch = { provider: 'upload', label: 'Uploaded files', hostPatterns: [], embeddable: true, kindHint: 'smile-design' };

export function detectProvider(url: string): ProviderMatch {
  let host = '';
  try { host = new URL(url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`).hostname.toLowerCase(); } catch { return GENERIC_PROVIDER; }
  return PROVIDERS.find(p => p.hostPatterns.some(h => host === h || host.endsWith(`.${h}`))) ?? GENERIC_PROVIDER;
}

export function providerFor(id: DesignProvider): ProviderMatch {
  if (id === 'upload') return UPLOAD_PROVIDER;
  return PROVIDERS.find(p => p.provider === id) ?? GENERIC_PROVIDER;
}

export const KIND_LABEL: Record<DesignKind, string> = { 'smile-design': 'Smile design', 'aligner-plan': 'Aligner treatment plan' };

export const LAB_MEMBERS: LabMember[] = [
  { id: 'anas',  name: 'Anas',  role: 'Case Manager',    initials: 'AN' },
  { id: 'mark',  name: 'Mark',  role: 'CAD Designer',    initials: 'MK' },
  { id: 'lorna', name: 'Lorna', role: 'Lab Coordinator', initials: 'LO' },
];

/** The fixed markup palette (danger, amber, brand, green, viewer chrome). */
export const SWATCHES = ['#D4183D', '#F59E0B', '#4D8EF7', '#10B981', '#1B1B2D'];

export const STUDIO_SERVICES = ['Clear Aligners', 'Veneers', 'Crown', 'Bridge', 'Retainer'];

// ── Camera presets ────────────────────────────────────────────────────────────
const cam = (azimuth: number, elevation: number, zoom = 1, target: [number, number, number] = [0, 0, 4]): CameraState => ({ azimuth, elevation, zoom, target });

export const CAMERA_PRESETS: { id: string; label: string; camera: CameraState }[] = [
  { id: 'front',  label: 'Front',          camera: cam(0, 4, 1.15) },
  { id: 'right',  label: 'Right 45°',      camera: cam(-45, 6, 1.1) },
  { id: 'left',   label: 'Left 45°',       camera: cam(45, 6, 1.1) },
  { id: 'upper',  label: 'Upper occlusal', camera: cam(0, -78, 1.0, [0, 0, -6]) },
  { id: 'lower',  label: 'Lower occlusal', camera: cam(0, 78, 1.0, [0, 0, -6]) },
  { id: 'overjet', label: 'Overjet',       camera: cam(-88, 0, 1.6, [0, 0, 10]) },
];
export const DEFAULT_CAMERA = CAMERA_PRESETS[0].camera;

// ── Dates (DD-MMM-YYYY, matching the portal's mock data) ─────────────────────
export function studioDate(d: Date | string = new Date()): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, '0')}-${x.toLocaleString('en-GB', { month: 'short' })}-${x.getFullYear()}`;
}
export function studioDateTime(iso: string): string {
  const d = new Date(iso);
  return `${studioDate(d)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`).toISOString();

// ── Demo seed ─────────────────────────────────────────────────────────────────
const pen = (id: string, color: string, pts: [number, number][], width = 3): MarkupStroke => ({ id, tool: 'pen', color, points: pts, width });

function caseA(): StudioCase {
  const caseId = 'SG-2026-0481';
  const v1 = 'v-0481-1', v2 = 'v-0481-2';
  const baseModel: ModelParams = { kind: 'smile-design', shade: 'A2', designedTeeth: [13, 12, 11, 21, 22, 23] };
  return {
    caseId, demoLabel: 'Smile design',
    patientName: 'Amelia Hughes', practice: 'Smile Genius Belfast', dentist: 'Dr. Murphy', dentistEmail: 'dr.murphy@smilegenius.co.uk',
    lab: 'Smile Genius Lab', service: 'Veneers', teeth: [13, 12, 11, 21, 22, 23],
    material: 'Lithium disilicate (IPS e.max)', shade: 'A2', kind: 'smile-design',
    versions: [
      {
        id: v2, caseId, number: 2, kind: 'smile-design', provider: 'exocad',
        sourceUrl: 'https://webview.exocad.com/v/sg-0481-v2', uploadedBy: 'Mark', uploadedAt: at('2026-10-09', '15:20'),
        note: 'Midline shifted, 12 shortened and 23 buccal contour reduced as far as the contact on 24 allows. Shade bumped to BL3 at the patient\'s request — confirm on the photos.',
        status: 'awaiting-review', captures: [],
        model: { ...baseModel, shade: 'BL3', midlineShiftMm: 0, incisalDeltaMm: { 12: 0 }, buccalBulkMm: { 23: 0.25 } },
        carryForward: { 'cap-0481-1': 'confirmed', 'cap-0481-2': 'confirmed' },
      },
      {
        id: v1, caseId, number: 1, kind: 'smile-design', provider: 'exocad',
        sourceUrl: 'https://webview.exocad.com/v/sg-0481-v1', uploadedBy: 'Mark', uploadedAt: at('2026-10-04', '11:05'),
        note: 'Smile design for 13–23. Please check incisal edge position and the midline against the facial midline before we press.',
        status: 'superseded', reviewedBy: 'Dr. Murphy', reviewedAt: at('2026-10-06', '13:42'), decision: 'changes-requested',
        decisionNote: 'Close — three things to sort before pressing.',
        model: { ...baseModel, midlineShiftMm: 0.5, incisalDeltaMm: { 12: 0.3 }, buccalBulkMm: { 23: 0.45 } },
        signOff: { name: 'Dr. Murphy', at: at('2026-10-06', '13:42'), versionId: v1, versionHash: 'sha256:9f3c…a71e', decision: 'changes-requested' },
        captures: [
          {
            id: 'cap-0481-1', versionId: v1, index: 1, thumbnailLabel: 'Front · retracted', camera: cam(0, 3, 1.35),
            strokes: [pen('s1', '#D4183D', [[0.5, 0.18], [0.5, 0.82]]), { id: 's2', tool: 'arrow', color: '#D4183D', points: [[0.62, 0.3], [0.53, 0.42]], width: 3 }],
            comment: "Dental midline sits about 0.5mm to the patient's left of the facial midline. Can we shift the central embrasure across?",
            teeth: [11, 21], mentions: ['mark'], createdAt: at('2026-10-06', '13:20'), status: 'addressed',
            labResponse: { by: 'Mark', at: at('2026-10-09', '15:10'), note: 'Midline shifted 0.5mm, central embrasure recut.', outcome: 'addressed' },
          },
          {
            id: 'cap-0481-2', versionId: v1, index: 2, thumbnailLabel: 'Right lateral 45°', camera: cam(-45, 4, 1.4, [-6, -2, 6]),
            strokes: [{ id: 's3', tool: 'ellipse', color: '#F59E0B', points: [[0.4, 0.5], [0.6, 0.66]], width: 3 }],
            comment: 'Incisal edge on 12 is long relative to 11 — bring it back roughly 0.3mm so the incisal plane stays parallel to the interpupillary line.',
            teeth: [12], mentions: [], createdAt: at('2026-10-06', '13:31'), status: 'addressed',
            labResponse: { by: 'Mark', at: at('2026-10-09', '15:12'), note: 'Incisal edge on 12 reduced 0.3mm; incisal plane re-checked against the interpupillary line.', outcome: 'addressed' },
          },
          {
            id: 'cap-0481-3', versionId: v1, index: 3, thumbnailLabel: 'Upper occlusal', camera: cam(0, -78, 1.05, [0, 0, -6]),
            strokes: [{ id: 's4', tool: 'highlighter', color: '#F59E0B', points: [[0.68, 0.36], [0.72, 0.44], [0.74, 0.52]], width: 4 }],
            comment: 'Emergence profile on 23 looks over-contoured buccally — patient has a tight buccal corridor and will feel it.',
            teeth: [23], mentions: [], createdAt: at('2026-10-06', '13:38'), status: 'partially-addressed',
            labResponse: { by: 'Mark', at: at('2026-10-09', '15:15'), note: 'Reduced buccal contour 0.2mm — more than that and we lose the contact on 24.', outcome: 'partially' },
          },
        ],
      },
    ],
    links: [
      { token: 'rv_8kq2m4x9', versionId: v2, recipientName: 'Dr. Murphy', recipientEmail: 'dr.murphy@smilegenius.co.uk', expiresAt: at('2026-10-26', '23:59'), openedAt: at('2026-10-10', '08:40'), confirmedName: 'Dr. Murphy', confirmedAt: at('2026-10-10', '08:40') },
      { token: 'rv_2hd6n1t4', versionId: v1, recipientName: 'Dr. Murphy', recipientEmail: 'dr.murphy@smilegenius.co.uk', expiresAt: at('2026-10-18', '23:59'), openedAt: at('2026-10-06', '13:02'), submittedAt: at('2026-10-06', '13:42'), confirmedName: 'Dr. Murphy', confirmedAt: at('2026-10-06', '13:02') },
    ],
  };
}

function caseB(): StudioCase {
  const caseId = 'SG-2026-0506';
  const v1 = 'v-0506-1', v2 = 'v-0506-2';
  const plan: ModelParams = {
    kind: 'aligner-plan', shade: 'A1', stages: { upper: 28, lower: 22 },
    attachments: [{ tooth: 14, fromStage: 4 }, { tooth: 24, fromStage: 4 }],
    ipr: [{ between: [12, 11], stage: 6, mm: 0.3 }, { between: [21, 22], stage: 6, mm: 0.3 }],
    elasticsFromStage: 12, biteRamps: [11, 21],
  };
  return {
    caseId, demoLabel: 'Aligner plan',
    patientName: 'Ethan Walsh', practice: 'Smile Genius Manchester', dentist: 'Dr. Campbell', dentistEmail: 'dr.campbell@smilegenius.co.uk',
    lab: 'Smile Genius Lab', service: 'Clear Aligners', teeth: [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47],
    material: 'Aligner (PETG, 0.75mm)', shade: '—', kind: 'aligner-plan',
    versions: [
      {
        id: v2, caseId, number: 2, kind: 'aligner-plan', provider: 'clincheck',
        sourceUrl: 'https://iap.invisalign.com/plan/sg-0506-v2', uploadedBy: 'Anas', uploadedAt: at('2026-10-08', '16:40'),
        note: 'Restaged to 31 upper / 22 lower. IPR moved distal to 13, attachment on 14 raised 1mm occlusally, overcorrection added on the 22 rotation.',
        status: 'awaiting-review', captures: [],
        model: { ...plan, stages: { upper: 31, lower: 22 }, attachments: [{ tooth: 14, fromStage: 4, raisedMm: 1 }, { tooth: 24, fromStage: 4 }], ipr: [{ between: [13, 14], stage: 6, mm: 0.3 }, { between: [21, 22], stage: 6, mm: 0.3 }], overcorrection: true },
        carryForward: {},
      },
      {
        id: v1, caseId, number: 1, kind: 'aligner-plan', provider: 'clincheck',
        sourceUrl: 'https://iap.invisalign.com/plan/sg-0506', uploadedBy: 'Anas', uploadedAt: at('2026-10-01', '10:15'),
        note: 'Class II correction, 28 upper / 22 lower. IPR 0.3mm 12/11 and 21/22 at stage 6, attachments 14 and 24 at stage 4, bite ramps 11/21, elastics from stage 12.',
        status: 'superseded', reviewedBy: 'Dr. Campbell', reviewedAt: at('2026-10-03', '18:05'), decision: 'changes-requested',
        model: plan,
        signOff: { name: 'Dr. Campbell', at: at('2026-10-03', '18:05'), versionId: v1, versionHash: 'sha256:41be…0c92', decision: 'changes-requested' },
        captures: [
          {
            id: 'cap-0506-1', versionId: v1, index: 1, thumbnailLabel: 'Stage 6 · Front', camera: cam(0, 4, 1.3), stage: 6,
            strokes: [{ id: 'b1', tool: 'ellipse', color: '#D4183D', points: [[0.38, 0.42], [0.47, 0.62]], width: 3 }],
            comment: '0.3mm IPR between 12 and 11 — contacts are already tight here, can we move it distal to the 13?',
            teeth: [11, 12, 13], mentions: ['anas'], createdAt: at('2026-10-03', '17:40'), status: 'addressed',
            labResponse: { by: 'Anas', at: at('2026-10-08', '16:30'), note: 'Moved the 0.3mm IPR to 13/14 at stage 6 — 12/11 contact left untouched.', outcome: 'addressed' },
          },
          {
            id: 'cap-0506-2', versionId: v1, index: 2, thumbnailLabel: 'Stage 14 · Right buccal', camera: cam(-60, 4, 1.35, [-10, 0, 0]), stage: 14,
            strokes: [{ id: 'b2', tool: 'arrow', color: '#F59E0B', points: [[0.3, 0.25], [0.44, 0.44]], width: 3 }],
            comment: 'Attachment on 14 is sitting very close to the gingival margin. Patient has recession here — move it occlusally.',
            teeth: [14], mentions: [], createdAt: at('2026-10-03', '17:52'), status: 'addressed',
            labResponse: { by: 'Anas', at: at('2026-10-08', '16:34'), note: 'Attachment on 14 raised 1mm occlusally, clear of the margin.', outcome: 'addressed' },
          },
          {
            id: 'cap-0506-3', versionId: v1, index: 3, thumbnailLabel: 'Stage 28 · Overjet', camera: cam(-88, 0, 1.6, [0, 0, 10]), stage: 28,
            strokes: [pen('b3', '#4D8EF7', [[0.52, 0.42], [0.58, 0.44], [0.62, 0.5]])],
            comment: "Final overjet looks around 1mm. I'd want 2mm of overcorrection on the rotations for 22.",
            teeth: [22], mentions: [], createdAt: at('2026-10-03', '18:01'), status: 'open',
          },
        ],
      },
    ],
    links: [
      { token: 'rv_3fp7w2c5', versionId: v2, recipientName: 'Dr. Campbell', recipientEmail: 'dr.campbell@smilegenius.co.uk', expiresAt: at('2026-10-22', '23:59') },
      { token: 'rv_expired01', versionId: v1, recipientName: 'Dr. Campbell', recipientEmail: 'dr.campbell@smilegenius.co.uk', expiresAt: at('2026-10-08', '23:59'), openedAt: at('2026-10-03', '17:30'), submittedAt: at('2026-10-03', '18:05') },
    ],
  };
}

export function seedStudioCases(): Record<string, StudioCase> {
  const a = caseA(), b = caseB();
  return { [a.caseId]: a, [b.caseId]: b };
}

export const DEMO_CASE_IDS = ['SG-2026-0481', 'SG-2026-0506'];
