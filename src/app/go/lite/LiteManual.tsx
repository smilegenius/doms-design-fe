// ─── Go Lite · Create manually ───────────────────────────────────────────────
// The second way to create lab work in the light app (the first is a photo of
// the prescription). It brings the web's guided case creation (/flows/new-case)
// to the phone as a native flow: one question per page, pages that slide like
// pushed screens, a pinned header (back / step title / Save draft) with a
// segmented step bar you can tap to jump, and one big CTA in the bottom bar.
//
//   Patient → Lab → Services → Scans source → Dentist → Review
//
// Picking a patient, lab or dentist moves on by itself. Each service is its own
// page: a full-mouth tooth chart (or Upper / Lower / Both for whole-arch work),
// material, shade swatches, the category's extras (rarely used ones folded
// under "More details") and its delivery date from a calendar sheet. Denture
// stages and aligner phases each get a date.
//
// Data: Go's own form model and builders (screens/ManualCase.tsx), so a case
// made here lands in Lab work and To dispatch exactly like a photo case, and a
// draft (Save draft) reopens here with ?draft=ID.
// Only Patient, Lab, Dentist and one service are required (Go's rule).
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, CalendarClock, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileText, FlaskConical, Mail,
  Lock, MessageSquare, Mic, Monitor, Paperclip, PlusCircle, Star, Trash, Truck, User, UserPlus, X,
} from '../icons';
import { ME, useGo } from '../store';
import {
  CASE_SOURCES, CLINICIANS, LABS, LabCase, MATERIALS, PATIENTS, PRACTICES, SERVICE_CATEGORIES, SHADES, STAGE_NAMES, StageLine,
  allItems, clinicianName, patchItemStages, detailFields, freeTextMaterial, getCategoryForItem, labName, needsMaterial, patientById, phaseName, practiceName, serviceLabel,
} from '../data';
import {
  CaseForm, ChoiceWithOther, DetailInput, FormItem, LabPicker, PatientPicker, buildCase, buildDraft, emptyForm, itemDateSummary, itemMissing,
  itemName, itemStaged, itemSummary, newItem, normForm,
} from '../screens/ManualCase';
import { Avatar, Btn, Input, Screen, SearchBox, Segmented, Sheet, TeethChips, TextArea, cx } from '../ui';
import { Created, LITE } from './LiteScreens';
import { PRODUCT_ICON } from '../../newCase/ServiceSteps';
import type { ProductId } from '../../newCase/data';
import { ToothDefs, ToothSvg, slotOf } from '../../newCase/ToothShapes';

// ─── Steps ──────────────────────────────────────────────────────────────────

type StepId = 'patient' | 'lab' | 'services' | 'source' | 'dentist' | 'review';
const STEPS: { id: StepId; name: string; title: string; sub: string }[] = [
  { id: 'patient', name: 'Patient', title: 'Who is it for?', sub: 'Search your patients or add a new one.' },
  { id: 'lab', name: 'Lab', title: 'Which lab?', sub: 'Services and dates come from the lab you pick.' },
  { id: 'services', name: 'Services', title: 'What are we making?', sub: 'Add one or more services. Each has its own delivery date.' },
  { id: 'source', name: 'Scans source', title: 'How will the lab get the scans?', sub: 'Optional. Pick how the impressions or scans reach the lab.' },
  { id: 'dentist', name: 'Dentist', title: 'Who is prescribing?', sub: 'The case is created on behalf of this dentist.' },
  { id: 'review', name: 'Review', title: 'Check and send', sub: 'Tap anything to change it.' },
];

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDay(d); };
const today = () => localDay(new Date());
const dayLabel = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const daysFrom = (d: string) => Math.round((new Date(`${d}T12:00`).getTime() - new Date(`${today()}T12:00`).getTime()) / 864e5);
const inDays = (d: string) => { const n = daysFrom(d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `In ${n} days` : `${-n} days ago`; };

// Whole-arch services: picked as Upper, Lower or Both arches (both are always allowed).
const ARCH_ONLY = new Set(['or-retainers', 'or-clear-aligners', 'de-full-denture', 'ap-whitening-tray', 'ap-night-guard', 'ap-splint']);
const ARCH_TOKENS = ['Upper arch', 'Lower arch', 'Both arches'] as const;
type ArchToken = (typeof ARCH_TOKENS)[number];

// Each service gets the same icon the New Case flow gives its product (crown, implant, veneer, denture…), not
// one icon per category.
const ITEM_PRODUCT: Record<string, ProductId> = {
  'su-post-and-core-retained-crown': 'crown', 'su-screw-retained-crown': 'implant', 'su-implant-abutment': 'implant',
  'su-inlay-onlay': 'inlay', 'su-veneer': 'veneer', 'su-crown': 'crown',
  'br-post-and-core-retained': 'bridge', 'br-implant-abutment': 'bridge', 'br-screw-retained': 'bridge', 'br-pontic': 'bridge', 'br-abutment': 'bridge',
  'or-retainers': 'retainer', 'or-clear-aligners': 'aligner',
  'de-partial-denture': 'partial', 'de-full-denture': 'denture', 'de-immediate-denture': 'denture',
  'ap-whitening-tray': 'whitening', 'ap-night-guard': 'nightguard', 'ap-splint': 'nightguard',
  'ot-other': 'other',
};
function ServiceIcon({ itemId }: { itemId: string }) {
  const Icon = PRODUCT_ICON[ITEM_PRODUCT[itemId] ?? 'other'];
  return <Icon className="w-5 h-5" strokeWidth={1.75} />;
}
const SOURCE_ICON: Record<string, React.ReactNode> = {
  'Via Scanner': <Monitor className="w-5 h-5" />,
  'Impressions (By Post)': <Truck className="w-5 h-5" />,
  SMS: <MessageSquare className="w-5 h-5" />,
  Whatsapp: <MessageSquare className="w-5 h-5" />,
  Email: <Mail className="w-5 h-5" />,
  'Photo of lab form': <Camera className="w-5 h-5" />,
  'Voice note': <Mic className="w-5 h-5" />,
  Other: <FileText className="w-5 h-5" />,
};

const FAV_KEY = 'sg-go-lite-fav-labs';
const readFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? '') ?? ['northstar']; } catch { return ['northstar']; } };

// ─── Native bits ────────────────────────────────────────────────────────────

/** A grouped list card (iOS inset-grouped style). */
function Group({ title, children, className }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('mt-5', className)}>
      {title && <h3 className="px-1 mb-2 text-[12px] font-semibold text-go-muted">{title}</h3>}
      <div className="rounded-[22px] bg-go-surface border border-go-line/80 go-card-shadow overflow-hidden divide-y divide-go-line/70">{children}</div>
    </section>
  );
}

/** One tappable row inside a Group: icon or avatar, title, sub, and a radio tick, chevron or value. */
function Row({ lead, title, sub, onClick, selected, chevron, right, warn }: {
  lead?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; onClick?: () => void; selected?: boolean; chevron?: boolean; right?: React.ReactNode; warn?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cx('w-full flex items-center gap-3 px-4 min-h-[60px] py-2.5 text-left transition active:bg-go-raised', selected && 'bg-go-brand-soft/60')}>
      {lead}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-go-ink truncate">{title}</span>
        {sub && <span className={cx('block text-[12.5px] mt-0.5 truncate', warn ? 'text-go-warn font-medium' : 'text-go-muted')}>{sub}</span>}
      </span>
      {right}
      {selected !== undefined && (
        <span className={cx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition', selected ? 'go-grad text-white' : 'border-2 border-go-line')}>
          {selected && <Check className="w-3.5 h-3.5" />}
        </span>
      )}
      {chevron && <ChevronRight className="w-5 h-5 text-go-faint flex-shrink-0" />}
    </button>
  );
}

const Lead = ({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'violet' | 'teal' | 'ok' | 'warn' }) => (
  <span className={cx('w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0', {
    brand: 'bg-go-brand-soft text-go-brand', violet: 'bg-go-violet-soft text-go-violet', teal: 'bg-go-teal-soft text-go-teal', ok: 'bg-go-ok-soft text-go-ok', warn: 'bg-go-warn-soft text-go-warn',
  }[tone])}>{children}</span>
);

