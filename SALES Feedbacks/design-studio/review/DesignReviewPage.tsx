import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Camera, ExternalLink, ImageUp, Info, Lock, MessageSquare, X } from 'lucide-react';
import Button from '../../../src/app/components/Button';
import Modal from '../../../src/app/components/Modal';
import { useLockBodyScroll } from '../../../src/app/components/useLockBodyScroll';
import { useToast } from '../../../src/app/context/ToastContext';
import {
  CAMERA_PRESETS, CameraState, Capture, DesignVersion, KIND_LABEL, LAB_MEMBERS, providerFor, ReviewLink, StudioCase, studioDate, studioDateTime,
} from '../data/designStudio';
import {
  addCapture, addReviewAttachment, attachToCapture, clinicianFiles, confirmIdentity, isExpired, markOpened, removeReviewAttachment, resolveLink, submitReview, unresolvedCarryForward, useStudio,
} from '../store/studioStore';
import { Jaws, useCamera } from '../viewer/DesignViewer';
import VersionViewer, { useVersionStage } from '../viewer/VersionViewer';
import { FileDropZone, FileList } from '../components/FileChips';
import { storeFiles } from '../store/fileStore';
import StageScrubber from '../viewer/StageScrubber';
import { ToothChips } from '../markup/FdiPicker';
import CaptureCard from './CaptureCard';
import CarryForwardChecklist from './CarryForwardChecklist';
import { ExpiredState, IdentityGate, ReviewChrome, SubmittedState } from './ReviewParts';

// ── Dentist review page (public, no login) ───────────────────────────────────
// /review/:token          single-version review (or compare, for V2+)
// /review/:token/compare  compare mode

