// ─── Home — the clinician's day ──────────────────────────────────────────────
// Top: the four status actions the client asked for (each opens Lab work
// filtered). Middle: today's lab-dependent appointments on a time rail.
// Bottom: the next 7 days as a strip plus the selected day's agenda.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Building2, CalendarClock, Check, ChevronDown } from '../icons';
import { FilledChatBubble, FilledClock, FilledPackage, FilledTruck } from '../../components/icons/FilledNavIcons';
import { ME, useGo, useScoped } from '../store';
import {
  ATTENTION, Attention, LabCase, PRACTICES, ReadinessLevel, caseTitle, dayOffset, fmtTime, fmtTimeParts, hourLabel, matchesAttention, patientById, readiness, shortName,
} from '../data';
import { Card, IconTile, Pill, READINESS_DOT, Screen, Sheet, cx } from '../ui';

export function PracticeSwitcher({ inline }: { inline?: boolean }) {
  const { practice, setPractice, cases } = useGo();
  const [open, setOpen] = useState(false);
  const label = practice === 'all' ? 'All my practices' : PRACTICES.find(p => p.id === practice)!.name;
  const opts = [{ id: 'all' as const, name: 'All my practices', area: `${PRACTICES.length} practices` }, ...PRACTICES];
  return (
    <>
      {inline ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-go-brand">
          {label}<ChevronDown className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-go-surface border border-go-line max-w-[220px]">
          <span className="w-7 h-7 rounded-full bg-go-brand-soft text-go-brand flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4" /></span>
          <span className="text-[13px] font-semibold text-go-ink truncate">{label}</span>
          <ChevronDown className="w-4 h-4 text-go-muted flex-shrink-0" />
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Practice" sub="Lab work and approvals are shown for the practice you pick.">
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
                  <span className="block text-[12px] text-go-muted">{p.area} · {n} lab work</span>
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

// ─── Today on a time rail ───────────────────────────────────────────────────

const TEXT_TONE: Record<ReadinessLevel, string> = {
  'at-risk': 'text-go-bad', attention: 'text-go-warn', arriving: 'text-go-brand', 'on-track': 'text-go-violet', 'in-practice': 'text-go-ok',
};

const START = 8, END = 18;
const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getHours() + d.getMinutes() / 60 - START) / (END - START)) * 100));

/** One appointment, two short lines: "R. Evans · Bridge" / "Fit · At risk". */
function ApptRow({ c, dim }: { c: LabCase; dim?: boolean }) {
  const navigate = useNavigate();
  const r = readiness(c);
  const [t, ap] = fmtTimeParts(c.appointment!.at);
  return (
    <button onClick={() => navigate(`/go/work/${c.id}`)}
      className={cx('w-full flex items-center gap-3 px-1 py-2 rounded-xl text-left hover:bg-go-raised transition', dim && 'opacity-50')}>
      <span className="w-10 text-right leading-none flex-shrink-0">
        <span className="text-[13px] font-semibold text-go-ink tabular-nums">{t}</span>
        <span className="block text-[9.5px] font-medium text-go-faint uppercase mt-0.5">{ap}</span>
      </span>
      <span className={cx('w-1 h-7 rounded-full flex-shrink-0', READINESS_DOT[r.level])} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold text-go-ink truncate">
          {shortName(patientById(c.patientId).name)} <span className="font-normal text-go-muted">· {c.service}{c.items?.length ? ` +${c.items.length}` : ''}</span>
        </span>
        <span className="block text-[11.5px] text-go-muted truncate">
          {c.appointment!.kind} · <span className={cx('font-semibold', TEXT_TONE[r.level])}>{r.label}</span>
        </span>
      </span>
    </button>
  );
}

