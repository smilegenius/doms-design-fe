// ─── Case scoring ───────────────────────────────────────────────────────────
// A lab assigns a WEIGHT to each prescription field, per service type. A case's
// score is a *completeness* measure: it earns a field's weight whenever that
// field is actually filled in on the case. The score is the earned weight as a
// percentage of the service's total configured weight.
//
//   score% = (Σ weight of filled fields) ÷ (Σ weight of all configured fields)
//
// The config lives in CaseScoringContext (editable in the Lab portal's
// Configuration page) and is read wherever cases are listed — so both the
// clinic and the lab see the same score. A service type with NO configured
// fields yields "No score applicable".
import type { Case } from '../pages/CasesPage';
import type { ServiceItem } from '../pages/CaseDetailPage';

// ── The master list of fields a lab can put weight on ────────────────────────
// Each def knows how to detect whether the field is "filled" on a given case
// service. Only fields that actually exist on persisted case data are listed,
// so the score reflects what the clinic genuinely submitted.
export interface ScoreFieldDef {
  id: string;
  label: string;
  hint: string;
  /** True when this field is considered "provided" for the given service. */
  isFilled: (si: ServiceItem, c: Case) => boolean;
}

export const SCORE_FIELD_DEFS: ScoreFieldDef[] = [
  { id: 'teeth',        label: 'Teeth selected',      hint: 'At least one tooth marked on the chart', isFilled: (si) => (si.fdi?.length ?? 0) > 0 },
  { id: 'material',     label: 'Material',            hint: 'Restoration material chosen',            isFilled: (si) => !!si.material },
  { id: 'shade',        label: 'Shade',               hint: 'Tooth shade specified',                  isFilled: (si) => !!si.shade },
  { id: 'scans',        label: '3D scan files',       hint: 'Intra-oral scan files attached',         isFilled: (si) => (si.scanFileCount ?? 0) > 0 },
  { id: 'attachments',  label: 'Photos / attachments', hint: 'Supporting photos or files attached',   isFilled: (si) => (si.attachmentCount ?? 0) > 0 },
  { id: 'instructions', label: 'Lab instructions',    hint: 'Written instructions for the lab',       isFilled: (si) => !!(si.instructions && si.instructions.trim()) },
  { id: 'delivery',     label: 'Requested delivery',  hint: 'A delivery date was requested',          isFilled: (si, c) => !!si.deliveryDate || !!c.requestedDelivery },
  { id: 'orderType',    label: 'Order type',          hint: 'NHS / Private marked',                   isFilled: (si) => !!si.orderType },
  { id: 'stages',       label: 'Stages',              hint: 'Lab stages selected (dentures)',         isFilled: (si) => (si.stages?.length ?? 0) > 0 },
];

export const SCORE_FIELD_DEF_MAP: Record<string, ScoreFieldDef> =
  Object.fromEntries(SCORE_FIELD_DEFS.map(d => [d.id, d]));

// ── A configured field: a def id + the weight the lab assigned it ────────────
export interface ScoreField {
  id: string;       // matches a ScoreFieldDef id
  label: string;    // cached label (kept in sync with the def)
  weight: number;
}

// Config keyed by service-type name (matches the names on Case.serviceItems).
export type ScoringConfig = Record<string, ScoreField[]>;

// Services grouped by category — mirrors the case-creation form so the config
// reads the same way. The flat SCOREABLE_SERVICE_TYPES is derived from it.
export interface ServiceGroup { category: string; services: string[]; }
export const SERVICE_GROUPS: ServiceGroup[] = [
  { category: 'Single Unit',  services: ['Crown', 'Veneers', 'Inlay/Onlay', 'Implant Abutment', 'Post & Core Crown', 'Screw-Retained Crown'] },
  { category: 'Bridge',       services: ['Bridge'] },
  { category: 'Orthodontics', services: ['Clear Aligners', 'Retainer'] },
  { category: 'Denture',      services: ['Full Denture', 'Partial Denture', 'Immediate Denture'] },
  { category: 'Appliances',   services: ['Night Guard', 'Whitening Tray', 'Splint'] },
  { category: 'Others',       services: ['Other'] },
];
export const SCOREABLE_SERVICE_TYPES: string[] = SERVICE_GROUPS.flatMap(g => g.services);

const f = (id: string, weight: number): ScoreField => ({
  id, label: SCORE_FIELD_DEF_MAP[id]?.label ?? id, weight,
});

// Default seed. Some services are intentionally LEFT OUT (Night Guard,
// Retainer) so those cases demonstrate the "No score applicable" fallback
// until the lab configures them.
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  'Crown':          [f('teeth', 20), f('material', 20), f('shade', 20), f('scans', 25), f('instructions', 15)],
  'Veneers':        [f('teeth', 15), f('material', 20), f('shade', 30), f('scans', 20), f('instructions', 15)],
  'Bridge':         [f('teeth', 20), f('material', 25), f('shade', 20), f('scans', 20), f('instructions', 15)],
  'Clear Aligners': [f('teeth', 20), f('scans', 30), f('instructions', 20), f('delivery', 15), f('attachments', 15)],
  'Full Denture':   [f('teeth', 15), f('material', 20), f('shade', 20), f('stages', 30), f('instructions', 15)],
  'Partial Denture':[f('teeth', 15), f('material', 20), f('shade', 20), f('stages', 30), f('instructions', 15)],
  // 'Night Guard' and 'Retainer' deliberately unconfigured → "No score applicable".
};

