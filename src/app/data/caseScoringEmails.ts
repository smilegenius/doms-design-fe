import { useSyncExternalStore } from 'react';
import type { ScoreTierId } from './caseScoring';

// ─── Automated Case Scoring Emails ───────────────────────────────────────────
// When a case is scored "Needs Review" or "Incomplete", the lab can auto-email
// the dentist from its OWN business email account (Google Workspace or
// Microsoft 365) instead of from Smile Genius. This module holds the whole
// feature's state — the mailbox connection, the per-outcome automation
// toggles, the selected template per outcome, and the lab's custom templates —
// in a localStorage-backed store shared by Settings, the case pages and the
// create-case flow. "Complete" cases never send an email, so they have no
// configuration here at all.

// ── Providers ─────────────────────────────────────────────────────────────────
export type EmailProvider = 'google' | 'microsoft';

export const PROVIDER_META: Record<EmailProvider, { label: string; product: string; color: string; oauth: string }> = {
  google:    { label: 'Google Workspace', product: 'Gmail',   color: '#EA4335', oauth: 'OAuth via Google' },
  microsoft: { label: 'Microsoft 365',    product: 'Outlook', color: '#0078D4', oauth: 'OAuth via Microsoft' },
};

// The mock business address the OAuth simulation "signs in" with.
export const MOCK_LAB_EMAIL = 'cases@smilegeniuslab.co.uk';

// ── Scoring outcomes that can trigger an email ───────────────────────────────
// Maps onto the scoring tiers: the amber "Need Attention" band is what the
// email feature calls "Needs Review"; the red band is "Incomplete". The green
// "Complete" band is deliberately absent — no email is ever sent for it.
export type ScoringEmailCategory = 'needs-review' | 'incomplete';

export const CATEGORY_META: Record<ScoringEmailCategory, { label: string; dot: string; description: string }> = {
  'needs-review': {
    label: 'Needs Review',
    dot: '#F59E0B',
    description: 'Sent when a case is scored in the amber band — items need the dentist’s attention before production can begin.',
  },
  incomplete: {
    label: 'Incomplete',
    dot: '#EF4444',
    description: 'Sent when a case is scored in the red band — required information is missing and production cannot begin.',
  },
};

// Which email category (if any) a score tier triggers. 'complete' → null.
export function categoryForTier(tier: ScoreTierId): ScoringEmailCategory | null {
  if (tier === 'attention') return 'needs-review';
  if (tier === 'incomplete') return 'incomplete';
  return null;
}

// ── Templates ─────────────────────────────────────────────────────────────────
// Placeholders are resolved at send time from the case being scored.
export const SCORING_EMAIL_PLACEHOLDERS = [
  'Dentist Name',
  'Patient Name',
  'Case ID',
  'Service Name',
  'Missing Items Summary',
  'Case Link',
  'Lab Name',
];

export interface ScoringEmailTemplate {
  id: string;
  name: string;
  /** Professional / Friendly / Urgent for defaults; 'Custom' for user-created. */
  tone: string;
  subject: string;
  body: string;
  custom?: boolean;
  updatedAt?: string; // ISO — custom templates only
}

