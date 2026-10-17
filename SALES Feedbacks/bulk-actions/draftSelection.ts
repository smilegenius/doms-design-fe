import { useSyncExternalStore } from 'react';

// ── Ticked drafts ────────────────────────────────────────────────────────────
// The Cases list can't select drafts, so the sandbox keeps its own selection
// for draft rows (DraftCheckboxes). Drafts and cases never mix: ticking a
// draft clears the list's own ticks, and the other way round.

let ids: string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export const useDraftSelection = () => useSyncExternalStore(subscribe, () => ids);
export const getDraftSelection = () => ids;
export function toggleDraft(id: string) { ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]; emit(); }
export function setDraftSelection(next: string[]) { ids = [...new Set(next)]; emit(); }
export function clearDraftSelection() { if (ids.length) { ids = []; emit(); } }
