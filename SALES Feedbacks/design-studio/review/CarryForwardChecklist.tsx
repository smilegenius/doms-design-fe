import { Check, RotateCcw, X } from 'lucide-react';
import { Capture, DesignVersion, LAB_MEMBERS } from '../data/designStudio';
import { resolveCarryForward, undoCarryForward } from '../store/studioStore';
import { ToothChips } from '../markup/FdiPicker';
import CaptureStill from './CaptureStill';

// Compare mode: one row per previous-version capture. The dentist confirms
// each point or re-opens it (which seeds a fresh capture quoting the old comment).

export const STATUS_PILL: Record<Capture['status'], { label: string; cls: string }> = {
  'addressed':           { label: 'Addressed',           cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
  'partially-addressed': { label: 'Partially addressed', cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' },
  'open':                { label: 'Not addressed',       cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
  'accepted':            { label: 'Accepted',            cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
};

export function labPill(c: Capture) {
  if (c.labResponse?.outcome === 'cant-do') return { label: "Can't do", cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' };
  return STATUS_PILL[c.status];
}

export default function CarryForwardChecklist({ version, previous, readOnly, onFly, onReopened }: {
  version: DesignVersion;
  previous: DesignVersion;
  readOnly: boolean;
  onFly: (c: Capture) => void;
  onReopened: (newCaptureId: string) => void;
}) {
  const points = previous.captures;
  const done = points.filter(p => version.carryForward?.[p.id]).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#030213]">From Version {previous.number}</p>
        <p className={`text-[11px] font-semibold ${done === points.length ? 'text-[#047857]' : 'text-[#B45309]'}`}>{done} of {points.length} points confirmed</p>
      </div>
      <div className="h-1 rounded-full bg-[#F0EFF6] overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all" style={{ width: `${points.length ? (done / points.length) * 100 : 0}%` }} />
      </div>
      {points.map(p => {
        const verdict = version.carryForward?.[p.id];
        const pill = labPill(p);
        const by = p.labResponse && LAB_MEMBERS.find(m => m.name === p.labResponse!.by);
        return (
          <div key={p.id} className={`rounded-xl border p-2.5 ${verdict === 'confirmed' ? 'border-[#A7F3D0] bg-[#ECFDF5]/40' : verdict === 'reopened' ? 'border-[#FDE68A] bg-[#FFF8E1]/40' : 'border-[#E0E0E6] bg-white'}`}>
            <div className="flex gap-2.5">
              <button onClick={() => onFly(p)} className="w-20 flex-shrink-0 rounded-lg overflow-hidden ring-offset-1 hover:ring-2 hover:ring-[#4D8EF7] transition" title="Fly both versions to this view">
                <CaptureStill capture={p} model={previous.model} files={previous.files} width={200} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[#030213]">Capture {p.index} · {p.thumbnailLabel}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${pill.cls}`}>{pill.label}</span>
                </div>
                <p className="text-xs text-[#717182] mt-0.5 line-clamp-3">“{p.comment}”</p>
                <div className="flex flex-wrap gap-1 mt-1"><ToothChips teeth={p.teeth} /></div>
              </div>
            </div>
            {p.labResponse ? (
              <div className="mt-2 rounded-lg bg-[#F8F9FC] border border-[#F0EFF6] px-2.5 py-2 flex gap-2">
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">{by?.initials ?? p.labResponse.by.slice(0, 2).toUpperCase()}</span>
                <p className="text-xs text-[#030213]"><span className="font-semibold">{p.labResponse.by}:</span> {p.labResponse.note}</p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-[#A0A0B0] italic">No response from the lab on this point.</p>
            )}
            {!readOnly && (
              verdict ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${verdict === 'confirmed' ? 'text-[#047857]' : 'text-[#B45309]'}`}>
                    {verdict === 'confirmed' ? <><Check className="w-3.5 h-3.5" /> Looks right</> : <><X className="w-3.5 h-3.5" /> Still not right — see the new capture</>}
                  </span>
                  <button onClick={() => undoCarryForward(version, p.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#717182] hover:text-[#030213]">
                    <RotateCcw className="w-3 h-3" /> Undo
                  </button>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => resolveCarryForward(version, p, 'confirmed')}
                    className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border border-[#A7F3D0] text-[#047857] bg-white hover:bg-[#ECFDF5]"
                  >
                    <Check className="w-3.5 h-3.5" /> Looks right
                  </button>
                  <button
                    onClick={() => { const id = resolveCarryForward(version, p, 'reopened'); if (id) onReopened(id); }}
                    className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC]"
                  >
                    Still not right
                  </button>
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
