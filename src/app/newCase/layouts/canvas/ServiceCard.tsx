// ─── Experience C · one card per service ─────────────────────────────────────
// Title, lead-time line, Change Teeth (or Arch) and Remove, then the rest of the
// service's slots as compact rows. The teeth or arch read in the title, so their
// row only opens while it needs an answer or is being changed. Answered and
// defaulted rows read "label · value · source · Change"; a row that still needs
// an answer is open, with an amber "Needs you" marker and its full editor.
// "Change" makes a row the active one and opens it inline.
//
// Motion: a new card fades in with a slight scale, a removed one collapses
// before it goes, and the card's height glides whenever a row opens or folds.
// A row that becomes the active "Needs you" gets a brief soft pulse. Hovering
// the card lights its teeth on the chart.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MousePointerClick, Trash2 } from 'lucide-react';
import type { ProductId } from '../../data';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import {
  NoteDef, PRODUCTS, ServiceItem, Slot, SlotId, bridgeParts, itemTitle, parseStep, plural, priceOf, slotGaps,
  slotStepId, slotsFor, stagesShort,
} from '../../rules';
import { NoteView, PRODUCT_ICON, SlotEditor, itemDetails, questionFor } from '../../ServiceSteps';
import { ServiceNote } from '../../Instructions';
import { MiniChart } from '../../TeethChart';
import { LinkButton, SourceTag, StateIcon, FOCUS } from '../../ui';
import { collapseOut, fadeSwap, popIn, useHeightMorph, usePulse } from './motion';
import { archFirst, waitsForChart } from './selection';
import { RowMode, useAdvanceOnChange, useCanvas } from './state';

/** Services whose title already names their teeth ("Crown · 36 · LL6"). */
const TEETH_IN_TITLE: ProductId[] = ['crown', 'bridge', 'implant', 'veneer', 'inlay'];
const inTitle = (item: ServiceItem, id: SlotId) => id === 'arch' || (id === 'teeth' && TEETH_IN_TITLE.includes(item.product));
const changeLabel = (item: ServiceItem, id: SlotId) =>
  id === 'arch' ? 'Change Arch' : item.product === 'implant' ? 'Change Site' : item.product === 'inlay' ? 'Change Tooth' : 'Change Teeth';
/** Hide "You": a value is the user's own unless it says otherwise. */
const shownSrc = (src?: string, value?: string) => (src && src !== 'You' && src !== value ? src : undefined);

