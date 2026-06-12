import { Building2, User, Users, MessageSquare, RotateCcw, CheckCircle2, AlertTriangle, Send, ArrowRight, FileEdit, Archive, Pencil, Mail, MapPin } from 'lucide-react';
import { Practice } from '../data/clinicsData';
import ActionMenu, { ActionMenuItem } from './ActionMenu';

interface PracticesGridProps {
  practices: Practice[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  pageAllSelected: boolean;
  onEdit: (practice: Practice) => void;
  onInvite: (practice: Practice) => void;
  onMessage?: (practice: Practice) => void;
  onArchive: (practice: Practice) => void;
  onContinueEditing?: (practice: Practice) => void;
  newlyAddedId?: string | null;
}

export default function PracticesGrid({
  practices,
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
}: PracticesGridProps) {
  const pageIds = practices.map(p => p.id);
  const anySelected = pageIds.some(id => selectedIds.includes(id));

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
          {pageAllSelected ? `All ${practices.length} on this page selected` : anySelected ? `${pageIds.filter(id => selectedIds.includes(id)).length} selected` : 'Select all on this page'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {practices.map((practice) => {
          const isDraft = practice.status === 'draft';
          const isArchived = practice.status === 'archived';
          const isNew = practice.id === newlyAddedId;
          return (
            <div
              key={practice.id}
              className={`border rounded-xl p-4 transition-all duration-200 relative cursor-pointer group ${
                isArchived ? 'bg-[#F5F5F5] border-[#D4D4D4] opacity-70' :
                isDraft ? 'bg-[#FAFAFA] border-dashed border-[#C8C8D4]' :
                'bg-white border-[#E0E0E6] hover:shadow-md hover:border-[#C8C0F0]'
              }${isNew ? ' newly-added' : ''}`}
              onClick={() => onEdit(practice)}
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
                <ActionMenu items={getMenuItems(practice)} align="right" />
              </div>

              {/* Checkbox — top-right under 3-dot on hover, or we put it top-left when no badge */}
              <div
                className={`absolute z-10 ${isDraft || isArchived ? 'top-9 left-3' : 'top-3 left-3'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(practice.id)}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(practice.id); }}
                  className="w-4 h-4 rounded cursor-pointer accent-[#4D8EF7]"
                />
              </div>

              {/* Header */}
              <div className="flex items-start gap-3 mb-3 pt-6 pr-8">
                <div className="flex-1 min-w-0">
                  <h3 title={practice.name} className={`font-semibold text-xs truncate mb-0.5 ${isArchived ? 'text-[#9E9EAE] line-through' : isDraft ? 'text-[#717182]' : 'text-[#030213]'}`}>
                    {practice.name}
                  </h3>
                  <div className="text-xs text-[#A0A0B0]">{practice.practiceCode}</div>
                </div>
              </div>

              {/* Status */}
              <div className="mb-3">
                <div className="flex items-center gap-1.5">
                  {practice.status === 'active' && <><CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" /><span className="text-xs text-[#2E7D32]">Active</span></>}
                  {practice.status === 'inactive' && <><AlertTriangle className="w-3.5 h-3.5 text-[#E65100]" /><span className="text-xs text-[#E65100]">Inactive</span></>}
                  {practice.status === 'invited' && <><Send className="w-3.5 h-3.5 text-[#1565C0]" /><span className="text-xs text-[#1565C0]">Invited</span></>}
                  {practice.status === 'draft' && <span className="text-xs text-[#8B8B9E]">Not yet saved</span>}
                  {practice.status === 'archived' && <span className="text-xs text-[#9E9EAE]">Archived</span>}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 pb-3 border-b border-[#F0EFF6]">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#8B8B9E] flex-shrink-0"><User className="w-3.5 h-3.5" /><span>Practice Manager</span></div>
                  <span title={practice.managers[0]?.name} className={`font-medium truncate ml-2 max-w-[120px] ${isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{practice.managers[0]?.name ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#8B8B9E]"><Users className="w-3.5 h-3.5" /><span>Dentists</span></div>
                  <span className={`font-medium ${isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#030213]'}`}>{practice.dentists.length}</span>
                </div>
                {practice.city && (
                  <div className="flex items-center gap-1.5 text-xs pt-0.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-[#8B8B9E] flex-shrink-0" />
                    <span title={`${practice.city}${practice.country ? `, ${practice.country}` : ''}`} className={`truncate ${isArchived || isDraft ? 'text-[#A0A0B0]' : 'text-[#5A5568]'}`}>{practice.city}{practice.country ? `, ${practice.country}` : ''}</span>
                  </div>
                )}
              </div>

              {/* Footer action — Draft */}
              {isDraft && onContinueEditing && (
                <div className="pt-2.5 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onContinueEditing(practice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Continue Editing
                  </button>
                </div>
              )}

              {/* Footer action */}
              {!isDraft && !isArchived && (
                <div className="pt-2.5 flex items-center justify-end gap-2">
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {practice.status === 'active' && onMessage && (
                      <button
                        onClick={() => onMessage(practice)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F0FDF4] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white transition-colors border border-[#BBF7D0] whitespace-nowrap"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Message
                      </button>
                    )}
                    {(practice.status === 'inactive' || practice.status === 'pending-invite' || practice.status === 'invited') && (
                      <button
                        onClick={() => onInvite(practice)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EEF4FF] text-[#4D8EF7] hover:bg-[#4D8EF7] hover:text-white transition-colors border border-[#C8D8FC] whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {practice.status === 'invited' ? 'Resend Invite' : 'Send Invite'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
