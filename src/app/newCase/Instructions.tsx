// ─── New Case Flow · instructions ────────────────────────────────────────────
// Each service can carry its own instructions ("Case Instructions (Crown)").
// At Review they merge, under each service's name, into the one Case
// Instructions text that goes to the lab, which stays editable. If a service's
// instructions change after that edit, "Merge Again" brings the merge back.
// With room ('wide') each box leads with a small icon; One page keeps the plain one.

import { useState } from 'react';
import { MessageSquarePlus, MessageSquareText } from 'lucide-react';
import { useCase } from './CaseContext';
import { PRODUCTS, ServiceItem, caseInstructions, instructionsStale, mergedInstructions } from './rules';
import { useRoom } from './room';
import { LinkButton, Notice, FOCUS } from './ui';

const AREA = 'w-full rounded-lg border border-[#D4D4DD] px-3 py-2 text-sm focus:border-[#3F6FE8] focus:ring-2 focus:ring-[#3F6FE8]/20 outline-none';

/**
 * Optional instructions for one service: a link until used, then a small box.
 * `inline`: already inside its own "Case Instructions (Crown)" section (Guided), so it opens straight to
 * the box, focused, with no second click and no repeated label.
 */
export function ServiceNote({ item, className = '', inline = false, autoFocus = true }: { item: ServiceItem; className?: string; inline?: boolean; /** Put the cursor in the box when it opens empty. */ autoFocus?: boolean }) {
  const { updateItem, readOnly } = useCase();
  const wide = useRoom() === 'wide';
  const [open, setOpen] = useState(inline);
  const note = item.note ?? '';
  const id = `svc-note-${item.id}`;
  const label = `Case Instructions (${PRODUCTS[item.product].label})`;
  if (readOnly) {
    if (!note.trim()) return null;
    if (inline) return <p className={`text-sm text-[#1F1F2E] whitespace-pre-wrap ${className}`}>{note.trim()}</p>;
    return wide ? (
      <div className={className}>
        <div className="rounded-xl bg-[#F8F9FC] border border-[#ECECF2] px-3.5 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4A4A5A]"><NoteIcon />{label}</p>
          <p className="mt-1 text-sm text-[#1F1F2E] whitespace-pre-wrap">{note.trim()}</p>
        </div>
      </div>
    ) : (
      <p className={`text-xs text-[#1F1F2E] whitespace-pre-wrap ${className}`}><span className="font-semibold text-[#4A4A5A]">Instructions: </span>{note.trim()}</p>
    );
  }
  if (!open && !note) {
    const noun = PRODUCTS[item.product].noun;
    const add = `Add Instructions for This ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
    return (
      <div className={className}>
        {wide ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#C9C9D6] bg-white text-xs font-semibold text-[#2F62D6] hover:border-[#3F6FE8] hover:bg-[#F8FAFF] motion-safe:transition-colors ${FOCUS}`}
          >
            <MessageSquarePlus className="w-4 h-4" strokeWidth={1.75} aria-hidden />{add}
          </button>
        ) : (
          <LinkButton onClick={() => setOpen(true)}>+ {add}</LinkButton>
        )}
      </div>
    );
  }
  const area = (
    <textarea
      id={id}
      autoFocus={autoFocus && open && !note}
      value={note}
      maxLength={500}
      rows={2}
      onChange={e => updateItem(item.id, { note: e.target.value })}
      placeholder="Anything the lab should know about this one?"
      aria-label={inline ? label : undefined}
      aria-describedby={wide || inline ? `${id}-help` : undefined}
      className={AREA}
    />
  );
  if (inline) {
    return (
      <div className={className}>
        {area}
        <p id={`${id}-help`} className="flex gap-2 text-[11px] text-[#5A5A6A] mt-1">
          <span className="flex-1 min-w-0">Goes into the case instructions at Review.</span>
          <span aria-hidden className="tabular-nums">{note.length}/500</span>
        </p>
      </div>
    );
  }
  if (wide) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 mb-1.5">
          <NoteIcon tile />
          <label htmlFor={id} className="text-xs font-semibold text-[#3A3A4A]">{label}</label>
          <span aria-hidden className="ml-auto text-[11px] tabular-nums text-[#5A5A6A]">{note.length}/500</span>
        </div>
        {area}
        <p id={`${id}-help`} className="text-[11px] text-[#5A5A6A] mt-1">Goes into the case instructions at Review.</p>
      </div>
    );
  }
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-[#3A3A4A] mb-1">{label}</label>
      {area}
      <p className="text-[11px] text-[#5A5A6A] mt-1">Goes into the case instructions at Review.</p>
    </div>
  );
}

