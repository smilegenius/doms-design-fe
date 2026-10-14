import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

// Compact FDI tooth picker. The portal's /FDI.svg chart sits alongside the
// number grid so the quadrants read the way they do on the order form.

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export function ToothChips({ teeth, onRemove }: { teeth: number[]; onRemove?: (t: number) => void }) {
  if (!teeth.length) return null;
  return (
    <>
      {[...teeth].sort((a, b) => a - b).map(t => (
        <span key={t} className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F2FD] text-[#1565C0]">
          {t}
          {onRemove && (
            <button onClick={() => onRemove(t)} className="hover:text-[#030213]" aria-label={`Remove tooth ${t}`}><X className="w-3 h-3" /></button>
          )}
        </span>
      ))}
    </>
  );
}

export default function FdiPicker({ teeth, onChange }: { teeth: number[]; onChange: (t: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const toggle = (t: number) => onChange(teeth.includes(t) ? teeth.filter(x => x !== t) : [...teeth, t]);

  const row = (list: number[]) => (
    <div className="flex items-center gap-0.5">
      {list.map((t, i) => (
        <button
          key={t}
          onClick={() => toggle(t)}
          className={`w-[22px] h-7 rounded text-[10px] font-semibold transition-colors ${i === 8 ? 'ml-1.5' : ''} ${
            teeth.includes(t) ? 'bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] text-white' : 'bg-[#F8F9FC] text-[#717182] hover:bg-[#E3F2FD] hover:text-[#030213]'
          }`}
          aria-pressed={teeth.includes(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-[#E0E0E6] text-[#717182] hover:border-[#4D8EF7] hover:text-[#4D8EF7]"
      >
        <Plus className="w-3 h-3" /> Teeth
      </button>
      {open && (
        <div className="absolute z-30 left-0 bottom-full mb-2 bg-white border border-[#E0E0E6] rounded-xl shadow-lg p-3 flex gap-3">
          <img src="/FDI.svg" alt="FDI tooth chart" className="w-14 h-auto opacity-70 hidden sm:block" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wide">FDI · upper</span>
              <span className="text-[10px] text-[#A0A0B0]">R · L</span>
            </div>
            {row(UPPER)}
            <div className="h-px bg-[#F0EFF6] my-1.5" />
            {row(LOWER)}
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] font-semibold text-[#717182] uppercase tracking-wide">FDI · lower</span>
              <button onClick={() => setOpen(false)} className="text-[11px] font-medium text-[#4D8EF7] hover:text-[#3578E5]">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
