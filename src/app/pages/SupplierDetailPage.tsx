import { useState, useEffect, useRef, ReactNode } from 'react';
import {
  ArrowLeft, Mail, Phone, Globe, MapPin, Tag, FileText, Building2, CreditCard,
  ChevronDown, Check, Copy, ExternalLink, Pencil,
  Receipt, Building, Search, Info, Star, Plus, X,
} from 'lucide-react';
import { Supplier, SupplierRelationshipStatus, SupplierGLMapping, GL_ACCOUNTS, EXPENSE_CATEGORIES, WorkflowType } from '../data/suppliersData';
import { COUNTRIES } from '../components/CountrySelect';
import { INVOICES, CATEGORY_NOMINALS } from './InvoicesPage';
import ModalPortal from '../components/ModalPortal';
import { useToast } from '../context/ToastContext';

const WORKFLOW_OPTIONS: WorkflowType[] = ['Auto Approve', 'Single Approver', 'Two-Stage', 'CFO Required'];
const PAYMENT_TERM_OPTIONS = ['Due on receipt', '1 Week', 'Net 14', 'Net 15', 'Net 30', 'Net 60'];

const ALL_STATUSES: SupplierRelationshipStatus[] = [
  'Active', 'On hold', 'Not using', 'Archived', 'Pending review',
];

