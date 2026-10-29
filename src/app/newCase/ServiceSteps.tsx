// ─── New Case Flow · services and their sub-steps ────────────────────────────
// "What are we making?" (only what the chosen lab makes) and one screen per
// slot of a service: the first unanswered required slot is the big question,
// defaulted slots before it sit above it in a light panel. With room to spare
// ('wide': Guided, Conversation) the defaults shrink to a row of fact pills and
// the editors turn visual (service tiles, swatches, one-line option rows);
// One page's inline rows ('compact') keep the plain chips.

import { useContext, useEffect, useId, useMemo, useState, forwardRef, KeyboardEvent, ReactNode } from 'react';
import {
  AlignHorizontalSpaceAround, Anchor, ArrowRight, Bolt, Camera, Check, ChevronDown, Crown, Droplet, Gem, Layers, Link, Link2, Moon, MoreHorizontal, PackagePlus,
  Plus, Shapes, Shield, Smile, SmilePlus, Sparkles, Square, Wrench, History, Trash2, X, Zap, type LucideIcon,
} from 'lucide-react';
import { CaseContext, useCase } from './CaseContext';
import { ControllerContext } from './controller';
import { ChartWidthContext, ColumnWidthContext, LiveTeethContext, useRoom } from './room';
import {
  ABUTMENTS, ACRYLIC_OPTIONS, BRIDGE_ERRORS, MATERIAL_GROUP, MOULD_OPTIONS, OPTIONS, PARTIAL_DESIGNS, PARTIAL_STAGES, POSTDAM_OPTIONS,
  PRODUCTS, REMAKE_REASONS, ServiceItem, Slot, SlotId, TILE_ORDER, archCaps, bridgeIssue, bridgeParts, bridgeReadback,
  effective, implantOnRecord, isFront, itemTitle, jawOf, labMakes, labProducts, labsThatMake, materialOptions,
  optionAvail, optionName, plural, priceOf, remakeCandidate, shadeSwatch, slotGaps, slotsFor, spanBetween, spanText,
  teethText, toothText, unitsOf, usualsFor, palmerOf, patientAge, slotStepId, NOTATIONS, Notation,
  DENTURE_STAGES, DENTURE_TREATMENTS, DentureStageId, DentureTreatment, StagePlan, dentureStageReady, dentureTreatment,
  isFollowUp, seedDenturePlan, stageName, stageOption, stagePlan, stagesOutOfOrder, stagesShort, stagesSummary,
  suggestedStageDates, treatmentName, CaseDraft, receivedFor, serviceDate, aProduct, fastTrackEligible,
  AlignerGroupId, AlignerKey, alignerGroup, alignerReadback, isAlignerGroup, nextStageExtra, repeatExtra,
} from './rules';
import { IMPLANT_SYSTEMS, LABS, ProductId } from './data';
import { getRow, setNotation } from './store';
import { ServiceNote } from './Instructions';
import { ArrowAction, stepName, useArrowActive, useFooterArrow, useHandArrow } from './footerArrow';
import { demoNow, fmtDay, fmtShort, fromISO, toISO } from './dates';
import TeethChart, { ChartLegend, MiniChart } from './TeethChart';
import { StageDatePicker } from '../components/DentureStages';
import type { StageRow } from '../data/dentureStages';
import {
  ChoiceChips, ChipOption, DefaultsPanel, FieldLabel, LinkButton, NextArrow, Notice, PrimaryButton, SecondaryButton, SourceTag,
  StateIcon, StepHeading, ToggleChips, FOCUS,
} from './ui';

export const PRODUCT_ICON: Record<ProductId, typeof Crown> = {
  crown: Crown, bridge: Link2, implant: Anchor, veneer: Layers, inlay: Square, nightguard: Moon, denture: Smile,
  partial: SmilePlus, reline: Wrench, retainer: Shield, aligner: AlignHorizontalSpaceAround, whitening: Sparkles, other: PackagePlus,
};

/** Where the arrow lands once this answer is in: the service's next open item, else the next gap, else Review. */
function useNextName(itemId: string, slot: SlotId): string {
  const { steps, draft, user } = useCase();
  const i = steps.findIndex(s => s.id === slotStepId(itemId, slot));
  const after = steps.slice(i + 1);
  const s = after.find(x => x.gap && x.itemId === itemId) ?? after.find(x => x.gap && x.navigable)
    ?? steps.slice(0, Math.max(i, 0)).find(x => x.gap && x.navigable);
  return stepName(steps, s?.id ?? 'review', draft, user.notation, itemId);
}

/**
 * The step's "that's it" arrow: handed to the sticky footer in Guided, drawn in
 * place where there's no footer to carry it (Conversation, One page).
 */
function StepArrow({ show = true, ...a }: ArrowAction & { show?: boolean }) {
  const inFooter = useFooterArrow();
  // An editor that isn't the current step keeps its arrow to itself.
  const active = useArrowActive();
  useHandArrow(inFooter && show && active, a);
  if (inFooter || !show) return null;
  return <NextArrow onClick={a.run} disabled={a.disabled} label={a.label} next={a.next} hint={a.hint} />;
}

// ─── Services picker ─────────────────────────────────────────────────────────

