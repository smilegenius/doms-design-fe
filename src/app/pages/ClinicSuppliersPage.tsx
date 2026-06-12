// Clinic Portal — Suppliers Page
// ────────────────────────────────────────────────────────────────────────────
// Clinics manage their own supplier roster:
//   • Pull from the Global Supplier Registry (everything available platform-wide)
//   • Pull from the Dental Group's existing supplier list (DSO-curated)
//   • Create a brand new supplier (lands as "Pending review" — DSO + global
//     admin must approve before it auto-propagates back to the global registry
//     and is visible to sibling clinics in the DSO).
//
// Clinic-side rules enforced here (vs. the DSO Suppliers page):
//   • GL Code is assigned only — clinics cannot create/edit GL codes
//   • Status: clinics can flip between Active / On hold BEFORE activation;
//     once a supplier reaches Active, the status pill locks (only DSO can
//     change it from there).
//   • No Archive action — controlled by Dental Group only.
//   • YTD Spend + Invoice Count are CLINIC-SCOPED (only this clinic's spend).
//
// This page is intentionally self-contained: the AddClinicSupplierModal
// lives in the same file so list + add flow share the same data shape and
// can be iterated together. The detail view reuses SupplierDetailPage in
// clinic-permissions mode.
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, X, Globe, Building2, Check, AlertCircle, CheckCircle2, PauseCircle, Clock, Package,
  Lock, ChevronDown, ChevronRight, ArrowLeft, Tag, Pencil, Save,
} from 'lucide-react';
import {
  mockSuppliers, Supplier, GL_ACCOUNTS, GLCode,
  SupplierRelationshipStatus,
} from '../data/suppliersData';
import { globalSuppliers, GlobalSupplier } from '../data/globalSuppliersData';
import ModalPortal from '../components/ModalPortal';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import { useToast } from '../context/ToastContext';

// ─── Lookups ────────────────────────────────────────────────────────────────
const COUNTRY_NAMES: Record<string, string> = {
  IE: 'Ireland', GB: 'United Kingdom', UK: 'United Kingdom', DE: 'Germany',
  FR: 'France', SE: 'Sweden', DK: 'Denmark', LI: 'Liechtenstein',
  JP: 'Japan', KR: 'South Korea', US: 'United States', SG: 'Singapore',
};
const countryName = (code?: string) => (code ? COUNTRY_NAMES[code] ?? code : '');

// Clinic-visible statuses. Clinics never see "Archived" rows (DSO archives
// suppliers globally), and "Not using" is a DSO concept. Clinics flip
// between Active ↔ On hold pre-activation; once Active, the pill locks.
const CLINIC_STATUSES: SupplierRelationshipStatus[] = ['Active', 'On hold'];

