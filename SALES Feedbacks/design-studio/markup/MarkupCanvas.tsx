import { useRef, useState } from 'react';
import { ArrowUpRight, Circle, Eraser, Highlighter, PenLine, Type, Undo2 } from 'lucide-react';
import { MarkupStroke, MarkupTool, SWATCHES } from '../data/designStudio';
import { StrokeShape, VB_H, VB_W } from './StrokeLayer';

// ── Markup over a frozen capture ─────────────────────────────────────────────
// Pointer events throughout, so drawing works with mouse, pen and touch.

const WIDTHS = { sm: 3, md: 5, lg: 8 } as const;
type WidthKey = keyof typeof WIDTHS;

const TOOLS: { id: MarkupTool; label: string; icon: typeof PenLine }[] = [
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'text', label: 'Text', icon: Type },
];

let n = 0;
const sid = () => `stk-${Date.now().toString(36)}${(n++).toString(36)}`;

export function MarkupToolbar({ tool, setTool, color, setColor, width, setWidth, onUndo, onClear, canUndo }: {
  tool: MarkupTool; setTool: (t: MarkupTool) => void;
  color: string; setColor: (c: string) => void;
  width: WidthKey; setWidth: (w: WidthKey) => void;
  onUndo: () => void; onClear: () => void; canUndo: boolean;
}) {
  const btn = (on: boolean) => `w-7 h-7 rounded-md flex items-center justify-center transition-colors ${on ? 'bg-[#E3F2FD] text-[#4D8EF7]' : 'text-[#717182] hover:bg-[#F8F9FC] hover:text-[#030213]'}`;
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[#F0EFF6] bg-white">
      {TOOLS.map(t => (
        <button key={t.id} onClick={() => setTool(t.id)} className={btn(tool === t.id)} title={t.label} aria-pressed={tool === t.id}>
          <t.icon className="w-3.5 h-3.5" />
        </button>
      ))}
      <span className="w-px h-4 bg-[#F0EFF6] mx-1" />
      <button onClick={onUndo} disabled={!canUndo} className={`${btn(false)} disabled:opacity-40`} title="Undo"><Undo2 className="w-3.5 h-3.5" /></button>
      <button onClick={onClear} disabled={!canUndo} className={`${btn(false)} disabled:opacity-40`} title="Clear"><Eraser className="w-3.5 h-3.5" /></button>
      <span className="w-px h-4 bg-[#F0EFF6] mx-1" />
      {SWATCHES.map(c => (
        <button
          key={c}
          onClick={() => setColor(c)}
          className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'border-[#030213] scale-110' : 'border-white'}`}
          style={{ background: c, boxShadow: '0 0 0 1px #E0E0E6' }}
          title="Colour"
          aria-pressed={color === c}
        />
      ))}
      <span className="w-px h-4 bg-[#F0EFF6] mx-1" />
      {(Object.keys(WIDTHS) as WidthKey[]).map(w => (
        <button key={w} onClick={() => setWidth(w)} className={btn(width === w)} title={`Stroke ${w}`} aria-pressed={width === w}>
          <span className="rounded-full bg-current" style={{ width: WIDTHS[w] + 1, height: WIDTHS[w] + 1 }} />
        </button>
      ))}
    </div>
  );
}

/** Drawing surface: the still underneath is supplied by the parent. */
export default function MarkupCanvas({ strokes, onChange, tool, color, width }: {
  strokes: MarkupStroke[];
  onChange: (s: MarkupStroke[]) => void;
  tool: MarkupTool;
  color: string;
  width: WidthKey;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<MarkupStroke | null>(null);
  const [textAt, setTextAt] = useState<[number, number] | null>(null);
  const [text, setText] = useState('');

  const toNorm = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  function down(e: React.PointerEvent) {
    e.preventDefault();
    const p = toNorm(e);
    if (tool === 'text') { setTextAt(p); setText(''); return; }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraft({ id: sid(), tool, color, width: WIDTHS[width], points: [p] });
  }
  function move(e: React.PointerEvent) {
    if (!draft) return;
    const p = toNorm(e);
    setDraft(d => d && ({ ...d, points: d.tool === 'pen' || d.tool === 'highlighter' ? [...d.points, p] : [d.points[0], p] }));
  }
  function up() {
    if (draft) onChange([...strokes, draft]);
    setDraft(null);
  }
  function commitText() {
    if (textAt && text.trim()) onChange([...strokes, { id: sid(), tool: 'text', color, width: WIDTHS[width], points: [textAt], text: text.trim() }]);
    setTextAt(null);
    setText('');
  }

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {strokes.map(s => <StrokeShape key={s.id} s={s} />)}
        {draft && <StrokeShape s={draft} />}
      </svg>
      {textAt && (
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextAt(null); }}
          onBlur={commitText}
          placeholder="Type, then Enter"
          className="absolute z-10 px-2 py-1 text-xs rounded-md border border-[#4D8EF7] bg-white shadow-sm outline-none w-40"
          style={{ left: `${textAt[0] * 100}%`, top: `${textAt[1] * 100}%`, transform: 'translate(-4px, -50%)', color }}
        />
      )}
    </>
  );
}

export type { WidthKey };
