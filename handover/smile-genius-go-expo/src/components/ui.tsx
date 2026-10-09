// ─── Smile Genius Go — mobile UI kit (React Native) ──────────────────────────
// Same components and props as the web prototype's kit, built on React Native.
// Every colour comes from the go-* tokens (NativeWind classes or useTheme()),
// so each component works in light and dark without variants.
//
// RN rules this kit takes care of (read before writing a screen):
//  • All text goes in <T> (never a bare string, never RN's <Text> directly).
//    T maps font-normal/medium/semibold/bold to the Poppins files, and
//    `truncate` / `line-clamp-N` to numberOfLines.
//  • Gradients: <Grad> (brand) or <LinearGradient> — CSS gradient classes don't work natively.
//  • Lists with dividers: <Rows> instead of `divide-y`. Stack with `gap-*`, not `space-y-*`.
//  • Use px for tracking/leading (tracking-[1.5px], leading-[18px]), not em/relative.
//  • Dates: <DateField> (yyyy-mm-dd strings), never a text input.
import { Children, Fragment, createElement, isValidElement, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import type { PressableProps, StyleProp, TextInputProps, TextProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import Animated, { FadeIn, FadeInUp, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { cssInterop, vars } from 'nativewind';
import { cssVars } from '../theme/tokens';
import { router, usePathname } from 'expo-router';
import {
  Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, Home, Info, AlertTriangle, Layers, Mic, PenLine, Plus, Receipt, Search, User, X, CalendarClock,
} from './icons';
import { FEATURES, useGo, useScoped } from '../store/store';
import { LabCase, ReadinessLevel, STAGES, Stage, invoiceNeedsAction, isOverdue, readiness, stageIndex, stageLabel } from '../data/data';
import { useTheme } from '../theme/ThemeRoot';

cssInterop(LinearGradient, { className: 'style' });

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Text ───────────────────────────────────────────────────────────────────

const FONT = { normal: 'Poppins_400Regular', medium: 'Poppins_500Medium', semibold: 'Poppins_600SemiBold', bold: 'Poppins_700Bold' } as const;

/** Every piece of text. className works like on the web; weight → Poppins file, truncate / line-clamp-N → numberOfLines. */
export function T({ className = '', style, numberOfLines, ...rest }: TextProps & { className?: string }) {
  const weight = (className.match(/\bfont-(normal|medium|semibold|bold)\b/)?.[1] ?? 'normal') as keyof typeof FONT;
  const lines = numberOfLines ?? (/\btruncate\b/.test(className) ? 1 : Number(className.match(/\bline-clamp-(\d)\b/)?.[1]) || undefined);
  const cls = className.replace(/\bfont-(normal|medium|semibold|bold)\b/g, '').replace(/\b(truncate|line-clamp-\d)\b/g, '');
  const hasColour = /\btext-(go-|white|black|transparent)/.test(cls);
  return <Text {...rest} numberOfLines={lines} className={cx(!hasColour && 'text-go-ink', 'text-[15px]', cls)} style={[{ fontFamily: FONT[weight] }, style]} />;
}

// ─── Gradients & shadows ────────────────────────────────────────────────────

/** Brand gradient surface (the web `go-grad`). */
export function Grad({ className, style, children, glow }: { className?: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode; glow?: boolean }) {
  const { c } = useTheme();
  return (
    <LinearGradient colors={[c.g1, c.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className={className}
      style={[glow && { shadowColor: c.g1, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }, style]}>
      {children}
    </LinearGradient>
  );
}

/** The web `go-card-shadow`. */
export function useCardShadow(): ViewStyle {
  const { c, theme } = useTheme();
  return { shadowColor: c.shadow, shadowOpacity: theme === 'dark' ? 0.4 : 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 };
}

// ─── Layout ─────────────────────────────────────────────────────────────────

/**
 * A screen: optional header, scrolling body, optional sticky footer (actions in
 * thumb reach). Background is transparent so the app's wash shows through.
 * tabs = leave room for the floating tab bar.
 */
export function Screen({ header, children, footer, tabs, scroll = true, className }: {
  header?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; tabs?: boolean; scroll?: boolean; className?: string;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabs ? 120 : 24 }}>
      {children}
    </ScrollView>
  ) : <View className="flex-1">{children}</View>;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className={cx('flex-1', className)} style={{ paddingTop: insets.top }}>
      {header}
      {body}
      {footer && (
        <View className="border-t border-go-line bg-go-surface/95 px-4 pt-3" style={{ paddingBottom: insets.bottom + 14 }}>
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Back = router back when there is history, else `fallback`. */
export function useBack(fallback = '/home') {
  return () => (router.canGoBack() ? router.back() : router.replace(fallback as never));
}

export function TopBar({ title, sub, back, fallback, right, large }: {
  title?: React.ReactNode; sub?: React.ReactNode; back?: boolean; fallback?: string; right?: React.ReactNode; large?: boolean;
}) {
  const goBack = useBack(fallback);
  return (
    <View className="bg-go-bg/80">
      <View className="flex-row items-center gap-2 px-3 h-14">
        {back ? (
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}
            className="w-10 h-10 -ml-1 rounded-full items-center justify-center active:bg-go-raised">
            <ChevronLeft className="w-6 h-6 text-go-ink" />
          </Pressable>
        ) : <View className="w-1" />}
        {!large ? (
          <View className="flex-1 min-w-0 items-center">
            {!!title && (typeof title === 'string' ? <T className="text-[15px] font-semibold truncate">{title}</T> : title)}
            {!!sub && (typeof sub === 'string' ? <T className="text-[11px] text-go-muted truncate">{sub}</T> : sub)}
          </View>
        ) : <View className="flex-1" />}
        <View className="min-w-[40px] flex-row items-center justify-end gap-1">{right}</View>
      </View>
      {large && (
        <View className="px-5 pb-3">
          {typeof title === 'string' ? <T className="text-[28px] leading-[34px] font-bold">{title}</T> : title}
          {!!sub && <T className="text-[13px] text-go-muted mt-1">{sub}</T>}
        </View>
      )}
    </View>
  );
}

export function IconBtn({ children, onPress, label, badge }: { children: React.ReactNode; onPress?: () => void; label: string; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      className="w-10 h-10 rounded-full items-center justify-center bg-go-surface border border-go-line active:bg-go-raised">
      {children}
      {!!badge && (
        <Grad className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full items-center justify-center">
          <T className="text-white text-[10px] font-bold">{badge}</T>
        </Grad>
      )}
    </Pressable>
  );
}

// ─── Tab bar ────────────────────────────────────────────────────────────────

const TABS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/work', label: 'Lab work', icon: Layers },
  null,
  { to: '/invoices', label: 'Invoices', icon: Receipt },
  { to: '/account', label: 'Account', icon: User },
] as const;

/** Floating tab bar with the centre + (Create lab work). Used as the Tabs navigator's tabBar. */
export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const shadow = useCardShadow();
  const { invoices } = useScoped();
  const [newOpen, setNewOpen] = useState(false);
  const finCount = FEATURES.invoices ? invoices.filter(i => invoiceNeedsAction(i.status)).length : 0;
  return (
    <>
      <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 px-3 pt-2" style={{ paddingBottom: insets.bottom + 10 }}>
        <View className="flex-row items-center justify-around h-16 rounded-[26px] bg-go-surface/95 border border-go-line" style={shadow}>
          {TABS.map((t, i) => {
            if (!t) {
              return (
                <Pressable key="new" onPress={() => setNewOpen(true)} accessibilityRole="button" accessibilityLabel="Create lab work"
                  className="-mt-7 rounded-[22px] border-4 border-go-bg active:opacity-90">
                  <Grad glow className="w-14 h-14 rounded-[18px] items-center justify-center"><Plus className="w-6 h-6 text-white" /></Grad>
                </Pressable>
              );
            }
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            const badge = t.to === '/invoices' ? finCount : 0;
            return (
              <Pressable key={i} onPress={() => router.navigate(t.to as never)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                className="flex-1 items-center gap-0.5 py-1">
                <View className={cx('items-center justify-center w-10 h-7 rounded-full', active && 'bg-go-brand-soft')}>
                  <Icon className={cx('w-5 h-5', active ? 'text-go-brand' : 'text-go-muted')} />
                  {!!badge && <View className="absolute -top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-go-bad items-center justify-center"><T className="text-white text-[9px] font-bold">{badge}</T></View>}
                </View>
                <T className={cx('text-[10px] font-semibold', active ? 'text-go-brand' : 'text-go-muted')}>{t.label}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
      <NewWorkSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

export function NewWorkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const go = (to: string) => { onClose(); router.push(to as never); };
  return (
    <Sheet open={open} onClose={onClose} title="Create lab work" sub="Choose the way that suits you best.">
      <View className="gap-3">
        <ActionTile icon={<Mic className="w-6 h-6 text-go-pink" />} tone="pink" title="By audio" body="Say what you need. We’ll turn it into a case." onPress={() => go('/new/audio')} />
        <ActionTile icon={<Camera className="w-6 h-6 text-go-brand-ink" />} tone="brand" title="By photo" body="Take a photo of a written prescription. We’ll turn it into a case." onPress={() => go('/new/capture')} />
        <ActionTile icon={<PenLine className="w-6 h-6 text-go-violet" />} tone="violet" title="Manually" body="Fill in the form yourself, step by step." onPress={() => go('/new/manual')} />
      </View>
    </Sheet>
  );
}

// ─── Brand ──────────────────────────────────────────────────────────────────

const SMILE = 'M191.419 32.4519C197.375 21.5101 188.444 25.3832 183.234 28.6874C97.2679 83.2079 21.5955 47.9542 7.28707 42.9781C0.305509 40.55 0.30552 40.55 0.30552 40.55C14.7773 57.4099 46.738 74.6491 96.8154 72.5271C151.038 70.2295 183.973 46.1293 191.419 32.4519Z';
const DOT = 'M206.562 24C202.867 24 199.829 22.8817 197.448 20.6452C195.149 18.3226 194 15.4839 194 12.129C194 8.68817 195.149 5.80645 197.448 3.48387C199.829 1.16129 202.867 0 206.562 0C210.174 0 213.13 1.16129 215.429 3.48387C217.81 5.80645 219 8.68817 219 12.129C219 15.4839 217.81 18.3226 215.429 20.6452C213.13 22.8817 210.174 24 206.562 24Z';
const WORD = 'M7.16303 27.1983C5.9568 27.1983 4.88276 26.9917 3.94091 26.5786C2.99906 26.1656 2.25549 25.6037 1.71021 24.8932C1.16492 24.1662 0.859234 23.3565 0.793139 22.4642H4.9819C5.03147 22.9434 5.25454 23.3317 5.65111 23.6292C6.04768 23.9266 6.53513 24.0753 7.11346 24.0753C7.64222 24.0753 8.04705 23.9762 8.32796 23.7779C8.62538 23.5631 8.7741 23.2904 8.7741 22.9599C8.7741 22.5634 8.56755 22.2742 8.15446 22.0925C7.74136 21.8942 7.07215 21.6794 6.14682 21.448C5.1554 21.2167 4.32922 20.9771 3.66827 20.7292C3.00732 20.4649 2.43725 20.06 1.95806 19.5148C1.47887 18.9529 1.23928 18.2011 1.23928 17.2593C1.23928 16.4661 1.45409 15.7473 1.8837 15.1029C2.32985 14.442 2.97427 13.9215 3.81698 13.5414C4.67621 13.1614 5.69242 12.9714 6.86561 12.9714C8.6006 12.9714 9.96381 13.401 10.9552 14.2602C11.9632 15.1194 12.5415 16.2596 12.6902 17.6806H8.7741C8.708 17.2014 8.49319 16.8214 8.12967 16.5405C7.78267 16.2596 7.32001 16.1191 6.74168 16.1191C6.24597 16.1191 5.86592 16.2183 5.60154 16.4166C5.33716 16.5983 5.20497 16.8544 5.20497 17.1849C5.20497 17.5815 5.41152 17.8789 5.82461 18.0772C6.25423 18.2755 6.91518 18.4738 7.80746 18.672C8.83193 18.9364 9.66638 19.2008 10.3108 19.4652C10.9552 19.713 11.517 20.1261 11.9962 20.7045C12.4919 21.2663 12.7481 22.0264 12.7646 22.9847C12.7646 23.7944 12.5332 24.5214 12.0706 25.1659C11.6244 25.7938 10.9718 26.2895 10.1125 26.653C9.26981 27.0165 8.28665 27.1983 7.16303 27.1983ZM33.0049 13.0209C34.7234 13.0209 36.0866 13.5414 37.0945 14.5824C38.119 15.6234 38.6312 17.0692 38.6312 18.9199V27H34.4177V19.49C34.4177 18.5977 34.1781 17.912 33.6989 17.4328C33.2362 16.9371 32.5918 16.6892 31.7656 16.6892C30.9394 16.6892 30.2868 16.9371 29.8076 17.4328C29.3449 17.912 29.1136 18.5977 29.1136 19.49V27H24.9V19.49C24.9 18.5977 24.6604 17.912 24.1812 17.4328C23.7186 16.9371 23.0742 16.6892 22.248 16.6892C21.4218 16.6892 20.7691 16.9371 20.2899 17.4328C19.8272 17.912 19.5959 18.5977 19.5959 19.49V27H15.3576V13.1696H19.5959V14.9046C20.0255 14.3263 20.5873 13.8719 21.2813 13.5414C21.9753 13.1944 22.7602 13.0209 23.636 13.0209C24.677 13.0209 25.6023 13.244 26.4119 13.6901C27.2381 14.1363 27.8826 14.7724 28.3452 15.5986C28.8244 14.8385 29.4771 14.2189 30.3033 13.7397C31.1295 13.2605 32.03 13.0209 33.0049 13.0209ZM43.727 11.7321C42.9834 11.7321 42.3721 11.5173 41.8929 11.0877C41.4302 10.6415 41.1989 10.0962 41.1989 9.45181C41.1989 8.79086 41.4302 8.24557 41.8929 7.81596C42.3721 7.36982 42.9834 7.14675 43.727 7.14675C44.454 7.14675 45.0489 7.36982 45.5116 7.81596C45.9907 8.24557 46.2303 8.79086 46.2303 9.45181C46.2303 10.0962 45.9907 10.6415 45.5116 11.0877C45.0489 11.5173 44.454 11.7321 43.727 11.7321ZM45.8338 13.1696V27H41.5954V13.1696H45.8338ZM53.1436 8.65867V27H48.9052V8.65867H53.1436ZM69.2523 19.8618C69.2523 20.2583 69.2275 20.6714 69.1779 21.101H59.5859C59.652 21.9603 59.9246 22.6212 60.4038 23.0839C60.8995 23.53 61.5026 23.7531 62.2132 23.7531C63.2707 23.7531 64.006 23.3069 64.4191 22.4147H68.9301C68.6987 23.3235 68.2774 24.1414 67.666 24.8684C67.0711 25.5955 66.3193 26.1656 65.4105 26.5786C64.5017 26.9917 63.4855 27.1983 62.3619 27.1983C61.0069 27.1983 59.8007 26.9091 58.7432 26.3308C57.6857 25.7525 56.8595 24.9263 56.2646 23.8522C55.6698 22.7782 55.3723 21.5224 55.3723 20.0848C55.3723 18.6473 55.6615 17.3915 56.2398 16.3174C56.8347 15.2434 57.6609 14.4172 58.7184 13.8389C59.7759 13.2605 60.9904 12.9714 62.3619 12.9714C63.7003 12.9714 64.89 13.2523 65.931 13.8141C66.972 14.3759 67.7817 15.1773 68.36 16.2183C68.9548 17.2593 69.2523 18.4738 69.2523 19.8618ZM64.9148 18.7464C64.9148 18.0194 64.6669 17.441 64.1712 17.0114C63.6755 16.5818 63.0559 16.367 62.3123 16.367C61.6018 16.367 60.9987 16.5735 60.503 16.9866C60.0238 17.3997 59.7263 17.9863 59.6107 18.7464H64.9148ZM81.9952 12.9714C82.9701 12.9714 83.821 13.1696 84.5481 13.5662C85.2916 13.9628 85.8617 14.4833 86.2583 15.1277V13.1696H90.4966V26.9752C90.4966 28.2475 90.2405 29.3959 89.7283 30.4204C89.2326 31.4614 88.4642 32.2876 87.4232 32.899C86.3987 33.5103 85.1181 33.816 83.5814 33.816C81.5325 33.816 79.8719 33.3286 78.5995 32.3537C77.3272 31.3953 76.6002 30.0899 76.4184 28.4376H80.6072C80.7394 28.9663 81.0533 29.3794 81.549 29.6768C82.0447 29.9908 82.6561 30.1478 83.3832 30.1478C84.2589 30.1478 84.9529 29.8917 85.4651 29.3794C85.9939 28.8837 86.2583 28.0823 86.2583 26.9752V25.0172C85.8452 25.6616 85.2751 26.1903 84.5481 26.6034C83.821 27 82.9701 27.1983 81.9952 27.1983C80.855 27.1983 79.8223 26.9091 78.897 26.3308C77.9716 25.7359 77.2363 24.9015 76.691 23.8274C76.1623 22.7369 75.8979 21.4811 75.8979 20.06C75.8979 18.639 76.1623 17.3915 76.691 16.3174C77.2363 15.2434 77.9716 14.4172 78.897 13.8389C79.8223 13.2605 80.855 12.9714 81.9952 12.9714ZM86.2583 20.0848C86.2583 19.0273 85.9609 18.1929 85.366 17.5815C84.7877 16.9701 84.0772 16.6644 83.2344 16.6644C82.3917 16.6644 81.6729 16.9701 81.0781 17.5815C80.4998 18.1763 80.2106 19.0025 80.2106 20.06C80.2106 21.1176 80.4998 21.9603 81.0781 22.5882C81.6729 23.1995 82.3917 23.5052 83.2344 23.5052C84.0772 23.5052 84.7877 23.1995 85.366 22.5882C85.9609 21.9768 86.2583 21.1423 86.2583 20.0848ZM106.6 19.8618C106.6 20.2583 106.575 20.6714 106.526 21.101H96.9337C96.9998 21.9603 97.2724 22.6212 97.7516 23.0839C98.2473 23.53 98.8505 23.7531 99.561 23.7531C100.618 23.7531 101.354 23.3069 101.767 22.4147H106.278C106.047 23.3235 105.625 24.1414 105.014 24.8684C104.419 25.5955 103.667 26.1656 102.758 26.5786C101.85 26.9917 100.833 27.1983 99.7097 27.1983C98.3547 27.1983 97.1485 26.9091 96.091 26.3308C95.0335 25.7525 94.2073 24.9263 93.6124 23.8522C93.0176 22.7782 92.7202 21.5224 92.7202 20.0848C92.7202 18.6473 93.0093 17.3915 93.5877 16.3174C94.1825 15.2434 95.0087 14.4172 96.0662 13.8389C97.1237 13.2605 98.3382 12.9714 99.7097 12.9714C101.048 12.9714 102.238 13.2523 103.279 13.8141C104.32 14.3759 105.129 15.1773 105.708 16.2183C106.303 17.2593 106.6 18.4738 106.6 19.8618ZM102.263 18.7464C102.263 18.0194 102.015 17.441 101.519 17.0114C101.023 16.5818 100.404 16.367 99.6601 16.367C98.9496 16.367 98.3465 16.5735 97.8508 16.9866C97.3716 17.3997 97.0742 17.9863 96.9585 18.7464H102.263ZM117.263 13.0209C118.882 13.0209 120.171 13.5497 121.13 14.6072C122.105 15.6482 122.592 17.0858 122.592 18.9199V27H118.378V19.49C118.378 18.5646 118.139 17.8459 117.66 17.3336C117.18 16.8214 116.536 16.5653 115.726 16.5653C114.917 16.5653 114.272 16.8214 113.793 17.3336C113.314 17.8459 113.074 18.5646 113.074 19.49V27H108.836V13.1696H113.074V15.0038C113.504 14.3924 114.082 13.9132 114.809 13.5662C115.536 13.2027 116.354 13.0209 117.263 13.0209ZM127.669 11.7321C126.925 11.7321 126.314 11.5173 125.835 11.0877C125.372 10.6415 125.141 10.0962 125.141 9.45181C125.141 8.79086 125.372 8.24557 125.835 7.81596C126.314 7.36982 126.925 7.14675 127.669 7.14675C128.396 7.14675 128.991 7.36982 129.453 7.81596C129.933 8.24557 130.172 8.79086 130.172 9.45181C130.172 10.0962 129.933 10.6415 129.453 11.0877C128.991 11.5173 128.396 11.7321 127.669 11.7321ZM129.776 13.1696V27H125.537V13.1696H129.776ZM146.504 13.1696V27H142.266V25.1163C141.836 25.7277 141.249 26.2234 140.506 26.6034C139.779 26.967 138.969 27.1487 138.077 27.1487C137.019 27.1487 136.086 26.9174 135.276 26.4547C134.466 25.9755 133.838 25.2898 133.392 24.3975C132.946 23.5052 132.723 22.456 132.723 21.2497V13.1696H136.937V20.6797C136.937 21.605 137.176 22.3238 137.655 22.836C138.135 23.3483 138.779 23.6044 139.589 23.6044C140.415 23.6044 141.068 23.3483 141.547 22.836C142.026 22.3238 142.266 21.605 142.266 20.6797V13.1696H146.504ZM155.175 27.1983C153.968 27.1983 152.894 26.9917 151.952 26.5786C151.011 26.1656 150.267 25.6037 149.722 24.8932C149.176 24.1662 148.871 23.3565 148.805 22.4642H152.993C153.043 22.9434 153.266 23.3317 153.663 23.6292C154.059 23.9266 154.547 24.0753 155.125 24.0753C155.654 24.0753 156.059 23.9762 156.34 23.7779C156.637 23.5631 156.786 23.2904 156.786 22.9599C156.786 22.5634 156.579 22.2742 156.166 22.0925C155.753 21.8942 155.084 21.6794 154.158 21.448C153.167 21.2167 152.341 20.9771 151.68 20.7292C151.019 20.4649 150.449 20.06 149.97 19.5148C149.49 18.9529 149.251 18.2011 149.251 17.2593C149.251 16.4661 149.466 15.7473 149.895 15.1029C150.341 14.442 150.986 13.9215 151.829 13.5414C152.688 13.1614 153.704 12.9714 154.877 12.9714C156.612 12.9714 157.975 13.401 158.967 14.2602C159.975 15.1194 160.553 16.2596 160.702 17.6806H156.786C156.72 17.2014 156.505 16.8214 156.141 16.5405C155.794 16.2596 155.332 16.1191 154.753 16.1191C154.258 16.1191 153.877 16.2183 153.613 16.4166C153.349 16.5983 153.217 16.8544 153.217 17.1849C153.217 17.5815 153.423 17.8789 153.836 18.0772C154.266 18.2755 154.927 18.4738 155.819 18.672C156.843 18.9364 157.678 19.2008 158.322 19.4652C158.967 19.713 159.529 20.1261 160.008 20.7045C160.504 21.2663 160.76 22.0264 160.776 22.9847C160.776 23.7944 160.545 24.5214 160.082 25.1659C159.636 25.7938 158.983 26.2895 158.124 26.653C157.281 27.0165 156.298 27.1983 155.175 27.1983Z';
const WORD_SMILE = 'M165.562 29.1068C166.989 26.0695 164.967 27.0625 163.778 27.9386C144.154 42.3949 126.639 31.467 123.506 29.8808C121.977 29.1068 121.977 29.1068 121.977 29.1068C125.035 34.0716 131.977 39.3547 143.129 39.3547C155.204 39.3547 163.778 32.9034 165.562 29.1068Z';
const WORD_DOT = 'M166.72 25.7229C167.182 26.1365 167.77 26.3433 168.486 26.3433C169.186 26.3433 169.759 26.1365 170.204 25.7229C170.666 25.2933 170.896 24.7684 170.896 24.1479C170.896 23.5116 170.666 22.9866 170.204 22.573C169.759 22.1435 169.186 21.9287 168.486 21.9287C167.77 21.9287 167.182 22.1435 166.72 22.573C166.275 22.9866 166.052 23.5116 166.052 24.1479C166.052 24.7684 166.275 25.2933 166.72 25.7229Z';

/** Full "smile genius." wordmark — text follows the theme ink, the smile keeps the brand gradient. */
export function BrandWordmark({ width = 170 }: { width?: number }) {
  const { c } = useTheme();
  return (
    <Svg viewBox="0 0 171 40" width={width} height={width * (40 / 171)} accessibilityLabel="Smile Genius">
      <Defs>
        <SvgLinearGradient id="wm" x1="166.052" y1="33.2046" x2="121.977" y2="33.2046" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#4D8EF7" /><Stop offset="1" stopColor="#A59DFF" />
        </SvgLinearGradient>
      </Defs>
      <Path fill="url(#wm)" d={WORD_SMILE} />
      <Path fill={c.ink} fillOpacity={0.8} d={WORD_DOT} />
      <Path fill={c.ink} d={WORD} />
    </Svg>
  );
}

/** Large decorative swoosh (gradient smile + ink dot). */
export function BrandSwoosh({ width = 240 }: { width?: number }) {
  const { c } = useTheme();
  return (
    <Svg viewBox="0 0 219 77" width={width} height={width * (77 / 219)}>
      <Defs>
        <SvgLinearGradient id="sw" x1="194" y1="47" x2="1" y2="55" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#4D8EF7" /><Stop offset="1" stopColor="#A59DFF" />
        </SvgLinearGradient>
      </Defs>
      <Path fill="url(#sw)" d={SMILE} />
      <Path fill={c.ink} fillOpacity={0.8} d={DOT} />
    </Svg>
  );
}

/** App mark (smile + dot). Default: white on a brand-gradient tile. plain = bare mark. */
export function GoMark({ size = 36, plain }: { size?: number; plain?: boolean }) {
  const { theme } = useTheme();
  const mark = (w: number, fill: string, opacity = 1) => (
    <Svg viewBox="0 0 219 77" width={w} height={w * (77 / 219)}>
      <Defs>
        <SvgLinearGradient id="gm" x1="219" y1="40" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#4D8EF7" /><Stop offset="1" stopColor="#A59DFF" />
        </SvgLinearGradient>
      </Defs>
      <Path d={SMILE} fill={fill} fillOpacity={opacity} />
      <Path d={DOT} fill={fill} fillOpacity={opacity} />
    </Svg>
  );
  if (plain) return theme === 'dark' ? mark(size, '#FFFFFF', 0.6) : mark(size, 'url(#gm)');
  return (
    <Grad glow className="items-center justify-center" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      {mark(size * 0.68, '#FFFFFF')}
    </Grad>
  );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

export function Card({ children, className, onPress, style }: { children: React.ReactNode; className?: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const shadow = useCardShadow();
  const cls = cx('w-full bg-go-surface rounded-[22px] border border-go-line/80', onPress && 'active:opacity-90', className);
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" className={cls} style={[shadow, style]}>{children}</Pressable>
    : <View className={cls} style={[shadow, style]}>{children}</View>;
}

/** Children separated by hairlines (the web `divide-y divide-go-line`). */
export function Rows({ children, className }: { children: React.ReactNode; className?: string }) {
  const kids = Children.toArray(children).filter(Boolean);
  return (
    <View className={className}>
      {kids.map((k, i) => (
        <Fragment key={isValidElement(k) && k.key != null ? k.key : i}>
          {i > 0 && <View className="h-px bg-go-line" />}
          {k}
        </Fragment>
      ))}
    </View>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <View className={cx('px-4 mt-6', className)}>
      <View className="flex-row items-center justify-between px-1 mb-2.5">
        <T className="text-[11px] font-bold uppercase tracking-[1.5px] text-go-muted">{title}</T>
        {action}
      </View>
      {children}
    </View>
  );
}

export type Tone = 'brand' | 'violet' | 'ok' | 'warn' | 'bad' | 'teal' | 'pink' | 'neutral';
export const TONE_BG: Record<Tone, string> = {
  brand: 'bg-go-brand-soft', violet: 'bg-go-violet-soft', ok: 'bg-go-ok-soft', warn: 'bg-go-warn-soft',
  bad: 'bg-go-bad-soft', teal: 'bg-go-teal-soft', pink: 'bg-go-pink-soft', neutral: 'bg-go-raised',
};
export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-go-brand-ink', violet: 'text-go-violet', ok: 'text-go-ok', warn: 'text-go-warn',
  bad: 'text-go-bad', teal: 'text-go-teal', pink: 'text-go-pink', neutral: 'text-go-ink2',
};
const DOT_BG: Record<Tone, string> = {
  brand: 'bg-go-brand', violet: 'bg-go-violet', ok: 'bg-go-ok', warn: 'bg-go-warn', bad: 'bg-go-bad', teal: 'bg-go-teal', pink: 'bg-go-pink', neutral: 'bg-go-faint',
};

export function Pill({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <View className={cx('flex-row items-center gap-1.5 h-6 px-2.5 rounded-full self-start', TONE_BG[tone], className)}>
      {dot && <View className={cx('w-1.5 h-1.5 rounded-full', DOT_BG[tone])} />}
      <T className={cx('text-[11px] font-semibold', TONE_TEXT[tone])} numberOfLines={1}>{children}</T>
    </View>
  );
}

/** Tinted icon square. Give the icon its colour class (e.g. text-go-pink) — RN icons don't inherit colour. */
export function IconTile({ icon, tone = 'brand', size = 'md' }: { icon: React.ReactNode; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-9 h-9 rounded-xl' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-11 h-11 rounded-2xl';
  return <View className={cx('items-center justify-center', s, TONE_BG[tone])}>{icon}</View>;
}

export function ActionTile({ icon, tone, title, body, onPress, right }: { icon: React.ReactNode; tone: Tone; title: string; body?: string; onPress?: () => void; right?: React.ReactNode }) {
  return (
    <Card onPress={onPress} className="p-4 flex-row items-center gap-3.5">
      <IconTile icon={icon} tone={tone} />
      <View className="flex-1 min-w-0">
        <T className="text-[15px] font-semibold">{title}</T>
        {!!body && <T className="text-[12.5px] text-go-muted leading-[18px] mt-0.5">{body}</T>}
      </View>
      {right}
    </Card>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const ini = name.replace(/^Dr\s+/, '').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Grad className="items-center justify-center" style={{ width: size, height: size, borderRadius: size / 2 }}>
      <T className="text-white font-bold" style={{ fontSize: size * 0.36 }}>{ini}</T>
    </Grad>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <Rows>
      {rows.map(([k, v]) => (
        <View key={k} className="flex-row items-start justify-between gap-4 py-3">
          <T className="text-[13px] text-go-muted">{k}</T>
          <View className="flex-1 items-end min-w-0">
            {typeof v === 'string' || typeof v === 'number' ? <T className="text-[13.5px] font-medium text-right">{v}</T> : v}
          </View>
        </View>
      ))}
    </Rows>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View className="items-center px-8 py-12">
      <View className="w-16 h-16 rounded-3xl bg-go-raised border border-go-line items-center justify-center mb-4">{icon}</View>
      <T className="text-[16px] font-semibold text-center">{title}</T>
      {!!body && <T className="text-[13px] text-go-muted mt-1 leading-[20px] text-center">{body}</T>}
      {action && <View className="mt-5">{action}</View>}
    </View>
  );
}

// ─── Buttons & inputs ───────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost';
const BTN_BG: Record<BtnVariant, string> = { primary: '', secondary: 'bg-go-surface border border-go-line', soft: 'bg-go-brand-soft', danger: 'bg-go-bad', ghost: '' };
const BTN_TEXT: Record<BtnVariant, string> = { primary: 'text-white', secondary: 'text-go-ink', soft: 'text-go-brand-ink', danger: 'text-white', ghost: 'text-go-brand' };

/** Button. icon: give it the matching colour class (white on primary/danger). */
export function Btn({ children, variant = 'primary', icon, block, onPress, disabled, size = 'lg', className, textClassName }: {
  children: React.ReactNode; variant?: BtnVariant; icon?: React.ReactNode; block?: boolean; onPress?: () => void; disabled?: boolean;
  size?: 'md' | 'lg'; className?: string; textClassName?: string;
}) {
  const box = cx('flex-row items-center justify-center gap-2', size === 'lg' ? 'h-[52px] px-5 rounded-2xl' : 'h-10 px-4 rounded-xl');
  // A colour in textClassName replaces the variant's colour (two colour classes would fight)
  const ownColour = /\btext-(go-|white|black)/.test(textClassName ?? '');
  const label = <T className={cx('font-semibold', size === 'lg' ? 'text-[15px]' : 'text-[13.5px]', !ownColour && BTN_TEXT[variant], textClassName)}>{children}</T>;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      className={cx(block ? 'self-stretch' : 'self-start', disabled ? 'opacity-40' : 'active:opacity-85', className)}>
      {variant === 'primary' && !disabled
        ? <Grad glow className={box}>{icon}{label}</Grad>
        : <View className={cx(box, variant === 'primary' ? 'bg-go-brand' : BTN_BG[variant])}>{icon}{label}</View>}
    </Pressable>
  );
}

export function Label({ children, hint, optional }: { children: React.ReactNode; hint?: string; optional?: boolean }) {
  return (
    <View className="flex-row items-baseline justify-between mb-1.5 px-0.5">
      <T className="text-[13px] font-semibold">{children}{optional && <T className="text-[13px] text-go-faint"> · optional</T>}</T>
      {!!hint && <T className="text-[11px] text-go-muted">{hint}</T>}
    </View>
  );
}

const FIELD = 'w-full rounded-2xl bg-go-surface border text-[15px] text-go-ink';

export function Input({ className, invalid, ...props }: TextInputProps & { className?: string; invalid?: boolean }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput placeholderTextColor={c.faint} {...props}
      onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }}
      className={cx(FIELD, 'h-[52px] px-4', invalid ? 'border-go-warn' : focus ? 'border-go-brand' : 'border-go-line', className)}
      style={[{ fontFamily: FONT.normal }, props.style]} />
  );
}

export function TextArea({ className, rows = 3, ...props }: TextInputProps & { className?: string; rows?: number }) {
  return <Input multiline textAlignVertical="top" {...props} className={cx('h-auto py-3', className)} style={[{ minHeight: rows * 24 + 24 }, props.style]} />;
}

const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); };
const showYmd = (s: string) => fromYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Date picker field. value / onChange use yyyy-mm-dd ('' = not set). Android: system dialog; iOS: calendar sheet; web: date input. */
export function DateField({ value, onChange, min, max, placeholder = 'Choose a date', invalid, className, accessibilityLabel }: {
  value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string; invalid?: boolean; className?: string; accessibilityLabel?: string;
}) {
  const { c, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ? fromYmd(value) : new Date());
  const box = cx(FIELD, 'h-[52px] px-4 flex-row items-center gap-2', invalid ? 'border-go-warn' : 'border-go-line', className);
  if (Platform.OS === 'web') {
    // react-native-web: a real <input type="date"> keeps the browser's own picker
    return (
      <View className={box}>
        {createElement('input', {
          type: 'date', value, min, max, 'aria-label': accessibilityLabel,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          style: { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: c.ink, fontFamily: FONT.normal, fontSize: 15, colorScheme: theme },
        })}
      </View>
    );
  }
  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ? fromYmd(value) : new Date(), mode: 'date',
        minimumDate: min ? fromYmd(min) : undefined, maximumDate: max ? fromYmd(max) : undefined,
        onChange: (e, d) => { if (e.type === 'set' && d) onChange(toYmd(d)); },
      });
    } else { setTemp(value ? fromYmd(value) : new Date()); setOpen(true); }
  };
  return (
    <>
      <Pressable onPress={openPicker} accessibilityRole="button" accessibilityLabel={accessibilityLabel} className={box}>
        <CalendarClock className="w-[18px] h-[18px] text-go-muted" />
        <T className={cx('flex-1 text-[15px]', !value && 'text-go-faint')} numberOfLines={1}>{value ? showYmd(value) : placeholder}</T>
        {!!value && (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear date"><X className="w-4 h-4 text-go-muted" /></Pressable>
        )}
      </Pressable>
      {Platform.OS === 'ios' && (
        <Sheet open={open} onClose={() => setOpen(false)} title={accessibilityLabel ?? 'Choose a date'}
          footer={<Btn block onPress={() => { onChange(toYmd(temp)); setOpen(false); }}>Done</Btn>}>
          <DateTimePicker value={temp} mode="date" display="inline" themeVariant={theme} accentColor={c.brand}
            minimumDate={min ? fromYmd(min) : undefined} maximumDate={max ? fromYmd(max) : undefined}
            onChange={(_, d) => d && setTemp(d)} />
        </Sheet>
      )}
    </>
  );
}

export function Chips<V extends string>({ options, value, onChange, multi, wrap = true }: {
  options: readonly V[]; value: V | V[] | null; onChange: (v: any) => void; multi?: boolean; wrap?: boolean;
}) {
  const sel = (o: V) => (Array.isArray(value) ? value.includes(o) : value === o);
  const chips = options.map(o => (
    <Pressable key={o} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: sel(o) }}
      onPress={() => (multi ? onChange(sel(o) ? (value as V[]).filter(x => x !== o) : [...((value as V[]) ?? []), o]) : onChange(o))}
      className={cx('h-9 px-3.5 rounded-full border flex-row items-center gap-1.5', sel(o) ? 'bg-go-brand border-go-brand' : 'bg-go-surface border-go-line')}>
      {sel(o) && multi && <Check className="w-3.5 h-3.5 text-white" />}
      <T className={cx('text-[13px] font-medium', sel(o) ? 'text-white' : 'text-go-ink2')}>{o}</T>
    </Pressable>
  ));
  return wrap
    ? <View className="flex-row flex-wrap gap-2">{chips}</View>
    : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4" className="-mx-4">{chips}</ScrollView>;
}