export default function ServiceCard({ item }: { item: ServiceItem }) {
  const api = useCase();
  const ui = useCanvas();
  const { ctx, draft, user, lab, readOnly, notes, dismissNote, doneAndAdvance, removeItem, step, go } = api;
  const n = user.notation;
  const slots = slotsFor(item, ctx, draft);
  const left = slotGaps(slots).length;
  const p = priceOf(item, ctx, draft.fastTrack);
  const details = new Map(itemDetails(item, ctx, draft).map(d => [d.label, d]));
  const Icon = PRODUCT_ICON[item.product];
  const archItem = PRODUCTS[item.product].archItem;
  const activeHere = parseStep(step).itemId === item.id;
  const title = itemTitle(item, n);
  const onChart = !readOnly && waitsForChart(item, lab);
  const cardRef = useRef<HTMLElement>(null);

  // Each row: open with "Needs you" while it's a gap; open for changing when
  // it's the active row and was already answered; else one line. A gap that has
  // just been answered folds at once (the page moves on 220 ms later). A Delivery date is typed digit by digit
  // and a half-typed day can already be valid: it stays open (with Done) instead of folding mid-typing.
  const fromGap = useRef(new Set<SlotId>());
  const [, bump] = useState(0);
  const modes = new Map<SlotId, RowMode>(slots.map(s => {
    const active = step === slotStepId(item.id, s.id);
    const gap = s.required && !s.answered;
    if (!active) fromGap.current.delete(s.id);
    else if (gap && s.id !== 'deliveryDate') fromGap.current.add(s.id);
    return [s.id, readOnly ? 'view' : gap ? 'gap' : active && !fromGap.current.has(s.id) ? 'change' : 'view'];
  }));
  const reopen = (id: SlotId) => { fromGap.current.delete(id); bump(x => x + 1); };
  const change = (id: SlotId) => { reopen(id); go(slotStepId(item.id, id)); };

  // Teeth and arch already read in the title: folded, their row lives in the header.
  const folded = slots.filter(s => inTitle(item, s.id) && modes.get(s.id) === 'view');
  const rows = slots.filter(s => !folded.includes(s));

  // The shade and arch editors show their own note when open: don't repeat it below.
  const shadeOpen = modes.has('shade') && modes.get('shade') !== 'view';
  const archOpen = modes.has('arch') && modes.get('arch') !== 'view' && !onChart;
  const itemNotes = readOnly ? [] : notes.filter(x =>
    x.itemId === item.id && !(shadeOpen && x.id.startsWith('stump:')) && !(archOpen && x.kind === 'openCase'));
  // "Carry On" past an open case moves on, as it does in the arch editor.
  const onDismiss = (x: NoteDef) => (x.kind === 'openCase' && x.step === step
    ? doneAndAdvance(() => dismissNote(x.id))
    : dismissNote(x.id));
  const bp = item.product === 'bridge' && item.teeth.length > 1 ? bridgeParts(item) : null;
  const bridgeText = bp ? [plural(bp.span.length, 'unit'), bp.pontics.length ? `${bp.pontics.length === 1 ? 'pontic' : 'pontics'} ${[...bp.pontics].sort((a, b) => Number(a) - Number(b)).join(', ')}` : null].filter(Boolean).join(' · ') : null;
  // The lead time once the service is chosen far enough to have one ("7 days"); never its price.
  const lead = p.kind !== 'none' && p.ta != null ? plural(p.ta, 'day') : null;
  // A full denture has no date of its own: the line reads its ordered stages and their days. Any other
  // service's day is its own Delivery date row.
  const metaText = item.product === 'denture' ? stagesShort(item) : [bridgeText, lead].filter(Boolean).join(' · ');

  // The card glides to its new height when a row opens or folds, or a note comes or goes.
  useHeightMorph(cardRef, `${rows.map(s => `${s.id}:${modes.get(s.id)}`).join(',')}|${itemNotes.length}|${readOnly}`);
  // Added after the page opened: fade in with a slight scale (and skip the scroll reveal).
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !ui.settled.current) return;
    el.dataset.ncSeen = '1';
    popIn(el);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A removed card's hover mustn't keep its teeth lit.
  useEffect(() => () => ui.spy.hoverOff(item.id), []); // eslint-disable-line react-hooks/exhaustive-deps

  const removing = useRef(false);
  const remove = () => {
    if (removing.current) return;
    removing.current = true;
    void collapseOut(cardRef.current).then(() => removeItem(item.id));
  };

  return (
    <section
      ref={cardRef}
      id={`nc-sec-${item.id}`}
      data-nc-item={item.id}
      data-nc-section={item.id}
      data-nc-reveal
      aria-labelledby={`nc-item-${item.id}`}
      onMouseEnter={() => ui.spy.hoverOn(item.id)}
      onMouseLeave={() => ui.spy.hoverOff(item.id)}
      className={`bg-white rounded-2xl border overflow-hidden transition-[box-shadow,border-color] duration-300 motion-reduce:transition-none ${
        ui.highlightId === item.id ? 'border-[#3F6FE8] ring-4 ring-[#3F6FE8]/20' : activeHere ? 'border-[#C8D8FC] shadow-[0_4px_16px_rgba(63,111,232,0.08)]' : 'border-[#E0E0E6] hover:border-[#D4D4DD]'
      }`}
    >
      <header className="flex items-center gap-3.5 px-5 py-3.5">
        <div className="flex-shrink-0 w-[72px] flex justify-center">
          {item.teeth.length || (archItem && item.arch) ? (
            <MiniChart
              teeth={item.teeth}
              arch={archItem ? item.arch : undefined}
              pontics={item.product === 'bridge' ? bridgeParts(item).pontics : undefined}
              width={64}
              label={title}
            />
          ) : (
            <span className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center" aria-hidden><Icon className="w-5 h-5" /></span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 id={`nc-item-${item.id}`} tabIndex={-1} className="text-base font-semibold text-[#030213] leading-snug focus:outline-none">{title}</h2>
            {folded.map(s => <SourceTag key={s.id} src={shownSrc(s.src)} />)}
            {ctx.funding === 'nhs' && PRODUCTS[item.product].privateOnly && <SourceTag src="Private" />}
            {!readOnly && left > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A4B08]"><StateIcon state="gap" size="sm" />{left} left</span>
            )}
          </div>
          <p className="text-xs text-[#4A4A5A] mt-0.5">{metaText || (item.product === 'denture' ? 'Stage dates once a stage is ordered' : left ? 'Lead time once the gaps are filled' : '')}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {folded.map(s => (
              <LinkButton key={s.id} onClick={() => change(s.id)}>{changeLabel(item, s.id)}</LinkButton>
            ))}
            <button
              type="button"
              onClick={remove}
              aria-label={`Remove ${title}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] ${FOCUS}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />Remove
            </button>
          </div>
        )}
      </header>

      {rows.length > 0 && (
        <ul className="border-t border-[#F0EFF6] divide-y divide-[#F0EFF6]">
          {rows.map(s => (
            <SlotRow
              key={s.id}
              item={item}
              slot={s}
              mode={modes.get(s.id)!}
              onChange={() => change(s.id)}
              onChart={onChart && (s.id === 'teeth' || s.id === 'arch')}
              value={details.get(s.label)?.value ?? s.value}
            />
          ))}
        </ul>
      )}

      {itemNotes.length > 0 && (
        <div className="px-5 py-3 space-y-2 border-t border-[#F0EFF6]">
          {itemNotes.map(x => <NoteView key={x.id} note={x} onDismiss={() => onDismiss(x)} />)}
        </div>
      )}
      <ServiceNote item={item} className="px-5 py-3 border-t border-[#F0EFF6]" />
    </section>
  );
}

function SlotRow({ item, slot, mode, onChange, onChart, value }: {
  item: ServiceItem; slot: Slot; mode: RowMode; onChange: () => void; onChart: boolean; value?: string;
}) {
  const api = useCase();
  const c = useController();
  const ui = useCanvas();
  const { readOnly, step, go, user, lab } = api;
  const id = slotStepId(item.id, slot.id);
  const active = step === id;
  // A date is typed digit by digit: its row stays open until Done.
  useAdvanceOnChange(mode === 'change' && slot.id !== 'deliveryDate', `${slot.value ?? ''}|${slot.src ?? ''}`, slot.answered);
  const ref = active ? c.headingRef : undefined;
  const accent = active ? 'bg-[#3F6FE8]' : mode === 'gap' ? 'bg-[#B45309]' : '';
  const liRef = useRef<HTMLLIElement>(null);
  // The card glides to its new height; the row's new content fades in meanwhile.
  const firstMode = useRef(true);
  useLayoutEffect(() => {
    if (firstMode.current) { firstMode.current = false; return; }
    fadeSwap(liRef.current);
  }, [mode]);
  usePulse(liRef, active && mode === 'gap');

  if (mode === 'view') {
    const src = shownSrc(slot.src, value);
    return (
      <li ref={liRef} data-nc-row={id} className={`relative flex items-center gap-3 pl-5 pr-4 py-2.5 transition-colors duration-200 motion-reduce:transition-none ${active ? 'bg-[#F5F8FF]' : ''}`}>
        {accent && <span aria-hidden className={`absolute left-0 inset-y-0 w-[3px] ${accent}`} />}
        <h3 ref={ref} tabIndex={-1} className="w-36 flex-shrink-0 text-xs font-semibold text-[#4A4A5A] focus:outline-none">{slot.label}</h3>
        <p className="flex-1 min-w-0 text-sm text-[#030213] truncate" title={value}>{value || '—'}</p>
        {src && <SourceTag src={src} />}
        {!readOnly && <LinkButton onClick={onChange}>Change</LinkButton>}
      </li>
    );
  }

  const question = questionFor(slot, item, user.notation, lab.name);
  const label = PRODUCTS[item.product].label;
  return (
    <li ref={liRef} data-nc-row={id} className={`relative pl-5 pr-4 py-4 transition-colors duration-200 motion-reduce:transition-none ${active ? 'bg-[#F5F8FF]' : ''}`}>
      <span aria-hidden className={`absolute left-0 inset-y-0 w-[3px] ${accent}`} />
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {mode === 'gap' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#F5D98B] text-[11px] font-semibold text-[#8A4B08]">
            <StateIcon state="gap" size="sm" />Needs you
          </span>
        )}
        <h3 ref={ref} tabIndex={-1} className="text-[15px] font-semibold text-[#030213] leading-snug focus:outline-none">{question}</h3>
        {mode === 'change' && <LinkButton className="ml-auto" onClick={() => go(c.nextGapId)}>Done</LinkButton>}
      </div>
      {onChart ? (
        // The big chart is the one place teeth and arches are picked for a new service.
        <p className="flex items-center gap-2 text-sm text-[#3A3A4A]">
          <MousePointerClick className="w-4 h-4 text-[#2F62D6] flex-shrink-0" aria-hidden />
          <span>
            {archFirst(item.product) ? 'Select the arch on the chart' : 'Tap the teeth on the chart'}, then pick {label} in the bar below.{' '}
            <LinkButton onClick={ui.focusChart}>Go to Chart</LinkButton>
          </span>
        </p>
      ) : (
        <SlotEditor item={item} slot={slot} />
      )}
    </li>
  );
}
