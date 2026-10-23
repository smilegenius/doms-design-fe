// ─── Experience C · local UI state ───────────────────────────────────────────
// What only the canvas needs on top of the case page: the chart's pending
// selection, a service picked from the tiles that is waiting for its teeth
// (armed), the card that's briefly highlighted after a tooth tap, where the
// reader is (spy.ts), the chart size, and the scrolling every part shares:
// glide a row or a section into the space between the sticky header and the
// sticky footer, never under either.

import { RefObject, MutableRefObject, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ProductId } from '../../data';
import { useCase } from '../../CaseContext';
import type { ChartTarget, Pending } from './selection';
import type { Spy } from './spy';

export interface CanvasUi {
  pending: Pending | null;
  setPending: (p: Pending | null) => void;
  /** A tooth or arch service picked from the tiles: the chart is waiting for its teeth. */
  armed: ProductId | null;
  setArmed: (p: ProductId | null) => void;
  /** The service the chart's next selection is for (armed, or a card still without teeth). */
  target: ChartTarget | null;
  /** Item whose card is flashing (a tooth of it was tapped). */
  highlightId: string | null;
  flashItem: (itemId: string) => void;
  /** go(id), and when id is already the active row, bring it back into view and focus. */
  jump: (id: string) => void;
  /** Focus the chart's heading, the way into the chart for keyboard users. */
  focusChart: () => void;
  footerRef: RefObject<HTMLDivElement>;
  /** Section in view, hovered service, scroll edges. */
  spy: Spy;
  /** Where the sticky chart panel sits: just under the sticky header. */
  stickyTop: number;
  /** True once the canvas has mounted: cards added after that animate in. */
  settled: MutableRefObject<boolean>;
}

export const CanvasContext = createContext<CanvasUi | null>(null);
export function useCanvas(): CanvasUi {
  const c = useContext(CanvasContext);
  if (!c) throw new Error('useCanvas outside the canvas layout');
  return c;
}

/** Room kept under the panel, above the footer. */
const BREATHING = 12;
/** The footer floats this far above the bottom of the page area. */
const DOCK_GAP = 12;
/**
 * The footer's height is measured, but never taken as less than this: the
 * tallest the footer can be, dock gap included. The selection bar that
 * replaces the totals is one row of offers whose names and lines are clamped
 * to two lines (about 110 px), and the totals bar's attestation is clamped to
 * three (about 110 px), so the chart never shrinks under the user's finger on
 * the first tap, nor when the case becomes ready.
 */
const FOOTER_FLOOR = 124;
const PORTAL_TOP_BAR = 56;
const MIN_W = 200;
/** Keeps the panel at about 300–330 px, so the case column keeps its room. */
const MAX_W = 296;
/** Narrow page areas (1120–1200 px): a smaller chart still. */
const MAX_W_NARROW = 256;

/** The nearest scrolling ancestor (the portal shell's main area), whether or not it scrolls yet. */
export function scrollBox(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === 'auto' || oy === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}

/**
 * The largest chart (200–296 px wide) that keeps the whole sticky panel above
 * the footer, measured rather than estimated: the visible height of the page
 * area, the panel's sticky offset (under the header), the footer's height (the
 * tallest seen, so the chart doesn't jump each time the selection bar comes and
 * goes) and everything in the panel that isn't the chart. The panel then never
 * needs to scroll.
 */
export function useChartFit(
  asideRef: RefObject<HTMLElement>,
  chartRef: RefObject<HTMLElement>,
  footerRef: RefObject<HTMLElement>,
  top: number,
): { width: number; maxHeight: number } {
  const [fit, setFit] = useState({ width: 260, maxHeight: 640 });
  useLayoutEffect(() => {
    const aside = asideRef.current;
    const chart = chartRef.current;
    if (!aside || !chart) return;
    const box = scrollBox(aside);
    let tallestFooter = FOOTER_FLOOR;
    let watchedFooter: HTMLElement | null = null;
    let raf = 0;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    const compute = () => {
      // The footer comes after the chart in the page, so its ref is only set once this commit is done.
      const footer = footerRef.current;
      if (footer && footer !== watchedFooter) { ro?.observe(footer); watchedFooter = footer; }
      const viewH = box ? box.clientHeight : window.innerHeight - PORTAL_TOP_BAR;
      const footerH = (footer?.offsetHeight ?? 0) + DOCK_GAP;
      tallestFooter = Math.max(tallestFooter, footerH);
      // Border included: scrollHeight is the content plus padding.
      const chrome = aside.scrollHeight + 2 - chart.offsetHeight;
      const room = viewH - top - tallestFooter - BREATHING - chrome;
      const narrow = (aside.parentElement?.clientWidth ?? 1000) < 860;
      const width = Math.round(Math.min(narrow ? MAX_W_NARROW : MAX_W, Math.max(MIN_W, (room * 327) / 555)));
      const maxHeight = Math.max(240, viewH - top - Math.max(footerH, FOOTER_FLOOR) - 8);
      setFit(prev => (Math.abs(prev.width - width) > 2 || Math.abs(prev.maxHeight - maxHeight) > 2 ? { width, maxHeight } : prev));
    };
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    ro?.observe(aside);
    if (box) ro?.observe(box);
    const onResize = () => { tallestFooter = FOOTER_FLOOR; measure(); };
    window.addEventListener('resize', onResize);
    // Once now, before the first paint, and again when the footer is there.
    compute();
    measure();
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [asideRef, chartRef, footerRef, top]);
  return fit;
}

/** The sticky header and footer that frame the readable part of the page. */
export interface Frame { header?: HTMLElement | null; footer?: HTMLElement | null }
/** Room left between a glided-to element and the header or footer. */
const GAP = 12;

/**
 * Elements whose height is still gliding (motion.ts keeps this), and the
 * height each is gliding to. A row that folds above a scroll target is still
 * tall for a moment; aiming at where the target will be once it has folded
 * keeps a glide from overshooting.
 */
export const morphs = new Map<HTMLElement, number>();
function settleShift(el: HTMLElement): number {
  let shift = 0;
  morphs.forEach((to, m) => {
    if (!m.isConnected || m === el || m.contains(el) || el.contains(m)) return;
    if (m.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) shift += to - m.offsetHeight;
  });
  return shift;
}
/**
 * Where an element will be once every height glide above it, and its own (a
 * row that is opening right now still measures its folded height), has
 * settled. A glide inside it moves only its bottom.
 */
function finalRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const s = settleShift(el);
  const own = morphs.get(el);
  let h = r.height;
  // Negative targets mark a card collapsing out of the page: it keeps the height it shows.
  if (own != null && own >= 0) h = own;
  else {
    morphs.forEach((to, m) => {
      if (m !== el && m.isConnected && el.contains(m)) h += to - m.offsetHeight;
    });
  }
  const top = r.top + s;
  return { top, bottom: top + h, height: h };
}