// The three default templates per category — copy is the product spec's,
// verbatim. Defaults are immutable; the lab customises via Custom Templates.
export const DEFAULT_TEMPLATES: Record<ScoringEmailCategory, ScoringEmailTemplate[]> = {
  'needs-review': [
    {
      id: 'nr-default-1',
      name: 'Default Template 1',
      tone: 'Professional',
      subject: 'Your Case Requires Review',
      body: `Hi {{Dentist Name}},

We've completed an initial review of your case and identified a few items that require your attention before production can begin.

Patient: {{Patient Name}}
Case ID: {{Case ID}}
Service: {{Service Name}}

Missing Items
{{Missing Items Summary}}

Please review the missing items and update your case at your earliest convenience to avoid delays in production.

Review Case: {{Case Link}}

If you have any questions, simply reply to this email.

Kind regards,
{{Lab Name}}`,
    },
    {
      id: 'nr-default-2',
      name: 'Default Template 2',
      tone: 'Friendly',
      subject: 'A Quick Review is Needed for Your Case',
      body: `Hi {{Dentist Name}},

We've reviewed your case and noticed a few items that need your attention before we can begin production.

Patient: {{Patient Name}}
Case ID: {{Case ID}}
Service: {{Service Name}}

Missing Items
{{Missing Items Summary}}

You can review and update your case using the link below.

Review Case: {{Case Link}}

Once updated, we'll continue processing your case as quickly as possible.

Thank you,
{{Lab Name}}`,
    },
    {
      id: 'nr-default-3',
      name: 'Default Template 3',
      tone: 'Urgent',
      subject: 'Action Required: Your Case Requires Review',
      body: `Hi {{Dentist Name}},

Your case requires additional review before production can begin.

Patient: {{Patient Name}}
Case ID: {{Case ID}}
Service: {{Service Name}}

Missing Items
{{Missing Items Summary}}

Please review and update the requested information as soon as possible to help us meet the expected delivery timeline.

Review Case: {{Case Link}}

If you require any assistance, please contact us.

Regards,
{{Lab Name}}`,
    },
  ],
  incomplete: [
    {
      id: 'inc-default-1',
      name: 'Default Template 1',
      tone: 'Professional',
      subject: 'Additional Information Required to Proceed with Your Case',
      body: `Hi {{Dentist Name}},

We've reviewed your case and found that some required information is missing. We are unable to begin production until the missing information has been provided.

Patient: {{Patient Name}}
Case ID: {{Case ID}}
Service: {{Service Name}}

Missing Items
{{Missing Items Summary}}

Please update the required information using the link below.

View Case: {{Case Link}}

Once the missing information has been submitted, we'll continue processing your case.

Kind regards,
{{Lab Name}}`,
    },
    {
      id: 'inc-default-2',
      name: 'Default Template 2',
      tone: 'Friendly',
      subject: 'Your Case Needs a Few More Details',
      body: `Hi {{Dentist Name}},

Before we can begin working on your case, we need a few additional details.

Patient: {{Patient Name}}
Case ID: {{Case ID}}
Service: {{Service Name}}

Missing Items
{{Missing Items Summary}}

Please review and update the missing information using the link below.

View Case: {{Case Link}}

As soon as the information is provided, we'll continue processing your case.

Thank you,
{{Lab Name}}`,
    },
    {
      id: 'inc-default-3',
      name: 'Default Template 3',
      tone: 'Urgent',
      subject: 'Action Required: Your Case is Incomplete',
      body: `Hi {{Dentist Name}},

Your case cannot proceed because required information is still missing.

Patient: {{Patient Name}}
Case ID: {{Case ID}}
Service: {{Service Name}}

Missing Items
{{Missing Items Summary}}

Please provide the missing information as soon as possible to avoid delays in production.

View Case: {{Case Link}}

If you need any assistance, please get in touch with us.

Regards,
{{Lab Name}}`,
    },
  ],
};

// ── Settings state ────────────────────────────────────────────────────────────
export interface EmailConnection {
  status: 'connected' | 'disconnected';
  provider?: EmailProvider;
  email?: string;
  connectedAt?: string; // ISO
  /** Remembered after a disconnect so "Reconnect" restores the same account. */
  lastProvider?: EmailProvider;
  lastEmail?: string;
}

export interface CategoryAutomation {
  /** Whether a scored case in this category automatically emails the dentist. */
  enabled: boolean;
  /** Exactly ONE template per category — a default id or a custom template id. */
  templateId: string;
}

export interface CaseScoringEmailSettings {
  connection: EmailConnection;
  automation: Record<ScoringEmailCategory, CategoryAutomation>;
  customTemplates: ScoringEmailTemplate[];
}

const DEFAULT_SETTINGS: CaseScoringEmailSettings = {
  connection: { status: 'disconnected' },
  automation: {
    'needs-review': { enabled: true, templateId: 'nr-default-1' },
    incomplete:     { enabled: true, templateId: 'inc-default-1' },
  },
  customTemplates: [],
};

const LS_KEY = 'lab.caseScoringEmails';

