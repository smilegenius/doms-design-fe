import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface Country {
  name: string;
  code: string;
}

export const COUNTRIES: Country[] = [
  { name: 'United Kingdom', code: 'GB' },
  { name: 'Ireland', code: 'IE' },
  { name: 'United States', code: 'US' },
  { name: 'Germany', code: 'DE' },
  { name: 'France', code: 'FR' },
  { name: 'Spain', code: 'ES' },
  { name: 'Italy', code: 'IT' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'Belgium', code: 'BE' },
  { name: 'Switzerland', code: 'CH' },
  { name: 'Austria', code: 'AT' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Norway', code: 'NO' },
  { name: 'Denmark', code: 'DK' },
  { name: 'Finland', code: 'FI' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Poland', code: 'PL' },
  { name: 'Czech Republic', code: 'CZ' },
  { name: 'Hungary', code: 'HU' },
  { name: 'Romania', code: 'RO' },
  { name: 'Greece', code: 'GR' },
  { name: 'Luxembourg', code: 'LU' },
  { name: 'Liechtenstein', code: 'LI' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' },
  { name: 'New Zealand', code: 'NZ' },
  { name: 'Japan', code: 'JP' },
  { name: 'South Korea', code: 'KR' },
  { name: 'China', code: 'CN' },
  { name: 'India', code: 'IN' },
  { name: 'Singapore', code: 'SG' },
  { name: 'Hong Kong', code: 'HK' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Israel', code: 'IL' },
  { name: 'Turkey', code: 'TR' },
  { name: 'South Africa', code: 'ZA' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Chile', code: 'CL' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Malaysia', code: 'MY' },
  { name: 'Thailand', code: 'TH' },
  { name: 'Indonesia', code: 'ID' },
  { name: 'Philippines', code: 'PH' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Bangladesh', code: 'BD' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Egypt', code: 'EG' },
  { name: 'Morocco', code: 'MA' },
  { name: 'Kenya', code: 'KE' },
  { name: 'Ghana', code: 'GH' },
  { name: 'Russia', code: 'RU' },
  { name: 'Ukraine', code: 'UA' },
];

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  placeholder?: string;
}

export default function CountrySelect({ value, onChange, className = '', placeholder = 'Select country...' }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const selected = COUNTRIES.find(c => c.code === value);

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  const baseCls = `w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none cursor-pointer flex items-center justify-between gap-2 bg-white ${className}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`${baseCls} ${open ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/30' : 'border-[#E0E0E6]'}`}
      >
        <span className={`truncate ${selected ? 'text-[#030213]' : 'text-[#A0A0B0]'}`}>
          {selected ? `${selected.name} (${selected.code})` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#A0A0B0] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#E0E0E6] rounded-lg shadow-xl">
          {/* Search */}
          <div className="p-2 border-b border-[#F0EFF6]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E0E0E6] rounded-md focus:outline-none focus:border-[#4D8EF7]"
              />
            </div>
          </div>
          {/* List */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-[#A0A0B0] text-center">No countries found</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[#F8F9FC] transition-colors ${c.code === value ? 'text-[#4D8EF7] font-medium bg-[#F0EFF6]' : 'text-[#030213]'}`}
                >
                  <span>{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#A0A0B0]">{c.code}</span>
                    {c.code === value && <Check className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
