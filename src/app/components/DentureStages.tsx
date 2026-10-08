import { Check, CopyCheck, Info, History } from 'lucide-react';
import type { CaseStatus } from '../pages/CasesPage';
import { STATUS_MAP } from '../pages/CaseDetailPage';
import { DENTURE_STAGES, isPastISO, type StageRow } from '../data/dentureStages';

// ─── Denture stage UI ────────────────────────────────────────────────────────
// Shared by case creation (Quick Create + the detailed wizard), the case page's
// "New Stage Order" modal and the stage table on the case page. A denture has
// no service-level delivery date: each selected stage carries its own.

export const NO_SERVICE_DATE_COPY = 'No service-level delivery date for dentures. Set a delivery date for each selected stage.';

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

/** A stage that happened before the case reached DOMS. */
export function DoneEarlierTag({ size = 'sm' }: { size?: 'xs' | 'sm' }) {
  return (
    <span
      title="This stage is dated before the case was created in Smile Genius — it was done earlier."
      className={`inline-flex items-center gap-1 rounded-full font-semibold border bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6] whitespace-nowrap ${size === 'xs' ? 'px-2 py-px text-[10px]' : 'px-2.5 py-0.5 text-[11px]'}`}
    >
      <History className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      Done earlier
    </span>
  );
}

/** Status cell for a stage row — "Done earlier" replaces the status when the stage predates the case. */
export function StageStatusCell({ row, size = 'sm' }: { row: StageRow; size?: 'xs' | 'sm' }) {
  return row.doneEarlier ? <DoneEarlierTag size={size} /> : <StageStatusPill status={row.status} size={size} />;
}

// ── Stage + date picker ──────────────────────────────────────────────────────

export interface StageDatePickerProps {
  /** Stages ticked for this order. */
  stages: string[];
  /** ISO date per stage. */
  dates: Record<string, string>;
  onChange: (stages: string[], dates: Record<string, string>) => void;
  /** Stages already on the case — shown locked with their date + status. */
  existing?: StageRow[];
  catalog?: string[];
  /** Hide the "no service-level date" footnote (e.g. inside a modal that says it already). */
  hideNote?: boolean;
}

export function StageDatePicker({ stages, dates, onChange, existing = [], catalog = DENTURE_STAGES, hideNote }: StageDatePickerProps) {
  const ordered = new Map(existing.map(r => [r.stage, r]));
  const selected = catalog.filter(s => stages.includes(s));
  // "Copy date to selected" takes the first dated stage (catalogue order) and
  // writes it onto every other selected stage.
  const source = selected.find(s => dates[s]);
  const canCopy = !!source && selected.length > 1 && selected.some(s => dates[s] !== dates[source!]);

  const toggle = (stage: string) => {
    if (stages.includes(stage)) {
      const nextDates = { ...dates };
      delete nextDates[stage];
      onChange(stages.filter(s => s !== stage), nextDates);
    } else {
      onChange([...stages, stage], dates);
    }
  };
  const setDate = (stage: string, iso: string) => onChange(stages, { ...dates, [stage]: iso });
  const copyDate = () => {
    if (!source) return;
    onChange(stages, { ...dates, ...Object.fromEntries(selected.map(s => [s, dates[source]])) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#717182]">Tick a stage, then set its delivery date</p>
        <button
          type="button"
          onClick={copyDate}
          disabled={!canCopy}
          title={canCopy ? `Copy ${source}'s date to every selected stage` : 'Select two or more stages and date one of them'}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] border border-[#C8D8FC] bg-white hover:bg-[#EEF4FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
              <div key={stage} className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFBFC]">
                <span className="w-4 h-4 rounded border-2 border-[#D1D5DB] bg-[#F0EFF6] flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#A0A0B0]" strokeWidth={3} />
                </span>
                <span className="text-sm text-[#5A5568] flex-1 min-w-0 truncate">{stage}</span>
                <span className="text-[11px] text-[#A0A0B0] whitespace-nowrap" title="Already ordered on this case">{prior.date ?? "—"}</span>
                <StageStatusCell row={prior} size="xs" />
              </div>
            );
          }
          const active = stages.includes(stage);
          const past = active && isPastISO(dates[stage]);
          return (
            <div key={stage} className={`px-3 py-2 ${active ? 'bg-[#F8FAFF]' : ''}`}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggle(stage)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    active ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D1D5DB] bg-white'
                  }`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`text-sm truncate ${active ? 'font-semibold text-[#1565C0]' : 'text-[#5A5568]'}`}>{stage}</span>
                </button>
                <input
                  type="date"
                  value={dates[stage] ?? ''}
                  disabled={!active}
                  aria-label={`${stage} delivery date`}
                  onChange={(e) => setDate(stage, e.target.value)}
                  className={`w-[150px] px-2.5 py-1.5 text-xs border rounded-lg bg-white outline-none focus:border-[#4D8EF7] disabled:bg-[#F8F9FC] disabled:text-[#C0C0CC] ${
                    active && !dates[stage] ? 'border-[#FCD34D]' : 'border-[#E0E0E6]'
                  } text-[#030213]`}
                />
              </div>
              {past && (
                <p className="mt-1.5 ml-7 inline-flex items-center gap-1 text-[11px] font-medium text-[#92400E]">
                  <History className="w-3 h-3" />
                  Past date — this stage will show as done earlier
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!hideNote && (
        <p className="flex items-start gap-1.5 text-[11px] text-[#1565C0] bg-[#EEF4FF] border border-[#C8D8FC] rounded-lg px-2.5 py-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          {NO_SERVICE_DATE_COPY}
        </p>
      )}
    </div>
  );
}

/** Compact read-only list of selected stages + dates — used in creation summaries. */
export function StageDateList({ stages, dates, format = (d: string) => d }: {
  stages: string[];
  dates: Record<string, string | null | undefined>;
  format?: (d: string) => string;
}) {
  const ordered = DENTURE_STAGES.filter(s => stages.includes(s));
  return (
    <ul className="space-y-0.5">
      {ordered.map(s => (
        <li key={s} className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-[#5A5568] truncate">{s}</span>
          <span className={`inline-flex items-center gap-1 whitespace-nowrap ${dates[s] ? 'text-[#030213] font-medium' : 'text-[#D97706]'}`}>
            {dates[s] && isPastISO(dates[s]) && <History className="w-3 h-3 text-[#92400E]" />}
            {dates[s] ? format(dates[s]!) : 'No date'}
          </span>
        </li>
      ))}
    </ul>
  );
}

