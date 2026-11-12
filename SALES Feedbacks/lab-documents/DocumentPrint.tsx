import type { CSSProperties, ReactNode } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import type { DocsSettings } from './docsStore';
import { caseBlockers, fillTokens, jurisdictions, placeOfIssue } from './engine';

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

/** The case label for the outgoing box. Works with every other setting off. */
export function CaseLabel({ c, s }: { c: Case; s: DocsSettings }) {
  const big = s.labelStock === '102x152';
  const summary = (c.serviceItems ?? []).map(si => `${si.name}${si.fdi?.length ? ` (${si.fdi.join(', ')})` : ''}`).join(' · ') || c.services?.join(' · ');
  const row = (k: string, v: ReactNode, strong = false) => (
    <div style={{ marginBottom: big ? 6 : 4 }}>
      <p style={{ fontSize: big ? 9 : 7, color: '#555', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</p>
      <p style={{ fontSize: strong ? (big ? 18 : 13) : (big ? 12 : 9.5), fontWeight: strong ? 800 : 600, margin: 0, lineHeight: 1.2 }}>{v}</p>
    </div>
  );
  return (
    <div style={{ ...exact, width: big ? '96mm' : '56mm', height: big ? '146mm' : '94mm', boxSizing: 'border-box', padding: big ? '5mm' : '3mm', border: '1px solid #000', color: '#000', fontFamily: 'Arial, Helvetica, sans-serif', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ borderBottom: '1.5px solid #000', paddingBottom: big ? 6 : 4, marginBottom: big ? 8 : 5 }}>
        <p style={{ fontSize: big ? 14 : 10.5, fontWeight: 800, margin: 0 }}>{s.displayName}</p>
        <p style={{ fontSize: big ? 9 : 7, margin: '1px 0 0' }}>{s.address.split('\n').filter(Boolean).join(', ')}</p>
        <p style={{ fontSize: big ? 9 : 7, margin: '1px 0 0' }}>{[s.phone, s.email].filter(Boolean).join(' · ')}</p>
      </div>
      {row('Case ID', c.id, true)}
      {row('Patient', c.patientName)}
      {row('Practice', c.practice)}
      {row(c.serviceItems?.some(si => si.fdi?.length) ? 'Product · teeth' : 'Product', summary || '—')}
      <div style={{ marginTop: 'auto', border: '1.5px solid #000', textAlign: 'center', padding: big ? '6px 0' : '3px 0' }}>
        <p style={{ fontSize: big ? 15 : 10.5, fontWeight: 800, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Custom-made device</p>
      </div>
    </div>
  );
}

export const labelPageCss = (s: DocsSettings) => (s.labelStock === '102x152' ? '@page { size: 102mm 152mm; margin: 3mm; }' : '@page { size: 62mm 100mm; margin: 3mm; }');
export const paperPageCss = (s: DocsSettings) => `@page { size: ${s.paper === 'Letter' ? 'letter' : 'A4'} portrait; margin: 12mm; }`;
