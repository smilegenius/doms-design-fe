import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Box, CheckCircle2, Lock, Plus, RotateCcw, Share2 } from 'lucide-react';
import Button from '../../../src/app/components/Button';
import { useToast } from '../../../src/app/context/ToastContext';
import {
  Capture, DEMO_CASE_IDS, DesignVersion, KIND_LABEL, LAB_MEMBERS, providerFor, ReviewLink, studioDate, studioDateTime,
} from '../data/designStudio';
import { latestVersion, linkForVersion, resetDesignStudioDemo, respondToCapture, useStudio } from '../store/studioStore';
import { Jaws, useCamera } from '../viewer/DesignViewer';
import VersionViewer from '../viewer/VersionViewer';
import { FileList } from '../components/FileChips';
import StageScrubber from '../viewer/StageScrubber';
import { ToothChips } from '../markup/FdiPicker';
import { MentionChip } from '../markup/MentionTextarea';
import CaptureStill from '../review/CaptureStill';
import { labPill } from '../review/CarryForwardChecklist';
import ShareDesignModal from './ShareDesignModal';
import LinkCard from './LinkCard';

// ── Lab side: Design Studio for one case ─────────────────────────────────────
// Rendered inside the real lab Layout. Version rail on the left, the selected
// version on the right: link card, covering note, viewer, the dentist's
// captures and a reply on each.

