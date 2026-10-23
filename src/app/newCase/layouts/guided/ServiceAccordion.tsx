// ─── Experience A · one service, one card ────────────────────────────────────
// A service's step in Guided shows the whole service at once: every item it
// asks for (End teeth, Material, Shade, Preferences…) as an accordion section,
// plus its Case Instructions. A closed section reads back its answer
// ("Shade · A3.5"); the one being answered is open with its editor. The left
// timeline stays the map: picking an item there opens its section here, and
// answering one opens the next that needs you (the page's auto-advance moves
// the step, the accordion follows it). Items after the first open one wait,
// as they do in the timeline. Focus lands on the opened section's header.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageSquareText } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { PRODUCTS, ServiceItem, Slot, SlotId, itemTitle, slotGaps, slotStepId, slotsFor } from '../../rules';
import { NoteView, PRODUCT_ICON, RemoveService, SlotEditor, questionFor } from '../../ServiceSteps';
import { ServiceNote } from '../../Instructions';
import { SourceTag, StateIcon, StepHeading, FOCUS } from '../../ui';

export default function ServiceAccordion({ item, slotId }: { item: ServiceItem; slotId: SlotId }) {
  const { ctx, user, lab, steps, go, notes, dismissNote, readOnly } = useCase();
  const { headingRef } = useController();
  const n = user.notation;
  const slots = slotsFor(item, ctx);
  const label = PRODUCTS[item.product].label;
  const open = slots.some(s => s.id === slotId) ? slotId : slots[0]?.id;
  const kicker = slotGaps(slots).length ? `Adding ${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}` : label;
  // Closed by default: its header already reads the note back.
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <div>
      {/* The card's title (between the arrows): the service itself, not one question. */}
      <StepHeading icon={PRODUCT_ICON[item.product]} kicker={kicker} title={itemTitle(item, n)} />
      <div className="flex items-center gap-3 mb-3">
        <p className="flex-1 min-w-0 text-xs text-[#5A5A6A]">
          {slots.filter(s => s.answered).length} of {slots.length} set{slotGaps(slots).length ? ` · ${slotGaps(slots).length} to go` : ' · all set'}
        </p>
        <RemoveService item={item} />
      </div>

      <ol className="space-y-2">
        {slots.map(s => {
          const node = steps.find(x => x.id === slotStepId(item.id, s.id));
          const isOpen = s.id === open;
          const reachable = !!node?.navigable;
          // Notes for this item show in its own section (the editors already show the stump and open-case notes).
          const sectionNotes = notes.filter(x => x.itemId === item.id && x.step === slotStepId(item.id, s.id)
            && !(s.id === 'shade' && x.id.startsWith('stump:')) && !(s.id === 'arch' && x.kind === 'openCase'));
          return (
            <Section
              key={s.id}
              slot={s}
              open={isOpen}
              disabled={!reachable && !isOpen}
              question={questionFor(s, item, n, lab.name, true)}
              headingRef={isOpen ? headingRef : undefined}
              onToggle={() => go(slotStepId(item.id, s.id))}
            >
              <SlotEditor item={item} slot={s} />
              {sectionNotes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {sectionNotes.map(x => <NoteView key={x.id} note={x} onDismiss={() => dismissNote(x.id)} />)}
                </div>
              )}
            </Section>
          );
        })}
        {/* The service's own instructions: optional, merged into the case's at Review. */}
        {(!readOnly || item.note) && (
          <li className="rounded-xl border border-[#ECECF2] bg-white">
            <button
              type="button"
              aria-expanded={noteOpen}
              onClick={() => setNoteOpen(o => !o)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-xl ${FOCUS}`}
            >
              <MessageSquareText className="w-4 h-4 text-[#2F62D6] flex-shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium text-[#030213]">Case Instructions ({label})</span>
                <span className="text-[#5A5A6A]"> · {item.note?.trim() ? item.note.trim() : 'Optional'}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-[#5A5A6A] transition-transform motion-reduce:transition-none ${noteOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {noteOpen && <div className="px-3.5 pb-3.5 nc-accordion-in"><ServiceNote item={item} /></div>}
          </li>
        )}
      </ol>
    </div>
  );
}

/** One item of the service: a header that reads back the answer, and its editor when open. */
function Section({ slot, open, disabled, question, headingRef, onToggle, children }: {
  slot: Slot; open: boolean; disabled: boolean; question: string;
  headingRef?: React.Ref<HTMLHeadingElement>; onToggle: () => void; children: React.ReactNode;
}) {
  const box = useRef<HTMLLIElement>(null);
  const id = `nc-acc-${slot.id}`;
  const state = slot.answered ? 'done' : slot.required ? 'gap' : 'todo';
  // An opened section slides into view if it's below the fold.
  useEffect(() => { if (open) box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [open]);
  return (
    <li ref={box} className={`rounded-xl border transition-colors motion-reduce:transition-none ${open ? 'border-[#C8D8FC] bg-white shadow-[0_6px_18px_-12px_rgba(63,111,232,0.45)]' : 'border-[#ECECF2] bg-white'}`}>
      <h3 ref={headingRef} tabIndex={-1} className="focus:outline-none">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          disabled={disabled}
          onClick={onToggle}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-xl disabled:cursor-default ${FOCUS}`}
        >
          <StateIcon state={state} size="sm" ripple={open && state === 'gap'} />
          <span className="min-w-0 flex-1 truncate text-sm">
            {open
              ? <span className="font-semibold text-[#030213]">{question}</span>
              : <>
                <span className={`font-medium ${disabled ? 'text-[#6B6B7B]' : 'text-[#030213]'}`}>{slot.label}</span>
                {slot.answered && slot.value && <span className="text-[#5A5A6A]"> · {slot.value}</span>}
                {!slot.answered && <span className={state === 'gap' ? 'text-[#8A4B08]' : 'text-[#5A5A6A]'}> · {disabled ? 'after the ones above' : state === 'gap' ? 'needs you' : 'optional'}</span>}
              </>}
          </span>
          {slot.answered && slot.src && slot.src !== slot.value && !open && <SourceTag src={slot.src} />}
          <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[#5A5A6A] transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </h3>
      {open && <div id={id} className="px-3.5 pb-4 pt-1 nc-accordion-in">{children}</div>}
    </li>
  );
}
