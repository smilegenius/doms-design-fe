import { useState } from 'react';
import { CalendarOff } from 'lucide-react';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import type { CaseLike } from '../../data/carestack';
import { markAppointmentNotRequired } from '../../data/carestack';
import { CS_CURRENT_USER, ghostBtn, inputCls, labelCls, primaryBtn } from './shared';

const REASONS = [
  'Retainer — no fitting appointment needed',
  'Appliance posted directly to the patient',
  'Fitting handled at an existing routine appointment',
  'Study model / diagnostic work only',
  'Other',
];

export default function AppointmentNotRequiredModal({
  caseData, onClose, currentUser = CS_CURRENT_USER,
}: {
  caseData: CaseLike;
  onClose: () => void;
  currentUser?: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState('');
  const isOther = reason === 'Other';
  const canSave = !isOther || notes.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const text = isOther ? notes.trim() : notes.trim() ? `${reason} — ${notes.trim()}` : reason;
    markAppointmentNotRequired(caseData, text, currentUser);
    toast.success(`${caseData.id} marked Appointment Not Required`);
    onClose();
  };

  return (
    <Modal zIndex="z-[120]"
      isOpen
      onClose={onClose}
      title="Appointment Not Required"
      size="md"
      footer={
        <>
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
          <button onClick={save} disabled={!canSave} className={primaryBtn}><CalendarOff className="w-3.5 h-3.5" />Confirm</button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[#5A5568] leading-relaxed">
          Use this when the lab work for <span className="font-semibold text-[#030213]">{caseData.patientName}</span> does not need a patient appointment. No CareStack appointment will be created or associated, and no further appointment updates will be sent to CareStack for this case. The lab workflow continues as normal.
        </p>
        <div>
          <label className={labelCls}>Reason <span className="text-[#D4183D]">*</span></label>
          <select value={reason} onChange={e => setReason(e.target.value)} className={inputCls}>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{isOther ? 'Details' : 'Notes'} {isOther && <span className="text-[#D4183D]">*</span>}</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder={isOther ? 'Explain why no appointment is needed…' : 'Optional'}
            className={`${inputCls} resize-none`}
          />
        </div>
        <p className="text-[10px] text-[#A0A0B0]">Recorded as {currentUser} · now</p>
      </div>
    </Modal>
  );
}
