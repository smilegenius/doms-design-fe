import { Mail, CheckCircle2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Practice } from '../data/clinicsData';

interface InvitePracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  practice: Practice | null;
  onSendInvite: (practiceId: string) => void;
}

export default function InvitePracticeModal({
  isOpen,
  onClose,
  practice,
  onSendInvite,
}: InvitePracticeModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isResend = practice?.status === 'invited';

  const handleSend = async () => {
    if (!practice) return;

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onSendInvite(practice.id);
    setSending(false);
    setSent(true);

    setTimeout(() => {
      setSent(false);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  if (!practice) return null;

  if (sent) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Invitation Sent" size="md">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-[#2E7D32]" />
          </div>
          <h3 className="text-xl font-semibold text-[#030213] mb-2">
            {isResend ? 'Invitation Resent Successfully!' : 'Invitation Sent Successfully!'}
          </h3>
          <p className="text-[#5A5568] mb-4">
            Invitation email has been {isResend ? 'resent' : 'sent'} to the practice manager and team.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isResend ? 'Resend Practice Invitation' : 'Send Practice Invitation'}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            loading={sending}
            icon={isResend ? <RotateCcw className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          >
            {isResend ? 'Resend Invitation' : 'Send Invitation'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Practice Info */}
        <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg p-4">
          <h4 className="font-semibold text-[#030213] mb-3">Practice Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-[#717182]">Practice Name:</span>
              <span className="text-sm font-medium text-[#030213]">{practice.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[#717182]">Practice Code:</span>
              <span className="text-sm font-medium text-[#030213]">{practice.practiceCode}</span>
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div>
          <h4 className="font-semibold text-[#030213] mb-3">Invitation Recipients</h4>

          {/* Managers */}
          <div className="mb-4">
            <div className="text-sm font-medium text-[#717182] mb-2">Practice Managers</div>
            <div className="space-y-2">
              {practice.managers.map((manager, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-[#030213]">
                  <Mail className="w-4 h-4 text-[#4D8EF7]" />
                  <span className="font-medium">{manager.name}</span>
                  <span className="text-[#717182]">({manager.email})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dentists */}
          <div>
            <div className="text-sm font-medium text-[#717182] mb-2">Dentists</div>
            <div className="space-y-2">
              {practice.dentists.map((dentist, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-[#030213]">
                  <Mail className="w-4 h-4 text-[#4D8EF7]" />
                  <span className="font-medium">{dentist.name}</span>
                  <span className="text-[#717182]">({dentist.email})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className={`${isResend ? "bg-[#FFF9E6] border border-[#FFE5A0]" : "bg-[#E3F2FD] border border-[#90CAF9]"} rounded-lg p-4`}>
          <p className={`text-sm ${isResend ? "text-[#F57C00]" : "text-[#1565C0]"}`}>
            {isResend
              ? 'A reminder invitation email will be sent to all managers and dentists with instructions to set up their accounts and access the platform.'
              : 'An invitation email will be sent to all managers and dentists with instructions to set up their accounts and access the platform.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
