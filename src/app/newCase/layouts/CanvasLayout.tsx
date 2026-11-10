// ─── Experience C · Whole case on one page ───────────────────────────────────
// The simplest way to finish the whole case without leaving the page, in three
// columns. On the left, a navigator over the one continuous page: every part
// of the case by its name, with its state, its value and a spine that fills as
// the case is answered; a highlight slides to the section in view. In the
// middle, the case itself, top to bottom in the navigator's order: patient and
// lab, each service as a card of compact rows, Add Another Service, scans,
// prescriber and delivery, instructions, then Review and Send. On the right,
// the portal's Teeth Chart, sticky, the one place teeth are picked: tap teeth
// or a whole arch and "What are we making?" appears in the footer bar, offering
// only what fits the selection at this lab. The chart lights the service in
// view or under the pointer. Gaps stay open with "Needs you"; anything else
// opens in place with "Change". Nothing ever leaves the page.
//
// The active row is the page's current step: when an answer moves the case on,
// that row glides into view (between the sticky header and footer) and its
// heading takes focus; the navigator follows. Reading never moves the page.
// When an answer folds the row that had focus, focus stays on that row (or its
// card, or the chart) instead of falling back to the page.

import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProductId } from '../data';
import { useCase } from '../CaseContext';
import { useController } from '../controller';
import { FOCUS } from '../ui';
import { CaseBanners, CaseIdBadge, CaseMenu, CloseButton, SaveIndicator } from './CaseHeader';
import ChartPanel from './canvas/ChartPanel';
import ServiceCard from './canvas/ServiceCard';
import { InstructionsCard, LabFirstCard, LogisticsCard, PatientLabCard } from './canvas/CaseDetails';
import Picker from './canvas/Picker';
import CanvasFooter from './canvas/Footer';
import Navigator, { navEntries } from './canvas/Navigator';
import ReviewCard from './canvas/ReviewCard';
import { useRevealOnScroll } from './canvas/motion';
import { Pending, chartTarget } from './canvas/selection';
import { CanvasContext, CanvasUi, Frame, glide, reveal, useCanvas } from './canvas/state';
import { createSpy, useScrollSpy, useSpy } from './canvas/spy';
import { progressOf } from './canvas/summary';

/** Where focus was inside the canvas, so it can be put back when that control is folded away. */
type FocusMark = { el: HTMLElement; row?: string; item?: string; footer: boolean };

/** Room between the sticky header and the sticky chart panel. */
const UNDER_HEADER = 12;

