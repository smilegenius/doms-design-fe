import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  dividerAbove?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: 'left' | 'right';
}

export default function ActionMenu({ items, align = 'right' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`p-1.5 rounded-md transition-colors text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] ${open ? 'bg-[#F0EFF6] text-[#030213]' : ''}`}
        title="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 z-[70] bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1.5 min-w-[172px] w-max ${align === 'right' ? 'right-0' : 'left-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.dividerAbove && i > 0 && (
                <div className="my-1 border-t border-[#F0EFF6]" />
              )}
              <button
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
                  item.variant === 'danger'
                    ? 'text-[#D4183D] hover:bg-[#FFF1F4]'
                    : 'text-[#030213] hover:bg-[#F8F9FC]'
                }`}
              >
                <span className={`flex-shrink-0 ${item.variant === 'danger' ? 'text-[#D4183D]' : 'text-[#717182]'}`}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
