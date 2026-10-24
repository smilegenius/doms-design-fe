// ─── Experience C · the end of the page ──────────────────────────────────────
// Where the one continuous page arrives, right above the footer that sends it:
// each service with its own back-by date, the case's date, the delivery plan
// (fit appointment, sending a quicker service separately), then either what's
// still missing (each one a link straight to it) or that it's ready. Send
// itself stays in the footer, beside its attestation line.

import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { fmtDay } from '../../dates';
import { itemTitle, plural, stagesShort } from '../../rules';
import { gapLabel } from '../../ReviewStep';
import { StateIcon, FOCUS } from '../../ui';
import { DeliveryPlan } from './CaseDetails';
import { useCanvas } from './state';
import { backLine } from './summary';

/** The section's name, here and in the navigator. */
export function reviewName(view: string): string {
  return view === 'edit' ? 'Review and Send' : view === 'approve' ? 'Approve and Send' : 'Services and Delivery';
}

export default function ReviewCard() {
  const api = useCase();
  const c = useController();
  const ui = useCanvas();
  const { draft, dates, steps, gaps, readOnly, lab, user } = api;
  const n = user.notation;
  const todo = steps.filter(s => s.gap && s.navigable);
  const say = (s: string) => {
    const t = s.replace(/^Needs you:\s*/, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <section
      id="nc-sec-review"
      data-nc-section="review"
      data-nc-reveal
      aria-labelledby="nc-review"
      className="bg-white rounded-2xl border border-[#E0E0E6] overflow-hidden"
    >
      <div className="px-5 pt-4 pb-3 flex items-baseline gap-3">
        <h2 id="nc-review" tabIndex={-1} className="text-base font-semibold text-[#030213] focus:outline-none">{reviewName(c.view)}</h2>
        {!readOnly && (
          <p className={`ml-auto text-xs font-semibold ${gaps ? 'text-[#8A4B08]' : 'text-[#2E7D32]'}`}>
            {gaps ? `${plural(gaps, 'thing')} left` : 'Ready to send'}
          </p>
        )}
      </div>

      {draft.items.length > 0 && (
        <ul className="border-t border-[#F0EFF6] divide-y divide-[#F0EFF6]">
          {draft.items.map(i => {
            // Each service's own date: delivery lives with the service.
            const own = dates.perItem.find(p => p.id === i.id);
            return (
              <li key={i.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="flex-1 min-w-0 text-sm text-[#030213] truncate">{itemTitle(i, n)}</span>
                <span className="min-w-0 max-w-[55%] truncate text-xs text-[#3A3A4A] whitespace-nowrap">
                  {/* A denture has no date of its own: its stages each have one. */}
                  {i.product === 'denture'
                    ? (stagesShort(i) || 'Stage dates once a stage is ordered')
                    : own?.backBy ? `Back by ${fmtDay(own.backBy)}` : own?.ta != null ? plural(own.ta, 'working day') : '—'}
                </span>
              </li>
            );
          })}
          <li className="px-5 py-3 bg-[#FAFAFC] space-y-2.5">
            <p className="text-xs font-semibold text-[#4A4A5A]">{backLine(api)}{draft.split ? ' · sends as 2 cases' : ''}</p>
            <DeliveryPlan />
          </li>
        </ul>
      )}

      {!readOnly && (gaps > 0 ? (
        <div className="px-5 py-3.5 border-t border-[#F0EFF6]">
          <p className="text-xs text-[#4A4A5A]">Before it can go to {lab.name}:</p>
          <ul className="mt-2 space-y-1">
            {todo.map(g => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => ui.jump(g.id)}
                  className={`group inline-flex items-center gap-2 text-left text-sm text-[#1F1F2E] rounded ${FOCUS}`}
                >
                  <StateIcon state="gap" size="sm" />
                  <span className="group-hover:underline">{say(gapLabel(g, api))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-5 py-3.5 border-t border-[#F0EFF6] bg-[#F0FDF4] flex items-center gap-2 text-sm text-[#1F1F2E]">
          <StateIcon state="done" size="sm" />
          Everything’s in. Read the line above {c.sendLabel}, then send it from the bar below.
        </p>
      ))}
    </section>
  );
}
