// ─── Full statement · page 2 of the order form · 13-Nov-2026 ─────────────────
// Settings › Order Form › Conformity statement › "Add the full statement as
// page 2". The full statement for a custom-made device (UK MDR 2002 and/or
// EU MDR 2017/745), which the short statement on page 1 says is "available on
// request": filled in from the case and the lab's settings, with blank lines
// only where the lab must write by hand (exceptions, warnings, the date if it
// signs in ink). Idea from the Growth team's lab settings; drawn here in the
// order form's own black-and-white type.

import type { ReactNode } from 'react';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import type { OrderFormModel } from './OrderForm';
import { SIGNATURE_FONT, jurisdictions, type OrderFormSettings } from './orderFormSettings';

const FONT = '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
const INK = '#1A1A1F';
const MUTED = '#6B6B75';

const Blank = ({ w = '100%' }: { w?: number | string }) => (
  <span style={{ display: 'inline-block', width: w, borderBottom: `1px solid ${INK}`, height: 14, verticalAlign: 'bottom' }} />
);
const Box = () => <span style={{ display: 'inline-block', width: 9, height: 9, border: `1px solid ${INK}`, marginRight: 5, verticalAlign: 'middle' }} />;

function Row({ k, v, blank }: { k: string; v?: ReactNode; blank?: number | string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '3px 0', alignItems: 'flex-end', fontSize: 11 }}>
      <span style={{ width: 200, flexShrink: 0, color: MUTED }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: v ? 600 : 400 }}>{v || <Blank w={blank} />}</span>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid #D9D9DE', borderRadius: 4, overflow: 'hidden' }}>
      <p style={{ margin: 0, padding: '5px 10px', background: '#F4F4F6', borderBottom: '1px solid #D9D9DE', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {n}. {title}
      </p>
      <div style={{ padding: '6px 10px 8px' }}>{children}</div>
    </section>
  );
}

const UK_POSTCODE = /\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
/** "14 Kelham Island Works, Alma Street, Sheffield S3 8RY" → "Sheffield". */
const townOf = (address: string) => (address.split(',').pop() ?? '').replace(UK_POSTCODE, '').trim();

