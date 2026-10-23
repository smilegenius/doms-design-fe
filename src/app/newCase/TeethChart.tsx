// ─── New Case Flow · Teeth Chart ─────────────────────────────────────────────
// A horizontal dental chart, viewer facing the patient: the upper row
// 18 … 11 | 21 … 28 with crowns pointing down, the lower row 48 … 41 | 31 … 38
// with crowns up, the two crown rows facing each other across the occlusal
// plane, a midline and the quadrants (UR · UL · LR · LL). The teeth are
// anatomical buccal-view shapes (ToothShapes.tsx) at their real relative
// widths, each tooth's number next to its crown.
//
// Every tooth is a real button with the same accessible name as before
// ("Tooth 36, lower left 6"); one of them is in the tab order, ←/→ move along
// a row, ↑/↓ switch rows (the nearest tooth), Home/End jump to a row's ends.
// "Select Upper Arch" / "Select Lower Arch" share a row above the chart (on a
// narrow chart, one above and one below the rows).
// The chart shows bridge pontics, recorded-missing teeth, implants on record,
// teeth used by another service and, for arch-limited items, dims the other jaw.
//
// MiniChart (summary rail, Review) keeps the portal's two-arch artwork.

import { KeyboardEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { InteractiveToothChart } from '../pages/CreateCasePage';
import { LOWER_ORDER, UPPER_ORDER, archTeethIds, jawOf, palmerOf, toothName, Notation, toothText } from './rules';
import type { Arch } from './data';
import { CHART_W, HALF_W, MID_HALF, NARROWEST_SLOT, ToothDefs, ToothLook, ToothSvg, slotOf, toothX } from './ToothShapes';
import { FOCUS } from './ui';

type Jaw = 'upper' | 'lower';
/** Each row left to right as the viewer sees it. */
const ROWS: Record<Jaw, string[]> = { upper: UPPER_ORDER, lower: LOWER_ORDER };
const ALL = [...UPPER_ORDER, ...LOWER_ORDER];
/** A width in mm as a share of one half of the chart. */
const pct = (mm: number) => `${(mm / HALF_W) * 100}%`;
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');

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
  /** Width in px; leave it out and the chart fills its container. */
  width?: number;
  readOnly?: boolean;
  notation?: Notation;
  label?: string;
}

