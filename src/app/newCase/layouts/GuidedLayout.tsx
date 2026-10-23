// ─── Experience A · Guided steps ─────────────────────────────────────────────
// Two columns and a footer. Left: the case's corner (← Back to Lab Work, case
// ID, ⋯) above the step timeline. Right: the one question being asked, with
// the round ← back and → next arrows in the card's top corners. Below: Save as
// draft and the one button that finishes the case (Ready for Dispatch / Create
// Case). No page header and no right rail: the timeline shows every value.
// The step card is frosted glass over soft brand-tinted light (new-case-guided.css).

import { useState } from 'react';
import { useCase } from '../CaseContext';
import { useController } from '../controller';
import { parseStep } from '../rules';
import { PatientStep, LabStep, RecordsStep, PrescriberStep, DeliveryStep } from '../CaseSteps';
import { ServicesStep } from '../ServiceSteps';
import ServiceAccordion from './guided/ServiceAccordion';
import { ReviewStep } from '../ReviewStep';
import { Timeline, BottomBar, StepArrows } from '../Shell';
import { FooterArrowProvider } from '../footerArrow';
import { HeadingSlotContext } from '../ui';
import { RoomProvider } from '../room';
import { CaseBanners, CaseCorner } from './CaseHeader';
import '../../../styles/new-case-guided.css';

/** The current step's screen (heading receives focus on every step change). */
export function StepBody() {
  const { step, draft } = useCase();
  const { headingRef } = useController();
  const parsed = parseStep(step);
  const item = parsed.itemId ? draft.items.find(i => i.id === parsed.itemId) : undefined;
  switch (parsed.kind) {
    case 'patient': return <PatientStep ref={headingRef} />;
    case 'lab': return <LabStep ref={headingRef} />;
    case 'services': return <ServicesStep ref={headingRef} />;
    // Keyed by step so editor state (a teeth message, open shade rows) never carries to another service.
    // A service shows as one card: every item it asks for as an accordion, the current one open.
    case 'slot': return item ? <ServiceAccordion key={item.id} item={item} slotId={parsed.slot!} /> : null;
    case 'records': return <RecordsStep ref={headingRef} />;
    case 'prescriber': return <PrescriberStep ref={headingRef} />;
    case 'delivery': return <DeliveryStep ref={headingRef} />;
    case 'review': return <ReviewStep ref={headingRef} />;
  }
}

export default function GuidedLayout() {
  const c = useController();
  const api = useCase();
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  return (
    // The footer's arrow is the one way on: steps hand it their "that's it".
    // The step card is wide, so steps draw their fuller versions.
    <FooterArrowProvider value={true}>
      <RoomProvider value="wide">
        {/* .nc-guided: one notch smaller type, so a step fits a short window without scrolling. */}
        <div className="nc-guided nc-guided-light min-w-[900px] min-h-[calc(100vh-56px)] flex flex-col">
          <div className="flex-1 grid grid-cols-[210px_minmax(560px,1fr)] gap-5 px-6 pt-5 pb-6 items-start">
            <div className="sticky top-4">
              <CaseCorner />
              <Timeline />
            </div>
            <div className="min-w-0 w-full max-w-[960px]">
              <CaseBanners className="mb-4 space-y-2" />
              <main className="nc-glass rounded-2xl px-6 pt-5 pb-6">
                {/* Read-only (sent, or waiting for approval): a step shows its answers, its controls can't be used. */}
                {/* ← back and → next sit in the card's top corners; the footer only finishes the case. */}
                <StepArrows onSlot={setTitleSlot} />
                <fieldset disabled={api.readOnly && api.step !== 'review'} className="min-w-0 m-0 p-0 border-0">
                  {/* Each step's title sits small between the arrows, not above the step. */}
                  <HeadingSlotContext.Provider value={titleSlot}>
                    <StepBody />
                  </HeadingSlotContext.Provider>
                </fieldset>
              </main>
            </div>
          </div>
          <BottomBar onSave={() => c.saveAndClose(true)} onSend={() => c.send()} sending={c.sending} />
        </div>
      </RoomProvider>
    </FooterArrowProvider>
  );
}
