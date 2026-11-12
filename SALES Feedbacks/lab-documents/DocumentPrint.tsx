import type { CSSProperties, ReactNode } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import type { DocsSettings } from './docsStore';
import { caseBlockers, fillTokens, jurisdictions, placeOfIssue, practiceAddressLines } from './engine';
import { PoweredBy } from '../bulk-actions/printForms';

// ── The printed pieces of Settings › Order form ───────────────────────────────
// The identity band lives with the order form itself (printForms.tsx). Here:
// the short conformity statement with its sign-off, and the case label.
// Inline styles only, so the same markup prints and downloads.

const exact: CSSProperties = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' };
/** A handwriting face for the typed signature (system fonts, so it prints offline too). */
export const SIGNATURE_FONT = "'Snell Roundhand', 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";

/** Does the statement print on this case's order form? */
export const statementOnForm = (c: Case, s: DocsSettings) => s.statementOn && !caseBlockers(c, s).length;

/** Signed on behalf of the lab: the signatory's name in a handwriting face, or a blank line for wet ink. */
export function SignOff({ s }: { s: DocsSettings }) {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginTop: 10 }}>
      <div style={{ minWidth: 220 }}>
        {s.signatureMode === 'typed'
          ? <p style={{ fontFamily: SIGNATURE_FONT, fontSize: 24, lineHeight: 1.1, margin: 0, color: '#0B2545', borderBottom: '1px solid #030213', paddingBottom: 2, width: 240 }}>{s.signerName}</p>
          : <div style={{ height: 30, borderBottom: '1px solid #030213', width: 240 }} />}
        <p style={{ fontSize: 11, margin: '4px 0 0', fontWeight: 600 }}>{[s.signerName, s.signerTitle].filter(Boolean).join(', ') || '—'}</p>
        <p style={{ fontSize: 10, margin: 0, color: '#717182' }}>Signed on behalf of {s.displayName}</p>
      </div>
      <p style={{ fontSize: 10, color: '#717182', margin: 0, textAlign: 'right' }}>Issued at {placeOfIssue(s)} on {date}</p>
    </div>
  );
}

/** The short statement at the bottom of the order form (UK first when both), with the sign-off. */
export function StatementBlock({ c, s }: { c: Case; s: DocsSettings }) {
  return (
    <div style={{ borderTop: '2px solid #030213', marginTop: 12, paddingTop: 10 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Statement for a custom-made device</p>
      {jurisdictions(s.jurisdiction).map(j => (
        <p key={j} style={{ fontSize: 11, lineHeight: 1.5, margin: '0 0 6px' }}>
          {s.jurisdiction === 'Both' && <span style={{ fontWeight: 700 }}>{j === 'UK' ? 'UK · ' : 'EU · '}</span>}
          {fillTokens(j === 'UK' ? s.ukText : s.euText, c, s)}
        </p>
      ))}
      {(s.mhra || s.damas) && <p style={{ fontSize: 10, color: '#717182', margin: 0 }}>{[s.mhra && `MHRA registration ${s.mhra}`, s.damas && `DAMAS ${s.damas} (voluntary scheme)`].filter(Boolean).join(' · ')}</p>}
      <SignOff s={s} />
    </div>
  );
}

/**
 * The case label for the outgoing box, laid out like a delivery label: who it
 * goes to (dentist, practice and full address) is the biggest thing on it,
 * then the patient and product, the "From" lab with its logo, and the case ID
 * as a small reference. "Custom-made device" (UK packaging requirement) and
 * "Powered by Smile Genius" at the foot. Black on white for thermal printers.
 */
export function CaseLabel({ c, s }: { c: Case; s: DocsSettings }) {
  const big = s.labelStock === '102x152';
  const k = big ? 1 : 0.68;
  const px = (n: number) => Math.round(n * k * 10) / 10;
  const logo = s.brandingOn && s.logo ? s.logo : null;
  const addr = practiceAddressLines(c.practice);
  const product = (c.serviceItems ?? []).map(si => `${si.name}${si.fdi?.length ? ` (${si.fdi.join(', ')})` : ''}`).join(', ') || c.services?.join(', ') || '—';
  const small = (t: string) => <p style={{ fontSize: px(8), letterSpacing: '0.1em', textTransform: 'uppercase', color: '#444', margin: 0, fontWeight: 700 }}>{t}</p>;
  const blank = <span style={{ display: 'block', borderBottom: '1px solid #000', height: px(16) }} />;
  return (
    <div style={{ ...exact, width: big ? '96mm' : '56mm', height: big ? '146mm' : '94mm', boxSizing: 'border-box', padding: big ? '6mm' : '3.5mm', borderRadius: big ? '3mm' : '2mm', border: '1px solid #000', color: '#000', background: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
      {small('Deliver to')}
      <p style={{ fontSize: px(21), fontWeight: 800, margin: `${px(4)}px 0 0`, lineHeight: 1.15 }}>{c.dentist}</p>
      <p style={{ fontSize: px(17), fontWeight: 700, margin: `${px(3)}px 0 0`, lineHeight: 1.2 }}>{c.practice}</p>
      <div style={{ fontSize: px(18), lineHeight: 1.3, marginTop: px(3) }}>
        {addr.length
          ? addr.map((l, i) => <p key={i} style={{ margin: 0, fontWeight: i === addr.length - 1 || /^[A-Z]{1,2}\d/.test(l) ? 800 : 400 }}>{l}</p>)
          : <>{blank}{blank}</>}
      </div>

      <div style={{ borderTop: '1.5px solid #000', marginTop: px(14), paddingTop: px(10), display: 'grid', gridTemplateColumns: '1fr', rowGap: px(5) }}>
        <div>{small('Patient')}<p style={{ fontSize: px(13), fontWeight: 600, margin: 0 }}>{c.patientName}</p></div>
        <div>{small('Product')}<p style={{ fontSize: px(13), fontWeight: 600, margin: 0, lineHeight: 1.25 }}>{product}</p></div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ borderTop: '1px solid #000', paddingTop: px(7), display: 'flex', alignItems: 'center', gap: px(8) }}>
          {logo && <img src={logo} alt="" style={{ height: px(26), width: 'auto', maxWidth: '38%', objectFit: 'contain', objectPosition: 'left', filter: 'grayscale(1)' }} />}
          <div style={{ minWidth: 0 }}>
            {small('From')}
            <p style={{ fontSize: px(10), fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{s.displayName}</p>
            <p style={{ fontSize: px(8.5), margin: 0, lineHeight: 1.25 }}>{s.address.split('\n').map(x => x.trim()).filter(Boolean).join(', ')}{s.phone ? ` · ${s.phone}` : ''}</p>
          </div>
        </div>
        <p style={{ fontSize: px(8.5), margin: `${px(5)}px 0 0`, color: '#333' }}>Ref {c.id}</p>
        <p style={{ background: '#000', color: '#fff', textAlign: 'center', fontSize: px(11), fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', padding: `${px(4)}px 0`, margin: `${px(6)}px 0 0`, borderRadius: px(3) }}>Custom-made device</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: px(6) }}><PoweredBy height={px(20)} color="#000" /></div>
      </div>
    </div>
  );
}

export const labelPageCss = (s: DocsSettings) => (s.labelStock === '102x152' ? '@page { size: 102mm 152mm; margin: 3mm; }' : '@page { size: 62mm 100mm; margin: 3mm; }');
export const paperPageCss = (s: DocsSettings) => `@page { size: ${s.paper === 'Letter' ? 'letter' : 'A4'} portrait; margin: 12mm; }`;
