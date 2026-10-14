import { useState } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import SideDrawer from '../../src/app/components/SideDrawer';
import { FileList } from '../design-studio/components/FileChips';
import { portalDateTime } from '../lab-prescription-inbox/data';
import { useIntake } from './intakeStore';

/**
 * Sits over the (unchanged) QuickCreate draft screen for website-form drafts,
 * like RxPhotoDock does for inbox drafts: who sent it, and the files they
 * attached to the form.
 */
export default function IntakeFilesDock({ caseId }: { caseId: string }) {
  const { submissions } = useIntake();
  const sub = submissions.find(s => s.caseId === caseId);
  const [open, setOpen] = useState(false);
  if (!sub) return null;
  const n = sub.files.length;

  return (
    <>
      <div className="fixed left-4 bottom-20 z-[60] rounded-xl border border-[#DBEAFE] bg-[#EEF4FF] shadow-lg pl-2.5 pr-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0"><Globe className="w-4 h-4 text-[#4D8EF7]" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#1565C0]">From your website · {sub.ref}</p>
            <p className="text-[10px] text-[#3B6BAE]">{sub.dentist} · {n ? `${n} file${n === 1 ? '' : 's'}` : 'no files'}{sub.knownPractice ? '' : ' · new practice'}</p>
          </div>
          <button onClick={() => setOpen(true)} className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity">
            View <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      <SideDrawer open={open} onClose={() => setOpen(false)} title={`Website request ${sub.ref}`} subtitle={`Received ${portalDateTime(sub.at)}`} icon={<Globe className="w-4 h-4 text-[#4D8EF7]" />}>
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E0E0E6] p-4 space-y-1.5 text-sm">
            {[
              ['Dentist', `${sub.dentist} · GDC ${sub.gdc || '—'}`],
              ['Practice', `${sub.practice}${sub.postcode ? `, ${sub.postcode}` : ''}`],
              ['Contact', `${sub.email} · ${sub.phone}`],
              ['Service', sub.service],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3"><span className="w-20 flex-shrink-0 text-xs text-[#717182] pt-0.5">{k}</span><span className="text-[#030213] min-w-0">{v}</span></div>
            ))}
            {!sub.knownPractice && (
              <p className="text-xs text-[#B45309] bg-[#FFF8E1] border border-[#FDE68A] rounded-lg px-3 py-2 mt-2">This practice isn't linked to your account yet. Check the details before you confirm the case.</p>
            )}
          </div>
          {n ? <FileList files={sub.files} title="Files attached to the form" /> : <p className="text-xs text-[#717182]">The dentist didn't attach any files.</p>}
        </div>
      </SideDrawer>
    </>
  );
}
