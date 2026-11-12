import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Case } from '../../src/app/pages/CasesPage';
import { portalDate } from '../lab-prescription-inbox/data';
import { accentFor, getIntakeConfig } from '../intake-form/intakeStore';
import { getDocs, type DocsSettings } from '../lab-documents/docsStore';
import { statementOnForm, StatementBlock } from '../lab-documents/DocumentPrint';
// The Smile Genius smile mark, inlined so it shows in downloaded (offline) forms too.
import sgMark from '../../public/favicon.svg?raw';

export const sgMarkSrc = `data:image/svg+xml;utf8,${encodeURIComponent(sgMark)}`;

// ── Printing order forms ─────────────────────────────────────────────────────
// One print window for any number of forms: each page is rendered to static
// markup with the app's own styles copied in, one form per printed page, then
// the browser's print dialog opens. Used by the case page's LabLink form tab
// and by Bulk Actions → Print order forms.

export function printPages(pages: { key: string; node: ReactElement }[], title: string, pageCss = '@page { margin: 12mm; }', pageClass = 'sf-print-page'): boolean {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return false;
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(el => el.outerHTML).join('\n');
  const body = pages.map(p => `<section class="${pageClass}">${renderToStaticMarkup(p.node)}</section>`).join('\n');
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title>${styles}
<style>
  body { background: #fff !important; margin: 0; }
  .sf-print-page { max-width: 760px; margin: 0 auto; padding: 24px; break-after: page; page-break-after: always; }
  .sf-print-page:last-child { break-after: auto; page-break-after: auto; }
  .sf-sg-form thead { display: table-header-group; }
  .sf-sg-form tfoot { display: table-footer-group; }
  .sf-sg-form tr { break-inside: avoid; page-break-inside: avoid; }
  .sf-label-page { margin: 0; padding: 0; break-after: page; page-break-after: always; }
  .sf-label-page:last-child { break-after: auto; page-break-after: auto; }
  ${pageCss}
  @media screen { .sf-print-page { border-bottom: 1px dashed #E0E0E6; } }
</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  // Let fonts and styles settle before the dialog.
  w.setTimeout(() => w.print(), 400);
  return true;
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #F0EFF6', padding: '10px 0' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{title}</p>
      {children}
    </div>
  );
}
function KV({ k, v }: { k: string; v?: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 12, padding: '2px 0' }}>
      <span style={{ width: 150, flexShrink: 0, color: '#A0A0B0' }}>{k}</span>
      <span style={{ color: '#030213', minWidth: 0, overflowWrap: 'anywhere' }}>{v || '—'}</span>
    </div>
  );
}

/** The lab's logo from Settings → LabLink, or its initials on the lab's accent colour. */
export function LabLogo({ name, logo, accent }: { name: string; logo: string | null; accent: ReturnType<typeof accentFor> }) {
  if (logo) return <img src={logo} alt={name} style={{ height: 40, maxWidth: 160, objectFit: 'contain', objectPosition: 'left' }} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return (
    <span style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontWeight: 700, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{initials}</span>
  );
}

/**
 * The Smile Genius order form, for printing. Mirrors the fields of the portal's
 * own order form (OrderFormBody in CaseDetailPage, not exported): details,
 * patient, case instructions, each service, scan files, attachments, creation.
 *
 * Four zones, each switched in Settings › Order form (lab-documents/), all off
 * by default:
 *   1. Identity band: Smile Genius at the top (today's form), or with the
 *      lab's logo on, the lab's logo with its name, address and phone from
 *      Lab info, MHRA and DAMAS, and "Powered by Smile Genius" in the footer.
 *   2. Case body: unchanged, with colour emphasis (on by default) on dentist,
 *      patient, delivery date and case instructions.
 *   3. + 4. Short conformity statement and sign-off, when switched on.
 * Laid out as a table so the header and footer repeat on every printed page.
 * `docs` overrides the saved settings (the samples page renders A to G).
 */
