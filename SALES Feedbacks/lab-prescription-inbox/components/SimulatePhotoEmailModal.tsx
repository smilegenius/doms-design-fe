import { useState } from 'react';
import { Mail, Paperclip } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import Button from '../../../src/app/components/Button';
import { useAuth } from '../../../src/app/context/AuthContext';
import { LAB_TEAM, RX_INBOX, SAMPLE_PRESCRIPTIONS, teamMemberFor } from '../data';

/** Demo only: stands in for a lab user emailing a phone photo to the inbox. */
export default function SimulatePhotoEmailModal({ onClose, onSend }: {
  onClose: () => void;
  onSend: (sampleId: string, from: string) => void;
}) {
  const { user } = useAuth();
  const [sampleId, setSampleId] = useState(SAMPLE_PRESCRIPTIONS[0].id);
  const [from, setFrom] = useState(teamMemberFor(user?.email)?.email ?? LAB_TEAM[0].email);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Email a prescription photo"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button icon={<Mail className="w-4 h-4" />} onClick={() => onSend(sampleId, from)}>Send</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#E0E0E6] divide-y divide-[#F0EFF6]">
          <label className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-12 text-[11px] font-medium text-[#717182] uppercase tracking-wide">From</span>
            <select
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-[#030213] focus:outline-none"
            >
              {LAB_TEAM.map(m => <option key={m.email} value={m.email}>{m.name} ({m.email})</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-12 text-[11px] font-medium text-[#717182] uppercase tracking-wide">To</span>
            <span className="text-sm text-[#030213] font-mono truncate">{RX_INBOX}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[#5A5568] mb-2 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Attach the photo(s) of the paper prescription
          </p>
          <div className="grid grid-cols-3 gap-3">
            {SAMPLE_PRESCRIPTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSampleId(s.id)}
                className={`text-left rounded-xl border-2 p-1.5 transition-colors ${
                  sampleId === s.id ? 'border-[#4D8EF7] bg-[#EEF4FF]' : 'border-[#E0E0E6] hover:bg-[#F8F9FC]'
                }`}
              >
                <div className="relative">
                  <img src={s.pages[0]} alt={`${s.photoName} preview`} className="w-full aspect-[3/4] object-cover rounded-lg" />
                  {s.pages.length > 1 && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">{s.pages.length} pages</span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-[#030213] mt-1.5 px-0.5 truncate">{s.photoName}</p>
                <p className="text-[10px] text-[#717182] px-0.5 truncate">{s.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
