import { useSyncExternalStore } from 'react';
import type { Case } from '../pages/CasesPage';

// ─── Cases created through Quick Create ──────────────────────────────────────
// Submitting the creation form used to end at a toast — the case never joined
// the Cases list. Rescan linking needs the new case to be a real record (the
// original has to be able to point AT something, and the user has to be able
// to open it from the Related Cases section), so submissions now land here and
// the Cases list merges them in alongside the mock data.
//
// localStorage-backed so a created case survives a refresh, like the rest of
// the prototype's user-made data.

const LS_KEY = 'cases.created';

function load(): Case[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Case[];
    }
  } catch { /* corrupt — start empty */ }
  return [];
}

let created: Case[] = load();
const listeners = new Set<() => void>();

function commit(next: Case[]) {
  created = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getCreatedCases(): Case[] {
  return created;
}

/** Newest first — the Cases list shows a freshly created case at the top. */
export function addCreatedCase(c: Case) {
  commit([c, ...created.filter(x => x.id !== c.id)]);
}

/**
 * Next case ID for a newly created case. Uses the SG-#### series the rescan
 * spec's examples use, continuing from whatever has already been created.
 */
export function nextCaseId(): string {
  const used = created
    .map(c => Number(/^SG-(\d+)$/.exec(c.id)?.[1] ?? NaN))
    .filter(n => !Number.isNaN(n));
  const next = (used.length ? Math.max(...used) : 10450) + 1;
  return `SG-${next}`;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Components re-render when a case is created. */
export function useCreatedCases(): Case[] {
  return useSyncExternalStore(subscribe, getCreatedCases);
}
