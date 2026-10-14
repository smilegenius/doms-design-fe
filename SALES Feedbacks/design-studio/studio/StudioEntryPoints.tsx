import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box } from 'lucide-react';
import { DEMO_CASE_IDS, STUDIO_SERVICES } from '../data/designStudio';
import { latestVersion, useStudio } from '../store/studioStore';

// Entry points into Design Studio from the (unchanged) lab Cases page.

const STATUS_COPY = {
  'awaiting-review': 'awaiting review',
  'changes-requested': 'changes requested',
  'approved': 'approved',
  'superseded': 'superseded',
} as const;

/** Compact notice above the Cases list, same shape as the inbox bar. */
export function DesignStudioBar() {
  const navigate = useNavigate();
  const { cases } = useStudio();
  const list = Object.values(cases).filter(c => c.versions.length > 0);
  const out = list.filter(c => latestVersion(c)?.status === 'awaiting-review').length;
  const changes = list.filter(c => latestVersion(c)?.status === 'changes-requested').length;
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 -mb-2 sm:-mb-3 lg:-mb-4">
      <div className="rounded-xl border border-[#E0E0E6] bg-white px-4 py-2.5 flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
            <Box className="w-3.5 h-3.5 text-white" />
          </span>
          <p className="text-[11px] text-[#717182] leading-relaxed">
            <span className="font-bold text-[#030213]">Design Studio.</span>{' '}
            {out} design{out === 1 ? '' : 's'} out for review{changes ? ` · ${changes} with changes requested` : ''}. Dentists review and sign off from a secure link — no login.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {list.filter(c => DEMO_CASE_IDS.includes(c.caseId)).map(c => (
            <button
              key={c.caseId}
              onClick={() => navigate(`/growth/cases/${c.caseId}/studio?demo=1`)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#030213] border border-[#E0E0E6] hover:bg-[#F8F9FC]"
            >
              {c.caseId} · {c.patientName}
              <span className="px-1.5 py-px rounded-full bg-[#FFF8E1] text-[#B45309] text-[9px] font-bold">Demo</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Dock over the real case detail for Studio-enabled cases. */
export function StudioCaseDock({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const { cases } = useStudio();
  const c = cases[caseId];
  if (!c || !STUDIO_SERVICES.includes(c.service)) return null;
  const v = latestVersion(c);
  if (!v) return null;
  return (
    <div className="fixed right-6 bottom-6 z-[60] rounded-xl border border-[#E0E0E6] bg-white shadow-lg pl-2 pr-2 py-2 flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center">
        <Box className="w-4 h-4 text-white" />
      </span>
      <div>
        <p className="text-xs font-semibold text-[#030213]">Design Studio</p>
        <p className="text-[11px] text-[#717182]">V{v.number} {STATUS_COPY[v.status]}</p>
      </div>
      <button
        onClick={() => navigate(`/growth/cases/${caseId}/studio`)}
        className="ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90"
      >
        Open <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
