import { useSyncExternalStore } from 'react';
import type { Case } from '../../../src/app/pages/CasesPage';
import { addCreatedCase, getCreatedCases } from '../../../src/app/data/createdCases';
import { MOCK_NOTIFICATIONS } from '../../../src/app/pages/NotificationsPage';
import {
  Capture, DEMO_CASE_IDS, DesignFile, DesignKind, DesignProvider, DesignVersion, LAB_MEMBERS, ModelParams, ReviewLink,
  seedStudioCases, STUDIO_SERVICES, StudioCase, studioDate, studioDateTime,
} from '../data/designStudio';

// ── Design Studio store ──────────────────────────────────────────────────────
// Same pattern as src/app/data/createdCases.ts (module store, useSyncExternalStore,
// localStorage). The dentist's review page and the lab portal run in separate
// tabs on the same origin, so a `storage` listener keeps them in step: the
// lab's link card goes "Opened" the moment the dentist opens the link.

interface StudioState { cases: Record<string, StudioCase> }

const LS_KEY = 'salesFeedbacks.designStudio.v1';

function load(): StudioState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed?.cases) return parsed; }
  } catch { /* corrupt or blocked: reseed */ }
  return { cases: seedStudioCases() };
}

let state: StudioState = load();
const listeners = new Set<() => void>();

function commit(next: StudioState) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage full or blocked: keep in memory */ }
  listeners.forEach(l => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== LS_KEY) return;
    state = load();
    listeners.forEach(l => l());
  });
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useStudio(): StudioState { return useSyncExternalStore(subscribe, () => state); }
export function getStudio(): StudioState { return state; }

function updateCase(caseId: string, fn: (c: StudioCase) => StudioCase) {
  const c = state.cases[caseId];
  if (!c) return;
  commit({ cases: { ...state.cases, [caseId]: fn(c) } });
}
function updateVersion(versionId: string, fn: (v: DesignVersion) => DesignVersion) {
  const c = Object.values(state.cases).find(x => x.versions.some(v => v.id === versionId));
  if (!c) return;
  updateCase(c.caseId, x => ({ ...x, versions: x.versions.map(v => (v.id === versionId ? fn(v) : v)) }));
}

// ── Lookups ───────────────────────────────────────────────────────────────────
export function resolveLink(token: string) {
  for (const c of Object.values(state.cases)) {
    const link = c.links.find(l => l.token === token);
    if (link) {
      const version = c.versions.find(v => v.id === link.versionId)!;
      const previous = c.versions.find(v => v.number === version.number - 1);
      return { studioCase: c, link, version, previous };
    }
  }
  return null;
}
export const isExpired = (link: ReviewLink) => new Date(link.expiresAt).getTime() < Date.now();
export const latestVersion = (c: StudioCase): DesignVersion | undefined => [...c.versions].sort((a, b) => b.number - a.number)[0];
export const linkForVersion = (c: StudioCase, versionId: string) => c.links.find(l => l.versionId === versionId);

/** Points from the previous version the dentist still has to confirm. */
export function unresolvedCarryForward(version: DesignVersion, previous?: DesignVersion) {
  if (!previous) return [];
  return previous.captures.filter(cap => !version.carryForward?.[cap.id]);
}

// ── Dentist actions ───────────────────────────────────────────────────────────
export function markOpened(token: string) {
  const r = resolveLink(token);
  if (!r || r.link.openedAt) return;
  updateCase(r.studioCase.caseId, c => ({ ...c, links: c.links.map(l => (l.token === token ? { ...l, openedAt: new Date().toISOString() } : l)) }));
}

export function confirmIdentity(token: string, name: string) {
  const r = resolveLink(token);
  if (!r) return;
  const now = new Date().toISOString();
  updateCase(r.studioCase.caseId, c => ({
    ...c,
    links: c.links.map(l => (l.token === token ? { ...l, confirmedName: name, confirmedAt: now, openedAt: l.openedAt ?? now } : l)),
  }));
}

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export function addCapture(versionId: string, partial: Omit<Capture, 'id' | 'versionId' | 'index' | 'createdAt' | 'status' | 'strokes' | 'comment' | 'teeth' | 'mentions'> & Partial<Capture>): string {
  const id = uid('cap');
  updateVersion(versionId, v => ({
    ...v,
    captures: [...v.captures, {
      strokes: [], comment: '', teeth: [], mentions: [], status: 'open',
      ...partial, id, versionId, index: v.captures.length + 1, createdAt: new Date().toISOString(),
    } as Capture],
  }));
  return id;
}

