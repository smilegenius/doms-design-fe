import { useState, useMemo } from 'react';
import { Plus, Grid3x3, List, Filter, Mail, Users, CheckCircle2, AlertTriangle, Clock, Send, X, FileEdit, Archive } from 'lucide-react';
import SortDropdown from '../components/SortDropdown';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import DropdownFilter from '../components/DropdownFilter';
import StaffTable from '../components/StaffTable';
import StaffGrid from '../components/StaffGrid';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { SkeletonGrid, SkeletonTable } from '../components/SkeletonLoader';
import AddStaffModal from '../components/AddStaffModal';
import FilterDrawer from '../components/FilterDrawer';
import { StaffMember, mockStaffMembers, mockPractices } from '../data/clinicsData';

type ViewMode = 'table' | 'grid';

interface StaffManagementPageProps {
  onShowInviteModal: (practices: any[], staff: StaffMember[]) => void;
  onShowStaffDetail: (staff: StaffMember) => void;
}

export default function StaffManagementPage({
  onShowInviteModal,
  onShowStaffDetail,
}: StaffManagementPageProps) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>(mockStaffMembers);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [practiceFilter, setPracticeFilter] = useState('all');
  const [staffTypeFilter, setStaffTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [pageLoading, setPageLoading] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Add Staff Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);

  // New-entry highlight
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  // Filter Drawer
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState('name-asc');
  const staffSortOptions = [
    { value: 'name-asc',   label: 'Name A–Z' },
    { value: 'name-desc',  label: 'Name Z–A' },
    { value: 'status',     label: 'Status' },
    { value: 'staff-type', label: 'Staff Type' },
    { value: 'practice',   label: 'Practice' },
  ];

  // Filter options
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'invited', label: 'Invited' },
  ];

  const practiceOptions = useMemo(() => {
    const practices = Array.from(new Set(staff.map((s) => s.practiceName))).sort();
    return [
      { value: 'all', label: 'All Practices' },
      ...practices.map((practice) => ({ value: practice, label: practice })),
    ];
  }, [staff]);

  const staffTypeOptions = useMemo(() => {
    const types = Array.from(new Set(staff.map((s) => s.staffType))).sort();
    return [
      { value: 'all', label: 'All Staff Types' },
      ...types.map((type) => ({ value: type, label: type })),
    ];
  }, [staff]);

  // Filtered and paginated staff
  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      // Archive view shows only archived; otherwise exclude archived
      if (showArchived) {
        if (member.status !== 'archived') return false;
      } else {
        if (member.status === 'archived') return false;
      }

      const matchesSearch =
        searchQuery === '' ||
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.practiceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.email && member.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = showArchived || statusFilter === 'all' || member.status === statusFilter;
      const matchesPractice = practiceFilter === 'all' || member.practiceName === practiceFilter;
      const matchesStaffType = staffTypeFilter === 'all' || member.staffType === staffTypeFilter;

      return matchesSearch && matchesStatus && matchesPractice && matchesStaffType;
    });
  }, [staff, searchQuery, statusFilter, practiceFilter, staffTypeFilter, showArchived]);

  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':   return a.name.localeCompare(b.name);
        case 'name-desc':  return b.name.localeCompare(a.name);
        case 'status':     return a.status.localeCompare(b.status);
        case 'staff-type': return a.staffType.localeCompare(b.staffType);
        case 'practice':   return a.practiceName.localeCompare(b.practiceName);
        default:           return 0;
      }
    });
  }, [filteredStaff, sortBy]);

  const totalPages = Math.ceil(sortedStaff.length / itemsPerPage);
  const paginatedStaff = sortedStaff.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const stats = useMemo(() => {
    return {
      total: staff.length,
      active: staff.filter((s) => s.status === 'active').length,
      inactive: staff.filter((s) => s.status === 'inactive').length,
      invited: staff.filter((s) => s.status === 'invited').length,
      draft: staff.filter((s) => s.status === 'draft').length,
      archived: staff.filter((s) => s.status === 'archived').length,
    };
  }, [staff]);

  // Manual Add Staff
  const handleAddStaff = (data: {
    practiceId: string;
    name: string;
    staffType: string;
    email?: string;
    phone?: string;
    performerCode?: string;
    performerName?: string;
    employeeId?: string;
    status?: 'active' | 'draft';
  }) => {
    const practice = mockPractices.find((p) => p.id === data.practiceId);
    if (!practice) return;

    const isDraft = data.status === 'draft';

    if (staffToEdit) {
      setStaff((prev) =>
        prev.map((s) =>
          s.id === staffToEdit.id
            ? {
                ...s,
                practiceId: data.practiceId,
                practiceName: practice.name,
                name: data.name,
                staffType: data.staffType,
                email: data.email,
                phone: data.phone,
                performerCode: data.performerCode,
                performerName: data.performerName,
                employeeId: data.employeeId,
                status: isDraft ? 'draft' : 'inactive',
              }
            : s
        )
      );
      toast.success(isDraft ? `${data.name} draft updated` : `${data.name} saved`);
      if (!isDraft) {
        setNewlyAddedId(staffToEdit.id);
        setTimeout(() => setNewlyAddedId(null), 2500);
      }
      setStaffToEdit(null);
      return;
    }

    const newStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      practiceId: data.practiceId,
      practiceName: practice.name,
      name: data.name,
      staffType: data.staffType,
      email: data.email,
      phone: data.phone,
      performerCode: data.performerCode,
      performerName: data.performerName,
      employeeId: data.employeeId,
      status: isDraft ? 'draft' : 'inactive',
    };

    setStaff([...staff, newStaff]);
    toast.success(isDraft ? `${data.name} saved as draft` : `${data.name} added successfully`);
    if (!isDraft) {
      setNewlyAddedId(newStaff.id);
      setTimeout(() => setNewlyAddedId(null), 2500);
    }
  };

  const handleContinueEditingStaff = (member: StaffMember) => {
    setStaffToEdit(member);
    setAddModalOpen(true);
  };

  const handleArchiveStaff = (member: StaffMember) => {
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: 'archived' as const } : s));
    toast.success(`${member.name} archived`);
  };

  // Invite Handlers
  const handleInviteStaff = (member: StaffMember) => {
    onShowInviteModal([], [member]);
  };

  const handleBulkInvite = () => {
    const selectedStaff = staff.filter((s) => selectedIds.includes(s.id));
    const pendingStaff = selectedStaff.filter(
      (s) => s.status === 'inactive' || s.status === 'pending-invite' || s.status === 'invited'
    );

    if (pendingStaff.length > 0) {
      onShowInviteModal([], pendingStaff);
      setSelectedIds([]);
    }
  };

  // Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedStaff.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedStaff.map((s) => s.id));
    }
  };

  const pageAllSelected = paginatedStaff.length > 0 && paginatedStaff.every(s => selectedIds.includes(s.id));

  const handleEdit = (member: StaffMember) => {
    onShowStaffDetail(member);
  };

  const handleMessage = (member: StaffMember) => {
    console.log('Message staff:', member);
  };

  const handlePageChange = (page: number) => {
    setPageLoading(true);
    setTimeout(() => {
      setCurrentPage(page);
      setPageLoading(false);
    }, 300);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPracticeFilter('all');
    setStaffTypeFilter('all');
  };

  const selectedStaffForBulk = staff.filter((s) =>
    selectedIds.includes(s.id) && (s.status === 'inactive' || s.status === 'pending-invite' || s.status === 'invited')
  );

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Staff Management</h1>
            <p className="text-sm sm:text-base text-[#717182]">
              Manage staff members, send invitations, and track onboarding status
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              variant="primary"
              icon={<Plus className="w-5 h-5" />}
              onClick={() => setAddModalOpen(true)}
              className="whitespace-nowrap"
            >
              Add Staff Member
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${stats.draft > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-6`}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md relative ${
              statusFilter === 'all' ? 'border-transparent' : 'border-[#E0E0E6]'
            }`}
            style={statusFilter === 'all' ? {
              background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #4D8EF7, #A59DFF) border-box',
              border: '2px solid transparent'
            } : {}}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-xs text-[#717182] mb-1">Total Staff</div>
                <div className="text-xl font-semibold text-[#030213]">{stats.total}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#4D8EF7]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#4D8EF7]" />
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
              statusFilter === 'active' ? 'border-[#2E7D32] ring-2 ring-[#2E7D32]/20' : 'border-[#E0E0E6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-xs text-[#717182] mb-1">Active</div>
                <div className="text-xl font-semibold text-[#030213]">{stats.active}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#2E7D32]/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
              statusFilter === 'inactive' ? 'border-[#E65100] ring-2 ring-[#E65100]/20' : 'border-[#E0E0E6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-xs text-[#717182] mb-1">Inactive</div>
                <div className="text-xl font-semibold text-[#030213]">{stats.inactive}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#E65100]/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#E65100]" />
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter('invited')}
            className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
              statusFilter === 'invited' ? 'border-[#1565C0] ring-2 ring-[#1565C0]/20' : 'border-[#E0E0E6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-xs text-[#717182] mb-1">Invited</div>
                <div className="text-xl font-semibold text-[#030213]">{stats.invited}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#1565C0]/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#1565C0]" />
              </div>
            </div>
          </button>
          {stats.draft > 0 && (
            <button
              onClick={() => setStatusFilter('draft')}
              className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
                statusFilter === 'draft' ? 'border-[#717182] ring-2 ring-[#717182]/20' : 'border-[#E0E0E6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-xs text-[#717182] mb-1">Drafts</div>
                  <div className="text-xl font-semibold text-[#030213]">{stats.draft}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#717182]/10 flex items-center justify-center">
                  <FileEdit className="w-5 h-5 text-[#717182]" />
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[#1565C0]">
                  {selectedIds.length} staff member{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedStaffForBulk.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Mail className="w-4 h-4" />}
                    onClick={handleBulkInvite}
                    className="whitespace-nowrap"
                  >
                    Invite {selectedStaffForBulk.length} Member{selectedStaffForBulk.length !== 1 ? 's' : ''}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  className="whitespace-nowrap"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search by name, practice, or email..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <SortDropdown options={staffSortOptions} value={sortBy} onChange={v => { setSortBy(v); setCurrentPage(1); }} />
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
              className="p-3 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors flex-shrink-0"
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

          {/* Active Filters */}
          {(practiceFilter !== 'all' || staffTypeFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-sm text-[#717182]">Active Filters:</span>
              {practiceFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Practice: {practiceOptions.find(o => o.value === practiceFilter)?.label}</span>
                  <button
                    onClick={() => setPracticeFilter('all')}
                    className="hover:text-[#D4183D] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {staffTypeFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Type: {staffTypeOptions.find(o => o.value === staffTypeFilter)?.label}</span>
                  <button
                    onClick={() => setStaffTypeFilter('all')}
                    className="hover:text-[#D4183D] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingState />
        ) : filteredStaff.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#E0E0E6]">
            <EmptyState
              type={searchQuery || practiceFilter !== 'all' || staffTypeFilter !== 'all' ? 'no-results' : 'no-clinics'}
              onAction={clearFilters}
            />
          </div>
        ) : (
          <>
            {pageLoading ? (
              viewMode === 'table' ? (
                <SkeletonTable rows={itemsPerPage} />
              ) : (
                <SkeletonGrid count={itemsPerPage} />
              )
            ) : (
              <>
                {viewMode === 'table' ? (
                  <StaffTable
                    staff={paginatedStaff}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onEdit={handleEdit}
                    onInvite={handleInviteStaff}
                    onMessage={handleMessage}
                    onArchive={handleArchiveStaff}
                    onContinueEditing={handleContinueEditingStaff}
                  />
                ) : (
                  <StaffGrid
                    staff={paginatedStaff}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    pageAllSelected={pageAllSelected}
                    onEdit={handleEdit}
                    onInvite={handleInviteStaff}
                    onMessage={handleMessage}
                    onArchive={handleArchiveStaff}
                    onContinueEditing={handleContinueEditingStaff}
                    newlyAddedId={newlyAddedId}
                  />
                )}
              </>
            )}

            <div className="mt-6 bg-white rounded-lg border border-[#E0E0E6]">
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
                  {filteredStaff.length} {filteredStaff.length === 1 ? 'member' : 'members'}
                </span>
              </div>
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredStaff.length}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={(items) => {
                    setPageLoading(true);
                    setItemsPerPage(items);
                    setCurrentPage(1);
                    setTimeout(() => setPageLoading(false), 300);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <AddStaffModal
        isOpen={addModalOpen}
        onClose={() => { setAddModalOpen(false); setStaffToEdit(null); }}
        practices={mockPractices}
        mode={staffToEdit ? 'edit' : 'add'}
        initialData={
          staffToEdit
            ? {
                practiceId: staffToEdit.practiceId,
                name: staffToEdit.name,
                staffType: staffToEdit.staffType,
                email: staffToEdit.email,
                phone: staffToEdit.phone,
                performerCode: staffToEdit.performerCode,
                performerName: staffToEdit.performerName,
                employeeId: staffToEdit.employeeId,
              }
            : undefined
        }
        onSubmit={handleAddStaff}
      />

      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={[
          {
            label: 'Practice',
            value: practiceFilter,
            options: practiceOptions,
            onChange: setPracticeFilter,
          },
          {
            label: 'Staff Type',
            value: staffTypeFilter,
            options: staffTypeOptions,
            onChange: setStaffTypeFilter,
          },
        ]}
        onApply={() => setFilterDrawerOpen(false)}
        onReset={clearFilters}
      />
    </>
  );
}
