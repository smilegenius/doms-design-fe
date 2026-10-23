// ─── Experience C · the chart's pending selection ────────────────────────────
// Tapping teeth (or "Select Arch") builds a pending selection that isn't a
// service yet. This file only turns that selection into the services that fit
// it, by asking the rules: what the lab makes (labMakes), whether an option is
// offered for this funding (optionAvail), the turnaround (priceOf; no price is shown),
// and whether a bridge over those teeth is valid (spanBetween + bridgeIssue).
// It also checks the selection against the case's own services (a tooth that
// already has one, an arch already covered). No rule is decided here.

import type { Arch, Lab, ProductId } from '../../data';
import {
  BRIDGE_ERRORS, Ctx, OPTIONS, PRODUCTS, ServiceItem, archTeethIds, bridgeIssue, itemTitle, jawOf, labMakes, optionAvail,
  parseStep, plural, priceOf, spanBetween, teethText, toothText,
} from '../../rules';

export type Pending = { kind: 'teeth'; teeth: string[] } | { kind: 'arch'; arch: Arch };

export interface Offer {
  product: ProductId;
  /** Passed straight to api.addService(product, extra), or to updateItem for a card waiting for its teeth. */
  extra: Partial<ServiceItem>;
  /** Why it can't be picked for this selection (shown in place of the lead time). */
  blocked?: string;
  /** Blocked only until more teeth are tapped ("Tap 35 · LL5 and 37 · LL7 too"). */
  hint?: boolean;
  /** "7 days", "pontic 15 · 10 days". Never a price. */
  sub?: string;
}

export interface SelectionOffers {
  /** "For 36 · LL6", "For the upper arch" */
  title: string;
  offers: Offer[];
  /** Recorded-missing teeth in a crown, veneer or inlay selection. */
  notice?: string;
  /** Nothing fits at this lab. */
  none?: string;
}

/** The service the chart's next selection is for: one picked from the tiles, or a card that has no teeth yet. */
export interface ChartTarget { product: ProductId; itemId?: string }

const ONE_TOOTH: ProductId[] = ['crown', 'implant', 'veneer', 'inlay'];
const MANY_TEETH: ProductId[] = ['crown', 'veneer', 'bridge'];
const WHOLE_ARCH: ProductId[] = ['nightguard', 'denture', 'retainer', 'whitening'];
const TOOTH_FIRST: ProductId[] = ['crown', 'bridge', 'implant', 'veneer', 'inlay'];
/** Can't go on a tooth that's recorded as missing. */
const NEEDS_TOOTH: ProductId[] = ['crown', 'veneer', 'inlay'];

/** Services that start on the chart: tap their teeth, or select their arch. */
export const startsOnChart = (p: ProductId) => TOOTH_FIRST.includes(p) || WHOLE_ARCH.includes(p);
export const archFirst = (p: ProductId) => WHOLE_ARCH.includes(p);
/** A chart service that has neither teeth nor an arch yet: the chart fills it in. */
export const waitsForChart = (i: ServiceItem, lab: Lab) =>
  startsOnChart(i.product) && labMakes(lab, i.product) && i.teeth.length === 0 && !i.arch;

/**
 * What the next chart selection is for: the active card if it's still waiting
 * for its teeth or arch, else a service picked from the tiles, else any card
 * still waiting. Null means a selection starts a new service.
 */
export function chartTarget(armed: ProductId | null, items: ServiceItem[], step: string, lab: Lab): ChartTarget | null {
  const activeId = parseStep(step).itemId;
  const active = items.find(i => i.id === activeId && waitsForChart(i, lab));
  if (active) return { product: active.product, itemId: active.id };
  if (armed) return { product: armed };
  const waiting = items.find(i => waitsForChart(i, lab));
  return waiting ? { product: waiting.product, itemId: waiting.id } : null;
}

/**
 * A service whose teeth or arch are open in its own card (Change Teeth, a
 * partial denture, a reopened tooth): the big chart must not start another
 * service meanwhile.
 */
export function chartEditing(items: ServiceItem[], step: string, target: ChartTarget | null): { item: ServiceItem; what: string } | null {
  const ps = parseStep(step);
  if (ps.kind !== 'slot' || (ps.slot !== 'teeth' && ps.slot !== 'arch' && ps.slot !== 'extract')) return null;
  const item = items.find(i => i.id === ps.itemId);
  if (!item || item.id === target?.itemId) return null;
  return { item, what: ps.slot === 'arch' ? 'arch' : ps.slot === 'extract' ? 'teeth to extract' : 'teeth' };
}

/** The chart's title for a target: "Tap the teeth for the crown". */
export function chartAsk(t: ChartTarget | null): string {
  if (!t) return 'Tap teeth or a whole arch';
  const noun = PRODUCTS[t.product].noun;
  if (archFirst(t.product)) return `Select the arch for the ${noun}`;
  if (t.product === 'bridge') return 'Tap each end of the bridge';
  if (t.product === 'implant') return 'Tap the implant site';
  if (t.product === 'inlay') return 'Tap the tooth for the inlay or onlay';
  return `Tap the teeth for the ${noun}`;
}

