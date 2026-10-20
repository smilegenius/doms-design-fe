import type { ReactNode } from 'react';
import { accentFor, getIntakeConfig } from '../intake-form/intakeStore';
import { LabLogo, sgMarkSrc } from '../bulk-actions/printForms';
import type { BillingAccount, BillingState, Invoice, Statement } from './types';
import { credited, lineNet, lineVat, paid, totals } from './engine';
import { fmtDate, fmtMonth, money } from './format';

// ── The documents: invoice, statement, statement of manufacture ──────────────
// Inline-styled so they print (printPages) the same as they preview. Lab logo
// top left, lab name top right (Settings → LabLink), Smile Genius mark below.

const LAB_ADDRESS = ['Unit 4, Riverside Works', 'Manchester M3 4LZ', 'United Kingdom'];

function Header({ title, right }: { title: string; right: ReactNode }) {
  const cfg = getIntakeConfig();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: 12, marginBottom: 14, borderBottom: '2px solid #030213' }}>
      <div>
        <LabLogo name={cfg.labName} logo={cfg.logo} accent={accentFor(cfg.accent)} />
        <p style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 0', letterSpacing: '0.04em' }}>{title}</p>
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, color: '#5A5568', lineHeight: 1.5 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#030213', margin: 0 }}>{cfg.labName}</p>
        {LAB_ADDRESS.map(l => <p key={l} style={{ margin: 0 }}>{l}</p>)}
        {right}
      </div>
    </div>
  );
}

function Footer({ left }: { left: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F0EFF6', marginTop: 16, paddingTop: 8, fontSize: 10, color: '#A0A0B0' }}>
      <span>{left}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9 }}><img src={sgMarkSrc} alt="" style={{ height: 9 }} /> Smile Genius</span>
    </div>
  );
}

