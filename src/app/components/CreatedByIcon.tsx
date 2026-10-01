import { Microscope } from 'lucide-react';
import type { CaseCreatedBy } from '../data/caseProvenance';

// The molar from the Cases nav icon (components/icons/CasesIcon), without the
// scanner brackets — a dental clinic reads as a tooth, not a stethoscope.
function ToothIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="4.5 4.5 9 10.8" fill="none" style={style} aria-hidden>
      <path
        d="M5 7C5 5.7 6 5 7.2 5C8 5 8.5 5.3 8.7 5.7C8.85 5.95 9.15 5.95 9.3 5.7C9.5 5.3 10 5 10.8 5C12 5 13 5.7 13 7C13 8.5 12.7 10 12.2 11.5C12 12.3 11.8 13.5 11.5 14.3C11.3 14.85 10.4 14.85 10.2 14.3L9.6 12.4C9.5 12 8.5 12 8.4 12.4L7.8 14.3C7.6 14.85 6.7 14.85 6.5 14.3C6.2 13.5 6 12.3 5.8 11.5C5.3 10 5 8.5 5 7Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Which side made a case — the clinic or the lab — as a small icon tile in
// each portal's own accent (clinic violet, lab teal, as on the portal picker).
// Tooltip names the practice / lab and how the case was made.
const SIDE = {
  clinic: { label: 'Clinic', Icon: ToothIcon,  bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  lab:    { label: 'Lab',    Icon: Microscope, bg: '#ECFEFF', color: '#0F766E', border: '#A5F3FC' },
} as const;

export default function CreatedByIcon({ createdBy, size = 20, showName = false }: {
  createdBy: CaseCreatedBy;
  size?: number;
  /** Write "Created by Clinic" beside the icon (case header — the practice / lab is already on the card). */
  showName?: boolean;
}) {
  const s = SIDE[createdBy.side];
  const title = `Created by the ${s.label.toLowerCase()} — ${createdBy.org} · ${createdBy.detail}`;
  const icon = (
    <span
      style={{ width: size, height: size, minWidth: size, background: s.bg, color: s.color, borderColor: s.border }}
      className="rounded-md border inline-flex items-center justify-center"
    >
      <s.Icon style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );

  if (!showName) return <span title={title} className="inline-flex flex-shrink-0 cursor-help">{icon}</span>;
  return (
    <span title={title} className="inline-flex items-center gap-1.5 text-[11px] text-[#5A5568] cursor-help min-w-0">
      {icon}
      <span className="truncate">
        <span className="text-[#A0A0B0]">Created by</span>{' '}
        <span className="font-semibold" style={{ color: s.color }}>{s.label}</span>
      </span>
    </span>
  );
}
