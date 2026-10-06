// ─── Simulated on-screen keyboard (desktop phone frame only) ────────────────
// On a real phone the OS keyboard does this for us. Inside the desktop device
// frame there is none, so focusing a text field slides this one up, the app
// viewport shrinks by its height (via --go-kb) so forms and sticky actions
// rise above it, and the focused field is scrolled into view. Blur → it
// slides back down and the layout returns. Keys really type into the field.
import { useEffect, useRef, useState } from 'react';
import { ArrowBigUp, ChevronDown, CornerDownLeft, Delete } from './icons';
import { cx } from './ui';

export const KB_HEIGHT = 292;
const FRAME_MIN_WIDTH = 640; // below this the app runs full-screen on a real phone
const TEXT_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', '']);

type Field = HTMLInputElement | HTMLTextAreaElement;
const isTextField = (el: Element | null): el is Field =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)));

/** Tracks the focused text field inside `root`; null when none (or not in frame mode). */
export function useKeyboardTarget(root: HTMLElement | null, routeKey?: string) {
  const [target, setTarget] = useState<Field | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setTarget(cur => (cur && (!cur.isConnected || document.activeElement !== cur) ? null : cur)), 0);
    return () => clearTimeout(t);
  }, [routeKey]);
  useEffect(() => {
    if (!root) return;
    const onIn = (e: FocusEvent) => {
      if (window.innerWidth < FRAME_MIN_WIDTH) return;
      if (isTextField(e.target as Element)) setTarget(e.target as Field);
    };
    // Defer so moving focus between two fields doesn't bounce the keyboard.
    const onOut = () => setTimeout(() => {
      const a = document.activeElement;
      if (!(a && root.contains(a) && isTextField(a))) setTarget(null);
    }, 0);
    root.addEventListener('focusin', onIn);
    root.addEventListener('focusout', onOut);
    return () => { root.removeEventListener('focusin', onIn); root.removeEventListener('focusout', onOut); };
  }, [root]);
  return target;
}

