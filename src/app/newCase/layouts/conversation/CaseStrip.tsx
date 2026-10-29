// ─── Experience B · Conversation · case strip ────────────────────────────────
// One slim sticky line: who it's for, which lab, Back by,
// then the case ID, save state, ⋯ and Close. Patient and lab
// jump to their question while the case can be edited.

import { ReactNode } from 'react';
import { useCase } from '../../CaseContext';
import { fmtDay } from '../../dates';
import { patientAge, plural } from '../../rules';
import { SourceTag, FOCUS } from '../../ui';
import { CaseIdBadge, CaseMenu, CloseButton, SaveIndicator } from '../CaseHeader';

export default function CaseStrip() {
  const { patient, lab, draft, ctx, dates, readOnly, go } = useCase();
  const funding = draft.funding === 'nhs' ? 'NHS' : 'Private';
  // A day the clinic asked for is fixed: only a lab's lead time counts from the scan.
  const back = dates.route === 'follow' && dates.ta != null && !dates.fixed
    ? `Back ${plural(dates.ta, 'working day')} after the scan`
    : dates.backBy ? `Back by ${fmtDay(dates.backBy)}` : '';
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E0E0E6]">
      <div className="h-[52px] px-6 flex items-center gap-4">
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <StripItem onClick={readOnly ? undefined : () => go('patient')} change="Change patient">
            <span className="w-6 h-6 rounded-full bg-[#EEF4FF] text-[#1E40AF] text-[10px] font-bold flex items-center justify-center flex-shrink-0" aria-hidden>
              {patient.first[0]}{patient.last[0]}
            </span>
            <span className="text-sm font-semibold text-[#030213] truncate">{patient.first} {patient.last}</span>
            <span className="text-xs text-[#5A5A6A] whitespace-nowrap">· {patientAge(patient, ctx.now)} · {funding}</span>
          </StripItem>
          <Sep />
          <StripItem onClick={readOnly ? undefined : () => go('lab')} change="Change lab" title={`${lab.name} · ${draft.labSrc}`}>
            {draft.labPicked !== false && <span className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${lab.avatar}`} aria-hidden>{lab.initials}</span>}
            <span className="text-sm font-medium text-[#030213] truncate">{draft.labPicked === false ? 'Choose a lab' : lab.name}</span>
            {/* Room for the tag from 1400 px; below that it's in the tooltip so the strip stays one line. */}
            {draft.labPicked !== false && <span className="hidden min-[1400px]:inline-flex"><SourceTag src={draft.labSrc} /></span>}
          </StripItem>
          {draft.items.length > 0 && back && (
            <>
              <Sep />
              <p className="px-2 text-sm font-medium text-[#030213] whitespace-nowrap">{back}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CaseIdBadge />
          <SaveIndicator />
          <CaseMenu />
          <CloseButton />
        </div>
      </div>
    </div>
  );
}

function StripItem({ children, onClick, change, title }: { children: ReactNode; onClick?: () => void; change: string; title?: string }) {
  const cls = 'min-w-0 flex items-center gap-2 px-2 py-1 rounded-lg';
  if (!onClick) return <div className={cls} title={title}>{children}</div>;
  return (
    <button type="button" onClick={onClick} title={title} className={`${cls} hover:bg-[#F0EFF6] transition-colors ${FOCUS}`}>
      {children}
      <span className="sr-only">. {change}</span>
    </button>
  );
}

const Sep = () => <span className="w-px h-5 bg-[#E0E0E6] flex-shrink-0" aria-hidden />;
