import { useState } from 'react';
import { Plus, Trash2, X, Send } from 'lucide-react';
import ModalPortal from './ModalPortal';

// Shape mirrors the onboarding "Invite Users" step so Settings → Invite New User
// can re-use the exact same fields, defaults and status badge.
export interface InviteUserRow {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: string;
  department: string;
}

const ROLES = ['Super-Admin', 'Admin', 'Practice Manager', 'Finance', 'Reviewer', 'Member'];
const DEPARTMENTS = ['Administration', 'Finance', 'Operations', 'Clinical', 'IT'];

function newRow(): InviteUserRow {
  return {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    email: '',
    employeeId: '',
    role: 'Practice Manager',
    department: 'Operations',
  };
}

const rowInputCls =
  'w-full px-2.5 py-1.5 text-sm border border-[#E0E0E6] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] transition-colors';

interface InviteUsersModalProps {
  onClose: () => void;
  // Called when the user confirms. The caller decides what to do with the rows
  // (e.g. POST to API, append to local state, show a toast).
  onConfirm: (users: InviteUserRow[]) => void;
}

export default function InviteUsersModal({ onClose, onConfirm }: InviteUsersModalProps) {
  const [users, setUsers] = useState<InviteUserRow[]>([newRow()]);

  function add() { setUsers((prev) => [...prev, newRow()]); }
  function remove(id: string) {
    setUsers((prev) => (prev.length === 1 ? prev : prev.filter((u) => u.id !== id)));
  }
  function update(id: string, patch: Partial<InviteUserRow>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  // Only rows that have at least a name AND an email count as "sendable".
  const validRows = users.filter((u) => u.name.trim() && u.email.trim());
  const canSend = validRows.length > 0;

  function handleSend() {
    if (!canSend) return;
    onConfirm(validRows);
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-[#F0EFF6]">
            <div>
              <h2 className="text-base font-semibold text-[#030213]">Invite users</h2>
              <p className="text-xs text-[#717182] mt-0.5">
                Add people to your dental group. They'll get an email invitation —
                their status stays <span className="font-medium text-[#E65100]">Inactive</span> until they accept and finish onboarding.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body — list of invitee rows */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-3">
              {/* Column header row — desktop only */}
              <div className="hidden sm:grid grid-cols-[1.5fr_2fr_1fr_1.2fr_1.2fr_36px] gap-3 px-3 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">
                <span>Name</span>
                <span>Email</span>
                <span>Employee ID</span>
                <span>Role</span>
                <span>Department</span>
                <span />
              </div>

              {users.map((u, idx) => (
                <div
                  key={u.id}
                  className="grid grid-cols-1 sm:grid-cols-[1.5fr_2fr_1fr_1.2fr_1.2fr_36px] gap-3 p-3 bg-[#F8F9FC] border border-[#F0EFF6] rounded-xl"
                >
                  <input value={u.name}       onChange={(e) => update(u.id, { name: e.target.value })}       placeholder="Full name"           className={rowInputCls} />
                  <input value={u.email}      onChange={(e) => update(u.id, { email: e.target.value })}      placeholder="email@company.com"   type="email" className={rowInputCls} />
                  <input value={u.employeeId} onChange={(e) => update(u.id, { employeeId: e.target.value })} placeholder="EMP-002"             className={rowInputCls} />
                  <select value={u.role}       onChange={(e) => update(u.id, { role: e.target.value })}       className={rowInputCls}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select value={u.department} onChange={(e) => update(u.id, { department: e.target.value })} className={rowInputCls}>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => remove(u.id)}
                      disabled={users.length === 1}
                      title="Remove row"
                      className="p-2 text-[#A0A0B0] hover:text-[#C62828] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Inactive-until-accept badge */}
                  <div className="sm:col-span-6 -mt-1 flex items-center gap-2 px-1">
                    <span className="text-[10px] text-[#A0A0B0]">Status:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF3E0] text-[#E65100] border border-[#FFCC80]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]" />
                      Inactive · pending onboarding
                    </span>
                    {idx === 0 && (
                      <span className="hidden sm:inline text-[10px] text-[#A0A0B0]">— flips to Active once they finish their setup.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={add}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
            >
              <Plus className="w-4 h-4" /> Add another user
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#F0EFF6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
            <p className="text-[11px] text-[#A0A0B0]">
              {canSend
                ? `${validRows.length} invitation${validRows.length === 1 ? '' : 's'} ready to send.`
                : 'Enter at least a name and email to send an invitation.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Send invitations
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
