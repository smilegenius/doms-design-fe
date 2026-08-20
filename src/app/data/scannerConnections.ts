import { useSyncExternalStore } from 'react';

// ─── Scanner connections & token-expiry reminders ────────────────────────────
// Scanner integrations authenticate with a token that expires after a fixed
// lifetime (1 / 7 / 30 / 365 days). Once it lapses Smile Genius silently stops
// importing cases — the integration still LOOKS connected — so the lab has to
// be told before it happens and chased daily until it reconnects.
//
// This module owns the whole feature's state and copy:
//   • the lab's connected scanners + their current token cycle
//   • business-day maths for the pre-expiry milestones
//   • the notification catalogue (email subject/body + in-app copy, PM's
//     wording verbatim) for every milestone and for the post-expiry daily
//   • the derived reminder feed the notification surfaces render
//
// Reminders are DERIVED from the live token cycle rather than stored, so a
// successful reconnect starts a new cycle and every pending reminder for the
// old one disappears in the same render (AC4) — nothing to clean up.
// localStorage-backed and shared by Settings, the notification feed, the bell
// popover and the lab-wide expiry banner.

// ── Connections ───────────────────────────────────────────────────────────────
/** Token lifetimes offered by the scanner vendors. */
export type TokenLifetimeDays = 1 | 7 | 30 | 365;

