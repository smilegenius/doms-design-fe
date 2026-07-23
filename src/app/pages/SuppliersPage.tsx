import { useState, useMemo } from 'react';
import { Plus, Grid3x3, List, Filter, Tag, ChevronRight, ChevronDown, X, CheckCircle2, Clock, XCircle, PauseCircle, Package, Archive, Check, Copy, Building2 } from 'lucide-react';
import SortDropdown from '../components/SortDropdown';
import { mockSuppliers, Supplier, SupplierGLMapping, SupplierRelationshipStatus, EXPENSE_CATEGORIES } from '../data/suppliersData';
import { useToast } from '../context/ToastContext';

import GLCodeMappingPanel from '../components/GLCodeMappingPanel';
import AddSupplierModal from '../components/AddSupplierModal';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import FilterDrawer from '../components/FilterDrawer';

type ViewMode = 'table' | 'grid';

const ALL_STATUSES: SupplierRelationshipStatus[] = [
  'Active', 'Not using', 'Archived', 'Pending review',
];

// Two-letter ISO → display name for the supplier-row sub-text. Only the
// countries currently present in mock data are listed; unknown codes fall
// back to the raw code.
const COUNTRY_NAMES: Record<string, string> = {
  IE: 'Ireland',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  SE: 'Sweden',
  DK: 'Denmark',
  LI: 'Liechtenstein',
  JP: 'Japan',
  KR: 'South Korea',
  US: 'United States',
};
const countryName = (code?: string) => (code ? COUNTRY_NAMES[code] ?? code : '');

function statusStyle(s: SupplierRelationshipStatus) {
  switch (s) {
    case 'Active':         return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Pending review': return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'On hold':        return 'text-[#5A5568] bg-[#F3F3F5] border-[#D4CEE1]';
    case 'Not using':      return 'text-[#5A5568] bg-[#F0EFF6] border-[#D4CEE1]';
    case 'Archived':       return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}


function formatCurrency(n: number) {
  return '£' + n.toLocaleString('en-GB');
}

// Hover tooltip with copy button — wraps any text
function CopyTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="relative group/tip">
      {children}
      <span className="pointer-events-none group-hover/tip:pointer-events-auto absolute left-0 top-full mt-1 z-[60] opacity-0 group-hover/tip:opacity-100 transition-opacity flex items-center gap-2 bg-[#1A1A2E] text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap max-w-[320px]">
        <span className="flex-1 break-all line-clamp-3">{text}</span>
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="flex-shrink-0 text-[#A59DFF] hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
      </span>
    </span>
  );
}

// "+N" badge that shows remaining categories on hover
function CategoryOverflow({ extra }: { extra: string[] }) {
  return (
    <span className="relative group/cats inline-flex items-center flex-shrink-0">
      <span className="px-1.5 py-0.5 bg-[#E0E0E6] text-[#717182] rounded text-[10px] cursor-default">
        +{extra.length}
      </span>
      <span className="pointer-events-none group-hover/cats:pointer-events-auto absolute left-0 top-full mt-1 z-[60] opacity-0 group-hover/cats:opacity-100 transition-opacity bg-white border border-[#E0E0E6] rounded-lg shadow-xl py-1.5 min-w-[160px]">
        {extra.map(cat => (
          <span key={cat} className="block px-3 py-1 text-xs text-[#5A5568] whitespace-nowrap">{cat}</span>
        ))}
      </span>
    </span>
  );
}

