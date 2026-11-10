// ─── Experience C · sticky footer ────────────────────────────────────────────
// A dock floating under the case and the chart. Normally: the back-by date,
// then one next action. While something is missing that's "Next: …" and the
// gaps button that goes there; once nothing is missing it's the attestation
// line and Send. In the approval view it holds Approve and Send. While teeth or
// an arch are selected on the chart it becomes the "What are we making?" bar:
// the services that fit the selection at this lab, each with its lead time, in
// one row. Every state keeps under the height the chart panel allows for it
// (state.ts FOOTER_FLOOR), so the chart never resizes as the bar comes and
// goes. It lifts (a soft shadow) only while the case runs on underneath it.

import { useLayoutEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Send, X } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { PRODUCTS, attestation, recordsState, sendMode } from '../../rules';
import { gapLabel } from '../../ReviewStep';
import { PRODUCT_ICON } from '../../ServiceSteps';
import { GapButton, PrimaryButton, SecondaryButton, SourceTag, StateIcon, FOCUS } from '../../ui';
import { riseIn } from './motion';
import { Offer, offersFor } from './selection';
import { useCanvas } from './state';
import { useSpy } from './spy';
import { backLine } from './summary';

export default function CanvasFooter() {
  const api = useCase();
  const ui = useCanvas();
  const under = useSpy(ui.spy, s => s.under);
  const selecting = !api.readOnly && !!ui.pending;
  return (
    <div
      className={`rounded-2xl transition-shadow duration-300 ease-out motion-reduce:transition-none ${
        selecting ? 'shadow-[0_10px_28px_rgba(63,111,232,0.20)]'
          : under ? 'shadow-[0_-10px_28px_-12px_rgba(3,2,19,0.28),0_2px_6px_rgba(3,2,19,0.04)]' : 'shadow-none'
      }`}
    >
      {selecting ? <SelectionBar /> : <DeliveryBar />}
    </div>
  );
}

