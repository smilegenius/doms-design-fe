// ─── Lab Settings › Order Form ───────────────────────────────────────────────
// What a lab can set up on the new Dental Order Form (12-Nov-2026, from the
// Growth team's Settings › Order form, rebuilt in our components):
//   · Branding: the lab's logo in the form's header ("Powered by Smile Genius"
//     moves to the foot), MHRA and DAMAS numbers, field emphasis, paper size.
//   · Conformity statement: one short UK and/or EU statement for a custom-made
//     device at the bottom of the form, signed with a typed name or a blank
//     line for ink.
//   · Sections: the foot's how-to video, help and duplicate check.
// The lab's name and address come from the case (its lab), so they match the
// form's Lab box. Saved in this browser (localStorage). OrderFormSheet reads it;
// the Settings tab passes its unsaved draft for the live preview.

import { useSyncExternalStore } from 'react';

export type Jurisdiction = 'UK' | 'EU' | 'Both';
export type SignatureMode = 'typed' | 'image' | 'blank';
export type PaperSize = 'A4' | 'Letter';
/** Label stock for the case label: a 62 mm roll (most label printers) or a 4 × 6 in shipping label. */
export type LabelStock = '62x100' | '102x152';

export interface Site { name: string; address: string }

export interface OrderFormSettings {
  // Branding
  logo: string | null;      // data URL
  logoWidth: number | null; // px, for the "300 px or more prints sharper" hint
  showLogo: boolean;
  mhra: string;
  damas: string;
  emphasis: boolean;
  paper: PaperSize;
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
  /** 13-Nov: the full statement for a custom-made device, filled in from the case, as page 2 of the order form. */
  fullStatementOn: boolean;
  signatureImage: string | null; // data URL, for signatureMode 'image'
  // Sections at the foot of the form
  showHowTo: boolean;
  showHelp: boolean;
  showDuplicateCheck: boolean;
  // Case label (12-Nov, optional): Print label beside the order form's Print, for the outgoing box
  labelOn: boolean;
  labelStock: LabelStock;
}

/** Filled in from the case when the form is drawn. */
export const TOKENS: { token: string; label: string }[] = [
  { token: '{{lab.name}}', label: 'Lab name' },
  { token: '{{lab.address}}', label: 'Lab address' },
  { token: '{{lab.sites}}', label: 'Manufacturing sites' },
  { token: '{{lab.authRep}}', label: 'EU authorised representative' },
  { token: '{{patient}}', label: 'Patient' },
  { token: '{{prescriber}}', label: 'Prescriber' },
  { token: '{{practice}}', label: 'Practice' },
  { token: '{{caseId}}', label: 'Order ID' },
];

export const UK_DEFAULT =
  'This is a custom-made medical device, made by {{lab.name}}, {{lab.address}}, to the prescription of {{prescriber}} of {{practice}}, ' +
  'with the design characteristics specified on this form (order {{caseId}}), for the exclusive use of {{patient}}. It conforms to the requirements for ' +
  'custom-made devices of the UK Medical Devices Regulations 2002 (SI 2002 No 618, as amended), except where stated on this form. ' +
  'A full statement is available from {{lab.name}} on request.';

export const EU_DEFAULT =
  'This is a custom-made device under Regulation (EU) 2017/745 on medical devices (EU MDR), made by {{lab.name}}, {{lab.address}}, at {{lab.sites}}, ' +
  'to the prescription of {{prescriber}} of {{practice}}, with the specific characteristics set out on this form (order {{caseId}}), for the exclusive use of {{patient}}. ' +
  'It conforms to the general safety and performance requirements of the Regulation, except where stated on this form, and contains no medicinal substance and no tissues ' +
  'or cells of human or animal origin. EU authorised representative: {{lab.authRep}}. A full statement is available from {{lab.name}} on request.';

export const DEFAULT_ORDER_FORM_SETTINGS: OrderFormSettings = {
  logo: null, logoWidth: null, showLogo: false, mhra: '', damas: '', emphasis: true, paper: 'A4',
  statementOn: false, jurisdiction: 'UK', ukText: UK_DEFAULT, euText: EU_DEFAULT,
  sites: [], authRep: { name: '', address: '' },
  signerName: '', signerTitle: '', signatureMode: 'typed', signatureImage: null, fullStatementOn: false,
  showHowTo: true, showHelp: true, showDuplicateCheck: true,
  labelOn: true, labelStock: '62x100',
};

