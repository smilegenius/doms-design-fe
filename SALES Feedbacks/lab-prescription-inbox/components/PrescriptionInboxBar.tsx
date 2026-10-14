import { useState } from 'react';
import { ArrowRight, Eye, Loader2, Mail, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../src/app/context/ToastContext';
import { RX_INBOX } from '../data';
import { receivePrescriptionPhoto, resetRxInboxDemo, useRxInbox } from '../inboxStore';
import SimulatePhotoEmailModal from './SimulatePhotoEmailModal';
import NotificationEmailModal from './NotificationEmailModal';

// Compact notice above the Cases list. Same shape as the compact
// ScannerExpiryNotice, in the inbox blue used by the Email Inbox tab.
export default function PrescriptionInboxBar() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { inbound, sent } = useRxInbox();
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const processing = inbound.filter(m => m.status === 'processing').length;
  const latest = inbound.find(m => m.status === 'drafted');

  function send(sampleId: string, from: string) {
    setSimulateOpen(false);
    toast.info(`Photo received from ${from}. AI is reading the prescription…`);
    receivePrescriptionPhoto(sampleId, from).then(({ caseId, notified }) => {
      if (notified) toast.success(`Draft ${caseId} is ready. Emailed ${notified} user${notified === 1 ? '' : 's'}.`);
      else toast.warning(`Draft ${caseId} is ready. No one has draft-ready emails on (Settings → Notifications), so no email was sent.`);
    });
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 -mb-2 sm:-mb-3 lg:-mb-4">
      <div className="rounded-xl border border-[#DBEAFE] bg-[#EEF4FF] px-4 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-white border border-[#DBEAFE] flex items-center justify-center flex-shrink-0 text-[#4D8EF7]">
              {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            </span>
            <p className="flex-1 min-w-0 text-[11px] leading-relaxed text-[#1E3A8A]">
              <span className="font-bold text-[#1565C0]">Prescription email inbox.</span>{' '}
              {processing
                ? `AI is reading ${processing} prescription photo${processing === 1 ? '' : 's'}. The draft will appear in the list below.`
                : <>Photos of paper prescriptions emailed to <span className="font-mono">{RX_INBOX}</span> become AI-prefilled drafts here.</>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {latest && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#5A5568] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
              >
                <Eye className="w-3 h-3" /> Last notification
              </button>
            )}
            {inbound.length > 0 && (
              <button
                onClick={() => { resetRxInboxDemo(); toast.success('Prescription inbox demo reset'); navigate('/lab/cases'); }}
                title="Remove inbox drafts and clear the inbox log"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#5A5568] hover:bg-white/60 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset demo
              </button>
            )}
            <button
              onClick={() => setSimulateOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
            >
              Email a prescription photo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {simulateOpen && <SimulatePhotoEmailModal onClose={() => setSimulateOpen(false)} onSend={send} />}
      {previewOpen && latest && (
        <NotificationEmailModal inbound={latest} email={sent.find(e => e.caseId === latest.id)} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
