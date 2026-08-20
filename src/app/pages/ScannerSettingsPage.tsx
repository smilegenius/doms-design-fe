import { useState } from 'react';
import {
  AlertTriangle, Bell, CheckCircle2, Clock, Eye, Mail, PlayCircle, Plug, RefreshCw, ShieldAlert,
} from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useScannerReconnectFlow } from '../components/ScannerReconnect';
import {
  ConnectionHealth,
  HELP_VIDEO_LABEL,
  RECONNECT_LABEL,
  REMINDER_SCHEDULE,
  ReminderCopy,
  ReminderStage,
  ScannerConnection,
  applicableMilestones,
  connectionStatus,
  formatDate,
  remindersFor,
  simulateStage,
  useScannerConnections,
} from '../data/scannerConnections';

// ─── Settings → Scanner Connections (lab) ────────────────────────────────────
// The lab's scanner integrations and the token-expiry reminder workflow behind
// them. A token that lapses stops case imports WITHOUT the integration looking
// disconnected, so this page makes three things explicit:
//   • where every scanner's current token stands (active / expiring / expired)
//   • the reminder schedule — 30/15/5/3/1 business days before expiry, then
//     daily after it, over Email and In-App
//   • the exact copy that goes out, previewable per milestone
// Reminders are business-critical: they are always on and deliberately absent
// from Settings → Notifications (see NotificationPreferencesPage).

const SCANNER_LOGO: Record<ScannerConnection['brand'], string> = {
  iTero: '/scanner-itero.png.png',
  '3Shape': '/scanner-3shape.png.png',
  Medit: '/scanner-medit.png.png',
  Carestream: '/scanner-3shape.png.png',
};

const HEALTH_PILL: Record<ConnectionHealth, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'Active', cls: 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]', icon: CheckCircle2 },
  expiring: { label: 'Expiring soon', cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]', icon: Clock },
  expired: { label: 'Expired', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]', icon: AlertTriangle },
};

// Inline {{placeholder}} chip — same treatment as the escalation + case
// scoring email previews.
function Placeholder({ text }: { text: string }) {
  return (
    <span className="px-1 py-px rounded bg-[#EEF4FF] border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0]">
      {text}
    </span>
  );
}

function MergeInline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{[^}]+\}\})/g).map((p, i) =>
        /^\{\{[^}]+\}\}$/.test(p) ? <Placeholder key={i} text={p} /> : <span key={i}>{p}</span>
      )}
    </>
  );
}

/** Human phrasing for how far a token is from expiry. */
function expiryPhrase(businessDaysLeft: number, health: ConnectionHealth): string {
  if (health === 'expired') {
    const n = Math.abs(businessDaysLeft);
    return `Expired ${n} business day${n === 1 ? '' : 's'} ago`;
  }
  if (businessDaysLeft === 0) return 'Expires today';
  if (businessDaysLeft === 1) return 'Expires tomorrow';
  return `Expires in ${businessDaysLeft} business days`;
}

