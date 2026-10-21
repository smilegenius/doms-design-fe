import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Image as ImageIcon, Printer } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { getIntakeConfig } from '../intake-form/intakeStore';
import { casesFor } from './BulkDialogs';
import { printPages, SgOrderFormPrint } from './printForms';

// ── The lab-branded Smile Genius order form for one case, on screen ──────────
// /growth/order-form/:caseId. The same form Bulk Actions prints and downloads:
// lab logo top left, lab name top right (Settings → LabLink), a small Smile
// Genius mark at the bottom. Shown as a sheet of paper, with Print.

export default function OrderFormPreview({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const c = casesFor([caseId])[0];
  const cfg = getIntakeConfig();
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white text-[#030213] hover:bg-[#F8F9FC]';

  if (!c) return <div className="p-8 text-sm text-[#717182]">Case {caseId} not found.</div>;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
          <h1 className="text-xl font-semibold text-[#030213] mt-1">Order form · {c.id}</h1>
          <p className="text-xs text-[#717182]">{c.patientName} · {c.practice}. Branded with {cfg.logo ? 'your lab logo' : 'your lab initials (no logo uploaded yet)'} and name from Settings → LabLink.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!cfg.logo && <button className={btn} onClick={() => navigate('/growth/settings?tab=intake-form')}><ImageIcon className="w-3.5 h-3.5" /> Upload the lab logo</button>}
          <button className={btn} onClick={() => navigate(`/growth/cases/${encodeURIComponent(c.id)}`)}><ExternalLink className="w-3.5 h-3.5" /> Open the case</button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF]" onClick={() => { if (!printPages([{ key: c.id, node: <SgOrderFormPrint c={c} /> }], `${c.id} order form`)) toast.error('Allow pop-ups to print'); }}><Printer className="w-3.5 h-3.5" /> Print</button>
        </div>
      </div>
      <div className="bg-[#EEF0F4] rounded-xl p-4 sm:p-8 overflow-x-auto">
        <div className="mx-auto bg-white shadow-md rounded-sm p-8 sm:p-10 w-full max-w-[794px] min-h-[1000px]">
          <SgOrderFormPrint c={c} />
        </div>
      </div>
    </div>
  );
}
