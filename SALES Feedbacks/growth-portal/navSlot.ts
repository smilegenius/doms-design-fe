import { useEffect, useState } from 'react';

// ── A slot in Layout's sidebar for an item attached at runtime ──────────────
// Layout's nav is internal to src/, so Growth items (What's new, Billing,
// Design, My queue / Calendar) portal into a <div> placed next to an anchor
// button. Several items can share one anchor ("Cases" has Design and the V2
// workflow items): they line up in a run after (or before) the anchor, sorted
// by `order`, and a slot that is already in its run is never moved again.
//
// The slot element is made once per item and only moved when it is out of
// place. (Before, each item insisted on sitting directly next to the anchor and
// made a new element inside a state updater: two items on one anchor kept
// swapping places forever and leaked thousands of empty divs into the nav.)

const ATTR = 'sfNavSlot';
const isSlot = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && ATTR in el.dataset;
const orderOf = (el: HTMLElement) => Number(el.dataset[ATTR]) || 0;

/** Where `host` belongs: the sibling to insert it before (null = append). Undefined when it is already in place. */
function placement(anchor: HTMLElement, host: HTMLElement, side: 'after' | 'before', order: number): Element | null | undefined {
  const step = (el: Element | null) => (side === 'after' ? el?.nextElementSibling : el?.previousElementSibling) ?? null;
  const run: HTMLElement[] = [];
  for (let el = step(anchor); isSlot(el); el = step(el)) run.push(el);
  // In the run, and in order with its neighbours → leave it.
  const i = run.indexOf(host);
  if (i >= 0 && host.parentElement === anchor.parentElement) {
    // The run reads outward from the anchor; lower orders sit nearer it.
    const nearer = run[i - 1], farther = run[i + 1];
    if ((!nearer || orderOf(nearer) <= order) && (!farther || orderOf(farther) >= order)) return undefined;
  }
  const others = run.filter(el => el !== host);
  const far = others.find(el => orderOf(el) > order);
  if (side === 'after') {
    if (far) return far;
    return (others[others.length - 1] ?? anchor).nextElementSibling;
  }
  if (far) return far.nextElementSibling;
  return others[others.length - 1] ?? anchor;
}

/**
 * A portal host placed next to the sidebar button `find()` returns.
 * `collapsed` mirrors the anchor (the sidebar shows icons only).
 */
export function useNavSlot(find: () => HTMLElement | null, side: 'after' | 'before', order = 0) {
  const [host] = useState(() => {
    const el = document.createElement('div');
    el.dataset[ATTR] = String(order);
    return el;
  });
  const [attached, setAttached] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const sync = () => {
      const anchor = find();
      if (!anchor?.parentElement) {
        if (host.isConnected) host.remove();
        setAttached(false);
        return;
      }
      setCollapsed(!anchor.textContent?.trim());
      const ref = placement(anchor, host, side, order);
      if (ref !== undefined) anchor.parentElement.insertBefore(host, ref);
      setAttached(true);
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { mo.disconnect(); host.remove(); setAttached(false); };
    // find/side/order are fixed per item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  return { host: attached ? host : null, collapsed };
}
