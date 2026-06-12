import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Practice } from '../data/clinicsData';

interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  practices: Practice[];
  onSendBulkInvites: (practiceIds: string[]) => void;
}

export default function BulkInviteModal({
  isOpen,
  onClose,
  practices,
  onSendBulkInvites,
}: BulkInviteModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    onSendBulkInvites(practices.map((p) => p.id));
    setSending(false);
    setSent(true);

    setTimeout(() => {
      setSent(false);
      onClose();
    }, 2500);
  };

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  const totalRecipients = practices.reduce(
    (sum, p) => sum + p.managers.length + p.dentists.length,
    0
  );

  if (sent) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Invitations Sent" size="md">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-[#2E7D32]" />
          </div>
          <h3 className="text-xl font-semibold text-[#030213] mb-2">
            Invitations Sent Successfully!
          </h3>
          <p className="text-[#5A5568] mb-4">
            {practices.length} practice{practices.length !== 1 ? 's' : ''} invited ({totalRecipients} recipients)
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Send Bulk Invitations"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            loading={sending}
            icon={<Mail className="w-4 h-4" />}
          >
            Send {practices.length} Invitation{practices.length !== 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#F8F9FC] rounded-lg p-4 border border-[#E0E0E6]">
            <div className="text-sm text-[#717182] mb-1">Practices</div>
            <div className="text-2xl font-semibold text-[#030213]">{practices.length}</div>
          </div>
          <div className="bg-[#E3F2FD] rounded-lg p-4 border border-[#90CAF9]">
            <div className="text-sm text-[#1565C0] mb-1">Total Recipients</div>
            <div className="text-2xl font-semibold text-[#1565C0]">{totalRecipients}</div>
          </div>
          <div className="bg-[#FFF9E6] rounded-lg p-4 border border-[#FFE5A0]">
            <div className="text-sm text-[#F57C00] mb-1">Emails to Send</div>
            <div className="text-2xl font-semibold text-[#F57C00]">{totalRecipients}</div>
          </div>
        </div>

        {/* Practice List */}
        <div>
          <h4 className="font-semibold text-[#030213] mb-3">Selected Practices</h4>
          <div className="max-h-80 overflow-y-auto border border-[#E0E0E6] rounded-lg">
            <table className="w-full">
              <thead className="bg-[#F3F3F5] sticky top-0">
                <tr className="border-b border-[#E0E0E6]">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">
                    Practice
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-[#030213]">
                    Code
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-[#030213]">
                    Recipients
                  </th>
                </tr>
              </thead>
              <tbody>
                {practices.map((practice) => (
                  <tr
                    key={practice.id}
                    className="border-b border-[#E0E0E6] hover:bg-[#F8F9FC]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-[#030213]">
                      {practice.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5A5568]">
                      {practice.practiceCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5A5568] text-right">
                      {practice.managers.length + practice.dentists.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-[#FFF9E6] border border-[#FFE5A0] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#F57C00] mt-0.5" />
            <div>
              <h4 className="font-medium text-[#030213] mb-1">Confirm Bulk Action</h4>
              <p className="text-sm text-[#5A5568]">
                Invitation emails will be sent to all managers and dentists in the selected practices. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
