import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, AlertTriangle, MessageSquare, ChevronDown, ChevronUp,
  FileText, MapPin, Download, Calendar, Lightbulb, Maximize2, Minimize2,
  StickyNote, X, Bold, Italic, Underline, Strikethrough, Code as CodeIcon,
  Superscript, Subscript, Undo2, Redo2, Paperclip, Eye, Plus, Minus,
  RotateCw, Maximize, Palette, FolderOpen, MoreHorizontal, Printer,
  Check, Clock, CheckCircle2, Archive, ArchiveRestore,
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';

// ─── Types ────────────────────────────────────────────────────────────────────

type CaseStatus = 'new' | 'submitted' | 'in-production' | 'quality-check' | 'shipped' | 'delivered' | 'refinement' | 'on-hold' | 'completed';
type Tab = 'prescription' | 'timeline' | 'invoice' | 'shipping';
type ViewerFormat = '3D' | 'PLY' | 'STL' | 'OBJ';

// ─── Stage order — one fabrication-stage sub-order on a staged service ─────────
// Denture (and later aligner) cases are ordered in stages. The clinic picks a
// set of stages at creation (the "initial" order, which bundles whatever was
// selected — e.g. Special Tray + Bite Registration + Try In into one order),
// then can place further stage orders over time for the remaining stages.
export interface StageOrder {
  id: string;
  stages: string[];               // the stage names this order covers
  status: CaseStatus;
  deliveryDate: string | null;
  createdAt: string;
}

// Catalog of fabrication stages per staged service. A service whose name is a
// key here renders the stage-order tab strip + "New Stage Order" flow instead
// of the plain single-phase layout. Aligners follow after denture.
export const STAGE_CATALOGS: Record<string, string[]> = {
  'Full Denture':    ['Special Tray', 'Bite Registration', 'Try In', 'Finish'],
  'Partial Denture': ['Special Tray', 'Bite Registration', 'Try In', 'Finish'],
};

// ─── Service Item — one row per service inside a multi-service case ────────────
export interface ServiceItem {
  id: string;
  name: string;
  status: CaseStatus;
  deliveryDate: string | null;
  /** Multi-phase services (e.g. Clear Aligners Phase 1/2) */
  phases?: {
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'received';
    deliveryDate?: string;
  }[];
  /** Staged services (denture/aligner) — the stages selected at creation and
      the stage orders placed so far. When absent for a service that has a
      STAGE_CATALOGS entry, CaseDetailPage seeds a sensible initial order. */
  stages?: string[];
  stageOrders?: StageOrder[];
  /** Clear Aligners only — set when the case's "Phasing" field is Yes. Drives
      the open-ended, auto-named Phase 1 / Phase 2 … phase-order tab strip.
      Undefined is treated as enabled for aligners (prototype default). */
  phasing?: boolean;
  /** Per-service prescription data — surfaces in the per-service Details tab and summary cards. */
  fdi?: number[];                  // selected teeth FDI numbers
  material?: string;               // e.g. 'Zirconia', 'PFM', 'E.max'
  shade?: string;                  // e.g. 'A2', 'B1'
  orderType?: string;              // 'NHS' | 'Private'
  instructions?: string;           // service-specific instructions
  scanFileCount?: number;          // number of scan files for this service
  attachmentCount?: number;        // number of attachments for this service
}

interface CaseForDetail {
  id: string;
  patientName: string;
  practice: string;
  dentist: string;
  services: string[];
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  requestedDelivery: string | null;
  hasAlert: boolean;
  /** Service-level detail — one entry per service on this case */
  serviceItems?: ServiceItem[];
  /** Whether this case is archived (hidden from the main Cases list). */
  archived?: boolean;
}