function StatusDropdown({ current, onSelect }: {
  current: SupplierRelationshipStatus;
  onSelect: (s: SupplierRelationshipStatus) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#E0E0E6] shadow-lg py-1 min-w-[160px]">
      {ALL_STATUSES.map(st => (
        <button
          key={st}
          onClick={(e) => { e.stopPropagation(); onSelect(st); }}
          className="w-full text-left px-3 py-1.5 hover:bg-[#F8F9FC] transition-colors flex items-center justify-between gap-2"
        >
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyle(st)}`}>{st}</span>
          {current === st && <Check className="w-3 h-3 text-[#4D8EF7] flex-shrink-0" />}
        </button>
      ))}
    </div>
  );
}

// ── Grid card ────────────────────────────────────────────────────────────────
function SupplierCard({ supplier, selected, onToggle, onGLClick, onStatusChange, onDetailClick, statusMenuOpen, onStatusMenuToggle }: {
  supplier: Supplier;
  selected: boolean;
  onToggle: () => void;
  onGLClick: () => void;
  onStatusChange: (s: SupplierRelationshipStatus) => void;
  onDetailClick: () => void;
  statusMenuOpen: boolean;
  onStatusMenuToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`bg-white rounded-lg border p-4 transition-all hover:shadow-md hover:border-[#C8C0F0] cursor-pointer relative ${
        selected ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/20' : 'border-[#E0E0E6]'
      }`}
      onClick={onDetailClick}
    >
      {/* Checkbox — only this toggles selection */}
      <div className="absolute top-3 right-3" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
          selected ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'
        }`}>
          {selected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </div>

      {/* Name */}
      <div className="mb-3 pr-6">
        <p title={supplier.name} className="font-medium text-[#030213] text-xs leading-tight truncate hover:text-[#4D8EF7] transition-colors">{supplier.name}</p>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-1 mb-3">
        <span className="px-1.5 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px] whitespace-nowrap truncate max-w-[120px]">{supplier.categories[0]}</span>
        {supplier.categories.length > 1 && (
          <CategoryOverflow extra={supplier.categories.slice(1)} />
        )}
      </div>

      {/* Metrics row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-[#717182]">
          <span className="font-semibold text-[#030213]">{formatCurrency(supplier.ytdSpend)}</span> YTD
        </div>
        <div className="text-xs text-[#717182]">
          <span className="font-semibold text-[#030213]">{supplier.invoiceCount}</span> inv.
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end pt-2 border-t border-[#F0EFF6]">
        {/* Status dropdown */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={onStatusMenuToggle}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border hover:opacity-75 transition-opacity flex items-center gap-1 ${statusStyle(supplier.relationshipStatus)}`}
          >
            {supplier.relationshipStatus}
            <ChevronDown className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
          </button>
          {statusMenuOpen && (
            <div className="absolute right-0 bottom-7 z-50">
              <StatusDropdown current={supplier.relationshipStatus} onSelect={(st) => { onStatusChange(st); }} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuppliersPage({ onSupplierClick, initialStatusFilter, onNavigateToSettings }: { onSupplierClick?: (s: Supplier) => void; initialStatusFilter?: SupplierRelationshipStatus | 'all'; onNavigateToSettings?: () => void }) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState(mockSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierRelationshipStatus | 'all'>(initialStatusFilter ?? 'all');
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [glFilter, setGlFilter] = useState('all');
  // Default to grid (card) view on mobile — the wide table is hard to read on a phone.
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window === 'undefined' ? 'table' : (window.innerWidth >= 768 ? 'table' : 'grid')
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [glPanelSupplier, setGlPanelSupplier] = useState<Supplier | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sort — default to invoice count descending so high-traffic suppliers surface first
  const [sortBy, setSortBy] = useState('invoices-desc');
  const supplierSortOptions = [
    { value: 'name-asc',      label: 'Name A–Z' },
    { value: 'name-desc',     label: 'Name Z–A' },
    { value: 'spend-desc',    label: 'Spend: High–Low' },
    { value: 'spend-asc',     label: 'Spend: Low–High' },
    { value: 'invoices-desc', label: 'Invoices: Most' },
    { value: 'status',        label: 'Status' },
  ];
  // Note: a global page-change loader is already shown by Layout (navLoading) for ~500ms,
  // so this page does not need its own additional artificial delay.
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);

  function handleAddSupplier(supplier: Supplier) {
    setSuppliers(prev => [...prev, supplier]);
  }

  function handleSaveGL(supplierId: string, mapping: SupplierGLMapping) {
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, glMapping: mapping } : s));
  }

  function updateStatus(id: string, status: SupplierRelationshipStatus) {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, relationshipStatus: status } : s));
    setStatusMenuId(null);
  }

  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState(false);
  function applyBulkArchive() {
    const count = selectedIds.length;
    setSuppliers(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, relationshipStatus: 'Archived' as const } : s));
    setSelectedIds([]);
    setBulkArchiveConfirm(false);
    toast.success(`${count} ${count === 1 ? 'supplier' : 'suppliers'} archived`);
  }

  const stats = useMemo(() => ({
    total:         suppliers.length,
    active:        suppliers.filter(s => s.relationshipStatus === 'Active').length,
    notUsing:      suppliers.filter(s => s.relationshipStatus === 'Not using').length,
    paused:        suppliers.filter(s => s.relationshipStatus === 'On hold' || s.relationshipStatus === 'Not using').length,
    pendingReview: suppliers.filter(s => s.relationshipStatus === 'Pending review').length,
    archived:      suppliers.filter(s => s.relationshipStatus === 'Archived').length,
  }), [suppliers]);

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      // Archive view shows only archived; otherwise exclude archived
      if (showArchived) {
        if (s.relationshipStatus !== 'Archived') return false;
      } else {
        if (s.relationshipStatus === 'Archived') return false;
      }
      const matchStatus   = showArchived || statusFilter === 'all' || s.relationshipStatus === statusFilter;
      const matchCategory = categoryFilter === 'all' || s.categories.includes(categoryFilter);
      const matchGL       = glFilter === 'all' || (glFilter === 'mapped' ? !!s.glMapping : !s.glMapping);
      const q = searchQuery.toLowerCase();
      const matchSearch   = !q || s.name.toLowerCase().includes(q) || s.vendorId.toLowerCase().includes(q);
      return matchStatus && matchCategory && matchGL && matchSearch;
    });
  }, [suppliers, statusFilter, categoryFilter, glFilter, searchQuery, showArchived]);

  const sortedSuppliers = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':      return a.name.localeCompare(b.name);
        case 'name-desc':     return b.name.localeCompare(a.name);
        case 'spend-desc':    return b.ytdSpend - a.ytdSpend;
        case 'spend-asc':     return a.ytdSpend - b.ytdSpend;
        case 'invoices-desc': return b.invoiceCount - a.invoiceCount;
        case 'status':        return a.relationshipStatus.localeCompare(b.relationshipStatus);
        default:              return 0;
      }
    });
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sortedSuppliers.length / itemsPerPage);
  const paginated  = sortedSuppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSelectAll() {
    const pageIds = paginated.map(s => s.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  }
  const pageAllSelected = paginated.length > 0 && paginated.every(s => selectedIds.includes(s.id));

  function handlePageChange(page: number) {
    setCurrentPage(page);
    setSelectedIds([]);
  }

  function clearFilters() {
    setStatusFilter('all');
    setCategoryFilter('all');
    setGlFilter('all');
  }

  const hasActiveDrawerFilters = categoryFilter !== 'all' || glFilter !== 'all';

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
  ], []);

  const glOptions = [
    { value: 'all', label: 'All' },
    { value: 'mapped', label: 'GL Mapped' },
    { value: 'unmapped', label: 'Unmapped' },
  ];

  // 'Archived' is intentionally absent — archived suppliers live behind the
  // dedicated "View Archived" toggle, never the status filter.
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Active', label: 'Active' },
    { value: 'On hold', label: 'On hold' },
    { value: 'Not using', label: 'Not using' },
    { value: 'Pending review', label: 'Pending review' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Close menus overlay */}
      {statusMenuId && (
        <div className="fixed inset-0 z-40" onClick={() => setStatusMenuId(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-1">My Suppliers</h1>
          <p className="text-sm text-[#717182]">Supplier directory with GL code mappings and approval workflows.</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-5 h-5" />} onClick={() => setAddModalOpen(true)} className="whitespace-nowrap">
          Add Supplier
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <button onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md text-left ${statusFilter === 'all' ? 'border-transparent' : 'border-[#E0E0E6]'}`}
          style={statusFilter === 'all' ? { background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #4D8EF7, #A59DFF) border-box', border: '2px solid transparent' } : {}}>
          <div className="flex items-center justify-between">
            <div><div className="text-xs text-[#717182] mb-1">Total</div><div className="text-xl font-semibold text-[#030213]">{stats.total}</div></div>
            <div className="w-10 h-10 rounded-full bg-[#4D8EF7]/10 flex items-center justify-center"><Package className="w-5 h-5 text-[#4D8EF7]" /></div>
          </div>
        </button>

        <button onClick={() => { setStatusFilter('Active'); setCurrentPage(1); }}
          className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md text-left ${statusFilter === 'Active' ? 'border-[#2E7D32] ring-2 ring-[#2E7D32]/20' : 'border-[#E0E0E6]'}`}>
          <div className="flex items-center justify-between">
            <div><div className="text-xs text-[#717182] mb-1">Active</div><div className="text-xl font-semibold text-[#030213]">{stats.active}</div></div>
            <div className="w-10 h-10 rounded-full bg-[#2E7D32]/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-[#2E7D32]" /></div>
          </div>
        </button>

<button onClick={() => { setStatusFilter('On hold'); setCurrentPage(1); }}
          className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md text-left ${statusFilter === 'On hold' ? 'border-[#5A5568] ring-2 ring-[#5A5568]/20' : 'border-[#E0E0E6]'}`}>
          <div className="flex items-center justify-between">
            <div><div className="text-xs text-[#717182] mb-1">Paused / On hold</div><div className="text-xl font-semibold text-[#030213]">{stats.paused}</div></div>
            <div className="w-10 h-10 rounded-full bg-[#5A5568]/10 flex items-center justify-center"><PauseCircle className="w-5 h-5 text-[#5A5568]" /></div>
          </div>
        </button>

        <button onClick={() => { setStatusFilter('Pending review'); setCurrentPage(1); }}
          className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md text-left ${statusFilter === 'Pending review' ? 'border-[#E65100] ring-2 ring-[#E65100]/20' : 'border-[#E0E0E6]'}`}>
          <div className="flex items-center justify-between">
            <div><div className="text-xs text-[#717182] mb-1">Pending Review</div><div className="text-xl font-semibold text-[#030213]">{stats.pendingReview}</div></div>
            <div className="w-10 h-10 rounded-full bg-[#E65100]/10 flex items-center justify-center"><Clock className="w-5 h-5 text-[#E65100]" /></div>
          </div>
        </button>

      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm font-medium text-[#1565C0]">{selectedIds.length} supplier{selectedIds.length !== 1 ? 's' : ''} selected</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkArchiveConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#717182] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>Clear Selection</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk archive confirmation */}
      {bulkArchiveConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBulkArchiveConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5 text-[#717182]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[#030213]">Archive suppliers?</h3>
                <p className="text-sm text-[#717182] mt-1">
                  {selectedIds.length} {selectedIds.length === 1 ? 'supplier' : 'suppliers'} will be moved to Archived. You can restore them later.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setBulkArchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] text-[#717182] rounded-lg hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyBulkArchive}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#717182] rounded-lg transition-opacity hover:opacity-90"
              >
                Archive all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + view toggle + filter */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <SearchInput placeholder="Search by name or vendor ID..." value={searchQuery} onChange={v => { setSearchQuery(v); setCurrentPage(1); }} />
          <SortDropdown options={supplierSortOptions} value={sortBy} onChange={v => { setSortBy(v); setCurrentPage(1); }} />
          <button onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')} className="p-3 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors flex-shrink-0">
            {viewMode === 'table' ? <Grid3x3 className="w-5 h-5 text-[#717182]" /> : <List className="w-5 h-5 text-[#717182]" />}
          </button>
          <button onClick={() => setFilterDrawerOpen(true)} className="p-3 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex-shrink-0">
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>

        {hasActiveDrawerFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-sm text-[#717182]">Active Filters:</span>
            {categoryFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                <span>Category: {categoryFilter}</span>
                <button onClick={() => setCategoryFilter('all')}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {glFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                <span>GL: {glFilter === 'mapped' ? 'GL Mapped' : 'Unmapped'}</span>
                <button onClick={() => setGlFilter('all')}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear All</Button>
          </div>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center py-20 text-[#A0A0B0]">
          <Package className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-[#030213]">No suppliers found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
          {(searchQuery || hasActiveDrawerFilters || statusFilter !== 'all') && (
            <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); clearFilters(); }} className="mt-3 text-xs text-[#4D8EF7] hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <>
          <div className="bg-[#F3F3F5] rounded-xl border border-[#E0E0E6] overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-y-1">
              <thead>
                <tr className="bg-[#F3F3F5] [&>th]:border-b [&>th]:border-[#E0E0E6]">
                  <th className="w-12 px-6 py-4">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${pageAllSelected ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'}`} onClick={toggleSelectAll}>
                      {pageAllSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </th>
                  {['Supplier', 'GL Code', 'Description', 'Status', 'YTD Spend', 'Invoices', ''].map(h => (
                    <th key={h} className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(s => (
                  <tr key={s.id} className="group bg-white hover:bg-[#F8F9FC] transition-colors cursor-pointer [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px]" onClick={() => onSupplierClick?.(s)}>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${selectedIds.includes(s.id) ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'}`} onClick={() => toggleSelect(s.id)}>
                        {selectedIds.includes(s.id) && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div title={s.name} className="text-xs font-medium text-[#030213] truncate max-w-[180px]">{s.name}</div>
                      <div className="text-xs text-[#A0A0B0] mt-0.5">{countryName(s.country)}</div>
                    </td>
                    {/* GL Code — primary code chip + small "+N" overflow chip when
                        the supplier has more than one category mapped */}
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      {s.glMapping ? (
                        <button onClick={() => setGlPanelSupplier(s)} className="inline-flex items-center gap-1 group/gl">
                          <span className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-xs font-mono font-semibold whitespace-nowrap group-hover/gl:bg-[#EEF4FF] group-hover/gl:text-[#4D8EF7] transition-colors">{s.glMapping.glCode.code}</span>
                          {s.categories.length > 1 && (
                            <span className="px-1.5 py-0.5 bg-[#F3F3F5] text-[#A0A0B0] rounded text-[10px] font-semibold whitespace-nowrap">+{s.categories.length - 1}</span>
                          )}
                        </button>
                      ) : (
                        <button onClick={() => setGlPanelSupplier(s)} className="inline-flex items-center gap-1 text-xs text-[#A0A0B0] hover:text-[#4D8EF7] transition-colors">
                          <Tag className="w-3 h-3" /><span>Map GL code</span>
                        </button>
                      )}
                    </td>
                    {/* Description — primary category label + same "+N" overflow */}
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      {s.glMapping ? (
                        <div className="inline-flex items-center gap-1">
                          <span title={s.glMapping.category} className="text-xs text-[#030213] truncate max-w-[140px]">{s.glMapping.category}</span>
                          {s.categories.length > 1 && (
                            <span className="px-1.5 py-0.5 bg-[#F3F3F5] text-[#A0A0B0] rounded text-[10px] font-semibold whitespace-nowrap">+{s.categories.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#A0A0B0]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-start gap-1">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => { e.stopPropagation(); setStatusMenuId(statusMenuId === s.id ? null : s.id); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border hover:opacity-75 transition-opacity cursor-pointer ${statusStyle(s.relationshipStatus)}`}
                          >
                            {s.relationshipStatus}
                            <ChevronDown className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
                          </button>
                          {statusMenuId === s.id && (
                            <div className="absolute left-0 top-7 z-50">
                              <StatusDropdown current={s.relationshipStatus} onSelect={(st) => updateStatus(s.id, st)} />
                            </div>
                          )}
                        </div>
                        {/* Requester chip — surfaces on Pending review rows so
                            the admin can tell whether a Clinic requested the
                            supplier or the Dental Group did. Format:
                              "Clinic: <user>" (blue tone)
                              "DSO: <user>"    (purple tone)
                            Sits under the status pill so the source travels
                            with the status it qualifies. */}
                        {s.relationshipStatus === 'Pending review' && s.customFields?.requestUser && (() => {
                          const isClinic = s.customFields.requestSource === 'clinic';
                          const label    = isClinic ? 'Clinic' : 'DSO';
                          const tone     = isClinic
                            ? 'bg-[#EEF4FF] border-[#BFDBFE] text-[#1565C0]'
                            : 'bg-[#F3EEFF] border-[#DDD6FE] text-[#5B21B6]';
                          return (
                            <div
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold max-w-[200px] ${tone}`}
                              title={s.customFields.originClinic
                                ? `${label}: ${s.customFields.requestUser} · ${s.customFields.originClinic}`
                                : `${label}: ${s.customFields.requestUser}`}
                            >
                              <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">
                                <span className="font-bold">{label}:</span> {s.customFields.requestUser}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-[#030213] whitespace-nowrap">{formatCurrency(s.ytdSpend)}</td>
                    <td className="px-6 py-4 text-xs text-[#717182]">{s.invoiceCount}</td>
                    <td className="px-6 py-4">
                      <ChevronRight className="w-4 h-4 text-[#D4CEE1] group-hover:text-[#A59DFF] transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-white rounded-lg border border-[#E0E0E6]">
            <div className="px-6 py-3 border-b border-[#F0EFF6] flex items-center justify-between">
              <button
                onClick={() => { setShowArchived(s => !s); setCurrentPage(1); }}
                className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  showArchived
                    ? 'bg-[#4D8EF7] text-white hover:bg-[#3578E5]'
                    : 'text-[#5A5568] hover:bg-[#F3F3F5] border border-[#E0E0E6]'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchived ? 'Hide Archived' : `View Archived (${stats.archived ?? 0})`}
              </button>
              <span className="text-xs text-[#717182]">
                {filtered.length} {filtered.length === 1 ? 'supplier' : 'suppliers'}
              </span>
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} itemsPerPage={itemsPerPage} totalItems={filtered.length} onPageChange={handlePageChange} onItemsPerPageChange={items => { setItemsPerPage(items); setCurrentPage(1); }} />
            )}
          </div>
        </>
      ) : (
        <>
          {/* Select-all bar for grid view */}
          <div className="flex items-center gap-3 mb-3 px-1">
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${pageAllSelected ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'}`}
              onClick={toggleSelectAll}
            >
              {pageAllSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {!pageAllSelected && selectedIds.some(id => paginated.map(s => s.id).includes(id)) && <div className="w-2 h-0.5 bg-[#4D8EF7] rounded" />}
            </div>
            <span className="text-xs text-[#717182]">
              {pageAllSelected ? `All ${paginated.length} on this page selected` : selectedIds.some(id => paginated.map(s => s.id).includes(id)) ? `${selectedIds.filter(id => paginated.map(s => s.id).includes(id)).length} selected` : `Select all on this page`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map(s => (
              <SupplierCard
                key={s.id}
                supplier={s}
                selected={selectedIds.includes(s.id)}
                onToggle={() => toggleSelect(s.id)}
                onGLClick={() => setGlPanelSupplier(s)}
                onStatusChange={(st) => updateStatus(s.id, st)}
                onDetailClick={() => onSupplierClick?.(s)}
                statusMenuOpen={statusMenuId === s.id}
                onStatusMenuToggle={(e) => { e.stopPropagation(); setStatusMenuId(statusMenuId === s.id ? null : s.id); }}
              />
            ))}
          </div>

          <div className="mt-4 bg-white rounded-lg border border-[#E0E0E6]">
            <div className="px-6 py-3 border-b border-[#F0EFF6] flex items-center justify-between">
              <button
                onClick={() => { setShowArchived(s => !s); setCurrentPage(1); }}
                className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  showArchived
                    ? 'bg-[#4D8EF7] text-white hover:bg-[#3578E5]'
                    : 'text-[#5A5568] hover:bg-[#F3F3F5] border border-[#E0E0E6]'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchived ? 'Hide Archived' : `View Archived (${stats.archived ?? 0})`}
              </button>
              <span className="text-xs text-[#717182]">
                {filtered.length} {filtered.length === 1 ? 'supplier' : 'suppliers'}
              </span>
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} itemsPerPage={itemsPerPage} totalItems={filtered.length} onPageChange={handlePageChange} onItemsPerPageChange={items => { setItemsPerPage(items); setCurrentPage(1); }} />
            )}
          </div>
        </>
      )}

      {glPanelSupplier && (
        <GLCodeMappingPanel supplier={glPanelSupplier} onClose={() => setGlPanelSupplier(null)} onSave={handleSaveGL} />
      )}

      {addModalOpen && (
        <AddSupplierModal
          existingNames={suppliers.map(s => s.name.toLowerCase())}
          onAdd={handleAddSupplier}
          onClose={() => setAddModalOpen(false)}
          onNavigateToSettings={onNavigateToSettings}
        />
      )}

      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={[
          { label: 'Status', value: statusFilter, options: statusOptions, onChange: v => { setStatusFilter(v as SupplierRelationshipStatus | 'all'); setCurrentPage(1); } },
          { label: 'Category', value: categoryFilter, options: categoryOptions, onChange: v => { setCategoryFilter(v); setCurrentPage(1); } },
          { label: 'GL Mapping', value: glFilter, options: glOptions, onChange: v => { setGlFilter(v); setCurrentPage(1); } },
        ]}
        onApply={() => setFilterDrawerOpen(false)}
        onReset={() => { clearFilters(); setFilterDrawerOpen(false); }}
      />
    </div>
  );
}
