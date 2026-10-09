// ─── The read (voice transcription or photo of a prescription) ──────────────
// PROTOTYPE: canned results. Replace with real speech-to-text / OCR that
// returns the same { form, flags } shape.
import { CaseForm, emptyForm, newItem } from './caseForm';
import { ReadFlag, ReadMode, RxScenario } from './readSource';

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const INSTRUCTIONS: Record<RxScenario, string> = {
  single: 'Light contacts. Match adjacent LL4 characterisation.',
  clean: 'Light contacts. Match adjacent LL4 characterisation.',
  multi: 'Crown: light contacts, match LL4. Night guard: hard, 2 mm. Bridge: modified ridge lap pontic. Trays: reservoirs on.',
};

/** Voice-note transcript; flagged bits are what the form asks you to check. */
export const TRANSCRIPT: Record<RxScenario, { t: string; flag?: boolean }[]> = {
  single: [
    { t: 'New crown for Tom Hughes, date of birth third of August eighty-five. Lower left five, e.max, shade ' },
    { t: 'A2… maybe A3', flag: true }, { t: '. Send it to Northstar, back by ' }, { t: 'Wednesday the ninth', flag: true },
    { t: '. Light contacts, match the lower left four.' },
  ],
  clean: [
    { t: 'New private crown for Tom Hughes, date of birth third of August eighty-five. Lower left five, e.max, shade A2. Send it to Northstar, back in nine days. Light contacts, match the lower left four.' },
  ],
  multi: [
    { t: 'Four items for Tom Hughes, all to Northstar. One: crown, lower left five, e.max, shade ' }, { t: 'A2… maybe A3', flag: true },
    { t: '. Two: upper night guard, ' }, { t: 'hard acrylic-ish', flag: true }, { t: ', two mil. Three: bridge upper right four to six, PFM, A3. Four: whitening trays both arches, reservoirs on. Back by ' },
    { t: 'Wednesday the ninth', flag: true }, { t: '.' },
  ],
};

/** What the read (voice transcription or photo OCR) returns, as a prefilled case form + flags. */
export function readCase(rx: RxScenario, mode: ReadMode): { form: CaseForm; flags: ReadFlag[] } {
  const clean = rx === 'clean';
  const heard = mode === 'audio';
  const flags: ReadFlag[] = [];
  const flag = (field: string, label: string, heardAs: string, missing?: boolean) => flags.push({ field, label, heard: heardAs, missing });

  // Delivery dates are per service; the crown's date is what the read heard
  const crown = newItem('su-crown', { teeth: ['LL5'], material: 'Lithium Disilicate (e.max)', shade: clean ? 'A2' : null, returnBy: clean ? plusDays(9) : '' });
  if (!clean) flag(`${crown.uid}.shade`, 'Shade', heard ? 'A2… maybe A3' : 'A2/3 ?');
  const items = [crown];
  if (rx === 'multi') {
    const guard = newItem('ap-night-guard', { teeth: ['Upper arch'] });
    flag(`${guard.uid}.applianceOption`, 'Type', heard ? 'hard acrylic-ish' : 'Hard?');
    items.push(
      guard,
      newItem('br-screw-retained', { teeth: ['UR4', 'UR5', 'UR6'], material: 'Porcelain Fused to Metal (PFM)', shade: 'A3', details: { brand: 'Straumann · BLX · RB', abutmentMaterial: 'Chrome Cobalt' } }),
      newItem('ap-whitening-tray', { teeth: ['Both arches'], details: { applianceOption: 'Yes' } }),
    );
  }
  if (!clean) {
    flag('funding', 'Order type', '', true);
    flag(`${crown.uid}.returnBy`, 'Delivery date', heard ? 'Wednesday the ninth' : 'Wed/09');
  }
  const form: CaseForm = {
    ...emptyForm(),
    practice: 'cds', clinician: 'reed', patientId: 'P-10450', lab: 'northstar',
    funding: clean ? 'Private' : null,
    caseSource: heard ? 'Voice note' : 'Photo of lab form',
    instructions: INSTRUCTIONS[rx],
    // The photo of the lab form is kept on the case; a voice note only fills the form
    attachments: heard ? [] : ['Lab form photo'],
    items,
  };
  return { form, flags };
}

