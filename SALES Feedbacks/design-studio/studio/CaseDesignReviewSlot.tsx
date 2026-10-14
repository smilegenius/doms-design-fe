import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Box, CheckCircle2, ExternalLink, Lock, Plus, Share2, UploadCloud } from 'lucide-react';
import Button from '../../../src/app/components/Button';
import { getCreatedCases } from '../../../src/app/data/createdCases';
import { mockCases, upgradeDemoCase, type Case } from '../../../src/app/pages/CasesPage';
import { KIND_LABEL, providerFor, STUDIO_SERVICES, studioDate, studioDateTime, StudioCase } from '../data/designStudio';
import { ensureStudioCase, latestVersion, linkForVersion, useStudio } from '../store/studioStore';
import { useCamera } from '../viewer/DesignViewer';
import VersionViewer from '../viewer/VersionViewer';
import StageScrubber from '../viewer/StageScrubber';
import { FileList } from '../components/FileChips';
import ShareDesignModal from './ShareDesignModal';
import LinkCard from './LinkCard';
import { CaptureRow, VERSION_STATUS } from './DesignStudioPage';
import { StudioCaseDock } from './StudioEntryPoints';
import RequestFilesPanel, { useRequestFilesChip } from '../../upload-links/RequestFilesPanel';

// ── "Design review" inside the existing case page ────────────────────────────
// CaseDetailPage's per-service menu (Details / Invoice / Shipping) is internal
// to that file, so the sandbox attaches a fourth item at runtime: it finds the
// menu, portals a matching button into it, and — while active — portals the
// Design review panel into the content column (sandbox.css hides the native
// content). Clicking a native item hands control straight back.
// The same slot also hosts "Request files" (upload-links/): every sandbox
// item is a .sf-design-tab button and its panel a .sf-design-panel.

interface Slot { sidebar: HTMLElement; content: HTMLElement }

function findSlot(): Slot | null {
  for (const b of document.querySelectorAll('button')) {
    if (b.textContent?.trim() !== 'Details') continue;
    const side = b.parentElement;
    if (!side) continue;
    const labels = [...side.children]
      .filter(c => c.tagName === 'BUTTON' && !c.classList.contains('sf-design-tab'))
      .map(c => c.textContent?.trim());
    if (labels.join('|') === 'Details|Invoice|Shipping' && side.nextElementSibling instanceof HTMLElement) {
      return { sidebar: side, content: side.nextElementSibling };
    }
  }
  return null;
}

/** Track the case page's service menu + content column as the page re-renders. */
function useCaseDetailSlot() {
  const [slot, setSlot] = useState<Slot | null>(() => findSlot());
  useEffect(() => {
    const check = () => setSlot(prev => {
      const next = findSlot();
      return prev && next && prev.sidebar === next.sidebar && prev.content === next.content ? prev : next;
    });
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    check();
    return () => mo.disconnect();
  }, []);
  return slot;
}

function findPortalCase(id: string): Case | undefined {
  return getCreatedCases().find(c => c.id === id) ?? mockCases.find(c => c.id === id) ?? (upgradeDemoCase.id === id ? upgradeDemoCase : undefined);
}

