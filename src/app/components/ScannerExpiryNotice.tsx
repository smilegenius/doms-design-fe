import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, PlayCircle, Plug, RefreshCw } from 'lucide-react';
import {
  HELP_VIDEO_LABEL,
  RECONNECT_LABEL,
  connectionStatus,
  copyForStage,
  formatDate,
  mostUrgentAlert,
  resolvePlaceholders,
  useScannerConnections,
} from '../data/scannerConnections';
import { useScannerReconnectFlow } from './ScannerReconnect';

// ─── Scanner token-expiry notice ─────────────────────────────────────────────
// A lapsed scanner token doesn't show up as a disconnected integration, so the
// lab can stop receiving cases without noticing. This banner keeps the current
// reminder stage visible in the lab's own workflow (Overview + Cases) with the
// same two actions every notification carries — Reconnect Scanner and Watch
// Video — plus a shortcut to the connection settings.
//
// Informational only: it never blocks a case or a page. It shows the single
// most urgent scanner (expired outranks expiring) and disappears the moment
// that scanner is reconnected. Lab portal only — the host gates rendering.
export default function ScannerExpiryNotice({ variant = 'detailed', className = '' }: {
  variant?: 'compact' | 'detailed';
  className?: string;
}) {
  const navigate = useNavigate();
  const connections = useScannerConnections();
  const flow = useScannerReconnectFlow();

  const alert = mostUrgentAlert(connections);
  if (!alert) return null;

  const { connection } = alert;
  const status = connectionStatus(connection);
  const expired = status.health === 'expired';
  const copy = copyForStage(status.stage ?? 'expired');
  const message = resolvePlaceholders(copy.inApp, { scannerName: connection.name, userName: '' });

  // Expired is the red state (imports are already stopped); every pre-expiry
  // milestone is amber (imports still running, action needed).
  const tone = expired
    ? { border: '#FECACA', bg: '#FEF2F2', chipBorder: '#FECACA', icon: '#B91C1C', title: '#B91C1C', body: '#9F2A2A' }
    : { border: '#FDE68A', bg: '#FFF8E1', chipBorder: '#FDE68A', icon: '#B45309', title: '#B45309', body: '#92610A' };

  const heading = expired ? 'Scanner Connection Expired' : `${connection.name} connection expires soon`;
  const Icon = expired ? AlertTriangle : Plug;

  const goToSettings = () => navigate('/lab/settings?tab=scanners');

  if (variant === 'compact') {
    return (
      <div className={`rounded-xl border px-4 py-2.5 ${className}`} style={{ borderColor: tone.border, background: tone.bg }}>
        <div className="flex items-center gap-2.5">
          <span
            className="w-6 h-6 rounded-lg bg-white border flex items-center justify-center flex-shrink-0"
            style={{ borderColor: tone.chipBorder, color: tone.icon }}
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
          <p className="flex-1 min-w-0 text-[11px] leading-relaxed" style={{ color: tone.body }}>
            <span className="font-bold" style={{ color: tone.title }}>{heading}.</span> {message}
          </p>
          <button
            onClick={() => flow.openReconnect(connection)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0"
          >
            {RECONNECT_LABEL}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {flow.modals}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${className}`} style={{ borderColor: tone.border, background: tone.bg }}>
      <div className="flex items-start gap-2.5">
        <span
          className="w-6 h-6 rounded-lg bg-white border flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ borderColor: tone.chipBorder, color: tone.icon }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: tone.title }}>{heading}</p>
          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: tone.body }}>{message}</p>
          <p className="text-[10px] mt-1" style={{ color: tone.body }}>
            {expired
              ? `Expired ${formatDate(connection.expiresAt)} · reminders continue daily until you reconnect`
              : `Token expires ${formatDate(connection.expiresAt)} · ${connection.account}`}
            {' · '}
            <button onClick={goToSettings} className="font-semibold underline underline-offset-2 hover:opacity-80">
              Scanner settings
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <button
            onClick={flow.openVideo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#030213] bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            {HELP_VIDEO_LABEL}
          </button>
          <button
            onClick={() => flow.openReconnect(connection)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {RECONNECT_LABEL}
          </button>
        </div>
      </div>
      {flow.modals}
    </div>
  );
}
