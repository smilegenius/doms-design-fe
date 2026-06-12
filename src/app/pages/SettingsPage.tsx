import { useState, useMemo } from 'react';
import {
  User,
  Building2,
  Users,
  Bell,
  Pencil,
  Plus,
  Mail,
  CheckCircle2,
  Circle,
  Send,
  AlertTriangle,
  Grid3x3,
  List,
  Filter,
  Archive,
  X,
  MoreVertical,
} from 'lucide-react';
import InviteUsersModal, { InviteUserRow } from '../components/InviteUsersModal';
import { useToast } from '../context/ToastContext';
import SearchInput from '../components/SearchInput';
import SortDropdown from '../components/SortDropdown';
import FilterDrawer from '../components/FilterDrawer';
import Pagination from '../components/Pagination';
import Button from '../components/Button';

type TabId = 'personal' | 'dso' | 'users' | 'notifications';

const TABS: { id: TabId; label: string; description: string; icon: any }[] = [
  { id: 'personal',      label: 'Personal Info',   description: 'Your account profile',  icon: User },
  { id: 'dso',           label: 'DSO Info',        description: 'Organization details',  icon: Building2 },
  { id: 'users',         label: 'User Management', description: 'Team members & roles',  icon: Users },
  { id: 'notifications', label: 'Notifications',   description: 'Email & system alerts', icon: Bell },
];

// Mock configured-tabs set — wire to real persistence later
const CONFIGURED: Set<TabId> = new Set(['personal', 'dso']);

interface Member {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'invited';
}

const mockMembers: Member[] = [
  { id: '1', name: 'Riverdale Admin',  email: 'super_admin_riverdale_dev@yopmail.com', employeeId: '—',     role: 'Super Admin',    department: 'Finance Team',   status: 'active' },
  { id: '2', name: 'Sajid Mahmood',    email: 'sajid@smilegenius.com',                 employeeId: 'EMP-002', role: 'Admin',          department: 'Operations',     status: 'active' },
  { id: '3', name: 'Sophie Wilson',    email: 'sophie@smilegenius.com',                employeeId: 'EMP-005', role: 'Practice Manager', department: 'Clinical',      status: 'active' },
  { id: '4', name: 'Dr. Murphy',       email: 'murphy@smilegenius.com',                employeeId: 'EMP-011', role: 'Dentist',        department: 'Clinical',       status: 'invited' },
];

