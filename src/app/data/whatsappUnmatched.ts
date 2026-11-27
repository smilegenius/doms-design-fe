import { useSyncExternalStore } from 'react';

// ─── Unmatched WhatsApp messages ─────────────────────────────────────────────
// Inbound WhatsApp messages that couldn't be linked to a case on their own: the
// dentist started a new chat instead of replying in the case thread, wrote from
// a number the lab doesn't have, has several open cases and didn't say which,
// or answered on a case that's already closed. They wait in the lab's WhatsApp
// inbox (Action required) until someone assigns them to one of the dentist's
// open cases — then they move to Resolved and show in that case's
// conversation thread. Assigning can be undone, which puts the message back.
//
// Stored (localStorage) like the case communication records, so an assignment
// survives a reload and the case thread reads it from here.

export type UnmatchedReason = 'not-a-reply' | 'unknown-number' | 'several-cases' | 'closed-case';

export const UNMATCHED_REASON: Record<UnmatchedReason, { label: string; detail: string }> = {
  'not-a-reply':    { label: 'Not a reply in a case thread', detail: 'Sent as a new chat, so it isn’t linked to any case.' },
  'unknown-number': { label: 'Unknown number',               detail: 'This number isn’t on file for any dentist.' },
  'several-cases':  { label: 'Several possible cases',       detail: 'The dentist has more than one open case and the message doesn’t say which.' },
  'closed-case':    { label: 'Reply on a closed case',       detail: 'It answers a message on a case that’s already completed.' },
};

export interface UnmatchedAssignment {
  caseId: string;
  /** The dentist the lab confirmed — needed when the number was unknown. */
  dentist: string;
  at: string; // ISO
  by: string;
}

export interface UnmatchedWhatsApp {
  id: string;
  /** The dentist the number belongs to, or null when the number is unknown. */
  dentist: string | null;
  /** The sender's WhatsApp profile name — all there is for an unknown number. */
  profileName: string;
  fromNumber: string;
  body: string;
  receivedAt: string; // ISO
  reason: UnmatchedReason;
  assignment?: UnmatchedAssignment;
  /** Resolved without a case — the lab read it and nothing needs linking. */
  dismissed?: { at: string; by: string };
  /** The case it was last taken off — shown when it is reassigned. */
  previousCaseId?: string;
}

const SEED: UnmatchedWhatsApp[] = [
  {
    id: 'wa-un-101',
    dentist: 'Dr. Webb',
    profileName: 'Dr Tom Webb',
    fromNumber: '+44 7700 900748',
    body: 'Morning! Quick one — can we go a shade lighter on Isabella’s crown? A1 instead of A2. Thanks',
    receivedAt: '2026-11-13T08:42:00',
    reason: 'several-cases',
  },
  {
    id: 'wa-un-106',
    dentist: 'Dr. Webb',
    profileName: 'Dr Tom Webb',
    fromNumber: '+44 7700 900748',
    body: 'Also for Isabella — could it be ready by the 20th? She’s away after that.',
    receivedAt: '2026-11-13T08:47:00',
    reason: 'not-a-reply',
  },
  {
    id: 'wa-un-102',
    dentist: 'Dr. Webb',
    profileName: 'Dr Tom Webb',
    fromNumber: '+44 7700 900748',
    body: 'Patient isn’t happy with the bite on the partial. Can we do a try-in before you finish it?',
    receivedAt: '2026-11-12T17:05:00',
    reason: 'not-a-reply',
  },
  {
    id: 'wa-un-103',
    dentist: null,
    profileName: 'Rhys Evans',
    fromNumber: '+44 7911 482330',
    body: 'Hi, Dr Evans from Cardiff here — new phone. Is Harry Lewis’s crown still on for Friday?',
    receivedAt: '2026-11-12T14:20:00',
    reason: 'unknown-number',
  },
  {
    id: 'wa-un-104',
    dentist: 'Dr. Reed',
    profileName: 'Dr Reed',
    fromNumber: '+44 7700 900371',
    body: 'Sorry, replying on the old chat — scans for Daniel Foster are uploaded now.',
    receivedAt: '2026-11-11T10:30:00',
    reason: 'closed-case',
  },
  {
    id: 'wa-un-105',
    dentist: 'Dr. Evans',
    profileName: 'Dr Evans',
    fromNumber: '+44 7700 900254',
    body: 'Sophie Turner asked if her crown could come a day early. Is that possible?',
    receivedAt: '2026-11-10T09:15:00',
    reason: 'not-a-reply',
    assignment: { caseId: 'CASE-053', dentist: 'Dr. Evans', at: '2026-11-10T09:40:00', by: 'Sana Khan' },
  },
];

const LS_KEY = 'lab.whatsappUnmatched';

function load(): UnmatchedWhatsApp[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED;
    // Seed messages added after the store was first saved still show up.
    const stored = parsed as UnmatchedWhatsApp[];
    const ids = new Set(stored.map(m => m.id));
    return [...stored, ...SEED.filter(m => !ids.has(m.id))];
  } catch {
    return SEED;
  }
}

let messages: UnmatchedWhatsApp[] = load();
const listeners = new Set<() => void>();

function commit(next: UnmatchedWhatsApp[]) {
  messages = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getUnmatchedWhatsApp(): UnmatchedWhatsApp[] {
  return messages;
}

export function isResolved(m: UnmatchedWhatsApp): boolean {
  return !!m.assignment || !!m.dismissed;
}

/** Link the message to a case — it moves to Resolved and joins that case's thread. */
export function assignUnmatchedWhatsApp(id: string, input: { caseId: string; dentist: string; by: string }) {
  commit(messages.map(m => (m.id === id
    ? { ...m, assignment: { ...input, at: new Date().toISOString() } }
    : m)));
}

/** Bulk — several messages (same dentist) linked to one case at once. */
export function assignManyUnmatchedWhatsApp(ids: string[], input: { caseId: string; dentist: string; by: string }) {
  const at = new Date().toISOString();
  const set = new Set(ids);
  commit(messages.map(m => (set.has(m.id) ? { ...m, dismissed: undefined, assignment: { ...input, at } } : m)));
}

/** Resolved without a case — nothing to link (thanks, chit-chat, already handled). */
export function dismissUnmatchedWhatsApp(ids: string[], by: string) {
  const at = new Date().toISOString();
  const set = new Set(ids);
  commit(messages.map(m => (set.has(m.id) ? { ...m, assignment: undefined, dismissed: { at, by } } : m)));
}

/** Undo — the message leaves the case thread (if any) and goes back to Action required. */
export function unassignUnmatchedWhatsApp(id: string) {
  commit(messages.map(m => {
    if (m.id !== id || !isResolved(m)) return m;
    const { assignment, dismissed: _d, ...rest } = m;
    return assignment ? { ...rest, previousCaseId: assignment.caseId } : rest;
  }));
}

/** Demo reset — back to the seeded inbox. */
export function resetUnmatchedWhatsApp() {
  commit(SEED);
}

/** Messages the lab assigned to this case, oldest first. */
export function unmatchedAssignedTo(caseId: string, all: UnmatchedWhatsApp[] = messages): UnmatchedWhatsApp[] {
  return all
    .filter(m => m.assignment?.caseId === caseId)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useUnmatchedWhatsApp(): UnmatchedWhatsApp[] {
  return useSyncExternalStore(subscribe, getUnmatchedWhatsApp);
}
