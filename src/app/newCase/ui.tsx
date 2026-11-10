// ─── New Case Flow · shared UI pieces ────────────────────────────────────────
// Chips, tags, notes and buttons in the portal's own idiom (inline hex tokens,
// lucide icons). Chip groups are named radiogroups; every control is a real
// button so keyboard users get the same flow.

import { createContext, forwardRef, ReactNode, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Info, X, type LucideIcon } from 'lucide-react';
import { useRoom } from './room';

/** White text on this gradient passes 4.5:1 (slightly deeper than the brand). */
export const GRADIENT_BTN = 'bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8] text-white';
export const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6FE8] focus-visible:ring-offset-2';

export function PrimaryButton({ children, onClick, disabled, className = '', title, type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; title?: string; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold ${GRADIENT_BTN} hover:opacity-95 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS} ${className}`}
    >
      {children}
    </button>
  );
}
export function SecondaryButton({ children, onClick, disabled, className = '', title }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-[#3A3A4A] border border-[#D4D4DD] bg-white hover:bg-[#F8F9FC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS} ${className}`}
    >
      {children}
    </button>
  );
}
export function LinkButton({ children, onClick, className = '', disabled }: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`text-xs font-semibold text-[#2F62D6] hover:text-[#1E40AF] hover:underline disabled:opacity-40 rounded ${FOCUS} ${className}`}>
      {children}
    </button>
  );
}

/**
 * "That's it, move on" as a round arrow instead of a "Done: …" button. Beside it
 * the arrow says where it goes ("Next · Material"), or, while it can't go yet,
 * what's missing. It pulses twice when it becomes ready. `label` is what a
 * screen reader hears ("Done: 25 · UL5").
 */
