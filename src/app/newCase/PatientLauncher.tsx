// ─── New Case Flow · patient picker: "spotlight + bento" ─────────────────────
// Shown on the page itself (never a popup), and nothing inside it scrolls.
// A tall spotlight search sits on top; under it, a bento of tiles, all visible
// at a glance (Waiting Scans is hidden for now: SHOW_SCANS):
//   Waiting Scans    (mode 'new', two of three columns, top row) scanner
//                    drafts as tickets: scanner badge, patient, time ago, arch
//                    pictograms (upper / lower / bite), what's left. A green
//                    "listening" dot names the connected scanners; the round
//                    sync button checks for new scans, and a new arrival
//                    slides into the ghost ticket's cell glowing "Just In"
//                    (once). Four show, "+ N more" opens the rest in place.
//   New Patient      (mode 'new': the third column, two rows tall) a call to
//                    action that morphs, in the same tile, into the quick-add
//                    form (names mirror the search until typed); the form fits
//                    the tile, so opening it moves nothing else.
//   Recent Patients  (under the scans) one row of avatar bubbles: a ring =
//                    scan waiting, an orange count = other open drafts; hover
//                    (after a beat) or keyboard focus shows a floating detail
//                    card (a non-modal tooltip; Esc dismisses it).
// Typing (two characters or more) turns the bento into results in the same
// frame: matching tickets, then patient cards (six at most, "6 of N"), with
// New Patient beside them offering "Add “Jo Smith”". In 'change' mode there
// are no scans: bubbles and New Patient sit side by side (2:1). Under 760 px
// (measured on the picker itself) everything stacks.
// Keys: ↓ from the search drops to the first ticket, bubble or result; ←→ move
// along a row (then across to the next tile), ↑↓ move between rows and tiles,
// Home/End jump within a row; never inside a text field. Picking someone with
// one open draft continues it, so a scan never gets two drafts; several open
// a chooser right there.

import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, CornerDownLeft, History, Radar, RefreshCw, ScanLine, Search, SearchX, UserPlus, Users, X } from 'lucide-react';
import { CLINIC, Funding, Patient, User } from './data';
import { demoNow, dobFromString, fmtFull, fmtTime, maskDOB, parseDOB } from './dates';
import { fullName, patientAge, plural } from './rules';
import { CaseRow, addPatient, allPatients, checkForScans, loginMap, openDraftsFor, recentPatients, useFlowStore } from './store';
import { draftGaps, scanArchesText } from './derive';
import { ChoiceChips, FOCUS, GRADIENT_BTN, Notice, PrimaryButton, SecondaryButton, Segmented, StateIcon } from './ui';

export interface LauncherProps {
  mode: 'new' | 'change';
  user: User;
  /** Shown as a Cancel (×) when the picker can be dismissed (changing patient). */
  onClose?: () => void;
  /** Focus the search box on mount. */
  autoFocus?: boolean;
  /** Continue an existing draft row. */
  onOpenDraft: (row: CaseRow) => void;
  /** Start a new case (or, in change mode, move this case) for a patient. */
  onPick: (patientId: string) => void;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
function matches(p: Patient, q: string): boolean {
  const query = norm(q);
  if (query.length < 2) return false;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 4 && p.dob.replace(/\D/g, '').startsWith(digits)) return true;
  if (p.dob.includes(q.trim())) return true;
  if (norm(p.id).includes(query) || (p.practiceId && norm(p.practiceId).includes(query))) return true;
  return norm(fullName(p)).includes(query) || norm(`${p.last} ${p.first}`).includes(query);
}

/** Tickets shown before "+ N more"; bubbles at rest and result cards while searching. */
const SCAN_CAP = 4;
/** The Waiting Scans tile is hidden for now (user call, 26-Oct): a scan stays reachable through its
 *  patient (the bubble's ring, or search). Flip back to bring the tile back. */
const SHOW_SCANS = false;
const PEOPLE = 6;
/** The picker's own width at which the tiles sit side by side. */
const WIDE = 760;
/** Marks what the arrow keys move between; the value names the row it belongs to. */
const NAV = 'data-nav';
const TILE = 'min-w-0 bg-white rounded-2xl border border-[#E0E0E6] shadow-[0_1px_2px_rgba(3,2,19,0.04)]';
const RISE = 'motion-safe:animate-[pl-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_both]';
/** A new ticket's entrance. Its glow plays on a child span, so the ticket's own box-shadow (tint and focus ring) stays put. */
const JUST_IN = 'motion-safe:animate-[pl-in_0.55s_cubic-bezier(0.16,1,0.3,1)_both]';
const GLOW = 'motion-safe:animate-[pl-glow_1.6s_ease-out_0.4s_2]';
/** Keyframes used only here; every use goes through motion-safe:. */
const KEYFRAMES = `
@keyframes pl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pl-in { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes pl-glow { 0% { box-shadow: 0 0 0 0 rgba(63,111,232,0.45); } 70%, 100% { box-shadow: 0 0 0 10px rgba(63,111,232,0); } }
@keyframes pl-ping { 0% { transform: scale(1); opacity: 0.5; } 70%, 100% { transform: scale(2.8); opacity: 0; } }
@keyframes pl-pop { from { opacity: 0; transform: translateY(4px) scale(0.98); } to { opacity: 1; transform: none; } }
`;

type FocusTo = 'first' | 'next' | 'cta';
interface TipPos { id: string; dx: number; caret: number; above: boolean }
const TIP_W = 236;
/** A first guess at the card's height; once it renders, its real height decides the flip. */
const TIP_H = 160;
/** Hover waits this long before a card opens, so a pointer passing over the bubbles opens none. */
const TIP_HOVER_MS = 300;

