// ─── New Case Flow · Teeth Chart ─────────────────────────────────────────────
// The portal's own InteractiveToothChart (two arches, FDI artwork, "Select
// Arch", teal selection), used as it is. This wrapper only adds what the flow
// needs on top of it, in a pointer-transparent overlay with the same viewBox:
// bridge pontics, recorded-missing teeth, implants on record, teeth used by
// another service, a dimmed arch for arch-limited items, and keyboard access
// (each tooth is a focusable button with an accessible name).

import { useState } from 'react';
import { InteractiveToothChart } from '../pages/CreateCasePage';
import { archTeethIds, jawOf, toothName, Notation, toothText } from './rules';
import type { Arch } from './data';

// Hit-area centres from InteractiveToothChart (viewBox 0 0 327 555).
const TEETH: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  '11': { cx: 144, cy: 44, rx: 12, ry: 11 }, '12': { cx: 108, cy: 51, rx: 11, ry: 10 }, '13': { cx: 81, cy: 67, rx: 14, ry: 13 },
  '14': { cx: 68, cy: 97, rx: 15, ry: 15 }, '15': { cx: 57, cy: 129, rx: 17, ry: 15 }, '16': { cx: 46, cy: 166, rx: 22, ry: 22 },
  '17': { cx: 42, cy: 209, rx: 20, ry: 19 }, '18': { cx: 42, cy: 247, rx: 20, ry: 18 },
  '21': { cx: 184, cy: 44, rx: 12, ry: 11 }, '22': { cx: 219, cy: 51, rx: 11, ry: 10 }, '23': { cx: 246, cy: 67, rx: 14, ry: 13 },
  '24': { cx: 259, cy: 97, rx: 15, ry: 15 }, '25': { cx: 270, cy: 129, rx: 17, ry: 15 }, '26': { cx: 280, cy: 166, rx: 22, ry: 22 },
  '27': { cx: 284, cy: 209, rx: 20, ry: 19 }, '28': { cx: 284, cy: 247, rx: 20, ry: 18 },
  '48': { cx: 49, cy: 332, rx: 21, ry: 18 }, '47': { cx: 57, cy: 370, rx: 22, ry: 21 }, '46': { cx: 66, cy: 411, rx: 22, ry: 22 },
  '45': { cx: 71, cy: 447, rx: 16, ry: 15 }, '44': { cx: 83, cy: 474, rx: 15, ry: 14 }, '43': { cx: 102, cy: 496, rx: 16, ry: 17 },
  '42': { cx: 126, cy: 511, rx: 13, ry: 11 }, '41': { cx: 151, cy: 520, rx: 11, ry: 6 },
  '31': { cx: 175, cy: 520, rx: 11, ry: 6 }, '32': { cx: 200, cy: 511, rx: 13, ry: 11 }, '33': { cx: 224, cy: 496, rx: 16, ry: 17 },
  '34': { cx: 242, cy: 474, rx: 15, ry: 14 }, '35': { cx: 254, cy: 447, rx: 16, ry: 15 }, '36': { cx: 260, cy: 412, rx: 22, ry: 22 },
  '37': { cx: 269, cy: 372, rx: 22, ry: 21 }, '38': { cx: 277, cy: 333, rx: 21, ry: 18 },
};
const ARCH_HIT = { upper: 190, lower: 408 };

export interface ChartProps {
  /** Teeth lit teal (FDI ids). */
  selected: string[];
  /** Arch services light the whole arch. */
  arch?: Arch;
  pontics?: string[];
  missing?: string[];
  implants?: string[];
  otherTeeth?: string[];
  /** Arch-limited items: only this arch is tappable. */
  limitArch?: 'upper' | 'lower';
  /** Called with the FDI id of a tapped tooth. */
  onTooth?: (id: string) => void;
  /** "Select Arch" / arch mode. */
  onArch?: (jaw: 'upper' | 'lower') => void;
  /** Multi mode: "Select Arch" sets the teeth of that jaw at once. */
  onSetTeeth?: (teeth: string[]) => void;
  archMode?: boolean;
  width?: number;
  readOnly?: boolean;
  notation?: Notation;
  label?: string;
}