export function Segmented<V extends string>({ options, value, onChange }: { options: { value: V; label: string; count?: number }[]; value: V; onChange: (v: V) => void }) {
  const shadow = useCardShadow();
  return (
    <View className="flex-row p-1 rounded-2xl bg-go-raised border border-go-line">
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }}
          className={cx('flex-1 h-9 rounded-xl flex-row items-center justify-center gap-1.5', value === o.value && 'bg-go-surface')}
          style={value === o.value ? shadow : undefined}>
          <T className={cx('text-[13px] font-semibold', value === o.value ? 'text-go-ink' : 'text-go-muted')} numberOfLines={1}>{o.label}</T>
          {o.count !== undefined && (
            <View className={cx('px-1.5 rounded-full', value === o.value ? 'bg-go-brand-soft' : 'bg-go-line/60')}>
              <T className={cx('text-[11px]', value === o.value ? 'text-go-brand-ink' : 'text-go-muted')}>{o.count}</T>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const knob = <View className="absolute top-[3px] w-6 h-6 rounded-full bg-white" style={[{ left: on ? 23 : 3 }, { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]} />;
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }}>
      {on ? <Grad className="w-[50px] h-[30px] rounded-full">{knob}</Grad> : <View className="w-[50px] h-[30px] rounded-full bg-go-line">{knob}</View>}
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 1, max = 9 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View className="flex-row items-center h-[52px] rounded-2xl border border-go-line bg-go-surface self-start">
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} accessibilityLabel="Fewer" className={cx('w-12 h-full items-center justify-center', value <= min && 'opacity-30')}>
        <T className="text-xl text-go-ink2">−</T>
      </Pressable>
      <T className="w-8 text-center text-[16px] font-semibold">{value}</T>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} accessibilityLabel="More" className={cx('w-12 h-full items-center justify-center', value >= max && 'opacity-30')}>
        <T className="text-xl text-go-ink2">+</T>
      </Pressable>
    </View>
  );
}

