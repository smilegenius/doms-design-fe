import type { MarkupStroke } from '../data/designStudio';

// Renders markup strokes over a 16:10 capture frame. Points are normalised
// 0..1, so the same strokes burn into thumbnails at any size.

export const VB_W = 1000, VB_H = 625;

function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (ang: number) => `${x2 - size * Math.cos(a - ang)},${y2 - size * Math.sin(a - ang)}`;
  return `${x2},${y2} ${p(0.45)} ${p(-0.45)}`;
}

export function StrokeShape({ s }: { s: MarkupStroke }) {
  const pts = s.points.map(([x, y]) => [x * VB_W, y * VB_H] as [number, number]);
  const common = { stroke: s.color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (s.tool === 'text') {
    const [x, y] = pts[0];
    return (
      <text x={x} y={y} fill={s.color} fontSize={s.width * 7 + 14} fontWeight={600} fontFamily="Poppins, sans-serif"
        stroke="#FFFFFF" strokeWidth={4} paintOrder="stroke" dominantBaseline="middle">{s.text}</text>
    );
  }
  if (pts.length < 2) {
    const [x, y] = pts[0] ?? [0, 0];
    return <circle cx={x} cy={y} r={s.width} fill={s.color} opacity={s.tool === 'highlighter' ? 0.35 : 1} />;
  }
  if (s.tool === 'ellipse') {
    const [[x1, y1], [x2, y2]] = [pts[0], pts[pts.length - 1]];
    return <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} strokeWidth={s.width} {...common} />;
  }
  if (s.tool === 'arrow') {
    const [[x1, y1], [x2, y2]] = [pts[0], pts[pts.length - 1]];
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={s.width} {...common} />
        <polygon points={arrowHead(x1, y1, x2, y2, s.width * 4 + 10)} fill={s.color} />
      </g>
    );
  }
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  if (s.tool === 'highlighter') return <path d={d} strokeWidth={s.width * 3} opacity={0.35} {...common} />;
  return <path d={d} strokeWidth={s.width} {...common} />;
}

export default function StrokeLayer({ strokes, className = '' }: { strokes: MarkupStroke[]; className?: string }) {
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}>
      {strokes.map(s => <StrokeShape key={s.id} s={s} />)}
    </svg>
  );
}
