// ─── Split Print button · 13-Nov-2026 ────────────────────────────────────────
// "Print" prints everything; the arrow beside it opens a short menu to print
// one part only (the order form, the full statement, the case label). Used
// wherever the order form prints: Full View's footer, the settings editor's
// Print preview (the same Full View) and View Case's floating pill. The menu
// opens upwards, as every one of those sits at the bottom of its panel.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Printer } from 'lucide-react';

export interface PrintOption { label: string; sub?: string; onClick: () => void }

export default function SplitPrintButton({ onPrint, options, variant = 'button', label = 'Print' }: {
  onPrint: () => void;
  /** The parts that can print alone. With none, it is a plain Print button. */
  options: PrintOption[];
  /** 'button': the footer's gradient button; 'pill': inside the dark floating pill. */
  variant?: 'button' | 'pill';
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const pill = variant === 'pill';
  const shell = pill
    ? 'h-7 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[11px]'
    : 'rounded-lg bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-xs';
  return (
    <div ref={ref} className="relative inline-flex">
      <div className={`inline-flex items-stretch font-semibold overflow-hidden ${shell}`}>
        <button type="button" onClick={onPrint} className={`inline-flex items-center gap-1.5 hover:bg-white/10 transition-colors ${pill ? 'pl-3 pr-2' : 'pl-4 pr-3 py-2'}`}>
          <Printer className="w-3.5 h-3.5" />
          {label}
        </button>
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label="More print options"
            aria-haspopup="menu"
            aria-expanded={open}
            className={`inline-flex items-center border-l border-white/30 hover:bg-white/10 transition-colors ${pill ? 'px-1.5' : 'px-2'}`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 mb-2 w-60 rounded-xl border border-[#E0E0E6] bg-white shadow-xl py-1 z-30 text-left">
          <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A0A0B0]">Print only</p>
          {options.map(o => (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); o.onClick(); }}
              className="w-full px-3 py-2 text-left hover:bg-[#F8F9FC] transition-colors"
            >
              <span className="block text-xs font-semibold text-[#030213]">{o.label}</span>
              {o.sub && <span className="block text-[11px] text-[#717182] leading-snug">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