function load(): CaseScoringEmailSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // Merge over defaults so newly-added keys survive older saved payloads.
    return {
      connection: { ...DEFAULT_SETTINGS.connection, ...(parsed.connection ?? {}) },
      automation: {
        'needs-review': { ...DEFAULT_SETTINGS.automation['needs-review'], ...(parsed.automation?.['needs-review'] ?? {}) },
        incomplete:     { ...DEFAULT_SETTINGS.automation.incomplete,      ...(parsed.automation?.incomplete ?? {}) },
      },
      customTemplates: Array.isArray(parsed.customTemplates) ? parsed.customTemplates : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let settings: CaseScoringEmailSettings = load();
const listeners = new Set<() => void>();

function commit(next: CaseScoringEmailSettings) {
  settings = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getScoringEmailSettings(): CaseScoringEmailSettings {
  return settings;
}

export function isEmailConnected(): boolean {
  return settings.connection.status === 'connected';
}

// ── Connection lifecycle ──────────────────────────────────────────────────────
export function connectEmail(provider: EmailProvider, email: string = MOCK_LAB_EMAIL) {
  commit({
    ...settings,
    connection: {
      status: 'connected',
      provider,
      email,
      connectedAt: new Date().toISOString(),
      lastProvider: provider,
      lastEmail: email,
    },
  });
}

export function disconnectEmail() {
  const { lastProvider, lastEmail, provider, email } = settings.connection;
  commit({
    ...settings,
    connection: {
      status: 'disconnected',
      lastProvider: provider ?? lastProvider,
      lastEmail: email ?? lastEmail,
    },
  });
}

/** One-click restore of the previously connected account. */
export function reconnectEmail() {
  const { lastProvider, lastEmail } = settings.connection;
  if (!lastProvider) return;
  connectEmail(lastProvider, lastEmail ?? MOCK_LAB_EMAIL);
}

// ── Automation config ─────────────────────────────────────────────────────────
export function setAutomationEnabled(category: ScoringEmailCategory, enabled: boolean) {
  commit({
    ...settings,
    automation: { ...settings.automation, [category]: { ...settings.automation[category], enabled } },
  });
}

export function selectTemplate(category: ScoringEmailCategory, templateId: string) {
  commit({
    ...settings,
    automation: { ...settings.automation, [category]: { ...settings.automation[category], templateId } },
  });
}

// ── Custom templates ──────────────────────────────────────────────────────────
export function addCustomTemplate(input: { name: string; subject: string; body: string }): ScoringEmailTemplate {
  const tpl: ScoringEmailTemplate = {
    id: `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim() || 'Custom Template',
    tone: 'Custom',
    subject: input.subject,
    body: input.body,
    custom: true,
    updatedAt: new Date().toISOString(),
  };
  commit({ ...settings, customTemplates: [...settings.customTemplates, tpl] });
  return tpl;
}

export function updateCustomTemplate(id: string, patch: { name?: string; subject?: string; body?: string }) {
  commit({
    ...settings,
    customTemplates: settings.customTemplates.map(t =>
      t.id === id ? { ...t, ...patch, name: (patch.name ?? t.name).trim() || t.name, updatedAt: new Date().toISOString() } : t
    ),
  });
}

export function removeCustomTemplate(id: string) {
  // A category pointing at the deleted template falls back to its Default 1.
  const automation = { ...settings.automation };
  if (automation['needs-review'].templateId === id) automation['needs-review'] = { ...automation['needs-review'], templateId: 'nr-default-1' };
  if (automation.incomplete.templateId === id)      automation.incomplete      = { ...automation.incomplete,      templateId: 'inc-default-1' };
  commit({ ...settings, automation, customTemplates: settings.customTemplates.filter(t => t.id !== id) });
}

// ── Lookups ───────────────────────────────────────────────────────────────────
/** All selectable templates for a category: the 3 defaults + every custom. */
export function templatesForCategory(category: ScoringEmailCategory, custom: ScoringEmailTemplate[] = settings.customTemplates): ScoringEmailTemplate[] {
  return [...DEFAULT_TEMPLATES[category], ...custom];
}

export function findTemplate(category: ScoringEmailCategory, templateId: string, custom: ScoringEmailTemplate[] = settings.customTemplates): ScoringEmailTemplate {
  return templatesForCategory(category, custom).find(t => t.id === templateId)
    ?? DEFAULT_TEMPLATES[category][0];
}

// ── Reactive read ─────────────────────────────────────────────────────────────
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Components re-render whenever the connection, automation or templates change. */
export function useCaseScoringEmails(): CaseScoringEmailSettings {
  return useSyncExternalStore(subscribe, getScoringEmailSettings);
}