// ── Score bands & thresholds ─────────────────────────────────────────────────
// The lab decides where the cut-offs sit. Three tiers — Incomplete / Need
// Attention / Complete — each with an upper % bound and an on/off switch. A
// score lands in the first enabled tier whose `upTo` it doesn't exceed; a
// disabled tier merges its range into the next enabled tier above it.
export type ScoreBand = 'red' | 'amber' | 'green';
export type ScoreTierId = 'incomplete' | 'attention' | 'complete';

export interface ScoreThreshold {
  id: ScoreTierId;
  label: string;
  enabled: boolean;
  upTo: number;        // inclusive upper bound (the 'complete' tier is fixed at 100)
}

// Each tier maps to a RAG colour for the pills.
export const TIER_BAND: Record<ScoreTierId, ScoreBand> = {
  incomplete: 'red',
  attention: 'amber',
  complete: 'green',
};

export const DEFAULT_THRESHOLDS: ScoreThreshold[] = [
  { id: 'incomplete', label: 'Incomplete',     enabled: true, upTo: 49 },
  { id: 'attention',  label: 'Need Attention', enabled: true, upTo: 79 },
  { id: 'complete',   label: 'Complete',       enabled: true, upTo: 100 },
];

export interface ResolvedTier { id: ScoreTierId; label: string; band: ScoreBand; }

// Which tier a percentage falls into, honouring enable/disable + cut-offs.
export function resolveTier(percent: number, thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS): ResolvedTier {
  const enabled = thresholds.filter(t => t.enabled).sort((a, b) => a.upTo - b.upTo);
  if (enabled.length === 0) return { id: 'complete', label: 'Complete', band: 'green' };
  for (const t of enabled) {
    if (percent <= t.upTo) return { id: t.id, label: t.label, band: TIER_BAND[t.id] };
  }
  const last = enabled[enabled.length - 1];
  return { id: last.id, label: last.label, band: TIER_BAND[last.id] };
}

// Legacy default-threshold helper (kept for callers that don't pass config).
export function scoreBand(percent: number): ScoreBand {
  return resolveTier(percent, DEFAULT_THRESHOLDS).band;
}

export interface ScoredField {
  id: string;
  label: string;
  weight: number;
  filled: boolean;
}

export interface ScoredService {
  serviceName: string;
  configured: boolean;     // does this service type have a scoring config?
  earned: number;
  total: number;
  fields: ScoredField[];
}

export interface CaseScore {
  applicable: boolean;     // false when no service on the case has a config
  /** Scoring exists but is out of sync with the Prescription Builder — the lab
      disabled/removed a weighted field, so the score can't be trusted yet. */
  unavailable: boolean;
  percent: number;         // 0–100 (0 when not applicable)
  earned: number;
  total: number;
  band: ScoreBand;
  tier: ScoreTierId;       // which configured tier the score falls into
  tierLabel: string;       // the tier's label, e.g. "Need Attention"
  services: ScoredService[];
}

// Compute a case's completeness score against a scoring config. Aggregates
// across every service item that has a configured service type. The optional
// thresholds decide which tier (and colour) the resulting % falls into. When a
// `staleServices` predicate is supplied, a contributing service flagged stale
// makes the whole score "unavailable".
export function computeCaseScore(
  c: Case,
  config: ScoringConfig,
  thresholds: ScoreThreshold[] = DEFAULT_THRESHOLDS,
  isStale?: (service: string) => boolean,
): CaseScore {
  const services: ScoredService[] = [];
  let earned = 0;
  let total = 0;

  for (const si of c.serviceItems ?? []) {
    const fields = config[si.name];
    if (!fields || fields.length === 0) {
      services.push({ serviceName: si.name, configured: false, earned: 0, total: 0, fields: [] });
      continue;
    }
    const scored: ScoredField[] = fields.map(fld => {
      const def = SCORE_FIELD_DEF_MAP[fld.id];
      const filled = def ? def.isFilled(si, c) : false;
      return { id: fld.id, label: fld.label, weight: fld.weight, filled };
    });
    const svcEarned = scored.reduce((s, x) => s + (x.filled ? x.weight : 0), 0);
    const svcTotal  = scored.reduce((s, x) => s + x.weight, 0);
    earned += svcEarned;
    total  += svcTotal;
    services.push({ serviceName: si.name, configured: true, earned: svcEarned, total: svcTotal, fields: scored });
  }

  const applicable = total > 0;
  const percent = applicable ? Math.round((earned / total) * 100) : 0;
  const tier = resolveTier(percent, thresholds);
  // Out of sync if any service that contributes a score is flagged stale.
  const unavailable = applicable && !!isStale && (c.serviceItems ?? []).some(si =>
    (config[si.name]?.some(f => f.weight > 0) ?? false) && isStale(si.name),
  );
  return { applicable, unavailable, percent, earned, total, band: tier.band, tier: tier.id, tierLabel: tier.label, services };
}