export const pendingTeeth = (p: Pending | null): string[] =>
  !p ? [] : p.kind === 'arch' ? archTeethIds(p.arch) : p.teeth;

/** A tooth tap: add or remove it; an arch selection gives way to the tooth. */
export function toggleTooth(p: Pending | null, id: string): Pending | null {
  const teeth = p?.kind === 'teeth' ? p.teeth : [];
  const next = teeth.includes(id) ? teeth.filter(t => t !== id) : [...teeth, id];
  return next.length ? { kind: 'teeth', teeth: next } : null;
}

/** "Select Arch" hands back the chart's whole new selection: read which jaws are now whole. */
export function pendingFromArchSet(ids: string[], missing: string[]): Pending | null {
  const whole = (jaw: 'upper' | 'lower') => archTeethIds(jaw).filter(t => !missing.includes(t)).every(t => ids.includes(t));
  const u = whole('upper');
  const l = whole('lower');
  if (u && l) return { kind: 'arch', arch: 'both' };
  if (u) return { kind: 'arch', arch: 'upper' };
  if (l) return { kind: 'arch', arch: 'lower' };
  return null;
}

const stub = (product: ProductId, extra: Partial<ServiceItem>): ServiceItem =>
  ({ id: 'canvas-offer', product, teeth: [], teethDone: true, photos: [], ...extra });