export default function DesignReviewPage() {
  const { token = '' } = useParams();
  useStudio(); // re-render on any store change (incl. other tabs)
  const r = resolveLink(token);

  useEffect(() => { if (r && !isExpired(r.link)) markOpened(token); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <ExpiredState />;
  if (isExpired(r.link)) return <ExpiredState studioCase={r.studioCase} link={r.link} />;
  if (!r.link.confirmedName) {
    return <IdentityGate studioCase={r.studioCase} version={r.version} link={r.link} onConfirm={name => confirmIdentity(token, name)} />;
  }
  return <ReviewWorkspace token={token} studioCase={r.studioCase} link={r.link} linkVersion={r.version} previous={r.previous} />;
}

function useIsDesktop() {
  const q = '(min-width: 1024px)';
  const [ok, setOk] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setOk(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return ok;
}

function labelForCamera(c: CameraState, stage?: number, total?: number) {
  const preset = CAMERA_PRESETS.find(p => Math.abs(p.camera.azimuth - c.azimuth) < 9 && Math.abs(p.camera.elevation - c.elevation) < 9);
  const view = preset?.label ?? `Custom · ${Math.round(((c.azimuth % 360) + 540) % 360 - 180)}° / ${Math.round(c.elevation)}°`;
  return stage !== undefined ? `Stage ${stage}${total ? ` of ${total}` : ''} · ${view}` : view;
}

function ReviewWorkspace({ token, studioCase, link, linkVersion, previous }: {
  token: string; studioCase: StudioCase; link: ReviewLink; linkVersion: DesignVersion; previous?: DesignVersion;
}) {
  const { toast } = useToast();
  const location = useLocation();
  const desktop = useIsDesktop();
  const [viewId, setViewId] = useState(linkVersion.id);
  const version = studioCase.versions.find(v => v.id === viewId) ?? linkVersion;
  const viewingOther = version.id !== linkVersion.id;
  const submitted = !!link.submittedAt;
  const readOnly = submitted || viewingOther;
  const prev = viewingOther ? studioCase.versions.find(v => v.number === version.number - 1) : previous;
  const [mode, setMode] = useState<'review' | 'compare'>(previous && (location.pathname.endsWith('/compare') || linkVersion.number > 1) ? 'compare' : 'review');
  const compare = mode === 'compare' && !!prev && !submitted;

  const isPlan = version.kind === 'aligner-plan';
  const totalStages = isPlan ? Math.max(version.model.stages?.upper ?? 0, version.model.stages?.lower ?? 0) : undefined;
  const [stage, setStage] = useState(totalStages ?? 0);
  const [jaws, setJaws] = useState<Jaws>('both');
  const right = useCamera();
  const left = useCamera();
  const [linked, setLinked] = useState(true);
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('right');
  const stageR = useVersionStage(version);
  const [imageIdx, setImageIdx] = useState(0);
  const [showImages, setShowImages] = useState(false);
  const [imageIdxL, setImageIdxL] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<'review' | 'details' | 'lab'>('review');
  const [confirm, setConfirm] = useState<null | 'approve' | 'changes'>(null);
  const [note, setNote] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const provider = providerFor(version.provider);

  const setBoth = (c: CameraState) => { right.setCamera(c); if (linked) left.setCamera(c); };
  const setLeft = (c: CameraState) => { left.setCamera(c); if (linked) right.setCamera(c); };
  /** Sync-to-capture: always flies both canvases. */
  const flyBoth = (c: CameraState) => { right.flyTo(c); left.flyTo(c); };
  /** Presets / zoom on the live canvas: the other follows only while orbit is linked. */
  const flyRight = (c: CameraState) => { right.flyTo(c); if (linked) left.flyTo(c); };

  const unresolved = prev && !viewingOther ? unresolvedCarryForward(version, prev) : [];
  const comments = version.captures.filter(c => c.comment.trim()).length;

  const capture = useCallback(() => {
    if (readOnly || stageR.mode === 'loading') return;
    if (stageR.mode === 'images' || (showImages && stageR.images.length)) {
      const img = stageR.images[Math.min(imageIdx, stageR.images.length - 1)];
      const id = addCapture(version.id, { thumbnailLabel: `Image ${imageIdx + 1} · ${img.name}`, camera: right.camera, imageFileId: img.id });
      setExpanded(id);
      setTab('review');
      return;
    }
    const id = addCapture(version.id, { thumbnailLabel: labelForCamera(right.camera, isPlan ? stage : undefined, totalStages), camera: right.camera, stage: isPlan ? stage : undefined });
    setExpanded(id);
    setTab('review');
  }, [readOnly, version.id, right.camera, isPlan, stage, totalStages, stageR.mode, stageR.images, imageIdx, showImages]);

  const addUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = addCapture(version.id, { thumbnailLabel: `Screenshot from ${provider.label}`, camera: right.camera, uploadedImage: String(reader.result), stage: isPlan ? stage : undefined });
      setExpanded(id);
      setTab('review');
      toast.success('Screenshot added as a capture');
    };
    reader.readAsDataURL(file);
  }, [version.id, provider.label, right.camera, isPlan, stage, toast]);

  // C to capture; paste a screenshot to add it as a capture.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); capture(); }
    };
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (!f) return;
      // Into the open capture as an attachment; otherwise a new screenshot capture.
      if (expanded) {
        storeFiles([new File([f], f.name || `pasted-${Date.now()}.png`, { type: f.type })], 'clinician').then(({ ok }) => {
          if (ok.length) { attachToCapture(version.id, expanded, ok); toast.success('Image attached to the capture'); }
        });
      } else addUpload(f);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
  }, [readOnly, capture, addUpload, expanded, version.id, toast]);

  function flyToCapture(c: Capture) {
    if (c.stage !== undefined) setStage(c.stage);
    flyBoth(c.camera);
  }

  function submit(decision: 'approved' | 'changes-requested') {
    submitReview(token, decision, note.trim());
    setConfirm(null);
    setJustSubmitted(true);
    toast.success(`Feedback sent to ${studioCase.lab}`);
  }

  const [fallbackOpen, setFallbackOpen] = useState(desktop);
  const fallback = !provider.embeddable && version.provider !== 'upload' && (fallbackOpen ? (
    <div className="absolute top-12 sm:top-14 left-3 right-3 sm:right-auto sm:max-w-md rounded-xl border border-[#E0E0E6] bg-white/95 backdrop-blur px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-[#1565C0] flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[#030213] leading-relaxed">
            {provider.label} doesn't allow embedding — open it in a new tab, then come back here to capture and comment.
            <span className="hidden sm:inline text-[#717182]"> The model here is a preview built from the exported plan.</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <a href={version.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90">
              Open in {provider.label} <ExternalLink className="w-3 h-3" />
            </a>
            {!readOnly && (
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#030213] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]">
                <ImageUp className="w-3 h-3" /> Upload a screenshot
              </button>
            )}
            {!readOnly && <span className="hidden sm:inline text-[10px] text-[#A0A0B0]">or paste one with ⌘V</span>}
          </div>
        </div>
        <button onClick={() => setFallbackOpen(false)} className="text-[#A0A0B0] hover:text-[#030213]" aria-label="Hide"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  ) : (
    <button onClick={() => setFallbackOpen(true)} className="absolute top-12 sm:top-14 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/95 border border-[#E0E0E6] text-[10px] font-semibold text-[#1565C0] shadow-sm">
      <Info className="w-3 h-3" /> {provider.label} · open or upload
    </button>
  ));

  const versionLabel = (v: DesignVersion, live: boolean) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm ${live ? 'bg-white text-[#030213] border-[#E0E0E6]' : 'bg-[#1B1B2D] text-white border-[#1B1B2D]'}`}>
      {!live && <Lock className="w-3 h-3" />} Version {v.number} · {studioDate(v.uploadedAt)}
    </span>
  );

  const viewerArea = (
    <div className="h-full min-h-0 flex flex-col gap-2 p-2 sm:p-3">
      {compare && !desktop && prev && (
        <div className="inline-flex self-center p-0.5 bg-white border border-[#E0E0E6] rounded-lg">
          {[prev, version].map(v => (
            <button key={v.id} onClick={() => setMobileSide(v.id === prev.id ? 'left' : 'right')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold ${(mobileSide === 'left') === (v.id === prev.id) ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white' : 'text-[#717182]'}`}>
              Version {v.number}
            </button>
          ))}
        </div>
      )}
      <div className={`flex-1 min-h-0 grid gap-2 sm:gap-3 ${compare && desktop ? 'grid-cols-2' : ''}`}>
        {compare && prev && (desktop || mobileSide === 'left') && (
          <VersionViewer
            version={prev} imageIndex={imageIdxL} onImageIndex={setImageIdxL}
            camera={left.camera} onCameraChange={setLeft} onFlyTo={c => { left.flyTo(c); if (linked) right.flyTo(c); }}
            stage={stage} jaws={jaws} onJawsChange={setJaws} label={versionLabel(prev, false)} compactPill
            linked={{ on: linked, toggle: () => setLinked(l => !l) }} className="h-full"
          />
        )}
        {(!compare || desktop || mobileSide === 'right') && <VersionViewer
          version={version} imageIndex={imageIdx} onImageIndex={setImageIdx} showImages={showImages} onShowImages={setShowImages}
          camera={right.camera} onCameraChange={setBoth} onFlyTo={flyRight}
          stage={stage} jaws={jaws} onJawsChange={setJaws} onCapture={readOnly ? undefined : capture}
          label={compare || viewingOther ? versionLabel(version, !viewingOther) : undefined}
          linked={compare ? { on: linked, toggle: () => setLinked(l => !l) } : undefined}
          overlay={fallback} compactPill={!desktop || compare} className="h-full"
        />}
      </div>
      {isPlan && <StageScrubber model={version.model} stage={stage} onStage={setStage} />}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) addUpload(f); e.target.value = ''; }} />
    </div>
  );

  const fromLab = prev?.captures.filter(c => c.labResponse) ?? [];
  const panel = (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="flex items-center gap-5 px-4 border-b border-[#F0EFF6] flex-shrink-0">
        {([['review', `Review (${version.captures.length})`], ['details', 'Design details'], ['lab', 'From the lab']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`py-3 text-sm font-semibold border-b-2 transition-colors ${tab === id ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {tab === 'review' && (
          <>
            {viewingOther && (
              <p className="text-[11px] text-[#717182] bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2">You're looking at an earlier version. It's read-only.</p>
            )}
            {compare && prev && (
              <CarryForwardChecklist version={version} previous={prev} readOnly={readOnly} onFly={flyToCapture} onReopened={id => setExpanded(id)} />
            )}
            {compare && <p className="text-xs font-semibold text-[#030213] pt-2">New on Version {version.number}</p>}
            {version.captures.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E0E0E6] px-4 py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-[#F8F9FC] flex items-center justify-center mx-auto"><Camera className="w-5 h-5 text-[#A0A0B0]" /></div>
                <p className="text-sm text-[#717182] mt-3 max-w-xs mx-auto">
                  {readOnly ? 'No captures on this version.' : 'Spin the model to the angle you want, then hit Capture. Everything you draw stays attached to that exact view.'}
                </p>
              </div>
            ) : (
              version.captures.map(c => (
                <CaptureCard
                  key={c.id}
                  capture={c}
                  model={version.model}
                  totalStages={totalStages}
                  expanded={expanded === c.id}
                  onExpand={open => setExpanded(open ? c.id : null)}
                  onFly={() => flyToCapture(c)}
                  readOnly={readOnly}
                  files={version.files}
                />
              ))
            )}
            {(!readOnly || (version.reviewAttachments?.length ?? 0) > 0) && (
              <div className="rounded-xl border border-[#E0E0E6] p-3 space-y-2">
                <p className="text-xs font-semibold text-[#030213]">Attachments for the lab</p>
                {!readOnly && <p className="text-[11px] text-[#717182]">Patient photos, a fresh scan or a report — anything that isn't tied to one view.</p>}
                <FileList files={version.reviewAttachments ?? []} onRemove={readOnly ? undefined : id => removeReviewAttachment(version.id, id)} />
                {!readOnly && <FileDropZone compact uploadedBy="clinician" onAdded={f => addReviewAttachment(version.id, f)} title="Add files for the lab" />}
              </div>
            )}
          </>
        )}

        {tab === 'details' && (
          <dl className="text-sm divide-y divide-[#F0EFF6] border border-[#E0E0E6] rounded-xl">
            {([
              ['Design type', KIND_LABEL[version.kind]],
              ['Source', version.sourceUrl
                ? <a key="s" href={version.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#4D8EF7] hover:text-[#3578E5]">{provider.label} <ExternalLink className="w-3 h-3" /></a>
                : `${provider.label} · ${version.files?.length ?? 0} file${version.files?.length === 1 ? '' : 's'}`],
              ['Service', studioCase.service],
              ['Teeth (FDI)', <span key="t" className="flex flex-wrap gap-1 justify-end"><ToothChips teeth={studioCase.teeth.length > 10 ? [] : studioCase.teeth} />{studioCase.teeth.length > 10 && 'Full arches'}</span>],
              ['Material', studioCase.material],
              ...(!isPlan ? [['Shade (VITA)', version.model.shade === studioCase.shade ? studioCase.shade : `${version.model.shade} (prescribed ${studioCase.shade})`]] as [string, string][] : []),
              ...(isPlan ? [
                ['Stages', `${version.model.stages?.upper} upper / ${version.model.stages?.lower} lower`],
                ['IPR', (version.model.ipr ?? []).map(i => `${i.mm}mm ${i.between.join('/')} at stage ${i.stage}`).join(' · ')],
                ['Attachments', (version.model.attachments ?? []).map(a => `${a.tooth} from stage ${a.fromStage}${a.raisedMm ? ` (raised ${a.raisedMm}mm)` : ''}`).join(' · ')],
                ['Bite ramps', (version.model.biteRamps ?? []).join(', ')],
                ['Elastics', version.model.elasticsFromStage ? `From stage ${version.model.elasticsFromStage}` : '—'],
              ] as [string, string][] : []),
              ['Uploaded', `${studioDateTime(version.uploadedAt)} by ${version.uploadedBy}`],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-3 py-2.5">
                <dt className="text-xs text-[#717182] flex-shrink-0">{k}</dt>
                <dd className="text-xs text-[#030213] text-right">{v}</dd>
              </div>
            ))}
            <div className="px-3 py-2.5">
              <dt className="text-xs text-[#717182] mb-1.5">Sign-off record</dt>
              {studioCase.versions.filter(v => v.signOff).length === 0 && <dd className="text-xs text-[#A0A0B0]">Nothing signed yet.</dd>}
              {studioCase.versions.filter(v => v.signOff).map(v => (
                <dd key={v.id} className="flex items-start gap-1.5 text-[11px] text-[#717182] mb-1">
                  <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  V{v.number}: {v.signOff!.decision === 'approved' ? 'Approved' : 'Changes requested'} by {v.signOff!.name}, {studioDateTime(v.signOff!.at)} · <span className="font-mono">{v.signOff!.versionHash}</span>
                </dd>
              ))}
            </div>
          </dl>
        )}

        {tab === 'lab' && (
          <div className="space-y-3">
            {version.note && (
              <div className="rounded-xl border border-[#E0E0E6] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[9px] font-bold flex items-center justify-center">{LAB_MEMBERS.find(m => m.name === version.uploadedBy)?.initials ?? 'SG'}</span>
                  <p className="text-xs font-semibold text-[#030213]">{version.uploadedBy} · {LAB_MEMBERS.find(m => m.name === version.uploadedBy)?.role ?? studioCase.lab}</p>
                  <span className="text-[10px] text-[#A0A0B0] ml-auto">{studioDate(version.uploadedAt)}</span>
                </div>
                <p className="text-sm text-[#030213] leading-relaxed">{version.note}</p>
              </div>
            )}
            <FileList files={version.files ?? []} title="Design files from the lab" />
            {fromLab.length > 0 && <p className="text-xs font-semibold text-[#030213]">Replies to your Version {prev!.number} comments</p>}
            {fromLab.map(c => (
              <div key={c.id} className="rounded-xl border border-[#F0EFF6] bg-[#F8F9FC] p-3">
                <p className="text-[11px] text-[#717182]">Capture {c.index} · {c.thumbnailLabel}</p>
                <p className="text-xs text-[#030213] mt-1"><span className="font-semibold">{c.labResponse!.by}:</span> {c.labResponse!.note}</p>
              </div>
            ))}
            <p className="text-[11px] text-[#A0A0B0] flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> @mention Anas, Mark or Lorna in any comment to reach them directly.</p>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex-shrink-0 border-t border-[#F0EFF6] px-4 py-3 bg-white">
          <p className="text-[11px] text-[#717182] mb-2">
            {version.captures.length} capture{version.captures.length === 1 ? '' : 's'} · {comments} comment{comments === 1 ? '' : 's'}
            {clinicianFiles(version).length > 0 && ` · ${clinicianFiles(version).length} file${clinicianFiles(version).length === 1 ? '' : 's'}`}
            {unresolved.length > 0 && <span className="text-[#B45309]"> · {unresolved.length} point{unresolved.length === 1 ? '' : 's'} to confirm</span>}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setNote(''); setConfirm('changes'); }}>Request changes</Button>
            <span className="relative group">
              <Button size="sm" disabled={unresolved.length > 0} onClick={() => { setNote(''); setConfirm('approve'); }}>Approve design</Button>
              {unresolved.length > 0 && (
                <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-[#1B1B2D] text-white text-[11px] px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {unresolved.length} point{unresolved.length === 1 ? '' : 's'} from Version {prev!.number} still need{unresolved.length === 1 ? 's' : ''} your confirmation.
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#F8F9FC] font-sans">
      <ReviewChrome
        studioCase={studioCase} version={version} onVersion={v => setViewId(v.id)}
        mode={mode} onMode={setMode} canCompare={!!prev && !submitted}
      />
      {submitted && !viewingOther ? (
        <div className="flex-1 overflow-y-auto">
          <SubmittedState studioCase={studioCase} version={linkVersion} link={link} justSubmitted={justSubmitted} />
        </div>
      ) : desktop ? (
        <div className={`flex-1 min-h-0 grid ${compare ? 'grid-cols-[1fr_380px]' : 'grid-cols-[1fr_420px]'}`}>
          <div className="min-h-0">{viewerArea}</div>
          <aside className="min-h-0 border-l border-[#E0E0E6]">{panel}</aside>
        </div>
      ) : (
        <MobileLayout viewer={viewerArea} panel={panel} />
      )}

      <Modal
        isOpen={confirm === 'approve'}
        onClose={() => setConfirm(null)}
        title="Approve this design?"
        size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button onClick={() => submit('approved')}>Approve design</Button></div>}
      >
        <p className="text-sm text-[#717182]">Approving tells the lab to proceed to manufacture. Your approval is recorded against Version {version.number}.</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Optional note for the lab" className="mt-3 w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm focus:outline-none focus:border-[#4D8EF7]" />
      </Modal>
      <Modal
        isOpen={confirm === 'changes'}
        onClose={() => setConfirm(null)}
        title="Request changes"
        size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button onClick={() => submit('changes-requested')}>Send to the lab</Button></div>}
      >
        <p className="text-sm text-[#717182]">
          {version.captures.length
            ? `Your ${version.captures.length} capture${version.captures.length === 1 ? '' : 's'} and comments go to the lab as a structured review.`
            : 'Add a note so the lab knows what to change — captures make it clearer.'}
        </p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Summary for the lab (optional)" className="mt-3 w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm focus:outline-none focus:border-[#4D8EF7]" />
      </Modal>
    </div>
  );
}

/** Below lg: viewer on top at 55vh, review panel as a sheet that drags up. */
function MobileLayout({ viewer, panel }: { viewer: React.ReactNode; panel: React.ReactNode }) {
  const peek = () => Math.max(170, Math.round(window.innerHeight * 0.45 - 56));
  const [h, setH] = useState(peek);
  const drag = useRef<{ y: number; h: number } | null>(null);
  const expanded = h > window.innerHeight * 0.6;
  useLockBodyScroll(true);
  const snap = (v: number) => setH(v > window.innerHeight * 0.6 ? Math.round(window.innerHeight * 0.88) : peek());
  const handle = useMemo(() => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, h }; },
    onPointerMove: (e: React.PointerEvent) => { if (drag.current) setH(Math.min(window.innerHeight * 0.92, Math.max(160, drag.current.h + (drag.current.y - e.clientY)))); },
    onPointerUp: () => { if (drag.current) snap(h); drag.current = null; },
  }), [h]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex-1 min-h-0 relative">
      <div className="h-[55vh]">{viewer}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(3,2,19,0.12)] flex flex-col" style={{ height: h }}>
        <button
          {...handle}
          onClick={() => snap(expanded ? 0 : window.innerHeight)}
          className="touch-none flex-shrink-0 py-2 flex justify-center"
          aria-label={expanded ? 'Collapse review panel' : 'Expand review panel'}
        >
          <span className="w-10 h-1.5 rounded-full bg-[#E0E0E6]" />
        </button>
        <div className="flex-1 min-h-0">{panel}</div>
      </div>
    </div>
  );
}
