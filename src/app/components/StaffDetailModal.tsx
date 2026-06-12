import { X, Building2, Mail, Phone, User, UserPlus, MessageSquare, RotateCcw, CheckCircle2, AlertTriangle, Clock, Send, Archive, Copy, Check, Pencil } from 'lucide-react';
import { useState } from 'react';
import { StaffMember } from '../data/clinicsData';
import ActionMenu from './ActionMenu';
import ModalPortal from './ModalPortal';

interface StaffDetailModalProps {
  staff: StaffMember;
  onClose: () => void;
  onInvite: (staff: StaffMember) => void;
  onEdit?: (staff: StaffMember) => void;
  onMessage?: (staff: StaffMember) => void;
  onArchive?: (staff: StaffMember) => void;
}

// Inline copy button — shows Copy icon, briefly switches to Check after click
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={label ? `Copy ${label}` : 'Copy'}
      className="p-1.5 rounded-md text-[#A0A0B0] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#2E7D32]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function StaffDetailModal({
  staff,
  onClose,
  onInvite,
  onEdit,
  onMessage,
  onArchive,
}: StaffDetailModalProps) {
  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#E0E0E6]">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-[#4D8EF7]/10 to-[#A59DFF]/10 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-[#4D8EF7]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#030213]">{staff.name}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0]">
                  {staff.staffType}
                </div>
                {staff.practiceName && (
                  <div className="flex items-center gap-1 text-xs text-[#717182]">
                    <Building2 className="w-3 h-3" />
                    <span>{staff.practiceName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && staff.status !== 'archived' && (
              <button
                onClick={() => onEdit(staff)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4D8EF7] bg-[#EEF4FF] border border-[#C8D8FC] hover:bg-[#4D8EF7] hover:text-white hover:border-[#4D8EF7] rounded-lg transition-colors"
                title="Edit staff details"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            {staff.status !== 'archived' && onArchive && (
              <ActionMenu
                align="right"
                items={[
                  {
                    label: 'Archive Staff Member',
                    icon: <Archive className="w-4 h-4" />,
                    onClick: () => { onArchive(staff); onClose(); },
                    variant: 'danger',
                  },
                ]}
              />
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#F3F3F5] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#717182]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-[#8B8B9E] mb-2">Status</label>
            <div className="flex items-center gap-2">
              {staff.status === 'active' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D32]" />
                  <span className="text-sm text-[#2E7D32] font-medium">Active</span>
                  {staff.activatedAt && (
                    <span className="text-xs text-[#717182]">since {staff.activatedAt}</span>
                  )}
                </>
              )}
              {staff.status === 'inactive' && (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#E65100]" />
                  <span className="text-sm text-[#E65100] font-medium">Inactive</span>
                </>
              )}
              {staff.status === 'invited' && (
                <>
                  <Send className="w-4 h-4 text-[#1565C0]" />
                  <span className="text-sm text-[#1565C0] font-medium">Invited</span>
                  {staff.invitedAt && (
                    <span className="text-xs text-[#717182]">on {staff.invitedAt}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Practice */}
          <div>
            <label className="block text-xs font-medium text-[#8B8B9E] mb-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Practice</span>
              </div>
            </label>
            <div className="text-sm text-[#030213] font-medium">{staff.practiceName}</div>
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[#8B8B9E]">Contact Information</label>

            {staff.email && (
              <div className="flex items-center gap-2 group">
                <Mail className="w-4 h-4 text-[#717182] flex-shrink-0" />
                <span className="text-sm text-[#030213] break-all">{staff.email}</span>
                <CopyButton value={staff.email} label="email" />
              </div>
            )}

            {staff.phone && (
              <div className="flex items-center gap-2 group">
                <Phone className="w-4 h-4 text-[#717182] flex-shrink-0" />
                <span className="text-sm text-[#030213]">{staff.phone}</span>
                <CopyButton value={staff.phone} label="phone" />
              </div>
            )}
          </div>

          {/* Performer Code + Name (Dentist) */}
          {staff.performerCode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#8B8B9E] mb-2">Performer Code</label>
                <div className="text-sm text-[#030213] bg-[#F3F3F5] px-3 py-2 rounded-lg flex items-center justify-between gap-2">
                  <span className="truncate">{staff.performerCode}</span>
                  <CopyButton value={staff.performerCode} label="performer code" />
                </div>
              </div>
              {staff.performerName && (
                <div>
                  <label className="block text-xs font-medium text-[#8B8B9E] mb-2">Performer Name</label>
                  <div className="text-sm text-[#030213] bg-[#F3F3F5] px-3 py-2 rounded-lg flex items-center justify-between gap-2">
                    <span className="truncate">{staff.performerName}</span>
                    <CopyButton value={staff.performerName} label="performer name" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Employee ID (Other staff) */}
          {staff.employeeId && (
            <div>
              <label className="block text-xs font-medium text-[#8B8B9E] mb-2">Employee ID</label>
              <div className="text-sm text-[#030213] bg-[#F3F3F5] px-3 py-2 rounded-lg inline-flex items-center gap-2">
                <span>{staff.employeeId}</span>
                <CopyButton value={staff.employeeId} label="employee ID" />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#E0E0E6] bg-[#F8F9FC]">
          {(staff.status === 'inactive' || staff.status === 'pending-invite' || staff.status === 'draft') && (
            <button
              onClick={() => onInvite(staff)}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Send Invite
            </button>
          )}

          {staff.status === 'invited' && (
            <button
              onClick={() => onInvite(staff)}
              className="px-4 py-2 text-sm font-medium text-[#717182] bg-white hover:bg-[#F8F9FC] rounded-lg border border-[#E0E0E6] transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Resend Invitation
            </button>
          )}

          {staff.status === 'active' && onMessage && (
            <button
              onClick={() => onMessage(staff)}
              className="px-4 py-2 text-sm font-medium text-[#717182] bg-white hover:bg-[#F8F9FC] rounded-lg border border-[#E0E0E6] transition-colors flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Message
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
