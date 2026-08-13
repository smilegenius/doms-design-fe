import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';

// ─── Connect-email notice — automated case scoring emails ────────────────────
// Shown on every SCORED case (draft in Quick Create, created in Case Details)
// while the lab has NO business email connected: without a connection the
// automated case scoring emails can't be sent, so the notice keeps that
// visible and gives a one-click shortcut to the Email Integration settings.
// Informational only — it never blocks the case. Lab portal only (the host
// gates rendering); it disappears the moment an email account is connected.
// Body copy is the product spec's, verbatim.
export default function ConnectEmailNotice({ variant = 'detailed' }: { variant?: 'compact' | 'detailed' }) {
  const navigate = useNavigate();
  const goToSettings = () => navigate('/lab/settings?tab=notifications&sub=case-emails');

  if (variant === 'compact') {
    return (
      <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-lg bg-white border border-[#BFDBFE] text-[#1565C0] flex items-center justify-center flex-shrink-0">
            <Mail className="w-3.5 h-3.5" />
          </span>
          <p className="flex-1 min-w-0 text-[11px] text-[#3B6BAE] leading-relaxed">
            <span className="font-bold text-[#1565C0]">Email automation unavailable.</span>{' '}
            Connect your business email to automatically notify dentists when a case requires review or additional information.
          </p>
          <button
            onClick={goToSettings}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0"
            title="Open Email Integration settings"
          >
            Connect Email
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#BFDBFE] bg-[#EEF4FF] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-lg bg-white border border-[#BFDBFE] text-[#1565C0] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Mail className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[#1565C0]">Email Automation Unavailable</p>
          <p className="text-[11px] text-[#3B6BAE] leading-relaxed mt-0.5">
            Connect your business email to automatically notify dentists when a case requires review or additional information.
          </p>
        </div>
        <button
          onClick={goToSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity flex-shrink-0 mt-0.5"
          title="Open Email Integration settings"
        >
          <Mail className="w-3.5 h-3.5" />
          Connect Email
        </button>
      </div>
    </div>
  );
}
