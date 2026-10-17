import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FolderUp, Mail, MessageSquareText, Paperclip } from 'lucide-react';
import { getCreatedCases } from '../../src/app/data/createdCases';
import { mockCases, type Case } from '../../src/app/pages/CasesPage';
import { FileList } from '../design-studio/components/FileChips';
import type { DesignFile } from '../design-studio/data/designStudio';
import { portalDateTime } from '../lab-prescription-inbox/data';
import { IntakeSubmission, labLinkForCase, useIntake } from './intakeStore';
import { emailsForCase, useForwardedEmails } from '../forwarded-email/emailStore';

// ── The case's "Attachment files / Scans" card, with real files and filters ──
// CaseDetailPage draws this card with placeholder files and an "All" button
// that doesn't filter. Inside Growth Team Feedback the sandbox fills it at
// runtime: the case's own scans and attachments (labelled by where they came
// from) plus everything LabLink added (the new-case request it came from and
// files sent later), filterable by type and source. The dentist's notes sit
// above. Relies on CaseDetailPage's markup: the card title
// "Attachment files / Scans"; sandbox.css hides the native body.

type TypeFilter = 'all' | 'scans' | 'dicom' | 'photos' | 'docs';
type SourceFilter = 'all' | 'scanner' | 'lablink' | 'email' | 'lab';

const TYPES: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'scans', label: 'Scans' }, { id: 'dicom', label: 'CBCT / DICOM' }, { id: 'photos', label: 'Photos' }, { id: 'docs', label: 'Documents' },
];
const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: 'all', label: 'All sources' }, { id: 'scanner', label: 'Scanner' }, { id: 'lablink', label: 'LabLink' }, { id: 'email', label: 'Email' }, { id: 'lab', label: 'Lab' },
];

const typeOf = (k: DesignFile['kind']): Exclude<TypeFilter, 'all'> =>
  k === 'mesh' ? 'scans' : k === 'dicom' || k === 'archive' ? 'dicom' : k === 'image' ? 'photos' : 'docs';

interface NativeFile { name: string; size: string; type: Exclude<TypeFilter, 'all'>; source: Exclude<SourceFilter, 'all' | 'lablink' | 'email'>; from: string }

function findCase(id: string): Case | undefined {
  return getCreatedCases().find(c => c.id === id) ?? mockCases.find(c => c.id === id);
}

/** The case's own files, as CaseDetailPage lists them (placeholders), with where they came from. */
function nativeFiles(c: Case): NativeFile[] {
  const scans = (c.serviceItems ?? []).reduce((n, si) => n + (si.scanFileCount ?? 0), 0);
  const atts = (c.serviceItems ?? []).reduce((n, si) => n + (si.attachmentCount ?? 0), 0);
  const fromScanner = c.source === 'scanner';
  const from = fromScanner ? `${c.scanner} scanner` : c.source === 'email' ? 'Email to the lab' : c.source === 'post' ? 'Impressions by post' : 'Added by the lab';
  return [
    ...Array.from({ length: scans }, (_, i): NativeFile => ({ name: `scan-${i + 1}.stl`, size: `${(2.3 + i * 0.6).toFixed(1)} MB`, type: 'scans', source: fromScanner ? 'scanner' : 'lab', from })),
    ...Array.from({ length: atts }, (_, i): NativeFile => ({ name: `attachment-${i + 1}.pdf`, size: `${(0.4 + i * 0.3).toFixed(1)} MB`, type: 'docs', source: 'lab', from: fromScanner ? 'Added by the lab' : from })),
  ];
}

function findCard(): { card: HTMLElement; subtitle: HTMLElement | null; allBtn: HTMLElement | null } | null {
  const title = [...document.querySelectorAll<HTMLElement>('p')].find(p => p.children.length === 0 && p.textContent?.trim() === 'Attachment files / Scans');
  const card = title?.closest<HTMLElement>('.rounded-xl.overflow-hidden');
  if (!title || !card) return null;
  const header = card.firstElementChild as HTMLElement | null;
  const allBtn = header ? [...header.querySelectorAll<HTMLElement>('button')].find(b => b.textContent?.trim() === 'All') ?? null : null;
  return { card, subtitle: title.nextElementSibling as HTMLElement | null, allBtn };
}

