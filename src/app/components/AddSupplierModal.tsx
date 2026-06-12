import { useState, useEffect, useRef } from 'react';
import { X, Search, Globe, MapPin, ArrowLeft, CheckCircle2, Plus, Trash2, ChevronDown, Check, Info } from 'lucide-react';
import CountrySelect from './CountrySelect';
import { globalSuppliers, GlobalSupplier } from '../data/globalSuppliersData';
import { Supplier, EXPENSE_CATEGORIES, GL_ACCOUNTS, WorkflowType } from '../data/suppliersData';
import { useSupplierFields } from '../context/SupplierFieldsContext';
import ModalPortal from './ModalPortal';

interface AddSupplierModalProps {
  existingNames: string[];
  onAdd: (supplier: Supplier) => void;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

type View = 'registry' | 'registry-fields' | 'manual-step1' | 'manual-step2' | 'success';

function CategoryTag({ cat }: { cat: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-[#F0EFF6] text-[#717182] border-[#D4CEE1]">
      {cat}
    </span>
  );
}

const emptyStep1 = {
  name: '', categories: [] as string[], primaryContact: '', email: '', phone: '',
  companyUrl: '', billingAddress: '', taxId: '', country: '', notes: '',
};

interface CustomField { key: string; value: string; }

// Slugify a category for use in a stable orgValues key
function categoryKey(c: string) {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Dropdown for selecting a nominal code from the org's GL_ACCOUNTS chart.
// On pick, sets both the code and the name into orgValues using the given keys.
function NominalCodeDropdown({ codeValue, codeKey, nameKey, orgValues, setOrgValues }: {
  codeValue: string;
  codeKey: string;
  nameKey: string;
  orgValues: Record<string, string>;
  setOrgValues: (v: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const current = GL_ACCOUNTS.find(gl => gl.code === codeValue);
  const display = current ? `${current.code} · ${current.nominalName}` : '';

  // Search across both code and nominal name
  const q = query.trim().toLowerCase();
  const filtered = q
    ? GL_ACCOUNTS.filter(gl => gl.code.toLowerCase().includes(q) || gl.nominalName.toLowerCase().includes(q))
    : GL_ACCOUNTS;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 text-sm border rounded-lg bg-white transition-colors ${open ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/30' : 'border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}
      >
        <span className={display ? 'text-[#030213] truncate' : 'text-[#A0A0B0]'}>
          {display || 'Select a GL code…'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#E0E0E6] rounded-lg shadow-lg overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-[#F0EFF6] relative">
            <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code or name…"
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {codeValue && !q && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...orgValues };
                    delete next[codeKey];
                    delete next[nameKey];
                    setOrgValues(next);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-[#717182] hover:bg-[#F8F9FC] transition-colors"
                >
                  Clear selection
                </button>
                <div className="h-px bg-[#F0EFF6]" />
              </>
            )}
            {filtered.length === 0 ? (
              <p className="text-xs text-[#A0A0B0] text-center py-4">No GL codes match "{query}".</p>
            ) : (
              filtered.map(gl => {
                const selected = gl.code === codeValue;
                return (
                  <button
                    key={gl.code}
                    type="button"
                    onClick={() => {
                      setOrgValues({ ...orgValues, [codeKey]: gl.code, [nameKey]: gl.nominalName });
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-[#F8F9FC] transition-colors ${selected ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
                  >
                    <span className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span className="font-mono text-xs text-[#717182] flex-shrink-0">{gl.code}</span>
                      <span className="truncate">{gl.nominalName}</span>
                    </span>
                    {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Info tooltip rendered next to the "Nominal Code & Name" label.
function NominalCodeInfo({ onNavigateToSettings }: { onNavigateToSettings?: () => void }) {
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
        type="button"
        onClick={() => setOpen(v => !v)}
        className="p-0.5 text-[#A0A0B0] hover:text-[#4D8EF7] transition-colors"
        title="Where do these codes come from?"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-40 left-5 top-1/2 -translate-y-1/2 w-64 bg-[#030213] text-white text-[11px] leading-snug rounded-lg shadow-xl px-3 py-2">
          <p className="font-semibold mb-0.5">Managed in Settings</p>
          <p className="text-[#D4CEE1] mb-1.5">GL codes come from <span className="text-white font-medium">Spend Settings → Accounting Integration → GL Codes</span>. Pick one per category.</p>
          {onNavigateToSettings && (
            <button
              type="button"
              onClick={() => { setOpen(false); onNavigateToSettings(); }}
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

function OrgFieldsForm({ fields, orgValues, setOrgValues, customFields, setCustomFields, categories = [], onNavigateToSettings }: {
  fields: ReturnType<typeof useSupplierFields>['fields'];
  orgValues: Record<string, string>;
  setOrgValues: (v: Record<string, string>) => void;
  customFields: CustomField[];
  setCustomFields: (v: CustomField[]) => void;
  categories?: string[];
  onNavigateToSettings?: () => void;
}) {
  function addCustomField() {
    setCustomFields([...customFields, { key: '', value: '' }]);
  }
  function updateCustomField(i: number, patch: Partial<CustomField>) {
    setCustomFields(customFields.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function removeCustomField(i: number) {
    setCustomFields(customFields.filter((_, idx) => idx !== i));
  }

  const inputCls = 'w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]';

  return (
    <div className="space-y-5">
      {/* General Fields — always present */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-[#030213] uppercase tracking-wider">General Fields</p>
        <div>
          <label className="block text-xs font-medium text-[#030213] mb-1.5">Account Number</label>
          <input
            value={orgValues['__account_number'] ?? ''}
            onChange={e => setOrgValues({ ...orgValues, __account_number: e.target.value })}
            placeholder="e.g. ACC-10042"
            className={inputCls}
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="block text-xs font-medium text-[#030213]">GL Code &amp; GL Name</label>
            <NominalCodeInfo onNavigateToSettings={onNavigateToSettings} />
          </div>
          {categories.length === 0 ? (
            <NominalCodeDropdown
              codeValue={orgValues['__nominal_code'] ?? ''}
              codeKey="__nominal_code"
              nameKey="__nominal_name"
              orgValues={orgValues}
              setOrgValues={setOrgValues}
            />
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => {
                const key = categoryKey(cat);
                return (
                  <div key={cat} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F0EFF6] text-[#5A5568] border border-[#D4CEE1] justify-center">
                      {cat}
                    </span>
                    <NominalCodeDropdown
                      codeValue={orgValues[`__nominal_code__${key}`] ?? ''}
                      codeKey={`__nominal_code__${key}`}
                      nameKey={`__nominal_name__${key}`}
                      orgValues={orgValues}
                      setOrgValues={setOrgValues}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {fields.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#030213] uppercase tracking-wider">Organisation Fields</p>
          {fields.map(f => (
            <div key={f.id}>
              <label className="block text-xs font-medium text-[#030213] mb-1.5">
                {f.label || 'Unnamed field'}
                {f.required && <span className="text-[#C62828] ml-1">*</span>}
              </label>
              <input
                required={f.required}
                value={orgValues[f.id] ?? ''}
                onChange={e => setOrgValues({ ...orgValues, [f.id]: e.target.value })}
                placeholder={f.placeholder || ''}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      )}

      {/* Custom fields */}
      <div>
        <p className="text-xs font-semibold text-[#030213] uppercase tracking-wider mb-3">Additional Fields</p>
        {customFields.length > 0 && (
          <div className="space-y-2 mb-3">
            {customFields.map((cf, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={cf.key}
                  onChange={e => updateCustomField(i, { key: e.target.value })}
                  placeholder="Field name"
                  className="flex-1 px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]"
                />
                <input
                  value={cf.value}
                  onChange={e => updateCustomField(i, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]"
                />
                <button type="button" onClick={() => removeCustomField(i)} className="p-1.5 text-[#D4CEE1] hover:text-[#C62828] transition-colors flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addCustomField}
          className="flex items-center gap-1.5 text-sm text-[#4D8EF7] hover:text-[#3578e5] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add field
        </button>
      </div>
    </div>
  );
}

export default function AddSupplierModal({ existingNames, onAdd, onClose, onNavigateToSettings }: AddSupplierModalProps) {
  const { fields: orgFields } = useSupplierFields();

  const [view, setView] = useState<View>('registry');
  const [search, setSearch] = useState('');
  const [registryCategoryFilter, setRegistryCategoryFilter] = useState<string>('all');
  const [registryCategoryOpen, setRegistryCategoryOpen] = useState(false);
  const registryCategoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (registryCategoryRef.current && !registryCategoryRef.current.contains(e.target as Node)) setRegistryCategoryOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addedName, setAddedName] = useState('');

  const registryCategories = Array.from(
    new Set(globalSuppliers.flatMap(s => s.categories))
  ).sort();

  // Registry → step 2 org fields
  const [pendingRegistrySupplier, setPendingRegistrySupplier] = useState<GlobalSupplier | null>(null);
  const [registryStatus, setRegistryStatus] = useState<'Approved' | 'Inactive'>('Approved');
  const [orgValues, setOrgValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Manual form
  const [step1, setStep1] = useState(emptyStep1);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setCategoryOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const [manualOrgValues, setManualOrgValues] = useState<Record<string, string>>({});
  const [manualCustomFields, setManualCustomFields] = useState<CustomField[]>([]);

  const filtered = globalSuppliers.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.categories.some(c => c.toLowerCase().includes(q));
    const matchesCategory = registryCategoryFilter === 'all' ||
      s.categories.includes(registryCategoryFilter);
    return matchesSearch && matchesCategory;
  });

  // ── Registry: click card → open step-2 org fields ──────────────────────
  function handleRegistrySelect(gs: GlobalSupplier) {
    if (addedIds.has(gs.id) || existingNames.includes(gs.name.toLowerCase())) return;
    setPendingRegistrySupplier(gs);
    setRegistryStatus('Approved');
    setOrgValues({});
    setCustomFields([]);
    setView('registry-fields');
  }

  function handleRegistryFieldsSubmit(e: React.FormEvent) {
    e.preventDefault();
    const custom: Record<string, string> = {};
    if (orgValues['__account_number']) custom['Account Number'] = orgValues['__account_number'];
    if (orgValues['__nominal_code']) custom['GL Code'] = orgValues['__nominal_code'];
    if (orgValues['__nominal_name']) custom['GL Name'] = orgValues['__nominal_name'];
    // Per-category nominal mapping (one row per supplier category)
    (pendingRegistrySupplier?.categories ?? []).forEach((cat) => {
      const key = cat.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const code = orgValues[`__nominal_code__${key}`];
      const name = orgValues[`__nominal_name__${key}`];
      if (code) custom[`GL Code · ${cat}`] = code;
      if (name) custom[`GL Name · ${cat}`] = name;
    });
    customFields.forEach(cf => { if (cf.key.trim()) custom[cf.key.trim()] = cf.value; });
    orgFields.forEach(f => { if (orgValues[f.id] && !f.id.startsWith('__')) custom[f.label] = orgValues[f.id]; });
    if (!pendingRegistrySupplier) return;
    const gs = pendingRegistrySupplier;
    const supplier: Supplier = {
      id: `s_${Date.now()}`,
      vendorId: `V${String(Math.floor(Math.random() * 90000 + 10000))}`,
      name: gs.name,
      initials: gs.initials,
      avatarColor: gs.avatarColor,
      country: gs.country,
      categories: gs.categories,
      relationshipStatus: 'Active',
      practiceCount: 0,
      ytdSpend: 0,
      invoiceCount: 0,
      glMapping: null,
      customFields: Object.keys(custom).length ? custom : undefined,
    };
    onAdd(supplier);
    setAddedIds(prev => new Set([...prev, gs.id]));
    setAddedName(gs.name);
    setView('success');
  }

  // ── Manual: step-2 submit ────────────────────────────────────────────────
  function handleManualFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1.name.trim()) return;
    const words = step1.name.trim().split(' ');
    const initials = words.map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const custom: Record<string, string> = {};
    if (manualOrgValues['__account_number']) custom['Account Number'] = manualOrgValues['__account_number'];
    if (manualOrgValues['__nominal_code']) custom['GL Code'] = manualOrgValues['__nominal_code'];
    if (manualOrgValues['__nominal_name']) custom['GL Name'] = manualOrgValues['__nominal_name'];
    // Per-category nominal mapping (one row per supplier category)
    step1.categories.forEach((cat) => {
      const key = cat.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const code = manualOrgValues[`__nominal_code__${key}`];
      const name = manualOrgValues[`__nominal_name__${key}`];
      if (code) custom[`GL Code · ${cat}`] = code;
      if (name) custom[`GL Name · ${cat}`] = name;
    });
    manualCustomFields.forEach(cf => { if (cf.key.trim()) custom[cf.key.trim()] = cf.value; });
    orgFields.forEach(f => { if (manualOrgValues[f.id] && !f.id.startsWith('__')) custom[f.label] = manualOrgValues[f.id]; });
    const supplier: Supplier = {
      id: `s_${Date.now()}`,
      vendorId: `V${String(Math.floor(Math.random() * 90000 + 10000))}`,
      name: step1.name.trim(),
      initials,
      avatarColor: 'bg-[#F0EFF6] text-[#5A5568]',
      country: step1.country,
      categories: step1.categories,
      relationshipStatus: 'Active',
      practiceCount: 0,
      ytdSpend: 0,
      invoiceCount: 0,
      glMapping: null,
      primaryContact: step1.primaryContact || undefined,
      email: step1.email || undefined,
      phone: step1.phone || undefined,
      companyUrl: step1.companyUrl || undefined,
      billingAddress: step1.billingAddress || undefined,
      taxId: step1.taxId || undefined,
      notes: step1.notes,
      customFields: Object.keys(custom).length ? custom : undefined,
    };
    onAdd(supplier);
    setAddedName(supplier.name);
    setView('success');
  }

  function resetAll() {
    setStep1(emptyStep1);
    setManualOrgValues({});
    setManualCustomFields([]);
    setOrgValues({});
    setCustomFields([]);
    setPendingRegistrySupplier(null);
    setView('registry');
  }

  const isAdded = (gs: GlobalSupplier) =>
    addedIds.has(gs.id) || existingNames.includes(gs.name.toLowerCase());

  // ── Stepper indicator ────────────────────────────────────────────────────
  function Stepper({ current, total }: { current: number; total: number }) {
    return (
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-2 rounded-full transition-all ${i < current ? 'w-16 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' : i === current ? 'w-16 bg-[#4D8EF7]' : 'w-16 bg-[#E0E0E6]'}`} />
        ))}
        <span className="text-xs text-[#A0A0B0] ml-1">{current + 1} / {total}</span>
      </div>
    );
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">

        {/* ── REGISTRY VIEW ─────────────────────────────────────── */}
        {view === 'registry' && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
              <div>
                <h2 className="text-lg font-semibold text-[#030213]">Global Supplier Registry</h2>
                <p className="text-sm text-[#717182] mt-0.5">Select one or more verified suppliers to add to your account.</p>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => setView('manual-step1')}
                  className="flex items-center gap-2 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  New supplier
                </button>
                <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search bar + category filter */}
            <div className="px-7 py-4 border-b border-[#F0EFF6]">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-[#A0A0B0] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search Henry Schein, 3Shape, Dentsply..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]"
                  />
                </div>
                <div className="relative" ref={registryCategoryRef}>
                  <button
                    type="button"
                    onClick={() => setRegistryCategoryOpen(v => !v)}
                    className={`min-w-[180px] inline-flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-lg bg-white transition-colors ${registryCategoryOpen ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/30' : 'border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}
                  >
                    <span className={registryCategoryFilter === 'all' ? 'text-[#717182]' : 'text-[#030213] font-medium'}>
                      {registryCategoryFilter === 'all' ? 'All categories' : registryCategoryFilter}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#A0A0B0] transition-transform ${registryCategoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {registryCategoryOpen && (
                    <div className="absolute z-50 top-full mt-1 right-0 w-[220px] bg-white border border-[#E0E0E6] rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { setRegistryCategoryFilter('all'); setRegistryCategoryOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[#F8F9FC] transition-colors ${registryCategoryFilter === 'all' ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
                      >
                        All categories
                        {registryCategoryFilter === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                      </button>
                      <div className="h-px bg-[#F0EFF6] my-1" />
                      {registryCategories.map(c => {
                        const selected = registryCategoryFilter === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { setRegistryCategoryFilter(c); setRegistryCategoryOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[#F8F9FC] transition-colors ${selected ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
                          >
                            {c}
                            {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {registryCategoryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setRegistryCategoryFilter('all')}
                    className="text-xs text-[#4D8EF7] hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>

            {/* Supplier list — single-column rows so the layout matches the
                Clinic portal's Add Supplier modal. Each row is a horizontal
                strip with avatar + name + meta + Add button (or "Added"
                marker when already on the org's supplier list). */}
            <div className="overflow-y-auto px-7 py-5 flex-1">
              <div className="space-y-1.5">
                {filtered.length === 0 ? (
                  <p className="text-center text-xs italic text-[#A0A0B0] py-10">No suppliers match. Try a different keyword or category.</p>
                ) : filtered.map(gs => {
                  const added = isAdded(gs);
                  return (
                    <div
                      key={gs.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white transition-colors ${
                        added
                          ? 'border-[#BBF7D0] bg-[#F1FBF2]'
                          : 'border-[#E8EAF6] hover:border-[#BFDBFE] hover:bg-[#FAFBFF]'
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${gs.avatarColor}`}>
                        {gs.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-[#030213] truncate">{gs.name}</p>
                          <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider border bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]">
                            Global
                          </span>
                        </div>
                        <p className="text-[10px] text-[#717182] mt-0.5 truncate">
                          <span className="font-mono">{gs.vendorId}</span> · {gs.country} · {gs.categories.slice(0, 3).join(' · ')}
                          {gs.categories.length > 3 && ` · +${gs.categories.length - 3}`}
                        </p>
                      </div>
                      {added ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-bold text-[#1A5C2A]">
                          <Check className="w-3 h-3" strokeWidth={3} /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRegistrySelect(gs)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-[10px] font-bold hover:opacity-95"
                        >
                          <Plus className="w-3 h-3" strokeWidth={3} /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-white flex-shrink-0">
              <p className="text-sm text-[#717182]">Click <span className="font-semibold text-[#030213]">+ Add</span> on a row to bring the supplier into your account.</p>
            </div>
          </>
        )}

        {/* ── REGISTRY STEP 2: ORG FIELDS ───────────────────────── */}
        {view === 'registry-fields' && pendingRegistrySupplier && (
          <>
            <div className="flex items-center gap-3 px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
              <button onClick={() => setView('registry')} className="p-1.5 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#030213]">Supplier Additional Fields</h2>
                <p className="text-xs text-[#717182] mt-0.5">
                  Fields are configured in{' '}
                  <a href="/supplier/spend/settings" className="text-[#4D8EF7] hover:underline">Spend Management Settings</a>.
                </p>
              </div>
              <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="registry-fields-form" onSubmit={handleRegistryFieldsSubmit} className="overflow-y-auto flex-1 p-7 flex flex-col gap-6">
              {/* Supplier preview — single */}
              {pendingRegistrySupplier && (
                <div className="p-4 bg-[#F8F9FC] rounded-xl border border-[#E0E0E6]">
                  <p className="font-semibold text-sm text-[#030213]">{pendingRegistrySupplier.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pendingRegistrySupplier.categories.map(c => <CategoryTag key={c} cat={c} />)}
                  </div>
                </div>
              )}
              <OrgFieldsForm
                fields={orgFields}
                orgValues={orgValues}
                setOrgValues={setOrgValues}
                customFields={customFields}
                setCustomFields={setCustomFields}
                categories={pendingRegistrySupplier?.categories ?? []}
                onNavigateToSettings={onNavigateToSettings}
              />
            </form>
            <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-white flex-shrink-0">
              <Stepper current={1} total={2} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setView('registry')} className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
                  Back
                </button>
                <button type="submit" form="registry-fields-form" className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
                  Add supplier
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── MANUAL STEP 1: BASIC INFO ──────────────────────────── */}
        {view === 'manual-step1' && (
          <>
            <div className="flex items-center gap-3 px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
              <button onClick={() => setView('registry')} className="p-1.5 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#030213]">Add supplier manually</h2>
                <p className="text-xs text-[#717182] mt-0.5">Supplier will be added as inactive. You can activate it from the suppliers list.</p>
              </div>
              <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="manual-step1-form" onSubmit={e => { e.preventDefault(); if (step1.name.trim()) setView('manual-step2'); }} className="overflow-y-auto flex-1 p-7">
              <div className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Supplier Name <span className="text-[#C62828]">*</span></label>
                    <input required value={step1.name} onChange={e => setStep1(f => ({ ...f, name: e.target.value }))} placeholder="Northwood Dental Labs" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                  <div className="relative" ref={categoryRef}>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Category</label>
                    <div
                      onClick={() => setCategoryOpen(v => !v)}
                      className={`w-full min-h-[42px] px-3 py-1.5 text-sm border rounded-lg bg-white cursor-pointer flex flex-wrap gap-1 items-center ${categoryOpen ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/30' : 'border-[#E0E0E6]'}`}
                    >
                      {step1.categories.length === 0 && (
                        <span className="text-[#A0A0B0] py-1">Select categories</span>
                      )}
                      {step1.categories.map(c => (
                        <span key={c} className="flex items-center gap-1 px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] border border-[#D4CEE1] rounded text-[11px] font-medium">
                          {c}
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setStep1(f => ({ ...f, categories: f.categories.filter(x => x !== c) })); }}
                            className="hover:text-[#C62828] transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      <ChevronDown className={`w-3.5 h-3.5 text-[#A0A0B0] ml-auto flex-shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {categoryOpen && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#E0E0E6] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {EXPENSE_CATEGORIES.map(c => {
                          const selected = step1.categories.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setStep1(f => ({
                                  ...f,
                                  categories: selected ? f.categories.filter(x => x !== c) : [...f.categories, c],
                                }));
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[#F8F9FC] transition-colors ${selected ? 'text-[#4D8EF7] font-medium' : 'text-[#030213]'}`}
                            >
                              {c}
                              {selected && <CheckCircle2 className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Primary Contact <span className="text-[#C62828]">*</span></label>
                    <input required value={step1.primaryContact} onChange={e => setStep1(f => ({ ...f, primaryContact: e.target.value }))} placeholder="Jane Smith" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Email Address <span className="text-[#C62828]">*</span></label>
                    <input required type="email" value={step1.email} onChange={e => setStep1(f => ({ ...f, email: e.target.value }))} placeholder="orders@supplier.com" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Phone Number <span className="text-[#C62828]">*</span></label>
                    <input required value={step1.phone} onChange={e => setStep1(f => ({ ...f, phone: e.target.value }))} placeholder="+44 20 0000 0000" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Company URL</label>
                    <input value={step1.companyUrl} onChange={e => setStep1(f => ({ ...f, companyUrl: e.target.value }))} placeholder="example.co.uk" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Billing Address</label>
                    <input value={step1.billingAddress} onChange={e => setStep1(f => ({ ...f, billingAddress: e.target.value }))} placeholder="123 Main St, London" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Tax ID / VAT <span className="text-[#C62828]">*</span></label>
                    <input required value={step1.taxId} onChange={e => setStep1(f => ({ ...f, taxId: e.target.value }))} placeholder="GB123456789" className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#030213] mb-1.5">Country</label>
                    <CountrySelect value={step1.country} onChange={v => setStep1(f => ({ ...f, country: v }))} />
                  </div>
                  <div />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#030213] mb-1.5">Notes</label>
                  <textarea value={step1.notes} onChange={e => setStep1(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." rows={3} className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] resize-none" />
                </div>

              </div>
            </form>
            <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-white flex-shrink-0">
              <Stepper current={0} total={2} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setView('registry')} className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
                  Cancel
                </button>
                <button type="submit" form="manual-step1-form" className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── MANUAL STEP 2: ORG FIELDS ─────────────────────────── */}
        {view === 'manual-step2' && (
          <>
            <div className="flex items-center gap-3 px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
              <button onClick={() => setView('manual-step1')} className="p-1.5 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[#030213]">Supplier Additional Fields</h2>
                <p className="text-xs text-[#717182] mt-0.5">
                  Fields are configured in{' '}
                  <a href="/supplier/spend/settings" className="text-[#4D8EF7] hover:underline">Spend Management Settings</a>.
                </p>
              </div>
              <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="manual-step2-form" onSubmit={handleManualFinalSubmit} className="overflow-y-auto flex-1 p-7 flex flex-col gap-6">
              <OrgFieldsForm
                fields={orgFields}
                orgValues={manualOrgValues}
                setOrgValues={setManualOrgValues}
                customFields={manualCustomFields}
                setCustomFields={setManualCustomFields}
                categories={step1.categories}
                onNavigateToSettings={onNavigateToSettings}
              />
            </form>
            <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-white flex-shrink-0">
              <Stepper current={1} total={2} />
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setView('manual-step1')} className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
                  Back
                </button>
                <button type="submit" form="manual-step2-form" className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
                  Add supplier
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── SUCCESS ───────────────────────────────────────────── */}
        {view === 'success' && (
          <div className="flex flex-col items-center justify-center py-24 px-8">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-[#2E7D32]" />
            </div>
            <h3 className="text-lg font-semibold text-[#030213] mb-2">Supplier added</h3>
            <p className="text-sm text-[#717182] text-center max-w-sm mb-6">
              <span className="font-medium text-[#030213]">{addedName}</span> {addedName.endsWith('suppliers') ? 'have' : 'has'} been added to your supplier list.
            </p>
            <div className="flex gap-3">
              <button onClick={resetAll} className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
                Add another
              </button>
              <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
    </ModalPortal>
  );
}
