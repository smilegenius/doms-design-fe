// ─── New Case Flow · Review and Send ─────────────────────────────────────────
// One card per service with its own read-only Teeth Chart, then records,
// prescriber, lab and delivery, the case note and the attestation line that
// makes Send the prescriber's signature. With room ('wide': Guided,
// Conversation) it opens on a band of the case's facts, gaps read as amber
// rows that go straight to them, and the details sit side by side as small
// cards. One page ('compact') keeps the plain rows.

import { forwardRef, ForwardedRef, ReactNode, useState } from 'react';
import {
  ArrowRight, Building2, CalendarClock, ChevronDown, ClipboardCheck, Lock, MessageSquareText, Pencil, ScanLine, ShieldCheck, Stethoscope, Trash2, Truck, UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useCase } from './CaseContext';
import { CLINIC } from './data';
import { fmtCutoff, fmtDay, sameDay } from './dates';
import {
  PRODUCTS, ServiceItem, StepNode, archCaps, attestation, bridgeParts, fitCheck, fullName, itemTitle, labSees, parseStep, plural,
  recordsState, sendMode, slotsFor, splitSuggestion, fitLine, caseInstructions, instructionsStale,
} from './rules';
import { MiniChart } from './TeethChart';
import { CaseInstructionsBox, ServiceNote } from './Instructions';
import { PRODUCT_ICON, itemDetails, questionFor, NoteView } from './ServiceSteps';
import { backByText, recordsSummary } from './CaseSteps';
import { useRoom } from './room';
import { Card, GapButton, LinkButton, Notice, SecondaryButton, SourceTag, StateIcon, StepHeading, FOCUS } from './ui';

type Api = ReturnType<typeof useCase>;
type HeadingRef = ForwardedRef<HTMLHeadingElement>;

/** "Needs you: which teeth?" for any gap step. */
export function gapLabel(node: StepNode, api: ReturnType<typeof useCase>): string {
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  if (node.kind === 'lab') return 'Needs you: which lab is making this?';
  if (node.kind === 'services') return 'Needs you: what are we making?';
  if (node.kind === 'records') {
    const s = recordsState(api.draft, api.ctx);
    if (s === 'none') return 'Needs you: how will the lab get the impressions?';
    if (s === 'upload') return 'Needs you: upload the scan files and name each one';
    return 'Needs you: tick the disinfection line';
  }
  if (node.kind === 'prescriber') return api.prescriber && !api.prescriber.gdc ? 'Needs you: a GDC number for the prescriber' : 'Needs you: who is prescribing?';
  if (node.kind === 'slot' && node.slot && node.itemId) {
    const item = api.draft.items.find(i => i.id === node.itemId)!;
    const q = questionFor(node.slot, item, api.user.notation, api.lab.name);
    return `Needs you: ${lower(q)}${node.slot.id === 'material' || node.slot.id === 'shade' ? '' : ` (${itemTitle(item, api.user.notation)})`}`;
  }
  return 'Needs you';
}

export const ReviewStep = forwardRef<HTMLHeadingElement>(function ReviewStep(_, ref) {
  const wide = useRoom() === 'wide';
  return wide ? <WideReview hRef={ref} /> : <CompactReview hRef={ref} />;
});

const reviewTitle = (api: Api) =>
  api.readOnly ? 'Case details' : api.gaps ? `Nearly there: ${api.gaps} ${api.gaps === 1 ? 'thing' : 'things'} left` : 'Ready to send';

// ─── Compact (One page's rows) ───────────────────────────────────────────────

