import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Crosshair, Quote, Trash2 } from 'lucide-react';
import { Capture, DesignFile, LAB_MEMBERS, MarkupTool, ModelParams, SWATCHES } from '../data/designStudio';
import MarkupCanvas, { MarkupToolbar, WidthKey } from '../markup/MarkupCanvas';
import MentionTextarea, { MentionChip } from '../markup/MentionTextarea';
import FdiPicker, { ToothChips } from '../markup/FdiPicker';
import { attachToCapture, removeCapture, removeCaptureAttachment, updateCapture } from '../store/studioStore';
import { AttachButton, FileList, useFileIntake } from '../components/FileChips';
import CaptureStill from './CaptureStill';

// One capture in the dentist's review stack: still + markup + comment +
// teeth + @mentions. Collapses to a compact row once saved.

export function captureTitle(c: Capture, totalStages?: number) {
  return `Capture ${c.index} · ${c.thumbnailLabel}${c.stage !== undefined && totalStages && !c.thumbnailLabel.startsWith('Stage') ? ` · Stage ${c.stage} of ${totalStages}` : ''}`;
}

export default function CaptureCard({ capture, model, files, totalStages, expanded, onExpand, onFly, readOnly = false }: {
  capture: Capture;
  model: ModelParams;
  files?: DesignFile[];
  totalStages?: number;
  expanded: boolean;
  onExpand: (open: boolean) => void;
  onFly: () => void;
  readOnly?: boolean;
}) {
  const [tool, setTool] = useState<MarkupTool>('pen');
  const [color, setColor] = useState(SWATCHES[0]);
  const [width, setWidth] = useState<WidthKey>('md');
  const [focused, setFocused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (expanded) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [expanded]);
  const patch = (p: Partial<Capture>) => updateCapture(capture.versionId, capture.id, p);
  const intake = useFileIntake('clinician', f => attachToCapture(capture.versionId, capture.id, f));
  const [dropOver, setDropOver] = useState(false);

  if (!expanded) {
    return (
      <div className="bg-white border border-[#E0E0E6] rounded-xl p-2 flex gap-3 items-start hover:border-[#4D8EF7] transition-colors">
        <button onClick={onFly} className="w-24 flex-shrink-0 rounded-lg overflow-hidden" title="Fly the viewer back to this view">
          <CaptureStill capture={capture} model={model} files={files} width={240} />
        </button>
        <button onClick={() => onExpand(true)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#030213] truncate">{captureTitle(capture, totalStages)}</p>
            <ChevronDown className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0" />
          </div>
          <p className={`text-xs mt-0.5 line-clamp-2 ${capture.comment ? 'text-[#717182]' : 'text-[#A0A0B0] italic'}`}>{capture.comment || 'No comment yet'}</p>
          {(capture.teeth.length > 0 || capture.mentions.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              <ToothChips teeth={capture.teeth} />
              {capture.mentions.map(id => { const m = LAB_MEMBERS.find(x => x.id === id); return m ? <MentionChip key={id} member={m} /> : null; })}
              {(capture.attachments?.length ?? 0) > 0 && <span className="text-[10px] text-[#717182]">· {capture.attachments!.length} file{capture.attachments!.length === 1 ? '' : 's'}</span>}
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`bg-white border rounded-xl overflow-hidden transition-colors ${focused ? 'border-[#4D8EF7]' : 'border-[#E0E0E6]'}`}
      onFocus={() => setFocused(true)}
      onPointerDown={() => setFocused(true)}
      onDragOver={readOnly ? undefined : e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropOver(true); } }}
      onDragLeave={() => setDropOver(false)}
      onDrop={readOnly ? undefined : e => { e.preventDefault(); setDropOver(false); intake.add(e.dataTransfer.files); }}
      style={dropOver ? { boxShadow: '0 0 0 2px #4D8EF7' } : undefined}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#F0EFF6]">
        <p className="text-xs font-semibold text-[#030213] truncate">{captureTitle(capture, totalStages)}</p>
        <div className="flex items-center gap-1">
          <button onClick={onFly} className="w-7 h-7 rounded-md flex items-center justify-center text-[#717182] hover:bg-[#F8F9FC] hover:text-[#4D8EF7]" title="Fly the viewer back to this view">
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          {!readOnly && (
            <button onClick={() => removeCapture(capture.versionId, capture.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-[#717182] hover:bg-[#FFF1F2] hover:text-[#D4183D]" title="Delete capture">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {!readOnly && focused && (
        <MarkupToolbar
          tool={tool} setTool={setTool} color={color} setColor={setColor} width={width} setWidth={setWidth}
          canUndo={capture.strokes.length > 0}
          onUndo={() => patch({ strokes: capture.strokes.slice(0, -1) })}
          onClear={() => patch({ strokes: [] })}
        />
      )}
      <CaptureStill capture={capture} model={model} files={files} width={720}>
        {readOnly
          ? undefined
          : <MarkupCanvas strokes={capture.strokes} onChange={strokes => patch({ strokes })} tool={tool} color={color} width={width} />}
      </CaptureStill>
      <div className="p-3 space-y-2">
        {capture.carriedFrom && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#B45309]"><Quote className="w-3 h-3" /> Re-opened from the previous version</p>
        )}
        {readOnly ? (
          <p className="text-sm text-[#030213] whitespace-pre-line">{capture.comment || <span className="text-[#A0A0B0] italic">No comment</span>}</p>
        ) : (
          <MentionTextarea
            value={capture.comment}
            onChange={comment => patch({ comment })}
            mentions={capture.mentions}
            onMentionsChange={mentions => patch({ mentions })}
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <ToothChips teeth={capture.teeth} onRemove={readOnly ? undefined : t => patch({ teeth: capture.teeth.filter(x => x !== t) })} />
          {!readOnly && <FdiPicker teeth={capture.teeth} onChange={teeth => patch({ teeth })} />}
          {!readOnly && <AttachButton uploadedBy="clinician" onAdded={f => attachToCapture(capture.versionId, capture.id, f)} />}
          {readOnly && capture.mentions.map(id => { const m = LAB_MEMBERS.find(x => x.id === id); return m ? <MentionChip key={id} member={m} /> : null; })}
        </div>
        <FileList files={capture.attachments ?? []} onRemove={readOnly ? undefined : id => removeCaptureAttachment(capture.versionId, capture.id, id)} />
        {!readOnly && (
          <div className="flex justify-end">
            <button
              onClick={() => { setFocused(false); onExpand(false); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4D8EF7] hover:bg-[#F8F9FC]"
            >
              <Check className="w-3.5 h-3.5" /> Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