export default function CanvasLayout() {
  const api = useCase();
  const c = useController();
  const { draft, step, steps, readOnly, go, gaps, lab } = api;
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [armed, setArmed] = useState<ProductId | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  const [spy] = useState(createSpy);
  const settled = useRef(false);
  useLayoutEffect(() => { settled.current = true; }, []);
  /**
   * A navigator click on a section with a gap: the glide waits for the step
   * change, so a row folding above the section (it was open for a change, or
   * the services list closing) is already accounted for.
   */
  const pendingNav = useRef<{ step: string; section: string } | null>(null);

  // The sticky header's height places the sticky chart panel just under it.
  const [headerH, setHeaderH] = useState(76);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const read = () => setHeaderH(h => (Math.abs(h - el.offsetHeight) > 1 ? el.offsetHeight : h));
    read();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const frame = useCallback((): Frame => ({ header: headerRef.current, footer: footerRef.current }), []);
  /** Show a row's section as current while the page glides to it. */
  const holdFor = useCallback((el: Element | null | undefined) => {
    const id = el?.closest('[data-nc-section]')?.getAttribute('data-nc-section');
    if (id) spy.hold(id);
  }, [spy]);

  // A new step (an answer moved the case on, or "Change", or a gap link):
  // focus its heading without the browser's jump, then glide it into view if
  // it isn't already. Runs before the page's own focus call, which then finds
  // the heading already focused and leaves the scroll alone.
  useEffect(() => {
    c.headingRef.current?.focus({ preventScroll: true });
    const nav = pendingNav.current;
    pendingNav.current = null;
    // "Review" is the sticky footer itself: always in view.
    if (step === 'review') return;
    const root = rootRef.current;
    const row = root?.querySelector<HTMLElement>(`[data-nc-row="${step}"]`);
    // From the navigator: the section's top under the header, its gap in view.
    const section = nav?.step === step ? root?.querySelector<HTMLElement>(`[data-nc-section="${nav.section}"]`) : null;
    if (nav && section) { spy.hold(nav.section); glide(section, frame(), row); return; }
    holdFor(row);
    if (row) reveal(row, frame());
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keeping focus when a row folds ─────────────────────────────────────────
  // Answering an open row folds it in the same render, which removes the
  // control that had focus. When the step doesn't change (the row wasn't the
  // active one, an open case holds the move, Clear, Remove…), nothing else
  // would put focus back, so: the same row's heading, else its card's, else
  // the chart's. A real step change then moves focus on as usual.
  const lastFocus = useRef<FocusMark | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      lastFocus.current = {
        el,
        row: el.closest('[data-nc-row]')?.getAttribute('data-nc-row') ?? undefined,
        item: el.closest('[data-nc-item]')?.getAttribute('data-nc-item') ?? undefined,
        footer: !!el.closest('[data-nc-footer]'),
      };
    };
    root.addEventListener('focusin', onIn);
    return () => root.removeEventListener('focusin', onIn);
  }, []);
  useLayoutEffect(() => {
    const last = lastFocus.current;
    const root = rootRef.current;
    if (!last || !root || last.el.isConnected) return;
    const a = document.activeElement;
    if (a && a !== document.body) return;
    const find = (sel: string) => root.querySelector<HTMLElement>(sel);
    // Header menus and the like look after their own focus.
    if (!last.row && !last.item && !last.footer) return;
    const back = (last.row && find(`[data-nc-row="${last.row}"] h2[tabindex="-1"], [data-nc-row="${last.row}"] h3[tabindex="-1"]`))
      || (last.item && find(`[data-nc-item="${last.item}"] h2[tabindex="-1"]`))
      || find('[data-nc-chart-heading]');
    back?.focus({ preventScroll: true });
  });

  // A tooth of a service tapped on the chart: glide to its card and ring it.
  const flashItem = useCallback((itemId: string) => {
    setHighlightId(itemId);
    const card = rootRef.current?.querySelector<HTMLElement>(`[data-nc-item="${itemId}"]`);
    if (card) { spy.hold(itemId); glide(card, frame()); }
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setHighlightId(null), 1800);
  }, [spy, frame]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // "▲ Things Left" (or Ctrl + Enter) while the first gap is already the active
  // row: no step change, so bring the row back into view here.
  const jump = useCallback((id: string) => {
    if (id !== step) { go(id); return; }
    c.headingRef.current?.focus({ preventScroll: true });
    const row = id === 'review' ? null : rootRef.current?.querySelector<HTMLElement>(`[data-nc-row="${id}"]`);
    if (row) { holdFor(row); reveal(row, frame()); }
  }, [step, go, c.headingRef, holdFor, frame]);

  const focusChart = useCallback(() => {
    rootRef.current?.querySelector<HTMLElement>('[data-nc-chart-heading]')?.focus({ preventScroll: true });
  }, []);

  // Esc clears a chart selection first, then a service waiting on the chart
  // (the page's Esc saves and closes the case). With a drawer or modal open
  // (they lock the body scroll), Esc stays the page's.
  useEffect(() => {
    if (!pending && !armed) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.body.style.overflow === 'hidden') return;
      e.stopPropagation();
      if (pending) setPending(null); else setArmed(null);
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [pending, armed]);

  // Ctrl/Cmd + Enter: with a selection on the chart, Send is hidden behind
  // "What are we making?", so go to its first choice instead of sending past
  // it. With the first gap already active, bring it back into view (the page
  // then handles the key as usual).
  useEffect(() => {
    if (readOnly) return;
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter' || document.body.style.overflow === 'hidden') return;
      if (pending) {
        e.preventDefault();
        e.stopPropagation();
        rootRef.current?.querySelector<HTMLElement>('[data-nc-offers] button:not([aria-disabled])')?.focus();
        return;
      }
      if (gaps > 0 && c.firstGapId === step) jump(step);
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [readOnly, pending, gaps, c.firstGapId, step, jump]);

  const showPicker = !readOnly && (draft.items.length === 0 || step === 'services');
  useEffect(() => { if (readOnly) setPending(null); }, [readOnly]);
  // A service waiting on the chart belongs to the list it was picked from.
  useEffect(() => { if (!showPicker) setArmed(null); }, [showPicker]);

  // ── The navigator ──────────────────────────────────────────────────────────
  const entries = navEntries(api, c.view, showPicker);
  /** The step a section's entry opens: its first gap the user can go to, if any. */
  const gapStepOf = (id: string): string | null => {
    if (id === 'lab') return draft.labPicked === false ? 'lab' : null;
    if (id === 'services') return draft.items.length === 0 ? 'services' : null;
    if (id === 'records' || id === 'prescriber') return steps.find(s => s.id === id)?.gap ? id : null;
    return steps.find(s => s.itemId === id && s.gap && s.navigable)?.id ?? null;
  };
  const navTo = (id: string) => {
    const root = rootRef.current;
    if (!root) return;
    // "Add Another Service": the list opens where the button was; the step change glides to it.
    if (id === 'services' && !showPicker) { setPending(null); go('services'); return; }
    const section = root.querySelector<HTMLElement>(`[data-nc-section="${id}"]`);
    if (!section) return;
    const gapStep = readOnly ? null : gapStepOf(id);
    spy.hold(id);
    if (gapStep && gapStep !== step) {
      // The gap opens and takes focus; the step change glides the page there.
      pendingNav.current = { step: gapStep, section: id };
      go(gapStep);
      return;
    }
    const row = gapStep ? root.querySelector<HTMLElement>(`[data-nc-row="${gapStep}"]`) : null;
    glide(section, frame(), row);
    if (gapStep) { c.headingRef.current?.focus({ preventScroll: true }); return; }
    const heading = section.matches('[tabindex="-1"]') && !section.matches('[data-nc-row]')
      ? section
      : section.querySelector<HTMLElement>('h1[tabindex="-1"], h2[tabindex="-1"], h3[tabindex="-1"]');
    (heading ?? section).focus({ preventScroll: true });
  };

  // Sections come and go with the services, the lab card, the list and the view.
  const sig = useMemo(
    () => [draft.labPicked === false ? 'L' : 'l', showPicker ? 'P' : 'p', readOnly ? 'R' : 'r', ...draft.items.map(i => i.id)].join('|'),
    [draft.labPicked, showPicker, readOnly, draft.items],
  );
  useScrollSpy(rootRef, headerRef, footerRef, spy, `${sig}|${headerH}`);
  useRevealOnScroll(rootRef, footerRef, sig);

  // Every card reads the case context too, so the canvas context is rebuilt with it on each render.
  const target = readOnly ? null : chartTarget(armed, draft.items, step, lab);
  const ui: CanvasUi = {
    pending, setPending, armed, setArmed, target, highlightId, flashItem, jump, focusChart, footerRef,
    spy, stickyTop: headerH + UNDER_HEADER, settled,
  };

  return (
    <CanvasContext.Provider value={ui}>
      <div ref={rootRef} className="min-w-[1120px] min-h-[calc(100vh-56px)] flex items-stretch">
        {/* Left: the case navigator, sticky the whole way down. */}
        <div className="w-[248px] flex-shrink-0 pl-5 pr-4 pt-5 pb-5">
          <Navigator entries={entries} onGo={navTo} />
        </div>

        {/* Middle and right: the case and the chart under one sticky header, over one sticky footer. */}
        <div className="flex-1 min-w-0 flex flex-col pr-6">
          <CanvasHeader headerRef={headerRef} />

          <div className="flex-1 flex items-start gap-5 pt-3 pb-5">
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <CaseBanners className="space-y-2" />
              <PatientLabCard />
              {/* Right after the patient: pick the lab (it sets the catalogue, prices and dates). */}
              {draft.labPicked === false && !readOnly && <LabFirstCard />}
              {draft.items.map(item => <ServiceCard key={item.id} item={item} />)}
              {showPicker && <Picker />}
              {!showPicker && !readOnly && (
                <button
                  type="button"
                  data-nc-reveal
                  onClick={() => { setPending(null); go('services'); }}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-[#D4D4DD] text-sm font-semibold text-[#2F62D6] transition-colors duration-150 motion-reduce:transition-none hover:border-[#3F6FE8] hover:bg-[#F8FAFF] ${FOCUS}`}
                >
                  <Plus className="w-4 h-4" aria-hidden />Add Another Service
                </button>
              )}
              <LogisticsCard />
              <InstructionsCard />
              <ReviewCard />
            </div>

            <ChartPanel />
          </div>

          <div ref={footerRef} data-nc-footer className="sticky bottom-3 mb-3 z-20">
            <CanvasFooter />
          </div>
        </div>
      </div>
    </CanvasContext.Provider>
  );
}

/**
 * Sticky title row: whose case, where it came from, and the case controls. It
 * lifts once the page scrolls under it, and its bottom edge is a thin bar that
 * fills as the case is answered.
 */
function CanvasHeader({ headerRef }: { headerRef: RefObject<HTMLElement> }) {
  const api = useCase();
  const { patient, draft, readOnly } = api;
  const c = useController();
  const scrolled = useSpy(useCanvas().spy, s => s.scrolled);
  const { ratio, done, total } = progressOf(api);
  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-30 pt-5 pb-3.5 bg-[#F8F9FC]/90 backdrop-blur-sm transition-shadow duration-200 motion-reduce:transition-none ${
        scrolled ? 'shadow-[0_8px_16px_-14px_rgba(3,2,19,0.35)]' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Read-only views open here, right above the banner that holds Approve and Send. */}
          <h1 ref={readOnly ? c.headingRef : undefined} tabIndex={-1} className="text-xl font-semibold text-[#030213] leading-tight truncate focus:outline-none">
            {c.view === 'edit' ? 'New case for' : 'Case for'} {patient.first} {patient.last}
          </h1>
          {draft.scan && <p className="text-xs text-[#4A4A5A] mt-1 truncate">From the {draft.scan.scanner} scan, today {draft.scan.time}</p>}
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <CaseIdBadge />
          <SaveIndicator />
          <CaseMenu />
          <CloseButton />
        </div>
      </div>
      {!readOnly && (
        <div
          role="progressbar"
          aria-label="Case answered"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={`${done} of ${total} answered`}
          className="absolute left-0 right-0 bottom-0 h-[3px] rounded-full bg-[#E6E6EE] overflow-hidden"
        >
          <div
            className={`h-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none ${ratio >= 1 ? 'bg-[#2E7D32]' : 'bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8]'}`}
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>
      )}
    </header>
  );
}