interface CaseDetailPageProps {
  caseData: CaseForDetail;
  onBack: () => void;
  /** Toggle this case's archived state — wired from the Cases list. */
  onArchiveToggle?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<CaseStatus, { label: string; bg: string; color: string; border: string; banner: string; dot: string }> = {
  new:            { label: 'New',           bg: '#EEF4FF', color: '#1565C0', border: '#BFDBFE', banner: '#EFF6FF', dot: '#4D8EF7' },
  submitted:      { label: 'Submitted',     bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', banner: '#FFF7ED', dot: '#F97316' },
  'in-production':{ label: 'In Production', bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE', banner: '#F5F3FF', dot: '#8B5CF6' },
  'quality-check':{ label: 'Quality Check', bg: '#FFF7ED', color: '#B45309', border: '#FDE68A', banner: '#FFFBEB', dot: '#F59E0B' },
  shipped:        { label: 'Shipped',       bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0', banner: '#ECFDF5', dot: '#10B981' },
  delivered:      { label: 'Delivered',     bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', banner: '#F0FDF4', dot: '#22C55E' },
  refinement:     { label: 'Refinement',    bg: '#FDF4FF', color: '#7E22CE', border: '#E9D5FF', banner: '#FDF4FF', dot: '#A855F7' },
  'on-hold':      { label: 'On Hold',       bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3', banner: '#FFF1F2', dot: '#E11D48' },
  completed:      { label: 'Completed',     bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0', banner: '#F0FDF4', dot: '#16A34A' },
};

const SERVICE_ICON_COLOR: Record<string, { bg: string; color: string }> = {
  'Veneers':         { bg: '#FFF7ED', color: '#F59E0B' },
  'Crown':           { bg: '#EEF4FF', color: '#4D8EF7' },
  'Retainer':        { bg: '#F0FDF4', color: '#22C55E' },
  'Night Guard':     { bg: '#F5F3FF', color: '#8B5CF6' },
  'Clear Aligners':  { bg: '#EEF4FF', color: '#3B82F6' },
  'Bridge':          { bg: '#FDF4FF', color: '#A855F7' },
  'Partial Denture': { bg: '#FFF1F2', color: '#EF4444' },
  'Full Denture':    { bg: '#ECFDF5', color: '#10B981' },
};

// ─── Case pipeline timeline ───────────────────────────────────────────────────
// Mirrors the canonical pipeline used by the invoice overlay's timeline modal.
// Each step has a label, done flag, optional timestamp/sub, and an optional
// `state` marker ('current' / 'blocked') so the UI can render the active step
// with a coloured pulse + "You are here" badge.

interface CaseTimelineStep {
  label: string;
  done: boolean;
  timestamp?: string;
  sub?: string;
  state?: 'current' | 'blocked';
}

const PIPELINE_RANK: Record<CaseStatus, number> = {
  new: 0, submitted: 1, 'in-production': 2, 'quality-check': 3,
  shipped: 4, delivered: 5,
  // Soft states stay where the case currently sits in the pipeline.
  refinement: 3, 'on-hold': 2, completed: 5,
};

function buildCasePipeline(c: CaseForDetail): CaseTimelineStep[] {
  const rank = PIPELINE_RANK[c.status] ?? 0;
  const blocked = c.status === 'refinement' || c.status === 'on-hold';

  const stages: CaseTimelineStep[] = [
    { label: 'New',           done: true,             timestamp: c.createdAt, sub: 'Case created' },
    { label: 'Submitted',     done: rank >= 1,        timestamp: rank >= 1 ? c.createdAt : undefined, sub: 'Sent to lab' },
    { label: 'In Production', done: rank >= 2 && !blocked, timestamp: rank >= 2 ? c.updatedAt : undefined, sub: 'Being manufactured' },
    { label: 'Quality Check', done: rank >= 3 && !blocked, timestamp: rank >= 3 ? c.updatedAt : undefined, sub: 'QA review' },
    { label: 'Shipped',       done: rank >= 4,        timestamp: rank >= 4 ? c.updatedAt : undefined, sub: 'On its way' },
    { label: 'Delivered',     done: rank >= 5,        timestamp: rank >= 5 ? c.updatedAt : undefined, sub: 'Received at clinic' },
  ];

  // Mark the live / blocked step so the UI can highlight where the case actually sits.
  if (c.status === 'refinement') {
    stages[3].state = 'blocked';
    stages[3].label = 'Refinement';
    stages[3].sub   = 'Returned for adjustments';
  } else if (c.status === 'on-hold') {
    stages[2].state = 'blocked';
    stages[2].label = 'On Hold';
    stages[2].sub   = 'Awaiting clarification';
  } else if (rank < 5) {
    stages[Math.min(rank, 5)].state = 'current';
  }
  return stages;
}

// Compact case-timeline pill — sits in the identity card header row alongside
// the case number + status, mirrors the invoice overlay's compact pill. Clicking
// opens the full horizontal timeline in a modal.
function CaseTimelinePill({ caseData, onClick }: { caseData: CaseForDetail; onClick: () => void }) {
  const pipeline = buildCasePipeline(caseData);
  const markedIdx = pipeline.findIndex(s => s.state === 'current' || s.state === 'blocked');
  const currentIdx = markedIdx >= 0
    ? markedIdx
    : (() => {
        for (let i = pipeline.length - 1; i >= 0; i--) if (pipeline[i].done) return i;
        return 0;
      })();
  const current = pipeline[currentIdx];
  const isBlocked = current.state === 'blocked';

  // Show only the steps that have actually happened (done) + the current step.
  // We don't render upcoming dots — cases can move forward and backward so future
  // steps shouldn't be predicted.
  const actualSteps = pipeline.filter((s, i) => s.done || i === currentIdx);

  return (
    <button
      onClick={onClick}
      title="Open case timeline"
      className={`inline-flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full border hover:shadow-sm transition-all group ${
        isBlocked
          ? 'border-[#F9DCDC] bg-gradient-to-r from-[#FFF5F5] via-white to-[#FFF5F5] hover:border-[#C62828]/40'
          : 'border-[#E8EAF6] bg-gradient-to-r from-[#F5F8FF] via-white to-[#FAF7FF] hover:border-[#4D8EF7]/40'
      }`}
    >
      <span className="relative inline-flex items-center justify-center w-5 h-5 flex-shrink-0">
        <span className={`absolute inline-flex w-5 h-5 rounded-full opacity-40 animate-ping ${isBlocked ? 'bg-[#C62828]' : 'bg-[#4D8EF7]'}`} />
        <span className={`relative inline-flex items-center justify-center w-5 h-5 rounded-full ${isBlocked ? 'bg-[#C62828]' : 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'}`}>
          {isBlocked ? <AlertTriangle className="w-2.5 h-2.5 text-white" /> : <Clock className="w-2.5 h-2.5 text-white" />}
        </span>
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className={`text-[10px] font-semibold truncate max-w-[180px] ${isBlocked ? 'text-[#C62828]' : 'text-[#030213]'}`}>
          {isBlocked ? `You are here — ${current.label}` : current.label}
        </span>
        <span className="text-[9px] text-[#717182] truncate max-w-[180px]">{current.timestamp ?? '—'}</span>
      </span>
      {/* Mini dots — only the steps that actually happened */}
      <span className="hidden sm:inline-flex items-center gap-0.5 ml-1">
        {actualSteps.map((s, i) => {
          const isCurr = i === actualSteps.length - 1 && (s.state === 'current' || s.state === 'blocked');
          const blocked = s.state === 'blocked';
          return (
            <span
              key={i}
              className={`block w-1.5 h-1.5 rounded-full ${
                isCurr
                  ? (blocked ? 'bg-[#C62828] ring-2 ring-[#C62828]/30' : 'bg-[#4D8EF7] ring-2 ring-[#4D8EF7]/30')
                  : 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
              }`}
            />
          );
        })}
      </span>
      <ChevronDown className="w-3 h-3 text-[#A0A0B0] group-hover:text-[#4D8EF7] transition-colors" />
    </button>
  );
}

// Full case timeline rendered inside a modal — portaled to document.body so it
// sits above the layout chrome, with no inner scroll (the timeline fits naturally).
function CaseTimelineModal({ caseData, onClose }: { caseData: CaseForDetail; onClose: () => void }) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
            <p className="text-sm font-semibold text-[#030213]">Case Timeline · {caseData.id}</p>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 bg-gradient-to-br from-[#F8FAFF] via-white to-[#FAF8FF]">
            <CaseTimeline caseData={caseData} />
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// Inline case-pipeline timeline — same visual language as the invoice timeline modal.
// Renders ONLY the steps that have actually happened (done + current/blocked).
// Upcoming steps are not predicted — cases can move forward and backward.
function CaseTimeline({ caseData }: { caseData: CaseForDetail }) {
  const fullPipeline = buildCasePipeline(caseData);
  const currentIdx = (() => {
    const marked = fullPipeline.findIndex(s => s.state === 'current' || s.state === 'blocked');
    if (marked >= 0) return marked;
    for (let i = fullPipeline.length - 1; i >= 0; i--) if (fullPipeline[i].done) return i;
    return 0;
  })();
  // Slice to only the journey so far — drop everything after the current step.
  const pipeline = fullPipeline.slice(0, currentIdx + 1);
  const blockedStep = pipeline.find(s => s.state === 'blocked');
  const currentStep = pipeline.find(s => s.state === 'current');

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-2xl shadow-[0_1px_2px_rgba(77,142,247,0.06)] overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#F0EFF6] bg-gradient-to-r from-[#F5F8FF] via-white to-[#FAF7FF] flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            blockedStep ? 'bg-[#C62828]' : 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
          }`}>
            {blockedStep ? <AlertTriangle className="w-3.5 h-3.5 text-white" /> : <Clock className="w-3.5 h-3.5 text-white" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#030213]">Case Timeline</p>
            <p className="text-[11px] text-[#717182]">{caseData.id} · {caseData.practice}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {blockedStep && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FFEBEE] border border-[#F9DCDC] text-[10px] font-bold text-[#C62828] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C62828] animate-pulse" />
              {blockedStep.label}
            </span>
          )}
          {currentStep && !blockedStep && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EEF4FF] border border-[#C8D8FC] text-[10px] font-bold text-[#1565C0] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1565C0] animate-pulse" />
              {currentStep.label}
            </span>
          )}
        </div>
      </div>

      {/* Horizontal step layout */}
      <div className="px-4 py-5 bg-gradient-to-br from-[#F8FAFF] via-white to-[#FAF8FF]">
        <div>
          <div
            className="grid gap-0 mx-auto"
            style={{
              gridTemplateColumns: pipeline.map(() => 'minmax(0, 1fr)').join(' '),
              gridAutoFlow: 'row',
            }}
          >
            {/* Labels row */}
            {pipeline.map((step, i) => {
              const isBlockedStep = step.state === 'blocked';
              const isCurrentStep = step.state === 'current';
              const isLive = isBlockedStep || isCurrentStep;
              return (
                <div key={`label-${i}`} className="text-center px-2 pb-3">
                  {isLive && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mb-1 ${
                      isBlockedStep
                        ? 'bg-[#FFEBEE] text-[#C62828] border border-[#F9DCDC]'
                        : 'bg-[#EEF4FF] text-[#1565C0] border border-[#C8D8FC]'
                    }`}>
                      <span className={`w-1 h-1 rounded-full ${isBlockedStep ? 'bg-[#C62828]' : 'bg-[#1565C0]'} animate-pulse`} />
                      You are here
                    </span>
                  )}
                  <p className={`text-xs font-semibold leading-tight ${
                    isBlockedStep ? 'text-[#C62828]' :
                    isCurrentStep ? 'text-[#1565C0]' :
                    step.done ? 'text-[#030213]' : 'text-[#A0A0B0]'
                  }`}>
                    {step.label}
                  </p>
                  {step.timestamp && (
                    <p className={`text-[10px] mt-1 leading-tight ${step.done || isLive ? 'text-[#717182]' : 'text-[#C8C8D4]'}`}>
                      {step.timestamp}
                    </p>
                  )}
                  {step.sub && (
                    <p className={`text-[10px] mt-0.5 leading-tight italic ${step.done || isLive ? 'text-[#A0A0B0]' : 'text-[#D4CEE1]'}`}>
                      {step.sub}
                    </p>
                  )}
                </div>
              );
            })}
            {/* Dots row */}
            {pipeline.map((step, i) => {
              const isLast = i === pipeline.length - 1;
              const nextDone = !isLast && pipeline[i + 1].done;
              const isBlockedStep = step.state === 'blocked';
              const isCurrentStep = step.state === 'current';
              const showPulse = isCurrentStep || isBlockedStep || (step.done && !nextDone && !isLast && !pipeline.some(s => s.state === 'current' || s.state === 'blocked'));
              return (
                <div key={`dot-${i}`} className="relative flex items-center justify-center h-6">
                  {i > 0 && (
                    <div className={`absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-0.5 ${
                      pipeline[i - 1].done && step.done ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' :
                      pipeline[i - 1].done && isBlockedStep ? 'bg-gradient-to-r from-[#4D8EF7] to-[#C62828]' :
                      pipeline[i - 1].done && isCurrentStep ? 'bg-gradient-to-r from-[#4D8EF7] to-[#1565C0]' :
                      pipeline[i - 1].done ? 'bg-gradient-to-r from-[#4D8EF7] to-[#E8E8EC]' : 'bg-[#E8E8EC]'
                    }`} />
                  )}
                  {!isLast && (
                    <div className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-0.5 ${
                      step.done && nextDone ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' :
                      step.done ? 'bg-gradient-to-r from-[#A59DFF] to-[#E8E8EC]' : 'bg-[#E8E8EC]'
                    }`} />
                  )}
                  <div className="relative z-10 flex items-center justify-center">
                    {showPulse && (
                      <span className={`absolute inline-flex w-6 h-6 rounded-full opacity-30 animate-ping ${
                        isBlockedStep ? 'bg-[#C62828]' : 'bg-[#4D8EF7]'
                      }`} />
                    )}
                    <div className={`relative w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                      isBlockedStep
                        ? 'bg-[#C62828] border-[#C62828] shadow-sm shadow-[#C62828]/40'
                        : isCurrentStep
                          ? 'bg-white border-[#1565C0] ring-2 ring-[#1565C0]/30'
                          : step.done
                            ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] border-transparent shadow-sm shadow-[#4D8EF7]/40'
                            : 'bg-white border-[#D4CEE1]'
                    }`}>
                      {isBlockedStep
                        ? <AlertTriangle className="w-2.5 h-2.5 text-white" />
                        : isCurrentStep
                          ? <span className="w-1.5 h-1.5 rounded-full bg-[#1565C0]" />
                          : step.done
                            ? <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tooth Chart — illustrated image with selected-teeth chips ────────────────
// The realistic tooth illustration is dropped in as a single image; selected
// tooth numbers from the order are surfaced as colored chips above and below
// it so they're still easy to scan at a glance.

// FDI tooth-number arrays — kept for future per-tooth selection / quadrant overlay
// (the chart currently just shows the illustrated image).
// const UPPER_TEETH = [18,17,16,15,14,13,12,11, 21,22,23,24,25,26,27,28];
// const LOWER_TEETH = [48,47,46,45,44,43,42,41, 31,32,33,34,35,36,37,38];

function ToothChart({ compact = false }: {
  // Kept for backwards compatibility with existing call sites — values are not
  // rendered as separate badge rows any more, the chart only shows the illustration.
  selectedUpper?: number[];
  selectedLower?: number[];
  compact?: boolean;
}) {
  const w = compact ? 200 : 240;
  return (
    <div className="flex justify-center">
      <img
        src="/dental-arch.svg"
        alt="Dental arch chart"
        style={{ width: w, height: 'auto' }}
        className="flex-shrink-0 select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
}

// ─── Lab Notes Modal ──────────────────────────────────────────────────────────

export function LabNotesModal({ onClose, expanded, onToggleExpand }: { onClose: () => void; expanded: boolean; onToggleExpand: () => void; }) {
  const [body, setBody] = useState('');
  const toolbarBtn = 'w-7 h-7 rounded-md hover:bg-[#F0EFF6] flex items-center justify-center text-[#5A5568] transition-colors';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl flex flex-col transition-all ${
          expanded ? 'w-[90vw] h-[88vh]' : 'w-full max-w-xl max-h-[80vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0EFF6]">
          <button onClick={onToggleExpand} title={expanded ? 'Collapse' : 'Expand'} className="w-7 h-7 rounded-md hover:bg-[#F0EFF6] flex items-center justify-center text-[#5A5568] transition-colors">
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <h3 className="text-sm font-semibold text-[#030213]">Lab Notes</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#F3F3F5] flex items-center justify-center text-[#717182] hover:bg-[#E8E8EC] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Empty-state title row */}
        <div className="px-5 py-4 text-center text-[#A0A0B0] text-sm">Notes</div>

        {/* Rich text toolbar */}
        <div className="px-3 py-2 border-y border-[#F0EFF6] flex items-center gap-0.5 flex-wrap">
          <button className={toolbarBtn} title="Bold"><Bold className="w-3.5 h-3.5" /></button>
          <button className={toolbarBtn} title="Italic"><Italic className="w-3.5 h-3.5" /></button>
          <button className={toolbarBtn} title="Underline"><Underline className="w-3.5 h-3.5" /></button>
          <button className={toolbarBtn} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></button>
          <span className="w-px h-4 bg-[#E0E0E6] mx-1" />
          <button className={toolbarBtn} title="Code"><CodeIcon className="w-3.5 h-3.5" /></button>
          <button className={toolbarBtn} title="Superscript"><Superscript className="w-3.5 h-3.5" /></button>
          <button className={toolbarBtn} title="Subscript"><Subscript className="w-3.5 h-3.5" /></button>
          <span className="w-px h-4 bg-[#E0E0E6] mx-1" />
          <button className={toolbarBtn} title="Undo"><Undo2 className="w-3.5 h-3.5" /></button>
          <button className={toolbarBtn} title="Redo"><Redo2 className="w-3.5 h-3.5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 overflow-y-auto">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your notes here…"
            className="w-full h-full min-h-[140px] resize-none outline-none text-sm text-[#030213] placeholder:text-[#A0A0B0]"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0EFF6] flex items-center justify-between bg-[#FAFBFC]">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-white transition-colors">
            <Paperclip className="w-3.5 h-3.5" />
            Attach Files
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-white transition-colors">
              Cancel
            </button>
            <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity">
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Viewer & Order-form panels ───────────────────────────────────────────────

function ScanViewer({ format, onFormatChange }: { format: ViewerFormat; onFormatChange: (f: ViewerFormat) => void }) {
  return (
    <div className="relative bg-[#F0F2F7] rounded-xl border border-[#E0E0E6] h-[320px] overflow-hidden flex items-center justify-center">
      {/* Format tabs */}
      <div className="absolute top-3 left-3 inline-flex items-center bg-white border border-[#E0E0E6] rounded-lg overflow-hidden text-[11px] font-semibold">
        {(['3D','PLY','STL','OBJ'] as ViewerFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => onFormatChange(f)}
            className={`px-2.5 py-1 transition-colors ${format === f ? 'text-[#4D8EF7]' : 'text-[#717182] hover:text-[#030213]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Top-right tool cluster */}
      <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-[#1B1B2D] rounded-lg p-1.5">
        <button className="w-7 h-7 rounded-md bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center" title="Annotate">
          <Palette className="w-3.5 h-3.5 text-white" />
        </button>
        <button className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80" title="Crop">
          <Maximize className="w-3.5 h-3.5" />
        </button>
        <button className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-white/80" title="More">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Placeholder render — show the rendered teeth image while no real scan is attached.
          Drop a custom PNG into /public/teeth-3d.png and it will be picked up automatically;
          otherwise the existing dental-arch.svg is used as a fallback. */}
      <img
        src="/teeth-3d.png"
        alt="Teeth preview"
        className="max-h-[80%] max-w-[80%] object-contain select-none pointer-events-none"
        draggable={false}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/dental-arch.svg'; }}
      />

      {/* Bottom viewer controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-[#1B1B2D] rounded-full px-2 py-1.5">
        {[Minus, Plus, RotateCw, Maximize, Palette].map((Icon, i) => (
          <button
            key={i}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
              i === 4 ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]' : 'hover:bg-white/10'
            }`}
          >
            <Icon className="w-3.5 h-3.5 text-white" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Full View modal — expanded 3D + order form + teeth chart ────────────────
// Compact centered modal — shows ONLY the Order form + Lab Documents tabs.
// Opened from the Eye icon in the Cases list so users can scan the form
// details without leaving the listing or loading the 3D viewer.
export function OrderFormModal({ caseData, onClose }: {
  caseData: CaseForDetail;
  onClose: () => void;
}) {
  const [orderTab, setOrderTab] = useState<'order-form' | 'lab-documents'>('order-form');
  const selectedUpper = [11, 12, 13, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
            <div>
              <p className="text-sm font-semibold text-[#030213]">Order Form · {caseData.id}</p>
              <p className="text-[11px] text-[#717182] mt-0.5">{caseData.patientName} · {caseData.practice}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex items-center border-b border-[#F0EFF6] px-5">
            <button
              onClick={() => setOrderTab('order-form')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                orderTab === 'order-form' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <Eye className="w-4 h-4" />
              Order form
            </button>
            <button
              onClick={() => setOrderTab('lab-documents')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                orderTab === 'lab-documents' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Lab Documents
            </button>
            <button className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:underline">
              <Printer className="w-3 h-3" />
              Print
            </button>
          </div>

          {/* Body */}
          {orderTab === 'order-form' ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <Section title="Details">
                <KV label="Lab" value="Smile Genius Lab" />
                <KV label="Clinic" value={caseData.practice} />
                <KV label="Dentist" value={caseData.dentist} />
                <KV label="Dentist Contact" value="+44 20 7946 0000" />
              </Section>
              <Section title="Patient">
                <KV label="Patient" value={caseData.patientName} />
                <KV label="DOB / Gender" value="— / —" />
                <KV label="Ship to Address" value="—" />
                <KV label="SG Case ID" value={caseData.id} />
              </Section>
              <Section title="Case Instructions">
                <p className="text-xs text-[#A0A0B0]">No additional instructions provided.</p>
              </Section>
              <Section title={caseData.services[0] ?? 'Service'}>
                <KV label="FDI" value={selectedUpper.join(', ')} />
                <KV label="Order Type" value="NHS" />
                <KV label="Material" value="—" muted />
                <KV label="Brand" value="—" muted />
              </Section>
              <Section title="Scan Files">
                <p className="text-xs text-[#A0A0B0]">No scan files attached.</p>
              </Section>
              <Section title="Attachments">
                <p className="text-xs text-[#A0A0B0]">No attachments.</p>
              </Section>
            </div>
          ) : (
            <div className="flex-1 p-5 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#F0EFF6] flex items-center justify-center">
                <FolderOpen className="w-7 h-7 text-[#C8C0F0]" />
              </div>
              <p className="text-sm text-[#A0A0B0]">No lab documents uploaded for this case yet.</p>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

// Mirrors the production "Full View" overlay: 3 columns side-by-side that
// expand to fill the screen. The compact inline panels remain on the page —
// this modal is just a richer reading view. Exported so the Case Detail page
// can also open the same overlay from its action bar.
export function FullViewModal({ caseData, onClose, onOpenNotes }: {
  caseData: CaseForDetail;
  onClose: () => void;
  onOpenNotes: () => void;
}) {
  const [viewerFormat, setViewerFormat] = useState<ViewerFormat>('3D');
  const [orderTab, setOrderTab] = useState<'order-form' | 'lab-documents'>('order-form');
  const selectedUpper = [11,12,13,17,18,21,22,23,24,25,26,27,28];

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      {/* ── Top action bar — case ID + actions + close ── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#F0EFF6] bg-white flex-shrink-0">
        <h2 className="text-lg font-semibold text-[#030213]">{caseData.id}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNotes}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#030213] text-white text-sm font-semibold hover:bg-[#1B1B2D] transition-colors"
          >
            Notes
            <StickyNote className="w-3.5 h-3.5" />
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#EEF4FF] border border-[#C8D8FC] text-sm font-medium text-[#1565C0] hover:bg-[#DBEAFE] transition-colors">
            Download all files
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#F3F3F5] flex items-center justify-center text-[#717182] hover:bg-[#E8E8EC] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body — 3 columns: viewer | order tabs | creation + teeth chart ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] overflow-hidden">

        {/* Left — large 3D viewer with thumbnail switcher */}
        <div className="relative bg-[#F0F2F7] border-r border-[#F0EFF6] overflow-hidden flex items-center justify-center">
          <div className="absolute top-4 left-4 inline-flex items-center bg-white border border-[#E0E0E6] rounded-lg overflow-hidden text-xs font-semibold">
            {(['3D','PLY','STL','OBJ'] as ViewerFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setViewerFormat(f)}
                className={`px-3 py-1.5 transition-colors ${viewerFormat === f ? 'text-[#4D8EF7]' : 'text-[#717182] hover:text-[#030213]'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="absolute top-4 right-4 inline-flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${i === 0 ? 'bg-white border border-[#E0E0E6] ring-2 ring-[#4D8EF7]/30' : 'bg-[#1B1B2D]/80 hover:bg-[#1B1B2D]'}`}
                title={`View ${i + 1}`}
              >
                <img src="/dental-arch.svg" alt="" className="w-5 h-5 object-cover" style={{ filter: i === 0 ? 'none' : 'brightness(2) invert(0.9)' }} />
              </button>
            ))}
          </div>
          <img
            src="/teeth-3d.png"
            alt="Teeth preview"
            className="max-h-[70%] max-w-[70%] object-contain select-none pointer-events-none"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/dental-arch.svg'; }}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-[#1B1B2D] rounded-full px-2 py-1.5">
            {[Minus, Plus, RotateCw, Maximize, Palette].map((Icon, i) => (
              <button
                key={i}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${i === 4 ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]' : 'hover:bg-white/10'}`}
              >
                <Icon className="w-3.5 h-3.5 text-white" />
              </button>
            ))}
          </div>
        </div>

        {/* Right — Order form panel (tabs + form sections + creation + teeth chart all together) */}
        <div className="relative flex flex-col bg-white overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-[#F0EFF6] px-5">
            <button
              onClick={() => setOrderTab('order-form')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                orderTab === 'order-form' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <Eye className="w-4 h-4" />
              Order form
            </button>
            <button
              onClick={() => setOrderTab('lab-documents')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                orderTab === 'lab-documents' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Internal Documents
            </button>
          </div>

          {orderTab === 'order-form' ? (
            <div className="flex-1 overflow-y-auto">
              {/* Two-column body inside the Order form panel:
                  form fields on the left, Creation + Teeth Chart on the right. */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 p-5">
                {/* Form sections */}
                <div className="space-y-5">
                  <Section title="Details">
                    <KV label="Lab" value="Smile Genius Lab" />
                    <KV label="Clinic" value={caseData.practice} />
                    <KV label="Dentist" value={caseData.dentist} />
                    <KV label="Dentist Contact" value="+44 20 7946 0000" />
                  </Section>
                  <Section title="Patient">
                    <KV label="Patient" value={caseData.patientName} />
                    <KV label="DOB / Gender" value="— / —" />
                    <KV label="Ship to Address" value="—" />
                    <KV label="SG Case ID" value={caseData.id} />
                  </Section>
                  <Section title="Case Instructions">
                    <p className="text-xs text-[#A0A0B0]">No additional instructions provided.</p>
                  </Section>
                  <Section title={caseData.services[0] ?? 'Service'}>
                    <KV label="FDI" value={selectedUpper.join(', ')} />
                    <KV label="Order Type" value="NHS" />
                    <KV label="Material" value="—" muted />
                    <KV label="Brand" value="—" muted />
                  </Section>
                  <Section title="Scan Files">
                    <p className="text-xs text-[#A0A0B0]">No scan files attached.</p>
                  </Section>
                  <Section title="Attachments">
                    <p className="text-xs text-[#A0A0B0]">No attachments.</p>
                  </Section>
                </div>

                {/* Creation + Teeth Chart — still inside the same Order form panel */}
                <div className="space-y-5">
                  <Section title="Creation">
                    <KV label="Case Created" value={caseData.createdAt} />
                    <KV label="Delivery Date" value={caseData.requestedDelivery ?? '—'} />
                    <KV label="Submitted by" value={caseData.practice} />
                    <KV label="Received Via" value="Manual upload" />
                  </Section>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-0.5 h-3 bg-[#4D8EF7] rounded-full" />
                      <p className="text-[11px] font-bold text-[#4D8EF7] uppercase tracking-wide">Teeth Chart</p>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src="/dental-arch.svg"
                        alt="Dental arch chart"
                        className="w-full max-w-[240px] h-auto select-none pointer-events-none"
                        draggable={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 flex flex-col items-center justify-center text-center gap-3 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-[#F0EFF6] flex items-center justify-center">
                <FolderOpen className="w-7 h-7 text-[#C8C0F0]" />
              </div>
              <p className="text-sm text-[#A0A0B0]">No internal documents uploaded for this case yet.</p>
            </div>
          )}

          {/* Floating Print button — sits over the Order form panel */}
          <button className="absolute bottom-5 right-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#4D8EF7]/30">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Prescription Tab — main content ──────────────────────────────────────────

function PrescriptionTab({ caseData, onOpenNotes, onOpenFullView }: {
  caseData: CaseForDetail;
  onOpenNotes: () => void;
  onOpenFullView: () => void;
}) {
  const [orderOpen, setOrderOpen] = useState(true);
  const [viewerFormat, setViewerFormat] = useState<ViewerFormat>('3D');
  const [orderTab, setOrderTab] = useState<'order-form' | 'lab-documents'>('order-form');
  const selectedTeeth = [11,12,13,17,18,21,22,23,24,25,26,27,28];

  return (
    <div className="space-y-4">
      {/* ── Action bar — Notes / Download / Full view ── */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl px-3 py-2 flex items-center justify-end gap-2">
        <button
          onClick={onOpenNotes}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#030213] text-white text-xs font-semibold hover:bg-[#1B1B2D] transition-colors"
        >
          Notes
          <StickyNote className="w-3.5 h-3.5" />
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
        >
          Download all files
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onOpenFullView}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
        >
          Full View
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Case instructions ── */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-[#717182]">Case Instructions</p>
          <span className="text-[10px] text-[#A0A0B0]">Updated: {caseData.updatedAt}</span>
        </div>
        <p className="text-xs text-[#A0A0B0]">No additional instructions provided.</p>
      </div>

      {/* ── 3D viewer + Order form (side-by-side, stacked on mobile) ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Left: scan viewer */}
        <ScanViewer format={viewerFormat} onFormatChange={setViewerFormat} />

        {/* Right: Order form / Lab Documents tabs */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl flex flex-col">
          <div className="flex items-center border-b border-[#F0EFF6] px-4">
            <button
              onClick={() => setOrderTab('order-form')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                orderTab === 'order-form' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Order form
            </button>
            <button
              onClick={() => setOrderTab('lab-documents')}
              className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                orderTab === 'lab-documents' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Lab Documents
            </button>
            <button className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:underline">
              <Printer className="w-3 h-3" />
              Print
            </button>
          </div>

          {orderTab === 'order-form' ? (
            <div className="p-4 space-y-4 overflow-y-auto max-h-[340px]">
              <Section title="Details">
                <KV label="Lab Name" value="Smile Genius Lab" />
                <KV label="Clinic Name" value={caseData.practice} />
                <KV label="Dentist Name" value={caseData.dentist} />
                <KV label="Dentist Contact Number" value="—" />
              </Section>
              <Section title="Patient">
                <KV label="Patient Name" value={caseData.patientName} />
                <KV label="DOB / Gender" value="— / —" />
                <KV label="Ship to Address" value="—" />
                <KV label="SG Case ID" value={caseData.id} />
              </Section>
              <Section title="Case Instructions">
                <p className="text-xs text-[#A0A0B0]">—</p>
              </Section>
              <Section title={caseData.services[0] ?? 'Service'}>
                <KV label="FDI" value={selectedTeeth.join(', ')} />
                <KV label="Order Type" value="NHS" />
              </Section>
              <Section title="Scan Files">
                <p className="text-xs text-[#A0A0B0]">No scan files attached.</p>
              </Section>
            </div>
          ) : (
            <div className="p-4 flex flex-col items-center justify-center text-center gap-3 min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-[#F0EFF6] flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-[#C8C0F0]" />
              </div>
              <p className="text-xs text-[#A0A0B0]">No lab documents uploaded for this case yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Order details accordion ── */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <button
          onClick={() => setOrderOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#030213]">Order details</p>
              <p className="text-[10px] text-[#A0A0B0]">#{caseData.id}</p>
            </div>
          </div>
          {orderOpen ? <ChevronUp className="w-4 h-4 text-[#A0A0B0]" /> : <ChevronDown className="w-4 h-4 text-[#A0A0B0]" />}
        </button>

        {orderOpen && (
          <div className="border-t border-[#F0EFF6] px-5 py-5">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{(caseData.services[0] ?? 'S').slice(0, 1)}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#030213]">{caseData.services[0] ?? 'Service'}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-md">
                  <KV label="Tooth/Arch" value={selectedTeeth.join(', ')} />
                  <KV label="Material" value="—" muted />
                  <KV label="Tooth Shade" value="—" muted />
                  <KV label="Order Type" value="NHS" />
                  <KV label="Delivery Date" value={caseData.requestedDelivery ?? '—'} />
                </div>
              </div>
              <div className="flex flex-col gap-4 items-center">
                <ToothChart selectedUpper={selectedTeeth} selectedLower={[]} compact />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Attachment files / Scans ── */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-[#F0EFF6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#F0EFF6] flex items-center justify-center">
              <Download className="w-4 h-4 text-[#717182]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#030213]">Attachment files / Scans</p>
              <p className="text-[10px] text-[#A0A0B0]">No attached files</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
              <Download className="w-3.5 h-3.5" />
              Download all
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF4FF] border border-[#C8D8FC] text-xs font-medium text-[#1565C0] hover:bg-[#DBEAFE] transition-colors">
              <FileText className="w-3.5 h-3.5" />
              All
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="px-5 py-10 text-center">
          <p className="text-xs text-[#A0A0B0]">No files attached</p>
        </div>
      </div>
    </div>
  );
}

// ─── Service Mini Timeline — compact progress strip on each summary card ─────────
// Six-stage horizontal track: New → Submitted → In Production → QC → Shipped → Delivered.
// Active dot pulses; blocked stages (on-hold / refinement) render a red warning dot.
// Clicking the strip opens the full CaseTimelineModal.
function ServiceMiniTimeline({ status, onClick }: { status: CaseStatus; onClick?: () => void }) {
  const rank    = PIPELINE_RANK[status] ?? 0;
  const blocked = status === 'refinement' || status === 'on-hold';

  const STAGES = ['New', 'Submitted', 'In Prod.', 'QC', 'Shipped', 'Delivered'];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-1 py-1.5 px-1 rounded-lg hover:bg-[#F5F8FF] transition-colors group border border-transparent hover:border-[#D8E6FF]"
      title="View full case timeline"
    >
      {/* 6-dot track with connecting lines */}
      <div className="flex items-center flex-1 min-w-0">
        {STAGES.flatMap((label, i) => {
          const done      = i < rank;
          const isCurrent = i === rank;
          const isBlock   = blocked && isCurrent;
          const items = [];
          if (i > 0) {
            items.push(
              <div
                key={`line-${i}`}
                className={`flex-1 h-px ${rank >= i ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' : 'bg-[#E8E8EC]'}`}
              />
            );
          }
          items.push(
            <div key={`dot-${i}`} className="relative flex-shrink-0" title={label}>
              {isCurrent && !isBlock && (
                <span className="absolute -inset-1 rounded-full bg-[#4D8EF7] opacity-20 animate-ping" />
              )}
              <div className={`relative w-3 h-3 rounded-full flex items-center justify-center ${
                isBlock   ? 'bg-[#C62828]' :
                isCurrent ? 'bg-white border-2 border-[#4D8EF7]' :
                done      ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]' :
                            'bg-[#F0EFF6] border border-[#E0E0E6]'
              }`}>
                {isBlock  && <AlertTriangle className="w-1.5 h-1.5 text-white" />}
                {!isBlock && done && <Check className="w-1.5 h-1.5 text-white" strokeWidth={3.5} />}
              </div>
            </div>
          );
          return items;
        })}
      </div>
      {/* Current stage label */}
      <span className={`ml-2 text-[10px] font-semibold flex-shrink-0 whitespace-nowrap ${
        blocked ? 'text-[#C62828]' : 'text-[#4D8EF7] group-hover:text-[#1565C0]'
      }`}>
        {blocked
          ? (STATUS_MAP[status]?.label ?? STAGES[rank])
          : (STAGES[Math.min(rank, STAGES.length - 1)] ?? '—')}
      </span>
    </button>
  );
}

// ─── Case Summary Overview — shown on the default "Case Summary" top tab ────────
// One card per service item. Cards are clickable (navigates to that service tab)
// and surface: status-change dropdown, mini pipeline timeline, and a quick
// "Mark as Received" action — all without leaving the summary view.
// ── Delivery countdown helper — works off the case-wide DD-MMM-YYYY format ────
// Used by the summary cards to surface an at-a-glance "due in N days / Overdue /
// Due today" indicator next to the formatted delivery date. Today is pegged to
// the current demo date (2026-05-26) so the static mock data stays meaningful.
const SUMMARY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
function parseSummaryDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const mi = SUMMARY_MONTHS.indexOf(m as typeof SUMMARY_MONTHS[number]);
  if (mi < 0) return null;
  const dt = new Date(Number(y), mi, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
function deliveryCountdown(dateStr: string | null): { label: string; tone: 'overdue' | 'today' | 'soon' | 'future' } | null {
  const target = parseSummaryDate(dateStr);
  if (!target) return null;
  const today = new Date(2026, 4, 26); // 2026-05-26
  const ms = target.getTime() - today.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0)  return { label: 'Overdue',          tone: 'overdue' };
  if (days === 0) return { label: 'Due today',       tone: 'today'   };
  if (days <= 3)  return { label: `in ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'soon' };
  return { label: `in ${days} days`, tone: 'future' };
}

function CaseSummaryOverview({
  serviceItems,
  caseData,
  onSelectService,
  onOpenTimeline,
}: {
  serviceItems: ServiceItem[];
  caseData: CaseForDetail;
  onSelectService: (id: string) => void;
  onOpenTimeline?: () => void;
}) {
  // Per-card status state — starts from the service item's initial status
  const [cardStatuses, setCardStatuses] = useState<Record<string, CaseStatus>>(
    () => Object.fromEntries(serviceItems.map(si => [si.id, si.status])) as Record<string, CaseStatus>
  );
  // Which card's status dropdown is currently open (null = none)
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" onClick={() => setOpenStatusId(null)}>
      {serviceItems.map((si) => {
        const currentStatus = (cardStatuses[si.id] ?? si.status) as CaseStatus;
        const s       = STATUS_MAP[currentStatus];
        const iStyle  = SERVICE_ICON_COLOR[si.name] ?? { bg: '#FFF7ED', color: '#F59E0B' };
        const isReceived = currentStatus === 'delivered' || currentStatus === 'completed';
        const toothCount   = si.fdi?.length ?? 0;
        const orderType    = si.orderType ?? '—';
        const isNHS        = orderType === 'NHS';
        const isPrivate    = orderType === 'Private';
        const scanCount    = si.scanFileCount   ?? 0;
        const attachCount  = si.attachmentCount ?? 0;
        const countdown    = deliveryCountdown(si.deliveryDate);
        const countdownTone =
          countdown?.tone === 'overdue' ? 'bg-[#FFEBEE] text-[#C62828] border-[#F9DCDC]' :
          countdown?.tone === 'today'   ? 'bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]' :
          countdown?.tone === 'soon'    ? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' :
                                          'bg-[#EEF4FF] text-[#1565C0] border-[#C8D8FC]';

        return (
          <div
            key={si.id}
            onClick={() => { setOpenStatusId(null); onSelectService(si.id); }}
            className="relative bg-white border border-[#E0E0E6] rounded-xl p-5 hover:shadow-md hover:border-[#C8C0F0] transition-all cursor-pointer group flex flex-col gap-3 overflow-hidden"
          >
            {/* ── Decorative dental-arch corner cue ── */}
            <img
              src="/dental-arch.svg"
              alt=""
              aria-hidden
              className="absolute top-2 right-2 w-10 h-10 opacity-30 pointer-events-none select-none"
              draggable={false}
            />

            {/* ── Header row: icon + name + status dropdown ── */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: iStyle.bg }}
                >
                  <span className="text-base font-bold" style={{ color: iStyle.color }}>
                    {si.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#030213]">{si.name}</p>
                  <p className="text-[11px] text-[#717182]">
                    {(() => {
                      const st = getStaging(si);
                      if (st?.mode === 'catalog') return `${(si.stages ?? st.catalog.slice(0, -1)).length} stages`;
                      if (st?.mode === 'phased')  return 'Phasing enabled';
                      return si.phases ? `${si.phases.length} phases` : 'Single phase';
                    })()}
                  </p>
                </div>
              </div>

              {/* Clickable status pill → opens per-card status-change dropdown */}
              <div className="relative flex-shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setOpenStatusId(openStatusId === si.id ? null : si.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border hover:opacity-80 transition-opacity"
                  style={{ background: s.bg, color: s.color, borderColor: s.border }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {openStatusId === si.id && (
                  <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-[#E0E0E6] rounded-lg shadow-xl py-1 min-w-[180px]">
                    {(Object.keys(STATUS_MAP) as CaseStatus[]).map((st) => {
                      const ss = STATUS_MAP[st];
                      return (
                        <button
                          key={st}
                          onClick={() => {
                            setCardStatuses(prev => ({ ...prev, [si.id]: st }));
                            setOpenStatusId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#F8F9FC] transition-colors flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ss.dot }} />
                          <span className="text-xs text-[#030213] flex-1">{ss.label}</span>
                          {currentStatus === st && <Check className="w-3 h-3 text-[#4D8EF7]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Info strip — quick prescription facts (tooth count, material, shade, order type, files) ── */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F8F9FC] text-[#5A5568] border border-[#E0E0E6]">
                {toothCount} {toothCount === 1 ? 'tooth' : 'teeth'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F8F9FC] text-[#5A5568] border border-[#E0E0E6]">
                {si.material ?? '—'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F8F9FC] text-[#5A5568] border border-[#E0E0E6]">
                Shade {si.shade ?? '—'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isNHS
                    ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                    : isPrivate
                      ? 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]'
                      : 'bg-[#F8F9FC] text-[#5A5568] border-[#E0E0E6]'
                }`}
              >
                {orderType}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEF4FF] text-[#1565C0] border border-[#C8D8FC]" title={`${scanCount} scan file${scanCount === 1 ? '' : 's'}`}>
                <Eye className="w-2.5 h-2.5" />
                {scanCount}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]" title={`${attachCount} attachment${attachCount === 1 ? '' : 's'}`}>
                <Paperclip className="w-2.5 h-2.5" />
                {attachCount}
              </span>
            </div>

            {/* ── Phase progress (multi-phase services only) — hidden for
                staged services, which use the phase-order strip instead. ── */}
            {si.phases && si.phases.length > 0 && !getStaging(si) && (
              <div className="space-y-1.5">
                {si.phases.map((phase, idx) => {
                  const ps = PHASE_STATUS_MAP[phase.status] ?? PHASE_STATUS_MAP.pending;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#717182] flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: ps.dot }}
                        />
                        {phase.label}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{ background: ps.bg, color: ps.color, borderColor: ps.border }}
                      >
                        {ps.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Mini pipeline timeline — click to open full timeline modal ── */}
            <div onClick={(e) => e.stopPropagation()}>
              <ServiceMiniTimeline
                status={currentStatus}
                onClick={() => onOpenTimeline?.()}
              />
            </div>

            {/* ── Footer: delivery date + countdown + action ── */}
            <div
              className="flex items-center justify-between gap-3 pt-3 border-t border-[#F0EFF6] mt-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider mb-0.5">Delivery</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-[#030213]">{si.deliveryDate ?? '—'}</p>
                  {countdown && !isReceived && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${countdownTone}`}>
                      {countdown.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isReceived ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Received
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); /* future: update status inline */ }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark as Received
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectService(si.id); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors border border-[#C8D8FC]"
                >
                  Details
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Service Detail View — shown when the user clicks a per-service top tab ────
// Sidebar mirrors the main Case Detail sidebar but scoped to the one service:
//   Details  — service phases (or single "Mark as Received") + status + delivery
//   Invoice  — matched invoice lines for this case
//   Shipping — shipment tracking
type ServiceSubTab = 'details' | 'invoice' | 'shipping';

const PHASE_STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string; dot: string }> = {
  pending:      { label: 'Pending',     bg: '#F3F3F5', color: '#5A5568', border: '#E0E0E6', dot: '#A0A0B0' },
  'in-progress':{ label: 'In Progress', bg: '#F5F3FF', color: '#7C3AED', border: '#EDE9FE', dot: '#8B5CF6' },
  completed:    { label: 'Completed',   bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0', dot: '#16A34A' },
  received:     { label: 'Received',    bg: '#E0F7FA', color: '#00838F', border: '#B2EBF2', dot: '#0097A7' },
};

// Combine a stage order's stage names into the tab / banner label. The
// initial order usually bundles several ("Special Tray, Bite Registration,
// Try In"); later orders are often a single remaining stage.
function stageOrderLabel(o: StageOrder): string {
  return o.stages.length ? o.stages.join(', ') : 'Stage order';
}

// ── Staging model ────────────────────────────────────────────────────────────
// Two flavours of staged service share the same tab strip:
//   • 'catalog' (denture) — a FIXED set of named stages; each order picks from
//     the remaining ones; runs out when all are ordered.
//   • 'phased'  (aligner, when Phasing = Yes) — OPEN-ENDED, auto-named
//     "Phase 1", "Phase 2", … ; never runs out.
type Staging = { mode: 'catalog'; catalog: string[] } | { mode: 'phased' } | null;
function getStaging(service: ServiceItem): Staging {
  if (STAGE_CATALOGS[service.name]) return { mode: 'catalog', catalog: STAGE_CATALOGS[service.name] };
  // Aligners default to phasing-enabled in the prototype; an explicit
  // phasing === false (the "Phasing: No" answer) opts out.
  if (service.name === 'Clear Aligners' && service.phasing !== false) return { mode: 'phased' };
  return null;
}

// Tab caption for a stage order. Catalog orders read "Initial" / "Order N";
// phased orders ARE a phase, so the caption is the phase name itself.
function stageTabCaption(o: StageOrder, idx: number, mode: 'catalog' | 'phased'): string {
  if (mode === 'phased') return o.stages[0] ?? `Phase ${idx + 1}`;
  return idx === 0 ? 'Initial' : `Order ${idx + 1}`;
}

// Seed the initial stage orders for a staged service when the data doesn't
// carry them yet. Denture uses the service's own `stages` selection (or the
// catalog minus its last stage, leaving one to demo "New Stage Order");
// aligner phasing starts at a single auto-named "Phase 1".
function seedStageOrders(service: ServiceItem, createdAt: string): StageOrder[] {
  if (service.stageOrders && service.stageOrders.length) return service.stageOrders;
  const staging = getStaging(service);
  if (!staging) return [];
  const base = { id: 'so-1', status: service.status, deliveryDate: service.deliveryDate, createdAt };
  if (staging.mode === 'phased') {
    return [{ ...base, stages: ['Phase 1'] }];
  }
  const initial = service.stages && service.stages.length
    ? service.stages
    : staging.catalog.slice(0, Math.max(1, staging.catalog.length - 1));
  return [{ ...base, stages: initial }];
}

// ─── New Stage / Phase Order modal ────────────────────────────────────────────
// Lets the user place a follow-up order. Every prescription detail is inherited
// from the service (read-only "auto-filled" summary). Two modes:
//   • catalog (denture) — choose from the REMAINING named stages (already
//     ordered ones never appear).
//   • phased (aligner)  — nothing to choose; the next phase is auto-named
//     ("Phase N") and shown read-only, so it's a one-confirm action.
function StageOrderPickerModal({ service, mode, remaining, nextPhaseName, onCancel, onConfirm }: {
  service: ServiceItem;
  mode: 'catalog' | 'phased';
  remaining: string[];
  nextPhaseName: string;
  onCancel: () => void;
  onConfirm: (stages: string[]) => void;
}) {
  // Catalog mode pre-selects the first remaining stage so the common
  // "next stage" path is one click. Phased mode has no selection.
  const [picked, setPicked] = useState<string[]>(remaining.length ? [remaining[0]] : []);
  const toggle = (stage: string) =>
    setPicked(prev => prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);
  const isPhased = mode === 'phased';
  const canCreate = isPhased ? true : picked.length > 0;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-[#F0EFF6]">
            <h3 className="text-sm font-bold text-[#030213]">{isPhased ? 'New Phase Order' : 'New Stage Order'}</h3>
            <p className="text-xs text-[#717182] mt-0.5">
              {service.name} · {isPhased ? `adds ${nextPhaseName}, auto-filled from the case` : 'pick the stage(s) to order next'}
            </p>
          </div>
          {/* Auto-filled prescription summary — inherited from the service */}
          <div className="px-5 py-3 bg-[#FAFBFF] border-b border-[#F0EFF6]">
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Check className="w-3 h-3 text-[#16A34A]" strokeWidth={3} />
              Auto-filled from the case
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                service.material && `Material: ${service.material}`,
                service.shade && `Shade: ${service.shade}`,
                service.orderType && service.orderType,
                (service.fdi?.length ?? 0) > 0 && `${service.fdi!.length} teeth`,
              ].filter(Boolean).map((chip, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-[#5A5568] border border-[#E0E0E6]">
                  {chip as string}
                </span>
              ))}
            </div>
          </div>
          {/* Selection — phased shows the auto-named phase; catalog shows the
              remaining-stage picker. */}
          <div className="px-5 py-4">
            {isPhased ? (
              <>
                <p className="text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-2">New phase</p>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF]">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A59DFF] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {nextPhaseName.replace(/\D/g, '') || '+'}
                  </span>
                  <span className="text-sm font-semibold text-[#5B21B6]">{nextPhaseName}</span>
                  <span className="ml-auto text-[10px] text-[#A0A0B0]">auto-named</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-2">Select stage(s)</p>
                {remaining.length === 0 ? (
                  <p className="text-xs text-[#A0A0B0] italic">All stages have already been ordered.</p>
                ) : (
                  <div className="space-y-1.5">
                    {remaining.map(stage => {
                      const active = picked.includes(stage);
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => toggle(stage)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                            active
                              ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0] font-semibold'
                              : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#BFDBFE] hover:bg-[#F5F8FF]'
                          }`}
                        >
                          <span className="truncate">{stage}</span>
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            active ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D1D5DB] bg-white'
                          }`}>
                            {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#F0EFF6] flex items-center justify-end gap-2 bg-[#FAFBFC]">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[#5A5568] bg-[#F0EFF6] hover:bg-[#E5E3ED] transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!canCreate}
              onClick={() => onConfirm(isPhased ? [nextPhaseName] : picked)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <Plus className="w-4 h-4" />
              {isPhased ? 'Create phase order' : 'Create stage order'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function ServiceDetailView({ service, caseData, onOpenNotes, onOpenFullView }: {
  service: ServiceItem;
  caseData: CaseForDetail;
  onOpenNotes: () => void;
  onOpenFullView: () => void;
}) {
  const [subTab, setSubTab] = useState<ServiceSubTab>('details');
  // ── Stage / phase orders (denture catalog · aligner phasing) ────────────
  // Staged services render a tab strip under the service name. Denture bundles
  // the stages picked at creation into the "Initial" order, then "New Stage
  // Order" picks from the remaining catalog. Aligners (Phasing = Yes) start at
  // "Phase 1" and "New Phase Order" appends auto-named Phase 2, Phase 3, …
  const staging = getStaging(service);
  const stageMode = staging?.mode ?? null;            // 'catalog' | 'phased' | null
  const stageCatalog = staging?.mode === 'catalog' ? staging.catalog : null;
  const isPhased = staging?.mode === 'phased';
  const [stageOrders, setStageOrders] = useState<StageOrder[]>(
    () => seedStageOrders(service, caseData.createdAt)
  );
  const [activeStageId, setActiveStageId] = useState<string>(() => seedStageOrders(service, caseData.createdAt)[0]?.id ?? '');
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const orderedStages = new Set(stageOrders.flatMap(o => o.stages));
  // Catalog services run out of stages; phased services never do.
  const remainingStages = stageCatalog ? stageCatalog.filter(s => !orderedStages.has(s)) : [];
  const canAddOrder = isPhased || remainingStages.length > 0;
  const nextPhaseName = `Phase ${stageOrders.length + 1}`;
  const activeStageOrder = stageOrders.find(o => o.id === activeStageId) ?? stageOrders[0] ?? null;
  // Per-service viewer + order panel state — scoped to this view so each
  // service tab keeps its own viewer format and accordion state.
  const [viewerFormat, setViewerFormat] = useState<ViewerFormat>('3D');
  const [orderTab, setOrderTab] = useState<'order-form' | 'lab-documents'>('order-form');
  const [orderOpen, setOrderOpen] = useState(true);

  // When the service is staged, the active stage order drives the status +
  // delivery shown in the identity card so each stage-order tab reads as its
  // own order. Non-staged services fall back to the service-level values.
  const effectiveStatus = (staging && activeStageOrder) ? activeStageOrder.status : service.status;
  const effectiveDelivery = (staging && activeStageOrder) ? activeStageOrder.deliveryDate : service.deliveryDate;
  const s = STATUS_MAP[effectiveStatus];
  const iStyle = SERVICE_ICON_COLOR[service.name] ?? { bg: '#FFF7ED', color: '#F59E0B' };

  const SERVICE_SUB_TABS: { id: ServiceSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'details',  label: 'Details',  icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'invoice',  label: 'Invoice',  icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'shipping', label: 'Shipping', icon: <MapPin   className="w-3.5 h-3.5" /> },
  ];

  // Per-service prescription values — fall back to em-dash when missing.
  const fdiList = service.fdi ?? [];
  const fdiLabel = fdiList.length ? fdiList.join(', ') : '—';
  const upperTeeth = fdiList.filter(t => t < 30);
  const lowerTeeth = fdiList.filter(t => t >= 30);
  const scanCount  = service.scanFileCount ?? 0;
  const attachCount = service.attachmentCount ?? 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden mt-3 mx-6 mb-6 gap-3 min-h-0">
      {/* ── Stage / phase order strip (denture catalog · aligner phasing) ────
          One tab per order. Denture: first tab "Initial" bundles the stages
          picked at creation, "New Stage Order" picks from remaining stages.
          Aligner phasing: tabs are auto-named Phase 1, Phase 2, … and
          "New Phase Order" is always available. ── */}
      {staging && (
        <div className="bg-white border border-[#E0E0E6] rounded-xl flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-1 px-1.5 pt-1.5 overflow-x-auto">
            {stageOrders.map((o, idx) => (
              <button
                key={o.id}
                onClick={() => setActiveStageId(o.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 max-w-[260px] ${
                  activeStageId === o.id
                    ? 'border-[#7C3AED] text-[#5B21B6] bg-[#F5F3FF]'
                    : 'border-transparent text-[#717182] hover:text-[#030213] hover:bg-[#F8F9FC]'
                }`}
                title={stageOrderLabel(o)}
              >
                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A59DFF] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="truncate">{stageTabCaption(o, idx, stageMode!)}</span>
              </button>
            ))}
            <button
              onClick={() => setStagePickerOpen(true)}
              disabled={!canAddOrder}
              title={
                isPhased ? 'Add the next phase'
                : remainingStages.length === 0 ? 'All stages have been ordered'
                : 'Order another stage'
              }
              className="ml-auto mr-1 mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#7C3AED] to-[#A59DFF] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex-shrink-0 self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              {isPhased ? 'New Phase Order' : 'New Stage Order'}
            </button>
          </div>
          {/* Active order's stages */}
          <div className="px-4 py-2.5 border-t border-[#F0EFF6] bg-[#FAFBFF] flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{isPhased ? 'Phase:' : 'Stages:'}</span>
            {(activeStageOrder?.stages ?? []).map(stage => (
              <span key={stage} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F3FF] text-[#5B21B6] border border-[#DDD6FE]">
                {stage}
              </span>
            ))}
            {isPhased ? (
              <span className="ml-auto text-[10px] text-[#A0A0B0]">
                {stageOrders.length} phase{stageOrders.length === 1 ? '' : 's'} ordered
              </span>
            ) : remainingStages.length > 0 && (
              <span className="ml-auto text-[10px] text-[#A0A0B0]">
                {remainingStages.length} stage{remainingStages.length === 1 ? '' : 's'} not yet ordered
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden gap-4 min-h-0">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white border border-[#E0E0E6] rounded-xl py-3 px-2.5 self-start space-y-1">
        {SERVICE_SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === tab.id
                ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF] text-[#4D8EF7] font-semibold border border-[#DBEAFE]'
                : 'text-[#5A5568] hover:bg-[#F8F9FC] hover:text-[#030213] border border-transparent'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {subTab === 'details' && (
          <>
            {/* ── Action bar — Notes / Download / Full view (per-service scope) ── */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl px-3 py-2 flex items-center justify-end gap-2">
              <button
                onClick={onOpenNotes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#030213] text-white text-xs font-semibold hover:bg-[#1B1B2D] transition-colors"
              >
                Notes
                <StickyNote className="w-3.5 h-3.5" />
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
              >
                Download all files
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenFullView}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
              >
                Full View
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Service identity card ── */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iStyle.bg }}>
                    <span className="text-base font-bold" style={{ color: iStyle.color }}>{service.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#030213]">{service.name}</p>
                    <p className="text-[11px] text-[#717182]">{caseData.id} · {caseData.patientName}</p>
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                  style={{ background: s.bg, color: s.color, borderColor: s.border }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider mb-1">Delivery Date</p>
                  <p className="font-medium text-[#030213]">{effectiveDelivery ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider mb-1">{isPhased ? 'Phase' : stageCatalog ? 'Stages' : 'Phases'}</p>
                  <p className="font-medium text-[#030213]">
                    {isPhased
                      ? (activeStageOrder?.stages[0] ?? '—')
                      : stageCatalog
                        ? (activeStageOrder?.stages.length ?? 0)
                        : (service.phases ? service.phases.length : 1)}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Case instructions (service-scoped) ── */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-[#717182]">Case Instructions</p>
                <span className="text-[10px] text-[#A0A0B0]">Updated: {caseData.updatedAt}</span>
              </div>
              {service.instructions ? (
                <p className="text-xs text-[#030213] leading-relaxed">{service.instructions}</p>
              ) : (
                <p className="text-xs text-[#A0A0B0]">No additional instructions provided.</p>
              )}
            </div>

            {/* ── 3D viewer + Order form (per-service) ── */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {/* Left: scan viewer */}
              <ScanViewer format={viewerFormat} onFormatChange={setViewerFormat} />

              {/* Right: Order form / Lab Documents tabs */}
              <div className="bg-white border border-[#E0E0E6] rounded-xl flex flex-col">
                <div className="flex items-center border-b border-[#F0EFF6] px-4">
                  <button
                    onClick={() => setOrderTab('order-form')}
                    className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                      orderTab === 'order-form' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Order form
                  </button>
                  <button
                    onClick={() => setOrderTab('lab-documents')}
                    className={`inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                      orderTab === 'lab-documents' ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Lab Documents
                  </button>
                  <button className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:underline">
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>

                {orderTab === 'order-form' ? (
                  <div className="p-4 space-y-4 overflow-y-auto max-h-[340px]">
                    <Section title="Details">
                      <KV label="Lab Name" value="Smile Genius Lab" />
                      <KV label="Clinic Name" value={caseData.practice} />
                      <KV label="Dentist Name" value={caseData.dentist} />
                      <KV label="Dentist Contact Number" value="—" />
                    </Section>
                    <Section title="Patient">
                      <KV label="Patient Name" value={caseData.patientName} />
                      <KV label="DOB / Gender" value="— / —" />
                      <KV label="Ship to Address" value="—" />
                      <KV label="SG Case ID" value={caseData.id} />
                    </Section>
                    <Section title="Case Instructions">
                      {service.instructions
                        ? <p className="text-xs text-[#030213] leading-relaxed">{service.instructions}</p>
                        : <p className="text-xs text-[#A0A0B0]">—</p>}
                    </Section>
                    <Section title={service.name}>
                      <KV label="FDI" value={fdiLabel} muted={fdiList.length === 0} />
                      <KV label="Material"    value={service.material  ?? '—'} muted={!service.material} />
                      <KV label="Tooth Shade" value={service.shade     ?? '—'} muted={!service.shade} />
                      <KV label="Order Type"  value={service.orderType ?? '—'} muted={!service.orderType} />
                    </Section>
                    <Section title="Scan Files">
                      {scanCount > 0
                        ? <p className="text-xs text-[#030213]">{scanCount} scan {scanCount === 1 ? 'file' : 'files'} attached.</p>
                        : <p className="text-xs text-[#A0A0B0]">No scan files attached.</p>}
                    </Section>
                  </div>
                ) : (
                  <div className="p-4 flex flex-col items-center justify-center text-center gap-3 min-h-[300px]">
                    <div className="w-12 h-12 rounded-2xl bg-[#F0EFF6] flex items-center justify-center">
                      <FolderOpen className="w-6 h-6 text-[#C8C0F0]" />
                    </div>
                    <p className="text-xs text-[#A0A0B0]">No lab documents uploaded for this service yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Order details accordion (per-service) ── */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
              <button
                onClick={() => setOrderOpen((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iStyle.bg }}>
                    <FileText className="w-4 h-4" style={{ color: iStyle.color }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#030213]">Order details</p>
                    <p className="text-[10px] text-[#A0A0B0]">{service.name} · #{caseData.id}</p>
                  </div>
                </div>
                {orderOpen ? <ChevronUp className="w-4 h-4 text-[#A0A0B0]" /> : <ChevronDown className="w-4 h-4 text-[#A0A0B0]" />}
              </button>

              {orderOpen && (
                <div className="border-t border-[#F0EFF6] px-5 py-5">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iStyle.bg }}>
                          <span className="text-sm font-bold" style={{ color: iStyle.color }}>{service.name.slice(0, 1)}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#030213]">{service.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-md">
                        <KV label="Tooth/Arch"   value={fdiLabel} muted={fdiList.length === 0} />
                        <KV label="Material"     value={service.material  ?? '—'} muted={!service.material} />
                        <KV label="Tooth Shade"  value={service.shade     ?? '—'} muted={!service.shade} />
                        <KV label="Order Type"   value={service.orderType ?? '—'} muted={!service.orderType} />
                        <KV label="Delivery Date" value={service.deliveryDate ?? '—'} muted={!service.deliveryDate} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 items-center">
                      <ToothChart selectedUpper={upperTeeth} selectedLower={lowerTeeth} compact />
                    </div>
                  </div>

                  {/* Phase cards — kept inline within the accordion for multi-phase services. */}
                  {service.phases && service.phases.length > 0 && !staging && (
                    <div className="mt-6 pt-5 border-t border-[#F0EFF6] space-y-3">
                      <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold">Phases</p>
                      {service.phases.map((phase, idx) => {
                        const ps = PHASE_STATUS_MAP[phase.status] ?? PHASE_STATUS_MAP.pending;
                        const isReceived = phase.status === 'received';
                        return (
                          <div key={idx} className="border border-[#E0E0E6] rounded-xl p-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
                                  <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                                </div>
                                <p className="text-sm font-semibold text-[#030213]">{phase.label}</p>
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                                  style={{ background: ps.bg, color: ps.color, borderColor: ps.border }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ps.dot }} />
                                  {ps.label}
                                </span>
                                <span className="text-[11px] text-[#717182]">· {phase.deliveryDate ?? '—'}</span>
                              </div>
                              {isReceived ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Received
                                </span>
                              ) : (
                                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white hover:opacity-90 transition-opacity shadow-sm">
                                  <Check className="w-3.5 h-3.5" />
                                  Mark as Received
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Attachment files / Scans (per-service counts) ── */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-[#F0EFF6]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#F0EFF6] flex items-center justify-center">
                    <Download className="w-4 h-4 text-[#717182]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#030213]">Attachment files / Scans</p>
                    <p className="text-[10px] text-[#A0A0B0]">
                      {scanCount + attachCount === 0
                        ? 'No attached files'
                        : `${scanCount} scan ${scanCount === 1 ? 'file' : 'files'} · ${attachCount} ${attachCount === 1 ? 'attachment' : 'attachments'}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">
                    <Download className="w-3.5 h-3.5" />
                    Download all
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF4FF] border border-[#C8D8FC] text-xs font-medium text-[#1565C0] hover:bg-[#DBEAFE] transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                    All
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {scanCount + attachCount === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-xs text-[#A0A0B0]">No files attached</p>
                </div>
              ) : (
                <div className="px-5 py-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: scanCount }, (_, idx) => (
                    <div key={`scan-${idx}`} className="border border-[#E0E0E6] rounded-lg p-3 flex items-center gap-2 hover:border-[#C8D8FC] hover:bg-[#F8FAFF] transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-md bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                        <Eye className="w-4 h-4 text-[#1565C0]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#030213] truncate">scan-{idx + 1}.stl</p>
                        <p className="text-[10px] text-[#A0A0B0]">{(2.3 + idx * 0.6).toFixed(1)} MB</p>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: attachCount }, (_, idx) => (
                    <div key={`att-${idx}`} className="border border-[#E0E0E6] rounded-lg p-3 flex items-center gap-2 hover:border-[#C8D8FC] hover:bg-[#F8FAFF] transition-colors cursor-pointer">
                      <div className="w-8 h-8 rounded-md bg-[#F5F3FF] flex items-center justify-center flex-shrink-0">
                        <Paperclip className="w-4 h-4 text-[#7C3AED]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#030213] truncate">attachment-{idx + 1}.pdf</p>
                        <p className="text-[10px] text-[#A0A0B0]">{(0.4 + idx * 0.3).toFixed(1)} MB</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {subTab === 'invoice'  && <InvoiceTab  caseId={caseData.id} />}
        {subTab === 'shipping' && <ShippingTab />}
      </div>
      </div>

      {/* New Stage / Phase Order modal */}
      {stagePickerOpen && staging && (
        <StageOrderPickerModal
          service={service}
          mode={staging.mode}
          remaining={remainingStages}
          nextPhaseName={nextPhaseName}
          onCancel={() => setStagePickerOpen(false)}
          onConfirm={(stages) => {
            const newOrder: StageOrder = {
              id: `so-${stageOrders.length + 1}`,
              stages,
              status: 'new',
              deliveryDate: null,
              createdAt: caseData.updatedAt,
            };
            setStageOrders(prev => [...prev, newOrder]);
            setActiveStageId(newOrder.id);
            setStagePickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Small layout helpers used in the order form panel
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-0.5 h-3 bg-[#4D8EF7] rounded-full" />
        <p className="text-[11px] font-bold text-[#4D8EF7] uppercase tracking-wide">{title}</p>
      </div>
      <div className="space-y-1.5 pl-3">{children}</div>
    </div>
  );
}
function KV({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="text-xs flex items-baseline gap-2 min-w-0">
      <span className="text-[#A0A0B0] flex-shrink-0">{label}:</span>
      <span className={`truncate ${muted ? 'text-[#A0A0B0]' : 'text-[#030213] font-medium'}`}>{value}</span>
    </div>
  );
}

// ─── Order Timeline Tab ───────────────────────────────────────────────────────

function TimelineTab({ caseData }: { caseData: CaseForDetail }) {
  // Build the actual journey from the case status — only steps that have happened.
  const fullPipeline = buildCasePipeline(caseData);
  const currentIdx = (() => {
    const marked = fullPipeline.findIndex(s => s.state === 'current' || s.state === 'blocked');
    if (marked >= 0) return marked;
    for (let i = fullPipeline.length - 1; i >= 0; i--) if (fullPipeline[i].done) return i;
    return 0;
  })();
  const pipeline = fullPipeline.slice(0, currentIdx + 1);

  // Best-effort timestamps + actor labels per pipeline step.
  const eventMeta: { time: string; actor: string; detail: string }[] = [
    { time: '09:14', actor: `${caseData.dentist}`,           detail: caseData.practice },
    { time: '09:18', actor: `${caseData.dentist}`,           detail: 'Sent to lab partner' },
    { time: '10:42', actor: 'Lab Production team',           detail: 'Manufacturing started' },
    { time: '14:05', actor: 'Lab QC',                        detail: 'Quality check passed' },
    { time: '16:30', actor: 'Lab Dispatch',                  detail: 'Shipped via courier' },
    { time: '11:15', actor: caseData.practice,               detail: 'Delivered to clinic' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white hover:opacity-90 transition-opacity">
          <MessageSquare className="w-3.5 h-3.5" />
          Comment
        </button>
      </div>
      <div className="space-y-4">
        {pipeline.map((step, i) => {
          const meta = eventMeta[i] ?? { time: '—', actor: '—', detail: '—' };
          const isBlockedStep = step.state === 'blocked';
          const isCurrentStep = step.state === 'current';
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                    isBlockedStep
                      ? 'bg-[#C62828] ring-2 ring-[#C62828]/20'
                      : isCurrentStep
                        ? 'bg-[#4D8EF7] ring-2 ring-[#4D8EF7]/20'
                        : 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
                  }`}
                />
                {i < pipeline.length - 1 && <div className="w-px flex-1 bg-[#E0E0E6] mt-1 min-h-[24px]" />}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] text-[#A0A0B0]">{step.timestamp ?? caseData.updatedAt}, {meta.time}</span>
                  <span className={`text-[10px] font-medium ${isBlockedStep ? 'text-[#C62828]' : 'text-[#4D8EF7]'}`}>{meta.actor}</span>
                  {(isBlockedStep || isCurrentStep) && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      isBlockedStep
                        ? 'bg-[#FFEBEE] text-[#C62828] border border-[#F9DCDC]'
                        : 'bg-[#EEF4FF] text-[#1565C0] border border-[#C8D8FC]'
                    }`}>
                      <span className={`w-1 h-1 rounded-full animate-pulse ${isBlockedStep ? 'bg-[#C62828]' : 'bg-[#1565C0]'}`} />
                      You are here
                    </span>
                  )}
                </div>
                <div className="border border-[#E0E0E6] rounded-xl p-4 bg-white">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isBlockedStep
                        ? 'bg-[#FFEBEE]'
                        : isCurrentStep
                          ? 'bg-[#EEF4FF]'
                          : 'bg-[#F0FDF4]'
                    }`}>
                      {isBlockedStep
                        ? <AlertTriangle className="w-4 h-4 text-[#C62828]" />
                        : isCurrentStep
                          ? <Clock className="w-4 h-4 text-[#1565C0]" />
                          : <Check className="w-4 h-4 text-[#2E7D32]" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#030213]">{step.label}</p>
                      {step.sub && <p className="text-[10px] text-[#A0A0B0] mt-0.5">{step.sub}</p>}
                    </div>
                  </div>
                  <p className="text-xs text-[#717182] ml-11">{meta.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Invoice Tab (unchanged behaviour, same data) ─────────────────────────────

const MATCHED_INVOICE_ITEMS: Record<string, { invoiceNumber: string; supplier: string; description: string; qty: number; unitPrice: number; total: number; date: string; status: string }[]> = {
  'CASE-001': [
    { invoiceNumber: 'LAB-2024-4821', supplier: 'Kingsbridge Dental Lab', description: 'Full Ceramic Crown – Upper Right 6', qty: 1, unitPrice: 98.50, total: 98.50, date: '12 May 2025', status: 'Payment Processed' },
  ],
  'CASE-002': [
    { invoiceNumber: 'LAB-2024-4821', supplier: 'Kingsbridge Dental Lab', description: 'Zirconia Bridge 3 Unit', qty: 1, unitPrice: 150.00, total: 150.00, date: '12 May 2025', status: 'Payment Processed' },
  ],
  'CASE-003': [
    { invoiceNumber: 'INV-55902', supplier: 'Patterson Dental UK', description: 'Composite Restorative Kit', qty: 2, unitPrice: 340.00, total: 680.00, date: '13 May 2025', status: 'Awaiting Approval' },
  ],
  'CASE-008': [
    { invoiceNumber: 'DL-9003-B', supplier: 'Eurodontic Ltd', description: 'Impression Trays Custom x5', qty: 5, unitPrice: 120.00, total: 600.00, date: '11 May 2025', status: 'Awaiting Approval' },
  ],
  'CASE-009': [
    { invoiceNumber: 'INV-20250509-001', supplier: 'FreshSmile Supplies', description: 'Composite Resin A2', qty: 5, unitPrice: 98.00, total: 490.00, date: '09 May 2025', status: 'Disputed' },
  ],
};

const STATUS_CHIP: Record<string, string> = {
  'Payment Processed':    'bg-[#E0F7FA] text-[#00838F]',
  'Awaiting Approval':    'bg-[#FFF8E1] text-[#E65100]',
  'Approved':             'bg-[#E8F5E9] text-[#2E7D32]',
  'Exported for Payment': 'bg-[#E3F2FD] text-[#1565C0]',
  'Disputed':             'bg-[#FFEBEE] text-[#C62828]',
};

function fmtMoney(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n); }

function InvoiceTab({ caseId }: { caseId: string }) {
  const items = MATCHED_INVOICE_ITEMS[caseId] ?? [];
  if (items.length === 0) {
    return (
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 px-5 py-3 border-b border-[#F0EFF6] bg-[#F8F9FC]">
          {['Invoice', 'Supplier', 'Description', 'Total'].map(h => (
            <p key={h} className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{h}</p>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-[#F0EFF6] flex items-center justify-center">
            <FileText className="w-8 h-8 text-[#C8C0F0]" />
          </div>
          <p className="text-xs text-[#A0A0B0]">Matched and processed invoices will show up here automatically</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#717182]">{items.length} matched invoice {items.length === 1 ? 'line item' : 'line items'} from supplier invoices linked to this case.</p>
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="grid px-5 py-3 border-b border-[#F0EFF6] bg-[#F8F9FC] gap-3" style={{ gridTemplateColumns: '1.4fr 1.6fr 2fr 0.6fr 1fr 1.2fr' }}>
          {['Invoice', 'Supplier', 'Description', 'Qty', 'Total', 'Status'].map(h => (
            <p key={h} className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{h}</p>
          ))}
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid px-5 py-3 border-b border-[#F0EFF6] last:border-b-0 items-center gap-3" style={{ gridTemplateColumns: '1.4fr 1.6fr 2fr 0.6fr 1fr 1.2fr' }}>
            <div>
              <p className="text-xs font-semibold text-[#030213]">{it.invoiceNumber}</p>
              <p className="text-[10px] text-[#A0A0B0]">{it.date}</p>
            </div>
            <p className="text-xs text-[#030213] truncate">{it.supplier}</p>
            <p className="text-xs text-[#5A5568] truncate">{it.description}</p>
            <p className="text-xs text-right text-[#717182]">{it.qty}</p>
            <p className="text-xs font-semibold text-[#030213]">{fmtMoney(it.total)}</p>
            <span className={`inline-flex items-center w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CHIP[it.status] ?? 'bg-[#F3F3F5] text-[#717182]'}`}>{it.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shipping Tab ─────────────────────────────────────────────────────────────

function ShippingTab() {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="grid grid-cols-5 px-5 py-3 border-b border-[#F0EFF6] bg-[#F8F9FC]">
        {['Tracking ID', 'Service(s)', 'Courier', 'Tracking Link', 'Shipment Date'].map(h => (
          <p key={h} className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{h}</p>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#F0EFF6] flex items-center justify-center">
          <MapPin className="w-8 h-8 text-[#C8C0F0]" />
        </div>
        <p className="text-xs text-[#A0A0B0]">No shipping details attached</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const NAV_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'prescription',  label: 'Prescription',   icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'timeline',      label: 'Order Timeline', icon: <Calendar className="w-3.5 h-3.5" /> },
  { id: 'invoice',       label: 'Invoice',        icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'shipping',      label: 'Shipping',       icon: <MapPin   className="w-3.5 h-3.5" /> },
];

export default function CaseDetailPage({ caseData, onBack, onArchiveToggle }: CaseDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('prescription');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(caseData.requestedDelivery ?? '');
  // Conversion helpers — the rest of the app uses "DD-MMM-YYYY"; the date input expects ISO.
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
  const toIsoDate = (d: string): string => {
    if (!d.trim()) return '';
    const [day, mon, year] = d.split('-');
    const m = MONTHS.indexOf(mon as typeof MONTHS[number]);
    if (m < 0 || !day || !year) return '';
    return `${year}-${String(m + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
  };
  const fromIsoDate = (iso: string): string => {
    if (!iso) return '';
    const [year, mon, day] = iso.split('-');
    const m = Number(mon) - 1;
    if (m < 0 || m > 11 || !day || !year) return '';
    return `${day.padStart(2, '0')}-${MONTHS[m]}-${year}`;
  };
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  // Build service items list — derived BEFORE topTab useState so the initial
  // tab can be set correctly for single-service cases.
  const serviceItems: ServiceItem[] = caseData.serviceItems ?? caseData.services.map((svcName, i) => ({
    id: `si-${i}`,
    name: svcName,
    status: caseData.status,
    deliveryDate: caseData.requestedDelivery,
    phases: svcName === 'Clear Aligners' ? [
      { label: 'Phase 1', status: 'in-progress' as const, deliveryDate: caseData.requestedDelivery ?? undefined },
      { label: 'Phase 2', status: 'pending'     as const },
    ] : undefined,
  }));
  const isMultiService = serviceItems.length > 1;

  // Single-service cases skip the "Case Summary" tab entirely — topTab defaults
  // straight to the one service's ID so no redundant navigation layer exists.
  const [topTab, setTopTab] = useState<string>(
    isMultiService ? 'summary' : (serviceItems[0]?.id ?? 'summary')
  );
  // Details card collapses by default to reclaim vertical space.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const s = STATUS_MAP[caseData.status];
  const service = caseData.services[0] ?? 'Service';
  const iconStyle = SERVICE_ICON_COLOR[service] ?? { bg: '#FFF7ED', color: '#F59E0B' };
  const missingDeliveryDate = !deliveryDate.trim();

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC]">
      {/* ── Back nav (with delivery-date warning on the right when applicable) ── */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#717182] hover:text-[#030213] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Cases
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {missingDeliveryDate && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFEBEE] border border-[#FECDD3] text-[11px] font-medium text-[#BE123C]">
              <AlertTriangle className="w-3.5 h-3.5" />
              Warning — Please enter requested delivery date
            </span>
          )}
          {onArchiveToggle && (
            caseData.archived ? (
              <button
                onClick={onArchiveToggle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4D8EF7] border border-[#C8D8FC] bg-[#EEF4FF] hover:bg-[#DBEAFE] transition-colors"
                title="Restore this case to the active list"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                Unarchive
              </button>
            ) : (
              <button
                onClick={onArchiveToggle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC] hover:text-[#030213] transition-colors"
                title="Archive this case (hidden from the active list, restorable later)"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Identity card (with compact timeline pill in the header row) ── */}
      <div className="mx-6 mt-2 bg-white border border-[#E0E0E6] rounded-xl">
        <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-center gap-3 flex-wrap">
          <h1 className="text-base font-bold text-[#030213] tracking-tight">{caseData.id}</h1>

          {caseData.archived && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3F3F5] text-[#616161] border border-[#BDBDBD]">
              <Archive className="w-3 h-3" />
              Archived
            </span>
          )}

          {/* AI suggestion chip */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA]">
            <Lightbulb className="w-3 h-3" />
            New case received from {caseData.practice}
          </span>

          {/* Right side: collapsed patient hint + expand toggle + timeline pill */}
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            {!detailsOpen && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#717182]">
                <span className="font-medium text-[#030213]">{caseData.patientName}</span>
                <span className="text-[#D4CEE1]">·</span>
                <span className="truncate max-w-[120px]">{caseData.practice}</span>
              </span>
            )}
            <button
              onClick={() => setDetailsOpen(v => !v)}
              title={detailsOpen ? 'Collapse details' : 'Expand details'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors border border-transparent hover:border-[#C8D8FC]"
            >
              {detailsOpen
                ? <><ChevronUp   className="w-3.5 h-3.5" /> Hide details</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Show details</>
              }
            </button>
          </div>
        </div>

        {/* Collapsible details grid */}
        {detailsOpen && (
          <div className="px-5 py-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-5 border-t border-[#F0EFF6]">
            {/* Patient */}
            <div>
              <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold mb-1">Patient</p>
              <p className="text-xs font-semibold text-[#030213]">{caseData.patientName}</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Age / Gender</p>
              <p className="text-[11px] text-[#717182]">—</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Patient ID</p>
              <p className="text-[11px] text-[#717182]">—</p>
            </div>

            {/* Clinic */}
            <div>
              <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold mb-1">Clinic</p>
              <p className="text-xs font-semibold text-[#030213] truncate">{caseData.practice}</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Address</p>
              <p className="text-[11px] text-[#717182]">—</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Phone</p>
              <p className="text-[11px] text-[#717182]">+44 20 7946 0000</p>
            </div>

            {/* Dentist */}
            <div>
              <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold mb-1">Dentist</p>
              <p className="text-xs font-semibold text-[#030213]">{caseData.dentist}</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Phone</p>
              <p className="text-[11px] text-[#717182]">—</p>
            </div>

            {/* Assignee / Created */}
            <div>
              <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wider font-semibold mb-1">Assignee</p>
              <p className="text-[11px] text-[#717182]">— Unassigned —</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Created On</p>
              <p className="text-xs text-[#030213]">{caseData.createdAt}</p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Submitted By</p>
              <p className="text-[11px] text-[#717182]">{caseData.practice}</p>
            </div>

            {/* Delivery date / Created by / Received via */}
            <div>
              <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${missingDeliveryDate ? 'text-[#D4183D]' : 'text-[#A0A0B0]'}`}>Delivery Date</p>
              <input
                type="date"
                value={toIsoDate(deliveryDate)}
                onChange={(e) => setDeliveryDate(fromIsoDate(e.target.value))}
                className={`w-full text-xs px-2 py-1.5 rounded-md border outline-none transition-colors ${
                  missingDeliveryDate
                    ? 'border-[#FECDD3] bg-[#FFF1F2] focus:border-[#D4183D]'
                    : 'border-[#E0E0E6] focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20'
                }`}
              />
              <p className="text-[10px] text-[#A0A0B0] mt-3">Created By</p>
              <p className="text-[11px] text-[#717182]">Smile Genius Lab <span className="text-[#A0A0B0]">(Clinic)</span></p>
              <p className="text-[10px] text-[#A0A0B0] mt-2">Received via</p>
              <p className="text-[11px] text-[#717182]">Manual upload</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Top tab bar: Case Summary (multi-service only) + one tab per service ── */}
      <div className="mx-6 mt-3 bg-white border border-[#E0E0E6] rounded-xl overflow-x-auto">
        <div className="flex items-center px-1 min-w-0">
          {/* Case Summary tab — only when 2+ services exist */}
          {isMultiService && (
            <button
              onClick={() => setTopTab('summary')}
              className={`inline-flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                topTab === 'summary'
                  ? 'border-[#4D8EF7] text-[#4D8EF7]'
                  : 'border-transparent text-[#717182] hover:text-[#030213]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Case Summary
            </button>
          )}
          {/* Per-service tabs */}
          {serviceItems.map((si) => {
            const siStyle = SERVICE_ICON_COLOR[si.name] ?? { bg: '#FFF7ED', color: '#F59E0B' };
            return (
              <button
                key={si.id}
                onClick={() => setTopTab(si.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  topTab === si.id
                    ? 'border-[#4D8EF7] text-[#4D8EF7]'
                    : 'border-transparent text-[#717182] hover:text-[#030213]'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: siStyle.bg }}
                >
                  <span className="text-[8px] font-bold leading-none" style={{ color: siStyle.color }}>
                    {si.name.charAt(0)}
                  </span>
                </div>
                {si.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body: Case Summary cards OR per-service detail ── */}
      {topTab === 'summary' ? (
        /* Case Summary — one card per service, no sidebar */
        <div className="mt-3 mx-6 mb-6 flex-1 overflow-y-auto">
          <CaseSummaryOverview
            serviceItems={serviceItems}
            caseData={caseData}
            onSelectService={(id) => setTopTab(id)}
            onOpenTimeline={() => setTimelineOpen(true)}
          />
        </div>
      ) : (
        // Per-service view — find the matching ServiceItem and render its detail
        (() => {
          const activeSi = serviceItems.find(si => si.id === topTab);
          return activeSi
            ? <ServiceDetailView
                service={activeSi}
                caseData={caseData}
                onOpenNotes={() => setNotesOpen(true)}
                onOpenFullView={() => setFullViewOpen(true)}
              />
            : null;
        })()
      )}

      {/* Lab Notes modal */}
      {notesOpen && (
        <LabNotesModal
          onClose={() => { setNotesOpen(false); setNotesExpanded(false); }}
          expanded={notesExpanded}
          onToggleExpand={() => setNotesExpanded((v) => !v)}
        />
      )}

      {/* Full-view overlay — expanded 3D viewer + order form + teeth chart */}
      {fullViewOpen && (
        <FullViewModal
          caseData={caseData}
          onClose={() => setFullViewOpen(false)}
          onOpenNotes={() => setNotesOpen(true)}
        />
      )}

      {/* Case Timeline modal — opens from the compact pill in the identity card */}
      {timelineOpen && (
        <CaseTimelineModal caseData={caseData} onClose={() => setTimelineOpen(false)} />
      )}
    </div>
  );
}
