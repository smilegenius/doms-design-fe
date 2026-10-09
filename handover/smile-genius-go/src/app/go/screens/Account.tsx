import { useNavigate } from 'react-router-dom';
import { Bell, Building2, ChevronDown, ChevronRight, Clock, FileText, Layers as LayoutList, LogOut, MessageSquare, Monitor, Moon, PackageCheck, Receipt, Sun } from '../icons';
import { ME, Notice, NotifyPrefs, ThemePref, useGo } from '../store';
import { HOME_STATUSES, PRACTICES, fmtDateTime, relDay } from '../data';
import { StatusChip, statusShort } from './Home';
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

// ─── Account: a list of settings, each opening its own page ─────────────────
// Account › Appearance · Your practices · Notifications · Home screen order.

/** One settings row: icon, name, current value, chevron. */
function SettingRow({ icon, tone, label, value, to }: { icon: React.ReactNode; tone: Tone; label: string; value: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-go-raised transition">
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-go-ink">{label}</span>
        <span className="block text-[12.5px] text-go-muted truncate">{value}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-go-faint flex-shrink-0" />
    </button>
  );
}

const THEME_NAME: Record<ThemePref, string> = { light: 'Light', dark: 'Dark', system: 'Same as my phone' };

export function AccountScreen() {
  const navigate = useNavigate();
  const { signOut, themePref, notifyPrefs, dashOrder } = useGo();
  const nOn = Object.values(notifyPrefs).filter(Boolean).length;
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

      <Section title="Settings">
        <Card className="divide-y divide-go-line overflow-hidden">
          <SettingRow to="/go/account/appearance" icon={<Sun className="w-5 h-5" />} tone="brand" label="Appearance" value={THEME_NAME[themePref]} />
          <SettingRow to="/go/account/practices" icon={<Building2 className="w-5 h-5" />} tone="teal" label="Your practices" value={`${PRACTICES.length} practice${PRACTICES.length === 1 ? '' : 's'}`} />
          <SettingRow to="/go/account/notifications" icon={<Bell className="w-5 h-5" />} tone="pink" label="Notifications" value={nOn ? `${nOn} of 3 turned on` : 'All turned off'} />
          <SettingRow to="/go/account/dashboard" icon={<LayoutList className="w-5 h-5" />} tone="violet" label="Home screen order"
            value={dashOrder.slice(0, 3).map(statusShort).join(', ') + '…'} />
        </Card>
      </Section>

      <div className="px-4 mt-6">
        <Btn block variant="secondary" className="!text-go-bad" icon={<LogOut className="w-[18px] h-[18px]" />}
          onClick={() => { signOut(); navigate('/go/signin', { replace: true }); }}>Sign out</Btn>
        <p className="text-center text-[11.5px] text-go-faint mt-4">Smile Genius Go</p>
      </div>
    </Screen>
  );
}

const SubPage = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Screen header={<TopBar back fallback="/go/account" title={title} />}>{children}</Screen>
);

export function AppearanceSettings() {
  return (
    <SubPage title="Appearance">
      <Section title="Colour scheme" className="!mt-3">
        <div className="flex gap-2.5">
          <ThemeCard v="light" label="Light" icon={<Sun className="w-3.5 h-3.5" />} />
          <ThemeCard v="dark" label="Dark" icon={<Moon className="w-3.5 h-3.5" />} />
          <ThemeCard v="system" label="Auto" icon={<Monitor className="w-3.5 h-3.5" />} />
        </div>
        <p className="text-[12.5px] text-go-muted mt-3 px-1">Auto follows your phone’s light or dark setting.</p>
      </Section>
    </SubPage>
  );
}

export function PracticesSettings() {
  const { cases } = useGo();
  return (
    <SubPage title="Your practices">
      <Section title={`Practices you work at · ${PRACTICES.length}`} className="!mt-3">
        <Card className="divide-y divide-go-line">
          {PRACTICES.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <IconTile icon={<Building2 className="w-5 h-5" />} tone="brand" size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-go-ink">{p.name}</p>
                <p className="text-[12.5px] text-go-muted">{p.area} · {cases.filter(c => c.practice === p.id).length} cases</p>
              </div>
            </div>
          ))}
        </Card>
        <p className="text-[12.5px] text-go-muted mt-3 px-1">To be added to another practice, please ask your practice manager.</p>
      </Section>
    </SubPage>
  );
}

export function NotificationSettings() {
  const { notifyPrefs, setNotifyPref } = useGo();
  const rows: { k: keyof NotifyPrefs; label: string; sub: string }[] = [
    { k: 'questions', label: 'Additional information required', sub: 'When the lab needs more details from you before it can carry on' },
    { k: 'arrivals', label: 'Lab work on its way', sub: 'When the lab sends work back to your practice' },
    { k: 'overdue', label: 'Overdue lab work', sub: 'A reminder each morning if work has missed its delivery date' },
  ];
  return (
    <SubPage title="Notifications">
      <Section title="Tell me when" className="!mt-3">
        <Card className="divide-y divide-go-line">
          {rows.map(r => (
            <div key={r.k} className="flex items-center gap-3 p-4">
              <div className="flex-1"><p className="text-[15px] font-semibold text-go-ink">{r.label}</p><p className="text-[12.5px] text-go-muted">{r.sub}</p></div>
              <Toggle on={notifyPrefs[r.k]} onChange={v => setNotifyPref(r.k, v)} label={r.label} />
            </div>
          ))}
        </Card>
      </Section>
    </SubPage>
  );
}

/** Reorder the Home status tiles (up / down buttons — easier than dragging). */
export function DashboardSettings() {
  const { dashOrder, setDashOrder, toast } = useGo();
  const move = (i: number, d: -1 | 1) => {
    const o = [...dashOrder];
    [o[i], o[i + d]] = [o[i + d], o[i]];
    setDashOrder(o);
  };
  const isDefault = dashOrder.join() === HOME_STATUSES.join();
  return (
    <SubPage title="Home screen order">
      <p className="text-[13.5px] text-go-ink2 px-5 pt-2 leading-snug">
        Choose the order of the boxes on your Home screen. The one at the top is shown first. Boxes with nothing in them are hidden.
      </p>
      <Section title="Order" className="!mt-4">
        <Card className="divide-y divide-go-line overflow-hidden">
          {dashOrder.map((id, i) => (
            <div key={id} className="flex items-center gap-3 pl-4 pr-2 py-2.5">
              <span className="w-5 text-[13px] font-bold text-go-faint tabular-nums">{i + 1}</span>
              <StatusChip id={id} size={34} />
              <span className="flex-1 text-[15px] font-semibold text-go-ink">{statusShort(id)}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${statusShort(id)} up`}
                className="w-10 h-10 rounded-full flex items-center justify-center text-go-ink2 hover:bg-go-raised disabled:opacity-25">
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === dashOrder.length - 1} aria-label={`Move ${statusShort(id)} down`}
                className="w-10 h-10 rounded-full flex items-center justify-center text-go-ink2 hover:bg-go-raised disabled:opacity-25">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          ))}
        </Card>
      </Section>
      <div className="px-4 mt-4">
        <Btn block variant="secondary" disabled={isDefault} onClick={() => { setDashOrder([...HOME_STATUSES]); toast('Usual order restored'); }}>
          Put back to the usual order
        </Btn>
      </div>
    </SubPage>
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
      {!notices.length && <EmptyState icon={<Bell className="w-7 h-7" />} title="Nothing here yet" body="We’ll let you know when there’s news about your lab work." />}
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
