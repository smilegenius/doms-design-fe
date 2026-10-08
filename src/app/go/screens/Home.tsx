// ─── Home — the clinician's day ──────────────────────────────────────────────
// One card: the four statuses the client asked for (Overdue · To dispatch ·
// On hold · Draft) as tabs, with the selected status's cases broken down by
// delivery date. Dates only, no times.
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Building2, CalendarClock, Check, ChevronDown, ChevronRight, MessageSquare, Pause, PenLine, Receipt, XCircle } from '../icons';
import { FilledChatBubble, FilledClock, FilledPackage, FilledTruck } from '../../components/icons/FilledNavIcons';
import { ME, useGo, useScoped } from '../store';
import {
  ATTENTION, Attention, LabCase, PRACTICES, dayOffset, fmtDate, gbp, invoiceNeedsAction, labName, matchesAttention, patientById, shortName,
} from '../data';
import { Card, IconTile, Screen, Sheet, cx } from '../ui';

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
      <Sheet open={open} onClose={() => setOpen(false)} title="Practice" sub="Choose which practice’s lab work and invoices to show.">
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

// ─── Below the card: the portal's other dashboard stats ─────────────────────
// Always shown (even at 0) so Home is never empty when the four statuses are clear.

const subhead = (t: string) => <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted px-1 mb-2">{t}</h2>;

