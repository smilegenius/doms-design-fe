import { useState, useEffect } from 'react';
import { X, Plus, Send } from 'lucide-react';
import Button from './Button';
import { Practice } from '../data/clinicsData';

interface Recipient {
  id: string;
  name: string;
  email: string;
}

interface InviteClinicPageProps {
  practices?: Practice[];
  onClose: () => void;
  onSendInvite: (data: {
    recipients: Recipient[];
    practiceCode: string;
    subject: string;
    body: string;
    cc?: string;
  }) => void;
}

export default function InviteClinicPage({ practices = [], onClose, onSendInvite }: InviteClinicPageProps) {
  const [clinicName, setClinicName] = useState('');
  const [email, setEmail] = useState('');
  const [practiceCode, setPracticeCode] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState("Welcome to Smile Genius – You've been invited to join Lab Abc");
  const [body, setBody] = useState(`Hi [Invitee Name],

You have been invited by Lab Abc to join the [Lab Name] team on Smile Genius. It helps you manage orders, finances, patients, and lab services easily.

To get started, please click the button below to accept your invitation and set up your account:
[Accept Invitation Button]

If you have any questions, feel free to reach out to your Lab Admin or our support team.

Looking forward to having you on board!

Best,
The Smile Genius Team`);
  const [cc, setCc] = useState('');
  const [sending, setSending] = useState(false);

  // Pre-populate recipients from provided practices
  useEffect(() => {
    if (practices && practices.length > 0) {
      const initialRecipients: Recipient[] = [];

      practices.forEach((practice) => {
        // Add managers as recipients
        practice.managers.forEach((manager, index) => {
          initialRecipients.push({
            id: `${practice.id}-manager-${index}`,
            name: `${practice.name} - ${manager.name}`,
            email: manager.email,
          });
        });

        // Add dentists as recipients
        practice.dentists.forEach((dentist, index) => {
          initialRecipients.push({
            id: `${practice.id}-dentist-${index}`,
            name: `${practice.name} - ${dentist.name}`,
            email: dentist.email,
          });
        });
      });

      setRecipients(initialRecipients);

      // Set practice code if single practice
      if (practices.length === 1) {
        setPracticeCode(practices[0].practiceCode);
      }
    }
  }, [practices]);

  const handleAddMember = () => {
    if (clinicName && email) {
      const newRecipient: Recipient = {
        id: `recipient-${Date.now()}`,
        name: clinicName,
        email: email,
      };
      setRecipients([...recipients, newRecipient]);
      setClinicName('');
      setEmail('');
    }
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients(recipients.filter((r) => r.id !== id));
  };

  const handleSendInvite = async () => {
    if (recipients.length === 0) return;

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    onSendInvite({
      recipients,
      practiceCode,
      subject,
      body,
      cc: cc || undefined,
    });

    setSending(false);
  };

  const canSend = recipients.length > 0 && practiceCode && subject && body;

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#030213] mb-2">
            {practices && practices.length > 1 ? `Invite ${practices.length} Clinics` : 'Invite Clinic'}
          </h1>
          <p className="text-sm sm:text-base text-[#717182]">
            {practices && practices.length > 0
              ? `Send invitations to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''} from ${practices.length} practice${practices.length !== 1 ? 's' : ''}`
              : 'Send an invitation to Clinics'}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg border border-[#E0E0E6] p-4 sm:p-6 space-y-6">
          {/* Invite by email section */}
          <div>
            <h2 className="text-sm font-semibold text-[#030213] mb-4">Invite by email</h2>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-[#030213] mb-2">
                  Clinic Name*
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="[Name]"
                  className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-[#030213] mb-2">
                  Email*
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="[Email Email]"
                  className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-[#030213] mb-2">
                  Practice Code
                </label>
                <input
                  type="text"
                  value={practiceCode}
                  onChange={(e) => setPracticeCode(e.target.value)}
                  placeholder="[Enter Code]"
                  className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
                />
              </div>

              <div className="md:col-span-2 flex items-end">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleAddMember}
                  disabled={!clinicName || !email}
                  className="w-full whitespace-nowrap"
                >
                  Add Member
                </Button>
              </div>
            </div>

            {/* Recipients Tags */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F3F2FF] text-[#4D8EF7] rounded-full text-sm"
                  >
                    <span>{recipient.name}</span>
                    <button
                      onClick={() => handleRemoveRecipient(recipient.id)}
                      className="hover:text-[#D4183D] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Send Invite Button */}
            <Button
              variant="primary"
              icon={<Send className="w-4 h-4" />}
              onClick={handleSendInvite}
              loading={sending}
              disabled={!canSend}
              className="w-full"
            >
              Send Invite
            </Button>
          </div>

          {/* Email Copy Section */}
          <div className="pt-6 border-t border-[#E0E0E6]">
            <h2 className="text-sm font-semibold text-[#030213] mb-4">Invite email copy</h2>

            {/* Subject */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-[#030213]">
                  Subject
                </label>
                <button className="text-xs text-[#4D8EF7] hover:underline">
                  CC
                </button>
              </div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-medium text-[#030213] mb-2">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full px-4 py-3 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] resize-none"
              />

              {/* Rich Text Editor Toolbar */}
              <div className="flex items-center gap-1 mt-2 p-2 bg-[#F8F9FC] rounded border border-[#E0E0E6] flex-wrap">
                <select className="px-2 py-1 text-xs bg-white border border-[#E0E0E6] rounded hover:bg-[#F8F9FC]">
                  <option>Sans Serif</option>
                </select>
                <div className="w-px h-5 bg-[#E0E0E6] mx-1" />
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213] text-xs">
                  TT
                </button>
                <div className="w-px h-5 bg-[#E0E0E6] mx-1" />
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm font-bold">B</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm italic">I</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm underline">U</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm">A</span>
                </button>
                <div className="w-px h-5 bg-[#E0E0E6] mx-1" />
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm">≡</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm">•</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm">1.</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm">⇄</span>
                </button>
                <button className="p-1.5 hover:bg-white rounded text-[#717182] hover:text-[#030213]">
                  <span className="text-sm">···</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
