import { CloudOff } from 'lucide-react';

// ─── Offline labs (Low Potential / Non-participating) ────────────────────────
// Labs the clinic works with that live OUTSIDE Smile Genius. 'low_potential'
// labs may be onboarded one day; 'non_participating' labs never will be.
// Either way the platform never reaches the lab: the order form goes out by
// email/print, status updates are owned by the clinic, and in-app messaging
// is off. Shared between the create-case flow and the case detail page so
// both surfaces tell the same story.

export type OfflineLabStatus = 'low_potential' | 'non_participating';

export interface OfflineLab {
  id: string;
  name: string;
  country?: string;
  categories?: string[];
  initials?: string;
  avatarColor?: string;
  platformStatus: OfflineLabStatus;
}

// Demo records — appear in the clinic portal's lab picker (flagged with an
// "Offline" pill) and drive the offline notice on any case that names them.
export const OFFLINE_LABS: OfflineLab[] = [
  {
    id: 'offline-lab-1', name: 'Harbour Dental Ceramics', country: 'IE',
    categories: ['Crown & Bridge', 'Ceramics'], initials: 'HD',
    avatarColor: 'bg-[#FFF7ED] text-[#C2410C]', platformStatus: 'low_potential',
  },
  {
    id: 'offline-lab-2', name: 'Westport Denture Works', country: 'IE',
    categories: ['Dentures', 'Acrylics'], initials: 'WD',
    avatarColor: 'bg-[#F3F4F6] text-[#4B5563]', platformStatus: 'non_participating',
  },
];

// Case records only carry the lab NAME, so the detail page resolves offline
// status by name lookup.
export function offlineLabStatusFor(labName?: string): OfflineLabStatus | undefined {
  if (!labName) return undefined;
  return OFFLINE_LABS.find(l => l.name === labName)?.platformStatus;
}

// ─── The notice ──────────────────────────────────────────────────────────────
// Two variants, one card style:
//   'compact'  — slim one-liner + crisp fragments; stickied atop the create-
//                case form while the clinic fills the rest in.
//   'detailed' — the Case Details banner (clinic users only). Copy comes from
//                the PM ticket verbatim for Non-Participating labs; the Low
//                Potential wording mirrors it with "not yet onboarded".
export function OfflineLabNotice({ labName, status, variant = 'compact', className = '' }: {
  labName: string;
  status: OfflineLabStatus;
  variant?: 'compact' | 'detailed';
  className?: string;
}) {
  const nonPart = status === 'non_participating';
  if (variant === 'detailed') {
    return (
      <div className={`rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 shadow-[0_4px_14px_rgba(180,83,9,0.10)] ${className}`}>
        <div className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center flex-shrink-0 mt-0.5">
            <CloudOff className="w-3.5 h-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#92400E]">
              {nonPart ? 'Non-Participating Lab' : 'Low Potential Lab'}
              <span className="font-medium text-[#A16207]"> · {labName}</span>
            </p>
            <p className="text-[11px] text-[#A16207] leading-relaxed mt-0.5">
              {nonPart
                ? 'This case has been assigned to a Non-Participating Lab. As this lab does not use Smile Genius, case status updates and notifications will not be available through the platform. Please contact the lab directly for the latest progress on your case.'
                : 'This case has been assigned to a Low Potential Lab. As this lab is not yet onboarded on Smile Genius, case status updates and notifications will not be available through the platform. Please contact the lab directly for the latest progress on your case.'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 shadow-[0_4px_14px_rgba(180,83,9,0.10)] ${className}`}>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <span className="w-6 h-6 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center flex-shrink-0">
          <CloudOff className="w-3.5 h-3.5" />
        </span>
        <p className="text-xs font-bold text-[#92400E] flex-shrink-0">
          {labName} {nonPart ? "doesn't use" : "isn't on"} Smile Genius
          <span className="font-medium text-[#A16207]"> — this case runs offline.</span>
        </p>
        <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] font-medium text-[#A16207]">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#F59E0B] flex-shrink-0" />
            Email or print the order form yourself
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#F59E0B] flex-shrink-0" />
            You update the status — the lab can't
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#F59E0B] flex-shrink-0" />
            No case messaging or lab alerts
          </span>
        </div>
      </div>
    </div>
  );
}