/** Scroll the field to the middle of its own scroller once the layout has shrunk. */
export function revealField(el: Field) {
  const sc = el.closest('.go-scroll') as HTMLElement | null;
  if (!sc) return;
  const sr = sc.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = sr.height / sc.clientHeight || 1; // frame may be CSS-scaled
  const top = sc.scrollTop + (r.top - sr.top) / k - (sc.clientHeight - r.height / k) / 2;
  sc.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

/** Write into a React-controlled field the way a real keystroke would. */
function typeInto(el: Field, fn: (value: string, start: number, end: number) => { value: string; caret: number }) {
  let start = el.value.length, end = el.value.length;
  try { if (el.selectionStart !== null) { start = el.selectionStart; end = el.selectionEnd ?? start; } } catch { /* email inputs */ }
  const next = fn(el.value, start, end);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, next.value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  try { el.setSelectionRange(next.caret, next.caret); } catch { /* not supported on some types */ }
}

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const SYMBOLS = ['1234567890', '-/:;()£&@"', '.,?!\''];

export function SimKeyboard({ target, theme }: { target: Field | null; theme: 'light' | 'dark' }) {
  const [shift, setShift] = useState(false);
  const [syms, setSyms] = useState(false);
  const last = useRef<Field | null>(null);
  if (target) last.current = target;
  const el = target ?? last.current; // keep rendering keys while sliding out
  const open = !!target;

  useEffect(() => {
    if (!target) return;
    setSyms(target instanceof HTMLInputElement && (target.type === 'number' || target.type === 'tel'));
    // Auto-capitalise free text, never emails/passwords
    setShift(target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text' && !target.value));
    const t = setTimeout(() => revealField(target), 320);
    return () => clearTimeout(t);
  }, [target]);

  const type = (ch: string) => {
    if (!el) return;
    typeInto(el, (v, s, e) => ({ value: v.slice(0, s) + ch + v.slice(e), caret: s + ch.length }));
    if (shift) setShift(false);
  };
  const back = () => el && typeInto(el, (v, s, e) => (s === e
    ? { value: v.slice(0, Math.max(0, s - 1)) + v.slice(e), caret: Math.max(0, s - 1) }
    : { value: v.slice(0, s) + v.slice(e), caret: s }));
  const enter = () => {
    if (!el) return;
    if (el instanceof HTMLTextAreaElement) { type('\n'); return; }
    if (el.form) el.form.requestSubmit(); else el.blur();
  };
  const isEmail = el instanceof HTMLInputElement && el.type === 'email';
  const goLabel = el instanceof HTMLTextAreaElement ? null : el?.form ? 'go' : 'done';

  const dark = theme === 'dark';
  const keyCls = cx('h-[42px] rounded-[6px] text-[20px] flex items-center justify-center select-none active:opacity-60 transition-opacity',
    dark ? 'bg-[#5C5C61] text-white shadow-[0_1px_0_#000]' : 'bg-white text-black shadow-[0_1px_0_#898A8D]');
  const modCls = cx(keyCls, '!text-[15px]', dark ? '!bg-[#3A3A3D]' : '!bg-[#ABB0BA]');
  // mousedown preventDefault keeps focus (and the caret) in the field
  const hold = (fn: () => void) => ({ onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); fn(); } });
  const rows = syms ? SYMBOLS : LETTERS;

  return (
    <div className={cx('absolute inset-x-0 bottom-0 z-[66] overflow-hidden', !open && 'pointer-events-none')} style={{ height: KB_HEIGHT }}>
    <div aria-hidden={!open}
      className={cx('absolute inset-x-0 bottom-0 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
        open ? 'translate-y-0' : 'translate-y-full pointer-events-none')}
      style={{ height: KB_HEIGHT }}>
      <div className={cx('h-full flex flex-col', dark ? 'bg-[#2B2B2E]/95' : 'bg-[#D1D3D9]/95', 'backdrop-blur-xl')}>
        {/* Accessory bar */}
        <div className={cx('h-10 flex items-center justify-between px-3 border-b', dark ? 'border-white/10' : 'border-black/10')}>
          <div className="flex gap-4 text-[14px]" {...hold(() => {})}>
            {isEmail
              ? ['@example.test', '@nhs.net', '@gmail.com'].map(s => <button key={s} {...hold(() => type(s))} className={dark ? 'text-white/80' : 'text-black/70'}>{s}</button>)
              : <span className={dark ? 'text-white/40' : 'text-black/40'}>Smile Genius Go</span>}
          </div>
          <button {...hold(() => el?.blur())} aria-label="Hide keyboard" className={cx('flex items-center gap-1 text-[15px] font-semibold', dark ? 'text-[#7FB0FF]' : 'text-[#1565C0]')}>
            Done <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        {/* Keys */}
        <div className="flex-1 px-[3px] pt-2 space-y-[11px]">
          {rows.map((row, i) => (
            <div key={row} className={cx('flex gap-[6px]', !syms && i === 1 && 'px-[18px]')}>
              {i === 2 && (
                <button {...hold(() => (syms ? setSyms(false) : setShift(s => !s)))} className={cx(modCls, 'w-[42px] flex-shrink-0 mr-[8px]', shift && !syms && (dark ? '!bg-white !text-black' : '!bg-white'))}>
                  {syms ? 'ABC' : <ArrowBigUp className="w-5 h-5" fill={shift ? 'currentColor' : 'none'} />}
                </button>
              )}
              {row.split('').map(k => {
                const ch = shift && !syms ? k.toUpperCase() : k;
                return <button key={k} {...hold(() => type(ch))} className={cx(keyCls, 'flex-1 min-w-0')}>{ch}</button>;
              })}
              {i === 2 && (
                <button {...hold(back)} aria-label="Delete" className={cx(modCls, 'w-[42px] flex-shrink-0 ml-[8px]')}><Delete className="w-5 h-5" /></button>
              )}
            </div>
          ))}
          <div className="flex gap-[6px]">
            <button {...hold(() => setSyms(s => !s))} className={cx(modCls, 'w-[88px]')}>{syms ? 'ABC' : '123'}</button>
            {isEmail && <button {...hold(() => type('@'))} className={cx(keyCls, 'w-[42px]')}>@</button>}
            <button {...hold(() => type(' '))} className={cx(keyCls, 'flex-1 !text-[15px]')}>space</button>
            {isEmail && <button {...hold(() => type('.'))} className={cx(keyCls, 'w-[42px]')}>.</button>}
            <button {...hold(enter)} className={cx(modCls, 'w-[88px]', goLabel === 'go' && '!bg-[#4D8EF7] !text-white')}>
              {goLabel ?? <CornerDownLeft className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
