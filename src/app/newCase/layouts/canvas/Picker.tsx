// ─── Experience C · starting a service from the list ─────────────────────────
// Shown while the case has no services yet, or after "Add Another Service".
// Its arrow points right, at the chart beside the case.
// The chart stays the only place teeth are picked: a tooth or arch service
// tapped here arms the chart ("Tap the teeth for the crown") instead of adding
// an empty card. The "Pick up where you left off" chips (Repeat, Next stage:
// same logic as the Services step) and More add their service straight away.

import { useLayoutEffect, useRef } from 'react';
import { ArrowRight, History, MoreHorizontal } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { PRODUCTS, TILE_ORDER, labMakes, labProducts, optionAvail, optionName } from '../../rules';
import type { ProductId } from '../../data';
import { ServiceTile } from '../../ServiceSteps';
import { LinkButton, FOCUS } from '../../ui';
import { riseIn } from './motion';
import { archFirst, startsOnChart } from './selection';
import { useCanvas } from './state';

export default function Picker() {
  const { lab, patient, ctx, addService, openDrawer, draft, go } = useCase();
  const c = useController();
  const ui = useCanvas();
  const ref = useRef<HTMLElement>(null);
  // Opened with "Add Another Service": rise into place where the button was.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ui.settled.current) return;
    el.dataset.ncSeen = '1';
    riseIn(el, 10, 240);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const made = labProducts(lab);
  const tiles = TILE_ORDER.filter(p => made.includes(p));
  const hasMore = made.some(p => !TILE_ORDER.includes(p));
  const nhs = ctx.funding === 'nhs';
  const adding = draft.items.length > 0;

  const chips: { label: string; onPick: () => void }[] = [];
  const rep = patient.repeat;
  if (rep && labMakes(lab, rep.product) && optionAvail(lab, rep.product, rep.option, ctx.funding).ok) {
    chips.push({
      label: `Repeat: ${rep.label}`,
      onPick: () => addService(rep.product, { arch: rep.arch, archSrc: 'Last time', type: rep.option, typeSrc: 'Last time' }),
    });
  }
  const ns = patient.nextStage;
  if (ns && labMakes(lab, ns.product) && !draft.items.some(i => i.stageSrc === 'Next stage')) {
    chips.push({
      label: `Next stage: ${optionName('denture', ns.stage)} · ${ns.arch} full denture (${ns.note})`,
      onPick: () => addService('denture', { arch: ns.arch, archSrc: 'Next stage', stage: ns.stage, stageSrc: 'Next stage' }),
    });
  }

  const onTile = (p: ProductId) => {
    if (!startsOnChart(p)) { addService(p); return; }
    // Tapping the armed tile again puts it down.
    const next = ui.armed === p ? null : p;
    ui.setPending(null);
    ui.setArmed(next);
    // After the chart's heading has its new words ("Tap the teeth for the crown").
    if (next) requestAnimationFrame(ui.focusChart);
  };
  const armed = ui.armed;

  return (
    <section ref={ref} id="nc-sec-services" data-nc-row="services" data-nc-section="services" data-nc-reveal aria-labelledby="nc-picker" className="bg-white rounded-2xl border-2 border-dashed border-[#C8D8FC] p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden><ArrowRight className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <h2 id="nc-picker" tabIndex={-1} className="text-base font-semibold text-[#030213] focus:outline-none">{adding ? 'Add another service' : `What are we making for ${patient.first}?`}</h2>
          <p className="text-sm text-[#4A4A5A] mt-0.5">
            {armed
              ? <>{archFirst(armed) ? `Now select the arch on the chart for the ${PRODUCTS[armed].noun}.` : `Now tap the teeth on the chart for the ${PRODUCTS[armed].noun}.`} <LinkButton onClick={() => ui.setArmed(null)}>Pick Something Else</LinkButton></>
              : 'Tap the teeth on the chart, or pick a service here and then tap its teeth.'}
          </p>
        </div>
        {adding && <LinkButton onClick={() => { ui.setArmed(null); go(c.firstGapId); }}>Cancel</LinkButton>}
      </div>

      {chips.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-[#3A3A4A] mb-2">Pick up where you left off</p>
          <div className="flex flex-wrap gap-2">
            {chips.map(ch => (
              <button key={ch.label} type="button" onClick={ch.onPick} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#C8D8FC] bg-[#F5F8FF] text-sm font-semibold text-[#1E3A8A] hover:bg-[#EEF4FF] ${FOCUS}`}>
                <History className="w-4 h-4" aria-hidden />
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2.5">
        {tiles.map(p => (
          // The armed tile is ringed; the chart's heading says what it's waiting for.
          <div key={p} className={`grid rounded-2xl ${armed === p ? 'ring-2 ring-[#3F6FE8] ring-offset-2' : ''}`}>
            <ServiceTile product={p} nhs={nhs} onPick={() => onTile(p)} />
          </div>
        ))}
        {hasMore && (
          <button type="button" onClick={() => openDrawer({ kind: 'moreServices' })} className={`flex flex-col items-start gap-3 p-4 rounded-2xl border border-dashed border-[#C9C9D6] bg-white hover:border-[#3F6FE8] hover:bg-[#F8FAFF] text-left ${FOCUS}`}>
            <span className="w-10 h-10 rounded-xl bg-[#F3F3F5] text-[#4A4A5A] flex items-center justify-center" aria-hidden><MoreHorizontal className="w-5 h-5" /></span>
            <span>
              <span className="block text-sm font-semibold text-[#030213]">More</span>
              <span className="block text-[11px] text-[#5A5A6A] mt-0.5">Everything else {lab.name.split(' ')[0]} makes</span>
            </span>
          </button>
        )}
      </div>
      {nhs && tiles.some(p => PRODUCTS[p].privateOnly) && (
        <p className="mt-3 text-xs text-[#5A5A6A]">Items tagged Private go to the lab as private work for this NHS patient.</p>
      )}
    </section>
  );
}
