// ── The conformity statement wording ─────────────────────────────────────────
// One generic short statement for every product (fixed, removable,
// implant-related), in a UK version and an EU version. It sits at the bottom
// of the order form, which already carries the device, teeth, materials,
// instructions, patient and prescriber, so the statement points to "this
// form" for those and stays a few lines long. Every particular the law asks
// for is on the printed sheet (statement + form together); see
// UK_PARTICULARS / EU_PARTICULARS. The lab can edit the wording; {{tokens}}
// fill from the case and from Lab info. Not legal advice.

export const TOKENS: { token: string; label: string }[] = [
  { token: '{{lab.name}}', label: 'Lab name' },
  { token: '{{lab.address}}', label: 'Lab address' },
  { token: '{{lab.sites}}', label: 'Manufacturing sites (EU)' },
  { token: '{{lab.authRep}}', label: 'EU authorised representative' },
  { token: '{{patient}}', label: 'Patient' },
  { token: '{{prescriber}}', label: 'Prescriber' },
  { token: '{{practice}}', label: 'Practice' },
  { token: '{{caseId}}', label: 'Order reference' },
];

export const UK_DEFAULT =
  'This is a custom-made medical device, made by {{lab.name}}, {{lab.address}}, to the prescription of {{prescriber}} of {{practice}}, ' +
  'with the design characteristics specified on this form (order {{caseId}}). It is intended for the exclusive use of {{patient}} and conforms to the relevant ' +
  'essential requirements in Annex I of the Medical Devices Directive as applied by the UK Medical Devices Regulations 2002, except where stated on this form. ' +
  'A full statement is available from {{lab.name}} on request.';

export const EU_DEFAULT =
  'This is a custom-made device under Regulation (EU) 2017/745, made by {{lab.name}}, {{lab.address}}, at {{lab.sites}}, to the prescription of {{prescriber}} of {{practice}}, ' +
  'with the specific characteristics set out on this form (order {{caseId}}). It is intended for the exclusive use of {{patient}} and conforms to the general safety ' +
  'and performance requirements in Annex I of the Regulation, except where stated on this form. It contains no medicinal substance and no tissues or cells of human ' +
  'or animal origin. EU authorised representative: {{lab.authRep}}. A full statement is available from {{lab.name}} on request.';

/** What each regime asks the statement to carry, and where it comes from on the printed sheet. */
export const UK_PARTICULARS = [
  { what: 'Manufacturer name and address', from: 'Lab info' },
  { what: 'Data identifying the device', from: 'Order reference + the form' },
  { what: 'For the exclusive use of a named patient', from: 'The case' },
  { what: 'Name of the prescriber and their practice', from: 'The case' },
  { what: 'Particular features from the prescription', from: 'The form' },
  { what: 'Conforms to the essential requirements (with reasons if any aren’t met)', from: 'The statement' },
];
export const EU_PARTICULARS = [
  { what: 'Manufacturer name and address, plus every manufacturing site', from: 'Lab info + sites below' },
  { what: 'EU authorised representative (labs outside the EU)', from: 'Below' },
  { what: 'Data identifying the device', from: 'Order reference + the form' },
  { what: 'For the exclusive use of a named patient (name, acronym or code)', from: 'The case' },
  { what: 'Prescriber and health institution', from: 'The case' },
  { what: 'Specific characteristics from the prescription', from: 'The form' },
  { what: 'Conforms to the Annex I general safety and performance requirements', from: 'The statement' },
  { what: 'Medicinal substance or human / animal tissue, where present', from: 'The statement' },
];
