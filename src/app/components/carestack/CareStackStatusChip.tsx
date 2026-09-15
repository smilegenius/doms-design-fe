import { Loader2 } from 'lucide-react';
import { SUMMARY_META, summariseCase, useCaseCareStack } from '../../data/carestack';

// Listing chip — one glance at where the case sits with CareStack.
export default function CareStackStatusChip({ caseId }: { caseId: string }) {
  const rec = useCaseCareStack(caseId);
  const summary = summariseCase(rec);
  const meta = SUMMARY_META[summary];
  const busy = summary === 'checking' || summary === 'searching';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${meta.cls}`}>
      {busy && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {meta.label}
    </span>
  );
}