export function CheckRow({ checked, onChange, label, required }: { checked: boolean; onChange: (v: boolean) => void; label: string; required?: boolean }) {
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }}
      className={cx('w-full flex-row items-center gap-3 p-3.5 rounded-2xl border', checked ? 'border-go-ok/40 bg-go-ok-soft' : 'border-go-line bg-go-surface')}>
      <View className={cx('w-6 h-6 rounded-lg items-center justify-center', checked ? 'bg-go-ok' : 'border-2 border-go-line')}>
        {checked && <Check className="w-4 h-4 text-white" />}
      </View>
      <T className="flex-1 text-[14px]">{label}</T>
      {required && !checked && <T className="text-[10px] font-bold uppercase tracking-[1px] text-go-warn">Required</T>}
    </Pressable>
  );
}

// ─── Sheet & picker ─────────────────────────────────────────────────────────

/** Bottom sheet (modal). tall = 90% of the screen; otherwise up to 90%. */
export function Sheet({ open, onClose, title, sub, children, footer, tall, label }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; tall?: boolean;
  /** Accessible name when the title is not plain text (e.g. icon + label). */
  label?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { theme } = useTheme();
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {open && (
        // A modal renders outside the app root (a portal on web), so the theme variables are set again here
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end" style={vars(cssVars(theme))}>
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} className="absolute inset-0 bg-black/45">
            <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SlideInDown.duration(280)} exiting={SlideOutDown.duration(200)}
            accessibilityViewIsModal accessibilityLabel={label ?? (typeof title === 'string' ? title : undefined)}
            className="bg-go-surface rounded-t-[30px] border-t border-go-line"
            style={tall ? { height: height * 0.9 } : { maxHeight: height * 0.9 }}>
            <View className="pt-2.5 pb-1 items-center"><View className="w-10 h-1.5 rounded-full bg-go-line" /></View>
            {(!!title || !!sub) && (
              <View className="flex-row items-start gap-3 px-5 pt-2 pb-3">
                <View className="flex-1 min-w-0">
                  {!!title && (typeof title === 'string' ? <T className="text-[19px] font-bold leading-[24px]">{title}</T> : title)}
                  {!!sub && (typeof sub === 'string' ? <T className="text-[13px] text-go-muted mt-1 leading-[18px]">{sub}</T> : sub)}
                </View>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" className="w-9 h-9 -mr-1 rounded-full bg-go-raised items-center justify-center">
                  <X className="w-[18px] h-[18px] text-go-ink2" />
                </Pressable>
              </View>
            )}
            <ScrollView className={tall ? 'flex-1' : 'flex-shrink'} contentContainerClassName="px-5 pb-4" keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer && <View className="px-5 pt-3 border-t border-go-line" style={{ paddingBottom: insets.bottom + 16 }}>{footer}</View>}
            {!footer && <View style={{ height: insets.bottom }} />}
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

