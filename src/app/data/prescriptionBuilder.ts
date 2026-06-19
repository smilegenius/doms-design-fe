// ─── Prescription Builder ────────────────────────────────────────────────────
// The lab configures the prescription form here — which fields appear in case
// creation, whether they're required, and the dropdown values on offer. This is
// the SOURCE for Case Scoring: scoring can only weight fields that are enabled
// here (and flagged `scoreable`). Disable a weighted field and that service's
// scoring goes "out of sync" until the lab updates it.
import {
  MATERIAL_TYPES, TOOTH_SHADES, ORDER_TYPES, DENTURE_STAGES,
  RETAINER_TYPES, ALIGNER_DURATIONS, APPLIANCE_NIGHT_GUARD_TYPES, IMPLANT_BRANDS,
} from '../pages/CreateCasePage';
import type { ScoringConfig } from './caseScoring';

export type PrescriptionFieldType = 'teeth' | 'select' | 'multiselect' | 'toggle' | 'text' | 'files' | 'date';

export interface PrescriptionField {
  id: string;
  label: string;
  type: PrescriptionFieldType;
  enabled: boolean;
  required: boolean;
  /** Can Case Scoring put weight on this field? Only fields backed by case
      data (a SCORE_FIELD_DEF) are scoreable. */
  scoreable: boolean;
  /** Dropdown values for select/multiselect — the lab can add/remove these. */
  options?: string[];
  hint?: string;
}

export type PrescriptionConfig = Record<string, PrescriptionField[]>;

// Field templates — ids match the SCORE_FIELD_DEFS so scoring lines up 1:1.
const F = {
  teeth:        (required = true):  PrescriptionField => ({ id: 'teeth',        label: 'Teeth selected',       type: 'teeth',      enabled: true, required, scoreable: true,  hint: 'Tooth chart' }),
  material:     (required = true):  PrescriptionField => ({ id: 'material',     label: 'Material',             type: 'select',     enabled: true, required, scoreable: true,  options: [...MATERIAL_TYPES] }),
  shade:        (required = true):  PrescriptionField => ({ id: 'shade',        label: 'Shade',                type: 'select',     enabled: true, required, scoreable: true,  options: [...TOOTH_SHADES] }),
  scans:        (required = false): PrescriptionField => ({ id: 'scans',        label: '3D scan files',        type: 'files',      enabled: true, required, scoreable: true,  hint: 'Intra-oral scan upload' }),
  attachments:  (required = false): PrescriptionField => ({ id: 'attachments',  label: 'Photos / attachments', type: 'files',      enabled: true, required, scoreable: true,  hint: 'Supporting photos / files' }),
  instructions: (required = false): PrescriptionField => ({ id: 'instructions', label: 'Lab instructions',     type: 'text',       enabled: true, required, scoreable: true }),
  delivery:     (required = false): PrescriptionField => ({ id: 'delivery',     label: 'Requested delivery',   type: 'date',       enabled: true, required, scoreable: true }),
  orderType:    (required = true):  PrescriptionField => ({ id: 'orderType',    label: 'Order type',           type: 'select',     enabled: true, required, scoreable: true,  options: [...ORDER_TYPES] }),
  stages:       (required = true):  PrescriptionField => ({ id: 'stages',       label: 'Stages',               type: 'multiselect', enabled: true, required, scoreable: true,  options: [...DENTURE_STAGES] }),
  // Service-specific fields — configurable in the form but not scoreable
  // (no completeness signal on persisted case data).
  brand:           (): PrescriptionField => ({ id: 'brand',           label: 'Implant brand',     type: 'select', enabled: true, required: false, scoreable: false, options: IMPLANT_BRANDS.slice(0, 8) }),
  retainerType:    (): PrescriptionField => ({ id: 'retainerType',    label: 'Retainer type',     type: 'select', enabled: true, required: true,  scoreable: false, options: [...RETAINER_TYPES] }),
  alignerDuration: (): PrescriptionField => ({ id: 'alignerDuration', label: 'Aligner duration',  type: 'select', enabled: true, required: true,  scoreable: false, options: [...ALIGNER_DURATIONS] }),
  nightGuardType:  (): PrescriptionField => ({ id: 'nightGuardType',  label: 'Night guard type',  type: 'select', enabled: true, required: true,  scoreable: false, options: [...APPLIANCE_NIGHT_GUARD_TYPES] }),
};

