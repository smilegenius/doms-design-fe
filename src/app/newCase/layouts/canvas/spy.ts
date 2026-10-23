// ─── Experience C · where the reader is ──────────────────────────────────────
// A tiny store, outside React state, for what changes while the page scrolls or
// the pointer moves: the section in view (scrollspy), a hovered service, and
// whether the page has scrolled away from the top or runs on under the footer.
// Only the navigator, the header, the footer and the chart subscribe, so
// scrolling never re-renders the case itself.
//
// Programmatic scrolls (a navigator click, the page moving on to the next gap,
// a tooth tap) "hold" the section they are taking the reader to, so the
// scrollspy doesn't flick through every section the glide passes. The hold
// lets go once the scrolling has stopped, or at once when the user takes over
// (the wheel, a touch, the scroll keys, the scrollbar). Letting go looks again
// at where the reader is: the held section stays current while it is still in
// view, else the scrollspy's own pick takes over.

import { RefObject, useEffect, useSyncExternalStore } from 'react';
import { scrollBox } from './state';

export interface SpyState {
  /** The section the reader is on, or the one a programmatic scroll is taking them to. */
  active: string | null;
  /** A service hovered in its card or the navigator: the chart lights its teeth. */
  hover: string | null;
  /** The page has scrolled away from the top (the header lifts). */
  scrolled: boolean;
  /** Content runs on under the sticky footer (the footer lifts). */
  under: boolean;
}

export interface Spy {
  get: () => SpyState;
  set: (p: Partial<SpyState>) => void;
  subscribe: (fn: () => void) => () => void;
  /** Show this section as the current one while a programmatic scroll runs. */
  hold: (id: string) => void;
  holding: () => boolean;
  /** A scroll event: while holding, let go once the scrolling stops. */
  scrolling: () => void;
  release: () => void;
  /** Called whenever a hold lets go (the scrollspy sets it to its own pick). */
  onRelease: (fn: (() => void) | null) => void;
  hoverOn: (id: string) => void;
  /** Cleared a beat later, so moving between two cards doesn't flash the chart. */
  hoverOff: (id: string) => void;
}

export function createSpy(): Spy {
  let state: SpyState = { active: null, hover: null, scrolled: false, under: false };
  const subs = new Set<() => void>();
  let holding = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  const set = (p: Partial<SpyState>) => {
    const keys = Object.keys(p) as (keyof SpyState)[];
    if (keys.every(k => state[k] === p[k])) return;
    state = { ...state, ...p };
    subs.forEach(f => f());
  };
  let released: (() => void) | null = null;
  const release = () => {
    const was = holding;
    holding = false;
    clearTimeout(holdTimer);
    if (was) released?.();
  };
  return {
    get: () => state,
    set,
    subscribe: fn => { subs.add(fn); return () => { subs.delete(fn); }; },
    hold: id => {
      holding = true;
      set({ active: id });
      clearTimeout(holdTimer);
      // Nothing to scroll (already in view): let go soon all the same.
      holdTimer = setTimeout(release, 700);
    },
    holding: () => holding,
    scrolling: () => {
      if (!holding) return;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(release, 160);
    },
    release,
    onRelease: fn => { released = fn; },
    hoverOn: id => { clearTimeout(hoverTimer); set({ hover: id }); },
    hoverOff: id => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => { if (state.hover === id) set({ hover: null }); }, 90);
    },
  };
}

/** Subscribe to one value of the spy (keep it a primitive). */
export function useSpy<T>(spy: Spy, pick: (s: SpyState) => T): T {
  return useSyncExternalStore(spy.subscribe, () => pick(spy.get()));
}

/**
 * Scrollspy over every [data-nc-section] in the canvas, observed against the
 * portal shell's scroll area (not the window). A section is current when it
 * crosses a reading band just under the sticky header; the first one in page
 * order wins. At the very end of the page the last sections can't reach the
 * band, so there the last one visible wins. `sig` changes whenever sections
 * come or go, to observe them afresh.
 */
