import { Building2, Mail, MessageSquare, RotateCcw, CheckCircle2, AlertTriangle, Send, Phone, ArrowRight, FileEdit, Archive, Pencil } from 'lucide-react';
import { StaffMember } from '../data/clinicsData';
import ActionMenu, { ActionMenuItem } from './ActionMenu';

interface StaffGridProps {
  staff: StaffMember[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  pageAllSelected: boolean;
  onEdit: (staff: StaffMember) => void;
  onInvite: (staff: StaffMember) => void;
  onMessage?: (staff: StaffMember) => void;
  onArchive: (staff: StaffMember) => void;
  onContinueEditing?: (staff: StaffMember) => void;
  newlyAddedId?: string | null;
}

export default function StaffGrid({
  staff,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  pageAllSelected,
  onEdit,
  onInvite,
  onMessage,
  onArchive,
  onContinueEditing,
  newlyAddedId,
}: StaffGridProps) {
  const pageIds = staff.map(m => m.id);
  const anySelected = pageIds.some(id => selectedIds.includes(id));

  function getMenuItems(member: StaffMember): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      { label: 'View Details', icon: <ArrowRight className="w-4 h-4" />, onClick: () => onEdit(member) },
    ];
    // Note: Send/Resend Invite intentionally NOT in this menu — it lives in the
    // staff detail modal footer to avoid redundancy with the detail screen CTA.
    if (member.status !== 'archived' && onContinueEditing) {
      items.push({ label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => onContinueEditing(member) });
    }
    if (member.status === 'active' && onMessage) {
      items.push({ label: 'Message', icon: <MessageSquare className="w-4 h-4" />, onClick: () => onMessage(member) });
    }
    if (member.status !== 'archived') {
      items.push({ label: 'Archive', icon: <Archive className="w-4 h-4" />, onClick: () => onArchive(member), variant: 'danger', dividerAbove: true });
    }
    return items;
  }

  return (
    <div>
      {/* Select-all bar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors flex-shrink-0 ${pageAllSelected ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'}`}
          onClick={onToggleSelectAll}
        >
          {pageAllSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {!pageAllSelected && anySelected && <div className="w-2 h-0.5 bg-[#4D8EF7] rounded" />}
        </div>
        <span className="text-xs text-[#717182]">
          {pageAllSelected ? `All ${staff.length} on this page selected` : anySelected ? `${pageIds.filter(id => selectedIds.includes(id)).length} selected` : 'Select all on this page'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {staff.map((member) => {
          const isDraft = member.status === 'draft';
          const isArchived = member.status === 'archived';
          const isNew = member.id === newlyAddedId;
          return (
            <div
              key={member.id}
              className={`border rounded-xl p-4 transition-all duration-200 relative cursor-pointer group ${
                isArchived ? 'bg-[#F5F5F5] border-[#D4D4D4] opacity-70' :
                isDraft ? 'bg-[#FAFAFA] border-dashed border-[#C8C8D4]' :
                'bg-white border-[#E0E0E6] hover:shadow-md hover:border-[#C8C0F0]'
              }${isNew ? ' newly-added' : ''}`}
              onClick={() => onEdit(member)}
            >
              {/* Status badge top-left */}
              {(isDraft || isArchived) && (
                <div className="absolute top-3 left-3 z-10">
                  {isDraft && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3F3F5] text-[#717182] border border-[#D4CEE1]">
                      <FileEdit className="w-2.5 h-2.5" /> Draft
                    </span>
                  )}
                  {isArchived && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EFEFEF] text-[#717182] border border-[#D4D4D4]">
                      <Archive className="w-2.5 h-2.5" /> Archived
                    </span>
                  )}
                </div>
              )}

              {/* 3-dot menu — always visible */}
              <div className="absolute top-2.5 right-2.5 z-10">
                <ActionMenu items={getMenuItems(member)} align="right" />
              </div>

              {/* Checkbox */}
              <div
                className={`absolute z-10 ${isDraft || isArchived ? 'top-9 left-3' : 'top-3 left-3'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(member.id)}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(member.id); }}
                  className="w-4 h-4 rounded cursor-pointer accent-[#4D8EF7]"
                />
              </div>

              {/* Header */}
              <div className="flex items-start gap-3 mb-3 pt-6 pr-8">
                <div className="flex-1 min-w-0">
                  <h3 title={member.name} className={`font-semibold text-xs truncate mb-0.5 ${isArchived ? 'text-[#9E9EAE] line-through' : isDraft ? 'text-[#717182]' : 'text-[#030213]'}`}>
                    {member.name}
                  </h3>
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0]">
                    {member.staffType}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="mb-3">
                <div className="flex items-center gap-1.5">
                  {member.status === 'active' && <><CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" /><span className="text-xs text-[#2E7D32]">Active</span></>}
                  {member.status === 'inactive' && <><AlertTriangle className="w-3.5 h-3.5 text-[#E65100]" /><span className="text-xs text-[#E65100]">Inactive</span></>}
                  {member.status === 'invited' && <><Send className="w-3.5 h-3.5 text-[#1565C0]" /><span className="text-xs text-[#1565C0]">Invited</span></>}
                  {member.status === 'draft' && <span className="text-xs text-[#8B8B9E]">Not yet saved</span>}
                  {member.status === 'archived' && <span className="text-xs text-[#9E9EAE]">Archived</span>}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 pb-3 border-b border-[#F0EFF6]">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#8B8B9E]"><Building2 className="w-3.5 h-3.5" /><span>Practice</span></div>
                  <span title={member.practiceName} className={`font-medium truncate ml-2 max-w-[140px] ${isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{member.practiceName}</span>
                </div>
                {member.email && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-[#8B8B9E]"><Mail className="w-3.5 h-3.5" /><span>Email</span></div>
                    <span title={member.email} className={`truncate ml-2 max-w-[140px] ${isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-[#8B8B9E]"><Phone className="w-3.5 h-3.5" /><span>Phone</span></div>
                    <span title={member.phone} className={`truncate ml-2 max-w-[140px] ${isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{member.phone}</span>
                  </div>
                )}
                {member.performerCode && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-[#8B8B9E]"><span>Code</span></div>
                    <span className={isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#030213]'}>{member.performerCode}</span>
                  </div>
                )}
              </div>

              {/* Footer action — Draft */}
              {isDraft && onContinueEditing && (
                <div className="pt-2.5 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onContinueEditing(member)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Continue Editing
                  </button>
                </div>
              )}

              {/* Footer action */}
              {!isDraft && !isArchived && (
                <div className="pt-2.5 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  {member.status === 'active' && onMessage && (
                    <button
                      onClick={() => onMessage(member)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F0FDF4] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white transition-colors border border-[#BBF7D0] whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message
                    </button>
                  )}
                  {(member.status === 'inactive' || member.status === 'pending-invite' || member.status === 'invited') && (
                    <button
                      onClick={() => onInvite(member)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EEF4FF] text-[#4D8EF7] hover:bg-[#4D8EF7] hover:text-white transition-colors border border-[#C8D8FC] whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {member.status === 'invited' ? 'Resend Invite' : 'Send Invite'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
