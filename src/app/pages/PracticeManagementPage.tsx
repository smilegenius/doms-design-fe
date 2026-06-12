import { useState, useMemo } from 'react';
import { Plus, Upload, Grid3x3, List, Filter, Mail, Building2, CheckCircle2, AlertTriangle, Clock, Send, X, FileEdit, Archive } from 'lucide-react';
import SortDropdown from '../components/SortDropdown';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import DropdownFilter from '../components/DropdownFilter';
import PracticesTable from '../components/ClinicsTable';
import PracticesGrid from '../components/ClinicsGrid';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { SkeletonGrid, SkeletonTable } from '../components/SkeletonLoader';
import CSVUploadModal from '../components/CSVUploadModal';
import CSVValidationModal from '../components/CSVValidationModal';
import ImportSuccessModal from '../components/ImportSuccessModal';
import InvitePracticeModal from '../components/InvitePracticeModal';
import BulkInviteModal from '../components/BulkInviteModal';
import AddPracticeModal from '../components/AddPracticeModal';
import InviteClinicPage from '../components/InviteClinicPage';
import FilterDrawer from '../components/FilterDrawer';
import { Practice, mockPractices, Manager, Dentist, Staff } from '../data/clinicsData';

type ViewMode = 'table' | 'grid';

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

interface PracticeManagementPageProps {
  onShowInviteModal: (practices: Practice[], staff?: any[]) => void;
  onShowPracticeDetail: (practice: Practice) => void;
}

