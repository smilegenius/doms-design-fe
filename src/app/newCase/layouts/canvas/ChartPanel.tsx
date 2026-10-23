// ─── Experience C · the chart panel ──────────────────────────────────────────
// The portal's own Teeth Chart, on the right beside the case and the only place
// teeth and arches are picked for a new service. It shows every service's teeth
// (grey; a whole-arch service greys its arch), bridge pontics, recorded-missing
// teeth and implants on record. Taps build a pending selection; "What are we
// making?" then appears in the footer bar right under it. A tooth that already
// belongs to a service glides the page to that service's card instead, and
// while a card has its own teeth or arch open, the chart sends the user there.
//
// The chart follows the reader: the service whose card is in view, or hovered
// (in the case or in the navigator), is lit, so the chart always says which
// teeth the card in front of you is about. A pending selection always wins,
// and the lighting goes out while the pointer or keyboard focus is on the
// chart, so the teeth under the user's hand show only what is really selected.

import { Ref, useEffect, useRef, useState } from 'react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { PRODUCTS, archTeethIds, itemTitle, toothText } from '../../rules';
import TeethChart, { ChartLegend } from '../../TeethChart';
import { chartAsk, chartEditing, pendingFromArchSet, pendingTeeth, toggleTooth } from './selection';
import { useCanvas, useChartFit } from './state';
import { useSpy } from './spy';

