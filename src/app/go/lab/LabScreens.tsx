// ─── Smile Genius Go · Lab version ───────────────────────────────────────────
// The app for the lab side, mounted at /go/lab/*. Northstar Dental Lab receives
// cases from several practices, accepts them, moves them through production and
// sends them back. There is no practice switcher: the lab is always Northstar,
// and a case the lab creates is always for Northstar.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Bell, Building2, Filter, X, CalendarClock, Check, CheckCircle2, ChevronRight, ClipboardCheck, Clock, FileText, FlaskConical, Home, Image as ImageIcon, Inbox, Layers, LogOut, MessageSquare, PackageCheck, Paperclip, Pause, PenLine, Plus, Search, Send, Truck, User,
} from '../icons';
import { useGo } from '../store';
import {
  COURIERS, CLINICIANS, LabCase, PRACTICES, PracticeId, SERVICE_CATEGORIES, allItems, caseTitle, clinicianName, dayOffset, fmtDate, fmtDateTime, initials, itemIdForLabel, patientById, practiceName, relDay, serviceLabel, shortName,
} from '../data';
import {
  Avatar, Btn, Card, Chips, EmptyState, IconTile, Input, KV, Label, PickerField, Pill, Screen, SearchBox, Section, Segmented, Sheet, TeethChips, TextArea, Tone, TopBar, cx,
} from '../ui';
import { PatientPicker } from '../screens/ManualCase';
import { LiteCreate } from '../lite/LiteScreens';
import { HERO } from '../screens/Home';
import {
  LAB_BASE, LAB_STATUS_CHOICES, NOTIFIES_CLINIC, OVERRIDE_REASONS, labLabel, missingInfo, needsOverride, LAB_FILTERS, LAB_ID, LAB_ME, LAB_NAME, LabFilter, byDue, isClosed, isLabCase, matchesLab, needsReason, shipPatch, statusOf, statusPatch, waitingAccept, waitingShip,
} from './labData';
import type { LabStatus } from '../data';

const iso = (d: string) => new Date(`${d}T12:00`).toISOString();
const ymd = (isoStr: string) => (isoStr ? isoStr.slice(0, 10) : '');

/** Every case on the lab's side (not the practices' own drafts), soonest due first. */
function useLabCases() {
  const { cases } = useGo();
  return useMemo(() => cases.filter(isLabCase).sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)) || byDue(a, b)), [cases]);
}

const shipText = (c: LabCase) => [c.labShipment?.courier, c.labShipment?.tracking].filter(Boolean).join(' · ') || 'No shipping details given';

const STATUS_TONE: Record<string, Tone> = {
  Draft: 'neutral', Received: 'brand', 'Under Review': 'brand', Accepted: 'teal', 'In Queue': 'violet', 'In Production': 'violet', 'Quality Control': 'violet',
  Shipped: 'ok', Delivered: 'ok', 'On Hold (Lab)': 'warn', 'On Hold (Practice)': 'warn', 'Not Approved': 'bad', Cancelled: 'neutral',
};
export const StatusPill = ({ c }: { c: LabCase }) => <Pill tone={STATUS_TONE[statusOf(c)] ?? 'neutral'} dot>{labLabel(statusOf(c))}</Pill>;