function CompactReview({ hRef }: { hRef: HeadingRef }) {
  const api = useCase();
  const { draft, update, go, gaps, user, prescriber, patient, lab, dates, readOnly } = api;
  const { gapNodes, allGaps, mode, follow, fit, split } = reviewFacts(api);

  return (
    <div className="space-y-5">
      <StepHeading ref={hRef} kicker="Review and Send" title={reviewTitle(api)} />

      {gaps > 0 && !readOnly && (
        <Card className="p-4">
          <ul className="space-y-1.5">
            {(gapNodes.length ? gapNodes : allGaps).map(n => (
              <li key={n.id}>
                <button type="button" onClick={() => go(n.id)} className={`text-sm text-[#8A4B08] font-medium hover:underline rounded ${FOCUS}`}>▲ {gapLabel(n, api)}</button>
              </li>
            ))}
          </ul>
          {allGaps.length > gapNodes.length && <p className="text-xs text-[#5A5A6A] mt-2">More questions open up as you answer these.</p>}
        </Card>
      )}

      {draft.items.map(item => <ServiceCard key={item.id} item={item} />)}
      {draft.items.length === 0 && (
        <Card className="p-4 text-sm text-[#5A5A6A]">No services yet. <LinkButton onClick={() => go('services')}>Add a Service</LinkButton></Card>
      )}

      <Card className="divide-y divide-[#F0EFF6]">
        <Row label="Scans Source" value={recordsSummary(api)} onEdit={readOnly ? undefined : () => go('records')} />
        <Row label="Prescriber" value={prescriber ? `${prescriber.name}${prescriber.gdc ? ` · GDC ${prescriber.gdc}` : ''}` : 'Not chosen yet'} onEdit={readOnly ? undefined : () => go('prescriber')} />
        <Row label="Lab" value={`${lab.name} · ${lab.city} · MHRA ${lab.mhra}`} src={draft.labSrc} onEdit={readOnly ? undefined : () => go('lab')} />
        <Row
          label="Delivery"
          value={<>
            {backByText(api)}
            {fit && <span className="block text-xs text-[#4A4A5A] mt-0.5">{fitLine(fit)}</span>}
            {!fit && dates.earliestFit && dates.route !== 'follow' && !readOnly && (
              <span className="block mt-1"><LinkButton onClick={() => api.openDrawer({ kind: 'fit' })}>Add Fit Appointment</LinkButton></span>
            )}
            {draft.split && <span className="block text-xs text-[#4A4A5A] mt-0.5">Sends as 2 cases{!readOnly && <> · <LinkButton onClick={() => api.sendSeparately(false)}>Keep Together</LinkButton></>}</span>}
            {split && !draft.split && !draft.keepTogether && !readOnly && (
              <div className="mt-2">
                <Notice tone="note" actions={<><SecondaryButton onClick={() => api.sendSeparately(true)}>Send Separately</SecondaryButton><SecondaryButton onClick={() => update(d => ({ ...d, keepTogether: true }))}>Keep Together</SecondaryButton></>}>
                  The {PRODUCTS[split.item.product].noun} alone would be back {fmtDay(split.backBy)}.
                </Notice>
              </div>
            )}
          </>}
          onEdit={readOnly ? undefined : () => go('delivery')}
        />
      </Card>

      {/* Each service's instructions, merged here; still editable — folded to its first line until opened. */}
      <InstructionsFold />

      {gaps === 0 && prescriber && !readOnly && (
        <p className="text-sm text-[#1F1F2E] leading-relaxed bg-[#F8F9FC] border border-[#ECECF2] rounded-xl px-4 py-3">
          {attestation(mode, user, prescriber, patient, follow)}
        </p>
      )}
      {gaps > 0 && !readOnly && <GapButton count={gaps} onClick={() => go(gapNodes[0]?.id ?? 'review')} />}
      <p className="text-[11px] text-[#5A5A6A]">{CLINIC.name} · {lab.name} sees {patient.first[0]}.{patient.last[0]}. only.</p>
    </div>
  );
}

function Row({ label, value, src, onEdit }: { label: string; value: React.ReactNode; src?: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <p className="w-28 flex-shrink-0 text-xs font-semibold text-[#4A4A5A] pt-0.5">{label}</p>
      <div className="flex-1 min-w-0 text-sm text-[#030213]">{value} {src && <SourceTag src={src} />}</div>
      {onEdit && <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className={`p-1 rounded text-[#4A4A5A] hover:text-[#030213] ${FOCUS}`}><Pencil className="w-3.5 h-3.5" /></button>}
    </div>
  );
}