export default function TeethChart({
  selected, arch, pontics = [], missing = [], implants = [], otherTeeth = [], limitArch,
  onTooth, onArch, onSetTeeth, archMode, width = 260, readOnly, notation = 'fdi', label,
}: ChartProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const lit = arch ? archTeethIds(arch) : selected.filter(t => !pontics.includes(t));
  const service = { itemId: 'flow', teeth: lit } as Parameters<typeof InteractiveToothChart>[0]['activeService'];
  const noop = () => {};

  const toothLabel = (id: string) => {
    const state = [
      lit.includes(id) ? 'selected' : null,
      pontics.includes(id) ? 'pontic' : null,
      missing.includes(id) ? 'recorded as missing' : null,
      implants.includes(id) ? 'implant on record' : null,
      otherTeeth.includes(id) ? 'in another service' : null,
    ].filter(Boolean).join(', ');
    return `Tooth ${notation === 'palmer' ? toothText(id, 'palmer') : `${id}, ${toothName(id)}`}${state ? `, ${state}` : ''}`;
  };

  return (
    <div
      className={`relative ${readOnly ? 'pointer-events-none' : ''} [&>div>div:first-child]:hidden [&>div>div:nth-child(2)]:!mt-0`}
      style={{ width }}
      role={readOnly ? 'img' : undefined}
      aria-label={readOnly ? label : undefined}
    >
      <InteractiveToothChart
        activeService={service}
        width={width}
        onToothToggle={readOnly ? noop : (id => (archMode ? onArch?.(jawOf(id)) : onTooth?.(id)))}
        onTeethSet={!readOnly && onSetTeeth ? onSetTeeth : undefined}
        onArchToggle={!readOnly && archMode ? (jaw => onArch?.(jaw)) : undefined}
      />
      <svg viewBox="0 0 327 555" className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} aria-hidden={readOnly || undefined}>
        <defs>
          <pattern id="nc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#9A9AAA" strokeWidth="2" />
          </pattern>
        </defs>
        {limitArch && (
          <rect x="0" y={limitArch === 'upper' ? 290 : 0} width="327" height="265" fill="rgba(255,255,255,0.6)" />
        )}
        {Object.entries(TEETH).map(([id, t]) => (
          <g key={id}>
            {otherTeeth.includes(id) && !lit.includes(id) && <ellipse cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill="rgba(110,110,130,0.28)" />}
            {missing.includes(id) && (
              <>
                <ellipse cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill="rgba(240,240,244,0.92)" />
                <ellipse cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill="url(#nc-hatch)" opacity="0.5" />
              </>
            )}
            {pontics.includes(id) && (
              <ellipse cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill="rgba(89,193,227,0.22)" stroke="#2A8DB0" strokeWidth={1.6} strokeDasharray="4 3" />
            )}
            {implants.includes(id) && (
              <g>
                <circle cx={t.cx} cy={t.cy} r={6} fill="#6A5CE8" stroke="#fff" strokeWidth={1.5} />
                <rect x={t.cx - 1} y={t.cy - 3.5} width={2} height={7} fill="#fff" />
              </g>
            )}
            {focused === id && <ellipse cx={t.cx} cy={t.cy} rx={t.rx + 4} ry={t.ry + 4} fill="none" stroke="#3F6FE8" strokeWidth={2.5} />}
          </g>
        ))}
        {!readOnly && (['upper', 'lower'] as const).map(jaw => (onArch || onSetTeeth) && (
          <ellipse
            key={jaw}
            cx={163} cy={ARCH_HIT[jaw]} rx={72} ry={46}
            fill="none"
            stroke={focused === `arch-${jaw}` ? '#3F6FE8' : 'none'}
            strokeWidth={2.5}
            tabIndex={0}
            role="button"
            aria-label={`Select ${jaw} arch`}
            aria-pressed={archTeethIds(jaw).every(t => lit.includes(t))}
            onFocus={() => setFocused(`arch-${jaw}`)}
            onBlur={() => setFocused(null)}
            onKeyDown={e => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (archMode || !onSetTeeth) { onArch?.(jaw); return; }
              const ids = archTeethIds(jaw).filter(t => !missing.includes(t));
              const others = selected.filter(t => jawOf(t) !== jaw);
              onSetTeeth(ids.every(t => selected.includes(t)) ? others : [...others, ...ids]);
            }}
            style={{ outline: 'none' }}
          />
        ))}
        {!readOnly && Object.entries(TEETH).map(([id, t]) => (
          <ellipse
            key={`k-${id}`}
            cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={toothLabel(id)}
            aria-pressed={lit.includes(id) || pontics.includes(id)}
            onFocus={() => setFocused(id)}
            onBlur={() => setFocused(null)}
            onKeyDown={e => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (archMode) onArch?.(jawOf(id)); else onTooth?.(id);
            }}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>
    </div>
  );
}

/** Small read-only chart for the summary rail and Review. */
export function MiniChart({ teeth, arch, pontics, width = 64, label }: { teeth: string[]; arch?: Arch; pontics?: string[]; width?: number; label: string }) {
  return <TeethChart selected={teeth} arch={arch} pontics={pontics} width={width} readOnly label={label} />;
}

export function ChartLegend({ items }: { items: ('selected' | 'pontic' | 'missing' | 'implant' | 'other')[] }) {
  const map = {
    selected: { label: 'Selected', el: <span className="w-3 h-3 rounded-full bg-[rgba(89,193,227,0.62)] border border-[#3FA8CA]" /> },
    pontic: { label: 'Pontic', el: <span className="w-3 h-3 rounded-full bg-[rgba(89,193,227,0.22)] border border-dashed border-[#2A8DB0]" /> },
    missing: { label: 'Recorded missing', el: <span className="w-3 h-3 rounded-full bg-[#EDEDF2] border border-[#B8B8C6]" /> },
    implant: { label: 'Implant on record', el: <span className="w-3 h-3 rounded-full bg-[#6A5CE8]" /> },
    other: { label: 'In another service', el: <span className="w-3 h-3 rounded-full bg-[rgba(110,110,130,0.35)]" /> },
  };
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map(k => (
        <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-[#4A4A5A]">{map[k].el}{map[k].label}</span>
      ))}
    </div>
  );
}
