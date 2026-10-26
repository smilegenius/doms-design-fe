// ─── Experience C · the case-level cards ─────────────────────────────────────
// The page reads top to bottom in the navigator's order, so the case-level
// rows sit where they belong: Patient and funding with the Lab first (until a
// lab is picked, the "Select Lab to proceed" card sits right under the
// patient instead), the services next, then Scans source and Prescriber,
// then Case Instructions. Delivery has no row: each service carries its own
// back-by date, and the plan (fit, send separately) sits in the Review card. A row that needs an answer is open (Scans
// source often is); "Change" opens any other row inline with the same step
// screen Experience A uses, so every rule behaves the same. Rows glide open
// and shut, and a "Needs you" row that becomes the active one pulses once.

import { ReactNode, Ref, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { useCase } from '../../CaseContext';
import { useController } from '../../controller';
import { CLINIC } from '../../data';
import { fmtDay } from '../../dates';
import { PRODUCTS, itemPhrase, patientLine, splitSuggestion } from '../../rules';
import { CaseInstructionsBox } from '../../Instructions';
import { LabStep, PatientStep, PrescriberStep, RecordsStep, recordsSummary } from '../../CaseSteps';
import { NoteView } from '../../ServiceSteps';
import { LinkButton, Notice, SecondaryButton, SourceTag, StateIcon } from '../../ui';
import { useHeightMorph, usePulse } from './motion';
import { useAdvanceOnChange, useRowMode } from './state';

type RowId = 'patient' | 'lab' | 'records' | 'prescriber';

const CARD = 'bg-white rounded-2xl border border-[#E0E0E6] overflow-hidden';

/** Who it's for and who's making it. */
export function PatientLabCard() {
  const { draft, patient, lab, ctx } = useCase();
  // Picked in its own card: the lab row then arrives answered, folded, while the page moves on.
  const labFirst = useRef(draft.labPicked === false);
  if (draft.labPicked === false) labFirst.current = true;
  return (
    <section data-nc-reveal aria-label="Patient and lab" className={CARD}>
      <ul className="divide-y divide-[#F0EFF6]">
        <CaseRow
          id="patient"
          label="Patient and funding"
          gap={false}
          autoKey={`${patient.id}|${draft.funding}`}
          summary={patientLine(patient, ctx.now)}
          tags={<><SourceTag src={draft.scan ? 'From scan' : 'Patient record'} /><FundingTag nhs={draft.funding === 'nhs'} /></>}
          render={ref => <PatientStep ref={ref} />}
        />
        {/* Until a lab is picked it has its own card, right under the patient. */}
        {draft.labPicked !== false && <CaseRow
          id="lab"
          label="Lab"
          gap={false}
          settledOnMount={labFirst.current}
          summary={<span className="inline-flex items-center gap-2"><span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${lab.avatar}`} aria-hidden>{lab.initials}</span>{lab.name} · {lab.city}</span>}
          tags={<Tag src={draft.labSrc} />}
          render={ref => <LabStep ref={ref} />}
        />}
      </ul>
      <p className="px-5 py-2.5 border-t border-[#F0EFF6] text-[11px] text-[#5A5A6A]">{CLINIC.name} · {draft.labPicked === false ? 'The lab' : lab.name} sees {patient.first[0]}.{patient.last[0]}. only.</p>
    </section>
  );
}

/** Right after the patient: pick the lab (it sets the catalogue, prices and dates). */
export function LabFirstCard() {
  const { step } = useCase();
  const c = useController();
  const ref = useRef<HTMLElement>(null);
  usePulse(ref, step === 'lab', '#FFFFFF');
  return (
    <section
      ref={ref}
      id="nc-sec-lab"
      data-nc-row="lab"
      data-nc-section="lab"
      data-nc-reveal
      className="bg-white rounded-2xl border border-[#E0E0E6] border-l-4 border-l-[#E8A93B] p-5"
    >
      <LabStep ref={step === 'lab' ? c.headingRef : undefined} />
    </section>
  );
}

/** Scans source, prescriber and delivery. */
export function LogisticsCard() {
  const api = useCase();
  const { draft, prescriber, prescriberSrc, user, steps, notes, readOnly } = api;
  const gapOf = (id: RowId) => !!steps.find(s => s.id === id)?.gap;
  const unlinked = notes.find(x => x.kind === 'unlinked');

  return (
    <section data-nc-reveal aria-labelledby="nc-case-details" className={CARD}>
      <h2 id="nc-case-details" className="px-5 pt-4 pb-3 text-[11px] font-bold uppercase tracking-widest text-[#4A4A5A]">Case details</h2>
      <ul className="border-t border-[#F0EFF6] divide-y divide-[#F0EFF6]">
        <CaseRow
          id="records"
          label="Scans source"
          gap={gapOf('records')}
          summary={recordsSummary(api)}
          tags={<Tag src={draft.scan ? 'From scan' : undefined} />}
          render={ref => <RecordsStep ref={ref} />}
        />
        <CaseRow
          id="prescriber"
          label="Prescriber"
          gap={gapOf('prescriber')}
          autoKey={prescriber?.id ?? ''}
          summary={prescriber ? `${prescriber.name}${prescriber.id === user.id ? ' (you)' : ''}${prescriber.gdc ? ` · GDC ${prescriber.gdc}` : ''}` : 'Not chosen yet'}
          tags={<Tag src={prescriberSrc} />}
          below={unlinked && !readOnly ? (
            <p className="text-xs text-[#1E40AF]">{unlinked.text} <LinkButton onClick={() => api.go('prescriber')}>Review</LinkButton></p>
          ) : null}
          render={ref => <PrescriberStep ref={ref} />}
        />
      </ul>
    </section>
  );
}

/** The one Case Instructions text: merged from each service's instructions, still editable. */
export function InstructionsCard() {
  return (
    <section
      id="nc-sec-instructions"
      data-nc-section="instructions"
      data-nc-reveal
      tabIndex={-1}
      aria-label="Case instructions"
      className={`${CARD} px-5 py-4 focus:outline-none`}
    >
      <CaseInstructionsBox id="nc-canvas-note" />
    </section>
  );
}

/** Where a value came from, except "You": a value is the user's own unless it says otherwise. */
function Tag({ src }: { src?: string }) {
  return src && src !== 'You' ? <SourceTag src={src} /> : null;
}

function FundingTag({ nhs }: { nhs: boolean }) {
  return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-white border-[#D4D4DD] text-[#3A3A4A]">{nhs ? 'NHS' : 'Private'}</span>;
}

function CaseRow({ id, label, gap, settledOnMount, summary, tags, below, autoKey, render }: {
  id: RowId;
  label: string;
  gap: boolean;
  /** Arrives already answered while active: mount folded (only the first render counts). */
  settledOnMount?: boolean;
  summary: ReactNode;
  tags?: ReactNode;
  below?: ReactNode;
  /** Changing this value while the row is open for a change closes it and moves on. */
  autoKey?: string;
  render: (ref: Ref<HTMLHeadingElement> | undefined) => ReactNode;
}) {
  const { step, go, readOnly } = useCase();
  const c = useController();
  const active = step === id;
  const { mode, reopen } = useRowMode(active, gap, readOnly, settledOnMount);
  useAdvanceOnChange(mode === 'change' && autoKey !== undefined, autoKey ?? '', true);
  const ref = active ? c.headingRef : undefined;
  const liRef = useRef<HTMLLIElement>(null);
  // Opening and folding glide instead of jumping.
  useHeightMorph(liRef, mode, { fade: true });
  usePulse(liRef, active && mode === 'gap');

  if (mode === 'view') {
    return (
      <li ref={liRef} id={`nc-sec-${id}`} data-nc-row={id} data-nc-section={id} className={`relative pl-5 pr-4 py-3 transition-colors duration-200 motion-reduce:transition-none ${active ? 'bg-[#F5F8FF]' : ''}`}>
        {active && <span aria-hidden className="absolute left-0 inset-y-0 w-[3px] bg-[#3F6FE8]" />}
        <div className="flex items-center gap-3">
          <h3 ref={ref} tabIndex={-1} className="w-36 flex-shrink-0 text-xs font-semibold text-[#4A4A5A] focus:outline-none">{label}</h3>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-sm text-[#030213]">
            <span className="min-w-0">{summary}</span>
            {tags}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => { reopen(); go(id); }}
              aria-label={`Change ${label.toLowerCase()}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2F62D6] hover:text-[#1E40AF] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F6FE8] focus-visible:ring-offset-2"
            >
              <Pencil className="w-3 h-3" aria-hidden />Change
            </button>
          )}
        </div>
        {below && <div className="mt-2 pl-[156px]">{below}</div>}
      </li>
    );
  }

  return (
    <li ref={liRef} id={`nc-sec-${id}`} data-nc-row={id} data-nc-section={id} className={`relative px-5 py-4 transition-colors duration-200 motion-reduce:transition-none ${active ? 'bg-[#F5F8FF]' : 'bg-white'}`}>
      <span aria-hidden className={`absolute left-0 inset-y-0 w-[3px] ${active ? 'bg-[#3F6FE8]' : 'bg-[#B45309]'}`} />
      <div className="absolute right-4 top-3.5 z-10">
        {mode === 'gap' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#F5D98B] text-[11px] font-semibold text-[#8A4B08]">
            <StateIcon state="gap" size="sm" />Needs you
          </span>
        ) : (
          <LinkButton onClick={() => go(c.nextGapId)}>Done</LinkButton>
        )}
      </div>
      {/* The step screens carry their own heading: kept, but sized for a row. */}
      <div className="[&_h2]:text-base [&_h2]:pr-28">{render(ref)}</div>
    </li>
  );
}

