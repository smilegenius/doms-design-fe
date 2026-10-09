// ─── Smile Genius Go — filled icon set ───────────────────────────────────────
// Heroicons (solid), the same family as the web app, under the names the
// screens use. Import icons from here only, never from the library directly.
//
// Size and colour come from className, like on the web:
//   <Bell className="w-5 h-5 text-go-brand" />
// (or pass size / color props). With no colour class an icon uses the theme ink.
import type { ComponentType } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { cssInterop } from 'nativewind';
import {
  ArrowLeftIcon, ArrowPathIcon, ArrowRightStartOnRectangleIcon, ArrowUpTrayIcon, BackspaceIcon, BeakerIcon, BellIcon, BoltIcon, BoltSlashIcon,
  BuildingOffice2Icon, BuildingOfficeIcon, CalendarDaysIcon, CameraIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, CheckIcon, ChevronDownIcon,
  ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, ClockIcon, ComputerDesktopIcon, CubeIcon,
  DocumentTextIcon, EnvelopeIcon, EnvelopeOpenIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, HandThumbUpIcon, HomeIcon, InboxIcon,
  InformationCircleIcon, LinkIcon, LockClosedIcon, MagnifyingGlassIcon, MoonIcon, PaperAirplaneIcon, PaperClipIcon, PencilSquareIcon, PhotoIcon,
  PlusIcon, PrinterIcon, ShieldCheckIcon, SparklesIcon, Square3Stack3DIcon, SunIcon, TruckIcon, UserIcon, WalletIcon, WrenchScrewdriverIcon,
  XCircleIcon, XMarkIcon, FunnelIcon, MicrophoneIcon, StopIcon, UserPlusIcon, PlusCircleIcon, TrashIcon, StarIcon, PauseIcon, PlayIcon,
  ListBulletIcon, Squares2X2Icon, ChatBubbleOvalLeftEllipsisIcon,
} from 'react-native-heroicons/solid';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeRoot';

/** Heroicons "document-currency-pound" (solid) — not in this icon package version, so drawn from the same path. */
function DocumentCurrencyPoundIcon({ size = 24, color, style }: HeroProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={style}>
      <Path fillRule="evenodd" clipRule="evenodd" d="M3.75 3.375c0-1.036.84-1.875 1.875-1.875H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375Zm10.5 1.875a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Zm-3.674 9.583a2.249 2.249 0 0 1 3.765-2.174.75.75 0 0 0 1.06-1.06A3.75 3.75 0 0 0 9.076 15H8.25a.75.75 0 0 0 0 1.5h1.156a3.75 3.75 0 0 1-.206 1.559l-.156.439a.75.75 0 0 0 1.042.923l.439-.22a2.113 2.113 0 0 1 1.613-.115 3.613 3.613 0 0 0 2.758-.196l.44-.22a.75.75 0 1 0-.671-1.341l-.44.22a2.113 2.113 0 0 1-1.613.114 3.612 3.612 0 0 0-1.745-.134c.048-.341.062-.686.042-1.029H12a.75.75 0 0 0 0-1.5h-1.379l-.045-.167Z" />
    </Svg>
  );
}

type HeroProps = { size?: number; color?: string; style?: StyleProp<ViewStyle> };
export interface IconProps {
  className?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle & { color?: string }>;
  /** Ignored — kept so web-style props don't break (icons are filled). */
  strokeWidth?: number | string;
  accessibilityLabel?: string;
}
export type IconType = ComponentType<IconProps>;

