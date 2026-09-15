import { useEffect, useRef, useState } from 'react';
import { Plug } from 'lucide-react';
import type { CaseLike } from '../../data/carestack';
import { revalidateCase, summaryLabel, useCaseCareStack, useCareStackEnabled } from '../../data/carestack';
import SideDrawer from '../SideDrawer';
import { CS_CURRENT_USER } from './shared';
import CareStackAppointmentCell from './CareStackAppointmentCell';
import CareStackCaseSection from './CareStackCaseSection';
import AddAppointmentModal from './AddAppointmentModal';
import AppointmentNotRequiredModal from './AppointmentNotRequiredModal';

// ─── CareStack row on the case creation form ─────────────────────────────────
// Same shape as the case page: one compact row above Services with the
// "CareStack Appointment · state" button (opens the full mapping / appointment
// / sync-log drawer) and the appointment control (Choose → Link Appointment /
// Not Required, or the Linked chip). Validation re-runs as the patient,
// dentist or practice fields change.

export default function CareStackDraftPanel({ caseLike, currentUser = CS_CURRENT_USER }: { caseLike: CaseLike; currentUser?: string }) {
  const enabled = useCareStackEnabled();
  const rec = useCaseCareStack(caseLike.id);
  const [action, setAction] = useState<'link' | 'not-required' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounced re-validation whenever the identifying fields change.
  const key = `${caseLike.patientName}|${caseLike.dentist}|${caseLike.practice}`;
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !caseLike.patientName.trim()) return;
    if (lastKey.current === key) return;
    const t = window.setTimeout(() => { lastKey.current = key; revalidateCase(caseLike); }, 600);
    return () => window.clearTimeout(t);
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null;

  return (
    <div className="inline-flex items-center">
      {/* The cases-list appointment control, sized like the case-source
          picker it sits next to: Choose ▾ / Linked · date / status. */}
      <CareStackAppointmentCell
        size="button"
        caseId={caseLike.id}
        onLink={() => setAction('link')}
        onNotRequired={() => setAction('not-required')}
        onOpenDetails={() => setDrawerOpen(true)}
      />

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="CareStack Appointment"
        subtitle={`${caseLike.id} · ${summaryLabel(rec)} · enabled by Smile Genius Group`}
        icon={<Plug className="w-4 h-4 text-[#0F766E]" />}
        iconBg="bg-[#ECFEFF]"
      >
        <CareStackCaseSection variant="drawer" caseData={caseLike} currentUser={currentUser} />
      </SideDrawer>

      {action === 'link' && rec && (
        <AddAppointmentModal caseData={caseLike} record={rec} onClose={() => setAction(null)} currentUser={currentUser} />
      )}
      {action === 'not-required' && (
        <AppointmentNotRequiredModal caseData={caseLike} onClose={() => setAction(null)} currentUser={currentUser} />
      )}
    </div>
  );
}
