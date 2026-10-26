// ─── Experience B · Conversation · the thread ────────────────────────────────
// What has been asked and answered so far, as compact question → answer pairs.
// A service's answers sit under a small header with its mini chart beside it
// (never inside a button: the chart carries hidden controls). Tapping a pair
// goes back to that question; the answers after it come back with Next.
// Removing a service is on Review, where it is labelled and deliberate.

import { Fragment, useState } from 'react';
import { Check, ChevronDown, Pencil } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { PRODUCTS, bridgeParts, itemTitle, plural, priceOf } from '../../rules';
import { MiniChart } from '../../TeethChart';
import { PRODUCT_ICON } from '../../ServiceSteps';
import { FOCUS } from '../../ui';
import { CHART_SLOTS, DefaultsLine, Entry, ItemGroup, Pair, answerCount, buildThread } from './model';
import { AnswerPill } from './bits';

/** The answers before the current question. */
export default function Thread() {
  const api = useCase();
  return <ThreadList entries={buildThread(api)} />;
}

/** Review and read-only views: the case is already shown in full below, so the thread starts folded. */
export function FoldedThread() {
  const api = useCase();
  const [open, setOpen] = useState(false);
  const entries = buildThread(api);
  const n = answerCount(entries);
  if (!n) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="nc-chat-answers"
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-[#4A4A5A] hover:bg-white hover:text-[#030213] transition-colors ${FOCUS}`}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        {open ? 'Hide Answers' : `Show Answers (${n})`}
      </button>
      <div id="nc-chat-answers" hidden={!open} className="mt-2">
        {open && <ThreadList entries={entries} />}
      </div>
    </div>
  );
}

function ThreadList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return null;
  return (
    <ol aria-label="Answered so far" className="space-y-0.5">
      {entries.map(e => (
        <li key={e.kind === 'pair' ? e.pair.stepId : e.group.item.id}>
          {e.kind === 'pair' ? <PairRow pair={e.pair} /> : <ItemBlock group={e.group} />}
        </li>
      ))}
    </ol>
  );
}

const ROW = 'w-full flex items-center gap-3 pl-2 pr-1.5 py-1.5 rounded-2xl text-left';

/** A quiet marker in the question column, the width of the defaults tick so rows line up. */
const Dot = () => (
  <span className="w-5 flex justify-center flex-shrink-0" aria-hidden>
    <span className="w-1.5 h-1.5 rounded-full bg-[#B8B8C6]" />
  </span>
);

function PairRow({ pair }: { pair: Pair }) {
  const { go, readOnly } = useCase();
  const body = (
    <>
      <Dot />
      <span className={`flex-1 min-w-0 truncate text-sm ${pair.gap ? 'text-[#8A4B08] font-medium' : 'text-[#5A5A6A]'}`}>{pair.question}</span>
      <AnswerPill pair={pair} />
    </>
  );
  if (readOnly) return <div className={ROW}>{body}</div>;
  return (
    <button type="button" onClick={() => go(pair.stepId)} className={`group ${ROW} hover:bg-white transition-colors ${FOCUS}`}>
      {body}
      <Pencil className="w-3 h-3 flex-shrink-0 text-[#6B6B7B] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden />
      <span className="sr-only">. Change this answer</span>
    </button>
  );
}

/** "Used your usuals: Monolithic zirconia · Preferences: …" — each value opens its own question. */
function DefaultsRow({ line }: { line: DefaultsLine }) {
  const { go, readOnly } = useCase();
  const last = line.parts.length - 1;
  return (
    <div className={ROW}>
      <span className="w-5 h-5 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center flex-shrink-0" aria-hidden>
        <Check className="w-3 h-3" strokeWidth={3} />
      </span>
      <p className="flex-1 min-w-0 flex items-center gap-1 text-[13px] text-[#4A4A5A]">
        <span className="font-semibold text-[#2E7D32] flex-shrink-0 whitespace-nowrap">{line.lead}:</span>
        {line.parts.map((p, k) => {
          const fit = k === last ? 'min-w-0 truncate' : 'flex-shrink-0 whitespace-nowrap';
          return (
            <Fragment key={p.stepId}>
              {k > 0 && <span className="flex-shrink-0 text-[#6B6B7B]" aria-hidden>·</span>}
              {readOnly ? (
                <span className={fit} title={p.text}>{p.text}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => go(p.stepId)}
                  title={p.text}
                  className={`${fit} px-1 -mx-0.5 rounded-md text-left hover:bg-white hover:text-[#030213] hover:underline transition-colors ${FOCUS}`}
                >
                  {p.text}<span className="sr-only">. Change</span>
                </button>
              )}
            </Fragment>
          );
        })}
      </p>
    </div>
  );
}

function ItemBlock({ group }: { group: ItemGroup }) {
  const { ctx, draft, user } = useCase();
  const { item } = group;
  const title = itemTitle(item, user.notation);
  // The lead time once the service is chosen far enough to have one ("7 days"); never its price.
  const p = priceOf(item, ctx, draft.fastTrack);
  const lead = p.kind !== 'none' && p.ta != null ? plural(p.ta, 'day') : '';
  const arch = PRODUCTS[item.product].archItem ? item.arch : undefined;
  const drawn = arch ? true : item.teeth.length > 0;
  // While the big chart is open in the card, the mini one would only repeat it.
  const onChart = group.current && !!group.currentSlot && CHART_SLOTS.includes(group.currentSlot);
  const Icon = PRODUCT_ICON[item.product];
  const nested = group.pairs.length > 0 || !!group.defaults;
  return (
    <div className="pt-3 pb-1">
      <div className="flex items-center gap-3 pl-2 pr-1.5">
        {drawn && !onChart ? (
          <MiniChart teeth={item.teeth} arch={arch} pontics={item.bridge ? bridgeParts(item).pontics : undefined} width={64} label={title} />
        ) : (
          <span className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#2F62D6] flex items-center justify-center flex-shrink-0" aria-hidden>
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#030213] truncate">{title}</p>
          <p className="text-[11px] text-[#5A5A6A]">{lead || (group.current ? 'Adding now' : '')}</p>
        </div>
      </div>
      {nested && (
        <ol aria-label={`${title}: answers`} className="mt-1 ml-[27px] pl-3 border-l-2 border-[#ECECF2] space-y-0.5">
          {group.pairs.map(p => <li key={p.stepId}><PairRow pair={p} /></li>)}
          {group.defaults && <li><DefaultsRow line={group.defaults} /></li>}
        </ol>
      )}
    </div>
  );
}
