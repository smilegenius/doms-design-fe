import { useMemo, useState } from 'react';
import { Printer, Stethoscope, X } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from './SmileGeniusWordmark';

// ─── Digital Rx · Lab ticket ─────────────────────────────────────────────────
// The A4 sheet that goes in the parcel with the impressions. There is no paper
// prescription: the case number tells the lab which case to open in Smile
// Genius. The same sheet is printed per case (single or bulk) and, with the
// case number left blank, from Settings so the receptionist can write it in.

/** Deterministic QR-style pattern from a seed — a stand-in for the real code. */
export function FakeQr({ seed, size = 74 }: { seed: string; size?: number }) {
  const cells = useMemo(() => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 121 }, (_, i) => {
      const x = i % 11, y = Math.floor(i / 11);
      if ((x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7)) return !(x === 1 && y === 1) && !(x === 9 && y === 1) && !(x === 1 && y === 9);
      h = (h * 1103515245 + 12345) >>> 0;
      return (h >> 16) % 2 === 0;
    });
  }, [seed]);
  return (
    <div className="grid grid-cols-11 flex-shrink-0" style={{ width: size, height: size, gap: size / 50 }} aria-hidden>
      {cells.map((on, i) => <span key={i} className={`rounded-[1px] ${on ? 'bg-[#030213]' : ''}`} />)}
    </div>
  );
}

const STEPS = [
  <>Log in at <b>dental.smilegeniusapp.com/login</b></>,
  <><b>Search the case number</b> above and review the prescription.</>,
  <><b>Accept</b> the case. Anything unclear? Message or call the practice first.</>,
  <>When the work goes out, <b>mark it as Shipped.</b></>,
];

/** One A4 sheet, 794 × 1123 px (210 × 297 mm at 96 dpi). caseNumber null = blank, to write in by hand. */
export interface LabelDetails { patient?: string; dentist?: string; clinic?: string }