/** Not approved (rejected by lab) · Delivery date changed (needs review). */
function MoreStatuses({ cases }: { cases: LabCase[] }) {
  const navigate = useNavigate();
  const items = (['not-approved', 'date-changed'] as Attention[]).map(id => ({
    a: ATTENTION.find(x => x.id === id)!, n: cases.filter(c => matchesAttention(c, id)).length,
  }));
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ a, n }) => {
        const st = STATUS_STYLE[a.id];
        const Icon = st.icon;
        return (
          <button key={a.id} onClick={() => navigate(`/go/work?f=${a.id}`)} aria-label={`${a.label}: ${n}`}
            className={cx('text-left rounded-[20px] border bg-go-surface p-3.5 active:scale-[0.98] transition',
              n && a.id === 'not-approved' ? 'border-go-bad/40' : 'border-go-line')}>
            <span className="flex items-center justify-between">
              <span className="text-[22px] font-bold tabular-nums leading-none text-go-ink">{n}</span>
              <Icon className={cx('w-5 h-5', n ? st.color : 'text-go-faint')} />
            </span>
            <span className="block text-[12.5px] font-semibold text-go-ink mt-2">{a.short}</span>
            <span className="block text-[11px] text-go-muted">{a.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

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

/** Latest lab comments across cases (portal: Unread messages). */
function LatestComments({ cases }: { cases: LabCase[] }) {
  const navigate = useNavigate();
  const latest = cases.flatMap(c => {
    const m = c.messages[c.messages.length - 1];
    return m && m.from === 'lab' ? [{ c, m }] : [];
  }).sort((x, y) => y.m.at.localeCompare(x.m.at)).slice(0, 3);
  if (!latest.length) {
    return (
      <Card className="p-4 flex items-center gap-3">
        <IconTile icon={<MessageSquare className="w-5 h-5" />} tone="neutral" size="sm" />
        <span className="text-[13px] text-go-muted">You’re all caught up. No new comments.</span>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-go-line">
      {latest.map(({ c, m }) => (
        <button key={c.id} onClick={() => navigate(`/go/work/${c.id}?tab=messages`)} className="w-full flex items-start gap-3 p-3.5 text-left">
          <IconTile icon={<MessageSquare className="w-4 h-4" />} tone="pink" size="sm" />
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="flex-1 text-[13px] font-semibold text-go-ink truncate">{labName(c.lab)}</span>
              <span className="text-[11px] text-go-faint flex-shrink-0">{fmtDate(m.at)}</span>
            </span>
            <span className="block text-[11.5px] text-go-muted truncate">{shortName(patientById(c.patientId).name)} · {c.id}</span>
            <span className="block text-[12.5px] text-go-ink2 mt-0.5 line-clamp-2">{m.text}</span>
          </span>
        </button>
      ))}
    </Card>
  );
}


/** "Today", "Tomorrow", "2 days late" — next to the date in each group header. */
function dayTag(iso: string, late: boolean) {
  const d = dayOffset(iso);
  if (late && d < 0) return `${-d} day${d === -1 ? '' : 's'} late`;
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 0 ? `In ${d} days` : `${-d} days ago`;
}

/** Patient · service, then status · lab · appointment. */
function CaseRow({ c, status }: { c: LabCase; status: Attention }) {
  const navigate = useNavigate();
  const st = STATUS_STYLE[status];
  const label = c.onHold ? `On hold (${c.onHold.side})` : st.short;
  const sub = [c.lab ? labName(c.lab) : null, c.appointment ? `${c.appointment.kind} ${fmtDate(c.appointment.at)}` : null].filter(Boolean).join(' · ');
  return (
    <button onClick={() => navigate(c.stage === 'draft' ? `/go/new/manual?draft=${c.id}` : `/go/work/${c.id}`)}
      className="w-full flex items-center gap-3 px-1 py-2 rounded-xl text-left hover:bg-go-raised transition">
      <span className={cx('w-1 h-8 rounded-full flex-shrink-0', st.bar)} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-go-ink truncate">
          {shortName(patientById(c.patientId).name)} <span className="font-normal text-go-muted">· {c.service}{c.items?.length ? ` +${c.items.length}` : ''}</span>
        </span>
        <span className="block text-[11.5px] text-go-muted truncate">
          <span className={cx('font-semibold', st.color)}>{label}</span>{sub ? ` · ${sub}` : ''}
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-go-faint flex-shrink-0" />
    </button>
  );
}

function StatusBoard({ cases }: { cases: LabCase[] }) {
  // null = all four statuses together; tapping a status filters to it (tap again for all)
  const [selId, setSel] = useState<Attention | null>(null);
  // The card is capped at 60% of the phone screen; its list scrolls inside so the
  // sections below stay in view.
  const cardRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [listMax, setListMax] = useState<number>();
  useLayoutEffect(() => {
    const screen = cardRef.current?.closest('.go-scroll') as HTMLElement | null;
    if (!screen) return;
    const fit = () => setListMax(Math.round(screen.clientHeight * 0.6 - (tabsRef.current?.offsetHeight ?? 0)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(screen);
    return () => ro.disconnect();
  }, [cases.length]);
  // Only statuses with something in them; the rest share the width evenly.
  const live = ATTENTION.filter(a => a.home)
    .map(a => ({ a, list: cases.filter(c => matchesAttention(c, a.id)) }))
    .filter(x => x.list.length > 0);
  if (!live.length) {
    return (
      <Card className="p-5 text-center">
        <p className="text-[14px] font-semibold text-go-ink">All clear</p>
        <p className="text-[12.5px] text-go-muted mt-0.5">Nothing overdue, to dispatch, on hold or in draft.</p>
      </Card>
    );
  }
  const sel = live.find(x => x.a.id === selId) ?? null;

  // Each case once, under its first status in the client's order
  const rows: { c: LabCase; status: Attention }[] = [];
  for (const { a, list } of sel ? [sel] : live) for (const c of list) if (!rows.some(r => r.c.id === c.id)) rows.push({ c, status: a.id });
  // Group by delivery date, earliest first
  rows.sort((x, y) => (x.c.returnBy || '9').localeCompare(y.c.returnBy || '9'));
  const groups: { key: string; iso: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const key = r.c.returnBy ? new Date(r.c.returnBy).toDateString() : 'none';
    const g = groups.find(x => x.key === key);
    if (g) g.items.push(r); else groups.push({ key, iso: r.c.returnBy, items: [r] });
  }

  return (
    <div ref={cardRef}><Card className="overflow-hidden">
      {/* Status filters: icon + count, short label */}
      <div ref={tabsRef} role="tablist" className="grid divide-x divide-go-line border-b border-go-line" style={{ gridTemplateColumns: `repeat(${live.length}, minmax(0, 1fr))` }}>
        {live.map(({ a, list }) => {
          const st = STATUS_STYLE[a.id];
          const Icon = st.icon;
          const on = sel?.a.id === a.id;
          return (
            <button key={a.id} role="tab" aria-selected={on} aria-label={`${a.label}: ${list.length}`}
              onClick={() => setSel(on ? null : a.id)}
              className={cx('relative flex flex-col items-center gap-1 px-1 pt-3 pb-2.5 transition', on ? 'bg-go-raised' : 'active:scale-95', sel && !on && 'opacity-55')}>
              <span className="flex items-center gap-1.5">
                <Icon className={cx('w-[18px] h-[18px]', st.color)} />
                <span className="text-[20px] font-bold tabular-nums leading-none text-go-ink">{list.length}</span>
              </span>
              <span className={cx('text-[11px] whitespace-nowrap', on ? 'font-semibold text-go-ink' : 'font-medium text-go-muted')}>{st.short}</span>
              {on && <span className={cx('absolute bottom-0 inset-x-3 h-0.5 rounded-full', st.bar)} />}
            </button>
          );
        })}
      </div>

      {/* Breakdown by delivery date */}
      <div className="go-scroll overflow-y-auto overscroll-contain px-3 pb-2.5" style={{ maxHeight: listMax }}>
        {groups.map(g => {
          const past = !!g.iso && dayOffset(g.iso) < 0;
          return (
            <div key={g.key}>
              {/* Date header sticks while its cases scroll under it */}
              <p className="sticky top-0 z-[1] bg-go-surface pt-2.5 pb-0.5 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-go-muted">
                <span>{g.iso ? fmtDate(g.iso) : 'No delivery date'}</span>
                {g.iso && <span className={cx('normal-case tracking-normal font-semibold', past ? 'text-go-bad' : 'text-go-faint')}>{dayTag(g.iso, past)}</span>}
              </p>
              <div className="-mx-1">{g.items.map(r => <CaseRow key={r.c.id} c={r.c} status={r.status} />)}</div>
            </div>
          );
        })}
      </div>
    </Card></div>
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
        <div className="absolute -top-28 -right-16 w-72 h-72 rounded-full bg-go-lav/20 blur-3xl pointer-events-none" />
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

      <div className="px-4 mt-4"><StatusBoard cases={cases} /></div>
      <div className="px-4 mt-5">{subhead('Also needs a look')}<MoreStatuses cases={cases} /></div>
      <div className="px-4 mt-5">{subhead('Invoices')}<FinanceStrip /></div>
      <div className="px-4 mt-5 mb-2">{subhead('Latest comments')}<LatestComments cases={cases} /></div>
    </Screen>
  );
}
