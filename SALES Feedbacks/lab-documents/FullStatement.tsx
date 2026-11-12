import type { ReactNode } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import type { DocsSettings } from './docsStore';
import { deviceSummary, jurisdictions, placeOfIssue, practiceAddress } from './engine';
import { PoweredBy } from '../bulk-actions/printForms';

// ── The full statement for a custom-made device ──────────────────────────────
// For when a dentist asks for more than the short statement on the order form
// ("A full statement is available from the lab on request"). One generic page
// for fixed, removable and implant-related work. The lab's own details are
// printed from Settings › Order form; everything about the case is a blank
// line for the lab to fill in and sign in wet ink, or pre-filled when made
// for a particular case. Inline styles only, so it downloads and prints as is.

const line = (w: number | string = '100%') => <span style={{ display: 'inline-block', width: w, borderBottom: '1px solid #030213', height: 14, verticalAlign: 'bottom' }} />;

function Row({ k, v, blank = '100%' }: { k: string; v?: ReactNode; blank?: number | string }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 11.5, padding: '4px 0', alignItems: 'flex-end' }}>
      <span style={{ width: 190, flexShrink: 0, color: '#5A5568' }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{v ? <b>{v}</b> : line(blank)}</span>
    </div>
  );
}
function H({ n, children }: { n: number; children: ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 4px' }}>{n}. {children}</p>;
}
const box = <span style={{ display: 'inline-block', width: 10, height: 10, border: '1px solid #030213', marginRight: 5, verticalAlign: 'middle' }} />;
const oneLine = (a: string) => a.split('\n').map(x => x.trim()).filter(Boolean).join(', ');

export function FullStatement({ s, c }: { s: DocsSettings; c?: Case }) {
  const js = jurisdictions(s.jurisdiction);
  const uk = js.includes('UK');
  const eu = js.includes('EU');
  const sites = s.sites.filter(x => x.name.trim());
  let n = 0;
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#030213', fontSize: 11.5, lineHeight: 1.45 }}>
      <div style={{ borderBottom: '2px solid #030213', paddingBottom: 8, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          {s.logo && s.brandingOn && <img src={s.logo} alt="" style={{ height: 34, maxWidth: 160, objectFit: 'contain', display: 'block', marginBottom: 6 }} />}
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Statement for a custom-made device</p>
          <p style={{ fontSize: 10.5, color: '#5A5568', margin: '2px 0 0' }}>
            {uk && 'UK Medical Devices Regulations 2002 (SI 2002 No 618, as amended)'}{uk && eu && ' · '}{eu && 'Regulation (EU) 2017/745 on medical devices (EU MDR)'}
          </p>
        </div>
        <p style={{ fontSize: 10.5, color: '#5A5568', margin: 0, textAlign: 'right' }}>{s.displayName}<br />{oneLine(s.address)}</p>
      </div>

      <H n={++n}>Manufacturer</H>
      <Row k="Dental laboratory" v={s.displayName} />
      <Row k="Address" v={oneLine(s.address)} />
      {uk && <Row k="MHRA registration number" v={s.mhra || undefined} blank={180} />}
      {s.damas && <Row k="DAMAS number (voluntary)" v={s.damas} />}
      {eu && <Row k="Manufacturing sites" v={sites.length ? sites.map(x => `${x.name}, ${oneLine(x.address)}`).join('; ') : undefined} />}
      {eu && <Row k="EU authorised representative" v={s.authRep.name.trim() ? `${s.authRep.name}, ${oneLine(s.authRep.address)}` : undefined} />}

      <H n={++n}>Patient, prescription and device</H>
      <Row k="Patient (name or code)" v={c?.patientName} />
      <Row k="Prescribing clinician" v={c?.dentist} />
      <Row k="Practice and address" v={c ? [c.practice, practiceAddress(c.practice)].filter(Boolean).join(', ') : undefined} />
      <Row k="Order reference" v={c?.id} blank={200} />
      <Row k="Device description" v={c ? deviceSummary(c) : undefined} />
      <div style={{ fontSize: 11.5, padding: '4px 0' }}>
        <span style={{ color: '#5A5568' }}>Particular features, as specified in the prescription</span>
        {c && (c.serviceItems ?? []).some(si => si.instructions)
          ? <p style={{ margin: '3px 0 0', fontWeight: 700 }}>{(c.serviceItems ?? []).map(si => si.instructions).filter(Boolean).join(' ')}</p>
          : <div style={{ marginTop: 6 }}>{line()}<div style={{ height: 8 }} />{line()}</div>}
      </div>

      <H n={++n}>Declaration</H>
      <p style={{ margin: '0 0 6px' }}>
        {s.displayName} declares that the device described above is a custom-made device, made to the written prescription of the clinician named above for the
        exclusive use of the patient named above, and that it conforms to {uk && 'the requirements for custom-made devices of the UK Medical Devices Regulations 2002 (SI 2002 No 618, as amended)'}
        {uk && eu && ', and to '}{eu && 'the general safety and performance requirements of Regulation (EU) 2017/745'}.
      </p>
      <Row k="Requirements not fully met, and why" v={undefined} />
      <div style={{ padding: '2px 0 4px' }}>{line()}</div>
      <p style={{ margin: '4px 0 0' }}>The device contains a medicinal substance, or tissues or cells of human or animal origin: &nbsp;{box}No &nbsp;&nbsp;{box}Yes, details: {line(220)}</p>

      <H n={++n}>Documentation</H>
      <p style={{ margin: 0 }}>
        Documentation on the design, manufacture and performance of the device, including the materials used, is kept at the manufacturer's address and made available to
        {uk && ' the MHRA'}{uk && eu && ' and'}{eu && ' the competent authorities'} for at least 10 years after the device was placed on the market (15 years for implantable devices).
      </p>

      <H n={++n}>Information for the clinician</H>
      <p style={{ margin: '0 0 4px' }}>{box}Supplied non-sterile: clean and disinfect before fitting, following a protocol suitable for the material.</p>
      <Row k="Materials used" v={c ? (c.serviceItems ?? []).map(si => si.material).filter(Boolean).join(', ') || undefined : undefined} />
      <Row k="Contra-indications and warnings" />
      <div style={{ padding: '2px 0 4px' }}>{line()}</div>

      <H n={++n}>Signed on behalf of {s.displayName}</H>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24 }}>
        <Row k="Signature" />
        <Row k="Printed name" v={[s.signerName, s.signerTitle].filter(Boolean).join(', ') || undefined} />
        <Row k="Place of issue" v={placeOfIssue(s) || undefined} />
        <Row k="Date of issue" />
      </div>

      <p style={{ fontSize: 9.5, color: '#717182', marginTop: 16, borderTop: '1px solid #E0E0E6', paddingTop: 6 }}>
        {s.displayName} is the manufacturer of this device and the declarant of this statement. The dentist should make the patient aware that they can ask for a copy.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><PoweredBy height={20} /></div>
    </div>
  );
}

export const fullStatementHtml = (title: string, body: string, pageCss: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{background:#fff;margin:0 auto;padding:24px;max-width:760px}${pageCss}</style></head><body>${body}</body></html>`;
