import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Mail } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import Button from '../../../src/app/components/Button';
import { AiSparkle } from '../../../src/app/components/AiSparkle';
import { getCreatedCases } from '../../../src/app/data/createdCases';
import { LAB_NAME, portalDateTime, RX_INBOX, SAMPLE_PRESCRIPTIONS } from '../data';
import type { InboundRx, NotificationEmail } from '../inboxStore';

/** Preview of the "draft ready for review" email that nominated users receive. */
export default function NotificationEmailModal({ inbound, email, onClose }: {
  inbound: InboundRx;
  email?: NotificationEmail;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const draft = getCreatedCases().find(c => c.id === inbound.id);
  const si = draft?.serviceItems[0];
  const sample = SAMPLE_PRESCRIPTIONS.find(s => s.id === inbound.sampleId);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Draft-ready notification"
      size="lg"
      footer={<div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>}
    >
      {!email ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#FDE68A] bg-[#FFF8E1] px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#92610A] leading-relaxed">
            No notification was sent for this photo because no one had draft-ready emails turned on when it arrived. Turn them on under Settings → Notifications → Prescription Email Inbox.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[72px_1fr] gap-y-1.5 text-xs">
            <span className="text-[#717182]">From</span><span className="text-[#030213]">Smile Genius &lt;noreply@smilegeniusdental.com&gt;</span>
            <span className="text-[#717182]">To</span><span className="text-[#030213] break-all">{email.to.join(', ')}</span>
            <span className="text-[#717182]">Subject</span><span className="text-[#030213] font-semibold">{email.subject}</span>
            <span className="text-[#717182]">Sent</span><span className="text-[#5A5568]">{portalDateTime(email.sentAt)}</span>
          </div>

          <div className="rounded-xl border border-[#E0E0E6] overflow-hidden">
            <div className="bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] px-5 py-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-sm font-semibold text-white">Smile Genius</p>
            </div>
            <div className="px-5 py-5 space-y-4 bg-white">
              <div className="flex items-center gap-2">
                <AiSparkle label />
                <p className="text-sm font-semibold text-[#030213]">A draft case is ready for your review</p>
              </div>
              <p className="text-xs text-[#5A5568] leading-relaxed">
                A prescription photo sent to <span className="font-mono text-[#030213]">{RX_INBOX}</span> by{' '}
                <span className="text-[#030213]">{inbound.from}</span> was read by AI. Review the pre-filled details and create the case.
              </p>
              {draft && si ? (
                <div className="flex gap-4 items-start">
                {sample && (
                  <div className="relative flex-shrink-0">
                    <img src={sample.pages[0]} alt={`${sample.photoName} preview`} className="w-24 aspect-[3/4] object-cover rounded-lg border border-[#E0E0E6]" />
                    <span className="absolute bottom-1 left-1 right-1 text-center px-1 py-0.5 rounded bg-black/60 text-white text-[9px] font-semibold truncate">
                      {sample.pages.length} page{sample.pages.length === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0 rounded-xl border border-[#F0EFF6] bg-[#F8F9FC] p-4 grid grid-cols-2 gap-3">
                  {[
                    ['Case', draft.id],
                    ['Patient', draft.patientName],
                    ['Practice', draft.practice],
                    ['Dentist', draft.dentist],
                    ['Service', `${si.name} · ${(si.fdi ?? []).join(', ')}`],
                    ['Requested delivery', draft.requestedDelivery ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[11px] font-medium text-[#717182] uppercase tracking-wide mb-1">{label}</div>
                      <div className="text-sm text-[#030213] font-medium">{value}</div>
                    </div>
                  ))}
                </div>
                </div>
              ) : (
                <p className="text-xs text-[#717182]">This draft has already been reviewed or removed.</p>
              )}
              {draft && (
                <Button size="sm" onClick={() => { onClose(); navigate(`/lab/cases/quick-new/${encodeURIComponent(draft.id)}`); }}>
                  Review draft
                </Button>
              )}
            </div>
            <p className="px-5 py-3 border-t border-[#F0EFF6] bg-[#F8F9FC] text-[10px] text-[#A0A0B0] leading-relaxed">
              You're receiving this because draft-ready emails are on in your notification preferences at {LAB_NAME}. Change it in Settings → Notifications → Prescription Email Inbox.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
