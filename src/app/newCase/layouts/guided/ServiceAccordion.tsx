// ─── Experience A · one service, one card ────────────────────────────────────
// A service's step in Guided shows the whole service at once: every item it
// asks for (End teeth, Material, Shade…) as an accordion section,
// plus its Case Instructions. A closed section reads back its answer
// ("Shade · A3.5"); the one being answered is open with its editor. The left
// timeline stays the map: picking an item there opens its section here, and
// answering one opens the next that needs you (the page's auto-advance moves
// the step, the accordion follows it). Items after the first open one wait,
// as they do in the timeline. Focus lands on the opened section's header.
// With the room, every service is two columns: what's picked on a chart (Teeth,
// Arch, Extractions) stays open on the left, every other item beside it.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, MessageSquareText } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { PRODUCTS, ServiceItem, Slot, SlotId, itemTitle, slotGaps, slotStepId, slotsFor } from '../../rules';
import { NoteView, PRODUCT_ICON, RemoveService, SlotEditor, questionFor } from '../../ServiceSteps';
import { ServiceNote } from '../../Instructions';
import { SourceTag, StateIcon, StepHeading, FOCUS } from '../../ui';
import { ChartWidthContext, ColumnWidthContext, LiveTeethContext } from '../../room';
import { ArrowActiveProvider } from '../../footerArrow';

