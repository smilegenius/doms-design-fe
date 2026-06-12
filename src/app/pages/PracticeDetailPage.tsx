import { ArrowLeft, Building2, Mail, Phone, MapPin, UserPlus, MessageSquare, RotateCcw, CheckCircle2, AlertTriangle, Clock, Send, User, Search, Grid3x3, List, Pencil, Archive } from 'lucide-react';
import ActionMenu from '../components/ActionMenu';
import { Practice, StaffMember, mockPractices } from '../data/clinicsData';
import { useState, useMemo } from 'react';
import AddPracticeModal from '../components/AddPracticeModal';
import AddStaffModal from '../components/AddStaffModal';

interface PracticeDetailPageProps {
  practice: Practice;
  staffMembers: StaffMember[];
  onBack: () => void;
  onInvite: (practice: Practice) => void;
  onMessage?: (practice: Practice) => void;
  onStaffClick: (staff: StaffMember) => void;
  onPracticeUpdated?: (updated: Practice) => void;
  onStaffAdded?: (staff: StaffMember) => void;
  onArchive?: (practice: Practice) => void;
}

export default function PracticeDetailPage({
  practice,
  staffMembers,
  onBack,
  onInvite,
  onMessage,
  onStaffClick,
  onPracticeUpdated,
  onStaffAdded,
  onArchive,
}: PracticeDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'dentists' | 'staff'>('dentists');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);

  const practiceStaff = staffMembers.filter((s) => s.practiceId === practice.id);
  const manager = practiceStaff.find((s) => s.staffType === 'Practice Manager');
  const dentists = practiceStaff.filter((s) => s.staffType === 'Dentist');
  const otherStaff = practiceStaff.filter((s) => s.staffType !== 'Practice Manager' && s.staffType !== 'Dentist');

  const filteredDentists = useMemo(() => {
    let list = dentists.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || (d.email?.toLowerCase().includes(q) ?? false);
      return matchSearch && (statusFilter === 'all' || d.status === statusFilter);
    });
    return sortBy === 'name' ? list.sort((a, b) => a.name.localeCompare(b.name)) : list.sort((a, b) => a.status.localeCompare(b.status));
  }, [dentists, searchQuery, statusFilter, sortBy]);

  const filteredOtherStaff = useMemo(() => {
    let list = otherStaff.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.email?.toLowerCase().includes(q) ?? false);
      return matchSearch && (statusFilter === 'all' || s.status === statusFilter);
    });
    return sortBy === 'name' ? list.sort((a, b) => a.name.localeCompare(b.name)) : list.sort((a, b) => a.status.localeCompare(b.status));
  }, [otherStaff, searchQuery, statusFilter, sortBy]);

  const handleEditSubmit = (data: {
    name: string; practiceCode?: string; address?: string; postcode?: string;
    city?: string; country?: string; email?: string; phone?: string;
    managers: any[]; dentists: any[]; staff?: any[];
  }) => {
    const updated: Practice = {
      ...practice,
      name: data.name,
      practiceCode: data.practiceCode,
      address: data.address,
      postcode: data.postcode,
      city: data.city,
      country: data.country,
      email: data.email,
      phone: data.phone,
      managers: data.managers,
      dentists: data.dentists,
    };
    onPracticeUpdated?.(updated);
    setEditModalOpen(false);
  };

  const handleAddStaffSubmit = (data: {
    practiceId: string; name: string; staffType: string;
    email?: string; phone?: string; performerCode?: string;
    performerName?: string; employeeId?: string;
  }) => {
    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      practiceId: practice.id,
      practiceName: practice.name,
      name: data.name,
      staffType: data.staffType,
      email: data.email,
      phone: data.phone,
      performerCode: data.performerCode,
      performerName: data.performerName,
      employeeId: data.employeeId,
      status: 'inactive',
    };
    onStaffAdded?.(newMember);
    setAddStaffModalOpen(false);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'active') return <><CheckCircle2 className="w-4 h-4 text-[#2E7D32]" /><span className="text-xs text-[#2E7D32]">Active</span></>;
    if (status === 'inactive') return <><AlertTriangle className="w-4 h-4 text-[#E65100]" /><span className="text-xs text-[#E65100]">Inactive</span></>;
    if (status === 'invited') return <><Send className="w-4 h-4 text-[#1565C0]" /><span className="text-xs text-[#1565C0]">Invited</span></>;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Header */}
      <div className="bg-white border-b border-[#E0E0E6]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="flex items-center gap-2 text-[#717182] hover:text-[#030213] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Practices</span>
            </button>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Edit Practice — always visible */}
              <button
                onClick={() => setEditModalOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-[#717182] bg-white hover:bg-[#F8F9FC] rounded-lg border border-[#E0E0E6] transition-colors flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                Edit Practice
              </button>

              {/* Add Staff — always visible */}
              <button
                onClick={() => setAddStaffModalOpen(true)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff
              </button>

              {practice.status === 'invited' && (
                <button onClick={() => onInvite(practice)} className="px-3 py-1.5 text-sm font-medium text-[#717182] bg-white hover:bg-[#F8F9FC] rounded-lg border border-[#E0E0E6] transition-colors flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Resend Invitation
                </button>
              )}
              {practice.status === 'active' && onMessage && (
                <button onClick={() => onMessage(practice)} className="px-3 py-1.5 text-sm font-medium text-[#717182] bg-white hover:bg-[#F8F9FC] rounded-lg border border-[#E0E0E6] transition-colors flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Message
                </button>
              )}

              {/* 3-dot menu — always rightmost */}
              {practice.status !== 'archived' && (
                <ActionMenu
                  align="right"
                  items={[
                    {
                      label: 'Archive Practice',
                      icon: <Archive className="w-4 h-4" />,
                      onClick: () => { onArchive?.(practice); onBack(); },
                      variant: 'danger',
                    },
                  ]}
                />
              )}
            </div>
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-semibold text-[#030213]">{practice.name}</h1>
                {practice.practiceCode && <span className="text-sm text-[#717182]">{practice.practiceCode}</span>}
                <div className="flex items-center gap-1.5">
                  {practice.status === 'active' && <><CheckCircle2 className="w-4 h-4 text-[#2E7D32]" /><span className="text-xs text-[#2E7D32] font-medium">Active</span></>}
                  {practice.status === 'inactive' && <><AlertTriangle className="w-4 h-4 text-[#E65100]" /><span className="text-xs text-[#E65100] font-medium">Inactive</span></>}
                  {practice.status === 'invited' && <><Send className="w-4 h-4 text-[#1565C0]" /><span className="text-xs text-[#1565C0] font-medium">Invited</span></>}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm text-[#717182]">
                {practice.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{practice.address}, {practice.city}</span>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  {practice.email && (
                    <a href={`mailto:${practice.email}`} className="flex items-center gap-1.5 hover:text-[#4D8EF7] transition-colors">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" /><span>{practice.email}</span>
                    </a>
                  )}
                  {practice.phone && (
                    <a href={`tel:${practice.phone}`} className="flex items-center gap-1.5 hover:text-[#4D8EF7] transition-colors">
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" /><span>{practice.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Manager Card */}
            {manager && (
              <div onClick={() => onStaffClick(manager)} className="group bg-white border border-[#E0E0E6] rounded-xl px-5 py-4 hover:border-[#4D8EF7]/50 hover:shadow-md transition-all cursor-pointer min-w-[220px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-[#717182] uppercase tracking-wide">Practice Manager</span>
                  <Building2 className="w-4 h-4 text-[#A0A0B0] group-hover:text-[#4D8EF7] transition-colors" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4D8EF7]/15 to-[#A59DFF]/15 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#4D8EF7]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-sm text-[#030213]">{manager.name}</span>
                      {manager.status === 'active' && <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] flex-shrink-0" />}
                      {manager.status === 'invited' && <Send className="w-3.5 h-3.5 text-[#1565C0] flex-shrink-0" />}
                    </div>
                    <span className="text-xs text-[#717182] truncate block">{manager.email}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-[#E0E0E6] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#E0E0E6]">
            <button
              onClick={() => setActiveTab('dentists')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'dentists' ? 'text-[#4D8EF7] border-b-2 border-[#4D8EF7] bg-[#4D8EF7]/5' : 'text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC]'}`}
            >
              Dentists ({dentists.length})
            </button>
            {otherStaff.length > 0 && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'staff' ? 'text-[#4D8EF7] border-b-2 border-[#4D8EF7] bg-[#4D8EF7]/5' : 'text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC]'}`}
              >
                Other Staff ({otherStaff.length})
              </button>
            )}
          </div>

          {/* Search & Controls */}
          <div className="p-4 border-b border-[#E0E0E6] bg-[#F8F9FC]">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717182]" />
                <input type="text" placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] bg-white text-sm" />
              </div>
              <div className="flex gap-2">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] bg-white text-sm">
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="invited">Invited</option>
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'status')} className="px-3 py-2 border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] bg-white text-sm">
                  <option value="name">Sort by Name</option>
                  <option value="status">Sort by Status</option>
                </select>
                <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2 border border-[#E0E0E6] rounded-lg hover:bg-white transition-colors">
                  {viewMode === 'grid' ? <List className="w-5 h-5 text-[#717182]" /> : <Grid3x3 className="w-5 h-5 text-[#717182]" />}
                </button>
              </div>
            </div>
          </div>

          {/* Staff Content */}
          <div className="p-6">
            {activeTab === 'dentists' && (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDentists.map((d) => (
                      <div key={d.id} onClick={() => onStaffClick(d)} className="border border-[#E0E0E6] rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#4D8EF7]/10 to-[#A59DFF]/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-[#4D8EF7]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[#030213] truncate">{d.name}</h3>
                            {d.performerCode && <div className="text-xs text-[#717182] mt-1">{d.performerCode}</div>}
                          </div>
                        </div>
                        <div className="text-sm text-[#717182] mb-2 truncate">{d.email}</div>
                        <div className="flex items-center gap-1.5"><StatusIcon status={d.status} /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-[#E0E0E6] rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[#F3F3F5] border-b border-[#E0E0E6]">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Name</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Email</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Performer Code</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDentists.map((d) => (
                          <tr key={d.id} onClick={() => onStaffClick(d)} className="border-b border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors cursor-pointer">
                            <td className="px-4 py-3 text-sm font-medium text-[#030213]">{d.name}</td>
                            <td className="px-4 py-3 text-sm text-[#717182]">{d.email}</td>
                            <td className="px-4 py-3 text-sm text-[#717182]">{d.performerCode}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1.5"><StatusIcon status={d.status} /></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {filteredDentists.length === 0 && <div className="text-center py-12 text-[#717182]">{searchQuery || statusFilter !== 'all' ? 'No dentists match your filters' : 'No dentists found'}</div>}
              </>
            )}

            {activeTab === 'staff' && (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOtherStaff.map((s) => (
                      <div key={s.id} onClick={() => onStaffClick(s)} className="border border-[#E0E0E6] rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#4D8EF7]/10 to-[#A59DFF]/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-[#4D8EF7]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[#030213] truncate">{s.name}</h3>
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0] mt-1">{s.staffType}</div>
                          </div>
                        </div>
                        <div className="text-sm text-[#717182] mb-2 truncate">{s.email}</div>
                        <div className="flex items-center gap-1.5"><StatusIcon status={s.status} /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-[#E0E0E6] rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-[#F3F3F5] border-b border-[#E0E0E6]">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Name</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Role</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Email</th>
                          <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOtherStaff.map((s) => (
                          <tr key={s.id} onClick={() => onStaffClick(s)} className="border-b border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors cursor-pointer">
                            <td className="px-4 py-3 text-sm font-medium text-[#030213]">{s.name}</td>
                            <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0]">{s.staffType}</span></td>
                            <td className="px-4 py-3 text-sm text-[#717182]">{s.email}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1.5"><StatusIcon status={s.status} /></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {filteredOtherStaff.length === 0 && <div className="text-center py-12 text-[#717182]">{searchQuery || statusFilter !== 'all' ? 'No staff members match your filters' : 'No other staff members found'}</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Practice Modal */}
      <AddPracticeModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        initialData={practice}
        onSubmit={handleEditSubmit}
      />

      {/* Add Staff Modal */}
      <AddStaffModal
        isOpen={addStaffModalOpen}
        onClose={() => setAddStaffModalOpen(false)}
        practices={[practice]}
        defaultPracticeId={practice.id}
        onSubmit={handleAddStaffSubmit}
      />
    </div>
  );
}