function CaseDesignPanel({ caseId, portalCase, studioCase }: { caseId: string; portalCase?: Case; studioCase?: StudioCase }) {
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const { camera, setCamera, flyTo } = useCamera();
  const [stage, setStage] = useState(0);
  const [imageIdx, setImageIdx] = useState(0);
  const version = studioCase ? latestVersion(studioCase) : undefined;
  const link = studioCase && version ? linkForVersion(studioCase, version.id) : undefined;
  const older = studioCase ? [...studioCase.versions].sort((a, b) => b.number - a.number).slice(1) : [];
  const canShareNext = !!version && version.status !== 'approved' && !!version.reviewedAt;

  function startShare() {
    if (!studioCase && portalCase) ensureStudioCase(portalCase);
    setShareOpen(true);
  }

  // startShare creates the record first; the modal opens once it arrives from the store.
  const modal = shareOpen && studioCase && (
    <ShareDesignModal studioCase={studioCase} onClose={() => setShareOpen(false)} onShared={() => setShareOpen(false)} />
  );

  if (!version) {
    return (
      <>
        <div className="bg-white border border-[#E0E0E6] rounded-xl flex flex-col items-center justify-center py-14 px-4">
          <div className="w-16 h-16 bg-[#F8F9FC] rounded-full flex items-center justify-center mb-4"><Box className="w-8 h-8 text-[#717182]" /></div>
          <h3 className="text-xl font-semibold text-[#030213] mb-2">No design shared yet</h3>
          <p className="text-[#717182] text-center mb-6 max-w-md">
            Paste the link from your design software — or upload the STL, renders or a PDF — and we'll build {portalCase?.dentist ?? 'the dentist'}'s review page. No login needed on their side.
          </p>
          <Button icon={<Plus className="w-4 h-4" />} onClick={startShare}>Share a design</Button>
        </div>
        {modal}
      </>
    );
  }

  const st = VERSION_STATUS[version.status];
  const provider = providerFor(version.provider);

  return (
    <>
      <div className="bg-white border border-[#E0E0E6] rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]">V{version.number}</span>
          <p className="text-sm font-semibold text-[#030213]">Design review</p>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
          <span className="text-xs text-[#717182]">{KIND_LABEL[version.kind]} · {provider.label} · {studioDate(version.uploadedAt)} by {version.uploadedBy}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />} onClick={() => navigate(`/growth/cases/${encodeURIComponent(caseId)}/studio?from=case`)}>Open Design Studio</Button>
          {canShareNext && <Button size="sm" icon={<Share2 className="w-3.5 h-3.5" />} onClick={() => setShareOpen(true)}>Share next version</Button>}
        </div>
      </div>

      {link && <LinkCard link={link} version={version} />}

      <div className="bg-white border border-[#E0E0E6] rounded-xl p-4 space-y-3">
        {version.note && <p className="text-sm text-[#030213] bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2"><span className="text-[#717182]">Covering note · </span>{version.note}</p>}
        <VersionViewer
          version={version} imageIndex={imageIdx} onImageIndex={setImageIdx}
          camera={camera} onCameraChange={setCamera} onFlyTo={flyTo}
          stage={version.kind === 'aligner-plan' ? stage : undefined} compactPill className="h-[300px]"
        />
        {version.kind === 'aligner-plan' && !version.files?.length && <StageScrubber model={version.model} stage={stage} onStage={setStage} />}
        <FileList files={version.files ?? []} title="Design files" />
      </div>

      {version.decision ? (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${version.decision === 'approved' ? 'bg-[#ECFDF5] border-[#A7F3D0]' : 'bg-[#FFF8E1] border-[#FDE68A]'}`}>
          {version.decision === 'approved' ? <CheckCircle2 className="w-5 h-5 text-[#047857] flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-[#B45309] flex-shrink-0" />}
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${version.decision === 'approved' ? 'text-[#047857]' : 'text-[#B45309]'}`}>
              {version.decision === 'approved' ? 'Approved' : 'Changes requested'} by {version.reviewedBy} · {studioDateTime(version.reviewedAt!)}
            </p>
            {version.decisionNote && <p className="text-sm text-[#030213] mt-0.5">“{version.decisionNote}”</p>}
            {version.signOff && <p className="text-[11px] text-[#717182] mt-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Sign-off record · <span className="font-mono">{version.signOff.versionHash}</span></p>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E0E0E6] bg-white px-4 py-3">
          <p className="text-sm text-[#030213]">Waiting for {studioCase!.dentist} to review Version {version.number}.</p>
          <p className="text-xs text-[#717182] mt-0.5">Their captures, comments, files and decision land here as soon as they submit.</p>
        </div>
      )}

      {(version.reviewAttachments?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-[#E0E0E6] p-4">
          <FileList files={version.reviewAttachments!} title={`Files from ${studioCase!.dentist}`} />
        </div>
      )}

      {version.captures.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[#030213]">{studioCase!.dentist}'s captures ({version.captures.length})</p>
          {version.captures.map(c => (
            <CaptureRow key={c.id} capture={c} version={version} onFly={() => { if (c.stage !== undefined) setStage(c.stage); flyTo(c.camera); }} />
          ))}
        </div>
      )}

      {older.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E0E0E6] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#717182] uppercase tracking-wide mb-2">Earlier versions</p>
          <div className="space-y-1.5">
            {older.map(v => (
              <button key={v.id} onClick={() => navigate(`/growth/cases/${encodeURIComponent(caseId)}/studio?from=case`)} className="w-full flex items-center justify-between gap-3 text-left px-2 py-1.5 rounded-lg hover:bg-[#F8F9FC]">
                <span className="text-xs text-[#030213]">V{v.number} · {studioDate(v.uploadedAt)} · {v.captures.length} capture{v.captures.length === 1 ? '' : 's'}</span>
                <span className="text-[11px] text-[#717182]">{v.decision === 'approved' ? 'Approved' : v.decision === 'changes-requested' ? 'Changes requested' : VERSION_STATUS[v.status].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {modal}
    </>
  );
}

type SandboxItem = 'design' | 'files';

/** Which item to open on arrival; set when a deep link had to click through the Cases list. */
export const pendingOpen: { value: string | null } = { value: null };

const tabCls = (on: boolean) => `sf-design-tab w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
  on
    ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF] text-[#4D8EF7] font-semibold border border-[#DBEAFE]'
    : 'text-[#5A5568] hover:bg-[#F8F9FC] hover:text-[#030213] border border-transparent'
}`;

export default function CaseDesignReviewSlot({ caseId }: { caseId: string }) {
  const slot = useCaseDetailSlot();
  const [active, setActive] = useState<SandboxItem | null>(null);
  const filesChip = useRequestFilesChip(caseId);
  const [gaveUp, setGaveUp] = useState(false);
  const { cases } = useStudio();
  const studioCase = cases[caseId];
  const portalCase = useMemo(() => findPortalCase(caseId), [caseId]);
  const eligible = !!studioCase?.versions.length
    || !!portalCase?.serviceItems.some(si => STUDIO_SERVICES.includes(si.name))
    || !!portalCase?.services.some(s => STUDIO_SERVICES.includes(s));

  useEffect(() => { setActive(null); }, [caseId, slot?.sidebar]);
  // ?sf=design | files opens that item straight away (the What's new examples use it).
  useEffect(() => {
    if (!slot) return;
    const sf = new URLSearchParams(window.location.search).get('sf') ?? pendingOpen.value;
    pendingOpen.value = null;
    if (sf === 'files' || (sf === 'design' && eligible)) setActive(sf === 'files' ? 'files' : 'design');
  }, [slot?.sidebar, caseId, eligible]);
  useEffect(() => { const t = window.setTimeout(() => setGaveUp(true), 2500); return () => window.clearTimeout(t); }, [caseId]);

  // Mark the native menu + content while the Design review item is active.
  useEffect(() => {
    if (!slot) return;
    slot.sidebar.setAttribute('data-sf-design-tab', active ? 'on' : 'off');
    slot.content.setAttribute('data-sf-design-content', active ? 'on' : 'off');
    if (active) slot.content.scrollTop = 0;
    return () => { slot.sidebar.removeAttribute('data-sf-design-tab'); slot.content.removeAttribute('data-sf-design-content'); };
  }, [slot, active]);

  // A native item (Details / Invoice / Shipping) hands control back.
  useEffect(() => {
    if (!slot) return;
    const onClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.sf-design-tab')) setActive(null); };
    slot.sidebar.addEventListener('click', onClick, true);
    return () => slot.sidebar.removeEventListener('click', onClick, true);
  }, [slot]);

  if (!slot) return gaveUp && eligible ? <StudioCaseDock caseId={caseId} /> : null;

  const v = studioCase ? latestVersion(studioCase) : undefined;
  const chip = v ? (v.status === 'awaiting-review' ? 'Awaiting' : v.status === 'approved' ? 'Approved' : v.status === 'changes-requested' ? 'Changes' : `V${v.number}`) : 'New';

  return (
    <>
      {createPortal(
        <>
          {eligible && (
            <button onClick={() => setActive('design')} className={tabCls(active === 'design')}>
              <Box className="w-3.5 h-3.5" />
              Design review
              <span className={`ml-auto px-1.5 py-px rounded-full text-[9px] font-bold ${v ? 'bg-[#E3F2FD] text-[#1565C0]' : 'bg-[#F8F9FC] text-[#717182] border border-[#E0E0E6]'}`}>{chip}</span>
            </button>
          )}
          <button onClick={() => setActive('files')} className={tabCls(active === 'files')}>
            <UploadCloud className="w-3.5 h-3.5" />
            Request files
            <span className={`ml-auto px-1.5 py-px rounded-full text-[9px] font-bold ${filesChip.hot ? 'bg-[#4D8EF7] text-white' : filesChip.label === 'Live' ? 'bg-[#ECFDF5] text-[#047857]' : 'bg-[#F8F9FC] text-[#717182] border border-[#E0E0E6]'}`}>{filesChip.label}</span>
          </button>
        </>,
        slot.sidebar,
      )}
      {active && createPortal(
        <div className="sf-design-panel space-y-4">
          {active === 'design'
            ? <CaseDesignPanel caseId={caseId} portalCase={portalCase} studioCase={studioCase} />
            : <RequestFilesPanel caseId={caseId} portalCase={portalCase} />}
        </div>,
        slot.content,
      )}
    </>
  );
}
