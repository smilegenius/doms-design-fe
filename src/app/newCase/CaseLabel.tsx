// ─── Case label · 12-Nov-2026 ────────────────────────────────────────────────
// An optional label for the outgoing box (Settings › Order Form › Case label),
// printed from beside the order form's Print. Laid out like a delivery label:
// who it goes to (dentist, practice, full address, postcode in bold) is the
// biggest thing on it, then patient and product, the lab as sender (with its
// logo), the case ID as a small reference, "Custom-made device" (UK packaging)
// and "Powered by Smile Genius". Black on white, for thermal label printers.
// The idea came from the Growth team's samples; it is drawn here with the order
// form's own type and pieces.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { FakeQr } from '../components/DispatchLabel';
import type { OrderFormModel } from './OrderForm';
import { LABEL_STOCK, useOrderFormSettings, type OrderFormSettings } from './orderFormSettings';

const LABEL_FONT = '"Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;

/** "22 Elmfield Road, Headingley, Leeds LS6 2AB" → its lines, the postcode on its own last line. */
function addressLines(address: string): { lines: string[]; postcode: string | null } {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  const m = last.match(UK_POSTCODE);
  if (!m) return { lines: parts, postcode: null };
  const town = last.slice(0, m.index).trim();
  return { lines: [...parts.slice(0, -1), ...(town ? [town] : [])], postcode: m[1].toUpperCase() };
}

/**
 * 12-Nov, round 2 ("improve the label"): no dead space and nothing too small to read off a box. Top to bottom:
 * a header strip (custom-made device · the case ID), Deliver to (the address block, postcode boxed), then a band with
 * the case's QR code (opens the case) beside Patient / Product / Due, and the sender at the foot.
 */