/** The delivery plan under the services at Review: sending a quicker service separately, and any delivery notes (no fit appointment). */
export function DeliveryPlan() {
  const api = useCase();
  const { draft, ctx, user, notes, readOnly, dates, update, sendSeparately, dismissNote } = api;
  const split = splitSuggestion(draft, ctx, dates);
  const deliveryNotes = notes.filter(x => x.step === 'delivery');
  const offer = !!split && !draft.keepTogether && !draft.split;
  // Nothing to decide: no empty block under the back-by line.
  if (readOnly || (!offer && !draft.split && deliveryNotes.length === 0)) return null;
  return (
    <div className="space-y-2">
      {split && !draft.keepTogether && !draft.split && (
        <Notice tone="note" actions={<><SecondaryButton onClick={() => sendSeparately(true)}>Send Separately</SecondaryButton><SecondaryButton onClick={() => update(d => ({ ...d, keepTogether: true }))}>Keep Together</SecondaryButton></>}>
          The {PRODUCTS[split.item.product].noun} alone would be back {fmtDay(split.backBy)}.
        </Notice>
      )}
      {draft.split && (
        <Notice tone="success" actions={<SecondaryButton onClick={() => sendSeparately(false)}>Keep Together</SecondaryButton>}>
          Sends as 2 cases: the {itemPhrase(split?.item ?? draft.items[0], user.notation)} goes on its own and is back {split ? fmtDay(split.backBy) : 'sooner'}.
        </Notice>
      )}
      {deliveryNotes.map(x => <NoteView key={x.id} note={x} onDismiss={() => dismissNote(x.id)} />)}
    </div>
  );
}
