import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { InvoiceStatus } from './types';

// ── Small building blocks shared by the Billing screens ──────────────────────
// Same look as the portal (white cards, #E0E0E6 borders, #4D8EF7 accents).

export const input = 'w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] bg-white focus:outline-none focus:border-[#4D8EF7]';
export const inputSm = 'px-2 py-1 rounded-md border border-[#E0E0E6] text-xs text-[#030213] bg-white focus:outline-none focus:border-[#4D8EF7]';
export const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white text-[#030213] hover:bg-[#F8F9FC] transition-colors disabled:opacity-50';
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF] hover:opacity-90 transition-opacity disabled:opacity-50';
export const btnDanger = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#F5C2C2] bg-white text-[#C62828] hover:bg-[#FFF5F5] transition-colors disabled:opacity-50';
export const link = 'text-[#4D8EF7] font-medium hover:underline';
export const th = 'text-left text-[10px] font-semibold uppercase tracking-wide text-[#717182] px-3 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6] whitespace-nowrap';
export const td = 'px-3 py-2 text-xs text-[#030213] border-b border-[#F0EFF6] align-top';

export function Card({ title, sub, actions, children, className = '', pad = true }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`bg-white border border-[#E0E0E6] rounded-xl ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-[#F0EFF6]">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-[#030213]">{title}</h3>}
            {sub && <p className="text-[11px] text-[#717182] mt-0.5">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

const TONES = {
  gray: 'bg-[#F3F3F5] text-[#5A5568]',
  blue: 'bg-[#EEF4FF] text-[#1565C0]',
  green: 'bg-[#E8F5E9] text-[#2E7D32]',
  amber: 'bg-[#FFF8E1] text-[#B45309]',
  red: 'bg-[#FFEBEE] text-[#C62828]',
  purple: 'bg-[#F5F3FF] text-[#7C3AED]',
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = 'gray', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-semibold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

export const STATUS_PILL: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Waiting for approval', tone: 'blue' },
  flagged: { label: 'Flagged', tone: 'amber' },
  sent: { label: 'Sent', tone: 'purple' },
  'part-paid': { label: 'Part paid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  void: { label: 'Void', tone: 'gray' },
};
export function InvoiceStatusPill({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  if (overdue) return <Pill tone="red">Overdue</Pill>;
  const p = STATUS_PILL[status];
  return <Pill tone={p.tone}>{p.label}</Pill>;
}

export function Stat({ label, value, sub, tone, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'green' | 'amber'; onClick?: () => void }) {
  const c = tone === 'red' ? 'text-[#C62828]' : tone === 'green' ? 'text-[#2E7D32]' : tone === 'amber' ? 'text-[#B45309]' : 'text-[#030213]';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`text-left bg-white border border-[#E0E0E6] rounded-xl px-4 py-3 ${onClick ? 'hover:border-[#C8D8FC] transition-colors' : ''}`}>
      <p className="text-[11px] text-[#717182]">{label}</p>
      <p className={`text-xl font-semibold mt-0.5 ${c}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#A0A0B0] mt-0.5">{sub}</p>}
    </Tag>
  );
}

export function Note({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'amber' | 'red' | 'green' }) {
  const c = { blue: 'bg-[#F5F9FF] border-[#C8D8FC] text-[#1565C0]', amber: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]', red: 'bg-[#FFF5F5] border-[#F5C2C2] text-[#B71C1C]', green: 'bg-[#F1F8F2] border-[#C8E6C9] text-[#1B5E20]' }[tone];
  return <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${c}`}><Info className="w-3.5 h-3.5 mt-px flex-shrink-0" /><div className="min-w-0">{children}</div></div>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#030213] mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[#A0A0B0] mt-1">{hint}</span>}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-[#F3F3F5]">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${value === o.value ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Bar({ pct, tone = 'blue', marker }: { pct: number; tone?: 'blue' | 'amber' | 'red' | 'green'; marker?: number }) {
  const c = { blue: 'bg-[#4D8EF7]', amber: 'bg-[#F59E0B]', red: 'bg-[#E53935]', green: 'bg-[#43A047]' }[tone];
  return (
    <div className="relative h-2 rounded-full bg-[#F0EFF6] overflow-hidden">
      <div className={`h-full ${c}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      {marker != null && <div className="absolute top-0 bottom-0 w-px bg-[#030213]/40" style={{ left: `${marker}%` }} />}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[#A0A0B0] text-center py-6">{children}</p>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-xs text-[#030213]">
      <span className={`relative w-8 h-[18px] rounded-full transition-colors ${on ? 'bg-[#4D8EF7]' : 'bg-[#D4CEE1]'}`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${on ? 'left-[16px]' : 'left-[2px]'}`} />
      </span>
      {label}
    </button>
  );
}