export interface PickOption { value: string; label: string; sub?: string }
export function PickerField({ label, value, options, onChange, placeholder = 'Select', searchable, optional, invalid }: {
  label: string; value: string | null; options: PickOption[]; onChange: (v: string) => void; placeholder?: string; searchable?: boolean; optional?: boolean; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find(o => o.value === value);
  const shown = useMemo(() => options.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q.toLowerCase())), [options, q]);
  return (
    <View>
      <Label optional={optional}>{label}</Label>
      <Pressable onPress={() => { setQ(''); setOpen(true); }} accessibilityRole="button" accessibilityLabel={label}
        className={cx(FIELD, 'h-[52px] px-4 flex-row items-center gap-2', invalid ? 'border-go-warn' : 'border-go-line')}>
        <View className="flex-1 min-w-0">
          {current ? (
            <T className="text-[15px] truncate">{current.label}{!!current.sub && <T className="text-go-muted text-[12.5px]"> · {current.sub}</T>}</T>
          ) : <T className="text-[15px] text-go-faint">{placeholder}</T>}
        </View>
        <ChevronDown className="w-[18px] h-[18px] text-go-muted" />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} tall={options.length > 7}>
        {searchable && <View className="pb-3"><SearchBox value={q} onChange={setQ} placeholder={`Search ${label.toLowerCase()}`} /></View>}
        <View className="gap-1">
          {shown.map(o => (
            <Pressable key={o.value} onPress={() => { onChange(o.value); setOpen(false); }}
              className={cx('w-full flex-row items-center gap-3 px-3.5 py-3 rounded-2xl', o.value === value ? 'bg-go-brand-soft' : 'active:bg-go-raised')}>
              <View className="flex-1 min-w-0">
                <T className="text-[15px] font-medium">{o.label}</T>
                {!!o.sub && <T className="text-[12px] text-go-muted mt-0.5">{o.sub}</T>}
              </View>
              {o.value === value && <Check className="w-5 h-5 text-go-brand" />}
            </Pressable>
          ))}
          {!shown.length && <T className="text-center text-[13px] text-go-muted py-8">Nothing found</T>}
        </View>
      </Sheet>
    </View>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View className={cx('flex-row items-center gap-2.5 h-12 px-4 rounded-2xl bg-go-surface border', focus ? 'border-go-brand' : 'border-go-line')}>
      <Search className="w-[18px] h-[18px] text-go-muted" />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} returnKeyType="search" accessibilityLabel={placeholder}
        className="flex-1 min-w-0 text-[15px] text-go-ink h-full" style={{ fontFamily: FONT.normal }} />
      {!!value && <Pressable onPress={() => onChange('')} accessibilityLabel="Clear search" hitSlop={8}><X className="w-4 h-4 text-go-muted" /></Pressable>}
    </View>
  );
}

