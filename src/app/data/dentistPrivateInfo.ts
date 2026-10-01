import { useSyncExternalStore } from 'react';

// ─── Lab-private dentist details ─────────────────────────────────────────────
// A lab keeps its own contact notes against a dentist: a direct email, a mobile
// number and free notes. They are visible ONLY to the lab — the dentist never
// sees them and they do not change the dentist's own contact record on the
// clinic side. The lab's WhatsApp sends use the private phone when one is
// saved, which is what makes this more than a notepad: no number on file means
// no WhatsApp can go out, and the private phone is how the lab fixes that.

export interface DentistPrivateInfo {
  email?: string;
  phone?: string;
  notes?: string;
}

/** Notes have a hard cap so the field can show a live count. */
export const PRIVATE_NOTES_MAX = 2000;

// ── Known numbers ────────────────────────────────────────────────────────────
// The prototype has no dentist contact store, so this stands in for one: the
// numbers a clinic has shared with the lab. Deliberately NOT exhaustive —
// Dr. Harper has no number on file, which is the case that demonstrates the
// "add a private number before you can message" path.
export const DENTIST_PHONE_DIRECTORY: Record<string, string> = {
  'Dr. Amelia Hart': '+44 7700 900118',
  'Dr. Evans':       '+44 7700 900254',
  'Dr. Reed':        '+44 7700 900371',
  'Dr. Davies':      '+44 7700 900490',
  'Dr. Anderson':    '+44 7700 900512',
  'Dr. Foster':      '+44 7700 900637',
  'Dr. Webb':        '+44 7700 900748',
  'Dr. White':       '+44 7700 900865',
  // 'Dr. Harper'  — no number on file
  // 'Dr. Murphy'  — no number on file
};

const LS_KEY = 'lab.dentistPrivateInfo';

function load(): Record<string, DentistPrivateInfo> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, DentistPrivateInfo>) : {};
  } catch {
    return {};
  }
}

let records: Record<string, DentistPrivateInfo> = load();
const listeners = new Set<() => void>();

function commit(next: Record<string, DentistPrivateInfo>) {
  records = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getAllDentistPrivateInfo(): Record<string, DentistPrivateInfo> {
  return records;
}

export function getDentistPrivateInfo(dentist: string): DentistPrivateInfo {
  return records[dentist] ?? {};
}

export function saveDentistPrivateInfo(dentist: string, info: DentistPrivateInfo) {
  const clean: DentistPrivateInfo = {
    email: info.email?.trim() || undefined,
    phone: info.phone?.trim() || undefined,
    notes: info.notes?.slice(0, PRIVATE_NOTES_MAX).trim() || undefined,
  };
  commit({ ...records, [dentist]: clean });
}

/** Demo reset — drop every lab-private record. */
export function clearDentistPrivateInfo() {
  commit({});
}

/**
 * The number the lab can reach this dentist on: the private one it saved
 * first, then whatever the clinic shared. `undefined` means there is no
 * number on file and nothing can be sent.
 */
export function dentistPhoneFor(dentist: string): string | undefined {
  return records[dentist]?.phone ?? DENTIST_PHONE_DIRECTORY[dentist];
}

/** The address the lab emails this dentist on, when it has a private one. */
export function dentistPrivateEmailFor(dentist: string): string | undefined {
  return records[dentist]?.email;
}

// ── Reactive read ─────────────────────────────────────────────────────────────
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useDentistPrivateInfo(): Record<string, DentistPrivateInfo> {
  return useSyncExternalStore(subscribe, getAllDentistPrivateInfo);
}