export interface ScannerConnection {
  id: string;
  /** Full product name — the {{Scanner Name}} placeholder in every notification. */
  name: string;
  /** Vendor, matching the brand logos already shipped for case rows. */
  brand: 'iTero' | '3Shape' | 'Medit' | 'Carestream';
  /** The scanner account/site the token belongs to. */
  account: string;
  tokenLifetimeDays: TokenLifetimeDays;
  /** ISO — when the CURRENT token cycle started (connect or last reconnect). */
  connectedAt: string;
  /** ISO — when the current token expires. */
  expiresAt: string;
  /** ISO — set on every successful reconnect; drives the "reconnected" pill. */
  lastReconnectedAt?: string;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Mon–Fri. Public holidays are a backend concern — the UI counts weekdays. */
export function isBusinessDay(d: Date): boolean {
  const w = d.getDay();
  return w !== 0 && w !== 6;
}

/** Move `n` business days forward (n > 0) or back (n < 0) from `from`. */
export function addBusinessDays(from: Date | string, n: number): Date {
  const d = startOfDay(new Date(from));
  const step = n >= 0 ? 1 : -1;
  let left = Math.abs(n);
  while (left > 0) {
    d.setDate(d.getDate() + step);
    if (isBusinessDay(d)) left--;
  }
  return d;
}

/**
 * Business days from today (exclusive) to `target` (inclusive).
 * 0 = expires today; negative = already expired, |n| business days ago.
 */
export function businessDaysUntil(target: Date | string, now: Date = new Date()): number {
  const from = startOfDay(now);
  const to = startOfDay(new Date(target));
  if (from.getTime() === to.getTime()) return 0;
  const forward = to > from;
  const cursor = new Date(from);
  let count = 0;
  while (cursor.getTime() !== to.getTime()) {
    cursor.setDate(cursor.getDate() + (forward ? 1 : -1));
    if (isBusinessDay(cursor)) count++;
  }
  return forward ? count : -count;
}

/** Calendar days between today and `target` (negative when in the past). */
export function calendarDaysUntil(target: Date | string, now: Date = new Date()): number {
  return Math.round((startOfDay(new Date(target)).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** "12-Jun-2026" — the date format used across the portal. */
export function formatDate(d: Date | string): string {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}-${MONTHS[x.getMonth()]}-${x.getFullYear()}`;
}

/** "12-Jun-2026, 09:00 AM" — the notification-feed timestamp format. */
export function formatTimestamp(d: Date | string): string {
  const x = new Date(d);
  const h24 = x.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${formatDate(x)}, ${String(h).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')} ${ampm}`;
}

// ── Reminder stages ───────────────────────────────────────────────────────────
/** Pre-expiry milestones, in business days before the token lapses. */
export const PRE_EXPIRY_MILESTONES = [30, 15, 5, 3, 1] as const;
export type PreExpiryMilestone = (typeof PRE_EXPIRY_MILESTONES)[number];

/** `pre-<n>` = n business days out; `expired` = the post-expiry daily reminder. */
export type ReminderStage = `pre-${PreExpiryMilestone}` | 'expired';

export const HELP_VIDEO_URL = 'https://help.smilegenius.com/videos/reconnect-your-scanner';
export const HELP_VIDEO_LABEL = 'Watch Video';
export const RECONNECT_LABEL = 'Reconnect Scanner';

// ── Notification copy ─────────────────────────────────────────────────────────
// The 5 / 3 / 1 business-day and post-expiry wording is the product spec's,
// verbatim. The spec schedules 30- and 15-business-day reminders but supplies
// no copy for them, so those reuse the 5-day template with the interval
// substituted — swap in PM's wording when it lands.
export interface ReminderCopy {
  stage: ReminderStage;
  /** Short label for the schedule rows, e.g. "5 business days before". */
  label: string;
  emailSubject: string;
  /** Body paragraphs, in order, above the Reconnect Scanner CTA. */
  emailBody: string[];
  /** "Need help?" / "Need assistance?" / "Need help reconnecting?" */
  emailHelpLead: string;
  /** Optional sentence under the help lead, above the Watch Video CTA. */
  emailHelpBody?: string;
  inApp: string;
}

function preExpiryCopy(days: PreExpiryMilestone): ReminderCopy {
  if (days === 1) {
    return {
      stage: 'pre-1',
      label: '1 business day before',
      emailSubject: 'Action Required: Your {{Scanner Name}} connection expires tomorrow',
      emailBody: [
        'Hi {{User Name}},',
        'Your {{Scanner Name}} connection will expire tomorrow.',
        'If you do not reconnect it, Smile Genius will no longer be able to automatically receive cases from your scanner.',
        'Reconnect now to avoid any disruption.',
      ],
      emailHelpLead: 'Need help?',
      inApp: 'Your {{Scanner Name}} connection expires tomorrow. Reconnect now to avoid interruption to case imports.',
    };
  }
  if (days === 3) {
    return {
      stage: 'pre-3',
      label: '3 business days before',
      emailSubject: 'Reminder: Your {{Scanner Name}} connection expires in 3 business days',
      emailBody: [
        'Hi {{User Name}},',
        'Just a reminder that your {{Scanner Name}} connection will expire in 3 business days.',
        'Reconnect now to ensure you continue receiving scanner cases without interruption.',
      ],
      emailHelpLead: 'Need assistance?',
      inApp: 'Your {{Scanner Name}} connection expires in 3 business days. Reconnect now to continue receiving scanner cases.',
    };
  }
  // 5 business days — also the template the 30/15-day reminders are built from.
  return {
    stage: `pre-${days}` as ReminderStage,
    label: `${days} business days before`,
    emailSubject: `Your {{Scanner Name}} connection expires in ${days} business days`,
    emailBody: [
      'Hi {{User Name}},',
      `Your {{Scanner Name}} connection will expire in ${days} business days.`,
      'To avoid any interruption to automatic case imports, please reconnect your scanner before the expiry date.',
    ],
    emailHelpLead: 'Need help?',
    emailHelpBody: 'Watch our step-by-step video guide on reconnecting your scanner.',
    inApp: `Your {{Scanner Name}} connection expires in ${days} business days. Reconnect now to avoid interruptions to automatic case imports.`,
  };
}

export const EXPIRED_COPY: ReminderCopy = {
  stage: 'expired',
  label: 'Daily after expiry',
  emailSubject: 'Scanner Connection Expired – Action Required',
  emailBody: [
    'Hi {{User Name}},',
    'Your {{Scanner Name}} connection has expired.',
    'Smile Genius is currently unable to receive new cases from your scanner until the connection is restored.',
    'Please reconnect your scanner as soon as possible.',
  ],
  emailHelpLead: 'Need help reconnecting?',
  emailHelpBody: 'Watch our step-by-step guide.',
  inApp: 'Your {{Scanner Name}} connection has expired. Automatic case imports are currently unavailable until you reconnect your scanner.',
};

/** Every reminder in the workflow, in the order they fire. */
export const REMINDER_SCHEDULE: ReminderCopy[] = [
  ...PRE_EXPIRY_MILESTONES.map(preExpiryCopy),
  EXPIRED_COPY,
];

export function copyForStage(stage: ReminderStage): ReminderCopy {
  return REMINDER_SCHEDULE.find(c => c.stage === stage) ?? EXPIRED_COPY;
}

/** Placeholders resolved at send time. */
export interface ReminderContext {
  scannerName: string;
  userName: string;
}

export function resolvePlaceholders(text: string, ctx: ReminderContext): string {
  return text
    .replace(/\{\{Scanner Name\}\}/g, ctx.scannerName)
    .replace(/\{\{User Name\}\}/g, ctx.userName);
}

// ── Connection health ─────────────────────────────────────────────────────────
export type ConnectionHealth = 'active' | 'expiring' | 'expired';

export interface ConnectionStatus {
  health: ConnectionHealth;
  /** Business days until expiry; 0 = today, negative = expired. */
  businessDaysLeft: number;
  calendarDaysLeft: number;
  /** The milestone currently in force, if the scanner is inside one. */
  stage: ReminderStage | null;
}

export function connectionStatus(c: ScannerConnection, now: Date = new Date()): ConnectionStatus {
  const businessDaysLeft = businessDaysUntil(c.expiresAt, now);
  const calendarDaysLeft = calendarDaysUntil(c.expiresAt, now);
  if (calendarDaysLeft < 0) {
    return { health: 'expired', businessDaysLeft, calendarDaysLeft, stage: 'expired' };
  }
  // "Expiring" means the lab has actually been TOLD — i.e. a pre-expiry
  // reminder has fired for this token cycle. Deriving the pill from the
  // reminders rather than from the raw thresholds keeps the status, the
  // banner and the feed on one rule, and stops a short-lived token (7 days is
  // only 5 business days) from reading as "expiring" the moment it's issued.
  const fired = remindersFor(c, now);
  const latest = fired[fired.length - 1];
  return {
    health: latest ? 'expiring' : 'active',
    businessDaysLeft,
    calendarDaysLeft,
    stage: latest?.stage ?? null,
  };
}

/**
 * The milestones that can actually fire inside a token's lifetime. A short
 * token (1 or 7 days) is already past the earlier milestones when it's issued,
 * so those reminders never go out — the lab relies on the post-expiry daily.
 */
export function applicableMilestones(c: ScannerConnection): PreExpiryMilestone[] {
  const cycleStart = startOfDay(new Date(c.connectedAt));
  const expiry = startOfDay(new Date(c.expiresAt));
  return PRE_EXPIRY_MILESTONES.filter(m => addBusinessDays(expiry, -m) > cycleStart);
}

// ── Derived reminder feed ─────────────────────────────────────────────────────
export interface ScannerReminder {
  /** Stable per token cycle, so a reconnect retires the whole set. */
  id: string;
  scannerId: string;
  scannerName: string;
  stage: ReminderStage;
  /** When the reminder fired (09:00 on its scheduled day). */
  firedAt: Date;
  copy: ReminderCopy;
}

const SEND_HOUR = 9;

function at9am(d: Date): Date {
  const x = startOfDay(d);
  x.setHours(SEND_HOUR, 0, 0, 0);
  return x;
}

/**
 * Every reminder that has fired for a scanner's CURRENT token cycle: the
 * pre-expiry milestones already reached, plus one daily reminder for each day
 * since expiry. Reconnecting starts a new cycle, so this returns nothing until
 * the next milestone is reached (AC4).
 */
export function remindersFor(c: ScannerConnection, now: Date = new Date()): ScannerReminder[] {
  const out: ScannerReminder[] = [];
  const cycleStart = startOfDay(new Date(c.connectedAt));
  const expiry = startOfDay(new Date(c.expiresAt));

  for (const m of PRE_EXPIRY_MILESTONES) {
    const fireDay = addBusinessDays(expiry, -m);
    // Only milestones inside this cycle that have already come round. A
    // milestone landing on (or before) the day the token was issued never
    // fires — reconnecting must not immediately warn about the new token.
    if (fireDay <= cycleStart) continue;
    const firedAt = at9am(fireDay);
    if (firedAt > now) continue;
    out.push({
      id: `${c.id}-${c.connectedAt}-pre-${m}`,
      scannerId: c.id,
      scannerName: c.name,
      stage: `pre-${m}` as ReminderStage,
      firedAt,
      copy: copyForStage(`pre-${m}` as ReminderStage),
    });
  }

  // Post-expiry: one email + one in-app reminder every day until reconnected.
  const daysSinceExpiry = -calendarDaysUntil(expiry, now);
  for (let i = 0; i <= daysSinceExpiry; i++) {
    const day = new Date(expiry.getTime() + i * DAY_MS);
    const firedAt = at9am(day);
    if (firedAt > now) continue;
    out.push({
      id: `${c.id}-${c.connectedAt}-expired-${formatDate(day)}`,
      scannerId: c.id,
      scannerName: c.name,
      stage: 'expired',
      firedAt,
      copy: EXPIRED_COPY,
    });
  }

  return out;
}

/** Every fired reminder across every connection, newest first. */
export function allReminders(connections: ScannerConnection[], now: Date = new Date()): ScannerReminder[] {
  return connections
    .flatMap(c => remindersFor(c, now))
    .sort((a, b) => b.firedAt.getTime() - a.firedAt.getTime());
}

/**
 * The one connection worth surfacing in a banner: the most urgent scanner
 * (expired beats expiring). Null when everything is healthy — the banner
 * disappears the moment the lab reconnects.
 */
export function mostUrgentAlert(connections: ScannerConnection[], now: Date = new Date()):
  { connection: ScannerConnection; status: ConnectionStatus } | null {
  const flagged = connections
    .map(c => ({ connection: c, status: connectionStatus(c, now) }))
    .filter(x => x.status.health !== 'active')
    .sort((a, b) => a.status.businessDaysLeft - b.status.businessDaysLeft);
  return flagged[0] ?? null;
}

// ── Store ─────────────────────────────────────────────────────────────────────
const LS_KEY = 'lab.scannerConnections';

// Demo seeds, anchored to the day the portal is first opened so the states
// always read the same: one scanner inside the 3-business-day milestone, one
// already expired and chasing daily, one healthy on a 365-day token.
function seed(): ScannerConnection[] {
  const now = new Date();
  const iteroExpiry = addBusinessDays(now, 3);
  const triosExpiry = new Date(startOfDay(now).getTime() - 4 * DAY_MS);
  const meditExpiry = new Date(startOfDay(now).getTime() + 210 * DAY_MS);
  return [
    {
      id: 'scanner-itero',
      name: 'iTero Element 5D',
      brand: 'iTero',
      account: 'Smile Genius Lab · Belfast',
      tokenLifetimeDays: 30,
      connectedAt: new Date(iteroExpiry.getTime() - 30 * DAY_MS).toISOString(),
      expiresAt: iteroExpiry.toISOString(),
    },
    {
      id: 'scanner-trios',
      name: '3Shape TRIOS 5',
      brand: '3Shape',
      account: 'Smile Genius Lab · Manchester',
      tokenLifetimeDays: 7,
      connectedAt: new Date(triosExpiry.getTime() - 7 * DAY_MS).toISOString(),
      expiresAt: triosExpiry.toISOString(),
    },
    {
      id: 'scanner-medit',
      name: 'Medit i700',
      brand: 'Medit',
      account: 'Smile Genius Lab · Belfast',
      tokenLifetimeDays: 365,
      connectedAt: new Date(meditExpiry.getTime() - 365 * DAY_MS).toISOString(),
      expiresAt: meditExpiry.toISOString(),
    },
  ];
}

function load(): ScannerConnection[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as ScannerConnection[];
    }
  } catch { /* corrupt — fall back to the seeds */ }
  return seed();
}

let connections: ScannerConnection[] = load();
const listeners = new Set<() => void>();

function commit(next: ScannerConnection[]) {
  connections = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getScannerConnections(): ScannerConnection[] {
  return connections;
}

/**
 * Successful reconnect: a fresh token for the scanner's own lifetime. The new
 * cycle has no milestone behind it, so every pending reminder stops at once
 * and nothing fires again until the next cycle reaches its first milestone.
 */
export function reconnectScanner(id: string, now: Date = new Date()) {
  commit(connections.map(c => {
    if (c.id !== id) return c;
    const expiresAt = new Date(now.getTime() + c.tokenLifetimeDays * DAY_MS);
    return {
      ...c,
      connectedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastReconnectedAt: now.toISOString(),
    };
  }));
}

/** Demo affordance — wind a scanner's token to a chosen stage of the workflow. */
export function simulateStage(id: string, stage: ReminderStage, now: Date = new Date()) {
  commit(connections.map(c => {
    if (c.id !== id) return c;
    const expiry = stage === 'expired'
      ? new Date(startOfDay(now).getTime() - DAY_MS)
      : addBusinessDays(now, Number(stage.replace('pre-', '')));
    return {
      ...c,
      connectedAt: new Date(expiry.getTime() - c.tokenLifetimeDays * DAY_MS).toISOString(),
      expiresAt: expiry.toISOString(),
      lastReconnectedAt: undefined,
    };
  }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Components re-render whenever a scanner is reconnected. */
export function useScannerConnections(): ScannerConnection[] {
  return useSyncExternalStore(subscribe, getScannerConnections);
}
