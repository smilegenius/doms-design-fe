import { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { LAB_MEMBERS, LabMember } from '../data/designStudio';

// Comment box that grows with its content. Typing "@" opens the lab team; a
// pick becomes an avatar chip (stored as a LabMember id), not raw text.

export function MentionChip({ member, onRemove }: { member: LabMember; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-[#F8F9FC] border border-[#E0E0E6] text-[11px] font-medium text-[#030213]">
      <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[8px] font-bold flex items-center justify-center">{member.initials}</span>
      {member.name}
      {onRemove && <button onClick={onRemove} className="text-[#717182] hover:text-[#030213]" aria-label={`Remove ${member.name}`}><X className="w-3 h-3" /></button>}
    </span>
  );
}

export default function MentionTextarea({ value, onChange, mentions, onMentionsChange, placeholder, autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  mentions: string[];
  onMentionsChange: (m: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }, [value]);

  // Name matches first, then role matches ("@cad" finds Mark).
  const q = (query ?? '').toLowerCase();
  const matches = query === null ? [] : [
    ...LAB_MEMBERS.filter(m => m.name.toLowerCase().startsWith(q)),
    ...LAB_MEMBERS.filter(m => !m.name.toLowerCase().startsWith(q) && m.role.toLowerCase().includes(q)),
  ];

  function detect(v: string, caret: number) {
    const m = /@(\w*)$/.exec(v.slice(0, caret));
    setQuery(m ? m[1] : null);
    setActive(0);
  }

  function pick(member: LabMember) {
    const el = ref.current!;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@(\w*)$/, '');
    onChange((before + value.slice(caret)).replace(/ {2,}/g, ' '));
    if (!mentions.includes(member.id)) onMentionsChange([...mentions, member.id]);
    setQuery(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
  }

  return (
    <div className="relative">
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {mentions.map(id => {
            const m = LAB_MEMBERS.find(x => x.id === id);
            return m ? <MentionChip key={id} member={m} onRemove={() => onMentionsChange(mentions.filter(x => x !== id))} /> : null;
          })}
        </div>
      )}
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        rows={2}
        value={value}
        onChange={e => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart); }}
        onKeyDown={e => {
          if (!matches.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % matches.length); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + matches.length) % matches.length); }
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[active]); }
          if (e.key === 'Escape') setQuery(null);
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        placeholder={placeholder ?? 'Add a comment — type @ to mention someone at the lab'}
        className="w-full resize-none px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:border-[#4D8EF7] bg-white"
      />
      {matches.length > 0 && (
        <div className="absolute z-30 left-2 top-full mt-1 w-56 bg-white border border-[#E0E0E6] rounded-xl shadow-lg py-1">
          {matches.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={e => { e.preventDefault(); pick(m); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${i === active ? 'bg-[#F8F9FC]' : ''}`}
            >
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[9px] font-bold flex items-center justify-center">{m.initials}</span>
              <span className="text-sm text-[#030213]">{m.name}</span>
              <span className="text-[11px] text-[#717182]">· {m.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