const orderStatuses = ['New Order', 'In Production', 'Quality Check', 'Shipped', 'Delivered', 'Refinement', 'On Hold'];
const paymentStatuses = ['Awaiting Settlement', 'Settled', 'Failed', 'Refund Issued'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-[#F8F9FC] border-b border-[#F0EFF6]">
        <h3 className="text-sm font-semibold text-[#030213]">{title}</h3>
        {actions}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, value, fallback = '—' }: { label: string; value?: React.ReactNode; fallback?: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[#717182] uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-[#030213] font-medium">{value ?? <span className="text-[#A0A0B0]">{fallback}</span>}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        on ? 'bg-[#4D8EF7]' : 'bg-[#D4CEE1]'
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function StatusPill({ status }: { status: Member['status'] }) {
  const map = {
    active:   { label: 'Active',   cls: 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]' },
    inactive: { label: 'Inactive', cls: 'bg-[#FFF7ED] text-[#E65100] border-[#FED7AA]' },
    invited:  { label: 'Invited',  cls: 'bg-[#EEF4FF] text-[#1565C0] border-[#DBEAFE]' },
  };
  const v = map[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${v.cls}`}>
      {v.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const { toast } = useToast();

  // Notification toggles
  const [orderNotif, setOrderNotif] = useState<Record<string, { email: boolean; system: boolean }>>(
    Object.fromEntries(orderStatuses.map((s, i) => [s, { email: i % 2 === 0, system: true }]))
  );
  const [paymentNotif, setPaymentNotif] = useState<Record<string, { email: boolean; system: boolean }>>(
    Object.fromEntries(paymentStatuses.map((s) => [s, { email: false, system: true }]))
  );

  // Team members — seeded from the mock list, appended on invite.
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // ── User Management page-state — mirrors the Staff page experience ──
  const [userViewMode, setUserViewMode] = useState<'grid' | 'table'>('grid');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | Member['status']>('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userDeptFilter, setUserDeptFilter] = useState('all');
  const [userSort, setUserSort] = useState<'name-asc' | 'name-desc' | 'status' | 'role' | 'department'>('name-asc');
  const [userPage, setUserPage] = useState(1);
  const [userItemsPerPage, setUserItemsPerPage] = useState(20);
  const [userFilterDrawerOpen, setUserFilterDrawerOpen] = useState(false);
  const [userSelectedIds, setUserSelectedIds] = useState<string[]>([]);

  const userSortOptions = [
    { value: 'name-asc',   label: 'Name A–Z' },
    { value: 'name-desc',  label: 'Name Z–A' },
    { value: 'status',     label: 'Status' },
    { value: 'role',       label: 'Role' },
    { value: 'department', label: 'Department' },
  ];

  const userRoleOptions = useMemo(() => {
    const roles = Array.from(new Set(members.map((m) => m.role))).sort();
    return [{ value: 'all', label: 'All Roles' }, ...roles.map((r) => ({ value: r, label: r }))];
  }, [members]);

  const userDeptOptions = useMemo(() => {
    const depts = Array.from(new Set(members.map((m) => m.department))).sort();
    return [{ value: 'all', label: 'All Departments' }, ...depts.map((d) => ({ value: d, label: d }))];
  }, [members]);

  const filteredMembers = useMemo(() => members.filter((m) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q);
    const matchesStatus = userStatusFilter === 'all' || m.status === userStatusFilter;
    const matchesRole = userRoleFilter === 'all' || m.role === userRoleFilter;
    const matchesDept = userDeptFilter === 'all' || m.department === userDeptFilter;
    return matchesSearch && matchesStatus && matchesRole && matchesDept;
  }), [members, userSearch, userStatusFilter, userRoleFilter, userDeptFilter]);

  const sortedMembers = useMemo(() => {
    const next = [...filteredMembers];
    switch (userSort) {
      case 'name-asc':   next.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc':  next.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'status':     next.sort((a, b) => a.status.localeCompare(b.status)); break;
      case 'role':       next.sort((a, b) => a.role.localeCompare(b.role)); break;
      case 'department': next.sort((a, b) => a.department.localeCompare(b.department)); break;
    }
    return next;
  }, [filteredMembers, userSort]);

  const userTotalPages = Math.max(1, Math.ceil(sortedMembers.length / userItemsPerPage));
  const paginatedMembers = sortedMembers.slice((userPage - 1) * userItemsPerPage, userPage * userItemsPerPage);

  const memberStats = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    invited: members.filter((m) => m.status === 'invited').length,
    inactive: members.filter((m) => m.status === 'inactive').length,
  }), [members]);

  function toggleUserSelect(id: string) {
    setUserSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }
  function toggleUserSelectAll() {
    if (userSelectedIds.length === paginatedMembers.length) setUserSelectedIds([]);
    else setUserSelectedIds(paginatedMembers.map((m) => m.id));
  }
  const userPageAllSelected = paginatedMembers.length > 0 && paginatedMembers.every((m) => userSelectedIds.includes(m.id));

  function clearUserFilters() {
    setUserSearch('');
    setUserStatusFilter('all');
    setUserRoleFilter('all');
    setUserDeptFilter('all');
    setUserPage(1);
  }

  function handleInviteConfirm(rows: InviteUserRow[]) {
    // Append the newly invited users to the table with an Invited status.
    setMembers((prev) => [
      ...prev,
      ...rows.map((r) => ({
        id: r.id,
        name: r.name.trim() || r.email,
        email: r.email.trim(),
        employeeId: r.employeeId.trim() || '—',
        role: r.role,
        department: r.department,
        status: 'invited' as const,
      })),
    ]);
    setInviteModalOpen(false);
    toast.success(`Sent ${rows.length} ${rows.length === 1 ? 'invitation' : 'invitations'}`);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-2">Settings</h1>
        <p className="text-sm sm:text-base text-[#717182]">
          Manage your account, organization, team, and preferences
        </p>
      </div>

      {/* Two-column layout: vertical menu left, detail right */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Vertical menu — matches Spend Settings */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="bg-white border border-[#E0E0E6] rounded-xl p-2 lg:sticky lg:top-6">
            {TABS.map(({ id, label, description, icon: Icon }) => {
              const active = activeTab === id;
              const done = CONFIGURED.has(id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 mb-0.5 rounded-lg text-left transition-all relative ${
                    active
                      ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF] text-[#030213]'
                      : 'text-[#5A5568] hover:bg-[#F8F9FC]'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF]" />
                  )}
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${active ? 'text-[#4D8EF7]' : 'text-[#717182]'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium leading-tight ${active ? 'text-[#030213]' : 'text-[#5A5568]'}`}>{label}</p>
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-[#D4CEE1] flex-shrink-0" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-tight ${done ? 'text-[#2E7D32]' : 'text-[#A0A0B0]'}`}>
                      {done ? 'Configured' : description}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Progress summary */}
            <div className="mt-2 pt-2 border-t border-[#F0EFF6]">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#717182] uppercase tracking-wide">Setup progress</span>
                <span className="text-[11px] font-semibold text-[#030213]">{CONFIGURED.size}/{TABS.length}</span>
              </div>
              <div className="mx-3 mb-1 h-1 rounded-full bg-[#F3F3F5] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all"
                  style={{ width: `${(CONFIGURED.size / TABS.length) * 100}%` }}
                />
              </div>
            </div>
          </nav>
        </aside>

        {/* Detail */}
        <section className="flex-1 min-w-0">

      {/* ─── Personal Info ────────────────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <SectionCard
          title="User Info"
          actions={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-5 mb-5 border-b border-[#F0EFF6]">
            <Field label="First Name" value="Sajid" />
            <Field label="Last Name" value="Mahmood" />
            <Field label="Email" value="sajid@smilegenius.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-5 mb-5 border-b border-[#F0EFF6]">
            <Field label="User Department" value="Operations" />
            <Field label="Role" value={<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />Super Admin</span>} />
            <Field label="Employee ID" value="EMP-001" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Phone" />
            <Field label="Time Zone" value="Europe / London (GMT)" />
            <Field label="Language" value="English (UK)" />
          </div>
        </SectionCard>
      )}

      {/* ─── DSO Info ─────────────────────────────────────────────────────── */}
      {activeTab === 'dso' && (
        <SectionCard
          title="DSO Info"
          actions={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-5 mb-5 border-b border-[#F0EFF6]">
            <Field label="Name of the DSO" value="Smile Genius" />
            <Field label="Contact No." value="+44 20 7946 0123" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-5 mb-5 border-b border-[#F0EFF6]">
            <Field label="Website" value="smilegenius.com" />
            <Field label="Country" value={
              <span className="inline-flex items-center gap-2">
                <span className="text-base leading-none">🇬🇧</span>
                United Kingdom
              </span>
            } />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-5 mb-5 border-b border-[#F0EFF6]">
            <Field label="Address" value="1 Smile Lane" />
            <Field label="City" value="London" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Postal Code" value="SW1A 1AA" />
          </div>
        </SectionCard>
      )}

      {/* ─── User Management — same flow as Staff Management ────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#030213]">User Management</h2>
              <p className="text-xs text-[#717182] mt-0.5">
                Manage team members, send invitations, and track onboarding status.
              </p>
            </div>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setInviteModalOpen(true)}
              className="whitespace-nowrap"
            >
              Invite New User
            </Button>
          </div>

          {/* Stat cards — clickable filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <button
              onClick={() => { setUserStatusFilter('all'); setUserPage(1); }}
              className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
                userStatusFilter === 'all' ? 'border-transparent' : 'border-[#E0E0E6]'
              }`}
              style={userStatusFilter === 'all' ? {
                background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #4D8EF7, #A59DFF) border-box',
                border: '2px solid transparent',
              } : {}}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-xs text-[#717182] mb-1">Total Users</div>
                  <div className="text-xl font-semibold text-[#030213]">{memberStats.total}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#4D8EF7]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#4D8EF7]" />
                </div>
              </div>
            </button>
            <button
              onClick={() => { setUserStatusFilter('active'); setUserPage(1); }}
              className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
                userStatusFilter === 'active' ? 'border-[#2E7D32] ring-2 ring-[#2E7D32]/20' : 'border-[#E0E0E6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-xs text-[#717182] mb-1">Active</div>
                  <div className="text-xl font-semibold text-[#030213]">{memberStats.active}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#2E7D32]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                </div>
              </div>
            </button>
            <button
              onClick={() => { setUserStatusFilter('invited'); setUserPage(1); }}
              className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
                userStatusFilter === 'invited' ? 'border-[#1565C0] ring-2 ring-[#1565C0]/20' : 'border-[#E0E0E6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-xs text-[#717182] mb-1">Invited</div>
                  <div className="text-xl font-semibold text-[#030213]">{memberStats.invited}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#1565C0]/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-[#1565C0]" />
                </div>
              </div>
            </button>
            <button
              onClick={() => { setUserStatusFilter('inactive'); setUserPage(1); }}
              className={`bg-white rounded-lg border p-3 transition-all cursor-pointer hover:shadow-md ${
                userStatusFilter === 'inactive' ? 'border-[#E65100] ring-2 ring-[#E65100]/20' : 'border-[#E0E0E6]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-xs text-[#717182] mb-1">Inactive</div>
                  <div className="text-xl font-semibold text-[#030213]">{memberStats.inactive}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#E65100]/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#E65100]" />
                </div>
              </div>
            </button>
          </div>

          {/* Bulk action bar */}
          {userSelectedIds.length > 0 && (
            <div className="bg-[#E3F2FD] border border-[#90CAF9] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm font-medium text-[#1565C0]">
                {userSelectedIds.length} user{userSelectedIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Mail className="w-4 h-4" />}
                  onClick={() => {
                    toast.success(`Reminder sent to ${userSelectedIds.length} ${userSelectedIds.length === 1 ? 'user' : 'users'}`);
                    setUserSelectedIds([]);
                  }}
                >
                  Send reminder
                </Button>
                <Button variant="outline" size="sm" onClick={() => setUserSelectedIds([])}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Search + sort + view + filter */}
          <div>
            <div className="flex items-center gap-3">
              <SearchInput
                placeholder="Search by name, email, role…"
                value={userSearch}
                onChange={(v) => { setUserSearch(v); setUserPage(1); }}
              />
              <SortDropdown options={userSortOptions} value={userSort} onChange={(v) => { setUserSort(v as typeof userSort); setUserPage(1); }} />
              <button
                onClick={() => setUserViewMode(userViewMode === 'table' ? 'grid' : 'table')}
                className="p-3 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors flex-shrink-0"
                title={userViewMode === 'table' ? 'Switch to grid view' : 'Switch to list view'}
              >
                {userViewMode === 'table' ? <Grid3x3 className="w-5 h-5 text-[#717182]" /> : <List className="w-5 h-5 text-[#717182]" />}
              </button>
              <button
                onClick={() => setUserFilterDrawerOpen(true)}
                className="p-3 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex-shrink-0"
              >
                <Filter className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Active filter chips */}
            {(userRoleFilter !== 'all' || userDeptFilter !== 'all') && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-sm text-[#717182]">Active Filters:</span>
                {userRoleFilter !== 'all' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                    <span>Role: {userRoleFilter}</span>
                    <button onClick={() => setUserRoleFilter('all')} className="hover:text-[#D4183D] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {userDeptFilter !== 'all' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                    <span>Dept: {userDeptFilter}</span>
                    <button onClick={() => setUserDeptFilter('all')} className="hover:text-[#D4183D] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={clearUserFilters}>Clear All</Button>
              </div>
            )}
          </div>

          {/* Content */}
          {sortedMembers.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#E0E0E6] py-16 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F3F3F5] flex items-center justify-center">
                <Users className="w-6 h-6 text-[#A0A0B0]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#030213]">No users found</p>
                <p className="text-xs text-[#717182] mt-1">Try adjusting your filters or search term.</p>
              </div>
              {(userSearch || userRoleFilter !== 'all' || userDeptFilter !== 'all') && (
                <Button variant="outline" size="sm" onClick={clearUserFilters}>Clear filters</Button>
              )}
            </div>
          ) : userViewMode === 'table' ? (
            // ── List view ───────────────────────────────────────────────
            <div className="bg-white rounded-lg border border-[#E0E0E6] overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#F0EFF6]">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={userPageAllSelected}
                        ref={(el) => { if (el) el.indeterminate = userSelectedIds.length > 0 && !userPageAllSelected; }}
                        onChange={toggleUserSelectAll}
                        className="w-4 h-4 rounded accent-[#4D8EF7] cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#717182] uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#717182] uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#717182] uppercase tracking-wider">Employee ID</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#717182] uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#717182] uppercase tracking-wider">Department</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#717182] uppercase tracking-wider">Status</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFF6]">
                  {paginatedMembers.map((m) => {
                    const isChecked = userSelectedIds.includes(m.id);
                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors cursor-pointer ${isChecked ? 'bg-[#FAFBFF]' : 'hover:bg-[#F8F9FC]'}`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleUserSelect(m.id)}
                            aria-label={`Select ${m.name}`}
                            className="w-4 h-4 rounded accent-[#4D8EF7] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-[#030213]">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5A5568] whitespace-nowrap">{m.email}</td>
                        <td className="px-4 py-3 text-sm text-[#5A5568] whitespace-nowrap">{m.employeeId}</td>
                        <td className="px-4 py-3 text-sm text-[#030213] whitespace-nowrap">{m.role}</td>
                        <td className="px-4 py-3 text-sm text-[#5A5568] whitespace-nowrap">{m.department}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><StatusPill status={m.status} /></td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="p-1.5 rounded-lg text-[#717182] hover:text-[#030213] hover:bg-[#F3F3F5] transition-colors"
                            title="More"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // ── Grid (card) view ─────────────────────────────────────────
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedMembers.map((m) => {
                const isChecked = userSelectedIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className={`relative bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
                      isChecked ? 'border-[#4D8EF7] ring-1 ring-[#4D8EF7]/20' : 'border-[#E0E0E6] hover:border-[#C8C0F0]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleUserSelect(m.id)}
                      aria-label={`Select ${m.name}`}
                      className="absolute top-3 left-3 w-4 h-4 rounded accent-[#4D8EF7] cursor-pointer"
                    />
                    <div className="absolute top-3 right-3">
                      <StatusPill status={m.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-6 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center text-white text-base font-semibold flex-shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#030213] truncate">{m.name}</p>
                        <p className="text-xs text-[#717182] truncate">{m.role}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0 mt-0.5" />
                        <span className="text-[#5A5568] break-all">{m.email}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-[#F0EFF6]">
                        <span className="text-[#A0A0B0]">Employee ID</span>
                        <span className="font-medium text-[#030213]">{m.employeeId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#A0A0B0]">Department</span>
                        <span className="font-medium text-[#030213]">{m.department}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer with count + pagination */}
          {sortedMembers.length > 0 && (
            <div className="bg-white rounded-lg border border-[#E0E0E6]">
              <div className="px-6 py-3 border-b border-[#F0EFF6] flex items-center justify-between">
                <span className="text-xs text-[#717182]">
                  Showing <span className="font-medium text-[#030213]">{paginatedMembers.length}</span> of {sortedMembers.length} {sortedMembers.length === 1 ? 'user' : 'users'}
                </span>
                {userStatusFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0EFF6] text-[#5A5568] border border-[#E0E0E6]">
                    <Archive className="w-3 h-3" />
                    Filter: {userStatusFilter}
                    <button onClick={() => setUserStatusFilter('all')} className="ml-1 hover:text-[#C62828]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
              {userTotalPages > 1 && (
                <Pagination
                  currentPage={userPage}
                  totalPages={userTotalPages}
                  itemsPerPage={userItemsPerPage}
                  totalItems={sortedMembers.length}
                  onPageChange={setUserPage}
                  onItemsPerPageChange={(n) => { setUserItemsPerPage(n); setUserPage(1); }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Notifications ────────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {/* Order status */}
          <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_140px] gap-4 px-6 py-3 bg-[#F8F9FC] border-b border-[#F0EFF6]">
              <h3 className="text-sm font-semibold text-[#030213]">Order Status</h3>
              <div className="text-[11px] font-medium text-[#717182] uppercase tracking-wide flex items-center gap-1.5 justify-center">
                <Mail className="w-3.5 h-3.5" /> Email
              </div>
              <div className="text-[11px] font-medium text-[#717182] uppercase tracking-wide flex items-center gap-1.5 justify-center">
                <Bell className="w-3.5 h-3.5" /> System
              </div>
            </div>
            <div className="divide-y divide-[#F0EFF6]">
              {orderStatuses.map((s) => (
                <div key={s} className="grid grid-cols-[1fr_140px_140px] gap-4 px-6 py-3 items-center">
                  <span className="text-sm text-[#030213]">{s}</span>
                  <div className="flex justify-center">
                    <Toggle on={orderNotif[s].email} onChange={() => setOrderNotif({ ...orderNotif, [s]: { ...orderNotif[s], email: !orderNotif[s].email } })} />
                  </div>
                  <div className="flex justify-center">
                    <Toggle on={orderNotif[s].system} onChange={() => setOrderNotif({ ...orderNotif, [s]: { ...orderNotif[s], system: !orderNotif[s].system } })} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment status */}
          <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_140px] gap-4 px-6 py-3 bg-[#F8F9FC] border-b border-[#F0EFF6]">
              <h3 className="text-sm font-semibold text-[#030213]">Payment Status</h3>
              <div className="text-[11px] font-medium text-[#717182] uppercase tracking-wide flex items-center gap-1.5 justify-center">
                <Mail className="w-3.5 h-3.5" /> Email
              </div>
              <div className="text-[11px] font-medium text-[#717182] uppercase tracking-wide flex items-center gap-1.5 justify-center">
                <Bell className="w-3.5 h-3.5" /> System
              </div>
            </div>
            <div className="divide-y divide-[#F0EFF6]">
              {paymentStatuses.map((s) => (
                <div key={s} className="grid grid-cols-[1fr_140px_140px] gap-4 px-6 py-3 items-center">
                  <span className="text-sm text-[#030213]">{s}</span>
                  <div className="flex justify-center">
                    <Toggle on={paymentNotif[s].email} onChange={() => setPaymentNotif({ ...paymentNotif, [s]: { ...paymentNotif[s], email: !paymentNotif[s].email } })} />
                  </div>
                  <div className="flex justify-center">
                    <Toggle on={paymentNotif[s].system} onChange={() => setPaymentNotif({ ...paymentNotif, [s]: { ...paymentNotif[s], system: !paymentNotif[s].system } })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


        </section>
      </div>

      {inviteModalOpen && (
        <InviteUsersModal
          onClose={() => setInviteModalOpen(false)}
          onConfirm={handleInviteConfirm}
        />
      )}

      <FilterDrawer
        isOpen={userFilterDrawerOpen}
        onClose={() => setUserFilterDrawerOpen(false)}
        filters={[
          { label: 'Role',       value: userRoleFilter, options: userRoleOptions, onChange: (v) => { setUserRoleFilter(v); setUserPage(1); } },
          { label: 'Department', value: userDeptFilter, options: userDeptOptions, onChange: (v) => { setUserDeptFilter(v); setUserPage(1); } },
        ]}
        onApply={() => setUserFilterDrawerOpen(false)}
        onReset={clearUserFilters}
      />
    </div>
  );
}
