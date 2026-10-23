// ─── New Case Flow · Guided timeline and bottom bar ──────────────────────────

import { ReactNode } from 'react';
import { FileText, Package, Send } from 'lucide-react';
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
    const slots = slotsFor(item, ctx);
    const nodes = steps.filter(s => s.itemId === item.id);
    const gap = nodes.some(s => s.gap);
    const activeHere = cur?.itemId === item.id;
    const first = nodes.find(s => s.gap) ?? nodes[0];
    // Under the service: what's still open while it has gaps, else its material and shade.
    const left = nodes.filter(s => s.gap).length;
    const sub = left ? `${plural(left, 'thing')} left` : itemSpec(item, ctx) || undefined;
    const subs = nodes.map(s => ({
      s,
      sl: slots.find(x => s.slot && x.id === s.slot.id)!,
      state: (!s.navigable ? 'todo' : s.gap ? 'gap' : 'done') as Exclude<NodeState, 'action'>,
    }));
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
                  value={state === 'done' ? sl.value : undefined}
                  current={step === s.id}
                  disabled={!s.navigable}
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
  const nav = steps.filter(s => s.navigable);
  const i = nav.findIndex(s => s.id === step);
  const prev = i > 0 ? nav[i - 1] : undefined;
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
export function StepArrows({ onSlot }: { onSlot?: (el: HTMLElement | null) => void }) {
  const { steps, step, go, draft, user, readOnly } = useCase();
  const handed = useStepArrow();
  const { prev, nextId } = useStepTargets();
  const cur = steps.find(s => s.id === step);
  const name = (id: string) => stepName(steps, id, draft, user.notation, cur?.itemId);
  return (
    // Back · the step's title (rendered into the middle by StepHeading) · next.
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-4 mb-4 -mt-1 pb-3 border-b border-[#F0EFF6]">
      {/* The sides shrink and their labels truncate, so the title in the middle is never overlapped. */}
      <div className="min-w-0 flex">
        {prev && !readOnly && <NextArrow back compact onClick={() => go(prev.id)} label="Back" next={name(prev.id)} />}
      </div>
      <div ref={onSlot} className="min-w-0 max-w-[360px]" />
      <div className="min-w-0 flex justify-end">
        {readOnly || step === 'review' ? null : handed ? (
          <NextArrow side="left" compact onClick={handed.run} disabled={handed.disabled} label={handed.label} next={handed.next} hint={handed.hint} />
        ) : (
          <NextArrow side="left" compact onClick={() => go(nextId)} disabled={!!cur?.gap} label="Next" next={name(nextId)} hint="Answer this to move on" />
        )}
      </div>
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
    <div className="nc-glass-bar sticky bottom-0 z-20 border-t border-[#E0E0E6]/70 px-6 py-2.5 flex items-center gap-4">
      <button type="button" onClick={onSave} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#3A3A4A] hover:bg-[#F8F9FC] ${FOCUS}`}>
        <FileText className="w-4 h-4" aria-hidden />Save as draft
      </button>
      <div className="flex-1 flex items-center justify-end gap-3">
        {gaps > 0 && first && <GapButton count={gaps} onClick={() => go(first.id)} />}
        <PrimaryButton onClick={onSend} disabled={sending || gaps > 0} title={gaps > 0 ? 'Finish what’s left first' : undefined}>
          {isPosted(recordsState(draft, ctx)) ? <Package className="w-4 h-4" aria-hidden /> : <Send className="w-3.5 h-3.5" aria-hidden />}
          {sending ? 'Sending…' : label}
        </PrimaryButton>
      </div>
    </div>
  );
}
export type { StepNode };
