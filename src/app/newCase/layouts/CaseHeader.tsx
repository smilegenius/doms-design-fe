// ─── New Case Flow · case header and banners ─────────────────────────────────
// The case ID and status, the save indicator, the ⋯ menu and Close, Guided's
// case corner above its timeline, and the banners (approval, sent, reopened
// answers). Each layout composes the pieces it wants.

import { useEffect, useState } from 'react';
import { ArrowLeft, FilePlus, HelpCircle, MoreHorizontal, Trash2, X } from 'lucide-react';
import { useCase } from '../CaseContext';
import { useController } from '../controller';
import { fmtDay, fromISO } from '../dates';
import { Notice, PrimaryButton, SecondaryButton, FOCUS } from '../ui';

export function SaveIndicator() {
  const c = useController();
  if (c.view !== 'edit') return null;
  return <span className="text-xs text-[#4A4A5A]">{c.saveState === 'saved' ? 'Saved' : c.saveState === 'saving' ? 'Saving…' : 'Not saved yet'}</span>;
}

export function CaseMenu() {
  const { draft } = useCase();
  const c = useController();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-case-menu]')) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', h);
    window.addEventListener('keydown', k, true);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('keydown', k, true); };
  }, [open]);
  if (c.view !== 'edit') return null;
  return (
    <div className="relative" data-case-menu>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label="More actions" aria-expanded={open} className={`p-1.5 rounded-lg text-[#3A3A4A] hover:bg-[#F0EFF6] ${FOCUS}`}><MoreHorizontal className="w-5 h-5" /></button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E0E0E6] rounded-xl shadow-lg overflow-hidden z-30">
          {/* A scan's draft opens as itself; a different job for the same patient starts apart. */}
          {draft.scan && (
            <button type="button" onClick={() => { setOpen(false); c.startSeparate(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#3A3A4A] hover:bg-[#F8F9FC]"><FilePlus className="w-4 h-4" aria-hidden />Start a Separate Case</button>
          )}
          <button type="button" disabled={!draft.id} onClick={() => { setOpen(false); c.requestDelete(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-40"><Trash2 className="w-4 h-4" aria-hidden />Delete Draft</button>
          <button type="button" onClick={() => { setOpen(false); c.showHelp(); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#3A3A4A] hover:bg-[#F8F9FC]"><HelpCircle className="w-4 h-4" aria-hidden />Help</button>
        </div>
      )}
    </div>
  );
}

export function CaseIdBadge() {
  const { draft } = useCase();
  const c = useController();
  if (!draft.id) return null;
  return (
    <span className="text-sm font-semibold text-[#030213] whitespace-nowrap">
      {draft.id}{' '}
      <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3F3F5] border border-[#E0E0E6] text-[#3A3A4A] align-middle">
        {c.row?.status ?? 'Draft'}{c.row?.flag ? ` · ${c.row.flag}` : ''}
      </span>
    </span>
  );
}

export function CloseButton() {
  const c = useController();
  return <SecondaryButton onClick={() => c.saveAndClose(false)}><X className="w-3.5 h-3.5" aria-hidden />Close</SecondaryButton>;
}

/** Approval / waiting / sent / reopened banners. (Continuing a scan's draft needs no banner: the subtitle says "from iTero scan".) */
export function CaseBanners({ className = 'mt-4 space-y-2' }: { className?: string }) {
  const { prescriber, lab, gaps } = useCase();
  const c = useController();
  const items = [];
  if (c.view === 'approve') {
    items.push(
      <Notice key="appr" tone="decision" actions={<>
        <SecondaryButton onClick={c.changeSomething}>Change Something</SecondaryButton>
        <PrimaryButton onClick={() => c.send(true)} disabled={c.sending || gaps > 0}>{c.sending ? 'Sending…' : 'Approve and Send'}</PrimaryButton>
      </>}>
        Prepared by {c.preparedBy?.name ?? 'a colleague'}, today {c.preparedAt ?? ''} · waiting for you to approve.
      </Notice>,
    );
  }
  if (c.view === 'waiting') items.push(<Notice key="wait" tone="note">Waiting for {prescriber?.name ?? 'the prescriber'} to approve and send. It stays a draft until then.</Notice>);
  if (c.view === 'sent' && c.row) {
    items.push(
      <Notice key="sent" tone="success">
        {c.row.status} · sent to {lab.name}{c.row.delivery ? `, back by ${fmtDay(fromISO(c.row.delivery))}` : ''}{c.row.flag ? ` · ${c.row.flag}` : ''}.
      </Notice>,
    );
  }
  if (c.banner) items.push(<Notice key="ban" tone="decision" onDismiss={c.dismissBanner}>{c.banner}</Notice>);
  if (!items.length) return null;
  return <div className={className}>{items}</div>;
}

/**
 * Guided has no page header. The case's corner sits above the timeline instead:
 * the portal's "← Back to …" link (saves and closes), the case ID with its
 * status and ⋯, then the save state and where the case came from. The page
 * title is for screen readers only.
 */
export function CaseCorner() {
  const c = useController();
  const { draft, patient } = useCase();
  return (
    <div className="mb-5 px-1">
      <h1 className="sr-only">{c.view === 'edit' ? 'Create new Case' : 'Case'} for {patient.first} {patient.last}</h1>
      <button type="button" onClick={() => c.saveAndClose(false)} className={`inline-flex items-center gap-1.5 text-xs text-[#717182] hover:text-[#030213] transition-colors rounded ${FOCUS}`}>
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden />Back to Lab Work
      </button>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          {draft.id ? <CaseIdBadge /> : <span className="text-sm font-semibold text-[#030213]">New case</span>}
        </div>
        <CaseMenu />
      </div>
      <p className="mt-0.5 text-[11px] text-[#4A4A5A] truncate" title={c.sub}>
        <SaveIndicator />{c.view === 'edit' && <span className="mx-1 text-[#B8B8C6]" aria-hidden>·</span>}{c.sub.replace(/^New case · /, '')}
      </p>
    </div>
  );
}
