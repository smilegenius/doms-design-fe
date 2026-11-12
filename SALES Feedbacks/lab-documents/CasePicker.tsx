import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { allCases } from '../bulk-actions/caseContent';

/** Pick any case to preview: type a case ID, patient or practice. */
export default function CasePicker({ value, onChange, label = 'Preview case' }: { value: string; onChange: (id: string) => void; label?: string }) {
  const cases = useMemo(() => allCases().filter(c => c.status !== 'draft'), []);
  const [text, setText] = useState('');
  const current = cases.find(c => c.id === value);
  const listId = 'sf-docs-cases';
  function pick(v: string) {
    setText(v);
    const id = v.split(' · ')[0].trim();
    if (cases.some(c => c.id === id)) { onChange(id); setText(''); }
  }
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-[#5A5568]">
      {label}
      <span className="relative">
        <Search className="w-3 h-3 absolute left-2 top-2 text-[#A0A0B0]" />
        <input
          list={listId}
          value={text}
          onChange={e => pick(e.target.value)}
          placeholder={current ? `${current.id} · ${current.patientName}` : 'Search cases'}
          className="border border-[#E0E0E6] rounded-md pl-6 pr-2 py-1 text-xs w-64 bg-white placeholder:text-[#030213]"
          aria-label={label}
        />
        <datalist id={listId}>
          {cases.map(c => <option key={c.id} value={`${c.id} · ${c.patientName} · ${c.practice}`} />)}
        </datalist>
      </span>
      <span className="text-[10px] text-[#A0A0B0]">{cases.length} cases</span>
    </label>
  );
}
