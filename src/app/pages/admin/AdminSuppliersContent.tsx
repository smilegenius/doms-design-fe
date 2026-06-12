import { useState, useMemo } from 'react';
import { Grid3x3, List, Filter, CheckCircle2, XCircle, Clock, Package, X, Plus, Upload, Globe, MapPin, MoreVertical, Archive, FileText, ChevronRight, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { PendingSupplierSubmission, initialPendingSubmissions, GlobalSupplier, globalSuppliers } from '../../data/globalSuppliersData';
import { AdminGlobalSupplierDetail, AdminSubmissionDetail, GlobalSupplierStatus } from './AdminSupplierDetailPage';
import Button from '../../components/Button';
import SearchInput from '../../components/SearchInput';
import Pagination from '../../components/Pagination';
import FilterDrawer from '../../components/FilterDrawer';
import AdminAddSupplierModal from '../../components/AdminAddSupplierModal';
import AdminCSVUploadModal from '../../components/AdminCSVUploadModal';

type TabFilter = PendingSupplierSubmission['status'] | 'All' | 'GlobalList';
type ViewMode = 'table' | 'grid';

function statusBadge(status: PendingSupplierSubmission['status']) {
  switch (status) {
    case 'Pending':  return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'Approved': return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Rejected': return 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]';
    case 'Draft':    return 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]';
    case 'Archived': return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}

function GlobalSupplierCard({ gs, status, onClick, onArchive, onUnarchive, menuOpen, onMenuToggle }: {
  gs: GlobalSupplier;
  status: GlobalSupplierStatus;
  onClick: () => void;
  onArchive: () => void;
  onUnarchive?: () => void;
  menuOpen: boolean;
  onMenuToggle: (e: React.MouseEvent) => void;
}) {
  const statusCls = status === 'Approved' ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]'
    : status === 'Pending'  ? 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]'
    : status === 'Rejected' ? 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]'
    : status === 'Draft'    ? 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]'
    : 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  return (
    <div className="bg-white rounded-lg border border-[#E0E0E6] p-4 hover:shadow-md transition-all cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-medium text-[#030213] text-sm leading-tight">{gs.name}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1 text-[10px] text-[#717182]">
            <MapPin className="w-3 h-3" />
            {gs.country}
          </span>
          <div className="relative">
            <button onClick={onMenuToggle} className="p-0.5 rounded hover:bg-[#F0EFF6] transition-colors" title="Actions">
              <MoreVertical className="w-3.5 h-3.5 text-[#A0A0B0]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-5 z-50 bg-white rounded-lg border border-[#E0E0E6] shadow-lg py-1 min-w-[140px]">
                {status === 'Archived' ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnarchive?.(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#717182] hover:bg-[#E8F5E9] hover:text-[#2E7D32] transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Restore (set Approved)
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onArchive(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#717182] hover:bg-[#FFF3E0] hover:text-[#E65100] transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {gs.categories.map(c => (
          <span key={c} className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px]">{c}</span>
        ))}
      </div>
      <div className="pt-2 border-t border-[#F0EFF6] flex items-center justify-between">
        <span className="text-[10px] text-[#A0A0B0]">{gs.taxId ?? '—'}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCls}`}>{status}</span>
      </div>
    </div>
  );
}

function SubmissionCard({ sub, onApprove, onReject, onArchive, menuOpen, onMenuToggle, onClick }: {
  sub: PendingSupplierSubmission;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
  menuOpen: boolean;
  onMenuToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#E0E0E6] p-4 transition-all hover:shadow-md cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-medium text-[#030213] text-sm leading-tight truncate">{sub.name}</p>
          {sub.website && <p className="text-xs text-[#A0A0B0] truncate">{sub.website}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge(sub.status)}`}>
            {sub.status}
          </span>
          {/* 3-dot menu */}
          <div className="relative">
            <button onClick={onMenuToggle} className="p-0.5 rounded hover:bg-[#F0EFF6] transition-colors">
              <MoreVertical className="w-3.5 h-3.5 text-[#A0A0B0]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-5 z-50 bg-white rounded-lg border border-[#E0E0E6] shadow-lg py-1 min-w-[120px]">
                <button
                  onClick={(e) => { e.stopPropagation(); onArchive(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#717182] hover:bg-[#FFF3E0] hover:text-[#E65100] transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3 space-y-1">
        <span className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px]">{sub.category}</span>
      </div>

      {(sub.email || sub.phone) && (
        <div className="text-xs text-[#717182] mb-2">
          {sub.email && <p className="truncate">{sub.email}</p>}
          {sub.phone && <p className="text-[#A0A0B0]">{sub.phone}</p>}
        </div>
      )}

      {sub.notes && (
        <p className="text-[10px] text-[#717182] line-clamp-2 mb-3">{sub.notes}</p>
      )}

      <div className="pt-2 border-t border-[#F0EFF6] flex items-center justify-between">
        <div className="text-[10px] text-[#A0A0B0]">
          <span className="text-[#717182]">{sub.submittedBy}</span>
          <span className="mx-1">·</span>
          {sub.submittedAt}
        </div>
        {sub.status === 'Pending' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#2E7D32] bg-[#E8F5E9] border border-[#A5D6A7] rounded-lg hover:bg-[#C8E6C9] transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#C62828] bg-[#FFEBEE] border border-[#EF9A9A] rounded-lg hover:bg-[#FFCDD2] transition-colors"
            >
              <XCircle className="w-3 h-3" />
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSuppliersContent() {
  const [submissions, setSubmissions] = useState<PendingSupplierSubmission[]>(initialPendingSubmissions);
  const [statusFilter, setStatusFilter] = useState<TabFilter>('GlobalList');
  const [showArchivedGlobal, setShowArchivedGlobal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openGlobalStatusId, setOpenGlobalStatusId] = useState<string | null>(null);
  const [globalStatusPos, setGlobalStatusPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedGlobalSupplier, setSelectedGlobalSupplier] = useState<GlobalSupplier | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<PendingSupplierSubmission | null>(null);
  const [globalStatuses, setGlobalStatuses] = useState<Record<string, GlobalSupplierStatus>>({});
  const [globalEdits, setGlobalEdits] = useState<Record<string, Partial<GlobalSupplier>>>({});
  const [statusConfirm, setStatusConfirm] = useState<{ supplierId: string; supplierName: string; from: GlobalSupplierStatus; to: GlobalSupplierStatus } | null>(null);

  function handleAddSupplier(supplier: GlobalSupplier) {
    const sub: PendingSupplierSubmission = {
      id: `sub_${Date.now()}`,
      name: supplier.name,
      category: supplier.categories[0] ?? '',
      email: '', phone: '', website: '', notes: 'Added by admin',
      submittedBy: 'Super Admin',
      submittedAt: new Date().toISOString().split('T')[0],
      status: 'Approved',
    };
    setSubmissions(prev => [sub, ...prev]);
  }

  function handleDraftSupplier(supplier: GlobalSupplier) {
    const sub: PendingSupplierSubmission = {
      id: `sub_${Date.now()}`,
      name: supplier.name,
      category: supplier.categories[0] ?? '',
      email: '', phone: '', website: '', notes: 'Saved as draft',
      submittedBy: 'Super Admin',
      submittedAt: new Date().toISOString().split('T')[0],
      status: 'Draft',
    };
    setSubmissions(prev => [sub, ...prev]);
  }

  function handleCSVImport(suppliers: GlobalSupplier[]) {
    const subs: PendingSupplierSubmission[] = suppliers.map((s, i) => ({
      id: `sub_csv_${Date.now()}_${i}`,
      name: s.name,
      category: s.categories[0] ?? '',
      email: '', phone: '', website: '', notes: 'Imported via CSV',
      submittedBy: 'Super Admin',
      submittedAt: new Date().toISOString().split('T')[0],
      status: 'Approved',
    }));
    setSubmissions(prev => [...subs, ...prev]);
  }

  const stats = useMemo(() => ({
    total:    submissions.length,
    pending:  submissions.filter(s => s.status === 'Pending').length,
    approved: submissions.filter(s => s.status === 'Approved').length,
    rejected: submissions.filter(s => s.status === 'Rejected').length,
    draft:    submissions.filter(s => s.status === 'Draft').length,
    archived: submissions.filter(s => s.status === 'Archived').length,
  }), [submissions]);

  const filteredGlobal = useMemo(() => {
    if (statusFilter !== 'GlobalList') return [];
    const q = searchQuery.toLowerCase();
    return globalSuppliers.filter(s => {
      const status = globalStatuses[s.id] ?? 'Approved';
      if (status === 'Pending') return false;
      // Archive view shows only archived; otherwise exclude archived
      if (showArchivedGlobal) {
        if (status !== 'Archived') return false;
      } else {
        if (status === 'Archived') return false;
      }
      return !q || s.name.toLowerCase().includes(q) || s.vendorId.toLowerCase().includes(q);
    });
  }, [statusFilter, searchQuery, globalStatuses, showArchivedGlobal]);

  const archivedGlobalCount = useMemo(
    () => globalSuppliers.filter(g => (globalStatuses[g.id] ?? 'Approved') === 'Archived').length,
    [globalStatuses]
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'GlobalList') return [];
    return submissions.filter(s => {
      const matchStatus   = statusFilter === 'All' || s.status === statusFilter;
      const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch   = !q || s.name.toLowerCase().includes(q) || s.submittedBy.toLowerCase().includes(q);
      return matchStatus && matchCategory && matchSearch;
    });
  }, [submissions, statusFilter, categoryFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function approve(id: string) {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'Approved' } : s));
  }
  function reject(id: string) {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'Rejected' } : s));
  }
  function archiveSubmission(id: string) {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'Archived' } : s));
    setOpenMenuId(null);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSelectAll() {
    const pageIds = paginated.map(s => s.id);
    const allSel = pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSel ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  }
  const pageAllSelected = paginated.length > 0 && paginated.every(s => selectedIds.includes(s.id));

  function handlePageChange(page: number) {
    setCurrentPage(page);
    setSelectedIds([]);
  }

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(submissions.map(s => s.category))).sort();
    return [{ value: 'all', label: 'All Categories' }, ...cats.map(c => ({ value: c, label: c }))];
  }, [submissions]);

  const hasActiveFilters = categoryFilter !== 'all';

  function clearFilters() { setCategoryFilter('all'); }

  const selectedPending = selectedIds.filter(id => submissions.find(s => s.id === id)?.status === 'Pending');

  const mergedGS = selectedGlobalSupplier
    ? { ...selectedGlobalSupplier, ...globalEdits[selectedGlobalSupplier.id] }
    : null;

  const confirmModal = statusConfirm ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#FFF3E0] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#E65100]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#030213] text-sm mb-1">Confirm status change</h3>
            <p className="text-xs text-[#717182] leading-relaxed">
              You're changing <span className="font-medium text-[#030213]">{statusConfirm.supplierName}</span> from{' '}
              <span className="font-medium">{statusConfirm.from}</span> to{' '}
              <span className="font-medium">{statusConfirm.to}</span>.
            </p>
          </div>
        </div>

        {statusConfirm.from === 'Approved' && statusConfirm.to !== 'Approved' && (
          <div className="mb-4 p-3 bg-[#F3F3F5] border border-[#E0E0E6] rounded-xl">
            <p className="text-xs text-[#717182] leading-relaxed">
              This supplier will <strong>no longer be visible</strong> in the global registry. Dental groups won't be able to find or add this supplier to their account until the status is set back to <strong>Approved</strong>.
            </p>
          </div>
        )}
        {statusConfirm.to === 'Approved' && statusConfirm.from !== 'Approved' && (
          <div className="mb-4 p-3 bg-[#F3F3F5] border border-[#E0E0E6] rounded-xl">
            <p className="text-xs text-[#717182] leading-relaxed">
              This supplier will become <strong>visible in the global registry</strong>. Dental groups will be able to find and add this supplier to their account.
            </p>
          </div>
        )}
        {statusConfirm.from !== 'Approved' && statusConfirm.to !== 'Approved' && (
          <div className="mb-4 p-3 bg-[#F3F3F5] border border-[#E0E0E6] rounded-xl">
            <p className="text-xs text-[#717182] leading-relaxed">
              This supplier is already not visible in the global registry. The status will be updated to <strong>{statusConfirm.to}</strong>.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStatusConfirm(null)}
            className="flex-1 px-4 py-2.5 border border-[#E0E0E6] text-[#717182] text-sm font-medium rounded-lg hover:bg-[#F8F9FC] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setGlobalStatuses(prev => ({ ...prev, [statusConfirm.supplierId]: statusConfirm.to }));
              if (statusConfirm.to === 'Pending') {
                const gs = [...globalSuppliers, ...Object.keys(globalEdits).map(id => ({ ...globalSuppliers.find(g => g.id === id)!, ...globalEdits[id] }))].find(g => g.id === statusConfirm.supplierId);
                const newSub: PendingSupplierSubmission = {
                  id: `gs_${statusConfirm.supplierId}_${Date.now()}`,
                  name: statusConfirm.supplierName,
                  category: gs?.categories?.[0] ?? '',
                  email: '', phone: '', website: '',
                  notes: 'Moved to pending from global registry by admin.',
                  submittedBy: 'Super Admin',
                  submittedAt: new Date().toISOString().split('T')[0],
                  status: 'Pending',
                };
                setSubmissions(prev => [newSub, ...prev]);
                setStatusFilter('Pending');
                setSelectedGlobalSupplier(null);
              }
              setStatusConfirm(null);
            }}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (selectedGlobalSupplier && mergedGS) {
    return (
      <>
        {confirmModal}
        <AdminGlobalSupplierDetail
          supplier={mergedGS}
          currentStatus={globalStatuses[selectedGlobalSupplier.id] ?? 'Approved'}
          onBack={() => setSelectedGlobalSupplier(null)}
          onStatusChange={(id, newStatus) => {
            const from = globalStatuses[id] ?? 'Approved';
            setStatusConfirm({ supplierId: id, supplierName: mergedGS.name, from, to: newStatus });
          }}
          onSave={(id, updates) => {
            setGlobalEdits(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
            if (updates.name) setSelectedGlobalSupplier(prev => prev ? { ...prev, ...updates } : prev);
          }}
        />
      </>
    );
  }
  if (selectedSubmission) {
    return (
      <AdminSubmissionDetail
        submission={selectedSubmission}
        onBack={() => setSelectedSubmission(null)}
        onStatusChange={(id, status) => {
          setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
          setSelectedSubmission(prev => prev?.id === id ? { ...prev, status } : prev);
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Close menu overlay */}
      {(openMenuId || openGlobalStatusId) && (
        <div className="fixed inset-0 z-[90]" onClick={() => { setOpenMenuId(null); setOpenGlobalStatusId(null); setGlobalStatusPos(null); }} />
      )}

      {/* Global status dropdown — rendered at page level to escape table stacking context */}
      {openGlobalStatusId && globalStatusPos && (
        <div
          className="fixed bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1 min-w-[150px] z-[100]"
          style={{ top: globalStatusPos.top, left: globalStatusPos.left }}
        >
          {(['Approved', 'Pending', 'Rejected', 'Draft', 'Archived'] as GlobalSupplierStatus[]).map(opt => {
            const oCls = opt === 'Approved' ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]'
              : opt === 'Pending'  ? 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]'
              : opt === 'Rejected' ? 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]'
              : opt === 'Draft'    ? 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]'
              : 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
            const current = globalStatuses[openGlobalStatusId] ?? 'Approved';
            const supplierName = filteredGlobal.find(g => g.id === openGlobalStatusId)?.name ?? '';
            return (
              <button
                key={opt}
                onClick={e => {
                  e.stopPropagation();
                  if (current === opt) { setOpenGlobalStatusId(null); setGlobalStatusPos(null); return; }
                  setStatusConfirm({ supplierId: openGlobalStatusId, supplierName, from: current, to: opt });
                  setOpenGlobalStatusId(null);
                  setGlobalStatusPos(null);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#F8F9FC] transition-colors flex items-center justify-between gap-3"
              >
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${oCls}`}>{opt}</span>
                {current === opt && <Check className="w-3 h-3 text-[#4D8EF7]" />}
              </button>
            );
          })}
        </div>
      )}

      {confirmModal}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-1">Supplier Approvals</h1>
          <p className="text-sm text-[#717182]">
            Review submitted suppliers and manage the global registry.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => setCsvModalOpen(true)}
            className="whitespace-nowrap"
          >
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setAddModalOpen(true)}
            className="whitespace-nowrap"
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Section toggle — Global Registry vs Submissions */}
      <div className="flex items-center gap-2 mb-5 p-1 bg-[#F3F3F5] rounded-xl w-fit">
        {([
          { label: 'Global Registry', filter: 'GlobalList' as TabFilter, count: globalSuppliers.filter(g => { const st = globalStatuses[g.id] ?? 'Approved'; return st !== 'Pending' && st !== 'Archived'; }).length, Icon: Globe },
          { label: 'Submissions',     filter: 'All'        as TabFilter, count: stats.total, Icon: Package },
        ]).map(({ label, filter, count, Icon }) => {
          const active = filter === 'GlobalList' ? statusFilter === 'GlobalList' : statusFilter !== 'GlobalList';
          return (
            <button
              key={label}
              onClick={() => { setStatusFilter(filter); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-[#030213] shadow-sm border border-[#E0E0E6]'
                  : 'text-[#717182] hover:text-[#030213]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-[#E8F0FE] text-[#4D8EF7]' : 'bg-[#E8E8EC] text-[#717182]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Submission stat cards — only shown when in submissions view */}
      {statusFilter !== 'GlobalList' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {([
            { label: 'All',      filter: 'All'      as TabFilter, count: stats.total,    activeBorder: 'border-[#717182] ring-2 ring-[#717182]/20', iconBg: 'bg-[#717182]/10', iconColor: 'text-[#717182]', Icon: Package  },
            { label: 'Pending',  filter: 'Pending'  as TabFilter, count: stats.pending,  activeBorder: 'border-[#F57C00] ring-2 ring-[#F57C00]/20', iconBg: 'bg-[#F57C00]/10', iconColor: 'text-[#F57C00]', Icon: Clock    },
            { label: 'Rejected', filter: 'Rejected' as TabFilter, count: stats.rejected, activeBorder: 'border-[#C62828] ring-2 ring-[#C62828]/20', iconBg: 'bg-[#C62828]/10', iconColor: 'text-[#C62828]', Icon: XCircle  },
            { label: 'Draft',    filter: 'Draft'    as TabFilter, count: stats.draft,    activeBorder: 'border-[#1565C0] ring-2 ring-[#1565C0]/20', iconBg: 'bg-[#1565C0]/10', iconColor: 'text-[#1565C0]', Icon: FileText },
            { label: 'Archived', filter: 'Archived' as TabFilter, count: stats.archived, activeBorder: 'border-[#616161] ring-2 ring-[#616161]/20', iconBg: 'bg-[#616161]/10', iconColor: 'text-[#616161]', Icon: Archive  },
          ]).map(({ label, filter, count, activeBorder, iconBg, iconColor, Icon }) => (
            <button
              key={label}
              onClick={() => { setStatusFilter(filter); setCurrentPage(1); }}
              className={`bg-white rounded-lg border p-3 text-left transition-all cursor-pointer hover:shadow-md ${
                statusFilter === filter ? activeBorder : 'border-[#E0E0E6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#717182] mb-1">{label}</div>
                  <div className="text-xl font-semibold text-[#030213]">{count}</div>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm font-medium text-[#1565C0]">
              {selectedIds.length} submission{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {selectedPending.length > 0 && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => { selectedPending.forEach(id => approve(id)); setSelectedIds([]); }}
                  >
                    Approve {selectedPending.length}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<XCircle className="w-4 h-4" />}
                    onClick={() => { selectedPending.forEach(id => reject(id)); setSelectedIds([]); }}
                  >
                    Reject {selectedPending.length}
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search + view toggle + filter */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <SearchInput
            placeholder="Search suppliers, organisations..."
            value={searchQuery}
            onChange={v => { setSearchQuery(v); setCurrentPage(1); }}
          />
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="p-3 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors flex-shrink-0"
            title={viewMode === 'table' ? 'Switch to grid' : 'Switch to table'}
          >
            {viewMode === 'table' ? (
              <Grid3x3 className="w-5 h-5 text-[#717182]" />
            ) : (
              <List className="w-5 h-5 text-[#717182]" />
            )}
          </button>
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className="p-3 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex-shrink-0"
          >
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-sm text-[#717182]">Active Filters:</span>
            {categoryFilter !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                <span>Category: {categoryFilter}</span>
                <button onClick={() => setCategoryFilter('all')} className="hover:text-[#D4183D] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear All</Button>
          </div>
        )}
      </div>

      {/* Content — Global List view */}
      {statusFilter === 'GlobalList' ? (
        viewMode === 'grid' ? (
          <>
            {filteredGlobal.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center py-16 text-[#A0A0B0]">
                <Globe className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No suppliers match your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGlobal.map(gs => (
                  <GlobalSupplierCard
                    key={gs.id}
                    gs={gs}
                    status={globalStatuses[gs.id] ?? 'Approved'}
                    onClick={() => setSelectedGlobalSupplier(gs)}
                    menuOpen={openGlobalStatusId === gs.id}
                    onMenuToggle={(e) => { e.stopPropagation(); setOpenGlobalStatusId(openGlobalStatusId === gs.id ? null : gs.id); setGlobalStatusPos(null); }}
                    onArchive={() => { setGlobalStatuses(prev => ({ ...prev, [gs.id]: 'Archived' })); setOpenGlobalStatusId(null); }}
                    onUnarchive={() => { setGlobalStatuses(prev => ({ ...prev, [gs.id]: 'Approved' })); setOpenGlobalStatusId(null); }}
                  />
                ))}
              </div>
            )}
            {/* Bottom bar — archive toggle */}
            <div className="mt-4 bg-white rounded-lg border border-[#E0E0E6]">
              <div className="px-6 py-3 flex items-center justify-between">
                <button
                  onClick={() => { setShowArchivedGlobal(s => !s); setCurrentPage(1); }}
                  className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    showArchivedGlobal
                      ? 'bg-[#4D8EF7] text-white hover:bg-[#3578E5]'
                      : 'text-[#5A5568] hover:bg-[#F3F3F5] border border-[#E0E0E6]'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  {showArchivedGlobal ? 'Hide Archived' : `View Archived (${archivedGlobalCount})`}
                </button>
                <span className="text-xs text-[#717182]">
                  {filteredGlobal.length} {filteredGlobal.length === 1 ? 'supplier' : 'suppliers'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg border border-[#E0E0E6] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#F0EFF6] bg-[#FAFAFA]">
                  {['SUPPLIER', 'CATEGORIES', 'COUNTRY', 'TAX ID / VAT', 'STATUS', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F9FC]">
                {filteredGlobal.map(gs => (
                  <tr key={gs.id} className="hover:bg-[#F8F9FC] transition-colors cursor-pointer group" onClick={() => setSelectedGlobalSupplier(gs)}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#030213]">{gs.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {gs.categories.map(c => (
                          <span key={c} className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px]">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-[#717182]">
                        <MapPin className="w-3 h-3" />
                        {gs.country}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#A0A0B0]">{gs.taxId ?? '—'}</td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      {(() => {
                        const st = globalStatuses[gs.id] ?? 'Approved';
                        const cls = st === 'Approved' ? 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]'
                          : st === 'Pending'  ? 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]'
                          : st === 'Rejected' ? 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]'
                          : st === 'Draft'    ? 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]'
                          : 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
                        return (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openGlobalStatusId === gs.id) {
                                setOpenGlobalStatusId(null);
                                setGlobalStatusPos(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setGlobalStatusPos({ top: rect.bottom + 4, left: rect.left });
                                setOpenGlobalStatusId(gs.id);
                              }
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 hover:opacity-80 transition-opacity ${cls}`}
                          >
                            {st}
                            <ChevronDown className={`w-2.5 h-2.5 opacity-60 transition-transform ${openGlobalStatusId === gs.id ? 'rotate-180' : ''}`} />
                          </button>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight className="w-4 h-4 text-[#D4CEE1] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredGlobal.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-[#A0A0B0]">
                <Globe className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No suppliers match your search</p>
              </div>
            )}
            {/* Bottom bar — archive toggle (table view) */}
            <div className="border-t border-[#F0EFF6] px-6 py-3 flex items-center justify-between">
              <button
                onClick={() => { setShowArchivedGlobal(s => !s); setCurrentPage(1); }}
                className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  showArchivedGlobal
                    ? 'bg-[#4D8EF7] text-white hover:bg-[#3578E5]'
                    : 'text-[#5A5568] hover:bg-[#F3F3F5] border border-[#E0E0E6]'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchivedGlobal ? 'Hide Archived' : `View Archived (${archivedGlobalCount})`}
              </button>
              <span className="text-xs text-[#717182]">
                {filteredGlobal.length} {filteredGlobal.length === 1 ? 'supplier' : 'suppliers'}
              </span>
            </div>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center py-20 text-[#A0A0B0]">
          <Clock className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium text-[#030213]">No submissions found</p>
          <p className="text-xs mt-1">Manually added suppliers from tenant organisations will appear here</p>
        </div>
      ) : viewMode === 'table' ? (
        <>
          <div className="bg-white rounded-lg border border-[#E0E0E6] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#F0EFF6] bg-[#FAFAFA]">
                  <th className="w-10 py-3 pl-4 pr-2">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                        pageAllSelected ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'
                      }`}
                      onClick={toggleSelectAll}
                    >
                      {pageAllSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </th>
                  {['SUPPLIER', 'CATEGORY', 'CONTACT', 'NOTES', 'SUBMITTED BY', 'DATE', 'STATUS', 'ACTIONS'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider py-3 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F9FC]">
                {paginated.map(s => {
                  return (
                    <tr key={s.id} className="hover:bg-[#F8F9FC] transition-colors group cursor-pointer" onClick={() => setSelectedSubmission(s)}>
                      <td className="py-3 pl-4 pr-2" onClick={e => e.stopPropagation()}>
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                            selectedIds.includes(s.id) ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'
                          }`}
                          onClick={() => toggleSelect(s.id)}
                        >
                          {selectedIds.includes(s.id) && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-[#030213]">{s.name}</p>
                          {s.website && <p className="text-[#A0A0B0] text-[10px]">{s.website}</p>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 bg-[#F0EFF6] text-[#5A5568] rounded text-[10px]">{s.category}</span>
                      </td>
                      <td className="py-3 pr-4 text-[#717182] max-w-[140px]">
                        {s.email && <p className="text-[10px] truncate">{s.email}</p>}
                        {s.phone && <p className="text-[10px] text-[#A0A0B0]">{s.phone}</p>}
                      </td>
                      <td className="py-3 pr-4 text-[#717182] max-w-[160px]">
                        {s.notes
                          ? <p className="text-[10px] line-clamp-2 text-[#717182]">{s.notes}</p>
                          : <span className="text-[#D4CEE1] text-[10px]">—</span>
                        }
                      </td>
                      <td className="py-3 pr-4 text-[#717182]">{s.submittedBy}</td>
                      <td className="py-3 pr-4 text-[#A0A0B0] whitespace-nowrap">{s.submittedAt}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {s.status === 'Pending' ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => approve(s.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-[#2E7D32] bg-[#E8F5E9] border border-[#A5D6A7] rounded-lg hover:bg-[#C8E6C9] transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => reject(s.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-[#C62828] bg-[#FFEBEE] border border-[#EF9A9A] rounded-lg hover:bg-[#FFCDD2] transition-colors"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[#D4CEE1] text-[10px]">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 bg-white rounded-lg border border-[#E0E0E6]">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={items => { setItemsPerPage(items); setCurrentPage(1); }}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(s => (
              <SubmissionCard
                key={s.id}
                sub={s}
                onApprove={() => approve(s.id)}
                onReject={() => reject(s.id)}
                onArchive={() => archiveSubmission(s.id)}
                menuOpen={openMenuId === s.id}
                onMenuToggle={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }}
                onClick={() => setSelectedSubmission(s)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 bg-white rounded-lg border border-[#E0E0E6]">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={items => { setItemsPerPage(items); setCurrentPage(1); }}
              />
            </div>
          )}
        </>
      )}

      {addModalOpen && (
        <AdminAddSupplierModal
          onAdd={s => { handleAddSupplier(s); setAddModalOpen(false); }}
          onDraft={s => { handleDraftSupplier(s); setAddModalOpen(false); }}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {csvModalOpen && (
        <AdminCSVUploadModal
          onImport={s => { handleCSVImport(s); setCsvModalOpen(false); }}
          onClose={() => setCsvModalOpen(false)}
        />
      )}

      {/* Filter drawer */}
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={[
          {
            label: 'Category',
            value: categoryFilter,
            options: categoryOptions,
            onChange: v => { setCategoryFilter(v); setCurrentPage(1); },
          },
        ]}
        onApply={() => setFilterDrawerOpen(false)}
        onReset={() => { clearFilters(); setFilterDrawerOpen(false); }}
      />
    </div>
  );
}
