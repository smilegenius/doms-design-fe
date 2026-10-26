// ─── Experience C · the case navigator ───────────────────────────────────────
// A scroll navigator over the one continuous page, not a wizard: every part of
// the case by its own name (Patient, Lab, each service by its title, Scans
// Source, Prescriber, Delivery, Case Instructions, Review and Send), each with its state (done, needs you, not reached, optional) and the
// value it holds now. A spine runs through the state icons: the stretch between
// two entries fills once both are settled, so the fill always matches the icons
// and a part that needs you is a gap in it. A highlight slides to the section
// in view. Clicking an entry
// glides its section into view and, when it needs an answer, opens that answer
// and gives it focus. Hovering a service lights its teeth on the chart.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { useCase, CaseApi } from '../../CaseContext';
import { useController } from '../../controller';
import { caseInstructions, itemSpec, itemTitle, plural, slotGaps, slotsFor } from '../../rules';
import { recordsSummary } from '../../CaseSteps';
import { StateIcon, FOCUS } from '../../ui';
import { popIcon, reducedMotion } from './motion';
import { reviewName } from './ReviewCard';
import { useCanvas } from './state';
import { useSpy } from './spy';
import { backLine, progressOf } from './summary';

type NavState = 'done' | 'gap' | 'todo' | 'optional' | 'ready' | 'action';
export interface NavEntry {
  /** The section id (data-nc-section) this entry scrolls to. */
  id: string;
  name: string;
  value?: string;
  state: NavState;
  /** A service's unanswered required items. */
  left?: number;
  itemId?: string;
}

const STATE_WORD: Record<NavState, string> = { done: 'done', gap: 'needs you', todo: 'not reached yet', optional: 'optional', ready: 'ready', action: '' };
/** Nothing more is needed there: the spine runs on through it. */
const SETTLED: NavState[] = ['done', 'optional', 'ready', 'action'];
type Box = { top: number; height: number };
const sameBox = (x?: Box, y?: Box) =>
  (!x && !y) || (!!x && !!y && Math.abs(x.top - y.top) < 0.5 && Math.abs(x.height - y.height) < 0.5);

/** The entries, in page order. */
export function navEntries(api: CaseApi, view: string, showPicker: boolean): NavEntry[] {
  const { draft, ctx, patient, lab, prescriber, user, steps, gaps, readOnly } = api;
  const n = user.notation;
  const gapOf = (id: string) => !!steps.find(s => s.id === id)?.gap;
  const out: NavEntry[] = [
    { id: 'patient', name: 'Patient', value: `${patient.first} ${patient.last} · ${draft.funding === 'nhs' ? 'NHS' : 'Private'}`, state: 'done' },
    draft.labPicked === false
      ? { id: 'lab', name: 'Lab', value: 'Select a lab to proceed', state: 'gap' }
      : { id: 'lab', name: 'Lab', value: lab.name, state: 'done' },
  ];
  for (const it of draft.items) {
    const left = slotGaps(slotsFor(it, ctx, draft)).length;
    out.push({
      id: it.id,
      itemId: it.id,
      name: itemTitle(it, n),
      value: itemSpec(it, ctx) || undefined,
      state: left && !readOnly ? 'gap' : 'done',
      left: readOnly ? 0 : left,
    });
  }
  if (!readOnly) {
    if (draft.items.length === 0) out.push({ id: 'services', name: 'Services', value: 'What are we making?', state: 'gap' });
    else out.push({ id: 'services', name: 'Add Another Service', value: showPicker ? 'Tap teeth or pick a service' : undefined, state: 'action' });
  }
  const records = recordsSummary(api).replace(/ · today .*$/, '');
  out.push({ id: 'records', name: 'Scans Source', value: records, state: gapOf('records') ? 'gap' : 'done' });
  out.push({
    id: 'prescriber',
    name: 'Prescriber',
    value: !prescriber ? 'Not chosen yet' : !prescriber.gdc ? `${prescriber.name} · no GDC number` : `${prescriber.name}${prescriber.id === user.id ? ' (you)' : ''}`,
    state: gapOf('prescriber') ? 'gap' : 'done',
  });
  const note = caseInstructions(draft, n).trim().split('\n')[0];
  out.push({ id: 'instructions', name: 'Case Instructions', value: note || (readOnly ? 'None' : 'Optional'), state: note ? 'done' : 'optional' });
  out.push({
    id: 'review',
    name: reviewName(view),
    value: readOnly ? backLine(api) : gaps ? `${plural(gaps, 'thing')} left` : `Ready · ${backLine(api)}`,
    state: readOnly ? 'done' : gaps ? 'todo' : 'ready',
  });
  return out;
}

