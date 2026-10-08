import { useSyncExternalStore } from 'react';
import type { Case, CaseStatus } from '../pages/CasesPage';
import { DEMO_TODAY, formatCaseDate, parseCaseDate } from './rescanDetection';

// ─── Denture stages & follow-up prescriptions (Oct-2026 round) ───────────────
// One denture treatment, several prescriptions over time, every stage under a
// single case. The rules this module carries:
//   • Delivery dates live on the SERVICE for every non-denture service, and on
//     each STAGE for a denture — a denture service has no date of its own.
//   • A follow-up prescription (same patient / practice / dentist / denture
//     service) is appended to the existing case as a new stage order; stages
//     already ordered are never duplicated.
//   • No matching case → a new case is created. Stages dated before the case
//     reached DOMS are shown as "Done earlier" rather than as open work.

/** Fabrication stages of a denture, in the order they happen. */
export const DENTURE_STAGES = ['Special Tray', 'Bite Registration', 'Try In', 'Retry', 'Finish'];

/** Service names (case data) and catalogue ids (creation form) that are dentures. */
export const DENTURE_SERVICES = ['Full Denture', 'Partial Denture', 'Immediate Denture'];
const DENTURE_ITEM_IDS = ['de-partial-denture', 'de-full-denture', 'de-immediate-denture'];

export const isDentureService = (name: string) => DENTURE_SERVICES.includes(name);
export const isDentureItem = (itemId: string) => DENTURE_ITEM_IDS.includes(itemId);

/** Catalogue order for a set of stage names (unknown names keep their place at the end). */
export function sortStages(stages: string[]): string[] {
  const rank = (s: string) => { const i = DENTURE_STAGES.indexOf(s); return i < 0 ? 99 : i; };
  return [...stages].sort((a, b) => rank(a) - rank(b));
}

// ── Dates ─────────────────────────────────────────────────────────────────────
// Form inputs hold ISO (yyyy-mm-dd); case data holds "DD-MMM-YYYY". "Today" is
// the demo clock the Cases list and case creation already stamp with.

export const TODAY_ISO = isoOf(DEMO_TODAY);

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoToCaseDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return formatCaseDate(new Date(y, m - 1, d));
}

export function caseDateToISO(date: string): string {
  return isoOf(parseCaseDate(date));
}

/** A picked date that is before today — the stage was done before this prescription. */
export const isPastISO = (iso: string | undefined | null) => !!iso && iso < TODAY_ISO;

/** A stage dated before its case reached DOMS — it happened outside the system. */
export function isDoneEarlier(stageDate: string | null | undefined, caseCreatedAt: string): boolean {
  if (!stageDate) return false;
  return parseCaseDate(stageDate) < parseCaseDate(caseCreatedAt);
}

// ── Stage orders as stored on a service ──────────────────────────────────────
// Structural so this module doesn't depend on CaseDetailPage's types.
export interface StageOrderLike {
  id: string;
  stages: string[];
  status: CaseStatus;
  deliveryDate: string | null;
  createdAt: string;
  /** Requested delivery per stage ("DD-MMM-YYYY"). */
  stageDates?: Record<string, string | null>;
  /** Per-stage status when the stages of one order have moved apart. */
  stageStatuses?: Record<string, CaseStatus>;
  /** Set when the order arrived as a follow-up prescription. */
  followUpFrom?: string;
}

export interface StagedServiceLike {
  name: string;
  status: CaseStatus;
  deliveryDate: string | null;
  stages?: string[];
  stageDates?: Record<string, string | null>;
  stageOrders?: StageOrderLike[];
}

/**
 * The stage orders of a denture service: what the case carries (or one
 * "Initial" order built from its stages), then every appended follow-up.
 * Generated mock cases carry neither, so they fall back to the catalogue
 * minus its last stage — leaving one to demo "New Stage Order".
 */
export function stageOrdersFor(caseId: string, createdAt: string, service: StagedServiceLike): StageOrderLike[] {
  let base: StageOrderLike[];
  if (service.stageOrders?.length) {
    base = service.stageOrders;
  } else {
    const stages = service.stages?.length
      ? sortStages(service.stages)
      : DENTURE_STAGES.slice(0, DENTURE_STAGES.length - 1);
    base = [{
      id: 'so-1',
      stages,
      status: service.status,
      deliveryDate: service.deliveryDate,
      createdAt,
      stageDates: service.stageDates ?? Object.fromEntries(stages.map(s => [s, service.deliveryDate])),
    }];
  }
  const appended = getStageAppends(caseId, service.name).map((a, i): StageOrderLike => ({
    id: `so-fu-${i + 1}`,
    stages: a.stages,
    status: 'submitted',
    deliveryDate: firstDate(a.stages, a.stageDates),
    createdAt: a.createdAt,
    stageDates: a.stageDates,
    followUpFrom: a.fromId,
  }));
  return [...base, ...appended];
}