export const VERSION_STATUS: Record<DesignVersion['status'], { label: string; cls: string }> = {
  'awaiting-review':   { label: 'Awaiting review',   cls: 'bg-[#E3F2FD] text-[#1565C0] border-[#E3F2FD]' },
  'changes-requested': { label: 'Changes requested', cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' },
  'approved':          { label: 'Approved',          cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
  'superseded':        { label: 'Superseded',        cls: 'bg-[#F8F9FC] text-[#717182] border-[#E0E0E6]' },
};

const openPoints = (v: DesignVersion) => v.captures.filter(c => c.status === 'open' || c.status === 'partially-addressed').length;

export function LabReply({ capture, version }: { capture: Capture; version: DesignVersion }) {
  const { toast } = useToast();
  const r = capture.labResponse;
  const [editing, setEditing] = useState(!r);
  const [outcome, setOutcome] = useState<'addressed' | 'partially' | 'cant-do'>(r?.outcome ?? 'addressed');
  const [note, setNote] = useState(r?.note ?? '');
  const [by, setBy] = useState(r?.by ?? 'Mark');
  const needsReason = outcome === 'cant-do' && !note.trim();
  const superseded = version.status === 'superseded' || version.status === 'approved';

  if (!editing && r) {
    return (
      <div className={`rounded-lg border px-3 py-2 flex items-start gap-2 ${r.outcome === 'cant-do' ? 'bg-[#FFF8E1] border-[#FDE68A]' : r.outcome === 'partially' ? 'bg-[#FFF8E1] border-[#FDE68A]' : 'bg-[#ECFDF5] border-[#A7F3D0]'}`}>
        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">{LAB_MEMBERS.find(m => m.name === r.by)?.initials ?? 'SG'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#030213]"><span className="font-semibold">{r.by}:</span> {r.note}</p>
          <p className="text-[10px] text-[#717182] mt-0.5">{studioDateTime(r.at)}</p>
        </div>
        {!superseded && <button onClick={() => setEditing(true)} className="text-[11px] font-medium text-[#4D8EF7] hover:text-[#3578E5]">Edit</button>}
      </div>
    );
  }
  if (superseded) return null;
  return (
    <div className="rounded-lg border border-[#E0E0E6] p-2.5 space-y-2 bg-[#F8F9FC]">
      <div className="inline-flex p-0.5 bg-white border border-[#E0E0E6] rounded-lg">
        {([['addressed', 'Addressed'], ['partially', 'Partially'], ['cant-do', "Can't do"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setOutcome(id)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${outcome === id ? (id === 'addressed' ? 'bg-[#ECFDF5] text-[#047857]' : 'bg-[#FFF8E1] text-[#B45309]') : 'text-[#717182]'}`}>
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder={outcome === 'cant-do' ? "Why can't this be done? (required)" : 'What did you change?'}
        className={`w-full px-3 py-2 rounded-lg border text-xs bg-white focus:outline-none ${needsReason ? 'border-[#FDE68A] focus:border-[#B45309]' : 'border-[#E0E0E6] focus:border-[#4D8EF7]'}`}
      />
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] text-[#717182] inline-flex items-center gap-1.5">
          Replying as
          <select value={by} onChange={e => setBy(e.target.value)} className="px-1.5 py-0.5 rounded border border-[#E0E0E6] text-[11px] text-[#030213] bg-white">
            {LAB_MEMBERS.map(m => <option key={m.id}>{m.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          {r && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>}
          <Button
            size="sm"
            disabled={needsReason || !note.trim()}
            onClick={() => { respondToCapture(version.id, capture.id, outcome, note.trim(), by); setEditing(false); toast.success(`Reply saved on Capture ${capture.index}`); }}
          >
            Save reply
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CaptureRow({ capture, version, onFly }: { capture: Capture; version: DesignVersion; onFly: () => void }) {
  const pill = labPill(capture);
  const outcome = capture.labResponse?.outcome;
  const tone = outcome === 'addressed' ? 'border-[#A7F3D0]' : outcome === 'cant-do' || outcome === 'partially' ? 'border-[#FDE68A]' : 'border-[#E0E0E6]';
  return (
    <div className={`bg-white rounded-xl border ${tone} p-3 flex flex-col sm:flex-row gap-3`}>
      <button onClick={onFly} className="sm:w-56 flex-shrink-0 rounded-lg overflow-hidden border border-[#F0EFF6]" title="Show this view in the viewer">
        <CaptureStill capture={capture} model={version.model} files={version.files} width={480} />
      </button>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-[#030213]">Capture {capture.index} · {capture.thumbnailLabel}</p>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${pill.cls}`}>{pill.label}</span>
        </div>
        <p className="text-sm text-[#030213] whitespace-pre-line">{capture.comment || <span className="text-[#A0A0B0] italic">No comment</span>}</p>
        <div className="flex flex-wrap gap-1">
          <ToothChips teeth={capture.teeth} />
          {capture.mentions.map(id => { const m = LAB_MEMBERS.find(x => x.id === id); return m ? <MentionChip key={id} member={m} /> : null; })}
        </div>
        <FileList files={capture.attachments ?? []} />
        <LabReply capture={capture} version={version} />
      </div>
    </div>
  );
}

export default function DesignStudioPage({ caseId }: { caseId: string }) {
  const [imageIdx, setImageIdx] = useState(0);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const fromCase = params.get('from') === 'case';
  const { cases } = useStudio();
  const studioCase = cases[caseId];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const { camera, setCamera, flyTo } = useCamera();
  const [stage, setStage] = useState(0);
  const [jaws, setJaws] = useState<Jaws>('both');

  useEffect(() => { setSelectedId(null); }, [caseId]);

  if (!studioCase) {
    return (
      <div className="p-8">
        <p className="text-sm text-[#717182]">Design Studio isn't set up for {caseId}.</p>
      </div>
    );
  }

  const versions = [...studioCase.versions].sort((a, b) => b.number - a.number);
  const version = versions.find(v => v.id === selectedId) ?? versions[0];
  const link = version ? linkForVersion(studioCase, version.id) : undefined;
  const latest = versions[0];
  const canShareNext = !!latest && latest.status !== 'approved' && latest.reviewedAt && latest.captures.some(c => c.labResponse);
  const totalStages = version?.kind === 'aligner-plan' ? Math.max(version.model.stages?.upper ?? 0, version.model.stages?.lower ?? 0) : 0;
  const provider = version ? providerFor(version.provider) : undefined;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={() => navigate(fromCase ? `/growth/cases/${encodeURIComponent(caseId)}` : '/growth/cases')} className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213]">
        <ArrowLeft className="w-4 h-4" /> {fromCase ? 'Back to case' : 'Back to Cases'}
      </button>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Design Studio</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F2FD] text-[#1565C0]">{caseId}</span>
          </div>
          <p className="text-sm text-[#717182] mt-1">
            {studioCase.patientName} · {studioCase.service} · {studioCase.practice} · {studioCase.dentist}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {demo && (
            <div className="inline-flex p-0.5 bg-white border border-[#E0E0E6] rounded-lg" title="Demo switcher">
              {DEMO_CASE_IDS.map(id => (
                <button
                  key={id}
                  onClick={() => navigate(`/growth/cases/${id}/studio?demo=1`)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${id === caseId ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white' : 'text-[#717182] hover:text-[#030213]'}`}
                >
                  {cases[id]?.demoLabel}
                </button>
              ))}
            </div>
          )}
          {demo && (
            <button
              onClick={() => { resetDesignStudioDemo(); setSelectedId(null); }}
              title="Restore both demo cases to their seeded state"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#717182] hover:bg-white hover:text-[#030213]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset demo
            </button>
          )}
          {canShareNext && <Button icon={<Share2 className="w-4 h-4" />} onClick={() => setShareOpen(true)}>Share next version</Button>}
        </div>
      </div>

      {!version ? (
        <div className="bg-white rounded-xl border border-[#E0E0E6] flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-[#F8F9FC] rounded-full flex items-center justify-center mb-4"><Box className="w-8 h-8 text-[#717182]" /></div>
          <h3 className="text-xl font-semibold text-[#030213] mb-2">No design shared yet</h3>
          <p className="text-[#717182] text-center mb-6 max-w-md">Paste the link from your design software and we'll build the dentist's review page.</p>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShareOpen(true)}>Share a design</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start">
          {/* Version rail */}
          <aside className="space-y-2 lg:sticky lg:top-6">
            {versions.map(v => {
              const st = VERSION_STATUS[v.status];
              const on = v.id === version.id;
              const n = openPoints(v);
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors relative ${on ? 'bg-gradient-to-r from-[#E3F2FD] to-[#FFFFFF] border-[#4D8EF7]' : 'bg-white border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]">V{v.number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs font-semibold text-[#030213] mt-2">{providerFor(v.provider).label}</p>
                  <p className="text-[11px] text-[#717182]">{studioDate(v.uploadedAt)} · by {v.uploadedBy}</p>
                  <p className="text-[11px] text-[#717182] mt-1">
                    {v.reviewedBy ? `Reviewed by ${v.reviewedBy}` : `With ${studioCase.dentist}`}
                    {v.captures.length > 0 && ` · ${n ? `${n} open point${n === 1 ? '' : 's'}` : 'all points answered'}`}
                  </p>
                </button>
              );
            })}
          </aside>

          {/* Version detail */}
          <section className="space-y-4 min-w-0">
            {/* Always the live link from the store, so its status updates as the dentist opens it. */}
            {link && <LinkCard link={link} version={version} />}

            <div className="bg-white rounded-xl border border-[#E0E0E6] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold text-[#030213]">Version {version.number} · {KIND_LABEL[version.kind]}</p>
                {version.sourceUrl
                  ? <a href={version.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-[#4D8EF7] hover:text-[#3578E5] truncate max-w-full">{provider?.label} · {version.sourceUrl.replace(/^https?:\/\//, '')}</a>
                  : <span className="text-xs text-[#717182]">{provider?.label} · {version.files?.length ?? 0} file{version.files?.length === 1 ? '' : 's'}</span>}
              </div>
              {version.note && <p className="text-sm text-[#030213] bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2"><span className="text-[#717182]">Covering note · </span>{version.note}</p>}
              <VersionViewer
                version={version} imageIndex={imageIdx} onImageIndex={setImageIdx} camera={camera} onCameraChange={setCamera} onFlyTo={flyTo}
                stage={version.kind === 'aligner-plan' ? stage : undefined} jaws={jaws} onJawsChange={setJaws} className="h-[360px]"
              />
              {version.kind === 'aligner-plan' && !version.files?.length && <StageScrubber model={version.model} stage={stage} onStage={setStage} />}
              <FileList files={version.files ?? []} title="Design files" />
            </div>

            {(version.reviewAttachments?.length ?? 0) > 0 && (
              <div className="bg-white rounded-xl border border-[#E0E0E6] p-4">
                <FileList files={version.reviewAttachments!} title={`Files from ${studioCase.dentist}`} />
              </div>
            )}

            {/* Decision + sign-off */}
            {version.decision ? (
              <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${version.decision === 'approved' ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-[#FFF8E1] border-[#FDE68A]'}`}>
                {version.decision === 'approved' ? <CheckCircle2 className="w-5 h-5 text-[#047857] flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-[#B45309] flex-shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${version.decision === 'approved' ? 'text-[#047857]' : 'text-[#B45309]'}`}>
                    {version.decision === 'approved' ? 'Approved' : 'Changes requested'} by {version.reviewedBy} · {studioDateTime(version.reviewedAt!)}
                  </p>
                  {version.decisionNote && <p className="text-sm text-[#030213] mt-0.5">“{version.decisionNote}”</p>}
                  {version.signOff && (
                    <p className="text-[11px] text-[#717182] mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Sign-off record · Version {version.number} · <span className="font-mono">{version.signOff.versionHash}</span></p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#E0E0E6] bg-white px-4 py-3">
                <p className="text-sm text-[#030213]">Waiting for {studioCase.dentist} to review Version {version.number}.</p>
                <p className="text-xs text-[#717182] mt-0.5">Their captures, comments and decision land here as soon as they submit — no email thread to chase.</p>
              </div>
            )}

            {version.captures.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[#030213]">{studioCase.dentist}'s captures ({version.captures.length})</p>
                {version.captures.map(c => (
                  <CaptureRow key={c.id} capture={c} version={version} onFly={() => { if (c.stage !== undefined) setStage(c.stage); flyTo(c.camera); }} />
                ))}
              </div>
            )}
            {totalStages > 0 && <p className="text-[11px] text-[#A0A0B0]">Plan: {version.model.stages?.upper} upper / {version.model.stages?.lower} lower stages.</p>}
          </section>
        </div>
      )}

      {shareOpen && (
        <ShareDesignModal
          studioCase={studioCase}
          onClose={() => setShareOpen(false)}
          onShared={(l: ReviewLink) => { setShareOpen(false); setSelectedId(l.versionId); }}
        />
      )}
    </div>
  );
}

