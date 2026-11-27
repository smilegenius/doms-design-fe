import type { ReactNode } from 'react';
import {
  Ban, BadgeCheck, CheckCircle2, Clock, Eye, Inbox, PackageCheck, PauseCircle, ShieldCheck, Truck, Wrench, XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  Aligner, Denture, DenturePartial, DentureReline, NightGuard, Retainer, ToothBridge, ToothCrown, ToothImplant,
  ToothInlay, ToothOther, ToothVeneer, WhiteningTray,
} from '../../src/app/components/TreatmentIcons';
import { Pill } from '../lab-billing/ui';
import { type Line, type LineStatus, type WorkflowState, STATUS, statusText } from './workflowStore';

// ── V2 workflow: look-and-feel pieces ────────────────────────────────────────
// The portal's treatment icons on every service line, an icon on every status,
// initials avatars for owners, and one page header shared by Queue and Calendar.

/** The portal's checkbox (globals.css styles the box; this gives it its size). */
export const checkbox = 'w-4 h-4 flex-shrink-0 rounded cursor-pointer';

const SERVICE_ICONS:[RegExp, LucideIcon][] = [
  [/implant|abutment|screw/i, ToothImplant],
  [/reline|rebase/i, DentureReline],
  [/partial|chrome|cobalt|valplast|flexi/i, DenturePartial],
  [/denture|full arch|obturator/i, Denture],
  [/align/i, Aligner],
  [/retain/i, Retainer],
  [/guard|splint/i, NightGuard],
  [/whiten|bleach/i, WhiteningTray],
  [/bridge/i, ToothBridge],
  [/veneer/i, ToothVeneer],
  [/inlay|onlay/i, ToothInlay],
  [/crown|emax|zirconia|zr\b|post|core/i, ToothCrown],
];
export const serviceIcon = (service: string): LucideIcon => SERVICE_ICONS.find(([re]) => re.test(service))?.[1] ?? ToothOther;

/** The treatment icon in a soft tile, for lists and cards. */
export function ServiceIcon({ service, size = 'md' }: { service: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = serviceIcon(service);
  const box = { sm: 'w-6 h-6 rounded-md', md: 'w-8 h-8 rounded-lg', lg: 'w-12 h-12 rounded-xl' }[size];
  const ic = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-6 h-6' }[size];
  return <span className={`${box} flex-shrink-0 inline-flex items-center justify-center bg-[#F0F5FF] text-[#4D8EF7]`}><Icon className={ic} /></span>;
}

export const STATUS_ICON: Record<LineStatus, LucideIcon> = {
  received: Inbox,
  'under-review': Eye,
  'on-hold-lab': PauseCircle,
  'on-hold-practice': PauseCircle,
  accepted: CheckCircle2,
  'in-queue': Clock,
  'in-production': Wrench,
  qc: ShieldCheck,
  shipped: Truck,
  delivered: PackageCheck,
  'not-approved': XCircle,
  cancelled: Ban,
};

/** Status (and stage) of a line, with its icon. */
export function LinePill({ s, l }: { s: WorkflowState; l: Line }) {
  const Icon = l.qcPassed ? BadgeCheck : STATUS_ICON[l.status];
  return <Pill tone={l.qcPassed ? 'green' : STATUS[l.status].tone}><Icon className="w-3 h-3" />{statusText(s, l)}</Pill>;
}

const AVATAR_TONES = ['bg-[#EEF4FF] text-[#1565C0]', 'bg-[#F5F3FF] text-[#7C3AED]', 'bg-[#E8F5E9] text-[#2E7D32]', 'bg-[#FFF8E1] text-[#B45309]', 'bg-[#FCE4EC] text-[#AD1457]', 'bg-[#E0F7FA] text-[#00838F]'];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const toneFor = (name: string) => AVATAR_TONES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];

/** Initials circle for a person; a dashed circle for the team queue. */
export function Avatar({ name, size = 'sm' }: { name: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';
  if (!name) return <span title="Team queue" className={`${box} flex-shrink-0 inline-flex items-center justify-center rounded-full border border-dashed border-[#C8C8D2] text-[#A0A0B0]`}>?</span>;
  return <span title={name} className={`${box} flex-shrink-0 inline-flex items-center justify-center rounded-full font-semibold ${toneFor(name)}`}>{initials(name)}</span>;
}

/** Avatar + name, or "Team queue". */
export function Owner({ name }: { name: string | null }) {
  return <span className="inline-flex items-center gap-1.5 min-w-0"><Avatar name={name} /><span className={`truncate ${name ? '' : 'text-[#A0A0B0]'}`}>{name ?? 'Team queue'}</span></span>;
}

/** Page title (with an optional count chip, like Cases), one-line subtitle and actions. */
export function PageHeader({ title, count, sub, actions }: { title: string; count?: number; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] flex items-center gap-3">
          {title}
          {count != null && <span className="px-2.5 py-0.5 rounded-full border border-[#C8D8FC] text-sm font-semibold text-[#4D8EF7]">{count}</span>}
        </h1>
        {sub && <p className="text-sm text-[#717182] mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small stat tile with an icon; clickable when it leads somewhere. */
export function StatTile({ icon: Icon, tint, label, value, sub, onClick, alert }: { icon: LucideIcon; tint: string; label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void; alert?: boolean }) {
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={e => onClick && e.key === 'Enter' && onClick()}
      className={`flex items-start gap-3 text-left bg-white border rounded-xl px-4 py-3 ${onClick ? 'cursor-pointer hover:border-[#C7DAFF] transition-colors' : ''} ${alert ? 'border-[#F5C2C2]' : 'border-[#E0E0E6]'}`}>
      <span className={`w-9 h-9 rounded-lg flex-shrink-0 inline-flex items-center justify-center ${tint}`}><Icon className="w-4 h-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#717182]">{label}</p>
        <p className={`text-2xl font-semibold leading-tight ${alert ? 'text-[#C62828]' : 'text-[#030213]'}`}>{value}</p>
        {sub && <p className="text-[11px] text-[#717182] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/** Card title with a leading icon. */
export function IconTitle({ icon: Icon, tint, children }: { icon: LucideIcon; tint: string; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2"><Icon className={`w-4 h-4 ${tint}`} />{children}</span>;
}
