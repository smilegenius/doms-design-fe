// ─── Home — the clinician's day ──────────────────────────────────────────────
// The four statuses the client asked for (Overdue · To dispatch · On hold ·
// Draft) as hero tiles, each opening Lab work filtered to it. No case list
// here. Dates only, no times.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Bell, Building2, Camera, Check, ChevronDown, ChevronRight, IconType, Mic, PenLine, Plus, Receipt } from '../components/icons';
import { FEATURES, ME, useGo, useScoped } from '../store/store';
import { ATTENTION, HomeStatus, LabCase, PRACTICES, gbp, initials, invoiceNeedsAction, matchesAttention, patientById } from '../data/data';
import { Card, Grad, IconTile, NewWorkSheet, Screen, Sheet, T, cx, useCardShadow } from '../components/ui';
import { HERO, StatusChip, statusShort } from '../components/status';
import { useTheme } from '../theme/ThemeRoot';
import type { TokenName } from '../theme/tokens';

export function PracticeSwitcher({ inline }: { inline?: boolean }) {
  const { practice, setPractice, cases, soloPractice } = useGo();
  const [open, setOpen] = useState(false);
  // One-practice user: just the practice name, no dropdown
  if (soloPractice) {
    const name = PRACTICES.find(p => p.id === soloPractice)!.name;
    return inline
      ? <T className="text-[22px] font-bold tracking-[-0.4px] leading-[28px]">{name}</T>
      : <T className="text-[13px] font-semibold">{name}</T>;
  }
  const label = practice === 'all' ? 'All my practices' : PRACTICES.find(p => p.id === practice)!.name;
  const opts = [{ id: 'all' as const, name: 'All my practices', area: `${PRACTICES.length} practices` }, ...PRACTICES];
  return (
    <>
      {inline ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Practice: ${label}`}
          className="flex-row items-center gap-1 self-start active:opacity-70">
          <T className="text-[22px] font-bold tracking-[-0.4px] leading-[28px] flex-shrink" numberOfLines={1}>{label}</T>
          <ChevronDown className="w-5 h-5 text-go-brand" />
        </Pressable>
      ) : (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Practice: ${label}`}
          className="flex-row items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-go-surface border border-go-line max-w-[220px] self-start active:opacity-80">
          <View className="w-7 h-7 rounded-full bg-go-brand-soft items-center justify-center"><Building2 className="w-4 h-4 text-go-brand" /></View>
          <T className="text-[13px] font-semibold truncate flex-shrink">{label}</T>
          <ChevronDown className="w-4 h-4 text-go-muted" />
        </Pressable>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Practice" sub={FEATURES.invoices ? 'Choose which practice’s lab work and invoices to show.' : 'Choose which practice’s lab work to show.'}>
        <View className="gap-2">
          {opts.map(p => {
            const n = p.id === 'all' ? cases.length : cases.filter(c => c.practice === p.id).length;
            const on = practice === p.id;
            return (
              <Pressable key={p.id} onPress={() => { setPractice(p.id); setOpen(false); }}
                accessibilityRole="button" accessibilityState={{ selected: on }}
                className={cx('w-full flex-row items-center gap-3 p-3.5 rounded-2xl border active:opacity-80', on ? 'border-go-brand bg-go-brand-soft' : 'border-go-line')}>
                <IconTile icon={<Building2 className={cx('w-5 h-5', on ? 'text-go-brand-ink' : 'text-go-ink2')} />} tone={on ? 'brand' : 'neutral'} size="sm" />
                <View className="flex-1 min-w-0">
                  <T className="text-[15px] font-semibold">{p.name}</T>
                  <T className="text-[12px] text-go-muted">{p.area} · {n} case{n === 1 ? '' : 's'}</T>
                </View>
                {on && <Check className="w-5 h-5 text-go-brand" strokeWidth={2.5} />}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

// Invoices strip (switched off for now). Latest comments was removed on 8 Oct.

const subhead = (t: string) => <T className="text-[11px] font-bold uppercase tracking-[1.5px] text-go-muted px-1 mb-2">{t}</T>;

/** Open invoices · total · approved this month (portal: Financial actions). */
function FinanceStrip() {
  const { invoices } = useScoped();
  const open = invoices.filter(i => invoiceNeedsAction(i.status));
  const total = (xs: typeof invoices) => xs.reduce((s, i) => s + i.net + i.vat, 0);
  const approved = invoices.filter(i => i.status === 'approved' || i.status === 'xero');
  return (
    <Card onPress={() => router.push('/invoices')} className="p-3.5 flex-row items-center gap-3">
      <IconTile icon={<Receipt className="w-5 h-5 text-go-brand-ink" />} tone="brand" size="sm" />
      <View className="flex-1 min-w-0">
        <T className="text-[13.5px] font-semibold">{open.length} invoice{open.length === 1 ? '' : 's'} to review</T>
        <T className="text-[11.5px] text-go-muted truncate">{gbp(total(open))} to settle · {gbp(total(approved))} approved</T>
      </View>
      <ChevronRight className="w-4 h-4 text-go-faint" />
    </Card>
  );
}

// ─── The status tiles ───────────────────────────────────────────────────────
// Tinted gradient, glossy icon chip, big count, label and the patients'
// initials (no sub-text; lateness shows on each case's pill in Lab work).
// A tile opens Lab work filtered to it. Only statuses with work show; with an
// odd count the first (most urgent) spans the full width. Order: dashOrder.

function Faces({ list }: { list: LabCase[] }) {
  const n = list.length;
  // The web `ring-2 ring-go-surface` → a 2px surface-coloured rim around each dot
  const dot = (key: string, text: string, tone: string, first: boolean) => (
    <View key={key} className={cx('w-8 h-8 rounded-full bg-go-surface p-0.5', !first && '-ml-1.5')}>
      <View className="flex-1 rounded-full bg-go-raised border border-go-line items-center justify-center">
        <T className={cx('text-[9.5px] font-bold', tone)}>{text}</T>
      </View>
    </View>
  );
  return (
    <View className="flex-row">
      {list.slice(0, 3).map((c, i) => dot(c.id, initials(patientById(c.patientId).name), 'text-go-ink2', i === 0))}
      {n > 3 && dot('more', `+${n - 3}`, 'text-go-muted', false)}
    </View>
  );
}

function StatusTile({ id, list, wide }: { id: HomeStatus; list: LabCase[]; wide?: boolean }) {
  const { c } = useTheme();
  const shadow = useCardShadow();
  const a = ATTENTION.find(x => x.id === id)!;
  const h = HERO[id];
  const Icon: IconType = h.icon;
  const n = list.length;
  const open = () => router.push({ pathname: '/work', params: { f: id } });

  const label = (
    <View className="flex-row items-center gap-1">
      <T className="text-[13.5px] font-semibold">{statusShort(id)}</T>
      <ChevronRight className="w-3.5 h-3.5 text-go-faint" />
    </View>
  );

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${a.label}: ${n}`}
      className="flex-1 rounded-[24px] active:opacity-90" style={shadow}>
      <LinearGradient colors={[c[h.soft as TokenName], c.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        className={cx('flex-1 rounded-[24px] border overflow-hidden', h.ring, wide ? 'flex-row items-center gap-3.5 p-4' : 'p-3.5 pb-3')}>
        {/* Oversized faded watermark icon (the web's blurred corner glow is dropped) */}
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -12, right: -12, opacity: 0.07 }}>
          <Icon size={80} color={c[h.glow as TokenName]} />
        </View>
        {wide ? (
          <>
            <StatusChip id={id} size={48} />
            <View className="flex-1 min-w-0">
              {label}
              <View className="mt-2"><Faces list={list} /></View>
            </View>
            <T className="text-[44px] leading-[48px] font-bold tracking-[-0.8px] pr-1" style={{ fontVariant: ['tabular-nums'] }}>{n}</T>
          </>
        ) : (
          <>
            <View className="flex-row items-center justify-between">
              <StatusChip id={id} size={40} />
              <Faces list={list} />
            </View>
            <T className="text-[34px] leading-[38px] font-bold tracking-[-0.6px] mt-3" style={{ fontVariant: ['tabular-nums'] }}>{n}</T>
            <View className="mt-1.5">{label}</View>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const GAP = 10; // gap-2.5

function StatusTiles({ cases }: { cases: LabCase[] }) {
  const { dashOrder } = useGo();
  // Two columns: tile width measured from the grid (flex-wrap + exact half widths)
  const [w, setW] = useState(0);
  const live = dashOrder
    .map(id => ({ id, list: cases.filter(c => matchesAttention(c, id)) }))
    .filter(x => x.list.length > 0);
  if (!live.length) {
    return (
      <Card className="p-4 flex-row items-center gap-3">
        <IconTile icon={<Check className="w-5 h-5 text-go-ok" strokeWidth={2.5} />} tone="ok" size="sm" />
        <View className="flex-1 min-w-0">
          <T className="text-[14px] font-semibold">All clear</T>
          <T className="text-[12px] text-go-muted">Nothing needs your attention right now.</T>
        </View>
      </Card>
    );
  }
  // With 1 or 3 statuses the first (most urgent) spans the full width
  const wideFirst = live.length % 2 === 1;
  const half = w ? (w - GAP) / 2 : undefined;
  return (
    <View className="flex-row flex-wrap" style={{ gap: GAP }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {live.map((x, i) => {
        const wide = wideFirst && i === 0;
        return (
          <Animated.View key={x.id} entering={FadeInUp.delay(i * 50)} className="flex-row min-w-0"
            style={{ width: wide ? '100%' : half ?? '48%' }}>
            <StatusTile id={x.id} list={x.list} wide={wide} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Brand-new practice: no lab work at all yet. One clear way in. */
function EmptyHome() {
  const [open, setOpen] = useState(false);
  const { c } = useTheme();
  const shadow = useCardShadow();
  const ways = [
    { icon: Mic, label: 'By audio', tone: 'text-go-pink' },
    { icon: Camera, label: 'By photo', tone: 'text-go-brand' },
    { icon: PenLine, label: 'Manually', tone: 'text-go-violet' },
  ];
  return (
    <>
      <Animated.View entering={FadeInUp}>
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Create your lab work"
          className="rounded-[28px] active:opacity-90" style={shadow}>
          {/* The web's two blurred glow blobs are dropped */}
          <LinearGradient colors={[c['brand-soft'], c.surface, c['violet-soft']]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="rounded-[28px] border border-go-brand/25 overflow-hidden p-5">
            <Grad glow className="w-14 h-14 rounded-[20px] items-center justify-center" style={{ borderRadius: 20 }}>
              <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
            </Grad>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <T className="text-[22px] font-bold tracking-[-0.4px] leading-[28px]">Create your lab work</T>
              <ChevronRight className="w-5 h-5 text-go-brand" />
            </View>
            <T className="text-[13px] text-go-ink2 mt-1 leading-[18px]">Speak, take a photo of the paper form, or fill it in. Your cases will appear here.</T>
            <View className="flex-row gap-2 mt-4">
              {ways.map(w => (
                <View key={w.label} className="flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl bg-go-surface/80 border border-go-line">
                  <w.icon className={cx('w-4 h-4', w.tone)} />
                  <T className="text-[12px] font-semibold text-go-ink2" numberOfLines={1}>{w.label}</T>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
      <NewWorkSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { notices } = useGo();
  const { cases } = useScoped();
  const unread = notices.filter(n => !n.read).length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen tabs>
      <View className="flex-row items-start justify-between gap-3 px-5 pt-3">
        <View className="flex-1 min-w-0">
          {/* Small greeting on top; the practice is the headline (and the switcher) */}
          <T className="text-[12.5px] text-go-muted">
            {greet}, <T className="text-[12.5px] font-semibold text-go-ink2">{ME.first}</T> · {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </T>
          <View className="mt-0.5" accessibilityRole="header"><PracticeSwitcher inline /></View>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications"
          className="w-10 h-10 rounded-full bg-go-surface border border-go-line items-center justify-center active:bg-go-raised">
          <Bell className="w-5 h-5 text-go-ink" />
          {!!unread && <View className="absolute top-[6px] right-[8px] w-3 h-3 rounded-full bg-go-bad border-2 border-go-surface" />}
        </Pressable>
      </View>

      {!cases.length ? (
        <View className="px-4 mt-5"><EmptyHome /></View>
      ) : (
        <>
          <View className="px-4 mt-4"><StatusTiles cases={cases} /></View>
          {/* Switched off for now (FEATURES.invoices) */}
          {FEATURES.invoices && <View className="px-4 mt-5">{subhead('Invoices')}<FinanceStrip /></View>}
        </>
      )}
    </Screen>
  );
}
