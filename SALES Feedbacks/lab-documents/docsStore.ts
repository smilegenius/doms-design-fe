import { useSyncExternalStore } from 'react';
import { EU_DEFAULT, OLD_DEFAULTS, UK_DEFAULT } from './templates';

// ── Settings › Order form: lab-branded order form, conformity statement, case label ──
// Spec: "Lab-branded order form & patient statement" (11 Nov 2026), as revised
// on review: the lab's name, address and phone come from Lab info (Settings ›
// DSO Info), field emphasis is on by default, the statement is one short
// generic block (UK and/or EU) printed with the order form, and the signature
// is the signatory's typed name or a blank line for a wet-ink signature.
// Saved in this browser only (localStorage).

export type Jurisdiction = 'UK' | 'EU' | 'Both';
export type SignatureMode = 'typed' | 'blank';
export type LabelStock = '62x100' | '102x152';
export type PaperSize = 'A4' | 'Letter';

export interface Site { name: string; address: string }

/** The lab's own details, as shown in Settings › DSO Info (read-only here). */
export interface LabInfo { displayName: string; address: string; phone: string; email: string }

export interface DocsSettings extends LabInfo {
  // Branding
  brandingOn: boolean;
  logo: string | null;      // data URL
  logoWidth: number | null; // px, for the "300 px or more" hint
  mhra: string;
  damas: string;
  emphasis: boolean;        // on by default
  // Conformity statement
  statementOn: boolean;
  jurisdiction: Jurisdiction;
  ukText: string;
  euText: string;
  sites: Site[];            // EU: every manufacturing site
  authRep: Site;            // EU: authorised representative
  signerName: string;
  signerTitle: string;
  signatureMode: SignatureMode;
  // Case label (optional) and paper
  labelOn: boolean;
  labelStock: LabelStock;
  paper: PaperSize;
}

/**
 * Settings › DSO Info. Its values live inside the portal's SettingsPage (not
 * exported), so they're mirrored here. It has no email field yet, so the
 * email line is left off.
 */
export const LAB_INFO: LabInfo = {
  displayName: 'Smile Genius',
  address: '1 Smile Lane\nLondon\nSW1A 1AA\nUnited Kingdom',
  phone: '+44 20 7946 0123',
  email: '',
};

export const DEFAULT_SETTINGS: DocsSettings = {
  ...LAB_INFO,
  brandingOn: false, logo: null, logoWidth: null, mhra: '', damas: '', emphasis: true,
  statementOn: false, jurisdiction: 'UK', ukText: UK_DEFAULT, euText: EU_DEFAULT,
  sites: [], authRep: { name: '', address: '' },
  signerName: '', signerTitle: '', signatureMode: 'typed',
  labelOn: false, labelStock: '62x100', paper: 'A4',
};

const LS_KEY = 'salesFeedbacks.docs.v2';
function load(): DocsSettings {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (p) {
      // Unedited wording follows the current standard text (it now cites the exact clauses).
      if (OLD_DEFAULTS.includes(p.ukText)) p.ukText = UK_DEFAULT;
      if (OLD_DEFAULTS.includes(p.euText)) p.euText = EU_DEFAULT;
      return { ...DEFAULT_SETTINGS, ...p, ...LAB_INFO };
    }
  } catch { /* corrupt or blocked */ }
  return DEFAULT_SETTINGS;
}
let settings: DocsSettings = load();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useDocs(): DocsSettings { return useSyncExternalStore(subscribe, () => settings); }
export function getDocs(): DocsSettings { return settings; }
export function saveDocs(next: DocsSettings) {
  settings = { ...next, ...LAB_INFO };
  try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch { /* keep in memory (a big logo can exceed the quota) */ }
  listeners.forEach(l => l());
}
export function resetDocsDemo() { saveDocs(DEFAULT_SETTINGS); }
