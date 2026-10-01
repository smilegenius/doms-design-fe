import { Sparkles } from 'lucide-react';
import type { CaseCreator } from '../data/caseProvenance';

// Who made a case — a person's initials, or the Smile Genius sparkle when the
// platform created it (email → draft). Tooltip carries the name + how.
const TONES = [
  { bg: '#EEF4FF', color: '#1565C0', border: '#C8D8FC' },
  { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
  { bg: '#ECFEFF', color: '#0F766E', border: '#A5F3FC' },
  { bg: '#FFF8E1', color: '#A16207', border: '#FDE68A' },
  { bg: '#FDF2F8', color: '#BE185D', border: '#FBCFE8' },
];

function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function CreatorAvatar({ creator, size = 20, showName = false }: {
  creator: CaseCreator;
  size?: number;
  /** Render the name beside the avatar (case header); the list shows the avatar only. */
  showName?: boolean;
}) {
  const title = `Created by ${creator.name} · ${creator.detail}`;
  const tone = TONES[creator.name.length % TONES.length];
  const avatar = creator.kind === 'system' ? (
    <span
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white inline-flex items-center justify-center"
    >
      <Sparkles style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  ) : (
    <span
      style={{ width: size, height: size, minWidth: size, background: tone.bg, color: tone.color, borderColor: tone.border, fontSize: Math.max(8, size * 0.42) }}
      className="rounded-full border inline-flex items-center justify-center font-bold leading-none"
    >
      {initials(creator.name)}
    </span>
  );

  if (!showName) return <span title={title} className="inline-flex flex-shrink-0 cursor-help">{avatar}</span>;
  return (
    <span title={title} className="inline-flex items-center gap-1.5 text-[11px] text-[#5A5568] cursor-help">
      {avatar}
      <span className="truncate">
        <span className="text-[#A0A0B0]">Created by</span> <span className="font-semibold text-[#030213]">{creator.name}</span>
      </span>
    </span>
  );
}