function DeliveryBar() {
  const api = useCase();
  const c = useController();
  const ui = useCanvas();
  const { draft, ctx, gaps, user, prescriber, patient, readOnly, step, steps } = api;
  const back = backLine(api);
  const follow = recordsState(draft, ctx) === 'follow';
  const ready = gaps === 0;
  const attest = ready && prescriber && !readOnly ? attestation(sendMode(user, prescriber), user, prescriber, patient, follow) : '';
  // "Next: shade for 36 · LL6": the first gap, in the words Review uses.
  const first = steps.find(s => s.id === c.firstGapId);
  const next = ready || !first || first.kind === 'review' ? null
    : first.kind === 'services' ? 'tap the teeth or an arch on the chart'
    : gapLabel(first, api).replace(/^Needs you:\s*/, '');

  return (
    <div className="bg-white/95 backdrop-blur border border-[#E0E0E6] rounded-2xl px-5 py-3 flex items-end gap-6">
      <div className="min-w-0 flex-shrink-0">
        <h2
          ref={step === 'review' && !readOnly ? c.headingRef : undefined}
          tabIndex={-1}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#4A4A5A] focus:outline-none"
        >
          {ready && !readOnly ? <><StateIcon state="done" size="sm" />Ready to send</> : 'Delivery'}
        </h2>
        <p className="mt-0.5 text-sm text-[#4A4A5A] whitespace-nowrap">
          <span className="text-base font-semibold text-[#030213]">{back}</span>
          {draft.split && <><span className="mx-2 text-[#B8B8C6]" aria-hidden>·</span>Sends as 2 cases</>}
        </p>
      </div>

      {c.view === 'approve' && (
        <div className="flex-1 min-w-0 flex justify-end">
          <PrimaryButton onClick={() => c.send(true)} disabled={c.sending || gaps > 0}>
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />{c.sending ? 'Sending…' : 'Approve and Send'}
          </PrimaryButton>
        </div>
      )}

      {!readOnly && (
        <div className="flex-1 min-w-0 flex flex-col items-end gap-1.5">
          {/* Two lines, three at most on the narrowest page; the clamp only guards the footer's height. */}
          {attest && <p data-nc-attest title={attest} className="max-w-[620px] text-right text-[11px] leading-[14px] text-[#3A3A4A] line-clamp-3">{attest}</p>}
          <div className="max-w-full flex items-center gap-3">
            {next && (
              <p className="min-w-0 text-xs text-[#4A4A5A] truncate" title={`Next: ${next}`}>
                Next: <span className="font-semibold text-[#8A4B08]">{next}</span>
              </p>
            )}
            <button type="button" onClick={() => c.saveAndClose(true)} className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#3A3A4A] hover:bg-[#F8F9FC] ${FOCUS}`}>
              <FileText className="w-4 h-4" aria-hidden />Save as draft
            </button>
            {ready ? (
              <PrimaryButton className="flex-shrink-0" onClick={() => c.send()} disabled={c.sending}>
                <Send className="w-3.5 h-3.5" aria-hidden />{c.sending ? 'Sending…' : c.sendLabel}
              </PrimaryButton>
            ) : (
              <GapButton className="flex-shrink-0" count={gaps} onClick={() => ui.jump(c.firstGapId)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionBar() {
  const api = useCase();
  const ui = useCanvas();
  const barRef = useRef<HTMLDivElement>(null);
  // The bar rises in over the back-by line when the first tooth is tapped.
  useLayoutEffect(() => { riseIn(barRef.current, 8, 200); }, []);
  const { ctx, draft, addService, updateItem, removeItem, doneAndAdvance, go, lab } = api;
  const target = ui.target;
  const sel = offersFor(ui.pending!, ctx, draft.fastTrack, draft.items, target);
  const nhs = ctx.funding === 'nhs';
  const pick = (o: Offer) => {
    if (o.blocked) return;
    const itemId = target?.itemId;
    if (itemId && o.product === target!.product) {
      // The card waiting for its teeth or arch gets them, as its own editor would give them.
      doneAndAdvance(() => updateItem(itemId, o.extra));
    } else {
      // A card with no teeth yet that turns out to be something else is replaced, not kept empty.
      if (itemId) removeItem(itemId);
      addService(o.product, o.extra);
    }
    ui.setPending(null);
    ui.setArmed(null);
  };
  return (
    <div ref={barRef} className="bg-[#F5F8FF] border-2 border-[#3F6FE8] rounded-2xl px-5 py-2.5 flex items-center gap-4">
      <div className="w-[196px] flex-shrink-0 min-w-0">
        <p className="text-[11px] leading-4 font-bold uppercase tracking-widest text-[#2F62D6]">What are we making?</p>
        <p aria-live="polite" className="text-sm font-semibold text-[#030213] truncate" title={sel.title}>{sel.title}</p>
        {/* The notice takes the lab line's place: the offers already say what this lab makes. */}
        {sel.notice
          ? <p className="mt-0.5 text-[11px] leading-[15px] text-[#8A4B08] line-clamp-2" title={sel.notice}>{sel.notice}</p>
          : <p className="text-[11px] leading-4 text-[#4A4A5A] truncate" title={`Made at ${lab.name}`}>Made at {lab.name}</p>}
      </div>
      <div data-nc-offers role="group" aria-label={`What are we making? ${sel.title}`} className="flex-1 min-w-0">
        {sel.none ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#F5D98B] bg-[#FFF8E1] px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-[#B45309] flex-shrink-0" aria-hidden />
            <p className="flex-1 min-w-0 text-sm text-[#1F1F2E] leading-snug line-clamp-2">{sel.none}</p>
            <SecondaryButton className="flex-shrink-0" onClick={() => { ui.setPending(null); go('lab'); }}>Change Lab</SecondaryButton>
          </div>
        ) : (
          // One row, however many fit the selection: each offer shares the room (up to 240 px),
          // its name and its line wrapping to two lines at most, so the bar never grows a second row.
          <div className="grid grid-flow-col auto-cols-[minmax(0,240px)] justify-start gap-2">
            {sel.offers.map(o => {
              const Icon = PRODUCT_ICON[o.product];
              const tone = !o.blocked ? 'pick' : o.hint ? 'hint' : 'off';
              const label = PRODUCTS[o.product].label;
              const line = o.blocked ?? o.sub;
              return (
                <button
                  key={`${o.product}${o.hint ? '-hint' : ''}`}
                  type="button"
                  aria-disabled={o.blocked ? true : undefined}
                  onClick={() => pick(o)}
                  title={o.blocked}
                  className={`min-w-0 flex flex-col justify-center gap-0.5 px-3 py-2 rounded-xl border text-left transition-all motion-reduce:transition-none ${FOCUS} ${
                    tone === 'pick' ? 'bg-white border-[#C8D8FC] hover:border-[#3F6FE8] hover:shadow-md hover:-translate-y-px'
                      : tone === 'hint' ? 'bg-white border-dashed border-[#C8D8FC] cursor-default'
                      : 'bg-[#FAFAFB] border-dashed border-[#D4D4DD] cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-start gap-1.5 min-w-0">
                    <Icon className={`w-4 h-4 mt-px flex-shrink-0 ${tone === 'off' ? 'text-[#8B8B9E]' : 'text-[#2F62D6]'}`} aria-hidden />
                    <span className={`min-w-0 line-clamp-2 text-sm leading-[18px] font-semibold ${tone === 'off' ? 'text-[#6B6B7B]' : 'text-[#030213]'}`}>
                      {label}
                      {nhs && PRODUCTS[o.product].privateOnly && <> <SourceTag src="Private" /></>}
                    </span>
                  </span>
                  {line && (
                    <span className={`pl-[22px] text-[11px] leading-[15px] line-clamp-2 ${tone === 'hint' ? 'text-[#1E3A8A]' : tone === 'off' ? 'text-[#6B6B7B]' : 'text-[#4A4A5A]'}`}>{line}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <SecondaryButton onClick={() => ui.setPending(null)}><X className="w-3.5 h-3.5" aria-hidden />Clear</SecondaryButton>
        <span className="text-[10px] text-[#5A5A6A]">or press Esc</span>
      </div>
    </div>
  );
}
