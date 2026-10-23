// ─── Experience B · Conversation · the current question ──────────────────────
// One large card, asked by Smile Genius (its mark sits beside the card, like a
// chat avatar, so the question keeps the card's full height). Its body reuses
// the same step screens and slot editors as every other experience, so
// behaviour is identical; only the frame is different. A slot question shows
// the defaults it builds on (so Layered zirconia can be picked on the shade
// question) above its editor.

import { forwardRef } from 'react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { PRODUCTS, ServiceItem, SlotId, itemTitle, parseStep, slotGaps, slotStepId, slotsFor } from '../../rules';
import { PatientStep, LabStep, RecordsStep, PrescriberStep, DeliveryStep } from '../../CaseSteps';
import { NoteView, ServicesStep, SlotEditor, questionFor } from '../../ServiceSteps';
import { ServiceNote } from '../../Instructions';
import { ReviewStep } from '../../ReviewStep';
import { DefaultsPanel, LinkButton, SourceTag } from '../../ui';
import { PANEL_SLOTS, defaultsLead, isUsual } from './model';
import { SgLogo } from './bits';

const QuestionCard = forwardRef<HTMLElement>(function QuestionCard(_, ref) {
  const { readOnly } = useCase();
  return (
    <section
      ref={ref}
      aria-label={readOnly ? 'Case details' : 'Current question'}
      className="relative scroll-mt-[104px] rounded-3xl bg-white border border-[#E0E0E6] shadow-[0_18px_48px_-24px_rgba(23,23,64,0.30)]"
    >
      <SgLogo size={36} className="absolute -left-[52px] top-6" />
      {/* The reused screens carry their own heading; in this card it reads as the question. */}
      <div className="px-7 pt-7 pb-7 [&_h2]:text-[22px] [&_h2]:leading-snug [&_h2]:scroll-mt-[128px]">
        <CardBody />
      </div>
    </section>
  );
});
export default QuestionCard;

function CardBody() {
  const { step, draft } = useCase();
  const { headingRef } = useController();
  const parsed = parseStep(step);
  const item = parsed.itemId ? draft.items.find(i => i.id === parsed.itemId) : undefined;
  switch (parsed.kind) {
    case 'patient': return <PatientStep ref={headingRef} />;
    case 'lab': return <LabStep ref={headingRef} />;
    case 'services': return <ServicesStep ref={headingRef} />;
    // Keyed by step: each slot question mounts fresh editor state (no message carried to another service).
    case 'slot': return item && parsed.slot ? <SlotQuestion key={step} ref={headingRef} item={item} slotId={parsed.slot} /> : null;
    case 'records': return <RecordsStep ref={headingRef} />;
    case 'prescriber': return <PrescriberStep ref={headingRef} />;
    case 'delivery': return <DeliveryStep ref={headingRef} />;
    case 'review': return <ReviewStep ref={headingRef} />;
  }
  return null;
}

/** One slot of a service as a question: defaults it builds on, then its editor and notes. */
const SlotQuestion = forwardRef<HTMLHeadingElement, { item: ServiceItem; slotId: SlotId }>(function SlotQuestion({ item, slotId }, ref) {
  const { ctx, user, lab, notes, dismissNote, readOnly, removeItem, go } = useCase();
  const n = user.notation;
  const slots = slotsFor(item, ctx);
  const idx = slots.findIndex(s => s.id === slotId);
  const slot = slots[idx];
  if (!slot) return null;
  const gap = slot.required && !slot.answered;
  const label = PRODUCTS[item.product].label;
  const kicker = slotGaps(slots).length ? `Adding ${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}` : itemTitle(item, n);
  // A service just picked and not yet answered: a quiet way out if it was the wrong tile.
  const justPicked = !readOnly && idx === 0 && gap;
  const panel = slots.slice(0, idx).filter(s => PANEL_SLOTS.includes(s.id));
  const panelLead = panel.every(p => isUsual(p.src))
    ? `${defaultsLead(panel.map(p => p.src ?? ''))}. Change here if this case is different.`
    : 'Already set. Change here if you need to.';
  const stepId = slotStepId(item.id, slot.id);
  // The shade editor shows the stump-shade note and the arch editor the open-case note themselves.
  const itemNotes = notes.filter(x =>
    x.itemId === item.id && x.step === stepId
    && !(slot.id === 'shade' && x.id.startsWith('stump:'))
    && !(slot.id === 'arch' && x.kind === 'openCase'));
  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A6A]">{kicker}</p>
          {justPicked && (
            <LinkButton onClick={() => { removeItem(item.id); go('services'); }} className="ml-auto">Pick a Different Service</LinkButton>
          )}
        </div>
        <h2 ref={ref} tabIndex={-1} className="text-xl font-semibold text-[#030213] leading-snug focus:outline-none">{questionFor(slot, item, n, lab.name)}</h2>
        {!gap && slot.src && (
          <p className="mt-1.5 text-sm text-[#5A5A6A] inline-flex items-center gap-1.5">Set · <SourceTag src={slot.src} /></p>
        )}
      </div>
      {panel.length > 0 && (
        <DefaultsPanel>
          <p className="text-xs text-[#4A4A5A]">{panelLead}</p>
          {panel.map(p => <SlotEditor key={p.id} item={item} slot={p} compact />)}
        </DefaultsPanel>
      )}
      <SlotEditor item={item} slot={slot} />
      <ServiceNote item={item} className="mt-6 pt-4 border-t border-[#F0EFF6]" />
      {itemNotes.length > 0 && (
        <div className="mt-5 space-y-2">
          {itemNotes.map(x => <NoteView key={x.id} note={x} onDismiss={() => dismissNote(x.id)} />)}
        </div>
      )}
    </div>
  );
});
