import { useSyncExternalStore } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { addCreatedCase, removeCreatedCases } from '../../src/app/data/createdCases';
import { LAB_TEAM, portalDate, SAMPLE_PRESCRIPTIONS, SamplePrescription, SANDBOX_ID_PREFIX } from './data';

// ── Prescription email inbox store ───────────────────────────────────────────
// Same pattern as src/app/data/createdCases.ts: a module-level store with
// useSyncExternalStore and localStorage persistence.
//
// AI drafts go straight into the portal's existing created-cases store with
// addCreatedCase, so the real CasesPage lists them and the real QuickCreate
// screen opens them. Only this folder writes the store's sandbox entries.

export type Channel = 'inApp' | 'email';
export type ChannelPrefs = Record<Channel, boolean>;

/** Per-user preferences for the "Prescription Email Inbox" notification category. */
export interface RxNotificationPrefs {
  /** AI Draft Ready for Review: any draft made from the lab inbox. */
  draftReady: ChannelPrefs;
  /** Draft Ready: Photos I Sent, even when draftReady is off. */
  mySubmissions: ChannelPrefs;
}
export type RxPrefKey = keyof RxNotificationPrefs;

export interface InboundRx {
  id: string;          // = the draft case id it produced
  sampleId: string;    // which photographed prescription was attached
  from: string;
  photoName: string;
  receivedAt: string;  // ISO
  status: 'processing' | 'drafted';
  patientName?: string;
}

export interface NotificationEmail {
  id: string;
  caseId: string;
  to: string[];
  subject: string;
  sentAt: string;      // ISO
}

interface InboxState {
  prefs: Record<string, RxNotificationPrefs>;   // keyed by team member email
  inbound: InboundRx[];
  sent: NotificationEmail[];
  /** Bumped by "Reset demo" so the host remounts CasesPage (it keeps its own list state). */
  resetVersion: number;
  /** Drafts whose photo viewer has already auto-opened once. */
  photoSeen: string[];
}

const ON: ChannelPrefs = { inApp: true, email: true };
const OFF: ChannelPrefs = { inApp: false, email: false };

// Seed: Sajid (the demo sign-in) and Sophie have nominated themselves; everyone
// hears about photos they sent themselves.
const DEFAULT_PREFS: Record<string, RxNotificationPrefs> = Object.fromEntries(
  LAB_TEAM.map(m => [m.email, {
    draftReady: m.email === 'sajid@smilegenius.com' ? { ...ON }
      : m.email === 'sophie@smilegenius.com' ? { inApp: false, email: true }
      : { ...OFF },
    mySubmissions: { ...ON },
  }]),
);

const LS_KEY = 'salesFeedbacks.rxInbox.v2';
const DEFAULT_STATE: InboxState = { prefs: DEFAULT_PREFS, inbound: [], sent: [], resetVersion: 0, photoSeen: [] };

function load(): InboxState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed, prefs: { ...DEFAULT_PREFS, ...parsed.prefs } };
    }
  } catch { /* corrupt or blocked: start fresh */ }
  return DEFAULT_STATE;
}

let state: InboxState = load();
const listeners = new Set<() => void>();

function commit(next: InboxState) {
  state = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked: keep in-memory */ }
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useRxInbox(): InboxState {
  return useSyncExternalStore(subscribe, () => state);
}

export function prefsFor(email: string): RxNotificationPrefs {
  return state.prefs[email] ?? { draftReady: { ...OFF }, mySubmissions: { ...OFF } };
}

export function setRxPref(email: string, key: RxPrefKey, channel: Channel, value: boolean) {
  const current = prefsFor(email);
  commit({ ...state, prefs: { ...state.prefs, [email]: { ...current, [key]: { ...current[key], [channel]: value } } } });
}

/** Team members who currently get the draft-ready email for every inbox draft. */
export function draftReadyEmailRecipients(prefs = state.prefs): string[] {
  return LAB_TEAM.filter(m => prefs[m.email]?.draftReady.email).map(m => m.email);
}

let counter = 0;
function nextSandboxId() {
  counter += 1;
  return `${SANDBOX_ID_PREFIX}${String(Date.now()).slice(-5)}${counter}`;
}

/**
 * A lab user emails a photo to the inbox. After a short AI "read", the draft
 * case lands in the Cases list and everyone whose preferences ask for it is
 * emailed. Resolves with how many people were notified.
 */
export function receivePrescriptionPhoto(sampleId: string, from: string, delayMs = 2500): Promise<{ caseId: string; notified: number }> {
  const sample = SAMPLE_PRESCRIPTIONS.find(s => s.id === sampleId) ?? SAMPLE_PRESCRIPTIONS[0];
  const id = nextSandboxId();
  const receivedAt = new Date().toISOString();
  const sender = LAB_TEAM.find(m => m.email === from);
  const pages = sample.pages.length;

  // Recipients are fixed when the email arrives.
  const to = draftReadyEmailRecipients();
  if (prefsFor(from).mySubmissions.email && !to.includes(from)) to.push(from);

  commit({ ...state, inbound: [{ id, sampleId: sample.id, from, photoName: sample.photoName, receivedAt, status: 'processing' }, ...state.inbound] });

  return new Promise(resolve => {
    setTimeout(() => {
      const today = portalDate();
      const draft: Case = {
        ...structuredClone(sample.draft),
        id,
        createdAt: today,
        updatedAt: today,
        createdBy: sender?.name,
        emailPrescription: {
          fromName: sender?.name ?? from,
          fromEmail: from,
          subject: 'Prescription photo',
          receivedAt: 'Just now',
          attachmentName: sample.photoName,
          bodyPreview: `Photo of a paper prescription (${pages} page${pages === 1 ? '' : 's'}) sent to the lab's prescription inbox. AI read it and pre-filled this draft for ${sample.draft.patientName}.`,
        },
      };
      addCreatedCase(draft);

      const sent = to.length
        ? [{ id: `mail-${id}`, caseId: id, to, subject: `Draft case ${id} ready for review: ${draft.patientName}`, sentAt: new Date().toISOString() }, ...state.sent]
        : state.sent;
      commit({
        ...state,
        sent,
        inbound: state.inbound.map(m => (m.id === id ? { ...m, status: 'drafted', patientName: draft.patientName } : m)),
      });
      resolve({ caseId: id, notified: to.length });
    }, delayMs);
  });
}

/** The photographed prescription behind an inbox draft, if it came from the inbox. */
export function sampleForCase(caseId: string): SamplePrescription | undefined {
  const inbound = state.inbound.find(m => m.id === caseId);
  return inbound ? SAMPLE_PRESCRIPTIONS.find(s => s.id === inbound.sampleId) : undefined;
}

export function markPhotoSeen(caseId: string) {
  if (!state.photoSeen.includes(caseId)) commit({ ...state, photoSeen: [...state.photoSeen, caseId] });
}

/** Drop a reviewed (submitted) sandbox draft from the created-cases store. */
export function removeSandboxDraft(caseId: string) {
  if (caseId.startsWith(SANDBOX_ID_PREFIX)) removeCreatedCases(c => c.id === caseId);
}

/** "Reset demo": remove every sandbox draft and clear the inbox logs. */
export function resetRxInboxDemo() {
  removeCreatedCases(c => c.id.startsWith(SANDBOX_ID_PREFIX));
  commit({ ...state, inbound: [], sent: [], photoSeen: [], resetVersion: state.resetVersion + 1 });
}
