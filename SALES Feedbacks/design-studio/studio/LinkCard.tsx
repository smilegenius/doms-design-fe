import { useEffect, useState } from 'react';
import { Copy, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import { DesignVersion, ReviewLink, studioDate } from '../data/designStudio';

export const reviewUrl = (token: string) => `${window.location.origin}/review/${token}`;

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return studioDate(iso);
}

export function linkStatus(link: ReviewLink) {
  if (link.submittedAt) return { label: 'Feedback received', cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' };
  if (link.openedAt) return { label: `Opened ${ago(link.openedAt)}`, cls: 'bg-[#E3F2FD] text-[#1565C0] border-[#E3F2FD]' };
  return { label: 'Not opened yet', cls: 'bg-[#F8F9FC] text-[#717182] border-[#E0E0E6]' };
}

export default function LinkCard({ link, version }: { link: ReviewLink; version: DesignVersion }) {
  const { toast } = useToast();
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick(t => t + 1), 30_000); return () => window.clearInterval(id); }, []);
  const url = reviewUrl(link.token);
  const status = linkStatus(link);

  const copy = (text: string, msg: string) => { navigator.clipboard?.writeText(text).catch(() => {}); toast.success(msg); };
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC] transition-colors';

  return (
    <div className="rounded-xl border border-[#E0E0E6] bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-semibold text-[#030213]">Review link · {link.recipientName}</p>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${status.cls}`}>{status.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <input readOnly value={url} onFocus={e => e.target.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E0E0E6] bg-[#F8F9FC] text-xs font-mono text-[#030213] focus:outline-none" />
        <button onClick={() => copy(url, 'Review link copied')} className={btn}><Copy className="w-3.5 h-3.5" /> Copy</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <a href={url} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="w-3.5 h-3.5" /> Preview as dentist</a>
        <button onClick={() => toast.success(`Review link resent to ${link.recipientName}`)} className={btn}><Send className="w-3.5 h-3.5" /> Resend</button>
        <button
          onClick={() => copy(`${version.note ? `${version.note}\n\n` : ''}Review the design for Version ${version.number} here (no login needed): ${url}`, 'Copied for WhatsApp')}
          className={btn}
        >
          <MessageCircle className="w-3.5 h-3.5" /> Copy for WhatsApp
        </button>
        <span className="text-[11px] text-[#A0A0B0] ml-auto">Expires {studioDate(link.expiresAt)} · {link.recipientEmail}</span>
      </div>
    </div>
  );
}