export default function PatientPicker({ mode, user, onClose, onOpenDraft, onPick, autoFocus = true }: LauncherProps) {
  const store = useFlowStore();
  const { rows } = store;
  const uid = useId();
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [allScans, setAllScans] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const chooserFirst = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // "23 min ago" follows the demo clock.
  const [, setTick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setTick(n => n + 1), 30_000); return () => window.clearInterval(t); }, []);

  // ── Room: measured on the picker, so one picker fits a page column or a card ──
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = width >= WIDE;
  const cardCols = wide && width >= 1080 ? 3 : wide || width >= 480 ? 2 : 1;

  const patients = useMemo(() => allPatients(), [store.patients]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = useMemo(() => recentPatients(), [store.patients]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(patients.map(p => [p.id, p] as const)), [patients]);
  const draftsOf = useMemo(() => {
    const m = new Map<string, CaseRow[]>();
    for (const r of rows) if (r.status === 'Draft' && !r.flag && r.draft) m.set(r.patientId, [...(m.get(r.patientId) ?? []), r]);
    return m;
  }, [rows]);
  // The scanners Smile Genius is linked to (known logins), plus any a scan came from.
  const scanners = useMemo(() => {
    const s = new Set<string>();
    Object.keys(loginMap()).forEach(k => s.add(k.split(':')[0]));
    rows.forEach(r => {
      if (r.source !== 'scanner') return;
      const n = r.draft?.scan?.scanner ?? r.scanLabel?.split(' · ')[0];
      if (n) s.add(n);
    });
    return Array.from(s);
  }, [rows, store.logins]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.trim();
  const searching = norm(q).length >= 2;
  const waiting = !SHOW_SCANS ? [] : rows.filter(r => r.status === 'Draft' && r.source === 'scanner' && !r.flag && r.draft && byId.has(r.patientId));
  const scans = searching ? waiting.filter(r => matches(byId.get(r.patientId)!, q)) : waiting;
  const matched = useMemo(() => (searching ? patients.filter(p => matches(p, q)) : []), [patients, q, searching]);
  const people = searching ? matched.slice(0, PEOPLE) : recent.slice(0, PEOPLE);
  // A broad search shows the cap in the count pill ("6 of 8") rather than a line that could wrap.
  const capped = searching && matched.length > PEOPLE;
  const exact = matched.find(p => norm(fullName(p)) === norm(q));

  const pick = (p: Patient) => {
    if (mode === 'change') { onPick(p.id); return; }
    const drafts = openDraftsFor(p.id);
    if (drafts.length === 1) { onOpenDraft(drafts[0]); return; }
    if (drafts.length > 1) { setExpanded(x => (x === p.id ? null : p.id)); return; }
    onPick(p.id);
  };
  // Several drafts: the chooser opens under the bubbles (or results) and takes focus.
  useEffect(() => { if (expanded) chooserFirst.current?.focus(); }, [expanded]);
  const dismissChooser = () => {
    const id = expanded;
    setExpanded(null);
    const back = id ? rootRef.current?.querySelector<HTMLElement>(`[data-pid="${id}"][${NAV}="bubbles"], [data-pid="${id}"][${NAV}="results"]`) : null;
    (back ?? input.current)?.focus();
  };

  // ── Refresh: ask the scanners for anything new (demo: one held-back scan) ──
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => fmtTime(demoNow()));
  const [said, setSaid] = useState('');
  const [justIn, setJustIn] = useState<string[]>([]);
  // A Just In ticket keeps its tint and tag, but its arrival plays once: not again when a search clears.
  const played = useRef(new Set<string>());
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const refresh = () => {
    if (checking) return;
    const since = checkedAt;
    setChecking(true);
    setSaid('Checking scanners…');
    timer.current = window.setTimeout(() => {
      const got = checkForScans();
      setCheckedAt(fmtTime(demoNow()));
      setChecking(false);
      if (!got.length) { setSaid(`No new scans since ${since}`); return; }
      setJustIn(ids => [...ids, ...got.map(r => r.id)]);
      const from = Array.from(new Set(got.map(r => r.draft?.scan?.scanner ?? 'the scanner'))).join(' and ');
      setSaid(`${plural(got.length, 'new scan')} from ${from}`);
    }, 900);
  };

  // ── New Patient: the tile's call to action morphs into the form ──
  const [formOpen, setFormOpen] = useState(false);
  const [focusReq, setFocusReq] = useState<{ to: FocusTo; n: number } | null>(null);
  const openForm = (to: 'first' | 'next') => { setFormOpen(true); setFocusReq(f => ({ to, n: (f?.n ?? 0) + 1 })); };
  const closeForm = () => { setFormOpen(false); setFocusReq(f => ({ to: 'cta', n: (f?.n ?? 0) + 1 })); };

  // ── Bubble detail cards: hover or keyboard focus, never modal ──
  const [tip, setTip] = useState<TipPos | null>(null);
  const tipTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(tipTimer.current), []);
  const showTip = (id: string, anchor: HTMLElement, delay = 0) => {
    window.clearTimeout(tipTimer.current);
    const place = () => {
      const root = rootRef.current;
      if (!root || !anchor.isConnected) return;
      const a = anchor.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      // Kept inside the picker's width; flipped above when the page (or a clipping card) ends below.
      const left = Math.max(box.left, Math.min(a.left + a.width / 2 - TIP_W / 2, box.right - TIP_W));
      setTip({ id, dx: left - a.left, caret: a.left + a.width / 2 - left, above: flipAbove(anchor, TIP_H) });
    };
    // Hover waits a beat unless a card is already up (then moving along the bubbles switches at once).
    if (delay && !tip) tipTimer.current = window.setTimeout(place, delay);
    else place();
  };
  const hideTip = (after = 0) => {
    window.clearTimeout(tipTimer.current);
    if (after) tipTimer.current = window.setTimeout(() => setTip(null), after);
    else setTip(null);
  };
  // The card's real height (a scan line, drafts, a long "Last:") decides the flip, before it paints.
  useLayoutEffect(() => {
    if (!tip) return;
    const card = document.getElementById(`${uid}-tip-${tip.id}`);
    const anchor = card?.parentElement;
    if (!card || !anchor) return;
    const above = flipAbove(anchor, card.offsetHeight);
    if (above !== tip.above) setTip({ ...tip, above });
  }, [tip, uid]);
  // Esc dismisses a card wherever focus is (WCAG 1.4.13), and does only that.
  useEffect(() => {
    if (!tip) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      window.clearTimeout(tipTimer.current);
      setTip(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [tip]);

  // ── Keyboard: ↓ into the bento, then arrows move spatially between tiles ──
  const intoBento = () => {
    const items = navItems(gridRef.current);
    (items.find(el => el.getAttribute(NAV) !== 'tile') ?? items[0])?.focus();
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); intoBento(); return; }
    if (e.key === 'Escape' && !onClose && q) { e.preventDefault(); setQ(''); setExpanded(null); setTip(null); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exact) pick(exact);
      else if (searching) openForm('next');
    }
  };
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const row = t.getAttribute(NAV);
    // Never take arrows from a text field (the form's inputs carry no data-nav anyway).
    if (!row || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const items = navItems(gridRef.current);
    if (!items.includes(t)) return;
    const same = items.filter(el => el.getAttribute(NAV) === row);
    const i = same.indexOf(t);
    let next: HTMLElement | null | undefined;
    if (e.key === 'ArrowDown') next = stepV(t, items, 1);
    else if (e.key === 'ArrowUp') next = stepV(t, items, -1) ?? input.current;
    else if (e.key === 'ArrowRight') next = same[i + 1] ?? stepH(t, items, 1);
    else if (e.key === 'ArrowLeft') next = same[i - 1] ?? stepH(t, items, -1);
    else if (e.key === 'Home') next = same[0];
    else next = same[same.length - 1];
    e.preventDefault();
    if (next && next !== t) next.focus();
  };
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); }
  };

  // What Enter in the search box will do, shown at its right edge.
  const firstDrafts = exact ? (draftsOf.get(exact.id) ?? []).length : 0;
  const enterText = exact
    ? mode === 'change' ? 'Use Patient' : firstDrafts === 1 ? 'Continue Draft' : firstDrafts > 1 ? 'Choose Draft' : 'Start Case'
    : 'Add as New';

  // ── Pieces ──
  const chooserId = `${uid}-choose`;
  const chooserFor = mode === 'new' && expanded ? byId.get(expanded) : undefined;
  const chooserDrafts = chooserFor ? draftsOf.get(chooserFor.id) ?? [] : [];
  const chooser = chooserFor && chooserDrafts.length > 1 && (
    <DraftChooser id={chooserId} p={chooserFor} drafts={chooserDrafts} firstRef={chooserFirst} onOpenDraft={onOpenDraft} onSeparate={() => onPick(chooserFor.id)} onDismiss={dismissChooser} />
  );

  const ticketList = (list: CaseRow[], cols: 1 | 2) => {
    // New arrivals go after the others, into the cell the ghost ticket held: nothing else moves.
    const fresh = searching ? [] : list.filter(r => justIn.includes(r.id));
    const base = fresh.length ? list.filter(r => !justIn.includes(r.id)) : list;
    const shown = allScans
      ? [...base, ...fresh]
      : [...base.slice(0, Math.max(0, SCAN_CAP - fresh.length)), ...fresh.slice(0, SCAN_CAP)];
    // Two tickets side by side in a column under ~860 px leave a tight second row.
    const tight = cols === 2 && width < 860;
    return (
      <>
        <ul className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {shown.map(r => {
            const isNew = justIn.includes(r.id);
            return (
              <Ticket
                key={r.id}
                row={r}
                p={byId.get(r.patientId)!}
                user={user}
                q={searching ? q : ''}
                fresh={isNew}
                animate={isNew && !played.current.has(r.id)}
                onPlayed={() => played.current.add(r.id)}
                tight={tight}
                onOpen={() => onOpenDraft(r)}
              />
            );
          })}
          {/* An odd ticket out leaves a cell: it shows where the next scan lands. */}
          {cols === 2 && !searching && shown.length % 2 === 1 && <GhostTicket />}
        </ul>
        {list.length > SCAN_CAP && (
          <button type="button" data-nav="more" onClick={() => setAllScans(v => !v)} aria-expanded={allScans} className={`mt-2 w-full h-8 rounded-lg border border-dashed border-[#DCE6FD] text-xs font-semibold text-[#2F62D6] hover:bg-[#F5F8FF] ${FOCUS}`}>
            {allScans ? 'Show Fewer' : `+ ${plural(list.length - SCAN_CAP, 'more scan')}`}
          </button>
        )}
      </>
    );
  };

  const leftSpan = wide ? 'col-span-2' : '';
  // Searching: while the form is open, the tile beside the results grows; the results keep their own height.
  const leftSelf = wide && formOpen ? 'self-start' : '';
  // Mode 'new' at rest: New Patient takes the third column, two rows tall, beside the scans and the bubbles.
  // Its form fits that height, so opening it changes nothing around it.
  const tallTile = wide && mode === 'new' && SHOW_SCANS && !searching;

  const scansTile = (
    <section key="scans" aria-labelledby={`${uid}-scans`} className={`${TILE} flex flex-col p-3.5 ${leftSpan} ${RISE}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-h-7">
        <h3 id={`${uid}-scans`} className="flex items-center gap-1.5 text-sm font-semibold text-[#030213]">
          <ScanLine className="w-4 h-4 text-[#2F62D6]" aria-hidden />Waiting Scans<Count n={scans.length} />
        </h3>
        {scanners.length > 0 && <Listening names={scanners} />}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-[#5A5A6A] whitespace-nowrap">{checking ? 'Checking…' : `Checked ${checkedAt}`}</span>
          <button
            type="button"
            onClick={refresh}
            aria-label="Check for new scans"
            aria-disabled={checking || undefined}
            title="Check for new scans"
            className={`w-7 h-7 inline-flex items-center justify-center rounded-full border border-[#E0E0E6] bg-white text-[#4A4A5A] hover:text-[#2F62D6] hover:border-[#C8D8FC] hover:bg-[#F5F8FF] motion-safe:transition-colors ${FOCUS}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-2.5 flex-1 flex flex-col">
        {scans.length === 0 ? <ScansEmpty /> : ticketList(scans, wide ? 2 : 1)}
      </div>
    </section>
  );

  const anyRing = people.some(p => (draftsOf.get(p.id) ?? []).some(r => r.source === 'scanner'));
  const anyBadge = people.some(p => (draftsOf.get(p.id) ?? []).some(r => r.source !== 'scanner'));
  // z-10 on the strip: a bubble's floating card paints over the tiles around it.
  // When a taller tile beside it stretches the strip, the bubbles sit centred (my-auto), not on top of a gap.
  const recentStrip = (
    <section
      key="recent"
      aria-labelledby={`${uid}-recent`}
      className={`${TILE} relative z-10 flex flex-col px-3.5 py-3 ${leftSpan} ${RISE}`}
      style={{ animationDelay: mode === 'new' ? '140ms' : '0ms' }}
    >
      <div className="flex items-center gap-2 min-h-7">
        <h3 id={`${uid}-recent`} className="flex items-center gap-1.5 text-sm font-semibold text-[#030213]">
          <History className="w-4 h-4 text-[#4A4A5A]" aria-hidden />Recent Patients
        </h3>
        {width >= 480 && (anyRing || anyBadge) && (
          <span aria-hidden className="ml-auto flex items-center gap-3 text-[11px] text-[#5A5A6A]">
            {anyRing && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full p-[1.5px] bg-gradient-to-tr from-[#3F6FE8] to-[#6A5CE8]"><span className="block w-full h-full rounded-full bg-white" /></span>Scan waiting</span>}
            {anyBadge && <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#FFF8E1] border border-[#E07B00]" />Open draft</span>}
          </span>
        )}
      </div>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-[#4A4A5A]">No patients yet. Add one under New Patient.</p>
      ) : (
        // Six bubbles need 6 × 68 + 5 × 12 = 468 px: one row from a 520 px picker up.
        <ul className="my-auto pt-1.5 flex flex-wrap gap-x-3 gap-y-3">
          {people.map(p => (
            <Bubble
              key={p.id}
              p={p}
              drafts={draftsOf.get(p.id) ?? []}
              mode={mode}
              expanded={expanded === p.id}
              chooserId={chooserId}
              tipId={`${uid}-tip-${p.id}`}
              tip={tip?.id === p.id ? tip : null}
              onShow={(el, delay) => showTip(p.id, el, delay)}
              onHide={hideTip}
              onPick={() => { hideTip(); pick(p); }}
            />
          ))}
        </ul>
      )}
      {chooser}
    </section>
  );

  const resultsFrame = (
    <section key="results" aria-labelledby={`${uid}-res`} className={`${TILE} p-3.5 ${leftSpan} ${leftSelf} ${RISE}`}>
      {mode === 'new' && scans.length > 0 && (
        <div className="mb-3.5">
          <h3 className="flex items-center gap-1.5 min-h-7 text-sm font-semibold text-[#030213]">
            <ScanLine className="w-4 h-4 text-[#2F62D6]" aria-hidden />Waiting Scans<Count n={scans.length} />
          </h3>
          <div className="mt-2">{ticketList(scans, wide ? 2 : 1)}</div>
        </div>
      )}
      <h3 id={`${uid}-res`} className="flex items-center gap-1.5 min-h-7 text-sm font-semibold text-[#030213]">
        <Users className="w-4 h-4 text-[#4A4A5A]" aria-hidden />Patients<Count n={capped ? `${PEOPLE} of ${matched.length}` : matched.length} />
      </h3>
      {people.length === 0 ? (
        <NoMatch query={query} onAdd={() => openForm('next')} />
      ) : (
        <ul className={`mt-2 grid gap-2 ${cardCols === 3 ? 'grid-cols-3' : cardCols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {people.map(p => (
            <ResultCard key={p.id} p={p} q={q} drafts={draftsOf.get(p.id) ?? []} mode={mode} expanded={expanded === p.id} chooserId={chooserId} onPick={() => pick(p)} />
          ))}
        </ul>
      )}
      {chooser}
    </section>
  );

  const tile = (
    <NewPatientTile
      key="tile"
      uid={uid}
      mode={mode}
      query={q}
      exact={!!exact}
      searching={searching}
      matchedCount={matched.length}
      open={formOpen}
      banner={!wide}
      tall={tallTile}
      cols3={!wide && width >= 480}
      focusReq={focusReq}
      escBack={!onClose}
      onOpen={() => openForm('first')}
      onBack={closeForm}
      onCreated={p => onPick(p.id)}
      onUse={pick}
      className={`${RISE} ${tallTile ? 'row-span-2' : ''}`}
      style={{ animationDelay: '70ms' }}
    />
  );

  const blocks = searching
    ? [resultsFrame, tile]
    : mode === 'new' && SHOW_SCANS
      ? wide ? [scansTile, tile, recentStrip] : [scansTile, recentStrip, tile]
      : [recentStrip, tile];

  return (
    <section ref={rootRef} aria-label={mode === 'change' ? 'Change patient' : 'Find or add a patient'} onKeyDown={onEsc} className="w-full flex flex-col gap-3">
      <style>{KEYFRAMES}</style>

      {/* Spotlight search: a gradient ring and a soft glow while it has focus. */}
      <div className="group/spot relative">
        <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-[20px] bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8] opacity-0 blur-md group-focus-within/spot:opacity-25 motion-safe:transition-opacity motion-safe:duration-300" />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8] opacity-0 group-focus-within/spot:opacity-100 motion-safe:transition-opacity motion-safe:duration-300" />
        <div className="relative flex items-center gap-3 h-[54px] pl-4 pr-2.5 rounded-2xl bg-white bg-clip-padding border-[1.5px] border-[#E0E0E6] [&:hover:not(:focus-within)]:border-[#C8D8FC] focus-within:border-transparent shadow-[0_8px_24px_-12px_rgba(3,2,19,0.18)]">
          <Search className="w-5 h-5 flex-shrink-0 text-[#5A5A6A] group-focus-within/spot:text-[#3F6FE8] motion-safe:transition-colors" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={e => { setQ(e.target.value); setExpanded(null); setTip(null); }}
            onKeyDown={onSearchKey}
            placeholder="Name, date of birth or patient ID"
            aria-label="Find a patient by name, date of birth or patient ID"
            aria-describedby={`${uid}-keys`}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-[#030213] placeholder:text-[#6B6B7B] outline-none"
          />
          <span aria-hidden className="flex items-center gap-2 flex-shrink-0">
            <KeyHint k="↓" label={searching ? undefined : 'Browse'} />
            {searching && <KeyHint k={<CornerDownLeft className="w-3 h-3" />} label={enterText} />}
          </span>
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => { setQ(''); setExpanded(null); setTip(null); input.current?.focus(); }} className={`px-2 py-1 rounded-lg text-xs font-semibold text-[#2F62D6] hover:text-[#1E40AF] hover:bg-[#F5F8FF] flex-shrink-0 ${FOCUS}`}>
              Clear
            </button>
          )}
          {onClose && <button type="button" onClick={onClose} aria-label="Cancel" className={`p-1.5 rounded-lg text-[#4A4A5A] hover:text-[#030213] hover:bg-[#F8F9FC] flex-shrink-0 ${FOCUS}`}><X className="w-4 h-4" /></button>}
          <p id={`${uid}-keys`} className="sr-only">Typing filters the tiles below. Arrow keys move between them. Enter picks an exact match, or goes on to add a new patient.</p>
        </div>
      </div>
      <p role="status" className="sr-only">
        {searching ? `Found ${plural(matched.length, 'patient')}${mode === 'new' && SHOW_SCANS ? ` and ${plural(scans.length, 'waiting scan')}` : ''}.${capped ? ` Showing ${PEOPLE}. Keep typing to narrow it down.` : ''}` : ''}
      </p>
      <p role="status" className="sr-only">{said}</p>

      <div ref={gridRef} onKeyDown={onGridKey} className={`grid gap-3 ${wide ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {blocks}
      </div>
    </section>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function KeyHint({ k, label }: { k: ReactNode; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5A5A6A] whitespace-nowrap">
      <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md border border-[#E0E0E6] border-b-2 bg-[#F8F9FC] font-sans text-[11px] font-semibold text-[#4A4A5A]">{k}</kbd>
      {label}
    </span>
  );
}
function Count({ n }: { n: number | string }) {
  return <span className="min-w-[20px] px-1.5 flex-shrink-0 whitespace-nowrap rounded-full bg-[#F0EFF6] text-center text-[11px] leading-[18px] font-semibold text-[#4A4A5A]">{n}</span>;
}
/** Green dot with a slow pulse (motion-safe): the scanners are linked and sending. */
function Listening({ names }: { names: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#4A4A5A] whitespace-nowrap">
      <span className="relative flex w-2 h-2 flex-shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[#2E7D32] opacity-0 motion-safe:animate-[pl-ping_2.8s_ease-out_infinite]" />
        <span className="relative w-2 h-2 rounded-full bg-[#2E7D32]" />
      </span>
      <span><span className="sr-only">Listening: </span>{names.join(' · ')} connected</span>
    </span>
  );
}
function Pill({ tone, children }: { tone: 'gap' | 'ok' | 'info'; children: ReactNode }) {
  const cls = tone === 'gap' ? 'bg-[#FFF8E1] text-[#8A4B08] border-[#F5D98B]' : tone === 'ok' ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' : 'bg-[#EEF4FF] text-[#1E40AF] border-[#C8D8FC]';
  return <span className={`inline-flex items-center gap-0.5 px-1.5 rounded-full text-[11px] leading-4 font-semibold border whitespace-nowrap ${cls}`}>{children}</span>;
}
const AV = { md: 'w-9 h-9 text-xs', lg: 'w-10 h-10 text-[13px]' } as const;
function Avatar({ p, size = 'md' }: { p: Patient; size?: keyof typeof AV }) {
  return (
    <span className={`${AV[size]} rounded-full bg-gradient-to-br from-[#3F6FE8] to-[#6A5CE8] text-white font-semibold flex items-center justify-center flex-shrink-0`} aria-hidden>
      {p.first[0]}{p.last[0]}
    </span>
  );
}
/** The big soft icon on the New Patient tile. */
function Blob({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-12 h-12 rounded-2xl' : size === 'md' ? 'w-10 h-10 rounded-xl' : 'w-7 h-7 rounded-lg';
  const icon = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <span aria-hidden className={`${box} flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#3F6FE8] to-[#6A5CE8] text-white shadow-[0_10px_24px_-8px_rgba(63,111,232,0.6)]`}>
      <UserPlus className={icon} strokeWidth={1.9} />
    </span>
  );
}

/** The matched part of a name or ID, marked in the brand tint (amber stays for what needs you). */
const MARK = 'bg-[#DCE6FD] text-[#1E40AF] rounded-sm px-0.5 -mx-0.5';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function Marked({ text, q }: { text: string; q: string }) {
  const query = norm(q);
  if (query.length < 2) return <>{text}</>;
  const terms = Array.from(new Set([query, ...query.split(' ').filter(w => w.length >= 2)])).sort((a, b) => b.length - a.length);
  const parts = text.split(new RegExp(`(${terms.map(esc).join('|')})`, 'gi'));
  return <>{parts.map((s, i) => (i % 2 ? <mark key={i} className={MARK}>{s}</mark> : s))}</>;
}
/** A date of birth matched by its digits ("1203…") marks the digits typed. */
function MarkedDob({ dob, q }: { dob: string; q: string }) {
  const t = q.trim();
  const digits = q.replace(/\D/g, '');
  if (t.length >= 2 && dob.includes(t)) return <Marked text={dob} q={t} />;
  if (digits.length >= 4 && dob.replace(/\D/g, '').startsWith(digits)) {
    let end = 0;
    for (let n = 0; end < dob.length && n < digits.length; end++) if (/\d/.test(dob[end])) n++;
    return <><mark className={MARK}>{dob.slice(0, end)}</mark>{dob.slice(end)}</>;
  }
  return <>{dob}</>;
}

/** "23 min ago" on the demo clock, for a scan taken today at "10:42". */
function ago(time: string): string {
  const now = demoNow();
  const [h, m] = time.split(':').map(Number);
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  const min = Math.max(0, Math.floor((now.getTime() - t.getTime()) / 60000));
  if (min < 1) return 'just now';
  return min < 60 ? `${min} min ago` : `${Math.floor(min / 60)} h ago`;
}

// ─── Scan tickets ────────────────────────────────────────────────────────────

const SCANNER_TONE: Record<string, string> = {
  Medit: 'bg-[#EEF4FF] text-[#2F62D6] border-[#DCE6FD]',
  iTero: 'bg-[#F3EEFF] text-[#5B4BD8] border-[#E4DCFB]',
  '3Shape': 'bg-[#EAF7F1] text-[#1F7A4F] border-[#CDEBDC]',
  'DS Core': 'bg-[#FFF4E5] text-[#9A4A07] border-[#F5D9B5]',
};
function ScannerBadge({ name }: { name: string }) {
  return (
    <span className={`h-[18px] px-1.5 inline-flex items-center flex-shrink-0 rounded-md border font-mono text-[10px] font-semibold tracking-wider ${SCANNER_TONE[name] ?? 'bg-[#F3F3F5] text-[#4A4A5A] border-[#E0E0E6]'}`}>
      {name === 'iTero' ? name : name.toUpperCase()}
    </span>
  );
}
const ARCH_NAME = { upper: 'Upper arch', lower: 'Lower arch', bite: 'Bite' } as const;
/** Upper arch · lower arch · bite, lit when the scan has them. */
function ArchGlyphs({ arches }: { arches: { upper: boolean; lower: boolean; bite: boolean } }) {
  return (
    <span className="flex flex-shrink-0 items-center gap-px">
      {(['upper', 'lower', 'bite'] as const).map(k => (
        <span key={k} title={arches[k] ? ARCH_NAME[k] : `${ARCH_NAME[k]} (not in this scan)`} className={`w-5 h-[18px] rounded-md flex items-center justify-center ${arches[k] ? 'bg-[#EEF4FF] text-[#2F62D6]' : 'text-[#C4C4D0]'}`}>
          <svg viewBox="0 0 16 12" width="15" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {k === 'upper' && <><path d="M2 11C2 5 4.7 1.5 8 1.5S14 5 14 11" /><path d="M5.2 11C5.2 7.4 6.4 5 8 5s2.8 2.4 2.8 6" opacity=".45" /></>}
            {k === 'lower' && <><path d="M2 1C2 7 4.7 10.5 8 10.5S14 7 14 1" /><path d="M5.2 1C5.2 4.6 6.4 7 8 7s2.8-2.4 2.8-6" opacity=".45" /></>}
            {k === 'bite' && <><path d="M2 5.3C2 3 4.7 1.2 8 1.2S14 3 14 5.3" /><path d="M2 6.7C2 9 4.7 10.8 8 10.8S14 9 14 6.7" /><path d="M1.5 6h13" opacity=".45" strokeDasharray="1.5 1.5" /></>}
          </svg>
        </span>
      ))}
    </span>
  );
}

function Ticket({ row, p, user, q, fresh, animate, tight, onPlayed, onOpen }: {
  row: CaseRow; p: Patient; user: User; q: string;
  /** Arrived on this visit: tinted and tagged "Just In". */
  fresh: boolean;
  /** Play the arrival (slide-in and glow); true only until it has played once. */
  animate: boolean;
  /** Two tickets side by side in a narrow column: a long scanner badge drops the word "Ready". */
  tight: boolean;
  onPlayed: () => void; onOpen: () => void;
}) {
  const draft = row.draft!;
  const scan = draft.scan;
  const gaps = draftGaps(draft, user);
  const name = fullName(p);
  const [scanner, time] = scan ? [scan.scanner, scan.time] : (row.scanLabel ?? 'Scan').split(' · ');
  const since = time ? ago(time) : '';
  const arches = scanArchesText(draft);
  const terse = tight && scanner.length > 5;
  // Punched notches where the stub tears off; they take the ticket's border colour.
  const notch = `absolute -right-[5px] w-2.5 h-[5px] bg-white border motion-safe:transition-colors ${
    fresh ? 'border-[#C8D8FC] group-hover:border-[#3F6FE8]/50' : 'border-[#ECECF2] group-hover:border-[#DCE6FD]'
  }`;
  return (
    <li className="min-w-0">
      <button
        type="button"
        data-nav="tickets"
        data-pid={p.id}
        onClick={onOpen}
        title={time ? `${scanner} · ${time}` : scanner}
        className={`group relative w-full h-full flex items-stretch rounded-xl border text-left motion-safe:transition-[background-color,border-color,box-shadow] ${
          fresh
            ? `bg-[#F5F8FF] border-[#C8D8FC] shadow-[0_0_0_3px_rgba(63,111,232,0.12)] hover:bg-white hover:border-[#3F6FE8]/50 ${animate ? JUST_IN : ''}`
            : 'bg-[#F8F9FC] border-[#ECECF2] hover:bg-white hover:border-[#DCE6FD] hover:shadow-[0_6px_18px_-10px_rgba(63,111,232,0.45)]'
        } ${FOCUS}`}
      >
        {animate && (
          <span
            aria-hidden
            onAnimationEnd={e => { if (e.animationName === 'pl-glow') onPlayed(); }}
            className={`pointer-events-none absolute -inset-px rounded-xl ${GLOW}`}
          />
        )}
        {/* The stub: who it's for, torn off along a dashed line. */}
        <span className="relative flex items-center px-2 border-r border-dashed border-[#DCE6FD]">
          <Avatar p={p} />
          <span aria-hidden className={`${notch} -top-px border-t-0 rounded-b-full`} />
          <span aria-hidden className={`${notch} -bottom-px border-b-0 rounded-t-full`} />
        </span>
        <span className="flex-1 min-w-0 px-2.5 py-2">
          <span className="flex items-center gap-2 h-5">
            <span className="min-w-0 truncate text-sm font-semibold text-[#030213]"><Marked text={name} q={q} /></span>
            <span aria-hidden className="ml-auto flex-shrink-0">
              {fresh
                ? <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-[#2F62D6] text-white text-[10px] font-bold uppercase tracking-wide">Just In</span>
                : <span className="text-[11px] text-[#5A5A6A] whitespace-nowrap">{since}</span>}
            </span>
          </span>
          <span aria-hidden className="mt-1.5 flex items-center gap-2 h-5">
            {/* Badge and arches give way (clipped) before the status does. */}
            <span className="min-w-0 flex items-center gap-1.5 overflow-hidden">
              <ScannerBadge name={scanner} />
              {scan && <ArchGlyphs arches={scan.arches} />}
            </span>
            <span className="ml-auto flex-shrink-0">
              {gaps ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A4B08] whitespace-nowrap">
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#FFF8E1] ring-[1.5px] ring-inset ring-[#E07B00] text-center text-[10px] font-bold leading-4">{gaps}</span>left
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32] whitespace-nowrap">
                  <span className="w-4 h-4 rounded-full bg-[#2E7D32] text-white flex items-center justify-center"><Check className="w-2.5 h-2.5" strokeWidth={3.5} /></span>{terse ? null : 'Ready'}
                </span>
              )}
            </span>
          </span>
          <span className="sr-only">
            , {scanner} scan{time ? ` at ${time}` : ''}{since ? `, ${since}` : ''}.{arches ? ` Arches: ${arches}.` : ''} {gaps ? `${gaps} ${gaps === 1 ? 'thing' : 'things'} left.` : 'Ready.'}{fresh ? ' Just in.' : ''}
          </span>
        </span>
      </button>
    </li>
  );
}
function GhostTicket() {
  return (
    <li aria-hidden className="min-h-[64px] flex items-center justify-center gap-2 px-3 rounded-xl border border-dashed border-[#DCE6FD] bg-white text-[11px] text-[#5A5A6A]">
      <Radar className="w-4 h-4 text-[#9DB4F0]" />The next scan lands here
    </li>
  );
}
function ScansEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#E0E0E6] bg-[#F8F9FC] px-4 py-5">
      <Radar className="w-6 h-6 text-[#3F6FE8]" aria-hidden />
      <p className="mt-2 text-sm font-semibold text-[#030213]">All caught up</p>
      <p className="mt-0.5 text-xs text-[#5A5A6A]">New scans land here as soon as a scanner sends them.</p>
    </div>
  );
}

// ─── Recent bubbles, result cards, the drafts chooser ───────────────────────

const isFocusVisible = (el: Element) => { try { return el.matches(':focus-visible'); } catch { return true; } };

function Bubble({ p, drafts, mode, expanded, chooserId, tipId, tip, onShow, onHide, onPick }: {
  p: Patient; drafts: CaseRow[]; mode: 'new' | 'change'; expanded: boolean; chooserId: string; tipId: string; tip: TipPos | null;
  /** delay: hover waits a beat; keyboard focus shows the card at once. */
  onShow: (anchor: HTMLElement, delay?: number) => void; onHide: (after?: number) => void; onPick: () => void;
}) {
  const name = fullName(p);
  const scanRow = drafts.find(r => r.source === 'scanner');
  const other = drafts.filter(r => r.source !== 'scanner').length;
  const many = mode === 'new' && drafts.length > 1;
  const scan = scanRow?.draft?.scan;
  const action = mode === 'change'
    ? 'Select to use this patient'
    : drafts.length === 1 ? (scanRow ? 'Select to continue the scan' : 'Select to continue the draft') : many ? 'Select to choose a draft' : 'Select to start a case';
  return (
    <li className="relative w-[68px]" onMouseEnter={e => onShow(e.currentTarget, TIP_HOVER_MS)} onMouseLeave={() => onHide(120)}>
      {/* Esc on an open card is handled by the picker, wherever focus is. */}
      <button
        type="button"
        data-nav="bubbles"
        data-pid={p.id}
        onClick={onPick}
        onFocus={e => { if (isFocusVisible(e.currentTarget)) onShow(e.currentTarget.parentElement as HTMLElement); }}
        onBlur={() => onHide()}
        aria-describedby={tipId}
        aria-expanded={many ? expanded : undefined}
        aria-controls={many && expanded ? chooserId : undefined}
        className={`group w-full flex flex-col items-center gap-1 pt-0.5 pb-1 rounded-xl ${FOCUS}`}
      >
        <span className="relative">
          {/* A scan waiting rings the bubble, like a story. */}
          <span className={`block rounded-full p-[2px] motion-safe:transition-colors ${scanRow ? 'bg-gradient-to-tr from-[#3F6FE8] to-[#6A5CE8]' : 'bg-transparent group-hover:bg-[#DCE6FD]'}`}>
            <span className="block rounded-full bg-white p-[2px]">
              <span className="block rounded-full motion-safe:transition-transform motion-safe:group-hover:scale-105"><Avatar p={p} size="lg" /></span>
            </span>
          </span>
          {other > 0 && (
            <span aria-hidden className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFF8E1] border border-[#E07B00] ring-2 ring-white text-center text-[10px] font-bold leading-4 text-[#8A4B08]">{other}</span>
          )}
        </span>
        {/* The visible label starts the accessible name (WCAG 2.5.3), the full name follows. */}
        <span className="max-w-full truncate text-xs font-medium text-[#030213]">{p.last ? `${p.first} ${p.last[0]}.` : p.first}</span>
        <span className="sr-only">, {name}{scanRow ? ', scan waiting' : ''}{other ? `, ${plural(other, 'open draft')}` : ''}</span>
      </button>
      <div
        role="tooltip"
        id={tipId}
        className={tip
          ? `absolute z-30 ${tip.above ? 'bottom-full mb-2' : 'top-full mt-1'} p-3 rounded-xl bg-white border border-[#E0E0E6] shadow-[0_14px_36px_-12px_rgba(3,2,19,0.28)] text-left motion-safe:animate-[pl-pop_0.16s_ease-out_both]`
          : 'hidden'}
        style={tip ? { left: tip.dx, width: TIP_W } : undefined}
      >
        {tip && <span aria-hidden className={`absolute w-2.5 h-2.5 rotate-45 bg-white border-[#E0E0E6] ${tip.above ? '-bottom-[6px] border-r border-b' : '-top-[6px] border-l border-t'}`} style={{ left: tip.caret - 5 }} />}
        <p className="text-sm font-semibold text-[#030213] truncate">{name}</p>
        <p className="text-xs text-[#4A4A5A]">{p.dob} · {p.id}</p>
        <p className="mt-0.5 text-xs text-[#4A4A5A]">Last: {p.lastLabel ?? 'No lab work yet'}</p>
        {(scan || other > 0) && (
          <div className="mt-2 pt-2 border-t border-[#F0EFF6] space-y-1">
            {scan && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2F62D6]"><ScanLine className="w-3.5 h-3.5" aria-hidden />Scan waiting · {scan.scanner} {scan.time}</p>}
            {other > 0 && <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A4B08]"><span className="w-2 h-2 rounded-full bg-[#E07B00]" aria-hidden />{plural(other, 'open draft')}</p>}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[#5A5A6A]">{action}</p>
      </div>
    </li>
  );
}

function ResultCard({ p, q, drafts, mode, expanded, chooserId, onPick }: {
  p: Patient; q: string; drafts: CaseRow[]; mode: 'new' | 'change'; expanded: boolean; chooserId: string; onPick: () => void;
}) {
  const name = fullName(p);
  const scanCount = drafts.filter(r => r.source === 'scanner').length;
  const other = drafts.length - scanCount;
  const many = mode === 'new' && drafts.length > 1;
  const practiceHit = !!p.practiceId && norm(p.practiceId).includes(norm(q));
  return (
    <li className="min-w-0">
      <button
        type="button"
        data-nav="results"
        data-pid={p.id}
        onClick={onPick}
        aria-expanded={many ? expanded : undefined}
        aria-controls={many && expanded ? chooserId : undefined}
        className={`w-full h-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left motion-safe:transition-colors ${
          expanded ? 'border-[#F5D98B] bg-[#FFFBEB]' : 'border-[#ECECF2] bg-white hover:border-[#DCE6FD] hover:bg-[#F8FAFF]'
        } ${FOCUS}`}
      >
        <span className={`rounded-full p-[2px] flex-shrink-0 ${scanCount ? 'bg-gradient-to-tr from-[#3F6FE8] to-[#6A5CE8]' : ''}`}>
          <span className="block rounded-full bg-white p-[1.5px]"><Avatar p={p} /></span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 min-h-5">
            <span className="min-w-0 truncate text-sm font-semibold text-[#030213]" title={name}><Marked text={name} q={q} /></span>
            {(scanCount > 0 || other > 0) && (
              <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                {scanCount > 0 && <Pill tone="info"><ScanLine className="w-3 h-3" aria-hidden />Scan<span className="sr-only"> waiting</span></Pill>}
                {other > 0 && <Pill tone="gap">{other > 1 ? `${other} Drafts` : 'Draft'}</Pill>}
                {many && <ChevronDown className={`w-3.5 h-3.5 text-[#4A4A5A] motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />}
              </span>
            )}
          </span>
          <span className="block text-xs text-[#4A4A5A] truncate">
            <MarkedDob dob={p.dob} q={q} /> · <Marked text={p.id} q={q} />{practiceHit && <> · <Marked text={p.practiceId!} q={q} /></>}
          </span>
          <span className="block text-[11px] text-[#5A5A6A] truncate" title={p.lastLabel}>Last: {p.lastLabel ?? 'No lab work yet'}</span>
        </span>
      </button>
    </li>
  );
}

function NoMatch({ query, onAdd }: { query: string; onAdd: () => void }) {
  return (
    <div className="mt-2 flex flex-col items-center text-center rounded-xl border border-dashed border-[#E0E0E6] bg-[#F8F9FC] px-4 py-6">
      <span className="w-10 h-10 rounded-full bg-white border border-[#ECECF2] flex items-center justify-center text-[#5A5A6A]"><SearchX className="w-5 h-5" aria-hidden /></span>
      <p className="mt-2 max-w-full text-sm font-semibold text-[#030213] break-words">No one matches “{query}”</p>
      <p className="mt-0.5 text-xs text-[#5A5A6A]">Check the spelling, or try a date of birth (DD/MM/YYYY) or a patient ID.</p>
      <button type="button" data-nav="empty" onClick={onAdd} className={`mt-2.5 px-1 rounded text-xs font-semibold text-[#2F62D6] hover:text-[#1E40AF] hover:underline ${FOCUS}`}>Add Them as a New Patient</button>
    </div>
  );
}

function DraftChooser({ id, p, drafts, firstRef, onOpenDraft, onSeparate, onDismiss }: {
  id: string; p: Patient; drafts: CaseRow[]; firstRef: RefObject<HTMLButtonElement>; onOpenDraft: (r: CaseRow) => void; onSeparate: () => void; onDismiss: () => void;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={`${id}-t`}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDismiss(); } }}
      className="mt-3 p-3 rounded-xl border border-[#F5D98B] bg-[#FFF8E1] motion-safe:animate-[pl-rise_0.3s_ease-out_both]"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5"><StateIcon state="gap" size="sm" ripple={false} /></span>
        <p id={`${id}-t`} className="flex-1 min-w-0 text-sm text-[#1F1F2E]">
          <span className="font-semibold">{fullName(p)}</span> has {plural(drafts.length, 'open draft')}. Continue one, or start a separate case.
        </p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={`p-1 rounded-md text-[#6B6B7B] hover:text-[#030213] hover:bg-white/70 ${FOCUS}`}><X className="w-3.5 h-3.5" aria-hidden /></button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {drafts.map((r, i) => {
          const detail = [r.scanLabel ?? 'Draft', r.service && r.service !== '—' ? r.service : null].filter(Boolean).join(' · ');
          return (
            <button key={r.id} ref={i === 0 ? firstRef : undefined} type="button" data-nav="chooser" onClick={() => onOpenDraft(r)} className={`min-w-0 max-w-full flex flex-col items-start px-3 py-1.5 rounded-lg bg-white border border-[#F5D98B] hover:border-[#E07B00] text-left ${FOCUS}`}>
              <span className="text-xs font-semibold text-[#030213]">Continue {r.id}</span>
              <span className="max-w-full truncate text-[11px] text-[#5A5A6A]">{detail}</span>
            </button>
          );
        })}
        <button type="button" data-nav="chooser" onClick={onSeparate} className={`px-3 py-1.5 rounded-lg border border-dashed border-[#C8D8FC] bg-white text-xs font-semibold text-[#2F62D6] hover:bg-[#F5F8FF] ${FOCUS}`}>Start a Separate Case</button>
      </div>
    </div>
  );
}

// ─── New Patient: a call to action that morphs into the quick-add form ───────
// Both faces stay mounted, so Back keeps what was typed. The face going away
// folds to nothing (grid rows 1fr → 0fr) and fades; the other unfolds. Until
// the person types in a name field, the names follow the search (last word →
// last name, the rest → first name), and the CTA offers "Add “Jo Smith”".

interface Names { first: string; last: string }
function nameFromSearch(q: string): Names {
  const t = q.trim();
  if (!t || /\d/.test(t)) return { first: '', last: '' };
  const words = t.split(/\s+/).map(w => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w));
  return words.length > 1 ? { first: words.slice(0, -1).join(' '), last: words[words.length - 1] } : { first: words[0], last: '' };
}
/** Visibility flips at once when shown (so focus can land) and only after the fold when hidden. */
const FACE_SHOW = 'visible opacity-100 grid-rows-[1fr] motion-safe:[transition:grid-template-rows_340ms_cubic-bezier(0.16,1,0.3,1),opacity_260ms_ease-out_80ms]';
const FACE_HIDE = 'invisible opacity-0 grid-rows-[0fr] motion-safe:[transition:grid-template-rows_340ms_cubic-bezier(0.16,1,0.3,1),opacity_160ms_ease-out,visibility_0s_linear_340ms]';

function NewPatientTile({ uid, mode, query, exact, searching, matchedCount, open, banner, tall = false, cols3, focusReq, escBack, onOpen, onBack, onCreated, onUse, className = '', style }: {
  uid: string; mode: 'new' | 'change'; query: string;
  /** The search names an existing patient exactly: no "Add “…”" then. */
  exact: boolean; searching: boolean; matchedCount: number;
  open: boolean;
  /** Full-width row (narrow picker) instead of a tall tile. */
  banner: boolean;
  /** Two grid rows tall: the call to action also lists what the form will ask. */
  tall?: boolean;
  /** First, last and date of birth on one line. */
  cols3: boolean;
  focusReq: { to: FocusTo; n: number } | null;
  /** Esc in the form goes back to the call to action (when Esc doesn't cancel the picker). */
  escBack: boolean;
  onOpen: () => void; onBack: () => void; onCreated: (p: Patient) => void; onUse: (p: Patient) => void;
  className?: string; style?: CSSProperties;
}) {
  const mirror = useMemo(() => nameFromSearch(query), [query]);
  const [own, setOwn] = useState<Names | null>(null);
  const first = own ? own.first : mirror.first;
  const last = own ? own.last : mirror.last;
  const mirrored = !own && !!(mirror.first || mirror.last);
  const form = useRef<ManualHandle>(null);
  const cta = useRef<HTMLButtonElement>(null);
  const ctaBox = useRef<HTMLDivElement>(null);
  const formBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusReq) return;
    // preventScroll: the face is still folded, and focus would scroll it inside its clip.
    if (focusReq.to === 'cta') {
      cta.current?.focus({ preventScroll: true });
      if (ctaBox.current) ctaBox.current.scrollTop = 0;
      return;
    }
    form.current?.focus(focusReq.to);
    if (formBox.current) formBox.current.scrollTop = 0;
    // Once the morph has settled, keep the Add button on screen.
    const t = window.setTimeout(() => form.current?.reveal(), 360);
    return () => window.clearTimeout(t);
  }, [focusReq]);

  const named = `${first.trim()} ${last.trim()}`.trim();
  const offer = !exact && !!named && (!!own || searching);
  const label = offer ? `Add “${named}”` : 'Enter Details Manually';
  const q = query.trim();
  const sub = searching && !exact
    ? matchedCount ? 'Not one of these? Add them in seconds.' : `No one called “${q}” yet. Add them in seconds.`
    : 'Not on the list? Add them in seconds.';
  const ctaButton = (
    <button
      ref={cta}
      type="button"
      data-nav={open ? undefined : 'tile'}
      onClick={onOpen}
      title={offer ? label : undefined}
      className={`group h-10 px-3.5 inline-flex items-center justify-between gap-2 rounded-xl text-sm font-semibold ${banner ? 'max-w-full' : 'w-full'} ${
        offer
          ? `${GRADIENT_BTN} shadow-[0_8px_20px_-8px_rgba(63,111,232,0.7)] hover:opacity-95`
          : 'bg-white text-[#2F62D6] border border-[#DCE6FD] shadow-[0_1px_2px_rgba(3,2,19,0.05)] hover:border-[#3F6FE8] hover:bg-[#F8FAFF]'
      } motion-safe:transition-colors ${FOCUS}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ArrowRight className="w-4 h-4 flex-shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
    </button>
  );

  return (
    <section
      aria-label="New patient"
      className={`relative min-w-0 flex flex-col rounded-2xl border bg-white overflow-hidden motion-safe:transition-[border-color,box-shadow] motion-safe:duration-300 ${
        open ? 'border-[#C8D8FC] shadow-[0_14px_36px_-18px_rgba(63,111,232,0.5)]' : 'border-[#DCE6FD] shadow-[0_1px_2px_rgba(3,2,19,0.04)]'
      } ${className}`}
      style={style}
    >
      <div aria-hidden className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-[#EEF4FF] via-white to-[#F3EEFF] motion-safe:transition-opacity motion-safe:duration-300 ${open ? 'opacity-0' : 'opacity-100'}`} />
      <div aria-hidden className={`pointer-events-none absolute -top-14 -right-14 w-44 h-44 rounded-full bg-[#6A5CE8]/10 blur-2xl motion-safe:transition-opacity motion-safe:duration-300 ${open ? 'opacity-0' : 'opacity-100'}`} />

      {/* Face 1 · the call to action */}
      <div className={`relative grid min-h-0 ${open ? FACE_HIDE : `${FACE_SHOW} flex-1`}`}>
        <div ref={ctaBox} className="min-h-0 overflow-hidden">
          {banner ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 p-3.5">
              <Blob size="md" />
              <div className="flex-1 min-w-[160px]">
                <h3 className="text-sm font-semibold text-[#030213]">New Patient</h3>
                <p className="text-xs text-[#4A4A5A] break-words">{sub}</p>
              </div>
              {ctaButton}
            </div>
          ) : (
            <div className="h-full flex flex-col p-3.5">
              <Blob size="lg" />
              <h3 className="mt-3 text-[15px] leading-5 font-semibold text-[#030213]">New Patient</h3>
              <p className="mt-1 text-[13px] leading-[18px] text-[#4A4A5A] break-words">{sub}</p>
              <div className="mt-auto pt-3">
                {tall && (
                  <div className="mb-3">
                    <p className="text-[11px] leading-4 font-semibold text-[#5A5A6A]">You’ll need</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-[#4A4A5A]">
                      <NeedItem n="1">First and last name</NeedItem>
                      <NeedItem n="2">Date of birth</NeedItem>
                      <NeedItem n="+" optional>Sex, ID{CLINIC.nhsContract ? ', funding' : ''} · optional</NeedItem>
                    </ul>
                  </div>
                )}
                {ctaButton}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Face 2 · the quick-add form, in the same tile */}
      <div
        className={`relative grid min-h-0 ${open ? FACE_SHOW : FACE_HIDE}`}
        onKeyDown={e => { if (e.key === 'Escape' && escBack) { e.stopPropagation(); onBack(); } }}
      >
        <div ref={formBox} className="min-h-0 overflow-hidden">
          <div className="p-3.5">
            <div className="flex items-center gap-2 mb-3">
              <Blob size="sm" />
              <h3 className="text-sm font-semibold text-[#030213]">New Patient</h3>
              <button type="button" onClick={onBack} title="Back (keeps what you typed)" className={`ml-auto inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-semibold text-[#4A4A5A] hover:text-[#030213] hover:bg-[#F8F9FC] ${FOCUS}`}>
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />Back
              </button>
            </div>
            <ManualForm
              ref={form}
              uid={uid}
              mode={mode}
              first={first}
              last={last}
              mirrored={mirrored}
              onName={(k, v) => setOwn({ first, last, [k]: v })}
              cols3={cols3}
              onCreated={onCreated}
              onUse={onUse}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function NeedItem({ n, optional = false, children }: { n: string; optional?: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-2 min-w-0 ${optional ? 'text-[#5A5A6A]' : ''}`}>
      <span aria-hidden className={`w-4 h-4 flex-shrink-0 rounded-full border bg-white text-center text-[10px] font-bold leading-[14px] ${optional ? 'border-dashed border-[#C8D8FC] text-[#5A5A6A]' : 'border-[#DCE6FD] text-[#2F62D6]'}`}>{n}</span>
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}

// ─── The quick-add form ──────────────────────────────────────────────────────
// While a name is missing, the line above the button says so, and Enter in a
// field goes to the missing name instead of doing nothing.

interface ManualHandle {
  /** 'first': the first name; 'next': the first field still to fill. */
  focus: (to: 'first' | 'next') => void;
  /** Scroll the page just enough to show the Add button. */
  reveal: () => void;
}
const SEX_LABEL = { F: 'Female', M: 'Male', X: 'Not Stated' } as const;

const ManualForm = forwardRef<ManualHandle, {
  uid: string; mode: 'new' | 'change'; first: string; last: string; mirrored: boolean;
  onName: (k: 'first' | 'last', v: string) => void; cols3: boolean; onCreated: (p: Patient) => void; onUse: (p: Patient) => void;
}>(
  function ManualForm({ uid, mode, first, last, mirrored, onName, cols3, onCreated, onUse }, ref) {
    const [dob, setDob] = useState('');
    const [sex, setSex] = useState<'F' | 'M' | 'X' | undefined>();
    const [pid, setPid] = useState('');
    const [funding, setFunding] = useState<Funding>(CLINIC.defaultFunding);
    const [more, setMore] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [warn, setWarn] = useState<string | null>(null);
    const [dup, setDup] = useState<Patient | null>(null);
    const firstRef = useRef<HTMLInputElement>(null);
    const lastRef = useRef<HTMLInputElement>(null);
    const dobRef = useRef<HTMLInputElement>(null);
    const useRefBtn = useRef<HTMLButtonElement>(null);
    const submitRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (dup) useRefBtn.current?.focus(); }, [dup]);
    // A duplicate found for one name is stale once the names change, typed or mirrored from the search.
    useEffect(() => { setDup(null); }, [first, last]);
    // More Details makes the tile taller: keep the button that adds the patient on screen.
    useEffect(() => { if (more) submitRef.current?.scrollIntoView({ block: 'nearest' }); }, [more]);
    useImperativeHandle(ref, () => ({
      focus: to => (to === 'first' || !first.trim() ? firstRef : !last.trim() ? lastRef : dobRef).current?.focus({ preventScroll: true }),
      reveal: () => submitRef.current?.scrollIntoView({ block: 'nearest' }),
    }), [first, last]);

    const create = (force = false) => {
      const r = parseDOB(dob, demoNow());
      if (r.error) { setErr(r.error); dobRef.current?.focus(); return; }
      setErr(null);
      setWarn(r.warning ?? null);
      if (!force) {
        const match = allPatients().find(p => norm(fullName(p)) === norm(`${first} ${last}`) && dobFromString(p.dob).getTime() === r.date!.getTime());
        if (match) { setDup(match); return; }
      }
      const p = addPatient({ first: first.trim(), last: last.trim(), dob: maskDOB(dob), sex: sex ?? 'X', funding, practiceId: pid.trim() || undefined, lastLabel: 'New patient' });
      onCreated(p);
    };
    const extras = [sex && SEX_LABEL[sex], pid.trim(), funding !== CLINIC.defaultFunding && (funding === 'nhs' ? 'NHS' : 'Private')].filter(Boolean).join(' · ');
    const ready = !!first.trim() && !!last.trim();
    // The disabled Add button blocks Enter's implicit submit; send the person to the missing name instead.
    const onFormKey = (e: KeyboardEvent<HTMLFormElement>) => {
      if (e.key !== 'Enter' || ready || (e.target as HTMLElement).tagName !== 'INPUT') return;
      e.preventDefault();
      (!first.trim() ? firstRef : lastRef).current?.focus();
    };
    const nameDesc = [mirrored && `${uid}-mirror`, !ready && `${uid}-need`].filter(Boolean).join(' ') || undefined;

    const dobField = (
      <Field id={`${uid}-dob`} label="Date of birth">
        <input
          id={`${uid}-dob`}
          ref={dobRef}
          inputMode="numeric"
          autoComplete="off"
          value={dob}
          onChange={e => { setDob(maskDOB(e.target.value)); setErr(null); setDup(null); }}
          placeholder="DD/MM/YYYY"
          aria-invalid={!!err}
          aria-describedby={err ? `${uid}-dob-err` : warn ? `${uid}-dob-warn` : undefined}
          className={`${inputCls} ${err ? 'border-[#DC2626]' : ''}`}
        />
        {/* An alert: the field takes focus before aria-invalid renders, and Enter inside it can't refocus. */}
        {err && <p id={`${uid}-dob-err`} role="alert" className="text-xs text-[#B91C1C] mt-1">{err}</p>}
        {warn && !err && <p id={`${uid}-dob-warn`} className="text-xs text-[#8A4B08] mt-1">{warn}</p>}
      </Field>
    );

    return (
      <form className="flex flex-col gap-2.5" onKeyDown={onFormKey} onSubmit={e => { e.preventDefault(); create(); }}>
        <div>
          <div className={`grid gap-2 items-start ${cols3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <Field id={`${uid}-first`} label="First name">
              <input id={`${uid}-first`} ref={firstRef} value={first} onChange={e => onName('first', e.target.value)} autoComplete="off" aria-describedby={nameDesc} className={inputCls} />
            </Field>
            <Field id={`${uid}-last`} label="Last name">
              <input id={`${uid}-last`} ref={lastRef} value={last} onChange={e => onName('last', e.target.value)} autoComplete="off" aria-describedby={nameDesc} className={inputCls} />
            </Field>
            {cols3 && dobField}
          </div>
          {/* Space kept so the form doesn't jump as the search fills it in. */}
          <p id={`${uid}-mirror`} aria-hidden={!mirrored} className={`mt-1 h-4 flex items-center gap-1 text-[11px] text-[#2F62D6] ${mirrored ? '' : 'invisible'}`}>
            <Search className="w-3 h-3" aria-hidden />Filled in from your search
          </p>
        </div>
        {!cols3 && dobField}
        <div className="min-w-0">
          <button
            type="button"
            aria-expanded={more}
            aria-controls={more ? `${uid}-more` : undefined}
            onClick={() => setMore(m => !m)}
            className={`max-w-full flex items-center gap-1 rounded text-xs font-semibold text-[#2F62D6] hover:text-[#1E40AF] ${FOCUS}`}
          >
            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 motion-safe:transition-transform ${more ? 'rotate-180' : ''}`} aria-hidden />
            <span className="flex-shrink-0">More Details</span>
            {!more && <span className="min-w-0 truncate font-normal text-[#4A4A5A]">· {extras || 'Sex, ID, funding'}</span>}
          </button>
          {more && (
            <div id={`${uid}-more`} className="mt-2.5 space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#3A3A4A] mb-1.5">Sex <span className="font-normal text-[#5A5A6A]">(optional)</span></p>
                <ChoiceChips label="Sex" size="sm" value={sex} onChange={v => setSex(v as 'F' | 'M' | 'X')} options={[{ id: 'F', label: 'Female' }, { id: 'M', label: 'Male' }, { id: 'X', label: 'Not Stated' }]} />
              </div>
              <Field id={`${uid}-pid`} label="Practice patient ID">
                <input id={`${uid}-pid`} value={pid} onChange={e => setPid(e.target.value)} autoComplete="off" className={inputCls} />
              </Field>
              {CLINIC.nhsContract && (
                <div>
                  <p className="text-xs font-semibold text-[#3A3A4A] mb-1.5">Funding</p>
                  <Segmented label="Funding" value={funding} onChange={setFunding} options={[{ id: 'private', label: 'Private' }, { id: 'nhs', label: 'NHS' }]} />
                </div>
              )}
            </div>
          )}
        </div>
        {dup && (
          <div role="alert">
            <Notice tone="decision" actions={<>
              <button ref={useRefBtn} type="button" onClick={() => onUse(dup)} className={`inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8] ${FOCUS}`}>Use This Patient</button>
              <SecondaryButton onClick={() => create(true)}>Create New Anyway</SecondaryButton>
            </>}>
              {fullName(dup)}, born {fmtFull(dobFromString(dup.dob))}, is already a patient here ({patientAge(dup, demoNow())}, {dup.id}).
            </Notice>
          </div>
        )}
        <div ref={submitRef} className="space-y-2">
          {/* Why the button is off, where everyone can see it (its title is mouse-only); the lab note once it's on. */}
          {ready
            ? <p className="text-[11px] leading-4 text-[#5A5A6A]">Labs see initials, age, sex and the patient ID.</p>
            : <p id={`${uid}-need`} className="text-[11px] leading-4 text-[#5A5A6A]">Enter a first and last name to continue.</p>}
          <PrimaryButton type="submit" className="w-full h-10" disabled={!ready} title={ready ? undefined : 'Enter a first and last name'}>
            {mode === 'new' ? 'Add and Start Case' : 'Add and Use'}
          </PrimaryButton>
        </div>
      </form>
    );
  },
);
const inputCls = 'w-full min-w-0 h-9 rounded-lg border border-[#D4D4DD] bg-white px-2.5 text-sm text-[#030213] outline-none focus:border-[#3F6FE8] focus:ring-2 focus:ring-[#3F6FE8]/20';
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[11px] leading-4 font-semibold text-[#3A3A4A] mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── Helpers: arrow-key moves and tooltip room ──────────────────────────────

/** What the arrows can land on right now: shown, enabled, not on a folded face. */
function navItems(box: HTMLElement | null): HTMLElement[] {
  if (!box) return [];
  return Array.from(box.querySelectorAll<HTMLElement>(`[${NAV}]`))
    .filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
}
/** ↑/↓: the nearest item in the next row up or down; one in the same column wins.
 *  Going up with nothing above in that column returns nothing (the caller goes to the search). */
function stepV(cur: HTMLElement, items: HTMLElement[], dir: 1 | -1): HTMLElement | undefined {
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cands = items.filter(el => el !== cur).map(el => ({ el, b: el.getBoundingClientRect() }))
    .filter(({ b }) => (dir > 0 ? b.top >= r.bottom - 4 : b.bottom <= r.top + 4));
  if (!cands.length) return undefined;
  const overlap = cands.filter(({ b }) => b.left < r.right - 1 && b.right > r.left + 1);
  if (!overlap.length && dir < 0) return undefined;
  const pool = overlap.length ? overlap : cands;
  const gap = (b: DOMRect) => Math.max(0, dir > 0 ? b.top - r.bottom : r.top - b.bottom);
  const dx = (b: DOMRect) => Math.abs(b.left + b.width / 2 - cx);
  const score = (b: DOMRect) => (overlap.length ? Math.round(gap(b) / 6) * 10_000 + dx(b) : Math.hypot(gap(b), dx(b)));
  return pool.reduce((best, c) => (score(c.b) < score(best.b) ? c : best)).el;
}
/** ←/→ past the end of a row: the nearest item beside it, in the next tile over
 *  (level with it if one is, else the closest on that side). */
function stepH(cur: HTMLElement, items: HTMLElement[], dir: 1 | -1): HTMLElement | undefined {
  const r = cur.getBoundingClientRect();
  const cy = r.top + r.height / 2;
  const cands = items.filter(el => el !== cur).map(el => ({ el, b: el.getBoundingClientRect() }))
    .filter(({ b }) => (dir > 0 ? b.left >= r.right - 4 : b.right <= r.left + 4));
  if (!cands.length) return undefined;
  const level = cands.filter(({ b }) => b.top < r.bottom && b.bottom > r.top);
  const gap = (b: DOMRect) => Math.max(0, dir > 0 ? b.left - r.right : r.left - b.right);
  const score = (b: DOMRect) => (level.length ? gap(b) : Math.hypot(gap(b), b.top + b.height / 2 - cy));
  return (level.length ? level : cands).reduce((best, c) => (score(c.b) < score(best.b) ? c : best)).el;
}
/** The visible band an element can show a floating card in: the window, narrowed by any clipping card around it. */
function clipOf(el: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).overflowY === 'visible') continue;
    const b = n.getBoundingClientRect();
    top = Math.max(top, b.top);
    bottom = Math.min(bottom, b.bottom);
  }
  return { top, bottom };
}
/** A card h px tall opens above its anchor when it would run past the bottom of its clip and fits above. */
function flipAbove(anchor: HTMLElement, h: number): boolean {
  const a = anchor.getBoundingClientRect();
  const clip = clipOf(anchor);
  return a.bottom + h + 8 > clip.bottom && a.top - h - 8 >= clip.top;
}
