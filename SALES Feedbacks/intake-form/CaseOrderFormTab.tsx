import { useState } from 'react';
import { Globe, Printer } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { printPages } from '../bulk-actions/printForms';
import IntakeOrderForm from './IntakeOrderForm';
import { withOrder } from './IntakeFilesDock';
import { useIntake } from './intakeStore';
import OrderPanelTab from './OrderPanelTab';

// ── "LabLink form" tab, next to the Smile Genius order form ──────────────────
// On a case confirmed from LabLink: the form the dentist submitted.

/** Set before a deep link clicks through the Cases list (?sf=order is lost on the way). */
export const pendingOrderTab = { value: false };

export default function CaseOrderFormTab({ caseId }: { caseId: string }) {
  const { submissions, config } = useIntake();
  const { toast } = useToast();
  const sub = submissions.find(s => s.confirmedCaseId === caseId);
  // Read the deep link once, when the case opens.
  const [open] = useState(() => { const v = new URLSearchParams(window.location.search).get('sf') === 'order' || pendingOrderTab.value; pendingOrderTab.value = false; return v; });
  if (!sub) return null;
  const full = withOrder(sub);
  return (
    <OrderPanelTab tabKey="lablink" label="LabLink form" icon={<Globe className="w-3.5 h-3.5" />} openOnLoad={open}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#717182]">What {sub.dentist} submitted on LabLink ({sub.ref}){sub.confirmedBy ? ` · confirmed by ${sub.confirmedBy}` : ''}</p>
        <button
          onClick={() => { if (!printPages([{ key: sub.ref, node: <IntakeOrderForm sub={full} config={config} print /> }], `LabLink form ${sub.ref}`)) toast.error('Allow pop-ups to print'); }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4D8EF7] hover:underline flex-shrink-0"
        >
          <Printer className="w-3 h-3" /> Print this form
        </button>
      </div>
      <IntakeOrderForm sub={full} config={config} />
    </OrderPanelTab>
  );
}