function ServiceCard({ item }: { item: ServiceItem }) {
  const api = useCase();
  const { ctx, user, go, removeItem, notes, dismissNote, readOnly } = api;
  const slots = slotsFor(item, ctx);
  const gaps = slots.filter(s => s.required && !s.answered).length;
  const firstSlot = slots.find(s => s.required && !s.answered) ?? slots[0];
  const itemNotes = notes.filter(n => n.itemId === item.id);
  const arch = PRODUCTS[item.product].archItem ? item.arch : undefined;
  const own = ownDates(api, item.id);
  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <MiniChart teeth={item.teeth} arch={arch} pontics={item.bridge ? bridgeParts(item).pontics : undefined} width={92} label={itemTitle(item, user.notation)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="text-base font-semibold text-[#030213] flex-1">{itemTitle(item, user.notation)}</h3>
            {!readOnly && (
              <div className="flex gap-1">
                <button type="button" onClick={() => go(`svc:${item.id}:${firstSlot.id}`)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-[#2F62D6] hover:bg-[#EEF4FF] ${FOCUS}`}><Pencil className="w-3 h-3" aria-hidden />Edit</button>
                <button type="button" onClick={() => removeItem(item.id)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] ${FOCUS}`}><Trash2 className="w-3 h-3" aria-hidden />Remove</button>
              </div>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
            {itemDetails(item, ctx).filter(d => d.label !== 'Teeth' || item.product === 'bridge').map(d => (
              <div key={d.label} className="contents">
                <dt className="text-xs text-[#4A4A5A]">{d.label}</dt>
                <dd className="text-xs text-[#030213] font-medium">{d.value} {d.src && d.src !== 'You' && <SourceTag src={d.src} />}</dd>
              </div>
            ))}
            {own && (
              <>
                <dt className="text-xs text-[#4A4A5A]">{own.backBy ? 'Back by' : 'Lead time'}</dt>
                <dd className="text-xs text-[#030213] font-semibold">{own.backBy ? `${fmtDay(own.backBy)} · ${own.days}` : own.days}</dd>
              </>
            )}
          </dl>
          {gaps > 0 && !readOnly && <p className="mt-2 text-xs font-semibold text-[#8A4B08]">▲ {gaps} {gaps === 1 ? 'thing' : 'things'} left</p>}
          <ServiceNote item={item} className="mt-3" />
          {itemNotes.length > 0 && !readOnly && <div className="mt-3 space-y-2">{itemNotes.map(n => <NoteView key={n.id} note={n} onDismiss={() => dismissNote(n.id)} />)}</div>}
        </div>
      </div>
    </Card>
  );
}

// ─── Wide (Guided, Conversation) ─────────────────────────────────────────────

function WideReview({ hRef }: { hRef: HeadingRef }) {
  const api = useCase();
  const { draft, update, ctx, steps, go, gaps, user, prescriber, patient, lab, dates, readOnly } = api;
  const { gapNodes, allGaps, mode, follow, fit, split } = reviewFacts(api);
  const edit = (id: string) => (readOnly ? undefined : () => go(id));
  const gapAt = (kind: StepNode['kind']) => !readOnly && steps.some(s => s.kind === kind && s.gap);
  const back = backFact(api);
  const addFit = !fit && !!dates.earliestFit && dates.route !== 'follow' && !readOnly;

  return (
    <div className="space-y-4">
      <StepHeading ref={hRef} icon={ClipboardCheck} kicker="Review and Send" title={reviewTitle(api)} />

      {/* The case at a glance. */}
      <dl className="grid grid-cols-3 rounded-2xl border border-[#ECECF2] bg-[#F8F9FC] divide-x divide-[#ECECF2]">
        <Fact icon={UserRound} label="Patient" value={fullName(patient)} sub={labSees(patient, ctx.now)} />
        <Fact
          icon={Building2}
          label="Lab"
          value={draft.labPicked === false ? 'Not chosen yet' : lab.name}
          sub={draft.labPicked === false ? undefined : <>{lab.city} · MHRA {lab.mhra} <SourceTag src={draft.labSrc} /></>}
          onEdit={edit('lab')}
          gap={gapAt('lab')}
        />
        <Fact icon={CalendarClock} label="Back by" value={back.value} sub={back.sub} big />
      </dl>

      {gaps > 0 && !readOnly && (
        <section aria-labelledby="nc-review-gaps" className="rounded-2xl border border-[#F5D98B] bg-[#FFF8E1] p-4">
          {/* The one pulsing cue on the page; the rows below keep a still icon. */}
          <h3 id="nc-review-gaps" className="flex items-center gap-2 text-xs font-semibold text-[#8A4B08]"><StateIcon state="gap" size="sm" />Before it can go to {lab.name}</h3>
          <ul className="mt-2.5 space-y-2">
            {(gapNodes.length ? gapNodes : allGaps).map(n => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => go(n.id)}
                  className={`group w-full flex items-center gap-3 pl-3 pr-2 py-2 rounded-xl bg-white border border-[#F5D98B] text-left hover:border-[#B45309] motion-safe:transition-colors ${FOCUS}`}
                >
                  <StateIcon state="gap" size="sm" ripple={false} />
                  <span className="flex-1 min-w-0 text-sm font-medium text-[#8A4B08]">{gapLabel(n, api)}</span>
                  <span aria-hidden className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF8E1] border border-[#F5D98B] text-xs font-semibold text-[#8A4B08] group-hover:bg-[#FFF1C7] motion-safe:transition-colors">
                    Go<ArrowRight className="w-3.5 h-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" strokeWidth={1.75} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {allGaps.length > gapNodes.length && <p className="text-xs text-[#5A5A6A] mt-2">More questions open up as you answer these.</p>}
        </section>
      )}

      <section aria-labelledby="nc-review-services" className="space-y-3">
        <SectionLabel id="nc-review-services">{draft.items.length ? `Services · ${draft.items.length}` : 'Services'}</SectionLabel>
        {draft.items.map(item => <WideService key={item.id} item={item} startOpen={draft.items.length === 1} />)}
        {draft.items.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-[#C9C9D6] text-sm text-[#5A5A6A]">
            <PRODUCT_ICON.other className="w-5 h-5 text-[#4A4A5A]" strokeWidth={1.75} aria-hidden />
            No services yet. <LinkButton onClick={() => go('services')}>Add a Service</LinkButton>
          </div>
        )}
      </section>

      <section aria-labelledby="nc-review-details" className="space-y-3">
        <SectionLabel id="nc-review-details">Case details</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <Detail icon={ScanLine} label="Scans Source" onEdit={edit('records')} gap={gapAt('records')}>{recordsSummary(api)}</Detail>
          <Detail
            icon={Stethoscope}
            label="Prescriber"
            onEdit={edit('prescriber')}
            gap={gapAt('prescriber')}
            sub={prescriber ? (prescriber.gdc ? `GDC ${prescriber.gdc}` : 'No GDC number on file') : undefined}
          >
            {prescriber ? prescriber.name : 'Not chosen yet'}
          </Detail>
          <Detail
            icon={Truck}
            label="Delivery"
            sub={(fit || addFit || draft.split) && <>
              {fit && <span className="block">{fitLine(fit)}</span>}
              {addFit && <span className="block mt-0.5"><LinkButton onClick={() => api.openDrawer({ kind: 'fit' })}>Add Fit Appointment</LinkButton></span>}
              {draft.split && <span className="block mt-0.5">Sends as 2 cases{!readOnly && <> · <LinkButton onClick={() => api.sendSeparately(false)}>Keep Together</LinkButton></>}</span>}
            </>}
          >
            {/* How the lab gets the work; the band above already gives the back-by day. */}
            {receiveText(api)}
          </Detail>
        </div>
        {split && !draft.split && !draft.keepTogether && !readOnly && (
          <Notice tone="note" actions={<><SecondaryButton onClick={() => api.sendSeparately(true)}>Send Separately</SecondaryButton><SecondaryButton onClick={() => update(d => ({ ...d, keepTogether: true }))}>Keep Together</SecondaryButton></>}>
            The {PRODUCTS[split.item.product].noun} alone would be back {fmtDay(split.backBy)}.
          </Notice>
        )}
      </section>

      {/* Each service's instructions, merged here; still editable. */}
      <Card className="p-4">
        <CaseInstructionsBox />
      </Card>

      {gaps === 0 && prescriber && !readOnly && (
        <div className="flex items-start gap-3 rounded-xl bg-[#F8F9FC] border border-[#ECECF2] px-4 py-3">
          <ShieldCheck className="w-5 h-5 mt-0.5 text-[#2E7D32] flex-shrink-0" strokeWidth={1.75} aria-hidden />
          <p className="text-sm text-[#1F1F2E] leading-relaxed">{attestation(mode, user, prescriber, patient, follow)}</p>
        </div>
      )}
      {gaps > 0 && !readOnly && <GapButton count={gaps} onClick={() => go(gapNodes[0]?.id ?? 'review')} />}
      <p className="flex items-center gap-1.5 text-[11px] text-[#5A5A6A]">
        <Lock className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} aria-hidden />
        {CLINIC.name} · {lab.name} sees {patient.first[0]}.{patient.last[0]}. only.
      </p>
    </div>
  );
}

/** One service: its chart (or icon), title, its own back-by date, spec sheet, Edit and Remove. */
/**
 * One service at Review as an accordion: the header always reads it back (chart,
 * title, a one-line summary, its own back-by date); open, it shows every detail,
 * Edit / Remove and its instructions. Open by default only when it's the only
 * service or it still needs something, so Review fits without scrolling.
 */
function WideService({ item, startOpen }: { item: ServiceItem; startOpen?: boolean }) {
  const api = useCase();
  const { ctx, user, go, removeItem, notes, dismissNote, readOnly } = api;
  const slots = slotsFor(item, ctx);
  const gaps = slots.filter(s => s.required && !s.answered).length;
  const firstSlot = slots.find(s => s.required && !s.answered) ?? slots[0];
  const itemNotes = notes.filter(n => n.itemId === item.id);
  const arch = PRODUCTS[item.product].archItem ? item.arch : undefined;
  const own = ownDates(api, item.id);
  const title = itemTitle(item, user.notation);
  const Icon = PRODUCT_ICON[item.product];
  const details = itemDetails(item, ctx).filter(d => d.label !== 'Teeth' || item.product === 'bridge');
  const [open, setOpen] = useState(!!startOpen || (gaps > 0 && !readOnly));
  const summary = details.filter(d => d.value.length <= 34).map(d => d.value).join(' · ');
  const bodyId = `nc-review-svc-${item.id}`;
  if (!open) {
    return (
      <Card className="p-0">
        <button type="button" aria-expanded={false} aria-controls={bodyId} onClick={() => setOpen(true)} className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-2xl ${FOCUS}`}>
          <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#F8F9FC] border border-[#ECECF2] flex items-center justify-center overflow-hidden" aria-hidden>
            {item.teeth.length > 0 || arch ? <MiniChart teeth={item.teeth} arch={arch} pontics={item.bridge ? bridgeParts(item).pontics : undefined} width={32} label={title} /> : <Icon className="w-5 h-5 text-[#2F62D6]" strokeWidth={1.75} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[#030213] truncate">{title}</span>
            {summary && <span className="block text-xs text-[#5A5A6A] truncate">{summary}</span>}
          </span>
          {gaps > 0 && !readOnly && <StateIcon state="gap" size="sm" ripple={false} />}
          {own && <span className="flex-shrink-0 text-xs font-semibold text-[#030213] whitespace-nowrap">{own.backBy ? `Back by ${fmtDay(own.backBy)}` : own.days}</span>}
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#5A5A6A]" aria-hidden />
        </button>
      </Card>
    );
  }
  return (
    <Card className="p-4 nc-accordion-in">
      <div id={bodyId} className="flex gap-4">
        <div className="flex-shrink-0 self-start w-[100px] rounded-xl bg-[#F8F9FC] border border-[#ECECF2] p-2 flex flex-col items-center gap-1">
          {item.teeth.length > 0 || arch
            ? <MiniChart teeth={item.teeth} arch={arch} pontics={item.bridge ? bridgeParts(item).pontics : undefined} width={82} label={title} />
            : <span aria-hidden className="w-full h-[84px] flex items-center justify-center text-[#2F62D6]"><Icon className="w-8 h-8" strokeWidth={1.75} /></span>}
          {arch && <span className="text-[10px] font-bold tracking-wider text-[#3A3A4A]">{archCaps(arch)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-[#030213] leading-snug">{title}</h4>
              {gaps > 0 && !readOnly && (
                <p className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FFF8E1] border border-[#F5D98B] text-[11px] font-semibold text-[#8A4B08]">
                  <StateIcon state="gap" size="sm" ripple={false} />{gaps} {gaps === 1 ? 'thing' : 'things'} left
                </p>
              )}
            </div>
            <button type="button" aria-expanded aria-controls={bodyId} aria-label={`Fold ${title}`} onClick={() => setOpen(false)} className={`order-last p-1 rounded-md text-[#5A5A6A] hover:bg-[#F8F9FC] ${FOCUS}`}>
              <ChevronDown className="w-4 h-4 rotate-180" aria-hidden />
            </button>
            {own && (
              <div className="flex-shrink-0 max-w-[180px] text-right">
                <p className="text-sm font-semibold text-[#030213]">{own.backBy ? `Back by ${fmtDay(own.backBy)}` : own.days}</p>
                {own.backBy && <p className="text-[11px] leading-snug text-[#5A5A6A]">{own.days}</p>}
              </div>
            )}
          </div>
          {details.length > 0 && (
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 rounded-xl border border-[#ECECF2] px-3.5 py-3">
              {details.map(d => (
                <div key={d.label} className={`min-w-0 ${d.value.length > 34 ? 'col-span-2' : ''}`}>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A6A]">{d.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[#030213] leading-snug">{d.value} {d.src && d.src !== 'You' && <SourceTag src={d.src} />}</dd>
                </div>
              ))}
            </dl>
          )}
          {!readOnly && (
            <div className="mt-3 flex items-center gap-1">
              <button type="button" onClick={() => go(`svc:${item.id}:${firstSlot.id}`)} aria-label={`Edit ${title}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#2F62D6] border border-[#DCE6FD] bg-white hover:bg-[#EEF4FF] motion-safe:transition-colors ${FOCUS}`}><Pencil className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />Edit</button>
              <button type="button" onClick={() => removeItem(item.id)} aria-label={`Remove ${title}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] motion-safe:transition-colors ${FOCUS}`}><Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />Remove</button>
            </div>
          )}
        </div>
      </div>
      <ServiceNote item={item} className="mt-4 pt-3 border-t border-[#F0EFF6]" />
      {itemNotes.length > 0 && !readOnly && <div className="mt-3 space-y-2">{itemNotes.map(n => <NoteView key={n.id} note={n} onDismiss={() => dismissNote(n.id)} />)}</div>}
    </Card>
  );
}

/** One cell of the facts band: icon and label (with an optional Edit), value, a muted line. */
function Fact({ icon: Icon, label, value, sub, onEdit, gap, big }: {
  icon: LucideIcon; label: string; value: string; sub?: ReactNode; onEdit?: () => void; gap?: boolean; big?: boolean;
}) {
  return (
    <div className={`min-w-0 px-4 py-3 first:rounded-l-2xl last:rounded-r-2xl ${gap ? 'bg-[#FFF8E1]' : ''}`}>
      <dt className="flex items-center gap-1.5 h-5 text-[10px] font-bold uppercase tracking-widest text-[#5A5A6A]">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${gap ? 'text-[#B45309]' : 'text-[#2F62D6]'}`} strokeWidth={1.75} aria-hidden />
        <span className="truncate">{label}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className={`ml-auto -mr-1.5 p-1 rounded text-[#4A4A5A] hover:text-[#030213] hover:bg-white ${FOCUS}`}>
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </dt>
      <dd title={value} className={`mt-1 font-semibold text-[#030213] ${big ? 'text-lg leading-6 tabular-nums truncate' : 'text-sm leading-snug line-clamp-2'}`}>{value}</dd>
      {sub && <dd className="mt-0.5 text-[11px] leading-snug text-[#5A5A6A]">{sub}</dd>}
    </div>
  );
}

/** A small labelled card in the details grid; amber while its step needs an answer. */
function Detail({ icon: Icon, label, children, sub, onEdit, gap }: {
  icon: LucideIcon; label: string; children: ReactNode; sub?: ReactNode; onEdit?: () => void; gap?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${gap ? 'border-[#F5D98B] bg-[#FFFBEB]' : 'border-[#E0E0E6] bg-white'}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${gap ? 'bg-[#FFF8E1] text-[#B45309]' : 'bg-[#EEF4FF] text-[#2F62D6]'}`}>
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </span>
        <p className="flex-1 min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-[#5A5A6A]">{label}</p>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className={`p-1 rounded text-[#4A4A5A] hover:text-[#030213] hover:bg-[#F8F9FC] ${FOCUS}`}>
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="mt-1.5 text-sm font-medium text-[#030213] leading-snug line-clamp-2">{children}</div>
      {sub && <div className="mt-1 text-xs text-[#4A4A5A] leading-snug">{sub}</div>}
    </div>
  );
}

function SectionLabel({ id, children }: { id: string; children: ReactNode }) {
  return <h3 id={id} className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A6A]">{children}</h3>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** What both layouts read: the gaps, the send mode and the delivery checks. */
function reviewFacts(api: Api) {
  const { draft, ctx, steps, dates, user, prescriber } = api;
  return {
    gapNodes: steps.filter(s => s.gap && s.navigable),
    allGaps: steps.filter(s => s.gap),
    mode: sendMode(user, prescriber),
    follow: recordsState(draft, ctx) === 'follow',
    fit: draft.fit && dates.backBy ? fitCheck(draft.fit, dates.backBy) : null,
    split: splitSuggestion(draft, ctx, dates),
  };
}

/** The band's back-by cell: the day, and how it's counted. */
function backFact(api: Api): { value: string; sub: string } {
  const { dates, lab } = api;
  if (dates.route === 'follow' && dates.ta != null) {
    return { value: dates.backBy ? fmtDay(dates.backBy) : plural(dates.ta, 'working day'), sub: dates.backBy ? `if the scan arrives by ${fmtCutoff(lab.cutoffMin)} today` : 'after the scan arrives' };
  }
  if (dates.backBy) return { value: fmtDay(dates.backBy), sub: plural(dates.ta ?? 0, 'working day') };
  return { value: '—', sub: 'once every item can be made' };
}

/** The Delivery card's lead: how the lab gets the work, and when. */
function receiveText(api: Api): string {
  const { dates, draft, ctx } = api;
  const when = dates.received ? (sameDay(dates.received, ctx.now) ? 'today' : fmtDay(dates.received)) : '—';
  if (dates.route === 'post') return `Posted · received ${when}`;
  if (dates.route === 'follow') return 'Received when the scan arrives';
  return recordsState(draft, ctx) === 'none' ? 'Received once the scans source is set' : `Digital · received ${when}`;
}

/** A service's own dates: its back-by day and lead time ("7 working days"); null until the lab can make it. */
function ownDates(api: Api, itemId: string): { backBy?: Date; days: string } | null {
  const per = api.dates.perItem.find(x => x.id === itemId);
  if (!per || per.ta == null) return null;
  return { backBy: per.backBy, days: `${plural(per.ta, 'working day')}${api.dates.route === 'follow' ? ' after the scan arrives' : ''}` };
}

export { parseStep };

/** The merged Case Instructions, folded to its first line; opens to the editable box (Merge Again, Undo). */
function InstructionsFold() {
  const { draft, user, readOnly } = useCase();
  const text = caseInstructions(draft, user.notation).trim();
  const stale = instructionsStale(draft, user.notation);
  const [open, setOpen] = useState(stale);
  if (open) return <Card className="p-4 nc-accordion-in"><CaseInstructionsBox /></Card>;
  return (
    <Card className="p-0">
      <button type="button" aria-expanded={false} onClick={() => setOpen(true)} disabled={readOnly && !text} className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-2xl disabled:cursor-default ${FOCUS}`}>
        <MessageSquareText className="w-4 h-4 text-[#2F62D6] flex-shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium text-[#030213]">Case Instructions</span>
          <span className="text-[#5A5A6A]"> · {text ? text.split('\n')[0] : readOnly ? 'None' : 'None yet · optional'}</span>
        </span>
        {!readOnly && <ChevronDown className="w-4 h-4 text-[#5A5A6A] flex-shrink-0" aria-hidden />}
      </button>
    </Card>
  );
}
