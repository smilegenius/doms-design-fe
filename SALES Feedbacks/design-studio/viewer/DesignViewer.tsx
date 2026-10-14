import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Link2, Link2Off, Maximize, Minus, MoreHorizontal, Palette, Plus, RotateCcw } from 'lucide-react';
import { CAMERA_PRESETS, CameraState, DEFAULT_CAMERA, DesignKind, ModelParams } from '../data/designStudio';
import { buildScene, Scene } from './archModel';
import { renderScene } from './renderArch';

// ── Design viewer ────────────────────────────────────────────────────────────
// Same chrome as ScanViewer in src/app/pages/CaseDetailPage.tsx (format tabs
// top-left, dark #1B1B2D tool cluster top-right, dark bottom pill), with the
// procedural arch rendered live underneath. The camera is controlled by the
// parent so two viewers can share one camera (linked orbit in compare mode).

export type Jaws = 'upper' | 'lower' | 'both';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animate between two camera states (~400ms, ease-out). Returns a cancel function. */
export function tweenCamera(from: CameraState, to: CameraState, onFrame: (c: CameraState) => void, ms = 420): () => void {
  let raf = 0;
  const start = performance.now();
  // Take the short way round in azimuth.
  let dAz = to.azimuth - from.azimuth;
  if (dAz > 180) dAz -= 360;
  if (dAz < -180) dAz += 360;
  const step = (now: number) => {
    const t = easeOut(Math.min(1, (now - start) / ms));
    onFrame({
      azimuth: from.azimuth + dAz * t,
      elevation: from.elevation + (to.elevation - from.elevation) * t,
      zoom: from.zoom + (to.zoom - from.zoom) * t,
      target: [0, 1, 2].map(i => from.target[i] + (to.target[i] - from.target[i]) * t) as [number, number, number],
    });
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Owns a camera plus a cancellable fly-to. */
export function useCamera(initial: CameraState = DEFAULT_CAMERA) {
  const [camera, setCamera] = useState<CameraState>(initial);
  const ref = useRef(camera);
  ref.current = camera;
  const cancel = useRef<() => void>();
  const flyTo = (to: CameraState) => { cancel.current?.(); cancel.current = tweenCamera(ref.current, to, setCamera); };
  const set = (c: CameraState) => { cancel.current?.(); setCamera(c); };
  return { camera, setCamera: set, flyTo };
}

interface Props {
  model: ModelParams;
  kind: DesignKind;
  camera: CameraState;
  onCameraChange: (c: CameraState) => void;
  onFlyTo: (c: CameraState) => void;
  stage?: number;
  jaws?: Jaws;
  onJawsChange?: (j: Jaws) => void;
  onCapture?: () => void;
  /** Static: no orbit (the locked V1 canvas in compare). */
  locked?: boolean;
  label?: ReactNode;
  linked?: { on: boolean; toggle: () => void };
  /** Extra overlay (fallback banner, stage scrubber…). */
  overlay?: ReactNode;
  className?: string;
  compactPill?: boolean;
  /** Uploaded design: a parsed mesh scene (null = none, undefined = still loading). */
  scene?: Scene | null;
}

export default function DesignViewer({
  model, kind, camera, onCameraChange, onFlyTo, stage, jaws = 'both', onJawsChange, onCapture,
  locked = false, label, linked, overlay, className = '', compactPill = false, scene: meshScene,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [format, setFormat] = useState('3D');
  const [guides, setGuides] = useState(kind === 'smile-design' && meshScene === undefined);
  const [moreOpen, setMoreOpen] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const camRef = useRef(camera);
  camRef.current = camera;

  const scene = useMemo(() => meshScene ?? buildScene(model, { stage, jaws }), [meshScene, model, stage, jaws]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(size.w * dpr)) { canvas.width = Math.round(size.w * dpr); canvas.height = Math.round(size.h * dpr); }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const raf = requestAnimationFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderScene(ctx, size.w, size.h, camera, scene, { guides: guides && !meshScene });
    });
    return () => cancelAnimationFrame(raf);
  }, [camera, scene, size, guides]);

  // ── Orbit / pinch with pointer events (mouse, pen and touch alike) ──
  function onPointerDown(e: React.PointerEvent) {
    if (locked) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || locked) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) onCameraChange({ ...camRef.current, zoom: clamp(camRef.current.zoom * (dist / pinch.current), 0.6, 3) });
      pinch.current = dist;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = camRef.current;
    onCameraChange({ ...c, azimuth: c.azimuth - dx * 0.32, elevation: clamp(c.elevation + dy * 0.28, -85, 85) });
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }
  function onWheel(e: React.WheelEvent) {
    if (locked) return;
    const c = camRef.current;
    onCameraChange({ ...c, zoom: clamp(c.zoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.6, 3) });
  }
  const zoomBy = (k: number) => onFlyTo({ ...camRef.current, zoom: clamp(camRef.current.zoom * k, 0.6, 3) });

  const formats = kind === 'aligner-plan' ? ['Upper', 'Lower', 'Both', 'Overjet'] : ['3D', 'PLY', 'STL', 'OBJ'];
  const activeFormat = kind === 'aligner-plan' ? (format === 'Overjet' ? 'Overjet' : jaws === 'upper' ? 'Upper' : jaws === 'lower' ? 'Lower' : 'Both') : format;
  function pickFormat(f: string) {
    setFormat(f);
    if (kind !== 'aligner-plan') return;
    if (f === 'Overjet') { onJawsChange?.('both'); onFlyTo(CAMERA_PRESETS.find(p => p.id === 'overjet')!.camera); return; }
    onJawsChange?.(f === 'Upper' ? 'upper' : f === 'Lower' ? 'lower' : 'both');
    if (f === 'Upper') onFlyTo(CAMERA_PRESETS.find(p => p.id === 'upper')!.camera);
    if (f === 'Lower') onFlyTo(CAMERA_PRESETS.find(p => p.id === 'lower')!.camera);
    if (f === 'Both') onFlyTo(DEFAULT_CAMERA);
  }

  return (
    <div ref={wrapRef} className={`relative bg-[#F0F2F7] rounded-xl border border-[#E0E0E6] overflow-hidden select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full touch-none ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        aria-label="3D design viewer. Drag to orbit, pinch or scroll to zoom."
        role="img"
      />

      {/* Format tabs — same group as ScanViewer */}
      <div className="absolute top-3 left-3 inline-flex items-center bg-white border border-[#E0E0E6] rounded-lg overflow-hidden text-[11px] font-semibold">
        {formats.map(f => (
          <button
            key={f}
            onClick={() => pickFormat(f)}
            className={`px-2.5 py-1 transition-colors ${activeFormat === f ? 'text-[#4D8EF7]' : 'text-[#717182] hover:text-[#030213]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {label && <div className="absolute top-12 left-3 sm:top-3 sm:left-1/2 sm:-translate-x-1/2">{label}</div>}

      {/* Top-right tool cluster — same as ScanViewer */}
      <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-[#1B1B2D] rounded-lg p-1.5">
        <button
          onClick={onCapture}
          disabled={!onCapture}
          className="w-7 h-7 rounded-md bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center disabled:opacity-40"
          title="Annotate — capture this view"
        >
          <Palette className="w-3.5 h-3.5 text-white" />
        </button>
        <button
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrapRef.current?.requestFullscreen?.())}
          className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80"
          title="Full screen"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
        <div className="relative">
          <button onClick={() => setMoreOpen(o => !o)} className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80" title="More">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-9 w-44 bg-[#1B1B2D] rounded-lg p-1 z-10 shadow-lg">
              <button
                onClick={() => { setGuides(g => !g); setMoreOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] text-white/80 hover:bg-white/10"
              >
                {guides ? 'Hide' : 'Show'} facial midline
              </button>
              <button
                onClick={() => { onFlyTo(DEFAULT_CAMERA); setMoreOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] text-white/80 hover:bg-white/10"
              >
                Reset view
              </button>
            </div>
          )}
        </div>
      </div>

      {overlay}

      {/* Bottom pill — zoom, reset, presets, linked orbit */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-0.5 bg-[#1B1B2D] rounded-full px-1.5 py-1.5 max-w-full overflow-x-auto">
          <button onClick={() => zoomBy(1 / 1.2)} disabled={locked} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-40 flex-shrink-0" title="Zoom out">
            <Minus className="w-3.5 h-3.5 text-white" />
          </button>
          <button onClick={() => zoomBy(1.2)} disabled={locked} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-40 flex-shrink-0" title="Zoom in">
            <Plus className="w-3.5 h-3.5 text-white" />
          </button>
          <button onClick={() => onFlyTo(DEFAULT_CAMERA)} disabled={locked} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-40 flex-shrink-0" title="Reset view">
            <RotateCcw className="w-3.5 h-3.5 text-white" />
          </button>
          {!compactPill && <span className="w-px h-4 bg-white/20 mx-1 flex-shrink-0" />}
          {!compactPill && CAMERA_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => onFlyTo(p.camera)}
              disabled={locked}
              className="px-2 h-7 rounded-full text-[10.5px] font-medium text-white/80 hover:bg-white/10 hover:text-white whitespace-nowrap disabled:opacity-40 flex-shrink-0"
              title={`${p.label} view`}
            >
              {p.label}
            </button>
          ))}
          {linked && (
            <>
              <span className="w-px h-4 bg-white/20 mx-1 flex-shrink-0" />
              <button
                onClick={linked.toggle}
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${linked.on ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]' : 'hover:bg-white/10'}`}
                title={linked.on ? 'Linked orbit on — both versions move together' : 'Linked orbit off'}
                aria-pressed={linked.on}
              >
                {linked.on ? <Link2 className="w-3.5 h-3.5 text-white" /> : <Link2Off className="w-3.5 h-3.5 text-white/80" />}
              </button>
            </>
          )}
        </div>
        {onCapture && (
          <button
            onClick={onCapture}
            className="pointer-events-auto inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] shadow-lg hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Capture this view</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/25 text-[10px] font-bold">C</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