export default function ServiceAccordion({ item, slotId }: { item: ServiceItem; slotId: SlotId }) {
  const { ctx, draft, user, lab, step, go, notes, dismissNote, readOnly } = useCase();
  const { headingRef } = useController();
  const n = user.notation;
  const slots = slotsFor(item, ctx, draft);
  const label = PRODUCTS[item.product].label;
  const open = slots.some(s => s.id === slotId) ? slotId : slots[0]?.id;
  const kicker = slotGaps(slots).length ? `Adding ${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label}` : label;
  // While the step is on the chart side (Teeth, Arch) nothing in the second column is being answered, so the
  // service's Case Instructions show there by default; otherwise closed (its header reads the note back).
  // A click overrides it until the step moves on.
  const [noteToggle, setNoteToggle] = useState<boolean | null>(null);
  useEffect(() => { setNoteToggle(null); }, [open]);

  // A service picked on the chart keeps the chart in view: teeth on the left, every other item beside it,
  // so Material, Shade and the rest are answered without scrolling past the chart. Needs the room for both.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Every service splits the same way: what's picked on a chart (Teeth, Arch, Extractions) stays open in the
  // first column, every other item (Material, Shade, Stages, Acrylic, Mould…) sits in the second.
  const chartSlots = slots.filter(s => CHART_SLOTS.includes(s.id));
  const otherSlots = slots.filter(s => !CHART_SLOTS.includes(s.id));
  const canSplit = chartSlots.length > 0 && otherSlots.length > 0;
  const split = canSplit && width >= SPLIT_MIN;
  const noteOpen = noteToggle ?? (split && !!open && CHART_SLOTS.includes(open));
  // 65 : 35, the chart gets the room (the user's call); the items' column never drops under 280 px.
  const cols = 'grid-cols-[minmax(0,65fr)_minmax(280px,35fr)]';
  // The second column's width, so a wide editor (a denture's stages) lays itself out for it.
  const side = useRef<HTMLOListElement>(null);
  const [sideWidth, setSideWidth] = useState<number>();
  useLayoutEffect(() => {
    const el = side.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setSideWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [canSplit]);

  const section = (s: Slot, opts: { pinned?: boolean } = {}) => {
    const isOpen = opts.pinned || s.id === open;
    const current = s.id === open;
    // Notes for this item show in its own section (the editors already show the stump and open-case notes).
    const sectionNotes = notes.filter(x => x.itemId === item.id && x.step === slotStepId(item.id, s.id)
      && !(s.id === 'shade' && x.id.startsWith('stump:')) && !(s.id === 'arch' && x.kind === 'openCase'));
    return (
      <Section
        key={s.id}
        slot={s}
        open={isOpen}
        // Any item opens when you pick it (an accordion, not a locked wizard); the timeline still says what's next.
        disabled={false}
        question={questionFor(s, item, n, lab.name, true)}
        headingRef={current ? headingRef : undefined}
        onToggle={() => go(slotStepId(item.id, s.id))}
      >
        {/* The horizontal chart runs across its section and fills it: up to 640 px stacked (so the step still fits a */}
        {/* short window), up to 720 px in its own wide column. */}
        {/* A chart that stays open beside another item keeps its "Done" arrow until the teeth are the step again. */}
        <ArrowActiveProvider value={current}>
          {/* The pinned chart keeps focus on the tooth just tapped (data-nc-keep-focus; its heading still takes focus as usual). */}
          <div data-nc-keep-focus={opts.pinned || undefined}>
            <ChartWidthContext.Provider value={opts.pinned ? 720 : 640}><SlotEditor item={item} slot={s} /></ChartWidthContext.Provider>
          </div>
        </ArrowActiveProvider>
        {sectionNotes.length > 0 && (
          <div className="mt-4 space-y-2">
            {sectionNotes.map(x => <NoteView key={x.id} note={x} onDismiss={() => dismissNote(x.id)} />)}
          </div>
        )}
      </Section>
    );
  };

  /** The service's own instructions: optional, merged into the case's at Review. */
  const noteRow = (!readOnly || item.note) && (
    <li className="rounded-xl border border-[#ECECF2] bg-white">
      <button
        type="button"
        aria-expanded={noteOpen}
        onClick={() => setNoteToggle(!noteOpen)}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left rounded-xl ${FOCUS}`}
      >
        <MessageSquareText className="w-4 h-4 text-[#2F62D6] flex-shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-[#030213]">Case Instructions ({label})</span>
          <span className="text-[#5A5A6A]"> · {item.note?.trim() ? item.note.trim() : 'Optional'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#5A5A6A] transition-transform motion-reduce:transition-none ${noteOpen ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {/* Opened by default, it leaves focus on the chart; opened with a click, the cursor goes into the box. */}
      {noteOpen && <div className="px-3.5 pb-3.5 nc-accordion-in"><ServiceNote item={item} inline autoFocus={noteToggle === true} /></div>}
    </li>
  );

  return (
    <LiveTeethContext.Provider value={true}>
    <div ref={box}>
      {/* The card's title (between the arrows): the service itself, not one question. */}
      <StepHeading icon={PRODUCT_ICON[item.product]} kicker={kicker} title={itemTitle(item, n)} />
      <div className="flex items-center gap-3 mb-3">
        <p className="flex-1 min-w-0 text-xs text-[#5A5A6A]">
          {slots.filter(s => s.answered).length} of {slots.length} set{slotGaps(slots).length ? ` · ${slotGaps(slots).length} to go` : ' · all set'}
        </p>
        <RemoveService item={item} />
      </div>

      {canSplit ? (
        // One tree whether or not the columns sit side by side: only classes change across the width,
        // so no section remounts (focus, a half-typed note and editor state survive).
        <div className={split ? `grid ${cols} gap-3 items-start` : 'space-y-2'}>
          {/* Teeth count as they're tapped here (LiveTeethContext), so the item open beside the chart stays open. */}
          <ol className={split ? 'sticky top-4 space-y-2' : 'space-y-2'}>
            {chartSlots.map(s => section(s, { pinned: split }))}
          </ol>
          <ColumnWidthContext.Provider value={split ? sideWidth : undefined}>
            <ol ref={side} className="space-y-2" aria-label={split ? `${label}: the other items` : undefined}>
              {otherSlots.map(s => section(s))}
              {noteRow}
            </ol>
          </ColumnWidthContext.Provider>
        </div>
      ) : (
        <ol className="space-y-2">
          {slots.map(s => section(s))}
          {noteRow}
        </ol>
      )}
    </div>
    </LiveTeethContext.Provider>
  );
}

/** The card's width at which the chart and the other items sit side by side. */
const SPLIT_MIN = 720;
/** Items answered on a chart: they keep the first column. */
const CHART_SLOTS: SlotId[] = ['teeth', 'arch', 'extract'];

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
