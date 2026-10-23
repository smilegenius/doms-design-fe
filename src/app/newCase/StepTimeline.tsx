// ─── New Case Flow · step timeline ───────────────────────────────────────────
// One vertical line through every step's state icon, Patient to Review and
// Send. The stretch between two steps fills once both are settled (done, or
// the "+" of Add Another Service), so a step that needs you is a gap in the
// fill, as on One page's spine. The current step is the highlighted row with a
// ring round its node. A service's sub-steps branch off the line onto an
// indented one of their own. The nodes are hidden from screen readers, so each
// row says its state in words, as One page's navigator does. Presentational
// only: Guided's Timeline and the Start from Scratch page draw with it.
//
// Geometry: a row's node centre sits 20 px in and 20 px down (a sub-step's
// 40 px in, 16 px down), and rows touch, so each row draws the stretch from
// its own node to the next one's without measuring anything.

import { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { StateIcon, FOCUS } from './ui';

export type NodeState = 'done' | 'gap' | 'todo' | 'action';

const settled = (s: NodeState) => s === 'done' || s === 'action';
/** What the hidden node says, read after the row's text. The current step isn't "not reached yet". */
const STATE_WORD: Record<NodeState, string> = { done: 'done', gap: 'needs you', todo: 'not reached yet', action: '' };
function StateWord({ state, current }: { state: NodeState; current?: boolean }) {
  const word = current && state === 'todo' ? '' : STATE_WORD[state];
  return word ? <span className="sr-only">, {word}</span> : null;
}
/** Each entry's stretch to the next: lit once both ends are settled. The last entry has none. */
export function lineBelow(states: NodeState[]): (boolean | undefined)[] {
  return states.map((s, i) => (i < states.length - 1 ? settled(s) && settled(states[i + 1]) : undefined));
}

/** A stretch of the line: grey, filling green top-down when lit. */
function Line({ lit, className }: { lit: boolean; className: string }) {
  return (
    <span aria-hidden className={`absolute z-[1] w-0.5 bg-[#E0E0E6] overflow-hidden ${className}`}>
      <span className={`absolute inset-0 origin-top bg-[#2E7D32] transition-transform duration-300 ease-out motion-reduce:transition-none ${lit ? 'scale-y-100' : 'scale-y-0'}`} />
    </span>
  );
}

/** Done ✓, needs you ▲, not reached ○ or an action (+), above the line; ringed when current. */
export function TimelineNode({ state, size = 'md', current }: { state: NodeState; size?: 'sm' | 'md'; current?: boolean }) {
  const ring = current
    ? `ring-2 ring-[#3F6FE8] ring-offset-[#EEF4FF] ${size === 'sm' ? 'ring-offset-1' : 'ring-offset-2'}`
    : '';
  return (
    <span
      aria-hidden
      className={`relative z-[2] flex-shrink-0 flex items-center justify-center rounded-full transition-shadow duration-200 motion-reduce:transition-none ${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} ${state === 'gap' ? 'bg-white' : ''} ${ring}`}
    >
      {state === 'action' ? (
        <span className="w-4 h-4 rounded-full border border-dashed border-[#3F6FE8] bg-white text-[#2F62D6] flex items-center justify-center">
          <Plus className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      ) : (
        <StateIcon state={state} size={size} />
      )}
    </span>
  );
}

/** The list itself; rows go straight in, in order. */
export function StepTimeline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label}>
      <ol>{children}</ol>
    </nav>
  );
}

