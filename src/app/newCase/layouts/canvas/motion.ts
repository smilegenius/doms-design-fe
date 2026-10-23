// ─── Experience C · motion ───────────────────────────────────────────────────
// Small, fast transitions (150–300 ms, ease-out) done with the Web Animations
// API, so no global CSS is needed and nothing ever sticks half-way: every
// animation runs from a starting look back to the element's own styles. Under
// prefers-reduced-motion none of them run (and scrolls are instant).

import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { morphs, scrollBox } from './state';

export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function canAnimate(el: Element | null | undefined): el is HTMLElement {
  return !!el && typeof (el as HTMLElement).animate === 'function' && !reducedMotion();
}

function run(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!canAnimate(el)) return null;
  try { return el.animate(frames, { easing: EASE_OUT, ...opts }); } catch { return null; }
}

/** Fade and rise into place (a section scrolled into view for the first time, the selection bar). */
export function riseIn(el: Element | null | undefined, distance = 14, duration = 280) {
  return run(el, [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'none' }], { duration });
}

/** A new service card: fade in with a slight scale. */
export function popIn(el: Element | null | undefined) {
  return run(el, [
    { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 300 });
}

/** A state icon that just changed (gap → done). */
export function popIcon(el: Element | null | undefined) {
  return run(el, [
    { transform: 'scale(0.5)', opacity: 0.3 },
    { transform: 'scale(1.15)', opacity: 1, offset: 0.6 },
    { transform: 'scale(1)', opacity: 1 },
  ], { duration: 280 });
}

/** Content swapped in place (a row folding to one line, or opening): a quick fade. */
export function fadeSwap(el: Element | null | undefined) {
  return run(el, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 200 });
}

/**
 * A removed card collapses before it goes: height, opacity and the gap below
 * it (a negative bottom margin eats the column's 16 px gap) all close together.
 * Resolves when done; at once without motion.
 */
export function collapseOut(el: HTMLElement | null | undefined, gap = 16): Promise<void> {
  if (!canAnimate(el)) return Promise.resolve();
  const h = el.offsetHeight;
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  const a = run(el, [
    { height: `${h}px`, opacity: 1, marginBottom: '0px', transform: 'none' },
    { height: '0px', opacity: 0, marginBottom: `-${gap}px`, transform: 'scale(0.98)' },
  ], { duration: 220, easing: EASE_IN_OUT, fill: 'forwards' });
  if (!a) return Promise.resolve();
  // It ends up taking no room at all, the gap below it included.
  morphs.set(el, -gap);
  return a.finished.then(() => undefined, () => undefined).then(() => { morphs.delete(el); });
}

/**
 * A soft highlight pulse when `on` turns true (a "Needs you" row that just
 * became the active one): the background flashes a light blue and settles on
 * the active row's own tint (`settle`), which its class takes at the same time.
 */
export function usePulse(ref: RefObject<HTMLElement>, on: boolean, settle = '#F5F8FF') {
  const was = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (on && !was.current && el) {
      run(el, [
        { backgroundColor: '#DCE7FF', boxShadow: 'inset 0 0 0 2px rgba(63,111,232,0.32)' },
        { backgroundColor: settle, boxShadow: 'inset 0 0 0 2px rgba(63,111,232,0)' },
      ], { duration: 360 });
    }
    was.current = on;
  }, [on, ref, settle]);
}

/**
 * Animate an element's height between two layouts instead of jumping: when
 * `key` changes (a row opens, folds, a note appears), its height glides from
 * what it was to what it now is, clipped meanwhile. The height before the
 * change is tracked with a ResizeObserver, which reports after React's layout
 * effects, so it still holds the old value when the key changes.
 */
export function useHeightMorph(ref: RefObject<HTMLElement>, key: string, opts: { duration?: number; fade?: boolean } = {}) {
  const { duration = 240, fade = false } = opts;
  const settled = useRef<number | null>(null);
  const prevKey = useRef(key);
  const running = useRef<Animation | null>(null);
  const baseOverflow = useRef('');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    settled.current = el.offsetHeight;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (!running.current) settled.current = el.offsetHeight; });
    ro?.observe(el);
    return () => { ro?.disconnect(); morphs.delete(el); };
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prevKey.current === key) return;
    prevKey.current = key;
    let from = settled.current;
    if (running.current) {
      // Mid-glide: start the new one from where this one has got to.
      from = el.offsetHeight;
      const a = running.current;
      running.current = null;
      morphs.delete(el);
      a.cancel();
    } else {
      baseOverflow.current = el.style.overflow;
    }
    const to = el.offsetHeight;
    settled.current = to;
    if (from == null || Math.abs(to - from) < 2 || !canAnimate(el)) {
      el.style.overflow = baseOverflow.current;
      return;
    }
    el.style.overflow = 'hidden';
    const frames: Keyframe[] = fade
      ? [{ height: `${from}px`, opacity: 0.4 }, { height: `${to}px`, opacity: 1 }]
      : [{ height: `${from}px` }, { height: `${to}px` }];
    const a = run(el, frames, { duration });
    if (!a) { el.style.overflow = baseOverflow.current; return; }
    running.current = a;
    morphs.set(el, to);
    const end = () => {
      if (running.current !== a) return;
      running.current = null;
      morphs.delete(el);
      el.style.overflow = baseOverflow.current;
      settled.current = el.offsetHeight;
    };
    a.addEventListener('finish', end);
    a.addEventListener('cancel', end);
  }, [key, ref, duration, fade]);
}

/**
 * Cards fade and rise into place the first time they scroll into view. Cards
 * already on screen when the page opens (or when they are added) are left as
 * they are. Watched from the footer's top edge, so the motion is seen rather
 * than spent under the footer.
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement>, footerRef: RefObject<HTMLElement>, sig: string) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const footerH = footerRef.current?.offsetHeight ?? 0;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const seen = el.dataset.ncSeen;
        if (seen === undefined) {
          // First report: on screen already means nothing to reveal.
          el.dataset.ncSeen = e.isIntersecting ? '1' : '0';
          if (e.isIntersecting) io.unobserve(el);
        } else if (seen === '1') {
          io.unobserve(el);
        } else if (e.isIntersecting) {
          el.dataset.ncSeen = '1';
          io.unobserve(el);
          riseIn(el);
        }
      }
    }, { root: scrollBox(root), rootMargin: `0px 0px -${footerH + 12}px 0px`, threshold: 0 });
    root.querySelectorAll<HTMLElement>('[data-nc-reveal]').forEach(el => {
      if (el.dataset.ncSeen !== '1') io.observe(el);
    });
    return () => io.disconnect();
  }, [rootRef, footerRef, sig]);
}