/** A date that opens a calendar sheet: month grid, quick "+N days", today ringed, earlier days off (unless allowPast). */
function DateField({ value, onChange, label, min, allowPast, optional, compact }: {
  value: string; onChange: (d: string) => void; label: string; min?: string; allowPast?: boolean; optional?: boolean; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const first = value || min || plusDays(1);
  const [month, setMonth] = useState(() => first.slice(0, 7));
  useEffect(() => { if (open) setMonth((value || min || plusDays(1)).slice(0, 7)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [y, m] = month.split('-').map(Number);
  const startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const lo = allowPast ? '' : (min ?? plusDays(1));
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const pick = (d: string) => { onChange(d); setOpen(false); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={cx('w-full flex items-center gap-3 rounded-2xl bg-go-surface border border-go-line text-left active:scale-[.99] transition', compact ? 'h-12 px-3' : 'h-14 px-4')}>
        <CalendarClock className="w-5 h-5 text-go-brand flex-shrink-0" />
        <span className="flex-1 min-w-0">
          {value
            ? <><span className="block text-[15px] font-semibold text-go-ink leading-tight">{dayLabel(value)}</span>
                <span className="block text-[12px] text-go-muted">{daysFrom(value) < 0 ? 'Done earlier' : inDays(value)}</span></>
            : <span className="block text-[15px] text-go-faint">{optional ? 'No date yet' : 'Choose a date'}</span>}
        </span>
        <ChevronRight className="w-5 h-5 text-go-faint" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}
        footer={optional && value ? <Btn block variant="secondary" onClick={() => pick('')}>No date</Btn> : undefined}>
        <div className="flex gap-2 mb-4 overflow-x-auto go-scroll -mx-5 px-5">
          {[7, 10, 14, 21, 28].map(n => (
            <button key={n} type="button" onClick={() => pick(plusDays(n))}
              className={cx('h-9 px-3.5 rounded-full text-[13px] font-semibold border whitespace-nowrap flex-shrink-0 transition',
                value === plusDays(n) ? 'bg-go-brand text-white border-go-brand' : 'bg-go-surface text-go-ink2 border-go-line')}>
              In {n} days
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="w-10 h-10 rounded-full bg-go-raised flex items-center justify-center text-go-ink2"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-[16px] font-bold text-go-ink">{new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="w-10 h-10 rounded-full bg-go-raised flex items-center justify-center text-go-ink2"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11.5px] font-semibold text-go-faint mb-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const off = !!lo && d < lo;
            const on = d === value;
            const isToday = d === today();
            const weekend = (i % 7) >= 5;
            return (
              <button key={d} type="button" disabled={off} onClick={() => pick(d)} aria-label={dayLabel(d)} aria-pressed={on}
                className={cx('mx-auto w-10 h-10 rounded-full text-[15px] font-semibold transition',
                  on ? 'go-grad text-white go-glow' : off ? 'text-go-faint/50' : weekend ? 'text-go-muted' : 'text-go-ink',
                  !on && isToday && 'ring-2 ring-go-brand/40', !on && !off && 'active:bg-go-raised')}>
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        {allowPast && <p className="text-[12px] text-go-muted mt-3 text-center">A date in the past means it was done earlier.</p>}
      </Sheet>
    </>
  );
}

// ─── Tooth chart (UK Palmer notation: UR8 … UL8 / LR8 … LL8) ────────────────

const SIDE = [8, 7, 6, 5, 4, 3, 2, 1];
const ARCH_OF: Record<ArchToken, string[]> = {
  'Upper arch': [...SIDE.map(n => `UR${n}`), ...[...SIDE].reverse().map(n => `UL${n}`)],
  'Lower arch': [...SIDE.map(n => `LR${n}`), ...[...SIDE].reverse().map(n => `LL${n}`)],
  'Both arches': [],
};

// The chart's teeth are the New Case flow's anatomical ones (ToothShapes): each tooth its own shape and width, crowns
// meeting at the bite line, selected teeth in the selection teal. Go's UR/UL/LL/LR ids map to FDI quadrants 1–4.
const FDI_QUADRANT: Record<string, string> = { UR: '1', UL: '2', LL: '3', LR: '4' };
const fdiOf = (id: string) => `${FDI_QUADRANT[id.slice(0, 2)]}${id.slice(2)}`;

type QuadKey = 'UR' | 'UL' | 'LR' | 'LL';
// The four quadrants as the mouth looks from the front: patient's right on the left, front teeth at the midline.
const QUADS: { key: QuadKey; label: string; ids: string[]; lower?: boolean }[] = [
  { key: 'UR', label: 'Upper right', ids: SIDE.map(n => `UR${n}`) },
  { key: 'UL', label: 'Upper left', ids: [...SIDE].reverse().map(n => `UL${n}`) },
  { key: 'LR', label: 'Lower right', ids: SIDE.map(n => `LR${n}`), lower: true },
  { key: 'LL', label: 'Lower left', ids: [...SIDE].reverse().map(n => `LL${n}`), lower: true },
];
const quadOf = (k: QuadKey) => QUADS.find(q => q.key === k)!;

/** A tooth drawn in the overview — just a picture; the whole quadrant around it is the button. */
function ToothArt({ id, on, uid }: { id: string; on: boolean; uid: string }) {
  const fdi = fdiOf(id);
  return (
    <span className="min-w-0 block" style={{ flexGrow: slotOf(fdi), flexBasis: 0 }}>
      <ToothSvg id={fdi} uid={uid} look={{ lit: on }} tint="off" />
    </span>
  );
}

/** A tooth in the zoomed quadrant: thumb-sized, with its number under (or over) it. */
function Tooth({ id, on, lower, uid, onTap }: { id: string; on: boolean; lower?: boolean; uid: string; onTap: () => void }) {
  const fdi = fdiOf(id);
  return (
    <button type="button" onClick={onTap} aria-pressed={on} aria-label={id} style={{ flexGrow: slotOf(fdi), flexBasis: 0 }}
      className={cx('group min-w-0 flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition active:scale-95',
        on ? 'bg-go-brand/10' : 'active:bg-go-line/40', lower ? 'flex-col-reverse justify-end' : 'justify-end')}>
      <span className="block w-full px-0.5"><ToothSvg id={fdi} uid={uid} look={{ lit: on }} tint={on ? 'off' : 'hover'} /></span>
      <span className={cx('text-[13px] font-bold tabular-nums leading-none', on ? 'text-go-brand' : 'text-go-muted')}>{Number(id.slice(2))}</span>
    </button>
  );
}

/** The whole mouth as four tappable quadrants; tapping one zooms in to its eight teeth at thumb size. */
const onlyTeeth = (v: string[]) => v.filter(x => !(ARCH_TOKENS as readonly string[]).includes(x));
function ToothChart({ value, onChange }: { value: string[]; onChange: (next: (prev: string[]) => string[]) => void }) {
  const teeth = onlyTeeth(value);
  const toggle = (t: string) => onChange(prev => { const cur = onlyTeeth(prev); return cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]; });
  const setAll = (ids: string[]) => onChange(prev => {
    const cur = onlyTeeth(prev);
    return ids.every(t => cur.includes(t)) ? cur.filter(t => !ids.includes(t)) : [...new Set([...cur, ...ids])];
  });
  const wholeOn = (a: 'Upper arch' | 'Lower arch') => ARCH_OF[a].every(t => teeth.includes(t));
  const countIn = (q: QuadKey) => teeth.filter(t => t.startsWith(q)).length;
  const uid = `go-teeth-${useId().replace(/:/g, '')}`;
  const [quad, setQuad] = useState<QuadKey | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // First visit with nothing picked: a thumb taps the upper-right quadrant twice, so it's clear the chart opens up.
  // It goes away on the first touch of the chart, or once it has played.
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (teeth.length) return;
    const box = card.current, t = box?.querySelector<HTMLElement>('[data-quad="UR"]');
    if (!box || !t) return;
    const b = box.getBoundingClientRect(), r = t.getBoundingClientRect();
    const scale = b.width / box.offsetWidth || 1; // the phone frame may be scaled down
    setHint({ x: (r.left + r.width * 0.62 - b.left) / scale, y: (r.top + r.height * 0.55 - b.top) / scale });
  }, []);

  // Overview: each half-row is one big button (~150px wide) — far easier to hit than a single 20px tooth.
  const zone = (k: QuadKey) => {
    const q = quadOf(k), n = countIn(k);
    return (
      <button type="button" data-quad={k} onClick={() => setQuad(k)} aria-label={`${q.label}, ${n ? `${n} selected` : 'none selected'} — open`}
        className={cx('relative flex-1 min-w-0 flex rounded-2xl px-1 transition active:scale-[.98] border',
          q.lower ? 'items-start pt-1.5 pb-5' : 'items-end pt-5 pb-1.5',
          n ? 'bg-go-brand/[.06] border-go-brand/30' : 'bg-go-line/20 border-transparent hover:bg-go-line/35')}>
        <span className={cx('absolute flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide leading-none',
          q.lower ? 'bottom-1.5' : 'top-1.5', k.endsWith('R') ? 'left-2' : 'right-2', n ? 'text-go-brand' : 'text-go-faint')}>
          {q.label}{n > 0 && <span className="min-w-[15px] h-[15px] px-1 rounded-full bg-go-brand text-white text-[9.5px] grid place-items-center">{n}</span>}
        </span>
        {q.ids.map(t => <ToothArt key={t} id={t} uid={uid} on={teeth.includes(t)} />)}
      </button>
    );
  };

  const open = quad ? quadOf(quad) : null;
  const openAll = open ? open.ids.every(t => teeth.includes(t)) : false;
  return (
    <div>
      <div ref={card} onPointerDown={() => setHint(null)}
        className="relative rounded-[22px] bg-go-surface border border-go-line/80 go-card-shadow p-2" aria-label="Teeth chart">
        {hint && (
          <span aria-hidden className="go-tap-hint pointer-events-none absolute z-10" style={{ left: hint.x, top: hint.y }}
            onAnimationEnd={e => { if (e.animationName === 'go-tap-hand') setHint(null); }}>
            <span className="go-tap-ripple absolute -left-4 -top-4 w-8 h-8 rounded-full bg-go-brand/40" />
            <span className="go-tap-hand absolute"><TapThumb /></span>
          </span>
        )}
        <ToothDefs uid={uid} />
        {!open ? (
          <div className="go-fade-in">
            <div className="flex gap-1.5">{zone('UR')}{zone('UL')}</div>
            <div className="h-1.5" />
            <div className="flex gap-1.5">{zone('LR')}{zone('LL')}</div>
          </div>
        ) : (
          <div key={open.key} className="go-rise">
            <div className="flex items-center gap-1 mb-2">
              <button type="button" onClick={() => setQuad(null)} aria-label="Back to all teeth"
                className="h-9 pl-1.5 pr-2.5 rounded-xl flex items-center gap-0.5 text-[12.5px] font-semibold text-go-ink2 active:bg-go-line/40">
                <ChevronLeft className="w-4 h-4" /> All teeth
              </button>
              <button type="button" onClick={() => setAll(open.ids)}
                className={cx('ml-auto h-8 px-3 rounded-full text-[12px] font-semibold border transition active:scale-[.97]',
                  openAll ? 'bg-go-brand text-white border-go-brand' : 'bg-go-surface text-go-ink2 border-go-line')}>
                {openAll ? 'All 8 picked' : 'Pick all 8'}
              </button>
            </div>
            {/* Jump between quadrants without going back. */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-go-line/25 mb-2">
              {QUADS.map(q => {
                const n = countIn(q.key), cur = q.key === open.key;
                return (
                  <button key={q.key} type="button" onClick={() => setQuad(q.key)} aria-pressed={cur}
                    className={cx('h-9 rounded-xl flex items-center justify-center gap-1 text-[12px] font-bold transition',
                      cur ? 'bg-go-surface text-go-ink shadow-sm' : 'text-go-muted')}>
                    {q.key}
                    {n > 0 && <span className="min-w-[15px] h-[15px] px-1 rounded-full bg-go-brand text-white text-[9.5px] grid place-items-center">{n}</span>}
                  </button>
                );
              })}
            </div>
            <div className={cx('flex gap-0.5 px-0.5', open.lower ? 'items-start' : 'items-end')}>
              {open.ids.map(t => <Tooth key={t} id={t} uid={uid} on={teeth.includes(t)} lower={open.lower} onTap={() => toggle(t)} />)}
            </div>
            <p className={cx('mt-1.5 text-[10.5px] font-semibold text-go-faint flex', open.key.endsWith('R') ? 'justify-end' : 'justify-start')}>
              {open.key.endsWith('R') ? 'Front teeth →' : '← Front teeth'}
            </p>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        {(['Upper arch', 'Lower arch'] as const).map(a => (
          <button key={a} type="button" onClick={() => setAll(ARCH_OF[a])}
            className={cx('flex-1 h-10 rounded-2xl text-[13px] font-semibold border transition active:scale-[.98]',
              wholeOn(a) ? 'bg-go-brand text-white border-go-brand' : 'bg-go-surface text-go-ink2 border-go-line')}>
            Whole {a.split(' ')[0].toLowerCase()}
          </button>
        ))}
      </div>
      <p className="mt-2.5 px-1 text-[12.5px] text-go-muted min-h-[18px]">
        {teeth.length
          ? <>Selected: <span className="font-semibold text-go-ink">{teeth.length > 6 ? `${teeth.length} teeth` : teeth.join(', ')}</span></>
          : open ? 'Tap the teeth to pick them.' : 'Tap a side of the mouth to open it.'}
      </p>
    </div>
  );
}

/** A thumb seen from above, coming in from the bottom right; its pad (12, 3.6 in CSS px) is the touch point. */
function TapThumb() {
  return (
    <svg viewBox="0 0 20 34" width="24" height="40.8" className="go-tap-thumb drop-shadow-md" fill="none" stroke="#2A2F3A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 34V10a7 7 0 0 1 14 0v24" fill="white" />
      <path d="M6.2 9.6a3.8 3.8 0 0 1 7.6 0v3.2c-2.5 1-5.1 1-7.6 0Z" fill="#EEF0F4" />
      <path d="M6 22.5c2.6.9 5.4.9 8 0" opacity=".55" />
    </svg>
  );
}

/** Upper (∩), lower (∪) or both, drawn. */
function ArchArt({ which }: { which: ArchToken }) {
  return (
    <svg viewBox="0 0 48 40" className="w-12 h-10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      {which !== 'Lower arch' && <path d={which === 'Both arches' ? 'M8 17C8 5 40 5 40 17' : 'M8 26C8 8 40 8 40 26'} />}
      {which !== 'Upper arch' && <path d={which === 'Both arches' ? 'M8 23C8 35 40 35 40 23' : 'M8 14C8 32 40 32 40 14'} />}
    </svg>
  );
}

function ArchPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const cur = value.find(v => (ARCH_TOKENS as readonly string[]).includes(v)) as ArchToken | undefined;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {ARCH_TOKENS.map(a => {
        const on = cur === a;
        return (
          <button key={a} type="button" onClick={() => onChange(on ? [] : [a])} aria-pressed={on}
            className={cx('rounded-[20px] border py-4 flex flex-col items-center gap-2 transition active:scale-[.97]',
              on ? 'border-go-brand bg-go-brand-soft text-go-brand go-card-shadow' : 'border-go-line bg-go-surface text-go-muted')}>
            <ArchArt which={a} />
            <span className={cx('text-[13.5px] font-semibold', on ? 'text-go-brand-ink' : 'text-go-ink')}>{a === 'Both arches' ? 'Both' : a.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Shade swatches: colours on screen are a guide only.
const SHADE_TINT: Record<string, string> = { A: '#E9D9B8', B: '#EFE3C4', C: '#DCD3C0', D: '#E2D6C3', BL: '#F7F6F1' };
const shadeTint = (s: string) => SHADE_TINT[s.startsWith('BL') ? 'BL' : s[0]] ?? '#EEE';

// ─── A service's own page ───────────────────────────────────────────────────

function Field({ label, optional, children, hint }: { label: string; optional?: boolean; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="px-1 mb-2.5 flex items-baseline gap-1.5">
        <span className="text-[15px] font-bold text-go-ink">{label}</span>
        {optional && <span className="text-[12px] text-go-faint">optional</span>}
      </h3>
      {children}
      {hint && <p className="px-1 mt-2 text-[12px] text-go-muted">{hint}</p>}
    </section>
  );
}

/** One closed row per detail, like the web flow: the label, what's set so far, and a chevron; tap to edit. */
function Fold({ label, optional, required, summary, open, onToggle, hint, children }: {
  label: string; optional?: boolean; required?: boolean; summary?: string; open: boolean; onToggle: () => void; hint?: React.ReactNode; children: React.ReactNode;
}) {
  const id = `fold-${useId().replace(/:/g, '')}`;
  return (
    <section className={cx('rounded-[20px] bg-go-surface border transition-colors', open ? 'border-go-brand/40 go-card-shadow' : 'border-go-line/80')}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id}
        className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left">
        <span className="flex-shrink-0 flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold text-go-ink">{label}</span>
          {optional && !summary && <span className="text-[12px] text-go-faint">optional</span>}
        </span>
        <span className={cx('flex-1 min-w-0 text-right truncate text-[13px]',
          summary ? 'font-semibold text-go-brand' : required ? 'font-semibold text-go-warn' : 'text-go-faint')}>
          {summary || (required ? 'Needed' : '')}
        </span>
        <ChevronDown className={cx('w-5 h-5 flex-shrink-0 text-go-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className="go-rise px-4 pb-4 -mt-0.5">
          {children}
          {hint && <p className="px-1 mt-2 text-[12px] text-go-muted">{hint}</p>}
        </div>
      )}
    </section>
  );
}

const shortDay = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const asText = (v: string | string[] | undefined) => ([] as string[]).concat(v ?? []).filter(Boolean).join(', ');

/** The case a denture follow-up is added to — shown on the service page and on Review. */
function MatchNote({ match }: { match: DentureMatch }) {
  return (
    <div className="mt-4 rounded-[18px] border border-go-ok/30 bg-go-ok-soft px-4 py-3 flex gap-3">
      <CheckCircle2 className="w-5 h-5 text-go-ok flex-shrink-0 mt-0.5" />
      <p className="text-[13px] leading-snug text-go-ink2">
        <span className="font-bold text-go-ink">Matching case found · {match.c.id}.</span> Its earlier stages are already ordered, so the new stage is added to that case. No new case is created.
      </p>
    </div>
  );
}

function ServicePage({ it, set, match }: { it: FormItem; set: (p: Partial<FormItem> | ((cur: FormItem) => Partial<FormItem>)) => void; match?: DentureMatch | null }) {
  const cat = getCategoryForItem(it.itemId) ?? 'others';
  const fields = detailFields(it.itemId).filter(f => f.key !== 'stages');
  const stagesField = detailFields(it.itemId).find(f => f.key === 'stages');
  const kind = itemStaged(it);
  const locked = new Map((match?.stages ?? []).map(l => [l.name, l]));
  const chosen = STAGE_NAMES.filter(n => !locked.has(n) && ([] as string[]).concat(it.details.stages ?? []).includes(n));
  // Everything under the teeth starts closed; one section opens at a time.
  // A matched denture opens on its stages: picking the next one is the whole job.
  const [open, setOpen] = useState<string | null>(match ? 'stages' : null);
  const fold = (key: string) => ({ open: open === key, onToggle: () => setOpen(o => (o === key ? null : key)) });
  const material = needsMaterial(it.itemId);
  return (
    <div>
      {match && <MatchNote match={match} />}
      {ARCH_ONLY.has(it.itemId)
        ? <Field label="Which arch?"><ArchPicker value={it.teeth} onChange={teeth => set({ teeth })} /></Field>
        : <Field label="Teeth" hint={cat === 'bridge' ? 'Tap every tooth in the bridge, ends included.' : undefined}><ToothChart value={it.teeth} onChange={next => set(cur => ({ teeth: next(cur.teeth) }))} /></Field>}

      <div className="mt-6 space-y-2.5">
        {material && (
          <Fold label="Material" optional summary={it.material ?? ''} {...fold('material')}>
            {freeTextMaterial(it.itemId)
              ? <Input value={it.material ?? ''} onChange={e => set({ material: e.target.value })} placeholder="Type the material" />
              : <ChoiceWithOther options={MATERIALS} value={it.material} onChange={material => set({ material })} placeholder="Type the material" />}
          </Fold>
        )}
        {material && (
          <Fold label="Shade" optional summary={it.shade ?? ''} {...fold('shade')}>
            {freeTextMaterial(it.itemId)
              ? <Input value={it.shade ?? ''} onChange={e => set({ shade: e.target.value })} placeholder="Type the shade" />
              : (
                <div className="grid grid-cols-6 gap-2">
                  {SHADES.map(s => {
                    const on = it.shade === s;
                    return (
                      <button key={s} type="button" onClick={() => set({ shade: on ? null : s })} aria-pressed={on}
                        className={cx('h-14 rounded-2xl border flex flex-col items-center justify-center gap-1 transition active:scale-95',
                          on ? 'border-go-brand ring-4 ring-go-brand/15 bg-go-brand-soft' : 'border-go-line bg-go-surface')}>
                        <span className="w-5 h-5 rounded-md border border-black/10" style={{ background: shadeTint(s) }} />
                        <span className={cx('text-[11.5px] font-bold', on ? 'text-go-brand-ink' : 'text-go-ink2')}>{s}</span>
                      </button>
                    );
                  })}
                </div>
              )}
          </Fold>
        )}

        {stagesField && (
          <Fold label={match ? 'Next stage' : 'Stages'} required summary={chosen.length ? (chosen.length > 2 ? `${chosen.length} stages` : chosen.join(', ')) : ''}
            hint={match ? `Stages with a lock are already on ${match.c.id}.` : 'Tick the stages to order, then give each a date.'} {...fold('stages')}>
            <div className="rounded-2xl border border-go-line/80 overflow-hidden divide-y divide-go-line/70">
              {STAGE_NAMES.map((n, i) => {
                const l = locked.get(n);
                if (l) return (
                  <div key={n} className="px-3.5 py-3 flex items-center gap-3 bg-go-raised/60">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-go-line/60 text-go-muted"><Lock className="w-3.5 h-3.5" /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-go-muted">{n}</span>
                      <span className="block text-[11.5px] text-go-faint">{lockedLine(l)} · {match!.c.id}</span>
                    </span>
                    <span className="text-[11px] font-bold text-go-faint">{i + 1}</span>
                  </div>
                );
                const on = chosen.includes(n);
                const d = it.stageDates[n] ?? '';
                return (
                  <div key={n} className={cx('px-3.5 py-3', on && 'bg-go-brand-soft/40')}>
                    <button type="button" onClick={() => set({ details: { ...it.details, stages: on ? chosen.filter(x => x !== n) : STAGE_NAMES.filter(x => x === n || chosen.includes(x)) } })}
                      className="w-full flex items-center gap-3 text-left" aria-pressed={on}>
                      <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition', on ? 'go-grad text-white' : 'border-2 border-go-line')}>{on && <Check className="w-3.5 h-3.5" />}</span>
                      <span className="flex-1 text-[15px] font-semibold text-go-ink">{n}</span>
                      <span className="text-[11px] font-bold text-go-faint">{i + 1}</span>
                    </button>
                    {on && <div className="mt-2.5 pl-9"><DateField compact allowPast value={d} label={`${n} · delivery date`} onChange={v => set({ stageDates: { ...it.stageDates, [n]: v } })} /></div>}
                  </div>
                );
              })}
            </div>
          </Fold>
        )}

        {fields.map(f => (
          <Fold key={f.key} label={f.label} optional={!f.required} required={f.required} summary={asText(it.details[f.key])} {...fold(`d:${f.key}`)}>
            <DetailInput bare field={f} value={it.details[f.key]} onChange={v => set({ details: { ...it.details, [f.key]: v } })} />
          </Fold>
        ))}

        {kind === 'phase' ? (
          <Fold label="Delivery dates" summary={(() => { const n = it.phases.filter(Boolean).length; return n ? `${n} of ${it.phases.length} dated` : ''; })()}
            hint="A date for each phase. You can order the next phase later from the case." {...fold('phases')}>
            <div className="space-y-2">
              {it.phases.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 text-[13px] font-semibold text-go-ink2 flex-shrink-0">{phaseName(i + 1)}</span>
                  <div className="flex-1 min-w-0"><DateField compact value={d} label={`${phaseName(i + 1)} · delivery date`} onChange={v => set({ phases: it.phases.map((x, j) => (j === i ? v : x)) })} /></div>
                  {it.phases.length > 1 && <button type="button" onClick={() => set({ phases: it.phases.filter((_, j) => j !== i) })} aria-label={`Remove ${phaseName(i + 1)}`}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-go-muted active:bg-go-raised"><X className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => set({ phases: [...it.phases, ''] })} className="mt-2.5 inline-flex items-center gap-1.5 h-10 text-[13.5px] font-semibold text-go-brand px-1">
              <PlusCircle className="w-4 h-4" />Add {phaseName(it.phases.length + 1)}
            </button>
          </Fold>
        ) : kind !== 'stage' && (
          <Fold label="Delivery date" optional summary={it.returnBy ? shortDay(it.returnBy) : ''} {...fold('date')}>
            <DateField value={it.returnBy} optional label="Delivery date" onChange={returnBy => { set({ returnBy }); }} />
          </Fold>
        )}
      </div>
    </div>
  );
}

// ─── Denture follow-ups ─────────────────────────────────────────────────────
// Same as the photo flow and the web Quick Create: a denture for a patient, practice and dentist that already have that
// denture on a case is its next stage. The stages already on that case are locked; the new ones are added to it.

export interface DentureMatch { c: LabCase; index: number; stages: StageLine[] }
function dentureMatch(cases: LabCase[], f: CaseForm): DentureMatch | null {
  const [it, ...more] = f.items;
  if (!it || more.length || itemStaged(it) !== 'stage' || !f.patientId || !f.practice || !f.clinician) return null;
  const name = serviceLabel(it.itemId).toLowerCase();
  for (const c of cases) {
    if (c.patientId !== f.patientId || c.practice !== f.practice || c.clinician !== f.clinician || c.stage === 'draft') continue;
    const index = allItems(c).findIndex(x => x.service.toLowerCase() === name && x.stages?.length);
    if (index >= 0) return { c, index, stages: allItems(c)[index].stages! };
  }
  return null;
}
const lockedLine = (l: StageLine) => (l.state === 'done-earlier' ? 'Done elsewhere' : l.state === 'received' ? 'Received' : l.date ? `Ordered · ${shortDay(l.date.slice(0, 10))}` : 'Ordered');

/** Jump-to-screen demos (?demo=…): a denture case already filled in, opened on its service page or Review. */
type Demo = 'denture' | 'denture-match' | 'partial-match' | 'denture-match-review';
const DEMO_OF: Record<Demo, { patientId: string; practice: NonNullable<CaseForm['practice']>; clinician: string; lab: string; itemId: string; teeth: string[]; stageDates?: Record<string, number>; review?: boolean }> = {
  // No case to match: every stage is open to order
  'denture': { patientId: 'P-10231', practice: 'cds', clinician: 'reed', lab: 'northstar', itemId: 'de-full-denture', teeth: ['Both arches'] },
  // SG-28488 (James Williams): Special Tray + Bite Registration done elsewhere, Try In ordered → only Finish is left
  'denture-match': { patientId: 'P-10188', practice: 'isc', clinician: 'okafor', lab: 'precision', itemId: 'de-full-denture', teeth: ['Both arches'] },
  // SG-28497 (Ella Brooks): partial denture with Special Tray done elsewhere, Bite Registration + Try In ordered
  'partial-match': { patientId: 'P-10402', practice: 'isc', clinician: 'okafor', lab: 'precision', itemId: 'de-partial-denture', teeth: ['Upper arch'] },
  // As denture-match, with Finish picked and dated: Review offers "Add to SG-28488" or a new case
  'denture-match-review': { patientId: 'P-10188', practice: 'isc', clinician: 'okafor', lab: 'precision', itemId: 'de-full-denture', teeth: ['Both arches'], stageDates: { Finish: 10 }, review: true },
};
const demoForm = (d: Demo, base: CaseForm): CaseForm => {
  const x = DEMO_OF[d];
  const stageDates = Object.fromEntries(Object.entries(x.stageDates ?? {}).map(([n, days]) => [n, plusDays(days)]));
  const it = newItem(x.itemId, { teeth: x.teeth, details: Object.keys(stageDates).length ? { stages: Object.keys(stageDates) } : {}, stageDates });
  return { ...base, patientId: x.patientId, practice: x.practice, clinician: x.clinician, lab: x.lab, items: [it] };
};

// ─── The flow ───────────────────────────────────────────────────────────────

export default function LiteManual() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { cases, addCase, updateCase, toast, soloPractice } = useGo();
  const draftId = params.get('draft');
  const draftCase = useMemo(() => (draftId ? cases.find(c => c.id === draftId && !!c.draftForm) : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  const demo = (Object.keys(DEMO_OF) as Demo[]).find(d => d === params.get('demo'));
  const [f, setF] = useState<CaseForm>(() => (draftCase ? normForm({ ...emptyForm(), ...(draftCase.draftForm as CaseForm) })
    : demo ? demoForm(demo, emptyForm()) : { ...emptyForm(), practice: soloPractice ?? 'cds' }));
  const set = (p: Partial<CaseForm>) => setF(x => ({ ...x, ...p }));
  // A draft reopens on its first gap (or Review once it has everything).
  const [step, setStep] = useState<StepId>(() => {
    if (demo) return DEMO_OF[demo].review ? 'review' : 'services';
    if (!draftCase) return 'patient';
    const d = draftCase.draftForm as CaseForm;
    return !d.patientId ? 'patient' : !d.lab ? 'lab' : !d.items?.length ? 'services' : 'review';
  });
  const [dir, setDir] = useState<1 | -1>(1);
  const [editing, setEditing] = useState<string | null>(() => (demo && !DEMO_OF[demo].review ? f.items[0]?.uid ?? null : null)); // a service's own page
  const [adding, setAdding] = useState(false);                  // the catalogue, once a service exists
  const [stepsOpen, setStepsOpen] = useState(false);
  const [patientSheet, setPatientSheet] = useState(false);
  const [labSheet, setLabSheet] = useState(false);
  // Who is prescribing: two quick picks in bottom sheets — the practice, then (on its own) the dentist.
  const [whoSheet, setWhoSheet] = useState<'practice' | 'dentist' | null>(null);
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<{ c: LabCase; added?: string[] } | null>(null);
  // Changing something from Review (or the Steps sheet once everything needed is in) comes back to Review.
  const [returnTo, setReturnTo] = useState<StepId | null>(null);
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState<string[]>(readFavs);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const idx = STEPS.findIndex(s => s.id === step);
  const cur = STEPS[idx];
  const editItem = editing ? f.items.find(i => i.uid === editing) : undefined;
  const okOf: Record<StepId, boolean> = {
    patient: !!f.patientId, lab: !!f.lab, services: f.items.length > 0, source: true, dentist: !!f.clinician, review: true,
  };
  const valueOf: Record<StepId, string | null> = {
    patient: f.patientId ? patientById(f.patientId).name : null,
    lab: f.lab ? labName(f.lab) : null,
    services: f.items.length ? f.items.map(itemName).join(', ') : null,
    source: [f.caseSource, f.funding].filter(Boolean).join(' · ') || null,
    dentist: f.clinician ? clinicianName(f.clinician) : null,
    review: null,
  };
  const missing = STEPS.filter(s => !okOf[s.id]);
  const match = dentureMatch(cases, f);

  const go = (to: StepId, from?: StepId) => {
    window.clearTimeout(advanceTimer.current);
    setReturnTo(from === 'review' && to !== 'review' ? 'review' : null);
    const ti = STEPS.findIndex(s => s.id === to);
    setDir(ti >= idx ? 1 : -1);
    setStep(to); setEditing(null); setAdding(false); setTried(false); setQ(''); setStepsOpen(false); setWhoSheet(null);
    // Arriving on the dentist step opens the first picker once the page has slid in; from Review it waits for a tap.
    if (to === 'dentist' && from !== 'review') {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => setWhoSheet(soloPractice ? 'dentist' : 'practice'), 340);
    }
  };
  const next = () => {
    if (!okOf[step]) { setTried(true); return; }
    go(returnTo ?? STEPS[Math.min(idx + 1, STEPS.length - 1)].id);
  };
  const closeService = () => { setDir(-1); setEditing(null); if (returnTo === 'review') go('review'); };
  const back = () => {
    window.clearTimeout(advanceTimer.current);
    if (editing) { closeService(); return; }
    if (returnTo === 'review') { go('review'); return; }
    if (adding && f.items.length) { setAdding(false); return; }
    if (idx === 0) { navigate(-1); return; }
    go(STEPS[idx - 1].id);
  };
  // Picking a patient, lab or dentist is the answer: the next page slides in on its own.
  const pickAndGo = (patch: Partial<CaseForm>) => {
    set(patch);
    window.clearTimeout(advanceTimer.current);
    const target = returnTo ?? STEPS[Math.min(STEPS.findIndex(s => s.id === step) + 1, STEPS.length - 1)].id;
    advanceTimer.current = window.setTimeout(() => go(target), 260);
  };

  const addService = (itemId: string) => {
    const it = newItem(itemId, { returnBy: plusDays(14) });
    set({ items: [...f.items, it] });
    setAdding(false); setDir(1); setEditing(it.uid);
  };
  const setItem = (uid: string, p: Partial<FormItem> | ((cur: FormItem) => Partial<FormItem>)) =>
    setF(x => ({ ...x, items: x.items.map(i => (i.uid === uid ? { ...i, ...(typeof p === 'function' ? p(i) : p) } : i)) }));
  const removeItem = (uid: string) => { setF(x => ({ ...x, items: x.items.filter(i => i.uid !== uid) })); setDir(-1); setEditing(null); toast('Service removed', 'info'); };

  const freeId = (base: () => string) => { let id = base(); while (cases.some(c => c.id === id || c.id === id.replace('SG-D', 'SG-2'))) id = base(); return id; };
  const send = (forceNew = false) => {
    if (missing.length) { toast(`Please add the ${missing[0].name.toLowerCase()}`, 'info'); go(missing[0].id); setTried(true); return; }
    // A denture follow-up: the new stages go onto the case that already has the earlier ones
    if (match && !forceNew) {
      const it = f.items[0];
      const have = new Set(match.stages.map(x => x.name));
      const fresh = STAGE_NAMES.filter(n => !have.has(n) && ([] as string[]).concat(it.details.stages ?? []).includes(n));
      if (!fresh.length || fresh.some(n => !it.stageDates[n])) {
        toast(fresh.length ? 'Please give each new stage a date' : 'Please pick the next stage to order', 'info');
        go('services', 'review'); setEditing(it.uid); return;
      }
      const now = new Date().toISOString();
      const added: StageLine[] = fresh.map(n => ({ name: n, date: new Date(`${it.stageDates[n]}T12:00`).toISOString(), orderedAt: now }));
      updateCase(match.c.id, x => ({
        ...patchItemStages(x, match.index, [...(allItems(x)[match.index].stages ?? []), ...added].sort((p, q) => STAGE_NAMES.indexOf(p.name) - STAGE_NAMES.indexOf(q.name))),
        events: [...x.events, { stage: 'note', at: now, by: ME.name, text: `Ordered ${fresh.join(', ')} · ${allItems(x)[match.index].service}` }],
      }));
      toast(`${fresh.join(', ')} added to ${match.c.id}`);
      setCreated({ c: match.c, added: fresh });
      return;
    }
    const built = buildCase(f, 'manual');
    const c: LabCase = draftCase ? { ...built, id: draftCase.id.replace('SG-D', 'SG-2') } : { ...built, id: freeId(() => `SG-${28510 + Math.floor(Math.random() * 400)}`) };
    if (draftCase) updateCase(draftCase.id, { ...c, draftForm: undefined }); else addCase(c);
    toast('Case created. Ready to dispatch');
    setCreated({ c });
  };
  const saveDraft = () => {
    if (!f.patientId) { toast('Please add a patient before saving a draft', 'info'); go('patient'); return; }
    const d = buildDraft(f, draftCase?.id ?? freeId(() => `SG-D${1100 + Math.floor(Math.random() * 800)}`));
    if (draftCase) updateCase(draftCase.id, d); else addCase(d);
    toast('Draft saved. Find it under Draft in Lab work');
    navigate(`${LITE}/work?f=draft`, { replace: true });
  };

  if (created) return <Created c={created.c} added={created.added} onAnother={() => navigate(`${LITE}/new/manual`, { replace: true, state: { again: location.key } })} />;

  // ── Header: back / title / Save draft, then the step bar (tap = all steps).
  const title = editItem ? itemName(editItem) : adding ? 'Add a service' : cur.name;
  const header = (
    <div className="relative z-10 bg-go-bg/80 backdrop-blur-xl">
      <div className="h-14 px-2 flex items-center gap-1">
        <button type="button" onClick={back} aria-label={idx === 0 && !editing ? 'Close' : 'Back'}
          className="w-10 h-10 rounded-full flex items-center justify-center text-go-ink active:bg-go-raised">
          {idx === 0 && !editing && !adding ? <X className="w-[22px] h-[22px]" /> : <ChevronLeft className="w-6 h-6" />}
        </button>
        <span className="flex-1 min-w-0 text-center text-[15px] font-semibold text-go-ink truncate">{title}</span>
        <button type="button" onClick={saveDraft} className="h-10 px-2 text-[13.5px] font-semibold text-go-brand rounded-full active:bg-go-raised">Save draft</button>
      </div>
      <button type="button" onClick={() => setStepsOpen(true)} aria-label={`Step ${idx + 1} of ${STEPS.length}, ${cur.name}. Show all steps`}
        className="w-full flex items-center gap-2.5 px-4 pb-3">
        <span className="flex-1 flex items-center gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.id} className={cx('h-1.5 rounded-full transition-all duration-300',
              i === idx ? 'flex-[2.4] go-grad' : 'flex-1', i !== idx && (okOf[s.id] && (i < idx || valueOf[s.id]) ? 'bg-go-ok/70' : i < idx ? 'bg-go-warn/60' : 'bg-go-line'))} />
          ))}
        </span>
        <span className="text-[11.5px] font-bold tabular-nums text-go-muted" aria-hidden>{idx + 1}/{STEPS.length}</span>
        <ChevronDown className="w-4 h-4 text-go-faint" />
      </button>
    </div>
  );

  // ── Footer: one big CTA.
  let footer: React.ReactNode;
  if (editItem) {
    const miss = itemMissing(editItem).filter(m => m !== 'material' && m !== 'shade');
    footer = <Btn block icon={<Check className="w-5 h-5" />} onClick={closeService}>{miss.length ? 'Done for now' : 'Done'}</Btn>;
  } else if (step === 'review') {
    // The earlier stages are already on a case: adding to it is the main action, a separate case the alternative
    footer = match
      ? <div className="flex gap-2"><Btn variant="secondary" className="!px-4 whitespace-nowrap" onClick={() => send(true)}>Create new</Btn><Btn block icon={<CheckCircle2 className="w-5 h-5" />} onClick={() => send()}>Add to {match.c.id}</Btn></div>
      : <Btn block icon={<CheckCircle2 className="w-5 h-5" />} onClick={() => send()}>Ready for Dispatch</Btn>;
  } else if (step === 'services' && (adding || !f.items.length)) {
    footer = undefined;
  } else {
    footer = <Btn block onClick={next} className={cx(!okOf[step] && 'opacity-60')}>{step === 'dentist' || returnTo === 'review' ? 'Review' : 'Continue'}<ChevronRight className="w-5 h-5" /></Btn>;
  }

  const pageKey = editing ? `svc-${editing}` : adding ? 'adding' : step;
  const heading = !editItem && !adding && (
    <div className="pt-3 pb-1">
      <h1 className="text-[28px] font-bold text-go-ink tracking-tight leading-tight">{cur.title}</h1>
      <p className="text-[13.5px] text-go-muted mt-1 leading-snug">{cur.sub}</p>
      {tried && !okOf[step] && <p className="mt-3 px-3.5 py-2.5 rounded-2xl bg-go-warn-soft text-go-warn text-[13px] font-semibold">Please choose one to continue.</p>}
    </div>
  );

  // ── Pages.
  const recentIds = [...new Set(cases.map(c => c.patientId))];
  const ql = q.trim().toLowerCase();
  const rank = (id: string) => { const i = recentIds.indexOf(id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const patients = [...PATIENTS].sort((a, b) => rank(a.id) - rank(b.id))
    .filter(p => !ql || p.name.toLowerCase().includes(ql) || p.id.toLowerCase().includes(ql));
  const labs = LABS.filter(l => !ql || l.name.toLowerCase().includes(ql) || l.town.toLowerCase().includes(ql));
  const toggleFav = (id: string) => setFavs(fs => { const n = fs.includes(id) ? fs.filter(x => x !== id) : [...fs, id]; localStorage.setItem(FAV_KEY, JSON.stringify(n)); return n; });
  const labRow = (l: (typeof LABS)[number]) => (
    <div key={l.id} className="flex items-center">
      <div className="flex-1 min-w-0">
        <Row lead={<Lead tone="violet"><FlaskConical className="w-5 h-5" /></Lead>} title={l.name}
          sub={<>{l.town}{l.offline && <span className="ml-1.5 text-go-warn font-semibold">· Offline · gets it by email</span>}</>}
          selected={f.lab === l.id} onClick={() => pickAndGo({ lab: l.id })} />
      </div>
      <button type="button" onClick={() => toggleFav(l.id)} aria-pressed={favs.includes(l.id)} aria-label={favs.includes(l.id) ? `Remove ${l.name} from favourites` : `Add ${l.name} to favourites`}
        className={cx('w-11 h-11 mr-1.5 rounded-full flex items-center justify-center flex-shrink-0 active:bg-go-raised', favs.includes(l.id) ? 'text-go-warn' : 'text-go-line')}><Star className="w-5 h-5" /></button>
    </div>
  );

  let page: React.ReactNode;
  if (editItem) {
    page = (
      <div className="pt-2">
        <div className="flex items-center gap-3 pt-2">
          <Lead><ServiceIcon itemId={editItem.itemId} /></Lead>
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-bold text-go-ink tracking-tight leading-tight truncate">{itemName(editItem)}</h1>
            <p className="text-[12.5px] text-go-muted">{SERVICE_CATEGORIES.find(c => c.id === getCategoryForItem(editItem.itemId))?.label}</p>
          </div>
          <button type="button" onClick={() => removeItem(editItem.uid)} aria-label={`Remove ${itemName(editItem)}`}
            className="w-10 h-10 rounded-full bg-go-bad-soft text-go-bad flex items-center justify-center active:scale-95"><Trash className="w-[18px] h-[18px]" /></button>
        </div>
        <ServicePage it={editItem} match={match} set={p => setItem(editItem.uid, p)} />
      </div>
    );
  } else if (step === 'services' && (adding || !f.items.length)) {
    page = (
      <div>
        {adding ? <div className="pt-3"><h1 className="text-[28px] font-bold text-go-ink tracking-tight">Add a service</h1></div> : heading}
        <div className="mt-4"><SearchBox value={q} onChange={setQ} placeholder="Search services" /></div>
        {SERVICE_CATEGORIES.map(cat => {
          const items = cat.items.filter(s => !ql || s.label.toLowerCase().includes(ql) || cat.label.toLowerCase().includes(ql));
          if (!items.length) return null;
          return (
            <section key={cat.id} className="mt-5">
              <h3 className="px-1 mb-2 flex items-center gap-2 text-[12px] font-semibold text-go-muted">{cat.label}</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {items.map(s => (
                  <button key={s.id} type="button" onClick={() => addService(s.id)}
                    className="rounded-[20px] bg-go-surface border border-go-line/80 go-card-shadow p-3.5 text-left flex flex-col gap-3 min-h-[96px] active:scale-[.97] transition">
                    <Lead><ServiceIcon itemId={s.id} /></Lead>
                    <span className="text-[14px] font-semibold text-go-ink leading-snug">{cat.id === 'bridge' ? serviceLabel(s.id) : s.label}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  } else if (step === 'patient') {
    const sel = f.patientId ? patientById(f.patientId) : null;
    page = (
      <div>
        {heading}
        <div className="mt-4"><SearchBox value={q} onChange={setQ} placeholder="Name or patient ID" /></div>
        <Group>
          <Row lead={<Lead tone="ok"><UserPlus className="w-5 h-5" /></Lead>} title={ql ? `Add “${q.trim()}” as a new patient` : 'New patient'} sub="Add their details in a few seconds" chevron
            onClick={() => setPatientSheet(true)} />
        </Group>
        {sel && !ql && <Group title="Chosen"><Row lead={<Avatar name={sel.name} size={40} />} title={sel.name} sub={`${sel.id} · ${sel.dob}`} selected onClick={() => go('lab')} /></Group>}
        <Group title={ql ? `${patients.length} found` : 'Recent patients'}>
          {patients.slice(0, ql ? 30 : 8).map(p => (
            <Row key={p.id} lead={<Avatar name={p.name} size={40} />} title={p.name} sub={`${p.id} · Born ${p.dob}`} selected={f.patientId === p.id} onClick={() => pickAndGo({ patientId: p.id })} />
          ))}
          {!patients.length && <p className="px-4 py-5 text-[13.5px] text-go-muted text-center">No patient matches “{q.trim()}”.</p>}
        </Group>
        <PatientPicker bare createWith={q.trim()} value={f.patientId} open={patientSheet} onOpenChange={setPatientSheet} onChange={id => { force(n => n + 1); pickAndGo({ patientId: id }); }} />
      </div>
    );
  } else if (step === 'lab') {
    const favLabs = labs.filter(l => favs.includes(l.id));
    page = (
      <div>
        {heading}
        <div className="mt-4"><SearchBox value={q} onChange={setQ} placeholder="Lab name or town" /></div>
        {favLabs.length > 0 && <Group title="Favourites">{favLabs.map(labRow)}</Group>}
        <Group title={favLabs.length ? 'All labs' : undefined}>{labs.filter(l => !favs.includes(l.id)).map(labRow)}
          {!labs.length && <p className="px-4 py-5 text-[13.5px] text-go-muted text-center">No lab matches “{q.trim()}”.</p>}
        </Group>
        <Group>
          <Row lead={<Lead tone="warn"><Building2 className="w-5 h-5" /></Lead>} title="Add a lab that isn’t on Smile Genius" sub="They’ll get the case by email" chevron onClick={() => setLabSheet(true)} />
        </Group>
        <LabPicker bare createWith={q.trim()} value={f.lab} open={labSheet} onOpenChange={setLabSheet} onChange={id => { force(n => n + 1); pickAndGo({ lab: id }); }} />
      </div>
    );
  } else if (step === 'services') {
    page = (
      <div>
        {heading}
        <div className="mt-4 space-y-2.5">
          {f.items.map((it, i) => {
            const miss = itemMissing(it).filter(m => m !== 'material' && m !== 'shade');
            const sum = itemSummary(it);
            return (
              <button key={it.uid} type="button" onClick={() => { setDir(1); setEditing(it.uid); }}
                className="w-full rounded-[22px] bg-go-surface border border-go-line/80 go-card-shadow p-4 text-left flex gap-3 active:scale-[.99] transition">
                <span className="w-8 h-8 rounded-xl go-grad text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-bold text-go-ink truncate">{itemName(it)}</span>
                  {it.teeth.length > 0 && <TeethChips teeth={it.teeth} className="mt-1.5" />}
                  {sum && <span className="block text-[12.5px] text-go-ink2 mt-1.5 truncate">{sum}</span>}
                  <span className="flex items-center gap-1.5 text-[12.5px] text-go-muted mt-1"><CalendarClock className="w-4 h-4 text-go-brand flex-shrink-0" /><span className="truncate">{itemDateSummary(it)}</span></span>
                  {miss.length > 0 && <span className="block text-[12px] font-semibold text-go-warn mt-1">Not set: {miss.join(', ')}</span>}
                </span>
                <ChevronRight className="w-5 h-5 text-go-faint self-center flex-shrink-0" />
              </button>
            );
          })}
          <button type="button" onClick={() => { setDir(1); setAdding(true); setQ(''); }}
            className="w-full h-14 rounded-[22px] border-2 border-dashed border-go-brand/35 text-go-brand text-[14.5px] font-semibold flex items-center justify-center gap-2 active:scale-[.99] transition">
            <PlusCircle className="w-5 h-5" />Add another service
          </button>
          {f.items.length > 1 && <p className="px-1 text-[12.5px] text-go-muted">{f.items.length} services on one case · each has its own delivery date.</p>}
        </div>
      </div>
    );
  } else if (step === 'source') {
    page = (
      <div>
        {heading}
        {/* Order type first — a quick two-way pick — then the longer list of scan sources. */}
        <section className="mb-5">
          <h3 className="px-1 mb-2 text-[12px] font-semibold text-go-muted">Order type</h3>
          <Segmented options={[{ value: 'NHS', label: 'NHS' }, { value: 'Private', label: 'Private' }]} value={f.funding ?? 'NHS'} onChange={v => set({ funding: v as 'NHS' | 'Private' })} />
        </section>
        <Group title="Scans source">
          {CASE_SOURCES.map(s => (
            <Row key={s} lead={<Lead tone="teal">{SOURCE_ICON[s] ?? SOURCE_ICON.Other}</Lead>} title={s}
              sub={s === 'Impressions (By Post)' ? 'Print a label after creating the case' : s === 'Via Scanner' ? 'The scan arrives from your scanner' : undefined}
              selected={f.caseSource === s} onClick={() => set({ caseSource: f.caseSource === s ? null : s })} />
          ))}
        </Group>
      </div>
    );
  } else if (step === 'dentist') {
    const doc = f.clinician ? CLINICIANS.find(c => c.id === f.clinician) : undefined;
    const prac = f.practice ? PRACTICES.find(p => p.id === f.practice) : undefined;
    // One search box per sheet; switching sheet starts it empty.
    const open = (w: 'practice' | 'dentist' | null) => { setQ(''); setWhoSheet(w); };
    const needle = q.trim().toLowerCase();
    const pracs = PRACTICES.filter(p => !needle || `${p.name} ${p.area}`.toLowerCase().includes(needle));
    const docs = CLINICIANS.filter(c => !needle || `${c.name} ${c.gdc}`.toLowerCase().includes(needle));
    const none = (what: string) => <p className="px-2 py-6 text-center text-[13.5px] text-go-muted">No {what} matches “{q.trim()}”.</p>;
    page = (
      <div>
        {heading}
        <Group title={soloPractice ? 'Dentist' : 'Practice and dentist'}>
          {!soloPractice && (
            <Row lead={<Lead tone="brand"><Building2 className="w-5 h-5" /></Lead>} title={prac?.name ?? 'Choose the practice'}
              sub={prac ? prac.area : 'Practice'} chevron onClick={() => open('practice')} />
          )}
          <Row lead={doc ? <Avatar name={doc.name} size={40} /> : <Lead tone="warn"><User className="w-5 h-5" /></Lead>}
            title={doc?.name ?? 'Choose the dentist'} sub={doc ? `GDC ${doc.gdc}` : 'Required'} warn={!doc && tried} chevron onClick={() => open('dentist')} />
        </Group>

        <Sheet open={whoSheet === 'practice'} onClose={() => open(null)} title="Which practice?" sub="Step 1 of 2 · then the dentist">
          <div className="px-4 pb-6">
            <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Practice name or area" /></div>
            {!pracs.length ? none('practice') : (
            <div className="rounded-[22px] bg-go-surface border border-go-line/80 overflow-hidden divide-y divide-go-line/70">
              {pracs.map(p => (
                <Row key={p.id} lead={<Lead tone="brand"><Building2 className="w-5 h-5" /></Lead>} title={p.name} sub={p.area} selected={f.practice === p.id}
                  onClick={() => { set({ practice: p.id }); open(null); window.setTimeout(() => setWhoSheet('dentist'), 280); }} />
              ))}
            </div>
            )}
          </div>
        </Sheet>
        <Sheet open={whoSheet === 'dentist'} onClose={() => open(null)} title="Which dentist?"
          sub={soloPractice ? 'The case is created on behalf of this dentist.' : `Step 2 of 2${prac ? ` · ${prac.name}` : ''}`}>
          <div className="px-4 pb-6">
            <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Dentist name or GDC number" /></div>
            {!docs.length ? none('dentist') : (
            <div className="rounded-[22px] bg-go-surface border border-go-line/80 overflow-hidden divide-y divide-go-line/70">
              {docs.map(c => (
                <Row key={c.id} lead={<Avatar name={c.name} size={40} />} title={c.name} sub={`GDC ${c.gdc}`} selected={f.clinician === c.id}
                  onClick={() => { open(null); pickAndGo({ clinician: c.id }); }} />
              ))}
            </div>
            )}
            {!soloPractice && (
              <button type="button" onClick={() => open('practice')} className="mt-3 h-10 px-1 inline-flex items-center gap-1 text-[13.5px] font-semibold text-go-brand">
                <ChevronLeft className="w-4 h-4" />Change practice
              </button>
            )}
          </div>
        </Sheet>
      </div>
    );
  } else {
    const p = f.patientId ? patientById(f.patientId) : null;
    page = (
      <div>
        {heading}
        <Group title="Case">
          <Row lead={p ? <Avatar name={p.name} size={40} /> : <Lead tone="warn"><User className="w-5 h-5" /></Lead>} title={p?.name ?? 'Add the patient'} sub={p ? `${p.id} · Born ${p.dob}` : 'Required'} warn={!p} chevron onClick={() => go('patient', 'review')} />
          <Row lead={<Lead tone="violet"><FlaskConical className="w-5 h-5" /></Lead>} title={f.lab ? labName(f.lab) : 'Choose the lab'} sub={f.lab ? 'Lab' : 'Required'} warn={!f.lab} chevron onClick={() => go('lab', 'review')} />
          <Row lead={f.clinician ? <Avatar name={clinicianName(f.clinician)} size={40} /> : <Lead tone="warn"><User className="w-5 h-5" /></Lead>} title={f.clinician ? clinicianName(f.clinician) : 'Choose the dentist'}
            sub={f.practice ? practiceName(f.practice) : undefined} chevron onClick={() => go('dentist', 'review')} />
        </Group>
        {match && <MatchNote match={match} />}
        <Group title={`Services · ${f.items.length}`}>
          {f.items.map((it, i) => (
            <Row key={it.uid} lead={<span className="w-8 h-8 rounded-xl go-grad text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>}
              title={<>{itemName(it)}{it.teeth.length > 0 && <span className="font-medium text-go-muted"> · {it.teeth.length > 4 ? `${it.teeth.length} teeth` : it.teeth.join(', ')}</span>}</>}
              sub={[itemSummary(it), itemDateSummary(it)].filter(Boolean).join(' · ')} chevron onClick={() => { go('services', 'review'); setEditing(it.uid); }} />
          ))}
          {!f.items.length && <Row lead={<Lead tone="warn"><PlusCircle className="w-5 h-5" /></Lead>} title="Add a service" sub="Required" warn chevron onClick={() => go('services', 'review')} />}
        </Group>
        <Group title="Order">
          <Row lead={<Lead tone="teal">{SOURCE_ICON[f.caseSource ?? 'Other']}</Lead>} title={f.caseSource ?? 'Scans source'} sub={f.caseSource ? 'Scans source' : 'Not set · optional'} chevron onClick={() => go('source', 'review')} />
          <Row lead={<Lead tone="brand"><FileText className="w-5 h-5" /></Lead>} title={f.funding ?? 'NHS'} sub="Order type" chevron onClick={() => go('source', 'review')} />
        </Group>
        <section className="mt-5">
          <h3 className="px-1 mb-2 text-[12px] font-semibold text-go-muted">Case instructions <span className="text-go-faint font-normal">· optional</span></h3>
          <TextArea rows={3} value={f.instructions} onChange={e => set({ instructions: e.target.value })} placeholder="Anything the lab should know?" />
        </section>
        <section className="mt-5">
          <h3 className="px-1 mb-2 text-[12px] font-semibold text-go-muted">Photos and files <span className="text-go-faint font-normal">· optional</span></h3>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
            onChange={e => { const names = Array.from(e.target.files ?? []).map(x => x.name); if (names.length) set({ attachments: [...f.attachments, ...names] }); e.target.value = ''; }} />
          {f.attachments.length > 0 && (
            <div className="rounded-[22px] bg-go-surface border border-go-line/80 divide-y divide-go-line/70 mb-2.5 overflow-hidden">
              {f.attachments.map(a => (
                <div key={a} className="flex items-center gap-3 px-4 h-12">
                  <Paperclip className="w-4 h-4 text-go-muted" /><span className="flex-1 min-w-0 truncate text-[14px] text-go-ink">{a}</span>
                  <button type="button" onClick={() => set({ attachments: f.attachments.filter(x => x !== a) })} aria-label={`Remove ${a}`} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-go-muted"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          <Btn block variant="secondary" icon={<Paperclip className="w-5 h-5" />} onClick={() => fileRef.current?.click()}>Add a photo or file</Btn>
        </section>
        {f.clinician && <p className="mt-5 px-1 text-[12px] text-go-faint leading-relaxed">Created by {ME.name} on behalf of {clinicianName(f.clinician)} (GDC {CLINICIANS.find(c => c.id === f.clinician)?.gdc}), the prescribing dentist.</p>}
      </div>
    );
  }

  return (
    <Screen header={header} footer={footer}>
      <div key={pageKey} className={cx('px-4', dir === 1 ? 'go-push-in' : 'go-pop-in')}>{page}</div>

      <Sheet open={stepsOpen} onClose={() => setStepsOpen(false)} title="Steps" sub={missing.length ? `Still needed: ${missing.map(s => s.name.toLowerCase()).join(', ')}` : 'Everything needed is in.'}>
        <ol className="space-y-1.5">
          {STEPS.map((s, i) => {
            const done = okOf[s.id] && !!valueOf[s.id];
            const need = !okOf[s.id];
            return (
              <li key={s.id}>
                <button type="button" onClick={() => go(s.id, missing.length ? undefined : 'review')} aria-current={s.id === step ? 'step' : undefined}
                  className={cx('w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition', s.id === step ? 'bg-go-brand-soft' : 'active:bg-go-raised')}>
                  <span className={cx('w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0',
                    done ? 'bg-go-ok text-white' : need ? 'bg-go-warn-soft text-go-warn' : 'bg-go-raised text-go-muted')}>
                    {done ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-go-ink">{s.name}</span>
                    <span className={cx('block text-[12.5px] truncate', need ? 'text-go-warn' : 'text-go-muted')}>{valueOf[s.id] ?? (need ? 'Needed' : s.id === 'review' ? 'Check and send' : 'Optional')}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-go-faint" />
                </button>
              </li>
            );
          })}
        </ol>
      </Sheet>
    </Screen>
  );
}
