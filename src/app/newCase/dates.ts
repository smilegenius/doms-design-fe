// ─── New Case Flow · date engine ─────────────────────────────────────────────
// UK working days (Mon–Fri, England and Wales bank holidays) for the lab side,
// and the clinic's opening days (Mon–Sat) for fit appointments. Pure functions
// only, so the worked examples in the requirements can be checked in isolation.

/** The demo clock: Thu 22 Oct 2026, 11:05. It ticks on from page load so
 *  timestamps move, but every worked example starts from this instant. */
export const DEMO_NOW = new Date(2026, 9, 22, 11, 5);
const BOOT = Date.now();
export function demoNow(): Date {
  return new Date(DEMO_NOW.getTime() + (Date.now() - BOOT));
}
/** A real timestamp (Date.now()) on the demo clock. */
export function demoTimeOf(ms: number): Date {
  return new Date(DEMO_NOW.getTime() + (ms - BOOT));
}

const BANK_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  // 2027
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
]);

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const isBankHoliday = (d: Date) => BANK_HOLIDAYS.has(toISO(d));
export function isWorkingDay(d: Date): boolean {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !isBankHoliday(d);
}
/** Elmfield opens Mon–Sat; closed Sundays and bank holidays. */
export const isClinicOpen = (d: Date) => d.getDay() !== 0 && !isBankHoliday(d);

export function addWorkingDays(d: Date, n: number): Date {
  let x = startOfDay(d);
  let k = 0;
  while (k < n) {
    x = addDays(x, 1);
    if (isWorkingDay(x)) k++;
  }
  return x;
}
export function firstClinicDayAfter(d: Date): Date {
  let x = addDays(d, 1);
  while (!isClinicOpen(x)) x = addDays(x, 1);
  return x;
}
export function lastWorkingDayBefore(d: Date): Date {
  let x = addDays(d, -1);
  while (!isWorkingDay(x)) x = addDays(x, -1);
  return x;
}
/** Working days after `from`, up to and including `to` (0 when to ≤ from). */
export function workingDaysBetween(from: Date, to: Date): number {
  let n = 0;
  let x = startOfDay(from);
  const end = startOfDay(to);
  while (x < end) {
    x = addDays(x, 1);
    if (isWorkingDay(x)) n++;
  }
  return n;
}

/**
 * When the lab counts the case as received. Digital records arrive today when
 * it's a working day before the lab's cut-off, else the next working day.
 * Posted impressions arrive one courier working day after posting.
 */
export function receivedDate(route: 'digital' | 'post', now: Date, cutoffMin: number, courierDays = 1): Date {
  if (route === 'post') return addWorkingDays(now, courierDays);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (isWorkingDay(now) && minutes < cutoffMin) return startOfDay(now);
  return addWorkingDays(now, 1);
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Mon 2 Nov" */
export const fmtDay = (d: Date) => `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
/** "2 Nov" */
export const fmtShort = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;
/** "Oct 2026" */
export const fmtMonth = (d: Date) => `${MON[d.getMonth()]} ${d.getFullYear()}`;
/** "14 Jul 2026" */
export const fmtFull = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
/** "10:42" */
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** 15*60 → "3pm", 12*60 → "noon" */
export function fmtCutoff(min: number): string {
  if (min === 12 * 60) return 'noon';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}${m ? `:${pad(m)}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}
export const sameDay = (a: Date, b: Date) => toISO(a) === toISO(b);

/** dd/mm/yyyy → Date, or an error message the new-patient form shows as-is. */
export function parseDOB(raw: string, now: Date): { date?: Date; error?: string; warning?: string } {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return { error: 'Enter a date of birth, for example 14/05/1979.' };
  if (digits.length !== 8) return { error: 'Enter a real date, for example 14/05/1979.' };
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4));
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || y < 1880) {
    return { error: 'Enter a real date, for example 14/05/1979.' };
  }
  if (date > now) return { error: 'That date is in the future.' };
  if (ageOn(date, now) > 110) return { date, warning: 'That makes the patient over 110. Check the year.' };
  return { date };
}
export function dobFromString(dob: string): Date {
  const [d, m, y] = dob.split('/').map(Number);
  return new Date(y, m - 1, d);
}
export function ageOn(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return age;
}
/** Keystrokes → "14/05/1979" mask. */
export function maskDOB(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