/** The one Case Instructions text: merged from the services, still editable. */
export function CaseInstructionsBox({ id = 'case-note' }: { id?: string }) {
  const { draft, update, user, readOnly } = useCase();
  const wide = useRoom() === 'wide';
  const n = user.notation;
  const value = caseInstructions(draft, n);
  const merged = mergedInstructions(draft, n);
  const fromServices = draft.items.some(i => i.note?.trim());
  const left = 1000 - value.length;
  if (readOnly) {
    return (
      <div className={wide ? 'flex items-start gap-3' : ''}>
        {wide && <BoxIcon />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#030213]">Case Instructions</p>
          <p className="mt-1 text-sm text-[#030213] whitespace-pre-wrap">{value.trim() || 'None'}</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      {wide ? (
        <div className="flex items-start gap-3">
          <BoxIcon />
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="block text-sm font-semibold text-[#030213]">Case Instructions</label>
            <p className="text-xs text-[#5A5A6A]">{fromServices ? 'Merged from each service’s instructions. Edit it freely.' : 'Optional'}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-baseline gap-3">
          <label htmlFor={id} className="text-sm font-semibold text-[#030213]">Case Instructions</label>
          {fromServices && <span className="text-xs text-[#5A5A6A]">Merged from each service’s instructions. Edit it freely.</span>}
        </div>
      )}
      <textarea
        id={id}
        value={value}
        maxLength={1000}
        onChange={e => {
          const v = e.target.value;
          update(d => ({ ...d, instructions: v, instructionsBase: d.instructions === undefined ? mergedInstructions(d, n) : d.instructionsBase }));
        }}
        rows={Math.min(8, Math.max(3, value.split('\n').length + 1))}
        aria-describedby={left <= 100 ? `${id}-count` : undefined}
        placeholder="Anything the lab should know? Your note starts this case’s message thread."
        className={`${wide ? 'mt-3' : 'mt-2'} ${AREA}`}
      />
      {left <= 100 && <p id={`${id}-count`} className="text-xs text-[#5A5A6A] text-right">{left} characters left</p>}
      {instructionsStale(draft, n) && (
        <div className="mt-2">
          <Notice tone="note" actions={<LinkButton onClick={() => update(d => ({ ...d, instructions: undefined, instructionsBase: undefined }))}>Merge Again</LinkButton>}>
            A service’s instructions changed since you edited this. Merging again replaces your edits with the latest from each service.
          </Notice>
        </div>
      )}
      {draft.instructions !== undefined && !instructionsStale(draft, n) && draft.instructions !== merged && fromServices && (
        <div className="mt-1"><LinkButton onClick={() => update(d => ({ ...d, instructions: undefined, instructionsBase: undefined }))}>Undo My Edits</LinkButton></div>
      )}
    </div>
  );
}

function NoteIcon({ tile }: { tile?: boolean }) {
  const icon = <MessageSquareText className="w-3.5 h-3.5 text-[#2F62D6]" strokeWidth={1.75} aria-hidden />;
  return tile ? <span aria-hidden className="w-6 h-6 rounded-md bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">{icon}</span> : icon;
}
function BoxIcon() {
  return (
    <span aria-hidden className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] border border-[#DCE6FD] text-[#2F62D6] flex items-center justify-center flex-shrink-0">
      <MessageSquareText className="w-4 h-4" strokeWidth={1.75} />
    </span>
  );
}