// ─── Lab work bits ──────────────────────────────────────────────────────────

export const STAGE_TONE: Record<Stage, Tone> = {
  draft: 'neutral', ready: 'warn', dispatched: 'brand', 'at-lab': 'brand', production: 'violet', shipped: 'ok', received: 'teal',
};
export function StagePill({ stage }: { stage: Stage }) {
  return <Pill tone={STAGE_TONE[stage]} dot>{stageLabel(stage)}</Pill>;
}
export function CaseFlags({ c }: { c: LabCase }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      <StagePill stage={c.stage} />
      {c.onHold && <Pill tone="warn">On hold ({c.onHold.side})</Pill>}
      {c.questionOpen && <Pill tone="pink">Info required</Pill>}
      {c.labStatus === 'Not Approved' && <Pill tone="bad">Not approved</Pill>}
      {c.deliveryChanged && <Pill tone="warn">Date changed</Pill>}
      {isOverdue(c) && <Pill tone="bad">Overdue</Pill>}
      {c.problem && <Pill tone="bad">Problem reported</Pill>}
    </View>
  );
}

export const READINESS_TONE: Record<ReadinessLevel, Tone> = {
  'at-risk': 'bad', attention: 'warn', arriving: 'brand', 'on-track': 'violet', 'in-practice': 'ok',
};
export const READINESS_DOT: Record<ReadinessLevel, string> = {
  'at-risk': 'bg-go-bad', attention: 'bg-go-warn', arriving: 'bg-go-brand', 'on-track': 'bg-go-violet', 'in-practice': 'bg-go-ok',
};
export function ReadinessPill({ c, detail }: { c: LabCase; detail?: boolean }) {
  const r = readiness(c);
  return (
    <View className="items-end">
      <Pill tone={READINESS_TONE[r.level]} dot>{r.label}</Pill>
      {detail && <T className="text-[11px] text-go-muted mt-0.5">{r.detail}</T>}
    </View>
  );
}

