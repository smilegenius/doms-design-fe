import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface DropdownFilterProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

// Shows the inline search box when the list has more than this many options.
// Below the threshold the dropdown stays compact.
const SEARCH_THRESHOLD = 6;

export default function DropdownFilter({ label, options, value, onChange }: DropdownFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the search input when the dropdown opens.
  useEffect(() => {
    if (isOpen && options.length > SEARCH_THRESHOLD) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, options.length]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const showSearch = options.length > SEARCH_THRESHOLD;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E0E0E6] rounded-lg text-[#030213] hover:bg-[#F8F9FC] transition-colors w-full justify-between"
      >
        <span className="text-sm font-medium truncate">
          {label && <>{label}: </>}<span className="text-[#717182]">{selectedOption?.label || 'All'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#717182] transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full min-w-[14rem] bg-white border border-[#E0E0E6] rounded-lg shadow-lg z-10 overflow-hidden">
          {showSearch && (
            <div className="p-2 border-b border-[#F0EFF6] relative">
              <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${(label || 'options').toLowerCase()}…`}
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-[#A0A0B0] text-center py-4">No matches.</p>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F8F9FC] transition-colors text-left"
                >
                  <span className="text-sm text-[#030213] truncate">{option.label}</span>
                  {value === option.value && <Check className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
