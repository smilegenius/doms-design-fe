import { Check, Minus, ScanLine, Stethoscope, Building2, Calendar, Layers } from 'lucide-react';
import { MatchReason, RescanMatch } from '../data/rescanDetection';

// ─── Potential-rescan match card ─────────────────────────────────────────────
// One suggested original case: the confidence score, the case's identifying
// details, and the "Matched because" breakdown. Shared by the creation-time
// recommendation and the same recommendation on Case Details, so both places
// show the user exactly the same evidence.

/** Confidence bands — a 100% match reads differently from a 71% one. */
function scoreTone(score: number) {
  if (score >= 100) return { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', label: 'Very high confidence' };
  if (score >= 85) return { bg: '#FFF8E1', border: '#FDE68A', text: '#B45309', label: 'High confidence' };
  return { bg: '#EEF4FF', border: '#BFDBFE', text: '#1565C0', label: 'Possible match' };
}

function ReasonRow({ reason }: { reason: MatchReason }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-px ${
          reason.matched ? 'bg-[#ECFDF5] text-[#047857]' : 'bg-[#F3F3F5] text-[#A0A0B0]'
        }`}
      >
        {reason.matched ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : <Minus className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={`text-[11px] font-medium ${reason.matched ? 'text-[#030213]' : 'text-[#A0A0B0]'}`}>
          {reason.label}
        </span>
        {reason.detail && (
          <span className="block text-[10px] text-[#A0A0B0] leading-relaxed">{reason.detail}</span>
        )}
      </span>
    </li>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-medium text-[#A0A0B0] uppercase tracking-wide">
        {icon}{label}
      </p>
      <p className="text-[11px] font-semibold text-[#030213] truncate mt-0.5" title={value}>{value}</p>
    </div>
  );
}

export default function RescanMatchCard({ match, selected, onSelect, onOpenCase }: {
  match: RescanMatch;
  /** Selection affordance — omitted when the card is purely informational. */
  selected?: boolean;
  onSelect?: () => void;
  onOpenCase?: () => void;
}) {
  const tone = scoreTone(match.score);
  const c = match.case;
  const teeth = (c.serviceItems ?? []).flatMap(si => si.fdi ?? []);
  const scanFiles = (c.serviceItems ?? []).reduce((n, si) => n + (si.scanFileCount ?? 0), 0);
  const selectable = !!onSelect;

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border bg-white transition-colors ${selectable ? 'cursor-pointer' : ''} ${
        selected ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/20' : 'border-[#E0E0E6] hover:border-[#C8D8FC]'
      }`}
    >
      {/* Score + case identity */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F0EFF6]">
        {selectable && (
          <span
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selected ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D4CEE1] bg-white'
            }`}
          >
            {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
          </span>
        )}
        <span
          className="px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0"
          style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
        >
          {match.score}% Match
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#030213] truncate">{c.id}</p>
          <p className="text-[10px] text-[#A0A0B0]">{tone.label}</p>
        </div>
        {onOpenCase && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenCase(); }}
            className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors flex-shrink-0"
          >
            View case
          </button>
        )}
      </div>

      {/* Suggested original's information */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 border-b border-[#F0EFF6]">
        <Detail icon={<Stethoscope className="w-2.5 h-2.5" />} label="Patient" value={c.patientName} />
        <Detail icon={<Stethoscope className="w-2.5 h-2.5" />} label="Dentist" value={c.dentist} />
        <Detail icon={<Building2 className="w-2.5 h-2.5" />} label="Clinic" value={c.practice} />
        <Detail icon={<Layers className="w-2.5 h-2.5" />} label="Service(s)" value={c.services.join(', ') || '—'} />
        <Detail
          icon={<Layers className="w-2.5 h-2.5" />}
          label="Tooth number(s)"
          value={teeth.length ? teeth.join(', ') : '—'}
        />
        <Detail icon={<Calendar className="w-2.5 h-2.5" />} label="Created" value={c.createdAt} />
        <Detail
          icon={<ScanLine className="w-2.5 h-2.5" />}
          label="Scan files"
          value={`${scanFiles} on this case`}
        />
      </div>

      {/* Matched because */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-2">Matched because</p>
        <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {match.reasons.map(r => <ReasonRow key={r.id} reason={r} />)}
        </ul>

        {match.supporting.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mt-3 mb-2">
              Supporting signals
              <span className="ml-1.5 font-medium normal-case tracking-normal text-[#C4C4CE]">
                shown for context — not part of the score
              </span>
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {match.supporting.map(r => <ReasonRow key={r.id} reason={r} />)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