export function SgOrderFormPrint({ c, docs, statement = true }: { c: Case; docs?: DocsSettings; statement?: boolean }) {
  const url = `${window.location.origin}/lab/cases/${c.id}`;
  const s = docs ?? getDocs();
  const branded = s.brandingOn && !!s.logo;
  const labName = branded ? s.displayName : (getIntakeConfig().labName || c.lab);
  const hl = s.emphasis;
  const em = (v?: ReactNode) => (hl && v ? <span style={{ background: '#FFF1C2', boxShadow: 'inset 3px 0 0 #F59E0B', padding: '1px 6px', borderRadius: 3, fontWeight: 600, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{v}</span> : v);
  return (
    <table className="sf-sg-form" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', color: '#030213' }}>
      <thead>
        <tr><td style={{ padding: 0 }}>
          {branded ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 10, marginBottom: 10, borderBottom: '2px solid #030213' }}>
              <LabLogo name={labName} logo={s.logo} accent={accentFor(getIntakeConfig().accent)} />
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{labName}</p>
                <p style={{ fontSize: 10, color: '#5A5568', margin: '2px 0 0' }}>{s.address.split('\n').filter(Boolean).join(', ')}</p>
                <p style={{ fontSize: 10, color: '#5A5568', margin: '1px 0 0' }}>{[s.phone, s.email].filter(Boolean).join(' · ')}</p>
                {(s.mhra || s.damas) && <p style={{ fontSize: 10, color: '#5A5568', margin: '1px 0 0' }}>{[s.mhra && `MHRA reg. ${s.mhra}`, s.damas && `DAMAS ${s.damas}`].filter(Boolean).join(' · ')}</p>}
                <p style={{ fontSize: 11, color: '#717182', margin: '4px 0 0' }}>Order form · {c.id} · printed {portalDate()}</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 10, marginBottom: 10, borderBottom: '2px solid #030213' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <img src={sgMarkSrc} alt="" style={{ height: 26 }} />
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>smile genius</span>
              </span>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Order form</p>
                <p style={{ fontSize: 11, color: '#717182', margin: '2px 0 0' }}>{c.id} · printed {portalDate()}</p>
              </div>
            </div>
          )}
        </td></tr>
      </thead>
      <tfoot>
        <tr><td style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0EFF6', marginTop: 12, paddingTop: 8 }}>
            <span style={{ fontSize: 10, color: '#A0A0B0' }}>{c.id} · {c.patientName}</span>
            {branded && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#A0A0B0' }}>
                <img src={sgMarkSrc} alt="" style={{ height: 9 }} /> Powered by Smile Genius
              </span>
            )}
          </div>
        </td></tr>
      </tfoot>
      <tbody>
        <tr><td style={{ padding: 0 }}>
          <Sec title="Details">
            <KV k="Lab name" v={labName} />
            <KV k="Practice name" v={c.practice} />
            <KV k="Dentist name" v={em(c.dentist)} />
            <KV k="Patient name" v={em(c.patientName)} />
            <KV k="SG Case ID" v={c.id} />
            <KV k="Case URL" v={url} />
          </Sec>
        </td></tr>
        {(c.serviceItems ?? []).map(si => (
          <tr key={si.id}><td style={{ padding: 0 }}>
            <Sec title={si.name}>
              <KV k="FDI" v={(si.fdi ?? []).join(', ')} />
              <KV k="Order type" v={si.orderType} />
              {si.material && <KV k="Material" v={si.material} />}
              {si.shade && <KV k="Tooth shade" v={si.shade} />}
              <KV k="Delivery date" v={em(si.deliveryDate ?? c.requestedDelivery ?? undefined)} />
              <KV k="Scan files" v={`${si.scanFileCount ?? 0} included`} />
              <KV k="Attachments" v={`${si.attachmentCount ?? 0}`} />
              {si.instructions && (
                <div style={{ fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}><span style={{ color: '#A0A0B0' }}>Case instructions · </span>{em(si.instructions)}</div>
              )}
            </Sec>
          </td></tr>
        ))}
        <tr><td style={{ padding: 0 }}>
          <Sec title="Creation">
            <KV k="Created on" v={c.createdAt} />
            <KV k="Created by" v={c.createdBy ?? (c.createdBySide === 'lab' ? 'The lab' : c.practice)} />
            <KV k="Received via" v={c.source === 'scanner' ? `Scanner · ${c.scanner}` : c.source === 'email' ? 'Email' : c.source === 'post' ? 'Post' : 'Manual'} />
            <KV k="Status" v={c.status.replace(/-/g, ' ')} />
          </Sec>
        </td></tr>
        {statement && statementOnForm(c, s) && (
          <tr><td style={{ padding: 0 }}><StatementBlock c={c} s={s} /></td></tr>
        )}
      </tbody>
    </table>
  );
}

/**
 * The scanner's order form for a case that came in from a scanner. Built from
 * the case's scanner details (the prototype has no scanner PDF): scanner,
 * scanner case ref and patient ID, scan date, teeth and the scan files.
 */
export function ScannerOrderFormPrint({ c }: { c: Case }) {
  const scans = (c.serviceItems ?? []).reduce((n, si) => n + (si.scanFileCount ?? 0), 0);
  return (
    <div style={{ fontFamily: 'inherit', color: '#030213' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{c.scanner} · Scanner order form</p>
        <p style={{ fontSize: 12, color: '#717182', margin: 0 }}>{c.scannerCaseRef ?? c.id}</p>
      </div>
      <Sec title="Scanner">
        <KV k="Scanner" v={c.scanner} />
        <KV k="Scanner case ref" v={c.scannerCaseRef} />
        <KV k="Scanner patient ID" v={c.scannerPatientId} />
        <KV k="Scanned on" v={c.scannerCreatedAt ?? c.createdAt} />
      </Sec>
      <Sec title="Sent by">
        <KV k="Practice" v={c.practice} />
        <KV k="Dentist" v={c.dentist} />
        <KV k="Patient" v={c.patientName} />
        <KV k="Lab" v={c.lab} />
      </Sec>
      {(c.serviceItems ?? []).map(si => (
        <Sec key={si.id} title={`Prescription · ${si.name}`}>
          <KV k="Teeth (FDI)" v={(si.fdi ?? []).join(', ')} />
          {si.material && <KV k="Material" v={si.material} />}
          {si.shade && <KV k="Shade" v={si.shade} />}
          <KV k="Due" v={si.deliveryDate ?? c.requestedDelivery ?? undefined} />
          {si.instructions && <KV k="Notes" v={si.instructions} />}
        </Sec>
      ))}
      <Sec title="Scan files">
        {scans ? Array.from({ length: scans }, (_, i) => <KV key={i} k={`Scan ${i + 1}`} v={`scan-${i + 1}.stl (on the ${c.scanner} portal)`} />) : <KV k="Scans" v="None listed" />}
      </Sec>
      <p style={{ fontSize: 10, color: '#A0A0B0', marginTop: 8 }}>Generated from the case's scanner details in Smile Genius.</p>
    </div>
  );
}