function statusStyle(s: SupplierRelationshipStatus) {
  switch (s) {
    case 'Active':         return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Pending review': return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'On hold':        return 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]';
    case 'Not using':      return 'text-[#5A5568] bg-[#F0EFF6] border-[#D4CEE1]';
    case 'Archived':       return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}

// ─── Inline-editable row primitives ──────────────────────────────────────────
type RowProps = {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  link?: string;          // make value a clickable link when not editing
  multiline?: boolean;
  hint?: ReactNode;       // optional inline hint shown beside label (e.g. info icon)
  readOnly?: boolean;     // when true, the value renders as static text + a "read-only" tag
};

function EditableTextRow({ icon, label, value, placeholder, onSave, link, multiline, hint, readOnly }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? '')) onSave(next);
  }
  function startEdit() {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#F8F9FC] last:border-0 group">
      <div className="w-7 h-7 rounded-lg bg-[#F8F9FC] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[#A0A0B0]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wide font-semibold">{label}</p>
          {hint}
          {readOnly && (
            <span className="text-[9px] text-[#C9C9D5] lowercase tracking-normal">read-only</span>
          )}
        </div>
        {readOnly ? (
          <p className="text-sm text-[#030213] break-words whitespace-pre-wrap">
            {value || <span className="text-[#A0A0B0]">—</span>}
          </p>
        ) : editing ? (
          multiline ? (
            <textarea
              ref={el => { inputRef.current = el; }}
              rows={3}
              value={draft}
              placeholder={placeholder}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Escape') { setDraft(value ?? ''); (e.target as HTMLTextAreaElement).blur(); }
              }}
              className="w-full text-sm text-[#030213] bg-white rounded-md px-2 py-1 border border-[#4D8EF7] outline-none ring-2 ring-[#4D8EF7]/20 resize-none"
            />
          ) : (
            <input
              ref={el => { inputRef.current = el; }}
              type="text"
              value={draft}
              placeholder={placeholder}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setDraft(value ?? ''); (e.target as HTMLInputElement).blur(); }
              }}
              className="w-full text-sm text-[#030213] bg-white rounded-md px-2 py-1 border border-[#4D8EF7] outline-none ring-2 ring-[#4D8EF7]/20"
            />
          )
        ) : value ? (
          link ? (
            <div className="flex items-center gap-2">
              <a href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-[#4D8EF7] hover:underline flex items-center gap-1 break-all">
                {value}<ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              <button onClick={startEdit} title="Edit" className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#A0A0B0] hover:text-[#4D8EF7]">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              title="Click to edit"
              className="text-left text-sm text-[#030213] hover:text-[#4D8EF7] break-words rounded px-1.5 -mx-1.5 py-0.5 hover:bg-[#EEF4FF] transition-colors w-full whitespace-pre-wrap"
            >
              {value}
            </button>
          )
        ) : (
          <button onClick={startEdit} className="text-sm text-[#A0A0B0] italic hover:text-[#4D8EF7] transition-colors flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Add {label.toLowerCase()}
          </button>
        )}
      </div>
      {value && !editing && (
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#A0A0B0] hover:text-[#4D8EF7]"
          title="Copy"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

function EditableSelectRow({
  icon, label, value, options, onSave, placeholder, hint, displayValue, badge,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  displayValue?: string;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    if (open && options.length > 6) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, options.length]);

  const shown = displayValue ?? value;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : options;
  const showSearch = options.length > 6;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#F8F9FC] last:border-0 group" ref={wrapRef}>
      <div className="w-7 h-7 rounded-lg bg-[#F8F9FC] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[#A0A0B0]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0 relative">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wide font-semibold">{label}</p>
          {badge}
          {hint}
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className={`text-left text-sm rounded px-1.5 -mx-1.5 py-0.5 hover:bg-[#EEF4FF] transition-colors flex items-center gap-1.5 w-full ${shown ? 'text-[#030213] hover:text-[#4D8EF7]' : 'text-[#A0A0B0] italic'}`}
        >
          <span className="flex-1 truncate">{shown || placeholder || `Set ${label.toLowerCase()}`}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-30 top-full left-0 mt-1 min-w-[240px] bg-white border border-[#E0E0E6] rounded-lg shadow-xl overflow-hidden">
            {showSearch && (
              <div className="p-2 border-b border-[#F0EFF6] relative">
                <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
                />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-[#A0A0B0] text-center py-3">No matches.</p>
              ) : (
                filtered.map(opt => {
                  const selected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { onSave(opt.value); setOpen(false); setQuery(''); }}
                      className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-3 hover:bg-[#F8F9FC] transition-colors ${selected ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nominal code picker — modal with code/name table + star for active default ──
function NominalCodePickerRow({
  value, displayValue, onSave, badge, hint,
}: {
  value: string;
  displayValue?: string;
  onSave: (code: string) => void;
  badge?: ReactNode;
  hint?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => { if (open) { setLocalValue(value); setSearch(''); } }, [open]);

  const filtered = GL_ACCOUNTS.filter(gl =>
    gl.code.includes(search) ||
    gl.nominalName.toLowerCase().includes(search.toLowerCase())
  );

  function apply() { onSave(localValue); setOpen(false); }

  const shown = displayValue ?? value;

  return (
    <>
      <div className="flex items-start gap-3 py-2.5 border-b border-[#F8F9FC] last:border-0 group">
        <div className="w-7 h-7 rounded-lg bg-[#F8F9FC] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[#A0A0B0]"><Tag className="w-3.5 h-3.5" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wide font-semibold">GL Code · GL Name</p>
            {badge}
            {hint}
          </div>
          <button
            onClick={() => setOpen(true)}
            className={`text-left text-sm rounded px-1.5 -mx-1.5 py-0.5 hover:bg-[#EEF4FF] transition-colors flex items-center gap-1.5 w-full ${shown ? 'text-[#030213] hover:text-[#4D8EF7]' : 'text-[#A0A0B0] italic'}`}
          >
            <span className="flex-1 truncate">{shown || 'Select GL code…'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0" />
          </button>
        </div>
      </div>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E6] flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-[#030213]">Select GL Code</h3>
                  <p className="text-[11px] text-[#717182] mt-0.5">Star marks the active default code for this supplier</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="w-7 h-7 rounded-full hover:bg-[#F3F3F5] flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-[#717182]" />
                </button>
              </div>
              {/* Search */}
              <div className="px-4 py-3 border-b border-[#F0EFF6] flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0A0B0]" />
                  <input autoFocus type="text" placeholder="Search GL code or name…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20" />
                </div>
              </div>
              {/* Column headers */}
              <div className="px-4 py-1.5 bg-[#F8F9FC] border-b border-[#E0E0E6] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-16 flex-shrink-0">Code</span>
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider flex-1">GL Name</span>
                  <div className="w-5 flex-shrink-0 flex items-center justify-center" title="Active default">
                    <Star className="w-3 h-3 text-[#D1D5DB]" />
                  </div>
                </div>
              </div>
              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0
                  ? <div className="py-8 text-center text-xs text-[#A0A0B0]">No codes found</div>
                  : filtered.map(gl => {
                    const isActive = localValue === gl.code;
                    return (
                      <button key={gl.code} type="button" onClick={() => setLocalValue(gl.code)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-[#F8F8F8] hover:bg-[#F5F8FF] ${isActive ? 'bg-[#FFFBEB]' : ''}`}>
                        <span className={`text-[11px] font-mono font-bold w-16 flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-[#4D8EF7]'}`}>{gl.code}</span>
                        <span className="text-xs text-[#030213] flex-1">{gl.nominalName}</span>
                        <div className="w-5 flex-shrink-0 flex items-center justify-center">
                          <Star className={`w-3.5 h-3.5 transition-colors ${isActive ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB]'}`} />
                        </div>
                      </button>
                    );
                  })}
              </div>
              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#E0E0E6] flex items-center justify-end gap-2 flex-shrink-0 bg-[#F8F9FC]">
                <button type="button" onClick={() => setOpen(false)} className="text-xs px-4 py-1.5 rounded-lg border border-[#E0E0E6] text-[#717182] hover:bg-[#F5F5F5] transition-colors">Cancel</button>
                <button type="button" onClick={apply} className="text-xs px-4 py-1.5 rounded-lg bg-[#4D8EF7] text-white font-semibold hover:bg-[#1565C0] transition-colors">Apply</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

// ── Inline editable categories — full modal with nominal codes + default flag ──
function EditableCategories({
  value, defaultCategory, onSave, onSaveDefault, title = 'Categories',
}: {
  value: string[];
  defaultCategory?: string;
  onSave: (next: string[]) => void;
  onSaveDefault?: (cat: string) => void;
  // Heading label for the chip block. The same component is re-used as
  // "Nominal Codes" inside Accounting Details now.
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(value);
  const [localDefault, setLocalDefault] = useState<string | undefined>(defaultCategory);
  const [search, setSearch] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [extraCats, setExtraCats] = useState<{ category: string; code: string; nominalName: string }[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newNominal, setNewNominal] = useState('');

  useEffect(() => { if (open) { setSelected(value); setLocalDefault(defaultCategory); } }, [open]);

  const allCats = [...CATEGORY_NOMINALS, ...extraCats];
  const filtered = allCats.filter(c =>
    c.category.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search) ||
    c.nominalName.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(cat: string) {
    setSelected(prev => {
      const removing = prev.includes(cat);
      if (removing && cat === localDefault) setLocalDefault(undefined);
      return removing ? prev.filter(c => c !== cat) : [...prev, cat];
    });
  }

  function addNew() {
    if (!newCat.trim()) return;
    const entry = { category: newCat.trim(), code: newCode.trim() || '—', nominalName: newNominal.trim() || newCat.trim() };
    setExtraCats(prev => [...prev, entry]);
    setSelected(prev => [...prev, entry.category]);
    setNewCat(''); setNewCode(''); setNewNominal(''); setAddMode(false);
  }

  function apply() {
    onSave(selected);
    if (localDefault !== defaultCategory && localDefault) onSaveDefault?.(localDefault);
    setOpen(false); setSearch(''); setAddMode(false);
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-[#A0A0B0] font-semibold uppercase tracking-wide">{title}</p>
          <button onClick={() => setOpen(true)} className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#3578E5] flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {value.length > 0 ? value.map(c => {
            const isDefault = c === defaultCategory;
            // Look up the nominal code for this category so the chip can render
            // as "{code} {label}" — the canonical Smile Genius nominal-code shape.
            const nominal = [...CATEGORY_NOMINALS, ...extraCats].find(n => n.category === c);
            return (
              <span key={c} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${isDefault ? 'bg-[#FFF8E1] text-[#92400E]' : 'bg-[#F0EFF6] text-[#5A5568]'}`}>
                {isDefault && <Star className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" />}
                {nominal?.code && (
                  <span className="font-mono font-bold tracking-wide">{nominal.code}</span>
                )}
                {c}
              </span>
            );
          }) : <span className="text-sm text-[#A0A0B0] italic">No {title.toLowerCase()} assigned.</span>}
        </div>
      </div>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E6] flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-[#030213]">Categories & GL Codes</h3>
                  <p className="text-[11px] text-[#717182] mt-0.5">{selected.length} selected — star flags the default</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="w-7 h-7 rounded-full hover:bg-[#F3F3F5] flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-[#717182]" />
                </button>
              </div>
              {/* Search */}
              <div className="px-4 py-3 border-b border-[#F0EFF6] flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0A0B0]" />
                  <input autoFocus type="text" placeholder="Search category, code, or GL name…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-2 rounded-lg border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20" />
                </div>
              </div>
              {/* Column headers */}
              <div className="px-4 py-1.5 bg-[#F8F9FC] border-b border-[#E0E0E6] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-4 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider flex-1">Category</span>
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-14 text-right flex-shrink-0">Code</span>
                  <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider w-32 text-right flex-shrink-0">GL Name</span>
                  <div className="w-5 flex-shrink-0" title="Flag as default"><Star className="w-3 h-3 text-[#D1D5DB] mx-auto" /></div>
                </div>
              </div>
              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0
                  ? <div className="py-8 text-center text-xs text-[#A0A0B0]">No categories found</div>
                  : filtered.map((c, i) => {
                    const isSel = selected.includes(c.category);
                    const isDefault = localDefault === c.category && isSel;
                    return (
                      <button key={i} type="button" onClick={() => toggle(c.category)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left border-b border-[#F8F8F8] hover:bg-[#F5F8FF] ${isDefault ? 'bg-[#FFFBEB]' : isSel ? 'bg-[#EEF4FF]' : ''}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D1D5DB]'}`}>
                          {isSel && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-xs text-[#030213] font-medium flex-1">{c.category}</span>
                        <span className={`text-[10px] font-mono font-semibold w-14 text-right flex-shrink-0 ${isDefault ? 'text-[#F59E0B]' : 'text-[#4D8EF7]'}`}>{c.code}</span>
                        <span className="text-[10px] text-[#717182] w-32 text-right truncate flex-shrink-0">{c.nominalName}</span>
                        <button
                          type="button"
                          title={isDefault ? 'Default — click to remove' : isSel ? 'Flag as default category' : ''}
                          onClick={(e) => { e.stopPropagation(); if (!isSel) return; setLocalDefault(prev => prev === c.category ? undefined : c.category); }}
                          className={`w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors ${isSel ? 'hover:bg-[#FEF3C7]' : 'pointer-events-none opacity-0'}`}
                        >
                          <Star className={`w-3.5 h-3.5 transition-colors ${isDefault ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB] hover:text-[#F59E0B]'}`} />
                        </button>
                      </button>
                    );
                  })}
              </div>
              {/* Add new */}
              <div className="border-t border-[#E0E0E6] flex-shrink-0">
                {addMode ? (
                  <div className="px-4 py-3 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">New Category</p>
                    <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Category name"
                      className="text-xs px-2.5 py-1.5 border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code e.g. 3620"
                        className="text-xs px-2.5 py-1.5 border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] font-mono" />
                      <input value={newNominal} onChange={e => setNewNominal(e.target.value)} placeholder="GL name"
                        className="text-xs px-2.5 py-1.5 border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={addNew} disabled={!newCat.trim()} className="flex-1 text-xs py-1.5 rounded-lg bg-[#4D8EF7] text-white font-semibold hover:bg-[#1565C0] transition-colors disabled:opacity-40">Add</button>
                      <button type="button" onClick={() => setAddMode(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-[#717182] hover:bg-[#F5F5F5] transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddMode(true)} className="w-full flex items-center gap-2 px-4 py-3 text-xs text-[#4D8EF7] font-semibold hover:bg-[#F5F9FF] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add new category & code
                  </button>
                )}
              </div>
              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#E0E0E6] flex items-center justify-between flex-shrink-0 bg-[#F8F9FC]">
                <button type="button" onClick={() => setSelected([])} className="text-xs text-[#717182] hover:text-[#C62828] transition-colors">Clear all</button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="text-xs px-4 py-1.5 rounded-lg border border-[#E0E0E6] text-[#717182] hover:bg-[#F5F5F5] transition-colors">Cancel</button>
                  <button type="button" onClick={apply} className="text-xs px-4 py-1.5 rounded-lg bg-[#4D8EF7] text-white font-semibold hover:bg-[#1565C0] transition-colors">Apply ({selected.length})</button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

// ── Inline editable supplier name (header) ──
function EditableName({ value, onSave }: { value: string; onSave: (v: string) => void; }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        className="text-xl font-semibold text-[#030213] bg-white rounded-md px-2 py-0.5 border border-[#4D8EF7] outline-none ring-2 ring-[#4D8EF7]/20 mb-1 w-full max-w-md"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit name"
      className="group flex items-center gap-2 text-xl font-semibold text-[#030213] mb-1 hover:text-[#4D8EF7] transition-colors"
    >
      <span>{value}</span>
      <Pencil className="w-3.5 h-3.5 text-[#A0A0B0] opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Inline editable country pill (header) ──
function EditableCountry({ value, onSave }: { value: string; onSave: (code: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = COUNTRIES.find(c => c.code === value);
  const filtered = COUNTRIES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-sm text-[#717182] hover:text-[#4D8EF7] transition-colors group"
        title="Click to change country"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>{current?.name ?? value}</span>
        <ChevronDown className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-all ${open ? 'rotate-180 opacity-100' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-64 bg-white border border-[#E0E0E6] rounded-lg shadow-xl">
          <div className="p-2 border-b border-[#F0EFF6]">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country…"
              className="w-full px-2 py-1.5 text-sm border border-[#E0E0E6] rounded outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.slice(0, 40).map(c => (
              <button
                key={c.code}
                onClick={() => { onSave(c.code); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-[#F8F9FC] transition-colors ${c.code === value ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
              >
                <span className="truncate">{c.name}</span>
                {c.code === value && <Check className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-[#A0A0B0] px-3 py-2">No countries match.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info-icon tooltip linking to settings (used on Nominal Code label) ──
function SettingsInfo({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-0.5 text-[#A0A0B0] hover:text-[#4D8EF7] transition-colors"
        title="Where do these codes come from?"
        type="button"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-40 left-5 top-1/2 -translate-y-1/2 w-56 bg-[#030213] text-white text-[11px] leading-snug rounded-lg shadow-xl px-3 py-2">
          <p className="font-semibold mb-0.5">Managed in Settings</p>
          <p className="text-[#D4CEE1] mb-1.5">GL codes are defined under Spend&nbsp;Settings → Accounting&nbsp;Integration → GL&nbsp;Codes.</p>
          {onNavigate && (
            <button
              onClick={() => { setOpen(false); onNavigate(); }}
              className="text-[#A59DFF] hover:underline font-medium"
            >
              Open settings →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mock data generators ─────────────────────────────────────────────────────
const PRACTICE_NAMES = ['Smile Genius Manchester', 'Smile Genius Edinburgh', 'Smile Genius Bristol', 'Smile Genius Leeds', 'Smile Genius Brighton', 'Smile Genius Birmingham', 'Smile Genius Liverpool', 'Smile Genius Newcastle'];
const INV_STATUSES = ['Paid', 'Paid', 'Paid', 'Pending', 'Overdue'] as const;

const INVOICE_STATUS_LABEL: Record<string, string> = {
  awaiting_approval: 'Awaiting Approval',
  disputed: 'Disputed',
  approved: 'Approved',
  exported_for_payment: 'Exported',
  payment_processed: 'Paid',
  archived: 'Archived',
};

function getSupplierInvoices(supplier: Supplier) {
  const realInvoices = INVOICES.filter(
    inv => inv.supplier.toLowerCase() === supplier.name.toLowerCase()
  ).map(inv => ({
    id: inv.id,
    number: inv.number,
    date: new Date(inv.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    amount: inv.amount,
    status: INVOICE_STATUS_LABEL[inv.status] ?? inv.status,
    rawStatus: inv.status,
    practice: inv.billedToName,
  }));
  if (realInvoices.length > 0) return realInvoices;
  // Fallback: synthetic rows when no real invoices match (avoids empty UI for demo data)
  return Array.from({ length: supplier.invoiceCount }, (_, i) => ({
    id: `INV-${String(supplier.invoiceCount - i).padStart(4, '0')}`,
    number: `INV-${String(supplier.invoiceCount - i).padStart(4, '0')}`,
    date: new Date(2024, (12 - (i % 12)) % 12, (i % 28) + 1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    amount: Math.round((supplier.ytdSpend / supplier.invoiceCount) * (0.7 + Math.random() * 0.6)),
    status: INV_STATUSES[i % INV_STATUSES.length] as string,
    rawStatus: undefined as string | undefined,
    practice: PRACTICE_NAMES[i % PRACTICE_NAMES.length],
  }));
}

function mockPractices(supplier: Supplier) {
  return Array.from({ length: supplier.practiceCount }, (_, i) => ({
    id: `P${i + 1}`,
    name: PRACTICE_NAMES[i % PRACTICE_NAMES.length],
    spend: Math.round(supplier.ytdSpend / supplier.practiceCount * (0.6 + Math.random() * 0.8)),
    invoices: Math.round(supplier.invoiceCount / supplier.practiceCount),
    status: i % 5 === 0 ? 'Inactive' : 'Active',
  }));
}

function invoiceStatusStyle(s: string) {
  switch (s) {
    case 'Paid':
    case 'Approved':           return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Pending':
    case 'Awaiting Approval':  return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'Disputed':
    case 'Overdue':            return 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]';
    case 'Exported':           return 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]';
    default:                   return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
interface SupplierDetailPageProps {
  supplier: Supplier;
  onBack: () => void;
  onStatusChange: (id: string, status: SupplierRelationshipStatus) => void;
  onSave?: (id: string, updates: Partial<Supplier>) => void;
  onOpenInvoice?: (invoiceId: string, supplierName: string) => void;
  onNavigateToSettings?: () => void;
}

type TabId = 'details' | 'invoices' | 'practices';

export default function SupplierDetailPage({ supplier, onBack, onStatusChange, onSave, onOpenInvoice, onNavigateToSettings }: SupplierDetailPageProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [activeTab,  setActiveTab]  = useState<TabId>('details');
  const [invSearch,  setInvSearch]  = useState('');
  const [pracSearch, setPracSearch] = useState('');
  const { toast } = useToast();

  function formatCurrency(n: number) { return '£' + n.toLocaleString('en-GB'); }

  // Patch any field on the supplier and toast.
  function patch(updates: Partial<Supplier>, label?: string) {
    onSave?.(supplier.id, updates);
    toast.success(label ? `${label} updated` : 'Supplier updated');
  }

  // Patch a single key on the supplier's GL mapping. Initialises mapping if missing.
  function patchGL(partial: Partial<SupplierGLMapping>, label: string) {
    const base: SupplierGLMapping = supplier.glMapping ?? {
      glCode: { code: '', nominalName: '' },
      category: '',
      workflow: 'Auto Approve',
      paymentTerms: 'Net 30',
    };
    const next: SupplierGLMapping = { ...base, ...partial };
    onSave?.(supplier.id, { glMapping: next });
    toast.success(`${label} updated`);
  }

  function setNominalByCode(code: string) {
    const gl = GL_ACCOUNTS.find(g => g.code === code);
    if (!gl) return;
    patchGL({ glCode: gl }, 'GL code');
  }

  const invoices  = getSupplierInvoices(supplier).filter(inv =>
    !invSearch ||
    inv.id.toLowerCase().includes(invSearch.toLowerCase()) ||
    inv.number.toLowerCase().includes(invSearch.toLowerCase()) ||
    inv.practice.toLowerCase().includes(invSearch.toLowerCase())
  );
  const practices = mockPractices(supplier).filter(p =>
    !pracSearch || p.name.toLowerCase().includes(pracSearch.toLowerCase())
  );

  const nominalDisplay = supplier.glMapping?.glCode.code
    ? `${supplier.glMapping.glCode.code} · ${supplier.glMapping.glCode.nominalName}`
    : '';

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {statusOpen && <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />}

      {/* ── Header bar ── */}
      <div className="bg-white border-b border-[#E0E0E6]">
        <div className="px-6 py-4">
          {/* Top row */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213] transition-colors">
              <ArrowLeft className="w-4 h-4" />My Suppliers
            </button>
            <div className="flex items-center gap-2">
              {/* Status */}
              <div className="relative z-50">
                <button onClick={() => setStatusOpen(v => !v)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5 hover:opacity-80 transition-opacity ${statusStyle(supplier.relationshipStatus)}`}>
                  {supplier.relationshipStatus}
                  <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
                </button>
                {statusOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1 min-w-[180px] z-50">
                    {ALL_STATUSES.map(st => (
                      <button key={st} onClick={() => { onStatusChange(supplier.id, st); setStatusOpen(false); toast.success(`Status set to ${st}`); }}
                        className="w-full text-left px-3 py-2 hover:bg-[#F8F9FC] transition-colors flex items-center justify-between gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusStyle(st)}`}>{st}</span>
                        {supplier.relationshipStatus === st && <Check className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Inline-edit hint chip — replaces the slide-over Edit button */}
            </div>
          </div>

          {/* Supplier identity */}
          <div className="flex items-center gap-4 mb-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${supplier.avatarColor}`}>
              {supplier.initials}
            </div>
            <div className="flex-1 min-w-0">
              <EditableName value={supplier.name} onSave={v => patch({ name: v }, 'Name')} />
              <div className="flex items-center gap-3 flex-wrap">
                <EditableCountry value={supplier.country} onSave={code => patch({ country: code }, 'Country')} />
                {supplier.categories.slice(0, 3).map(c => (
                  <span key={c} className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[11px]">{c}</span>
                ))}
                {supplier.categories.length > 3 && <span className="text-[11px] text-[#A0A0B0]">+{supplier.categories.length - 3} more</span>}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 border border-[#F0EFF6] rounded-xl overflow-hidden bg-[#FAFAFA]">
            <div className="text-center py-4">
              <p className="text-xl font-semibold text-[#030213]">{formatCurrency(supplier.ytdSpend)}</p>
              <p className="text-xs text-[#717182] mt-0.5">YTD Spend</p>
            </div>
            <div className="text-center py-4 border-x border-[#F0EFF6]">
              <p className="text-xl font-semibold text-[#030213]">{supplier.invoiceCount}</p>
              <p className="text-xs text-[#717182] mt-0.5">Invoices</p>
            </div>
            <div className="text-center py-4">
              <p className="text-xl font-semibold text-[#030213]">{supplier.practiceCount}</p>
              <p className="text-xs text-[#717182] mt-0.5">Practices</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-[#F0EFF6] px-6">
          {([
            { id: 'details',   label: 'Details' },
            { id: 'invoices',  label: `Invoices (${supplier.invoiceCount})` },
            { id: 'practices', label: `Practices (${supplier.practiceCount})` },
          ] as { id: TabId; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[#4D8EF7] border-[#4D8EF7]'
                  : 'text-[#717182] border-transparent hover:text-[#030213]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-6">

        {/* ── DETAILS TAB ── */}
        {activeTab === 'details' && (
          <div className="space-y-5">
            {/* Contact + Accounting side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Contact Details — inline editable */}
              <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
                <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-lg bg-[#E3F2FD] flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-[#4D8EF7]" /></span>
                  Contact Details
                </h2>
                <EditableTextRow icon={<Mail className="w-3.5 h-3.5" />}  label="Email"            value={supplier.email ?? ''}          placeholder="contact@supplier.com" onSave={v => patch({ email: v || undefined }, 'Email')} />
                <EditableTextRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone"            value={supplier.phone ?? ''}          placeholder="+44 20 1234 5678"      onSave={v => patch({ phone: v || undefined }, 'Phone')} />
                <EditableTextRow icon={<Globe className="w-3.5 h-3.5" />} label="Website"          value={supplier.companyUrl ?? ''}     placeholder="www.supplier.com"       onSave={v => patch({ companyUrl: v || undefined }, 'Website')} link={supplier.companyUrl} />
                <EditableTextRow icon={<MapPin className="w-3.5 h-3.5" />} label="Billing Address" value={supplier.billingAddress ?? ''} placeholder="1 High Street, London"  onSave={v => patch({ billingAddress: v || undefined }, 'Billing address')} multiline readOnly />
                <EditableTextRow icon={<CreditCard className="w-3.5 h-3.5" />} label="Tax ID / VAT" value={supplier.taxId ?? ''}          placeholder="GB123456789"            onSave={v => patch({ taxId: v || undefined }, 'Tax ID')} />
              </div>

              {/* Accounting Details — slim version: just Nominal Codes (multi-chip
                  with default star + Edit modal) and Payment Terms. Expense
                  Category, Approval Workflow, and Vendor ID intentionally removed. */}
              <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
                <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-lg bg-[#EDE7F6] flex items-center justify-center"><Tag className="w-3.5 h-3.5 text-[#6A1B9A]" /></span>
                  Accounting Details
                </h2>

                <EditableCategories
                  title="GL Codes"
                  value={supplier.categories}
                  defaultCategory={supplier.glMapping?.category}
                  onSave={next => patch({ categories: next }, 'GL codes')}
                  onSaveDefault={cat => patchGL({ category: cat }, 'Default GL code')}
                />

                <div className="mt-3 pt-3 border-t border-[#F0EFF6]">
                  <EditableSelectRow
                    icon={<CreditCard className="w-3.5 h-3.5" />}
                    label="Payment Terms"
                    value={supplier.glMapping?.paymentTerms ?? ''}
                    options={PAYMENT_TERM_OPTIONS.map(p => ({ value: p, label: p }))}
                    onSave={v => patchGL({ paymentTerms: v }, 'Payment terms')}
                  />
                </div>
              </div>
            </div>

            {/* Notes — sits in its own row below; the standalone Categories card
                used to live here but has been folded into Accounting Details. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
                <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-lg bg-[#FFF3E0] flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-[#E65100]" /></span>
                  Notes
                </h2>
                <EditableTextRow
                  icon={<FileText className="w-3.5 h-3.5" />}
                  label="Internal Notes"
                  value={supplier.notes ?? ''}
                  placeholder="Add any notes about this supplier…"
                  onSave={v => patch({ notes: v || undefined }, 'Notes')}
                  multiline
                />
              </div>
            </div>

            {/* Custom Fields */}
            {supplier.customFields && Object.keys(supplier.customFields).length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
                <h2 className="text-sm font-semibold text-[#030213] mb-4">Custom Fields</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {Object.entries(supplier.customFields).map(([k, v]) => (
                    <div key={k} className="bg-[#F8F9FC] rounded-xl p-3">
                      <p className="text-[10px] text-[#A0A0B0] font-semibold uppercase tracking-wide mb-1">{k}</p>
                      <p className="text-sm font-medium text-[#030213]">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0B0]" />
                <input type="text" placeholder="Search invoices or practices…" value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E0E0E6] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E0E0E6] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0EFF6] bg-[#FAFAFA]">
                    {['INVOICE', 'DATE', 'PRACTICE', 'AMOUNT', 'STATUS'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8F9FC]">
                  {invoices.slice(0, 20).map(inv => {
                    const clickable = !!onOpenInvoice && inv.id.startsWith('inv_');
                    return (
                      <tr
                        key={inv.id}
                        onClick={clickable ? () => onOpenInvoice!(inv.id, supplier.name) : undefined}
                        className={`transition-colors ${clickable ? 'cursor-pointer hover:bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#E3F2FD] flex items-center justify-center flex-shrink-0">
                              <Receipt className="w-3.5 h-3.5 text-[#4D8EF7]" />
                            </div>
                            <span className={`font-medium text-xs ${clickable ? 'text-[#4D8EF7]' : 'text-[#030213]'}`}>{inv.number}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#717182] text-xs">{inv.date}</td>
                        <td className="py-3 px-4 text-[#030213] text-xs">{inv.practice}</td>
                        <td className="py-3 px-4 font-medium text-[#030213]">{formatCurrency(inv.amount)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${invoiceStatusStyle(inv.status)}`}>{inv.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {invoices.length === 0 && (
                <div className="py-16 flex flex-col items-center text-[#A0A0B0]">
                  <Receipt className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No invoices found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRACTICES TAB ── */}
        {activeTab === 'practices' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0B0]" />
                <input type="text" placeholder="Search practices…" value={pracSearch}
                  onChange={e => setPracSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#E0E0E6] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E0E0E6] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F0EFF6] bg-[#FAFAFA]">
                    {['PRACTICE', 'YTD SPEND', 'INVOICES', 'STATUS'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8F9FC]">
                  {practices.map(p => (
                    <tr key={p.id} className="hover:bg-[#F8F9FC] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#F0EFF6] flex items-center justify-center flex-shrink-0">
                            <Building className="w-3.5 h-3.5 text-[#5A5568]" />
                          </div>
                          <span className="font-medium text-[#030213]">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#030213]">{formatCurrency(p.spend)}</td>
                      <td className="py-3 px-4 text-[#717182]">{p.invoices}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${p.status === 'Active' ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]' : 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {practices.length === 0 && (
                <div className="py-16 flex flex-col items-center text-[#A0A0B0]">
                  <Building className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No practices found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