export function updateCapture(versionId: string, captureId: string, patch: Partial<Capture>) {
  updateVersion(versionId, v => ({ ...v, captures: v.captures.map(c => (c.id === captureId ? { ...c, ...patch } : c)) }));
}

export function removeCapture(versionId: string, captureId: string) {
  updateVersion(versionId, v => ({
    ...v,
    captures: v.captures.filter(c => c.id !== captureId).map((c, i) => ({ ...c, index: i + 1 })),
  }));
}

/** Compare mode: confirm a carried-forward point, or re-open it as a fresh capture quoting the old comment. */
export function resolveCarryForward(version: DesignVersion, previousCapture: Capture, verdict: 'confirmed' | 'reopened') {
  updateVersion(version.id, v => ({ ...v, carryForward: { ...v.carryForward, [previousCapture.id]: verdict } }));
  if (verdict === 'reopened') {
    return addCapture(version.id, {
      thumbnailLabel: previousCapture.thumbnailLabel,
      camera: previousCapture.camera,
      stage: previousCapture.stage,
      teeth: previousCapture.teeth,
      comment: `Still not right (V${version.number - 1}, Capture ${previousCapture.index}): “${previousCapture.comment}”\n\n`,
      carriedFrom: previousCapture.id,
    });
  }
  return undefined;
}

export function undoCarryForward(version: DesignVersion, previousCaptureId: string) {
  updateVersion(version.id, v => {
    const next = { ...v.carryForward };
    delete next[previousCaptureId];
    return { ...v, carryForward: next, captures: v.captures.filter(c => c.carriedFrom !== previousCaptureId).map((c, i) => ({ ...c, index: i + 1 })) };
  });
}

function hashVersion(v: DesignVersion): string {
  // FNV-1a over the reviewed content: deterministic, so the record pins exactly what was signed.
  const files = (list?: DesignFile[]) => (list ?? []).map(f => [f.id, f.name, f.size]);
  const text = JSON.stringify({ id: v.id, url: v.sourceUrl, model: v.model, files: files(v.files), review: files(v.reviewAttachments), captures: v.captures.map(c => [c.id, c.comment, c.teeth, c.strokes.length, files(c.attachments)]) });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `fnv1a:${h.toString(16).padStart(8, '0')}`;
}

export function submitReview(token: string, decision: 'approved' | 'changes-requested', note: string) {
  const r = resolveLink(token);
  if (!r) return;
  const now = new Date().toISOString();
  const name = r.link.confirmedName ?? r.link.recipientName;
  updateCase(r.studioCase.caseId, c => ({
    ...c,
    links: c.links.map(l => (l.token === token ? { ...l, submittedAt: now } : l)),
    versions: c.versions.map(v => (v.id === r.version.id
      ? {
          ...v,
          status: decision,
          decision,
          decisionNote: note || undefined,
          reviewedBy: name,
          reviewedAt: now,
          signOff: { name, at: now, versionId: v.id, versionHash: hashVersion(v), decision },
        }
      : v)),
  }));
  syncPortalCase(r.studioCase.caseId);
}

/** Dentist attachments: per capture, or for the review as a whole. Blocked once submitted. */
function editable(versionId: string) {
  const c = Object.values(state.cases).find(x => x.versions.some(v => v.id === versionId));
  const link = c?.links.find(l => l.versionId === versionId);
  return !link?.submittedAt;
}
export function attachToCapture(versionId: string, captureId: string, files: DesignFile[]) {
  if (!editable(versionId)) return;
  updateVersion(versionId, v => ({ ...v, captures: v.captures.map(c => (c.id === captureId ? { ...c, attachments: [...(c.attachments ?? []), ...files] } : c)) }));
}
export function removeCaptureAttachment(versionId: string, captureId: string, fileId: string) {
  if (!editable(versionId)) return;
  updateVersion(versionId, v => ({ ...v, captures: v.captures.map(c => (c.id === captureId ? { ...c, attachments: (c.attachments ?? []).filter(f => f.id !== fileId) } : c)) }));
}
export function addReviewAttachment(versionId: string, files: DesignFile[]) {
  if (!editable(versionId)) return;
  updateVersion(versionId, v => ({ ...v, reviewAttachments: [...(v.reviewAttachments ?? []), ...files] }));
}
export function removeReviewAttachment(versionId: string, fileId: string) {
  if (!editable(versionId)) return;
  updateVersion(versionId, v => ({ ...v, reviewAttachments: (v.reviewAttachments ?? []).filter(f => f.id !== fileId) }));
}