export default function TeethChart({
  selected, arch, pontics = [], missing = [], implants = [], otherTeeth = [], limitArch,
  onTooth, onArch, onSetTeeth, archMode, width, readOnly, notation = 'fdi', label,
}: ChartProps) {
  const uid = `nc-tc${safeId(useId())}`;
  const boxRef = useRef<HTMLDivElement>(null);
  const toothRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [boxW, setBoxW] = useState(width ?? 560);
  const [hoverJaw, setHoverJaw] = useState<Jaw | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // The drawn width decides how the tooth numbers fit (the artwork itself just scales).
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setBoxW(p => (Math.abs(p - w) > 1 ? w : p));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const interactive = !readOnly;
  const lit = arch ? archTeethIds(arch) : selected.filter(t => !pontics.includes(t));
  const inert = (id: string) => !!limitArch && jawOf(id) !== limitArch;
  const showPills = interactive && (!!onSetTeeth || !!onArch);
  // Both arch buttons share one row above the chart when it's wide enough (it keeps the step short);
  // a narrow chart puts each beside its own row.
  const pillsTogether = boxW >= 280;
  // Full numbers under every crown when the narrowest tooth has room for them;
  // otherwise its position (1–8) beside the quadrant labels, the full number on hover or focus.
  const fullLabels = NARROWEST_SLOT * (boxW / CHART_W) >= (notation === 'palmer' ? 21 : 15);

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

  const tap = (id: string) => (archMode ? onArch?.(jawOf(id)) : onTooth?.(id));

  /**
   * A jaw is whole when every tooth of it that can be lit is lit: a recorded-missing tooth the
   * service leaves out (Crown, Veneer, Extraction) doesn't count against it; one it lights (Partial) does.
   */
  const jawFull = (jaw: Jaw) => {
    const ids = archTeethIds(jaw).filter(t => !missing.includes(t) || lit.includes(t));
    return ids.length > 0 && ids.every(t => lit.includes(t));
  };

  /** "Select Arch": the whole jaw, or clear it when it's already whole; the other jaw's teeth are kept. */
  const selectJaw = (jaw: Jaw) => {
    if (archMode || !onSetTeeth) { onArch?.(jaw); return; }
    const others = lit.filter(t => jawOf(t) !== jaw);
    onSetTeeth(jawFull(jaw) ? others : [...others, ...archTeethIds(jaw)]);
  };

  // Roving focus: one tooth is in the tab order (the last one focused, else the first lit, else the first that can be picked).
  const tabId = activeId && !inert(activeId) ? activeId : ALL.find(t => !inert(t) && lit.includes(t)) ?? ALL.find(t => !inert(t));
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const jaw = jawOf(id);
    const row = ROWS[jaw].filter(t => !inert(t));
    const i = row.indexOf(id);
    let to: string | undefined;
    switch (e.key) {
      case 'ArrowLeft': to = row[i - 1]; break;
      case 'ArrowRight': to = row[i + 1]; break;
      case 'Home': to = row[0]; break;
      case 'End': to = row[row.length - 1]; break;
      case 'ArrowUp':
      case 'ArrowDown': {
        const other: Jaw = e.key === 'ArrowUp' ? 'upper' : 'lower';
        if (other === jaw) break;
        const x = toothX(id);
        to = ROWS[other].filter(t => !inert(t)).sort((p, q) => Math.abs(toothX(p) - x) - Math.abs(toothX(q) - x))[0];
        break;
      }
      default: return;
    }
    e.preventDefault();
    if (to) toothRefs.current[to]?.focus();
  };

  const tooth = (id: string) => {
    const jaw = jawOf(id);
    const up = jaw === 'upper';
    const isLit = lit.includes(id);
    const look: ToothLook = {
      lit: isLit,
      pontic: pontics.includes(id),
      missing: missing.includes(id),
      implant: implants.includes(id),
      other: otherTeeth.includes(id) && !isLit,
    };
    const off = inert(id);
    // Hover washes the tooth teal (the whole row while "Select Arch" is pointed at, or in arch mode).
    const tint = !interactive || off || isLit ? 'off' : hoverJaw === jaw ? 'on' : archMode ? 'off' : 'hover';
    const text = notation === 'palmer' ? palmerOf(id) : id;
    // Missing teeth keep the readable number: the dashed ghost tooth already says they're missing.
    const tone = isLit ? 'text-[#0E5A73] font-semibold' : 'text-[#5A5A6A]';
    const number = (
      <span aria-hidden className={`relative block text-center whitespace-nowrap ${fullLabels ? 'text-[10px] leading-[14px]' : 'text-[9px] leading-[12px]'} ${tone}`}>
        {fullLabels ? text : !interactive ? id[1] : (
          <>
            <span className="group-hover:invisible group-focus-visible:invisible">{id[1]}</span>
            <span className="absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 px-1 rounded bg-[#030213] text-[10px] leading-[12px] font-semibold text-white group-hover:block group-focus-visible:block">{text}</span>
          </>
        )}
      </span>
    );
    // A small lift toward the bite on hover and focus.
    const lift = interactive && !off
      ? `transition-transform duration-150 motion-reduce:transition-none ${up
        ? 'motion-safe:group-hover:translate-y-[2px] motion-safe:group-focus-visible:translate-y-[2px]'
        : 'motion-safe:group-hover:-translate-y-[2px] motion-safe:group-focus-visible:-translate-y-[2px]'}`
      : '';
    const art = <span className={`block ${lift}`}><ToothSvg id={id} uid={uid} look={look} tint={tint} /></span>;
    const body = up ? <>{art}{number}</> : <>{number}{art}</>;
    const cls = `relative flex-shrink-0 flex flex-col ${up ? 'justify-end' : 'justify-start'}`;
    if (!interactive) return <div key={id} className={cls} style={{ width: pct(slotOf(id)) }}>{body}</div>;
    // Dimmed only by the chart's own rule (the other jaw of an arch-limited item), never by a disabled fieldset around it.
    return (
      <button
        key={id}
        ref={el => { toothRefs.current[id] = el; }}
        type="button"
        disabled={off}
        tabIndex={id === tabId ? 0 : -1}
        aria-label={toothLabel(id)}
        aria-pressed={isLit || look.pontic}
        onClick={() => tap(id)}
        onKeyDown={e => onKey(e, id)}
        onFocus={() => setActiveId(id)}
        onPointerEnter={archMode ? () => setHoverJaw(jaw) : undefined}
        onPointerLeave={archMode ? () => setHoverJaw(null) : undefined}
        className={`group ${cls} rounded-md hover:z-10 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[#3F6FE8] ${off ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
        style={{ width: pct(slotOf(id)) }}
      >
        {body}
      </button>
    );
  };

  const half = (ids: string[], side: 'left' | 'right') => (
    <div className={`flex w-1/2 ${side === 'left' ? 'justify-end' : 'justify-start'}`}>
      {side === 'right' && <span aria-hidden className="flex-shrink-0" style={{ width: pct(MID_HALF) }} />}
      {ids.map(id => tooth(id))}
      {side === 'left' && <span aria-hidden className="flex-shrink-0" style={{ width: pct(MID_HALF) }} />}
    </div>
  );
  const row = (jaw: Jaw) => (
    <div role={interactive ? 'group' : undefined} aria-label={interactive ? `${jaw === 'upper' ? 'Upper' : 'Lower'} teeth` : undefined} className="flex">
      {half(ROWS[jaw].slice(0, 8), 'left')}
      {half(ROWS[jaw].slice(8), 'right')}
    </div>
  );

  const pill = (jaw: Jaw) => {
    const on = jawFull(jaw);
    const off = !!limitArch && limitArch !== jaw;
    const name = jaw === 'upper' ? 'Upper' : 'Lower';
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={off}
        onClick={() => selectJaw(jaw)}
        onPointerEnter={() => setHoverJaw(jaw)}
        onPointerLeave={() => setHoverJaw(null)}
        onFocus={() => setHoverJaw(jaw)}
        onBlur={() => setHoverJaw(null)}
        className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${FOCUS} ${
          on ? 'bg-[#E6F6FB] border-[#9ED7EA] text-[#0E5A73]' : 'bg-white border-[#D4D4DD] text-[#2F62D6]'
        } ${off ? 'opacity-40 cursor-default' : on ? 'hover:bg-[#D4EFF8]' : 'hover:border-[#3F6FE8] hover:bg-[#F8FAFF]'}`}
      >
        {on && <Check aria-hidden className="w-3 h-3" strokeWidth={2.25} />}
        Select {name} Arch
      </button>
    );
  };

  const quad = 'pointer-events-none absolute text-[9px] leading-none font-semibold tracking-wider text-[#6B6B7B]';
  return (
    <div
      ref={boxRef}
      className="relative select-none"
      style={{ width: width ?? '100%' }}
      role={readOnly ? 'img' : 'group'}
      aria-label={readOnly ? label : 'Teeth chart'}
    >
      <ToothDefs uid={uid} />
      {showPills && (pillsTogether
        ? <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 pb-2">{pill('upper')}{pill('lower')}</div>
        : <div className="flex justify-center pb-2">{pill('upper')}</div>)}
      <div className="relative">
        <span aria-hidden className={`${quad} left-0.5 top-0.5`}>UR</span>
        <span aria-hidden className={`${quad} right-0.5 top-0.5`}>UL</span>
        <span aria-hidden className={`${quad} left-0.5 bottom-0.5`}>LR</span>
        <span aria-hidden className={`${quad} right-0.5 bottom-0.5`}>LL</span>
        {row('upper')}
        {/* The occlusal plane, between the two rows of numbers. */}
        <div aria-hidden className="relative h-1.5"><span className="absolute inset-x-[1%] top-1/2 h-px bg-[#E0E0E6]" /></div>
        {row('lower')}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-[#D4D4DD]" />
      </div>
      {showPills && !pillsTogether && <div className="flex justify-center pt-2">{pill('lower')}</div>}
    </div>
  );
}