const cell: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #F0EFF6', fontSize: 11, verticalAlign: 'top' };
const head: React.CSSProperties = { ...cell, fontSize: 9, fontWeight: 700, color: '#717182', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', background: '#F8F9FC' };

export function InvoiceDoc({ inv, acc, s }: { inv: Invoice; acc?: BillingAccount; s: BillingState }) {
  const t = totals(inv);
  // Sent invoices keep how they went out; drafts follow the current settings.
  const vat = inv.issuedAt ? !!inv.vatNumber : s.settings.vatRegistered;
  const vatNo = inv.issuedAt ? inv.vatNumber : s.settings.vatNumber;
  const cur = inv.currency;
  return (
    <div style={{ color: '#030213', fontFamily: 'inherit' }}>
      <Header title={inv.number ? 'INVOICE' : 'DRAFT INVOICE'} right={vat ? <p style={{ margin: '4px 0 0' }}>VAT {vatNo}</p> : null} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#717182', textTransform: 'uppercase', margin: '0 0 3px' }}>Bill to</p>
          <p style={{ fontWeight: 700, margin: 0 }}>{acc?.name ?? inv.practice}</p>
          {acc?.kind === 'dentist' && <p style={{ margin: 0 }}>c/o {acc.practices?.includes(inv.practice) ? inv.practice : acc.practices?.[0]}</p>}
          <p style={{ margin: 0, color: '#5A5568' }}>{acc?.country ?? 'United Kingdom'}</p>
          <p style={{ margin: 0, color: '#5A5568' }}>{acc?.emails.join(', ')}</p>
        </div>
        <div style={{ textAlign: 'right', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}><b>Invoice</b> {inv.number ?? 'not numbered yet'}</p>
          <p style={{ margin: 0 }}><b>Date</b> {fmtDate(inv.issuedAt ?? inv.createdAt)}</p>
          <p style={{ margin: 0 }}><b>Due</b> {fmtDate(inv.dueAt)}</p>
          {inv.replaces && <p style={{ margin: 0 }}><b>Replaces</b> {inv.replaces}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, fontSize: 11, padding: '8px 10px', background: '#F8F9FC', borderRadius: 6, marginBottom: 12 }}>
        <span><b>Patient ref</b> {inv.patient}</span>
        <span><b>Case</b> {inv.caseId}</span>
        <span><b>Dentist</b> {inv.dentist}</span>
        {inv.stage && <span><b>Stage</b> {inv.stage}</span>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={head}>Description</th><th style={head}>NHS / Private</th><th style={{ ...head, textAlign: 'right' }}>Qty</th><th style={{ ...head, textAlign: 'right' }}>Unit</th>
          {vat && <th style={{ ...head, textAlign: 'right' }}>VAT</th>}<th style={{ ...head, textAlign: 'right' }}>Amount</th>
        </tr></thead>
        <tbody>
          {inv.lines.map(l => (
            <tr key={l.id}>
              <td style={cell}>{l.description}{l.part && <div style={{ color: '#717182', fontSize: 10 }}>{l.part.manufacturer} · part {l.part.partNo}</div>}{l.source.kind === 'remake' && <div style={{ color: '#717182', fontSize: 10 }}>Remake under warranty</div>}</td>
              <td style={cell}>{l.kind}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{l.qty}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{money(l.unitPrice, cur)}</td>
              {vat && <td style={{ ...cell, textAlign: 'right' }}>{l.vatPct ? `${l.vatPct}%` : l.vat === 'zero' ? '0%' : 'Exempt'}</td>}
              <td style={{ ...cell, textAlign: 'right' }}>{money(lineNet(l), cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <table style={{ fontSize: 11, minWidth: 220 }}>
          <tbody>
            {vat && <tr><td style={{ padding: '2px 8px', color: '#717182' }}>Net</td><td style={{ padding: '2px 0', textAlign: 'right' }}>{money(t.net, cur)}</td></tr>}
            {vat && <tr><td style={{ padding: '2px 8px', color: '#717182' }}>VAT</td><td style={{ padding: '2px 0', textAlign: 'right' }}>{money(inv.lines.reduce((n, l) => n + lineVat(l), 0), cur)}</td></tr>}
            <tr><td style={{ padding: '4px 8px', fontWeight: 700 }}>Total</td><td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{money(t.gross, cur)}</td></tr>
            {credited(inv) > 0 && <tr><td style={{ padding: '2px 8px', color: '#717182' }}>Credit notes</td><td style={{ textAlign: 'right' }}>−{money(credited(inv), cur)}</td></tr>}
            {paid(inv) > 0 && <tr><td style={{ padding: '2px 8px', color: '#717182' }}>Paid</td><td style={{ textAlign: 'right' }}>−{money(paid(inv), cur)}</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 10, color: '#717182', marginTop: 14 }}>
        Payment terms: {s.settings.terms === '30' ? '30 days' : s.settings.terms === 'eom-following' ? 'end of the following month' : `${s.settings.customTermsDays} days`}. {cur !== 'GBP' ? `Invoiced in ${cur}. ` : ''}Please quote {inv.number ?? 'the invoice number'} with your payment.
        {!vat && ' Not VAT-registered: no VAT charged.'}
      </p>
      <Footer left={`${inv.number ?? 'Draft'} · ${inv.caseId}`} />
    </div>
  );
}

export function SomDoc({ inv }: { inv: Invoice }) {
  const cfg = getIntakeConfig();
  return (
    <div style={{ color: '#030213', fontSize: 11, lineHeight: 1.6 }}>
      <Header title="STATEMENT OF MANUFACTURE" right={null} />
      <p>This is to certify that the custom-made dental device(s) below were manufactured by {cfg.labName} for the named patient only, to the prescription of {inv.dentist}, in accordance with the Medical Devices Regulations 2002 (as amended).</p>
      <p><b>Patient:</b> {inv.patient} · <b>Case:</b> {inv.caseId} · <b>Prescriber:</b> {inv.dentist} · <b>Practice:</b> {inv.practice}</p>
      <ul>{inv.lines.filter(l => l.itemId).map(l => <li key={l.id}>{l.description}{l.part ? ` (${l.part.manufacturer}, part ${l.part.partNo})` : ''}</li>)}</ul>
      <p>The device conforms to the relevant essential requirements. Signed for {cfg.labName}, {fmtDate(inv.issuedAt ?? inv.createdAt)}.</p>
      <Footer left={`Attached to ${inv.number ?? 'draft invoice'}`} />
    </div>
  );
}

export function StatementDoc({ st, acc }: { st: Statement; acc?: BillingAccount }) {
  const cur = st.currency;
  const rows = [
    ...st.invoices.map(x => ({ date: x.date, text: `Invoice ${x.number}`, debit: x.amount, credit: 0 })),
    ...st.credits.map(x => ({ date: x.date, text: `Credit note ${x.number}`, debit: 0, credit: x.amount })),
    ...st.payments.map(x => ({ date: x.date, text: x.ref, debit: 0, credit: x.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const overdue = st.ageing.d30 + st.ageing.d60 + st.ageing.d90;
  return (
    <div style={{ color: '#030213' }}>
      <Header title="STATEMENT" right={<p style={{ margin: '4px 0 0' }}>{fmtMonth(st.period)}</p>} />
      <p style={{ fontSize: 11, margin: '0 0 10px' }}><b>{acc?.name}</b>{acc?.kind === 'dentist' ? ` (pays directly; ${acc.practices?.join(', ')})` : ''} · {acc?.emails.join(', ')}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={head}>Date</th><th style={head}>Details</th><th style={{ ...head, textAlign: 'right' }}>Charges</th><th style={{ ...head, textAlign: 'right' }}>Credits</th></tr></thead>
        <tbody>
          <tr><td style={cell}>{fmtDate(`${st.period}-01`)}</td><td style={cell}><b>Opening balance</b> (includes balances in Xero from before the switch-over)</td><td style={{ ...cell, textAlign: 'right' }}>{money(st.opening, cur)}</td><td style={cell} /></tr>
          {rows.map((r, i) => <tr key={i}><td style={cell}>{fmtDate(r.date)}</td><td style={cell}>{r.text}</td><td style={{ ...cell, textAlign: 'right' }}>{r.debit ? money(r.debit, cur) : ''}</td><td style={{ ...cell, textAlign: 'right' }}>{r.credit ? money(r.credit, cur) : ''}</td></tr>)}
          <tr><td style={cell} /><td style={{ ...cell, fontWeight: 700 }}>Closing balance</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{money(st.closing, cur)}</td><td style={cell} /></tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {[['Current', st.ageing.current], ['1–30 days overdue', st.ageing.d30], ['31–60 days', st.ageing.d60], ['60+ days', st.ageing.d90]].map(([k, v]) => (
          <div key={k as string} style={{ flex: 1, border: '1px solid #E0E0E6', borderRadius: 6, padding: '6px 8px' }}>
            <p style={{ fontSize: 9, color: '#717182', margin: 0, textTransform: 'uppercase' }}>{k}</p>
            <p style={{ fontSize: 12, fontWeight: 700, margin: 0, color: k !== 'Current' && (v as number) > 0 ? '#C62828' : '#030213' }}>{money(v as number, cur)}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: '#717182', marginTop: 10 }}>{overdue > 0 ? `${money(overdue, cur)} is overdue. ` : ''}Built from Xero, so it includes invoices from the old system and any raised directly in Xero.</p>
      <Footer left={`${acc?.name ?? ''} · ${fmtMonth(st.period)}`} />
    </div>
  );
}
