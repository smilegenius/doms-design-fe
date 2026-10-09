// ─── Status styling shared by Home tiles, Lab work and Account ───────────────
// Short labels, icons and colour classes for every attention status, plus the
// glossy gradient chip used on the Home tiles (and Account › Home screen order).
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarClock, ChatBubble, Clock, IconType, PackageCheck, Pause, PenLine, Truck, XCircle } from './icons';
import { Attention, HomeStatus } from '../data/data';
import { CHIP } from '../theme/tokens';

export const STATUS_STYLE: Record<Attention, { short: string; icon: IconType; color: string; bar: string }> = {
  overdue: { short: 'Overdue', icon: Clock, color: 'text-go-bad', bar: 'bg-go-bad' },
  ready: { short: 'To dispatch', icon: Truck, color: 'text-go-warn', bar: 'bg-go-warn' },
  'on-hold': { short: 'On hold', icon: Pause, color: 'text-go-violet', bar: 'bg-go-violet' },
  draft: { short: 'Draft', icon: PenLine, color: 'text-go-muted', bar: 'bg-go-faint' },
  arriving: { short: 'Arriving', icon: PackageCheck, color: 'text-go-brand', bar: 'bg-go-brand' },
  questions: { short: 'Info required', icon: ChatBubble, color: 'text-go-pink', bar: 'bg-go-pink' },
  'not-approved': { short: 'Not approved', icon: XCircle, color: 'text-go-bad', bar: 'bg-go-bad' },
  'date-changed': { short: 'Date changed', icon: CalendarClock, color: 'text-go-warn', bar: 'bg-go-warn' },
};

/** Home tile styling per status: tinted wash colours, border, count colour, chip icon. */
export const HERO: Record<HomeStatus, { soft: string; ring: string; glow: string; count: string; icon: IconType }> = {
  overdue: { icon: Clock, soft: 'bad-soft', ring: 'border-go-bad/25', glow: 'bad', count: 'text-go-bad' },
  ready: { icon: Truck, soft: 'warn-soft', ring: 'border-go-warn/25', glow: 'warn', count: 'text-go-warn' },
  'on-hold': { icon: Pause, soft: 'violet-soft', ring: 'border-go-violet/25', glow: 'violet', count: 'text-go-violet' },
  draft: { icon: PenLine, soft: 'brand-soft', ring: 'border-go-brand/25', glow: 'brand', count: 'text-go-brand' },
  'not-approved': { icon: XCircle, soft: 'pink-soft', ring: 'border-go-pink/25', glow: 'pink', count: 'text-go-pink' },
  'date-changed': { icon: CalendarClock, soft: 'teal-soft', ring: 'border-go-teal/25', glow: 'teal', count: 'text-go-teal' },
};

export const statusShort = (id: HomeStatus) => STATUS_STYLE[id].short;

/**
 * Glossy status chip: two-tone gradient (light top-left → deep), a white shine on
 * the top half and a shadow in its own colour. Same vivid colours in both themes.
 */
export function StatusChip({ id, size = 36 }: { id: HomeStatus; size?: number }) {
  const [c1, c2] = CHIP[id];
  const Icon = HERO[id].icon;
  const r = size * 0.36;
  return (
    <View style={{ width: size, height: size, borderRadius: r, shadowColor: c2, shadowOpacity: 0.55, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
      <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={{ flex: 1, borderRadius: r, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <LinearGradient colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }} />
        <Icon size={size / 2} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}