function TodayRail({ cases }: { cases: LabCase[] }) {
  const navigate = useNavigate();
  const today = cases.filter(c => c.appointment && dayOffset(c.appointment.at) === 0)
    .sort((a, b) => a.appointment!.at.localeCompare(b.appointment!.at));
  const now = new Date();
  const nowPct = pct(now);
  const risks = today.filter(c => readiness(c).level === 'at-risk').length;

  return (
    <Card className="p-4 relative overflow-hidden">
      <span className="absolute -right-16 -top-20 w-48 h-48 rounded-full bg-go-brand/10 blur-2xl pointer-events-none" />
      {/* One-line header */}
      <div className="relative flex items-center gap-2">
        <CalendarClock className="w-[18px] h-[18px] text-go-brand" />
        <p className="text-[15px] font-semibold text-go-ink">Today</p>
        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-go-raised border border-go-line text-[11px] font-bold text-go-ink2 flex items-center justify-center">{today.length}</span>
        <span className="flex-1" />
        {risks > 0 ? <Pill tone="bad" dot>{risks} at risk</Pill> : today.length ? <Pill tone="ok" dot>All set</Pill> : null}
      </div>

      {/* Rail */}
      <div className="relative mt-3 h-8">
        <div className="absolute inset-x-0 top-[11px] h-1.5 rounded-full bg-go-raised border border-go-line" />
        <div className="absolute left-0 top-[11px] h-1.5 rounded-full go-grad opacity-40" style={{ width: `${nowPct}%` }} />
        {[8, 12, 16].map(h => (
          <span key={h} className="absolute top-[22px] -translate-x-1/2 text-[9.5px] text-go-faint" style={{ left: `${((h - START) / (END - START)) * 100}%` }}>{hourLabel(h)}</span>
        ))}
        {nowPct > 0 && nowPct < 100 && <span className="absolute top-[2px] -translate-x-1/2 w-0.5 h-[24px] bg-go-ink rounded-full" style={{ left: `${nowPct}%` }} />}
        {today.map(c => {
          const r = readiness(c);
          return (
            <button key={c.id} onClick={() => navigate(`/go/work/${c.id}`)} aria-label={`${fmtTime(c.appointment!.at)} ${patientById(c.patientId).name}`}
              className={cx('absolute top-[6px] -translate-x-1/2 w-4 h-4 rounded-full ring-[3px] ring-go-surface', READINESS_DOT[r.level], r.level === 'at-risk' && 'go-pulse')}
              style={{ left: `${pct(new Date(c.appointment!.at))}%` }} />
          );
        })}
      </div>

      <div className="relative mt-1 -mx-1">
        {today.map(c => <ApptRow key={c.id} c={c} dim={new Date(c.appointment!.at) < now && readiness(c).level === 'in-practice'} />)}
        {!today.length && <p className="text-[13px] text-go-muted px-1 pb-1">Nothing booked today.</p>}
      </div>
    </Card>
  );
}

// ─── Status actions ─────────────────────────────────────────────────────────
// The four statuses the client wants up top. Each opens Lab work filtered to it.

const STATUS_STYLE: Record<Attention, { short: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  ready: { short: 'To dispatch', icon: FilledTruck, color: 'text-go-warn' },
  arriving: { short: 'Arriving', icon: FilledPackage, color: 'text-go-brand' },
  questions: { short: 'Questions', icon: FilledChatBubble, color: 'text-go-pink' },
  overdue: { short: 'Overdue', icon: FilledClock, color: 'text-go-bad' },
};

function StatusActions({ cases }: { cases: LabCase[] }) {
  const navigate = useNavigate();
  return (
    // One quiet card, four columns: icon + count on one line, short label under
    <Card className="grid grid-cols-4 divide-x divide-go-line py-3">
      {ATTENTION.map(a => {
        const n = cases.filter(c => matchesAttention(c, a.id)).length;
        const s = STATUS_STYLE[a.id];
        const Icon = s.icon;
        return (
          <button key={a.id} onClick={() => navigate(`/go/work?f=${a.id}`)} aria-label={`${a.label}: ${n}`}
            className="flex flex-col items-center gap-1 px-1 active:scale-95 transition">
            <span className="flex items-center gap-1.5">
              <Icon className={cx('w-[18px] h-[18px]', n ? s.color : 'text-go-faint')} />
              <span className={cx('text-[20px] font-bold tabular-nums leading-none', n ? 'text-go-ink' : 'text-go-faint')}>{n}</span>
            </span>
            <span className="text-[11px] font-medium text-go-muted whitespace-nowrap">{s.short}</span>
          </button>
        );
      })}
    </Card>
  );
}