function statusStyle(s: SupplierRelationshipStatus) {
  switch (s) {
    case 'Active':         return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Pending review': return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'On hold':        return 'text-[#5A5568] bg-[#F3F3F5] border-[#D4CEE1]';
    case 'Not using':      return 'text-[#5A5568] bg-[#F0EFF6] border-[#D4CEE1]';
    case 'Archived':       return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}

const fmtCurrency = (n: number) => '£' + n.toLocaleString('en-GB');

// True when the row was created by this clinic via the manual entry form.
// We tag those entries with customFields.approvalStage so we can distinguish
// them from rows pulled in from the Global Registry / DSO. Manual entries
// stay editable until they're approved into Active.
function isClinicCreated(s: Supplier): boolean {
  return !!s.customFields?.approvalStage;
}
function canEditClinicDetails(s: Supplier): boolean {
  return isClinicCreated(s) && s.relationshipStatus !== 'Active';
}

// Derive Lab / Non Lab from supplier categories or the explicit customField
// the Create-New form sets. Default Non Lab if nothing obvious — the clinic
// always sees a value in the table.
function supplierType(s: Supplier): 'Lab' | 'Non Lab' {
  const explicit = s.customFields?.supplierType as 'Lab' | 'Non Lab' | undefined;
  if (explicit === 'Lab' || explicit === 'Non Lab') return explicit;
  const labLike = ['Lab', 'Dental Labs', 'Orthodontics'];
  return s.categories.some(c => labLike.includes(c)) ? 'Lab' : 'Non Lab';
}

// ─── Seed: a handful of suppliers the clinic has already added so the
//     list isn't empty on first load. Real product reads this from API. ──
const SEED_CLINIC_SUPPLIERS: Supplier[] = [
  { ...mockSuppliers[0], ytdSpend: 8420,  invoiceCount: 6 },
  { ...mockSuppliers[1], ytdSpend: 12300, invoiceCount: 9 },
  { ...mockSuppliers[6], ytdSpend: 4150,  invoiceCount: 3, customFields: { supplierType: 'Lab' } },
  // Demo: a clinic-created supplier currently in Stage-1 (DSO review). Lets
  // the user see the Approval-in-progress stepper without submitting one.
  {
    id: 'cs-seed-pending',
    vendorId: 'CV-DEMO1',
    name: 'Northwood Dental Labs',
    initials: 'ND',
    avatarColor: 'bg-[#FFF3E0] text-[#E65100]',
    country: 'GB',
    categories: ['Dental Labs'],
    relationshipStatus: 'Pending review',
    practiceCount: 1,
    ytdSpend: 0,
    invoiceCount: 0,
    glMapping: null,
    primaryContact: 'Sarah Patel',
    email: 'orders@northwooddentallabs.co.uk',
    phone: '+44 20 7946 0012',
    taxId: 'GB-123456789',
    customFields: { supplierType: 'Lab', approvalStage: 'awaiting-dso' },
  },
];

interface ClinicSuppliersPageProps {
  initialSupplierId?: string;
  onSupplierSelected?: (id: string) => void;
}

export default function ClinicSuppliersPage({
  initialSupplierId,
  onSupplierSelected,
}: ClinicSuppliersPageProps) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>(SEED_CLINIC_SUPPLIERS);
  const [query, setQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierRelationshipStatus | 'all'>('all');
  const [typeFilter, setTypeFilter]     = useState<'all' | 'Lab' | 'Non Lab'>('all');
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter(s => {
      if (statusFilter !== 'all' && s.relationshipStatus !== statusFilter) return false;
      if (typeFilter !== 'all' && supplierType(s) !== typeFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.vendorId.toLowerCase().includes(q) ||
        (s.glMapping?.glCode.code ?? '').toLowerCase().includes(q) ||
        countryName(s.country).toLowerCase().includes(q)
      );
    });
  }, [suppliers, query, statusFilter, typeFilter]);

  // Detail view drilldown
  const activeSupplier = useMemo(
    () => initialSupplierId ? suppliers.find(s => s.id === initialSupplierId) : null,
    [suppliers, initialSupplierId]
  );

  function handleAdd(next: Supplier) {
    setSuppliers(prev => {
      if (prev.some(s => s.id === next.id)) {
        toast.error(`${next.name} is already on your supplier list`);
        return prev;
      }
      return [next, ...prev];
    });
    setAddOpen(false);
    const fromManual = next.relationshipStatus === 'Pending review';
    toast.success(
      fromManual
        ? `${next.name} sent to your Dental Group for review. Super Admin approval follows once they sign off.`
        : `${next.name} added to your suppliers`
    );
  }

  function updateStatus(id: string, status: SupplierRelationshipStatus) {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, relationshipStatus: status } : s));
  }

  function updateGL(id: string, gl: GLCode | null) {
    setSuppliers(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...s };
      if (!gl) {
        next.glMapping = null;
      } else if (next.glMapping) {
        next.glMapping = { ...next.glMapping, glCode: gl };
      } else {
        next.glMapping = { glCode: gl, category: '', workflow: 'Single Approver', paymentTerms: 'Net 30' };
      }
      return next;
    }));
    toast.success(gl ? `GL Code set to ${gl.code}` : 'GL Code cleared');
  }

  // Patch arbitrary editable fields — used by the detail page when the
  // supplier is clinic-created (manual) and still pre-Active. Other rows
  // ignore this since the detail UI hides edit affordances for them.
  function updateSupplier(id: string, patch: Partial<Supplier>) {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  // All hooks must be declared BEFORE the conditional drilldown return so
  // the hook order stays stable across renders (otherwise React throws a
  // Rules of Hooks violation when the user opens/closes a supplier).
  const stats = useMemo(() => ({
    total:   suppliers.length,
    active:  suppliers.filter(s => s.relationshipStatus === 'Active').length,
    onHold:  suppliers.filter(s => s.relationshipStatus === 'On hold').length,
    pending: suppliers.filter(s => s.relationshipStatus === 'Pending review').length,
  }), [suppliers]);

  // Drilldown view — render detail panel
  if (activeSupplier) {
    return (
      <ClinicSupplierDetail
        supplier={activeSupplier}
        onBack={() => onSupplierSelected?.('')}
        onStatusChange={(s) => updateStatus(activeSupplier.id, s)}
        onGLChange={(gl) => updateGL(activeSupplier.id, gl)}
        onUpdate={(patch) => updateSupplier(activeSupplier.id, patch)}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header — same scale as DSO Suppliers */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-1">My Suppliers</h1>
          <p className="text-sm text-[#717182]">Suppliers your clinic uses — added from the Global Registry, your Dental Group, or created here.</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-5 h-5" />} onClick={() => setAddOpen(true)} className="whitespace-nowrap">
          Add Supplier
        </Button>
      </div>

      {/* Clickable stat cards (filter shortcuts). Mirrors the DSO 5-card
          grid — clinics never archive so we drop the Archived card; the
          Pending review card stands in for the awaiting-approval queue. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<Package className="w-5 h-5 text-[#4D8EF7]" />}
          iconBg="bg-[#4D8EF7]/10"
          active={statusFilter === 'all'}
          activeStyle="gradient"
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={<CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />}
          iconBg="bg-[#2E7D32]/10"
          active={statusFilter === 'Active'}
          activeStyle="green"
          onClick={() => setStatusFilter('Active')}
        />
        <StatCard
          label="On hold"
          value={stats.onHold}
          icon={<PauseCircle className="w-5 h-5 text-[#5A5568]" />}
          iconBg="bg-[#5A5568]/10"
          active={statusFilter === 'On hold'}
          activeStyle="grey"
          onClick={() => setStatusFilter('On hold')}
        />
        <StatCard
          label="Awaiting Approval"
          value={stats.pending}
          icon={<Clock className="w-5 h-5 text-[#E65100]" />}
          iconBg="bg-[#E65100]/10"
          active={statusFilter === 'Pending review'}
          activeStyle="amber"
          onClick={() => setStatusFilter('Pending review')}
        />
      </div>

      {/* Search + type filter row (matches the DSO Search+Sort+Filter row;
          clinics don't need the sort/grid toggle so we trim those). */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <SearchInput placeholder="Search by name, vendor ID, GL code or country…" value={query} onChange={setQuery} />
          <FilterDropdown
            label="Type"
            value={typeFilter}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'Lab', label: 'Lab' },
              { value: 'Non Lab', label: 'Non Lab' },
            ]}
            onChange={(v) => setTypeFilter(v as typeof typeFilter)}
          />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          onAdd={() => setAddOpen(true)}
          hasFilters={query !== '' || statusFilter !== 'all' || typeFilter !== 'all'}
          onClearFilters={() => { setQuery(''); setStatusFilter('all'); setTypeFilter('all'); }}
        />
      ) : (
        <div className="bg-[#F3F3F5] rounded-xl border border-[#E0E0E6] overflow-x-auto">
          <table className="w-full min-w-[920px] border-separate border-spacing-y-1">
            <thead>
              <tr className="bg-[#F3F3F5] [&>th]:border-b [&>th]:border-[#E0E0E6]">
                {['Supplier', 'Type', 'Country', 'GL Code', 'Status', 'YTD Spend', 'Invoices', ''].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <SupplierRow
                  key={s.id}
                  supplier={s}
                  onOpen={() => onSupplierSelected?.(s.id)}
                  onStatusChange={(next) => updateStatus(s.id, next)}
                  onGLChange={(gl) => updateGL(s.id, gl)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddClinicSupplierModal
          existingIds={suppliers.map(s => s.id)}
          onClose={() => setAddOpen(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}

// ─── Clickable stat card (mirrors the DSO SuppliersPage stat cards) ────────
// label + value + icon-in-coloured-circle. When `active` the card gets a
// 2-px ring that matches the metric's tone (gradient for Total, green for
// Active, etc.) so the active filter is obvious at a glance.
type StatActiveStyle = 'gradient' | 'green' | 'grey' | 'amber';

function StatCard({ label, value, icon, iconBg, active, activeStyle, onClick }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  active: boolean;
  activeStyle: StatActiveStyle;
  onClick: () => void;
}) {
  const ringClasses =
    activeStyle === 'green' ? 'border-[#2E7D32] ring-2 ring-[#2E7D32]/20' :
    activeStyle === 'grey'  ? 'border-[#5A5568] ring-2 ring-[#5A5568]/20' :
    activeStyle === 'amber' ? 'border-[#E65100] ring-2 ring-[#E65100]/20' :
                              'border-transparent';
  const gradientStyle = active && activeStyle === 'gradient'
    ? { background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #4D8EF7, #A59DFF) border-box', border: '2px solid transparent' }
    : undefined;
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md text-left ${active ? ringClasses : 'border-[#E0E0E6]'}`}
      style={gradientStyle}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[#717182] mb-1">{label}</div>
          <div className="text-xl font-semibold text-[#030213]">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>{icon}</div>
      </div>
    </button>
  );
}

// ─── Empty state (matches DSO SuppliersPage empty state) ────────────────────
function EmptyState({ onAdd, hasFilters, onClearFilters }: {
  onAdd: () => void; hasFilters: boolean; onClearFilters: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center py-20 text-[#A0A0B0]">
      <Package className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm font-medium text-[#030213]">No suppliers found</p>
      <p className="text-xs mt-1">{hasFilters ? 'Try adjusting your search or filters' : 'Add your first supplier to get started'}</p>
      {hasFilters ? (
        <button onClick={onClearFilters} className="mt-3 text-xs text-[#4D8EF7] hover:underline">
          Clear all filters
        </button>
      ) : (
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onAdd} className="mt-3">
          Add Supplier
        </Button>
      )}
    </div>
  );
}

// ─── Row — matches the DSO SuppliersPage row chrome ─────────────────────────
function SupplierRow({ supplier, onOpen, onStatusChange, onGLChange }: {
  supplier: Supplier;
  onOpen: () => void;
  onStatusChange: (status: SupplierRelationshipStatus) => void;
  onGLChange: (gl: GLCode | null) => void;
}) {
  const isActive  = supplier.relationshipStatus === 'Active';
  const isPending = supplier.relationshipStatus === 'Pending review';
  const type = supplierType(supplier);
  return (
    <tr
      onClick={onOpen}
      className="group bg-white hover:bg-[#F8F9FC] transition-colors cursor-pointer [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px]"
    >
      {/* Supplier name + vendor id sub-line — matches DSO's name cell.
          Editable rows (clinic-created + pre-Active) get a small pencil
          pill so the user can spot at a glance which rows they own. */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1.5">
          <div title={supplier.name} className="text-xs font-medium text-[#030213] truncate max-w-[180px]">{supplier.name}</div>
          {canEditClinicDetails(supplier) && (
            <span
              className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]"
              title="Clinic-created · editable until approval"
            >
              <Pencil className="w-2 h-2" strokeWidth={3} />
              Editable
            </span>
          )}
        </div>
        <div className="text-xs text-[#A0A0B0] mt-0.5 tabular-nums">{supplier.vendorId}</div>
      </td>
      {/* Type pill */}
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
          type === 'Lab'
            ? 'bg-[#F3EEFF] text-[#5B21B6] border-[#DDD6FE]'
            : 'bg-[#F0F9FF] text-[#075985] border-[#BAE6FD]'
        }`}>
          {type}
        </span>
      </td>
      <td className="px-6 py-4 text-xs text-[#5A5568] whitespace-nowrap">{countryName(supplier.country) || '—'}</td>
      {/* GL Code — read-only when Active, dropdown otherwise */}
      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <GLCodeCell supplier={supplier} locked={isActive} onChange={onGLChange} />
      </td>
      {/* Status — dropdown when Clinic-editable, locked pill when Active */}
      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <StatusCell
          status={supplier.relationshipStatus}
          locked={isActive || isPending}
          onChange={onStatusChange}
          stage={isPending ? approvalStage(supplier) : undefined}
        />
      </td>
      <td className="px-6 py-4 text-right text-xs font-semibold text-[#030213] tabular-nums whitespace-nowrap">{fmtCurrency(supplier.ytdSpend)}</td>
      <td className="px-6 py-4 text-right text-xs text-[#5A5568] tabular-nums">{supplier.invoiceCount}</td>
      <td className="px-2 py-4"><ChevronRight className="w-4 h-4 text-[#A0A0B0] opacity-0 group-hover:opacity-100 transition-opacity" /></td>
    </tr>
  );
}

// ─── GL Code cell ───────────────────────────────────────────────────────────
// Clinics may assign an existing GL code OR clear it. They cannot create
// new ones. When the supplier is Active the cell renders as a read-only
// chip with a lock icon.
function GLCodeCell({ supplier, locked, onChange }: {
  supplier: Supplier;
  locked: boolean;
  onChange: (gl: GLCode | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = supplier.glMapping?.glCode;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GL_ACCOUNTS;
    return GL_ACCOUNTS.filter(g => g.code.toLowerCase().includes(q) || g.nominalName.toLowerCase().includes(q));
  }, [query]);

  if (locked) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#F0EFF6] text-[#5A5568]"
        title="GL Code locked — change managed by your Dental Group once the supplier is Active"
      >
        <Lock className="w-2.5 h-2.5 text-[#A0A0B0]" />
        {current ? current.code : '—'}
      </span>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 group/gl"
      >
        {current ? (
          <span className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-xs font-mono font-semibold whitespace-nowrap group-hover/gl:bg-[#EEF4FF] group-hover/gl:text-[#4D8EF7] transition-colors">
            {current.code}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-[#A0A0B0] hover:text-[#4D8EF7] transition-colors">
            <Tag className="w-3 h-3" /><span>Assign GL code</span>
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-70 text-[#A0A0B0]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 w-[260px] bg-white border border-[#E0E0E6] rounded-xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-[#F0EFF6]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0A0B0]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search GL codes…"
                  className="w-full pl-7 pr-2 py-1 text-xs border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7]"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.map(g => (
                <button
                  key={g.code}
                  onClick={() => { onChange(g); setOpen(false); setQuery(''); }}
                  className="w-full px-3 py-1.5 text-left hover:bg-[#FAFBFF] flex items-center justify-between gap-2"
                >
                  <span className="font-mono font-bold text-[11px] text-[#1565C0]">{g.code}</span>
                  <span className="text-[11px] text-[#5A5568] truncate flex-1 text-right">{g.nominalName}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-center text-[11px] italic text-[#A0A0B0]">No GL codes match.</p>
              )}
            </div>
            {current && (
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full px-3 py-2 text-[11px] text-[#C62828] border-t border-[#F0EFF6] hover:bg-[#FFEBEE]"
              >
                Clear GL Code
              </button>
            )}
            <p className="px-3 py-2 text-[10px] text-[#A0A0B0] bg-[#FAFBFF] border-t border-[#F0EFF6]">
              <Lock className="w-2.5 h-2.5 inline -mt-0.5 mr-1" />
              GL codes are managed by your Dental Group. Pick from the list — you can't create new ones.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Resolve an approval-stage from the customFields blob; defaults to the
// first stage (Dental Group review) so older drafts don't crash.
function approvalStage(s: Supplier): 'awaiting-dso' | 'awaiting-super-admin' | 'approved' {
  const v = s.customFields?.approvalStage;
  return v === 'awaiting-super-admin' || v === 'approved' ? v : 'awaiting-dso';
}

function stageLabel(stage: 'awaiting-dso' | 'awaiting-super-admin' | 'approved'): string {
  switch (stage) {
    case 'awaiting-dso':         return 'Awaiting Dental Group review';
    case 'awaiting-super-admin': return 'Awaiting Super Admin sign-off';
    case 'approved':             return 'Approved';
  }
}

// ─── Status cell ────────────────────────────────────────────────────────────
// Clinic can flip Active ↔ On hold BEFORE activation. Once status is
// Active it locks (only DSO can move it). Pending review rows are also
// locked client-side — the request is moving through DSO → Super Admin
// sign-off. The tooltip surfaces whichever stage the request is currently at.
function StatusCell({ status, locked, onChange, stage }: {
  status: SupplierRelationshipStatus;
  locked: boolean;
  onChange: (next: SupplierRelationshipStatus) => void;
  stage?: 'awaiting-dso' | 'awaiting-super-admin' | 'approved';
}) {
  const [open, setOpen] = useState(false);
  if (locked) {
    const pendingTooltip = stage === 'awaiting-super-admin'
      ? 'Dental Group approved — Super Admin sign-off next. Status will unlock once approved.'
      : 'Awaiting Dental Group review. Super Admin sign-off follows. Status will unlock once both approve.';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusStyle(status)}`}
        title={status === 'Active'
          ? 'Status locked. Your Dental Group manages the status once a supplier is Active.'
          : pendingTooltip}
      >
        <Lock className="w-2.5 h-2.5" />
        {status}
      </span>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border hover:opacity-90 ${statusStyle(status)}`}
      >
        {status}
        <ChevronDown className="w-2.5 h-2.5 opacity-70" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-[#E0E0E6] rounded-lg shadow-xl overflow-hidden min-w-[140px]">
            {CLINIC_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-[#FAFBFF] flex items-center gap-2"
              >
                <span className={`inline-block w-2 h-2 rounded-full ${
                  s === 'Active' ? 'bg-[#2E7D32]' : 'bg-[#A0A0B0]'
                }`} />
                {s}
                {s === status && <Check className="w-3 h-3 text-[#16A34A] ml-auto" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Simple filter dropdown ─────────────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-[#5A5568]">
      <span>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none px-2.5 py-1.5 pr-7 text-xs border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="w-3 h-3 text-[#A0A0B0] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </label>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Add Supplier Modal — picker (Global Registry / Dental Group) with a
// dedicated "+ New supplier" header button that switches to the manual form
// view. Matches the DSO AddSupplierModal pattern: sourcing from an existing
// registry is the default path; manual creation is a deliberate jump.
// ────────────────────────────────────────────────────────────────────────────
type PickerTab = 'global' | 'group';

function AddClinicSupplierModal({ existingIds, onClose, onAdd }: {
  existingIds: string[];
  onClose: () => void;
  onAdd: (next: Supplier) => void;
}) {
  const [view, setView] = useState<'pick' | 'create'>('pick');
  const [tab, setTab] = useState<PickerTab>('global');
  // Stages a candidate supplier — picker rows + the manual form both hand
  // off to this so the user sees the name + key details once more and
  // either confirms (→ onAdd) or backs out without committing.
  const [pending, setPending] = useState<{ source: 'global' | 'group' | 'manual'; supplier: Supplier } | null>(null);
  const handlePickerStage = (source: 'global' | 'group', s: Supplier) => setPending({ source, supplier: s });
  const handleManualStage = (s: Supplier) => setPending({ source: 'manual', supplier: s });
  const handleConfirm = () => {
    if (pending) {
      onAdd(pending.supplier);
      setPending(null);
    }
  };
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header — switches title + primary action based on view */}
          {view === 'pick' ? (
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#030213] truncate">Add Supplier</h2>
                  <p className="text-xs text-[#717182]">Pick from the registry or your Dental Group's list.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setView('create')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New supplier
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6]">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setView('pick')}
                  className="w-9 h-9 rounded-lg border border-[#E0E0E6] hover:bg-[#F8F9FC] flex items-center justify-center text-[#5A5568] flex-shrink-0"
                  title="Back to registry picker"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#030213] truncate">Add supplier manually</h2>
                  <p className="text-xs text-[#717182]">Goes to Dental Group first, then Super Admin for sign-off.</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182]">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Body */}
          {view === 'pick' ? (
            <>
              <div className="flex border-b border-[#F0EFF6] bg-[#FAFBFF]">
                <TabButton active={tab === 'global'} onClick={() => setTab('global')} icon={<Globe className="w-3.5 h-3.5" />} label="Global Registry" hint="Platform-wide" />
                <TabButton active={tab === 'group'} onClick={() => setTab('group')} icon={<Building2 className="w-3.5 h-3.5" />} label="Dental Group" hint="Your DSO's list" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {tab === 'global' && (
                  <GlobalRegistryTab existingIds={existingIds} onPick={(s) => handlePickerStage('global', s)} />
                )}
                {tab === 'group' && (
                  <DentalGroupTab existingIds={existingIds} onPick={(s) => handlePickerStage('group', s)} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <CreateNewTab onSubmit={handleManualStage} onCancel={() => setView('pick')} />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation overlay — sits on top of the modal so the picker / form
          stay mounted (no state lost if user cancels). */}
      {pending && (
        <ConfirmAddSupplierDialog
          source={pending.source}
          supplier={pending.supplier}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </ModalPortal>
  );
}

// ─── Confirm Add Supplier Dialog ────────────────────────────────────────────
// Shown right before a supplier is committed to the clinic list. Recaps the
// supplier's name + key details so the user has a clear "is this the right
// row?" moment. The wording adapts by source (the manual path emphasises
// that the entry will be submitted for approval).
function ConfirmAddSupplierDialog({ source, supplier, onCancel, onConfirm }: {
  source: 'global' | 'group' | 'manual';
  supplier: Supplier;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isManual = source === 'manual';
  const type = supplierType(supplier);
  const gl = supplier.glMapping?.glCode;
  const sourceLabel = source === 'global' ? 'Global Registry' : source === 'group' ? 'Dental Group' : 'Manually entered';
  const rows: { label: string; value?: string }[] = [
    { label: 'Type',             value: type },
    { label: 'Country',          value: countryName(supplier.country) || '—' },
    { label: 'Vendor ID',        value: supplier.vendorId },
    { label: 'Primary Contact',  value: supplier.primaryContact },
    { label: 'Email',            value: supplier.email },
    { label: 'Phone',            value: supplier.phone },
    { label: 'Tax ID / VAT',     value: supplier.taxId },
    { label: 'GL Code',          value: gl ? `${gl.code} — ${gl.nominalName}` : 'Not assigned' },
  ];
  const visibleRows = rows.filter(r => r.value && r.value !== '—');
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <span className={`w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${supplier.avatarColor}`}>
            {supplier.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[#030213]">
              Add "{supplier.name}"?
            </h3>
            <p className="text-[11px] text-[#717182] mt-0.5">
              {isManual
                ? 'Review the details below before submitting for approval.'
                : `From ${sourceLabel}. Confirm this is the right supplier.`}
            </p>
          </div>
        </div>
        {/* Detail rows */}
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-[#E8EAF6] divide-y divide-[#F0EFF6] bg-[#FAFBFF]">
            {visibleRows.map(r => (
              <div key={r.label} className="grid grid-cols-[110px_1fr] gap-3 px-3 py-1.5 text-[11px]">
                <span className="text-[#A0A0B0] font-medium">{r.label}</span>
                <span className="text-[#030213] font-semibold truncate" title={r.value}>{r.value}</span>
              </div>
            ))}
          </div>
          {isManual ? (
            <div className="mt-3 px-2.5 py-2 rounded-lg bg-[#FFFBEB] border border-[#FCD34D]">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#B45309] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#92400E] leading-snug">
                  Confirming sends this request to your <span className="font-bold">Dental Group</span> first.
                  Once they approve, the <span className="font-bold">Super Admin</span> reviews it and
                  adds the supplier to the Global Registry.
                </p>
              </div>
              {/* Mini stepper — visualises the two stages. */}
              <div className="flex items-center gap-1.5 mt-2 ml-5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-[#FCD34D] text-[10px] font-bold text-[#92400E]">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#B45309] text-white flex items-center justify-center text-[8px]">1</span>
                  Dental Group
                </span>
                <ChevronRight className="w-3 h-3 text-[#B45309]" />
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-[#FCD34D] text-[10px] font-bold text-[#B45309]/70">
                  <span className="w-3.5 h-3.5 rounded-full bg-white border border-[#B45309] text-[#B45309] flex items-center justify-center text-[8px]">2</span>
                  Super Admin
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[#717182] leading-snug">
              Adds <span className="font-semibold text-[#030213]">{supplier.name}</span> to your clinic's supplier list with status <span className="font-semibold text-[#030213]">On hold</span>. You can switch it to Active once you're ready.
            </p>
          )}
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFBFF] border-t border-[#F0EFF6]">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] bg-white border border-[#E0E0E6] hover:bg-[#F0EFF6]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            {isManual ? 'Submit for approval' : 'Confirm & Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, hint }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-left transition-colors border-b-2 ${
        active
          ? 'border-[#4D8EF7] bg-white'
          : 'border-transparent hover:bg-[#F0EFF6]'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={active ? 'text-[#1565C0]' : 'text-[#717182]'}>{icon}</span>
        <span className={`text-sm font-semibold ${active ? 'text-[#1565C0]' : 'text-[#030213]'}`}>{label}</span>
      </div>
      <p className="text-[10px] text-[#A0A0B0]">{hint}</p>
    </button>
  );
}

// ─── Tab 1: Global Registry ─────────────────────────────────────────────────
function GlobalRegistryTab({ existingIds, onPick }: {
  existingIds: string[];
  onPick: (s: Supplier) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return globalSuppliers;
    return globalSuppliers.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.vendorId.toLowerCase().includes(q) ||
      g.categories.some(c => c.toLowerCase().includes(q))
    );
  }, [query]);

  function makeFromGlobal(g: GlobalSupplier): Supplier {
    return {
      id: `cs-${g.id}`,
      vendorId: g.vendorId,
      name: g.name,
      initials: g.initials,
      avatarColor: g.avatarColor,
      country: g.country,
      categories: g.categories,
      relationshipStatus: 'On hold',  // Clinic picks from registry → On hold by default; flip to Active when ready
      practiceCount: 1,
      ytdSpend: 0,
      invoiceCount: 0,
      glMapping: null,
      taxId: g.taxId,
    };
  }

  return (
    <div className="p-5 space-y-3">
      <SearchRow value={query} onChange={setQuery} placeholder="Search the global registry…" />
      <div className="space-y-1.5">
        {filtered.map(g => {
          const added = existingIds.includes(`cs-${g.id}`);
          return (
            <SourceRow
              key={g.id}
              name={g.name}
              initials={g.initials}
              avatarColor={g.avatarColor}
              vendorId={g.vendorId}
              country={countryName(g.country)}
              categories={g.categories}
              badge={<SourceBadge tone="blue">Global</SourceBadge>}
              added={added}
              onAdd={() => onPick(makeFromGlobal(g))}
            />
          );
        })}
        {filtered.length === 0 && <EmptyResult />}
      </div>
    </div>
  );
}

// ─── Tab 2: Dental Group (DSO list) ─────────────────────────────────────────
function DentalGroupTab({ existingIds, onPick }: {
  existingIds: string[];
  onPick: (s: Supplier) => void;
}) {
  const [query, setQuery] = useState('');
  // Only suppliers in good standing (Active / On hold) should be selectable
  // from the DSO list. The Pending/Not using ones shouldn't propagate down.
  const dsoSuppliers = useMemo(
    () => mockSuppliers.filter(s => s.relationshipStatus === 'Active' || s.relationshipStatus === 'On hold'),
    []
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dsoSuppliers;
    return dsoSuppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.vendorId.toLowerCase().includes(q) ||
      s.categories.some(c => c.toLowerCase().includes(q))
    );
  }, [dsoSuppliers, query]);

  function makeFromDSO(s: Supplier): Supplier {
    // Clone but reset clinic-scoped numbers; inherit GL mapping suggestion
    // from the DSO since DSO sets the canonical GL Code for that supplier.
    return {
      ...s,
      relationshipStatus: 'On hold',
      ytdSpend: 0,
      invoiceCount: 0,
      practiceCount: 1,
    };
  }

  return (
    <div className="p-5 space-y-3">
      <SearchRow value={query} onChange={setQuery} placeholder="Search Dental Group's suppliers…" />
      <div className="space-y-1.5">
        {filtered.map(s => {
          const added = existingIds.includes(s.id);
          return (
            <SourceRow
              key={s.id}
              name={s.name}
              initials={s.initials}
              avatarColor={s.avatarColor}
              vendorId={s.vendorId}
              country={countryName(s.country)}
              categories={s.categories}
              badge={<SourceBadge tone="purple">DSO</SourceBadge>}
              added={added}
              onAdd={() => onPick(makeFromDSO(s))}
            />
          );
        })}
        {filtered.length === 0 && <EmptyResult />}
      </div>
    </div>
  );
}

// ─── Tab 3: Create New ──────────────────────────────────────────────────────
const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

function CreateNewTab({ onSubmit, onCancel }: { onSubmit: (s: Supplier) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [primaryContact, setPrimaryContact] = useState('');
  const [phone, setPhone] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [taxId, setTaxId] = useState('');
  const [type, setType] = useState<'Lab' | 'Non Lab' | ''>('');
  const [country, setCountry] = useState('GB');
  const [billingAddress, setBillingAddress] = useState('');
  const [glCodeKey, setGlCodeKey] = useState('');  // GL code value (string)
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Validation runs every render, but errors stay HIDDEN until the user
  // has touched (blurred) the field or attempted to submit. Avoids the
  // sea-of-Required-labels the moment the form opens.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const markTouched = (key: string) => setTouched(prev => prev.has(key) ? prev : new Set(prev).add(key));

  const rawErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim())            e.name = 'Required';
    if (!email.trim())           e.email = 'Required';
    else if (!/.+@.+\..+/.test(email)) e.email = 'Invalid email';
    if (!primaryContact.trim())  e.primaryContact = 'Required';
    if (!phone.trim())           e.phone = 'Required';
    if (!taxId.trim())           e.taxId = 'Required';
    if (!type)                   e.type = 'Required';
    return e;
  }, [name, email, primaryContact, phone, taxId, type]);

  // Visible errors — gated by touched / submitAttempted so we don't yell
  // at the user before they've had a chance to fill anything in.
  const errors: Record<string, string> = useMemo(() => {
    if (submitAttempted) return rawErrors;
    return Object.fromEntries(Object.entries(rawErrors).filter(([k]) => touched.has(k)));
  }, [rawErrors, touched, submitAttempted]);

  function handleSubmit() {
    if (Object.keys(rawErrors).length > 0) {
      setSubmitAttempted(true);
      return;
    }
    const id = `cs-new-${Date.now().toString(36)}`;
    const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    const gl = GL_ACCOUNTS.find(g => g.code === glCodeKey) ?? null;
    onSubmit({
      id,
      vendorId: `CV-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      name: name.trim(),
      initials,
      avatarColor: 'bg-[#EEF4FF] text-[#1565C0]',
      country,
      categories: type === 'Lab' ? ['Dental Labs'] : ['Clinical'],
      // Sequential approval — first the Dental Group reviews; once they
      // approve it moves to the Super Admin to be added to the Global
      // Registry. Stored on customFields so the detail page + status
      // tooltip can show which stage the request is currently at.
      relationshipStatus: 'Pending review',
      practiceCount: 1,
      ytdSpend: 0,
      invoiceCount: 0,
      glMapping: gl ? { glCode: gl, category: '', workflow: 'Single Approver', paymentTerms: 'Net 30' } : null,
      primaryContact: primaryContact.trim(),
      email: email.trim(),
      phone: phone.trim(),
      companyUrl: companyUrl.trim() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      taxId: taxId.trim(),
      notes: notes.trim() || undefined,
      customFields: {
        supplierType: type,
        accountNumber: accountNumber.trim(),
        approvalStage: 'awaiting-dso',  // → 'awaiting-super-admin' → 'approved'
        // Stamp the requester so the Dental Group portal can show
        // "Clinic: <user>" on its Pending list. Hardcoded for the demo —
        // production would resolve user + clinic from the session.
        requestSource: 'clinic',
        requestUser:   'Sajid Zahid',
        originClinic:  'Smile Genius Manchester',
      },
    });
  }

  const canSubmit = Object.keys(rawErrors).length === 0;

  return (
    <div className="p-5">
      {/* Approval notice — explains the sequential review steps. The
          request always reaches the Dental Group first; only after they
          approve does it move on to the Super Admin who promotes the
          supplier into the Global Registry. */}
      <div className="mb-4 px-3 py-2.5 rounded-lg bg-[#FFFBEB] border border-[#FCD34D] flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-[#92400E] leading-relaxed">
          Two-step approval: first your <span className="font-semibold">Dental Group</span> reviews
          the request. Once they sign off it moves on to the
          <span className="font-semibold"> Super Admin</span>, who promotes the supplier into the
          <span className="font-semibold"> Global Registry</span> so sibling clinics can reuse it.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Supplier Name" required error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => markTouched('name')} className={inputCls(errors.name)} placeholder="e.g. Northwood Dental Labs" />
        </Field>
        <Field label="Supplier Type" required error={errors.type}>
          <div className="grid grid-cols-2 gap-2">
            {(['Lab', 'Non Lab'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); markTouched('type'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  type === t
                    ? 'bg-[#EEF4FF] border-[#4D8EF7] text-[#1565C0]'
                    : 'bg-white border-[#E0E0E6] text-[#5A5568] hover:border-[#BFDBFE]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Email Address" required error={errors.email}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => markTouched('email')} type="email" className={inputCls(errors.email)} placeholder="orders@example.com" />
        </Field>
        <Field label="Primary Contact" required error={errors.primaryContact}>
          <input value={primaryContact} onChange={(e) => setPrimaryContact(e.target.value)} onBlur={() => markTouched('primaryContact')} className={inputCls(errors.primaryContact)} placeholder="e.g. Sarah Patel" />
        </Field>
        <Field label="Phone Number" required error={errors.phone}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => markTouched('phone')} className={inputCls(errors.phone)} placeholder="+44 …" />
        </Field>
        <Field label="Tax ID / VAT" required error={errors.taxId}>
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} onBlur={() => markTouched('taxId')} className={inputCls(errors.taxId)} placeholder="VAT or Tax ID" />
        </Field>
        <Field label="Company URL">
          <input value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} className={inputCls()} placeholder="https://…" />
        </Field>
        <Field label="Country">
          <div className="relative">
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={`${inputCls()} appearance-none pr-7 cursor-pointer`}>
              {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#A0A0B0] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </Field>
        <Field label="GL Code (assign from list)" hint="GL codes are managed by your Dental Group — pick from the list, you can't create new ones.">
          <div className="relative">
            <select value={glCodeKey} onChange={(e) => setGlCodeKey(e.target.value)} className={`${inputCls()} appearance-none pr-7 cursor-pointer`}>
              <option value="">Select GL Code…</option>
              {GL_ACCOUNTS.map(g => <option key={g.code} value={g.code}>{g.code} — {g.nominalName}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#A0A0B0] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </Field>
        <Field label="Account Number">
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputCls()} placeholder="Optional — vendor account #" />
        </Field>
        <Field label="Billing Address" className="sm:col-span-2">
          <textarea value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} rows={2} className={inputCls() + ' resize-none'} placeholder="Street, City, Postcode" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls() + ' resize-none'} placeholder="Anything the team should know…" />
        </Field>
      </div>
      <div className="mt-4 pt-3 border-t border-[#F0EFF6] flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit}>
          Submit for approval
        </Button>
      </div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full px-2.5 py-1.5 text-xs border rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15 ${
    err ? 'border-[#FCA5A5] bg-[#FFF5F5]' : 'border-[#E0E0E6] bg-white'
  }`;

function Field({ label, required, error, hint, className = '', children }: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">
        {label}
        {required && <span className="text-[#D4183D] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-[#D4183D] mt-0.5 flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" />{error}</p>}
      {hint && !error && <p className="text-[10px] text-[#A0A0B0] mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Shared bits between Tabs 1+2 ───────────────────────────────────────────
function SearchRow({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0A0B0]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15"
      />
    </div>
  );
}

function SourceRow({ name, initials, avatarColor, vendorId, country, categories, badge, added, onAdd }: {
  name: string;
  initials: string;
  avatarColor: string;
  vendorId: string;
  country: string;
  categories: string[];
  badge: React.ReactNode;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#E8EAF6] bg-white hover:border-[#BFDBFE] hover:bg-[#FAFBFF] transition-colors">
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}>
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-[#030213] truncate">{name}</p>
          {badge}
        </div>
        <p className="text-[10px] text-[#717182] mt-0.5 truncate">
          <span className="font-mono">{vendorId}</span> · {country || '—'} · {categories.slice(0, 3).join(' · ')}
          {categories.length > 3 && ` · +${categories.length - 3}`}
        </p>
      </div>
      {added ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-bold text-[#1A5C2A]">
          <Check className="w-3 h-3" strokeWidth={3} /> Added
        </span>
      ) : (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-[10px] font-bold hover:opacity-95"
        >
          <Plus className="w-3 h-3" strokeWidth={3} /> Add
        </button>
      )}
    </div>
  );
}

function SourceBadge({ tone, children }: { tone: 'blue' | 'purple'; children: React.ReactNode }) {
  const cls = tone === 'blue'
    ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]'
    : 'bg-[#F3EEFF] text-[#5B21B6] border-[#DDD6FE]';
  return (
    <span className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider border ${cls}`}>
      {children}
    </span>
  );
}

function EmptyResult() {
  return (
    <p className="text-center text-xs italic text-[#A0A0B0] py-6">No matches. Try a different keyword.</p>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Clinic Supplier Detail — drilldown view
// ────────────────────────────────────────────────────────────────────────────
function ClinicSupplierDetail({ supplier, onBack, onStatusChange, onGLChange, onUpdate }: {
  supplier: Supplier;
  onBack: () => void;
  onStatusChange: (s: SupplierRelationshipStatus) => void;
  onGLChange: (gl: GLCode | null) => void;
  onUpdate: (patch: Partial<Supplier>) => void;
}) {
  const isActive = supplier.relationshipStatus === 'Active';
  const isPending = supplier.relationshipStatus === 'Pending review';
  const stage = isPending ? approvalStage(supplier) : undefined;
  const editable = canEditClinicDetails(supplier);
  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-[#4D8EF7] hover:text-[#1565C0]">
          <ArrowLeft className="w-3 h-3" /> Back to Suppliers
        </button>

        {/* Header card */}
        <div className="bg-white border border-[#E0E0E6] rounded-2xl p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <span className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${supplier.avatarColor}`}>
              {supplier.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[#030213]">{supplier.name}</h1>
                <StatusCell status={supplier.relationshipStatus} locked={isActive || isPending} onChange={onStatusChange} stage={stage} />
              </div>
              <p className="text-xs text-[#717182] mt-1">
                <span className="font-mono">{supplier.vendorId}</span> · {countryName(supplier.country)} · {supplierType(supplier)}
              </p>
              {isPending && stage && (
                <ApprovalStepper stage={stage} />
              )}
              {isActive && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] text-[#1A5C2A]">
                  <Lock className="w-3 h-3" />
                  Active supplier — status changes now managed by your Dental Group
                </div>
              )}
              {/* Editability banner — tells the user upfront whether they
                  can edit these details or whether they're read-only. */}
              {editable ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EEF4FF] border border-[#BFDBFE] text-[11px] text-[#1565C0]">
                  <Pencil className="w-3 h-3" strokeWidth={2.5} />
                  You can edit these details — changes go into the next review.
                </div>
              ) : !isActive && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAFBFF] border border-[#E0E0E6] text-[11px] text-[#5A5568]">
                  <Lock className="w-3 h-3" />
                  Read-only — managed by your Dental Group. Contact your DSO admin to suggest changes.
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">YTD Spend (Clinic)</p>
              <p className="text-2xl font-bold text-[#030213] tabular-nums">{fmtCurrency(supplier.ytdSpend)}</p>
              <p className="text-[11px] text-[#717182] mt-0.5">{supplier.invoiceCount} invoices</p>
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-[#E0E0E6] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#030213]">Contact</h3>
              {editable && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]">
                  <Pencil className="w-2.5 h-2.5" strokeWidth={3} /> Editable
                </span>
              )}
            </div>
            {editable ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <EditableField label="Primary Contact" value={supplier.primaryContact ?? ''} onCommit={(v) => onUpdate({ primaryContact: v })} placeholder="e.g. Sarah Patel" />
                <EditableField label="Email"           value={supplier.email ?? ''}           onCommit={(v) => onUpdate({ email: v })}           placeholder="orders@example.com" />
                <EditableField label="Phone"           value={supplier.phone ?? ''}           onCommit={(v) => onUpdate({ phone: v })}           placeholder="+44 …" />
                <EditableField label="Company URL"     value={supplier.companyUrl ?? ''}      onCommit={(v) => onUpdate({ companyUrl: v })}      placeholder="https://…" />
                <EditableField label="Tax ID / VAT"    value={supplier.taxId ?? ''}           onCommit={(v) => onUpdate({ taxId: v })}           placeholder="VAT or Tax ID" />
                <EditableField
                  label="Account Number"
                  value={supplier.customFields?.accountNumber ?? ''}
                  onCommit={(v) => onUpdate({ customFields: { ...supplier.customFields, accountNumber: v } })}
                  placeholder="Optional"
                />
                <EditableField
                  label="Billing Address"
                  value={supplier.billingAddress ?? ''}
                  onCommit={(v) => onUpdate({ billingAddress: v })}
                  placeholder="Street, City, Postcode"
                  multiline
                  className="sm:col-span-2"
                />
                <EditableField
                  label="Notes"
                  value={supplier.notes ?? ''}
                  onCommit={(v) => onUpdate({ notes: v })}
                  placeholder="Anything the team should know…"
                  multiline
                  className="sm:col-span-2"
                />
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Detail label="Primary Contact" value={supplier.primaryContact} />
                <Detail label="Email" value={supplier.email} />
                <Detail label="Phone" value={supplier.phone} />
                <Detail label="Company URL" value={supplier.companyUrl} />
                <Detail label="Tax ID / VAT" value={supplier.taxId} />
                <Detail label="Account Number" value={supplier.customFields?.accountNumber} />
                <Detail label="Billing Address" value={supplier.billingAddress} className="sm:col-span-2" />
                {supplier.notes && <Detail label="Notes" value={supplier.notes} className="sm:col-span-2" />}
              </dl>
            )}
          </div>
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#030213]">GL Mapping</h3>
            <div>
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1">GL Code</p>
              <GLCodeCell supplier={supplier} locked={isActive} onChange={onGLChange} />
              <p className="text-[10px] text-[#A0A0B0] mt-1 leading-relaxed">
                Pick from the codes your Dental Group has set up. Clinics can't create or edit GL codes.
              </p>
            </div>
            {supplier.glMapping && (
              <>
                <Detail label="Nominal" value={supplier.glMapping.glCode.nominalName} />
                <Detail label="Category" value={supplier.glMapping.category || '—'} />
                <Detail label="Payment Terms" value={supplier.glMapping.paymentTerms} />
              </>
            )}
          </div>
        </div>

        {/* Activity stub */}
        <div className="bg-white border border-[#E0E0E6] rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#030213] mb-2">Recent Activity</h3>
          <p className="text-xs text-[#717182] italic">
            Invoice history for this supplier within your clinic will appear here once linked to AP records.
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{label}</dt>
      <dd className="text-xs text-[#030213] mt-0.5">{value || <span className="italic text-[#A0A0B0]">—</span>}</dd>
    </div>
  );
}

// ─── Inline-edit field — click-to-edit pattern used on the editable
//     Contact card. Click the value to enter edit mode; Save commits via
//     onCommit, Esc cancels. Renders identical chrome to <Detail> when not
//     editing so the read-only and editable layouts stay aligned.
function EditableField({ label, value, onCommit, placeholder, multiline = false, className = '' }: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const save = () => {
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
    setEditing(false);
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <div className={className}>
        <dt className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{label}</dt>
        <dd className="mt-0.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group inline-flex items-start gap-1.5 text-left w-full hover:bg-[#FAFBFF] rounded px-1 -mx-1 py-0.5 transition-colors"
          >
            <span className="text-xs text-[#030213] flex-1 truncate">
              {value || <span className="italic text-[#A0A0B0]">{placeholder || '—'}</span>}
            </span>
            <Pencil className="w-2.5 h-2.5 text-[#A0A0B0] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0" />
          </button>
        </dd>
      </div>
    );
  }
  const InputTag = multiline ? 'textarea' : 'input';
  return (
    <div className={className}>
      <dt className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 flex items-start gap-1">
        <InputTag
          // Cast lets the union element type accept both rows and type.
          {...(multiline ? { rows: 2 } : { type: 'text' }) as any}
          value={draft}
          autoFocus
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !multiline) { e.preventDefault(); save(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          placeholder={placeholder}
          className={`flex-1 px-2 py-1 text-xs border border-[#BFDBFE] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15 ${multiline ? 'resize-none' : ''}`}
        />
        <button
          type="button"
          onClick={save}
          className="px-1.5 py-1 rounded-md bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white hover:opacity-95 flex-shrink-0"
          title="Save (Enter)"
        >
          <Save className="w-3 h-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={cancel}
          className="px-1.5 py-1 rounded-md text-[#A0A0B0] hover:text-[#C62828] hover:bg-[#FFEBEE] flex-shrink-0"
          title="Cancel (Esc)"
        >
          <X className="w-3 h-3" />
        </button>
      </dd>
    </div>
  );
}

// ─── Approval stepper — single-line timeline for Pending review headers ─────
// Two stages: Dental Group → Super Admin. Renders as inline numbered dots
// connected by a thin line, with a short suffix showing what's happening
// now. Sits on one line so it adds minimal vertical noise to the header.
function ApprovalStepper({ stage }: { stage: 'awaiting-dso' | 'awaiting-super-admin' | 'approved' }) {
  const steps = [
    { label: 'Dental Group', state: stage === 'awaiting-dso' ? 'active' : 'done' },
    { label: 'Super Admin',  state: stage === 'approved' ? 'done' : stage === 'awaiting-super-admin' ? 'active' : 'pending' },
  ] as const;
  const currentLabel =
    stage === 'awaiting-dso'         ? 'with Dental Group' :
    stage === 'awaiting-super-admin' ? 'with Super Admin'  :
                                       'approved';
  const dotCls = (state: 'done' | 'active' | 'pending') =>
    state === 'done'
      ? 'bg-[#16A34A] text-white border-[#16A34A]'
      : state === 'active'
        ? 'bg-[#B45309] text-white border-[#B45309]'
        : 'bg-white text-[#A0A0B0] border-[#E0E0E6]';
  return (
    <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#FFFBEB] border border-[#FCD34D] text-[11px] text-[#92400E]">
      {steps.map((s, i) => (
        <span key={s.label} className="inline-flex items-center gap-1">
          {i > 0 && <span className="inline-block w-3 h-px bg-[#FCD34D]" />}
          <span
            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-bold ${dotCls(s.state)}`}
            title={`${s.label} — ${s.state}`}
          >
            {s.state === 'done' ? <Check className="w-2 h-2" strokeWidth={4} /> : i + 1}
          </span>
          <span className={`font-semibold ${s.state === 'pending' ? 'text-[#A0A0B0]' : ''}`}>
            {s.label}
          </span>
        </span>
      ))}
      <span className="text-[#B45309]/80">·</span>
      <span className="italic">Currently {currentLabel}</span>
    </div>
  );
}