export function TimelineRow({ state, label, value, current, within, disabled, onClick, below, tone = 'step', aside, children }: {
  state: NodeState;
  label: ReactNode;
  value?: ReactNode;
  /** The current step: aria-current="step", highlighted, its node ringed. */
  current?: boolean;
  /** Holds the current step (a service whose sub-step is open): a lighter tint. */
  within?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** The stretch from this node to the next one: lit, grey, or none (the last entry). */
  below?: boolean;
  /** A step, a service (room on the right for its ×) or an action (Add Another Service). */
  tone?: 'step' | 'service' | 'action';
  /** Beside the button, never inside it (a service's ×); revealed on hover or focus. After the button, so Tab reaches the row first. */
  aside?: ReactNode;
  /** A branch of sub-steps under the row. */
  children?: ReactNode;
}) {
  const bg = current ? 'bg-[#EEF4FF]' : within ? 'bg-[#F5F8FF]' : tone === 'action' ? 'hover:bg-[#F5F8FF]' : 'hover:bg-[#F8F9FC]';
  const text = tone === 'service'
    ? 'font-semibold text-[#030213] truncate'
    : tone === 'action'
      ? 'font-semibold text-[#2F62D6]'
      : current ? 'font-semibold text-[#030213]' : disabled ? 'font-medium text-[#6B6B7B]' : 'font-medium text-[#1F1F2E]';
  return (
    <li className={`relative ${aside ? 'group' : ''}`}>
      {below !== undefined && <Line lit={below} className="left-[19px] top-5 -bottom-5" />}
      <button
        type="button"
        disabled={disabled}
        aria-current={current ? 'step' : undefined}
        onClick={onClick}
        className={`w-full flex items-start gap-2.5 pl-2.5 ${tone === 'service' ? 'pr-8' : 'pr-2.5'} py-2 rounded-lg text-left transition-colors motion-reduce:transition-none ${FOCUS} ${bg} disabled:cursor-default disabled:hover:bg-transparent`}
      >
        <span className="mt-0.5 flex"><TimelineNode state={state} current={current} /></span>
        <span className="min-w-0">
          <span className={`block text-sm ${text}`}>{label}</span>
          {value && <span className={`block text-[11px] truncate ${disabled ? 'text-[#6B6B7B]' : 'text-[#4A4A5A]'}`}>{value}</span>}
          <StateWord state={state} current={current} />
        </span>
      </button>
      {aside}
      {children}
    </li>
  );
}

/** A service's sub-steps on their own indented line, curving off the main one. `lit`: the service and its first sub-step are both settled. */
export function TimelineBranch({ lit, children }: { lit: boolean; children: ReactNode }) {
  return (
    <div className="relative ml-6 my-1">
      {/* The elbow: from the main line (under it) round into the first sub-step's node. */}
      <span
        aria-hidden
        className={`absolute -left-[5px] top-[5px] h-3 w-[13px] rounded-bl-[12px] border-l-2 border-b-2 transition-colors duration-300 ease-out motion-reduce:transition-none ${lit ? 'border-[#2E7D32]' : 'border-[#E0E0E6]'}`}
      />
      <ol>{children}</ol>
    </div>
  );
}

export function TimelineSubRow({ state, label, value, current, disabled, onClick, below }: {
  state: Exclude<NodeState, 'action'>;
  label: ReactNode;
  value?: ReactNode;
  current?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  below?: boolean;
}) {
  return (
    <li className="relative">
      {below !== undefined && <Line lit={below} className="left-[15px] top-4 -bottom-4" />}
      <button
        type="button"
        disabled={disabled}
        aria-current={current ? 'step' : undefined}
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-left transition-colors motion-reduce:transition-none ${FOCUS} ${current ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'} disabled:cursor-default disabled:hover:bg-transparent`}
      >
        <span className="flex"><TimelineNode state={state} size="sm" current={current} /></span>
        {/* One line, "Material · Layered zirconia", so an open service doesn't push the timeline past the footer. */}
        <span className="min-w-0 truncate text-xs leading-4" title={typeof value === 'string' ? value : undefined}>
          <span className={current ? 'font-semibold text-[#030213]' : state === 'todo' ? 'text-[#6B6B7B]' : 'text-[#1F1F2E]'}>{label}</span>
          {value && <span className="text-[#5A5A6A]"> · {value}</span>}
          <StateWord state={state} current={current} />
        </span>
      </button>
    </li>
  );
}