export default function ChartPanel() {
  const api = useCase();
  const c = useController();
  const ui = useCanvas();
  const { draft, patient, user, readOnly, step } = api;
  const n = user.notation;
  const asideRef = useRef<HTMLElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const fit = useChartFit(asideRef, chartRef, ui.footerRef, ui.stickyTop);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  // The service hovered, else the one in view.
  const focusId = useSpy(ui.spy, s => s.hover ?? s.active);

  const target = ui.target;
  const editing = readOnly ? null : chartEditing(draft.items, step, target);
  const missing = patient.missing ?? [];
  const implants = (patient.implants ?? []).map(i => i.tooth);
  const toothItems = draft.items.filter(i => !PRODUCTS[i.product].archItem);
  const archItems = draft.items.filter(i => PRODUCTS[i.product].archItem);
  const used = toothItems.flatMap(i => i.teeth);
  const archTeeth = archItems.flatMap(i => (i.arch ? archTeethIds(i.arch) : []));
  const pontics = toothItems.flatMap(i => (i.product === 'bridge' ? i.bridge?.pontics ?? [] : []));
  const selected = pendingTeeth(ui.pending);
  // Read-only: every service's teeth lit, nothing to tap.
  const allTeeth = [...new Set([...used, ...archTeeth])];

  // While keyboard focus is on the teeth, or the pointer is over the chart, they say only what is really selected.
  const [inChart, setInChart] = useState(false);
  const [pointerIn, setPointerIn] = useState(false);

  // The lit service: never over a selection being made or a card being changed.
  const shown = !ui.pending && !target && !editing && !inChart && !pointerIn ? draft.items.find(i => i.id === focusId) : undefined;
  const lit = shown && (PRODUCTS[shown.product].archItem ? !!shown.arch : shown.teeth.length > 0) ? shown : undefined;
  const litArch = lit && PRODUCTS[lit.product].archItem ? lit.arch : undefined;
  // A lit bridge lights its abutments; its pontics keep their dashed look (the chart leaves pontics unlit).
  const litTeeth = lit && !litArch ? lit.teeth : [];
  /** The teeth the portal chart draws as selected while a service is lit (what its "Select Arch" works from). */
  const litShown = litArch ? archTeethIds(litArch) : litTeeth.filter(t => !pontics.includes(t));

  /** A card has its own teeth or arch open: point there instead of starting another service. */
  const sentToCard = () => {
    if (!editing) return false;
    setMsg(`Finish the ${editing.what} in the ${itemTitle(editing.item, n)} card.`);
    ui.flashItem(editing.item.id);
    return true;
  };
  const onTooth = (id: string) => {
    const owner = toothItems.find(i => i.teeth.includes(id));
    if (owner) {
      setMsg(`${toothText(id, n)} is in ${itemTitle(owner, n)}. Its card is highlighted.`);
      ui.flashItem(owner.id);
      return;
    }
    if (sentToCard()) return;
    setMsg(null);
    ui.setPending(toggleTooth(ui.pending, id));
  };
  const onSetTeeth = (ids: string[]) => {
    if (sentToCard()) return;
    setMsg(null);
    // "Select Arch" while a service was lit (a touch can tap before the lighting goes
    // out): the portal chart worked out its new selection from the lit teeth, and
    // nothing is really selected while a service is lit, so take only the jaw tapped.
    if (lit) {
      const jaw = (['upper', 'lower'] as const).find(j => archTeethIds(j).some(t => ids.includes(t) !== litShown.includes(t)));
      ui.setPending(jaw ? { kind: 'arch', arch: jaw } : null);
      return;
    }
    ui.setPending(pendingFromArchSet(ids, missing));
  };

  const legend = [
    ...(readOnly ? (allTeeth.length ? ['selected' as const] : []) : ['selected' as const]),
    ...(pontics.length ? ['pontic' as const] : []),
    ...(missing.length ? ['missing' as const] : []),
    ...(implants.length ? ['implant' as const] : []),
    // Read-only, a lit service greys the others' teeth: kept in the legend whenever that can happen, so it never jumps.
    ...(!readOnly || draft.items.length > 1 ? ['other' as const] : []),
  ];

  const hint = ui.pending
    ? ui.pending.kind === 'arch' ? 'Tap “Select Arch” again to clear it.' : 'Tap more teeth to add them, or tap one again to drop it.'
    : target ? `Then pick ${PRODUCTS[target.product].label} in the bar below.`
    : draft.items.length ? 'Then pick what to make. Grey teeth are already on this case.'
    : 'Then pick what to make. Tap a few teeth for several crowns or a bridge.';
  const title = readOnly ? 'Teeth on this case' : chartAsk(target);

  // The page's heading ref while the services step is current; the canvas finds it by data attribute otherwise.
  const headingRef: Ref<HTMLHeadingElement> | undefined = !readOnly && step === 'services' ? c.headingRef : undefined;

  // What the chart draws: a selection being made, else the lit service over the rest in grey, else everything.
  const chart = lit
    ? { selected: litTeeth, arch: litArch, pontics, other: readOnly ? allTeeth : [...used, ...archTeeth] }
    : {
      selected: readOnly ? allTeeth : selected,
      arch: undefined,
      // A pending selection lights every tooth it holds, pontics included, so "Select Arch" toggles off.
      pontics: readOnly ? pontics : pontics.filter(t => !selected.includes(t)),
      other: readOnly ? [] : [...used, ...archTeeth],
    };

  return (
    <aside
      ref={asideRef}
      aria-labelledby="nc-chart-title"
      className="sticky self-start flex-shrink-0 bg-white border border-[#E0E0E6] rounded-2xl p-4 overflow-y-auto"
      style={{ top: ui.stickyTop, width: Math.max(290, fit.width + 34), maxHeight: fit.maxHeight }}
    >
      <h2
        id="nc-chart-title"
        data-nc-chart-heading
        ref={headingRef}
        tabIndex={-1}
        title={title}
        className="text-sm font-semibold text-[#030213] leading-5 truncate focus:outline-none"
      >
        {title}
      </h2>
      {/* A fixed-height line under the title: a message, else which service is lit, else the hint. The chart never resizes as it changes. */}
      {!readOnly ? (
        <div className="mt-1 h-8 overflow-hidden text-xs leading-4">
          <p role="status" aria-live="polite" className="text-[#1E3A8A]">{msg ?? ''}</p>
          {!msg && (lit ? (
            <>
              <LitLine title={itemTitle(lit, n)} />
              <p aria-hidden className="text-[#4A4A5A] truncate">Tap other teeth to add a service.</p>
            </>
          ) : <p className="text-[#4A4A5A]">{hint}</p>)}
        </div>
      ) : (
        <div className="mt-1 h-4 overflow-hidden text-xs leading-4">{lit && <LitLine title={itemTitle(lit, n)} />}</div>
      )}

      <div
        className="mt-2 flex justify-center rounded-xl bg-[#F8F9FC] border border-[#ECECF2] py-2"
        onPointerEnter={() => setPointerIn(true)}
        onPointerLeave={() => setPointerIn(false)}
      >
        <div
          ref={chartRef}
          onFocus={e => { let kb = true; try { kb = (e.target as Element).matches(':focus-visible'); } catch { /* older engines */ } if (kb) setInChart(true); }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInChart(false); }}
        >
          <TeethChart
            selected={chart.selected}
            arch={chart.arch}
            pontics={chart.pontics}
            missing={missing}
            implants={implants}
            otherTeeth={chart.other}
            onTooth={onTooth}
            onSetTeeth={onSetTeeth}
            width={fit.width}
            readOnly={readOnly}
            notation={n}
            label={draft.items.length ? `Teeth on this case: ${draft.items.map(i => itemTitle(i, n)).join(', ')}` : 'No teeth on this case yet'}
          />
        </div>
      </div>

      {legend.length > 0 && <div className="mt-2"><ChartLegend items={legend} /></div>}
    </aside>
  );
}

/** "● Showing Crown · 36 · LL6": which service the chart is lighting. A visual aid only: the card in view says it in words. */
function LitLine({ title }: { title: string }) {
  return (
    <p aria-hidden className="flex items-center gap-1.5 min-w-0 text-[#3A3A4A]">
      <span className="w-2 h-2 rounded-full bg-[rgba(89,193,227,0.9)] flex-shrink-0" />
      <span className="truncate" title={title}>Showing <span className="font-semibold text-[#030213]">{title}</span></span>
    </p>
  );
}
