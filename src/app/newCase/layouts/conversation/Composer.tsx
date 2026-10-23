// ─── Experience B · Conversation · composer ──────────────────────────────────
// The sticky pill under the column, like a chat composer: Back, Save as draft,
// a row of dots for progress and one primary action (Next, the gaps left, or
// Send). Only the pill itself takes clicks; the fade above it lets them through.

import { ArrowLeft, ArrowRight, FileText, Send } from 'lucide-react';
import { ReactNode } from 'react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { StepNode } from '../../rules';
import { GapButton, PrimaryButton, FOCUS } from '../../ui';

const PRIMARY = 'rounded-full px-5 py-2.5 shadow-[0_6px_16px_-8px_rgba(63,111,232,0.7)]';

export default function Composer() {
  const { steps, step, go, gaps } = useCase();
  const c = useController();
  const nav = steps.filter(s => s.navigable);
  const i = nav.findIndex(s => s.id === step);
  const cur = steps.find(s => s.id === step);
  const onReview = step === 'review';
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 mt-auto pt-3 pb-5 bg-gradient-to-t from-[#F8F9FC] from-60% to-[#F8F9FC]/0">
      <div role="group" aria-label="Case actions" className="pointer-events-auto flex items-center gap-1 rounded-full bg-white border border-[#E0E0E6] shadow-[0_12px_32px_-16px_rgba(23,23,64,0.35)] p-1.5 pl-2">
        <Ghost onClick={() => i > 0 && go(nav[i - 1].id)} disabled={i <= 0}>
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden />Back
        </Ghost>
        <Ghost onClick={() => c.saveAndClose(true)}>
          <FileText className="w-3.5 h-3.5" aria-hidden />Save as draft
        </Ghost>
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <Progress nav={nav} at={i} index={c.stepIndex} total={c.stepTotal} />
        </div>
        {onReview ? (
          gaps > 0 ? (
            <GapButton count={gaps} onClick={() => go(c.firstGapId)} className="rounded-full px-5 py-2.5" />
          ) : (
            <PrimaryButton onClick={() => c.send()} disabled={c.sending} className={PRIMARY}>
              <Send className="w-3.5 h-3.5" aria-hidden />{c.sending ? 'Sending…' : c.sendLabel}
            </PrimaryButton>
          )
        ) : (
          <PrimaryButton onClick={() => go(c.nextGapId)} disabled={!!cur?.gap} title={cur?.gap ? 'Answer this question first' : undefined} className={PRIMARY}>
            Next<ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function Ghost({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium text-[#3A3A4A] hover:bg-[#F0EFF6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${FOCUS}`}
    >
      {children}
    </button>
  );
}

/** One dot per question you can reach: the current one is a short bar, open gaps are amber. The count is read out, not shown. */
function Progress({ nav, at, index, total }: { nav: StepNode[]; at: number; index: number; total: number }) {
  const said = <span className="sr-only">Question {index} of {total}</span>;
  // A long case would make a row of dots unreadable: say it in words instead.
  if (nav.length > 16) {
    return <span className="text-xs font-semibold text-[#5A5A6A] tabular-nums whitespace-nowrap">{index} of {total}</span>;
  }
  return (
    <span className="flex items-center gap-1">
      {said}
      {nav.map((s, k) => (
        <span
          key={s.id}
          aria-hidden
          className={`h-1.5 rounded-full transition-all duration-200 ${
            k === at ? 'w-5 bg-gradient-to-r from-[#3F6FE8] to-[#6A5CE8]'
              : s.gap ? 'w-1.5 bg-[#B45309]'
              : k < at ? 'w-1.5 bg-[#C8D8FC]'
              : 'w-1.5 bg-[#E0E0E6]'
          }`}
        />
      ))}
    </span>
  );
}