/** A handwriting face for the typed signature: system fonts only, as the form (and its PDF) uses no web fonts. */
export const SIGNATURE_FONT = "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";

/** The case label's stock: the page it prints on and the label drawn inside its 3 mm margin. */
export const LABEL_STOCK: Record<LabelStock, { label: string; page: { w: number; h: number }; w: number; h: number }> = {
  '62x100': { label: '62 × 100 mm', page: { w: 62, h: 100 }, w: 56, h: 94 },
  '102x152': { label: '102 × 152 mm (4 × 6 in)', page: { w: 102, h: 152 }, w: 96, h: 146 },
};

/** The printable area inside the 10 mm margins, in mm (a little short of the page, so rounding never adds one). */
export const PAPER: Record<PaperSize, { label: string; w: number; h: number; inner: { w: number; h: number } }> = {
  A4: { label: 'A4', w: 210, h: 297, inner: { w: 190, h: 274 } },
  Letter: { label: 'US Letter', w: 215.9, h: 279.4, inner: { w: 195.9, h: 256 } },
};

// ─── Rules ───────────────────────────────────────────────────────────────────

/** Why EU (or UK and EU) can't be picked yet, or null. */
export function euBlocker(s: Pick<OrderFormSettings, 'sites' | 'authRep'>): string | null {
  const sites = s.sites.some(x => x.name.trim() && x.address.trim());
  const rep = s.authRep.name.trim() && s.authRep.address.trim();
  return sites && rep ? null : 'An EU statement names every manufacturing site and your EU authorised representative.';
}

/** What stops Save, checked on the settings page rather than at the printer. */
export function saveErrors(s: OrderFormSettings): string[] {
  const out: string[] = [];
  if (s.showLogo && !s.logo) out.push('Upload a logo to show it on the form.');
  if (s.statementOn) {
    if (!s.signerName.trim()) out.push('Add the name of the person who signs the statement.');
    if (s.signatureMode === 'image' && !s.signatureImage) out.push('Upload a signature image, or choose a typed signature or a blank line.');
    if (s.jurisdiction !== 'UK' && euBlocker(s)) out.push(euBlocker(s)!);
    if (s.jurisdiction !== 'EU' && !s.ukText.trim()) out.push('The UK statement is empty.');
    if (s.jurisdiction !== 'UK' && !s.euText.trim()) out.push('The EU statement is empty.');
  }
  if (s.fullStatementOn && !s.statementOn && !s.signerName.trim()) out.push('Add the name of the person who signs the full statement.');
  if (s.fullStatementOn && s.jurisdiction !== 'UK' && !s.statementOn && euBlocker(s)) out.push(euBlocker(s)!);
  return out;
}

export const jurisdictions = (j: Jurisdiction): ('UK' | 'EU')[] => (j === 'Both' ? ['UK', 'EU'] : [j]);

const oneLine = (a: string) => a.split('\n').map(x => x.trim()).filter(Boolean).join(', ');

/** The statement with its {{tokens}} filled from the case. */
export function fillTokens(
  text: string,
  m: { id: string; patient: string; prescriber: string; practice: string; labName: string; labAddress: string },
  s: OrderFormSettings,
): string {
  const map: Record<string, string> = {
    'lab.name': m.labName,
    'lab.address': oneLine(m.labAddress),
    'lab.sites': s.sites.filter(x => x.name.trim()).map(x => `${x.name} (${oneLine(x.address)})`).join('; '),
    'lab.authRep': s.authRep.name.trim() ? `${s.authRep.name}, ${oneLine(s.authRep.address)}` : '',
    patient: m.patient,
    prescriber: m.prescriber,
    practice: m.practice,
    caseId: m.id,
  };
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, k: string) => map[k] ?? '');
}

// ─── Store ───────────────────────────────────────────────────────────────────

const LS_KEY = 'orderFormSettings.v1';

function load(): OrderFormSettings {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null');
    if (p) return { ...DEFAULT_ORDER_FORM_SETTINGS, ...p };
  } catch { /* corrupt or blocked */ }
  return DEFAULT_ORDER_FORM_SETTINGS;
}

let current: OrderFormSettings = load();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useOrderFormSettings(): OrderFormSettings {
  return useSyncExternalStore(subscribe, () => current);
}

/** Saved; returns false when the browser couldn't keep it (a big logo can exceed the quota), though this tab still uses it. */
export function saveOrderFormSettings(next: OrderFormSettings): boolean {
  current = next;
  let kept = true;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { kept = false; }
  listeners.forEach(l => l());
  return kept;
}