export function CaseLabel({ model, s }: { model: OrderFormModel; s: OrderFormSettings }) {
  const stock = LABEL_STOCK[s.labelStock];
  const big = s.labelStock === '102x152';
  // Type is set for the 4 × 6 label and scaled for the 62 mm roll; nothing prints under ~6.5 px (about 5 pt).
  const k = big ? 1 : 0.62;
  const px = (n: number) => Math.round(n * k * 10) / 10;
  const logo = s.showLogo && s.logo ? s.logo : null;
  const { lines, postcode } = addressLines(model.practice.address);
  const product = model.caseType.join(', ') || '—';
  const due = [...model.services.map(x => x.delivery), ...(model.cases ?? []).map(c => c.service.delivery)].find(Boolean);
  const cap = (t: string) => (
    <p style={{ fontSize: Math.max(6.5, px(9)), letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555', margin: 0, fontWeight: 700, lineHeight: 1.2 }}>{t}</p>
  );
  const rule = (w = 1) => <div style={{ borderTop: `${w}px solid #000`, margin: `${px(9)}px 0` }} />;
  return (
    <div
      style={{
        width: `${stock.w}mm`, height: `${stock.h}mm`, boxSizing: 'border-box', padding: big ? '5mm' : '3mm',
        borderRadius: big ? '3mm' : '2mm', border: '1px solid #000', background: '#fff', color: '#000',
        fontFamily: LABEL_FONT, display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}
    >
      {/* Header strip: what's inside (UK packaging) and the case reference. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: px(6), background: '#000', color: '#fff', borderRadius: px(4), padding: `${px(5)}px ${px(8)}px` }}>
        <span style={{ fontSize: Math.max(6.5, px(10)), fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Custom-made device</span>
        <span style={{ fontSize: Math.max(6.5, px(10)), fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{model.id}</span>
      </div>

      {/* Deliver to: the biggest thing on the label. */}
      <div style={{ marginTop: px(10) }}>
        {cap('Deliver to')}
        <p style={{ fontSize: px(22), fontWeight: 800, margin: `${px(2)}px 0 0`, lineHeight: 1.12 }}>{model.dentist.name}</p>
        <p style={{ fontSize: px(16), fontWeight: 700, margin: `${px(2)}px 0 0`, lineHeight: 1.2 }}>{model.practice.name}</p>
        <div style={{ fontSize: px(16), lineHeight: 1.3, marginTop: px(2) }}>
          {lines.map((l, i) => <p key={i} style={{ margin: 0 }}>{l}</p>)}
        </div>
        {postcode && (
          <p style={{ display: 'inline-block', margin: `${px(5)}px 0 0`, padding: `${px(1)}px ${px(6)}px`, border: '1.5px solid #000', borderRadius: px(3), fontSize: px(20), fontWeight: 800, letterSpacing: '0.04em' }}>
            {postcode}
          </p>
        )}
      </div>

      {rule(1.5)}

      {/* The case: a code to open it, and what's in the box. */}
      {/* It takes the space left between the address and the sender, centred in it (no gap on the label). */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: px(10), alignItems: 'center' }}>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <FakeQr seed={model.url} size={px(100)} />
          <p style={{ fontSize: Math.max(6.5, px(8)), margin: `${px(2)}px 0 0`, color: '#333' }}>Scan to open</p>
        </div>
        <div style={{ minWidth: 0, display: 'grid', rowGap: px(6) }}>
          <div>{cap('Patient')}<p style={{ fontSize: px(14), fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{model.patient.name}</p></div>
          <div>{cap('Product')}<p style={{ fontSize: px(13), fontWeight: 600, margin: 0, lineHeight: 1.25 }}>{product}</p></div>
          {due && <div>{cap('Due')}<p style={{ fontSize: px(13), fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{due}</p></div>}
        </div>
      </div>

      {/* From: the lab, at the foot. */}
      <div style={{ marginTop: px(9), borderTop: '1px solid #000', paddingTop: px(7) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: px(8) }}>
          {logo && <img src={logo} alt="" style={{ height: px(28), width: 'auto', maxWidth: '35%', objectFit: 'contain', objectPosition: 'left', filter: 'grayscale(1)' }} />}
          <div style={{ minWidth: 0 }}>
            {cap('From')}
            <p style={{ fontSize: Math.max(7.5, px(12)), fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{model.lab.name}</p>
            <p style={{ fontSize: Math.max(6.5, px(10)), margin: 0, lineHeight: 1.25, color: '#222' }}>{model.lab.address}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: px(4), marginTop: px(5), fontSize: Math.max(6.5, px(9)), color: '#333' }}>
          Powered by
          <span style={{ width: Math.max(44, px(72)), display: 'inline-flex' }}><SmileGeniusWordmark gradientId={`label_${model.id}`} smileFill="#000" className="w-full h-auto" /></span>
        </div>
      </div>
    </div>
  );
}

/**
 * Print the label on its own stock. The page is set at print time (a style added last, so its @page wins over
 * an open Full View's A4 one) and only the label's body-level copy is shown; both are removed afterwards.
 */
function printLabel(stockKey: OrderFormSettings['labelStock']) {
  const { page } = LABEL_STOCK[stockKey];
  const style = document.createElement('style');
  style.textContent = `
    @media print {
      @page { size: ${page.w}mm ${page.h}mm; margin: 3mm; }
      body.of-label-printing > *:not(.of-label-root) { display: none !important; }
      body.of-label-printing > .of-label-root { display: block !important; position: static !important; visibility: visible !important; }
    }`;
  document.head.appendChild(style);
  document.body.classList.add('of-label-printing');
  const done = () => { style.remove(); document.body.classList.remove('of-label-printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);
}

/** The label at its real size with Print: opened from Print label beside the order form's Print. */
export function CaseLabelView({ model, settings, onClose, autoPrint }: { model: OrderFormModel; settings?: OrderFormSettings; onClose: () => void; autoPrint?: boolean }) {
  const saved = useOrderFormSettings();
  const s = settings ?? saved;
  const stock = LABEL_STOCK[s.labelStock];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => printLabel(s.labelStock), 150);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Case label ${model.id}`}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[94vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#F0EFF6]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#030213]">Case label · {model.id}</p>
              <p className="text-[11px] text-[#717182] mt-0.5 truncate">For the outgoing box · {stock.label}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-[#E9E9EE] p-6 flex justify-center">
            <div className="shadow-[0_2px_12px_rgba(0,0,0,0.15)] h-fit">
              <CaseLabel model={model} s={s} />
            </div>
          </div>
          {/* The header's × closes it, so the footer holds only the real action. */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#F0EFF6]">
            <p className="text-[11px] text-[#717182]">Actual size. Set your label printer to {stock.label}.</p>
            <button
              onClick={() => printLabel(s.labelStock)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print label
            </button>
          </div>
        </div>
      </div>
      {/* What the printer gets: hidden until printing, then the only thing on the page. */}
      {createPortal(
        <div className="of-label-root" aria-hidden style={{ display: 'none' }}>
          <CaseLabel model={model} s={s} />
        </div>,
        document.body,
      )}
    </ModalPortal>
  );
}
