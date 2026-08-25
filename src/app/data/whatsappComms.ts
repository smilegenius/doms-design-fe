import { useSyncExternalStore } from 'react';
import type { ScoringEmailCategory } from './caseScoringEmails';

// ─── Lab WhatsApp communication ──────────────────────────────────────────────
// The lab can talk to dentists over WhatsApp as well as email — automatically
// (the same case-scoring events that fire an automated email) and manually
// (from a case's Conversation hub). Both routes send from the lab's OWN
// connected WhatsApp Business number, never from a Smile Genius number.
//
// Two gates govern every send, and they are deliberately separate:
//   • `enabled` — the lab's WhatsApp communication SETTING. Off means no
//     WhatsApp leaves the platform at all, automated or manual.
//   • `connection` — whether a WhatsApp Business account is actually linked.
//     A lab can have the setting on and the account disconnected; that is the
//     failure case the spec asks to be recorded rather than silently dropped.

// ── Connection ────────────────────────────────────────────────────────────────
export interface WhatsAppConnection {
  status: 'connected' | 'disconnected';
  /** WhatsApp Business display name shown to the recipient. */
  businessName?: string;
  /** The sender — the number every message goes out from. */
  number?: string;
  connectedAt?: string; // ISO
  /** Remembered after a disconnect so "Reconnect" restores the same account. */
  lastBusinessName?: string;
  lastNumber?: string;
}

// The mock WhatsApp Business account the embedded-signup simulation links.
export const MOCK_LAB_WHATSAPP_NAME = 'Smile Genius Lab';
export const MOCK_LAB_WHATSAPP_NUMBER = '+44 7700 900482';

// ── Templates ─────────────────────────────────────────────────────────────────
// WhatsApp messages carry no subject line and are read on a phone, so the
// bodies are deliberately short — the case link does the heavy lifting.
// Placeholders are the same set the email templates use, resolved at send time.
export const WHATSAPP_PLACEHOLDERS = [
  'Dentist Name',
  'Patient Name',
  'Case ID',
  'Service Name',
  'Missing Items Summary',
  'Case Link',
  'Lab Name',
];

export interface WhatsAppTemplate {
  id: string;
  name: string;
  /** Professional / Friendly for defaults; 'Custom' for lab-written ones. */
  tone: string;
  body: string;
  custom?: boolean;
  updatedAt?: string; // ISO — custom templates only
}

export const DEFAULT_WHATSAPP_TEMPLATES: Record<ScoringEmailCategory, WhatsAppTemplate[]> = {
  'needs-review': [
    {
      id: 'wa-nr-1',
      name: 'Default Message 1',
      tone: 'Professional',
      body: `Hi {{Dentist Name}}, this is {{Lab Name}}.

Case {{Case ID}} ({{Patient Name}} — {{Service Name}}) needs a quick review before we can start production:

{{Missing Items Summary}}

You can update the case here: {{Case Link}}

Thank you.`,
    },
    {
      id: 'wa-nr-2',
      name: 'Default Message 2',
      tone: 'Friendly',
      body: `Hi {{Dentist Name}} 👋 {{Lab Name}} here.

We have had a look at {{Case ID}} for {{Patient Name}} and just need a couple of things from you:

{{Missing Items Summary}}

Update the case here whenever you get a moment: {{Case Link}}`,
    },
  ],
  incomplete: [
    {
      id: 'wa-inc-1',
      name: 'Default Message 1',
      tone: 'Professional',
      body: `Hi {{Dentist Name}}, this is {{Lab Name}}.

Case {{Case ID}} ({{Patient Name}} — {{Service Name}}) is on hold: required information is missing.

{{Missing Items Summary}}

Production cannot begin until these are provided: {{Case Link}}

Thank you.`,
    },
    {
      id: 'wa-inc-2',
      name: 'Default Message 2',
      tone: 'Friendly',
      body: `Hi {{Dentist Name}} — {{Lab Name}} here.

We cannot start {{Case ID}} for {{Patient Name}} just yet, a few required details are missing:

{{Missing Items Summary}}

Send them over here and we will get straight on it: {{Case Link}}`,
    },
  ],
};

/** Resolve {{Placeholder}} tokens from a case. Shared by both channels. */
export function fillTemplateVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, k) => vars[String(k).trim()] ?? `{{${k}}}`);
}

// ── Recipient numbers ─────────────────────────────────────────────────────────
// The prototype has no contact store, so a recipient's WhatsApp number is
// derived from their name — stable across renders, which is all the UI needs.
// A real integration reads this off the clinic contact record.
export function whatsappNumberFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const block = String(100000 + (hash % 900000));
  return `+44 7${String(700 + (hash % 100))} ${block.slice(0, 3)} ${block.slice(3)}`;
}

