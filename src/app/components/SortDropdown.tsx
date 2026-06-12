import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, Check, ChevronDown } from 'lucide-react';

interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  options: SortOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function SortDropdown({ options, value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2.5 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors text-sm font-medium text-[#5A5568] h-[46px]"
      >
        <ArrowUpDown className="w-4 h-4 text-[#717182]" />
        <span className="hidden sm:inline">Sort</span>
        {current && (
          <span className="hidden md:inline text-[#4D8EF7] font-semibold">{current.label}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-[#717182] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg border border-[#E0E0E6] shadow-lg py-1 min-w-[180px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8F9FC] transition-colors flex items-center justify-between gap-3"
            >
              <span className={opt.value === value ? 'text-[#4D8EF7] font-semibold' : 'text-[#5A5568]'}>
                {opt.label}
              </span>
              {opt.value === value && <Check className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