/** Everything the dentist attached to a version (review-level + per capture). */
export function clinicianFiles(v: DesignVersion): DesignFile[] {
  return [...(v.reviewAttachments ?? []), ...v.captures.flatMap(c => c.attachments ?? [])];
}
const clinicianFileCount = (v: DesignVersion) => clinicianFiles(v).length;

/** First share on a real case: create its (empty) Design Studio record from the portal case. */
export function ensureStudioCase(pc: Case): StudioCase {
  const existing = state.cases[pc.id];
  if (existing) return existing;
  const item = pc.serviceItems.find(si => STUDIO_SERVICES.includes(si.name)) ?? pc.serviceItems[0];
  const service = item?.name ?? pc.services[0] ?? 'Crown';
  const surname = pc.dentist.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/).pop()?.toLowerCase() ?? 'dentist';
  const c: StudioCase = {
    caseId: pc.id,
    demoLabel: service === 'Clear Aligners' || service === 'Retainer' ? 'Aligner plan' : 'Smile design',
    patientName: pc.patientName, practice: pc.practice, dentist: pc.dentist,
    dentistEmail: `dr.${surname}@smilegenius.co.uk`,
    lab: pc.lab || 'Smile Genius Lab', service,
    teeth: item?.fdi ?? [], material: item?.material ?? '—', shade: item?.shade ?? '—',
    kind: service === 'Clear Aligners' || service === 'Retainer' ? 'aligner-plan' : 'smile-design',
    versions: [], links: [],
  };
  commit({ cases: { ...state.cases, [c.caseId]: c } });
  return c;
}

// ── Lab actions ───────────────────────────────────────────────────────────────
export function respondToCapture(versionId: string, captureId: string, outcome: 'addressed' | 'partially' | 'cant-do', note: string, by: string) {
  const status: Capture['status'] = outcome === 'addressed' ? 'addressed' : outcome === 'partially' ? 'partially-addressed' : 'open';
  updateCapture(versionId, captureId, { status, labResponse: { by, at: new Date().toISOString(), note, outcome } });
}

const TOKEN_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function mintToken() {
  let t = 'rv_';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  bytes.forEach(b => { t += TOKEN_CHARS[b % TOKEN_CHARS.length]; });
  return t;
}

export interface ShareInput {
  caseId: string;
  sourceUrl: string;
  provider: DesignProvider;
  kind: DesignKind;
  recipientName: string;
  recipientEmail: string;
  note: string;
  expiresInDays: number;
  uploadedBy: string;
  /** Upload share (provider 'upload'), or files carried over from the dentist. */
  files?: DesignFile[];
}

/** Share a design: a new version plus its secure review link. The previous version is superseded. */
export function shareDesign(input: ShareInput): ReviewLink {
  const c = state.cases[input.caseId];
  const prev = c ? latestVersion(c) : undefined;
  const number = (prev?.number ?? 0) + 1;
  const versionId = `v-${input.caseId.slice(-4)}-${number}-${Date.now().toString(36)}`;
  const model: ModelParams = prev && prev.kind === input.kind
    ? { ...prev.model, midlineShiftMm: 0, incisalDeltaMm: {}, buccalBulkMm: { ...prev.model.buccalBulkMm, 23: 0 } }
    : input.kind === 'aligner-plan'
      ? { kind: 'aligner-plan', shade: 'A1', stages: { upper: 24, lower: 20 }, attachments: [], ipr: [] }
      : { kind: input.kind, shade: c?.shade && /^[A-D]\d|BL\d/.test(c.shade) ? c.shade : 'A2', designedTeeth: c?.teeth };
  const version: DesignVersion = {
    id: versionId, caseId: input.caseId, number, kind: input.kind, provider: input.provider, sourceUrl: input.sourceUrl,
    uploadedBy: input.uploadedBy, uploadedAt: new Date().toISOString(), note: input.note || undefined,
    status: 'awaiting-review', captures: [], model, carryForward: {},
    files: input.files?.length ? input.files : undefined,
  };
  const link: ReviewLink = {
    token: mintToken(), versionId, recipientName: input.recipientName, recipientEmail: input.recipientEmail,
    expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
  };
  updateCase(input.caseId, x => ({
    ...x,
    versions: [version, ...x.versions.map(v => (v.status === 'awaiting-review' || v.status === 'changes-requested' ? { ...v, status: 'superseded' as const } : v))],
    links: [link, ...x.links],
  }));
  syncPortalCase(input.caseId);
  return link;
}

