// ─── New Case Flow · Guided timeline and bottom bar ──────────────────────────

import { ReactNode, useEffect, useState } from 'react';
import { ChevronDown, FileText, Package, Send } from 'lucide-react';
import { useCase } from './CaseContext';
import { StepNode, isPosted, itemSpec, itemTitle, recordsState, slotsFor, sendLabel, sendMode, plural } from './rules';
import { fmtDay } from './dates';
import { recordsSummary } from './CaseSteps';
import { RemoveService } from './ServiceSteps';
import { GapButton, NextArrow, PrimaryButton, SecondaryButton, FOCUS } from './ui';
import { stepName, useStepArrow } from './footerArrow';
import { NodeState, StepTimeline, TimelineBranch, TimelineRow, TimelineSubRow, lineBelow } from './StepTimeline';

// ─── Timeline ────────────────────────────────────────────────────────────────
// One vertical line, Patient to Review and Send, through every step's node (see
// StepTimeline). The open service's sub-steps branch off it; Add Another
// Service sits on it as a small "+".

export function Timeline() {
  const api = useCase();
  const { steps, step, go, draft, patient, lab, ctx, user, prescriber, readOnly } = api;
  const n = user.notation;
  const cur = steps.find(s => s.id === step);
  const gapOf = (id: string): NodeState => (steps.find(s => s.id === id)?.gap ? 'gap' : 'done');
  // The line's entries top to bottom, each drawn once the stretch below it is known.
  const entries: { state: NodeState; draw: (below?: boolean) => ReactNode }[] = [];
  const row = (id: string, label: string, value: string | undefined, state: NodeState = gapOf(id)) => entries.push({
    state,
    draw: below => <TimelineRow key={id} state={state} label={label} value={value} current={step === id} onClick={() => go(id)} below={below} />,
  });

  row('patient', 'Patient', `${patient.first} ${patient.last}`);
  row('lab', 'Lab', draft.labPicked === false ? 'Choose a lab' : lab.name);
  if (steps.some(s => s.id === 'services')) row('services', 'Services', draft.items.length ? 'Adding a service' : 'What are we making?');
  for (const item of draft.items) {
    const slots = slotsFor(item, ctx, draft);
    const nodes = steps.filter(s => s.itemId === item.id);
    const gap = nodes.some(s => s.gap);
    const activeHere = cur?.itemId === item.id;
    const first = nodes.find(s => s.gap) ?? nodes[0];
    // Under the service: what's still open while it has gaps, else its material and shade.
    const left = nodes.filter(s => s.gap).length;
    const sub = left ? `${plural(left, 'thing')} left` : itemSpec(item, ctx) || undefined;
    // Each sub-step reads exactly like its section in the service card (answered, needs you, optional),
    // so picking on the right shows here at once, teeth still to confirm included.
    const subs = nodes.map(s => {
      const sl = slots.find(x => s.slot && x.id === s.slot.id)!;
      return { s, sl, state: (sl.answered ? 'done' : sl.required ? 'gap' : 'todo') as Exclude<NodeState, 'action'> };
    });
    const subLines = lineBelow(subs.map(x => x.state));
    entries.push({
      state: gap ? 'gap' : 'done',
      draw: below => (
        <TimelineRow
          key={item.id}
          tone="service"
          state={gap ? 'gap' : 'done'}
          label={itemTitle(item, n)}
          value={sub}
          within={activeHere}
          onClick={() => go(first.id)}
          below={below}
          aside={!readOnly && (
            // Cancel this service from the nav: the × sits beside the row, never inside its button.
            <span className={`absolute right-1 top-1.5 z-10 ${activeHere ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
              <RemoveService item={item} variant="icon" />
            </span>
          )}
        >
          {activeHere && subs.length > 0 && (
            // The elbow is the stretch from the service to its first sub-step: lit once both are settled.
            <TimelineBranch lit={!gap && subs[0].state === 'done'}>
              {subs.map(({ s, sl, state }, i) => (
                <TimelineSubRow
                  key={s.id}
                  state={state}
                  label={sl.label}
                  value={sl.value || undefined}
                  current={step === s.id}
                  disabled={false}
                  onClick={() => go(s.id)}
                  below={subLines[i]}
                />
              ))}
            </TimelineBranch>
          )}
        </TimelineRow>
      ),
    });
  }
  if (draft.items.length > 0 && !readOnly) {
    entries.push({
      state: 'action',
      draw: below => <TimelineRow key="add-service" tone="action" state="action" label="Add Another Service" onClick={() => go('services')} below={below} />,
    });
  }
  row('records', 'Scans Source', recordsSummary(api));
  row('prescriber', 'Prescriber', prescriber?.name ?? 'Who is prescribing?');
  row('review', readOnly ? 'Case Details' : 'Review and Send', api.gaps ? plural(api.gaps, 'thing') + ' left' : 'Ready', api.gaps ? 'todo' : 'done');

  const lines = lineBelow(entries.map(e => e.state));
  return <StepTimeline label="Case steps">{entries.map((e, i) => e.draw(lines[i]))}</StepTimeline>;
}

// ─── Step arrows and bottom bar ─────────────────────────────────────────────

/** Where the arrows go from here: the previous navigable step, and the next gap (or Review). */
function useStepTargets() {
  const { steps, step } = useCase();
  // Items open in any order, so the current one may sit past a gap: back is the nearest reachable step before it.
  const prev = steps.slice(0, Math.max(0, steps.findIndex(s => s.id === step))).reverse().find(s => s.navigable);
  const after = steps.slice(steps.findIndex(s => s.id === step) + 1).find(s => s.gap && s.navigable);
  const nextId = after?.id ?? steps.find(s => s.gap && s.navigable)?.id ?? 'review';
  return { prev, nextId };
}

/**
 * The step card's top corners: ← back to the previous step (top left) and the
 * round → arrow (top right), each naming where it goes. A step that needs an
 * explicit "that's it" (several teeth, wings, a description) hands its action
 * to the → arrow; otherwise it goes to the next gap. Review has no → (the case
 * is finished from the footer).
 */
/**
 * Under 1024 px the timeline has no column: the card's header carries a stepper instead, one segment per
 * step (each service is one), the current one long and blue, gaps amber. Tapping it opens the timeline.
 */
function MiniStepper({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { steps, step, draft, gaps } = useCase();
  const cur = steps.find(s => s.id === step);
  const nodes: { key: string; gap: boolean; current: boolean }[] = [];
  const top = (id: string) => { const s = steps.find(x => x.id === id); if (s) nodes.push({ key: id, gap: s.gap, current: step === id }); };
  top('patient'); top('lab'); top('services');
  for (const it of draft.items) {
    const own = steps.filter(s => s.itemId === it.id);
    nodes.push({ key: it.id, gap: own.some(s => s.gap), current: cur?.itemId === it.id });
  }
  top('records'); top('prescriber');
  nodes.push({ key: 'review', gap: gaps > 0, current: step === 'review' });
  const at = Math.max(0, nodes.findIndex(n => n.current));
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="nc-header-timeline"
      aria-label={`Step ${at + 1} of ${nodes.length}${gaps ? `, ${plural(gaps, 'thing')} left` : ''}. Show all steps`}
      className={`mt-1.5 w-full sm:w-[280px] max-w-full mx-auto flex items-center gap-2 px-1 py-1 -my-1 rounded-lg ${FOCUS}`}
    >
      <span aria-hidden className="flex-1 min-w-0 flex items-center gap-1">
        {nodes.map(n => (
          <span
            key={n.key}
            className={`h-1.5 rounded-full transition-[flex-grow,background-color] duration-300 motion-reduce:transition-none ${n.current ? 'flex-[3] bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8]' : 'flex-1'} ${
              n.current ? '' : n.gap ? 'bg-[#F5C969]' : 'bg-[#86C79A]'}`}
          />
        ))}
      </span>
      <span aria-hidden className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-[#5A5A6A]">{at + 1}/{nodes.length}</span>
      <ChevronDown aria-hidden className={`w-3.5 h-3.5 flex-shrink-0 text-[#5A5A6A] transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

export function StepArrows({ onSlot, folded }: { onSlot?: (el: HTMLElement | null) => void; folded?: boolean }) {
  const { steps, step, go, draft, user, readOnly } = useCase();
  const handed = useStepArrow();
  const { prev, nextId } = useStepTargets();
  const cur = steps.find(s => s.id === step);
  const name = (id: string) => stepName(steps, id, draft, user.notation, cur?.itemId);
  const [tlOpen, setTlOpen] = useState(false);
  useEffect(() => { setTlOpen(false); }, [step]);
  return (
    // Under 1024 px the header (arrows, title, stepper) stays pinned while the step scrolls under it.
    <div className={folded ? `sticky top-0 z-20 -mx-3.5 sm:-mx-6 -mt-4 sm:-mt-5 mb-3 sm:mb-4 px-3.5 sm:px-6 pt-3 pb-2 rounded-t-2xl backdrop-blur-md border-b border-[#ECECF2] ${tlOpen ? 'bg-white shadow-[0_12px_24px_-12px_rgba(3,2,19,0.25)]' : 'bg-white/85'}` : ''}>
    {/* Back · the step's title (rendered into the middle by StepHeading) · next. */}
    <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] max-sm:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4 ${folded ? '' : 'mb-3 sm:mb-4 -mt-1 pb-2.5 sm:pb-3 border-b border-[#F0EFF6]'}`}>
      {/* The sides shrink and their labels truncate, so the title in the middle is never overlapped. */}
      <div className="min-w-0 flex">
        {prev && !readOnly && <NextArrow back compact onClick={() => go(prev.id)} label="Back" next={name(prev.id)} />}
      </div>
      <div className="min-w-0 max-w-[360px]">
        <div ref={onSlot} />
        {folded && <MiniStepper open={tlOpen} onToggle={() => setTlOpen(o => !o)} />}
      </div>
      <div className="min-w-0 flex justify-end">
        {readOnly || step === 'review' ? null : handed ? (
          <NextArrow side="left" compact onClick={handed.run} disabled={handed.disabled} label={handed.label} next={handed.next} hint={handed.hint} />
        ) : (
          <NextArrow side="left" compact onClick={() => go(nextId)} disabled={!!cur?.gap} label="Next" next={name(nextId)} hint="Answer this to move on" />
        )}
      </div>
    </div>
    {folded && tlOpen && <div id="nc-header-timeline" className="mt-2 max-h-[60vh] overflow-y-auto nc-accordion-in"><Timeline /></div>}
    </div>
  );
}

/**
 * Save as draft on the left; on the right the one button that finishes the
 * case — Ready for Dispatch when impressions go by post (the default without a
 * scan), Create Case otherwise, or Send to … to Approve. Until nothing is
 * missing it waits, with what's left as a link straight to the first gap.
 */
export function BottomBar({ onSave, onSend, sending }: { onSave: () => void; onSend: () => void; sending: boolean }) {
  const { steps, go, gaps, user, prescriber, draft, ctx, readOnly } = useCase();
  if (readOnly) return null;
  const label = sendLabel(sendMode(user, prescriber), prescriber, draft.split, isPosted(recordsState(draft, ctx)));
  const first = steps.find(s => s.gap && s.navigable);
  return (
    <div className="nc-glass-bar sticky bottom-0 z-20 border-t border-[#E0E0E6]/70 px-3 sm:px-6 py-2.5 flex items-center gap-2 sm:gap-4">
      <button type="button" onClick={onSave} className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium text-[#3A3A4A] hover:bg-[#F8F9FC] ${FOCUS}`}>
        <FileText className="w-4 h-4" aria-hidden /><span className="max-sm:hidden">Save as draft</span><span className="sm:hidden">Save</span>
      </button>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3">
        {gaps > 0 && first && <GapButton count={gaps} onClick={() => go(first.id)} />}
        <PrimaryButton className="whitespace-nowrap max-sm:px-3" onClick={onSend} disabled={sending || gaps > 0} title={gaps > 0 ? 'Finish what’s left first' : undefined}>
          {isPosted(recordsState(draft, ctx)) ? <Package className="w-4 h-4" aria-hidden /> : <Send className="w-3.5 h-3.5" aria-hidden />}
          {sending ? 'Sending…' : label}
        </PrimaryButton>
      </div>
    </div>
  );
}
export type { StepNode };
