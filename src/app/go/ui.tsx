// ─── Smile Genius Go — mobile UI kit ─────────────────────────────────────────
// Small set of touch-first primitives. Every colour comes from the `go-*`
// tokens so each component works in light and dark without variants.
import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, Check, Search, X, Home, Layers, Plus, Wallet, User, CheckCircle2, AlertTriangle, Info, Camera, PenLine,
} from './icons';
import { useGo, useScoped } from './store';
import { LabCase, ReadinessLevel, STAGES, Stage, isOverdue, readiness, stageIndex } from './data';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Layout ─────────────────────────────────────────────────────────────────

export function Screen({ header, children, footer, tabs, bg = 'bg-go-bg' }: {
  header?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; tabs?: boolean; bg?: string;
}) {
  return (
    <div className={cx('absolute inset-0 flex flex-col', bg)}>
      {header}
      <div className="go-scroll flex-1 overflow-y-auto overflow-x-hidden">
        {children}
        <div className={tabs ? 'h-28' : 'h-6'} />
      </div>
      {footer && (
        <div className="relative z-10 border-t border-go-line bg-go-surface/90 backdrop-blur-xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
          {footer}
        </div>
      )}
      {tabs && <TabBar />}
    </div>
  );
}

/** Back = browser back when there is history inside the app, else `fallback`. */
export function useBack(fallback = '/go/home') {
  const navigate = useNavigate();
  const location = useLocation();
  return () => (location.key !== 'default' ? navigate(-1) : navigate(fallback));
}

