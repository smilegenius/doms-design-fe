import { useState } from 'react';
import { Mail, Printer } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { getCreatedCases } from '../../src/app/data/createdCases';
import { printPages } from '../bulk-actions/printForms';
import { originalForms } from '../bulk-actions/caseContent';
import OrderPanelTab from '../intake-form/OrderPanelTab';
import { EmailCard } from './EmailSourcePane';
import { emailBehind, useForwardedEmails } from './emailStore';

// ── "Email" tab, next to the Smile Genius order form ─────────────────────────
// On a case made from a forwarded email: the original email and attachments.

export const pendingEmailTab = { value: false };

export default function CaseEmailTab({ caseId }: { caseId: string }) {
  useForwardedEmails();
  const { toast } = useToast();
  const e = emailBehind(caseId);
  const [open] = useState(() => { const v = new URLSearchParams(window.location.search).get('sf') === 'email' || pendingEmailTab.value; pendingEmailTab.value = false; return v; });
  if (!e || e.status !== 'case') return null;
  return (
    <OrderPanelTab tabKey="email" label="Email" icon={<Mail className="w-3.5 h-3.5" />} openOnLoad={open}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#717182]">The email this case was made from ({e.id}){e.actedBy ? ` · case created by ${e.actedBy}` : ''}</p>
        <button
          onClick={() => {
            const c = getCreatedCases().find(x => x.id === caseId);
            const page = c ? originalForms(c).find(o => o.label === 'Original email') : undefined;
            if (!page || !printPages([{ key: e.id, node: page.node }], `Email ${e.id}`)) toast.error('Allow pop-ups to print');
          }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:underline flex-shrink-0"
        >
          <Printer className="w-3 h-3" /> Print this email
        </button>
      </div>
      <EmailCard e={e} />
    </OrderPanelTab>
  );
}
