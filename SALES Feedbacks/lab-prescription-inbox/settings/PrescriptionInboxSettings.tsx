import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Camera, Copy, Eye, ImageIcon, Mail, Send, Sparkles } from 'lucide-react';
import Modal from '../../../src/app/components/Modal';
import { useToast } from '../../../src/app/context/ToastContext';
import { LAB_TEAM, portalDateTime, RX_INBOX, SAMPLE_PRESCRIPTIONS } from '../data';
import { draftReadyEmailRecipients, InboundRx, useRxInbox } from '../inboxStore';
import NotificationEmailModal from '../components/NotificationEmailModal';
import PrescriptionPhotoViewer from '../components/PrescriptionPhotoViewer';

// Card, step and log markup follows EmailInboxTab in
// src/app/pages/SpendSettingsPage.tsx (the invoice inbox), which isn't exported.

export default function PrescriptionInboxSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { prefs, inbound, sent } = useRxInbox();
  const [copied, setCopied] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [preview, setPreview] = useState<InboundRx | null>(null);
  const [photo, setPhoto] = useState<InboundRx | null>(null);

  const receiving = draftReadyEmailRecipients(prefs).map(e => LAB_TEAM.find(m => m.email === e)?.name ?? e);

  function copy() {
    navigator.clipboard?.writeText(RX_INBOX).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Inbox address copied to clipboard');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#030213]">Prescription Email Inbox</h2>
        <p className="text-xs text-[#717182] mt-0.5">
          Photograph paper prescriptions and email them here. AI creates a pre-filled draft case for your team to review.
        </p>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden border border-[#E0E0E6]">
        <div className="bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">Your unique prescription inbox</p>
            <p className="text-sm font-semibold text-white mt-0.5">Email prescription photos here. AI drafts the case.</p>
          </div>
        </div>
        <div className="bg-white px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 bg-[#F8F9FC] rounded-xl border border-[#E0E0E6]">
              <Mail className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0" />
              <span className="text-sm text-[#030213] truncate font-mono">{RX_INBOX}</span>
            </div>
            <button
              onClick={copy}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                copied
                  ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]'
                  : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:bg-[#F8F9FC]'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-[#717182] leading-relaxed">
            Any lab user can send a JPG, PNG, HEIC or PDF of a paper prescription to this address. Each photo becomes a draft case in Cases, with patient, practice, dentist, service, teeth, shade and material pre-filled by AI. Forward any other dentist email here too (case updates, new requests, files): it lands in Email triage, where you add it to a case or turn it into a new one.
          </p>
        </div>
      </div>

      {/* 3 feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: <Camera className="w-4 h-4 text-[#4D8EF7]" />, iconBg: 'bg-[#EEF4FF]', border: 'border-[#DBEAFE]',
            title: 'Snap & send',
            desc: 'Take a clear photo of the paper prescription and email it to the address above from any phone.',
          },
          {
            icon: <Sparkles className="w-4 h-4 text-[#7C3AED]" />, iconBg: 'bg-[#F5F3FF]', border: 'border-[#EDE9FE]',
            title: 'AI draft case',
            desc: 'The prescription is read and a draft case appears in Cases, with AI-filled fields flagged for review.',
          },
          {
            icon: <Bell className="w-4 h-4 text-[#2E7D32]" />, iconBg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]',
            title: 'Draft-ready emails',
            desc: 'Nominated users get an email as soon as a draft is ready, with a link straight to the review.',
          },
        ].map(({ icon, iconBg, border, title, desc }) => (
          <div key={title} className={`bg-white border ${border} rounded-xl p-4 hover:shadow-md transition-shadow`}>
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
              {icon}
            </div>
            <p className="text-sm font-semibold text-[#030213] mb-1.5">{title}</p>
            <p className="text-xs text-[#717182] leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Draft-ready emails now live under Notifications — same notice style
          as the "Business-critical notifications" note there. */}
      <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-white border border-[#BFDBFE] text-[#1565C0] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1565C0]">Draft-ready emails are set per user in Notifications</p>
              <p className="text-[11px] text-[#3B6BAE] leading-relaxed mt-0.5">
                {receiving.length
                  ? <>{receiving.length} user{receiving.length === 1 ? '' : 's'} currently receive{receiving.length === 1 ? 's' : ''} them: <span className="font-semibold">{receiving.join(', ')}</span>. Anyone can nominate themselves under Notification Preferences, then Prescription Email Inbox.</>
                  : <>No one receives them yet. Anyone can nominate themselves under Notification Preferences, then Prescription Email Inbox.</>}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/growth/settings?tab=notifications&focus=rx-inbox')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0 self-start sm:self-auto"
          >
            Manage notifications <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Send-from-phone steps */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#030213]">Send a prescription photo</p>
            <p className="text-xs text-[#717182] mt-0.5">No app or login needed. Email the photo from your phone.</p>
          </div>
          <button
            onClick={() => setLogsOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5A5568] border border-[#E0E0E6] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" /> View inbox activity
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#F0EFF6]">
          {[
            { client: 'iPhone', color: 'text-[#030213]', steps: ['Take the photo in Camera', 'Tap Share → Mail', 'Send to your prescription inbox'] },
            { client: 'Gmail app', color: 'text-[#EA4335]', steps: ['Compose → attach photo', 'Paste the inbox address above', 'Send, one email per patient'] },
            { client: 'Outlook app', color: 'text-[#0078D4]', steps: ['New message → Attach', 'Take or choose the photo', 'Send to your prescription inbox'] },
          ].map(({ client, color, steps }) => (
            <div key={client} className="p-5">
              <p className={`text-xs font-bold mb-3 ${color}`}>{client}</p>
              <ol className="space-y-2.5">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-xs text-[#5A5568] leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Inbox activity */}
      <Modal isOpen={logsOpen} onClose={() => setLogsOpen(false)} title="Prescription inbox activity" size="lg">
        {inbound.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#717182]">No prescription photos received yet.</p>
        ) : (
          <div className="space-y-2">
            {inbound.map(m => {
              const mail = sent.find(e => e.caseId === m.id);
              const statusClass = m.status === 'drafted' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#F3F3F5] text-[#717182]';
              return (
                <div key={m.id} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-[#F0EFF6] hover:bg-[#FAFBFF] transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#E8F5E9] text-[#2E7D32]">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-[#030213] truncate">
                        {m.photoName}{m.patientName ? `: ${m.patientName}` : ''}
                      </p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusClass}`}>
                        {m.status === 'drafted' ? 'drafted' : 'reading'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#717182] mt-0.5 truncate">{m.from}</p>
                    <p className="text-[11px] text-[#5A5568] mt-1 leading-relaxed flex items-center gap-1.5">
                      <Send className="w-3 h-3 text-[#1565C0]" />
                      {m.status === 'processing' ? 'Notification pending'
                        : mail ? `Draft-ready email sent to ${mail.to.length} user${mail.to.length === 1 ? '' : 's'}`
                        : 'No draft-ready email: no one had it turned on'}
                      {m.status === 'drafted' && (
                        <button onClick={() => setPreview(m)} className="ml-1 text-[#4D8EF7] hover:text-[#3578E5] font-medium">Preview email</button>
                      )}
                      <button onClick={() => setPhoto(m)} className="ml-2 inline-flex items-center gap-1 text-[#4D8EF7] hover:text-[#3578E5] font-medium">
                        <ImageIcon className="w-3 h-3" /> View photo
                      </button>
                    </p>
                    <p className="text-[10px] text-[#A0A0B0] mt-1">{portalDateTime(m.receivedAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      {photo && (
        <PrescriptionPhotoViewer
          open
          onClose={() => setPhoto(null)}
          sample={SAMPLE_PRESCRIPTIONS.find(x => x.id === photo.sampleId) ?? SAMPLE_PRESCRIPTIONS[0]}
          from={photo.from}
        />
      )}
      {preview && (
        <NotificationEmailModal inbound={preview} email={sent.find(e => e.caseId === preview.id)} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