export default function PracticeManagementPage({
  onShowInviteModal,
  onShowPracticeDetail,
}: PracticeManagementPageProps) {
  const { toast } = useToast();
  const [practices, setPractices] = useState<Practice[]>(mockPractices);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [cityFilter, setCityFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [pageLoading, setPageLoading] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // CSV Import States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validRowCount, setValidRowCount] = useState(0);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [pendingImportData, setPendingImportData] = useState<Practice[]>([]);

  // Invite States
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [bulkInviteModalOpen, setBulkInviteModalOpen] = useState(false);
  const [selectedPracticeForInvite, setSelectedPracticeForInvite] = useState<Practice | null>(null);
  const [practicesForInvite, setPracticesForInvite] = useState<Practice[]>([]);

  // Add Practice Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [practiceToEdit, setPracticeToEdit] = useState<Practice | null>(null);

  // New-entry highlight
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  // Invite Page
  const [showInvitePage, setShowInvitePage] = useState(false);

  // Filter Drawer
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState('name-asc');
  const practiceSortOptions = [
    { value: 'name-asc',  label: 'Name A–Z' },
    { value: 'name-desc', label: 'Name Z–A' },
    { value: 'status',    label: 'Status' },
    { value: 'city',      label: 'City' },
  ];

  // Filter options
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'invited', label: 'Invited' },
  ];

  const cityOptions = useMemo(() => {
    const cities = Array.from(new Set(practices.filter(p => p.city).map((c) => c.city!))).sort();
    return [
      { value: 'all', label: 'All Cities' },
      ...cities.map((city) => ({ value: city, label: city })),
    ];
  }, [practices]);

  const countryOptions = useMemo(() => {
    const countries = Array.from(new Set(practices.filter(p => p.country).map((c) => c.country!))).sort();
    return [
      { value: 'all', label: 'All Countries' },
      ...countries.map((country) => ({ value: country, label: country })),
    ];
  }, [practices]);

  // Filtered and paginated practices
  const filteredPractices = useMemo(() => {
    return practices.filter((practice) => {
      // Archive view shows ONLY archived; otherwise exclude archived from main view
      if (showArchived) {
        if (practice.status !== 'archived') return false;
      } else {
        if (practice.status === 'archived') return false;
      }

      const matchesSearch =
        searchQuery === '' ||
        practice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        practice.practiceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        practice.managers.some((m) => m.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = showArchived || statusFilter === 'all' || practice.status === statusFilter;
      const matchesCity = cityFilter === 'all' || practice.city === cityFilter;
      const matchesCountry = countryFilter === 'all' || practice.country === countryFilter;

      return matchesSearch && matchesStatus && matchesCity && matchesCountry;
    });
  }, [practices, searchQuery, statusFilter, cityFilter, countryFilter, showArchived]);

  const sortedPractices = useMemo(() => {
    return [...filteredPractices].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':  return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'status':    return a.status.localeCompare(b.status);
        case 'city':      return (a.city ?? '').localeCompare(b.city ?? '');
        default:          return 0;
      }
    });
  }, [filteredPractices, sortBy]);

  const totalPages = Math.ceil(sortedPractices.length / itemsPerPage);
  const paginatedPractices = sortedPractices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const stats = useMemo(() => {
    return {
      total: practices.length,
      active: practices.filter((p) => p.status === 'active').length,
      inactive: practices.filter((p) => p.status === 'inactive').length,
      invited: practices.filter((p) => p.status === 'invited').length,
      draft: practices.filter((p) => p.status === 'draft').length,
      archived: practices.filter((p) => p.status === 'archived').length,
    };
  }, [practices]);

  // CSV Import Handlers
  const handleFileUpload = (file: File) => {
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').filter((row) => row.trim());
      const headers = rows[0].split(',').map(h => h.trim());

      const errors: ValidationError[] = [];
      const validData: Practice[] = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        const rowData: any = {};

        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Validation
        let hasError = false;

        // Required: Practice Name
        if (!rowData['Practice Name']) {
          errors.push({
            row: i + 1,
            field: 'Practice Name',
            message: 'Required field is missing',
            value: rowData['Practice Name'],
          });
          hasError = true;
        }

        // Required: Practice Code
        if (!rowData['Practice Code']) {
          errors.push({
            row: i + 1,
            field: 'Practice Code',
            message: 'Required field is missing',
            value: rowData['Practice Code'],
          });
          hasError = true;
        }

        // Check for duplicate practice code
        const duplicateCode = practices.some(p => p.practiceCode === rowData['Practice Code']);
        if (duplicateCode) {
          errors.push({
            row: i + 1,
            field: 'Practice Code',
            message: 'Practice code already exists',
            value: rowData['Practice Code'],
          });
          hasError = true;
        }

        // Required: Manager
        if (!rowData['Manager Name'] || !rowData['Manager Email']) {
          errors.push({
            row: i + 1,
            field: 'Practice Manager',
            message: 'At least one manager with name and email is required',
            value: '',
          });
          hasError = true;
        }

        // Validate Manager Email
        if (rowData['Manager Email'] && !rowData['Manager Email'].match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          errors.push({
            row: i + 1,
            field: 'Manager Email',
            message: 'Invalid email format',
            value: rowData['Manager Email'],
          });
          hasError = true;
        }

        // Required: At least one dentist
        if (!rowData['Dentist 1 Name'] || !rowData['Dentist 1 Email']) {
          errors.push({
            row: i + 1,
            field: 'Dentist',
            message: 'At least one dentist with name and email is required',
            value: '',
          });
          hasError = true;
        }

        // Validate Dentist Emails
        for (let d = 1; d <= 10; d++) {
          const email = rowData[`Dentist ${d} Email`];
          if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            errors.push({
              row: i + 1,
              field: `Dentist ${d} Email`,
              message: 'Invalid email format',
              value: email,
            });
            hasError = true;
          }
        }

        if (!hasError) {
          // Parse managers
          const managers: Manager[] = [];
          if (rowData['Manager Name'] && rowData['Manager Email']) {
            managers.push({
              name: rowData['Manager Name'],
              email: rowData['Manager Email'],
              phone: rowData['Manager Phone'],
            });
          }

          // Parse dentists
          const dentists: Dentist[] = [];
          for (let d = 1; d <= 10; d++) {
            const name = rowData[`Dentist ${d} Name`];
            const email = rowData[`Dentist ${d} Email`];
            if (name && email) {
              dentists.push({
                name,
                email,
                phone: rowData[`Dentist ${d} Phone`],
                performerCode: rowData[`Dentist ${d} Performer Code`],
              });
            }
          }

          // Parse staff
          const staff: Staff[] = [];
          for (let s = 1; s <= 10; s++) {
            const name = rowData[`Staff ${s} Name`];
            const email = rowData[`Staff ${s} Email`];
            if (name && email) {
              staff.push({
                name,
                email,
                phone: rowData[`Staff ${s} Phone`],
              });
            }
          }

          validData.push({
            id: `imported-${Date.now()}-${i}`,
            name: rowData['Practice Name'],
            practiceCode: rowData['Practice Code'],
            address: rowData['Address'],
            city: rowData['City'],
            country: rowData['Country'] || 'United Kingdom',
            status: 'inactive',
            managers,
            dentists,
            staff: staff.length > 0 ? staff : undefined,
          });
        }
      }

      setValidationErrors(errors);
      setValidRowCount(validData.length);
      setTotalRowCount(rows.length - 1);
      setPendingImportData(validData);
      setUploadModalOpen(false);
      setValidationModalOpen(true);
    };

    reader.readAsText(file);
  };

  const handleProceedImport = () => {
    setPractices([...practices, ...pendingImportData]);
    setValidationModalOpen(false);
    setSuccessModalOpen(true);
    toast.success(`${pendingImportData.length} practice${pendingImportData.length !== 1 ? 's' : ''} imported successfully`);
  };

  // Manual Add Practice
  const handleAddPractice = (data: {
    name: string;
    practiceCode?: string;
    address?: string;
    postcode?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
    managers: Manager[];
    dentists: Dentist[];
    staff?: Staff[];
    status?: 'active' | 'draft';
  }) => {
    const isDraft = data.status === 'draft';

    if (practiceToEdit) {
      setPractices((prev) =>
        prev.map((p) =>
          p.id === practiceToEdit.id
            ? {
                ...p,
                name: data.name,
                practiceCode: data.practiceCode,
                address: data.address,
                postcode: data.postcode,
                city: data.city,
                country: data.country || 'United Kingdom',
                email: data.email,
                phone: data.phone,
                status: isDraft ? 'draft' : 'inactive',
                managers: data.managers.length ? data.managers : p.managers,
                dentists: data.dentists.length ? data.dentists : p.dentists,
                staff: data.staff?.length ? data.staff : p.staff,
              }
            : p
        )
      );
      toast.success(isDraft ? `${data.name} draft updated` : `${data.name} saved`);
      if (!isDraft) {
        setNewlyAddedId(practiceToEdit.id);
        setTimeout(() => setNewlyAddedId(null), 2500);
      }
      setPracticeToEdit(null);
      return;
    }

    const newPractice: Practice = {
      id: `practice-${Date.now()}`,
      name: data.name,
      practiceCode: data.practiceCode,
      address: data.address,
      postcode: data.postcode,
      city: data.city,
      country: data.country || 'United Kingdom',
      email: data.email,
      phone: data.phone,
      status: isDraft ? 'draft' : 'inactive',
      managers: data.managers,
      dentists: data.dentists,
      staff: data.staff,
    };

    setPractices([...practices, newPractice]);
    toast.success(isDraft ? `${data.name} saved as draft` : `${data.name} added successfully`);
    if (!isDraft) {
      setNewlyAddedId(newPractice.id);
      setTimeout(() => setNewlyAddedId(null), 2500);
    }
  };

  const handleContinueEditingPractice = (practice: Practice) => {
    setPracticeToEdit(practice);
    setAddModalOpen(true);
  };

  const handleArchivePractice = (practice: Practice) => {
    setPractices(prev => prev.map(p => p.id === practice.id ? { ...p, status: 'archived' as const } : p));
    toast.success(`${practice.name} archived`);
  };

  // Invite Handlers
  const handleInvitePractice = (practice: Practice) => {
    onShowInviteModal([practice]);
  };

  const handleSendInvite = (practiceId: string) => {
    setPractices(
      practices.map((p) =>
        p.id === practiceId
          ? { ...p, status: 'invited' as const, invitedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleBulkInvite = () => {
    const selectedPractices = practices.filter((p) => selectedIds.includes(p.id));
    const pendingPractices = selectedPractices.filter(
      (p) => p.status === 'inactive' || p.status === 'pending-invite' || p.status === 'invited'
    );

    if (pendingPractices.length > 0) {
      onShowInviteModal(pendingPractices);
    }
  };

  const handleSendBulkInvites = (practiceIds: string[]) => {
    setPractices(
      practices.map((p) =>
        practiceIds.includes(p.id)
          ? { ...p, status: 'invited' as const, invitedAt: new Date().toISOString() }
          : p
      )
    );
    setSelectedIds([]);
    toast.success(`Invitations sent to ${practiceIds.length} practice${practiceIds.length !== 1 ? 's' : ''}`);
  };

  const handleInvitePageSend = (data: {
    recipients: any[];
    practiceCode: string;
    subject: string;
    body: string;
    cc?: string;
  }) => {
    // Update all practices that were invited
    const practiceIds = practicesForInvite.map((p) => p.id);
    setPractices(
      practices.map((p) =>
        practiceIds.includes(p.id)
          ? { ...p, status: 'invited' as const, invitedAt: new Date().toISOString() }
          : p
      )
    );
    setSelectedIds([]);
    setPracticesForInvite([]);
    setShowInvitePage(false);
  };

  // Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === paginatedPractices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedPractices.map((p) => p.id));
    }
  };

  const pageAllSelected = paginatedPractices.length > 0 && paginatedPractices.every(p => selectedIds.includes(p.id));

  const handleEdit = (practice: Practice) => {
    onShowPracticeDetail(practice);
  };

  const handlePageChange = (page: number) => {
    setPageLoading(true);
    setTimeout(() => {
      setCurrentPage(page);
      setPageLoading(false);
    }, 300);
  };

  const handleMessage = (practice: Practice) => {
    console.log('Message practice:', practice);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
    setCountryFilter('all');
  };

  const selectedPracticesForBulk = practices.filter((p) =>
    selectedIds.includes(p.id) && (p.status === 'inactive' || p.status === 'pending-invite' || p.status === 'invited')
  );

  if (showInvitePage) {
    return (
      <InviteClinicPage
        practices={practicesForInvite}
        onClose={() => {
          setShowInvitePage(false);
          setPracticesForInvite([]);
        }}
        onSendInvite={handleInvitePageSend}
      />
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Practice Management</h1>
            <p className="text-sm sm:text-base text-[#717182]">
              Manage practices, send invitations, and track onboarding status
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              variant="outline"
              icon={<Upload className="w-5 h-5" />}
              onClick={() => setUploadModalOpen(true)}
              className="whitespace-nowrap"
            >
              Import CSV
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-5 h-5" />}
              onClick={() => setAddModalOpen(true)}
              className="whitespace-nowrap"
            >
              Add Practice
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
                <div className="text-xs text-[#717182] mb-1">Total Practices</div>
                <div className="text-xl font-semibold text-[#030213]">{stats.total}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#4D8EF7]/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#4D8EF7]" />
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
                  {selectedIds.length} practice{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedPracticesForBulk.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Mail className="w-4 h-4" />}
                    onClick={handleBulkInvite}
                    className="whitespace-nowrap"
                  >
                    Invite {selectedPracticesForBulk.length} Practice{selectedPracticesForBulk.length !== 1 ? 's' : ''}
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
              placeholder="Search by name, code, or email..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <SortDropdown options={practiceSortOptions} value={sortBy} onChange={v => { setSortBy(v); setCurrentPage(1); }} />
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
          {(cityFilter !== 'all' || countryFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-sm text-[#717182]">Active Filters:</span>
              {cityFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>City: {cityOptions.find(o => o.value === cityFilter)?.label}</span>
                  <button
                    onClick={() => setCityFilter('all')}
                    className="hover:text-[#D4183D] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {countryFilter !== 'all' && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                  <span>Country: {countryOptions.find(o => o.value === countryFilter)?.label}</span>
                  <button
                    onClick={() => setCountryFilter('all')}
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
        ) : filteredPractices.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#E0E0E6]">
            <EmptyState
              type={searchQuery || cityFilter !== 'all' || countryFilter !== 'all' ? 'no-results' : 'no-clinics'}
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
                  <PracticesTable
                    practices={paginatedPractices}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onEdit={handleEdit}
                    onInvite={handleInvitePractice}
                    onMessage={handleMessage}
                    onArchive={handleArchivePractice}
                  />
                ) : (
                  <PracticesGrid
                    practices={paginatedPractices}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    pageAllSelected={pageAllSelected}
                    onEdit={handleEdit}
                    onInvite={handleInvitePractice}
                    onMessage={handleMessage}
                    onArchive={handleArchivePractice}
                    onContinueEditing={handleContinueEditingPractice}
                    newlyAddedId={newlyAddedId}
                  />
                )}
              </>
            )}

            {/* Bottom bar — archive toggle + pagination */}
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
                  {filteredPractices.length} {filteredPractices.length === 1 ? 'practice' : 'practices'}
                </span>
              </div>
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredPractices.length}
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
      <CSVUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleFileUpload}
      />

      <CSVValidationModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        onProceed={handleProceedImport}
        validRows={validRowCount}
        totalRows={totalRowCount}
        errors={validationErrors}
        fileName={uploadedFileName}
      />

      <ImportSuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        importedCount={validRowCount}
      />

      <InvitePracticeModal
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setSelectedPracticeForInvite(null);
        }}
        practice={selectedPracticeForInvite}
        onSendInvite={handleSendInvite}
      />

      <BulkInviteModal
        isOpen={bulkInviteModalOpen}
        onClose={() => setBulkInviteModalOpen(false)}
        practices={selectedPracticesForBulk}
        onSendBulkInvites={handleSendBulkInvites}
      />

      <AddPracticeModal
        isOpen={addModalOpen}
        onClose={() => { setAddModalOpen(false); setPracticeToEdit(null); }}
        initialData={practiceToEdit ?? undefined}
        onSubmit={handleAddPractice}
      />

      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={[
          {
            label: 'City',
            value: cityFilter,
            options: cityOptions,
            onChange: setCityFilter,
          },
          {
            label: 'Country',
            value: countryFilter,
            options: countryOptions,
            onChange: setCountryFilter,
          },
        ]}
        onApply={() => setFilterDrawerOpen(false)}
        onReset={clearFilters}
      />
    </>
  );
}