function firstDate(stages: string[], dates: Record<string, string | null>): string | null {
  for (const s of stages) if (dates[s]) return dates[s];
  return null;
}

export interface StageRow {
  stage: string;
  date: string | null;
  status: CaseStatus;
  /** Index of the stage order it belongs to (0 = Initial). */
  orderIndex: number;
  doneEarlier: boolean;
  followUp: boolean;
}

/** One row per ordered stage, in catalogue order — the shape the list + case page show. */
export function stageRowsFor(caseId: string, createdAt: string, service: StagedServiceLike): StageRow[] {
  return stageRowsFromOrders(stageOrdersFor(caseId, createdAt, service), createdAt);
}

/** Same rows, from orders already in hand (e.g. the case page's live state). */
export function stageRowsFromOrders(orders: StageOrderLike[], createdAt: string): StageRow[] {
  const rows: StageRow[] = [];
  orders.forEach((o, orderIndex) => {
    for (const stage of o.stages) {
      const date = o.stageDates?.[stage] ?? o.deliveryDate ?? null;
      rows.push({
        stage,
        date,
        status: o.stageStatuses?.[stage] ?? o.status,
        orderIndex,
        doneEarlier: isDoneEarlier(date, createdAt),
        followUp: !!o.followUpFrom,
      });
    }
  });
  const rank = (s: string) => { const i = DENTURE_STAGES.indexOf(s); return i < 0 ? 99 : i; };
  return rows.sort((a, b) => rank(a.stage) - rank(b.stage));
}

// ── Follow-up appends (localStorage) ─────────────────────────────────────────
// A follow-up prescription doesn't create a case — it adds a stage order to the
// existing one. Kept like the other prototype records so it survives a refresh.

export interface StageAppend {
  caseId: string;
  serviceName: string;
  stages: string[];
  stageDates: Record<string, string | null>;
  createdAt: string;
  /** The draft / prescription it came from. */
  fromId: string;
  by: string;
}

const LS_KEY = 'denture.stageAppends';

function load(): StageAppend[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as StageAppend[];
    }
  } catch { /* corrupt — start empty */ }
  return [];
}

let appends: StageAppend[] = load();
const listeners = new Set<() => void>();

function commit(next: StageAppend[]) {
  appends = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getStageAppends(caseId: string, serviceName?: string): StageAppend[] {
  return appends.filter(a => a.caseId === caseId && (!serviceName || a.serviceName === serviceName));
}

export function addStageAppend(a: StageAppend) {
  commit([...appends, a]);
}

/** Walkthrough "Reset demo data" — forget every appended follow-up. */
export function resetStageAppends() {
  commit([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Re-render when a follow-up is appended anywhere. */
export function useStageAppends(): StageAppend[] {
  return useSyncExternalStore(subscribe, () => appends);
}

// ── Matching a follow-up prescription to an existing case ────────────────────
// Same practice, patient, dentist and denture service. Stage and delivery date
// are allowed to differ — that's the whole point of a follow-up.

export interface FollowUpSubject {
  patientName: string;
  practice: string;
  dentist: string;
  serviceName: string;
}

export interface FollowUpMatch {
  case: Case;
  serviceName: string;
  /** Stages already on the case, in catalogue order. */
  existing: StageRow[];
  /** Incoming stages that will be added. */
  toAdd: string[];
  /** Incoming stages the case already has — skipped, never duplicated. */
  duplicates: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/^dr\.?\s+/, '');

export function findFollowUpMatch(subject: FollowUpSubject, incomingStages: string[], cases: Case[]): FollowUpMatch | null {
  if (!isDentureService(subject.serviceName) || !subject.patientName.trim()) return null;
  const hit = cases.find(c =>
    c.status !== 'draft' && !c.archived &&
    norm(c.patientName) === norm(subject.patientName) &&
    norm(c.practice) === norm(subject.practice) &&
    norm(c.dentist) === norm(subject.dentist) &&
    c.serviceItems.some(si => si.name === subject.serviceName),
  );
  if (!hit) return null;
  const service = hit.serviceItems.find(si => si.name === subject.serviceName)!;
  const existing = stageRowsFor(hit.id, hit.createdAt, service);
  const have = new Set(existing.map(r => r.stage));
  return {
    case: hit,
    serviceName: subject.serviceName,
    existing,
    toAdd: sortStages(incomingStages.filter(s => !have.has(s))),
    duplicates: sortStages(incomingStages.filter(s => have.has(s))),
  };
}

/** The stage the work is heading to next — first one not done or delivered. */
export function nextStageRow(rows: StageRow[]): StageRow | null {
  const closed: CaseStatus[] = ['completed', 'delivered'];
  return rows.find(r => !r.doneEarlier && !closed.includes(r.status)) ?? rows[rows.length - 1] ?? null;
}