/** Six-segment rail: Ready → Dispatched → At lab → Production → Shipped → Received. */
export function ProgressRail({ stage, className }: { stage: Stage; className?: string }) {
  const idx = stageIndex(stage);
  return (
    <View className={cx('flex-row gap-1', className)} accessibilityLabel={`Step ${idx + 1} of ${STAGES.length}`}>
      {STAGES.map((s, i) => (i <= idx
        ? <Grad key={s.id} className="h-1.5 flex-1 rounded-full" />
        : <View key={s.id} className="h-1.5 flex-1 rounded-full bg-go-line" />))}
    </View>
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

/** Rendered once by the root layout, above everything. */
export function Toaster() {
  const { toasts } = useGo();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <View pointerEvents="box-none" className="absolute left-3 right-3 gap-2" style={{ top: insets.top + 8 }}>
      {toasts.map(t => (
        <Animated.View key={t.id} entering={FadeInUp.duration(250)} exiting={FadeOut.duration(200)} accessibilityLiveRegion="polite"
          className="flex-row items-start gap-3 px-4 py-3 rounded-2xl"
          style={{ backgroundColor: c.ink, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
          {t.tone === 'ok' ? <CheckCircle2 color={c.ok} size={20} />
            : t.tone === 'bad' ? <AlertTriangle color={c.bad} size={20} />
            : <Info color={c.brand} size={20} />}
          <T className="flex-1 text-[13.5px] font-medium leading-[19px]" style={{ color: c.bg }}>{t.text}</T>
        </Animated.View>
      ))}
    </View>
  );
}

export type { PressableProps };
