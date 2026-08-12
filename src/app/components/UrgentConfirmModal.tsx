import { AlertTriangle } from 'lucide-react';
import ModalPortal from './ModalPortal';

interface UrgentConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmation shown before an urgent chat message is sent (PM copy verbatim).
// Modeled on the logout confirm in Layout; z-[130] so it clears the case
// drawer (z-[100]) and the StatusChangeModal (z-[120]).
export default function UrgentConfirmModal({ isOpen, onCancel, onConfirm }: UrgentConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
          <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
          </div>
          <h3 className="text-base font-semibold text-[#030213] mb-1.5">Mark this message as urgent?</h3>
          <p className="text-sm text-[#717182] leading-relaxed">
            The recipient will receive reminder notifications if they do not respond to this message.
          </p>

          <div className="mt-3.5 rounded-xl border border-[#FDE68A] bg-[#FFF8E1] px-4 py-3">
            <p className="text-xs font-semibold text-[#B45309] mb-2">Reminders will be sent after:</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['2 hours', '4 hours', '6 hours', '8 hours'].map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full bg-white border border-[#FDE68A] text-[11px] font-semibold text-[#B45309]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs text-[#717182] leading-relaxed">
            Notifications will stop immediately once a reply is received or after the final 8-hour reminder.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-[#5A5568] border border-[#E0E0E6] rounded-lg hover:bg-[#F8F9FC] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Send as Urgent
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