/** "36", "36 and 46", "35, 36 and 37" */
function listText(ids: string[]): string {
  if (ids.length <= 1) return ids.join('');
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/** The bridge these teeth describe: the two extreme teeth are the ends; unselected or missing teeth between are pontics. */
function bridgeFor(teeth: string[], missing: string[]) {
  const order = archTeethIds(jawOf(teeth[0]));
  const byArch = [...teeth].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  const a = byArch[0];
  const b = byArch[byArch.length - 1];
  const span = spanBetween(a, b);
  const pontics = span.filter(t => missing.includes(t) || !teeth.includes(t));
  const extra: Partial<ServiceItem> = { teeth: span, teethDone: true, teethSrc: 'You', bridge: { a, b, pontics } };
  return { extra, span, pontics, issue: bridgeIssue(stub('bridge', extra)) };
}

/** The nearest teeth either side of a missing one that aren't missing too: the ends of a bridge over it. */
function bridgeEnds(id: string, missing: string[]): string[] {
  const order = archTeethIds(jawOf(id));
  const i = order.indexOf(id);
  const walk = (dir: -1 | 1) => {
    for (let k = i + dir; k >= 0 && k < order.length; k += dir) if (!missing.includes(order[k])) return order[k];
    return undefined;
  };
  return [walk(-1), walk(1)].filter((t): t is string => !!t);
}

export function offersFor(p: Pending, ctx: Ctx, fastTrack: boolean, items: ServiceItem[], target: ChartTarget | null): SelectionOffers {
  const lab = ctx.lab;
  const n = ctx.user.notation;
  const missing = ctx.patient.missing ?? [];
  // The card the chart is filling in doesn't count as "already on this case".
  const others = items.filter(i => i.id !== target?.itemId);
  // An NHS patient at a lab that offers no option of it on the NHS: say so before the pick.
  const notOnNhs = (product: ProductId) =>
    ctx.funding === 'nhs' && !OPTIONS[product].some(o => optionAvail(lab, product, o.id, ctx.funding).ok);
  /** The lead time only ("7 days"); undefined while it can't be made as chosen. */
  const leadTime = (product: ProductId, extra: Partial<ServiceItem>): string | undefined => {
    const pr = priceOf(stub(product, extra), ctx, fastTrack);
    if (pr.kind === 'none' || pr.ta == null) return undefined;
    return plural(pr.ta, 'day');
  };
  const offer = (product: ProductId, extra: Partial<ServiceItem>, blocked?: string, lead?: string): Offer => {
    const why = blocked ?? (notOnNhs(product) ? 'Not on the NHS' : undefined);
    if (why) return { product, extra, blocked: why };
    const sub = [lead, leadTime(product, extra) ?? (product === 'denture' ? 'Pick the stage next' : undefined)].filter(Boolean).join(' · ');
    return { product, extra, sub: sub || undefined };
  };

  let res: SelectionOffers;
  if (p.kind === 'arch') {
    const extra: Partial<ServiceItem> = { arch: p.arch, archSrc: 'You' };
    const offers = WHOLE_ARCH.filter(x => labMakes(lab, x)).map<Offer>(product => {
      const oneArch = p.arch === 'both' && (product === 'nightguard' || product === 'denture');
      const dup = others.find(i => i.product === product && i.arch && (i.arch === 'both' || p.arch === 'both' || i.arch === p.arch));
      return offer(product, extra, oneArch ? 'One arch at a time. Select just the upper or lower arch.' : dup ? `Already on this case: ${itemTitle(dup, n)}` : undefined);
    });
    res = {
      title: p.arch === 'both' ? 'For both arches' : `For the ${p.arch} arch`,
      offers,
      none: offers.length ? undefined : `${lab.name} doesn’t make whole-arch work like night guards or dentures.`,
    };
  } else {
    const teeth = [...p.teeth].sort((x, y) => Number(x) - Number(y));
    const gone = teeth.filter(t => missing.includes(t));
    const base: Partial<ServiceItem> = { teeth, teethDone: true, teethSrc: 'You' };
    const missingBlock = (product: ProductId) => (gone.length && NEEDS_TOOTH.includes(product) ? 'Recorded as missing' : undefined);
    let offers: Offer[];

    if (teeth.length === 1) {
      offers = ONE_TOOTH.filter(x => labMakes(lab, x)).map(product => offer(product, base, missingBlock(product)));
      // A missing tooth is a bridge site: say which teeth to tap for one.
      const ends = gone.length && labMakes(lab, 'bridge') ? bridgeEnds(teeth[0], missing) : [];
      if (ends.length) offers.push({ product: 'bridge', extra: base, hint: true, blocked: `Tap ${ends.map(t => toothText(t, n)).join(' and ')} too` });
    } else {
      const sameArch = teeth.every(t => jawOf(t) === jawOf(teeth[0]));
      offers = MANY_TEETH.filter(x => labMakes(lab, x)).map(product => {
        if (product !== 'bridge') return offer(product, base, missingBlock(product));
        if (!sameArch) return { product, extra: base, blocked: BRIDGE_ERRORS.arch };
        const br = bridgeFor(teeth, missing);
        const k = br.issue?.kind;
        // A tooth between the ends that already has its own service can't become part of a bridge.
        const owned = br.span.map(t => ({ t, item: others.find(i => !PRODUCTS[i.product].archItem && i.teeth.includes(t)) })).find(x => x.item);
        const blocked = k === 'long' ? BRIDGE_ERRORS.long
          : k === 'noAbutment' ? BRIDGE_ERRORS.noAbutment
          : k === 'noPontic' ? (teeth.length === 2
            ? 'Side by side, so no room for a pontic. Pick Crown, or tap end teeth with a gap between.'
            : 'Tap just the end teeth. The teeth between become pontics.')
          : owned ? `${toothText(owned.t, n)} is already in ${itemTitle(owned.item!, n)}`
          : undefined;
        const pontics = [...br.pontics].sort((x, y) => Number(x) - Number(y));
        return offer('bridge', br.extra, blocked, `${pontics.length === 1 ? 'pontic' : 'pontics'} ${pontics.join(', ')}`);
      });
      // A gap in the selection (or a missing tooth) reads as a bridge: offer it first.
      const bridge = offers.find(o => o.product === 'bridge' && !o.blocked);
      if (bridge) offers = [bridge, ...offers.filter(o => o !== bridge)];
    }
    // What can be picked comes first, then what more taps would open, then what can't be made here.
    offers = [...offers.filter(o => !o.blocked), ...offers.filter(o => o.hint), ...offers.filter(o => o.blocked && !o.hint)];

    res = {
      title: `For ${teethText(teeth, n)}`,
      offers,
      notice: gone.length && offers.some(o => NEEDS_TOOTH.includes(o.product))
        ? `${listText(gone)} ${gone.length === 1 ? 'is' : 'are'} recorded as missing. Use Bridge or Implant Crown for ${gone.length === 1 ? 'this site' : 'these sites'}.`
        : undefined,
      none: offers.length ? undefined : `${lab.name} doesn’t make ${teeth.length === 1 ? 'crowns, veneers or inlays' : 'crowns, veneers or bridges'}.`,
    };
  }
  return target ? narrow(res, p, target) : res;
}

/**
 * With a service waiting on the chart, offer just that service. When the
 * selection doesn't fit it, say what would and show what does fit, so there's
 * always a way on; while more taps are needed (a bridge's other end), it stays alone.
 */
function narrow(res: SelectionOffers, p: Pending, target: ChartTarget): SelectionOffers {
  const noun = PRODUCTS[target.product].noun;
  let mine = res.offers.find(o => o.product === target.product);
  if (!mine) {
    const oneTooth = target.product === 'bridge' && p.kind === 'teeth' && p.teeth.length === 1;
    const why = archFirst(target.product) ? `Tap “Select Arch” for the ${noun}`
      : p.kind === 'arch' ? `Tap the teeth for the ${noun}, not the whole arch`
      : oneTooth ? 'Tap the other end too. The teeth between become pontics.'
      : `Tap just one tooth for the ${noun}`;
    mine = { product: target.product, extra: {}, blocked: why, hint: oneTooth };
  }
  if (!mine.blocked) return { ...res, offers: [mine], notice: undefined, none: undefined };
  if (mine.hint) return { ...res, offers: [mine], none: undefined };
  return { ...res, offers: [mine, ...res.offers.filter(o => o !== mine && o.product !== target.product)], none: undefined };
}
