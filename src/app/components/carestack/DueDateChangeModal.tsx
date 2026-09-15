import { useState } from 'react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import Modal from '../Modal';
import { ghostBtn, inputCls, labelCls, primaryBtn } from './shared';

// Intercepts a delivery-date edit while CareStack is on: records the change
// (previous → new, reason, who, when), mirrors it onto the linked appointment
// as a note and emails the practice. Smile Genius never reschedules the
// patient's appointment itself — that stays the practice's call.
export default function DueDateChangeModal({
  previous, next, onConfirm, onCancel,
}: {
  previous: string;
  next: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Change lab work due date"
      size="md"
      footer={
        <>
          <button onClick={onCancel} className={ghostBtn}>Cancel</button>
          <button onClick={() => onConfirm(reason.trim() || undefined)} className={primaryBtn}><CalendarClock className="w-3.5 h-3.5" />Save due date</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-[#E0E0E6] bg-[#F8F9FC] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">Previous due date</p>
            <p className="text-sm font-semibold text-[#717182] line-through decoration-[#D4183D]/60 tabular-nums">{previous || '—'}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">New due date</p>
            <p className="text-sm font-bold text-[#030213] tabular-nums">{next}</p>
          </div>
        </div>
        <div>
          <label className={labelCls}>Reason for change <span className="normal-case tracking-normal text-[#A0A0B0]">(when available)</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Lab capacity — remake required"
            className={`${inputCls} resize-none`}
          />
        </div>
        <p className="text-[11px] text-[#5A5568] leading-relaxed bg-[#EEF4FF] border border-[#BFDBFE] rounded-lg px-3 py-2">
          Smile Genius will email the dentist and practice manager (cc reception) and, if a CareStack appointment is linked, add a note to it with the previous and new dates. Smile Genius never reschedules the patient’s appointment — the practice decides whether it needs to move.
        </p>
      </div>
    </Modal>
  );
}