export function TopBar({ title, sub, back, fallback, right, large }: {
  title?: React.ReactNode; sub?: React.ReactNode; back?: boolean; fallback?: string; right?: React.ReactNode; large?: boolean;
}) {
  const goBack = useBack(fallback);
  return (
    <div className="relative z-10 bg-go-bg/85 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 h-14">
        {back ? (
          <button onClick={goBack} aria-label="Go back" className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-go-ink hover:bg-go-raised active:scale-95 transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : <div className="w-1" />}
        {!large && (
          <div className="flex-1 min-w-0 text-center">
            {title && <p className="text-[15px] font-semibold text-go-ink truncate">{title}</p>}
            {sub && <p className="text-[11px] text-go-muted truncate -mt-0.5">{sub}</p>}
          </div>
        )}
        {large && <div className="flex-1" />}
        <div className="min-w-[40px] flex items-center justify-end gap-1">{right}</div>
      </div>
      {large && (
        <div className="px-5 pb-3">
          <h1 className="text-[28px] leading-tight font-bold text-go-ink tracking-tight">{title}</h1>
          {sub && <p className="text-[13px] text-go-muted mt-1">{sub}</p>}
        </div>
      )}
    </div>
  );
}

export function IconBtn({ children, onClick, label, badge }: { children: React.ReactNode; onClick?: () => void; label: string; badge?: number }) {
  return (
    <button onClick={onClick} aria-label={label} className="relative w-10 h-10 rounded-full flex items-center justify-center text-go-ink bg-go-surface border border-go-line hover:bg-go-raised active:scale-95 transition">
      {children}
      {!!badge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full go-grad text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-go-bg">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Tab bar ────────────────────────────────────────────────────────────────

export function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { invoices } = useScoped();
  const [newOpen, setNewOpen] = useState(false);
  const finCount = invoices.filter(i => i.status === 'to-approve' || i.status === 'needs-review').length;
  const tabs = [
    { to: '/go/home', label: 'Home', icon: Home },
    { to: '/go/work', label: 'Lab work', icon: Layers },
    null,
    { to: '/go/finance', label: 'Finance', icon: Wallet, badge: finCount },
    { to: '/go/account', label: 'Account', icon: User },
  ];
  return (
    <>
      <nav className="go-tabbar absolute bottom-0 inset-x-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 pointer-events-none">
        <div className="pointer-events-auto relative flex items-center justify-around h-16 rounded-[26px] bg-go-surface/80 backdrop-blur-2xl border border-go-line go-card-shadow">
          {tabs.map((t, i) => {
            if (!t) {
              return (
                <button key="new" onClick={() => setNewOpen(true)} aria-label="New lab work"
                  className="-mt-7 w-14 h-14 rounded-[20px] go-grad go-glow text-white flex items-center justify-center active:scale-95 transition ring-4 ring-go-bg">
                  <Plus className="w-6 h-6" strokeWidth={2.5} />
                </button>
              );
            }
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <button key={i} onClick={() => navigate(t.to)} className="relative flex-1 flex flex-col items-center gap-0.5 py-1">
                <span className={cx('relative flex items-center justify-center w-10 h-7 rounded-full transition', active && 'bg-go-brand-soft')}>
                  <Icon className={cx('w-[20px] h-[20px] transition', active ? 'text-go-brand' : 'text-go-muted')} strokeWidth={active ? 2.4 : 2} />
                  {!!t.badge && <span className="absolute -top-1 right-0 min-w-[16px] h-4 px-1 rounded-full bg-go-bad text-white text-[9px] font-bold flex items-center justify-center">{t.badge}</span>}
                </span>
                <span className={cx('text-[10px] font-semibold', active ? 'text-go-brand' : 'text-go-muted')}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <NewWorkSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}

export function NewWorkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <Sheet open={open} onClose={onClose} title="New lab work" sub="Choose how you want to create the prescription.">
      <div className="space-y-3">
        <ActionTile icon={<Camera className="w-6 h-6" />} tone="brand" title="Photograph prescription" body="Snap a paper Rx — details are read for you to check." onClick={() => go('/go/new/capture')} />
        <ActionTile icon={<PenLine className="w-6 h-6" />} tone="violet" title="Create manually" body="Short guided form, three steps." onClick={() => go('/go/new/manual')} />
      </div>
    </Sheet>
  );
}

/** App icon — the Smile Genius smile + dot on the brand gradient. */
export function GoMark({ size = 36, plain }: { size?: number; plain?: boolean }) {
  const { theme } = useGo();
  const gid = useId();
  // Smile Genius brand mark (swoosh + dot) — same vector as public/favicon.svg
  const mark = (w: number, cls?: string, fill = 'currentColor') => (
    <svg viewBox="0 0 219 77" style={{ width: w, height: w * (77 / 219) }} fill={fill} aria-hidden="true" className={cls}>
      <defs>
        <linearGradient id={gid} x1="219" y1="40" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4D8EF7" /><stop offset="1" stopColor="#A59DFF" />
        </linearGradient>
      </defs>
      <path d="M191.419 32.4519C197.375 21.5101 188.444 25.3832 183.234 28.6874C97.2679 83.2079 21.5955 47.9542 7.28707 42.9781C0.305509 40.55 0.30552 40.55 0.30552 40.55C14.7773 57.4099 46.738 74.6491 96.8154 72.5271C151.038 70.2295 183.973 46.1293 191.419 32.4519Z" />
      <path d="M206.562 24C202.867 24 199.829 22.8817 197.448 20.6452C195.149 18.3226 194 15.4839 194 12.129C194 8.68817 195.149 5.80645 197.448 3.48387C199.829 1.16129 202.867 0 206.562 0C210.174 0 213.13 1.16129 215.429 3.48387C217.81 5.80645 219 8.68817 219 12.129C219 15.4839 217.81 18.3226 215.429 20.6452C213.13 22.8817 210.174 24 206.562 24Z" />
    </svg>
  );
  // plain: bare mark — brand gradient on light, soft white on dark — no tile
  if (plain) return theme === 'dark' ? mark(size, 'text-white/60 flex-shrink-0') : mark(size, 'flex-shrink-0', `url(#${gid})`);
  return (
    <span className="go-grad rounded-[30%] flex items-center justify-center flex-shrink-0 go-glow text-white" style={{ width: size, height: size }}>
      {mark(size * 0.68)}
    </span>
  );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

export function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={cx('block w-full text-left bg-go-surface rounded-[22px] border border-go-line/80 go-card-shadow', onClick && 'active:scale-[.99] transition hover:border-go-brand/40', className)}>
      {children}
    </C>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('px-4 mt-6', className)}>
      <div className="flex items-center justify-between px-1 mb-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export type Tone = 'brand' | 'violet' | 'ok' | 'warn' | 'bad' | 'teal' | 'pink' | 'neutral';
const TONE: Record<Tone, string> = {
  brand: 'bg-go-brand-soft text-go-brand-ink',
  violet: 'bg-go-violet-soft text-go-violet',
  ok: 'bg-go-ok-soft text-go-ok',
  warn: 'bg-go-warn-soft text-go-warn',
  bad: 'bg-go-bad-soft text-go-bad',
  teal: 'bg-go-teal-soft text-go-teal',
  pink: 'bg-go-pink-soft text-go-pink',
  neutral: 'bg-go-raised text-go-ink2',
};
const DOT: Record<Tone, string> = {
  brand: 'bg-go-brand', violet: 'bg-go-violet', ok: 'bg-go-ok', warn: 'bg-go-warn', bad: 'bg-go-bad', teal: 'bg-go-teal', pink: 'bg-go-pink', neutral: 'bg-go-faint',
};

export function Pill({ tone = 'neutral', children, dot, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap', TONE[tone], className)}>
      {dot && <span className={cx('w-1.5 h-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  );
}

export function IconTile({ icon, tone = 'brand', size = 'md' }: { icon: React.ReactNode; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-9 h-9 rounded-xl' : size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-11 h-11 rounded-2xl';
  return <span className={cx('flex items-center justify-center flex-shrink-0', s, TONE[tone])}>{icon}</span>;
}

export function ActionTile({ icon, tone, title, body, onClick, right }: { icon: React.ReactNode; tone: Tone; title: string; body?: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <Card onClick={onClick} className="p-4 flex items-center gap-3.5">
      <IconTile icon={icon} tone={tone} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-go-ink">{title}</span>
        {body && <span className="block text-[12.5px] text-go-muted leading-snug mt-0.5">{body}</span>}
      </span>
      {right}
    </Card>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const ini = name.replace(/^Dr\s+/, '').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="go-grad text-white font-bold rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {ini}
    </span>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-go-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 py-3">
          <dt className="text-[13px] text-go-muted flex-shrink-0">{k}</dt>
          <dd className="text-[13.5px] font-medium text-go-ink text-right min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-12">
      <span className="w-16 h-16 rounded-3xl bg-go-raised border border-go-line text-go-muted flex items-center justify-center mb-4">{icon}</span>
      <p className="text-[16px] font-semibold text-go-ink">{title}</p>
      {body && <p className="text-[13px] text-go-muted mt-1 leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Buttons & inputs ───────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost';
const BTN: Record<BtnVariant, string> = {
  primary: 'go-grad text-white go-glow',
  secondary: 'bg-go-surface text-go-ink border border-go-line',
  soft: 'bg-go-brand-soft text-go-brand-ink',
  danger: 'bg-go-bad text-white',
  ghost: 'text-go-brand',
};
export function Btn({ children, variant = 'primary', icon, block, onClick, disabled, size = 'lg', type = 'button', className }: {
  children: React.ReactNode; variant?: BtnVariant; icon?: React.ReactNode; block?: boolean; onClick?: () => void; disabled?: boolean;
  size?: 'md' | 'lg'; type?: 'button' | 'submit'; className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cx('inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition active:scale-[.98] disabled:opacity-40 disabled:shadow-none disabled:active:scale-100',
        size === 'lg' ? 'h-[52px] px-5 text-[15px]' : 'h-10 px-4 text-[13.5px] rounded-xl', block && 'w-full', BTN[variant], className)}>
      {icon}{children}
    </button>
  );
}

export function Label({ children, hint, optional }: { children: React.ReactNode; hint?: string; optional?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5 px-0.5">
      <span className="text-[13px] font-semibold text-go-ink">{children}{optional && <span className="font-normal text-go-faint"> · optional</span>}</span>
      {hint && <span className="text-[11px] text-go-muted">{hint}</span>}
    </div>
  );
}

const fieldCls = 'w-full rounded-2xl bg-go-surface border border-go-line text-[15px] text-go-ink placeholder:text-go-faint outline-none focus:border-go-brand focus:ring-4 focus:ring-go-brand/15 transition';
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldCls, 'h-[52px] px-4', props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(fieldCls, 'px-4 py-3 resize-none leading-relaxed', props.className)} />;
}

export function Chips<T extends string>({ options, value, onChange, multi, wrap = true }: {
  options: readonly T[]; value: T | T[] | null; onChange: (v: any) => void; multi?: boolean; wrap?: boolean;
}) {
  const sel = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <div className={cx('flex gap-2', wrap ? 'flex-wrap' : 'overflow-x-auto go-scroll -mx-4 px-4')}>
      {options.map(o => (
        <button key={o} type="button"
          onClick={() => (multi ? onChange(sel(o) ? (value as T[]).filter(x => x !== o) : [...((value as T[]) ?? []), o]) : onChange(o))}
          className={cx('h-9 px-3.5 rounded-full text-[13px] font-medium border transition whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5',
            sel(o) ? 'bg-go-brand text-white border-go-brand' : 'bg-go-surface text-go-ink2 border-go-line hover:border-go-brand/50')}>
          {sel(o) && multi && <Check className="w-3.5 h-3.5" strokeWidth={3} />}{o}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex p-1 rounded-2xl bg-go-raised border border-go-line">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx('flex-1 h-9 rounded-xl text-[13px] font-semibold transition inline-flex items-center justify-center gap-1.5',
            value === o.value ? 'bg-go-surface text-go-ink go-card-shadow' : 'text-go-muted')}>
          {o.label}
          {o.count !== undefined && <span className={cx('text-[11px] px-1.5 rounded-full', value === o.value ? 'bg-go-brand-soft text-go-brand-ink' : 'bg-go-line/60')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx('relative w-[50px] h-[30px] rounded-full transition flex-shrink-0', on ? 'go-grad' : 'bg-go-line')}>
      <span className={cx('absolute top-[3px] w-6 h-6 rounded-full bg-white shadow transition-all', on ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}

export function Stepper({ value, onChange, min = 1, max = 9 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center h-[52px] rounded-2xl border border-go-line bg-go-surface">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-12 h-full text-xl text-go-ink2 disabled:opacity-30" disabled={value <= min}>−</button>
      <span className="w-8 text-center text-[16px] font-semibold text-go-ink tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="w-12 h-full text-xl text-go-ink2 disabled:opacity-30" disabled={value >= max}>+</button>
    </div>
  );
}

export function CheckRow({ checked, onChange, label, required }: { checked: boolean; onChange: (v: boolean) => void; label: string; required?: boolean }) {
  return (
    <button onClick={() => onChange(!checked)} className={cx('w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition',
      checked ? 'border-go-ok/40 bg-go-ok-soft' : 'border-go-line bg-go-surface')}>
      <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition', checked ? 'bg-go-ok text-white' : 'border-2 border-go-line')}>
        {checked && <Check className="w-4 h-4" strokeWidth={3} />}
      </span>
      <span className="flex-1 text-[14px] text-go-ink">{label}</span>
      {required && !checked && <span className="text-[10px] font-bold uppercase tracking-wider text-go-warn">Required</span>}
    </button>
  );
}

// ─── Sheet & picker ─────────────────────────────────────────────────────────

export function Sheet({ open, onClose, title, sub, children, footer, tall }: {
  open: boolean; onClose: () => void; title?: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode; tall?: boolean;
}) {
  const { sheetRoot } = useGo();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open || !sheetRoot) return null;
  return createPortal(
    <div className="absolute inset-0 z-50 flex flex-col justify-end transition-[padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ paddingBottom: 'var(--go-kb, 0px)' }}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] go-fade-in" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cx('relative go-sheet-in bg-go-surface rounded-t-[30px] border-t border-go-line flex flex-col', tall ? 'h-[90%]' : 'max-h-[90%]')}>
        <div className="pt-2.5 pb-1 flex justify-center"><span className="w-10 h-1.5 rounded-full bg-go-line" /></div>
        {(title || sub) && (
          <div className="flex items-start gap-3 px-5 pt-2 pb-3">
            <div className="flex-1 min-w-0">
              {title && <h3 className="text-[19px] font-bold text-go-ink leading-tight">{title}</h3>}
              {sub && <p className="text-[13px] text-go-muted mt-1 leading-snug">{sub}</p>}
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 -mr-1 rounded-full bg-go-raised text-go-ink2 flex items-center justify-center flex-shrink-0">
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
        <div className="go-scroll flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-go-line">{footer}</div>}
      </div>
    </div>,
    sheetRoot,
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
    <div>
      <Label optional={optional}>{label}</Label>
      <button type="button" onClick={() => { setQ(''); setOpen(true); }}
        className={cx(fieldCls, 'h-[52px] px-4 flex items-center gap-2 text-left', invalid && 'border-go-warn ring-4 ring-go-warn/15')}>
        <span className="flex-1 min-w-0">
          {current ? (
            <span className="block truncate">{current.label}{current.sub && <span className="text-go-muted text-[12.5px]"> · {current.sub}</span>}</span>
          ) : <span className="text-go-faint">{placeholder}</span>}
        </span>
        <ChevronDown className="w-[18px] h-[18px] text-go-muted flex-shrink-0" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} tall={options.length > 7}>
        {searchable && (
          <div className="sticky top-0 bg-go-surface pb-3 z-10">
            <SearchBox value={q} onChange={setQ} placeholder={`Search ${label.toLowerCase()}`} />
          </div>
        )}
        <div className="space-y-1">
          {shown.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={cx('w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition', o.value === value ? 'bg-go-brand-soft' : 'hover:bg-go-raised')}>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium text-go-ink">{o.label}</span>
                {o.sub && <span className="block text-[12px] text-go-muted mt-0.5">{o.sub}</span>}
              </span>
              {o.value === value && <Check className="w-5 h-5 text-go-brand" strokeWidth={2.5} />}
            </button>
          ))}
          {!shown.length && <p className="text-center text-[13px] text-go-muted py-8">No matches</p>}
        </div>
      </Sheet>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2.5 h-12 px-4 rounded-2xl bg-go-surface border border-go-line focus-within:border-go-brand focus-within:ring-4 focus-within:ring-go-brand/15 transition">
      <Search className="w-[18px] h-[18px] text-go-muted flex-shrink-0" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-go-ink placeholder:text-go-faint" />
      {value && <button onClick={() => onChange('')} aria-label="Clear search" className="text-go-muted"><X className="w-4 h-4" /></button>}
    </label>
  );
}

// ─── Lab work bits ──────────────────────────────────────────────────────────

export const STAGE_TONE: Record<Stage, Tone> = {
  ready: 'warn', dispatched: 'brand', 'at-lab': 'brand', production: 'violet', shipped: 'ok', received: 'teal',
};
export function StagePill({ stage }: { stage: Stage }) {
  return <Pill tone={STAGE_TONE[stage]} dot>{STAGES[stageIndex(stage)].label}</Pill>;
}
export function CaseFlags({ c }: { c: LabCase }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StagePill stage={c.stage} />
      {c.questionOpen && <Pill tone="pink">Lab question</Pill>}
      {isOverdue(c) && <Pill tone="bad">Overdue</Pill>}
      {c.problem && <Pill tone="bad">Problem reported</Pill>}
    </div>
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
    <span className="inline-flex flex-col items-end">
      <Pill tone={READINESS_TONE[r.level]} dot>{r.label}</Pill>
      {detail && <span className="text-[11px] text-go-muted mt-0.5">{r.detail}</span>}
    </span>
  );
}

/** Six-segment rail: Ready → Dispatched → At lab → Production → Shipped → Received. */
export function ProgressRail({ stage, className }: { stage: Stage; className?: string }) {
  const idx = stageIndex(stage);
  return (
    <div className={cx('flex gap-1', className)} aria-label={`Step ${idx + 1} of ${STAGES.length}`}>
      {STAGES.map((s, i) => (
        <span key={s.id} className={cx('h-1.5 flex-1 rounded-full', i < idx ? 'go-grad' : i === idx ? 'go-grad go-pulse' : 'bg-go-line')} />
      ))}
    </div>
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts } = useGo();
  return (
    <div className="absolute top-3 sm:top-[54px] inset-x-3 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} role="status" className="go-toast-in pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl bg-go-ink text-go-bg shadow-2xl">
          {t.tone === 'ok' ? <CheckCircle2 className="w-5 h-5 text-go-ok flex-shrink-0 mt-px" />
            : t.tone === 'bad' ? <AlertTriangle className="w-5 h-5 text-go-bad flex-shrink-0 mt-px" />
            : <Info className="w-5 h-5 text-go-brand flex-shrink-0 mt-px" />}
          <span className="text-[13.5px] font-medium leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
