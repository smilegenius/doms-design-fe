// ─── Account · settings pages · Notifications ────────────────────────────────
// Ported from the web prototype's screens/Account.tsx.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell, Building2, ChevronDown, ChevronRight, Clock, FileText, LayoutGrid, Layers as LayoutList, LogOut, MessageSquare, Monitor, Moon, PackageCheck, Receipt, Sun,
} from '../components/icons';
import { ME, Notice, NotifyPrefs, ThemePref, useGo } from '../store/store';
import { HOME_STATUSES, PRACTICES, fmtDateTime, relDay } from '../data/data';
import { StatusChip, statusShort } from '../components/status';
import { Avatar, Btn, Card, EmptyState, Grad, IconTile, Rows, Screen, Section, T, TONE_TEXT, Toggle, TopBar, Tone, cx } from '../components/ui';

// Mini preview — fixed colours so each card shows its own theme (as on the web).
const pal = (dark: boolean) => dark
  ? { bg: '#070710', card: '#10101E', line: '#26263A' }
  : { bg: '#F6F7FB', card: '#FFFFFF', line: '#E0E0E6' };

function Half({ dark }: { dark: boolean }) {
  const p = pal(dark);
  return (
    <View className="flex-1 p-1.5 gap-1" style={{ backgroundColor: p.bg }}>
      <LinearGradient colors={['#4D8EF7', '#A59DFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 8, width: '60%', borderRadius: 999 }} />
      <View className="h-5 rounded-md" style={{ backgroundColor: p.card, borderWidth: 1, borderColor: p.line }} />
      <View className="h-5 rounded-md" style={{ backgroundColor: p.card, borderWidth: 1, borderColor: p.line }} />
    </View>
  );
}

function ThemeCard({ v, label, icon }: { v: ThemePref; label: string; icon: (cls: string) => React.ReactNode }) {
  const { themePref, setThemePref } = useGo();
  const on = themePref === v;
  const colour = on ? 'text-go-brand' : 'text-go-ink2';
  return (
    <Pressable onPress={() => setThemePref(v)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
      className={cx('flex-1 rounded-2xl border-2 p-2 active:opacity-90', on ? 'border-go-brand' : 'border-go-line')}>
      <View className="h-20 rounded-xl overflow-hidden flex-row border border-go-line">
        {v === 'system' ? <><Half dark={false} /><Half dark /></> : <Half dark={v === 'dark'} />}
      </View>
      <View className="mt-2 flex-row items-center gap-1.5 self-start">
        {icon(cx('w-3.5 h-3.5', colour))}
        <T className={cx('text-[12.5px] font-semibold', colour)}>{label}</T>
      </View>
    </Pressable>
  );
}

// ─── Account: a list of settings, each opening its own page ─────────────────
// Account › Appearance · Your practices · Notifications · Home screen order
// (+ Review scenarios in development builds only).

/** One settings row: icon, name, current value, chevron. icon receives its colour class (RN icons don't inherit). */
function SettingRow({ icon, tone, label, value, to }: { icon: (cls: string) => React.ReactNode; tone: Tone; label: string; value: string; to: string }) {
  return (
    <Pressable onPress={() => router.push(to as never)} accessibilityRole="button" accessibilityLabel={label}
      className="w-full flex-row items-center gap-3 px-4 py-3.5 active:bg-go-raised">
      <IconTile icon={icon(cx('w-5 h-5', TONE_TEXT[tone]))} tone={tone} size="sm" />
      <View className="flex-1 min-w-0">
        <T className="text-[15px] font-semibold text-go-ink">{label}</T>
        <T className="text-[12.5px] text-go-muted truncate">{value}</T>
      </View>
      <ChevronRight className="w-4 h-4 text-go-faint" />
    </Pressable>
  );
}

const THEME_NAME: Record<ThemePref, string> = { light: 'Light', dark: 'Dark', system: 'Same as my phone' };

export function AccountScreen() {
  const { signOut, themePref, notifyPrefs, dashOrder } = useGo();
  const nOn = Object.values(notifyPrefs).filter(Boolean).length;
  return (
    <Screen tabs header={<TopBar large title="Account" />}>
      <View className="px-4">
        {/* The web's blurred lavender glow in the corner is dropped (no blur natively). */}
        <Card className="p-5 overflow-hidden">
          <View className="flex-row items-center gap-4">
            <Avatar name={ME.name} size={60} />
            <View className="flex-1 min-w-0">
              <T className="text-[18px] font-bold text-go-ink">{ME.name}</T>
              <T className="text-[13px] text-go-muted">{ME.role}</T>
              <T className="text-[12px] text-go-faint truncate">{ME.email}</T>
            </View>
          </View>
        </Card>
      </View>

      <Section title="Settings">
        <Card className="overflow-hidden">
          <Rows>
            <SettingRow to="/account/appearance" icon={cls => <Sun className={cls} />} tone="brand" label="Appearance" value={THEME_NAME[themePref]} />
            <SettingRow to="/account/practices" icon={cls => <Building2 className={cls} />} tone="teal" label="Your practices" value={`${PRACTICES.length} practice${PRACTICES.length === 1 ? '' : 's'}`} />
            <SettingRow to="/account/notifications" icon={cls => <Bell className={cls} />} tone="pink" label="Notifications" value={nOn ? `${nOn} of 3 turned on` : 'All turned off'} />
            <SettingRow to="/account/dashboard" icon={cls => <LayoutList className={cls} />} tone="violet" label="Home screen order"
              value={dashOrder.slice(0, 3).map(statusShort).join(', ') + '…'} />
            {/* Development builds only — replaces the web prototype's desktop side panel. Delete for production. */}
            {__DEV__ && (
              <SettingRow to="/account/review" icon={cls => <LayoutGrid className={cls} />} tone="neutral" label="Review scenarios" value="Jump to any screen or state" />
            )}
          </Rows>
        </Card>
      </Section>

      <View className="px-4 mt-6">
        {/* Secondary button with red text (the web's `!text-go-bad` override on Btn) */}
        <Pressable onPress={() => { signOut(); router.replace('/signin'); }} accessibilityRole="button" accessibilityLabel="Sign out"
          className="self-stretch h-[52px] px-5 rounded-2xl bg-go-surface border border-go-line flex-row items-center justify-center gap-2 active:opacity-90">
          <LogOut className="w-[18px] h-[18px] text-go-bad" />
          <T className="text-[15px] font-semibold text-go-bad">Sign out</T>
        </Pressable>
        <T className="text-center text-[11.5px] text-go-faint mt-4">Smile Genius Go</T>
      </View>
    </Screen>
  );
}

const SubPage = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Screen header={<TopBar back fallback="/account" title={title} />}>{children}</Screen>
);

export function AppearanceSettings() {
  return (
    <SubPage title="Appearance">
      <Section title="Colour scheme" className="!mt-3">
        <View className="flex-row gap-2.5">
          <ThemeCard v="light" label="Light" icon={cls => <Sun className={cls} />} />
          <ThemeCard v="dark" label="Dark" icon={cls => <Moon className={cls} />} />
          <ThemeCard v="system" label="Auto" icon={cls => <Monitor className={cls} />} />
        </View>
        <T className="text-[12.5px] text-go-muted mt-3 px-1">Auto follows your phone’s light or dark setting.</T>
      </Section>
    </SubPage>
  );
}

export function PracticesSettings() {
  const { cases } = useGo();
  return (
    <SubPage title="Your practices">
      <Section title={`Practices you work at · ${PRACTICES.length}`} className="!mt-3">
        <Card>
          <Rows>
            {PRACTICES.map(p => (
              <View key={p.id} className="flex-row items-center gap-3 p-4">
                <IconTile icon={<Building2 className="w-5 h-5 text-go-brand-ink" />} tone="brand" size="sm" />
                <View className="flex-1 min-w-0">
                  <T className="text-[15px] font-semibold text-go-ink">{p.name}</T>
                  <T className="text-[12.5px] text-go-muted">{p.area} · {cases.filter(c => c.practice === p.id).length} cases</T>
                </View>
              </View>
            ))}
          </Rows>
        </Card>
        <T className="text-[12.5px] text-go-muted mt-3 px-1">To be added to another practice, please ask your practice manager.</T>
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
        <Card>
          <Rows>
            {rows.map(r => (
              <View key={r.k} className="flex-row items-center gap-3 p-4">
                <View className="flex-1">
                  <T className="text-[15px] font-semibold text-go-ink">{r.label}</T>
                  <T className="text-[12.5px] text-go-muted">{r.sub}</T>
                </View>
                <Toggle on={notifyPrefs[r.k]} onChange={v => setNotifyPref(r.k, v)} label={r.label} />
              </View>
            ))}
          </Rows>
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
      <T className="text-[13.5px] text-go-ink2 px-5 pt-2 leading-[19px]">
        Choose the order of the boxes on your Home screen. The one at the top is shown first. Boxes with nothing in them are hidden.
      </T>
      <Section title="Order" className="!mt-4">
        <Card className="overflow-hidden">
          <Rows>
            {dashOrder.map((id, i) => (
              <View key={id} className="flex-row items-center gap-3 pl-4 pr-2 py-2.5">
                <T className="w-5 text-[13px] font-bold text-go-faint" style={{ fontVariant: ['tabular-nums'] }}>{i + 1}</T>
                <StatusChip id={id} size={34} />
                <T className="flex-1 text-[15px] font-semibold text-go-ink">{statusShort(id)}</T>
                <Pressable onPress={() => move(i, -1)} disabled={i === 0} accessibilityRole="button" accessibilityLabel={`Move ${statusShort(id)} up`}
                  className={cx('w-10 h-10 rounded-full items-center justify-center active:bg-go-raised', i === 0 && 'opacity-25')}>
                  <ChevronDown className="w-5 h-5 text-go-ink2" style={{ transform: [{ rotate: '180deg' }] }} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} disabled={i === dashOrder.length - 1} accessibilityRole="button" accessibilityLabel={`Move ${statusShort(id)} down`}
                  className={cx('w-10 h-10 rounded-full items-center justify-center active:bg-go-raised', i === dashOrder.length - 1 && 'opacity-25')}>
                  <ChevronDown className="w-5 h-5 text-go-ink2" />
                </Pressable>
              </View>
            ))}
          </Rows>
        </Card>
      </Section>
      <View className="px-4 mt-4">
        <Btn block variant="secondary" disabled={isDefault} onPress={() => { setDashOrder([...HOME_STATUSES]); toast('Usual order restored'); }}>
          Put back to the usual order
        </Btn>
      </View>
    </SubPage>
  );
}

const NOTICE_ICON: Record<Notice['kind'], { icon: React.ReactNode; tone: Tone }> = {
  question: { icon: <MessageSquare className="w-5 h-5 text-go-pink" />, tone: 'pink' },
  shipped: { icon: <PackageCheck className="w-5 h-5 text-go-ok" />, tone: 'ok' },
  invoice: { icon: <Receipt className="w-5 h-5 text-go-warn" />, tone: 'warn' },
  overdue: { icon: <Clock className="w-5 h-5 text-go-bad" />, tone: 'bad' },
  statement: { icon: <FileText className="w-5 h-5 text-go-brand-ink" />, tone: 'brand' },
};

export function NotificationsScreen() {
  const { notices, markNoticesRead } = useGo();
  const unread = notices.filter(n => !n.read).length;
  const groups = [
    { title: 'Today', items: notices.filter(n => relDay(n.at) === 'Today') },
    { title: 'Earlier', items: notices.filter(n => relDay(n.at) !== 'Today') },
  ].filter(g => g.items.length);
  return (
    <Screen header={<TopBar back title="Notifications" right={unread ? (
      <Pressable onPress={markNoticesRead} accessibilityRole="button" hitSlop={6} className="pr-1">
        <T className="text-[13px] font-semibold text-go-brand">Mark all read</T>
      </Pressable>
    ) : undefined} />}>
      {!notices.length && <EmptyState icon={<Bell className="w-7 h-7 text-go-muted" />} title="Nothing here yet" body="We’ll let you know when there’s news about your lab work." />}
      {groups.map(g => (
        <Section key={g.title} title={g.title} className="!mt-3">
          <Card className="overflow-hidden">
            <Rows>
              {g.items.map(n => {
                const s = NOTICE_ICON[n.kind];
                return (
                  <Pressable key={n.id} onPress={() => router.push(n.to as never)} accessibilityRole="button"
                    className={cx('w-full flex-row items-start gap-3 p-4 active:bg-go-raised', !n.read && 'bg-go-brand-soft/40')}>
                    <IconTile icon={s.icon} tone={s.tone} size="sm" />
                    <View className="flex-1 min-w-0">
                      <T className={cx('text-[14px] text-go-ink', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</T>
                      <T className="text-[12.5px] text-go-muted mt-0.5 leading-[17px]">{n.body}</T>
                      <T className="text-[11px] text-go-faint mt-1">{fmtDateTime(n.at)}</T>
                    </View>
                    {!n.read && <Grad className="w-2.5 h-2.5 rounded-full mt-1.5" />}
                  </Pressable>
                );
              })}
            </Rows>
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
