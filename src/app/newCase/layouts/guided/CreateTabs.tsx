// ─── Experience A · how the case is being filled ─────────────────────────────
// The Start page's two tabs stay above the case while it's being made.
// "Enter Manually" is this page: the case step by step. "Describe with AI"
// goes back to the description with the case written into the template, so
// typing or speaking carries on from where the case is (and fills this draft).

import { useNavigate } from 'react-router-dom';
import { PenLine, Sparkles } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { fullName } from '../../rules';
import { describeDraft } from '../../describe';
import { FOCUS } from '../../ui';

const TAB = 'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold whitespace-nowrap';

export default function CreateTabs() {
  const navigate = useNavigate();
  const { draft, patient, lab } = useCase();
  const toAi = () => navigate('/flows/new-case/case/new', {
    // fromCase: the AI page's Enter Manually comes straight back here.
    state: { session: `ai-${Date.now()}`, aiText: describeDraft(draft, fullName(patient), lab.name), fromCase: draft.id },
  });
  return (
    <div className="flex items-center gap-3 mb-3">
      <nav aria-label="How to fill the case" className="inline-flex flex-shrink-0 p-1 rounded-xl bg-[#F0EFF6] border border-[#E0E0E6]">
        <button
          type="button"
          onClick={toAi}
          className={`${TAB} text-[#5A5A6A] hover:text-[#030213] hover:bg-white/60 transition-colors motion-reduce:transition-none ${FOCUS}`}
        >
          <Sparkles className="w-4 h-4" strokeWidth={2} aria-hidden />Describe with AI
        </button>
        <span aria-current="page" className={`${TAB} bg-white text-[#030213] shadow-[0_1px_3px_rgba(3,2,19,0.10),0_0_0_1px_rgba(224,224,230,0.9)]`}>
          <PenLine className="w-4 h-4 text-[#2F62D6]" strokeWidth={2} aria-hidden />Enter Manually
        </span>
      </nav>
      <p className="min-w-0 truncate text-xs text-[#5A5A6A]">Step by step, as the timeline shows. Describe with AI carries on from here.</p>
    </div>
  );
}
