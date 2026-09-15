import type { ReactNode } from 'react';
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import type { CareStackLogEntry, EntityMapping } from '../../data/carestack';
import { formatStamp } from '../../data/carestack';

// ─── Small pieces shared by the CareStack surfaces ───────────────────────────

/** The user acting in the prototype — mirrors CURRENT_USER in CasesPage. */
export const CS_CURRENT_USER = 'Sana Khan';

export const inputCls =
  'w-full text-xs px-2.5 py-2 rounded-lg border border-[#E0E0E6] bg-white text-[#030213] outline-none transition-colors focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20 placeholder:text-[#A0A0B0]';
export const labelCls = 'block text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider mb-1';
export const primaryBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';
export const secondaryBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4D8EF7] border border-[#C8D8FC] hover:bg-[#EEF4FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const ghostBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors';

/** Hover bubble (same dark tooltip the overview pages use — no shared component exists). */
export function StatusTip({ text, children, className = '' }: { text: string; children: ReactNode; className?: string }) {
  return (
    <span tabIndex={0} title={text} className={`group relative inline-flex items-center cursor-help focus:outline-none ${className}`}>
      {children}
      <span className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block group-focus:block bg-[#030213] text-white text-[10px] font-medium leading-snug px-2 py-1.5 rounded-md shadow-lg whitespace-normal w-52 text-center">
        {text}
      </span>
    </span>
  );
}

/** Loading / green tick / red cross for one mapped entity. */
export function MappingIcon({ mapping, entity }: { mapping: EntityMapping; entity: string }) {
  switch (mapping.status) {
    case 'checking':
      return <Loader2 className="w-4 h-4 text-[#4D8EF7] animate-spin flex-shrink-0" />;
    case 'matched':
      return (
        <StatusTip text={`${entity} found in CareStack · ${mapping.csId}`}>
          <CheckCircle2 className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
        </StatusTip>
      );
    case 'not-found':
      return (
        <StatusTip text={`${entity} not found in CareStack`}>
          <XCircle className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
        </StatusTip>
      );
    default:
      return <Clock className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />;
  }
}

export const MAPPING_LABEL: Record<EntityMapping['status'], string> = {
  idle: 'Pending',
  checking: 'Loading',
  matched: 'Matched',
  'not-found': 'Not Found',
};
export const MAPPING_PILL: Record<EntityMapping['status'], string> = {
  idle: 'bg-[#F3F3F5] text-[#717182] border-[#E0E0E6]',
  checking: 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]',
  matched: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  'not-found': 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
};

export function LogOutcomeIcon({ outcome }: { outcome: CareStackLogEntry['outcome'] }) {
  if (outcome === 'ok') return <span className="w-5 h-5 rounded-md bg-[#F0FDF4] flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-3 h-3 text-[#15803D]" /></span>;
  if (outcome === 'failed') return <span className="w-5 h-5 rounded-md bg-[#FEF2F2] flex items-center justify-center flex-shrink-0"><XCircle className="w-3 h-3 text-[#DC2626]" /></span>;
  if (outcome === 'queued') return <span className="w-5 h-5 rounded-md bg-[#FFF8E1] flex items-center justify-center flex-shrink-0"><Clock className="w-3 h-3 text-[#B45309]" /></span>;
  return <span className="w-5 h-5 rounded-md bg-[#F3F3F5] flex items-center justify-center flex-shrink-0"><Clock className="w-3 h-3 text-[#A0A0B0]" /></span>;
}

export function Stamp({ iso }: { iso?: string | null }) {
  return <span className="tabular-nums">{formatStamp(iso)}</span>;
}

/** Today as YYYY-MM-DD for date inputs. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Now as YYYY-MM-DDTHH:mm for datetime-local inputs. */
export function nowLocalIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** 'YYYY-MM-DD' → 'DD-MMM-YYYY'. */
export function isoToDmy(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mi = Number(m) - 1;
  if (mi < 0 || mi > 11 || !d || !y) return '';
  return `${d.padStart(2, '0')}-${MONTHS[mi]}-${y}`;
}
/** 'DD-MMM-YYYY' → 'YYYY-MM-DD'. */
export function dmyToIso(dmy?: string | null): string {
  if (!dmy) return '';
  const [d, m, y] = dmy.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mi = MONTHS.indexOf(m);
  if (mi < 0 || !d || !y) return '';
  return `${y}-${String(mi + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
}
