import type { DesignFile, DesignProvider } from '../design-studio/data/designStudio';

// ── CAD integration (exocad & 3Shape): the data model ────────────────────────
// From the "CAD Integration" spec (Oct 2026). Smile Genius creates the CAD order
// for each digital case, tracks the design through its statuses, runs dentist
// approval through Design Studio, and sends work to outside partners. The
// desktop connector is simulated, and the finished design comes back manually
// (link or files) until exocad / 3Shape partner access is confirmed.

export type CadSoftware = 'exocad' | '3shape';

export type DesignStatus =
  | 'order-created' | 'waiting-scans' | 'in-design' | 'awaiting-dentist' | 'ready'
  | 'manufacturing' | 'finishing' | 'dispatched'
  | 'sent-to-partner' | 'design-received' | 'partner-manufacturing' | 'received-back'
  | 'cancelled';

export interface CadMap { indication: string; material: string }

export interface CadSettings {
  cad: 'exocad' | '3shape' | 'both' | 'none';
  /** Default CAD per department (when the lab uses both). */
  cadByDepartment: Record<string, CadSoftware>;
  createOn: 'accepted' | 'manual';
  patientDetails: 'full' | 'initials';
  approval: 'always' | 'never' | 'selected';
  /** Which restoration types need the dentist's sign-off when `approval` is 'selected'. */
  approvalTypes: { veneers: boolean; anterior4: boolean; implantBars: boolean; bridges: boolean; smileDesign: boolean };
  reminderHours: number;
  partnerByDepartment: Record<string, string | null>;
  partnerOverdueDays: number;
  /** Catalog item id → CAD indication and material, per CAD. */
  mapping: Record<string, Partial<Record<CadSoftware, CadMap>>>;
  assign: 'manual' | 'round-robin' | 'by-type';
  /** Technician per department, when assigning by type. */
  techByDepartment: Record<string, string>;
}

export interface Connector {
  id: string;
  pc: string;
  cad: CadSoftware;
  path: string;
  mode: 'shared' | 'per-pc';
  version: string;
  lastSeen: string;
  status: 'online' | 'offline' | 'needs-update';
  /** Case ids waiting to be written as orders when it's back. */
  queue: string[];
  testedAt?: string;
}

export interface OrderLine { id: string; itemId: string | null; itemName: string; fdi: number[]; indication: string | null; material: string | null }

export interface DesignedLine { id: string; itemId: string; fdi: number[] }

export interface ApprovalRound {
  versionId: string;
  token: string;
  number: number;
  sentAt: string;
  channel: 'whatsapp' | 'email' | 'portal';
  note?: string;
  decision?: 'approved' | 'changes-requested';
  decidedAt?: string;
  by?: string;
  versionHash?: string;
  comments?: string[];
}

export interface CadOrder {
  caseId: string;
  /** Where the design is done: a CAD in the lab, or a partner. */
  cad: CadSoftware | 'partner';
  /** The Smile Genius case id, written into the CAD order: the key that links both systems. */
  ref: string;
  patientSent: string;
  client: string;
  dueDate: string | null;
  shade: string | null;
  lines: OrderLine[];
  implant?: { system: string; platform: string };
  scans: { name: string; kind: 'prep' | 'antagonist' | 'bite' | 'scanbody' | 'photo' | 'file' }[];
  instructions?: string;
  notes: string[];
  technician: string | null;
  status: DesignStatus;
  history: { at: string; status: DesignStatus; by: string }[];
  createdAt: string;
  connectorId: string | null;
  /** Written to a queue because the connector was offline. */
  queued?: boolean;
  /** A TRIOS case 3Shape already put in its own inbox: linked, not created twice. */
  linkedFromInbox?: string;
  duplicate?: { otherRef: string; createdBy: string };
  approvalNeeded: boolean;
  rounds: ApprovalRound[];
  reminderSentAt?: string;
  labAlertedAt?: string;
  callDentist?: boolean;
  design?: {
    at: string;
    by: string;
    sourceUrl?: string;
    provider: DesignProvider;
    files: DesignFile[];
    lines: DesignedLine[];
    diff: string[];
  };
  partnerJobId?: string;
  cancelledAt?: string;
}

export interface Partner {
  id: string;
  name: string;
  does: 'design' | 'milling' | 'both';
  email: string;
  turnaroundDays: number;
  active: boolean;
}

export interface PartnerJob {
  token: string;
  caseId: string;
  partnerId: string;
  kind: 'design' | 'milling';
  sentAt: string;
  dueAt: string;
  status: 'sent' | 'downloaded' | 'uploaded' | 'shipped' | 'received';
  downloadedAt?: string;
  uploads: DesignFile[];
  uploadedAt?: string;
  tracking?: string;
  courier?: string;
  message?: string;
  remindedAt?: string;
  overdueAlertedAt?: string;
  reassignedFrom?: string;
}

export interface CadEvent { id: string; at: string; title: string; body: string; caseId?: string }

export interface CadState {
  version: number;
  settings: CadSettings;
  connectors: Connector[];
  orders: Record<string, CadOrder>;
  partners: Partner[];
  jobs: PartnerJob[];
  events: CadEvent[];
  /** Cases the integration has already looked at (older cases don't get orders). */
  seen: string[];
  rr: number;
}
