import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, EyeOff, KeyRound, Link2, Mail, MessageCircle, Plus, RefreshCw, ShieldCheck, UploadCloud, XCircle } from 'lucide-react';
import Button from '../../src/app/components/Button';
import Modal from '../../src/app/components/Modal';
import Toggle from '../../src/app/components/Toggle';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import type { Case } from '../../src/app/pages/CasesPage';
import PublicViewSummary from './PublicViewSummary';
import { FileList } from '../design-studio/components/FileChips';
import { portalDateTime, teamMemberFor } from '../lab-prescription-inbox/data';
import {
  createUploadLink, expiryLabel, fileCount, linkState, linksForCase, linkUrl, markReviewed, newFileCount,
  piiWarnings, publicViewFor, REQUEST_KINDS, RequestKind, revokeUploadLink, UploadLink, useUploadLinks,
} from './uploadStore';

// ── "Request files" on the case page ─────────────────────────────────────────
// The lab makes an upload link for this case and shares it offline. Hosted by
// the case-page slot (design-studio/studio/CaseDesignReviewSlot.tsx).

const STATE_PILL = {
  active:  { label: 'Live',    cls: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' },
  locked:  { label: 'Locked',  cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]' },
  expired: { label: 'Expired', cls: 'bg-[#F8F9FC] text-[#717182] border-[#E0E0E6]' },
  revoked: { label: 'Revoked', cls: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
};

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC] transition-colors';

function shareText(l: UploadLink) {
  const asks = l.requested.map(r => REQUEST_KINDS.find(k => k.id === r)!.label).join(', ');
  return `Hi ${l.view.dentist}, ${l.labName} needs files for case ${l.view.caseRef} (patient ${l.view.patientInitials}, ${l.view.service}): ${asks}.\n\nPlease upload them here (no login needed): ${linkUrl(l.token)}${l.code ? "\n\nWe'll send the access code in a separate message." : ''}`;
}

function CreateLinkModal({ portalCase, onClose }: { portalCase: Case; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requested, setRequested] = useState<RequestKind[]>(['cbct']);
  const [note, setNote] = useState('');
  const [expiry, setExpiry] = useState(14);
  const [withCode, setWithCode] = useState(true);
  const [confirmPii, setConfirmPii] = useState(false);
  const view = publicViewFor(portalCase);
  const warnings = piiWarnings(note, portalCase.patientName);

  function create() {
    if (!requested.length) { toast.error('Pick at least one type of file'); return; }
    if (warnings.length && !confirmPii) { setConfirmPii(true); return; }
    createUploadLink({
      caseId: portalCase.id, view, requested, note, expiryDays: expiry, withCode,
      createdBy: teamMemberFor(user?.email)?.name ?? user?.name ?? 'Lab',
    });
    toast.success('Upload link created');
    onClose();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create upload link"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button icon={<Link2 className="w-4 h-4" />} onClick={create}>{confirmPii && warnings.length ? 'Create anyway' : 'Create link'}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-[#030213] mb-1">What do you need?</p>
          <p className="text-xs text-[#717182] mb-2">The clinic sees this as a checklist.</p>
          <div className="flex flex-wrap gap-2">
            {REQUEST_KINDS.map(k => {
              const on = requested.includes(k.id);
              return (
                <button
                  key={k.id}
                  title={k.hint}
                  onClick={() => setRequested(r => (on ? r.filter(x => x !== k.id) : [...r, k.id]))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]' : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}
                >
                  {on && <CheckCircle2 className="w-3 h-3 inline -mt-0.5 mr-1" />}{k.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#030213] mb-1">Note to the clinician <span className="font-normal text-[#A0A0B0]">(optional)</span></label>
          <textarea
            value={note}
            maxLength={240}
            onChange={e => { setNote(e.target.value); setConfirmPii(false); }}
            rows={3}
            placeholder="e.g. Full-arch CBCT please, with the bite registration."
            className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:outline-none focus:border-[#4D8EF7] resize-none"
          />
          <div className="flex items-start justify-between gap-3 mt-1">
            <p className="text-[11px] text-[#717182] flex items-center gap-1"><EyeOff className="w-3 h-3" /> Don't include patient names or other personal details. Anyone with the link can read this note.</p>
            <span className="text-[11px] text-[#A0A0B0] tabular-nums">{note.length}/240</span>
          </div>
          {warnings.length > 0 && (
            <div className={`mt-2 rounded-lg border px-3 py-2 flex items-start gap-2 ${confirmPii ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#FFF8E1] border-[#FDE68A]'}`}>
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${confirmPii ? 'text-[#B91C1C]' : 'text-[#B45309]'}`} />
              <p className={`text-xs ${confirmPii ? 'text-[#B91C1C]' : 'text-[#B45309]'}`}>
                This note looks like it contains {warnings.join(', ')}. Please remove it: the clinic already knows the patient from the case ref and initials.
                {confirmPii && ' Select "Create anyway" if you\'re sure it\'s fine.'}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-[#030213] mb-2">Link expires in</p>
            <div className="inline-flex p-0.5 bg-[#F3F3F5] rounded-lg">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setExpiry(d)} className={`px-3 py-1 rounded-md text-xs ${expiry === d ? 'bg-white text-[#1565C0] font-semibold shadow-sm' : 'text-[#717182] font-medium'}`}>{d} days</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#030213]">Require an access code</p>
              <Toggle on={withCode} onChange={() => setWithCode(v => !v)} />
            </div>
            <p className="text-[11px] text-[#717182] mt-1">A 6-digit code you send separately, so a forwarded link alone isn't enough.</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#E0E0E6] bg-[#F8F9FC] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#717182] uppercase tracking-wide mb-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#047857]" /> The clinic will see only this</p>
          <PublicViewSummary view={view} />
          <p className="text-[11px] text-[#A0A0B0] mt-1.5">Never shown: the patient's name, date of birth, contact details, clinical notes, prices or other files.</p>
        </div>
      </div>
    </Modal>
  );
}

export function useRequestFilesChip(caseId: string) {
  const { links } = useUploadLinks();
  const mine = links.filter(l => l.caseId === caseId);
  const fresh = mine.reduce((n, l) => n + newFileCount(l), 0);
  const live = mine.find(l => linkState(l) === 'active' || linkState(l) === 'locked');
  return fresh ? { label: `${fresh} new`, hot: true } : live ? { label: 'Live', hot: false } : mine.length ? { label: 'Closed', hot: false } : { label: 'New', hot: false };
}

export default function RequestFilesPanel({ caseId, portalCase }: { caseId: string; portalCase?: Case }) {
  const { toast } = useToast();
  useUploadLinks();
  const [creating, setCreating] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick(t => t + 1), 30_000); return () => window.clearInterval(id); }, []);

  const links = linksForCase(caseId);
  const latest = links[0];
  const batches = links.flatMap(l => l.batches.map(b => ({ ...b, link: l }))).sort((a, b) => b.at.localeCompare(a.at));
  const fresh = links.reduce((n, l) => n + newFileCount(l), 0);
  const copy = (text: string, msg: string) => { navigator.clipboard?.writeText(text).catch(() => {}); toast.success(msg); };
  const modal = creating && portalCase && <CreateLinkModal portalCase={portalCase} onClose={() => setCreating(false)} />;

  if (!latest) {
    return (
      <>
        <div className="bg-white border border-[#E0E0E6] rounded-xl flex flex-col items-center justify-center py-14 px-4">
          <div className="w-16 h-16 bg-[#F8F9FC] rounded-full flex items-center justify-center mb-4"><UploadCloud className="w-8 h-8 text-[#717182]" /></div>
          <h3 className="text-xl font-semibold text-[#030213] mb-2">Ask the clinic for files</h3>
          <p className="text-[#717182] text-center mb-6 max-w-md">
            Create an upload link and send it on WhatsApp or email. {portalCase?.dentist ?? 'The clinician'} can upload DICOM, scans and photos straight into this case, with no login. The page shows only the case ref and the patient's initials.
          </p>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)} disabled={!portalCase}>Create upload link</Button>
        </div>
        {modal}
      </>
    );
  }

  const st = linkState(latest);
  const pill = STATE_PILL[st];
  const url = linkUrl(latest.token);
  const open = st === 'active' || st === 'locked';
  const text = shareText(latest);

  return (
    <>
      <div className="bg-white border border-[#E0E0E6] rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <UploadCloud className="w-4 h-4 text-[#4D8EF7]" />
          <p className="text-sm font-semibold text-[#030213]">Upload link</p>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pill.cls}`}>{pill.label}</span>
          <span className="text-xs text-[#717182]">
            Made by {latest.createdBy} · {st === 'revoked' ? `revoked ${portalDateTime(latest.revokedAt!)}` : `${st === 'expired' ? 'expired' : 'expires'} ${expiryLabel(latest)}`}
            {latest.openedAt ? ` · opened ${portalDateTime(latest.openedAt)}` : ' · not opened yet'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {open && <Button variant="outline" size="sm" icon={<XCircle className="w-3.5 h-3.5" />} onClick={() => { revokeUploadLink(latest.token); toast.success('Link revoked. It no longer opens.'); }}>Revoke</Button>}
          <Button size="sm" icon={open ? <RefreshCw className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} onClick={() => setCreating(true)} disabled={!portalCase}>{open ? 'New link' : 'Create new link'}</Button>
        </div>
      </div>

      {open && (
        <div className="rounded-xl border border-[#E0E0E6] bg-white p-4">
          <p className="text-xs font-semibold text-[#030213] mb-2">Share with {latest.view.dentist} · {latest.view.practice}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={e => e.target.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E0E0E6] bg-[#F8F9FC] text-xs font-mono text-[#030213] focus:outline-none" />
            <button onClick={() => copy(url, 'Upload link copied')} className={btn}><Copy className="w-3.5 h-3.5" /> Copy</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={btn}><MessageCircle className="w-3.5 h-3.5 text-[#25D366]" /> Share on WhatsApp</a>
            <a href={`mailto:?subject=${encodeURIComponent(`Files needed for case ${latest.view.caseRef}`)}&body=${encodeURIComponent(text)}`} className={btn}><Mail className="w-3.5 h-3.5" /> Email</a>
            <button onClick={() => copy(text, 'Message copied')} className={btn}><Copy className="w-3.5 h-3.5" /> Copy message</button>
            <a href={url} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="w-3.5 h-3.5" /> Preview as clinic</a>
          </div>
          {latest.code && (
            <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#EEF4FF] px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1565C0] flex-shrink-0" />
              <p className="text-xs text-[#1565C0] flex-1">Access code <span className="font-mono font-bold tracking-[0.25em] text-sm text-[#030213] ml-1">{latest.code}</span><span className="block text-[11px] text-[#3B6BAE] mt-0.5">Send it in a separate message or say it on the phone. It isn't included in the link or the message above.</span></p>
              <button onClick={() => copy(latest.code!, 'Access code copied')} className={btn}><Copy className="w-3.5 h-3.5" /> Copy code</button>
            </div>
          )}
          {st === 'locked' && (
            <p className="mt-2 text-xs text-[#B45309] flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Too many wrong codes. The link is locked for 15 minutes.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-[#717182] uppercase tracking-wide mb-2">Requested</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {latest.requested.map(r => <span key={r} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EEF4FF] text-[#1565C0]">{REQUEST_KINDS.find(k => k.id === r)!.label}</span>)}
          </div>
          {latest.note && <p className="text-sm text-[#030213] bg-[#F8F9FC] border border-[#F0EFF6] rounded-lg px-3 py-2"><span className="text-[#717182]">Note · </span>{latest.note}</p>}
        </div>
        <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-[#717182] uppercase tracking-wide mb-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#047857]" /> What the clinic sees</p>
          <PublicViewSummary view={latest.view} />
        </div>
      </div>

      <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-[#030213]">Files received <span className="text-[#717182] font-normal">({links.reduce((n, l) => n + fileCount(l), 0)})</span></p>
          {fresh > 0 && <Button variant="outline" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => markReviewed(caseId)}>Mark {fresh} as reviewed</Button>}
        </div>
        {batches.length === 0 ? (
          <p className="text-xs text-[#717182]">Nothing yet. Files appear here as soon as the clinic sends them, and the bell lets you know.</p>
        ) : (
          <div className="space-y-3">
            {batches.map(b => {
              const isNew = !b.link.reviewedAt || b.at > b.link.reviewedAt;
              return (
                <div key={b.id} className={`rounded-lg border px-3 py-2.5 ${isNew ? 'border-[#BFDBFE] bg-[#F5F9FF]' : 'border-[#F0EFF6]'}`}>
                  <p className="text-xs text-[#030213] mb-2">
                    <span className="font-semibold">{b.uploader ?? 'The clinic'}</span> sent {b.files.length} file{b.files.length === 1 ? '' : 's'} · {portalDateTime(b.at)}
                    {isNew && <span className="ml-2 px-1.5 py-px rounded-full text-[9px] font-bold bg-[#E3F2FD] text-[#1565C0]">NEW</span>}
                    {b.link.token !== latest.token && <span className="ml-2 text-[#A0A0B0]">· earlier link</span>}
                  </p>
                  <FileList files={b.files} />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {modal}
    </>
  );
}
