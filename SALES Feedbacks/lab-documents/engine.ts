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

// Demo practice addresses: the prototype's cases carry the practice name only
// (the case page shows "Ship to Address: —"). In the product these come from
// the practice record. Lines: street, town, postcode.
const PRACTICE_ADDRESS: Record<string, string[]> = {
  'Smile Genius Manchester': ['12 Deansgate', 'Manchester', 'M3 2BW'],
  'Smile Genius London Central': ['210 Marylebone Road', 'London', 'NW1 5LS'],
  'Smile Genius London': ['210 Marylebone Road', 'London', 'NW1 5LS'],
  'Smile Genius Leeds': ['3 Park Row', 'Leeds', 'LS1 5HN'],
  'Smile Genius Glasgow': ['45 West George Street', 'Glasgow', 'G2 1BP'],
  'Smile Genius Cardiff': ['18 Queen Street', 'Cardiff', 'CF10 2BU'],
  'Smile Genius Birmingham': ['88 Colmore Row', 'Birmingham', 'B3 2AB'],
  'Smile Genius Birmingham 1': ['88 Colmore Row', 'Birmingham', 'B3 2AB'],
  'Smile Genius Birmingham 2': ['5 Broad Street', 'Birmingham', 'B1 2HF'],
  'Smile Genius Belfast': ['27 Donegall Place', 'Belfast', 'BT1 5AB'],
  'Smile Genius Sheffield': ['9 Leopold Street', 'Sheffield', 'S1 2GY'],
  'Smile Genius Bristol': ['60 Queen Square', 'Bristol', 'BS1 4JZ'],
  'Smile Genius Dublin': ['14 Merrion Square', 'Dublin 2', 'D02 X285', 'Ireland'],
  'Harbour Dental Care': ['2 Quayside', 'Newcastle upon Tyne', 'NE1 3DX'],
};
export const practiceAddressLines = (practice: string): string[] => PRACTICE_ADDRESS[practice] ?? [];
export const practiceAddress = (practice: string) => (PRACTICE_ADDRESS[practice] ?? []).join(', ') || undefined;

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

/** "Crown, teeth 16, Zirconia, shade A2; …" for the full statement. */
export const deviceSummary = (c: Case) =>
  (c.serviceItems ?? []).map(si => [si.name, si.fdi?.length ? `teeth ${si.fdi.join(', ')}` : '', si.material, si.shade ? `shade ${si.shade}` : ''].filter(Boolean).join(', ')).join('; ')
  || c.services?.join(', ') || '';