export function resetDesignStudioDemo() {
  commit({ cases: seedStudioCases() });
  Object.keys(state.cases).forEach(syncPortalCase);
}

// ── Portal integration (read-only imports, runtime writes only) ───────────────
function portalStatus(c: StudioCase): Case['status'] {
  return latestVersion(c)?.status === 'approved' ? 'in-production' : 'sent-for-review';
}

/** The case as the portal's Cases list sees it. Lives in the created-cases store. */
function portalCase(c: StudioCase): Case {
  const existing = getCreatedCases().find(x => x.id === c.caseId);
  const status = portalStatus(c);
  const isAligner = c.kind === 'aligner-plan';
  return {
    id: c.caseId,
    patientName: c.patientName,
    practice: c.practice,
    dentist: c.dentist,
    lab: c.lab,
    services: [c.service],
    serviceItems: [{
      id: `${c.caseId}-s1`, name: c.service, status, deliveryDate: null,
      fdi: c.teeth,
      material: isAligner ? 'Composite' : 'E.max', shade: isAligner ? 'Clear' : c.shade, orderType: 'Private',
      instructions: latestVersion(c)?.note, scanFileCount: 3, attachmentCount: 1,
    }],
    status,
    createdAt: existing?.createdAt ?? studioDate(c.versions[c.versions.length - 1].uploadedAt),
    updatedAt: studioDate(latestVersion(c)?.uploadedAt ?? new Date().toISOString()),
    requestedDelivery: isAligner ? null : '30-Oct-2026',
    hasAlert: false,
    scanner: isAligner ? 'iTero' : '3Shape',
    source: 'scanner',
    createdBySide: 'clinic',
  };
}

/** Only the two demo cases are written back to the Cases list: writing a real (mock) case
 *  into the created-cases store would duplicate its row in CasesPage. */
function syncPortalCase(caseId: string) {
  const c = state.cases[caseId];
  if (c && DEMO_CASE_IDS.includes(caseId) && c.versions.length) addCreatedCase(portalCase(c));
}

/** Seed the two demo cases into the portal's Cases list (idempotent). */
export function ensureDesignStudioDemo() {
  const created = getCreatedCases();
  for (const c of Object.values(state.cases)) {
    if (!DEMO_CASE_IDS.includes(c.caseId)) continue;
    const existing = created.find(x => x.id === c.caseId);
    if (!existing || existing.status !== portalStatus(c)) syncPortalCase(c.caseId);
  }
}

/** Mirror submitted reviews into the bell (MOCK_NOTIFICATIONS is read on every render). */
export function syncStudioNotifications() {
  const fresh: { at: string; item: (typeof MOCK_NOTIFICATIONS)[number] }[] = [];
  for (const c of Object.values(state.cases)) {
    for (const v of c.versions) {
      if (!v.reviewedAt || !v.signOff) continue;
      const id = `ds-${v.id}`;
      if (MOCK_NOTIFICATIONS.some(n => n.id === id)) continue;
      const mentioned = [...new Set(v.captures.flatMap(cap => cap.mentions))]
        .map(m => LAB_MEMBERS.find(x => x.id === m)?.name).filter(Boolean) as string[];
      const reviewer = v.reviewedBy ?? c.dentist;
      fresh.push({
        at: v.reviewedAt,
        item: {
          id,
          title: mentioned.length
            ? `${reviewer} mentioned you on ${c.caseId}`
            : v.decision === 'approved' ? `${reviewer} approved Version ${v.number} on ${c.caseId}` : `${reviewer} requested changes on ${c.caseId}`,
          body: `${v.decision === 'approved' ? 'Design approved' : 'Changes requested'} on Version ${v.number} for ${c.patientName} · ${v.captures.length} capture${v.captures.length === 1 ? '' : 's'}${mentioned.length ? ` · mentions ${mentioned.join(', ')}` : ''}${clinicianFileCount(v) ? ` · ${clinicianFileCount(v)} file${clinicianFileCount(v) === 1 ? '' : 's'} attached` : ''}. Open Design Studio to respond.`,
          timestamp: studioDateTime(v.reviewedAt),
          read: false,
        },
      });
    }
  }
  // Oldest first, so the newest review ends up at the top of the bell.
  fresh.sort((a, b) => a.at.localeCompare(b.at)).forEach(f => MOCK_NOTIFICATIONS.unshift(f.item));
}