/** WhatsApp numbers are typed by hand in the composer — validate loosely. */
export function isValidWhatsAppNumber(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return /^\+?[\d\s()-]+$/.test(value.trim()) && digits.length >= 10 && digits.length <= 15;
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface WhatsAppCategoryAutomation {
  /** Whether this scoring outcome also sends a WhatsApp message. */
  enabled: boolean;
  /** Exactly ONE message per outcome — a default id or a custom template id. */
  templateId: string;
}

export interface WhatsAppSettings {
  /** The lab's WhatsApp communication setting — the master switch. */
  enabled: boolean;
  connection: WhatsAppConnection;
  automation: Record<ScoringEmailCategory, WhatsAppCategoryAutomation>;
  customTemplates: WhatsAppTemplate[];
}

const DEFAULT_SETTINGS: WhatsAppSettings = {
  enabled: true,
  connection: { status: 'disconnected' },
  automation: {
    'needs-review': { enabled: false, templateId: 'wa-nr-1' },
    incomplete:     { enabled: false, templateId: 'wa-inc-1' },
  },
  customTemplates: [],
};

const LS_KEY = 'lab.whatsappComms';

function load(): WhatsAppSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WhatsAppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      connection: { ...DEFAULT_SETTINGS.connection, ...(parsed.connection ?? {}) },
      automation: {
        'needs-review': { ...DEFAULT_SETTINGS.automation['needs-review'], ...(parsed.automation?.['needs-review'] ?? {}) },
        incomplete:     { ...DEFAULT_SETTINGS.automation.incomplete,     ...(parsed.automation?.incomplete ?? {}) },
      },
      customTemplates: Array.isArray(parsed.customTemplates) ? parsed.customTemplates : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let settings: WhatsAppSettings = load();
const listeners = new Set<() => void>();

function commit(next: WhatsAppSettings) {
  settings = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getWhatsAppSettings(): WhatsAppSettings {
  return settings;
}

// ── Availability ──────────────────────────────────────────────────────────────
export type WhatsAppBlockReason = 'disabled' | 'disconnected' | null;

export function isWhatsAppConnected(): boolean {
  return settings.connection.status === 'connected';
}

/**
 * Why WhatsApp cannot be used right now, or null when it can. Callers branch on
 * this rather than on the two flags, so the automated and manual routes apply
 * exactly the same rules.
 */
export function whatsappBlockReason(s: WhatsAppSettings = settings): WhatsAppBlockReason {
  if (!s.enabled) return 'disabled';
  if (s.connection.status !== 'connected') return 'disconnected';
  return null;
}

export function isWhatsAppAvailable(s: WhatsAppSettings = settings): boolean {
  return whatsappBlockReason(s) === null;
}

export const BLOCK_REASON_TEXT: Record<Exclude<WhatsAppBlockReason, null>, string> = {
  disabled: 'WhatsApp communication is turned off for this lab.',
  disconnected: 'No WhatsApp Business account is connected.',
};

// ── Actions ───────────────────────────────────────────────────────────────────
export function setWhatsAppEnabled(enabled: boolean) {
  commit({ ...settings, enabled });
}

export function connectWhatsApp(number: string = MOCK_LAB_WHATSAPP_NUMBER, businessName: string = MOCK_LAB_WHATSAPP_NAME) {
  commit({
    ...settings,
    connection: {
      status: 'connected',
      businessName,
      number,
      connectedAt: new Date().toISOString(),
      lastBusinessName: businessName,
      lastNumber: number,
    },
  });
}

export function disconnectWhatsApp() {
  const { businessName, number } = settings.connection;
  commit({
    ...settings,
    connection: {
      status: 'disconnected',
      lastBusinessName: businessName ?? settings.connection.lastBusinessName,
      lastNumber: number ?? settings.connection.lastNumber,
    },
  });
}

export function reconnectWhatsApp() {
  const { lastNumber, lastBusinessName } = settings.connection;
  connectWhatsApp(lastNumber ?? MOCK_LAB_WHATSAPP_NUMBER, lastBusinessName ?? MOCK_LAB_WHATSAPP_NAME);
}

export function setWhatsAppAutomationEnabled(category: ScoringEmailCategory, enabled: boolean) {
  commit({
    ...settings,
    automation: { ...settings.automation, [category]: { ...settings.automation[category], enabled } },
  });
}

export function selectWhatsAppTemplate(category: ScoringEmailCategory, templateId: string) {
  commit({
    ...settings,
    automation: { ...settings.automation, [category]: { ...settings.automation[category], templateId } },
  });
}

export function addCustomWhatsAppTemplate(input: { name: string; body: string }): WhatsAppTemplate {
  const tpl: WhatsAppTemplate = {
    id: `wa-custom-${Date.now()}`,
    name: input.name.trim(),
    tone: 'Custom',
    body: input.body,
    custom: true,
    updatedAt: new Date().toISOString(),
  };
  commit({ ...settings, customTemplates: [...settings.customTemplates, tpl] });
  return tpl;
}

export function updateCustomWhatsAppTemplate(id: string, patch: { name?: string; body?: string }) {
  commit({
    ...settings,
    customTemplates: settings.customTemplates.map(t =>
      t.id === id ? { ...t, ...patch, name: (patch.name ?? t.name).trim(), updatedAt: new Date().toISOString() } : t
    ),
  });
}

export function removeCustomWhatsAppTemplate(id: string) {
  // A deleted template cannot stay selected — fall the outcome back to its default.
  const automation = { ...settings.automation };
  (Object.keys(automation) as ScoringEmailCategory[]).forEach(cat => {
    if (automation[cat].templateId === id) {
      automation[cat] = { ...automation[cat], templateId: DEFAULT_WHATSAPP_TEMPLATES[cat][0].id };
    }
  });
  commit({ ...settings, customTemplates: settings.customTemplates.filter(t => t.id !== id), automation });
}

// ── Lookups ───────────────────────────────────────────────────────────────────
export function whatsappTemplatesFor(
  category: ScoringEmailCategory,
  custom: WhatsAppTemplate[] = settings.customTemplates,
): WhatsAppTemplate[] {
  return [...DEFAULT_WHATSAPP_TEMPLATES[category], ...custom];
}

export function findWhatsAppTemplate(
  category: ScoringEmailCategory,
  templateId: string,
  custom: WhatsAppTemplate[] = settings.customTemplates,
): WhatsAppTemplate {
  return whatsappTemplatesFor(category, custom).find(t => t.id === templateId) ?? DEFAULT_WHATSAPP_TEMPLATES[category][0];
}

// ── Reactive read ─────────────────────────────────────────────────────────────
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useWhatsAppComms(): WhatsAppSettings {
  return useSyncExternalStore(subscribe, getWhatsAppSettings);
}