// Per-category field templates — each builder returns fresh field objects so
// services never share references.
const singleUnit = (): PrescriptionField[] => [F.teeth(), F.material(), F.shade(), F.scans(), F.attachments(), F.instructions(), F.delivery(), F.orderType()];
const bridge     = (): PrescriptionField[] => [F.teeth(), F.material(), F.shade(), F.brand(), F.scans(), F.attachments(), F.instructions(), F.delivery(), F.orderType()];
const aligner    = (): PrescriptionField[] => [F.teeth(), F.alignerDuration(), F.scans(), F.attachments(), F.instructions(), F.delivery(), F.orderType()];
const retainer   = (): PrescriptionField[] => [F.teeth(), F.retainerType(), F.material(false), F.shade(false), F.instructions(), F.delivery(), F.orderType()];
const denture    = (): PrescriptionField[] => [F.teeth(), F.material(), F.shade(), F.stages(), F.instructions(), F.delivery(), F.orderType()];
const nightGuard = (): PrescriptionField[] => [F.teeth(), F.nightGuardType(), F.material(false), F.shade(false), F.instructions(), F.delivery(), F.orderType()];
const whitening  = (): PrescriptionField[] => [F.teeth(), F.shade(false), F.instructions(), F.delivery(), F.orderType()];
const splint     = (): PrescriptionField[] => [F.teeth(), F.material(false), F.instructions(), F.delivery(), F.orderType()];
const other      = (): PrescriptionField[] => [F.teeth(), F.material(false), F.shade(false), F.instructions(), F.delivery(), F.orderType()];

export const DEFAULT_PRESCRIPTION_CONFIG: PrescriptionConfig = {
  // Single Unit
  'Crown':                 singleUnit(),
  'Veneers':               singleUnit(),
  'Inlay/Onlay':           singleUnit(),
  'Implant Abutment':      [F.teeth(), F.material(), F.shade(), F.brand(), F.scans(), F.attachments(), F.instructions(), F.delivery(), F.orderType()],
  'Post & Core Crown':     singleUnit(),
  'Screw-Retained Crown':  singleUnit(),
  // Bridge
  'Bridge':                bridge(),
  // Orthodontics
  'Clear Aligners':        aligner(),
  'Retainer':              retainer(),
  // Denture
  'Full Denture':          denture(),
  'Partial Denture':       denture(),
  'Immediate Denture':     denture(),
  // Appliances
  'Night Guard':           nightGuard(),
  'Whitening Tray':        whitening(),
  'Splint':                splint(),
  // Others
  'Other':                 other(),
};

// The hardcoded intra-oral scan slots that "3D scan files" expands into for
// scoring — independent of the Prescription Builder.
export const SCAN_SLOT_FIELDS: PrescriptionField[] = [
  { id: 'scan_upper', label: 'Upper',       type: 'files', enabled: true, required: false, scoreable: true },
  { id: 'scan_lower', label: 'Lower',       type: 'files', enabled: true, required: false, scoreable: true },
  { id: 'scan_bite',  label: 'Bite Scan',   type: 'files', enabled: true, required: false, scoreable: true },
  { id: 'scan_bite2', label: 'Bite Scan 2', type: 'files', enabled: true, required: false, scoreable: true },
];

// Enabled + scoreable field ids for a service — the candidates Case Scoring can
// weight. The "scans" (3D scan files) field expands into per-slot sub-fields so
// the lab can weight each scan type individually.
export function scoreableFieldsFor(service: string, prescription: PrescriptionConfig): PrescriptionField[] {
  return (prescription[service] ?? [])
    .filter(f => f.enabled && f.scoreable)
    .flatMap(f => (f.id === 'scans' ? SCAN_SLOT_FIELDS : [f]));
}

// A service's scoring is "stale" when it weights a field that's no longer an
// enabled scoreable prescription field (the lab disabled/removed it).
export function staleScoringFields(service: string, scoring: ScoringConfig, prescription: PrescriptionConfig): string[] {
  const weighted = (scoring[service] ?? []).filter(f => f.weight > 0);
  if (weighted.length === 0) return [];
  const ok = new Set(scoreableFieldsFor(service, prescription).map(f => f.id));
  return weighted.filter(f => !ok.has(f.id)).map(f => f.id);
}

export function isServiceScoringStale(service: string, scoring: ScoringConfig, prescription: PrescriptionConfig): boolean {
  return staleScoringFields(service, scoring, prescription).length > 0;
}