export function useScrollSpy(
  rootRef: RefObject<HTMLElement>,
  headerRef: RefObject<HTMLElement>,
  footerRef: RefObject<HTMLElement>,
  spy: Spy,
  sig: string,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = scrollBox(root);
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-nc-section]'));
    const idOf = (el: Element) => el.getAttribute('data-nc-section');
    const inBand = new Set<Element>();
    const metrics = () => (scroller
      ? { top: scroller.scrollTop, h: scroller.clientHeight, sh: scroller.scrollHeight }
      : { top: window.scrollY, h: window.innerHeight, sh: document.documentElement.scrollHeight });
    const atEnd = () => { const m = metrics(); return m.top > 0 && m.sh - (m.top + m.h) < 4; };
    /** Part of it shows between the sticky header and the sticky footer. */
    const inView = (el: Element) => {
      const box = scroller?.getBoundingClientRect();
      const top = headerRef.current?.getBoundingClientRect().bottom ?? box?.top ?? 0;
      const bottom = footerRef.current?.getBoundingClientRect().top ?? box?.bottom ?? window.innerHeight;
      const r = el.getBoundingClientRect();
      return r.bottom > top + 24 && r.top < bottom - 24;
    };

    /** `keep`: a hold just let go, and the section it held stays current while it is still in view. */
    const pick = (keep = false) => {
      if (spy.holding() || !sections.length) return;
      if (keep) {
        const held = spy.get().active;
        const el = held ? sections.find(s => idOf(s) === held) : undefined;
        if (el && inView(el)) return;
      }
      let id: string | null = null;
      if (atEnd()) {
        const bottom = (scroller?.getBoundingClientRect().bottom ?? window.innerHeight);
        const seen = sections.filter(s => s.getBoundingClientRect().top < bottom - 24);
        id = seen.length ? idOf(seen[seen.length - 1]) : null;
      } else {
        const first = sections.find(s => inBand.has(s));
        id = first ? idOf(first) : null;
        if (!id && metrics().top < 8) id = idOf(sections[0]);
      }
      if (id) spy.set({ active: id });
    };

    const headerH = headerRef.current?.offsetHeight ?? 0;
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) inBand.add(e.target); else inBand.delete(e.target);
      }
      pick();
    }, { root: scroller, rootMargin: `-${headerH + 8}px 0px -58% 0px`, threshold: 0 });
    sections.forEach(s => io?.observe(s));

    let raf = 0;
    const edges = () => {
      const m = metrics();
      spy.set({ scrolled: m.top > 4, under: m.sh - (m.top + m.h) > 2 });
    };
    const onScroll = () => {
      spy.scrolling();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        edges();
        if (atEnd()) pick();
      });
    };
    spy.onRelease(() => pick(true));
    // The user takes over: the hold ends at once.
    const onUser = () => spy.release();
    // The scroll keys, unless they belong to a field or a control that uses them itself.
    const onKey = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key) || !spy.holding()) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.closest('[role="radiogroup"],[role="listbox"],[role="menu"],[role="slider"]'))) return;
      spy.release();
    };
    // A press on the scroll area itself (not on anything in it) is its scrollbar.
    const onPress = (e: PointerEvent) => { if (e.target === scroller) spy.release(); };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    target.addEventListener('wheel', onUser, { passive: true });
    target.addEventListener('touchstart', onUser, { passive: true });
    window.addEventListener('keydown', onKey);
    scroller?.addEventListener('pointerdown', onPress);
    // Content growing or shrinking moves the footer's edge without a scroll.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(edges);
    });
    ro?.observe(root);
    edges();
    return () => {
      io?.disconnect();
      ro?.disconnect();
      cancelAnimationFrame(raf);
      target.removeEventListener('scroll', onScroll);
      target.removeEventListener('wheel', onUser);
      target.removeEventListener('touchstart', onUser);
      window.removeEventListener('keydown', onKey);
      scroller?.removeEventListener('pointerdown', onPress);
      spy.onRelease(null);
    };
  }, [rootRef, headerRef, footerRef, spy, sig]);
}

const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);
