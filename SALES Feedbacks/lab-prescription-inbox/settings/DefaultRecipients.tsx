import { useEffect, useRef, useState } from 'react';
import { Check, Plus, UserPlus, X } from 'lucide-react';
import { LAB_TEAM, LabTeamMember } from '../data';

// ─── "Notified by default" ───────────────────────────────────────────────────
// Lab admins name the team members (from Settings → User Management) who get
// this notification by default: adding someone turns the bell and email on for
// them, removing turns both off. Everyone can still fine-tune their own
// switches above. Used by the notification categories under Settings → Notifications.

const initials = (n: string) => n.replace(/^Dr\.?\s+/i, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function DefaultRecipients({ isOn, channels, onAdd, onRemove, meEmail, label = 'Notified by default' }: {
  /** Does this person currently get it (either channel)? */
  isOn: (email: string) => boolean;
  /** Which channels are on for a person, for the chip's caption. */
  channels: (email: string) => string;
  onAdd: (m: LabTeamMember) => void;
  onRemove: (m: LabTeamMember) => void;
  meEmail?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const on = LAB_TEAM.filter(m => isOn(m.email));
  const rest = LAB_TEAM.filter(m => !isOn(m.email));

  return (
    <div className="px-5 py-4 border-t border-[#F0EFF6]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-[#030213]">{label}</p>
          <p className="text-xs text-[#717182] mt-0.5">Team members from User Management who get the bell alert and email for this. Adding someone turns both on for them.</p>
        </div>
        <div className="relative flex-shrink-0" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            disabled={!rest.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 text-[#4D8EF7]" /> Add people
          </button>
          {open && (
            <div className="absolute right-0 top-10 z-30 w-72 bg-white border border-[#E0E0E6] rounded-xl shadow-lg py-1">
              <p className="px-3 py-1.5 text-[11px] font-medium text-[#717182] uppercase tracking-wide">From User Management</p>
              {rest.map(m => (
                <button
                  key={m.email}
                  onClick={() => { onAdd(m); if (rest.length === 1) setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#F8F9FC]"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{initials(m.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-[#030213] truncate">{m.name}</span>
                    <span className="block text-[11px] text-[#A0A0B0] truncate">{m.role}</span>
                  </span>
                  <Plus className="w-3.5 h-3.5 text-[#4D8EF7] flex-shrink-0" />
                </button>
              ))}
              {!rest.length && <p className="px-3 py-2 text-xs text-[#717182] flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#047857]" /> Everyone is already added.</p>}
            </div>
          )}
        </div>
      </div>

      {on.length === 0 ? (
        <p className="text-xs text-[#A0A0B0]">No one yet. Use Add people to choose who gets this by default.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {on.map(m => (
            <span key={m.email} className="inline-flex items-center gap-2 pl-1.5 pr-1.5 py-1 rounded-full border border-[#E0E0E6] bg-[#F8F9FC]">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[9px] font-bold flex items-center justify-center">{initials(m.name)}</span>
              <span className="text-xs text-[#030213]">{m.name}{m.email === meEmail ? ' (you)' : ''}<span className="text-[#A0A0B0]"> · {m.role} · {channels(m.email)}</span></span>
              <button onClick={() => onRemove(m)} className="text-[#A0A0B0] hover:text-[#D4183D]" aria-label={`Remove ${m.name}`}><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