export function NextArrow({ onClick, disabled, label, next, hint, side = 'right', back, compact }: {
  onClick: () => void; disabled?: boolean; label: string; next?: string; hint?: string;
  /** Where the "Next · …" words sit; the card's top-right corner puts them before the arrow. */
  side?: 'left' | 'right';
  /** The twin that goes back: the same gradient, ← and "Back · Prescriber". */
  back?: boolean;
  /** For the card's corners: a smaller arrow and one small line of text. */
  compact?: boolean;
}) {
  const Icon = back ? ArrowLeft : ArrowRight;
  return (
    <div className={`inline-flex max-w-full min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'} ${side === 'left' ? 'flex-row-reverse text-right' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={next && !disabled ? `${label}, ${back ? 'to' : 'next'}: ${next}` : label}
        title={disabled ? hint : label}
        className={`group relative ${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-full flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95 transition-transform motion-reduce:transition-none disabled:opacity-35 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed ${FOCUS} ${
          // Back wears the same gradient as forward (the user's call); only forward pulses.
          `${GRADIENT_BTN} shadow-[0_6px_16px_rgba(63,111,232,0.32)]`
        }`}
      >
        {!disabled && !back && <span aria-hidden className="absolute inset-0 rounded-full ring-2 ring-[#3F6FE8]/50 motion-safe:animate-ping [animation-iteration-count:2]" />}
        <Icon className={`relative ${compact ? 'w-4 h-4' : 'w-5 h-5'} transition-transform ${back ? 'motion-safe:group-hover:-translate-x-0.5' : 'motion-safe:group-hover:translate-x-0.5'}`} aria-hidden />
      </button>
      {disabled
        ? hint && <span className={`min-w-0 text-[#5A5A6A] ${compact ? 'text-[11px] truncate' : 'text-xs line-clamp-2'}`} title={hint} aria-hidden>{hint}</span>
        : next && (compact ? (
          // One small line: "Back · Prescriber".
          <span className="min-w-0 truncate text-xs leading-4" title={next} aria-hidden>
            <span className="text-[#5A5A6A]">{back ? 'Back' : 'Next'} · </span>
            <span className="font-semibold text-[#030213]">{next}</span>
          </span>
        ) : (
          <span className="min-w-0 leading-tight" aria-hidden>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">{back ? 'Back' : 'Next'}</span>
            <span className="block text-sm font-semibold text-[#030213] truncate">{next}</span>
          </span>
        ))}
    </div>
  );
}

const TAG_TONE: Record<string, string> = {
  You: 'bg-[#EEF4FF] text-[#1E40AF] border-[#C8D8FC]',
  'Changed for this case': 'bg-[#EEF4FF] text-[#1E40AF] border-[#C8D8FC]',
};
/** Where a known value came from: "From scan", "Your usual", "Calculated"… */
export function SourceTag({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${TAG_TONE[src] ?? 'bg-[#F3F3F5] text-[#4A4A5A] border-[#E0E0E6]'}`}>
      {src}
    </span>
  );
}

export interface ChipOption {
  id: string;
  label: string;
  sub?: string;
  tag?: string;
  disabled?: boolean;
  reason?: string;
  swatch?: string;
}
/** A single-choice chip group (radiogroup). */
export function ChoiceChips({ label, options, value, onChange, size = 'md', className = '' }: {
  label: string; options: ChipOption[]; value?: string; onChange: (id: string) => void; size?: 'sm' | 'md'; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map(o => (
        <Chip key={o.id} option={o} selected={value === o.id} role="radio" onClick={() => !o.disabled && onChange(o.id)} size={size} />
      ))}
    </div>
  );
}
/** A multi-choice chip group (each chip is a toggle button). */
export function ToggleChips({ label, options, values, onToggle }: {
  label: string; options: ChipOption[]; values: string[]; onToggle: (id: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => (
        <Chip key={o.id} option={o} selected={values.includes(o.id)} role="toggle" onClick={() => !o.disabled && onToggle(o.id)} />
      ))}
    </div>
  );
}
function Chip({ option: o, selected, role, onClick, size = 'md' }: { option: ChipOption; selected: boolean; role: 'radio' | 'toggle'; onClick: () => void; size?: 'sm' | 'md' }) {
  const a11y = role === 'radio' ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected };
  return (
    <button
      type="button"
      {...a11y}
      aria-disabled={o.disabled || undefined}
      aria-label={[o.label, o.tag, o.disabled ? o.reason : o.sub].filter(Boolean).join(', ')}
      title={o.disabled ? o.reason : o.sub}
      onClick={onClick}
      className={`group relative text-left rounded-xl border transition-all ${size === 'sm' ? 'px-2.5 py-1.5' : 'px-3.5 py-2.5'} ${FOCUS} ${
        o.disabled
          ? 'bg-[#FAFAFB] border-dashed border-[#D4D4DD] cursor-not-allowed'
          : selected
            ? 'bg-[#EEF4FF] border-[#3F6FE8] ring-1 ring-[#3F6FE8]'
            : 'bg-white border-[#D4D4DD] hover:border-[#3F6FE8] hover:bg-[#F8FAFF]'
      }`}
    >
      <span className="flex items-center gap-2">
        {o.swatch && <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0" style={{ background: o.swatch }} aria-hidden />}
        <span className={`text-sm font-semibold ${o.disabled ? 'text-[#8B8B9E]' : 'text-[#030213]'}`}>{o.label}</span>
        {o.tag && <SourceTag src={o.tag} />}
        {selected && <Check className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={3} aria-hidden />}
      </span>
      {(o.sub || (o.disabled && o.reason)) && (
        <span className={`block text-[11px] mt-0.5 ${o.disabled ? 'text-[#6B6B7B]' : 'text-[#5A5A6A]'}`}>{o.disabled ? o.reason : o.sub}</span>
      )}
    </button>
  );
}

/** Two- or three-way segmented control (radios). */
export function Segmented<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-0.5 rounded-lg bg-[#F0EFF6] border border-[#E0E0E6]">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${FOCUS} ${
            value === o.id ? 'bg-white text-[#030213] shadow-sm' : 'text-[#5A5A6A] hover:text-[#030213]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Where a layout wants step titles to sit instead of above the step: Guided
 * puts it between the card's ← back and → next arrows. Null elsewhere.
 */
export const HeadingSlotContext = createContext<HTMLElement | null>(null);

/**
 * A step's kicker and question; receives focus whenever the step changes. With
 * room to spare it leads with the step's icon on a soft tile. Where the layout
 * offers a heading slot (Guided's arrow row) it renders there instead, small,
 * centred between the arrows, and only its one-line description stays here.
 */
export const StepHeading = forwardRef<HTMLHeadingElement, { kicker?: ReactNode; title: ReactNode; children?: ReactNode; icon?: LucideIcon }>(
  function StepHeading({ kicker, title, children, icon: Icon }, ref) {
    const wide = useRoom() === 'wide';
    const slot = useContext(HeadingSlotContext);
    if (slot) {
      return (
        <>
          {createPortal(
            // One line: the step's icon and its title. The section name is read out, not shown.
            <h2 ref={ref} tabIndex={-1} title={typeof title === 'string' ? title : undefined} className="min-w-0 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#030213] leading-5 focus:outline-none">
              {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-[#2F62D6]" strokeWidth={2} aria-hidden />}
              {kicker && <span className="sr-only">{kicker}: </span>}
              <span className="truncate">{title}</span>
            </h2>,
            slot,
          )}
          {children && <div className="mb-4 text-sm text-[#5A5A6A]">{children}</div>}
        </>
      );
    }
    return (
      <div className={`mb-5 ${Icon && wide ? 'flex items-start gap-4' : ''}`}>
        {Icon && wide && (
          <span aria-hidden className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          {kicker && <p className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A6A] mb-1">{kicker}</p>}
          <h2 ref={ref} tabIndex={-1} className="text-xl font-semibold text-[#030213] leading-snug focus:outline-none">{title}</h2>
          {children && <div className="mt-1.5 text-sm text-[#5A5A6A]">{children}</div>}
        </div>
      </div>
    );
  },
);

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-[#E0E0E6] rounded-2xl ${className}`}>{children}</div>;
}
/** Light panel for defaulted answers shown above the current question. */
export function DefaultsPanel({ children }: { children: ReactNode }) {
  return <div className="mb-5 rounded-xl bg-[#F8F9FC] border border-[#ECECF2] p-4 space-y-4">{children}</div>;
}
export function FieldLabel({ children, src, right }: { children: ReactNode; src?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <p className="text-xs font-semibold text-[#3A3A4A]">{children}</p>
      <SourceTag src={src} />
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/** Note (dismissible), decision (two buttons inline) or blocker. */
export function Notice({ tone = 'note', children, onDismiss, actions, role }: {
  tone?: 'note' | 'decision' | 'block' | 'success';
  children: ReactNode;
  onDismiss?: () => void;
  actions?: ReactNode;
  role?: 'alert' | 'status';
}) {
  const t = {
    note:     { box: 'bg-[#F5F8FF] border-[#D6E2FB]', icon: <Info className="w-4 h-4 text-[#2F62D6]" /> },
    decision: { box: 'bg-[#FFF8E1] border-[#F5D98B]', icon: <AlertTriangle className="w-4 h-4 text-[#B45309]" /> },
    block:    { box: 'bg-[#FEF2F2] border-[#F5C2C7]', icon: <AlertTriangle className="w-4 h-4 text-[#B91C1C]" /> },
    success:  { box: 'bg-[#F0FDF4] border-[#BBF7D0]', icon: <Check className="w-4 h-4 text-[#15803D]" /> },
  }[tone];
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${t.box}`}>
      <span className="mt-0.5 flex-shrink-0" aria-hidden>{t.icon}</span>
      <div className="flex-1 min-w-0 text-sm text-[#1F1F2E] leading-relaxed">
        {children}
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={`p-0.5 rounded text-[#6B6B7B] hover:text-[#030213] ${FOCUS}`}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Done ✓ (green) · needs you (an orange circle with "!" that ripples, so
 * what's pending catches the eye; `ripple={false}` where it sits inside a
 * button that already says so) · not reached (a hollow circle).
 */
export function StateIcon({ state, size = 'md', ripple = true }: { state: 'done' | 'gap' | 'todo' | 'active'; size?: 'sm' | 'md'; ripple?: boolean }) {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  if (state === 'done') {
    return <span className={`${s} rounded-full bg-[#2E7D32] text-white flex items-center justify-center flex-shrink-0`} aria-hidden><Check className="w-3 h-3" strokeWidth={3} /></span>;
  }
  if (state === 'gap') {
    return (
      <span className={`${s} relative flex items-center justify-center flex-shrink-0`} aria-hidden>
        {ripple && <span className="absolute inset-0 rounded-full bg-[#F59E0B]/45 motion-safe:animate-ping [animation-duration:1.8s]" />}
        <span className={`relative w-full h-full rounded-full bg-[#E07B00] text-white flex items-center justify-center font-bold leading-none ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'}`}>!</span>
      </span>
    );
  }
  return <span className={`${s} rounded-full border-2 border-[#B8B8C6] bg-white flex-shrink-0`} aria-hidden />;
}

/** "▲ 2 Things Left →" */
export function GapButton({ count, onClick, className = '' }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#FFF8E1] text-[#8A4B08] border border-[#F5D98B] hover:bg-[#FFF1C7] transition-colors ${FOCUS} ${className}`}
    >
      <StateIcon state="gap" size="sm" ripple={false} />
      {count} {count === 1 ? 'Thing Left' : 'Things Left'} →
    </button>
  );
}
