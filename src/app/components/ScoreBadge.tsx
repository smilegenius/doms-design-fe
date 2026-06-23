import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { CaseScore } from '../data/caseScoring';

// ─── Case completeness score badge ───────────────────────────────────────────
// Shared between the Cases list, the Case Detail page and the QuickCreate draft
// screen so the score reads identically everywhere: RAG-coloured % for scored
// services, a muted "No score" chip when scoring isn't set up, or an amber
// "Score unavailable" chip when scoring is out of sync with the Prescription
// Builder (clickable for the lab to fix).

const SCORE_BAND_STYLES: Record<'red' | 'amber' | 'green', string> = {
  green: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  amber: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]',
  red:   'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
};
const SCORE_TEXT: Record<'red' | 'amber' | 'green', string> = {
  green: 'text-[#047857]', amber: 'text-[#B45309]', red: 'text-[#B91C1C]',
};

// Full hover tooltip — the per-field breakdown.
function scoreDetail(score: CaseScore): string {
  const head = `${score.tierLabel} — ${score.percent}% (${score.earned}/${score.total} weight)`;
  const lines = score.services
    .filter(s => s.configured)
    .flatMap(s => s.fields.map(f => `${f.filled ? '✓' : '✗'} ${f.label}${f.weight ? ` · ${f.weight}` : ''}`));
  return [head, ...lines].join('\n');
}

// A round score badge (colour = band, number = completeness %). With
// `withDetails` it also prints the tier label + what's missing (or earned/total)
// beside the circle so the score reads at a glance — no hover needed.
export function ScoreBadge({ score, size = 'sm', onFix, withDetails, compact }: { score: CaseScore; size?: 'sm' | 'xs'; onFix?: () => void; withDetails?: boolean; compact?: boolean }) {
  const dim = size === 'xs' ? 'w-7 h-7 text-[9px]' : 'w-8 h-8 text-[10px]';
  const base = `${dim} rounded-full inline-flex items-center justify-center font-bold border flex-shrink-0`;
  // `compact` keeps the "Missing: …" line to ONE line (truncated) with a chevron
  // that reveals the full list in a small click-popover — used inside the case
  // detail / draft screen where a wrapped 2-line list looks cramped.
  const [open, setOpen] = useState(false);

  let badge: React.ReactNode;
  let label = '';
  let sub = '';
  let labelCls = '';
  let missing: string[] = [];

  if (score.unavailable) {
    // Out of sync with the Prescription Builder — only the lab (onFix) can fix it.
    const cls = `${base} bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]`;
    const icon = <AlertTriangle className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />;
    badge = onFix
      ? <button onClick={(e) => { e.stopPropagation(); onFix(); }} title="Score unavailable — scoring is out of sync with the Prescription Builder. Click to set it up." className={`${cls} hover:bg-[#FFEDD5] transition-colors`}>{icon}</button>
      : <span title="Score unavailable — the lab is updating scoring for this service." className={cls}>{icon}</span>;
    label = 'Score unavailable'; sub = onFix ? 'Set up scoring' : 'out of sync'; labelCls = 'text-[#C2410C]';
  } else if (!score.applicable) {
    badge = (
      <span title="No scoring set up for this service type" className={`${dim} rounded-full inline-flex items-center justify-center font-semibold border border-dashed bg-[#F8F9FC] text-[#A0A0B0] border-[#D4CEE1] flex-shrink-0`}>–</span>
    );
    label = 'No score'; sub = 'not set up'; labelCls = 'text-[#A0A0B0]';
  } else {
    badge = <span title={scoreDetail(score)} className={`${base} ${SCORE_BAND_STYLES[score.band]}`}>{score.percent}</span>;
    label = score.tierLabel; labelCls = SCORE_TEXT[score.band];
    // For anything short of complete, surface WHAT is missing — not just the
    // numbers — so the gap is readable without hovering.
    missing = score.services.filter(s => s.configured).flatMap(s => s.fields.filter(f => !f.filled).map(f => f.label));
    sub = missing.length ? `Missing: ${missing.join(', ')}` : `${score.earned}/${score.total} weight`;
  }

  if (!withDetails) return <>{badge}</>;

  // Compact: keep everything on one line, reveal the full missing list on click.
  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        {badge}
        <span className="leading-tight min-w-0 max-w-[260px]">
          <span className={`block text-[11px] font-semibold truncate ${labelCls}`}>{label}</span>
          <span className="relative flex items-center gap-1 min-w-0">
            <span className="block text-[10px] text-[#A0A0B0] truncate">{sub}</span>
            {missing.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                  title="Show all missing items"
                  className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <>
                    <span className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
                    <span className="absolute top-full left-0 mt-1 z-30 w-56 rounded-lg border border-[#E0E0E6] bg-white shadow-lg p-2.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1">Missing requirements</span>
                      <span className="block space-y-0.5">
                        {missing.map((m) => (
                          <span key={m} className="flex items-center gap-1.5 text-[11px] text-[#5A5568]">
                            <span className="w-1 h-1 rounded-full bg-[#B45309] flex-shrink-0" />
                            {m}
                          </span>
                        ))}
                      </span>
                    </span>
                  </>
                )}
              </>
            )}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {badge}
      <span className="leading-tight min-w-0 max-w-[220px]">
        <span className={`block text-[11px] font-semibold truncate ${labelCls}`}>{label}</span>
        <span className="block text-[10px] text-[#A0A0B0] whitespace-normal leading-tight">{sub}</span>
      </span>
    </span>
  );
}