/** Patient / Dentist / Clinic, filled from the case or left as empty lines to write on. */
function DetailRows({ details }: { details?: LabelDetails }) {
  const rows: [string, string | undefined][] = [['Patient', details?.patient], ['Dentist', details?.dentist], ['Clinic', details?.clinic]];
  return (
    <div className="mt-6 grid grid-cols-3 gap-6 px-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5A5568]">{label}</p>
          <div className="h-10 mt-1 border-b-2 border-[#030213] flex items-end pb-1">
            {value && <span className="text-[17px] font-semibold leading-tight truncate">{value}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DispatchLabelPage({ caseNumber, labName, details }: { caseNumber: string | null; labName?: string; details?: LabelDetails }) {
  return (
    <div className="dl-page bg-white text-[#030213] relative overflow-hidden flex flex-col" style={{ width: 794, height: 1123, fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="h-1.5 w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]" />
      <div className="flex-1 flex flex-col px-14 pt-9 pb-10">
        <div className="flex items-center justify-between">
          <SmileGeniusWordmark gradientId={`dl_grad_${caseNumber ?? 'blank'}`} />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EEF4FF] border border-[#C8D8FC] text-[15px] font-semibold text-[#1565C0]">
            <Stethoscope className="w-4 h-4" />
            {labName ?? 'Digital Rx'}
          </span>
        </div>

        <div className="mt-8 rounded-3xl border-2 border-[#030213] px-8 py-8 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#5A5568]">Case number</p>
          {caseNumber ? (
            <p className="text-[72px] leading-none font-bold mt-4 tracking-tight">{caseNumber}</p>
          ) : (
            // Blank sheet: a line to write the case number on.
            <div className="mt-20 flex justify-center">
              <span className="block w-[420px] border-b-[3px] border-[#030213]" />
            </div>
          )}
          <p className="text-[16px] text-[#5A5568] mt-5 leading-snug max-w-[520px] mx-auto">
            There’s no paper prescription with this case. The full prescription is in Smile Genius.
          </p>
        </div>

        <DetailRows details={details} />

        <div className="mt-6 rounded-3xl bg-[#F5F6FA] border border-[#E6E8F0] p-8 flex gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#1565C0]">For the lab</p>
            <p className="text-[26px] font-bold leading-tight mt-2">Open, accept and ship this case in Smile Genius</p>
            <ol className="mt-5 space-y-3.5">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3.5 text-[15px] leading-snug">
                  <span className="w-7 h-7 rounded-full bg-[#1565C0] text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="w-[190px] flex-shrink-0 flex flex-col items-center">
            <div className="w-[190px] h-[190px] rounded-2xl border border-[#E6E8F0] bg-white flex items-center justify-center">
              <FakeQr seed="smile-genius-lab-video" size={150} />
            </div>
            <p className="text-[12px] font-semibold text-[#5A5568] mt-3 text-center leading-snug">Watch: search, accept &amp; ship a case</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="rounded-3xl bg-[#080614] text-white px-8 py-7 flex items-center justify-between gap-6">
          <div>
            <p className="text-[22px] font-bold">Trouble signing in? Need help?</p>
            <p className="text-[14px] text-white/80 mt-2 leading-snug max-w-[420px]">
              Email <b>support@smilegeniusdental.com</b> or scan to book time with the Smile Genius team.
            </p>
          </div>
          <div className="bg-white rounded-xl p-2 flex-shrink-0">
            <FakeQr seed="smile-genius-support" size={72} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Preview of one or more label sheets with a Print button. Printing hides the
 * app and prints only the sheets, one per A4 page (the browser's print dialog
 * also offers Save as PDF).
 */
export function PrintLabelsModal({ caseNumbers, labNames, details, title, subtitle, allowCopies, onClose, onPrinted }: {
  /** null = a blank sheet. */
  caseNumbers: (string | null)[];
  /** The lab each sheet is addressed to, in the same order as caseNumbers. */
  labNames?: (string | undefined)[];
  /** Patient / dentist / clinic for each sheet, in the same order. Omit for empty lines. */
  details?: (LabelDetails | undefined)[];
  title: string;
  subtitle?: string;
  /** Show a "copies" control — each sheet is printed that many times. */
  allowCopies?: boolean;
  onClose: () => void;
  onPrinted?: () => void;
}) {
  const { toast } = useToast();
  const [copies, setCopies] = useState(1);
  const setClamped = (n: number) => setCopies(Math.min(100, Math.max(1, Math.floor(n) || 1)));
  const items = caseNumbers.map((n, i) => ({ n, lab: labNames?.[i], d: details?.[i] }));
  const sheets = allowCopies ? items.flatMap(it => Array.from({ length: copies }, () => it)) : items;
  return (
    <ModalPortal>
      <style>{`
        .dl-print-root { display: none; }
        @media print {
          @page { size: A4; margin: 0; }
          body > *:not(.dl-print-root) { display: none !important; }
          .dl-print-root { display: block !important; }
          .dl-print-root .dl-page { break-after: page; page-break-after: always; }
        }
      `}</style>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
            <div>
              <p className="text-sm font-semibold text-[#030213]">{title}</p>
              {subtitle && <p className="text-[11px] text-[#717182] mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#F3F3F5] p-5 space-y-4">
            {items.map(({ n, lab, d }, i) => (
              <div key={`${n}-${i}`} className="mx-auto shadow-md border border-[#E0E0E6]" style={{ width: 794 * 0.62, height: 1123 * 0.62 }}>
                <div style={{ transform: 'scale(0.62)', transformOrigin: 'top left' }}>
                  <DispatchLabelPage caseNumber={n} labName={lab} details={d} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#F0EFF6]">
            <div className="min-w-0">
              {allowCopies && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[#030213]">Copies</span>
                  <div className="inline-flex items-center border border-[#E0E0E6] rounded-lg overflow-hidden">
                    <button onClick={() => setClamped(copies - 1)} disabled={copies <= 1} aria-label="Fewer copies" className="w-8 h-8 text-base text-[#5A5568] hover:bg-[#F8F9FC] disabled:opacity-40">−</button>
                    <input
                      type="number" min={1} max={100} value={copies}
                      onChange={e => setClamped(Number(e.target.value))}
                      aria-label="Number of copies"
                      className="w-12 h-8 text-center text-xs font-semibold border-x border-[#E0E0E6] focus:outline-none"
                    />
                    <button onClick={() => setClamped(copies + 1)} disabled={copies >= 100} aria-label="More copies" className="w-8 h-8 text-base text-[#5A5568] hover:bg-[#F8F9FC] disabled:opacity-40">+</button>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-[#717182]">A4 · {sheets.length} sheet{sheets.length === 1 ? '' : 's'}. Choose “Save as PDF” in the print window to download.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors">
                Close
              </button>
              <button
                onClick={() => {
                  // The blank label from Settings is a real print / save-as-PDF; case labels just
                  // confirm that they are printing.
                  if (allowCopies) window.print();
                  toast.success(sheets.length === 1 ? 'Printing label…' : `Printing ${sheets.length} labels…`);
                  onPrinted?.();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Print-only copy at body level — what the browser actually prints. */}
      <div className="dl-print-root">
        {sheets.map(({ n, lab, d }, i) => <DispatchLabelPage key={`${n}-${i}`} caseNumber={n} labName={lab} details={d} />)}
      </div>
    </ModalPortal>
  );
}

