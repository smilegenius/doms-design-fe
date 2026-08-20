import { ReactNode, useState } from 'react';
import { Check, ExternalLink, PlayCircle, Plug, RefreshCw, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { useToast } from '../context/ToastContext';
import {
  HELP_VIDEO_LABEL,
  HELP_VIDEO_URL,
  RECONNECT_LABEL,
  ScannerConnection,
  formatDate,
  reconnectScanner,
} from '../data/scannerConnections';

// ─── Scanner reconnect + help video ──────────────────────────────────────────
// Every scanner token-expiry notification carries the same two actions —
// "Reconnect Scanner" and "Watch Video" — so the banner, the notification
// feed, the bell popover and the Settings page all drive the SAME two modals
// through `useScannerReconnectFlow()`. Each surface renders `flow.modals` once
// and calls `flow.openReconnect(scanner)` / `flow.openVideo()` from its CTAs.

// ── Reconnect modal ───────────────────────────────────────────────────────────
// Mirrors the Email Integration connect flow: an explanation of what the
// vendor hand-off does, then a simulated OAuth round-trip, then the new token
// window. Confirming issues a fresh token, which stops every pending reminder.
function ReconnectScannerModal({ connection, onClose, onWatchVideo }: {
  connection: ScannerConnection;
  onClose: () => void;
  onWatchVideo: () => void;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<'intro' | 'connecting' | 'done'>('intro');
  const [newExpiry, setNewExpiry] = useState<string>('');

  function reconnect() {
    setPhase('connecting');
    // Simulated vendor OAuth round-trip.
    window.setTimeout(() => {
      const now = new Date();
      reconnectScanner(connection.id, now);
      setNewExpiry(formatDate(new Date(now.getTime() + connection.tokenLifetimeDays * 24 * 60 * 60 * 1000)));
      setPhase('done');
      toast.success(`${connection.name} reconnected — expiry reminders stopped`);
    }, 900);
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={phase === 'done' ? 'Scanner reconnected' : RECONNECT_LABEL}
      size="md"
      footer={
        phase === 'done' ? (
          <Button onClick={onClose} icon={<Check className="w-4 h-4" />}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={reconnect}
              loading={phase === 'connecting'}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {RECONNECT_LABEL}
            </Button>
          </>
        )
      }
    >
      {phase === 'done' ? (
        <div className="text-center py-2">
          <span className="w-14 h-14 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] inline-flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-[#047857]" />
          </span>
          <p className="text-base font-semibold text-[#030213]">{connection.name} is connected</p>
          <p className="text-sm text-[#5A5568] mt-1 leading-relaxed">
            Automatic case imports have resumed. All expiry reminders for this scanner have stopped.
          </p>
          <div className="mt-4 rounded-xl border border-[#E0E0E6] divide-y divide-[#F0EFF6] text-sm text-left">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[#717182]">New token expires</span>
              <span className="font-semibold text-[#030213]">{newExpiry}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[#717182]">Token lifetime</span>
              <span className="font-semibold text-[#030213]">{connection.tokenLifetimeDays} days</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#E0E0E6] px-4 py-3">
            <span className="w-9 h-9 rounded-lg bg-[#ECFEFF] text-[#0F766E] flex items-center justify-center flex-shrink-0">
              <Plug className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#030213]">{connection.name}</p>
              <p className="text-xs text-[#717182] mt-0.5">{connection.account}</p>
              <p className="text-xs text-[#717182] mt-0.5">
                Current token expires {formatDate(connection.expiresAt)} · {connection.tokenLifetimeDays}-day lifetime
              </p>
            </div>
          </div>
          <p className="text-sm text-[#5A5568] leading-relaxed">
            Reconnecting signs in to {connection.brand} again and issues a fresh {connection.tokenLifetimeDays}-day
            token. Case imports resume immediately and all expiry reminders for this scanner stop.
          </p>
          <button
            onClick={onWatchVideo}
            className="w-full flex items-center gap-2.5 rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-2.5 text-left hover:bg-[#E4EDFF] transition-colors"
          >
            <PlayCircle className="w-4 h-4 text-[#1565C0] flex-shrink-0" />
            <span className="text-xs text-[#3B6BAE] leading-relaxed">
              <span className="font-bold text-[#1565C0]">Need help?</span> Watch the step-by-step video guide on
              reconnecting your scanner.
            </span>
          </button>
        </div>
      )}
    </Modal>
  );
}

// ── Help video modal ──────────────────────────────────────────────────────────
// The "Watch Video" CTA carried by every expiry notification. The player is a
// placeholder frame until the real asset is hosted; the link out always works.
function HelpVideoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="How to reconnect your scanner"
      size="lg"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-[#030213] aspect-video flex flex-col items-center justify-center text-center px-6">
          <PlayCircle className="w-14 h-14 text-white/80 mb-3" />
          <p className="text-sm font-semibold text-white">Reconnecting your scanner</p>
          <p className="text-xs text-white/60 mt-1">Step-by-step video guide · 2 min</p>
        </div>
        <ol className="space-y-2 text-sm text-[#5A5568]">
          {[
            'Open Settings → Scanner Connections in your lab portal.',
            'Find the scanner showing an expiring or expired token.',
            'Select Reconnect Scanner and sign in to your scanner account.',
            'Confirm the new connection — case imports resume straight away.',
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#EEF4FF] text-[#1565C0] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <a
          href={HELP_VIDEO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
        >
          Open the guide in the Help Centre <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </Modal>
  );
}

// ── Shared flow ───────────────────────────────────────────────────────────────
export interface ScannerReconnectFlow {
  openReconnect: (connection: ScannerConnection) => void;
  openVideo: () => void;
  /** Render once per surface — holds whichever modal is open. */
  modals: ReactNode;
}

export function useScannerReconnectFlow(): ScannerReconnectFlow {
  const [reconnecting, setReconnecting] = useState<ScannerConnection | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  return {
    openReconnect: (connection) => setReconnecting(connection),
    openVideo: () => setVideoOpen(true),
    modals: (
      <>
        {reconnecting && (
          <ReconnectScannerModal
            connection={reconnecting}
            onClose={() => setReconnecting(null)}
            onWatchVideo={() => setVideoOpen(true)}
          />
        )}
        {videoOpen && <HelpVideoModal onClose={() => setVideoOpen(false)} />}
      </>
    ),
  };
}

export { HELP_VIDEO_LABEL, RECONNECT_LABEL };