function view(el: HTMLElement, frame: Frame) {
  const scroller = scrollBox(el);
  const sTop = scroller ? scroller.getBoundingClientRect().top : 0;
  const sBottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
  const top = Math.max(sTop, frame.header ? frame.header.getBoundingClientRect().bottom : sTop);
  const bottom = Math.min(sBottom, frame.footer ? frame.footer.getBoundingClientRect().top : sBottom);
  return { scroller, top, bottom };
}

function scrollByDelta(scroller: HTMLElement | null, delta: number) {
  if (Math.abs(delta) < 2) return;
  const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  if (scroller) scroller.scrollBy({ top: delta, behavior });
  else window.scrollBy({ top: delta, behavior });
}

/**
 * Bring a row into the space between the sticky header and the sticky footer,
 * only if it isn't already there: tall rows with their top just under the
 * header, short ones centred.
 */
export function reveal(el: HTMLElement, frame: Frame) {
  const { scroller, top, bottom } = view(el, frame);
  const r = finalRect(el);
  if (r.top >= top + 4 && r.bottom <= bottom - 4) return;
  const room = bottom - top;
  const delta = r.height > room - 48 ? r.top - top - GAP : r.top + r.height / 2 - (top + room / 2);
  scrollByDelta(scroller, delta);
}

/**
 * Glide a section's top to just under the header, unless it is already wholly
 * in view. With `keep` (the row inside it that needs an answer), make sure that
 * row ends up in view too, even when that means going a little further.
 */
export function glide(el: HTMLElement, frame: Frame, keep?: HTMLElement | null) {
  const { scroller, top, bottom } = view(el, frame);
  const r = finalRect(el);
  const inView = r.top >= top + 4 && r.bottom <= bottom - 4;
  let delta = inView ? 0 : r.top - (top + GAP);
  if (keep) {
    const k = finalRect(keep);
    const kTop = k.top - delta;
    const kBottom = k.bottom - delta;
    if (kBottom > bottom - GAP) delta += Math.min(kBottom - (bottom - GAP), kTop - (top + GAP));
    else if (kTop < top + GAP) delta -= top + GAP - kTop;
  }
  scrollByDelta(scroller, delta);
}

export type RowMode = 'view' | 'gap' | 'change';
/**
 * How a row shows: open with "Needs you" while it's a gap; open for changing
 * when it's the active row and was already answered; otherwise one line. A gap
 * that has just been answered folds straight away (the page moves on 220 ms
 * later), so the answer reads back at once. `settledOnMount`: the row arrives
 * already answered while it is the active one (the lab, picked in its own card
 * right before its row appears), so it mounts folded instead of open.
 */
export function useRowMode(active: boolean, gap: boolean, readOnly: boolean, settledOnMount = false): { mode: RowMode; reopen: () => void } {
  const fromGap = useRef(settledOnMount);
  const [, bump] = useState(0);
  if (!active) fromGap.current = false;
  else if (gap) fromGap.current = true;
  const mode: RowMode = readOnly ? 'view' : gap ? 'gap' : active && !fromGap.current ? 'change' : 'view';
  return { mode, reopen: () => { fromGap.current = false; bump(x => x + 1); } };
}

/**
 * A row opened with "Change" (active, already answered): once its answer
 * changes, move on to the next gap the same way the page does after a gap is
 * answered. The page's own auto-advance only covers rows that were gaps.
 */
export function useAdvanceOnChange(on: boolean, key: string, answered: boolean) {
  const { doneAndAdvance } = useCase();
  const base = useRef<string | null>(null);
  useEffect(() => {
    if (!on) { base.current = null; return; }
    if (base.current === null) { base.current = key; return; }
    if (key !== base.current && answered) {
      base.current = key;
      doneAndAdvance(() => {});
    }
  }, [on, key, answered, doneAndAdvance]);
}
