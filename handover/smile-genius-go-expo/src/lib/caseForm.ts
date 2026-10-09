// ─── Create-case form model (shared by Manually, By audio and By photo) ─────
// Pure logic: the form shape, what each service still needs, per-service /
// per-stage / per-phase delivery dates, and turning a form into a LabCase.
import { ME } from '../store/store';
import {
  CLINICIANS, DetailField, LabCase, PracticeId, RxItem, STAGE_NAMES, StageLine, StagedKind, clinicianName, detailFields, fmtDate,
  getCategoryForItem, needsMaterial, nowIso, phaseName, serviceLabel, soonestDate,
} from '../data/data';
// ─── Shared form model (also used by photo / audio capture) ─────────────────

export interface FormItem {
  uid: string;
  itemId: string;                 // web catalogue id, e.g. 'su-crown', 'br-pontic'
  teeth: string[];
  sameForAll: boolean;            // web: "Same material & shade for all teeth"
  material: string | null;
  shade: string | null;
  perTooth: Record<string, { material?: string | null; shade?: string | null }>;
  details: Record<string, string | string[]>;
  /** Delivery date for this service (yyyy-mm-dd). Not used by staged services. */
  returnBy: string;
  /** Denture: date per selected stage (yyyy-mm-dd), keyed by stage name. */
  stageDates: Record<string, string>;
  /** Clear aligners with phasing: one date per phase (Phase 1, Phase 2 …). */
  phases: string[];
}
export interface CaseForm {
  practice: PracticeId | null;
  clinician: string | null;
  patientId: string | null;
  lab: string | null;
  funding: 'NHS' | 'Private' | null;   // null = not set yet (e.g. not heard in a voice note)
  /** Legacy case-level date (older drafts). Dates now live on each service. */
  returnBy: string;
  apptDate: string;           // Patient appointment (date only, optional)
  apptKind: 'Fit' | 'Try-in' | 'Issue';
  caseSource: string | null;
  instructions: string;
  attachments: string[];
  items: FormItem[];
}

export const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let uidSeq = 0;
export const newItem = (itemId: string, patch: Partial<FormItem> = {}): FormItem =>
  ({ uid: `it-${Date.now().toString(36)}-${++uidSeq}`, itemId, teeth: [], sameForAll: true, material: null, shade: null, perTooth: {}, details: {},
    returnBy: '', stageDates: {}, phases: [''], ...patch });
/** Older drafts / reads may lack the per-service date fields; the old case date fills a service's date. */
export const normItem = (it: FormItem, caseDate = ''): FormItem => ({ ...it, stageDates: it.stageDates ?? {}, phases: it.phases ?? [''], returnBy: it.returnBy ?? caseDate });
export const normForm = (f: CaseForm): CaseForm => ({ ...f, items: f.items.map(it => normItem(it, f.returnBy)) });

// ─── Staged services (denture stages, aligner phases) ───────────────────────
const isoDay = (d: string) => (d ? new Date(`${d}T12:00`).toISOString() : '');
export const todayDay = () => new Date().toISOString().slice(0, 10);
export const itemStaged = (it: FormItem): StagedKind | undefined =>
  getCategoryForItem(it.itemId) === 'denture' ? 'stage' : it.itemId === 'or-clear-aligners' && it.details.phasing === 'Yes' ? 'phase' : undefined;
export const chosenStages = (it: FormItem) => STAGE_NAMES.filter(n => ([] as string[]).concat(it.details.stages ?? []).includes(n));
/** The service's stages / phases as case data. A stage dated before today was done earlier (outside Smile Genius). */
export function itemStageLines(it: FormItem): StageLine[] {
  const kind = itemStaged(it);
  if (kind === 'stage') return chosenStages(it).map(n => {
    const d = it.stageDates[n] ?? '';
    return { name: n, date: isoDay(d), ...(d && d < todayDay() ? { state: 'done-earlier' as const } : {}) };
  });
  if (kind === 'phase') return it.phases.map((d, i) => ({ name: phaseName(i + 1), date: isoDay(d) }));
  return [];
}
const shortDay = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** One line for the service card / review: "Delivery Tue 22 Oct" or "Bite Registration 22 Oct · Try In 29 Oct". */
export function itemDateSummary(it: FormItem): string {
  const kind = itemStaged(it);
  if (kind === 'stage') {
    const st = chosenStages(it);
    if (!st.length) return 'Choose the stages';
    return st.map(n => (it.stageDates[n] ? `${n} ${shortDay(it.stageDates[n])}` : `${n} · no date`)).join(' · ');
  }
  if (kind === 'phase') return it.phases.map((d, i) => `${phaseName(i + 1)} ${d ? shortDay(d) : '· no date'}`).join(' · ');
  return it.returnBy ? `Delivery ${fmtDate(isoDay(it.returnBy))}` : 'No delivery date yet';
}
/** Soonest date on the form (any service / stage still to come) — for the appointment check. */
export const formSoonest = (f: CaseForm) => f.items.flatMap(it => {
  const k = itemStaged(it);
  return k === 'stage' ? chosenStages(it).map(n => it.stageDates[n]).filter(d => d && d >= todayDay()) : k === 'phase' ? it.phases : [it.returnBy];
}).filter(Boolean).sort()[0] ?? '';

