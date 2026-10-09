import { Check, CopyCheck, History } from 'lucide-react';
import type { CaseStatus } from '../pages/CasesPage';
import { STATUS_MAP } from '../pages/CaseDetailPage';
import { ARCH_LABELS, DENTURE_STAGES, TODAY_ISO, archOf, archTeeth, isPastISO, type Arch, type StageRow } from '../data/dentureStages';

// ─── Denture stage UI ────────────────────────────────────────────────────────
// Shared by case creation (Quick Create + the detailed wizard), the case page's
// "New Stage Order" modal and the stage table on the case page. A denture has
// no service-level delivery date: each selected stage carries its own, and a
// stage done before the case reached Smile Genius is marked "Done elsewhere".

export function StageStatusPill({ status, size = 'sm' }: { status: CaseStatus; size?: 'xs' | 'sm' }) {
  const s = STATUS_MAP[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border whitespace-nowrap ${size === 'xs' ? 'px-2 py-px text-[10px]' : 'px-2.5 py-0.5 text-[11px]'}`}
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

/** A stage that was done before the case reached Smile Genius — done, but not on this portal. */
export function DoneEarlierTag({ size = 'sm', date }: { size?: 'xs' | 'sm'; date?: string | null }) {
  return (
    <span
      title="Done before this case reached Smile Genius — not tracked on this portal."
      className={`inline-flex items-center gap-1 rounded-full font-semibold border bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6] whitespace-nowrap ${size === 'xs' ? 'px-2 py-px text-[10px]' : 'px-2.5 py-0.5 text-[11px]'}`}
    >
      <History className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      Done elsewhere{date ? <span className="font-normal">· {date}</span> : null}
    </span>
  );
}

/** Status cell for a stage row — "Done elsewhere" replaces the status when the stage predates the case. */
export function StageStatusCell({ row, size = 'sm', showDate }: { row: StageRow; size?: 'xs' | 'sm'; showDate?: boolean }) {
  return row.doneEarlier
    ? <DoneEarlierTag size={size} date={showDate ? row.date : undefined} />
    : <StageStatusPill status={row.status} size={size} />;
}

// ── Stage + date picker ──────────────────────────────────────────────────────

export interface StageDatePickerProps {
  /** Stages ticked for this order. */
  stages: string[];
  /** ISO date per stage — the delivery date, or the done-on date for a stage done elsewhere. */
  dates: Record<string, string>;
  /** Ticked stages that were already done before the case reached Smile Genius. */
  doneElsewhere?: string[];
  onChange: (stages: string[], dates: Record<string, string>, doneElsewhere: string[]) => void;
  /** Stages already on the case — shown locked with their date + status. */
  existing?: StageRow[];
  catalog?: string[];
  /** Offer "Done elsewhere" on each stage (case creation). Off for a new order on an existing case. */
  allowDoneElsewhere?: boolean;
  /** Tighter rows without the helper line — for the inline service card. */
  compact?: boolean;
}

export function StageDatePicker({
  stages, dates, doneElsewhere = [], onChange, existing = [], catalog = DENTURE_STAGES, allowDoneElsewhere = true, compact,
}: StageDatePickerProps) {
  const ordered = new Map(existing.map(r => [r.stage, r]));
  const selected = catalog.filter(s => stages.includes(s));
  const isDone = (s: string) => allowDoneElsewhere && doneElsewhere.includes(s);
  // "Copy date to selected" takes the first dated upcoming stage (catalogue
  // order) and writes it onto every other upcoming stage. Stages done
  // elsewhere keep their own done-on date.
  const upcoming = selected.filter(s => !isDone(s));
  const source = upcoming.find(s => dates[s]);
  const canCopy = !!source && upcoming.length > 1 && upcoming.some(s => dates[s] !== dates[source!]);

  const emit = (nextStages: string[], nextDates: Record<string, string>, nextDone: string[]) =>
    onChange(nextStages, nextDates, nextDone.filter(s => nextStages.includes(s)));

  const toggle = (stage: string) => {
    if (stages.includes(stage)) {
      const nextDates = { ...dates };
      delete nextDates[stage];
      emit(stages.filter(s => s !== stage), nextDates, doneElsewhere);
    } else {
      emit([...stages, stage], dates, doneElsewhere);
    }
  };
  // A past date can only mean the stage already happened — flip it to done.
  const setDate = (stage: string, iso: string) => {
    const nextDone = allowDoneElsewhere && isPastISO(iso) && !doneElsewhere.includes(stage) ? [...doneElsewhere, stage] : doneElsewhere;
    emit(stages, { ...dates, [stage]: iso }, nextDone);
  };
  const setDone = (stage: string, done: boolean) => {
    const nextDates = { ...dates };
    // Keep a date only if it still makes sense for the new meaning.
    if (dates[stage] && (done ? !isPastISO(dates[stage]) && dates[stage] !== TODAY_ISO : isPastISO(dates[stage]))) delete nextDates[stage];
    emit(stages, nextDates, done ? [...doneElsewhere, stage] : doneElsewhere.filter(s => s !== stage));
  };
  const copyDate = () => {
    if (!source) return;
    emit(stages, { ...dates, ...Object.fromEntries(upcoming.map(s => [s, dates[source]])) }, doneElsewhere);
  };

  const rowPad = compact ? 'px-2.5 py-1.5' : 'px-3 py-2';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {!compact && <p className="text-[11px] text-[#717182]">Tick a stage, then set its delivery date</p>}
        <button
          type="button"
          onClick={copyDate}
          disabled={!canCopy}
          title={canCopy ? `Copy ${source}'s date to every selected stage` : 'Select two or more stages and date one of them'}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] border border-[#C8D8FC] bg-white hover:bg-[#EEF4FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <CopyCheck className="w-3 h-3" />
          Copy date to selected
        </button>
      </div>

      <div className="border border-[#E0E0E6] rounded-xl divide-y divide-[#F0EFF6] bg-white overflow-hidden">
        {catalog.map(stage => {
          const prior = ordered.get(stage);
          if (prior) {
            return (
              <div key={stage} className={`flex items-center gap-3 ${rowPad} bg-[#FAFBFC]`}>
                <span className="w-4 h-4 rounded border-2 border-[#D1D5DB] bg-[#F0EFF6] flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#A0A0B0]" strokeWidth={3} />
                </span>
                <span className="text-sm text-[#5A5568] flex-1 min-w-0 truncate">{stage}</span>
                <span className="text-[11px] text-[#A0A0B0] whitespace-nowrap" title="Already ordered on this case">{prior.date ?? '—'}</span>
                <StageStatusCell row={prior} size="xs" />
              </div>
            );
          }
          const active = stages.includes(stage);
          const done = active && isDone(stage);
          return (
            <div key={stage} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${rowPad} ${done ? 'bg-[#FAFAFB]' : active ? 'bg-[#F8FAFF]' : ''}`}>
              <button
                type="button"
                onClick={() => toggle(stage)}
                className="flex items-center gap-3 flex-1 min-w-[140px] text-left"
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  active ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D1D5DB] bg-white'
                }`}>
                  {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </span>
                <span className={`text-sm truncate ${done ? 'font-semibold text-[#5A5568]' : active ? 'font-semibold text-[#1565C0]' : 'text-[#5A5568]'}`}>{stage}</span>
              </button>
              {active && allowDoneElsewhere && (
                <button
                  type="button"
                  onClick={() => setDone(stage, !done)}
                  aria-pressed={done}
                  title="Done before this case reached Smile Genius — e.g. at the patient's previous lab"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-colors ${
                    done ? 'bg-[#F3F3F5] text-[#5A5568] border-[#C9C9D3]' : 'bg-white text-[#A0A0B0] border-[#E0E0E6] hover:text-[#5A5568]'
                  }`}
                >
                  {done ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <History className="w-2.5 h-2.5" />}
                  Done elsewhere
                </button>
              )}
              <label className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[10px] font-semibold uppercase tracking-wide min-w-[54px] text-right whitespace-nowrap ${active ? 'text-[#717182]' : 'text-[#C0C0CC]'}`}>
                  {done ? 'Done on' : 'Delivery'}
                </span>
                <input
                  type="date"
                  value={dates[stage] ?? ''}
                  disabled={!active}
                  min={active && !done && allowDoneElsewhere ? TODAY_ISO : undefined}
                  max={done ? TODAY_ISO : undefined}
                  aria-label={`${stage} ${done ? 'done-on' : 'delivery'} date`}
                  title={done ? 'Optional — when it was done' : undefined}
                  onChange={(e) => setDate(stage, e.target.value)}
                  className={`w-[140px] px-2.5 py-1.5 text-xs border rounded-lg bg-white outline-none focus:border-[#4D8EF7] disabled:bg-[#F8F9FC] disabled:text-[#C0C0CC] ${
                    active && !done && !dates[stage] ? 'border-[#FCD34D]' : 'border-[#E0E0E6]'
                  } ${done ? 'text-[#5A5568]' : 'text-[#030213]'}`}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A stage is ready when it has a delivery date, or is done elsewhere (its done-on date is optional). */
export function stagesComplete(stages: string[], dates: Record<string, string | undefined> | undefined, doneElsewhere: string[] = []): boolean {
  return stages.length > 0 && stages.every(s => doneElsewhere.includes(s) || !!dates?.[s]);
}

/** Compact read-only list of selected stages + dates — used in creation summaries. */
export function StageDateList({ stages, dates, doneElsewhere = [], format = (d: string) => d }: {
  stages: string[];
  dates: Record<string, string | null | undefined>;
  doneElsewhere?: string[];
  format?: (d: string) => string;
}) {
  const ordered = DENTURE_STAGES.filter(s => stages.includes(s));
  return (
    <ul className="space-y-0.5">
      {ordered.map(s => (
        <li key={s} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-[#5A5568] truncate">{s}</span>
          {doneElsewhere.includes(s) ? (
            <DoneEarlierTag size="xs" date={dates[s] ? format(dates[s]!) : null} />
          ) : (
            <span className={`whitespace-nowrap ${dates[s] ? 'text-[#030213] font-medium' : 'text-[#D97706]'}`}>
              {dates[s] ? format(dates[s]!) : 'No date'}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Arch picker ──────────────────────────────────────────────────────────────
// A denture is made for a whole jaw, so it's picked as an arch rather than as
// tooth numbers. Writes every tooth of the chosen jaw(s) into `teeth`.

const ARCH_OPTIONS: Arch[] = ['upper', 'lower', 'both'];

export function ArchPicker({ teeth, onChange }: { teeth: string[]; onChange: (teeth: string[]) => void }) {
  const current = archOf(teeth);
  return (
    <div role="radiogroup" aria-label="Arch" className="grid grid-cols-3 gap-2">
      {ARCH_OPTIONS.map(arch => {
        const on = current === arch;
        return (
          <button
            key={arch}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(archTeeth(arch))}
            className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-xs font-semibold transition-colors ${
              on ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#C8D8FC]'
            }`}
          >
            <ArchGlyph arch={arch} on={on} />
            {ARCH_LABELS[arch]}
          </button>
        );
      })}
    </div>
  );
}

function ArchGlyph({ arch, on }: { arch: Arch; on: boolean }) {
  const active = on ? '#4D8EF7' : '#9CA3AF';
  const idle = '#E0E0E6';
  return (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none" aria-hidden="true">
      <path d="M6 12 C6 3, 34 3, 34 12" stroke={arch !== 'lower' ? active : idle} strokeWidth="3" strokeLinecap="round" />
      <path d="M6 16 C6 25, 34 25, 34 16" stroke={arch !== 'upper' ? active : idle} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