/** "3 days late", "Due tomorrow", "No due date". */
function dueText(c: LabCase) {
  if (!c.returnBy) return { text: 'No due date', bad: false };
  const n = dayOffset(c.returnBy);
  if (!isClosed(c) && c.stage !== 'draft' && n < 0) return { text: `${-n} day${n === -1 ? '' : 's'} late`, bad: true };
  return { text: n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due ${fmtDate(c.returnBy)}`, bad: false };
}

// ─── Tab bar ────────────────────────────────────────────────────────────────

export function LabTabBar() {
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const cases = useLabCases();
  const todo = cases.filter(waitingAccept).length + cases.filter(waitingShip).length;
  const tabs = [
    { to: `${LAB_BASE}/home`, label: 'Home', icon: Home },
    { to: `${LAB_BASE}/deliveries`, label: 'Shipping', icon: Truck, badge: todo },
    null,
    { to: `${LAB_BASE}/cases`, label: 'Cases', icon: Layers },
    { to: `${LAB_BASE}/account`, label: 'Me', icon: User },
  ];
  return (
    <nav className="go-tabbar absolute bottom-0 inset-x-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 pointer-events-none">
      <div className="pointer-events-auto relative flex items-center justify-around h-16 rounded-[26px] bg-go-surface/80 backdrop-blur-2xl border border-go-line go-card-shadow">
        {tabs.map(t => {
          if (!t) {
            return (
              <button key="new" onClick={() => navigate(`${LAB_BASE}/new`)} aria-label="Create a case"
                className="-mt-7 w-14 h-14 rounded-[20px] go-grad go-glow text-white flex items-center justify-center active:scale-95 transition ring-4 ring-go-bg">
                <Plus className="w-6 h-6" strokeWidth={2.5} />
              </button>
            );
          }
          const active = path.startsWith(t.to);
          const Icon = t.icon;
          return (
            <button key={t.to} onClick={() => navigate(t.to)} className="relative flex-1 flex flex-col items-center gap-0.5 py-1">
              <span className={cx('relative flex items-center justify-center w-10 h-7 rounded-full transition', active && 'bg-go-brand-soft')}>
                <Icon className={cx('w-[20px] h-[20px] transition', active ? 'text-go-brand' : 'text-go-muted')} />
                {!!t.badge && <span className="absolute -top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-go-bad text-white text-[9px] font-bold flex items-center justify-center">{t.badge}</span>}
              </span>
              <span className={cx('text-[10px] font-semibold', active ? 'text-go-brand' : 'text-go-muted')}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
const TABS = <LabTabBar />;

// ─── Case row ───────────────────────────────────────────────────────────────

function CaseRow({ c, onClick, action }: { c: LabCase; onClick?: () => void; action?: React.ReactNode }) {
  const p = patientById(c.patientId);
  const due = dueText(c);
  return (
    <Card className="p-3.5">
      <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={e => { if (onClick && e.key === 'Enter') onClick(); }}
        className={cx('flex items-center gap-3', onClick && 'cursor-pointer')}>
        <span className="w-10 h-10 rounded-full bg-go-brand-soft text-go-brand-ink text-[12px] font-bold flex items-center justify-center flex-shrink-0">{initials(p.name)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-go-ink truncate">{p.name} <span className="font-mono text-[11.5px] text-go-faint font-medium">{c.id}</span></p>
          <p className="text-[12.5px] text-go-ink2 truncate">{caseTitle(c)}</p>
          <p className="text-[12px] text-go-muted truncate">{practiceName(c.practice)} · {clinicianName(c.clinician)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusPill c={c} />
          <span className={cx('text-[11.5px] font-medium', due.bad ? 'text-go-bad' : 'text-go-muted')}>{due.text}</span>
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

// ─── Home (dashboard) ───────────────────────────────────────────────────────
// Same look as the clinic Home: the clinic's hero tiles (only statuses with work), a create card above.

/** One colour per meaning: teal = incoming, blue = accept / drafts, orange = ready to ship, red = overdue (nothing else is red or pink), violet = waiting or paused, teal calendar = no date. */
const LAB_HERO: Record<LabFilter, (typeof HERO)['draft']> = {
  new: { ...HERO['date-changed'], icon: Inbox },
  draft: { ...HERO.draft, icon: PenLine },
  accept: { ...HERO.draft, icon: ClipboardCheck },
  ship: { ...HERO.ready, icon: Truck },
  due3: { ...HERO['on-hold'], icon: Clock },
  nodate: { ...HERO['date-changed'], icon: CalendarClock },
  overdue: { ...HERO.overdue, icon: AlertTriangle },
  hold: { ...HERO['on-hold'], icon: Pause },
};

/** Where a dashboard card goes: shipping and accepting work open the Shipping page (on the right tab, filtered); the rest open Cases. */
const homeTarget = (id: LabFilter) => {
  if (id === 'new' || id === 'accept') return `${LAB_BASE}/deliveries?f=${id}`;
  if (id === 'ship') return `${LAB_BASE}/deliveries?tab=ship`;
  if (id === 'overdue' || id === 'due3') return `${LAB_BASE}/deliveries?tab=ship&f=${id}`;
  return `${LAB_BASE}/cases?f=${id}`;
};

/** Dashboard sections: new work coming in and work to ship (small cards), then what just needs sorting (a short list). */
const LAB_GROUPS: { title: string; ids: LabFilter[]; cards: boolean }[] = [
  { title: 'New work', ids: ['new', 'accept'], cards: true },
  { title: 'To ship', ids: ['ship', 'overdue', 'due3'], cards: true },
  { title: 'Needs attention', ids: ['nodate', 'hold', 'draft'], cards: false },
];

/** The clinic's hero tile, smaller: chip, count and a one-line label, so the five cards fit without scrolling. */
function MiniTile({ h, label, n, wide, onClick }: { h: (typeof HERO)['draft']; label: string; n: number; wide?: boolean; onClick: () => void }) {
  const Icon = h.icon;
  const shell = cx('relative w-full overflow-hidden text-left rounded-[20px] border bg-gradient-to-br to-go-surface go-card-shadow active:scale-[.98] transition', h.wash, h.ring);
  const deco = <span className={cx('pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl', h.glow)} />;
  const chip = <span className={cx('go-chip w-8 h-8 rounded-[11px] flex items-center justify-center flex-shrink-0', h.chip)}><Icon className="w-4 h-4" /></span>;
  if (wide) {
    return (
      <button onClick={onClick} aria-label={`${label}: ${n}`} className={cx(shell, 'h-[58px] flex items-center gap-3 px-3.5')}>
        {deco}<span className="relative">{chip}</span>
        <span className="relative flex-1 min-w-0 truncate text-[13px] font-semibold text-go-ink">{label}</span>
        <span className="relative text-[22px] font-bold tabular-nums leading-none text-go-ink">{n}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} aria-label={`${label}: ${n}`} className={cx(shell, 'h-[78px] px-3 py-2.5 flex flex-col justify-between')}>
      {deco}
      <span className="relative flex items-center justify-between">{chip}<span className="text-[22px] font-bold tabular-nums leading-none text-go-ink">{n}</span></span>
      <span className="relative truncate text-[13px] font-semibold text-go-ink">{label}</span>
    </button>
  );
}

export function LabHome() {
  const navigate = useNavigate();
  const cases = useLabCases();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const live = LAB_FILTERS.map(f => ({ f, list: cases.filter(c => matchesLab(c, f.id)) })).filter(x => x.list.length > 0);
  return (
    <Screen tabs={TABS}>
      <div className="flex items-start justify-between gap-3 px-5 pt-3">
        <div className="min-w-0">
          <p className="text-[12.5px] text-go-muted">
            {greet}, <span className="font-semibold text-go-ink2">{LAB_ME.first}</span> · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <h1 className="mt-0.5 text-[22px] font-bold text-go-ink tracking-tight leading-tight">{LAB_NAME}</h1>
        </div>
        <button onClick={() => navigate(`${LAB_BASE}/notifications`)} aria-label="Notifications"
          className="relative w-10 h-10 rounded-full bg-go-surface border border-go-line flex items-center justify-center text-go-ink flex-shrink-0">
          <Bell className="w-5 h-5" />
          {labNotices(cases).some(n => n.unread) && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-go-bad ring-2 ring-go-surface" />}
        </button>
      </div>

      <div className="px-4 mt-4">
        <button onClick={() => navigate(`${LAB_BASE}/new`)}
          className="go-rise relative w-full overflow-hidden text-left rounded-[24px] border border-go-brand/25 bg-gradient-to-br from-go-brand-soft via-go-surface to-go-violet-soft go-card-shadow p-4 flex items-center gap-3.5 active:scale-[.99] transition">
          <span className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-go-lav/30 blur-3xl" />
          <span className="relative w-12 h-12 rounded-[16px] go-grad go-glow text-white flex items-center justify-center flex-shrink-0"><Plus className="w-6 h-6" strokeWidth={2.5} /></span>
          <span className="relative flex-1 min-w-0">
            <span className="block text-[17px] font-bold text-go-ink tracking-tight leading-tight">Create a case</span>
            <span className="block text-[12.5px] text-go-ink2 mt-0.5 leading-snug">Scan the prescription. We’ll fill in the details.</span>
          </span>
          <ChevronRight className="relative w-5 h-5 text-go-brand flex-shrink-0" />
        </button>
      </div>

      <div className="px-4 mt-3">
        {live.length ? (
          <div className="space-y-3">
            {LAB_GROUPS.map(g => {
              const rows = g.ids.map(id => ({ f: LAB_FILTERS.find(x => x.id === id)!, list: cases.filter(c => matchesLab(c, id)) })).filter(x => x.list.length > 0);
              if (!rows.length) return null;
              const wideFirst = rows.length % 2 === 1;
              return (
                <section key={g.title}>
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted px-1 mb-1.5">{g.title}</h2>
                  {g.cards ? (
                    // Small cards (the first spans the width when the count is odd)
                    <div className="grid grid-cols-2 gap-2.5">
                      {rows.map(({ f, list }, i) => {
                        const wide = wideFirst && i === 0;
                        return (
                          <div key={f.id} className={cx('go-rise min-w-0', wide && 'col-span-2')} style={{ animationDelay: `${i * 50}ms` }}>
                            <MiniTile h={LAB_HERO[f.id]} label={f.label} n={list.length} wide={wide} onClick={() => navigate(homeTarget(f.id))} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // The rest: one calm line each
                    <Card className="divide-y divide-go-line overflow-hidden">
                      {rows.map(({ f, list }) => {
                        const h = LAB_HERO[f.id];
                        const Icon = h.icon;
                        return (
                          <button key={f.id} onClick={() => navigate(homeTarget(f.id))} aria-label={`${f.label}: ${list.length}`}
                            className="w-full h-11 flex items-center gap-3 px-3 text-left hover:bg-go-raised active:bg-go-raised transition">
                            <span className={cx('go-chip w-8 h-8 rounded-[11px] flex items-center justify-center flex-shrink-0', h.chip)}><Icon className="w-4 h-4" /></span>
                            <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-go-ink">{f.label}</span>
                            <span className="text-[22px] font-bold tabular-nums leading-none text-go-ink">{list.length}</span>
                            <ChevronRight className="w-4 h-4 text-go-faint flex-shrink-0 -ml-1" />
                          </button>
                        );
                      })}
                    </Card>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <Card className="p-4 flex items-center gap-3">
            <IconTile icon={<Check className="w-5 h-5" strokeWidth={2.5} />} tone="ok" size="sm" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-go-ink">All clear</span>
              <span className="block text-[12px] text-go-muted">Nothing needs your attention right now.</span>
            </span>
          </Card>
        )}
      </div>
    </Screen>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────
// Built from the shared cases: new cases to accept, overdue work and comments from practices.

interface LabNotice { id: string; title: string; body: string; at: string; to: string; unread: boolean; icon: React.ReactNode; tone: Tone }
function labNotices(cases: LabCase[]): LabNotice[] {
  const out: LabNotice[] = [];
  for (const c of cases) {
    const who = `${practiceName(c.practice)} · ${patientById(c.patientId).name}`;
    const to = `${LAB_BASE}/cases/${c.id}`;
    const sentAt = c.events.find(e => e.stage === 'dispatched')?.at ?? c.createdAt ?? new Date().toISOString();
    if (waitingAccept(c) && !c.labSeen) out.push({ id: `new-${c.id}`, title: 'New case to accept', body: `${who} · ${caseTitle(c)}`, at: sentAt, to, unread: true, icon: <Inbox className="w-5 h-5" />, tone: 'brand' });
    if (matchesLab(c, 'overdue')) out.push({ id: `late-${c.id}`, title: 'Case overdue', body: `${c.id} · ${who}. ${dueText(c).text}.`, at: c.returnBy, to, unread: false, icon: <Clock className="w-5 h-5" />, tone: 'bad' });
    const last = c.messages[c.messages.length - 1];
    if (last && last.from === 'practice' && !isClosed(c)) out.push({ id: `msg-${c.id}`, title: `Comment from ${practiceName(c.practice)}`, body: `${c.id} · ${last.text}`, at: last.at, to, unread: true, icon: <MessageSquare className="w-5 h-5" />, tone: 'pink' });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function LabNotifications() {
  const navigate = useNavigate();
  const items = labNotices(useLabCases());
  const groups = [
    { title: 'Today', items: items.filter(n => relDay(n.at) === 'Today') },
    { title: 'Earlier', items: items.filter(n => relDay(n.at) !== 'Today') },
  ].filter(g => g.items.length);
  return (
    <Screen header={<TopBar back fallback={`${LAB_BASE}/home`} title="Notifications" />}>
      {!items.length && <EmptyState icon={<Bell className="w-7 h-7" />} title="Nothing here yet" body="We’ll let you know when practices send new cases or write to you." />}
      {groups.map(g => (
        <Section key={g.title} title={g.title} className="!mt-3">
          <Card className="divide-y divide-go-line overflow-hidden">
            {g.items.map(n => (
              <button key={n.id} onClick={() => navigate(n.to)} className={cx('w-full text-left flex items-start gap-3 p-4 transition hover:bg-go-raised', n.unread && 'bg-go-brand-soft/40')}>
                <IconTile icon={n.icon} tone={n.tone} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={cx('text-[14px] text-go-ink', n.unread ? 'font-semibold' : 'font-medium')}>{n.title}</p>
                  <p className="text-[12.5px] text-go-muted mt-0.5 leading-snug">{n.body}</p>
                  <p className="text-[11px] text-go-faint mt-1">{fmtDateTime(n.at)}</p>
                </div>
                {n.unread && <span className="w-2.5 h-2.5 rounded-full go-grad mt-1.5 flex-shrink-0" />}
              </button>
            ))}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}

// ─── Cases ──────────────────────────────────────────────────────────────────
// Same layout as the clinic's Lab work: title with count, search always open,
// status chips, one card with a divided list.

export function LabCases() {
  const navigate = useNavigate();
  const cases = useLabCases();
  const [params, setParams] = useSearchParams();
  const f = (params.get('f') ?? '') as LabFilter | '';
  // Status filter: the lab portal's own statuses (?s=Accepted)
  const st = ['Draft', ...LAB_STATUS_CHOICES.map(x => x.status), 'Shipped'].find(x => x === params.get('s')) ?? null;
  const [statusOpen, setStatusOpen] = useState(false);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = cases.filter(c => (!f || matchesLab(c, f)) && (!st || statusOf(c) === st)
    && (!term || `${patientById(c.patientId).name} ${practiceName(c.practice)} ${clinicianName(c.clinician)}`.toLowerCase().includes(term)));
  const setF = (v: string) => { const n = new URLSearchParams(params); if (v) n.set('f', v); else n.delete('f'); setParams(n, { replace: true }); };
  const setS = (v: string | null) => { const n = new URLSearchParams(params); if (v) n.set('s', v); else n.delete('s'); setParams(n, { replace: true }); };
  // Every status the portal has, in its order, with how many cases sit in each
  const STATUS_ROWS = ['Draft', ...LAB_STATUS_CHOICES.map(x => x.status).filter(x => x !== 'Delivered'), 'Shipped', 'Delivered'].filter((x, i, a) => a.indexOf(x) === i) as string[];
  const chips = [{ id: '', short: 'All', n: cases.length }, ...STATUS_ROWS.map(x => ({ id: x, short: x, n: cases.filter(c => statusOf(c) === x).length })).filter(x => x.n > 0)];
  return (
    <Screen tabs={TABS} header={
      <div className="bg-go-bg/80 backdrop-blur-xl px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[24px] font-bold text-go-ink tracking-tight">Cases <span className="text-go-faint font-semibold text-[18px]">{cases.length}</span></h1>
          <button onClick={() => setStatusOpen(true)} aria-label="Filters"
            className={cx('relative w-10 h-10 rounded-full flex items-center justify-center border transition', st || f ? 'bg-go-brand-soft text-go-brand border-go-brand/30' : 'bg-go-surface text-go-ink border-go-line')}>
            <Filter className="w-[18px] h-[18px]" />
            {(st || f) && <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full go-grad text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-go-bg">{(st ? 1 : 0) + (f ? 1 : 0)}</span>}
          </button>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Search patient, practice or dentist" />
      </div>
    }>
      <div className="flex gap-2 overflow-x-auto go-scroll px-4 pb-1">
        {f && (
          <button onClick={() => setF('')} className="h-8 pl-3 pr-2 rounded-full text-[12.5px] font-semibold bg-go-brand text-white inline-flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
            {LAB_FILTERS.find(x => x.id === f)?.label}<X className="w-3.5 h-3.5" />
          </button>
        )}
        {chips.map(x => (
          <button key={x.id} onClick={() => setS(x.id || null)} aria-pressed={(st ?? '') === x.id}
            className={cx('h-8 pl-3 pr-2 rounded-full text-[12.5px] font-medium border whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition',
              (st ?? '') === x.id ? 'bg-go-ink text-go-bg border-go-ink' : 'bg-go-surface text-go-ink2 border-go-line')}>
            {x.short}<span className={cx('text-[11px] tabular-nums', (st ?? '') === x.id ? 'opacity-70' : 'text-go-faint')}>{x.n}</span>
          </button>
        ))}
      </div>
      <div className="px-4 mt-3">
        {list.length ? (
          <Card className="divide-y divide-go-line overflow-hidden">
            {list.map(c => <ListRow key={c.id} c={c} onClick={() => navigate(`${LAB_BASE}/cases/${c.id}`)} />)}
          </Card>
        ) : <EmptyState icon={<Search className="w-7 h-7" />} title="No cases found" body="Please check the spelling, or choose another status." />}
      </div>

      <Sheet open={statusOpen} onClose={() => setStatusOpen(false)} tall title={<span className="inline-flex items-center gap-2"><Filter className="w-5 h-5 text-go-brand" />Status</span>}
        footer={<Btn block onClick={() => setStatusOpen(false)}>Show {list.length} case{list.length === 1 ? '' : 's'}</Btn>}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mb-1.5 px-1">Status</p>
        <div className="space-y-1">
          {[{ status: null as string | null, label: 'All statuses', n: cases.length }, ...STATUS_ROWS.map(x => ({ status: x as string | null, label: x as string, n: cases.filter(c => statusOf(c) === x).length }))].map(r => (
            <button key={r.label} onClick={() => { setS(r.status); setStatusOpen(false); }}
              className={cx('w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition', st === r.status ? 'bg-go-brand-soft' : 'hover:bg-go-raised', !r.n && r.status && 'opacity-50')}>
              {r.status ? <Pill tone={STATUS_TONE[r.status] ?? 'neutral'} dot>{r.label}</Pill> : <span className="text-[14px] font-medium text-go-ink">{r.label}</span>}
              <span className="flex-1" />
              {r.status && NOTIFIES_CLINIC.has(r.status as LabStatus) && <Building2 className="w-4 h-4 text-go-brand flex-shrink-0" aria-label="The practice is notified" />}
              <span className="text-[12px] text-go-muted tabular-nums">{r.n}</span>
              {st === r.status && <Check className="w-4 h-4 text-go-brand" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mt-5 mb-1.5 px-1">Needs attention</p>
        <div className="space-y-1">
          {[{ id: '' as LabFilter | '', label: 'Everything' }, ...LAB_FILTERS].map(r => {
            const n = r.id ? cases.filter(c => matchesLab(c, r.id as LabFilter)).length : cases.length;
            return (
              <button key={r.id || 'all'} onClick={() => { setF(r.id); setStatusOpen(false); }}
                className={cx('w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition', f === r.id ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
                <span className="flex-1 text-[14px] font-medium text-go-ink">{r.label}</span>
                <span className="text-[12px] text-go-muted tabular-nums">{n}</span>
                {f === r.id && <Check className="w-4 h-4 text-go-brand" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </Screen>
  );
}

/** Same row as the clinic's Lab work list: initials, patient + id, dentist and practice, status pill + date. */
function ListRow({ c, onClick }: { c: LabCase; onClick: () => void }) {
  const p = patientById(c.patientId);
  const due = dueText(c);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-go-raised transition">
      <span className="rounded-full bg-go-raised border border-go-line text-[12px] font-bold text-go-ink2 flex items-center justify-center flex-shrink-0 w-10 h-10">{initials(p.name)}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[14px] font-semibold text-go-ink truncate">{shortName(p.name)}</span>
          <span className="text-[10.5px] text-go-faint font-mono flex-shrink-0">{c.id}</span>
        </span>
        <span className="flex items-center gap-2.5 min-w-0 text-[12px] text-go-muted mt-0.5">
          <span className="inline-flex items-center gap-1 min-w-0"><User className="w-3.5 h-3.5 text-go-brand flex-shrink-0" aria-label="Dentist" /><span className="truncate text-go-ink2">{clinicianName(c.clinician).replace(/^Dr (\S)\S* /, 'Dr $1. ')}</span></span>
          <span className="inline-flex items-center gap-1 min-w-0"><Building2 className="w-3.5 h-3.5 text-go-violet flex-shrink-0" aria-label="Practice" /><span className="truncate">{practiceName(c.practice).replace(/ (Dental )?(Studio|Care|Practice|Clinic)$/, '')}</span></span>
        </span>
        <span className="block text-[11.5px] font-medium text-go-violet mt-0.5 truncate">{caseTitle(c)}</span>
      </span>
      <span className="flex flex-col items-end flex-shrink-0">
        <Pill tone={STATUS_TONE[statusOf(c)] ?? 'neutral'} className="!h-[22px] !px-2">{labLabel(statusOf(c))}</Pill>
        <span className={cx('text-[11px] mt-1 tabular-nums', due.bad ? 'text-go-bad font-medium' : 'text-go-muted')}>{c.returnBy ? (due.bad ? due.text : fmtDate(c.returnBy)) : 'No date'}</span>
      </span>
    </button>
  );
}

// ─── The popups: accept · change status · ship · due date ─────────────

/** The portal's warning when a case is still missing required information: an override reason is needed to move it on. */
function OverrideBlock({ missing, to, value, onChange }: { missing: string[]; to: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-go-warn/30 bg-go-warn-soft p-3.5 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-go-warn flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-go-ink">This case is still missing required information</p>
          <p className="text-[12px] text-go-ink2 mt-1 leading-relaxed">Missing: {missing.join(', ')}. Moving it to “{to}” without waiting for the dentist needs an override reason.</p>
        </div>
      </div>
      <PickerField label="Override reason" value={value || null} onChange={onChange} placeholder="Select a reason…" options={OVERRIDE_REASONS.map(r => ({ value: r, label: r }))} />
    </div>
  );
}

export function AcceptSheet({ c, open, onClose, onDecline }: { c: LabCase; open: boolean; onClose: () => void; onDecline?: () => void }) {
  const { updateCase, toast, notify } = useGo();
  const [due, setDue] = useState('');
  const [override, setOverride] = useState('');
  useEffect(() => { if (open) { setDue(''); setOverride(''); } }, [open]);
  const missing = missingInfo(c);
  const must = missing.length > 0;
  const accept = () => {
    updateCase(c.id, x => ({ ...statusPatch(x, 'Accepted', '', must ? override : undefined), labSeen: true, ...(due && !x.returnBy ? { returnBy: iso(due) } : {}) }));
    toast(`${c.id} accepted · ${practiceName(c.practice)} notified`);
    notify('clinic', `${LAB_NAME} accepted ${c.id}`, 'ok');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Accept this case?" sub={`${practiceName(c.practice)} will be notified that ${LAB_NAME} has accepted it.`}
      footer={<div className="flex gap-2"><Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn><Btn onClick={accept} disabled={must && !override} className="flex-[1.4]" icon={<CheckCircle2 className="w-5 h-5" />}>{must ? 'Confirm override' : 'Accept case'}</Btn></div>}>
      <p className="text-[14px] font-semibold text-go-ink">{patientById(c.patientId).name} <span className="font-mono text-[12px] text-go-faint font-medium">{c.id}</span></p>
      <p className="text-[13px] text-go-ink2 mt-0.5">{caseTitle(c)}</p>
      <div className="mt-4">
        {c.returnBy
          ? <div className="rounded-2xl bg-go-raised px-4 py-3 text-[13px] text-go-ink2">Due <span className="font-semibold text-go-ink">{fmtDate(c.returnBy)}</span></div>
          : <><Label optional hint="This case has no delivery date">Add a delivery date</Label><Input type="date" value={due} onChange={e => setDue(e.target.value)} /></>}
      </div>
      {must && <OverrideBlock missing={missing} to="Accepted" value={override} onChange={setOverride} />}
      {onDecline && <button onClick={() => { onClose(); onDecline(); }} className="mt-4 text-[13px] font-semibold text-go-bad">Can’t accept it? Tell the practice why</button>}
    </Sheet>
  );
}

/** The portal's Shipping Details popup. Nothing here is required, and shipping a case that is missing information asks for an override reason first. */
export function ShipSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { updateCase, toast, notify } = useGo();
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [link, setLink] = useState('');
  const [services, setServices] = useState('All');
  const [shippedOn, setShippedOn] = useState('');
  const [eta, setEta] = useState('');
  const [override, setOverride] = useState('');
  useEffect(() => { if (open) { setCourier(''); setTracking(''); setLink(''); setServices('All'); setShippedOn(''); setEta(''); setOverride(''); } }, [open]);
  const missing = missingInfo(c);
  const must = missing.length > 0;
  const send = () => {
    const d = { courier: courier.trim() || undefined, tracking: tracking.trim() || undefined, link: link.trim() || undefined, services, shippedOn: shippedOn ? fmtDate(iso(shippedOn)) : undefined, eta: eta ? fmtDate(iso(eta)) : undefined };
    updateCase(c.id, x => shipPatch(x, d, must ? override : undefined));
    toast(`${c.id} shipped · ${practiceName(c.practice)} notified`);
    notify('clinic', `${c.id} is on its way from ${LAB_NAME}${d.courier ? ` · ${d.courier}` : ''}`, 'ok');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} tall title="Shipping details" sub={`${practiceName(c.practice)} will be notified. Everything here is optional.`}
      footer={<div className="flex gap-2"><Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn><Btn onClick={send} disabled={must && !override} className="flex-[1.4]" icon={<Send className="w-5 h-5" />}>{must ? 'Confirm override' : 'Save'}</Btn></div>}>
      <div className="space-y-3.5">
        {must && <OverrideBlock missing={missing} to="Shipped" value={override} onChange={setOverride} />}
        <div>
          <Label optional>Courier name</Label>
          <Input value={courier} onChange={e => setCourier(e.target.value)} placeholder="Enter courier name" />
          <div className="mt-2"><Chips options={COURIERS} value={COURIERS.includes(courier) ? courier : null} onChange={setCourier} /></div>
        </div>
        <div><Label optional>Tracking ID</Label><Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Enter tracking ID" /></div>
        <div><Label optional>Shipment tracking link</Label><Input value={link} onChange={e => setLink(e.target.value)} placeholder="e.g. tracking.example.com/123" inputMode="url" /></div>
        <PickerField label="Services include" optional value={services} onChange={setServices} options={[{ value: 'All', label: 'All' }, ...allItems(c).map(it => ({ value: it.service, label: it.service }))]} />
        <div className="grid grid-cols-2 gap-2.5">
          <div><Label optional>Order shipment date</Label><Input type="date" value={shippedOn} onChange={e => setShippedOn(e.target.value)} className="px-3 text-[14px]" /></div>
          <div><Label optional>Estimated arrival</Label><Input type="date" value={eta} min={shippedOn || undefined} onChange={e => setEta(e.target.value)} className="px-3 text-[14px]" /></div>
        </div>
      </div>
    </Sheet>
  );
}

/** Pick a new status (the portal's list), then confirm it, with a reason where the practice needs one and an override when information is missing. */
export function StatusSheet({ c, open, onClose, initial, onShip }: { c: LabCase; open: boolean; onClose: () => void; initial?: LabStatus | null; onShip: () => void }) {
  const { updateCase, toast, notify } = useGo();
  const [to, setTo] = useState<LabStatus | null>(initial ?? null);
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState('');
  useEffect(() => { if (open) { setTo(initial ?? null); setReason(''); setOverride(''); } }, [open, initial]);
  const current = statusOf(c);
  const close = () => { onClose(); };
  const mustOverride = !!to && needsOverride(c, to);
  const notifies = !!to && NOTIFIES_CLINIC.has(to);
  const confirm = () => {
    if (!to) return;
    updateCase(c.id, x => ({ ...statusPatch(x, to, reason.trim(), mustOverride ? override : undefined), labSeen: true }));
    toast(`${c.id} is now ${to}${notifies ? ` · ${practiceName(c.practice)} notified` : ''}`);
    if (notifies) notify('clinic', to === 'Accepted' ? `${LAB_NAME} accepted ${c.id}` : to === 'On Hold (Practice)' ? `${LAB_NAME} needs something from you on ${c.id}` : to === 'Not Approved' ? `${LAB_NAME} could not accept ${c.id}` : `${LAB_NAME} updated ${c.id} to ${to}`, to === 'Accepted' ? 'ok' : 'info');
    close();
  };
  const need = !!to && needsReason(to);
  return (
    <Sheet open={open} onClose={close} tall={!to}
      title={to ? `Change status to ${to}?` : 'Change status'}
      sub={to ? (notifies ? `${practiceName(c.practice)} will be notified.` : 'Only your lab sees this status.') : <>Now: <span className="font-semibold text-go-ink2">{labLabel(current)}</span></>}
      footer={to ? (
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => (initial ? close() : setTo(null))} className="flex-1">{initial ? 'Cancel' : 'Back'}</Btn>
          <Btn onClick={confirm} disabled={(need && !reason.trim()) || (mustOverride && !override)} className="flex-[1.4]">{mustOverride ? 'Confirm override' : 'Confirm'}</Btn>
        </div>
      ) : undefined}>
      {!to ? (
        <div>
          <p className="text-[12px] text-go-muted mb-2 px-1 inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-go-brand" />The practice is notified of these changes.</p>
          <div className="space-y-1">
            {LAB_STATUS_CHOICES.map(i => (
              <button key={i.status} disabled={i.status === current} onClick={() => { setTo(i.status); setReason(''); setOverride(''); }}
                className={cx('w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition', i.status === current ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
                <Pill tone={STATUS_TONE[i.status]} dot>{i.status}</Pill>
                <span className="flex-1 text-[12.5px] text-go-muted">{i.hint}</span>
                {NOTIFIES_CLINIC.has(i.status) && <Building2 className="w-4 h-4 text-go-brand flex-shrink-0" aria-label="The practice is notified" />}
                {i.status === current && <span className="text-[11px] font-semibold text-go-brand-ink">Current</span>}
              </button>
            ))}
            <button onClick={() => { close(); onShip(); }} className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left hover:bg-go-raised transition">
              <Pill tone="ok" dot>Shipped</Pill><span className="flex-1 text-[12.5px] text-go-muted">Add courier and tracking, then ship</span>
              <Building2 className="w-4 h-4 text-go-brand flex-shrink-0" aria-label="The practice is notified" /><ChevronRight className="w-4 h-4 text-go-faint" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4"><Pill tone={STATUS_TONE[current]}>{labLabel(current)}</Pill><ChevronRight className="w-4 h-4 text-go-faint" /><Pill tone={STATUS_TONE[to]} dot>{labLabel(to)}</Pill></div>
          {mustOverride && <div className="mb-4 -mt-1"><OverrideBlock missing={missingInfo(c)} to={to} value={override} onChange={setOverride} /></div>}
          {(need || notifies) && (<>
            <Label optional={!need} hint={need ? 'The practice will read this' : undefined}>{to === 'On Hold (Practice)' ? 'What do you need from the practice?' : need ? 'Reason' : 'Note to the practice'}</Label>
            <TextArea rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder={to === 'On Hold (Practice)' ? 'e.g. Please confirm the shade' : need ? 'Say why' : 'Add a note (optional)'} />
          </>)}
        </div>
      )}
    </Sheet>
  );
}

function DueSheet({ c, open, onClose }: { c: LabCase; open: boolean; onClose: () => void }) {
  const { updateCase, toast, notify } = useGo();
  const [date, setDate] = useState(ymd(c.returnBy));
  const [why, setWhy] = useState('');
  useEffect(() => { if (open) { setDate(ymd(c.returnBy)); setWhy(''); } }, [open, c.returnBy]);
  const save = () => {
    updateCase(c.id, x => ({
      returnBy: iso(date),
      ...(x.returnBy ? { deliveryChanged: { from: x.returnBy, reason: why.trim() || undefined } } : {}),
      events: [...x.events, { stage: 'note', at: new Date().toISOString(), by: LAB_NAME, text: `Due date ${x.returnBy ? 'changed' : 'set'} to ${fmtDate(iso(date))}${why.trim() ? ` · ${why.trim()}` : ''}` }],
    }));
    toast(`Due date saved · ${practiceName(c.practice)} notified`);
    notify('clinic', `${LAB_NAME} changed the delivery date on ${c.id}`, 'info');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={c.returnBy ? 'Change the due date?' : 'Set a due date'} sub={`${practiceName(c.practice)} will be notified.`}
      footer={<div className="flex gap-2"><Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn><Btn onClick={save} disabled={!date || date === ymd(c.returnBy)} className="flex-[1.4]">Save date</Btn></div>}>
      <Label>Due date</Label>
      <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
      {!!c.returnBy && <div className="mt-4"><Label optional>Reason</Label><Input value={why} onChange={e => setWhy(e.target.value)} placeholder="e.g. Waiting for materials" /></div>}
    </Sheet>
  );
}

// ─── Case detail ────────────────────────────────────────────────────────────
// Same page as the clinic's case: patient title, summary, due card, Details /
// Activity / Comments / Files tabs, and a sticky "next step" bar.

type Tab = 'details' | 'activity' | 'messages' | 'files';
/** A timeline line, named after the lab status it marks (Received, Accepted, In Production, Shipped…). */
function timelineLine(e: LabCase['events'][number]): { title: string; sub?: string } {
  if (e.stage === 'note') {
    const m = /^Status changed to (.+?)(?: · (.*))?$/.exec(e.text ?? '');
    if (m) return { title: m[1], sub: m[2] };
    return { title: e.text ?? 'Note' };
  }
  const named: Record<string, { title: string; sub?: string }> = {
    authorised: { title: 'Prescription authorised', sub: 'Practice' },
    dispatched: { title: 'Received', sub: 'Sent to the lab by the practice' },
    'at-lab': { title: 'Accepted' },
    production: { title: 'In Production' },
    shipped: { title: 'Shipped' },
    received: { title: 'Delivered', sub: 'Received at the practice' },
    ready: { title: 'Ready to send', sub: 'Practice' },
    draft: { title: 'Draft' },
  };
  const n = named[e.stage] ?? { title: e.stage };
  return { title: n.title, sub: [n.sub, e.text].filter(Boolean).join(' · ') || undefined };
}

export function LabCaseDetail() {
  const { id } = useParams();
  const { cases, updateCase, toast, notify } = useGo();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'details';
  const setTab = (t: Tab) => setParams(t === 'details' ? {} : { tab: t }, { replace: true });
  const c = cases.find(x => x.id === id && isLabCase(x));
  const [sheet, setSheet] = useState<null | 'accept' | 'status' | 'ship' | 'due'>(null);
  const [initial, setInitial] = useState<LabStatus | null>(null);
  const [reply, setReply] = useState('');
  useEffect(() => { if (c && !c.labSeen) updateCase(c.id, { labSeen: true }); }, [c, updateCase]);
  if (!c) return <Screen header={<TopBar back fallback={`${LAB_BASE}/cases`} title="Cases" />}><EmptyState icon={<Search className="w-7 h-7" />} title="Case not found" body="We couldn’t find this case. It may have been removed." /></Screen>;

  const p = patientById(c.patientId);
  const due = dueText(c);
  const accept = waitingAccept(c);
  const ship = waitingShip(c);
  const items = allItems(c);
  // A status change is stored as a stage event plus a note at the same moment: show it once
  const timeline = c.events.filter(e => !(e.stage !== 'note' && c.events.some(n => n.stage === 'note' && n.at === e.at && /^Status changed to/.test(n.text ?? ''))));
  const openStatus = (st: LabStatus | null) => { setInitial(st); setSheet('status'); };
  const editable = c.stage !== 'draft' && !isClosed(c);

  // One next step, in the sticky bar (as in the clinic's case page)
  const step: { icon: React.ReactNode; tone: Tone; title: string; body: string; cta?: { label: string; run: () => void; bad?: boolean } } =
    c.stage === 'draft' ? { icon: <ClipboardCheck className="w-5 h-5" />, tone: 'neutral', title: 'Draft not finished', body: 'Finish the details so it can go ahead.', cta: { label: 'Finish case', run: () => navigate(`${LAB_BASE}/new?draft=${c.id}`) } }
    : c.onHold ? { icon: <Pause className="w-5 h-5" />, tone: 'warn', title: `On hold (${c.onHold.side})`, body: c.onHold.reason, cta: { label: 'Take off hold', run: () => openStatus('In Production') } }
    : accept && statusOf(c) === 'Received' ? { icon: <Inbox className="w-5 h-5" />, tone: 'brand', title: 'New case to review', body: 'Check the prescription, then accept it or ask the practice.', cta: { label: 'Start review', run: () => { updateCase(c.id, x => ({ ...statusPatch(x, 'Under Review'), labSeen: true })); toast(`${c.id} is now Under Review`); } } }
    : accept ? { icon: <ClipboardCheck className="w-5 h-5" />, tone: 'brand', title: 'Ready to accept?', body: `${practiceName(c.practice)} is waiting to hear from you.`, cta: { label: 'Accept case', run: () => setSheet('accept') } }
    : ship ? { icon: <Truck className="w-5 h-5" />, tone: 'violet', title: 'Ready to ship?', body: `Made and checked? Ship it to ${practiceName(c.practice)}.`, cta: { label: 'Ship', run: () => setSheet('ship') } }
    : isClosed(c) ? { icon: <CheckCircle2 className="w-5 h-5" />, tone: 'ok', title: statusOf(c) === 'Shipped' ? 'Shipped to the practice' : labLabel(statusOf(c)), body: c.labShipment ? shipText(c) : 'Nothing more to do.' }
    : { icon: <FlaskConical className="w-5 h-5" />, tone: 'violet', title: labLabel(statusOf(c)), body: 'Update the status as the work moves on.', cta: { label: 'Change status', run: () => openStatus(null) } };
  const overdue = due.bad;

  const facts: [string, React.ReactNode][] = [
    ['Practice', practiceName(c.practice)],
    ['Dentist', clinicianName(c.clinician)],
    ['Lab status', labLabel(statusOf(c))],
    ['Due date', c.returnBy ? fmtDate(c.returnBy) : 'Not set'],
    ['Order type', c.funding],
    ['Created by', c.createdBy],
  ];
  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    updateCase(c.id, x => ({ messages: [...x.messages, { from: 'lab', author: `${LAB_ME.name} · Northstar`, text, at: new Date().toISOString() }] }));
    toast(`Sent · ${practiceName(c.practice)} notified`);
    notify('clinic', `New comment from ${LAB_NAME} on ${c.id}`, 'info');
    setReply('');
  };

  return (
    <Screen header={<TopBar back fallback={`${LAB_BASE}/cases`} title={p.name} sub={`${c.id} · DOB ${p.dob}`} />}
      footer={step.cta && !(tab === 'messages') ? (
        <div className="flex items-center gap-3">
          <IconTile icon={step.icon} tone={step.tone} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-go-ink truncate">{step.title}</p>
            <p className="text-[11.5px] text-go-muted truncate">{step.body}</p>
          </div>
          <Btn size="md" onClick={step.cta.run} className="!h-11 !px-5">{step.cta.label}</Btn>
        </div>
      ) : undefined}>
      <div className="px-4 pt-1">
        <p className="text-[22px] font-bold text-go-ink tracking-tight leading-tight">{c.service} <span className="go-grad-text">{c.teeth.join(', ')}</span></p>
        <p className="text-[12.5px] text-go-muted mt-0.5 truncate">{c.material}{c.shade ? ` · ${c.shade}` : ''} · {practiceName(c.practice)}</p>
        {c.items?.map(it => (
          <p key={it.service} className="text-[14px] font-semibold text-go-ink mt-1.5">+ {it.service} <span className="go-grad-text">{it.teeth.join(', ')}</span> <span className="text-[12px] font-normal text-go-muted">· {it.material}{it.shade ? ` · ${it.shade}` : ''}</span></p>
        ))}

        {/* Due date card, like the clinic's appointment card */}
        <div className={cx('mt-3 rounded-[20px] p-3.5 flex items-center gap-3 border',
          overdue ? 'bg-go-bad-soft border-go-bad/25' : !c.returnBy ? 'bg-go-warn-soft border-go-warn/25' : 'bg-go-surface border-go-line')}>
          <IconTile icon={<CalendarClock className="w-5 h-5" />} tone={overdue ? 'bad' : !c.returnBy ? 'warn' : 'violet'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-go-ink truncate">{due.text}</p>
            <p className={cx('text-[11.5px] truncate', overdue ? 'text-go-bad' : 'text-go-muted')}>
              {c.deliveryChanged ? `Changed from ${fmtDate(c.deliveryChanged.from)}${c.deliveryChanged.reason ? ` · ${c.deliveryChanged.reason}` : ''}` : c.returnBy ? fmtDate(c.returnBy) : 'Tell the practice when it will be ready'}
            </p>
          </div>
          {editable
            ? <button onClick={() => setSheet('due')} className="text-[12.5px] font-semibold text-go-brand flex-shrink-0">{c.returnBy ? 'Change' : 'Set date'}</button>
            : <StatusPill c={c} />}
        </div>

        {!step.cta && (
          <Card className="mt-4 p-3 flex items-center gap-3">
            <IconTile icon={step.icon} tone={step.tone} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-go-ink truncate">{step.title}</p>
              <p className="text-[11.5px] text-go-muted truncate">{step.body}</p>
            </div>
          </Card>
        )}
      </div>

      <div className="px-4 mt-4">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'details', label: 'Details' },
          { value: 'activity', label: 'Activity' },
          { value: 'messages', label: 'Comments', count: c.messages.length || undefined },
          { value: 'files', label: 'Files', count: c.attachments.length },
        ]} />
      </div>

      <div className="px-4 mt-3">
        {tab === 'details' && (
          <>
            {editable && (
              <Card className="p-3 mb-2 flex items-center gap-3">
                <span className="flex-1 min-w-0"><span className="block text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Status</span><Pill tone={STATUS_TONE[statusOf(c)] ?? 'neutral'} dot className="mt-1.5 !h-9 !px-4 !text-[15px] !font-bold">{labLabel(statusOf(c))}</Pill></span>
                <button onClick={() => openStatus(null)} className="h-8 px-3 rounded-full border border-go-line bg-go-surface text-[12px] font-semibold text-go-ink2 hover:bg-go-raised active:scale-[.98] transition flex-shrink-0">Change status</button>
              </Card>
            )}
            {items.length > 1 && (
              <div className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mb-2">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Services</p>
                {items.map((it, i) => <p key={i} className="text-[13px] text-go-ink mt-0.5">{it.service} <span className="text-go-muted">· <TeethChips teeth={it.teeth} /></span></p>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {facts.map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 min-w-0">
                  <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">{k}</p>
                  <p className="text-[13px] font-medium text-go-ink mt-0.5 truncate">{v}</p>
                </div>
              ))}
            </div>
            {c.instructions && (
              <div className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mt-2">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Case instructions</p>
                <p className="text-[13px] text-go-ink mt-0.5 leading-relaxed">{c.instructions}</p>
              </div>
            )}
            {c.labShipment && (
              <div className="rounded-2xl bg-go-surface border border-go-line px-3 py-2.5 mt-2">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold text-go-faint">Shipped</p>
                <p className="text-[13px] text-go-ink mt-0.5">{shipText(c)}{c.labShipment.eta ? ` · arriving ${c.labShipment.eta}` : ''}</p>
              </div>
            )}
          </>
        )}

        {tab === 'activity' && (
          <Card className="p-4">
            <ol className="relative">
              {[...timeline].reverse().map((e, i, arr) => (
                <li key={e.at + i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-go-line" />}
                  <span className={cx('relative z-[1] w-3 h-3 rounded-full mt-1 flex-shrink-0', i === 0 ? 'go-grad ring-4 ring-go-brand/15' : 'bg-go-line')} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-go-ink">{timelineLine(e).title}</p>
                    <p className="text-[11.5px] text-go-muted">{fmtDateTime(e.at)} · {e.by}{timelineLine(e).sub ? ` · ${timelineLine(e).sub}` : ''}</p>
                  </div>
                </li>
              ))}
              {!timeline.length && <p className="text-[13px] text-go-muted">No activity yet.</p>}
            </ol>
          </Card>
        )}

        {tab === 'messages' && (
          <div>
            <div className="space-y-2.5">
              {c.messages.map((m, i) => (
                <div key={i} className={cx('max-w-[86%] rounded-2xl px-3.5 py-2.5', m.from === 'lab' ? 'ml-auto bg-go-brand-soft' : 'bg-go-surface border border-go-line')}>
                  <p className="text-[11px] text-go-muted"><span className="font-semibold text-go-ink2">{m.author}</span> · {fmtDateTime(m.at)}</p>
                  <p className="text-[13.5px] text-go-ink leading-snug mt-0.5">{m.text}</p>
                </div>
              ))}
              {!c.messages.length && <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="No comments yet" body={`Write to ${practiceName(c.practice)} about this case.`} />}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <TextArea rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a comment" />
              <Btn size="md" onClick={sendReply} disabled={!reply.trim()} icon={<Send className="w-4 h-4" />} className="!h-12">Send</Btn>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="grid grid-cols-2 gap-2">
            {c.attachments.map(f => (
              <div key={f} className="rounded-2xl bg-go-surface border border-go-line p-3 aspect-[4/3] flex flex-col justify-between">
                <span className="w-9 h-9 rounded-xl bg-go-raised flex items-center justify-center text-go-muted">
                  {/photo/i.test(f) ? <ImageIcon className="w-[18px] h-[18px] text-go-brand" /> : /pdf/i.test(f) ? <FileText className="w-[18px] h-[18px] text-go-violet" /> : <Paperclip className="w-[18px] h-[18px]" />}
                </span>
                <p className="text-[12.5px] font-medium text-go-ink leading-snug line-clamp-2">{f}</p>
              </div>
            ))}
            {!c.attachments.length && <EmptyState icon={<Inbox className="w-7 h-7" />} title="No files" />}
          </div>
        )}
      </div>
      <AcceptSheet c={c} open={sheet === 'accept'} onClose={() => setSheet(null)} onDecline={() => openStatus('Not Approved')} />
      <StatusSheet c={c} open={sheet === 'status'} onClose={() => setSheet(null)} initial={initial} onShip={() => setSheet('ship')} />
      <ShipSheet c={c} open={sheet === 'ship'} onClose={() => setSheet(null)} />
      <DueSheet c={c} open={sheet === 'due'} onClose={() => setSheet(null)} />
    </Screen>
  );
}

// ─── Shipping: to accept · to ship · shipped ────────────────────────────

type DTab = 'accept' | 'ship' | 'sent';

/** Filters under the Shipping tabs (same ids as the dashboard cards, so a card opens the page already filtered). */
const SHIP_CHIPS: Record<'accept' | 'ship', { id: LabFilter; label: string }[]> = {
  accept: [{ id: 'new', label: 'Received' }, { id: 'accept', label: 'Under review' }, { id: 'nodate', label: 'No delivery date' }],
  ship: [{ id: 'overdue', label: 'Overdue' }, { id: 'due3', label: 'Due within 3 days' }, { id: 'nodate', label: 'No delivery date' }],
};

export function LabDeliveries() {
  const navigate = useNavigate();
  const cases = useLabCases();
  const [params, setParams] = useSearchParams();
  const tab = (['accept', 'ship', 'sent'].includes(params.get('tab') ?? '') ? params.get('tab') : 'accept') as DTab;
  const [acting, setActing] = useState<{ c: LabCase; kind: 'accept' | 'ship' | 'decline' } | null>(null);
  const lists: Record<DTab, LabCase[]> = {
    accept: cases.filter(waitingAccept),
    ship: cases.filter(waitingShip),
    sent: cases.filter(c => c.stage === 'shipped'),
  };
  const empty = {
    accept: { icon: <ClipboardCheck className="w-7 h-7" />, title: 'Nothing to accept', body: 'New cases from practices will appear here.' },
    ship: { icon: <Truck className="w-7 h-7" />, title: 'Nothing to ship', body: 'Work that is made and ready will appear here.' },
    sent: { icon: <PackageCheck className="w-7 h-7" />, title: 'Nothing shipped yet', body: 'Cases you ship to practices will appear here.' },
  }[tab];
  const chips = tab === 'sent' ? [] : SHIP_CHIPS[tab];
  const fParam = params.get('f') as LabFilter | null;
  const active = chips.find(x => x.id === fParam)?.id ?? null;
  const shown = active ? lists[tab].filter(c => matchesLab(c, active)) : lists[tab];
  const setFilter = (id: LabFilter | null) => { const n: Record<string, string> = {}; if (tab !== 'accept') n.tab = tab; if (id) n.f = id; setParams(n, { replace: true }); };
  const live = acting ? cases.find(x => x.id === acting.c.id) ?? acting.c : null;
  return (
    <Screen tabs={TABS} header={<TopBar large compact title="Shipping" sub="Accept new cases and ship finished work" />}>
      <div className="px-4">
        <Segmented value={tab} onChange={t => setParams(t === 'accept' ? {} : { tab: t }, { replace: true })}
          options={[{ value: 'accept', label: 'To accept', count: lists.accept.length }, { value: 'ship', label: 'To ship', count: lists.ship.length }, { value: 'sent', label: 'Shipped', count: lists.sent.length }]} />
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto go-scroll px-4">
          {[{ id: null as LabFilter | null, label: 'All' }, ...chips].map(x => {
            const n = x.id ? lists[tab].filter(c => matchesLab(c, x.id!)).length : lists[tab].length;
            return (
              <button key={x.id ?? 'all'} onClick={() => setFilter(x.id)} aria-pressed={active === x.id}
                className={cx('h-8 pl-3 pr-2 rounded-full text-[12.5px] font-medium border whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5 transition',
                  active === x.id ? 'bg-go-ink text-go-bg border-go-ink' : 'bg-go-surface text-go-ink2 border-go-line')}>
                {x.label}<span className={cx('text-[11px] tabular-nums', active === x.id ? 'opacity-70' : 'text-go-faint')}>{n}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="px-4 mt-3 space-y-2.5">
        {shown.map(c => (
          <CaseRow key={c.id} c={c} onClick={() => navigate(`${LAB_BASE}/cases/${c.id}`)}
            action={tab === 'accept' ? <Btn block size="md" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setActing({ c, kind: 'accept' })}>Accept case</Btn>
              : tab === 'ship' ? <Btn block size="md" icon={<Send className="w-4 h-4" />} onClick={() => setActing({ c, kind: 'ship' })}>Ship to practice</Btn>
              : c.labShipment ? <p className="text-[12.5px] text-go-muted inline-flex items-center gap-1.5"><Truck className="w-4 h-4" />{shipText(c)}</p> : undefined} />
        ))}
        {!shown.length && <EmptyState icon={empty.icon} title={active ? 'Nothing matches' : empty.title} body={active ? 'Try another filter, or choose All.' : empty.body} />}
      </div>
      {live && <>
        <AcceptSheet c={live} open={acting?.kind === 'accept'} onClose={() => setActing(null)} onDecline={() => setActing({ c: live, kind: 'decline' })} />
        <ShipSheet c={live} open={acting?.kind === 'ship'} onClose={() => setActing(null)} />
        <StatusSheet c={live} open={acting?.kind === 'decline'} initial="Not Approved" onClose={() => setActing(null)} onShip={() => setActing({ c: live, kind: 'ship' })} />
      </>}
    </Screen>
  );
}

// ─── Create (the lab is always Northstar) ───────────────────────────────────

/** Create a case = the clinic's prescription flow, with the lab fixed to Northstar. A saved draft reopens on the same review page. */
export function LabNew() {
  return <LiteCreate labMode />;
}

// ─── Me ─────────────────────────────────────────────────────────────────────

export function LabAccount() {
  const navigate = useNavigate();
  const { signOut, themePref, setThemePref } = useGo();
  return (
    <Screen tabs={TABS} header={<TopBar large compact title="Me" />}>
      <div className="px-4 space-y-3">
        <Card className="p-4 flex items-center gap-3.5">
          <Avatar name={LAB_ME.name} size={56} />
          <div className="min-w-0"><p className="text-[18px] font-bold text-go-ink">{LAB_ME.name}</p><p className="text-[13px] text-go-muted">{LAB_ME.role}</p><p className="text-[12.5px] text-go-muted truncate">{LAB_ME.email}</p></div>
        </Card>
        <Card className="p-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mb-1.5">Lab</p>
          <p className="text-[15px] font-semibold text-go-ink inline-flex items-center gap-2"><FlaskConical className="w-4 h-4 text-go-violet" />{LAB_NAME}</p>
          <p className="text-[12.5px] text-go-muted mt-0.5">Leeds · you receive cases from {PRACTICES.length} practices</p></Card>
        <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mb-2 px-1">Appearance</p>
          <Segmented value={themePref} onChange={setThemePref} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Auto' }]} /></div>
        <Btn block variant="secondary" icon={<LogOut className="w-5 h-5" />} onClick={() => { signOut(); navigate(`${LAB_BASE}/signin`, { replace: true }); }}>Sign out</Btn>
      </div>
    </Screen>
  );
}