export const emptyForm = (): CaseForm => ({
  practice: 'cds', clinician: 'reed', patientId: null, lab: null, funding: 'NHS', returnBy: '',
  apptDate: '', apptKind: 'Fit', caseSource: null, instructions: '', attachments: [], items: [],
});

const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null);
/** What's still needed for this service — same completeness rules as the web form. */
export function itemMissing(it: FormItem): string[] {
  const miss: string[] = [];
  if (!it.teeth.length) miss.push('teeth');
  if (needsMaterial(it.itemId)) {
    if (it.sameForAll) {
      if (!filled(it.material)) miss.push('material');
      if (!filled(it.shade)) miss.push('shade');
    } else if (it.teeth.some(t => !filled(it.perTooth[t]?.material ?? it.material) || !filled(it.perTooth[t]?.shade ?? it.shade))) {
      miss.push('material and shade for each tooth');
    }
  }
  for (const f of detailFields(it.itemId)) if (f.required && !filled(it.details[f.key])) miss.push(f.label.toLowerCase());
  return miss;
}
export const itemComplete = (it: FormItem) => itemMissing(it).length === 0;
/** Display name; "Other" uses the typed service name. */
export const itemName = (it: FormItem) =>
  (it.itemId === 'ot-other' && typeof it.details.customServiceName === 'string' && it.details.customServiceName.trim()) || serviceLabel(it.itemId);
/** Short summary like the web chip: shade · material · extras. */
export function itemSummary(it: FormItem): string {
  const parts: string[] = [];
  if (needsMaterial(it.itemId)) {
    if (it.sameForAll) { if (it.shade) parts.push(it.shade); if (it.material) parts.push(it.material); }
    else parts.push('Per-tooth material and shade');
  }
  for (const f of detailFields(it.itemId)) {
    const v = it.details[f.key];
    if (f.kind === 'textarea' || f.key === 'customServiceName' || !filled(v)) continue;
    parts.push(Array.isArray(v) ? v.join(', ') : f.kind === 'occlusion' ? `${f.label} ${v}` : String(v));
  }
  return parts.join(' · ');
}

export function buildCase(f: CaseForm, source: LabCase['source']): LabCase {
  const toRx = (it: FormItem): RxItem => ({
    ...(itemStaged(it) ? { staged: itemStaged(it), stages: itemStageLines(it) } : { returnBy: isoDay(it.returnBy) || undefined }),
    service: itemName(it), teeth: it.teeth,
    material: needsMaterial(it.itemId) ? (it.sameForAll ? it.material ?? '' : 'Per tooth') : '',
    shade: needsMaterial(it.itemId) && it.sameForAll ? it.shade ?? undefined : undefined,
    extra: detailFields(it.itemId).filter(d => d.kind !== 'textarea' && d.key !== 'customServiceName' && filled(it.details[d.key]))
      .map(d => `${d.label}: ${([] as string[]).concat(it.details[d.key] as string | string[]).join(', ')}`).join(' · ') || undefined,
  });
  // Services are optional — a case can go with just patient, dentist and lab
  const rx = f.items.map(toRx);
  const [first = { service: 'Lab work', teeth: [], material: '' } as RxItem, ...rest] = rx;
  const ret = soonestDate(rx);
  return {
    firstReturnBy: first.returnBy, firstStaged: first.staged, firstStages: first.stages,
    id: `SG-${28510 + Math.floor(Math.random() * 400)}`,
    patientId: f.patientId!, practice: f.practice!, lab: f.lab!, clinician: f.clinician!, createdBy: ME.name,
    service: first.service, teeth: first.teeth, material: first.material, shade: first.shade, extra: first.extra,
    items: rest.length ? rest : undefined,
    funding: f.funding ?? 'NHS', instructions: f.instructions || 'No extra instructions.', returnBy: ret, stage: 'ready',
    attachments: f.attachments, source, caseSource: f.caseSource ?? undefined,
    events: [{ stage: 'authorised', at: nowIso(), by: clinicianName(f.clinician!) }], messages: [],
    appointment: f.apptDate ? { at: new Date(`${f.apptDate}T09:00`).toISOString(), kind: f.apptKind, room: 'Surgery 1' } : undefined,
  };
}

/** A saved-but-not-submitted case: summary fields for the list + the full form to reopen. */
export function buildDraft(f: CaseForm, id?: string): LabCase {
  const first = f.items[0];
  return {
    id: id ?? `SG-D${1100 + Math.floor(Math.random() * 800)}`,
    patientId: f.patientId!, practice: f.practice ?? 'cds', lab: f.lab ?? '', clinician: f.clinician ?? '', createdBy: ME.name,
    service: first ? itemName(first) : 'New case', teeth: first?.teeth ?? [], material: first?.material ?? '',
    items: f.items.slice(1).map(it => ({ service: itemName(it), teeth: it.teeth, material: it.material ?? '' })),
    funding: f.funding ?? 'NHS', instructions: f.instructions, returnBy: formSoonest(f) ? isoDay(formSoonest(f)) : '',
    stage: 'draft', attachments: f.attachments, events: [], messages: [], source: 'manual', createdAt: new Date().toISOString(),
    appointment: f.apptDate ? { at: new Date(`${f.apptDate}T09:00`).toISOString(), kind: f.apptKind, room: 'Surgery 1' } : undefined,
    draftForm: f,
  };
}

