// ─── Smile Genius Go — filled icon set ───────────────────────────────────────
// The app uses solid (filled) icons throughout, from Heroicons — the same
// family as components/icons/FilledNavIcons. Exported under the names the
// screens already use, so a screen only changes its import path. Props such
// as strokeWidth/fill from the old outline set are accepted and ignored.
// Keyboard glyphs (shift, return) and the spinner have no filled meaning, so
// they stay as the line versions.
import type { ComponentType, SVGProps } from 'react';
import {
  ArrowLeftIcon, ArrowPathIcon, ArrowRightStartOnRectangleIcon, ArrowUpTrayIcon, BackspaceIcon, BeakerIcon, BellIcon, BoltIcon, BoltSlashIcon,
  BuildingOffice2Icon, BuildingOfficeIcon, CalendarDaysIcon, CameraIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, CheckIcon, ChevronDownIcon,
  ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, ClockIcon, ComputerDesktopIcon, CubeIcon, DocumentCurrencyPoundIcon,
  DocumentTextIcon, EnvelopeIcon, EnvelopeOpenIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, HandThumbUpIcon, HomeIcon, InboxIcon,
  InformationCircleIcon, LinkIcon, LockClosedIcon, MagnifyingGlassIcon, MoonIcon, PaperAirplaneIcon, PaperClipIcon, PencilSquareIcon, PhotoIcon,
  PlusIcon, PrinterIcon, ShieldCheckIcon, SparklesIcon, Square3Stack3DIcon, SunIcon, TruckIcon, UserIcon, WalletIcon, WrenchScrewdriverIcon,
  XCircleIcon, XMarkIcon,
} from '@heroicons/react/24/solid';

export { ArrowBigUp, CornerDownLeft, Loader2 } from 'lucide-react';

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;
type Props = { className?: string; style?: React.CSSProperties; strokeWidth?: number | string; fill?: string; 'aria-label'?: string };

const filled = (Icon: HeroIcon) => {
  const C = ({ className, style, 'aria-label': label }: Props) => (
    <Icon className={className} style={style} aria-hidden={label ? undefined : true} aria-label={label} />
  );
  return C;
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