function Body({ caseId, highlight }: { caseId: string; highlight: boolean }) {
  useIntake();
  useForwardedEmails();
  const c = findCase(caseId);
  const subs = labLinkForCase(caseId);
  const emails = emailsForCase(caseId);
  const [type, setType] = useState<TypeFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const native = useMemo(() => (c ? nativeFiles(c) : []), [c?.id]);

  const groups = subs.map(s => ({ s, files: s.files.filter(f => (type === 'all' || typeOf(f.kind) === type) && (source === 'all' || source === 'lablink')) }));
  const emailGroups = emails.map(e => ({ e, files: e.files.filter(f => (type === 'all' || typeOf(f.kind) === type) && (source === 'all' || source === 'email')) }));
  const nativeShown = native.filter(f => (type === 'all' || f.type === type) && (source === 'all' || f.source === source));
  const allLab = [...subs.flatMap(s => s.files), ...emails.flatMap(e => e.files)];
  const count = (t: TypeFilter) => (t === 'all' ? native.length + allLab.length : native.filter(f => f.type === t).length + allLab.filter(f => typeOf(f.kind) === t).length);
  const total = native.length + allLab.length;
  const shown = nativeShown.length + groups.reduce((n, g) => n + g.files.length, 0) + emailGroups.reduce((n, g) => n + g.files.length, 0);
  const notes = subs.filter(s => s.filesFor?.comments || s.order?.instructions);
  const what = (s: IntakeSubmission) => (s.kind === 'files' ? (s.filesFor?.matchedBy === 'reference' ? 'synced by reference' : `matched by ${s.filesFor?.attachedBy ?? 'the lab'}`) : 'with the new-case request');

  return (
    <div className={`sf-attach-body px-5 py-4 space-y-4 ${highlight ? 'ring-2 ring-[#4D8EF7]/30 rounded-b-xl' : ''}`}>
      <p className="text-[11px] text-[#717182]">{total} file{total === 1 ? '' : 's'}{subs.length ? ` · ${subs.reduce((n, s) => n + s.files.length, 0)} from LabLink` : ''}{emails.length ? ` · ${emails.reduce((n, e) => n + e.files.length, 0)} from email` : ''}</p>

      {notes.map(s => (
        <div key={s.ref} className="rounded-xl bg-[#EEF4FF] border border-[#DBEAFE] px-3 py-2.5 flex items-start gap-2">
          <MessageSquareText className="w-4 h-4 text-[#1565C0] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#1565C0]">Note from {s.dentist} · LabLink {s.ref} · {portalDateTime(s.at)}</p>
            <p className="text-xs text-[#030213] mt-0.5 leading-relaxed whitespace-pre-wrap">{s.filesFor?.comments || s.order?.instructions}</p>
          </div>
        </div>
      ))}

      {emails.map(e => (
        <div key={e.id} className="rounded-xl bg-[#F8F9FC] border border-[#F0EFF6] px-3 py-2.5 flex items-start gap-2">
          <Mail className="w-4 h-4 text-[#5A5568] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#5A5568]">Email from {e.fromName} · "{e.subject}" · {portalDateTime(e.at)} · {e.status === 'case' ? `this case was made from it by ${e.actedBy}` : `added by ${e.actedBy}`}</p>
            <p className="text-xs text-[#030213] mt-0.5 leading-relaxed whitespace-pre-wrap line-clamp-4">{e.body.trim()}</p>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)} disabled={t.id !== 'all' && count(t.id) === 0}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors disabled:opacity-40 ${type === t.id ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]' : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}>
              {t.label} <span className="tabular-nums text-[#A0A0B0]">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <select value={source} onChange={e => setSource(e.target.value as SourceFilter)} aria-label="Filter by source" className="px-2.5 py-1.5 rounded-lg border border-[#E0E0E6] text-xs text-[#030213] bg-white focus:outline-none focus:border-[#4D8EF7]">
          {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {shown === 0 && <p className="text-xs text-[#A0A0B0] text-center py-6">{total ? 'No files match these filters.' : 'No files attached'}</p>}

      {groups.filter(g => g.files.length).map(({ s, files }) => (
        <div key={s.ref}>
          <p className="text-[11px] font-semibold text-[#717182] mb-1.5 flex items-center gap-1.5">
            <FolderUp className="w-3.5 h-3.5 text-[#4D8EF7]" /> LabLink · {s.dentist} · {portalDateTime(s.at)} · {what(s)}
          </p>
          <FileList files={files} />
        </div>
      ))}

      {emailGroups.filter(g => g.files.length).map(({ e, files }) => (
        <div key={e.id}>
          <p className="text-[11px] font-semibold text-[#717182] mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#5A5568]" /> Email · {e.fromName} · {portalDateTime(e.at)} · forwarded by {e.forwardedBy}
          </p>
          <FileList files={files} />
        </div>
      ))}

      {nativeShown.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#717182] mb-1.5">{nativeShown[0].from}{nativeShown.some(f => f.from !== nativeShown[0].from) ? ' and the lab' : ''}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {nativeShown.map(f => (
              <div key={f.name} className="border border-[#E0E0E6] rounded-lg p-3 flex items-center gap-2" title={`${f.from} · kept with the case`}>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${f.type === 'scans' ? 'bg-[#EEF4FF]' : 'bg-[#F5F3FF]'}`}>
                  {f.type === 'scans' ? <Eye className="w-4 h-4 text-[#1565C0]" /> : <Paperclip className="w-4 h-4 text-[#7C3AED]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#030213] truncate">{f.name}</p>
                  <p className="text-[10px] text-[#A0A0B0]">{f.size} · {f.from}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseAttachmentsOverlay({ caseId }: { caseId: string }) {
  const [found, setFound] = useState<ReturnType<typeof findCard>>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    const sync = () => setFound(prev => {
      const next = findCard();
      return prev && next && prev.card === next.card ? prev : next;
    });
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => mo.disconnect();
  }, [caseId]);

  useEffect(() => {
    if (!found) return;
    found.card.setAttribute('data-sf-attach', 'on');
    found.subtitle?.setAttribute('data-sf-hide', 'on');
    found.allBtn?.setAttribute('data-sf-hide', 'on');
    return () => {
      found.card.removeAttribute('data-sf-attach');
      found.subtitle?.removeAttribute('data-sf-hide');
      found.allBtn?.removeAttribute('data-sf-hide');
    };
  }, [found]);

  // ?sf=attachments (What's new, Match files): bring the card into view.
  useEffect(() => {
    if (!found || new URLSearchParams(window.location.search).get('sf') !== 'attachments' && !pendingAttachments.value) return;
    pendingAttachments.value = false;
    // The case page settles its own scroll first, so wait a beat.
    const go = window.setTimeout(() => { found.card.scrollIntoView({ behavior: 'smooth', block: 'start' }); setHighlight(true); }, 600);
    const t = window.setTimeout(() => setHighlight(false), 3500);
    return () => { window.clearTimeout(go); window.clearTimeout(t); };
  }, [found?.card]);

  if (!found) return null;
  return createPortal(<Body caseId={caseId} highlight={highlight} />, found.card);
}

/** Set before a deep link has to click through the Cases list (the URL's ?sf= is lost on the way). */
export const pendingAttachments = { value: false };
