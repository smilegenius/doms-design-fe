import { useSyncExternalStore } from 'react';

// ─── Dispatch information · clinic → lab ─────────────────────────────────────
// When the clinic marks a Ready for Dispatch case as dispatched, what it posted
// — courier, delivery method, tracking number, date — is kept here against the
// case. The case's Shipping tab shows it (as "Clinic → Lab") next to the lab's
// own shipment back (as "Lab → Clinic"), and both portals read the same record
// so the lab can see what is on its way.
//
// localStorage-backed like the other prototype records, with one seeded case so
// the walkthrough has something to open.

export interface DispatchRecord {
  courier: string;
  /** Bag or Box. */
  packaging: string;
  tracking: string;
  /** Optional note for the lab, e.g. what is in the parcel. */
  comment?: string;
  /** yyyy-mm-dd */
  dispatchedOn: string;
  by: string;
  /** ISO timestamp of when it was recorded. */
  at: string;
  /** Set when the clinic edited the details afterwards. */
  editedBy?: string;
  editedAt?: string;
}

const LS_KEY = 'cases.dispatch';

const SEED: Record<string, DispatchRecord> = {
  // Multi-service case posted in one box: its Shipping tab shows this under each service tab.
  'CASE-DISP-4006': { courier: 'DPD', packaging: 'Box', tracking: 'DPD 15501234', comment: 'Both impressions in one box, bite registration included.', dispatchedOn: '2026-06-22', by: 'Sana Khan', at: '2026-06-22T10:05:00' },
  // Harry Lewis · Crown · impressions posted by Royal Mail (the case's own note).
  'CASE-054': { courier: 'Royal Mail', packaging: 'Bag', tracking: 'RM 1234 5678 9GB', dispatchedOn: '2026-06-20', by: 'Sana Khan', at: '2026-06-20T09:20:00' },
};

function load(): Record<string, DispatchRecord> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...SEED, ...parsed };
    }
  } catch { /* corrupt — start from the seed */ }
  return { ...SEED };
}

let records: Record<string, DispatchRecord> = load();
const listeners = new Set<() => void>();

function commit(next: Record<string, DispatchRecord>) {
  records = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in memory */ }
  listeners.forEach(l => l());
}

export function recordDispatch(caseId: string, record: DispatchRecord) {
  commit({ ...records, [caseId]: record });
}

/** Correct a recorded dispatch. Only the clinic that created it is offered this. */
export function updateDispatch(caseId: string, patch: Partial<DispatchRecord>) {
  const current = records[caseId];
  if (current) commit({ ...records, [caseId]: { ...current, ...patch } });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The dispatch recorded for a case, if any; re-renders when it is recorded. */
export function useDispatchRecord(caseId: string): DispatchRecord | undefined {
  return useSyncExternalStore(subscribe, () => records[caseId]);
}