// ─── Mini chart: the portal's arch artwork ───────────────────────────────────

// Hit-area centres from InteractiveToothChart (viewBox 0 0 327 555), for the pontic marks.
const ARCH_TEETH: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
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

/** Small read-only chart for the summary rail and Review: the portal's two arches, the teeth lit teal, pontics dashed. */
export function MiniChart({ teeth, arch, pontics = [], width = 64, label }: { teeth: string[]; arch?: Arch; pontics?: string[]; width?: number; label: string }) {
  const lit = arch ? archTeethIds(arch) : teeth.filter(t => !pontics.includes(t));
  const service = { itemId: 'flow', teeth: lit } as Parameters<typeof InteractiveToothChart>[0]['activeService'];
  return (
    <div
      className="relative pointer-events-none [&>div>div:first-child]:hidden [&>div>div:nth-child(2)]:!mt-0"
      style={{ width }}
      role="img"
      aria-label={label}
    >
      <InteractiveToothChart activeService={service} width={width} onToothToggle={() => {}} />
      {pontics.length > 0 && (
        <svg viewBox="0 0 327 555" className="absolute inset-0 w-full h-full" aria-hidden>
          {pontics.map(id => {
            const t = ARCH_TEETH[id];
            return t && <ellipse key={id} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} fill="rgba(89,193,227,0.22)" stroke="#2A8DB0" strokeWidth={1.6} strokeDasharray="4 3" />;
          })}
        </svg>
      )}
    </div>
  );
}

/** What the chart's looks mean, each drawn with the chart's own tooth. */
export function ChartLegend({ items }: { items: ('selected' | 'pontic' | 'missing' | 'implant' | 'other')[] }) {
  const uid = `nc-lg${safeId(useId())}`;
  const map: Record<typeof items[number], { label: string; look: ToothLook }> = {
    selected: { label: 'Selected', look: { lit: true } },
    pontic: { label: 'Pontic', look: { pontic: true } },
    missing: { label: 'Recorded missing', look: { missing: true } },
    implant: { label: 'Implant on record', look: { implant: true } },
    other: { label: 'In another service', look: { other: true } },
  };
  return (
    <div className="relative flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      <ToothDefs uid={uid} />
      {items.map(k => (
        <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-[#4A4A5A]">
          {/* The pontic is a crown only: its glyph is cropped to the crown so it sits on the label's centre line like the others. */}
          <span aria-hidden className="w-[10px] flex-shrink-0"><ToothSvg id="46" uid={uid} look={map[k].look} crop={k === 'pontic' ? 'crown' : undefined} /></span>
          {map[k].label}
        </span>
      ))}
    </div>
  );
}