export const ServicesStep = forwardRef<HTMLHeadingElement>(function ServicesStep(_, ref) {
  const { lab, patient, ctx, addService, openDrawer, go, draft } = useCase();
  const wide = useRoom() === 'wide';
  const made = labProducts(lab);
  const tiles = TILE_ORDER.filter(p => made.includes(p));
  const hasMore = made.some(p => !TILE_ORDER.includes(p));
  const nhs = ctx.funding === 'nhs';

  const chips: { label: string; kind: string; product: ProductId; title: string; sub?: string; onPick: () => void }[] = [];
  const rep = patient.repeat;
  if (rep && labMakes(lab, rep.product) && optionAvail(lab, rep.product, rep.option, ctx.funding).ok) {
    chips.push({
      label: `Repeat: ${rep.label}`, kind: 'Repeat', product: rep.product, title: rep.label,
      onPick: () => addService(rep.product, repeatExtra(rep)),
    });
  }
  const ns = patient.nextStage;
  if (ns && labMakes(lab, ns.product) && !draft.items.some(isFollowUp)) {
    // The case page seeds the plan: the stages before it done on ns.caseId, this one ordered.
    chips.push({
      label: `Next stage: ${optionName('denture', ns.stage)} · ${ns.arch} full denture (${ns.note})`,
      kind: 'Next stage', product: 'denture', title: `${optionName('denture', ns.stage)} · ${ns.arch} full denture`, sub: `${ns.note} · continues ${ns.caseId}`,
      onPick: () => addService('denture', nextStageExtra(ns)),
    });
  }

  if (wide) {
    const extras = made.filter(p => !TILE_ORDER.includes(p));
    return (
      <div>
        <StepHeading ref={ref} icon={PackagePlus} kicker={draft.items.length ? 'Add another service' : undefined} title={`What are we making for ${patient.first}?`}>
          From {lab.name}’s catalogue · <LinkButton onClick={() => go('lab')}>Change Lab</LinkButton>
        </StepHeading>

        {chips.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-[#3A3A4A] mb-2">Pick up where you left off</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {chips.map(c => {
                const Icon = PRODUCT_ICON[c.product];
                return (
                  <button key={c.label} type="button" onClick={c.onPick} aria-label={c.label} className={`group flex items-center gap-3 p-3 rounded-xl border border-[#C8D8FC] bg-gradient-to-r from-[#F5F8FF] to-[#F8F5FF] hover:border-[#3F6FE8] text-left transition-colors motion-reduce:transition-none ${FOCUS}`}>
                    <span aria-hidden className="w-10 h-10 rounded-xl bg-white border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" strokeWidth={1.75} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#2F62D6]"><History className="w-3 h-3" strokeWidth={1.75} aria-hidden />{c.kind}</span>
                      <span className="block text-sm font-semibold text-[#030213] truncate">{c.title}</span>
                      {c.sub && <span className="block text-[11px] text-[#5A5A6A] truncate">{c.sub}</span>}
                    </span>
                    <ArrowRight aria-hidden className="w-4 h-4 text-[#2F62D6] flex-shrink-0 transition-transform motion-reduce:transition-none motion-safe:group-hover:translate-x-0.5" strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-3">
          {tiles.map(p => <ServiceTile key={p} product={p} nhs={nhs} onPick={() => addService(p)} />)}
          {hasMore && (
            <button type="button" onClick={() => openDrawer({ kind: 'moreServices' })} className={`flex flex-col justify-between gap-4 min-h-[120px] p-4 rounded-2xl border border-dashed border-[#C9C9D6] bg-white hover:border-[#3F6FE8] hover:bg-[#F8FAFF] text-left transition-colors motion-reduce:transition-none ${FOCUS}`}>
              <span className="flex items-center gap-2 w-full">
                <span aria-hidden className="w-11 h-11 rounded-xl bg-[#F3F3F5] text-[#4A4A5A] flex items-center justify-center"><MoreHorizontal className="w-5 h-5" strokeWidth={1.75} /></span>
                <span aria-hidden className="ml-auto flex -space-x-1.5">
                  {extras.slice(0, 4).map(p => {
                    const Icon = PRODUCT_ICON[p];
                    return <span key={p} title={PRODUCTS[p].label} className="w-6 h-6 rounded-full bg-white border border-[#E0E0E6] text-[#4A4A5A] flex items-center justify-center"><Icon className="w-3 h-3" strokeWidth={1.75} /></span>;
                  })}
                </span>
              </span>
              <span>
                <span className="block text-sm font-semibold text-[#030213]">More</span>
                <span className="block text-xs text-[#4A4A5A] mt-0.5">{plural(extras.length, 'more service')}</span>
                <span className="block text-[11px] text-[#5A5A6A] mt-0.5">Everything else {lab.name.split(' ')[0]} makes</span>
              </span>
            </button>
          )}
        </div>
        {nhs && tiles.some(p => PRODUCTS[p].privateOnly) && (
          <p className="mt-4 text-xs text-[#5A5A6A]">Items tagged Private go to the lab as private work for this NHS patient.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <StepHeading ref={ref} kicker={draft.items.length ? 'Add another service' : undefined} title={`What are we making for ${patient.first}?`}>
        From {lab.name}’s catalogue · <LinkButton onClick={() => go('lab')}>Change Lab</LinkButton>
      </StepHeading>

      {chips.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-[#3A3A4A] mb-2">Pick up where you left off</p>
          <div className="flex flex-wrap gap-2">
            {chips.map(c => (
              <button key={c.label} type="button" onClick={c.onPick} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#C8D8FC] bg-[#F5F8FF] text-sm font-semibold text-[#1E3A8A] hover:bg-[#EEF4FF] ${FOCUS}`}>
                <History className="w-4 h-4" aria-hidden />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
        {tiles.map(p => <ServiceTile key={p} product={p} nhs={nhs} onPick={() => addService(p)} />)}
        {hasMore && (
          <button type="button" onClick={() => openDrawer({ kind: 'moreServices' })} className={`flex flex-col items-start gap-3 p-4 rounded-2xl border border-dashed border-[#C9C9D6] bg-white hover:border-[#3F6FE8] hover:bg-[#F8FAFF] text-left ${FOCUS}`}>
            <span className="w-10 h-10 rounded-xl bg-[#F3F3F5] text-[#4A4A5A] flex items-center justify-center"><MoreHorizontal className="w-5 h-5" /></span>
            <span>
              <span className="block text-sm font-semibold text-[#030213]">More</span>
              <span className="block text-[11px] text-[#5A5A6A] mt-0.5">Everything else {lab.name.split(' ')[0]} makes</span>
            </span>
          </button>
        )}
      </div>
      {nhs && tiles.some(p => PRODUCTS[p].privateOnly) && (
        <p className="mt-4 text-xs text-[#5A5A6A]">Items tagged Private go to the lab as private work for this NHS patient.</p>
      )}
    </div>
  );
});

export function ServiceTile({ product, nhs, onPick }: { product: ProductId; nhs: boolean; onPick: () => void }) {
  const { lab, ctx } = useCase();
  const wide = useRoom() === 'wide';
  const Icon = PRODUCT_ICON[product];
  // What this lab offers for it, for this patient's funding: "5 materials", "7–10 days".
  // A full denture counts its stages (Straight to Finish and Immediate aren't stages).
  const offered = product === 'other' ? []
    : (product === 'denture' ? DENTURE_STAGES : OPTIONS[product]).filter(o => optionAvail(lab, product, o.id, ctx.funding).ok);
  const days = offered.map(o => lab.prices[`${product}:${o.id}`]![2]);
  const lo = Math.min(...days), hi = Math.max(...days);
  // Aligners come one way: the tile says what's picked instead of "1 option".
  const count = !offered.length ? null : product === 'aligner' ? 'Upper, lower or both' : plural(offered.length, OPTION_NOUN[product] ?? 'option');
  // A full denture's days are each stage's, not the whole denture's.
  const span = offered.length ? (lo === hi ? plural(lo, 'day') : `${lo}–${hi} days`) + (product === 'denture' ? ' a stage' : '') : null;
  // Said instead of the count: Something Else is described, not picked; nothing on offer for an NHS patient.
  const lead = product === 'other' ? 'Describe the work' : !offered.length && ctx.funding === 'nhs' ? 'Not on the NHS' : null;
  if (wide) {
    return (
      <button type="button" onClick={onPick} className={`group flex flex-col justify-between gap-4 min-h-[120px] p-4 rounded-2xl border border-[#E0E0E6] bg-white text-left hover:border-[#3F6FE8] hover:shadow-[0_10px_24px_-14px_rgba(63,111,232,0.55)] transition-[border-color,box-shadow] motion-reduce:transition-none ${FOCUS}`}>
        <span className="flex items-start justify-between gap-2 w-full">
          <span aria-hidden className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center"><Icon className="w-5 h-5" strokeWidth={1.75} /></span>
          {nhs && PRODUCTS[product].privateOnly
            ? <SourceTag src="Private" />
            : <Plus aria-hidden className="w-4 h-4 text-[#3F6FE8] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity motion-reduce:transition-none" strokeWidth={1.75} />}
        </span>
        <span className="block">
          <span className="block text-sm font-semibold text-[#030213]">{PRODUCTS[product].label}</span>
          {(lead ?? count) && <span className="block text-xs text-[#4A4A5A] mt-0.5">{lead ?? count}</span>}
          {!lead && span && <span className="block text-[11px] text-[#5A5A6A] mt-0.5">{span}</span>}
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onPick} className={`flex flex-col items-start gap-3 p-4 rounded-2xl border border-[#E0E0E6] bg-white hover:border-[#3F6FE8] hover:shadow-md text-left transition-all ${FOCUS}`}>
      <span className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center"><Icon className="w-5 h-5" /></span>
      <span>
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#030213]">{PRODUCTS[product].label}</span>
          {nhs && PRODUCTS[product].privateOnly && <SourceTag src="Private" />}
        </span>
        {(lead ?? count) && <span className="block text-[11px] text-[#5A5A6A] mt-0.5">{lead ?? [count, span].filter(Boolean).join(' · ')}</span>}
      </span>
    </button>
  );
}

// ─── Slot screen ─────────────────────────────────────────────────────────────

const CHART_SLOTS: SlotId[] = ['teeth', 'arch', 'extract'];
const PANEL_SLOTS: SlotId[] = ['material', 'type', 'splint', 'retention', 'acrylic'];

/**
 * The question a slot asks. `teethShown`: the teeth are already on screen (the
 * mini chart beside Guided's step), so the question doesn't repeat them. Many
 * teeth read as a count, never a paragraph of tooth numbers.
 */
export function questionFor(slot: Slot, item: ServiceItem, n: Notation, labName: string, teethShown = false): string {
  const many = item.teeth.length > 4;
  const teeth = many ? `${item.teeth.length} teeth` : teethText(item.teeth, n);
  const title = many ? `${PRODUCTS[item.product].label} · ${item.teeth.length} teeth` : itemTitle(item, n);
  if (teethShown) {
    if (slot.id === 'material' && !item.ambiguous) return 'Which material?';
    if (slot.id === 'shade' && item.product !== 'denture' && item.product !== 'partial') return 'Which shade?';
    if (slot.id === 'system') return 'Which implant system?';
  }
  switch (slot.id) {
    case 'teeth':
      if (item.product === 'bridge') return 'Tap the teeth at each end of the bridge';
      if (item.product === 'implant') return 'Which implant site?';
      if (item.product === 'inlay') return 'Which tooth?';
      if (item.product === 'partial') return 'Which teeth does it replace?';
      if (item.product === 'reline') return 'Which tooth is being added?';
      return 'Which teeth?';
    case 'material': return item.ambiguous ? `Medit says '${item.ambiguous}'. Which one?` : `Material for ${title}`;
    case 'shade':
      if (item.product === 'denture' || item.product === 'partial') return 'Tooth shade for the denture';
      return item.product === 'bridge' && !many ? `Shade for ${spanText(item.teeth, n)}` : `Shade for ${teeth}`;
    case 'photos': return 'Photos for the lab';
    case 'arch': return 'Which arch?';
    case 'type': return 'Which type?';
    case 'stage': return 'Which stage?';
    case 'stages': return dentureTreatment(item) === 'staged' ? 'Which stages, and when?' : 'When is it needed back?';
    case 'inlayType': return 'Inlay or onlay?';
    case 'system': return `The implant system for ${teeth}`;
    case 'platform': return 'Which platform?';
    case 'scanBody': return 'Which scan body was used?';
    case 'postdam': return 'Where should the post-dam go?';
    case 'remakeReason': return 'What went wrong?';
    case 'desc': return 'What should the lab make?';
    case 'remake': return 'Is this a remake?';
    case 'implantRecord': return `${teeth} has an implant on record`;
    case 'wings': return 'Which teeth get a wing?';
    case 'abutment': return 'Which abutment?';
    case 'base': return 'Which base?';
    case 'design': return 'How will the lab get the design?';
    case 'work': return 'What work is needed?';
    case 'extract': return 'Which teeth will be extracted?';
    case 'under18': return 'Whitening trays need an adult patient';
    case 'labCheck': return `${labName} doesn’t make ${PRODUCTS[item.product].noun}s`;
    case 'splint': return 'Separate or splinted?';
    case 'retention': return 'Screw- or cement-retained?';
    case 'acrylic': return 'Which acrylic?';
    case 'mould': return 'Tooth mould';
    case 'alignerPlan': return 'How should the aligners be set up?';
    case 'alignerFindings': return 'What should the aligners correct?';
    case 'alignerPerio': return 'Biotype and Miller’s class';
    case 'alignerOcclusion': return 'Angle’s, skeletal and dental class';
    case 'deliveryDate': return 'When do you need it back?';
  }
}

export const SlotStep = forwardRef<HTMLHeadingElement, { item: ServiceItem; slotId: SlotId }>(function SlotStep({ item, slotId }, ref) {
  const { ctx, draft, user, lab, notes, dismissNote } = useCase();
  const wide = useRoom() === 'wide';
  const n = user.notation;
  const slots = slotsFor(item, ctx, draft);
  const idx = slots.findIndex(s => s.id === slotId);
  const slot = slots[idx];
  if (!slot) return null;
  const anyGap = slotGaps(slots).length > 0;
  const label = PRODUCTS[item.product].label;
  const kicker = anyGap ? `Adding ${aProduct(item.product, label)}` : itemTitle(item, n);
  const isChart = CHART_SLOTS.includes(slot.id);
  const panel = slots.slice(0, idx).filter(s => PANEL_SLOTS.includes(s.id));
  // The shade editor shows the stump-shade note itself, and the arch editor the open-case note.
  const itemNotes = notes.filter(x => x.itemId === item.id && x.step === `svc:${item.id}:${slot.id}`
    && !(slot.id === 'shade' && x.id.startsWith('stump:')) && !(slot.id === 'arch' && x.kind === 'openCase'));
  const showMini = !isChart && (item.teeth.length > 0 || item.arch);
  const archItem = PRODUCTS[item.product].archItem;
  // Under the mini chart: the arch, or the teeth (a count past four, never a paragraph).
  const caption = archItem ? (item.arch ? archCaps(item.arch) : '')
    : item.teeth.length > 4 ? `${item.teeth.length} teeth` : item.product === 'bridge' ? spanText(item.teeth, n) : teethText(item.teeth, n);

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <StepHeading ref={ref} icon={PRODUCT_ICON[item.product]} kicker={kicker} title={questionFor(slot, item, n, lab.name, !!showMini)}>
            {slot.required && !slot.answered ? null : slot.src ? <span className="inline-flex items-center gap-1.5">Set · <SourceTag src={slot.src} /></span> : null}
          </StepHeading>
        </div>
        <div className="pt-0.5 flex-shrink-0"><RemoveService item={item} /></div>
      </div>
      <div className={showMini ? `grid grid-cols-[1fr_auto] ${wide ? 'gap-8' : 'gap-6'} items-start` : ''}>
        <div className="min-w-0">
          {panel.length > 0 && (wide ? <FactStrip item={item} slots={panel} /> : (
            <DefaultsPanel>
              {panel.map(p => <SlotEditor key={p.id} item={item} slot={p} compact />)}
            </DefaultsPanel>
          ))}
          <SlotEditor item={item} slot={slot} />
          <ServiceNote item={item} className="mt-6 pt-4 border-t border-[#F0EFF6]" />
          {itemNotes.length > 0 && (
            <div className="mt-5 space-y-2">
              {itemNotes.map(x => <NoteView key={x.id} note={x} onDismiss={() => dismissNote(x.id)} />)}
            </div>
          )}
        </div>
        {showMini && (
          <figure className={`flex flex-col items-center gap-2 ${wide ? 'w-[200px] p-3 rounded-2xl bg-[#F8F9FC] border border-[#ECECF2]' : 'pt-1'}`}>
            <MiniChart teeth={item.teeth} arch={archItem ? item.arch : undefined} pontics={item.bridge?.pontics} width={176} label={itemTitle(item, n)} />
            {caption && <figcaption className="max-w-[176px] text-center text-[11px] font-semibold text-[#3A3A4A] leading-snug">{caption}</figcaption>}
          </figure>
        )}
      </div>
    </div>
  );
});

const SLOT_ICON: Partial<Record<SlotId, LucideIcon>> = { material: Gem, splint: Link, type: Shapes, retention: Bolt, acrylic: Droplet };

/** Wide room: what this question builds on, as one row of fact pills; each opens its own editor below the row. */
function FactStrip({ item, slots }: { item: ServiceItem; slots: Slot[] }) {
  const [open, setOpen] = useState<SlotId | null>(null);
  const shown = slots.find(s => s.id === open);
  const panelId = `nc-facts-${item.id}`;
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">{slots.every(s => !s.required || s.answered) ? 'Already set' : 'Builds on'}</span>
        {slots.map(s => {
          const Icon = SLOT_ICON[s.id] ?? Check;
          const on = open === s.id;
          const gap = s.required && !s.answered;
          return (
            <button
              key={s.id}
              type="button"
              aria-expanded={on}
              aria-controls={on ? panelId : undefined}
              aria-label={`${s.label}: ${s.value || 'not set'}${s.src && !gap ? `, ${s.src}` : ''}`}
              onClick={() => setOpen(on ? null : s.id)}
              className={`inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-full border text-xs transition-colors motion-reduce:transition-none ${FOCUS} ${
                on ? 'bg-[#EEF4FF] border-[#3F6FE8]'
                  : gap ? 'bg-[#FFF8E1] border-[#F5D98B] hover:border-[#B45309]'
                    : 'bg-[#F8F9FC] border-[#E0E0E6] hover:border-[#3F6FE8] hover:bg-white'
              }`}
            >
              <Icon aria-hidden className={`w-3.5 h-3.5 flex-shrink-0 ${gap ? 'text-[#B45309]' : 'text-[#2F62D6]'}`} strokeWidth={1.75} />
              <span className="text-[#5A5A6A] whitespace-nowrap">{s.label}</span>
              <span className={`font-semibold max-w-[200px] truncate ${gap ? 'text-[#8A4B08]' : 'text-[#030213]'}`}>{s.value || 'Needs you'}</span>
              {s.src && !gap && <SourceTag src={s.src} />}
              <ChevronDown aria-hidden className={`w-3.5 h-3.5 flex-shrink-0 text-[#5A5A6A] transition-transform motion-reduce:transition-none ${on ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
      {shown && (
        <div id={panelId} className="mt-2 rounded-xl bg-[#F8F9FC] border border-[#ECECF2] p-3.5">
          <SlotEditor item={item} slot={shown} compact />
        </div>
      )}
    </div>
  );
}

export function NoteView({ note, onDismiss }: { note: { id: string; text: string; kind: string; caseId?: string }; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  if (note.kind === 'openCase') {
    return (
      <Notice tone="note" actions={<>
        <SecondaryButton onClick={() => setOpen(o => !o)}>{open ? 'Hide It' : 'View It'}</SecondaryButton>
        <SecondaryButton onClick={onDismiss}>Carry On</SecondaryButton>
      </>}>
        {note.text}
        {open && note.caseId && <OpenCaseSummary caseId={note.caseId} />}
      </Notice>
    );
  }
  return <Notice tone="note" onDismiss={onDismiss}>{note.text}</Notice>;
}
function OpenCaseSummary({ caseId }: { caseId: string }) {
  const row = getRow(caseId);
  if (!row) return null;
  return (
    <span className="block mt-2 px-3 py-2 rounded-lg bg-white border border-[#E0E0E6] text-xs text-[#1F1F2E]">
      <span className="font-semibold">{row.id}</span> · {row.service} · {row.status}{row.delivery ? ` · due ${fmtDay(fromISO(row.delivery))}` : ''}{row.dentist ? ` · ${row.dentist}` : ''}
    </span>
  );
}

// ─── Remove a service ────────────────────────────────────────────────────────

/** Has the user given this service any answer yet? An empty one goes without asking. */
const hasWork = (i: ServiceItem) =>
  i.teeth.length > 0 || !!i.arch || !!i.material || !!i.shade || !!i.type || !!i.stage || !!i.stages?.length || !!i.base || !!i.work || !!i.desc || i.photos.length > 0
  || !!i.requestedDelivery || Object.keys(i.aligner ?? {}).length > 0;

/** "Remove Crown" on the step (link) or an × in the left nav (icon), with a quick confirm. */
export function RemoveService({ item, variant = 'link' }: { item: ServiceItem; variant?: 'link' | 'icon' }) {
  const { removeItem, toast, user, readOnly } = useCase();
  const [confirm, setConfirm] = useState(false);
  if (readOnly) return null;
  const title = itemTitle(item, user.notation);
  const label = PRODUCTS[item.product].label;
  const remove = () => { setConfirm(false); removeItem(item.id); toast.info(`${title} removed.`); };
  const ask = () => (hasWork(item) ? setConfirm(c => !c) : remove());
  const confirmBox = (
    <span role="group" aria-label={`Remove ${title}?`} className="inline-flex items-center gap-2 text-xs text-[#1F1F2E]">
      Remove {title}? Its answers go too.
      <button type="button" onClick={remove} className={`px-2 py-1 rounded-md font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] ${FOCUS}`}>Remove</button>
      <button type="button" onClick={() => setConfirm(false)} className={`px-2 py-1 rounded-md font-semibold text-[#3A3A4A] border border-[#D4D4DD] bg-white hover:bg-[#F8F9FC] ${FOCUS}`}>Keep</button>
    </span>
  );
  if (variant === 'icon') {
    return (
      <span className="relative inline-flex">
        <button type="button" onClick={ask} aria-label={`Remove ${title}`} aria-expanded={confirm} title={`Remove ${label}`} className={`p-1 rounded text-[#6B6B7B] hover:text-[#B91C1C] hover:bg-[#FEF2F2] ${FOCUS}`}>
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
        {confirm && (
          <span className="absolute right-0 top-full mt-1 z-30 w-60 p-3 bg-white border border-[#E0E0E6] rounded-xl shadow-lg [&>span]:flex-wrap">
            {confirmBox}
          </span>
        )}
      </span>
    );
  }
  return confirm ? confirmBox : (
    <button type="button" onClick={ask} className={`inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] hover:underline rounded ${FOCUS}`}>
      <Trash2 className="w-3.5 h-3.5" aria-hidden />Remove {label}
    </button>
  );
}

// ─── Slot editors ────────────────────────────────────────────────────────────

export function SlotEditor({ item, slot, compact }: { item: ServiceItem; slot: Slot; compact?: boolean }) {
  switch (slot.id) {
    case 'teeth': return <TeethEditor item={item} />;
    case 'extract': return <TeethEditor item={item} extraction />;
    case 'arch': return <ArchEditor item={item} />;
    case 'material': return <MaterialEditor item={item} compact={compact} />;
    case 'shade': return <ShadeEditor item={item} />;
    case 'photos': return <PhotosEditor item={item} />;
    case 'implantRecord': return <ImplantDecision item={item} />;
    case 'remake': return <RemakeDecision item={item} />;
    case 'labCheck': return <LabCheck item={item} />;
    case 'under18': return <Under18 item={item} />;
    case 'desc': return <DescEditor item={item} />;
    case 'wings': return <WingsEditor item={item} />;
    case 'stages': return <StagesEditor item={item} />;
    case 'deliveryDate': return <DeliveryDateEditor item={item} />;
    case 'alignerPlan': case 'alignerFindings': case 'alignerPerio': case 'alignerOcclusion':
      return <AlignerEditor item={item} group={slot.id} />;
    default: return <ChipSlot item={item} slot={slot} compact={compact} />;
  }
}

/** Every chip-only slot: one tap answers it. */
function ChipSlot({ item, slot, compact }: { item: ServiceItem; slot: Slot; compact?: boolean }) {
  const { ctx, lab, updateItem } = useCase();
  const wide = useRoom() === 'wide';
  const e = effective(item, ctx);
  const set = (patch: Partial<ServiceItem>) => updateItem(item.id, i => ({ ...i, ...patch, reopen: i.reopen?.filter(r => r !== slot.id) }));
  const avail = (product: ProductId, id: string) => optionAvail(lab, product, id, ctx.funding, item);
  // An answer's lead time ("7 days"); answers the lab has no entry for stay blank.
  const daysSub = (patch: Partial<ServiceItem>) => {
    const p = priceOf({ ...item, ...patch }, ctx, false);
    return p.kind !== 'none' && p.ta != null ? plural(p.ta, 'day') : undefined;
  };
  let label = slot.label;
  let options: PicOption[] = [];
  let value: string | undefined;
  let onChange: (id: string) => void = () => {};
  let extra: ReactNode = null;

  switch (slot.id) {
    case 'splint':
      options = [
        { id: 'separate', label: 'Separate', tag: e.splint === 'separate' && !item.splint ? 'Lab standard' : undefined, pic: <SplintPic /> },
        { id: 'splinted', label: 'Splinted', pic: <SplintPic joined /> },
      ];
      value = e.splint; onChange = id => set({ splint: id as 'separate' | 'splinted' });
      break;
    case 'type':
      options = OPTIONS[item.product].map(o => {
        const a = avail(item.product, o.id);
        return { id: o.id, label: o.name, disabled: !a.ok, reason: a.reason, tag: o.id === e.type && !item.type ? e.typeSrc : undefined, sub: a.ok ? daysSub({ type: o.id }) : undefined };
      });
      value = item.reopen?.includes('type') ? undefined : e.type; onChange = id => set({ type: id, typeSrc: 'You' });
      break;
    case 'stage':
      // Partial dentures only: a full denture plans its stages (StagesEditor).
      options = PARTIAL_STAGES.map(o => ({
        id: o.id, label: o.name,
        disabled: o.id === 'framework' && item.base !== 'chrome', reason: 'Only for a cobalt-chrome base.',
        sub: o.id === 'framework' ? '10 working days' : undefined,
      }));
      value = item.stage; onChange = id => set({ stage: id, stageSrc: 'You' });
      break;
    case 'acrylic':
      options = ACRYLIC_OPTIONS.map(o => ({ id: o, label: o, disabled: e.acrylicLocked && o !== 'Plain pink', reason: 'NHS dentures use plain pink.', tag: o === e.acrylic ? e.acrylicSrc : undefined, pic: <AcrylicDot veined={o === 'Veined pink'} /> }));
      value = e.acrylic; onChange = id => set({ acrylic: id });
      break;
    case 'mould':
      options = MOULD_OPTIONS.map(o => ({ id: o, label: o, tag: o === e.mould && !item.mould ? 'Lab standard' : undefined }));
      value = e.mould; onChange = id => set({ mould: id });
      break;
    case 'postdam':
      options = POSTDAM_OPTIONS.map(o => ({ id: o, label: o }));
      value = item.postdam; onChange = id => set({ postdam: id });
      break;
    case 'base':
      options = OPTIONS.partial.map(o => { const a = avail('partial', o.id); return { id: o.id, label: o.name, disabled: !a.ok, reason: a.reason, sub: a.ok ? daysSub({ base: o.id, stage: 'finish' }) : undefined }; });
      value = item.reopen?.includes('base') ? undefined : item.base;
      onChange = id => set({ base: id, stage: item.stage === 'framework' && id !== 'chrome' ? undefined : item.stage });
      break;
    case 'design':
      options = PARTIAL_DESIGNS.map(o => ({ id: o.id, label: o.name, sub: o.id === 'propose' ? '+2 working days' : undefined }));
      value = item.design; onChange = id => set({ design: id });
      break;
    case 'work':
      options = OPTIONS.reline.map(o => { const a = avail('reline', o.id); return { id: o.id, label: o.name, disabled: !a.ok, reason: a.reason, sub: a.ok ? daysSub({ work: o.id }) : undefined }; });
      value = item.reopen?.includes('work') ? undefined : item.work;
      onChange = id => set({ work: id, teeth: id === 'addtooth' ? item.teeth : [], teethDone: id === 'addtooth' ? item.teethDone : false });
      extra = <p className="text-xs text-[#5A5A6A] mt-3">The old denture goes to the lab in the box.</p>;
      break;
    case 'inlayType':
      options = [{ id: 'inlay', label: 'Inlay', pic: <InlayPic /> }, { id: 'onlay', label: 'Onlay', pic: <InlayPic onlay /> }];
      value = item.inlayType; onChange = id => set({ inlayType: id as 'inlay' | 'onlay' });
      break;
    case 'system':
      options = IMPLANT_SYSTEMS.map(s => ({ id: s.name, label: s.name, tag: s.name === e.system && !item.system ? e.systemSrc : undefined }));
      value = e.system; onChange = id => set({ system: id, systemSrc: 'You', platform: undefined, platformSrc: undefined, scanBody: undefined });
      if (implantOnRecord(item, ctx.patient)) {
        const rec = implantOnRecord(item, ctx.patient)!;
        extra = <p className="text-xs text-[#5A5A6A] mt-3">Patient record: {rec.system} · {rec.platform} · {rec.diameter}, placed {fmtShort(fromISO(rec.placed))} {fromISO(rec.placed).getFullYear()}.</p>;
      }
      break;
    case 'platform': {
      const sys = IMPLANT_SYSTEMS.find(s => s.name === e.system);
      options = (sys?.platforms ?? []).map(p => ({ id: p, label: p, tag: p === e.platform && !item.platform ? e.platformSrc : undefined }));
      value = e.platform; onChange = id => set({ platform: id, platformSrc: 'You' });
      break;
    }
    case 'scanBody': {
      const sys = IMPLANT_SYSTEMS.find(s => s.name === e.system);
      options = (sys?.scanBodies ?? IMPLANT_SYSTEMS[0].scanBodies).map(b => ({ id: b, label: b }));
      value = item.scanBody; onChange = id => set({ scanBody: id });
      extra = <p className="text-xs text-[#5A5A6A] mt-3">Never assumed: the lab designs to the scan body in the scan.</p>;
      break;
    }
    case 'retention':
      options = [
        { id: 'screw', label: 'Screw-retained', tag: !item.retention ? 'Lab standard' : undefined, sub: daysSub({ retention: 'screw' }), pic: <Bolt aria-hidden className="w-3.5 h-3.5" strokeWidth={1.75} /> },
        { id: 'cement', label: 'Cement-retained', sub: avail('implant', 'cement').ok ? daysSub({ retention: 'cement' }) : undefined, disabled: !avail('implant', 'cement').ok, reason: avail('implant', 'cement').reason, pic: <Droplet aria-hidden className="w-3.5 h-3.5" strokeWidth={1.75} /> },
      ];
      value = e.retention; onChange = id => set({ retention: id as 'screw' | 'cement', abutment: id === 'screw' ? undefined : item.abutment });
      break;
    case 'abutment':
      options = ABUTMENTS.map(a => ({ id: a, label: a }));
      value = item.abutment; onChange = id => set({ abutment: id });
      break;
    case 'remakeReason':
      options = REMAKE_REASONS.map(r => ({ id: r, label: r }));
      value = item.remakeReason;
      onChange = id => updateItem(item.id, i => {
        // The original's shade is only copied when the shade wasn't the problem.
        const prior = remakeCandidate(i, ctx.patient, ctx.now);
        const copyShade = id !== 'Shade' && prior?.shade;
        return {
          ...i, remakeReason: id,
          shade: copyShade ? prior!.shade : i.shadeSrc === 'Made the original' ? undefined : i.shade,
          shadeSrc: copyShade ? 'Made the original' : i.shadeSrc === 'Made the original' ? undefined : i.shadeSrc,
        };
      });
      break;
  }
  if (wide) {
    const form = WIDE_FORM[slot.id] ?? 'list';
    return (
      <div>
        {compact && <FieldLabel src={slot.src}>{label}</FieldLabel>}
        <WideChoice label={label} options={options} value={value} onChange={onChange} form={compact && form === 'list' ? 'pills' : form} small={compact} caption={!compact} />
        {!compact && extra}
      </div>
    );
  }
  return (
    <div>
      {compact && <FieldLabel src={slot.src}>{label}</FieldLabel>}
      <ChoiceChips label={label} options={options} value={value} onChange={onChange} size={compact ? 'sm' : 'md'} />
      {!compact && extra}
    </div>
  );
}

/** How a chip slot reads in the wide room; anything not listed is one-line rows. */
const WIDE_FORM: Partial<Record<SlotId, 'segment' | 'pills'>> = {
  splint: 'segment', inlayType: 'segment', retention: 'segment', acrylic: 'segment', platform: 'segment', remakeReason: 'pills',
};

// ─── Teeth ───────────────────────────────────────────────────────────────────

function TeethEditor({ item, extraction }: { item: ServiceItem; extraction?: boolean }) {
  const { user, patient, draft, readOnly, updateItem, doneAndAdvance, answerInPlace, addService, removeItem } = useCase();
  const wide = useRoom() === 'wide';
  // The chart runs across the top of the step and fills it, up to this.
  const chartMax = useContext(ChartWidthContext) ?? (wide ? 720 : 600);
  const n = user.notation;
  const [msg, setMsg] = useState<string | null>(null);
  const [allChips, setAllChips] = useState(false);
  const isBridge = item.product === 'bridge' && !extraction;
  const single = !extraction && (item.product === 'implant' || item.product === 'inlay' || item.product === 'reline');
  const limit = extraction || item.product === 'partial' || item.product === 'reline'
    ? (item.arch === 'upper' || item.arch === 'lower' ? item.arch : undefined) : undefined;
  const blocksMissing = extraction || ['crown', 'veneer', 'inlay'].includes(item.product);
  const missing = patient.missing ?? [];
  const implants = (patient.implants ?? []).map(i => i.tooth);
  const otherTeeth = draft.items.filter(i => i.id !== item.id && !PRODUCTS[i.product].archItem).flatMap(i => i.teeth);
  const teeth = extraction ? item.extract ?? [] : item.teeth;
  const noun = PRODUCTS[item.product].noun;

  /** Teeth changed: the remake and implant checks run again, and copied values go. */
  const resetChecks = (i: ServiceItem): ServiceItem => ({
    ...i, remake: undefined, remakeReason: undefined, implantDecision: undefined,
    material: i.matSrc === 'Made the original' ? undefined : i.material,
    matSrc: i.matSrc === 'Made the original' ? undefined : i.matSrc,
    shade: i.shadeSrc === 'Made the original' ? undefined : i.shade,
    shadeSrc: i.shadeSrc === 'Made the original' ? undefined : i.shadeSrc,
  });

  // Guided (LiveTeethContext): what's tapped is the answer straight away, a bridge once its span works,
  // and the step stays put while several teeth are picked. Elsewhere teeth wait for "Done".
  const live = useContext(LiveTeethContext);
  const settle = (i: ServiceItem): ServiceItem => extraction
    ? { ...i, extractDone: (i.extract?.length ?? 0) > 0 }
    : { ...i, teethDone: isBridge ? !bridgeIssue(i) : i.teeth.length > 0 };
  /** Every change a tap makes to the teeth. */
  const put = (patch: Partial<ServiceItem> | ((i: ServiceItem) => ServiceItem)) => {
    if (!live) { updateItem(item.id, patch); return; }
    answerInPlace(() => updateItem(item.id, i => settle(typeof patch === 'function' ? patch(i) : { ...i, ...patch })));
  };
  // A selection tapped before (still waiting for "Done") counts as soon as the card shows it.
  useEffect(() => {
    if (!live || readOnly || single) return;
    const waiting = extraction ? !item.extractDone : !item.teethDone;
    const valid = extraction ? !!settle(item).extractDone : settle(item).teethDone;
    if (waiting && valid && (extraction || isBridge || item.teethSrc === 'You')) put(i => i);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (id: string) => {
    setMsg(null);
    if (limit && jawOf(id) !== limit) { setMsg(`This ${noun} is for the ${limit} arch.`); return; }
    if (extraction) {
      if (missing.includes(id)) { setMsg(`${id} is recorded as missing, so it can’t be extracted.`); return; }
      const next = teeth.includes(id) ? teeth.filter(t => t !== id) : [...teeth, id];
      put({ extract: next, extractDone: false });
      return;
    }
    if (blocksMissing && missing.includes(id)) { setMsg(`${id} is recorded as missing. Use Bridge or Implant Crown for this site.`); return; }
    if (isBridge) { tapBridge(id); return; }
    if (single) {
      updateItem(item.id, i => resetChecks({ ...i, teeth: [id], teethDone: true, teethSrc: 'You' }));
      return;
    }
    put(i => resetChecks({ ...i, teeth: i.teeth.includes(id) ? i.teeth.filter(t => t !== id) : [...i.teeth, id], teethDone: false, teethSrc: 'You' }));
  };

  const tapBridge = (id: string) => {
    const b = item.bridge ?? { pontics: [] };
    const withDefaults = (span: string[], keep: string[]) => {
      const interior = span.slice(1, -1);
      const pontics = span.filter(t => missing.includes(t) || keep.includes(t) || (interior.includes(t) && !item.teeth.includes(t)));
      return pontics;
    };
    if (!b.a) {
      put({ bridge: { a: id, pontics: [] }, teeth: [id], teethDone: false });
      return;
    }
    if (!b.b) {
      if (id === b.a) { put({ bridge: { pontics: [] }, teeth: [], teethDone: false }); return; }
      if (jawOf(id) !== jawOf(b.a)) { setMsg(BRIDGE_ERRORS.arch); return; }
      const span = spanBetween(b.a, id);
      if (span.length > 6) { setMsg(BRIDGE_ERRORS.long); return; }
      put({ bridge: { a: b.a, b: id, pontics: withDefaults(span, []) }, teeth: span, teethDone: false });
      return;
    }
    if (item.teeth.includes(id)) {
      if (missing.includes(id)) { setMsg(`${id} is recorded as missing, so it stays a pontic.`); return; }
      const pontics = b.pontics.includes(id) ? b.pontics.filter(t => t !== id) : [...b.pontics, id];
      put({ bridge: { ...b, pontics }, teethDone: false });
      return;
    }
    if (jawOf(id) !== jawOf(b.a)) { setMsg(BRIDGE_ERRORS.arch); return; }
    const order = jawOf(id) === 'upper' ? 'upper' : 'lower';
    const all = [b.a, b.b, id];
    const ord = (t: string) => (order === 'upper' ? ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'] : ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']).indexOf(t);
    const sorted = all.sort((x, y) => ord(x) - ord(y));
    const span = spanBetween(sorted[0], sorted[2]);
    if (span.length > 6) { setMsg(BRIDGE_ERRORS.long); return; }
    const newInterior = span.filter(t => !item.teeth.includes(t) && t !== id);
    put({ bridge: { a: sorted[0], b: sorted[2], pontics: [...b.pontics, ...newInterior, ...span.filter(t => missing.includes(t) && !b.pontics.includes(t))] }, teeth: span, teethDone: false });
  };

  const setJaw = (ids: string[]) => {
    const allowed = ids.filter(t => !(blocksMissing && missing.includes(t)) && (!limit || jawOf(t) === limit));
    if (extraction) { put({ extract: allowed, extractDone: false }); return; }
    put(i => resetChecks({ ...i, teeth: allowed, teethDone: false, teethSrc: 'You' }));
  };

  const issue = isBridge ? bridgeIssue(item) : null;
  const parts = isBridge ? bridgeParts(item) : null;
  const doneText = isBridge
    ? (item.teeth.length > 1 ? `Done: ${spanText(item.teeth, n)}` : 'Tap the Other End')
    : teeth.length > 4 ? `Done: ${teeth.length} teeth` : teeth.length ? `Done: ${teethText(teeth, n)}` : 'Select a Tooth';
  const canDone = isBridge ? !issue : teeth.length > 0;
  const onDone = () => doneAndAdvance(() => updateItem(item.id, extraction ? { extractDone: true } : { teethDone: true }));
  const next = useNextName(item.id, extraction ? 'extract' : 'teeth');
  // Wide room, many teeth: in number order, the first dozen chips and a "+18 More" toggle, never a wall of chips.
  // One page keeps tap order.
  const sorted = wide ? [...teeth].sort((a, b) => Number(a) - Number(b)) : teeth;
  const capChips = wide && sorted.length > CHIP_CAP + 2;
  const chips = capChips && !allChips ? sorted.slice(0, CHIP_CAP) : sorted;

  return (
    <div className="space-y-4">
      {/* The horizontal chart on top at full width, its legend under it; what's picked reads back below. */}
      <div
        className={`rounded-xl bg-[#F8F9FC] border border-[#ECECF2] ${wide ? 'mx-auto px-4 pt-3 pb-2.5' : 'px-2.5 pt-2.5 pb-2'}`}
        style={{ maxWidth: chartMax }}
      >
        <TeethChart
          selected={teeth}
          pontics={parts?.pontics}
          missing={missing}
          implants={implants}
          otherTeeth={otherTeeth}
          limitArch={limit}
          onTooth={tap}
          onSetTeeth={!single && !isBridge ? setJaw : undefined}
          notation={n}
          // A sent case: the chart is a picture of the answer, nothing to hover or tap.
          readOnly={readOnly}
          label={teeth.length ? `Selected teeth: ${teethText(teeth, n)}` : 'No teeth selected'}
        />
        <div className="mt-2.5 pt-2 border-t border-[#ECECF2] flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex-1 min-w-0">
            <ChartLegend items={[
              'selected',
              ...(isBridge ? ['pontic' as const] : []),
              ...(missing.length ? ['missing' as const] : []),
              ...(implants.length ? ['implant' as const] : []),
              ...(otherTeeth.length ? ['other' as const] : []),
            ]} />
          </div>
          <NotationSelect />
        </div>
      </div>
      <div className="space-y-4">
        {/* No resin-bonded (Maryland) switch and no "tap the other end" line here: the user removed both. */}
        {/* In the wide room everything under the chart sits centred with it. */}
        <div role="status" aria-live="polite" className={`min-h-[1.5rem] ${wide ? 'text-center [&>div>div]:justify-center' : ''}`}>
          {isBridge ? (
            // One end tapped: just that tooth (the arrow's hint says what's next; sr-only says it here too).
            // Both ends: the span as pills, like the crown's teeth: the units, then each tooth (an abutment
            // filled, a pontic dashed and named, as in the chart's legend; tapping one switches it, as on the
            // chart). Only a cantilever says its kind: conventional is the usual.
            item.teeth.length > 1 && parts ? (
              <div>
                <p className="sr-only">{bridgeReadback(item, n)}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0EFF6] border border-[#E0E0E6] text-xs font-semibold text-[#3A3A4A]">
                    <Link2 className="w-3.5 h-3.5" aria-hidden />{plural(parts.span.length, 'unit')}
                  </span>
                  {parts.span.map(t => {
                    const pontic = parts.pontics.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => tap(t)}
                        aria-label={`${toothText(t, n)}, ${pontic ? 'pontic' : 'abutment'}. Make it ${pontic ? 'an abutment' : 'a pontic'}.`}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold text-[#0E5A73] hover:bg-[#D4EFF8] ${pontic ? 'bg-white border-dashed border-[#5BB8D6]' : 'bg-[#E6F6FB] border-[#9ED7EA]'} ${FOCUS}`}
                      >
                        {toothText(t, n)}{pontic && <span className="font-medium text-[#3F7F95]">Pontic</span>}
                      </button>
                    );
                  })}
                  {parts.cantilever && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-[#E0E0E6] text-xs font-semibold text-[#3A3A4A]">Cantilever</span>
                  )}
                </div>
              </div>
            )
              : item.teeth.length ? (
                <span className="inline-flex px-2.5 py-1 rounded-full bg-[#E6F6FB] border border-[#9ED7EA] text-xs font-semibold text-[#0E5A73]">
                  {toothText(item.teeth[0], n)}<span className="sr-only">. Now tap the other end of the bridge.</span>
                </span>
              )
              : <p className="text-sm text-[#5A5A6A]">Tap one end of the bridge, then the other. The teeth between become pontics. Tap a tooth in the span to switch it between abutment and pontic.</p>
          ) : teeth.length ? (
            <div>
              {wide && teeth.length > 4 && <p className="mb-1.5 text-xs font-semibold text-[#3A3A4A]">{teeth.length} teeth selected</p>}
              <div className="flex flex-wrap gap-1.5">
                {chips.map(t => (
                  <button key={t} type="button" onClick={() => tap(t)} aria-label={`Remove ${toothText(t, n)}`} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E6F6FB] border border-[#9ED7EA] text-xs font-semibold text-[#0E5A73] hover:bg-[#D4EFF8] ${FOCUS}`}>
                    {toothText(t, n)} <span aria-hidden>×</span>
                  </button>
                ))}
                {capChips && (
                  <button type="button" onClick={() => setAllChips(a => !a)} aria-expanded={allChips} className={`inline-flex items-center px-2.5 py-1 rounded-full border border-[#D4D4DD] bg-white text-xs font-semibold text-[#2F62D6] hover:border-[#3F6FE8] hover:bg-[#F8FAFF] ${FOCUS}`}>
                    {allChips ? 'Show Fewer' : `+${sorted.length - CHIP_CAP} More`}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#5A5A6A]">{single ? 'Tap a tooth.' : 'Tap each tooth, or “Select Upper Arch” / “Select Lower Arch” for the whole jaw.'}</p>
          )}
        </div>
        {msg && <Notice tone="decision" role="status">{msg}</Notice>}
        {isBridge && issue && issue.kind !== 'incomplete' && issue.kind !== 'noPontic' && <Notice tone="block">{BRIDGE_ERRORS[issue.kind]}</Notice>}
        {isBridge && issue?.kind === 'noPontic' && (
          <Notice tone="decision" actions={<>
            <SecondaryButton onClick={() => {
              const abut = parts!.abutments;
              removeItem(item.id);
              addService('crown', { teeth: abut, teethDone: true, teethSrc: 'You' });
            }}>Make Them {abut2(parts!.abutments.length)} Crowns</SecondaryButton>
            <SecondaryButton onClick={() => updateItem(item.id, { bridge: { pontics: [] }, teeth: [], teethDone: false })}>Change Teeth</SecondaryButton>
          </>}>
            That’s {parts!.abutments.length === 2 ? 'two abutments' : `${parts!.abutments.length} abutments`} and no pontic.
          </Notice>
        )}
        <div className="flex items-center gap-3">
          <StepArrow show={!single} run={onDone} disabled={!canDone} label={doneText} next={next} hint={isBridge ? 'Tap the other end of the bridge' : 'Tap a tooth first'} />
          {single && teeth.length > 0 && <p className="text-xs text-[#5A5A6A]">Tap another tooth to change it.</p>}
        </div>
        {extraction && <p className="text-xs text-[#5A5A6A]">The lab removes these teeth from the model and sets the denture teeth in their place.</p>}
      </div>
    </div>
  );
}
const abut2 = (k: number) => (k === 2 ? 'Two' : k === 3 ? 'Three' : String(k));

/** The tooth numbering the charts and teeth read in (the product's three). Kept per user for next time. */
export function NotationSelect() {
  const { user } = useCase();
  const id = useId();
  return (
    // Tiny: the words and a small arrow, no box ("Numbering FDI ⌄"). The range shows in each option's tooltip.
    <span className="relative inline-flex items-center gap-1 text-[11px] leading-4">
      <label htmlFor={id} className="text-[#5A5A6A]">Numbering</label>
      <select
        id={id}
        value={user.notation}
        onChange={e => setNotation(user.id, e.target.value as Notation)}
        title={NOTATIONS.find(o => o.id === user.notation)?.range}
        // As wide as the chosen word (a select is otherwise as wide as its longest option): the arrow sits right after it.
        style={{ width: `calc(${(NOTATIONS.find(o => o.id === user.notation)?.label ?? '').length}ch + 16px)` }}
        className={`appearance-none bg-transparent pr-3.5 font-semibold text-[#030213] hover:text-[#2F62D6] cursor-pointer rounded ${FOCUS}`}
      >
        {NOTATIONS.map(o => <option key={o.id} value={o.id} title={o.range}>{o.label}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-0 w-3 h-3 text-[#5A5A6A]" strokeWidth={2} />
    </span>
  );
}
const CHIP_CAP = 12;

function WingsEditor({ item }: { item: ServiceItem }) {
  const { updateItem, doneAndAdvance, user } = useCase();
  const abutments = bridgeParts(item).abutments;
  const wings = item.wings ?? [];
  const next = useNextName(item.id, 'wings');
  return (
    <div className="space-y-4">
      <ToggleChips
        label="Teeth that get a wing"
        options={abutments.map(t => ({ id: t, label: toothText(t, user.notation) }))}
        values={wings}
        onToggle={id => updateItem(item.id, { wings: wings.includes(id) ? wings.filter(w => w !== id) : [...wings, id], wingsDone: false })}
      />
      <StepArrow
        disabled={wings.length === 0}
        run={() => doneAndAdvance(() => updateItem(item.id, { wingsDone: true }))}
        label={wings.length ? `Done: ${wings.length === 1 ? 'wing on' : 'wings on'} ${[...wings].sort().join(', ')}` : 'Select a Tooth'}
        next={next}
        hint="Pick at least one tooth"
      />
    </div>
  );
}

// ─── Arch ────────────────────────────────────────────────────────────────────

function ArchEditor({ item }: { item: ServiceItem }) {
  const { ctx, updateItem, notes, dismissNote, doneAndAdvance, user } = useCase();
  const wide = useRoom() === 'wide';
  // A full denture is picked as Upper, Lower or Both (the portal's rule), like a retainer, aligners or whitening trays.
  const both = item.product === 'retainer' || item.product === 'aligner' || item.product === 'whitening' || item.product === 'denture';
  // A full denture for the arch of the patient's next stage picks up that plan (and drops it for another arch).
  const pick = (jaw: 'upper' | 'lower' | 'both') => updateItem(item.id, i => seedDenturePlan({
    ...i, arch: jaw, archSrc: 'You',
    teeth: i.product === 'partial' || i.product === 'reline' ? i.teeth.filter(t => jaw === 'both' || jawOf(t) === jaw) : i.teeth,
  }, ctx));
  const onArch = (jaw: 'upper' | 'lower') => {
    if (both && item.arch && item.arch !== jaw) {
      if (item.arch === 'both') { pick(jaw === 'upper' ? 'lower' : 'upper'); return; }
      pick('both');
      return;
    }
    pick(jaw);
  };
  const open = notes.find(x => x.itemId === item.id && x.kind === 'openCase');
  // Guided gives the chart its own column (ChartWidthContext): it fills it, up to 560 px, with the choices under it.
  // Elsewhere it's the small 240 px chart beside the choices.
  const chartMax = useContext(ChartWidthContext);
  return (
    <div className={chartMax ? 'space-y-3' : 'flex flex-wrap gap-x-8 gap-y-3 items-start'}>
      {chartMax
        ? <div className="w-full mx-auto" style={{ maxWidth: Math.min(chartMax, 560) }}><TeethChart selected={[]} arch={item.arch} archMode onArch={onArch} notation={user.notation} /></div>
        : <TeethChart selected={[]} arch={item.arch} archMode onArch={onArch} width={240} notation={user.notation} />}
      <div className={chartMax ? 'space-y-3' : 'flex-1 min-w-[200px] space-y-4 pt-1'}>
        {wide ? (
          // The numbering sits beside the arch choice when the chart has its own column.
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <WideChoice
            label="Arch"
            form="segment"
            value={item.arch}
            onChange={id => pick(id as 'upper' | 'lower' | 'both')}
            options={[
              { id: 'upper', label: 'Upper', pic: <ArchPic jaw="upper" /> }, { id: 'lower', label: 'Lower', pic: <ArchPic jaw="lower" /> },
              ...(both ? [{ id: 'both', label: 'Both', pic: <ArchPic jaw="both" /> }] : []),
            ]}
          />
          {chartMax && <NotationSelect />}
          </div>
        ) : (
          <ChoiceChips
            label="Arch"
            value={item.arch}
            onChange={id => pick(id as 'upper' | 'lower' | 'both')}
            options={[{ id: 'upper', label: 'Upper' }, { id: 'lower', label: 'Lower' }, ...(both ? [{ id: 'both', label: 'Both' }] : [])]}
          />
        )}
        <p className="text-xs text-[#5A5A6A]">{both ? 'Tap “Select Upper Arch” or “Select Lower Arch” on the chart (both for both), or pick it here.' : 'Tap “Select Upper Arch” or “Select Lower Arch” on the chart, or pick it here.'}</p>
        {open && <NoteView note={open} onDismiss={() => doneAndAdvance(() => dismissNote(open.id))} />}
      </div>
    </div>
  );
}

// ─── Denture stages ──────────────────────────────────────────────────────────

/**
 * A full denture's plan. Staged: one row per stage, in order, each Not Now ·
 * Order · Done Elsewhere; an ordered stage takes the day it's needed back
 * (today or later, the lab's suggestion filled in), a stage done elsewhere an
 * optional done-on day, and a past day typed for an order flips the stage to
 * Done Elsewhere. Stages done on the patient's earlier case read "Done here ·
 * CAS-…" and can't change. Straight to Finish and Immediate: one Finish day.
 * Several rows, so "that's it" is the round arrow (as for teeth). A sent case
 * shows the plan without controls.
 */
function StagesEditor({ item }: { item: ServiceItem }) {
  const { ctx, lab, readOnly, updateItem, answerInPlace } = useCase();
  if (readOnly) return <StagePlanView item={item} />;
  // The main clinic portal's own picker (components/DentureStages): the five stages to tick, each with its
  // delivery date, or "Done elsewhere" with an optional done-on date. No treatment switch, no per-row choices.
  const plan = stagePlan(item);
  const follow = plan.filter(s => s.state === 'here');
  const picked = plan.filter(s => s.state !== 'here');
  const idOf = (name: string) => DENTURE_STAGES.find(s => s.name === name)!.id;
  const dates = Object.fromEntries(picked.filter(s => s.date).map(s => [stageName(s.id), s.date!]));
  // A stage done on the patient's earlier case shows locked, as the portal shows a stage already on the case.
  const existing: StageRow[] = follow.map(s => ({ stage: stageName(s.id), date: s.date ?? null, status: 'delivered', orderIndex: 0, doneEarlier: false, followUp: true }));
  // Every tick or date is the answer as it's made (like the teeth): the step stays put while the plan is built.
  const onChange = (stages: string[], nextDates: Record<string, string>, done: string[]) => answerInPlace(() => updateItem(item.id, i => ({
    ...i, treatment: 'staged', stage: undefined, stagesDone: true, reopen: i.reopen?.filter(r => r !== 'stages'),
    stages: [...follow, ...stages.map(n => ({ id: idOf(n), state: done.includes(n) ? 'elsewhere' as const : 'order' as const, date: nextDates[n] || undefined }))],
  })));
  const unmade = picked.filter(s => s.state === 'order' && !optionAvail(lab, 'denture', s.id, ctx.funding).ok);
  return (
    <div className="space-y-3">
      {follow[0]?.caseId && (
        <p className="flex items-center gap-1.5 text-xs text-[#3A3A4A]">
          <History className="w-3.5 h-3.5 text-[#2F62D6] flex-shrink-0" strokeWidth={1.75} aria-hidden />
          Continues {follow[0].caseId} at {lab.name}: the lab has the models.
        </p>
      )}
      <StageDatePicker
        stages={picked.map(s => stageName(s.id))}
        dates={dates}
        doneElsewhere={picked.filter(s => s.state === 'elsewhere').map(s => stageName(s.id))}
        existing={existing}
        onChange={onChange}
        today={toISO(ctx.now)}
        dense
      />
      {unmade.length > 0 && <Notice tone="block">{lab.name} doesn’t make {andWords(unmade.map(s => stageName(s.id)))}.</Notice>}
    </div>
  );
}

/**
 * A plan without controls (Review, a sent case): each stage in play with its
 * day, done-here and done-elsewhere tagged. Works outside a case page too (the
 * AI page's preview), on the demo clock.
 */
export function StagePlanView({ item, small }: { item: ServiceItem; small?: boolean }) {
  const now = useContext(CaseContext)?.ctx.now ?? demoNow();
  const treatment = dentureTreatment(item);
  const plan = stagePlan(item);
  const today = toISO(now);
  const text = small ? 'text-xs' : 'text-sm';
  if (!plan.length) return <p className={`${text} text-[#5A5A6A]`}>No stage ordered yet</p>;
  // A done-on day from another year says its year.
  const on = (iso: string) => { const d = fromISO(iso); return `on ${fmtDay(d)}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`; };
  return (
    <ul aria-label="Stages" className="space-y-1.5">
      {plan.map(s => (
        <li key={s.id} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${text}`}>
          {/* Numbered as in the editor: by the stage's place among the five. */}
          <StageDot n={treatment === 'staged' ? DENTURE_STAGES.findIndex(x => x.id === s.id) + 1 : 1} row={s} today={today} small />
          <span className="font-semibold text-[#030213]">{treatment === 'staged' ? stageName(s.id) : treatmentName(treatment)}</span>
          {s.state === 'order' && <span className="text-[#4A4A5A]">{s.date ? `needed by ${fmtDay(fromISO(s.date))}` : 'day not picked'}</span>}
          {s.state === 'here' && <SourceTag src={`Done here${s.caseId ? ` · ${s.caseId}` : ''}`} />}
          {s.state === 'elsewhere' && <SourceTag src="Done elsewhere" />}
          {s.state === 'elsewhere' && s.date && <span className="text-[#4A4A5A]">{on(s.date)}</span>}
        </li>
      ))}
    </ul>
  );
}

/** The stage's marker: a number while it's Not now or ordered (amber "!" without a good day), a check once it's done here or elsewhere. */
function StageDot({ n, row, today, small }: { n: number; row?: StagePlan; today: string; small?: boolean }) {
  const size = small ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-[11px] mt-0.5';
  if (row?.state === 'order' && (!row.date || row.date < today)) {
    // Pending: the orange ripple, in the same box as the numbers so the names stay in line.
    return <span className={`${small ? 'w-4 h-4' : 'w-6 h-6 mt-0.5'} flex-shrink-0 flex items-center justify-center`}><StateIcon state="gap" size="sm" /></span>;
  }
  const tone = !row ? 'border border-dashed border-[#C9C9D6] bg-white text-[#6B6B7B]'
    : row.state === 'order' ? 'bg-[#3F6FE8] text-white'
      : row.state === 'here' ? 'bg-[#2E7D32] text-white'
        : 'bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32]';
  return (
    <span aria-hidden className={`${size} rounded-full flex-shrink-0 flex items-center justify-center font-bold tabular-nums ${tone}`}>
      {row && row.state !== 'order' ? <Check className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={3} /> : n}
    </span>
  );
}


// ─── Material ────────────────────────────────────────────────────────────────

function MaterialEditor({ item, compact }: { item: ServiceItem; compact?: boolean }) {
  const { ctx, lab, draft, updateItem, openDrawer, toast } = useCase();
  const wide = useRoom() === 'wide';
  const e = effective(item, ctx);
  const opts = materialOptions(item);
  const reopened = item.reopen?.includes('material');
  const units = unitsOf(item);
  const chip = (id: string): PicOption => {
    const a = optionAvail(lab, item.product, id, ctx.funding, item);
    // Each answer's lead time with this lab ("7 days"), fast-track included.
    const p = priceOf({ ...item, material: id }, ctx, draft.fastTrack);
    const days = p.ta != null ? plural(p.ta, 'day') : undefined;
    return {
      id, label: optionName(item.product, id),
      sub: a.ok ? days : undefined,
      disabled: !a.ok, reason: a.reason,
      tag: id === e.material && e.matSrc !== 'You' ? e.matSrc : undefined,
      pic: wide && !compact ? <MaterialDot id={id} /> : undefined,
    };
  };
  let ids: string[];
  if (item.ambiguous) ids = opts.map(o => o.id);
  else {
    const available = opts.filter(o => optionAvail(lab, item.product, o.id, ctx.funding, item).ok).map(o => o.id);
    const first = e.material && available.includes(e.material) ? [e.material] : [];
    ids = [...first, ...available.filter(x => !first.includes(x))].slice(0, 3);
    if (item.material && !ids.includes(item.material)) ids = [item.material, ...ids].slice(0, 3);
  }
  const pick = (id: string) => {
    updateItem(item.id, i => ({
      ...i, material: id, matSrc: 'You', ambiguous: undefined, reopen: i.reopen?.filter(r => r !== 'material'),
      shade: id === 'metal' ? undefined : i.shade, shadeSrc: id === 'metal' ? undefined : i.shadeSrc,
    }));
    if (id === 'metal' && item.shade) toast.info('Shade removed: not needed for full metal.');
  };
  if (wide) {
    const more = <LinkButton onClick={() => openDrawer({ kind: 'materials', itemId: item.id })}>More Materials</LinkButton>;
    return (
      <div>
        {compact && <FieldLabel right={more}>Material</FieldLabel>}
        {reopened && !compact && <div className="mb-3"><Notice tone="decision">The material needs a new pick for this patient’s funding.</Notice></div>}
        <WideChoice label="Material" options={ids.map(chip)} value={reopened || item.ambiguous ? item.material : e.material} onChange={pick} form={compact ? 'pills' : 'list'} small={compact} />
        {!compact && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {!item.ambiguous && more}
            <span className="text-[11px] text-[#5A5A6A]">Lead times from {lab.name}{units > 1 ? ` · ${units} units` : ''}</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      {compact && <FieldLabel right={<LinkButton onClick={() => openDrawer({ kind: 'materials', itemId: item.id })}>More Materials</LinkButton>}>Material</FieldLabel>}
      {reopened && !compact && <div className="mb-3"><Notice tone="decision">The material needs a new pick for this patient’s funding.</Notice></div>}
      <ChoiceChips label="Material" options={ids.map(chip)} value={reopened || item.ambiguous ? item.material : e.material} onChange={pick} size={compact ? 'sm' : 'md'} />
      {!compact && !item.ambiguous && (
        <div className="mt-3"><LinkButton onClick={() => openDrawer({ kind: 'materials', itemId: item.id })}>More Materials</LinkButton></div>
      )}
    </div>
  );
}

// ─── Shade ───────────────────────────────────────────────────────────────────

function ShadeEditor({ item }: { item: ServiceItem }) {
  const { ctx, patient, updateItem, openDrawer, notes, dismissNote } = useCase();
  const wide = useRoom() === 'wide';
  const [extra, setExtra] = useState(!!(item.incisal || item.cervical));
  const { usual, tag: usualTag } = usualsFor(ctx);
  const front = item.teeth.some(isFront) || item.product === 'veneer';
  const denture = item.product === 'denture' || item.product === 'partial';
  const shortlist = useMemo(() => {
    const out: ChipOption[] = [];
    if (patient.lastShade) out.push({ id: patient.lastShade, label: `${patient.lastShade} · Last time`, swatch: shadeSwatch(patient.lastShade) });
    for (const s of usual.shades) if (!out.some(o => o.id === s) && out.length < 5) out.push({ id: s, label: s, swatch: shadeSwatch(s) });
    return out;
  }, [patient.lastShade, usual.shades]);
  const options: ChipOption[] = [...shortlist];
  if (item.shade && item.shade !== 'photos' && !options.some(o => o.id === item.shade)) options.push({ id: item.shade, label: item.shade, swatch: shadeSwatch(item.shade), tag: item.shadeSrc === 'Made the original' ? 'Made the original' : undefined });
  else if (item.shadeSrc === 'Made the original') options.forEach(o => { if (o.id === item.shade) o.tag = 'Made the original'; });
  if (front && !denture) options.push({ id: 'photos', label: 'Match from Photos', sub: 'Photos become required' });
  const pick = (id: string) => updateItem(item.id, { shade: id, shadeSrc: 'You' });
  const stump = notes.find(x => x.id === `stump:${item.id}`);
  if (wide) {
    // A strip of tooth-shaped swatches, then Match from Photos, all one radiogroup.
    const swatches = options.filter(o => o.id !== 'photos');
    const photos = options.find(o => o.id === 'photos');
    const stop = options.some(o => o.id === item.shade) ? item.shade : options[0]?.id;
    // The small note row under each swatch ("Last time") only when some swatch has one, so the tiles stay short.
    const noteRow = swatches.some(o => o.tag || o.id === patient.lastShade);
    const radio = (o: ChipOption) => ({
      type: 'button' as const, role: 'radio', 'aria-checked': item.shade === o.id,
      'aria-label': [o.label, o.tag, o.sub].filter(Boolean).join(', '), title: o.sub,
      tabIndex: o.id === stop ? 0 : -1, onClick: () => pick(o.id),
    });
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#5A5A6A]">Quick picks <SourceTag src={usualTag} /></p>
          <div role="radiogroup" aria-label="Shade" onKeyDown={rove} className="flex flex-wrap items-start gap-1.5">
            {swatches.map(o => {
              const on = item.shade === o.id;
              const note = o.tag ?? (o.id === patient.lastShade ? 'Last time' : '');
              return (
                <button key={o.id} {...radio(o)} className={`relative flex flex-col items-center gap-1 min-w-[56px] px-2 pt-1.5 pb-1 rounded-xl border transition-colors motion-reduce:transition-none ${FOCUS} ${
                  on ? 'bg-[#EEF4FF] border-[#3F6FE8] ring-1 ring-[#3F6FE8]' : 'bg-white border-transparent hover:border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}>
                  <ToothSwatch color={o.swatch ?? shadeSwatch(o.id)} />
                  <span className="text-xs font-semibold text-[#030213] leading-none mt-0.5">{o.id}</span>
                  {noteRow && <span className="min-h-[10px] text-[10px] leading-none text-[#5A5A6A] whitespace-nowrap">{note}</span>}
                  {on && (
                    <span aria-hidden className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-[#3F6FE8] ring-2 ring-white text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              );
            })}
            {photos && (
              <>
                <span aria-hidden className="self-stretch w-px my-1 mx-2 bg-[#ECECF2]" />
                <span className="flex flex-col items-start gap-1 pt-3">
                  <button {...radio(photos)} className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
                    item.shade === 'photos' ? 'bg-[#EEF4FF] border-[#3F6FE8] text-[#1E40AF]' : 'bg-white border-[#D4D4DD] text-[#030213] hover:border-[#3F6FE8] hover:bg-[#F8FAFF]'}`}>
                    <Camera aria-hidden className="w-4 h-4 text-[#2F62D6]" strokeWidth={1.75} />
                    {photos.label}
                    {item.shade === 'photos' && <Check aria-hidden className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={3} />}
                  </button>
                  <span aria-hidden className="pl-1 text-[11px] text-[#5A5A6A]">{photos.sub}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <LinkButton onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: 'shade' })}>More Shades</LinkButton>
          {item.product === 'veneer' && <LinkButton onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: 'shade', tab: 'bleach' })}>Bleach Shades</LinkButton>}
          {!denture && !extra && <LinkButton onClick={() => setExtra(true)}>+ Add Incisal or Cervical Shade</LinkButton>}
        </div>
        {extra && !denture && (
          <div className="flex flex-wrap gap-2">
            {(['incisal', 'cervical'] as const).map(f => (
              <button key={f} type="button" onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: f })} className={`inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-lg border border-[#D4D4DD] bg-white text-sm hover:border-[#3F6FE8] hover:bg-[#F8FAFF] ${FOCUS}`}>
                {item[f] ? <ToothSwatch color={shadeSwatch(item[f]!)} small /> : <Plus aria-hidden className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={1.75} />}
                <span className="text-[#4A4A5A] capitalize">{f} shade</span>
                <span className={item[f] ? 'font-semibold text-[#030213]' : 'text-[#5A5A6A]'}>{item[f] ?? 'Optional'}</span>
              </button>
            ))}
          </div>
        )}
        {item.stump && (
          <p className="inline-flex items-center gap-2 text-sm text-[#3A3A4A]">
            <ToothSwatch color={shadeSwatch(item.stump)} small />
            Stump shade <span className="font-semibold">{item.stump}</span> · <LinkButton onClick={() => updateItem(item.id, { stump: undefined })}>Remove</LinkButton>
          </p>
        )}
        {stump && (
          <Notice tone="note" onDismiss={() => dismissNote(stump.id)} actions={<SecondaryButton onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: 'stump' })}>Add Stump Shade</SecondaryButton>}>
            {stump.text}
          </Notice>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ChoiceChips label="Shade" options={options} value={item.shade} onChange={pick} />
      <div className="flex flex-wrap items-center gap-4">
        <LinkButton onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: 'shade' })}>More Shades</LinkButton>
        {item.product === 'veneer' && <LinkButton onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: 'shade', tab: 'bleach' })}>Bleach Shades</LinkButton>}
        {!denture && !extra && <LinkButton onClick={() => setExtra(true)}>+ Add Incisal or Cervical Shade</LinkButton>}
      </div>
      {extra && !denture && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {(['incisal', 'cervical'] as const).map(f => (
            <button key={f} type="button" onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: f })} className={`flex items-center justify-between px-3 py-2 rounded-lg border border-[#D4D4DD] bg-white text-sm hover:border-[#3F6FE8] ${FOCUS}`}>
              <span className="text-[#3A3A4A] capitalize">{f} shade</span>
              <span className="font-semibold text-[#030213]">{item[f] ?? 'Optional'}</span>
            </button>
          ))}
        </div>
      )}
      {item.stump && (
        <p className="text-sm text-[#3A3A4A]">Stump shade <span className="font-semibold">{item.stump}</span> · <LinkButton onClick={() => updateItem(item.id, { stump: undefined })}>Remove</LinkButton></p>
      )}
      {stump && (
        <Notice tone="note" onDismiss={() => dismissNote(stump.id)} actions={<SecondaryButton onClick={() => openDrawer({ kind: 'shades', itemId: item.id, field: 'stump' })}>Add Stump Shade</SecondaryButton>}>
          {stump.text}
        </Notice>
      )}
    </div>
  );
}

// ─── Photos ──────────────────────────────────────────────────────────────────

function PhotosEditor({ item }: { item: ServiceItem }) {
  const { openDrawer, updateItem } = useCase();
  const wide = useRoom() === 'wide';
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#3A3A4A]">Take one retracted smile and one close-up with the shade tab next to the tooth. Two to four photos is plenty.</p>
      {wide && item.photos.length === 0 && (
        // The two shots the sentence above asks for, as empty frames.
        <div aria-hidden className="flex flex-wrap gap-3">
          {['Retracted smile', 'Close-up with shade tab'].map(s => (
            <div key={s} className="w-40 h-24 rounded-xl border border-dashed border-[#C9C9D6] bg-[#F8F9FC] flex flex-col items-center justify-center gap-1.5 text-[11px] font-medium text-[#4A4A5A]">
              <Camera className="w-5 h-5 text-[#8B8B9E]" strokeWidth={1.75} />
              {s}
            </div>
          ))}
        </div>
      )}
      {item.photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {item.photos.map((p, i) => (
            <div key={i} className="w-24">
              <div className="w-24 h-20 rounded-lg bg-gradient-to-br from-[#F7E2F8] to-[#AEE3E6] border border-[#E0E0E6] flex items-center justify-center text-[10px] font-semibold text-[#4A4A5A]">Photo {i + 1}</div>
              <p className="text-[11px] text-[#4A4A5A] mt-1 truncate">{p.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <PrimaryButton onClick={() => openDrawer({ kind: 'photos', itemId: item.id })}>{item.photos.length ? 'Add More Photos' : 'Add Photos'}</PrimaryButton>
        {item.photos.length > 0 && <LinkButton onClick={() => updateItem(item.id, { photos: [] })}>Remove All</LinkButton>}
      </div>
    </div>
  );
}

// ─── Decisions and blockers ──────────────────────────────────────────────────

function ImplantDecision({ item }: { item: ServiceItem }) {
  const { ctx, user, lab, updateItem, switchToImplant, go } = useCase();
  const rec = implantOnRecord(item, ctx.patient)!;
  const t = toothText(rec.tooth, user.notation);
  const placed = fromISO(rec.placed);
  const makes = labMakes(lab, 'implant');
  const other = labsThatMake('implant')[0];
  const keep = <SecondaryButton onClick={() => updateItem(item.id, { implantDecision: 'keep' })}>Keep Crown on Natural Tooth</SecondaryButton>;
  return (
    <div className="space-y-3">
      <Notice tone="decision" actions={makes
        ? <><PrimaryButton onClick={() => switchToImplant(item.id)}>Switch to Implant Crown</PrimaryButton>{keep}</>
        : <><PrimaryButton onClick={() => go('lab')}>Change Lab</PrimaryButton>{keep}</>}>
        <p>{t} has an implant on record ({rec.system} · {rec.platform} · {rec.diameter}, placed {placed.getDate()} {fmtShort(placed).split(' ')[1]} {placed.getFullYear()}). Make an implant crown instead?</p>
        {!makes && other && <p className="mt-1.5 font-semibold">{lab.name} doesn’t make implant crowns. {other.name} does.</p>}
      </Notice>
      {item.implantDecision === 'keep' && <p className="text-xs text-[#5A5A6A]">Kept as a crown on the natural tooth.</p>}
    </div>
  );
}

function RemakeDecision({ item }: { item: ServiceItem }) {
  const { ctx, user, updateItem } = useCase();
  const prior = remakeCandidate(item, ctx.patient, ctx.now)!;
  const plab = LABS.find(l => l.id === prior.lab)!;
  const t = toothText(prior.teeth!.find(x => item.teeth.includes(x))!, user.notation);
  const answer = (v: 'yes' | 'no') => updateItem(item.id, i => {
    if (v === 'no') {
      // Undoing a remake clears what it copied.
      return {
        ...i, remake: 'no', remakeReason: undefined,
        material: i.matSrc === 'Made the original' ? undefined : i.material, matSrc: i.matSrc === 'Made the original' ? undefined : i.matSrc,
        shade: i.shadeSrc === 'Made the original' ? undefined : i.shade, shadeSrc: i.shadeSrc === 'Made the original' ? undefined : i.shadeSrc,
      };
    }
    return { ...i, remake: 'yes', material: prior.option, matSrc: 'Made the original' };
  });
  return (
    <div className="space-y-3">
      <Notice tone="decision" actions={<>
        <SecondaryButton onClick={() => answer('no')}>No, New Work</SecondaryButton>
        <SecondaryButton onClick={() => answer('yes')}>Yes, a Remake</SecondaryButton>
      </>}>
        {t} had a {optionName(prior.product, prior.option).toLowerCase()} {PRODUCTS[prior.product].noun} from {plab.name}, delivered {fmtShort(fromISO(prior.date))} ({prior.caseId}). Is this a remake?
      </Notice>
      {item.remake && <p className="text-xs text-[#5A5A6A]">Answered: {item.remake === 'yes' ? 'yes, a remake. The material is copied from the original.' : 'no, new work.'}</p>}
    </div>
  );
}

function LabCheck({ item }: { item: ServiceItem }) {
  const { lab, go, removeItem } = useCase();
  const others = labsThatMake(item.product).map(l => l.name);
  return (
    <Notice tone="block" actions={<><PrimaryButton onClick={() => go('lab')}>Change Lab</PrimaryButton><SecondaryButton onClick={() => removeItem(item.id)}>Remove Item</SecondaryButton></>}>
      {lab.name} doesn’t make this. {others.length ? `${others.join(' and ')} ${others.length === 1 ? 'does' : 'do'}.` : 'No approved lab makes it: start a separate case through Something Else.'}
    </Notice>
  );
}

function Under18({ item }: { item: ServiceItem }) {
  const { patient, ctx, removeItem } = useCase();
  const age = patientAge(patient, ctx.now);
  return (
    <Notice tone="block" role="alert" actions={<SecondaryButton onClick={() => removeItem(item.id)}>Remove Item</SecondaryButton>}>
      Whitening trays can’t be prescribed for patients under 18. {patient.first} is {age}.
    </Notice>
  );
}

function DescEditor({ item }: { item: ServiceItem }) {
  const { updateItem, doneAndAdvance } = useCase();
  const v = item.desc ?? '';
  const next = useNextName(item.id, 'desc');
  return (
    <div className="space-y-3 max-w-xl">
      <label htmlFor={`desc-${item.id}`} className="text-xs font-semibold text-[#3A3A4A]">Describe the work, the teeth and any material you have in mind</label>
      <textarea
        id={`desc-${item.id}`}
        value={v}
        onChange={e => updateItem(item.id, { desc: e.target.value, descDone: false })}
        rows={4}
        aria-describedby={`desc-help-${item.id}`}
        className="w-full rounded-lg border border-[#D4D4DD] px-3 py-2 text-sm focus:border-[#3F6FE8] focus:ring-2 focus:ring-[#3F6FE8]/20 outline-none"
        placeholder="For example: implant bridge 34–36 on two Straumann BLT implants, screw-retained"
      />
      <p id={`desc-help-${item.id}`} className="text-xs text-[#5A5A6A]">At least 10 characters.</p>
      <StepArrow disabled={v.trim().length < 10} run={() => doneAndAdvance(() => updateItem(item.id, { descDone: true }))} label="Done" next={next} hint="Write a little more first" />
    </div>
  );
}

// ─── Aligners ────────────────────────────────────────────────────────────────

/**
 * One item of the aligner prescription (the portal's Aligner specifics): its fields as compact dropdowns with
 * their label above, two to a row, one in a narrow column. A pick is the answer as it's made, so the step stays
 * put while the rest of the item is filled in; the arrow moves on.
 */
function AlignerEditor({ item, group }: { item: ServiceItem; group: AlignerGroupId }) {
  const { readOnly, updateItem, answerInPlace, doneAndAdvance } = useCase();
  const column = useContext(ColumnWidthContext);
  const id = useId();
  const next = useNextName(item.id, group);
  const g = alignerGroup(group);
  const a = item.aligner ?? {};
  if (readOnly) return <p className="text-sm font-medium text-[#030213]">{alignerReadback(item, group) || 'Nothing picked'}</p>;
  // Picking the empty choice clears that field.
  const set = (key: AlignerKey, v: string) => answerInPlace(() => updateItem(item.id, i => {
    const aligner = { ...i.aligner };
    if (v) aligner[key] = v; else delete aligner[key];
    return { ...i, aligner, reopen: i.reopen?.filter(r => r !== group) };
  }));
  const missing = g.fields.find(f => f.required && !a[f.key]);
  return (
    <div className="space-y-3">
      <div className={`grid gap-x-3 gap-y-2.5 ${column !== undefined && column < 400 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {g.fields.map(f => {
          const v = a[f.key] ?? '';
          const gap = f.required && !v;
          return (
            <div key={f.key} className="min-w-0">
              <label htmlFor={`${id}-${f.key}`} className="block mb-1 text-[11px] font-semibold text-[#5A5A6A]">
                {f.label}{f.required && <span className="font-normal"> · needed</span>}
              </label>
              <div className="relative">
                <select
                  id={`${id}-${f.key}`}
                  value={v}
                  onChange={e => set(f.key, e.target.value)}
                  aria-required={f.required || undefined}
                  className={`w-full appearance-none pl-2.5 pr-7 py-1.5 text-xs rounded-lg border bg-white outline-none focus:border-[#4D8EF7] cursor-pointer ${v ? 'text-[#030213]' : 'text-[#5A5A6A]'} ${gap ? 'border-[#FCD34D]' : 'border-[#E0E0E6]'} ${FOCUS}`}
                >
                  <option value="">{f.placeholder ?? 'Select'}</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A5A6A]" strokeWidth={1.75} />
              </div>
            </div>
          );
        })}
      </div>
      <StepArrow
        disabled={!!missing}
        run={() => doneAndAdvance(() => {})}
        label={missing ? `Pick the ${missing.label.toLowerCase()}` : 'Done'}
        next={next}
        hint={missing ? `Pick the ${missing.label.toLowerCase()} first` : undefined}
      />
    </div>
  );
}

// ─── Delivery date ───────────────────────────────────────────────────────────

/**
 * When the service is needed back (the product's "Requested delivery date"): the lab's earliest day
 * unless the clinic picks a later one. A day sooner than the lab can make it, or one the lab doesn't
 * work (a weekend, a bank holiday), stays a gap until changed. Fast-Track sits beside it where it applies.
 */
function DeliveryDateEditor({ item }: { item: ServiceItem }) {
  const { ctx, draft, lab, user, readOnly, update, updateItem, answerInPlace } = useCase();
  const view = useContext(ControllerContext)?.view;
  const id = useId();
  const sd = serviceDate(item, ctx, receivedFor(draft, ctx), draft.fastTrack);
  // The lab's Fast-Track for this service (it's the case's: every service it suits goes faster).
  const ft = lab.fastTrack && fastTrackEligible(item, ctx) ? lab.fastTrack : undefined;
  const fast = !!ft && draft.fastTrack;
  const bad = sd.tooSoon || sd.offDay;
  if (readOnly) {
    // A sent case went with the day asked for. One waiting for approval can go too soon (the lab's cut-off
    // passes): it says so, never the lab's earliest as if that were fine.
    if (view !== 'sent' && bad && sd.requested) {
      return (
        <p className="text-sm font-medium text-[#8A4B08]">
          {fmtDay(sd.requested)} · {sd.offDay ? 'not a lab working day' : `now too soon, the lab’s earliest is ${sd.earliest ? fmtDay(sd.earliest) : '—'}`}
        </p>
      );
    }
    const day = view === 'sent' && sd.requested ? sd.requested : sd.backBy;
    return <p className="text-sm font-medium text-[#030213]">{day ? fmtDay(day) : '—'}{fast ? ' · Fast-Track' : ''}</p>;
  }
  if (!sd.earliest) return <p className="text-xs text-[#5A5A6A]">The day shows once {lab.name} can make this.</p>;
  const earliest = fmtDay(sd.earliest);
  const set = (iso?: string) => updateItem(item.id, i => ({ ...i, requestedDelivery: iso || undefined, deliverySrc: iso ? 'You' : undefined }));
  return (
    <div className="space-y-2">
      <input
        type="date"
        value={item.requestedDelivery ?? toISO(sd.earliest)}
        min={toISO(sd.earliest)}
        aria-label={`Delivery date for ${itemTitle(item, user.notation)}`}
        aria-describedby={`${id}-hint`}
        aria-invalid={bad || undefined}
        // Typed digit by digit, so the page stays put; clearing it goes back to the lab's earliest.
        onChange={e => { const v = e.target.value; answerInPlace(() => set(v)); }}
        // A click anywhere on the field opens the calendar, not only its icon.
        onClick={e => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* not allowed here: the icon still opens it */ } }}
        className={`w-[140px] px-2.5 py-1.5 text-xs rounded-lg border bg-white outline-none focus:border-[#4D8EF7] text-[#030213] ${bad ? 'border-[#FCD34D]' : 'border-[#E0E0E6]'}`}
      />
      <p id={`${id}-hint`} className={`text-xs ${bad ? 'text-[#8A4B08]' : 'text-[#5A5A6A]'}`}>
        {sd.offDay && sd.requested && <>{fmtDay(sd.requested)} isn’t a lab working day. </>}
        Earliest the lab can deliver{fast ? ' with Fast-Track' : ''}: {earliest}
        {item.requestedDelivery && <> · <LinkButton onClick={() => set(undefined)}>Use {earliest}</LinkButton></>}
      </p>
      {ft && (
        <label className="flex items-center gap-2 text-xs text-[#1F1F2E] cursor-pointer w-fit">
          {/* Toggling it moves the earliest day, never the step. */}
          <input type="checkbox" checked={draft.fastTrack} onChange={e => { const on = e.target.checked; answerInPlace(() => update(d => ({ ...d, fastTrack: on }))); }} className="w-3.5 h-3.5 accent-[#3F6FE8]" />
          <Zap className="w-3.5 h-3.5 text-[#B45309]" aria-hidden />
          Fast-Track · {plural(ft.daysFaster, 'working day')} faster
        </label>
      )}
    </div>
  );
}

/**
 * Used by the Review cards. `short`: a one-line form where `value` is long
 * (a denture's stages: value "Try In · Thu 12 Nov, … done elsewhere", short "Try In 12 Nov, …"; an aligner
 * item: every answer, short the first three and "+N more").
 * The Delivery date isn't one: each card reads its own Back by.
 */
export function itemDetails(item: ServiceItem, ctx: ReturnType<typeof useCase>['ctx'], d: CaseDraft): { id: SlotId; label: string; value: string; short?: string; src?: string }[] {
  return slotsFor(item, ctx, d)
    .filter(s => s.answered && s.id !== 'labCheck' && s.id !== 'deliveryDate')
    .map(s => ({
      id: s.id,
      label: s.label,
      value: s.id === 'teeth' && item.product === 'bridge' ? bridgeReadback(item, ctx.user.notation)
        : s.id === 'stages' ? stagesSummary(item) : isAlignerGroup(s.id) ? alignerReadback(item, s.id) : s.value ?? '',
      short: s.id === 'stages' || isAlignerGroup(s.id) ? s.value : undefined,
      src: s.src,
    }));
}
export { palmerOf, fmtDay };

// ─── Wide-room helpers ───────────────────────────────────────────────────────

type PicOption = ChipOption & { pic?: ReactNode };

/** What a tile counts: "5 materials", "6 stages". */
const OPTION_NOUN: Partial<Record<ProductId, string>> = {
  crown: 'material', bridge: 'material', implant: 'material', veneer: 'material', inlay: 'material',
  nightguard: 'type', retainer: 'type', whitening: 'type', denture: 'stage', partial: 'base',
};

/** "Try In", "Try In and Finish", "Try In, Retry and Finish" */
const andWords = (w: string[]) => (w.length < 2 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);


/** Arrow keys, Home and End move focus between a group's radios; Space or Enter picks (a pick can move the step on). */
function rove(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const n = items.length;
  const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + n) % n;
  items[j].focus();
}

/**
 * A single choice in the wide room: a segmented control (two or three short
 * answers), a pill row, or one-line rows (name, tag, lead time). Same
 * radiogroup semantics as ChoiceChips. `caption`: under a segment, the picked
 * answer's tag and lead time, and why any answer is unavailable.
 */
function WideChoice({ label, options, value, onChange, form, small, caption }: {
  label: string; options: PicOption[]; value?: string; onChange: (id: string) => void;
  form: 'segment' | 'pills' | 'list'; small?: boolean; caption?: boolean;
}) {
  const stop = options.some(o => o.id === value) ? value : options.find(o => !o.disabled)?.id ?? options[0]?.id;
  const radio = (o: PicOption) => ({
    type: 'button' as const, role: 'radio', 'aria-checked': value === o.id, 'aria-disabled': o.disabled || undefined,
    'aria-label': [o.label, o.tag, o.disabled ? o.reason : o.sub].filter(Boolean).join(', '),
    title: o.disabled ? o.reason : o.sub, tabIndex: o.id === stop ? 0 : -1,
    onClick: () => !o.disabled && onChange(o.id),
  });
  const tone = (on: boolean, off?: boolean) => off
    ? 'bg-[#FAFAFB] border-dashed border-[#D4D4DD] text-[#8B8B9E] cursor-not-allowed'
    : on ? 'bg-[#EEF4FF] border-[#3F6FE8] text-[#1E40AF]' : 'bg-white border-[#D4D4DD] text-[#030213] hover:border-[#3F6FE8] hover:bg-[#F8FAFF]';

  if (form === 'segment') {
    const sel = options.find(o => o.id === value);
    const note = caption
      ? [sel?.tag, sel?.sub, ...options.filter(o => o.disabled && o.reason).map(o => `${o.label}: ${o.reason}`)].filter(Boolean).join(' · ')
      : '';
    return (
      <div>
        <div role="radiogroup" aria-label={label} onKeyDown={rove} className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-[#F0EFF6] border border-[#E0E0E6]">
          {options.map(o => {
            const on = value === o.id;
            return (
              <button key={o.id} {...radio(o)} className={`inline-flex items-center gap-1.5 ${small ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-sm'} rounded-lg font-semibold transition-colors motion-reduce:transition-none ${FOCUS} ${
                o.disabled ? 'text-[#8B8B9E] cursor-not-allowed' : on ? 'bg-white text-[#1E40AF] shadow-sm ring-1 ring-[#DCE6FD]' : 'text-[#4A4A5A] hover:text-[#030213] hover:bg-white/70'}`}>
                {o.pic && <span aria-hidden className={`flex ${on ? 'text-[#2F62D6]' : ''}`}>{o.pic}</span>}
                {o.label}
                {on && <Check aria-hidden className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        {note && <p className="mt-2 text-xs text-[#5A5A6A]">{note}</p>}
      </div>
    );
  }

  if (form === 'pills') {
    return (
      <div role="radiogroup" aria-label={label} onKeyDown={rove} className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = value === o.id;
          return (
            <button key={o.id} {...radio(o)} className={`inline-flex items-center gap-1.5 ${small ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-sm'} rounded-full border transition-colors motion-reduce:transition-none ${FOCUS} ${tone(on, o.disabled)}`}>
              {o.pic && <span aria-hidden className="flex">{o.pic}</span>}
              <span className="font-semibold whitespace-nowrap">{o.label}</span>
              {o.tag && <SourceTag src={o.tag} />}
              {o.sub && !o.disabled && <span className="text-xs text-[#5A5A6A] whitespace-nowrap">{o.sub}</span>}
              {on && <Check aria-hidden className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={rove} className={`grid gap-2 ${options.length > 4 ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]' : 'max-w-[560px]'}`}>
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} {...radio(o)} className={`flex items-center gap-2.5 h-10 pl-3 pr-2.5 rounded-xl border text-left transition-colors motion-reduce:transition-none ${FOCUS} ${tone(on, o.disabled)}`}>
            {o.pic}
            <span className="min-w-0 truncate text-sm font-semibold">{o.label}</span>
            {o.tag && <SourceTag src={o.tag} />}
            {/* Lead time and dot never leave the row: only the label (or an unavailable answer's reason) truncates. */}
            <span className={`ml-auto flex items-center gap-2.5 pl-1 ${o.disabled ? 'min-w-0' : 'flex-shrink-0'}`}>
              {o.disabled
                ? o.reason && <span className="min-w-0 truncate text-xs text-[#6B6B7B]">{o.reason}</span>
                : o.sub && <span className="whitespace-nowrap text-xs tabular-nums text-[#5A5A6A]">{o.sub}</span>}
              <span aria-hidden className={`w-[18px] h-[18px] rounded-full border flex-shrink-0 flex items-center justify-center ${
                on ? 'bg-[#3F6FE8] border-[#3F6FE8]' : o.disabled ? 'border-dashed border-[#C9C9D6]' : 'bg-white border-[#C9C9D6]'}`}>
                {on && <Check className="w-3 h-3 text-white" strokeWidth={3.5} />}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A shade swatch shaped like a tooth (28 × 36; `small` 14 × 18). Colours on screen are only a guide. */
function ToothSwatch({ color, small }: { color: string; small?: boolean }) {
  return (
    <svg aria-hidden width={small ? 14 : 28} height={small ? 18 : 36} viewBox="0 0 28 36" className="flex-shrink-0">
      <path d="M5.6 3.1C9.2 1.3 18.8 1.3 22.4 3.1c2.3 1.2 2.9 3.6 2.5 6.6L22.7 29c-.5 3.6-3.7 5.5-8.7 5.5s-8.2-1.9-8.7-5.5L3.1 9.7c-.4-3 .2-5.4 2.5-6.6Z" fill={color} stroke="rgba(3,2,19,0.2)" strokeWidth="1" />
      <path d="M4.6 22.5h18.8l-.7 6.5c-.5 3.6-3.7 5.5-8.7 5.5s-8.2-1.9-8.7-5.5Z" fill="#fff" fillOpacity="0.22" />
      <path d="M8.2 6.6c2.2-.9 4.6-1.1 6.6-.8" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Two crowns, apart or joined. */
function SplintPic({ joined }: { joined?: boolean }) {
  return (
    <svg aria-hidden width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1" y="1.5" width="8" height="11" rx="3" />
      <rect x="13" y="1.5" width="8" height="11" rx="3" />
      {joined && <path d="M9 7h4" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}

/** A molar with the restoration inside it (inlay) or over the cusps (onlay). */
function InlayPic({ onlay }: { onlay?: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M3 3.2C5 1.6 11 1.6 13 3.2c1.4 1.2 1 4.6-.4 7.4-.6 1.2-1 3.4-1.9 3.4-.9 0-.9-2.6-2.7-2.6S6.1 14 5.2 14c-.9 0-1.3-2.2-1.9-3.4C1.9 7.8 1.6 4.4 3 3.2Z" />
      {onlay
        ? <path d="M2.6 4.6c2.2-1.6 8.6-1.6 10.8 0L13.2 6.4c-2-1-8.4-1-10.4 0Z" fill="currentColor" stroke="none" />
        : <rect x="6" y="4" width="4" height="3.2" rx="1" fill="currentColor" stroke="none" />}
    </svg>
  );
}

/** Upper (∩), lower (∪) or both. */
function ArchPic({ jaw }: { jaw: 'upper' | 'lower' | 'both' }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {jaw !== 'lower' && <path d={jaw === 'both' ? 'M3 7C3 2.5 13 2.5 13 7' : 'M2.5 11C2.5 3.5 13.5 3.5 13.5 11'} />}
      {jaw !== 'upper' && <path d={jaw === 'both' ? 'M3 9C3 13.5 13 13.5 13 9' : 'M2.5 5C2.5 12.5 13.5 12.5 13.5 5'} />}
    </svg>
  );
}

/** Denture base acrylic: veined or plain pink. */
function AcrylicDot({ veined }: { veined?: boolean }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6.2" fill="#EBA4AC" stroke="rgba(3,2,19,0.18)" />
      {veined && <path d="M3 5.5c1.6.8 2.4-.6 4 .2s2.2 2 4 1.2M3.6 9.4c1.4-.4 2.2.8 3.6.2" stroke="#C4566A" strokeWidth="0.9" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

/** A small tile hinting at the material's look, by its group (zirconia, glass ceramic, metal…). */
const GROUP_LOOK: Record<string, string> = {
  Zirconia: 'linear-gradient(135deg,#FFFFFF,#E9E4D8)',
  'Glass ceramic': 'linear-gradient(135deg,#FBF6EC,#DCE9F2)',
  'Metal-ceramic': 'linear-gradient(135deg,#F4EEDF 50%,#B4BAC5 50%)',
  Metal: 'linear-gradient(135deg,#DDE0E6,#9AA1AD)',
  Composite: 'linear-gradient(135deg,#F3E9D6,#E1CFAE)',
};
function MaterialDot({ id }: { id: string }) {
  const group = MATERIAL_GROUP[id];
  if (!group) return null;
  return <span aria-hidden title={group} className="w-5 h-5 rounded-md border border-black/10 flex-shrink-0" style={{ background: GROUP_LOOK[group] }} />;
}
