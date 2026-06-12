import { MessageSquare, RotateCcw, CheckCircle2, AlertTriangle, Send, ArrowRight, Archive, FileEdit, Mail } from 'lucide-react';
import { Practice } from '../data/clinicsData';
import ActionMenu, { ActionMenuItem } from './ActionMenu';

interface PracticesTableProps {
  practices: Practice[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (practice: Practice) => void;
  onInvite: (practice: Practice) => void;
  onMessage?: (practice: Practice) => void;
  onArchive: (practice: Practice) => void;
}

export default function PracticesTable({
  practices,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onInvite,
  onMessage,
  onArchive,
}: PracticesTableProps) {
  const allSelected = practices.length > 0 && practices.every((p) => selectedIds.includes(p.id));
  const someSelected = practices.some((p) => selectedIds.includes(p.id)) && !allSelected;

  function getMenuItems(practice: Practice): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      { label: 'View Details', icon: <ArrowRight className="w-4 h-4" />, onClick: () => onEdit(practice) },
    ];
    if (practice.status === 'inactive' || practice.status === 'pending-invite') {
      items.push({ label: 'Send Invite', icon: <Mail className="w-4 h-4" />, onClick: () => onInvite(practice) });
    }
    if (practice.status === 'invited') {
      items.push({ label: 'Resend Invite', icon: <RotateCcw className="w-4 h-4" />, onClick: () => onInvite(practice) });
    }
    if (practice.status === 'active' && onMessage) {
      items.push({ label: 'Message', icon: <MessageSquare className="w-4 h-4" />, onClick: () => onMessage(practice) });
    }
    if (practice.status !== 'archived') {
      items.push({ label: 'Archive', icon: <Archive className="w-4 h-4" />, onClick: () => onArchive(practice), variant: 'danger', dividerAbove: true });
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
                  className="w-4 h-4 rounded border-[#E0E0E6] text-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20 accent-[#4D8EF7]"
                />
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Practice Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Code</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Practice Manager</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Dentists</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#717182] uppercase tracking-wider">Status</th>
              <th className="px-4 py-4"></th>
              <th className="w-12 px-4 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {practices.map((practice) => {
              const isArchived = practice.status === 'archived';
              const isDraft = practice.status === 'draft';
              return (
                <tr
                  key={practice.id}
                  className={`transition-colors cursor-pointer group [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px] ${isArchived ? 'bg-[#FAFAFA] opacity-60' : 'bg-white hover:bg-[#F8F9FC]'}`}
                  onClick={() => onEdit(practice)}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(practice.id)}
                      onChange={() => onToggleSelect(practice.id)}
                      className="w-4 h-4 rounded border-[#E0E0E6] accent-[#4D8EF7]"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div title={practice.name} className={`text-xs font-medium truncate max-w-[180px] ${isArchived ? 'text-[#9E9EAE] line-through' : 'text-[#030213]'}`}>{practice.name}</div>
                    {practice.city && (
                      <div title={`${practice.city}, ${practice.country}`} className="text-xs text-[#A0A0B0] mt-0.5 truncate max-w-[180px]">{practice.city}, {practice.country}</div>
                    )}
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
                    <div className="text-xs text-[#5A5568]">{practice.practiceCode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-xs ${isArchived ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{practice.managers[0]?.name}</div>
                    <div className="text-xs text-[#A0A0B0] mt-0.5">{practice.managers[0]?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-[#5A5568]">{practice.dentists.length} dentist{practice.dentists.length !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {practice.status === 'active' && <><CheckCircle2 className="w-4 h-4 text-[#2E7D32]" /><span className="text-xs text-[#2E7D32]">Active</span></>}
                      {practice.status === 'inactive' && <><AlertTriangle className="w-4 h-4 text-[#E65100]" /><span className="text-xs text-[#E65100]">Inactive</span></>}
                      {practice.status === 'invited' && <><Send className="w-4 h-4 text-[#1565C0]" /><span className="text-xs text-[#1565C0]">Invited</span></>}
                      {practice.status === 'draft' && <span className="text-xs text-[#8B8B9E]">Draft</span>}
                      {practice.status === 'archived' && <span className="text-xs text-[#9E9EAE]">Archived</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    {practice.status === 'active' && onMessage && (
                      <button
                        onClick={() => onMessage(practice)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F0FDF4] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white transition-colors border border-[#BBF7D0] whitespace-nowrap"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Message
                      </button>
                    )}
                    {(practice.status === 'inactive' || practice.status === 'pending-invite' || practice.status === 'invited') && (
                      <button
                        onClick={() => onInvite(practice)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EEF4FF] text-[#4D8EF7] hover:bg-[#4D8EF7] hover:text-white transition-colors border border-[#C8D8FC] whitespace-nowrap"
                      >
                        <Send className="w-3 h-3" />
                        {practice.status === 'invited' ? 'Resend' : 'Invite'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <ActionMenu items={getMenuItems(practice)} align="right" />
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
