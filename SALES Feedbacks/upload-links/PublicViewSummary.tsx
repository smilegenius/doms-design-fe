import type { ReactNode } from 'react';
import { ToothChips } from '../design-studio/markup/FdiPicker';
import type { PublicCaseView } from './uploadStore';

/** What the clinic will see. Rendered from the same allow-listed snapshot the public page uses. */
export default function PublicViewSummary({ view }: { view: PublicCaseView }) {
  const row = (k: string, v: ReactNode) => (
    <div className="flex items-start gap-3 py-1"><span className="w-24 flex-shrink-0 text-[11px] text-[#717182]">{k}</span><span className="text-xs text-[#030213] min-w-0">{v}</span></div>
  );
  return (
    <div>
      {row('Case ref', <span className="font-mono">{view.caseRef}</span>)}
      {row('Patient', <span className="font-semibold">{view.patientInitials}</span>)}
      {row('Practice', view.practice)}
      {row('Dentist', view.dentist)}
      {row('Service', view.service)}
      {view.teeth.length > 0 && row('Teeth', <span className="flex flex-wrap gap-1"><ToothChips teeth={view.teeth} /></span>)}
    </div>
  );
}