export default function Navigator({ entries, onGo }: { entries: NavEntry[]; onGo: (id: string) => void }) {
  const api = useCase();
  const c = useController();
  const ui = useCanvas();
  const { gaps, readOnly } = api;
  const active = useSpy(ui.spy, s => s.active);
  const { done, total } = progressOf(api);
  const listRef = useRef<HTMLOListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** The sliding highlight, and the spine's stretch from each entry's icon to the next one's. */
  const [geo, setGeo] = useState<{ mark?: Box; segs: Box[] }>({ segs: [] });
  const [glides, setGlides] = useState(false);
  const shape = entries.map(e => `${e.id}:${e.state}:${e.value ?? ''}:${e.left ?? ''}`).join('|');

  // Where the sliding highlight and the spine go, measured from the entries themselves.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const ol = listRef.current;
    if (!wrap || !ol) return;
    const measure = () => {
      const base = wrap.getBoundingClientRect().top;
      const mids = Array.from(ol.querySelectorAll<HTMLElement>('[data-nav-icon]')).map(i => {
        const r = i.getBoundingClientRect();
        return r.top + r.height / 2 - base;
      });
      const segs = mids.slice(0, -1).map((m, i) => ({ top: m, height: mids[i + 1] - m }));
      const li = active ? ol.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(active)}"]`) : null;
      const r = li?.getBoundingClientRect();
      const mark = r ? { top: r.top - base, height: r.height } : undefined;
      setGeo(prev => (sameBox(prev.mark, mark) && prev.segs.length === segs.length && prev.segs.every((x, i) => sameBox(x, segs[i]))
        ? prev
        : { mark, segs }));
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(ol);
    return () => ro?.disconnect();
  }, [active, shape]);
  // The first placement lands; later ones slide.
  useEffect(() => {
    if (!geo.mark || glides) return;
    const r = requestAnimationFrame(() => setGlides(true));
    return () => cancelAnimationFrame(r);
  }, [geo.mark, glides]);

  // Keep the current entry in view when the list itself scrolls (a long case).
  useEffect(() => {
    const wrap = scrollRef.current;
    const li = active ? listRef.current?.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(active)}"]`) : null;
    if (!wrap || !li || wrap.scrollHeight <= wrap.clientHeight) return;
    const w = wrap.getBoundingClientRect();
    const r = li.getBoundingClientRect();
    const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth';
    if (r.top < w.top + 4) wrap.scrollBy({ top: r.top - w.top - 8, behavior });
    else if (r.bottom > w.bottom - 4) wrap.scrollBy({ top: r.bottom - w.bottom + 8, behavior });
  }, [active]);

  const slide = glides ? 'transition-[transform,height] duration-200 ease-out motion-reduce:transition-none' : '';
  const complete = !readOnly && gaps === 0;

  return (
    <nav
      aria-label="Case sections"
      className="sticky top-5 flex flex-col bg-white border border-[#E0E0E6] rounded-2xl"
      style={{ maxHeight: 'calc(100vh - 56px - 32px)' }}
    >
      <p className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A4A5A]" aria-hidden>Case sections</p>

      {/* Top padding keeps the first entry's focus ring inside the scroll area. */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2 pt-1 pb-2">
        <div ref={wrapRef} className="relative">
          {/* The sliding highlight, under everything. */}
          {geo.mark && (
            <span
              aria-hidden
              className={`absolute left-0 right-0 top-0 rounded-xl bg-[#EEF4FF] ${slide}`}
              style={{ transform: `translateY(${geo.mark.top}px)`, height: geo.mark.height }}
            >
              <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-[#3F6FE8] to-[#6A5CE8]" />
            </span>
          )}
          {/* The spine through the state icons: each stretch fills once the entries at both its ends are settled. */}
          {geo.segs.map((s, i) => {
            const a = entries[i];
            const b = entries[i + 1];
            if (!a || !b) return null;
            const on = SETTLED.includes(a.state) && SETTLED.includes(b.state);
            return (
              <span key={`${a.id}>${b.id}`} aria-hidden className="absolute w-[2px] bg-[#E6E6EE] overflow-hidden" style={{ left: 19, top: s.top, height: s.height }}>
                <span
                  className="absolute inset-0 origin-top bg-[#2E7D32] transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `scaleY(${on ? 1 : 0})` }}
                />
              </span>
            );
          })}
          <ol ref={listRef}>
            {entries.map(e => {
              const current = active === e.id;
              const hover = e.itemId ? { onMouseEnter: () => ui.spy.hoverOn(e.itemId!), onMouseLeave: () => ui.spy.hoverOff(e.itemId!), onFocus: () => ui.spy.hoverOn(e.itemId!), onBlur: () => ui.spy.hoverOff(e.itemId!) } : {};
              const cls = `group relative w-full text-left flex items-start gap-2.5 pl-3 pr-2.5 py-2 rounded-xl ${FOCUS}`;
              const body = (
                <>
                  <span data-nav-icon className="mt-0.5 flex-shrink-0"><NavIcon state={e.state} /></span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-[13px] leading-5 font-semibold truncate transition-colors duration-150 motion-reduce:transition-none ${
                        e.state === 'action' ? 'text-[#2F62D6] group-hover:text-[#1E40AF]' : current ? 'text-[#1E3A8A]' : 'text-[#030213] group-hover:text-[#2F62D6]'
                      }`}
                      title={e.name}
                    >
                      {e.name}
                    </span>
                    {(e.value || e.left) && (
                      <span className="flex items-baseline gap-2 text-[11px] leading-4">
                        {e.left ? (
                          <span className="font-semibold text-[#8A4B08] whitespace-nowrap"><span aria-hidden>▲ </span>{e.left} left</span>
                        ) : (
                          <span className="min-w-0 truncate text-[#4A4A5A]" title={e.value}>{e.value}</span>
                        )}
                      </span>
                    )}
                    {STATE_WORD[e.state] && <span className="sr-only">, {STATE_WORD[e.state]}</span>}
                  </span>
                </>
              );
              return (
                <li key={e.id} data-nav-id={e.id}>
                  {e.state === 'action' ? (
                    // "Add Another Service" is an action, not a place.
                    <button type="button" aria-current={current ? 'location' : undefined} onClick={() => onGo(e.id)} className={cls}>{body}</button>
                  ) : (
                    <a
                      href={`#nc-sec-${e.id}`}
                      aria-current={current ? 'location' : undefined}
                      onClick={ev => { ev.preventDefault(); onGo(e.id); }}
                      {...hover}
                      className={cls}
                    >
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {!readOnly && (
        // Not a live region: the page already announces the count of things left.
        <div className="mx-2 mb-2 px-3 py-2.5 rounded-xl border border-[#F0EFF6] bg-[#FAFAFC]">
          {complete ? (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#2E7D32]"><StateIcon state="done" size="sm" />Ready to send</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#4A4A5A]">{c.sendLabel} is in the bar below.</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8A4B08]"><StateIcon state="gap" size="sm" />{gaps === 1 ? '1 thing left' : `${gaps} things left`}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#4A4A5A]">{done} of {total} answered</p>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

/** Done ✓, needs you ▲, not reached ○, optional –, ready to send, or an action (+). Pops when it changes. */
function NavIcon({ state }: { state: NavState }) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    popIcon(ref.current);
  }, [state]);
  return (
    <span ref={ref} className="relative w-4 h-4 flex items-center justify-center" aria-hidden>
      {state === 'done' && <StateIcon state="done" size="sm" />}
      {state === 'gap' && <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center"><StateIcon state="gap" size="sm" /></span>}
      {state === 'todo' && <span className="w-4 h-4 rounded-full border-2 border-[#8B8B9E] bg-white" />}
      {state === 'optional' && (
        <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center"><span className="w-2.5 h-[2px] rounded-full bg-[#8B8B9E]" /></span>
      )}
      {state === 'ready' && (
        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#3F6FE8] to-[#6A5CE8] text-white flex items-center justify-center"><Send className="w-2.5 h-2.5" /></span>
      )}
      {state === 'action' && (
        <span className="w-4 h-4 rounded-full border border-dashed border-[#3F6FE8] bg-white text-[#2F62D6] flex items-center justify-center"><Plus className="w-2.5 h-2.5" strokeWidth={3} /></span>
      )}
    </span>
  );
}
