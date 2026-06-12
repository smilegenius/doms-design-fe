import { MessageSquare, RotateCcw, CheckCircle2, AlertTriangle, Send, ArrowRight, Archive, FileEdit, Mail, Pencil } from 'lucide-react';
import { StaffMember } from '../data/clinicsData';
import ActionMenu, { ActionMenuItem } from './ActionMenu';

interface StaffTableProps {
  staff: StaffMember[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (staff: StaffMember) => void;
  onInvite: (staff: StaffMember) => void;
  onMessage?: (staff: StaffMember) => void;
  onArchive: (staff: StaffMember) => void;
  onContinueEditing?: (staff: StaffMember) => void;
}

export default function StaffTable({
  staff,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onInvite,
  onMessage,
  onArchive,
  onContinueEditing,
}: StaffTableProps) {
  const allSelected = staff.length > 0 && staff.every((s) => selectedIds.includes(s.id));
  const someSelected = staff.some((s) => selectedIds.includes(s.id)) && !allSelected;

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
    <div className="bg-[#F3F3F5] rounded-xl border border-[#E0E0E6] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-separate border-spacing-y-1">
          <thead>
            <tr className="bg-[#F3F3F5] [&>th]:border-b [&>th]:border-[#E0E0E6]">
              <th className="w-12 px-6 py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded accent-[#4D8EF7]"
                />
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Staff Type</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Practice</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Contact</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Code / ID</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Status</th>
              <th className="px-4 py-4"></th>
              <th className="w-12 px-4 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => {
              const isArchived = member.status === 'archived';
              const isDraft = member.status === 'draft';
              return (
                <tr
                  key={member.id}
                  className={`transition-colors cursor-pointer group [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px] ${isArchived ? 'bg-[#FAFAFA] opacity-60' : 'bg-white hover:bg-[#F8F9FC]'}`}
                  onClick={() => onEdit(member)}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(member.id)}
                      onChange={() => onToggleSelect(member.id)}
                      className="w-4 h-4 rounded border-[#E0E0E6] accent-[#4D8EF7]"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div title={member.name} className={`text-xs font-medium truncate max-w-[160px] ${isArchived ? 'text-[#9E9EAE] line-through' : 'text-[#030213]'}`}>{member.name}</div>
                    {isDraft && (
                      <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F3F3F5] text-[#717182]">
                        <FileEdit className="w-2.5 h-2.5" /> Draft
                      </span>
                    )}
                    {isArchived && (
                      <span className="inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EFEFEF] text-[#9E9EAE]">
                        <Archive className="w-2.5 h-2.5" /> Archived
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0]">{member.staffType}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-xs ${isArchived ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{member.practiceName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div title={member.email} className={`text-xs truncate max-w-[180px] ${isArchived ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{member.email}</div>
                    {member.phone && <div title={member.phone} className="text-xs text-[#A0A0B0] mt-0.5">{member.phone}</div>}
                  </td>
                  <td className="px-6 py-4">
                    {member.performerCode ? (
                      <div>
                        <div className="text-xs text-[#5A5568]">{member.performerCode}</div>
                        {member.performerName && <div className="text-xs text-[#A0A0B0] mt-0.5">{member.performerName}</div>}
                      </div>
                    ) : member.employeeId ? (
                      <div className="text-xs text-[#5A5568]">{member.employeeId}</div>
                    ) : (
                      <div className="text-xs text-[#D0D0D6]">—</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {member.status === 'active' && <><CheckCircle2 className="w-4 h-4 text-[#2E7D32]" /><span className="text-xs text-[#2E7D32]">Active</span></>}
                      {member.status === 'inactive' && <><AlertTriangle className="w-4 h-4 text-[#E65100]" /><span className="text-xs text-[#E65100]">Inactive</span></>}
                      {member.status === 'invited' && <><Send className="w-4 h-4 text-[#1565C0]" /><span className="text-xs text-[#1565C0]">Invited</span></>}
                      {member.status === 'draft' && <span className="text-xs text-[#8B8B9E]">Draft</span>}
                      {member.status === 'archived' && <span className="text-xs text-[#9E9EAE]">Archived</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    {member.status === 'active' && onMessage && (
                      <button
                        onClick={() => onMessage(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F0FDF4] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white transition-colors border border-[#BBF7D0] whitespace-nowrap"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Message
                      </button>
                    )}
                    {(member.status === 'inactive' || member.status === 'pending-invite' || member.status === 'invited') && (
                      <button
                        onClick={() => onInvite(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EEF4FF] text-[#4D8EF7] hover:bg-[#4D8EF7] hover:text-white transition-colors border border-[#C8D8FC] whitespace-nowrap"
                      >
                        <Send className="w-3 h-3" />
                        {member.status === 'invited' ? 'Resend' : 'Invite'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu items={getMenuItems(member)} align="right" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
