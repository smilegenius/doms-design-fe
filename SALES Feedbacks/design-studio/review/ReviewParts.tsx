import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, HelpCircle, Lock, ShieldCheck } from 'lucide-react';
import Button from '../../../src/app/components/Button';
import { useToast } from '../../../src/app/context/ToastContext';
import { DesignVersion, KIND_LABEL, ReviewLink, StudioCase, studioDate, studioDateTime } from '../data/designStudio';
import { SmileGeniusLogo } from './SmileGeniusLogo';
import { FileList } from '../components/FileChips';
import { clinicianFiles } from '../store/studioStore';

const teethRange = (t: number[]) => {
  const upperAnterior = [13, 12, 11, 21, 22, 23];
  if (t.length === 6 && upperAnterior.every(x => t.includes(x))) return '13–23';
  return t.length > 8 ? 'full arch' : t.join(', ');
};

// ── Chrome (56px) ────────────────────────────────────────────────────────────
export function ReviewChrome({ studioCase, version, onVersion, mode, onMode, canCompare }: {
  studioCase: StudioCase;
  version: DesignVersion;
  onVersion?: (v: DesignVersion) => void;
  mode?: 'review' | 'compare';
  onMode?: (m: 'review' | 'compare') => void;
  canCompare?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [verOpen, setVerOpen] = useState(false);
  const total = studioCase.versions.length;
  return (
    <header className="h-14 flex-shrink-0 bg-white border-b border-[#E0E0E6] px-4 flex items-center gap-4">
      <SmileGeniusLogo className="w-28 h-auto flex-shrink-0" />
      <span className="hidden md:block w-px h-6 bg-[#F0EFF6]" />
      <p className="hidden md:block text-xs text-[#717182] truncate">
        Patient: <span className="font-semibold text-[#030213]">{studioCase.patientName}</span> · {studioCase.service} {teethRange(studioCase.teeth)} · {studioCase.practice}
      </p>
      <div className="ml-auto flex items-center gap-2">
        {canCompare && onMode && (
          <div className="hidden sm:inline-flex p-0.5 bg-[#F8F9FC] border border-[#E0E0E6] rounded-lg">
            {(['compare', 'review'] as const).map(m => (
              <button key={m} onClick={() => onMode(m)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${mode === m ? 'bg-white text-[#4D8EF7] shadow-sm' : 'text-[#717182]'}`}>
                {m === 'compare' ? `Compare with V${version.number - 1}` : 'This version only'}
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          <button
            onClick={() => setVerOpen(o => !o)}
            disabled={!onVersion}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E0E0E6] text-xs font-semibold text-[#030213] hover:bg-[#F8F9FC]"
          >
            Version {version.number} of {total} <ChevronDown className="w-3 h-3 text-[#717182]" />
          </button>
          {verOpen && onVersion && (
            <div className="absolute right-0 top-10 w-60 bg-white border border-[#E0E0E6] rounded-xl shadow-lg py-1 z-40">
              {[...studioCase.versions].sort((a, b) => b.number - a.number).map(v => (
                <button key={v.id} onClick={() => { onVersion(v); setVerOpen(false); }} className={`w-full text-left px-3 py-2 hover:bg-[#F8F9FC] ${v.id === version.id ? 'bg-[#F8F9FC]' : ''}`}>
                  <p className="text-xs font-semibold text-[#030213]">Version {v.number} · {studioDate(v.uploadedAt)}</p>
                  <p className="text-[11px] text-[#717182]">{v.status === 'superseded' ? 'Earlier version · read-only' : 'Current version'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setHelpOpen(o => !o)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#717182] hover:bg-[#F8F9FC]" aria-label="Help">
            <HelpCircle className="w-4 h-4" />
          </button>
          {helpOpen && (
            <div className="absolute right-0 top-10 w-72 bg-white border border-[#E0E0E6] rounded-xl shadow-lg p-4 z-40 text-xs text-[#717182] space-y-2">
              <p className="text-sm font-semibold text-[#030213]">How this review works</p>
              <p><span className="font-semibold text-[#030213]">Drag</span> to orbit, pinch or scroll to zoom, or pick a preset view.</p>
              <p><span className="font-semibold text-[#030213]">Capture</span> (or press C) freezes the view. Draw on it, comment, tag teeth and @mention the lab.</p>
              <p><span className="font-semibold text-[#030213]">Approve</span> or <span className="font-semibold text-[#030213]">Request changes</span> when you're done. Your decision is recorded against this exact version.</p>
              <p>Need a hand? <a className="text-[#4D8EF7] hover:text-[#3578E5]" href="mailto:lab@smilegeniuslab.co.uk">Email the lab</a></p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Soft identity gate (not a login) ─────────────────────────────────────────
export function IdentityGate({ studioCase, version, link, onConfirm }: {
  studioCase: StudioCase; version: DesignVersion; link: ReviewLink; onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(link.recipientName);
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8] to-[#AEE3E6] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-[#E0E0E6] overflow-hidden">
        <div className="px-6 pt-6">
          <SmileGeniusLogo className="w-32 h-auto" />
          <h1 className="text-xl font-semibold text-[#030213] mt-5">You've been asked to review a design for {studioCase.patientName}</h1>
          <p className="text-sm text-[#717182] mt-1">
            {KIND_LABEL[version.kind]} · Version {version.number} · {studioCase.service} · from {studioCase.lab}
          </p>
        </div>
        {version.note && (
          <div className="mx-6 mt-4 rounded-xl border border-[#F0EFF6] bg-[#F8F9FC] px-4 py-3">
            <p className="text-[11px] font-semibold text-[#717182] uppercase tracking-wide mb-1">Note from {version.uploadedBy} at the lab</p>
            <p className="text-sm text-[#030213] leading-relaxed">{version.note}</p>
          </div>
        )}
        <form className="px-6 py-5 space-y-3" onSubmit={e => { e.preventDefault(); if (name.trim()) onConfirm(name.trim()); }}>
          <label className="block">
            <span className="text-xs font-medium text-[#717182]">Confirm your name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:outline-none focus:border-[#4D8EF7]"
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Open the design
          </button>
          <p className="flex items-start gap-1.5 text-[11px] text-[#717182]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#047857] flex-shrink-0 mt-px" />
            No account needed — this link is unique to you and expires on {studioDate(link.expiresAt)}.
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Expired / invalid link ───────────────────────────────────────────────────
export function ExpiredState({ studioCase, link }: { studioCase?: StudioCase; link?: ReviewLink }) {
  const { toast } = useToast();
  const [requested, setRequested] = useState(false);
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8] to-[#AEE3E6] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-[#E0E0E6] p-6 text-center">
        <SmileGeniusLogo className="w-28 h-auto mx-auto" />
        <div className="w-12 h-12 rounded-full bg-[#FFF8E1] border border-[#FDE68A] flex items-center justify-center mx-auto mt-6">
          <Clock className="w-5 h-5 text-[#B45309]" />
        </div>
        <h1 className="text-lg font-semibold text-[#030213] mt-4">{link ? 'This review link has expired' : "We couldn't find this review link"}</h1>
        <p className="text-sm text-[#717182] mt-1.5">
          {link
            ? `Links stay open for a limited time to keep patient designs private. This one closed on ${studioDate(link.expiresAt)}.`
            : 'It may have been mistyped, or replaced by a newer link from the lab.'}
        </p>
        {requested ? (
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#047857]"><CheckCircle2 className="w-4 h-4" /> Request sent — the lab will email you a fresh link.</p>
        ) : (
          <div className="mt-5">
            <Button onClick={() => { setRequested(true); toast.success(`Request sent to ${studioCase?.lab ?? 'the lab'}`); }}>Request a new link</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Submitted: success recap (also the read-only view on re-open) ────────────
export function SubmittedState({ studioCase, version, link, justSubmitted }: {
  studioCase: StudioCase; version: DesignVersion; link: ReviewLink; justSubmitted: boolean;
}) {
  const approved = version.decision === 'approved';
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'start' }); }, []);
  return (
    <div ref={ref} className="max-w-xl mx-auto py-10 px-4 text-center">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${approved ? 'bg-[#ECFDF5] border border-[#A7F3D0]' : 'bg-[#E3F2FD]'}`}>
        <CheckCircle2 className={`w-8 h-8 ${approved ? 'text-[#047857]' : 'text-[#1565C0]'}`} />
      </div>
      <h2 className="text-xl font-semibold text-[#030213] mt-4">Feedback sent to {studioCase.lab}</h2>
      <p className="text-sm text-[#717182] mt-1">
        {approved ? `You approved Version ${version.number}. The lab will proceed to manufacture.` : `You requested changes to Version ${version.number}.`}
        {justSubmitted && ' You can close this tab. We\'ll email you when the lab responds.'}
      </p>
      <div className="mt-6 text-left bg-white border border-[#E0E0E6] rounded-xl divide-y divide-[#F0EFF6]">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-[#717182]">Decision</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${approved ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' : 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]'}`}>
            {approved ? 'Approved' : 'Changes requested'}
          </span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between"><span className="text-xs text-[#717182]">Captures</span><span className="text-sm text-[#030213]">{version.captures.length}</span></div>
        {clinicianFiles(version).length > 0 && <div className="px-4 py-3"><FileList files={clinicianFiles(version)} title="Files you sent" /></div>}
        {version.decisionNote && <div className="px-4 py-3"><p className="text-xs text-[#717182] mb-1">Your note</p><p className="text-sm text-[#030213]">{version.decisionNote}</p></div>}
        {version.signOff && (
          <div className="px-4 py-3 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-[#717182] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-[#717182] leading-relaxed">
              Signed by <span className="font-semibold text-[#030213]">{version.signOff.name}</span> on {studioDateTime(version.signOff.at)} · Version {version.number} · <span className="font-mono">{version.signOff.versionHash}</span>. This record can't be edited.
            </p>
          </div>
        )}
      </div>
      {!justSubmitted && <p className="text-[11px] text-[#A0A0B0] mt-4">This link is now read-only. Submitted {link.submittedAt ? studioDateTime(link.submittedAt) : ''}.</p>}
    </div>
  );
}
