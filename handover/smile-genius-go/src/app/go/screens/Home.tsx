// ─── Home — the clinician's day ──────────────────────────────────────────────
// The four statuses the client asked for (Overdue · To dispatch · On hold ·
// Draft) as hero tiles, each opening Lab work filtered to it. No case list
// here. Dates only, no times.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Building2, CalendarClock, Camera, Check, ChevronDown, ChevronRight, Clock, Mic, Pause, PenLine, Plus, Receipt, Truck, XCircle } from '../icons';
import { FilledChatBubble, FilledClock, FilledPackage, FilledTruck } from '../../components/icons/FilledNavIcons';
import { FEATURES, ME, useGo, useScoped } from '../store';
import {
  ATTENTION, Attention, HomeStatus, LabCase, PRACTICES, dayOffset, fmtDate, gbp, initials, invoiceNeedsAction, matchesAttention, patientById,
} from '../data';
import { Card, IconTile, NewWorkSheet, Screen, Sheet, cx } from '../ui';

export function PracticeSwitcher({ inline }: { inline?: boolean }) {
  const { practice, setPractice, cases, soloPractice } = useGo();
  const [open, setOpen] = useState(false);
  // One-practice user: just the practice name, no dropdown
  if (soloPractice) {
    const name = PRACTICES.find(p => p.id === soloPractice)!.name;
    return inline
      ? <span className="text-[22px] font-bold text-go-ink tracking-tight leading-tight">{name}</span>
      : <span className="text-[13px] font-semibold text-go-ink">{name}</span>;
  }
  const label = practice === 'all' ? 'All my practices' : PRACTICES.find(p => p.id === practice)!.name;
  const opts = [{ id: 'all' as const, name: 'All my practices', area: `${PRACTICES.length} practices` }, ...PRACTICES];
  return (
    <>
      {inline ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[22px] font-bold text-go-ink tracking-tight leading-tight text-left">
          {label}<ChevronDown className="w-5 h-5 text-go-brand flex-shrink-0" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-go-surface border border-go-line max-w-[220px]">
          <span className="w-7 h-7 rounded-full bg-go-brand-soft text-go-brand flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4" /></span>
          <span className="text-[13px] font-semibold text-go-ink truncate">{label}</span>
          <ChevronDown className="w-4 h-4 text-go-muted flex-shrink-0" />
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Practice" sub={FEATURES.invoices ? 'Choose which practice’s lab work and invoices to show.' : 'Choose which practice’s lab work to show.'}>
        <div className="space-y-2">
          {opts.map(p => {
            const n = p.id === 'all' ? cases.length : cases.filter(c => c.practice === p.id).length;
            const on = practice === p.id;
            return (
              <button key={p.id} onClick={() => { setPractice(p.id); setOpen(false); }}
                className={cx('w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition', on ? 'border-go-brand bg-go-brand-soft' : 'border-go-line')}>
                <IconTile icon={<Building2 className="w-5 h-5" />} tone={on ? 'brand' : 'neutral'} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold text-go-ink">{p.name}</span>
                  <span className="block text-[12px] text-go-muted">{p.area} · {n} case{n === 1 ? '' : 's'}</span>
                </span>
                {on && <Check className="w-5 h-5 text-go-brand" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}


// ─── One status card ────────────────────────────────────────────────────────
// Status tabs on top; inside, the selected status's cases grouped by delivery date.

const STATUS_STYLE: Record<Attention, { short: string; icon: React.ComponentType<{ className?: string }>; color: string; bar: string }> = {
  overdue: { short: 'Overdue', icon: FilledClock, color: 'text-go-bad', bar: 'bg-go-bad' },
  ready: { short: 'To dispatch', icon: FilledTruck, color: 'text-go-warn', bar: 'bg-go-warn' },
  'on-hold': { short: 'On hold', icon: Pause, color: 'text-go-violet', bar: 'bg-go-violet' },
  draft: { short: 'Draft', icon: PenLine, color: 'text-go-muted', bar: 'bg-go-faint' },
  arriving: { short: 'Arriving', icon: FilledPackage, color: 'text-go-brand', bar: 'bg-go-brand' },
  questions: { short: 'Info required', icon: FilledChatBubble, color: 'text-go-pink', bar: 'bg-go-pink' },
  'not-approved': { short: 'Not approved', icon: XCircle, color: 'text-go-bad', bar: 'bg-go-bad' },
  'date-changed': { short: 'Date changed', icon: CalendarClock, color: 'text-go-warn', bar: 'bg-go-warn' },
};

// Invoices strip (switched off for now). Latest comments was removed on 8 Oct.

const subhead = (t: string) => <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted px-1 mb-2">{t}</h2>;

/** Open invoices · total · approved this month (portal: Financial actions). */
function FinanceStrip() {
  const navigate = useNavigate();
  const { invoices } = useScoped();
  const open = invoices.filter(i => invoiceNeedsAction(i.status));
  const total = (xs: typeof invoices) => xs.reduce((s, i) => s + i.net + i.vat, 0);
  const approved = invoices.filter(i => i.status === 'approved' || i.status === 'xero');
  return (
    <Card onClick={() => navigate('/go/invoices')} className="p-3.5 flex items-center gap-3">
      <IconTile icon={<Receipt className="w-5 h-5" />} tone="brand" size="sm" />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-go-ink"><span className="tabular-nums">{open.length}</span> invoice{open.length === 1 ? "" : "s"} to review</span>
        <span className="block text-[11.5px] text-go-muted truncate">{gbp(total(open))} to settle · {gbp(total(approved))} approved</span>
      </span>
      <ChevronRight className="w-4 h-4 text-go-faint flex-shrink-0" />
    </Card>
  );
}



// ─── The four status tiles ──────────────────────────────────────────────────
// Overdue · To dispatch · On hold · Draft as hero tiles: tinted gradient,
// glossy icon chip, big count, label and the patients' initials (no sub-text;
// lateness shows on each case's pill in Lab work). A tile opens Lab work filtered to it.
// Only statuses with work show. 1 → one wide tile, 2 → a pair, 3 → the most
// urgent wide on top + a pair, 4 → 2×2.
// Full class strings per status so Tailwind picks them up.

type HeroStatus = HomeStatus;
/** Tile order: the client's four, then not approved (rejected by lab) and delivery date changed. */
// (order comes from the store: dashOrder, set in Account › Dashboard)
// Chip = glossy gradient icon (.go-chip-* in go.css); one consistent filled icon set.
const HERO: Record<HeroStatus, { wash: string; ring: string; chip: string; glow: string; count: string; icon: React.ComponentType<{ className?: string }> }> = {
  overdue: { icon: Clock, wash: 'from-go-bad-soft', ring: 'border-go-bad/25', chip: 'go-chip-overdue', glow: 'bg-go-bad/30', count: 'text-go-bad' },
  ready: { icon: Truck, wash: 'from-go-warn-soft', ring: 'border-go-warn/25', chip: 'go-chip-ready', glow: 'bg-go-warn/30', count: 'text-go-warn' },
  'on-hold': { icon: Pause, wash: 'from-go-violet-soft', ring: 'border-go-violet/25', chip: 'go-chip-hold', glow: 'bg-go-violet/30', count: 'text-go-violet' },
  draft: { icon: PenLine, wash: 'from-go-brand-soft', ring: 'border-go-brand/25', chip: 'go-chip-draft', glow: 'bg-go-brand/30', count: 'text-go-brand' },
  'not-approved': { icon: XCircle, wash: 'from-go-pink-soft', ring: 'border-go-pink/25', chip: 'go-chip-rejected', glow: 'bg-go-pink/30', count: 'text-go-pink' },
  'date-changed': { icon: CalendarClock, wash: 'from-go-teal-soft', ring: 'border-go-teal/25', chip: 'go-chip-date', glow: 'bg-go-teal/30', count: 'text-go-teal' },
};

/** The status's glossy icon chip + short label — reused by Account › Dashboard. */
export function StatusChip({ id, size = 36 }: { id: HomeStatus; size?: number }) {
  const Icon = HERO[id].icon;
  return (
    <span className={cx('go-chip flex items-center justify-center flex-shrink-0', HERO[id].chip)} style={{ width: size, height: size, borderRadius: size * 0.36 }}>
      <Icon className="w-1/2 h-1/2" />
    </span>
  );
}
export const statusShort = (id: HomeStatus) => STATUS_STYLE[id].short;

function Faces({ list }: { list: LabCase[] }) {
  const n = list.length;
  const dot = 'w-7 h-7 rounded-full bg-go-raised border border-go-line ring-2 ring-go-surface text-[9.5px] font-bold flex items-center justify-center';
  return (
    <span className="flex -space-x-1">
      {list.slice(0, 3).map(c => <span key={c.id} className={cx(dot, 'text-go-ink2')}>{initials(patientById(c.patientId).name)}</span>)}
      {n > 3 && <span className={cx(dot, 'text-go-muted')}>+{n - 3}</span>}
    </span>
  );
}

function StatusTile({ id, list, wide }: { id: HeroStatus; list: LabCase[]; wide?: boolean }) {
  const navigate = useNavigate();
  const a = ATTENTION.find(x => x.id === id)!;
  const st = STATUS_STYLE[id];
  const h = HERO[id];
  const Icon = h.icon;
  const n = list.length;
  const shell = cx('relative w-full h-full overflow-hidden text-left rounded-[24px] border bg-gradient-to-br to-go-surface go-card-shadow active:scale-[.98] transition', h.wash, h.ring);
  const deco = (
    <>
      {/* Soft corner glow + oversized watermark icon */}
      <span className={cx('pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl', h.glow)} />
      <Icon className={cx('pointer-events-none absolute -bottom-3 -right-3 w-20 h-20 opacity-[0.07]', h.count)} />
    </>
  );
  const label = (
    <span className="relative flex items-center gap-1">
      <span className="text-[13.5px] font-semibold text-go-ink">{st.short}</span>
      <ChevronRight className="w-3.5 h-3.5 text-go-faint" />
    </span>
  );

  if (wide) {
    return (
      <button onClick={() => navigate(`/go/work?f=${id}`)} aria-label={`${a.label}: ${n}`} className={cx(shell, 'flex items-center gap-3.5 p-4')}>
        {deco}
        <span className={cx('go-chip w-12 h-12 rounded-[16px] flex items-center justify-center flex-shrink-0', h.chip)}>
          <Icon className="w-6 h-6" />
        </span>
        <span className="relative flex-1 min-w-0">
          {label}
          <span className="block mt-2"><Faces list={list} /></span>
        </span>
        <span className="relative text-[44px] font-bold tabular-nums leading-none tracking-tight text-go-ink pr-1">{n}</span>
      </button>
    );
  }
  return (
    <button onClick={() => navigate(`/go/work?f=${id}`)} aria-label={`${a.label}: ${n}`} className={cx(shell, 'p-3.5 pb-3')}>
      {deco}
      <span className="relative flex items-center justify-between">
        <span className={cx('go-chip w-10 h-10 rounded-[14px] flex items-center justify-center', h.chip)}>
          <Icon className="w-5 h-5" />
        </span>
        <Faces list={list} />
      </span>
      <span className="relative block text-[34px] font-bold tabular-nums leading-none tracking-tight mt-3 text-go-ink">{n}</span>
      <span className="block mt-1.5">{label}</span>
    </button>
  );
}

function StatusTiles({ cases }: { cases: LabCase[] }) {
  const { dashOrder } = useGo();
  const live = dashOrder
    .map(id => ({ id, list: cases.filter(c => matchesAttention(c, id)) }))
    .filter(x => x.list.length > 0);
  if (!live.length) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <IconTile icon={<Check className="w-5 h-5" strokeWidth={2.5} />} tone="ok" size="sm" />
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-go-ink">All clear</span>
          <span className="block text-[12px] text-go-muted">Nothing needs your attention right now.</span>
        </span>
      </Card>
    );
  }
  // With 1 or 3 statuses the first (most urgent) spans the full width
  const wideFirst = live.length % 2 === 1;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {live.map((x, i) => {
        const wide = wideFirst && i === 0;
        return (
          <div key={x.id} className={cx('go-rise min-w-0', wide && 'col-span-2')} style={{ animationDelay: `${i * 50}ms` }}>
            <StatusTile id={x.id} list={x.list} wide={wide} />
          </div>
        );
      })}
    </div>
  );
}

/** Brand-new practice: no lab work at all yet. One clear way in. */
function EmptyHome() {
  const [open, setOpen] = useState(false);
  const ways = [
    { icon: Mic, label: 'By audio', tone: 'text-go-pink' },
    { icon: Camera, label: 'By photo', tone: 'text-go-brand' },
    { icon: PenLine, label: 'Manually', tone: 'text-go-violet' },
  ];
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="go-rise relative w-full overflow-hidden text-left rounded-[28px] border border-go-brand/25 bg-gradient-to-br from-go-brand-soft via-go-surface to-go-violet-soft go-card-shadow p-5 active:scale-[.99] transition">
        <span className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-go-lav/30 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-go-brand/20 blur-3xl" />
        <span className="relative w-14 h-14 rounded-[20px] go-grad go-glow text-white flex items-center justify-center">
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </span>
        <span className="relative flex items-center gap-1.5 mt-0.5">
          <span className="text-[22px] font-bold text-go-ink tracking-tight leading-tight">Create your lab work</span>
          <ChevronRight className="w-5 h-5 text-go-brand" />
        </span>
        <span className="relative block text-[13px] text-go-ink2 mt-1 leading-snug">Speak, take a photo of the paper form, or fill it in. Your cases will appear here.</span>
        <span className="relative flex gap-2 mt-4">
          {ways.map(w => (
            <span key={w.label} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-go-surface/80 border border-go-line text-[12px] font-semibold text-go-ink2">
              <w.icon className={cx('w-4 h-4', w.tone)} />{w.label}
            </span>
          ))}
        </span>
      </button>
      <NewWorkSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}


// ─── Screen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigate = useNavigate();
  const { notices } = useGo();
  const { cases } = useScoped();
  const unread = notices.filter(n => !n.read).length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen tabs>
      <div className="relative">
        <div className="relative flex items-start justify-between gap-3 px-5 pt-3">
          <div className="min-w-0">
            {/* Small greeting on top; the practice is the headline (and the switcher) */}
            <p className="text-[12.5px] text-go-muted">
              {greet}, <span className="font-semibold text-go-ink2">{ME.first}</span> · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
            <h1 className="mt-0.5"><PracticeSwitcher inline /></h1>
          </div>
          <button onClick={() => navigate('/go/notifications')} aria-label="Notifications"
            className="relative w-10 h-10 rounded-full bg-go-surface border border-go-line flex items-center justify-center text-go-ink flex-shrink-0">
            <Bell className="w-5 h-5" />
            {!!unread && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-go-bad ring-2 ring-go-surface" />}
          </button>
        </div>
      </div>

      {!cases.length ? (
        <div className="px-4 mt-5"><EmptyHome /></div>
      ) : (
        <>
          <div className="px-4 mt-4"><StatusTiles cases={cases} /></div>
          {/* Switched off for now (FEATURES.invoices) */}
          {FEATURES.invoices && <div className="px-4 mt-5">{subhead('Invoices')}<FinanceStrip /></div>}
        </>
      )}
    </Screen>
  );
}
