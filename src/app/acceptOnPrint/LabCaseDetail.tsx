// ─── Accept case on print · Case Details ─────────────────────────────────────
// A flow case in the portal's own Case Details (pages/CaseDetailPage), as the
// lab sees it. The page's Print buttons (Order form tab, Full View) go through
// the accept prompt via OrderFormSlot, and the lab's statuses (Received,
// Accepted…) show through CaseStatusSlot. Nothing here touches the portal's
// Cases; the portal page itself is unchanged when no host sets those slots.

import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CaseDetailPage, { CaseStatusSlot, OrderFormSlot, type CaseForDetail, type CaseStatusHost } from '../pages/CaseDetailPage';
import { useToast } from '../context/ToastContext';
import AcceptCasePrompt, { useOrderFormPrint } from './AcceptCasePrompt';
import LabFrame, { WALKTHROUGH_PATH } from './LabFrame';
import { LOOK, LabStatusControl, TO_PORTAL, statusSteps } from './labStatus';
import { LAB_NAME, setLabStatus, useLabCases, type LabCase, type LabStatus } from './store';

/** A flow case as the portal's Case Details takes it. A posted case says "Sent via Post" without the clinic's
 *  print-and-post banner (that is source 'post', which is the clinic's instruction). */
export function toDetail(c: LabCase): CaseForDetail {
  const status = TO_PORTAL[c.status];
  return {
    id: c.id,
    patientName: c.patientName,
    patientAge: c.patientAge,
    patientGender: c.patientGender,
    practice: c.practice,
    dentist: c.dentist,
    lab: LAB_NAME,
    services: [c.service],
    serviceItems: [{
      id: `${c.id}-s1`, name: c.service, status, deliveryDate: c.requestedDelivery,
      fdi: c.fdi, material: c.material, shade: c.shade, orderType: c.orderType, instructions: c.instructions,
      scanFileCount: c.scanFileCount, attachmentCount: 0,
    }],
    status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    requestedDelivery: c.requestedDelivery,
    hasAlert: false,
    source: c.via.kind === 'post' ? 'manual' : c.via.kind,
    scanner: c.via.kind === 'scanner' ? c.via.scanner : undefined,
    receivedVia: c.via.kind === 'post' ? 'Sent via Post' : undefined,
    createdBySide: 'clinic',
  };
}

export default function LabCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cases = useLabCases();
  const c = cases.find(x => x.id === id);
  const { print, dialog } = useOrderFormPrint();
  const [holding, setHolding] = useState(false);
  // ?print=1 (a walkthrough scenario): the case opens as if its Print had just been pressed. The flag is dropped
  // from the URL straight away, so a reload shows the case without the popup.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!c || params.get('print') !== '1') return;
    print(c.id);
    setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <Navigate to={WALKTHROUGH_PATH} replace />;

  const pick = (s: LabStatus) => {
    // On Hold always says what's missing; the rest apply at once.
    if (s === 'On Hold') { setHolding(true); return; }
    setLabStatus(c.id, s);
    toast.success(`${c.id} moved to ${LOOK[s].label}.`);
  };
  const statusHost: CaseStatusHost = {
    control: <LabStatusControl c={c} onPick={pick} />,
    look: LOOK[c.status],
    steps: statusSteps(c),
  };

  return (
    <LabFrame>
      <CaseStatusSlot.Provider value={statusHost}>
        <OrderFormSlot.Provider value={{ onPrint: () => print(c.id) }}>
          <CaseDetailPage
            key={c.id}
            caseData={toDetail(c)}
            onBack={() => navigate(WALKTHROUGH_PATH)}
            viewerPortal="lab"
            listLabel="walkthrough"
            canMarkReceived={false}
          />
        </OrderFormSlot.Provider>
      </CaseStatusSlot.Provider>
      {dialog}
      {holding && <AcceptCasePrompt c={c} start="missing" onClose={() => setHolding(false)} />}
    </LabFrame>
  );
}