/** Size / colour from the icon's classes: w-5 / w-[18px] → px, text-go-brand(/60) / text-white(/60) → colour. */
function fromClass(className: string | undefined, c: Record<string, string>, alpha: (n: never, a: number) => string) {
  if (!className) return {};
  const bracket = className.match(/\bw-\[(\d+(?:\.\d+)?)px\]/)?.[1];
  const scale = className.match(/\bw-(\d+(?:\.\d+)?)(?![\w.[])/)?.[1];
  const size = bracket ? Number(bracket) : scale ? Number(scale) * 4 : undefined;
  const m = className.match(/\btext-(go-[a-z0-9-]+?|white)(?:\/(\d+))?(?=\s|$)/);
  let color: string | undefined;
  if (m) {
    const a = m[2] ? Number(m[2]) / 100 : 1;
    if (m[1] === 'white') color = a === 1 ? '#FFFFFF' : `rgba(255, 255, 255, ${a})`;
    else { const name = m[1].slice(3); color = a === 1 ? c[name] : alpha(name as never, a); }
  }
  return { size, color };
}

const filled = (Hero: ComponentType<HeroProps & { className?: string }>): IconType => {
  function Icon({ className, size, color, style, accessibilityLabel }: IconProps) {
    const { c, alpha } = useTheme();
    // Native: NativeWind turns className into style. Web: className arrives as-is (and also styles the svg via CSS).
    const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle & { color?: string };
    const { color: styleColor, width, height, ...layout } = flat;
    const parsed = fromClass(className, c, alpha as never);
    const px = size ?? (typeof width === 'number' ? width : typeof height === 'number' ? height : parsed.size ?? 20);
    return (
      <Hero size={px} color={color ?? styleColor ?? parsed.color ?? c.ink} style={layout}
        {...(Platform.OS === 'web' && className ? { className } : {})}
        // accessibility props pass through to the Svg; only set when labelled
        {...(accessibilityLabel ? (Platform.OS === 'web' ? { accessibilityLabel } : { accessibilityLabel, accessible: true }) : {})} />
    );
  }
  // className (w-5 h-5 text-go-brand mt-px …) → style on native
  cssInterop(Icon, { className: 'style' });
  return Icon;
};

export const AlertTriangle = filled(ExclamationTriangleIcon);
export const ArrowLeft = filled(ArrowLeftIcon);
export const Bell = filled(BellIcon);
export const Building = filled(BuildingOfficeIcon);
export const Building2 = filled(BuildingOffice2Icon);
export const CalendarClock = filled(CalendarDaysIcon);
export const Camera = filled(CameraIcon);
export const Check = filled(CheckIcon);
export const CheckCircle2 = filled(CheckCircleIcon);
export const ChevronDown = filled(ChevronDownIcon);
export const ChevronLeft = filled(ChevronLeftIcon);
export const ChevronRight = filled(ChevronRightIcon);
export const ClipboardCheck = filled(ClipboardDocumentCheckIcon);
export const Clock = filled(ClockIcon);
export const Delete = filled(BackspaceIcon);
export const Eye = filled(EyeIcon);
export const EyeOff = filled(EyeSlashIcon);
export const FileText = filled(DocumentTextIcon);
export const FlaskConical = filled(BeakerIcon);
export const Hammer = filled(WrenchScrewdriverIcon);
export const Home = filled(HomeIcon);
export const Image = filled(PhotoIcon);
export const ImagePlus = filled(PhotoIcon);
export const ImageUp = filled(ArrowUpTrayIcon);
export const Inbox = filled(InboxIcon);
export const Info = filled(InformationCircleIcon);
export const Layers = filled(Square3Stack3DIcon);
export const Link2 = filled(LinkIcon);
export const Lock = filled(LockClosedIcon);
export const LogOut = filled(ArrowRightStartOnRectangleIcon);
export const Mail = filled(EnvelopeIcon);
export const MailCheck = filled(EnvelopeOpenIcon);
export const MessageSquare = filled(ChatBubbleLeftEllipsisIcon);
export const ChatBubble = filled(ChatBubbleOvalLeftEllipsisIcon);
export const Monitor = filled(ComputerDesktopIcon);
export const Moon = filled(MoonIcon);
export const PackageCheck = filled(CubeIcon);
export const Paperclip = filled(PaperClipIcon);
export const PenLine = filled(PencilSquareIcon);
export const Plus = filled(PlusIcon);
export const Printer = filled(PrinterIcon);
export const Receipt = filled(DocumentCurrencyPoundIcon);
export const RotateCcw = filled(ArrowPathIcon);
export const Search = filled(MagnifyingGlassIcon);
export const Send = filled(PaperAirplaneIcon);
export const ShieldCheck = filled(ShieldCheckIcon);
export const Sparkles = filled(SparklesIcon);
export const Sun = filled(SunIcon);
export const ThumbsUp = filled(HandThumbUpIcon);
export const Truck = filled(TruckIcon);
export const User = filled(UserIcon);
export const Wallet = filled(WalletIcon);
export const X = filled(XMarkIcon);
export const XCircle = filled(XCircleIcon);
export const Zap = filled(BoltIcon);
export const ZapOff = filled(BoltSlashIcon);
export const Filter = filled(FunnelIcon);
export const List = filled(ListBulletIcon);
export const LayoutGrid = filled(Squares2X2Icon);
export const Mic = filled(MicrophoneIcon);
export const Stop = filled(StopIcon);
export const UserPlus = filled(UserPlusIcon);
export const PlusCircle = filled(PlusCircleIcon);
export const Trash = filled(TrashIcon);
export const Star = filled(StarIcon);
export const Pause = filled(PauseIcon);
export const Play = filled(PlayIcon);
