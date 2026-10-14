import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { ModelParams } from '../data/designStudio';

// Aligner plans: stage slider docked under the canvas, with play/pause, speed
// and tick marks on stages that carry IPR or attachment placement.

const SPEEDS = [0.5, 1, 2] as const;

export default function StageScrubber({ model, stage, onStage }: { model: ModelParams; stage: number; onStage: (s: number) => void }) {
  const total = Math.max(model.stages?.upper ?? 0, model.stages?.lower ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = stageRef.current + 1;
      if (next > total) { setPlaying(false); return; }
      onStage(next);
    }, 420 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, total, onStage]);

  const events = [
    ...(model.ipr ?? []).map(i => ({ stage: i.stage, label: `IPR ${i.mm}mm ${i.between.join('/')}` })),
    ...(model.attachments ?? []).map(a => ({ stage: a.fromStage, label: `Attachment ${a.tooth}` })),
    ...(model.elasticsFromStage ? [{ stage: model.elasticsFromStage, label: 'Elastics start' }] : []),
  ];
  const byStage = new Map<number, string[]>();
  events.forEach(e => byStage.set(e.stage, [...(byStage.get(e.stage) ?? []), e.label]));

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { if (stage >= total) onStage(0); setPlaying(p => !p); }}
          className="w-8 h-8 rounded-full bg-[#1B1B2D] text-white flex items-center justify-center flex-shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="relative h-5">
            <input
              type="range"
              min={0}
              max={total}
              value={stage}
              onChange={e => { setPlaying(false); onStage(Number(e.target.value)); }}
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full accent-[#4D8EF7] cursor-pointer"
              aria-label="Aligner stage"
            />
            {[...byStage.entries()].map(([s, labels]) => (
              <span
                key={s}
                title={`Stage ${s}: ${labels.join(', ')}`}
                className="absolute top-0 w-1 h-1.5 rounded-full bg-[#F59E0B] -translate-x-1/2 pointer-events-none"
                style={{ left: `${(s / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-center sm:justify-between text-[10px] text-[#A0A0B0] mt-0.5">
            <span className="hidden sm:inline">Stage 0 (start)</span>
            <span className="font-semibold text-[#030213]">
              Stage {stage} of {total}{byStage.get(stage) ? ` · ${byStage.get(stage)!.join(' · ')}` : ''}
            </span>
            <span className="hidden sm:inline">Stage {total} (final)</span>
          </div>
        </div>
        <div className="inline-flex p-0.5 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg flex-shrink-0">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${speed === s ? 'bg-white text-[#4D8EF7] shadow-sm' : 'text-[#717182]'}`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