export function FullStatementPage({ model, s }: { model: OrderFormModel; s: OrderFormSettings }) {
  const js = jurisdictions(s.jurisdiction);
  const uk = js.includes('UK');
  const eu = js.includes('EU');
  const lab = model.lab.name;
  const logo = s.showLogo && s.logo ? s.logo : null;
  const sites = s.sites.filter(x => x.name.trim());
  const features = [
    ...model.instructions.map(c => c.text),
    ...(model.cases ?? []).flatMap(c => c.instructions.map(x => x.text)),
  ].map(t => t?.trim()).filter(Boolean);
  const materials = [...new Set([
    ...model.services.map(x => x.material),
    ...(model.cases ?? []).map(c => c.service.material),
  ].filter(m => m && m !== '—'))];
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const inInk = s.signatureMode === 'blank';
  let n = 0;
  return (
    <div style={{ fontFamily: FONT, color: INK, fontSize: 11, lineHeight: 1.45, display: 'grid', rowGap: 8 }}>
      {/* Heading: what this page is, under which law; the lab (logo) and the order at the right. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, paddingBottom: 8, borderBottom: '1.5px solid #2B2B33' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 9.5, color: MUTED }}>Page 2 · Order {model.id}</p>
          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700 }}>Statement for a custom-made device</p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>
            {uk && 'UK Medical Devices Regulations 2002 (SI 2002 No 618, as amended)'}{uk && eu && ' · '}{eu && 'Regulation (EU) 2017/745 on medical devices (EU MDR)'}
          </p>
        </div>
        {logo
          ? <img src={logo} alt="" style={{ height: 36, maxWidth: 160, objectFit: 'contain', flexShrink: 0 }} />
          : <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>{lab}</p>}
      </div>

      <Section n={++n} title="Manufacturer">
        <Row k="Dental laboratory" v={lab} />
        <Row k="Address" v={model.lab.address} />
        {uk && <Row k="MHRA registration number" v={s.mhra.trim() || undefined} blank={180} />}
        {s.damas.trim() && <Row k="DAMAS number (voluntary)" v={s.damas.trim()} />}
        {eu && <Row k="Manufacturing sites" v={sites.length ? sites.map(x => `${x.name}, ${x.address}`).join('; ') : undefined} />}
        {eu && <Row k="EU authorised representative" v={s.authRep.name.trim() ? `${s.authRep.name}, ${s.authRep.address}` : undefined} />}
      </Section>

      <Section n={++n} title="Patient, prescription and device">
        <Row k="Patient (name or code)" v={model.patient.name} />
        <Row k="Prescribing clinician" v={[model.dentist.name, model.dentist.detail].filter(Boolean).join(' · ')} />
        <Row k="Practice and address" v={`${model.practice.name}, ${model.practice.address}`} />
        <Row k="Order reference" v={model.id} />
        <Row k="Device" v={model.caseType.join('; ')} />
        <div style={{ padding: '3px 0' }}>
          <span style={{ color: MUTED }}>Particular features, as specified in the prescription</span>
          {features.length
            ? <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{features.join(' ')}</p>
            : <div style={{ marginTop: 6 }}><Blank /><div style={{ height: 8 }} /><Blank /></div>}
        </div>
      </Section>

      <Section n={++n} title="Declaration">
        <p style={{ margin: '0 0 4px' }}>
          {lab} declares that the device described above is a custom-made device, made to the written prescription of the clinician named above for the exclusive
          use of the patient named above, and that it conforms to{' '}
          {uk && 'the requirements for custom-made devices of the UK Medical Devices Regulations 2002 (SI 2002 No 618, as amended)'}
          {uk && eu && ', and to '}
          {eu && 'the general safety and performance requirements of Regulation (EU) 2017/745'}, except where stated below.
        </p>
        <Row k="Requirements not fully met, and why" />
        <p style={{ margin: '6px 0 0' }}>
          The device contains a medicinal substance, or tissues or cells of human or animal origin: &nbsp;<Box />No &nbsp;&nbsp;<Box />Yes, details: <Blank w={200} />
        </p>
      </Section>

      <Section n={++n} title="Documentation">
        <p style={{ margin: 0 }}>
          Documentation on the design, manufacture and performance of the device, including the materials used, is kept at the manufacturer’s address and made
          available to{uk && ' the MHRA'}{uk && eu && ' and'}{eu && ' the competent authorities'} for at least 10 years after the device was placed on the market
          (15 years for implantable devices).
        </p>
      </Section>

      <Section n={++n} title="Information for the clinician">
        <p style={{ margin: '0 0 3px' }}><Box />Supplied non-sterile: clean and disinfect before fitting, following a protocol suitable for the material.</p>
        <Row k="Materials used" v={materials.join(', ') || undefined} />
        <Row k="Contra-indications and warnings" />
      </Section>

      <Section n={++n} title={`Signed on behalf of ${lab}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, alignItems: 'end' }}>
          <div style={{ padding: '3px 0' }}>
            <span style={{ color: MUTED, fontSize: 11 }}>Signature</span>
            <div style={{ marginTop: 4, borderBottom: `1px solid ${INK}`, minHeight: 40, display: 'flex', alignItems: 'flex-end' }}>
              {s.signatureMode === 'typed' && s.signerName.trim() && <span style={{ fontFamily: SIGNATURE_FONT, fontSize: 28, lineHeight: 1.1 }}>{s.signerName}</span>}
              {s.signatureMode === 'image' && s.signatureImage && <img src={s.signatureImage} alt="" style={{ height: 40, maxWidth: '100%', objectFit: 'contain', objectPosition: 'left' }} />}
            </div>
          </div>
          <div>
            <Row k="Printed name" v={[s.signerName.trim(), s.signerTitle.trim()].filter(Boolean).join(', ') || undefined} />
            <Row k="Place of issue" v={townOf(model.lab.address) || undefined} />
            <Row k="Date of issue" v={inInk ? undefined : today} blank={140} />
          </div>
        </div>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 6, borderTop: '1px solid #D9D9DE', fontSize: 9, color: MUTED }}>
        <span>{lab} is the manufacturer of this device and the declarant of this statement. The dentist should make the patient aware that they can ask for a copy.</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Powered by <span style={{ width: 64, display: 'inline-flex' }}><SmileGeniusWordmark gradientId={`fs_${model.id}`} smileFill="#3C3C3C" className="w-full h-auto" /></span>
        </span>
      </div>
    </div>
  );
}
