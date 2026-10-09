// ─── What audio / photo read — shared by Capture and the case form ──────────
// Audio and photo don't have their own review screen: they prefill the same
// step-by-step form as "Manually", and pass along what they couldn't read for
// sure (flags) so the form can highlight those fields.

export type ReadMode = 'photo' | 'audio';
export type RxScenario = 'single' | 'multi' | 'clean';

/** A field the read wasn't sure about. field = a CaseForm key, or `${itemUid}.${key}` for a service. */
export interface ReadFlag { field: string; label: string; heard: string; missing?: boolean }
export interface ReadSource {
  mode: ReadMode;
  rx: RxScenario;
  secs: number;
  transcript: { t: string; flag?: boolean }[];
  flags: ReadFlag[];
}

export const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
