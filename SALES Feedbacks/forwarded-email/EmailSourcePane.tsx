import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Forward, Mail, Sparkles } from 'lucide-react';
import { FileList } from '../design-studio/components/FileChips';
import { portalDateTime } from '../lab-prescription-inbox/data';
import { findPane, findPill } from '../intake-form/IntakeFilesDock';
import { emailForDraft, ForwardedEmail, readEmail, useForwardedEmails } from './emailStore';
import { ClinicPick, pickClinic, setOrderType } from './quickCreateAssist';

// ── QuickCreate's source pane for an email draft ─────────────────────────────
// QuickCreate shows email drafts with its built-in mock prescription. For a
// forwarded email the sandbox puts the real email there at runtime: who sent
// it, who forwarded it, the full text, the attachments and what was read from
// it. The header pill reads "Email draft". Same technique (and sandbox.css
// rules) as the LabLink draft pane.

export function EmailCard({ e, compact = false, clinic }: { e: ForwardedEmail; compact?: boolean; clinic?: ClinicPick | null }) {
  const r = readEmail(e);
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#E0E0E6] rounded-xl p-3">
        <p className="text-xs font-bold text-[#030213]">{e.subject}</p>
        <p className="text-[11px] text-[#717182] mt-0.5">{e.fromName} &lt;{e.fromEmail}&gt;</p>
        <p className="text-[11px] text-[#717182] flex items-center gap-1"><Forward className="w-3 h-3" /> Received {portalDateTime(e.at)} · forwarded by {e.forwardedBy}</p>
        <p className={`text-xs text-[#030213] whitespace-pre-wrap leading-relaxed mt-2 pt-2 border-t border-[#F0EFF6] ${compact ? 'max-h-48 overflow-y-auto' : ''}`}>{e.body.trim()}</p>
      </div>
      {e.files.length > 0 && <FileList files={e.files} title={`Attachments (${e.files.length})`} />}
      <div className="rounded-xl border border-[#EDE9FE] bg-[#F5F3FF] px-3 py-2">
        <p className="text-[10px] font-bold text-[#6D28D9] uppercase tracking-wider flex items-center gap-1 mb-1"><Sparkles className="w-3 h-3" /> Read from the email</p>
        <p className="text-[11px] text-[#030213] leading-relaxed">
          {[['Patient', r.patientName], ['Practice', r.practice], ['Service', r.service], ['Teeth', r.teeth.join(', ')], ['Shade', r.shade], ['Material', r.material], ['Order type', r.orderType], ['Needed by', r.delivery], ['Reference', r.reference]]
            .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Nothing could be read; fill the form in from the email.'}
        </p>
        {clinic?.picked && <p className="text-[11px] text-[#047857] mt-1">Clinic set to {clinic.picked}.</p>}
        {clinic && !clinic.picked && clinic.candidates.length > 0 && <p className="text-[11px] text-[#B45309] mt-1">Pick the clinic: {clinic.candidates.join(', ')} match "{r.practice}".</p>}
      </div>
    </div>
  );
}

export default function EmailSourcePane({ caseId }: { caseId: string }) {
  useForwardedEmails();
  const e = emailForDraft(caseId);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [pill, setPill] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!e) return;
    const sync = () => {
      setPane(p => { const n = findPane(); return p === n ? p : n; });
      setPill(p => { const n = findPill(); return p === n ? p : n; });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => mo.disconnect();
  }, [e?.id]);

  // Carry the practice read from the email into QuickCreate's clinic picker (once).
  const [picked, setPicked] = useState<ClinicPick | null>(null);
  useEffect(() => {
    if (!pane || !e || picked !== null) return;
    const r = readEmail(e);
    const t = window.setTimeout(() => { setOrderType(r.orderType); pickClinic(r.practice).then(setPicked); }, 700);
    return () => window.clearTimeout(t);
  }, [pane, e?.id, picked]);

  useEffect(() => {
    if (!pane) return;
    pane.setAttribute('data-sf-intake-pane', 'on');
    return () => pane.removeAttribute('data-sf-intake-pane');
  }, [pane]);
  useEffect(() => {
    if (!pill) return;
    pill.setAttribute('data-sf-intake-pill', 'on');
    return () => pill.removeAttribute('data-sf-intake-pill');
  }, [pill]);

  if (!e) return null;
  return (
    <>
      {pane && createPortal(
        <div className="sf-intake-pane flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center"><Mail className="w-3.5 h-3.5 text-[#1565C0]" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider leading-tight">Source: forwarded email</p>
              <p className="text-[10px] text-[#717182] leading-tight truncate">{e.id} · from {e.fromName}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <EmailCard e={e} clinic={picked} />
            <p className="text-[10px] text-[#A0A0B0] text-center px-2">The form on the right is filled in from this email. Check each field against it, then create the case.</p>
          </div>
        </div>,
        pane,
      )}
      {pill && pill.parentElement && createPortal(
        <span className="sf-intake-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-[#1565C0] border border-[#DBEAFE]"><Mail className="w-3 h-3" /> Email draft</span>,
        pill.parentElement,
      )}
    </>
  );
}
