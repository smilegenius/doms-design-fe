import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Building2, Clock, FileText, LogOut, MessageSquare, Monitor, Moon, PackageCheck, Receipt, ShieldCheck, Sun } from '../icons';
import { ME, Notice, ThemePref, useGo } from '../store';
import { PRACTICES, fmtDateTime, relDay } from '../data';
import { Avatar, Btn, Card, EmptyState, IconTile, Screen, Section, Toggle, TopBar, Tone, cx } from '../ui';

function ThemeCard({ v, label, icon }: { v: ThemePref; label: string; icon: React.ReactNode }) {
  const { themePref, setThemePref } = useGo();
  const on = themePref === v;
  // Mini preview — fixed colours so each card shows its own theme.
  const pal = (dark: boolean) => dark
    ? { bg: '#070710', card: '#10101E', line: '#26263A' }
    : { bg: '#F6F7FB', card: '#FFFFFF', line: '#E0E0E6' };
  const Half = ({ dark }: { dark: boolean }) => {
    const p = pal(dark);
    return (
      <div className="flex-1 p-1.5 space-y-1" style={{ background: p.bg }}>
        <div className="h-2 w-3/5 rounded-full" style={{ background: 'linear-gradient(90deg,#4D8EF7,#A59DFF)' }} />
        <div className="h-5 rounded-md" style={{ background: p.card, border: `1px solid ${p.line}` }} />
        <div className="h-5 rounded-md" style={{ background: p.card, border: `1px solid ${p.line}` }} />
      </div>
    );
  };
  return (
    <button onClick={() => setThemePref(v)} aria-pressed={on}
      className={cx('flex-1 rounded-2xl border-2 p-2 transition', on ? 'border-go-brand' : 'border-go-line')}>
      <div className="h-20 rounded-xl overflow-hidden flex border border-go-line">
        {v === 'system' ? <><Half dark={false} /><Half dark /></> : <Half dark={v === 'dark'} />}
      </div>
      <p className={cx('mt-2 text-[12.5px] font-semibold inline-flex items-center gap-1.5', on ? 'text-go-brand' : 'text-go-ink2')}>{icon}{label}</p>
    </button>
  );
}

export function AccountScreen() {
  const navigate = useNavigate();
  const { signOut, cases } = useGo();
  const [prefs, setPrefs] = useState({ questions: true, arrivals: true, overdue: true });
  const rows: { k: keyof typeof prefs; label: string; sub: string }[] = [
    { k: 'questions', label: 'Additional information required', sub: 'When a lab needs more details before it can carry on' },
    { k: 'arrivals', label: 'Cases on their way back', sub: 'When a lab sends a case back to your practice' },
    { k: 'overdue', label: 'Overdue cases', sub: 'A morning reminder if a case has missed its delivery date' },
  ];
  return (
    <Screen tabs header={<TopBar large title="Account" />}>
      <div className="px-4">
        <Card className="p-5 relative overflow-hidden">
          <span className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-go-lav/25 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <Avatar name={ME.name} size={60} />
            <div className="min-w-0">
              <p className="text-[18px] font-bold text-go-ink">{ME.name}</p>
              <p className="text-[13px] text-go-muted">{ME.role}</p>
              <p className="text-[12px] text-go-faint truncate">{ME.email}</p>
            </div>
          </div>
        </Card>
      </div>

      <Section title="Appearance">
        <div className="flex gap-2.5">
          <ThemeCard v="light" label="Light" icon={<Sun className="w-3.5 h-3.5" />} />
          <ThemeCard v="dark" label="Dark" icon={<Moon className="w-3.5 h-3.5" />} />
          <ThemeCard v="system" label="Auto" icon={<Monitor className="w-3.5 h-3.5" />} />
        </div>
      </Section>

      <Section title={`Assigned practices · ${PRACTICES.length}`}>
        <Card className="divide-y divide-go-line">
          {PRACTICES.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <IconTile icon={<Building2 className="w-5 h-5" />} tone="brand" size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-go-ink">{p.name}</p>
                <p className="text-[12px] text-go-muted">{p.area} · {cases.filter(c => c.practice === p.id).length} cases</p>
              </div>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Notifications">
        <Card className="divide-y divide-go-line">
          {rows.map(r => (
            <div key={r.k} className="flex items-center gap-3 p-4">
              <div className="flex-1"><p className="text-[14px] font-semibold text-go-ink">{r.label}</p><p className="text-[12px] text-go-muted">{r.sub}</p></div>
              <Toggle on={prefs[r.k]} onChange={v => setPrefs(s => ({ ...s, [r.k]: v }))} label={r.label} />
            </div>
          ))}
        </Card>
      </Section>

      <div className="px-4 mt-6">
        <Btn block variant="secondary" className="!text-go-bad" icon={<LogOut className="w-[18px] h-[18px]" />}
          onClick={() => { signOut(); navigate('/go/signin', { replace: true }); }}>Sign out</Btn>
        <p className="text-center text-[11.5px] text-go-faint mt-4">Smile Genius Go · prototype · demo data</p>
      </div>
    </Screen>
  );
}

const NOTICE_ICON: Record<Notice['kind'], { icon: React.ReactNode; tone: Tone }> = {
  question: { icon: <MessageSquare className="w-5 h-5" />, tone: 'pink' },
  shipped: { icon: <PackageCheck className="w-5 h-5" />, tone: 'ok' },
  invoice: { icon: <Receipt className="w-5 h-5" />, tone: 'warn' },
  overdue: { icon: <Clock className="w-5 h-5" />, tone: 'bad' },
  statement: { icon: <FileText className="w-5 h-5" />, tone: 'brand' },
};

export function NotificationsScreen() {
  const navigate = useNavigate();
  const { notices, markNoticesRead } = useGo();
  const unread = notices.filter(n => !n.read).length;
  const groups = [
    { title: 'Today', items: notices.filter(n => relDay(n.at) === 'Today') },
    { title: 'Earlier', items: notices.filter(n => relDay(n.at) !== 'Today') },
  ].filter(g => g.items.length);
  return (
    <Screen header={<TopBar back title="Notifications" right={unread ? <button onClick={markNoticesRead} className="text-[13px] font-semibold text-go-brand pr-1">Mark all read</button> : undefined} />}>
      {!notices.length && <EmptyState icon={<Bell className="w-7 h-7" />} title="No notifications" />}
      {groups.map(g => (
        <Section key={g.title} title={g.title} className="!mt-3">
          <Card className="divide-y divide-go-line overflow-hidden">
            {g.items.map(n => {
              const s = NOTICE_ICON[n.kind];
              return (
                <button key={n.id} onClick={() => navigate(n.to)} className={cx('w-full text-left flex items-start gap-3 p-4 transition hover:bg-go-raised', !n.read && 'bg-go-brand-soft/40')}>
                  <IconTile icon={s.icon} tone={s.tone} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={cx('text-[14px] text-go-ink', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</p>
                    <p className="text-[12.5px] text-go-muted mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[11px] text-go-faint mt-1">{fmtDateTime(n.at)}</p>
                  </div>
                  {!n.read && <span className="w-2.5 h-2.5 rounded-full go-grad mt-1.5 flex-shrink-0" />}
                </button>
              );
            })}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
