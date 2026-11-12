import type { Case } from '../../src/app/pages/CasesPage';
import type { DocsSettings, Jurisdiction } from './docsStore';

// ── Rules for Settings › Order form ───────────────────────────────────────────

/** Why EU or Both is unavailable, or null. */
export function euBlocker(s: Pick<DocsSettings, 'sites' | 'authRep'>): string | null {
  const sites = s.sites.filter(x => x.name.trim() && x.address.trim()).length;
  const rep = s.authRep.name.trim() && s.authRep.address.trim();
  if (sites && rep) return null;
  return 'An EU statement must name every manufacturing site and your EU authorised representative.';
}

/** Problems that stop the settings page from saving (checked on save, not at the printer). */
export function saveErrors(s: DocsSettings): string[] {
  const out: string[] = [];
  if (s.brandingOn && !s.logo) out.push('Upload a logo to show it on the form.');
  if (s.statementOn) {
    if (!s.signerName.trim()) out.push('Add the name of the person who signs the statement.');
    if (s.jurisdiction !== 'UK' && euBlocker(s)) out.push(euBlocker(s)!);
    if (s.jurisdiction !== 'EU' && !s.ukText.trim()) out.push('The UK statement is empty.');
    if (s.jurisdiction !== 'UK' && !s.euText.trim()) out.push('The EU statement is empty.');
  }
  return out;
}

export const jurisdictions = (j: Jurisdiction): ('UK' | 'EU')[] => (j === 'Both' ? ['UK', 'EU'] : [j]);

// Demo practice addresses (the prototype's cases carry the practice name only).
const PRACTICE_ADDRESS: Record<string, string> = {
  'Smile Genius Manchester': '12 Deansgate, Manchester M3 2BW',
  'Smile Genius Birmingham': '88 Colmore Row, Birmingham B3 2AB',
  'Smile Genius London': '210 Marylebone Road, London NW1 5LS',
  'Smile Genius Dublin': '14 Merrion Square, Dublin 2, D02 X285, Ireland',
};
export const practiceAddress = (practice: string) => PRACTICE_ADDRESS[practice];

/** What stops a statement for this case (the order form still prints). */
export function caseBlockers(c: Case, s: DocsSettings): string[] {
  const out: string[] = [];
  if (!c.patientName?.trim()) out.push('The case has no patient name.');
  if (!c.dentist?.trim() || !c.practice?.trim()) out.push('The case has no prescriber or practice.');
  if (!s.signerName.trim()) out.push('No signatory in Settings › Order form.');
  return out;
}

const oneLine = (a: string) => a.split('\n').map(x => x.trim()).filter(Boolean).join(', ');

/** Fill the statement's {{tokens}}. */
export function fillTokens(text: string, c: Case, s: DocsSettings): string {
  const map: Record<string, string> = {
    'lab.name': s.displayName || c.lab,
    'lab.address': oneLine(s.address),
    'lab.sites': s.sites.filter(x => x.name.trim()).map(x => `${x.name} (${oneLine(x.address)})`).join('; '),
    'lab.authRep': s.authRep.name.trim() ? `${s.authRep.name}, ${oneLine(s.authRep.address)}` : '',
    patient: c.patientName,
    prescriber: c.dentist,
    practice: [c.practice, practiceAddress(c.practice)].filter(Boolean).join(', '),
    caseId: c.id,
  };
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, k: string) => map[k] ?? '');
}

/** Place of issue: the lab's town from Lab info. */
export const placeOfIssue = (s: DocsSettings) => s.address.split('\n').map(x => x.trim()).filter(Boolean)[1] ?? oneLine(s.address);

/** Download filename: case ID, patient surname, document type. */
export const docFileName = (c: Case, type: string) => `${c.id}_${(c.patientName.trim().split(/\s+/).pop() ?? 'patient').replace(/[^\w-]/g, '')}_${type}`;
