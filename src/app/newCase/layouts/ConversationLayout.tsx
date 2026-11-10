// ─── Experience B · Conversation ─────────────────────────────────────────────
// One calm column, one question at a time, like a short guided chat. A slim
// case strip on top (who, which lab, total, Back by); the services answered so
// far as a compact thread (tap one to change it); the current question as one
// large card; a faint line saying what comes next; and a sticky composer with
// Back, Save as draft and one primary action. On Review, and in the read-only
// views, the case is shown once (the thread folds away). No timeline, no rail,
// no stepper bar. Every rule, default, auto-advance and send path comes from
// the same CaseContext + controller as the other two.

import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useCase } from '../CaseContext';
import { useController } from '../controller';
import { parseStep } from '../rules';
import { LinkButton } from '../ui';
import { RoomProvider } from '../room';
import { CaseBanners } from './CaseHeader';
import CaseStrip from './conversation/CaseStrip';
import Thread, { FoldedThread } from './conversation/Thread';
import QuestionCard from './conversation/QuestionCard';
import Composer from './conversation/Composer';
import { upcoming } from './conversation/model';

export default function ConversationLayout() {
  const api = useCase();
  const c = useController();
  const cardRef = useRef<HTMLElement>(null);
  const summary = api.readOnly || api.step === 'review';

  // Each new question settles in the same place, with the last answer still
  // visible above it, and eases in (unless motion is reduced).
  const shown = useRef(api.step);
  useEffect(() => {
    if (shown.current === api.step) return;
    shown.current = api.step;
    const el = cardRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still && typeof el.animate === 'function') {
      el.animate(
        [{ opacity: 0.35, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 240, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
      );
    }
  }, [api.step]);

  return (
    <div className="min-w-[1100px] min-h-[calc(100vh-56px)] flex flex-col bg-[#F8F9FC]">
      <h1 className="sr-only">{c.view === 'edit' ? 'Create new Case' : 'Case'}</h1>
      <CaseStrip />
      <div className="flex-1 w-full max-w-[792px] mx-auto px-4 flex flex-col">
        <CaseBanners className="mt-6 space-y-2" />
        <div className={summary ? 'mt-5' : 'mt-7'}>
          {/* Review already lists every answer with its own Edit, so the thread folds away there. */}
          {summary ? <FoldedThread /> : <Thread />}
        </div>
        <div className="mt-4">
          {/* One large card per question: the steps draw their fuller versions. */}
          <RoomProvider value="wide"><QuestionCard ref={cardRef} /></RoomProvider>
        </div>
        <NextLine />
        {api.readOnly ? <div className="h-12" /> : <Composer />}
      </div>
    </div>
  );
}

/**
 * "Then: shade, then review and send · 1 more question", plus the two ways off
 * the straight path: Add Another Service (any time a service exists) and
 * Answer Later (on an open question, to Review, which lists what's left).
 */
function NextLine() {
  const api = useCase();
  if (api.readOnly) return null;
  const kind = parseStep(api.step).kind;
  const u = kind === 'review' ? null : upcoming(api);
  const canAdd = api.draft.items.length > 0 && kind !== 'services';
  const curGap = kind !== 'services' && kind !== 'review' && !!api.steps.find(s => s.id === api.step)?.gap;
  if (!u && !canAdd) return null;
  return (
    <div className="mt-3 px-5 flex items-center gap-4 text-xs text-[#5A5A6A]">
      {u && (
        <p className="min-w-0 truncate">
          {u.then}
          {u.count && <> · <span className={u.count.done ? 'font-semibold text-[#2E7D32]' : ''}>{u.count.text}</span></>}
        </p>
      )}
      <div className="ml-auto flex items-center gap-4 flex-shrink-0">
        {canAdd && (
          <LinkButton onClick={() => api.go('services')} className="inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" aria-hidden />Add Another Service
          </LinkButton>
        )}
        {curGap && <LinkButton onClick={() => api.go('review')}>Answer Later</LinkButton>}
      </div>
    </div>
  );
}