export default function ScannerSettingsPage() {
  const connections = useScannerConnections();
  const flow = useScannerReconnectFlow();
  const { user } = useAuth();
  const [preview, setPreview] = useState<ReminderCopy | null>(null);

  // The signed-in lab user resolves {{User Name}} in the previews.
  const userName = user?.name || (user?.email ? user.email.split('@')[0] : '');

  const expiringCount = connections.filter(c => connectionStatus(c).health !== 'active').length;

  return (
    <div className="space-y-6">
      {/* Why this exists */}
      <div className="rounded-xl border border-[#E0E0E6] bg-white overflow-hidden">
        <div className="flex items-start gap-3 px-6 py-5">
          <span className="w-9 h-9 rounded-lg bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center flex-shrink-0">
            <Plug className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#030213]">Scanner Connections</h3>
            <p className="text-xs text-[#717182] leading-relaxed mt-1">
              Each scanner authenticates with a token that expires after a fixed period. Once it expires Smile Genius
              can no longer import cases from that scanner — and the integration will still look connected — so we
              remind you before expiry and every day afterwards until the scanner is reconnected.
            </p>
          </div>
          {expiringCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFF8E1] text-[#B45309] border border-[#FDE68A] flex-shrink-0">
              <AlertTriangle className="w-3 h-3" />
              {expiringCount} need{expiringCount === 1 ? 's' : ''} attention
            </span>
          )}
        </div>
      </div>

      {/* Connected scanners */}
      <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#F8F9FC] border-b border-[#F0EFF6]">
          <h3 className="text-sm font-semibold text-[#030213]">Connected scanners</h3>
          <span className="text-[11px] text-[#717182]">{connections.length} connected</span>
        </div>
        <div className="divide-y divide-[#F0EFF6]">
          {connections.map(c => {
            const status = connectionStatus(c);
            const pill = HEALTH_PILL[status.health];
            const PillIcon = pill.icon;
            const fired = remindersFor(c).length;
            const milestones = applicableMilestones(c);
            // Details stack ABOVE the actions rather than beside them: the
            // Settings content column is narrow, and a side-by-side row
            // squeezes the scanner name to one character per line.
            return (
              <div key={c.id} className="px-6 py-4 flex items-start gap-3">
                <img
                  src={SCANNER_LOGO[c.brand]}
                  alt={c.brand}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[#030213]">{c.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pill.cls}`}>
                      <PillIcon className="w-2.5 h-2.5" />
                      {pill.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#717182] mt-0.5">{c.account}</p>
                  <p className="text-[11px] text-[#717182] mt-1">
                    {expiryPhrase(status.businessDaysLeft, status.health)} · token expires{' '}
                    <span className="font-semibold text-[#5A5568]">{formatDate(c.expiresAt)}</span> ·{' '}
                    {c.tokenLifetimeDays}-day lifetime
                    {c.lastReconnectedAt && ` · last reconnected ${formatDate(c.lastReconnectedAt)}`}
                  </p>
                  {fired > 0 && (
                    <p className="text-[11px] text-[#B45309] mt-1 flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      {fired} reminder{fired === 1 ? '' : 's'} sent for the current token —{' '}
                      {status.health === 'expired' ? 'continuing daily until reconnected' : 'reconnect to stop them'}
                    </p>
                  )}
                  {/* A short token is already past the earlier milestones when
                      it's issued, so say which reminders this one can send. */}
                  <p className="text-[11px] text-[#717182] mt-1">
                    {milestones.length === 0
                      ? `A ${c.tokenLifetimeDays}-day token is shorter than the earliest reminder milestone — only the daily post-expiry reminder applies.`
                      : `Pre-expiry reminders for this token: ${milestones.join(', ')} business day${milestones.length === 1 && milestones[0] === 1 ? '' : 's'} before expiry.`}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                  {/* Demo affordance — wind this scanner to any stage of the workflow. */}
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) simulateStage(c.id, e.target.value as ReminderStage); }}
                    title="Demo: jump this scanner to a reminder stage"
                    className="px-2 py-1.5 rounded-lg border border-[#E0E0E6] bg-white text-[11px] text-[#717182] focus:border-[#4D8EF7] focus:outline-none"
                  >
                    <option value="">Simulate stage…</option>
                    {REMINDER_SCHEDULE.map(r => (
                      <option key={r.stage} value={r.stage}>{r.label}</option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" icon={<PlayCircle className="w-3.5 h-3.5" />} onClick={flow.openVideo}>
                    {HELP_VIDEO_LABEL}
                  </Button>
                  <Button size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => flow.openReconnect(c)}>
                    {RECONNECT_LABEL}
                  </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reminder schedule */}
      <div className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#F8F9FC] border-b border-[#F0EFF6]">
          <h3 className="text-sm font-semibold text-[#030213]">Expiry reminder schedule</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F3F3F5] text-[#5A5568] border border-[#E0E0E6]">
            <ShieldAlert className="w-3 h-3" />
            Always on
          </span>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-[#717182] leading-relaxed mb-4">
            Scanner expiry reminders are business-critical: they are always enabled and cannot be turned off in{' '}
            <span className="font-medium text-[#5A5568]">Settings → Notifications</span>. Every reminder goes out over
            both Email and In-App, and carries a {RECONNECT_LABEL} action plus a link to the help video.
          </p>
          <div className="rounded-xl border border-[#F0EFF6] divide-y divide-[#F0EFF6]">
            {REMINDER_SCHEDULE.map(r => {
              const isExpired = r.stage === 'expired';
              return (
                <div key={r.stage} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isExpired ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#FFF8E1] text-[#B45309]'
                    }`}
                  >
                    {isExpired ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#030213]">{r.label}</p>
                    <p className="text-[11px] text-[#717182] truncate mt-0.5">{r.emailSubject}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F5F8FF] border border-[#DBEAFE] text-[10px] font-medium text-[#1565C0]">
                      <Mail className="w-2.5 h-2.5" /> Email
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F5F8FF] border border-[#DBEAFE] text-[10px] font-medium text-[#1565C0]">
                      <Bell className="w-2.5 h-2.5" /> In-App
                    </span>
                    <button
                      onClick={() => setPreview(r)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-[#4D8EF7] hover:bg-[#F5F8FF] transition-colors"
                    >
                      <Eye className="w-3 h-3" /> Preview
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#717182] mt-3 leading-relaxed">
            Reminders stop automatically as soon as the scanner is reconnected, and start again only on the next token
            cycle.
          </p>
        </div>
      </div>

      {/* Email + in-app preview, PM copy verbatim */}
      <Modal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? `${preview.label} — notification preview` : 'Notification preview'}
        size="md"
        footer={<Button variant="outline" onClick={() => setPreview(null)}>Close</Button>}
      >
        {preview && (
          <div className="space-y-4">
            {/* Email */}
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1.5">
                <Mail className="w-3 h-3" /> Email
              </p>
              <div className="rounded-lg bg-[#F8F9FC] border border-[#F0EFF6] px-4 py-2.5 mb-3">
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-0.5">Subject</p>
                <p className="text-sm font-semibold text-[#030213]"><MergeInline text={preview.emailSubject} /></p>
              </div>
              <div className="text-sm text-[#030213] leading-relaxed space-y-3">
                {preview.emailBody.map((line, i) => (
                  <p key={i} className={i === 0 ? '' : 'text-[#5A5568]'}>
                    {i === 0 && userName
                      ? `Hi ${userName},`
                      : <MergeInline text={line} />}
                  </p>
                ))}
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]">
                  {RECONNECT_LABEL}
                </span>
                <div className="pt-1">
                  <p className="text-[#030213] font-semibold text-xs">{preview.emailHelpLead}</p>
                  {preview.emailHelpBody && (
                    <p className="text-[#5A5568] text-xs mt-0.5">{preview.emailHelpBody}</p>
                  )}
                  <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#030213] bg-white border border-[#E0E0E6]">
                    <PlayCircle className="w-3.5 h-3.5" /> {HELP_VIDEO_LABEL}
                  </span>
                </div>
              </div>
            </div>

            {/* In-app */}
            <div className="border-t border-[#F0EFF6] pt-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1.5">
                <Bell className="w-3 h-3" /> In-App Notification
              </p>
              <div className="rounded-lg border border-[#E0E0E6] px-4 py-3 flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center flex-shrink-0">
                  <Plug className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-[#030213] leading-relaxed"><MergeInline text={preview.inApp} /></p>
                  <p className="text-[11px] font-semibold text-[#4D8EF7] mt-1">
                    Actions: {RECONNECT_LABEL} · {HELP_VIDEO_LABEL}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {flow.modals}
    </div>
  );
}
