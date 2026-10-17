import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import Button from '../../src/app/components/Button';
import { useToast } from '../../src/app/context/ToastContext';
import { EmailDetail } from './EmailTriagePage';
import { emailForDraft, useForwardedEmails } from './emailStore';

// ── Opening an email draft from Cases ────────────────────────────────────────
// In place of QuickCreate (like Match files for LabLink): the email, what was
// read from it, and the choice between a new case and an existing one.

export default function EmailDraftPage({ draftId }: { draftId: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  useForwardedEmails();
  const e = emailForDraft(draftId);
  if (!e) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[#F8F9FC]">
        <p className="text-sm text-[#717182]">This email draft isn't waiting any more.</p>
        <Button variant="outline" onClick={() => navigate('/growth/cases')}>Back to Cases</Button>
      </div>
    );
  }
  return (
    <div className="h-screen flex flex-col bg-[#F8F9FC]">
      <header className="h-14 flex-shrink-0 bg-white border-b border-[#E0E0E6] px-4 flex items-center gap-3">
        <button onClick={() => navigate('/growth/cases')} className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-4 h-4" /> Back to Cases</button>
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <h1 className="text-base font-semibold text-[#030213]">Email draft</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F3F3F5] text-[#5A5568] border border-[#E0E0E6]"><Mail className="w-3 h-3" /> {e.id} · forwarded by {e.forwardedBy}</span>
        </div>
        <button onClick={() => navigate('/growth/cases/emails')} className="text-xs font-medium text-[#4D8EF7] hover:underline w-28 text-right">All email drafts</button>
      </header>
      <div className="flex-1 min-h-0 flex">
        <EmailDetail e={e} onDone={(msg, to) => { toast.success(msg); navigate(to ?? '/growth/cases'); }} />
      </div>
    </div>
  );
}