// ─── Next 7 days: strip + that day's agenda ─────────────────────────────────

function WeekAgenda({ cases }: { cases: LabCase[] }) {
  const days = Array.from({ length: 7 }, (_, i) => i + 1).map(off => ({
    off, d: new Date(Date.now() + off * 864e5),
    items: cases.filter(c => c.appointment && dayOffset(c.appointment.at) === off)
      .sort((a, b) => a.appointment!.at.localeCompare(b.appointment!.at)),
  }));
  const [sel, setSel] = useState(() => days.find(d => d.items.length)?.off ?? 1);
  const day = days.find(d => d.off === sel)!;

  return (
    <Card className="p-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ off, d, items }) => {
          const on = sel === off;
          const risk = items.some(c => readiness(c).level === 'at-risk');
          return (
            <button key={off} onClick={() => setSel(off)} aria-pressed={on}
              className={cx('rounded-2xl py-2 flex flex-col items-center transition',
                on ? 'go-grad text-white go-glow' : risk ? 'bg-go-bad-soft' : 'hover:bg-go-raised')}>
              <span className={cx('text-[10px] font-semibold uppercase', on ? 'text-white/80' : 'text-go-muted')}>{d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}</span>
              <span className={cx('text-[15px] font-bold tabular-nums mt-0.5', on ? 'text-white' : items.length ? 'text-go-ink' : 'text-go-faint')}>{d.getDate()}</span>
              <span className="flex gap-0.5 h-1.5 mt-1">
                {items.slice(0, 3).map(c => <span key={c.id} className={cx('w-1.5 h-1.5 rounded-full', on ? 'bg-white' : READINESS_DOT[readiness(c).level])} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t border-go-line pt-1 -mx-1">
        {day.items.map(c => <ApptRow key={c.id} c={c} />)}
        {!day.items.length && <p className="text-[12.5px] text-go-muted text-center py-4">Nothing booked.</p>}
      </div>
    </Card>
  );
}

// Lab-stage groups — used by the Lab work board.
export const PIPELINE: { id: string; label: string; match: (c: LabCase) => boolean; cls: string }[] = [
  { id: 'ready', label: 'To send', match: c => c.stage === 'ready', cls: 'bg-go-warn' },
  { id: 'transit', label: 'To lab', match: c => c.stage === 'dispatched', cls: 'bg-go-teal' },
  { id: 'lab', label: 'At lab', match: c => c.stage === 'at-lab' || c.stage === 'production', cls: 'bg-go-violet' },
  { id: 'back', label: 'Coming back', match: c => c.stage === 'shipped', cls: 'bg-go-brand' },
  { id: 'in', label: 'In practice', match: c => c.stage === 'received', cls: 'bg-go-ok' },
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigate = useNavigate();
  const { notices } = useGo();
  const { cases } = useScoped();
  const unread = notices.filter(n => !n.read).length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const label = (t: string) => <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted px-1 mb-2">{t}</h2>;

  return (
    <Screen tabs>
      <div className="relative">
        <div className="absolute -top-28 -right-16 w-72 h-72 rounded-full bg-go-lav/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3 px-5 pt-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-go-ink tracking-tight leading-tight">{greet}, Dr {ME.name.split(' ').pop()}</h1>
            <p className="text-[12.5px] text-go-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · <PracticeSwitcher inline />
            </p>
          </div>
          <button onClick={() => navigate('/go/notifications')} aria-label="Notifications"
            className="relative w-10 h-10 rounded-full bg-go-surface border border-go-line flex items-center justify-center text-go-ink flex-shrink-0">
            <Bell className="w-5 h-5" />
            {!!unread && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-go-bad ring-2 ring-go-surface" />}
          </button>
        </div>
      </div>

      <div className="px-4 mt-4"><StatusActions cases={cases} /></div>
      <div className="px-4 mt-4"><TodayRail cases={cases} /></div>
      <div className="px-4 mt-5">
        {label('Next 7 days')}
        <WeekAgenda cases={cases} />
      </div>
    </Screen>
  );
}
