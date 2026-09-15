import { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import Modal from '../Modal';
import { CS_CURRENT_USER, ghostBtn, inputCls, labelCls, nowLocalIso, primaryBtn } from './shared';

// "Mark as Received" → the practice confirms delivery. The confirming user is
// the signed-in user; the timestamp defaults to now but can be back-dated.
export default function ReceivedModal({
  caseId, patientName, serviceLabel, onConfirm, onClose, currentUser = CS_CURRENT_USER,
}: {
  caseId: string;
  patientName: string;
  serviceLabel?: string;
  onConfirm: (r: { receivedAt: string; notes?: string }) => void;
  onClose: () => void;
  currentUser?: string;
}) {
  const [receivedAt, setReceivedAt] = useState(nowLocalIso());
  const [notes, setNotes] = useState('');
  return (
    <Modal zIndex="z-[120]"
      isOpen
      onClose={onClose}
      title="Mark as received"
      size="md"
      footer={
        <>
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
          <button
            onClick={() => onConfirm({ receivedAt: new Date(receivedAt).toISOString(), notes: notes.trim() || undefined })}
            disabled={!receivedAt}
            className={primaryBtn}
          >
            <PackageCheck className="w-3.5 h-3.5" />Confirm receipt
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[#5A5568] leading-relaxed">
          Confirm the practice has received the lab work for <span className="font-semibold text-[#030213]">{patientName}</span>
          {serviceLabel ? <> · <span className="font-semibold text-[#030213]">{serviceLabel}</span></> : null} ({caseId}).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Received date / time <span className="text-[#D4183D]">*</span></label>
            <input type="datetime-local" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Received by</label>
            <input value={currentUser} readOnly className={`${inputCls} bg-[#F8F9FC] text-[#717182]`} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Delivery notes <span className="normal-case tracking-normal text-[#A0A0B0]">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="e.g. Box slightly dented, contents intact" className={`${inputCls} resize-none`} />
          </div>
        </div>
        <p className="text-[10px] text-[#A0A0B0] leading-relaxed">
          The case moves to Delivered. If a CareStack appointment is linked, a “Lab Work Received by Practice” note is added to it and the practice team is emailed.
        </p>
      </div>
    </Modal>
  );
}
